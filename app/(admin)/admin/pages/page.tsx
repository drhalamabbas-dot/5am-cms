/* قائمة صفحات الموقع، وإنشاء صفحة جديدة.

   القالب يحدّد شكل الصفحة: sections لصفحات المحتوى (صورة وعنوان ثم أقسام)، وonepage
   للرئيسية، وproduct وquote لصفحتيهما. الصفحة الجديدة تبدأ بقالب sections. */
import { requireAnyPerm } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { refreshSite, slugify, str, EDITABLE_TEMPLATES } from '@/lib/admin';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const TEMPLATE_AR: Record<string, string> = {
  sections: 'صفحة محتوى', onepage: 'الرئيسية', product: 'صفحة منتج',
  quote: 'نموذج عرض سعر', equipment: 'كتالوج المعدات',
};

export default async function PagesList({
  searchParams,
}: { searchParams: Promise<{ e?: string; ok?: string; name?: string }> }) {
  const user = await requireAnyPerm(['pages.edit', 'pages.publish', 'pages.create', 'pages.delete']);
  const sp = await searchParams;
  const err = sp.e;
  const all = await q<any>(
    `SELECT p.id, p.slug, p.template, p.published, p.crumb_ar, p.crumb_en, p.parent_slug, p.redirect_to,
            (SELECT COUNT(*) FROM sections s WHERE s.page_id = p.id) AS sections
       FROM pages p ORDER BY p.position, p.id`
  );

  /* الترتيب يتبع بنية الموقع لا ترتيب النقل: الصفحة الأم ثم صفحاتها تحتها،
     والصفحات الخدمية في مجموعة على حدة، والتحويلات في آخر القائمة. */
  const SERVICE = ['index', 'quote', 'model', 'equipment'];
  const byParent = (slug: string) => all.filter((p) => p.parent_slug === slug && !p.redirect_to);
  const used = new Set<string>();
  const take = (p: any) => { used.add(p.slug); return p; };

  const groups: { title: string; rows: { row: any; depth: number }[] }[] = [];

  groups.push({
    title: 'صفحات أساسية',
    rows: all.filter((p) => SERVICE.includes(p.slug) && !p.redirect_to)
      .sort((a, b) => SERVICE.indexOf(a.slug) - SERVICE.indexOf(b.slug))
      .map((p) => ({ row: take(p), depth: 0 })),
  });

  const contentRows: { row: any; depth: number }[] = [];
  for (const p of all) {
    if (used.has(p.slug) || p.redirect_to || p.parent_slug) continue;
    contentRows.push({ row: take(p), depth: 0 });
    for (const child of byParent(p.slug)) {
      if (used.has(child.slug)) continue;
      contentRows.push({ row: take(child), depth: 1 });
    }
  }
  /* صفحة لها أمٌّ غير مدرجة: تُعرض في مستواها كي لا تختفي من القائمة. */
  for (const p of all) {
    if (used.has(p.slug) || p.redirect_to) continue;
    contentRows.push({ row: take(p), depth: 0 });
  }
  groups.push({ title: 'صفحات المحتوى', rows: contentRows });

  const redirects = all.filter((p) => p.redirect_to).map((p) => ({ row: p, depth: 0 }));
  if (redirects.length) groups.push({ title: 'روابط قديمة تُحوَّل', rows: redirects });

  return (
    <Shell user={user} here="/admin/pages" title="الصفحات"
           trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub="اضغط «تعديل» لتغيير نصوص الصفحة وصورها وترتيب أقسامها."
           actions={<a className="btn" href="/admin/pages/new">+ صفحة جديدة</a>}>
      {sp.ok === 'deleted' ? (
        <p className="msg msg--ok">
          حُذفت صفحة «{sp.name ?? ''}». لو غيّرت رأيك، ترجعها كاملة من{' '}
          <a href="/admin/history">التراجع عن تعديل</a>.
        </p>
      ) : null}
      {err === 'slug' ?<p className="msg msg--bad">المسار مطلوب، ويُكتب بحروف إنجليزية وأرقام وشرطات.</p> : null}
      {err === 'dup' ? <p className="msg msg--bad">هذا المسار مستعمل في صفحة أخرى.</p> : null}

      {groups.filter((g) => g.rows.length).map((g) => (
        <div className="panel" style={{ marginBottom: 22 }} key={g.title}>
          <div className="panel__head">
            <h2>{g.title}</h2>
            <small>{g.rows.length}</small>
          </div>
          <table>
            <thead>
              <tr><th>الصفحة</th><th>المسار</th><th>القالب</th><th>الأقسام</th><th>الحالة</th><th /></tr>
            </thead>
            <tbody>
              {g.rows.map(({ row: p, depth }) => (
                <tr key={p.id}>
                  <td style={{ paddingInlineStart: 14 + depth * 26 }}>
                    {depth ? <span style={{ color: 'var(--muted)', marginInlineEnd: 6 }}>↳</span> : null}
                    <strong>{p.crumb_ar || p.crumb_en || p.slug}</strong>
                    {p.crumb_en && p.crumb_ar ? <><br /><small dir="ltr">{p.crumb_en}</small></> : null}
                  </td>
                  <td><code dir="ltr">{p.slug}.html</code></td>
                  <td><span className="tag">{TEMPLATE_AR[p.template] ?? p.template}</span></td>
                  <td>{p.redirect_to ? <small dir="ltr">→ {p.redirect_to}</small> : p.sections}</td>
                  <td>
                    <span className={`tag ${p.published ? 'tag--on' : 'tag--off'}`}>
                      {p.published ? 'منشورة' : 'مسوّدة'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'end', whiteSpace: 'nowrap' }}>
                    <a className="btn btn--ghost btn--sm" href={`/${p.slug}.html?lang=ar`} target="_blank" rel="noopener">عرض</a>{' '}
                    {p.redirect_to ? null : (
                      <>
                        <a className="btn btn--ghost btn--sm" href={`/admin/pages/new/copy?from=${p.slug}`}
                           title="أنشئ صفحة جديدة بنفس أقسام هذه">انسخ</a>{' '}
                      </>
                    )}
                    {EDITABLE_TEMPLATES.includes(p.template) && !p.redirect_to ? (
                      <>
                        <a className="btn btn--sm" href={`/admin/edit/${p.slug}`}
                           title="عدّل وأنت شايف الصفحة">تعديل مرئي</a>{' '}
                      </>
                    ) : null}
                    <a className={`btn btn--sm${EDITABLE_TEMPLATES.includes(p.template) && !p.redirect_to ? ' btn--ghost' : ''}`}
                       href={`/admin/pages/${p.slug}`}>{EDITABLE_TEMPLATES.includes(p.template) && !p.redirect_to ? 'الإعدادات' : 'تعديل'}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

            <p className="field__hint">
        لإضافة صفحة، اضغط «+ صفحة جديدة» في أعلى الشاشة.
      </p>

    </Shell>
  );
}
