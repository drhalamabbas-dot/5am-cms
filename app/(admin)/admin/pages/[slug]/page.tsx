/* محرّر الصفحة: إعداداتها وأعلاها، ثم أقسامها بالترتيب.

   التعديل هنا يظهر للزائر فور الحفظ: refreshSite تُنسي Next نسخته المخزّنة. */
import { notFound, redirect } from 'next/navigation';
import { requireAnyPerm, requirePerm } from '@/lib/auth';
import { q, q1, json } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { refreshSite, snapshot, str, bool, J, CORE_TEMPLATES, EDITABLE_TEMPLATES } from '@/lib/admin';
import { SECTION_TYPES, ADDABLE, typeLabel, blankContent } from '@/lib/sectionSchema';
import { PageForm } from '@/components/admin/PageForm';
import { SectionPicker } from '@/components/admin/SectionPicker';
import { ConfirmButton } from '@/components/ConfirmButton';
import { moveSection, toggleSection, deleteSection } from '@/lib/sectionOps';
import { can } from '@/lib/permissions';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export default async function PageEditor({
  params, searchParams,
}: { params: Promise<{ slug: string }>; searchParams: Promise<{ ok?: string; after?: string }> }) {
  const user = await requireAnyPerm(['pages.edit', 'pages.publish', 'pages.create', 'pages.delete']);
  const { slug } = await params;
  const sp = await searchParams;
  const saved = sp.ok;
  const afterId = Number(sp.after) || 0;

  const page = await q1<any>('SELECT * FROM pages WHERE slug = ?', [slug]);
  if (!page) notFound();
  const sections = await q<any>(
    'SELECT id, type, anchor, position, published, content FROM sections WHERE page_id = ? ORDER BY position',
    [page.id]
  );
  const allPages = await q<any>('SELECT slug, crumb_ar, crumb_en FROM pages ORDER BY position');
  /* هل لهذه الصفحة رابط في المنيو أو الفوتر؟ الصفحة بلا رابط لا يصل إليها
     زائر مهما كانت منشورة. */
  const inNav = await q<any>(
    "SELECT area FROM nav_items WHERE href = ? OR href LIKE ?",
    [`${slug}.html`, `${slug}.html#%`]
  );
  const hero = json<any>(page.hero, {});
  /* قسم أُنشئ من قالب ولم يُملأ بعد: لا عنوان له في أي لغة. */
  const emptyCount = sections.filter((s) => {
    const c = json<any>(s.content, {});
    return !(c?.title?.ar || c?.title?.en || c?.h?.ar || c?.h?.en);
  }).length;

  /* كل بند في القائمة يحمل طريقه: زرٌّ ينفّذه، أو رابط ينقلك إلى مكانه.
     قائمة تقول «افعل» ولا تُمكّنك من الفعل تترك المستعمل يبحث. */
  const todo = [
    { done: emptyCount === 0 && sections.length > 0,
      text: emptyCount ? `املأ ${emptyCount} قسمًا ما زال فارغًا` : 'املأ أقسام الصفحة',
      go: '#sections' },
    { done: Boolean(hero?.img), text: 'اختر الصورة الكبيرة أعلى الصفحة', go: '#top' },
    { done: inNav.length > 0, text: 'ضع لها رابطًا في المنيو', act: 'nav' },
    { done: Boolean(page.title_en && page.description_en),
      text: 'اكتب عنوانها ووصفها لجوجل', go: '#seo' },
    { done: Boolean(page.published), text: 'انشر الصفحة ليراها الزائر', act: 'publish' },
  ];
  const left = todo.filter((t) => !t.done);

  /* ---------------------------------------------------- حفظ إعدادات الصفحة */
  async function savePage(form: FormData) {
    'use server';
    const u = await requirePerm('pages.edit');
    await snapshot('page', page.id, u.id);
    const hero = {
      img: str(form, 'hero.img'),
      kicker: { en: str(form, 'hero.kicker.en'), ar: str(form, 'hero.kicker.ar') },
      title: { en: str(form, 'hero.title.en'), ar: str(form, 'hero.title.ar') },
      lede: { en: str(form, 'hero.lede.en'), ar: str(form, 'hero.lede.ar') },
    };
    const clean = (o: any) => {
      const out: any = {};
      for (const [k, v] of Object.entries(o)) {
        if (v == null) continue;
        if (typeof v === 'object') {
          const inner = clean(v);
          if (Object.keys(inner).length) out[k] = inner;
        } else out[k] = v;
      }
      return out;
    };
    const related = String(form.get('related') ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
    /* مربّع «منشورة» لا يغيّر شيئًا لمن لا يملك صلاحية النشر */
    const was = await q1<any>('SELECT published FROM pages WHERE id = ?', [page.id]);
    const published = can(u, 'pages.publish') ? bool(form, 'published') : Number(was?.published ?? 0);
    await q(
      `UPDATE pages SET crumb_ar = ?, crumb_en = ?, parent_slug = ?, title_en = ?,
         description_en = ?, title_ar = ?, description_ar = ?, og_image = ?, noindex = ?, published = ?,
         quote_solution = ?, related = ?, hero = ? WHERE id = ?`,
      [
        str(form, 'crumb_ar'), str(form, 'crumb_en'), str(form, 'parent_slug'),
        str(form, 'title_en'), str(form, 'description_en'),
        str(form, 'title_ar'), str(form, 'description_ar'), str(form, 'og_image'),
        bool(form, 'noindex'), published,
        str(form, 'quote_solution'),
        related.length ? J(related) : null,
        Object.keys(clean(hero)).length ? J(clean(hero)) : null,
        page.id,
      ]
    );
    const name = str(form, 'crumb_ar') ?? str(form, 'crumb_en') ?? slug;
    await audit(u, 'page.save', { entity: 'page', id: slug, summary: name });
    if (Number(published) !== Number(was?.published ?? 0)) {
      await audit(u, published ? 'page.publish' : 'page.unpublish', { entity: 'page', id: slug, summary: name });
    }
    refreshSite();
    redirect(`/admin/pages/${slug}?ok=page`);
  }

  /* ------------------------------------------- ترتيب وإخفاء وحذف
     المنطق في lib/sectionOps.ts، مشتركًا مع شريط التحرير على الموقع. */
  async function move(form: FormData) {
    'use server';
    const u = await requirePerm('pages.edit');
    await moveSection(page.id, Number(form.get('id')), Number(form.get('dir')), u.id);
    refreshSite();
    redirect(`/admin/pages/${slug}?ok=order`);
  }

  async function remove(form: FormData) {
    'use server';
    const u = await requirePerm('pages.edit');
    await deleteSection(page.id, Number(form.get('id')), u.id);
    refreshSite();
    redirect(`/admin/pages/${slug}?ok=del`);
  }

  async function toggle(form: FormData) {
    'use server';
    const u = await requirePerm('pages.edit');
    await toggleSection(page.id, Number(form.get('id')), u.id);
    refreshSite();
    redirect(`/admin/pages/${slug}?ok=vis`);
  }

  /** النشر بضغطة من القائمة، بلا نزول إلى الإعدادات وبحث عن مربّع. */
  async function publish() {
    'use server';
    const u = await requirePerm('pages.publish');
    await snapshot('page', page.id, u.id);
    await q('UPDATE pages SET published = 1 WHERE id = ?', [page.id]);
    await audit(u, 'page.publish', { entity: 'page', id: slug, summary: page.crumb_ar || page.crumb_en || slug });
    refreshSite();
    redirect(`/admin/pages/${slug}?ok=pub`);
  }

  async function unpublish() {
    'use server';
    const u = await requirePerm('pages.publish');
    await snapshot('page', page.id, u.id);
    await q('UPDATE pages SET published = 0 WHERE id = ?', [page.id]);
    await audit(u, 'page.unpublish', { entity: 'page', id: slug, summary: page.crumb_ar || page.crumb_en || slug });
    refreshSite();
    redirect(`/admin/pages/${slug}?ok=unpub`);
  }

  /** يضع للصفحة رابطًا في آخر المنيو العلوي، فتصير قابلة للوصول بضغطة. */
  async function addToNav() {
    'use server';
    await requirePerm('nav.edit');
    const [{ n }] = await q<{ n: number }>(
      "SELECT COALESCE(MAX(position),-1)+1 n FROM nav_items WHERE area = 'header' AND parent_id IS NULL"
    );
    await q(
      `INSERT INTO nav_items (area, parent_id, position, label_en, label_ar, href, published)
       VALUES ('header', NULL, ?, ?, ?, ?, 1)`,
      [n, page.crumb_en ?? slug, page.crumb_ar ?? page.crumb_en ?? slug, `${slug}.html`]
    );
    refreshSite();
    redirect(`/admin/pages/${slug}?ok=nav`);
  }

  /**
   * يضيف قسمًا. وإن أُعطي `after` وُضع القسم الجديد مباشرةً بعد صاحبه بدل
   * آخر الصفحة — فإدخال قسم بين قسمين ضغطةٌ واحدة لا رحلةُ أسهم إلى أعلى.
   */
  async function add(form: FormData) {
    'use server';
    await requirePerm('pages.edit');
    const type = String(form.get('type') ?? '');
    if (!SECTION_TYPES[type]) redirect(`/admin/pages/${slug}`);

    const after = Number(form.get('after')) || 0;
    const list = await q<any>(
      'SELECT id, position FROM sections WHERE page_id = ? ORDER BY position, id', [page.id]
    );
    const at = after ? list.findIndex((s) => s.id === after) + 1 : list.length;

    /* يُفسح مكانٌ بإزاحة ما بعده، ثم يُكتب الجديد في الفجوة */
    for (let k = list.length - 1; k >= at; k--) {
      await q('UPDATE sections SET position = ? WHERE id = ?', [k + 1, list[k].id]);
    }
    await q(
      'INSERT INTO sections (page_id, type, position, published, content) VALUES (?,?,?,1,?)',
      [page.id, type, at, J(blankContent(type))]
    );
    refreshSite();
    const row = await q1<any>(
      'SELECT id FROM sections WHERE page_id = ? AND position = ?', [page.id, at]
    );
    redirect(row ? `/admin/pages/${slug}/sections/${row.id}` : `/admin/pages/${slug}`);
  }

  const MSG: Record<string, string> = {
    page: 'حُفظت إعدادات الصفحة.', order: 'تغيّر الترتيب.',
    del: 'حُذف القسم — نسخته محفوظة في سجل التعديلات.',
    vis: 'تغيّرت حالة الظهور.', section: 'حُفظ القسم.',
    nav: 'أُضيف رابط الصفحة إلى المنيو — رتّب مكانه من «المنيو والفوتر».',
    copy: 'نُسخت الصفحة — هذه نسخة جديدة مسوّدة، عدّل نصوصها ثم انشرها.',
    pub: 'نُشرت الصفحة — الزائر يراها الآن.',
    unpub: 'سُحبت من النشر — صارت مسوّدة لا يراها الزائر.',
    saved: 'حُفظ ما كتبته. أكمل أي قسم من هنا وقت ما تحب.',
  };

  return (
    <Shell
      user={user} here="/admin/pages"
      title={page.crumb_ar || page.crumb_en || page.slug}
      sub={`${page.slug}.html`}
      trail={[{ label: 'لوحة التحكم', href: '/admin' }, { label: 'الصفحات', href: '/admin/pages' }]}
      actions={
        <>
          {EDITABLE_TEMPLATES.includes(page.template) ? (
            <a className="btn" href={`/admin/edit/${page.slug}`}>عدّل وأنت شايف الصفحة</a>
          ) : null}
          <a className="btn btn--ghost" href={`/${page.slug}.html?lang=ar`} target="_blank" rel="noopener">عرض الصفحة ↗</a>
          <a className="btn btn--ghost" href="/admin/pages">كل الصفحات</a>
        </>
      }
    >
      {saved ? <p className="msg msg--ok">{MSG[saved] ?? 'تم الحفظ.'}</p> : null}

      {/* الصفحة مكتملة ومنشورة: شريط واحد يؤكّد ويتيح السحب من النشر */}
      {!left.length ? (
        <div className="msg msg--ok" style={{ display: 'flex', justifyContent: 'space-between',
                                              alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>الصفحة مكتملة ومنشورة — الزائر يراها الآن.</span>
          <form action={unpublish}>
            <button className="btn btn--ghost btn--sm" type="submit">اسحبها من النشر</button>
          </form>
        </div>
      ) : null}

      {/* ما تبقّى على هذه الصفحة كي تكتمل. يختفي حين لا يبقى شيء. */}
      {left.length ? (
        <div className="panel" style={{ marginBottom: 22, borderColor: '#e6c9a8' }}>
          <div className="panel__head" style={{ background: '#fdf6ee' }}>
            <h2>باقي {left.length} خطوة</h2>
            <small>{page.published ? 'منشورة' : 'مسوّدة — لا يراها الزائر'}</small>
          </div>
          <div className="panel__body">
            <ul className="todo">
              {todo.map((t, i) => (
                <li key={i} className={t.done ? 'is-done' : ''}>
                  <span className="todo__mark">{t.done ? '✓' : '○'}</span>
                  <span className="todo__text">{t.text}</span>
                  {t.done ? null : t.act === 'publish' ? (
                    <form action={publish}><button className="btn btn--sm" type="submit">انشر الآن</button></form>
                  ) : t.act === 'nav' ? (
                    <form action={addToNav}><button className="btn btn--ghost btn--sm" type="submit">أضفها للمنيو</button></form>
                  ) : t.go ? (
                    <a className="btn btn--ghost btn--sm" href={t.go}>اذهب</a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="panel" style={{ marginBottom: 22 }} id="sections">
        <div className="panel__head">
          <h2>الأقسام</h2>
          <small>{sections.length} قسم — الترتيب هنا هو ترتيب الظهور في الصفحة</small>
        </div>
        {sections.length === 0 ? (
          <p className="empty">لا أقسام بعد. أضف واحدًا من الأسفل.</p>
        ) : (
          <table>
            <tbody>
              {sections.map((s, i) => {
                const c = json<any>(s.content, {});
                const title = c?.title?.ar || c?.title?.en || c?.h?.ar || '';
                return (
                  <tr key={s.id}>
                    <td style={{ width: 40, color: 'var(--muted)' }}>{i + 1}</td>
                    <td>
                      <strong style={title ? undefined : { color: 'var(--muted)', fontWeight: 500 }}>
                        {title || 'لم يُملأ بعد'}
                      </strong>
                      <br /><small>{typeLabel(s.type)}{s.anchor ? ` · #${s.anchor}` : ''}</small>
                    </td>
                    <td style={{ width: 110 }}>
                      {title ? null : <span className="tag tag--todo">يحتاج ملء</span>}
                      {s.published ? null : <span className="tag tag--off">مخفي</span>}
                    </td>
                    <td style={{ textAlign: 'end', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', gap: 6 }}>
                        <form action={move}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="dir" value={-1} />
                          <button className="btn btn--ghost btn--sm" disabled={i === 0} title="أعلى">↑</button>
                        </form>
                        <form action={move}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="dir" value={1} />
                          <button className="btn btn--ghost btn--sm" disabled={i === sections.length - 1} title="أسفل">↓</button>
                        </form>
                        <form action={toggle}>
                          <input type="hidden" name="id" value={s.id} />
                          <button className="btn btn--ghost btn--sm">{s.published ? 'إخفاء' : 'إظهار'}</button>
                        </form>
                        <a className="btn btn--sm" href={`/admin/pages/${slug}/sections/${s.id}`}>تعديل</a>
                        <a className="btn btn--ghost btn--sm" href="#add-section"
                           data-add-after={s.id}
                           title="أضف قسمًا جديدًا تحت هذا مباشرةً">+ تحته</a>
                        <form action={remove}>
                          <input type="hidden" name="id" value={s.id} />
                          <ConfirmButton className="btn btn--bad btn--sm"
                            message={`حذف قسم «${title || typeLabel(s.type)}»؟\n\nتقدر ترجعه من «التراجع عن تعديل».\nلو عاوز تخفيه بس، اضغط «إلغاء» واختر «إخفاء».`}>
                            حذف
                          </ConfirmButton>
                        </form>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="panel__body" style={{ borderTop: '1px solid var(--line)' }}>
          <form action={add} id="add-section">
            <p className="step">أضف قسمًا — اختر شكله</p>
            <SectionPicker
              options={ADDABLE}
              initialAfter={afterId}
              after={sections.map((s) => {
                const c = json<any>(s.content, {});
                return {
                  id: s.id,
                  label: c?.title?.ar || c?.title?.en || typeLabel(s.type),
                };
              })}
            />
            <button className="btn" type="submit" style={{ marginTop: 16 }}>أضف القسم</button>
          </form>
        </div>
      </div>

      <PageForm page={page} allPages={allPages} action={savePage} />

      {CORE_TEMPLATES.includes(page.template) ? null : (
        <div className="panel" style={{ marginTop: 22 }}>
          <div className="panel__body" style={{ display: 'flex', justifyContent: 'space-between',
                                                alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="field__hint" style={{ margin: 0 }}>
              مش محتاج الصفحة دي؟ تقدر تسحبها من النشر أو تحذفها — وتشوف قبلها إيه اللي هيتأثر.
            </span>
            <a className="btn btn--bad btn--sm" href={`/admin/pages/${slug}/delete`}>احذف هذه الصفحة…</a>
          </div>
        </div>
      )}
    </Shell>
  );
}
