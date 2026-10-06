/* سجل العمليات — للسوبر أدمن وحده: مين عمل إيه وإمتى، بفلاتر بالموظف والعملية والتاريخ. */
import { requireSuper } from '@/lib/auth';
import { q, when } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { ACTION_AR } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const PAGE = 100;

type SP = { u?: string; a?: string; from?: string; to?: string; p?: string };

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireSuper();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.p) || 1);

  const where: string[] = [];
  const args: unknown[] = [];
  if (sp.u) { where.push('user_id = ?'); args.push(Number(sp.u)); }
  /* «user.» يجمع كل عمليات الحسابات، وهكذا */
  if (sp.a) { where.push(sp.a.endsWith('.') ? 'action LIKE ?' : 'action = ?'); args.push(sp.a.endsWith('.') ? `${sp.a}%` : sp.a); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? '')) { where.push('created_at >= ?'); args.push(`${sp.from} 00:00:00`); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? '')) { where.push('created_at <= ?'); args.push(`${sp.to} 23:59:59`); }
  const W = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows, [{ n }], users] = await Promise.all([
    q<any>(`SELECT id, user_id, user_name, action, entity, entity_id, summary, ip, created_at
              FROM audit_log ${W} ORDER BY id DESC LIMIT ${PAGE + 1} OFFSET ${(page - 1) * PAGE}`, args),
    q<{ n: number }>(`SELECT COUNT(*) AS n FROM audit_log ${W}`, args),
    q<any>('SELECT id, name, email FROM users ORDER BY name, id'),
  ]);
  const more = rows.length > PAGE;
  const shown = rows.slice(0, PAGE);
  const link = (p: number) => `/admin/audit?${new URLSearchParams({ ...sp, p: String(p) } as Record<string, string>)}`;

  const groups: [string, string][] = [
    ['user.', 'كل عمليات الحسابات'], ['page.', 'كل عمليات الصفحات'], ['product.', 'كل عمليات المنتجات'],
    ['request.', 'كل عمليات الطلبات'], ['store.', 'المتجر'],
  ];

  return (
    <Shell user={me} here="/admin/audit" title="سجل العمليات" trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub={`${n} عملية${where.length ? ' مطابقة للفلتر' : ''}. كلمات المرور لا تُكتب في السجل أبدًا.`}>
      <form className="panel" method="get" style={{ marginBottom: 20 }}>
        <div className="panel__body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="u">الموظف</label>
            <select id="u" name="u" defaultValue={sp.u ?? ''}>
              <option value="">الكل</option>
              {users.map((x) => <option key={x.id} value={x.id}>{x.name || x.email}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="a">العملية</label>
            <select id="a" name="a" defaultValue={sp.a ?? ''}>
              <option value="">الكل</option>
              <optgroup label="مجموعات">{groups.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</optgroup>
              <optgroup label="عملية بعينها">
                {Object.entries(ACTION_AR).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </optgroup>
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="from">من</label><input id="from" name="from" type="date" defaultValue={sp.from ?? ''} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="to">إلى</label><input id="to" name="to" type="date" defaultValue={sp.to ?? ''} />
          </div>
          <button className="btn" type="submit">اعرض</button>
          {where.length ? <a className="btn btn--ghost" href="/admin/audit">امسح الفلتر</a> : null}
        </div>
      </form>

      <div className="panel">
        {shown.length ? (
          <table>
            <thead><tr><th>الوقت</th><th>الموظف</th><th>العملية</th><th>التفاصيل</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td><small dir="ltr">{when(r.created_at)}</small></td>
                  <td>
                    {r.user_id ? <a href={`/admin/audit?u=${r.user_id}`}>{r.user_name || `#${r.user_id}`}</a> : <small>{r.user_name || '—'}</small>}
                    {r.ip ? <><br /><small dir="ltr" style={{ color: 'var(--muted)' }}>{r.ip}</small></> : null}
                  </td>
                  <td><span className={`tag${/delete|deactivate|failed/.test(r.action) ? ' tag--off' : ''}`}>{ACTION_AR[r.action] ?? r.action}</span></td>
                  <td><small>{r.summary || (r.entity ? `${r.entity} ${r.entity_id ?? ''}` : '')}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="panel__body"><p style={{ margin: 0 }}>لا عمليات{where.length ? ' بهذا الفلتر' : ' بعد'}.</p></div>}
      </div>

      {page > 1 || more ? (
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {page > 1 ? <a className="btn btn--ghost btn--sm" href={link(page - 1)}>→ الأحدث</a> : null}
          {more ? <a className="btn btn--ghost btn--sm" href={link(page + 1)}>الأقدم ←</a> : null}
        </div>
      ) : null}
    </Shell>
  );
}
