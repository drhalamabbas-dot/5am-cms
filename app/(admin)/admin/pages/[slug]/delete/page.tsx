/* حذف صفحة.

   شاشة تأكيد لا زرّ: الصفحة ليست وحدها — لها روابط في المنيو، وصفحات
   تحتها، وصفحات تشير إليها في «وصول مباشر»، وأزرار في صفحات أخرى تنقل إليها.
   تُعرض كلها قبل الحذف، ويُعرض البديل الأخفّ: سحبها من النشر.

   الحذف يرتّب ما حوله كي لا يبقى رابط مكسور، ويحفظ كل ما غيّره في نسخة
   واحدة من السجل، فتُعاد الصفحة بأقسامها وروابطها بضغطة واحدة. */
import { notFound, redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { q, q1, json, tx } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { refreshSite, snapshot, J, CORE_TEMPLATES } from '@/lib/admin';
import { ConfirmButton } from '@/components/ConfirmButton';

export const dynamic = 'force-dynamic';

/** كل ما يتأثّر بحذف الصفحة. يُحسب مرة للعرض ومرة داخل معاملة الحذف. */
async function impact(slug: string) {
  const link = [`${slug}.html`, `${slug}.html#%`];
  const [nav, children, related, linkedFrom] = await Promise.all([
    q<any>(
      `SELECT n.id, n.area, n.label_ar, n.label_en, n.parent_id,
              (SELECT COUNT(*) FROM nav_items c WHERE c.parent_id = n.id) AS kids
         FROM nav_items n WHERE n.href = ? OR n.href LIKE ?`, link
    ),
    q<any>('SELECT slug, crumb_ar, crumb_en FROM pages WHERE parent_slug = ?', [slug]),
    q<any>('SELECT slug, crumb_ar, crumb_en FROM pages WHERE JSON_CONTAINS(related, JSON_QUOTE(?))', [slug]),
    q<any>(
      `SELECT s.id, p.slug, p.crumb_ar, s.type FROM sections s JOIN pages p ON p.id = s.page_id
        WHERE p.slug <> ? AND CAST(s.content AS CHAR) LIKE ?`, [slug, `%${slug}.html%`]
    ),
  ]);
  return { nav, children, related, linkedFrom };
}

export default async function DeletePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requirePerm('pages.delete');
  const { slug } = await params;
  const page = await q1<any>('SELECT * FROM pages WHERE slug = ?', [slug]);
  if (!page) notFound();
  const name = page.crumb_ar || page.crumb_en || slug;
  const core = CORE_TEMPLATES.includes(page.template);
  const [{ n: sectionCount }] = await q<{ n: number }>('SELECT COUNT(*) n FROM sections WHERE page_id = ?', [page.id]);
  const hit = await impact(slug);
  const navLeaf = hit.nav.filter((n) => !n.kids);
  const navKept = hit.nav.filter((n) => n.kids);

  async function hide() {
    'use server';
    const u = await requirePerm('pages.delete');
    await snapshot('page', page.id, u.id);
    await q('UPDATE pages SET published = 0 WHERE id = ?', [page.id]);
    await audit(u, 'page.unpublish', { entity: 'page', id: slug, summary: name });
    refreshSite();
    redirect(`/admin/pages/${slug}?ok=unpub`);
  }

  async function destroy() {
    'use server';
    const u = await requirePerm('pages.delete');
    if (CORE_TEMPLATES.includes(page.template)) redirect(`/admin/pages/${slug}/delete`);

    await tx(async (db) => {
      const cur = await db.q1<any>('SELECT * FROM pages WHERE id = ? FOR UPDATE', [page.id]);
      if (!cur) return;
      const link = [`${slug}.html`, `${slug}.html#%`];
      const sections = await db.q<any>('SELECT * FROM sections WHERE page_id = ? FOR UPDATE', [cur.id]);
      const nav = await db.q<any>(
        `SELECT n.* FROM nav_items n
          WHERE (n.href = ? OR n.href LIKE ?)
            AND NOT EXISTS (SELECT 1 FROM nav_items c WHERE c.parent_id = n.id) FOR UPDATE`, link
      );
      const children = await db.q<any>('SELECT * FROM pages WHERE parent_slug = ? FOR UPDATE', [slug]);
      const pointing = await db.q<any>(
        'SELECT * FROM pages WHERE id <> ? AND JSON_CONTAINS(related, JSON_QUOTE(?)) FOR UPDATE', [cur.id, slug]
      );

      /* نسخة واحدة بكل ما سيتغيّر، كما هو الآن: الصفحة وأقسامها، وروابطها
         في المنيو، والصفحات التي تحتها أو تشير إليها. استعادتها تعيد الكل. */
      const others = [...children, ...pointing.filter((p) => !children.some((c) => c.id === p.id))];
      await db.q(
        'INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)',
        ['page', cur.id, JSON.stringify({ bundle: { pages: [cur, ...others], sections, nav_items: nav } }), u.id]
      );

      /* الصفحات التي كانت تحتها ترتفع إلى مستواها، فلا يشير مسارها إلى صفحة غائبة */
      if (children.length) {
        await db.q('UPDATE pages SET parent_slug = ? WHERE parent_slug = ?', [cur.parent_slug, slug]);
      }
      for (const p of pointing) {
        const rest = json<string[]>(p.related, []).filter((x) => x !== slug);
        await db.q('UPDATE pages SET related = ? WHERE id = ?', [rest.length ? J(rest) : null, p.id]);
      }
      if (nav.length) {
        await db.q(`DELETE FROM nav_items WHERE id IN (${nav.map(() => '?').join(',')})`, nav.map((n) => n.id));
      }
      await db.q('DELETE FROM pages WHERE id = ?', [cur.id]);   // الأقسام تتبعها
    });

    await audit(u, 'page.delete', { entity: 'page', id: slug, summary: name });
    refreshSite();
    redirect(`/admin/pages?ok=deleted&name=${encodeURIComponent(name)}`);
  }

  const label = (r: any) => r.crumb_ar || r.crumb_en || r.slug;

  return (
    <Shell user={user} here="/admin/pages" title={`حذف «${name}»`} sub={`${slug}.html`}
           trail={[
             { label: 'لوحة التحكم', href: '/admin' },
             { label: 'الصفحات', href: '/admin/pages' },
             { label: name, href: `/admin/pages/${slug}` },
           ]}>
      {core ? (
        <div className="panel">
          <div className="panel__body">
            <p className="msg msg--bad">
              هذه صفحة أساسية يقوم عليها الموقع، ولا تُحذف. تقدر تعدّل نصوصها وأقسامها من محرّرها.
            </p>
            <a className="btn" href={`/admin/pages/${slug}`}>ارجع إلى الصفحة</a>
          </div>
        </div>
      ) : (
        <>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel__head"><h2>قبل ما تحذف: هل يكفي إخفاؤها؟</h2></div>
            <div className="panel__body">
              <p className="field__hint" style={{ marginTop: 0 }}>
                السحب من النشر يخفي الصفحة عن الزائر وتبقى كما هي عندك، وترجعها بضغطة.
                الحذف يشيلها هي وأقسامها من الموقع.
              </p>
              {page.published ? (
                <form action={hide}>
                  <button className="btn" type="submit">اسحبها من النشر بدل الحذف</button>
                </form>
              ) : <p className="tag tag--off">هي مسوّدة الآن — الزائر لا يراها أصلًا.</p>}
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel__head"><h2>ما سيحدث عند الحذف</h2></div>
            <div className="panel__body">
              <ul className="todo">
                <li><span className="todo__mark">×</span>
                  <span className="todo__text">تُحذف الصفحة وأقسامها ({sectionCount}).</span></li>
                {navLeaf.map((n) => (
                  <li key={n.id}><span className="todo__mark">×</span>
                    <span className="todo__text">يُحذف رابطها «{n.label_ar || n.label_en}» من {n.area === 'footer' ? 'الفوتر' : 'المنيو'}.</span></li>
                ))}
                {hit.children.map((c) => (
                  <li key={c.slug}><span className="todo__mark">↑</span>
                    <span className="todo__text">«{label(c)}» كانت تحتها، فتصير {page.parent_slug ? 'تحت الصفحة الأعلى منها' : 'صفحة رئيسية في مستواها'}.</span></li>
                ))}
                {hit.related.map((r) => (
                  <li key={r.slug}><span className="todo__mark">−</span>
                    <span className="todo__text">تُشال من «وصول مباشر» في صفحة «{label(r)}».</span></li>
                ))}
              </ul>
            </div>
          </div>

          {navKept.length || hit.linkedFrom.length ? (
            <div className="panel" style={{ marginBottom: 20, borderColor: '#e6c9a8' }}>
              <div className="panel__head" style={{ background: '#fdf6ee' }}>
                <h2>روابط لن تُصلَح وحدها</h2>
                <small>بعد الحذف ستنقل الزائر إلى صفحة غير موجودة — عدّلها</small>
              </div>
              <div className="panel__body">
                <ul className="todo">
                  {navKept.map((n) => (
                    <li key={n.id}><span className="todo__mark">!</span>
                      <span className="todo__text">«{n.label_ar || n.label_en}» في {n.area === 'footer' ? 'الفوتر' : 'المنيو'} — تحته قائمة، فلن يُحذف.</span>
                      <a className="btn btn--ghost btn--sm" href="/admin/nav">عدّل المنيو</a></li>
                  ))}
                  {hit.linkedFrom.map((s) => (
                    <li key={s.id}><span className="todo__mark">!</span>
                      <span className="todo__text">زرّ أو رابط في صفحة «{s.crumb_ar || s.slug}».</span>
                      <a className="btn btn--ghost btn--sm" href={`/admin/pages/${s.slug}/sections/${s.id}`}>افتحه</a></li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <div className="panel">
            <div className="panel__body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <form action={destroy}>
                <ConfirmButton className="btn btn--bad"
                  message={`حذف صفحة «${name}» نهائيًا من الموقع؟\n\nتقدر ترجعها كاملة بأقسامها وروابطها من «التراجع عن تعديل».`}>
                  احذف الصفحة
                </ConfirmButton>
              </form>
              <a className="btn btn--ghost" href={`/admin/pages/${slug}`}>لا، ارجع</a>
              <span className="field__hint" style={{ margin: 0 }}>
                تُحفظ نسخة كاملة في «التراجع عن تعديل»، فالحذف ليس نهائيًا.
              </span>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
