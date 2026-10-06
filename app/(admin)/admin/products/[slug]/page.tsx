/* محرّر المنتج: بياناته، وصوره، ومواصفاته، ومقاطعه، وملفاته.

   بنية data محفوظة كما جاءت من الموقع القديم، ويُعاد تركيبها هنا من النموذج
   بالطريقة نفسها التي تُبنى بها السكاشن — فلا يضيع حقل. */
import { notFound, redirect } from 'next/navigation';
import { requireAnyPerm, requirePerm } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { q, q1, json } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { refreshSite, snapshot, str, bool, J } from '@/lib/admin';
import { contentFromForm } from '@/lib/formJson';
import { PRODUCT_FIELDS } from '@/lib/productSchema';
import { ProductForm } from '@/components/admin/ProductForm';
import { ytId } from '@/lib/youtube';
import { getSubcats } from '@/lib/subcats';

export const dynamic = 'force-dynamic';

export default async function ProductEditor({
  params, searchParams,
}: { params: Promise<{ slug: string }>; searchParams: Promise<{ ok?: string }> }) {
  const user = await requireAnyPerm(['products.edit', 'products.publish', 'products.delete']);
  const { slug } = await params;
  const saved = (await searchParams).ok;

  const p = await q1<any>('SELECT * FROM products WHERE slug = ?', [slug]);
  if (!p) notFound();
  const brands = await q<any>('SELECT id, slug, name FROM brands ORDER BY name');
  const all = await q<any>('SELECT ref, slug, name_en, name_ar FROM products WHERE slug <> ? ORDER BY position', [slug]);
  const data = json<any>(p.data, {});
  /* أين يظهر المنتج في كروت الصفحات — يُقال قبل حذفه */
  const usedIn = await q<{ slug: string; title: string }>(
    `SELECT DISTINCT pg.slug, COALESCE(pg.crumb_ar, pg.crumb_en, pg.slug) AS title
       FROM sections s JOIN pages pg ON pg.id = s.page_id
      WHERE s.type = 'products' AND JSON_CONTAINS(JSON_EXTRACT(s.content, '$.ids'), JSON_QUOTE(?))`,
    [p.ref]
  );

  async function save(form: FormData) {
    'use server';
    const u = await requireAnyPerm(['products.edit', 'products.publish']);
    const editOk = can(u, 'products.edit');
    const pubOk = can(u, 'products.publish');
    const was = await q1<any>('SELECT * FROM products WHERE id = ?', [p.id]);
    if (!was) redirect('/admin/products');
    const published = pubOk ? bool(form, 'published') : was.published;
    await snapshot('product', p.id, u.id);
    /* من عنده النشر وحده يغيّر حالة النشر فقط، والباقي يبقى كما هو */
    if (!editOk) {
      await q('UPDATE products SET published = ? WHERE id = ?', [published, p.id]);
    } else {
      const next = contentFromForm(form, PRODUCT_FIELDS, data);
      /* الصورة نفسها مرتين تظهر مرتين في المعرض؛ ورابط يوتيوب يُحفظ رمزًا */
      if (Array.isArray(next.gallery)) next.gallery = [...new Set(next.gallery.filter(Boolean))];
      if (Array.isArray(next.videos)) {
        next.videos = next.videos.map((v: any) => (v?.yt ? { ...v, yt: ytId(v.yt) || v.yt } : v));
      }
      await q(
        `UPDATE products SET brand_id = ?, category = ?, subcategory = ?, published = ?,
           name_en = ?, name_ar = ?, type_en = ?, type_ar = ?,
           description_en = ?, description_ar = ?, hero_image = ?, data = ?, sku = ?, store_hidden = ?
         WHERE id = ?`,
        [
          str(form, 'brand_id') ? Number(form.get('brand_id')) : null,
          str(form, 'category'), str(form, 'subcategory'), published,
          str(form, 'name_en'), str(form, 'name_ar'),
          str(form, 'type_en'), str(form, 'type_ar'),
          str(form, 'description_en'), str(form, 'description_ar'),
          str(form, 'hero_image'),
          J(next), str(form, 'sku'), bool(form, 'store_hidden'), p.id,
        ]
      );
    }
    const name = was.name_ar || was.name_en || was.slug;
    if (editOk) await audit(u, 'product.update', { entity: 'product', id: was.slug, summary: name });
    if (Number(published) !== Number(was.published)) {
      await audit(u, published ? 'product.publish' : 'product.unpublish', { entity: 'product', id: was.slug, summary: name });
    }
    refreshSite();
    redirect(`/admin/products/${slug}?ok=1`);
  }

  async function remove() {
    'use server';
    const u = await requirePerm('products.delete');
    const was = await q1<any>('SELECT * FROM products WHERE id = ?', [p.id]);
    if (!was) redirect('/admin/products');
    await snapshot('product', p.id, u.id);
    await q('DELETE FROM products WHERE id = ?', [p.id]);
    await audit(u, 'product.delete', {
      entity: 'product', id: was.slug, summary: was.name_ar || was.name_en || was.slug,
      before: { ...was, data: undefined },
    });
    refreshSite();
    redirect('/admin/products');
  }

  return (
    <Shell
      user={user} here="/admin/products"
      title={p.name_ar || p.name_en || p.slug}
      sub={`model.html?p=${p.slug}`}
      trail={[{ label: 'لوحة التحكم', href: '/admin' }, { label: 'المنتجات', href: '/admin/products' }]}
      actions={
        <>
          <a className="btn btn--ghost" href={`/model.html?p=${p.slug}&lang=ar`} target="_blank" rel="noopener">عرض ↗</a>
          <a className="btn btn--ghost" href="/admin/products">كل المنتجات</a>
        </>
      }
    >
      {saved ? <p className="msg msg--ok">حُفظ المنتج.</p> : null}
      <ProductForm p={p} data={data} brands={brands} all={all} subs={await getSubcats()} action={save}
                   remove={can(user, 'products.delete') ? remove : null} usedIn={usedIn}
                   canEdit={can(user, 'products.edit')} canPublish={can(user, 'products.publish')} />
    </Shell>
  );
}
