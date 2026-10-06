/* المتجر في لوحة التحكم: سويتش الفتح والقفل، وماذا يرى الزائر وهو مقفول،
   وأرقام المتجر (المنتجات فيه، والأكثر طلبًا ومشاهدة، وما يبحث عنه الناس).

   القفل لا يحذف شيئًا (lib/store.ts): المنتجات وإعداداتها والصفحة باقية،
   وإعادة الفتح ترجع كل شيء كما كان. */
import { redirect } from 'next/navigation';
import { requireAnyPerm, requirePerm } from '@/lib/auth';
import { q } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { ConfirmButton } from '@/components/ConfirmButton';
import { can } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { getStore, STORE_SLUG } from '@/lib/store';
import { refreshSite } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function StoreAdmin({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const me = await requireAnyPerm(['store.toggle', 'products.edit']);
  const sp = await searchParams;
  const store = await getStore();
  const [[counts], topReq, topViews, searches, misses] = await Promise.all([
    q<any>(`SELECT SUM(published = 1 AND store_hidden = 0) inStore, SUM(published = 1 AND store_hidden = 1) hidden,
                   SUM(published = 0) drafts, SUM(category = 'parts' AND published = 1 AND store_hidden = 0) parts FROM products`),
    q<any>(`SELECT p.slug, COALESCE(p.name_ar, p.name_en) name, SUM(s.requests) n FROM product_stats s JOIN products p ON p.id = s.product_id
             WHERE s.day >= CURDATE() - INTERVAL 30 DAY GROUP BY p.id HAVING n > 0 ORDER BY n DESC LIMIT 8`),
    q<any>(`SELECT p.slug, COALESCE(p.name_ar, p.name_en) name, SUM(s.views) n FROM product_stats s JOIN products p ON p.id = s.product_id
             WHERE s.day >= CURDATE() - INTERVAL 30 DAY GROUP BY p.id HAVING n > 0 ORDER BY n DESC LIMIT 8`),
    q<any>(`SELECT term, SUM(hits) n, MIN(results) results FROM search_stats WHERE day >= CURDATE() - INTERVAL 30 DAY
             GROUP BY term ORDER BY n DESC LIMIT 10`),
    q<any>(`SELECT term, SUM(hits) n FROM search_stats WHERE day >= CURDATE() - INTERVAL 30 DAY AND results = 0
             GROUP BY term ORDER BY n DESC LIMIT 10`),
  ]);
  const [[reqs]] = await Promise.all([
    q<any>(`SELECT COUNT(*) total, SUM(status = 'new') fresh FROM requests WHERE source = 'store' AND created_at >= CURDATE() - INTERVAL 30 DAY`),
  ]);
  const toggle = can(me, 'store.toggle');

  async function save(form: FormData) {
    'use server';
    const u = await requirePerm('store.toggle');
    const before = await getStore();
    /* «احفظ الاختيار فقط» يغيّر ما يراه الزائر والمتجر مقفول، ولا يفتح ولا يقفل */
    const enabled = form.get('keep') ? before.enabled : form.get('enabled') === '1';
    const closed = form.get('closed') === 'soon' ? 'soon' : 'home';
    await q(
      `INSERT INTO settings (\`key\`, \`value\`, \`group\`, label_en, label_ar) VALUES ('store', ?, 'store', 'Store', 'المتجر')
       ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
      [JSON.stringify({ enabled, closed })]
    );
    if (enabled !== before.enabled) await audit(u, enabled ? 'store.enable' : 'store.disable', { entity: 'setting', id: 'store', before, after: { enabled, closed } });
    else if (closed !== before.closed) await audit(u, 'settings.save', { entity: 'setting', id: 'store', summary: 'ماذا يرى الزائر والمتجر مقفول', before, after: { enabled, closed } });
    refreshSite();
    redirect(`/admin/store?ok=${enabled === before.enabled ? 'saved' : enabled ? 'on' : 'off'}`);
  }

  const list = (rows: any[], unit: string) => rows.length ? (
    <ol style={{ margin: 0, paddingInlineStart: 20, fontSize: 14, lineHeight: 1.9 }}>
      {rows.map((r) => <li key={r.slug ?? r.term}>{r.slug ? <a href={`/admin/products/${r.slug}`}>{r.name}</a> : <bdi>{r.term}</bdi>} <small>— {r.n} {unit}</small></li>)}
    </ol>
  ) : <p className="field__hint" style={{ margin: 0 }}>لا بيانات بعد — تظهر مع زيارات المتجر.</p>;

  return (
    <Shell user={me} here="/admin/store" title="المتجر" trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub="صفحة واحدة فيها كل المنتجات وقطع الغيار، وسلة «طلب عرض سعر» تصل طلباتها إلى «الطلبات»."
           actions={<a className="btn btn--ghost" href={`/${STORE_SLUG}.html?lang=ar`} target="_blank" rel="noopener">عاين المتجر ↗</a>}>
      {sp.ok === 'on' ? <p className="msg msg--ok">فُتح المتجر: ظهر للزوار مع رابطه في المنيو، بكل منتجاته كما كانت.</p> : null}
      {sp.ok === 'off' ? <p className="msg msg--ok">قُفل المتجر: اختفى عن الزوار ورابطه من المنيو. لم يُحذف شيء، وتقدر تعاينه وأنت داخل.</p> : null}
      {sp.ok === 'saved' ? <p className="msg msg--ok">حُفظ.</p> : null}

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <h2>حالة المتجر</h2>
          <span className={`tag ${store.enabled ? 'tag--on' : 'tag--off'}`}>{store.enabled ? 'مفتوح للزوار' : 'مقفول'}</span>
        </div>
        <div className="panel__body">
          {toggle ? (
            <form action={save}>
              <input type="hidden" name="enabled" value={store.enabled ? '0' : '1'} />
              <div className="field">
                <label htmlFor="closed">لما يكون مقفول، الزائر اللي يفتح رابطه:</label>
                <select id="closed" name="closed" defaultValue={store.closed} style={{ maxWidth: 420 }}>
                  <option value="home">يتحوّل للصفحة الرئيسية</option>
                  <option value="soon">يرى «المتجر قريبًا» مع زر عرض السعر</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <ConfirmButton className={`btn ${store.enabled ? 'btn--bad' : ''}`}
                               message={store.enabled ? 'قفل المتجر؟ يختفي عن الزوار ورابطه من المنيو. لا يُحذف شيء، وتفتحه تاني وقت ما تحب.' : 'فتح المتجر للزوار؟ يظهر رابطه في المنيو فورًا.'}>
                  {store.enabled ? 'اقفل المتجر' : 'افتح المتجر'}
                </ConfirmButton>
                <button className="btn btn--ghost" type="submit" name="keep" value="1">
                  احفظ الاختيار فقط
                </button>
              </div>
            </form>
          ) : <p style={{ margin: 0 }}>فتح المتجر وقفله لمن عنده صلاحية «تشغيل المتجر وإيقافه».</p>}
        </div>
      </div>

      <div className="grid grid--4" style={{ marginBottom: 20 }}>
        <div className="stat"><b>{Number(counts.inStore ?? 0)}</b><span>منتج ظاهر في المتجر</span></div>
        <div className="stat"><b>{Number(counts.parts ?? 0)}</b><span>منها قطع غيار</span></div>
        <div className="stat"><b>{Number(counts.hidden ?? 0)}</b><span>منشور ومخفي من المتجر</span></div>
        <div className="stat"><b>{Number(reqs.total ?? 0)}</b><span>طلب من المتجر (30 يومًا){Number(reqs.fresh) ? ` · ${reqs.fresh} جديد` : ''}</span></div>
      </div>
      <p className="field__hint" style={{ marginTop: -8, marginBottom: 20 }}>
        لإخفاء منتج من المتجر وحده أو إضافة رقم قطعة: افتحه من <a href="/admin/products">المنتجات</a>. المسوّدات لا تظهر في المتجر.
      </p>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        <div className="panel"><div className="panel__head"><h2>الأكثر طلبًا</h2></div><div className="panel__body">{list(topReq, 'طلب')}</div></div>
        <div className="panel"><div className="panel__head"><h2>الأكثر مشاهدة</h2></div><div className="panel__body">{list(topViews, 'مشاهدة')}</div></div>
        <div className="panel"><div className="panel__head"><h2>ما يبحث عنه الزوار</h2></div><div className="panel__body">{list(searches, 'مرة')}</div></div>
        <div className="panel">
          <div className="panel__head"><h2>بحثوا ولم يجدوا</h2></div>
          <div className="panel__body">
            {list(misses, 'مرة')}
            <p className="field__hint">كلمات بلا نتائج: منتج يطلبه الناس وليس في المتجر، أو اسم يحتاج يُضاف لوصف منتج.</p>
          </div>
        </div>
      </div>
    </Shell>
  );
}
