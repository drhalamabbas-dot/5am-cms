/* الخطوة الأولى من معالج «صفحة جديدة»: الاسم والشكل.

   لماذا معالج لا نموذج واحد: إنشاء الصفحة من قبلُ كان يفرّق الخطوات على
   شاشات — تُنشأ الصفحة، ثم تُفتح، ثم يُفتح كل قسم على حدة، ثم يُبحث عن مربّع
   النشر. هنا خطوة تلو خطوة في مسار واحد، ولا يُطلب في كل خطوة إلا ما يلزمها. */
import { redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { q, q1 } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { refreshSite, slugify, str } from '@/lib/admin';
import { SECTION_TYPES, blankContent } from '@/lib/sectionSchema';
import { templateById } from '@/lib/pageTemplates';
import { TemplatePicker } from '@/components/admin/TemplatePicker';
import { Steps } from '@/components/admin/Steps';

export const dynamic = 'force-dynamic';

export default async function NewPage({
  searchParams,
}: { searchParams: Promise<{ e?: string }> }) {
  const user = await requirePerm('pages.create');
  const err = (await searchParams).e;

  async function create(form: FormData) {
    'use server';
    const u = await requirePerm('pages.create');
    const ar = str(form, 'crumb_ar');
    const en = str(form, 'crumb_en');
    /* المسار يُشتقّ من الاسم الإنجليزي تلقائيًا: حقلٌ أقلّ يُسأل عنه، وهو
       الحقل الذي لا يعرف غير المتخصّص ما يكتب فيه. */
    const slug = slugify(String(form.get('slug') || en || ''));
    if (!ar && !en) redirect('/admin/pages/new?e=name');
    if (!slug) redirect('/admin/pages/new?e=slug');
    if (await q1('SELECT id FROM pages WHERE slug = ?', [slug])) redirect('/admin/pages/new?e=dup');

    const [{ n }] = await q<{ n: number }>('SELECT COALESCE(MAX(position),0)+1 n FROM pages');
    await q(
      `INSERT INTO pages (slug, template, position, published, crumb_en, crumb_ar, hero)
       VALUES (?, 'sections', ?, 0, ?, ?, ?)`,
      [slug, n, en ?? ar, ar ?? en, JSON.stringify({ title: { en: en ?? '', ar: ar ?? '' } })]
    );
    const row = await q1<{ id: number }>('SELECT id FROM pages WHERE slug = ?', [slug]);
    const tpl = templateById(String(form.get('template') ?? 'blank'));
    if (row && tpl) {
      let pos = 0;
      for (const type of tpl.sections) {
        if (!SECTION_TYPES[type]) continue;
        await q(
          'INSERT INTO sections (page_id, type, position, published, content) VALUES (?,?,?,1,?)',
          [row.id, type, pos++, JSON.stringify(blankContent(type))]
        );
      }
    }
    await audit(u, 'page.create', { entity: 'page', id: slug, summary: ar || en || slug });
    refreshSite();
    redirect(`/admin/pages/new/${slug}`);
  }

  return (
    <Shell user={user} here="/admin/pages" title="صفحة جديدة"
           trail={[{ label: 'لوحة التحكم', href: '/admin' }, { label: 'الصفحات', href: '/admin/pages' }]}
           sub="ثلاث خطوات: الاسم والشكل، ثم المحتوى، ثم النشر.">
      <Steps at={1} />

      {err === 'name' ? <p className="msg msg--bad">اكتب اسم الصفحة.</p> : null}
      {err === 'slug' ? <p className="msg msg--bad">تعذّر اشتقاق عنوان الصفحة — اكتبه بنفسك في الخيارات الإضافية.</p> : null}
      {err === 'dup' ? <p className="msg msg--bad">هذا العنوان مستعمل في صفحة أخرى. غيّر الاسم أو اكتب عنوانًا آخر.</p> : null}

      <form action={create}>
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head"><h2>ما اسم الصفحة؟</h2></div>
          <div className="panel__body">
            <div className="row">
              <div className="field">
                <label htmlFor="crumb_ar">بالعربية</label>
                <input id="crumb_ar" name="crumb_ar" type="text" placeholder="مركز التدريب" autoFocus />
              </div>
              <div className="field">
                <label htmlFor="crumb_en">بالإنجليزية</label>
                <input id="crumb_en" name="crumb_en" type="text" dir="ltr" placeholder="Training centre" />
              </div>
            </div>
            <p className="field__hint" style={{ marginTop: 0 }}>
              هذا ما يظهر في المنيو وفي أعلى الصفحة. وعنوان الصفحة على الإنترنت
              يُشتقّ من الاسم الإنجليزي وحده — لا تحتاج كتابته.
            </p>

            <details className="more" style={{ marginTop: 14 }}>
              <summary>خيارات إضافية</summary>
              <div className="more__body">
                <div className="field">
                  <label htmlFor="slug">عنوان الصفحة على الإنترنت</label>
                  <input id="slug" name="slug" type="text" dir="ltr" placeholder="training-centre" />
                  <p className="field__hint">اتركه فارغًا ليُشتقّ من الاسم الإنجليزي.</p>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head">
            <h2>ما شكلها؟</h2>
            <small>تقدر تغيّر الأقسام وتضيف وتحذف بعد كده</small>
          </div>
          <div className="panel__body">
            <TemplatePicker />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" type="submit">التالي — املأ المحتوى ←</button>
          <a className="btn btn--ghost" href="/admin/pages">إلغاء</a>
        </div>
      </form>
    </Shell>
  );
}
