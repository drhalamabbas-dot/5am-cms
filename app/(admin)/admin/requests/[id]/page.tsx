/* طلب واحد: بيانات العميل وما طلبه، وحالته ومسؤوله، والملاحظات وسجلّ ما جرى عليه. */
import { notFound, redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { q, q1, when } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { ConfirmButton } from '@/components/ConfirmButton';
import { can } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { STATUSES, STATUS_AR, STATUS_TAG, KIND_AR, SOURCE_AR, isStatus, clearOthers, clip } from '@/lib/requests';

export const dynamic = 'force-dynamic';

const MSG: Record<string, [string, boolean]> = {
  claimed: ['الطلب معك الآن. كلّم العميل ثم غيّر الحالة.', true],
  status: ['تغيّرت الحالة.', true],
  assigned: ['حُوّل الطلب.', true],
  note: ['أُضيفت الملاحظة.', true],
  taken: ['استلمه زميل قبلك.', false],
};

async function load(id: number) {
  const r = await q1<any>('SELECT * FROM requests WHERE id = ?', [id]);
  if (!r) redirect('/admin/requests');
  return r;
}

export default async function RequestPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; e?: string }> }) {
  const me = await requirePerm('requests.view');
  const id = Number((await params).id);
  const sp = await searchParams;
  const r = await q1<any>('SELECT * FROM requests WHERE id = ?', [id]);
  if (!r) notFound();
  const [events, staff, owner] = await Promise.all([
    q<any>(`SELECT e.*, u.name AS who FROM request_events e LEFT JOIN users u ON u.id = e.user_id
             WHERE e.request_id = ? ORDER BY e.id DESC`, [id]),
    q<any>('SELECT id, name, email, role, perms FROM users WHERE active = 1 ORDER BY name'),
    r.assigned_to ? q1<any>('SELECT id, name, email, phone FROM users WHERE id = ?', [r.assigned_to]) : null,
  ]);
  const handlers = staff.filter((s) => can({ role: s.role, perms: typeof s.perms === 'string' ? JSON.parse(s.perms) : s.perms }, 'requests.handle'));
  const items: any[] = (() => { try { const a = typeof r.items === 'string' ? JSON.parse(r.items) : r.items; return Array.isArray(a) ? a : []; } catch { return []; } })();
  const handle = can(me, 'requests.handle');
  /* أول من يفتح الطلب بعد وصوله يُعلَّم تنبيهه مقروءًا */
  await q('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND request_id = ? AND read_at IS NULL', [me.id, id]);

  async function claim() {
    'use server';
    const u = await requirePerm('requests.handle');
    const res = await q('UPDATE requests SET assigned_to = ?, claimed_at = NOW() WHERE id = ? AND assigned_to IS NULL', [u.id, id]) as unknown as { affectedRows: number };
    if (!res.affectedRows) redirect(`/admin/requests/${id}?e=taken`);
    await q("INSERT INTO request_events (request_id, user_id, kind) VALUES (?, ?, 'claim')", [id, u.id]);
    await clearOthers(id, u.id);
    await audit(u, 'request.claim', { entity: 'request', id });
    redirect(`/admin/requests/${id}?ok=claimed`);
  }

  async function setStatus(form: FormData) {
    'use server';
    const u = await requirePerm('requests.handle');
    const cur = await load(id);
    const to = String(form.get('status'));
    if (!isStatus(to) || to === cur.status) redirect(`/admin/requests/${id}`);
    const note = clip(form.get('note'), 1000);
    const closed = to === 'done' || to === 'cancelled';
    /* من يغيّر حالة طلب بلا مسؤول يصير مسؤوله */
    await q(`UPDATE requests SET status = ?, closed_at = ${closed ? 'NOW()' : 'NULL'}${cur.assigned_to ? '' : ', assigned_to = ?, claimed_at = NOW()'} WHERE id = ?`,
      cur.assigned_to ? [to, id] : [to, u.id, id]);
    await q("INSERT INTO request_events (request_id, user_id, kind, from_status, to_status, note) VALUES (?, ?, 'status', ?, ?, ?)",
      [id, u.id, cur.status, to, note]);
    if (!cur.assigned_to) await clearOthers(id, u.id);
    await audit(u, 'request.status', { entity: 'request', id, summary: `#${id}: ${STATUS_AR[cur.status]} ← ${STATUS_AR[to]}` });
    redirect(`/admin/requests/${id}?ok=status`);
  }

  async function assign(form: FormData) {
    'use server';
    const u = await requirePerm('requests.handle');
    const cur = await load(id);
    const to = Number(form.get('to')) || null;
    if (to === cur.assigned_to) redirect(`/admin/requests/${id}`);
    const target = to ? await q1<any>('SELECT id, name, email FROM users WHERE id = ? AND active = 1', [to]) : null;
    if (to && !target) redirect(`/admin/requests/${id}`);
    await q('UPDATE requests SET assigned_to = ?, claimed_at = ? WHERE id = ?', [to, to ? new Date() : null, id]);
    await q("INSERT INTO request_events (request_id, user_id, kind, note) VALUES (?, ?, 'assign', ?)",
      [id, u.id, target ? `إلى ${target.name || target.email}` : 'بلا مسؤول']);
    if (target && target.id !== u.id) {
      await q('INSERT INTO notifications (user_id, kind, title, body, link, request_id) VALUES (?,?,?,?,?,?)',
        [target.id, 'request.assigned', `حُوّل إليك طلب #${id}`, `من ${u.name || u.email}`, `/admin/requests/${id}`, id]);
    }
    if (target) await clearOthers(id, target.id);
    await audit(u, 'request.assign', { entity: 'request', id, summary: `#${id} ${target ? `إلى ${target.name || target.email}` : 'بلا مسؤول'}` });
    redirect(`/admin/requests/${id}?ok=assigned`);
  }

  async function addNote(form: FormData) {
    'use server';
    const u = await requirePerm('requests.handle');
    const note = clip(form.get('note'), 2000);
    if (!note) redirect(`/admin/requests/${id}`);
    await q("INSERT INTO request_events (request_id, user_id, kind, note) VALUES (?, ?, 'note', ?)", [id, u.id, note]);
    await audit(u, 'request.note', { entity: 'request', id });
    redirect(`/admin/requests/${id}?ok=note`);
  }

  async function remove() {
    'use server';
    const u = await requirePerm('requests.delete');
    const cur = await load(id);
    await q('DELETE FROM notifications WHERE request_id = ?', [id]);
    await q('DELETE FROM requests WHERE id = ?', [id]);
    /* بيانات العميل لا تُنسخ في السجل: يكفي أنه حُذف ومتى ومن حذفه */
    await audit(u, 'request.delete', { entity: 'request', id, summary: `#${id} (${KIND_AR[cur.kind] ?? cur.kind}، ${STATUS_AR[cur.status]})` });
    redirect('/admin/requests?ok=deleted');
  }

  /* الطلب الجدّي يصير صفقة بضغطة: عنوانها من المنتجات المطلوبة */
  const deal = await q1<any>('SELECT id, title FROM deals WHERE request_id = ? LIMIT 1', [id]);
  async function toDeal() {
    'use server';
    const u = await requirePerm('deals.edit');
    const cur = await load(id);
    if (!cur.customer_id) redirect(`/admin/requests/${id}`);
    const had = await q1<any>('SELECT id FROM deals WHERE request_id = ?', [id]);
    if (had) redirect(`/admin/deals/${had.id}`);
    let list: any[] = [];
    try { list = typeof cur.items === 'string' ? JSON.parse(cur.items) : cur.items ?? []; } catch { /* فارغة */ }
    const title = (Array.isArray(list) && list.length
      ? list.slice(0, 3).map((i) => `${i.name ?? i.ref} × ${i.qty}`).join('، ') + (list.length > 3 ? ` +${list.length - 3}` : '')
      : `${KIND_AR[cur.kind] ?? 'طلب'} #${id}`).slice(0, 250);
    const res = await q(`INSERT INTO deals (customer_id, request_id, title, stage, owner_id, created_by) VALUES (?, ?, ?, 'lead', ?, ?)`,
      [cur.customer_id, id, title, cur.assigned_to ?? u.id, u.id]) as unknown as { insertId: number };
    await q("INSERT INTO customer_events (customer_id, user_id, kind, deal_id, text) VALUES (?, ?, 'deal', ?, ?)", [cur.customer_id, u.id, res.insertId, title]);
    await audit(u, 'deal.create', { entity: 'deal', id: res.insertId, summary: `${title} (من طلب #${id})` });
    redirect(`/admin/deals/${res.insertId}?ok=created`);
  }

  const msg = sp.ok ? MSG[sp.ok] : sp.e ? MSG[sp.e] : null;
  const EVENT_AR: Record<string, string> = { created: 'وصل الطلب', claim: 'استلمه', assign: 'حوّله', status: 'غيّر الحالة', note: 'ملاحظة', escalate: 'صُعّد للسوبر أدمن' };
  const wa = r.phone ? r.phone.replace(/[^\d]/g, '').replace(/^0(?=1\d{9}$)/, '20') : '';

  return (
    <Shell user={me} here="/admin/requests" title={`طلب #${id}`}
           trail={[{ label: 'لوحة التحكم', href: '/admin' }, { label: 'الطلبات', href: '/admin/requests' }]}
           sub={`${KIND_AR[r.kind] ?? r.kind}${r.source ? ` · من ${SOURCE_AR[r.source] ?? r.source}` : ''} · ${when(r.created_at)}`}>
      {msg ? <p className={`msg ${msg[1] ? 'msg--ok' : 'msg--bad'}`}>{msg[0]}</p> : null}

      <div className="reqgrid">
        <div>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel__head">
              <h2>العميل</h2>
              <span className={`tag ${STATUS_TAG[r.status] ?? ''}`}>{STATUS_AR[r.status] ?? r.status}</span>
            </div>
            <div className="panel__body">
              <table className="kv">
                <tbody>
                  <tr><th>الاسم</th><td>{r.name || '—'}</td></tr>
                  {r.company ? <tr><th>الشركة</th><td>{r.company}</td></tr> : null}
                  <tr><th>الموبايل</th><td>{r.phone ? <a href={`tel:${r.phone}`} dir="ltr">{r.phone}</a> : '—'}
                    {wa ? <> · <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener">واتساب ↗</a></> : null}</td></tr>
                  <tr><th>البريد</th><td>{r.email ? <a href={`mailto:${r.email}`} dir="ltr">{r.email}</a> : '—'}</td></tr>
                  {r.city ? <tr><th>المكان</th><td>{r.city}</td></tr> : null}
                  <tr><th>اللغة</th><td>{r.lang === 'en' ? 'إنجليزي' : 'عربي'}</td></tr>
                  {r.page ? <tr><th>من صفحة</th><td><a href={r.page} target="_blank" rel="noopener" dir="ltr">{r.page}</a></td></tr> : null}
                </tbody>
              </table>
              {r.customer_id && (can(me, 'customers.view') || can(me, 'deals.edit')) ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {can(me, 'customers.view') ? <a className="btn btn--ghost btn--sm" href={`/admin/customers/${r.customer_id}`}>صفحة العميل وكل طلباته</a> : null}
                  {can(me, 'deals.edit') ? (
                    deal ? <a className="btn btn--ghost btn--sm" href={`/admin/deals/${deal.id}`}>صفقته: {deal.title}</a> : (
                      <form action={toDeal}><button className="btn btn--sm" type="submit">حوّله لصفقة</button></form>
                    )
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {items.length ? (
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel__head"><h2>المنتجات ({items.length})</h2></div>
              <table>
                <thead><tr><th>المنتج</th><th>رقم القطعة</th><th>الكمية</th></tr></thead>
                <tbody>
                  {items.map((i, k) => (
                    <tr key={k}>
                      <td>{i.slug ? <a href={`/model.html?p=${i.slug}&lang=ar`} target="_blank" rel="noopener">{i.name ?? i.ref}</a> : (i.name ?? i.ref)}</td>
                      <td><small dir="ltr">{i.sku || '—'}</small></td>
                      <td>{i.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {r.message ? (
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel__head"><h2>الرسالة</h2></div>
              <div className="panel__body"><pre style={{ whiteSpace: 'pre-wrap', margin: 0, font: 'inherit' }}>{r.message}</pre></div>
            </div>
          ) : null}

          <div className="panel">
            <div className="panel__head"><h2>ما جرى على الطلب</h2></div>
            <div className="panel__body">
              {handle ? (
                <form action={addNote} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <input name="note" type="text" placeholder="ملاحظة: كلّمته، طلب يتصل بكرة، أرسلت العرض…" aria-label="ملاحظة جديدة" style={{ flex: 1 }} />
                  <button className="btn btn--sm" type="submit">أضف</button>
                </form>
              ) : null}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {events.map((e) => (
                  <li key={e.id} style={{ padding: '8px 0', borderTop: '1px solid var(--line)', fontSize: 14 }}>
                    <small dir="ltr" style={{ color: 'var(--muted)' }}>{when(e.created_at)}</small>{' '}
                    <b>{e.who ?? (e.kind === 'created' ? 'العميل' : 'النظام')}</b> — {EVENT_AR[e.kind] ?? e.kind}
                    {e.kind === 'status' ? <> من «{STATUS_AR[e.from_status] ?? e.from_status}» إلى «{STATUS_AR[e.to_status] ?? e.to_status}»</> : null}
                    {e.note ? <>: {e.note}</> : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel__head"><h2>المسؤول</h2></div>
            <div className="panel__body">
              {owner ? <p style={{ marginTop: 0 }}><b>{owner.name || owner.email}</b>{owner.id === me.id ? ' (أنت)' : ''}{r.claimed_at ? <><br /><small dir="ltr">{when(r.claimed_at)}</small></> : null}</p>
                : <p style={{ marginTop: 0 }}>لم يستلمه أحد بعد.</p>}
              {!r.assigned_to && handle ? <form action={claim}><button className="btn" type="submit" style={{ width: '100%', justifyContent: 'center' }}>استلمته — سأتصل به</button></form> : null}
              {handle ? (
                <form action={assign} style={{ marginTop: 12 }}>
                  <label htmlFor="to">حوّله إلى</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select id="to" name="to" defaultValue={r.assigned_to ?? ''}>
                      <option value="">بلا مسؤول</option>
                      {handlers.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
                    </select>
                    <button className="btn btn--sm btn--ghost" type="submit">حوّل</button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>

          {handle ? (
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel__head"><h2>الحالة</h2></div>
              <div className="panel__body">
                <form action={setStatus}>
                  <div className="field">
                    <select name="status" defaultValue={r.status} aria-label="الحالة الجديدة">
                      {STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </div>
                  <div className="field"><input name="note" type="text" placeholder="سبب أو ملاحظة (اختياري)" aria-label="ملاحظة مع الحالة" /></div>
                  <button className="btn btn--sm" type="submit">احفظ الحالة</button>
                </form>
              </div>
            </div>
          ) : null}

          {can(me, 'requests.delete') ? (
            <form action={remove}>
              <ConfirmButton className="btn btn--bad btn--sm" message={`حذف الطلب #${id} نهائيًا مع ملاحظاته؟ لا يمكن استعادته.`}>احذف الطلب</ConfirmButton>
              <p className="field__hint">للطلبات الوهمية أو المكرّرة. الطلب الحقيقي الأفضل «ملغي».</p>
            </form>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}
