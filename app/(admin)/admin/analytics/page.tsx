/* =============================================================================
   التحليلات: كل ما يحدث في الموقع واللوحة في مكان واحد، لفترة تختارها (7 / 30 /
   90 يومًا) ومقارنة بالفترة التي قبلها.

   الزوار والصفحات والمصادر ← المنتجات (مشاهدة ← طلب) ← الطلبات وسرعة الرد ←
   الصفقات ← المحادثة والبوت ← أداء الفريق. كل الأرقام من قاعدة الموقع نفسها.
============================================================================= */
import { requirePerm } from '@/lib/auth';
import { q } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { ColumnChart, BarList } from '@/components/admin/Charts';
import { money, STAGES, STAGE_AR } from '@/lib/customers';
import { KIND_AR, SOURCE_AR, STATUS_AR } from '@/lib/requests';
import { cairoNow } from '@/lib/attendance';

export const dynamic = 'force-dynamic';

const RANGES = [7, 30, 90];
const nf = (v: unknown) => Number(v ?? 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
const ymd = (d: Date) => d.toISOString().slice(0, 10);

function Tile({ label, value, prev, unit = '', good = 'up', fmt = nf }: {
  label: string; value: number; prev?: number; unit?: string; good?: 'up' | 'down'; fmt?: (v: number) => string;
}) {
  let delta: React.ReactNode = null;
  if (prev != null) {
    if (!prev && !value) delta = <small className="tile__delta">— زي الفترة اللي قبلها</small>;
    else if (!prev) delta = <small className="tile__delta">جديد في الفترة دي</small>;
    else {
      const pct = Math.round(((value - prev) / prev) * 100);
      const up = pct > 0, better = pct === 0 ? null : (up === (good === 'up'));
      delta = (
        <small className={`tile__delta${better === true ? ' is-good' : better === false ? ' is-bad' : ''}`}>
          {pct === 0 ? '＝' : up ? '▲' : '▼'} {Math.abs(pct)}% عن الفترة اللي قبلها
        </small>
      );
    }
  }
  return <div className="tile"><span>{label}</span><b>{fmt(value)}{unit ? <em> {unit}</em> : null}</b>{delta}</div>;
}

export default async function Analytics({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const me = await requirePerm('analytics.view');
  const days = RANGES.includes(Number((await searchParams).r)) ? Number((await searchParams).r) : 30;
  /* الأيام بتوقيت القاهرة (كما تُسجَّل الزيارات)، والحساب على منتصف ليل UTC لنفس التاريخ */
  const end = new Date(`${cairoNow().day}T00:00:00Z`);
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  const pStart = new Date(start.getTime() - days * 86400000), pEnd = new Date(start.getTime() - 86400000);
  const R = [ymd(start), ymd(end)], P = [ymd(pStart), ymd(pEnd)];
  const inR = (col: string) => `${col} >= ? AND ${col} < ? + INTERVAL 1 DAY`;

  const one = async (sql: string, args: unknown[]) => Number((await q<any>(sql, args))[0]?.n ?? 0);
  const both = (sql: string, col: string) => Promise.all([one(sql.replace('$R', inR(col)), R), one(sql.replace('$R', inR(col)), P)]);

  const [
    [visitors, pVisitors], [views, pViews], [reqs, pReqs], [chats, pChats], [handoffs, pHandoffs], [wonValue, pWonValue],
  ] = await Promise.all([
    both('SELECT COUNT(*) n FROM visitors_daily WHERE $R', 'day'),
    both("SELECT COALESCE(SUM(n),0) n FROM traffic_daily WHERE dim = 'page' AND $R", 'day'),
    both("SELECT COUNT(*) n FROM requests WHERE $R", 'created_at'),
    both('SELECT COUNT(*) n FROM chat_conversations WHERE $R', 'created_at'),
    both('SELECT COUNT(*) n FROM chat_conversations WHERE $R', 'handoff_at'),
    both("SELECT COALESCE(SUM(value),0) n FROM deals WHERE stage = 'won' AND $R", 'closed_at'),
  ]);

  const [perDay, pages, sources, devices, langs, pageNames, productRows, searches, misses] = await Promise.all([
    q<any>(`SELECT day, SUM(n) n FROM traffic_daily WHERE dim = 'page' AND ${inR('day')} GROUP BY day`, R),
    q<any>(`SELECT k, SUM(n) n FROM traffic_daily WHERE dim = 'page' AND ${inR('day')} GROUP BY k ORDER BY n DESC LIMIT 10`, R),
    q<any>(`SELECT k, SUM(n) n FROM traffic_daily WHERE dim = 'source' AND ${inR('day')} GROUP BY k ORDER BY n DESC LIMIT 8`, R),
    q<any>(`SELECT k, SUM(n) n FROM traffic_daily WHERE dim = 'device' AND ${inR('day')} GROUP BY k ORDER BY n DESC`, R),
    q<any>(`SELECT k, SUM(n) n FROM traffic_daily WHERE dim = 'lang' AND ${inR('day')} GROUP BY k ORDER BY n DESC`, R),
    q<any>('SELECT slug, COALESCE(crumb_ar, crumb_en, slug) name FROM pages'),
    q<any>(`SELECT p.slug, COALESCE(p.name_ar, p.name_en, p.slug) name, SUM(s.views) views, SUM(s.requests) reqs
              FROM product_stats s JOIN products p ON p.id = s.product_id WHERE ${inR('s.day')}
             GROUP BY p.id ORDER BY views DESC, reqs DESC LIMIT 12`, R),
    q<any>(`SELECT term, SUM(hits) n FROM search_stats WHERE ${inR('day')} GROUP BY term ORDER BY n DESC LIMIT 8`, R),
    q<any>(`SELECT term, SUM(hits) n FROM search_stats WHERE results = 0 AND ${inR('day')} GROUP BY term ORDER BY n DESC LIMIT 8`, R),
  ]);

  const [bySource, byStatus, speed, pipeline, lost, botSources, team] = await Promise.all([
    q<any>(`SELECT COALESCE(source, kind) k, COUNT(*) n FROM requests WHERE ${inR('created_at')} GROUP BY k ORDER BY n DESC`, R),
    q<any>(`SELECT status k, COUNT(*) n FROM requests WHERE ${inR('created_at')} GROUP BY status`, R),
    q<any>(`SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, claimed_at)) claim, AVG(TIMESTAMPDIFF(HOUR, created_at, closed_at)) close,
                   SUM(claimed_at IS NULL AND status = 'new') waiting
              FROM requests WHERE ${inR('created_at')}`, R),
    q<any>(`SELECT stage, COUNT(*) n, COALESCE(SUM(value),0) v FROM deals WHERE stage IN ('lead','quoted','negotiation') GROUP BY stage`, []),
    q<any>(`SELECT stage, COUNT(*) n, lost_reason FROM deals WHERE stage IN ('won','lost') AND ${inR('closed_at')} GROUP BY stage, lost_reason`, R),
    q<any>(`SELECT COALESCE(source, 'fixed') k, COUNT(*) n FROM chat_messages WHERE role = 'bot' AND ${inR('created_at')} GROUP BY k`, R),
    q<any>(`SELECT u.id, COALESCE(u.name, u.email) name,
              (SELECT COUNT(*) FROM request_events e WHERE e.user_id = u.id AND e.kind = 'claim' AND ${inR('e.created_at')}) claimed,
              (SELECT COUNT(*) FROM request_events e WHERE e.user_id = u.id AND e.kind = 'status' AND e.to_status = 'done' AND ${inR('e.created_at')}) done,
              (SELECT COUNT(*) FROM deals d WHERE d.owner_id = u.id AND d.stage = 'won' AND ${inR('d.closed_at')}) won,
              (SELECT COUNT(*) FROM chat_messages m WHERE m.user_id = u.id AND m.role = 'agent' AND ${inR('m.created_at')}) replies,
              (SELECT COUNT(*) FROM audit_log a WHERE a.user_id = u.id AND ${inR('a.created_at')}) actions,
              (SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, t.check_in, t.check_out)),0) FROM attendance t WHERE t.user_id = u.id AND t.status <> 'rejected' AND ${inR('t.day')}) mins
             FROM users u WHERE u.active = 1 ORDER BY name`, [...R, ...R, ...R, ...R, ...R, ...R]),
  ]);

  /* اليوم بلا زيارات يظهر صفرًا لا يختفي */
  const counts = new Map(perDay.map((r) => [ymd(new Date(r.day)), Number(r.n)]));
  const series = Array.from({ length: days }, (_, i) => {
    const d = ymd(new Date(start.getTime() + i * 86400000));
    return { label: d.slice(5).replace('-', '/'), value: counts.get(d) ?? 0 };
  });
  const names = new Map(pageNames.map((p) => [`/${p.slug === 'index' ? '' : `${p.slug}.html`}`, p.name]));
  const productNames = new Map(productRows.map((p) => [`/model.html?p=${p.slug}`, p.name]));
  const pageLabel = (k: string) => names.get(k) ?? productNames.get(k) ?? (k.startsWith('/model.html?p=') ? `منتج: ${k.slice(14)}` : k);
  const won = lost.filter((l) => l.stage === 'won').reduce((n, l) => n + Number(l.n), 0);
  const lostN = lost.filter((l) => l.stage === 'lost').reduce((n, l) => n + Number(l.n), 0);
  const reasons = lost.filter((l) => l.stage === 'lost').map((l) => ({ label: l.lost_reason || 'بلا سبب مكتوب', value: Number(l.n) })).sort((a, b) => b.value - a.value);
  const bot = Object.fromEntries(botSources.map((b) => [b.k, Number(b.n)]));
  const answered = (bot.cache ?? 0) + (bot.qwen ?? 0) + (bot.own ?? 0) + (bot.deepseek ?? 0) + (bot.backup ?? 0);
  const hm = (m: number) => (m ? `${Math.floor(m / 60)} س ${m % 60} د` : '—');

  return (
    <Shell user={me} here="/admin/analytics" title="التحليلات" trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub={`آخر ${days} ${days === 7 ? 'أيام' : 'يومًا'} (${R[0]} ← ${R[1]})، مقارنة بالفترة نفسها اللي قبلها.`}>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__body" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, marginInlineEnd: 6 }}>الفترة:</span>
          {RANGES.map((r) => <a key={r} className={`btn btn--sm ${r === days ? '' : 'btn--ghost'}`} href={`/admin/analytics?r=${r}`}>آخر {r} {r === 7 ? 'أيام' : 'يومًا'}</a>)}
        </div>
      </div>

      <div className="tiles">
        <Tile label="الزوار" value={visitors} prev={pVisitors} />
        <Tile label="مشاهدات الصفحات" value={views} prev={pViews} />
        <Tile label="الطلبات" value={reqs} prev={pReqs} />
        <Tile label="من كل 100 زائر طلبوا" value={visitors ? (reqs / visitors) * 100 : 0} prev={pVisitors ? (pReqs / pVisitors) * 100 : 0} fmt={(v) => v.toFixed(1)} />
        <Tile label="محادثات" value={chats} prev={pChats} />
        <Tile label="طلبوا موظفًا في المحادثة" value={handoffs} prev={pHandoffs} />
        <Tile label="صفقات ربحناها" value={Number(wonValue)} prev={Number(pWonValue)} fmt={(v) => money(v)} />
        <Tile label="متوسط استلام الطلب" value={Number(speed[0]?.claim ?? 0)} unit="دقيقة" good="down" fmt={(v) => (v ? nf(Math.round(v)) : '—')} />
      </div>

      <section className="panel ana">
        <div className="panel__head"><h2>مشاهدات الصفحات يوميًا</h2><small>زوار حقيقيون فقط — بلا الأدمن والروبوتات</small></div>
        <div className="panel__body">
          {views ? <ColumnChart data={series} unit="مشاهدة" label="مشاهدات الصفحات يوميًا" />
                 : <p className="field__hint" style={{ margin: 0 }}>العدّ بدأ مع تحديث المرحلة الرابعة — الأرقام تظهر مع أول زيارات حقيقية.</p>}
        </div>
      </section>

      <div className="ana-grid">
        <section className="panel ana"><div className="panel__head"><h2>أكثر الصفحات زيارة</h2></div><div className="panel__body">
          <BarList rows={pages.map((p) => ({ label: pageLabel(p.k), value: Number(p.n), href: `${p.k}${p.k.includes('?') ? '&' : '?'}lang=ar` }))} unit="مشاهدة" />
        </div></section>
        <section className="panel ana"><div className="panel__head"><h2>من أين جاء الزوار</h2></div><div className="panel__body">
          <BarList rows={sources.map((s) => ({ label: s.k, value: Number(s.n) }))} unit="زيارة" />
          <p className="field__hint">«مباشر» = كتبوا العنوان أو من رابط محفوظ. لحملة إعلانية أضف للرابط <code dir="ltr">?utm_source=اسم_الحملة</code>.</p>
        </div></section>
        <section className="panel ana"><div className="panel__head"><h2>الأجهزة واللغة</h2></div><div className="panel__body">
          <BarList rows={devices.map((d) => ({ label: d.k, value: Number(d.n) }))} unit="مشاهدة" />
          <div style={{ height: 14 }} />
          <BarList rows={langs.map((d) => ({ label: d.k, value: Number(d.n) }))} unit="مشاهدة" />
        </div></section>
      </div>

      <section className="panel ana">
        <div className="panel__head"><h2>المنتجات: مشاهدة ← طلب</h2><small>أي منتج يجذب ولا يبيع؟</small></div>
        {productRows.length ? (
          <table>
            <thead><tr><th>المنتج</th><th>مشاهدات</th><th>طلبات</th><th>من كل 100 مشاهدة طلبوا</th></tr></thead>
            <tbody>
              {productRows.map((p) => (
                <tr key={p.slug}>
                  <td><a href={`/admin/products/${p.slug}`}>{p.name}</a></td>
                  <td>{nf(p.views)}</td><td>{nf(p.reqs)}</td>
                  <td>{Number(p.views) ? ((Number(p.reqs) / Number(p.views)) * 100).toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="panel__body"><p className="field__hint" style={{ margin: 0 }}>لا مشاهدات منتجات في الفترة.</p></div>}
      </section>

      <div className="ana-grid">
        <section className="panel ana"><div className="panel__head"><h2>بحث المتجر</h2></div><div className="panel__body">
          <BarList rows={searches.map((s) => ({ label: s.term, value: Number(s.n) }))} unit="مرة" />
        </div></section>
        <section className="panel ana"><div className="panel__head"><h2>بحثوا ولم يجدوا</h2></div><div className="panel__body">
          <BarList rows={misses.map((s) => ({ label: s.term, value: Number(s.n) }))} unit="مرة" empty="ممتاز — كل البحث لقى نتائج." />
          <p className="field__hint">فرصة: منتج مطلوب وليس عندنا، أو اسم يُضاف لوصف منتج.</p>
        </div></section>
        <section className="panel ana"><div className="panel__head"><h2>الطلبات من أين</h2></div><div className="panel__body">
          <BarList rows={bySource.map((s) => ({ label: SOURCE_AR[s.k] ?? KIND_AR[s.k] ?? s.k, value: Number(s.n) }))} unit="طلب" />
          <div style={{ height: 14 }} />
          <BarList rows={byStatus.map((s) => ({ label: STATUS_AR[s.k] ?? s.k, value: Number(s.n) }))} unit="طلب" />
          <p className="field__hint">متوسط الإغلاق: {speed[0]?.close != null ? `${nf(Math.round(Number(speed[0].close)))} ساعة` : '—'}{Number(speed[0]?.waiting) ? ` · ${speed[0].waiting} ينتظر الاستلام الآن` : ''}</p>
        </div></section>
      </div>

      <div className="ana-grid">
        <section className="panel ana"><div className="panel__head"><h2>الصفقات المفتوحة الآن</h2></div><div className="panel__body">
          <BarList rows={STAGES.filter(([k]) => ['lead', 'quoted', 'negotiation'].includes(k)).map(([k, l]) => {
            const s = pipeline.find((p) => p.stage === k);
            return { label: l, value: Number(s?.v ?? 0), note: `${s?.n ?? 0} صفقة` };
          })} unit="ج.م" />
          <p className="field__hint">في الفترة: ربحنا {won} وخسرنا {lostN}{won + lostN ? ` — نسبة الفوز ${Math.round((won / (won + lostN)) * 100)}%` : ''}.</p>
        </div></section>
        <section className="panel ana"><div className="panel__head"><h2>لماذا خسرنا</h2></div><div className="panel__body">
          <BarList rows={reasons} unit="صفقة" empty="لا صفقات خاسرة في الفترة." />
        </div></section>
        <section className="panel ana"><div className="panel__head"><h2>البوت</h2></div><div className="panel__body">
          <BarList rows={[
            { label: 'من الذاكرة (بلا استهلاك)', value: bot.cache ?? 0 }, { label: 'Qwen', value: bot.qwen ?? 0 },
            { label: 'موديلنا', value: bot.own ?? 0 }, { label: 'DeepSeek', value: bot.deepseek ?? 0 }, { label: 'الموديل الاحتياطي', value: bot.backup ?? 0 }, { label: 'من صفحات الموقع (بلا موديل)', value: bot.kb ?? 0 },
            { label: 'ترحيب وردود ثابتة', value: bot.fixed ?? 0 },
          ].filter((r) => r.value)} unit="رد" />
          {answered ? <p className="field__hint">{Math.round(((bot.cache ?? 0) / answered) * 100)}% من الإجابات جت من الذاكرة.</p> : null}
        </div></section>
      </div>

      <section className="panel ana">
        <div className="panel__head"><h2>الفريق في الفترة</h2></div>
        <table>
          <thead><tr><th>الموظف</th><th>استلم طلبات</th><th>أنهى طلبات</th><th>صفقات ربحها</th><th>ردود في المحادثات</th><th>عمليات في اللوحة</th><th>ساعات الحضور</th></tr></thead>
          <tbody>
            {team.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td><td>{nf(t.claimed)}</td><td>{nf(t.done)}</td><td>{nf(t.won)}</td>
                <td>{nf(t.replies)}</td><td>{nf(t.actions)}</td><td>{hm(Number(t.mins))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}
