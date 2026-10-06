/* عميل واحد: بياناته، وطلباته من الموقع، وصفقاته، وسجلّ التعامل معه (ملاحظات
   ومكالمات). ومنها تُفتح صفقة جديدة له. */
import { notFound, redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { q, q1, tx, when } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { ConfirmButton } from '@/components/ConfirmButton';
import { can } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { normPhone, money, STAGE_AR, STAGE_TAG, EVENT_AR, eraseCustomer } from '@/lib/customers';
import { clip, STATUS_AR, STATUS_TAG, KIND_AR } from '@/lib/requests';

export const dynamic = 'force-dynamic';

const MSG: Record<string, [string, boolean]> = {
  created: ['أُضيف العميل.', true],
  exists: ['هذا الرقم مسجّل من قبل — هذا عميله.', true],
  saved: ['حُفظت البيانات.', true],
  note: ['أُضيفت.', true],
  deal: ['فُتحت صفقة جديدة.', true],
  dup: ['هذا الرقم مسجّل لعميل آخر.', false],
  need: ['اكتب رقم موبايل صحيح أو بريدًا.', false],
};

export default async function CustomerPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; e?: string }> }) {
  const me = await requirePerm('customers.view');
  const id = Number((await params).id);
  const sp = await searchParams;
  const c = await q1<any>('SELECT * FROM customers WHERE id = ?', [id]);
  if (!c) notFound();
  const [requests, deals, events, staff] = await Promise.all([
    q<any>('SELECT id, kind, status, items, created_at FROM requests WHERE customer_id = ? ORDER BY id DESC', [id]),
    can(me, 'deals.view')
      ? q<any>('SELECT d.*, u.name AS owner FROM deals d LEFT JOIN users u ON u.id = d.owner_id WHERE d.customer_id = ? ORDER BY d.id DESC', [id])
      : Promise.resolve([]),
    q<any>(`SELECT e.*, u.name AS who FROM customer_events e LEFT JOIN users u ON u.id = e.user_id
             WHERE e.customer_id = ? AND e.kind IN ('note','call','edit','stage','deal') ORDER BY e.id DESC LIMIT 100`, [id]),
    q<any>('SELECT id, name, email FROM users WHERE active = 1 ORDER BY name'),
  ]);
  const edit = can(me, 'customers.edit');

  async function save(form: FormData) {
    'use server';
    const u = await requirePerm('customers.edit');
    const before = await q1<any>('SELECT * FROM customers WHERE id = ?', [id]);
    if (!before) redirect('/admin/customers');
    const phone = clip(form.get('phone'), 40);
    const pn = normPhone(phone);
    const email = clip(form.get('email'), 160)?.toLowerCase() ?? null;
    if (!pn && !email) redirect(`/admin/customers/${id}?e=need`);
    if (pn && await q1('SELECT id FROM customers WHERE phone_norm = ? AND id <> ?', [pn, id])) redirect(`/admin/customers/${id}?e=dup`);
    const owner = Number(form.get('owner_id')) || null;
    const next = {
      name: clip(form.get('name'), 120), phone, phone_norm: pn, email,
      company: clip(form.get('company'), 160), city: clip(form.get('city'), 100), notes: clip(form.get('notes'), 4000), owner_id: owner,
    };
    await q(`UPDATE customers SET name = ?, phone = ?, phone_norm = ?, email = ?, company = ?, city = ?, notes = ?, owner_id = ? WHERE id = ?`,
      [next.name, next.phone, next.phone_norm, next.email, next.company, next.city, next.notes, next.owner_id, id]);
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => k !== 'phone_norm' && (before[k] ?? null) !== (next[k] ?? null));
    if (changed.length) {
      const LBL: Record<string, string> = { name: 'الاسم', phone: 'الموبايل', email: 'البريد', company: 'الشركة', city: 'المدينة', notes: 'الملاحظات', owner_id: 'المسؤول' };
      await q("INSERT INTO customer_events (customer_id, user_id, kind, text) VALUES (?, ?, 'edit', ?)", [id, u.id, `غيّر ${changed.map((k) => LBL[k]).join('، ')}`]);
      await audit(u, 'customer.update', { entity: 'customer', id, summary: `${next.name ?? next.phone ?? ''}: ${changed.map((k) => LBL[k]).join('، ')}` });
    }
    redirect(`/admin/customers/${id}?ok=saved`);
  }

  async function addNote(form: FormData) {
    'use server';
    const u = await requirePerm('customers.edit');
    const text = clip(form.get('text'), 2000);
    const kind = form.get('kind') === 'call' ? 'call' : 'note';
    if (!text) redirect(`/admin/customers/${id}`);
    await q('INSERT INTO customer_events (customer_id, user_id, kind, text) VALUES (?,?,?,?)', [id, u.id, kind, text]);
    await q('UPDATE customers SET last_contact_at = NOW() WHERE id = ?', [id]);
    await audit(u, 'customer.note', { entity: 'customer', id });
    redirect(`/admin/customers/${id}?ok=note`);
  }

  async function newDeal(form: FormData) {
    'use server';
    const u = await requirePerm('deals.edit');
    const title = clip(form.get('title'), 250);
    if (!title) redirect(`/admin/customers/${id}`);
    const value = Number(String(form.get('value') ?? '').replace(/[^\d.]/g, '')) || null;
    const dealId = await tx(async (db) => {
      const res = await db.q(
        `INSERT INTO deals (customer_id, title, value, stage, owner_id, expected_close, created_by) VALUES (?,?,?, 'lead', ?, ?, ?)`,
        [id, title, value, u.id, /^\d{4}-\d{2}-\d{2}$/.test(String(form.get('expected_close'))) ? form.get('expected_close') : null, u.id]
      ) as unknown as { insertId: number };
      await db.q("INSERT INTO customer_events (customer_id, user_id, kind, deal_id, text) VALUES (?, ?, 'deal', ?, ?)", [id, u.id, res.insertId, title]);
      return res.insertId;
    });
    await audit(u, 'deal.create', { entity: 'deal', id: dealId, summary: `${title}${value ? ` — ${money(value)}` : ''}` });
    redirect(`/admin/deals/${dealId}?ok=created`);
  }

  async function remove() {
    'use server';
    const u = await requirePerm('customers.delete');
    await tx((db) => eraseCustomer(id, db));
    /* السجل بلا بيانات شخصية: رقم العميل فقط */
    await audit(u, 'customer.delete', { entity: 'customer', id, summary: `عميل #${id}` });
    redirect('/admin/customers?ok=deleted');
  }

  const msg = sp.ok ? MSG[sp.ok] : sp.e ? MSG[sp.e] : null;
  const wa = c.phone_norm ? c.phone_norm.replace(/^0(?=1\d{9}$)/, '20') : '';
  const items = (v: any) => { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a : []; } catch { return []; } };
  const owner = staff.find((s) => s.id === c.owner_id);

  return (
    <Shell user={me} here="/admin/customers" title={c.name || c.company || c.phone || c.email}
           trail={[{ label: 'لوحة التحكم', href: '/admin' }, { label: 'العملاء', href: '/admin/customers' }]}
           sub={`${c.company ? `${c.company} · ` : ''}عميل منذ ${when(c.created_at)}${owner ? ` · مسؤوله: ${owner.name || owner.email}` : ''}`}>
      {msg ? <p className={`msg ${msg[1] ? 'msg--ok' : 'msg--bad'}`}>{msg[0]}</p> : null}

      <div className="reqgrid">
        <div>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel__head">
              <h2>التواصل</h2>
              <span style={{ display: 'flex', gap: 6 }}>
                {c.phone ? <a className="btn btn--sm" href={`tel:${c.phone}`}>اتصل</a> : null}
                {wa ? <a className="btn btn--sm btn--ghost" href={`https://wa.me/${wa}`} target="_blank" rel="noopener">واتساب ↗</a> : null}
                {c.email ? <a className="btn btn--sm btn--ghost" href={`mailto:${c.email}`}>بريد</a> : null}
              </span>
            </div>
            <div className="panel__body">
              {edit ? (
                <form action={save}>
                  <div className="row">
                    <div className="field"><label htmlFor="name">الاسم</label><input id="name" name="name" type="text" defaultValue={c.name ?? ''} /></div>
                    <div className="field"><label htmlFor="company">الشركة</label><input id="company" name="company" type="text" defaultValue={c.company ?? ''} /></div>
                  </div>
                  <div className="row">
                    <div className="field"><label htmlFor="phone">الموبايل</label><input id="phone" name="phone" type="tel" dir="ltr" defaultValue={c.phone ?? ''} /></div>
                    <div className="field"><label htmlFor="email">البريد</label><input id="email" name="email" type="email" dir="ltr" defaultValue={c.email ?? ''} /></div>
                  </div>
                  <div className="row">
                    <div className="field"><label htmlFor="city">المدينة</label><input id="city" name="city" type="text" defaultValue={c.city ?? ''} /></div>
                    <div className="field">
                      <label htmlFor="owner_id">المسؤول عنه</label>
                      <select id="owner_id" name="owner_id" defaultValue={c.owner_id ?? ''}>
                        <option value="">بلا مسؤول</option>
                        {staff.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="field"><label htmlFor="notes">ملاحظات ثابتة</label><textarea id="notes" name="notes" defaultValue={c.notes ?? ''} placeholder="ما يجب أن يعرفه كل من يكلّمه" /></div>
                  <button className="btn btn--sm" type="submit">احفظ</button>
                </form>
              ) : (
                <table className="kv"><tbody>
                  <tr><th>الموبايل</th><td dir="ltr">{c.phone ?? '—'}</td></tr>
                  <tr><th>البريد</th><td dir="ltr">{c.email ?? '—'}</td></tr>
                  <tr><th>المدينة</th><td>{c.city ?? '—'}</td></tr>
                  {c.notes ? <tr><th>ملاحظات</th><td>{c.notes}</td></tr> : null}
                </tbody></table>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel__head"><h2>سجلّ التعامل</h2></div>
            <div className="panel__body">
              {edit ? (
                <form action={addNote} style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <select name="kind" aria-label="النوع" style={{ width: 'auto' }}>
                    <option value="call">مكالمة</option>
                    <option value="note">ملاحظة</option>
                  </select>
                  <input name="text" type="text" placeholder="كلّمته وطلب عرض بالسعر يوم الأحد…" aria-label="ماذا حدث" style={{ flex: 1, minWidth: 200 }} />
                  <button className="btn btn--sm" type="submit">أضف</button>
                </form>
              ) : null}
              {events.length ? (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {events.map((e) => (
                    <li key={e.id} style={{ padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 14 }}>
                      <small dir="ltr" style={{ color: 'var(--muted)' }}>{when(e.created_at)}</small>{' '}
                      <b>{e.who ?? 'النظام'}</b> — {EVENT_AR[e.kind] ?? e.kind}{e.text ? <>: {e.deal_id ? <a href={`/admin/deals/${e.deal_id}`}>{e.text}</a> : e.text}</> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="field__hint" style={{ margin: 0 }}>لا شيء بعد. سجّل كل مكالمة هنا فيعرف زميلك ما جرى.</p>}
            </div>
          </div>
        </div>

        <div>
          {can(me, 'deals.view') ? (
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel__head"><h2>الصفقات ({deals.length})</h2></div>
              <div className="panel__body">
                {deals.length ? (
                  <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0 }}>
                    {deals.map((d) => (
                      <li key={d.id} style={{ padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 14 }}>
                        <a href={`/admin/deals/${d.id}`}><b>{d.title}</b></a><br />
                        <span className={`tag ${STAGE_TAG[d.stage] ?? ''}`}>{STAGE_AR[d.stage] ?? d.stage}</span> <small>{money(d.value, d.currency)}</small>
                      </li>
                    ))}
                  </ul>
                ) : <p className="field__hint" style={{ marginTop: 0 }}>لا صفقات بعد.</p>}
                {can(me, 'deals.edit') ? (
                  <form action={newDeal}>
                    <div className="field"><label htmlFor="title">صفقة جديدة</label><input id="title" name="title" type="text" required placeholder="مولد 500 kVA للمصنع" /></div>
                    <div className="row">
                      <div className="field"><label htmlFor="value">القيمة المتوقعة (ج.م)</label><input id="value" name="value" type="text" inputMode="decimal" dir="ltr" /></div>
                      <div className="field"><label htmlFor="expected_close">تُقفل غالبًا يوم</label><input id="expected_close" name="expected_close" type="date" /></div>
                    </div>
                    <button className="btn btn--sm" type="submit">افتح الصفقة</button>
                  </form>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel__head"><h2>طلباته من الموقع ({requests.length})</h2></div>
            <div className="panel__body">
              {requests.length ? (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {requests.map((r) => (
                    <li key={r.id} style={{ padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 14 }}>
                      {can(me, 'requests.view') ? <a href={`/admin/requests/${r.id}`}>#{r.id}</a> : <>#{r.id}</>} {KIND_AR[r.kind] ?? r.kind}{' '}
                      <span className={`tag ${STATUS_TAG[r.status] ?? ''}`}>{STATUS_AR[r.status] ?? r.status}</span>
                      <br /><small dir="ltr">{when(r.created_at)}</small>
                      {items(r.items).length ? <small> · {items(r.items).map((i: any) => `${i.name} × ${i.qty}`).join('، ')}</small> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="field__hint" style={{ margin: 0 }}>لم يطلب من الموقع بعد.</p>}
            </div>
          </div>

          {can(me, 'customers.delete') ? (
            <form action={remove}>
              <ConfirmButton className="btn btn--bad btn--sm"
                             message="حذف العميل نهائيًا؟ تُمسح بياناته وملاحظاته وصفقاته، وتُمسح بياناته الشخصية من طلباته. لا يمكن استعادته.">
                احذف العميل وبياناته
              </ConfirmButton>
              <p className="field__hint">حين يطلب العميل مسح بياناته (حقه في القانون 151/2020).</p>
            </form>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}
