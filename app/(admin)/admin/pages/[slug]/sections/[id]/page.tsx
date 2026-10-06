/* محرّر قسم واحد.

   الحقول تُرسم من وصف النوع في lib/sectionSchema، والمحتوى يُعاد تركيبه من
   أسماء الحقول المنقوطة في lib/formJson. فإضافة نوع جديد لا تحتاج شاشة جديدة:
   يكفي وصفه في الملف الأول. */
import { notFound, redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { q, q1, json } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { refreshSite, snapshot, str, J } from '@/lib/admin';
import { SECTION_TYPES, typeLabel } from '@/lib/sectionSchema';
import { contentFromForm } from '@/lib/formJson';
import { cleanLinks } from '@/lib/links';
import { SectionForm } from '@/components/admin/SectionForm';

export const dynamic = 'force-dynamic';

export default async function SectionEditor({
  params,
}: { params: Promise<{ slug: string; id: string }> }) {
  const user = await requirePerm('pages.edit');
  const { slug, id } = await params;

  const page = await q1<any>('SELECT id, slug, crumb_ar, crumb_en FROM pages WHERE slug = ?', [slug]);
  if (!page) notFound();
  const section = await q1<any>(
    'SELECT id, type, anchor, content FROM sections WHERE id = ? AND page_id = ?',
    [Number(id), page.id]
  );
  if (!section) notFound();

  const spec = SECTION_TYPES[section.type];
  const content = json<any>(section.content, {});

  async function save(form: FormData) {
    'use server';
    const u = await requirePerm('pages.edit');
    await snapshot('section', section.id, u.id);
    const next = cleanLinks(spec ? contentFromForm(form, spec.fields, content) : content);
    await q('UPDATE sections SET anchor = ?, content = ? WHERE id = ?',
      [str(form, 'anchor'), J(next), section.id]);
    refreshSite();
    redirect(`/admin/pages/${slug}?ok=section`);
  }

  return (
    <Shell
      user={user} here="/admin/pages"
      title={typeLabel(section.type)}
      sub={`في صفحة «${page.crumb_ar || page.crumb_en || page.slug}»`}
      trail={[
        { label: 'لوحة التحكم', href: '/admin' },
        { label: 'الصفحات', href: '/admin/pages' },
        { label: page.crumb_ar || page.crumb_en || page.slug, href: `/admin/pages/${slug}` },
      ]}
      actions={
        <>
          <a className="btn btn--ghost" href={`/${page.slug}.html?lang=ar`} target="_blank" rel="noopener">عرض الصفحة ↗</a>
          <a className="btn btn--ghost" href={`/admin/pages/${slug}`}>رجوع</a>
        </>
      }
    >
      {!spec ? (
        <p className="msg msg--bad">
          هذا النوع (<code>{section.type}</code>) لا يُحرَّر من هنا بعد.
        </p>
      ) : (
        <SectionForm spec={spec} content={content} anchor={section.anchor} action={save} slug={slug} />
      )}
    </Shell>
  );
}
