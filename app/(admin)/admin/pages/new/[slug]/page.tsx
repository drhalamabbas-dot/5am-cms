/* الخطوة الثانية والثالثة من معالج «صفحة جديدة».

   الثانية: كل أقسام الصفحة في شاشة واحدة، كلٌّ بحقوله الأساسية وحدها. الغرض
   ألّا يفتح من ينشئ صفحةً خمسَ شاشات ليملأ خمسة أقسام.

   الثالثة: مراجعة ونشر. والصفحة تبقى مسوّدة حتى تُنشَر، فلا يرى الزائر عملًا
   نصفه مكتوب. */
import { notFound, redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { q, q1, json, tx } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { refreshSite, snapshot, str, J } from '@/lib/admin';
import { SECTION_TYPES, typeLabel } from '@/lib/sectionSchema';
import { contentFromForm, sameContent } from '@/lib/formJson';
import { cleanLinks } from '@/lib/links';
import { Steps } from '@/components/admin/Steps';
import { WizardContent } from '@/components/admin/WizardContent';

export const dynamic = 'force-dynamic';

export default async function WizardStep({
  params, searchParams,
}: { params: Promise<{ slug: string }>; searchParams: Promise<{ step?: string; ok?: string }> }) {
  const user = await requirePerm('pages.create');
  const { slug } = await params;
  const sp = await searchParams;
  const step = sp.step === '3' ? 3 : 2;

  const page = await q1<any>('SELECT * FROM pages WHERE slug = ?', [slug]);
  if (!page) notFound();
  const sections = await q<any>(
    'SELECT id, type, position, content FROM sections WHERE page_id = ? ORDER BY position',
    [page.id]
  );
  const hero = json<any>(page.hero, {});

  /* ------------------------------------------------- حفظ المحتوى كاملًا
     النموذج يعرض من كل قسم حقوله الأساسية وحدها، فيُبنى المحتوى منها وحدها:
     ما في «خيارات إضافية» (روابط الأزرار، الخلفيات…) لا يصل من النموذج،
     فيُنقل من المحتوى القديم كما هو بدل أن يُعدّ مُفرَّغًا ويُمحى.

     والكل في معاملة واحدة: نسخة كل قسم في السجل ثم تعديله، فإن فشل شيء في
     منتصفها لم يُكتب منها شيء. والحالة تُقرأ من القاعدة داخلها، لا مما رُسم
     قبل دقائق، كي لا يُكتب فوق تعديل حدث بينهما. */
  async function saveAll(form: FormData) {
    'use server';
    const u = await requirePerm('pages.create');

    await tx(async (db) => {
      const cur = await db.q1<any>('SELECT id, hero FROM pages WHERE id = ? FOR UPDATE', [page.id]);
      if (!cur) return;
      const rows = await db.q<any>(
        'SELECT id, type, content FROM sections WHERE page_id = ? ORDER BY position FOR UPDATE', [page.id]
      );

      /* أعلى الصفحة: ما في النموذج هو الحقيقة، فالحقل المُفرَّغ يُحذف فعلًا. */
      const nextHero: any = { ...json<any>(cur.hero, {}) };
      const img = str(form, 'hero.img');
      if (img) nextHero.img = img; else delete nextHero.img;
      for (const k of ['title', 'lede']) {
        const v = { en: str(form, `hero.${k}.en`) ?? '', ar: str(form, `hero.${k}.ar`) ?? '' };
        if (v.en || v.ar) nextHero[k] = v; else delete nextHero[k];
      }
      if (!sameContent(nextHero, json<any>(cur.hero, {}))) {
        await snapshot('page', page.id, u.id, db);
        await db.q('UPDATE pages SET hero = ? WHERE id = ?', [J(nextHero), page.id]);
      }

      /* كل قسم: تُستخرج حقوله من النموذج بإزالة بادئته. والأقسام التي كانت
         في النموذج تُعرف بعلامة sec — لا بوجود حقولها، فالقسم الذي فُرِّغ
         تمامًا لا يرسل حقولًا. وقسم أُضيف من نافذة أخرى بعد فتح النموذج ليس
         بينها، فلا يُلمس. */
      const shown = new Set(form.getAll('sec').map(Number));
      for (const s of rows) {
        const spec = SECTION_TYPES[s.type];
        if (!spec || !shown.has(s.id)) continue;
        const pre = `s${s.id}.`;
        const sub = new FormData();
        for (const [k, v] of form.entries()) {
          if (typeof v === 'string' && k.startsWith(pre)) sub.append(k.slice(pre.length), v);
        }
        const main = spec.fields.filter((f) => !f.advanced);
        const before = json<any>(s.content, {});
        const after = cleanLinks(contentFromForm(sub, main, before));
        if (sameContent(after, before)) continue;
        await snapshot('section', s.id, u.id, db);
        await db.q('UPDATE sections SET content = ? WHERE id = ?', [J(after), s.id]);
      }
    });

    refreshSite();
    redirect(form.get('go') === 'close'
      ? `/admin/pages/${slug}?ok=saved`
      : `/admin/pages/new/${slug}?step=3`);
  }

  /* ----------------------------------------------------------- النشر */
  async function publish() {
    'use server';
    const u = await requirePerm('pages.publish');
    await q('UPDATE pages SET published = 1 WHERE id = ?', [page.id]);
    await audit(u, 'page.publish', { entity: 'page', id: slug, summary: page.crumb_ar || page.crumb_en || slug });
    refreshSite();
    redirect(`/admin/pages/${slug}?ok=pub`);
  }

  async function addToNav() {
    'use server';
    await requirePerm('nav.edit');
    const [{ n }] = await q<{ n: number }>(
      "SELECT COALESCE(MAX(position),-1)+1 n FROM nav_items WHERE area='header' AND parent_id IS NULL"
    );
    await q(
      `INSERT INTO nav_items (area, parent_id, position, label_en, label_ar, href, published)
       VALUES ('header', NULL, ?, ?, ?, ?, 1)`,
      [n, page.crumb_en ?? slug, page.crumb_ar ?? page.crumb_en ?? slug, `${slug}.html`]
    );
    refreshSite();
    redirect(`/admin/pages/new/${slug}?step=3&ok=nav`);
  }

  const title = page.crumb_ar || page.crumb_en || slug;

  /* ============================================ الخطوة الثالثة: المراجعة */
  if (step === 3) {
    const inNav = await q<any>('SELECT id FROM nav_items WHERE href = ? OR href LIKE ?',
      [`${slug}.html`, `${slug}.html#%`]);
    const filled = sections.filter((s) => {
      const c = json<any>(s.content, {});
      return c?.title?.ar || c?.title?.en;
    }).length;

    return (
      <Shell user={user} here="/admin/pages" title={`${title} — جاهزة للنشر`}
             trail={[{ label: 'لوحة التحكم', href: '/admin' }, { label: 'الصفحات', href: '/admin/pages' }]}
             sub={`${slug}.html`}>
        <Steps at={3} />
        {sp.ok === 'nav' ? <p className="msg msg--ok">أُضيف رابط الصفحة إلى المنيو.</p> : null}

        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head"><h2>راجع قبل النشر</h2></div>
          <div className="panel__body">
            <ul className="todo">
              <li className={filled === sections.length && sections.length ? 'is-done' : ''}>
                <span className="todo__mark">{filled === sections.length && sections.length ? '✓' : '○'}</span>
                <span className="todo__text">
                  {sections.length ? `${filled} من ${sections.length} أقسام مملوءة` : 'لا أقسام'}
                </span>
                <a className="btn btn--ghost btn--sm" href={`/admin/pages/new/${slug}`}>عدّل</a>
              </li>
              <li className={hero?.img ? 'is-done' : ''}>
                <span className="todo__mark">{hero?.img ? '✓' : '○'}</span>
                <span className="todo__text">صورة أعلى الصفحة</span>
                <a className="btn btn--ghost btn--sm" href={`/admin/pages/new/${slug}`}>عدّل</a>
              </li>
              <li className={inNav.length ? 'is-done' : ''}>
                <span className="todo__mark">{inNav.length ? '✓' : '○'}</span>
                <span className="todo__text">رابط في المنيو</span>
                {inNav.length ? null : (
                  <form action={addToNav}>
                    <button className="btn btn--ghost btn--sm" type="submit">أضفها</button>
                  </form>
                )}
              </li>
            </ul>

            <p className="field__hint" style={{ marginTop: 16 }}>
              الصفحة ما زالت مسوّدة — لا يراها الزائر. افتحها في تبويب جديد لتتأكّد
              من شكلها، ثم انشرها.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <form action={publish}>
            <button className="btn" type="submit">انشر الصفحة</button>
          </form>
          <a className="btn btn--ghost" href={`/${slug}.html?lang=ar`} target="_blank" rel="noopener">
            عاينها أولًا ↗
          </a>
          <a className="btn btn--ghost" href={`/admin/pages/${slug}`}>احفظها مسوّدة وأغلق</a>
        </div>
      </Shell>
    );
  }

  /* ============================================= الخطوة الثانية: المحتوى */
  return (
    <Shell user={user} here="/admin/pages" title={title}
           trail={[{ label: 'لوحة التحكم', href: '/admin' }, { label: 'الصفحات', href: '/admin/pages' }]}
           sub="املأ ما تعرفه الآن — تقدر تكمل أي حاجة بعدين.">
      <Steps at={2} />
      <WizardContent
        hero={hero}
        sections={sections.map((s) => ({
          id: s.id, type: s.type, label: typeLabel(s.type), content: json<any>(s.content, {}),
        }))}
        action={saveAll}
        slug={slug}
      />
    </Shell>
  );
}
