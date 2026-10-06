/* صفقة واحدة: عنوانها وقيمتها ومرحلتها ومسؤولها وموعد إقفالها، وسبب الخسارة إن
   خُسرت، وما جرى عليها. */
import { notFound, redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { q, q1, when } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { ConfirmButton } from '@/components/ConfirmButton';
import { can } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { STAGES, STAGE_AR, STAGE_TAG, EVENT_AR, money, isStage } from '@/lib/customers';
import { clip } from '@/lib/requests';

export const dynamic = 'force-dynamic';

export default async function DealPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const me = await requirePerm('deals.view');
  const id = Number((await params).id);
  const sp = await searchParams;
  const d = await q1<any>(
    `SELECT d.*, COALESCE(c.name, c.company, c.phone) AS customer, c.phone, c.company FROM deals d
       JOIN customers c ON c.id = d.customer_id WHERE d.id = ?`, [id]
  );
  if (!d) notFound();
  const [events, staff] = await Promise.all([
    q<any>(`SELECT e.*, u.name AS who FROM customer_events e LEFT JOIN users u ON u.id = e.user_id
             WHERE e.deal_id = ? ORDER BY e.id DESC`, [id]),
    q<any>('SELECT id, name, email FROM users WHERE active = 1 ORDER BY name'),
  ]);
  const edit = can(me, 'deals.edit');

  async function save(form: FormData) {
    'use server';
    const u = await requirePerm('deals.edit');
    const before = await q1<any>('SELECT * FROM deals WHERE id = ?', [id]);
    if (!before) redirect('/admin/deals');
    const stage = isStage(form.get('stage')) ? String(form.get('stage')) : before.stage;
    const closed = stage === 'won' || stage === 'lost';
    const date = String(form.get('expected_close') ?? '');
    const raw = String(form.get('value') ?? '').replace(/[^\d.]/g, '');
    const next = {
      title: clip(form.get('title'), 250) ?? before.title,
      value: raw ? Number(raw) : null,
      owner_id: Number(form.get('owner_id')) || null,
      expected_close: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      lost_reason: stage === 'lost' ? clip(form.get('lost_reason'), 250) : null,
      notes: clip(form.get('notes'), 4000),
    };
    await q(
      `UPDATE deals SET title = ?, value = ?, owner_id = ?, expected_close = ?, lost_reason = ?, notes = ?, stage = ?,
         closed_at = ${closed ? (before.stage === stage ? 'closed_at' : 'NOW()') : 'NULL'} WHERE id = ?`,
      [next.title, next.value, next.owner_id, next.expected_close, next.lost_reason, next.notes, stage, id]
    );
    if (stage !== before.stage) {
      const text = `${next.title}: ${STAGE_AR[before.stage]} ← ${STAGE_AR[stage]}${next.lost_reason ? ` (${next.lost_reason})` : ''}`;
      await q("INSERT INTO customer_events (customer_id, user_id, kind, deal_id, text) VALUES (?, ?, 'stage', ?, ?)", [before.customer_id, u.id, id, text]);
      await audit(u, 'deal.stage', { entity: 'deal', id, summary: text });
    }
    await audit(u, 'deal.update', { entity: 'deal', id, summary: next.title,
      before: { title: before.title, value: before.value, owner_id: before.owner_id, expected_close: before.expected_close }, after: next });
    await q('UPDATE customers SET last_contact_at = NOW() WHERE id = ?', [before.customer_id]);
    redirect(`/admin/deals/${id}?ok=saved`);
  }

  async function remove() {
    'use server';
    const u = await requirePerm('deals.edit');
    const before = await q1<any>('SELECT * FROM deals WHERE id = ?', [id]);
    if (!before) redirect('/admin/deals');
    await q('DELETE FROM deals WHERE id = ?', [id]);
    await audit(u, 'deal.delete', { entity: 'deal', id, summary: before.title, before });
    redirect(`/admin/customers/${before.customer_id}`);
  }

  const dateVal = d.expected_close ? new Date(d.expected_close).toLocaleDateString('en-CA') : '';

  return (
    <Shell user={me} here="/admin/deals" title={d.title}
           trail={[{ label: 'لوحة التحكم', href: '/admin' }, { label: 'الصفقات', href: '/admin/deals' }]}
           sub={`${d.customer}${d.company && d.company !== d.customer ? ` · ${d.company}` : ''} · ${money(d.value, d.currency)} · ${STAGE_AR[d.stage]}`}
           actions={<a className="btn btn--ghost" href={`/admin/customers/${d.customer_id}`}>صفحة العميل</a>}>
      {sp.ok === 'created' ? <p className="msg msg--ok">فُتحت الصفقة. حرّكها بين المراحل مع كل خطوة.</p> : null}
      {sp.ok === 'saved' ? <p className="msg msg--ok">حُفظت.</p> : null}

      <div className="reqgrid">
        <div className="panel">
          <div className="panel__head"><h2>الصفقة</h2><span className={`tag ${STAGE_TAG[d.stage] ?? ''}`}>{STAGE_AR[d.stage]}</span></div>
          <div className="panel__body">
            <form action={save}>
              <fieldset disabled={!edit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                <div className="field"><label htmlFor="title">العنوان</label><input id="title" name="title" type="text" defaultValue={d.title} required /></div>
                <div className="row">
                  <div className="field"><label htmlFor="stage">المرحلة</label>
                    <select id="stage" name="stage" defaultValue={d.stage}>{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  </div>
                  <div className="field"><label htmlFor="value">القيمة (ج.م)</label><input id="value" name="value" type="text" inputMode="decimal" dir="ltr" defaultValue={d.value ?? ''} /></div>
                </div>
                <div className="row">
                  <div className="field"><label htmlFor="owner_id">المسؤول</label>
                    <select id="owner_id" name="owner_id" defaultValue={d.owner_id ?? ''}>
                      <option value="">بلا مسؤول</option>
                      {staff.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
                    </select>
                  </div>
                  <div className="field"><label htmlFor="expected_close">تُقفل غالبًا يوم</label><input id="expected_close" name="expected_close" type="date" defaultValue={dateVal} /></div>
                </div>
                <div className="field"><label htmlFor="lost_reason">سبب الخسارة (إن خسرناها)</label><input id="lost_reason" name="lost_reason" type="text" defaultValue={d.lost_reason ?? ''} placeholder="السعر، موعد التسليم، اختار منافسًا…" /></div>
                <div className="field"><label htmlFor="notes">ملاحظات</label><textarea id="notes" name="notes" defaultValue={d.notes ?? ''} /></div>
                {edit ? <button className="btn" type="submit">احفظ</button> : null}
              </fieldset>
            </form>
          </div>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel__head"><h2>ما جرى عليها</h2></div>
            <div className="panel__body">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {events.map((e) => (
                  <li key={e.id} style={{ padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 14 }}>
                    <small dir="ltr" style={{ color: 'var(--muted)' }}>{when(e.created_at)}</small> <b>{e.who ?? 'النظام'}</b> — {EVENT_AR[e.kind] ?? e.kind}{e.text ? `: ${e.text}` : ''}
                  </li>
                ))}
                <li style={{ padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 14 }}><small dir="ltr">{when(d.created_at)}</small> — فُتحت الصفقة</li>
              </ul>
              {d.request_id && can(me, 'requests.view') ? <p className="field__hint">من <a href={`/admin/requests/${d.request_id}`}>طلب #{d.request_id}</a></p> : null}
            </div>
          </div>
          {edit ? (
            <form action={remove}>
              <ConfirmButton className="btn btn--bad btn--sm" message="حذف الصفقة؟ (الخسارة الحقيقية الأفضل «خسرناها» مع السبب)">احذف الصفقة</ConfirmButton>
            </form>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}
