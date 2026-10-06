/* نسخ صفحة موجودة.

   لماذا: أقرب ما يفكّر به صاحب الموقع حين يريد صفحة جديدة هو «عايزها زي صفحة
   قطع الغيار». النسخ يعطيه ذلك: الأقسام نفسها بنصوصها وصورها، فلا يبدأ من
   بياض ولا من قالب فارغ — يستبدل الكلام ويمضي.

   تُنشأ مسوّدة دائمًا: نسخة لم تُراجَع لا يراها زائر. */
import { notFound, redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { q, q1, json } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { refreshSite, slugify, str, J } from '@/lib/admin';
import { typeLabel } from '@/lib/sectionSchema';

export const dynamic = 'force-dynamic';

export default async function CopyPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; e?: string }> }) {
  const user = await requirePerm('pages.create');
  const sp = await searchParams;
  const from = sp.from ?? '';

  const src = await q1<any>('SELECT * FROM pages WHERE slug = ?', [from]);
  if (!src) notFound();
  const sections = await q<any>(
    'SELECT id, type, anchor, position, published, content FROM sections WHERE page_id = ? ORDER BY position',
    [src.id]
  );

  const srcName = src.crumb_ar || src.crumb_en || src.slug;
  /* اقتراح مسار غير مستعمل: slug-2 ثم slug-3 … */
  const taken = (await q<{ slug: string }>('SELECT slug FROM pages')).map((r) => r.slug);
  let guess = `${src.slug}-2`;
  for (let i = 2; taken.includes(guess); i++) guess = `${src.slug}-${i + 1}`;

  async function copy(form: FormData) {
    'use server';
    const u = await requirePerm('pages.create');
    const ar = str(form, 'crumb_ar');
    const en = str(form, 'crumb_en');
    const slug = slugify(String(form.get('slug') || en || ''));
    if (!slug) redirect(`/admin/pages/new/copy?from=${from}&e=slug`);
    if (await q1('SELECT id FROM pages WHERE slug = ?', [slug])) {
      redirect(`/admin/pages/new/copy?from=${from}&e=dup`);
    }

    /* الهيرو يُنسخ كما هو، ويُستبدل عنوانه بالاسم الجديد كي لا تحمل النسخة
       عنوان أصلها فيلتبسا. */
    const hero = json<any>(src.hero, {}) ?? {};
    if (ar || en) hero.title = { en: en ?? '', ar: ar ?? '' };

    const [{ n }] = await q<{ n: number }>('SELECT COALESCE(MAX(position),0)+1 n FROM pages');
    await q(
      `INSERT INTO pages
         (slug, template, position, published, crumb_en, crumb_ar, parent_slug,
          title_en, description_en, og_image, noindex, hero, related, quote_solution)
       VALUES (?,?,?,0,?,?,?,?,?,?,?,?,?,?)`,
      [
        slug, src.template, n,
        en ?? src.crumb_en, ar ?? src.crumb_ar, src.parent_slug,
        src.title_en, src.description_en, src.og_image, src.noindex,
        /* related عمود JSON يعود مصفوفةً، وmysql2 يفرد المصفوفة وسائطَ
           فينكسر الاستعلام — فيُعاد نصًّا. */
        J(hero), J(json<string[]>(src.related, [])), src.quote_solution,
      ]
    );
    const row = await q1<{ id: number }>('SELECT id FROM pages WHERE slug = ?', [slug]);

    /* المعرّف المباشر يُنسخ كما هو: هو مُعرَّف داخل صفحته، فـ a.html#parts
       و b.html#parts عنوانان مختلفان ولا يتصادمان. */
    for (const s of sections) {
      await q(
        'INSERT INTO sections (page_id, type, anchor, position, published, content) VALUES (?,?,?,?,?,?)',
        [row!.id, s.type, s.anchor, s.position, s.published, J(json<any>(s.content, {}))]
      );
    }
    await audit(u, 'page.create', { entity: 'page', id: slug, summary: `${ar || en || slug} (نسخة من ${from})` });
    refreshSite();
    redirect(`/admin/pages/${slug}?ok=copy`);
  }

  return (
    <Shell user={user} here="/admin/pages" title={`نسخة من «${srcName}»`}
           trail={[{ label: 'لوحة التحكم', href: '/admin' }, { label: 'الصفحات', href: '/admin/pages' }]}
           sub="تُنسخ الأقسام بنصوصها وصورها. غيّر ما تشاء بعدها.">
      {sp.e === 'slug' ? <p className="msg msg--bad">اكتب اسمًا إنجليزيًا أو عنوانًا للصفحة.</p> : null}
      {sp.e === 'dup' ? <p className="msg msg--bad">هذا العنوان مستعمل في صفحة أخرى.</p> : null}

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <h2>سيُنسخ</h2>
          <small>{sections.length} قسم</small>
        </div>
        <div className="panel__body">
          <ul className="todo">
            {sections.map((s, i) => {
              const c = json<any>(s.content, {});
              return (
                <li key={s.id} className="is-done">
                  <span className="todo__mark">✓</span>
                  <span className="todo__text">
                    {i + 1} · {c?.title?.ar || c?.title?.en || typeLabel(s.type)}
                    <small style={{ marginInlineStart: 8 }}>{typeLabel(s.type)}</small>
                  </span>
                </li>
              );
            })}
            {sections.length === 0 ? <li><span className="todo__text">لا أقسام في هذه الصفحة</span></li> : null}
          </ul>
          <p className="field__hint">
            وتُنسخ معها صورة أعلى الصفحة وبيانات محركات البحث.
            <br />
            انتبه لأمر واحد: الأزرار التي تنقل إلى صفحات أخرى تُنسخ كما هي، فتظلّ
            تشير إلى وجهتها القديمة. راجعها بعد النسخ.
          </p>
        </div>
      </div>

      <form action={copy}>
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head"><h2>اسم النسخة</h2></div>
          <div className="panel__body">
            <div className="row">
              <div className="field">
                <label htmlFor="crumb_ar">بالعربية</label>
                <input id="crumb_ar" name="crumb_ar" type="text" defaultValue={`${srcName} — نسخة`} autoFocus />
              </div>
              <div className="field">
                <label htmlFor="crumb_en">بالإنجليزية</label>
                <input id="crumb_en" name="crumb_en" type="text" dir="ltr"
                       defaultValue={src.crumb_en ? `${src.crumb_en} copy` : ''} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="slug">عنوانها على الإنترنت</label>
              <input id="slug" name="slug" type="text" dir="ltr" defaultValue={guess} />
              <p className="field__hint">لا بدّ أن يختلف عن عنوان الصفحة الأصلية.</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" type="submit">انسخ الصفحة</button>
          <a className="btn btn--ghost" href="/admin/pages">إلغاء</a>
        </div>
        <p className="field__hint">تُنشأ مسوّدة لا يراها الزائر حتى تنشرها.</p>
      </form>
    </Shell>
  );
}
