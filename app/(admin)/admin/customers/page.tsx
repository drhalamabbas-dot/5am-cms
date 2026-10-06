/* العملاء: كل من طلب من الموقع أو أضافه موظف — مرة واحدة لكل رقم موبايل.
   بحث، و«عملائي»، و«عندهم صفقة مفتوحة»، وإضافة عميل يدويًا (مكالمة أو زيارة).
   ملف العملاء (إكسيل) ومدة الاحتفاظ بالبيانات للسوبر أدمن وحده. */
import { redirect } from 'next/navigation';
import { requirePerm, requireSuper } from '@/lib/auth';
import { q, q1, when } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { can, isSuper } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { normPhone, money, OPEN_STAGES, getRetentionMonths } from '@/lib/customers';
import { clip } from '@/lib/requests';
import { refreshSite } from '@/lib/admin';

export const dynamic = 'force-dynamic';

type SP = { q?: string; f?: string; ok?: string; e?: string; id?: string };

const MSG: Record<string, [string, boolean]> = {
  deleted: ['حُذف العميل وبياناته الشخصية نهائيًا.', true],
  privacy: ['حُفظت مدة الاحتفاظ.', true],
  need: ['اكتب رقم موبايل صحيح أو بريدًا.', false],
};

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requirePerm('customers.view');
  const sp = await searchParams;
  const term = (sp.q ?? '').trim();
  const where: string[] = [];
  const args: unknown[] = [];
  if (sp.f === 'mine') { where.push('c.owner_id = ?'); args.push(me.id); }
  if (sp.f === 'open') where.push(`EXISTS (SELECT 1 FROM deals d WHERE d.customer_id = c.id AND d.stage IN (${OPEN_STAGES.map(() => '?').join(',')}))`), args.push(...OPEN_STAGES);
  if (term) {
    const pn = normPhone(term);
    where.push(`(c.name LIKE ? OR c.company LIKE ? OR c.email LIKE ? OR c.city LIKE ?${pn ? ' OR c.phone_norm LIKE ?' : ''})`);
    args.push(...Array(4).fill(`%${term}%`), ...(pn ? [`%${pn}%`] : []));
  }
  const rows = await q<any>(
    `SELECT c.id, c.name, c.company, c.phone, c.email, c.city, c.last_contact_at, c.created_at, u.name AS owner,
            (SELECT COUNT(*) FROM requests r WHERE r.customer_id = c.id) AS reqs,
            (SELECT COUNT(*) FROM deals d WHERE d.customer_id = c.id AND d.stage IN ('lead','quoted','negotiation')) AS open_deals,
            (SELECT SUM(d.value) FROM deals d WHERE d.customer_id = c.id AND d.stage IN ('lead','quoted','negotiation')) AS open_value
       FROM customers c LEFT JOIN users u ON u.id = c.owner_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY COALESCE(c.last_contact_at, c.created_at) DESC LIMIT 300`, args
  );
  const total = (await q1<any>('SELECT COUNT(*) n FROM customers'))?.n ?? 0;
  const months = await getRetentionMonths();
  const edit = can(me, 'customers.edit');

  async function create(form: FormData) {
    'use server';
    const u = await requirePerm('customers.edit');
    const phone = clip(form.get('phone'), 40);
    const pn = normPhone(phone);
    const email = clip(form.get('email'), 160)?.toLowerCase() ?? null;
    if (!pn && !(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) redirect('/admin/customers?e=need');
    /* الرقم مسجّل؟ يُفتح عميله بدل عميل مكرّر */
    const dup = pn ? await q1<any>('SELECT id FROM customers WHERE phone_norm = ?', [pn]) : null;
    if (dup) redirect(`/admin/customers/${dup.id}?ok=exists`);
    const name = clip(form.get('name'), 120);
    const res = await q(
      `INSERT INTO customers (name, phone, phone_norm, email, company, city, notes, source, owner_id, created_by, last_contact_at)
       VALUES (?,?,?,?,?,?,?, 'manual', ?, ?, NOW())`,
      [name, phone, pn, email, clip(form.get('company'), 160), clip(form.get('city'), 100), clip(form.get('notes'), 4000), u.id, u.id]
    ) as unknown as { insertId: number };
    await audit(u, 'customer.create', { entity: 'customer', id: res.insertId, summary: name ?? phone ?? email ?? '' });
    redirect(`/admin/customers/${res.insertId}?ok=created`);
  }

  async function savePrivacy(form: FormData) {
    'use server';
    const u = await requireSuper();
    const m = Number(form.get('months'));
    const months2 = [0, 6, 12, 24, 36, 60].includes(m) ? m : 24;
    const before = await getRetentionMonths();
    await q(`INSERT INTO settings (\`key\`, \`value\`, \`group\`, label_en, label_ar) VALUES ('privacy', ?, 'privacy', 'Customer data retention', 'مدة الاحتفاظ ببيانات العملاء')
             ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`, [JSON.stringify({ retentionMonths: months2 })]);
    await audit(u, 'privacy.save', { entity: 'setting', id: 'privacy', summary: `${before || 'بلا حد'} ← ${months2 || 'بلا حد'} شهر` });
    refreshSite();
    redirect('/admin/customers?ok=privacy');
  }

  const msg = sp.ok ? MSG[sp.ok] : sp.e ? MSG[sp.e] : null;
  const tab = (f: string | undefined, label: string) => {
    const u = new URLSearchParams();
    if (f) u.set('f', f);
    if (term) u.set('q', term);
    return <a className={`btn btn--sm ${sp.f === f ? '' : 'btn--ghost'}`} href={`/admin/customers${u.size ? `?${u}` : ''}`}>{label}</a>;
  };

  return (
    <Shell user={me} here="/admin/customers" title="العملاء" trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub={`${total} عميل. كل من طلب من الموقع يُضاف هنا تلقائيًا، مرة واحدة لكل رقم موبايل.`}
           actions={isSuper(me) ? <a className="btn btn--ghost" href="/api/admin/customers/export">ملف العملاء (Excel)</a> : null}>
      {msg ? <p className={`msg ${msg[1] ? 'msg--ok' : 'msg--bad'}`}>{msg[0]}</p> : null}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__body" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {tab(undefined, 'الكل')}{tab('mine', 'عملائي')}{tab('open', 'عندهم صفقة مفتوحة')}
          <span style={{ flex: 1 }} />
          <form method="get" style={{ display: 'flex', gap: 6 }}>
            {sp.f ? <input type="hidden" name="f" value={sp.f} /> : null}
            <input type="search" name="q" defaultValue={term} placeholder="اسم، موبايل، شركة، مدينة…" aria-label="ابحث في العملاء" style={{ width: 240 }} />
            <button className="btn btn--sm btn--ghost" type="submit">ابحث</button>
          </form>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        {rows.length ? (
          <table>
            <thead><tr><th>العميل</th><th>الموبايل</th><th>الطلبات</th><th>صفقات مفتوحة</th><th>المسؤول</th><th>آخر تواصل</th><th /></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><a href={`/admin/customers/${c.id}`}><strong>{c.name || c.company || c.phone || c.email}</strong></a>
                    {c.company && c.name ? <><br /><small>{c.company}</small></> : null}
                    {c.city ? <small> · {c.city}</small> : null}</td>
                  <td><small dir="ltr">{c.phone || c.email || '—'}</small></td>
                  <td>{c.reqs || '—'}</td>
                  <td>{c.open_deals ? <>{c.open_deals} <small>({money(c.open_value)})</small></> : '—'}</td>
                  <td><small>{c.owner ?? '—'}</small></td>
                  <td><small dir="ltr">{when(c.last_contact_at ?? c.created_at)}</small></td>
                  <td style={{ textAlign: 'end' }}><a className="btn btn--ghost btn--sm" href={`/admin/customers/${c.id}`}>افتح</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="panel__body"><p style={{ margin: 0 }}>{term || sp.f ? 'لا عملاء بهذا البحث.' : 'لا عملاء بعد — يظهرون هنا مع أول طلب من الموقع، أو أضف عميلًا من تحت.'}</p></div>}
      </div>

      {edit ? (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head"><h2>إضافة عميل</h2></div>
          <div className="panel__body">
            <form action={create}>
              <div className="row">
                <div className="field"><label htmlFor="name">الاسم</label><input id="name" name="name" type="text" /></div>
                <div className="field"><label htmlFor="company">الشركة</label><input id="company" name="company" type="text" /></div>
              </div>
              <div className="row">
                <div className="field"><label htmlFor="phone">الموبايل</label><input id="phone" name="phone" type="tel" dir="ltr" /></div>
                <div className="field"><label htmlFor="email">البريد</label><input id="email" name="email" type="email" dir="ltr" /></div>
              </div>
              <div className="row">
                <div className="field"><label htmlFor="city">المدينة</label><input id="city" name="city" type="text" /></div>
                <div className="field"><label htmlFor="notes">ملاحظات</label><input id="notes" name="notes" type="text" placeholder="من أين عرفنا، ماذا يحتاج…" /></div>
              </div>
              <button className="btn" type="submit">أضف العميل</button>
              <p className="field__hint">لعميل كلّمنا بالتليفون أو زارنا. أبلغه أننا نحفظ بياناته للتواصل معه بخصوص طلبه.</p>
            </form>
          </div>
        </div>
      ) : null}

      {isSuper(me) ? (
        <div className="panel">
          <div className="panel__head"><h2>مدة الاحتفاظ ببيانات العملاء</h2></div>
          <div className="panel__body">
            <form action={savePrivacy} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="months">العميل الذي لم يتعامل معنا خلال</label>
                <select id="months" name="months" defaultValue={String(months)}>
                  {[[6, '6 أشهر'], [12, 'سنة'], [24, 'سنتين'], [36, '3 سنوات'], [60, '5 سنوات'], [0, 'لا تمسح تلقائيًا']].map(([v, l]) =>
                    <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <button className="btn btn--ghost" type="submit">احفظ</button>
            </form>
            <p className="field__hint">
              تُمسح بياناته الشخصية تلقائيًا (ومعها ملاحظاته وصفقاته المغلقة)، وتبقى أعداد الطلبات للإحصاء. لا يُمسح من له طلب أو صفقة مفتوحة.
              قانون حماية البيانات الشخصية (151/2020) يطلب ألا تُحفظ البيانات أطول من الحاجة إليها.
            </p>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
