/* الطلبات: صندوق واحد لعروض الأسعار وسلة المتجر و«كلّموني».

   الافتراضي «المفتوحة» (جديد ← قيد التنفيذ)، والجديد غير المستلَم أولًا لأنه
   ينتظر من يتصل. «استلمته» من القائمة مباشرةً بلا فتح الطلب. */
import { redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { q, q1, when } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { can } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { STATUSES, STATUS_AR, STATUS_TAG, KIND_AR, OPEN, clearOthers } from '@/lib/requests';

export const dynamic = 'force-dynamic';

type SP = { s?: string; mine?: string; q?: string; ok?: string; e?: string };

export default async function RequestsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requirePerm('requests.view');
  const sp = await searchParams;
  const status = sp.s === 'all' || STATUSES.some(([k]) => k === sp.s) ? sp.s! : 'open';
  const term = (sp.q ?? '').trim();

  const where: string[] = [];
  const args: unknown[] = [];
  if (status === 'open') where.push(`r.status IN (${OPEN.map(() => '?').join(',')})`), args.push(...OPEN);
  else if (status !== 'all') where.push('r.status = ?'), args.push(status);
  if (sp.mine === '1') where.push('r.assigned_to = ?'), args.push(me.id);
  if (sp.mine === 'none') where.push('r.assigned_to IS NULL');
  if (term) {
    where.push('(r.name LIKE ? OR r.phone LIKE ? OR r.email LIKE ? OR r.company LIKE ? OR r.message LIKE ? OR r.id = ?)');
    args.push(...Array(5).fill(`%${term}%`), Number(term.replace(/^#/, '')) || 0);
  }
  const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await q<any>(
    `SELECT r.id, r.kind, r.status, r.name, r.phone, r.company, r.items, r.source, r.created_at, r.assigned_to,
            r.escalated_at, u.name AS owner
       FROM requests r LEFT JOIN users u ON u.id = r.assigned_to
       ${W}
      ORDER BY (r.status = 'new' AND r.assigned_to IS NULL) DESC, r.id DESC LIMIT 200`, args
  );
  const counts = Object.fromEntries((await q<any>('SELECT status, COUNT(*) n FROM requests GROUP BY status')).map((r) => [r.status, r.n]));
  const openCount = OPEN.reduce((n, k) => n + (counts[k] ?? 0), 0);
  const waiting = (await q1<any>("SELECT COUNT(*) n FROM requests WHERE status = 'new' AND assigned_to IS NULL"))?.n ?? 0;
  const handle = can(me, 'requests.handle');

  async function claim(form: FormData) {
    'use server';
    const u = await requirePerm('requests.handle');
    const id = Number(form.get('id'));
    /* أول من يضغط يأخذه: الشرط في التحديث نفسه، فضغطتان معًا لا تأخذانه مرتين */
    const res = await q('UPDATE requests SET assigned_to = ?, claimed_at = NOW() WHERE id = ? AND assigned_to IS NULL', [u.id, id]) as unknown as { affectedRows: number };
    if (!res.affectedRows) redirect('/admin/requests?e=taken');
    await q("INSERT INTO request_events (request_id, user_id, kind) VALUES (?, ?, 'claim')", [id, u.id]);
    await clearOthers(id, u.id);
    await audit(u, 'request.claim', { entity: 'request', id });
    redirect(`/admin/requests/${id}?ok=claimed`);
  }

  const items = (v: any) => { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a : []; } catch { return []; } };
  const link = (o: Partial<SP>) => {
    const u = new URLSearchParams();
    const m = { s: status === 'open' ? undefined : status, mine: sp.mine, q: term || undefined, ...o };
    for (const [k, v] of Object.entries(m)) if (v) u.set(k, String(v));
    return `/admin/requests${u.size ? `?${u}` : ''}`;
  };

  return (
    <Shell user={me} here="/admin/requests" title="الطلبات" trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub={waiting ? `${waiting} طلب جديد ينتظر من يستلمه.` : 'كل طلبات العملاء من الموقع: عروض الأسعار والمتجر و«كلّموني».'}
           actions={can(me, 'requests.export') ? <a className="btn btn--ghost" href={`/api/admin/requests/export?${new URLSearchParams({ s: status, ...(term ? { q: term } : {}) })}`}>تصدير Excel</a> : null}>
      {sp.e === 'taken' ? <p className="msg msg--bad">استلمه زميل قبلك.</p> : null}
      {sp.ok === 'deleted' ? <p className="msg msg--ok">حُذف الطلب.</p> : null}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__body" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <a className={`btn btn--sm ${status === 'open' ? '' : 'btn--ghost'}`} href={link({ s: undefined })}>المفتوحة ({openCount})</a>
          {STATUSES.map(([k, l]) => (
            <a key={k} className={`btn btn--sm ${status === k ? '' : 'btn--ghost'}`} href={link({ s: k })}>{l} ({counts[k] ?? 0})</a>
          ))}
          <a className={`btn btn--sm ${status === 'all' ? '' : 'btn--ghost'}`} href={link({ s: 'all' })}>الكل</a>
          <span style={{ flex: 1 }} />
          <a className={`btn btn--sm ${sp.mine === '1' ? '' : 'btn--ghost'}`} href={link({ mine: sp.mine === '1' ? undefined : '1' })}>طلباتي</a>
          <a className={`btn btn--sm ${sp.mine === 'none' ? '' : 'btn--ghost'}`} href={link({ mine: sp.mine === 'none' ? undefined : 'none' })}>بلا مسؤول</a>
          <form method="get" style={{ display: 'flex', gap: 6 }}>
            {status !== 'open' ? <input type="hidden" name="s" value={status} /> : null}
            {sp.mine ? <input type="hidden" name="mine" value={sp.mine} /> : null}
            <input type="search" name="q" defaultValue={term} placeholder="اسم، موبايل، شركة، رقم الطلب…" aria-label="ابحث في الطلبات" style={{ width: 220 }} />
            <button className="btn btn--sm btn--ghost" type="submit">ابحث</button>
          </form>
        </div>
      </div>

      <div className="panel">
        {rows.length ? (
          <table>
            <thead><tr><th>#</th><th>العميل</th><th>الطلب</th><th>الحالة</th><th>المسؤول</th><th>وصل</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => {
                const it = items(r.items);
                const waitingRow = r.status === 'new' && !r.assigned_to;
                return (
                  <tr key={r.id} style={waitingRow ? { background: '#fff8f0' } : undefined}>
                    <td><a href={`/admin/requests/${r.id}`}>#{r.id}</a></td>
                    <td>
                      <strong>{r.name || '—'}</strong>{r.company ? <small> · {r.company}</small> : null}
                      {r.phone ? <><br /><small dir="ltr">{r.phone}</small></> : null}
                    </td>
                    <td>
                      <small>{KIND_AR[r.kind] ?? r.kind}</small>
                      {it.length ? <><br /><small style={{ color: 'var(--muted)' }}>{it.slice(0, 2).map((i: any) => `${i.name} × ${i.qty}`).join('، ')}{it.length > 2 ? ` +${it.length - 2}` : ''}</small></> : null}
                    </td>
                    <td><span className={`tag ${STATUS_TAG[r.status] ?? ''}`}>{STATUS_AR[r.status] ?? r.status}</span>
                      {r.escalated_at && waitingRow ? <> <span className="tag tag--off">متأخر</span></> : null}</td>
                    <td><small>{r.owner ?? (r.assigned_to ? `#${r.assigned_to}` : '—')}</small></td>
                    <td><small dir="ltr">{when(r.created_at)}</small></td>
                    <td style={{ textAlign: 'end', whiteSpace: 'nowrap' }}>
                      {waitingRow && handle ? (
                        <form action={claim} style={{ display: 'inline' }}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="btn btn--sm" type="submit">استلمته</button>
                        </form>
                      ) : null}{' '}
                      <a className="btn btn--ghost btn--sm" href={`/admin/requests/${r.id}`}>افتح</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <div className="panel__body"><p style={{ margin: 0 }}>لا طلبات هنا{term ? ' بهذا البحث' : ''}.</p></div>}
      </div>
    </Shell>
  );
}
