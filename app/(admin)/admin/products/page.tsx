/* قائمة المنتجات، وإضافة منتج جديد.
   المنتج يظهر في كتالوج المعدات وفي كروت المنتجات وفي البحث بمجرّد نشره. */
import { redirect } from 'next/navigation';
import { requireAnyPerm, requirePerm } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { q, q1 } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { refreshSite, slugify, str } from '@/lib/admin';
import { getSubcats } from '@/lib/subcats';
import { SubcatField } from '@/components/admin/SubcatField';

export const dynamic = 'force-dynamic';

const CATS: [string, string][] = [
  ['power', 'توليد الطاقة'],
  ['environmental', 'المعدات البيئية'],
  ['parts', 'قطع الغيار'],
];

export default async function ProductsList({
  searchParams,
}: { searchParams: Promise<{ e?: string; cat?: string; q?: string }> }) {
  const user = await requireAnyPerm(['products.edit', 'products.publish', 'products.delete']);
  const sp = await searchParams;
  const cat = sp.cat && CATS.some(([c]) => c === sp.cat) ? sp.cat : '';

  /* بحث بالاسم أو رقم القطعة أو المسار أو الماركة */
  const term = (sp.q ?? '').trim();
  const where: string[] = [];
  const args: unknown[] = [];
  if (cat) { where.push('p.category = ?'); args.push(cat); }
  if (term) {
    where.push('(p.name_en LIKE ? OR p.name_ar LIKE ? OR p.sku LIKE ? OR p.slug LIKE ? OR b.name LIKE ?)');
    args.push(...Array(5).fill(`%${term}%`));
  }
  const rows = await q<any>(
    `SELECT p.id, p.ref, p.slug, p.sku, p.category, p.subcategory, p.published, p.store_hidden, p.position,
            p.name_en, p.name_ar, p.hero_image, b.name AS brand
       FROM products p LEFT JOIN brands b ON b.id = p.brand_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY p.category, p.position`,
    args
  );
  const canAdd = can(user, 'products.edit');
  const qs = (c: string) => {
    const u = new URLSearchParams();
    if (c) u.set('cat', c);
    if (term) u.set('q', term);
    return u.size ? `/admin/products?${u}` : '/admin/products';
  };
  const brands = await q<any>('SELECT id, slug, name FROM brands ORDER BY name');

  async function create(form: FormData) {
    'use server';
    const u = await requirePerm('products.edit');
    const name = str(form, 'name_en') ?? '';
    const nameAr = str(form, 'name_ar') ?? '';
    if (!name && !nameAr) redirect('/admin/products?e=need');
    const typed = slugify(String(form.get('slug') ?? ''));
    /* اسم عربي وحده: المسار لا يُشتقّ من حروف عربية، فيُعطى مسارًا مرقّمًا
       يمكن تغييره لاحقًا */
    const [{ n }] = await q<{ n: number }>('SELECT COALESCE(MAX(position),0)+1 n FROM products');
    const base = typed || slugify(name) || `product-${n}`;
    if (typed && await q1('SELECT id FROM products WHERE slug = ? OR ref = ?', [typed, typed])) {
      redirect('/admin/products?e=dup');
    }
    let slug = base;
    for (let i = 2; await q1('SELECT id FROM products WHERE slug = ? OR ref = ?', [slug, slug]); i++) slug = `${base}-${i}`;
    const ref = slug;
    await q(
      `INSERT INTO products (ref, slug, sku, brand_id, category, subcategory, position, published,
                             name_en, name_ar, data)
       VALUES (?,?,?,?,?,?,?,0,?,?,?)`,
      [
        ref, slug, str(form, 'sku'), str(form, 'brand_id') ? Number(form.get('brand_id')) : null,
        str(form, 'category'), str(form, 'subcategory'), n,
        name || null, nameAr || null,
        JSON.stringify({ gallery: [], specifications: [], features: [], applications: [], downloads: [], videos: [], meta: [], related: [] }),
      ]
    );
    await audit(u, 'product.create', { entity: 'product', id: slug, summary: nameAr || name });
    refreshSite();
    redirect(`/admin/products/${slug}`);
  }

  const err = sp.e;
  return (
    <Shell user={user} here="/admin/products" title="المنتجات"
           trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub="كل منتج له صفحته الخاصة، ويظهر في كتالوج المعدات وفي البحث.">
      {err === 'need' ? <p className="msg msg--bad">اكتب اسم المنتج (بالعربية أو بالإنجليزية).</p> : null}
      {err === 'dup' ? <p className="msg msg--bad">المسار الذي كتبته مستعمل في منتج آخر — غيّره أو اتركه فارغًا.</p> : null}

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <h2>{rows.length} منتج{term ? ` لـ «${term}»` : ''}</h2>
          <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <form method="get" style={{ display: 'flex', gap: 6 }}>
              {cat ? <input type="hidden" name="cat" value={cat} /> : null}
              <input type="search" name="q" defaultValue={term} placeholder="اسم، رقم قطعة، ماركة…"
                     aria-label="ابحث في المنتجات" style={{ width: 200 }} />
              <button className="btn btn--sm btn--ghost" type="submit">ابحث</button>
            </form>
            <a className={`btn btn--sm ${cat ? 'btn--ghost' : ''}`} href={qs('')}>الكل</a>
            {CATS.map(([c, l]) => (
              <a key={c} className={`btn btn--sm ${cat === c ? '' : 'btn--ghost'}`} href={qs(c)}>{l}</a>
            ))}
          </span>
        </div>
        <table>
          <thead><tr><th /><th>المنتج</th><th>الماركة</th><th>التصنيف</th><th>الحالة</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td style={{ width: 70 }}>
                  <div style={{ width: 56, height: 40, background: '#f5f8fc', borderRadius: 5, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                    {p.hero_image
                      ? <img src={'/' + p.hero_image} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      : <small style={{ fontSize: 10 }}>—</small>}
                  </div>
                </td>
                <td>
                  <strong>{p.name_ar || p.name_en}</strong>
                  {p.name_ar ? <><br /><small dir="ltr">{p.name_en}</small></> : null}
                  {p.sku ? <><br /><small dir="ltr" style={{ color: 'var(--muted)' }}>#{p.sku}</small></> : null}
                </td>
                <td>{p.brand ?? '—'}</td>
                <td><small>{p.subcategory ?? p.category}</small></td>
                <td>
                  <span className={`tag ${p.published ? 'tag--on' : 'tag--off'}`}>
                    {p.published ? 'منشور' : 'مسوّدة'}
                  </span>
                  {p.store_hidden ? <> <span className="tag" title="لا يظهر في صفحة المتجر">مخفي من المتجر</span></> : null}
                </td>
                <td style={{ textAlign: 'end', whiteSpace: 'nowrap' }}>
                  <a className="btn btn--ghost btn--sm" href={`/model.html?p=${p.slug}&lang=ar`} target="_blank" rel="noopener">عرض</a>{' '}
                  <a className="btn btn--sm" href={`/admin/products/${p.slug}`}>تعديل</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canAdd ? <div className="panel">
        <div className="panel__head"><h2>منتج جديد</h2></div>
        <div className="panel__body">
          <form action={create}>
            <div className="row">
              <div className="field">
                <label htmlFor="name_ar">الاسم بالعربية</label>
                <input id="name_ar" name="name_ar" type="text" placeholder="مولد ديزل 800 كيلوفولت أمبير" />
              </div>
              <div className="field">
                <label htmlFor="name_en">الاسم بالإنجليزية</label>
                <input id="name_en" name="name_en" type="text" dir="ltr" placeholder="800 kVA Diesel Generator" />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="category">التصنيف</label>
                <select id="category" name="category" defaultValue="power">
                  {CATS.map(([c, l]) => <option value={c} key={c}>{l}</option>)}
                </select>
              </div>
              <SubcatField subs={await getSubcats()} value={null} />
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="brand_id">الماركة</label>
                <select id="brand_id" name="brand_id" defaultValue="">
                  <option value="">بلا ماركة</option>
                  {brands.map((b) => <option value={b.id} key={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="slug">المسار</label>
                <input id="slug" name="slug" type="text" dir="ltr" placeholder="800-kva-generator" />
                <p className="field__hint">اتركه فارغًا ليُشتقّ من الاسم الإنجليزي.</p>
              </div>
            </div>
            <div className="field" style={{ maxWidth: 320 }}>
              <label htmlFor="sku">رقم القطعة / الموديل (اختياري)</label>
              <input id="sku" name="sku" type="text" dir="ltr" placeholder="P/N 1R-0750" />
              <p className="field__hint">يظهر في المتجر ويُبحث به — مفيد لقطع الغيار.</p>
            </div>
            <button className="btn" type="submit">أنشئ المنتج</button>
            <p className="field__hint">يُنشأ مسوّدة، وتكمل بياناته وصوره ثم تنشره.</p>
          </form>
        </div>
      </div> : null}
    </Shell>
  );
}
