/* الصفقات: لوحة بمراحلها — عميل محتمل ← عرض سعر ← تفاوض ← ربحناها / خسرناها.
   كل عمود بمجموع قيمته، والمرحلة تتغيّر من الكارت نفسه بلا فتح الصفقة.
   المربوحة والمخسورة: آخر 90 يومًا فقط، كي تبقى اللوحة للشغل الجاري. */
import { redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { q, q1, when } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { can } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { STAGES, STAGE_AR, money, isStage } from '@/lib/customers';

export const dynamic = 'force-dynamic';

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ mine?: string }> }) {
  const me = await requirePerm('deals.view');
  const sp = await searchParams;
  const rows = await q<any>(
    `SELECT d.id, d.title, d.value, d.currency, d.stage, d.expected_close, d.updated_at, d.created_at, d.owner_id,
            c.id AS cid, COALESCE(c.name, c.company, c.phone) AS customer, u.name AS owner
       FROM deals d JOIN customers c ON c.id = d.customer_id LEFT JOIN users u ON u.id = d.owner_id
      WHERE (d.stage IN ('lead','quoted','negotiation') OR COALESCE(d.closed_at, d.updated_at) >= NOW() - INTERVAL 90 DAY)
        ${sp.mine ? 'AND d.owner_id = ?' : ''}
      ORDER BY d.expected_close IS NULL, d.expected_close, d.id DESC`, sp.mine ? [me.id] : []
  );
  const edit = can(me, 'deals.edit');
  const today = new Date().toISOString().slice(0, 10);

  async function move(form: FormData) {
    'use server';
    const u = await requirePerm('deals.edit');
    const id = Number(form.get('id'));
    const to = String(form.get('stage'));
    const d = await q1<any>('SELECT id, customer_id, title, stage FROM deals WHERE id = ?', [id]);
    if (!d || !isStage(to) || to === d.stage) redirect('/admin/deals');
    const closed = to === 'won' || to === 'lost';
    await q(`UPDATE deals SET stage = ?, closed_at = ${closed ? 'NOW()' : 'NULL'} WHERE id = ?`, [to, id]);
    await q("INSERT INTO customer_events (customer_id, user_id, kind, deal_id, text) VALUES (?, ?, 'stage', ?, ?)",
      [d.customer_id, u.id, id, `${d.title}: ${STAGE_AR[d.stage]} ← ${STAGE_AR[to]}`]);
    await q('UPDATE customers SET last_contact_at = NOW() WHERE id = ?', [d.customer_id]);
    await audit(u, 'deal.stage', { entity: 'deal', id, summary: `${d.title}: ${STAGE_AR[d.stage]} ← ${STAGE_AR[to]}` });
    redirect(`/admin/deals${form.get('mine') ? '?mine=1' : ''}`);
  }

  const openRows = rows.filter((r) => ['lead', 'quoted', 'negotiation'].includes(r.stage));
  const sum = (list: any[]) => list.reduce((n, r) => n + (Number(r.value) || 0), 0);

  return (
    <Shell user={me} here="/admin/deals" title="الصفقات" trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub={`${openRows.length} صفقة مفتوحة بقيمة ${money(sum(openRows))}. الصفقة الجديدة تُفتح من صفحة العميل.`}
           actions={<a className={`btn ${sp.mine ? '' : 'btn--ghost'}`} href={sp.mine ? '/admin/deals' : '/admin/deals?mine=1'}>{sp.mine ? 'كل الصفقات' : 'صفقاتي'}</a>}>
      <div className="board">
        {STAGES.map(([k, label]) => {
          const list = rows.filter((r) => r.stage === k);
          return (
            <section className={`board__col board__col--${k}`} key={k} aria-label={label}>
              <header><b>{label}</b><small>{list.length} · {money(sum(list))}</small></header>
              {list.map((d) => {
                const late = d.expected_close && k !== 'won' && k !== 'lost' && new Date(d.expected_close).toISOString().slice(0, 10) < today;
                return (
                  <article className="board__card" key={d.id}>
                    <a href={`/admin/deals/${d.id}`}><b>{d.title}</b></a>
                    <a className="board__cust" href={`/admin/customers/${d.cid}`}>{d.customer}</a>
                    <span className="board__val">{money(d.value, d.currency)}</span>
                    <small>
                      {d.owner ?? 'بلا مسؤول'}
                      {d.expected_close ? <> · <span style={late ? { color: 'var(--bad)', fontWeight: 600 } : undefined}>{late ? 'متأخرة: ' : ''}{when(d.expected_close).split(' · ')[0]}</span></> : null}
                    </small>
                    {edit ? (
                      <form action={move} className="board__move">
                        <input type="hidden" name="id" value={d.id} />
                        {sp.mine ? <input type="hidden" name="mine" value="1" /> : null}
                        <select name="stage" defaultValue={d.stage} aria-label={`مرحلة ${d.title}`}>
                          {STAGES.map(([s, l]) => <option key={s} value={s}>{l}</option>)}
                        </select>
                        <button className="btn btn--sm btn--ghost" type="submit">نقل</button>
                      </form>
                    ) : null}
                  </article>
                );
              })}
              {!list.length ? <p className="board__empty">—</p> : null}
            </section>
          );
        })}
      </div>
    </Shell>
  );
}
