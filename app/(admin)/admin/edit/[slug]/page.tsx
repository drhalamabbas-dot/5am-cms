/* المحرّر المرئي — على طريقة Shopify.

   الصفحة الحقيقية في الوسط، وأقسامها في قائمة جانبية. يُضغط القسم في
   الصفحة أو في القائمة فتظهر حقوله، وكل ما يُكتب يظهر في الصفحة بعد لحظة —
   معاينةً لا يراها الزائر (lib/previewStore.ts). لا يتغيّر شيء في الموقع حتى
   «احفظ»، والحفظ كله معاملة واحدة مع نسخة في السجل لكل ما تغيّر.

   الوحدة هي القسم بتصميمه الحالي: يُعدَّل محتواه ويُرتَّب ويُخفى ويُضاف، ولا
   يُغيَّر شكله — فيبقى الموقع بهويته. */
import crypto from 'node:crypto';
import { notFound } from 'next/navigation';
import { requireUser, requireAnyPerm } from '@/lib/auth';
import { can, PERMISSION_LABEL } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { q, q1, json, tx } from '@/lib/db';
import { refreshSite, snapshot, J, slugify, EDITABLE_TEMPLATES } from '@/lib/admin';
import { SECTION_TYPES, ADDABLE, blankContent } from '@/lib/sectionSchema';
import { sameContent } from '@/lib/formJson';
import { cleanLinks, siteHref } from '@/lib/links';
import { cleanTheme, cleanDesign, type Theme } from '@/lib/design';
import { VisualEditor, type EdSection } from '@/components/admin/VisualEditor';
import type { NavRow } from '@/lib/nav';

export const dynamic = 'force-dynamic';

/**
 * بصمة ما يحرّره المحرّر من الصفحة: أعلاها وكل أقسامها بمحتواها وترتيبها
 * وظهورها. إن تغيّرت بعد فتح المحرّر، فقد عُدّلت من مكان آخر. البصمة من
 * المحتوى نفسه لا من أوقات التعديل، فتعديلان في الثانية نفسها لا يفوتان.
 */
async function versionOf(db: { q: typeof q; q1: typeof q1 }, pageId: number): Promise<string> {
  const p = await db.q1<any>('SELECT hero FROM pages WHERE id = ?', [pageId]);
  if (!p) return '';
  const rows = await db.q<any>(
    'SELECT id, type, anchor, position, published, content FROM sections WHERE page_id = ? ORDER BY position, id', [pageId]
  );
  const norm = rows.map((r) => [r.id, r.type, r.anchor, r.position, r.published, json(r.content, {})]);
  /* والهيدر: يُحرَّر من المحرّر أيضًا، فتعديله من «المنيو والفوتر» أثناء فتح
     المحرّر تعارضٌ كذلك. */
  const nav = (await readNav(db)).map((r) => [r.id, r.parent_id, r.position, r.label_en, r.label_ar, r.href, r.desc_en, r.desc_ar, r.published]);
  /* وألوان الموقع وخطوطه: تُحرَّر من هنا أيضًا */
  const theme = await readTheme(db);
  return crypto.createHash('sha1').update(JSON.stringify([json(p.hero, {}), norm, nav, theme])).digest('hex');
}

/** تصميم القسم يُحفظ بقيمه الصالحة وحدها، ولا يُحفظ إن لم يبقَ منه شيء. */
function withDesign<T extends Record<string, any>>(content: T): T {
  if (!('design' in content)) return content;
  const { design, ...rest } = content;
  const d = cleanDesign(design);
  return (Object.keys(d).length ? { ...rest, design: d } : rest) as T;
}

/** ألوان الموقع وخطوطه المحفوظة، بعد الفحص (lib/design.ts). */
async function readTheme(db: { q1: typeof q1 }): Promise<Theme> {
  const r = await db.q1<any>("SELECT `value` FROM settings WHERE `key` = 'theme'");
  return cleanTheme(r ? json<any>(r.value, {}) : {});
}

/** صفوف المنيو العلوي كلها، المخفي منها أيضًا — بالشكل الذي يحرّره المحرّر. */
async function readNav(db: { q: typeof q }): Promise<NavRow[]> {
  const rows = await db.q<any>(
    `SELECT id, parent_id, area, position, label_en, label_ar, href, desc_en, desc_ar, extra, published
       FROM nav_items WHERE area = 'header' ORDER BY position, id`
  );
  return rows.map((r) => ({ ...r, extra: json(r.extra, null) }));
}

/** الحقول التي يغيّرها المحرّر في صفّ منيو. extra (نوع القائمة وإعلانها) لا يُغيَّر من هنا. */
const NAV_FIELDS = ['parent_id', 'position', 'label_en', 'label_ar', 'href', 'desc_en', 'desc_ar', 'published'] as const;

/** عملية في المحرّر بلا صلاحيتها: تُلغي الحفظ كله (المعاملة ترجع) برسالة واضحة */
class Denied extends Error {}
const EDITOR_PERMS = ['pages.edit', 'nav.edit', 'design.edit', 'pages.publish', 'pages.create'];

export default async function VisualEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const viewer = await requireAnyPerm(EDITOR_PERMS);
  const { slug } = await params;
  const page = await q1<any>('SELECT id, slug, template, crumb_ar, crumb_en, hero, published FROM pages WHERE slug = ?', [slug]);
  if (!page) notFound();

  const rows = await q<any>(
    'SELECT id, type, anchor, published, content FROM sections WHERE page_id = ? ORDER BY position, id', [page.id]
  );
  const sections: EdSection[] = rows.map((r) => ({
    id: r.id, type: r.type, anchor: r.anchor, published: r.published, content: json(r.content, {}),
  }));
  const version = await versionOf({ q, q1 }, page.id);

  /* -------------------------------------------------------------- الحفظ
     يُستدعى من المحرّر بحالته كلها. يعيد الحالة الجديدة من القاعدة (بمعرّفات
     الأقسام المضافة) أو سببًا واضحًا لعدم الحفظ. */
  async function save(payload: string): Promise<
    { ok: true; sections: EdSection[]; hero: any; nav: NavRow[]; theme: Theme; version: string } | { ok: false; error: string }
  > {
    'use server';
    const u = await requireAnyPerm(EDITOR_PERMS);
    /* كل جزء من الحفظ بصلاحيته: أقسام الصفحة وأعلاها، والمنيو، والألوان والخطوط */
    const need = (perm: string, what: string) => {
      if (!can(u, perm)) throw new Denied(`ليست لديك صلاحية «${PERMISSION_LABEL[perm] ?? perm}» — ${what} لم يُحفظ. ارجع عن هذا التعديل أو اطلب الصلاحية من السوبر أدمن.`);
    };
    const did: string[] = [];
    /* الصفحات الخاصة (الرئيسية والمنتج والكتالوج ونموذج السعر) لها بيانات
       خاصة لا يعرفها هذا المحرّر — يُمنع حفظها من هنا على الخادم، لا في
       الواجهة وحدها. */
    if (!EDITABLE_TEMPLATES.includes(page.template)) {
      return { ok: false, error: 'هذه الصفحة لا تُحفظ من المحرّر المرئي.' };
    }
    let body: any;
    try { body = JSON.parse(payload); } catch { return { ok: false, error: 'صيغة غير صالحة' }; }
    const list: any[] = Array.isArray(body?.sections) ? body.sections : [];
    for (const s of list) {
      if (!Number.isInteger(s?.id) || !SECTION_TYPES[s?.type]) return { ok: false, error: 'قسم غير معروف في الحفظ' };
    }

    const result = await tx(async (db) => {
      const cur = await db.q1<any>('SELECT * FROM pages WHERE id = ? FOR UPDATE', [page.id]);
      if (!cur) return { ok: false as const, error: 'الصفحة لم تعد موجودة' };
      const existing = await db.q<any>('SELECT * FROM sections WHERE page_id = ? FOR UPDATE', [page.id]);

      /* عُدّلت الصفحة من مكان آخر بعد فتح المحرّر؟ الحفظ كان سيمحو ذلك بصمت. */
      if (await versionOf(db, page.id) !== body.version) {
        return { ok: false as const, error: 'conflict' };
      }

      const byId = new Map(existing.map((s) => [s.id, s]));
      const keep = new Set<number>();
      const added: number[] = [];

      /* تغيّر ترتيب الأقسام القائمة؟ تُحفظ أقسام الصفحة كلها في نسخة واحدة
         قبل الكتابة، فيرجع الترتيب من السجل بخطوة. */
      const oldOrder = [...existing].sort((a, b) => a.position - b.position || a.id - b.id).map((s) => s.id);
      const newOrder = list.filter((s) => s.id > 0).map((s) => s.id);
      const oldKept = oldOrder.filter((id) => newOrder.includes(id));
      if (oldKept.join() !== newOrder.join()) {
        need('pages.edit', 'ترتيب الأقسام'); did.push('order');
        await db.q(
          'INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)',
          ['page', page.id, JSON.stringify({ bundle: { sections: existing }, note: 'order' }), u.id]
        );
      }

      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const content = withDesign(cleanLinks(s.content && typeof s.content === 'object' ? s.content : {}));
        const published = s.published ? 1 : 0;
        if (s.id < 0) {
          need('pages.edit', 'القسم الجديد'); did.push('add');
          const res = await db.q('INSERT INTO sections (page_id, type, position, published, content) VALUES (?,?,?,?,?)',
            [page.id, s.type, i, published, J(content)]) as unknown as { insertId: number };
          added.push(res.insertId);
          continue;
        }
        const old = byId.get(s.id);
        if (!old) return { ok: false as const, error: 'قسم لم يعد موجودًا — حدّث المحرّر' };
        keep.add(s.id);
        const changed = !sameContent(content, json(old.content, {})) || old.published !== published || old.type !== s.type;
        if (changed) {
          need('pages.edit', 'تعديل الأقسام'); did.push('sections');
          await snapshot('section', s.id, u.id, db);
          await db.q('UPDATE sections SET content = ?, published = ?, position = ? WHERE id = ?',
            [J(content), published, i, s.id]);
        } else if (old.position !== i) {
          await db.q('UPDATE sections SET position = ? WHERE id = ?', [i, s.id]);
        }
      }

      /* الأقسام المضافة: «لم تكن موجودة» في السجل، فيُتراجع عن إضافتها منه */
      if (added.length) {
        await db.q(
          'INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)',
          ['page', page.id, JSON.stringify({ absent: true, ids: { sections: added } }), u.id]
        );
      }

      /* ما حُذف في المحرّر: نسخته في السجل ثم يُحذف */
      for (const old of existing) {
        if (keep.has(old.id)) continue;
        need('pages.edit', 'حذف القسم'); did.push('delete');
        await snapshot('section', old.id, u.id, db);
        await db.q('DELETE FROM sections WHERE id = ?', [old.id]);
      }

      const hero = withDesign(cleanLinks(body.hero && typeof body.hero === 'object' ? body.hero : {}));
      if (!sameContent(hero, json(cur.hero, {}))) {
        need('pages.edit', 'أعلى الصفحة'); did.push('hero');
        await snapshot('page', page.id, u.id, db);
        await db.q('UPDATE pages SET hero = ? WHERE id = ?', [Object.keys(hero).length ? J(hero) : null, page.id]);
      }

      /* ------------------------------------------------ الهيدر (المنيو العلوي)
         يُقارن بما في القاعدة؛ إن تغيّر شيء تُحفظ الصفوف كلها كما كانت في نسخة
         واحدة — ومعها «لم تكن موجودة» للصفوف الجديدة — فيرجع المنيو بخطوة. */
      if (Array.isArray(body.nav)) {
        const before = await db.q<any>(`SELECT * FROM nav_items WHERE area = 'header' FOR UPDATE`);
        const byNav = new Map(before.map((r) => [r.id, r]));
        const want: any[] = body.nav.filter((r: any) => Number.isInteger(r?.id));
        const clean = (r: any) => ({
          parent_id: Number.isInteger(r.parent_id) ? r.parent_id : null,
          position: Number(r.position) || 0,
          label_en: String(r.label_en ?? '').trim(), label_ar: String(r.label_ar ?? '').trim(),
          href: typeof r.href === 'string' && r.href.trim() ? siteHref(r.href) : null,
          desc_en: typeof r.desc_en === 'string' && r.desc_en.trim() ? r.desc_en.trim() : null,
          desc_ar: typeof r.desc_ar === 'string' && r.desc_ar.trim() ? r.desc_ar.trim() : null,
          published: r.published ? 1 : 0,
        });
        const wantIds = new Set(want.map((r) => r.id));
        /* الطرفان بالتنظيف نفسه: نصّ فارغ في المحرّر وقيمة فارغة في القاعدة سواء */
        const changedRows = want.filter((r) => r.id > 0 && byNav.has(r.id)
          && NAV_FIELDS.some((f) => (clean(r) as any)[f] !== (clean(byNav.get(r.id)) as any)[f]));
        const newRows = want.filter((r) => r.id < 0);
        const gone = before.filter((r) => !wantIds.has(r.id));

        if (changedRows.length || newRows.length || gone.length) {
          need('nav.edit', 'تعديل المنيو'); did.push('nav');
          /* الجديد: الآباء قبل الأبناء، ومعرّفات مؤقتة سالبة تُستبدل بالحقيقية */
          const realId = new Map<number, number>();
          const parentOf = (p: number | null) => (p != null && p < 0 ? realId.get(p) ?? null : p);
          let pending = [...newRows];
          while (pending.length) {
            const ready = pending.filter((r) => !(Number.isInteger(r.parent_id) && r.parent_id < 0 && !realId.has(r.parent_id)));
            if (!ready.length) break;            // أب غير موجود — لا يُضاف ما تحته
            for (const r of ready) {
              const c = clean(r);
              const res = await db.q(
                `INSERT INTO nav_items (area, parent_id, position, label_en, label_ar, href, desc_en, desc_ar, extra, published)
                 VALUES ('header',?,?,?,?,?,?,?,?,?)`,
                [parentOf(c.parent_id), c.position, c.label_en, c.label_ar, c.href, c.desc_en, c.desc_ar,
                 r.extra && typeof r.extra === 'object' ? J(r.extra) : null, c.published]
              ) as unknown as { insertId: number };
              realId.set(r.id, res.insertId);
            }
            pending = pending.filter((r) => !realId.has(r.id));
          }
          for (const r of changedRows) {
            const c = clean(r);
            await db.q(
              `UPDATE nav_items SET ${NAV_FIELDS.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`,
              [...NAV_FIELDS.map((f) => (f === 'parent_id' ? parentOf(c.parent_id) : (c as any)[f])), r.id]
            );
          }
          if (gone.length) {
            await db.q(`DELETE FROM nav_items WHERE id IN (${gone.map(() => '?').join(',')})`, gone.map((r) => r.id));
          }
          const added = [...realId.values()];
          await db.q(
            'INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)',
            ['nav', before.find((r) => r.parent_id == null)?.id ?? 0,
             JSON.stringify(added.length
               ? { absent: true, ids: { nav_items: added }, bundle: { nav_items: before }, note: 'nav' }
               : { bundle: { nav_items: before }, note: 'nav' }), u.id]
          );
        }
      }

      /* ------------------------------------------- ألوان الموقع وخطوطه
         نسخة مما كانت عليه في السجل، ثم تُكتب. لا شيء إن لم تتغيّر. */
      if (body.theme && typeof body.theme === 'object') {
        const before = await readTheme(db);
        const next = cleanTheme(body.theme);
        if (!sameContent(before, next)) {
          need('design.edit', 'تغيير الألوان والخطوط'); did.push('theme');
          await db.q('INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)',
            ['theme', 0, JSON.stringify({ theme: before }), u.id]);
          await db.q(
            `INSERT INTO settings (\`key\`, \`value\`, \`group\`, label_en, label_ar)
             VALUES ('theme', ?, 'design', 'Site colours and fonts', 'ألوان وخطوط الموقع')
             ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`, [J(next)]);
        }
      }

      const fresh = await db.q<any>(
        'SELECT id, type, anchor, published, content FROM sections WHERE page_id = ? ORDER BY position, id', [page.id]
      );
      const after = await db.q1<any>('SELECT hero FROM pages WHERE id = ?', [page.id]);
      return {
        ok: true as const,
        sections: fresh.map((r) => ({ id: r.id, type: r.type, anchor: r.anchor, published: r.published, content: json(r.content, {}) })),
        hero: json(after?.hero, {}),
        nav: await readNav(db),
        theme: await readTheme(db),
        version: await versionOf(db, page.id),
      };
    }).catch((e) => {
      if (e instanceof Denied) return { ok: false as const, error: e.message };
      console.error('[editor] تعذّر الحفظ:', e);
      return { ok: false as const, error: 'تعذّر الحفظ، ولم يتغيّر شيء في الموقع.' };
    });

    if (result.ok) {
      const name = page.crumb_ar || page.crumb_en || slug;
      if (did.some((d) => d !== 'nav' && d !== 'theme')) await audit(u, 'page.save', { entity: 'page', id: slug, summary: `${name} (المحرّر المرئي)` });
      if (did.includes('nav')) await audit(u, 'nav.save', { entity: 'nav', summary: `من المحرّر المرئي في ${name}` });
      if (did.includes('theme')) await audit(u, 'theme.save', { entity: 'theme' });
      refreshSite();
    }
    return result;
  }

  /* ------------------------------------------------- صفحة جديدة من المحرّر
     تُنشأ تحت الصفحة المفتوحة (مسار التنقّل: … / هذه الصفحة / الجديدة)،
     مسوّدةً لا يراها الزائر، وتُفتح في المحرّر مباشرةً. ثلاث بدايات:
       products — كروت منتجات فارغة تُختار من «المنتجات» (مثل «مكانس الطرق»)
       copy     — نسخة من أقسام هذه الصفحة بنصوصها وصورها
       blank    — بلا أقسام */
  async function createPage(input: { ar: string; en: string; start: 'products' | 'copy' | 'blank' }):
    Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
    'use server';
    const u = await requireUser();
    if (!can(u, 'pages.create')) return { ok: false, error: 'ليست لديك صلاحية «إنشاء صفحات جديدة».' };
    const ar = String(input?.ar ?? '').trim();
    const en = String(input?.en ?? '').trim();
    if (!ar && !en) return { ok: false, error: 'اكتب اسم الصفحة' };
    const base = slugify(en || '') || `page-${Date.now().toString(36)}`;
    let newSlug = base;
    for (let i = 2; await q1('SELECT id FROM pages WHERE slug = ?', [newSlug]); i++) newSlug = `${base}-${i}`;

    const src = await q1<any>('SELECT * FROM pages WHERE id = ?', [page.id]);
    const title = { ar: ar || en, en: en || ar };
    const result = await tx(async (db) => {
      const [{ n }] = await db.q<{ n: number }>('SELECT COALESCE(MAX(position), 0) + 1 AS n FROM pages');
      /* الصورة الكبيرة من الصفحة الأم بدايةً — تُغيَّر بالضغط عليها في المحرّر */
      const hero = { img: json<any>(src?.hero, {})?.img ?? null, kicker: title, title };
      const res = await db.q(
        `INSERT INTO pages (slug, template, published, crumb_ar, crumb_en, parent_slug, position, hero, quote_solution)
         VALUES (?, 'sections', 0, ?, ?, ?, ?, ?, ?)`,
        [newSlug, title.ar, title.en, slug, n, J(hero), src?.quote_solution ?? null]
      ) as unknown as { insertId: number };
      const id = res.insertId;
      if (input.start === 'products') {
        /* شكل «مكانس الطرق»: كروت موديلات ثم شريط التواصل */
        await db.q('INSERT INTO sections (page_id, type, position, content) VALUES (?, ?, 0, ?)',
          [id, 'products', J({ ...blankContent('products'), style: 'models' })]);
        await db.q('INSERT INTO sections (page_id, type, position, content) VALUES (?, ?, 1, ?)',
          [id, 'cta', J(blankContent('cta'))]);
      } else if (input.start === 'copy') {
        const secs = await db.q<any>('SELECT type, position, published, content FROM sections WHERE page_id = ? ORDER BY position', [page.id]);
        for (const s of secs) {
          await db.q('INSERT INTO sections (page_id, type, position, published, content) VALUES (?,?,?,?,?)',
            [id, s.type, s.position, s.published, typeof s.content === 'string' ? s.content : J(s.content)]);
        }
      }
      /* «لم تكن موجودة»: تُحذف الصفحة الجديدة من سجل التعديلات بخطوة */
      await db.q('INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)',
        ['page', id, JSON.stringify({ absent: true, ids: { pages: [id] } }), u.id]);
      return { ok: true as const, slug: newSlug };
    }).catch((e) => {
      console.error('[editor] تعذّر إنشاء الصفحة:', e);
      return { ok: false as const, error: 'تعذّر إنشاء الصفحة' };
    });
    if (result.ok) {
      await audit(u, 'page.create', { entity: 'page', id: result.slug, summary: `${title.ar} (من المحرّر المرئي)` });
      refreshSite();
    }
    return result;
  }

  /** نشر الصفحة أو سحبها من النشر، من المحرّر نفسه. */
  async function setPublished(flag: boolean): Promise<{ ok: boolean }> {
    'use server';
    const u = await requireUser();
    if (!can(u, 'pages.publish')) return { ok: false };
    await tx(async (db) => {
      await snapshot('page', page.id, u.id, db);
      await db.q('UPDATE pages SET published = ? WHERE id = ?', [flag ? 1 : 0, page.id]);
    });
    await audit(u, flag ? 'page.publish' : 'page.unpublish', { entity: 'page', id: slug, summary: page.crumb_ar || page.crumb_en || slug });
    refreshSite();
    return { ok: true };
  }

  /* الصفحات التي يفتحها المحرّر، للتنقّل بينها من الشريط العلوي */
  const pages = (await q<any>(
    `SELECT slug, crumb_ar, crumb_en FROM pages
      WHERE template IN (${EDITABLE_TEMPLATES.map(() => '?').join(',')}) AND redirect_to IS NULL
      ORDER BY position, id`, EDITABLE_TEMPLATES
  )).map((p) => ({ slug: p.slug, title: p.crumb_ar || p.crumb_en || p.slug }));

  /* المنتجات: لنافذة اختيار كروت المنتجات، ولوجهات الروابط */
  const products = (await q<any>(
    `SELECT ref, slug, name_ar, name_en, hero_image, category, published FROM products ORDER BY category, position, id`
  )).map((p) => ({
    ref: p.ref, slug: p.slug, name: p.name_ar || p.name_en || p.ref,
    img: p.hero_image, category: p.category, published: p.published,
  }));

  /* الحقول تُرسل كما هي: وصفها بيانات بلا دوال */
  const schema = Object.fromEntries(Object.entries(SECTION_TYPES).map(([k, v]) => [k, v]));

  return (
    <VisualEditor
      slug={slug}
      title={page.crumb_ar || page.crumb_en || slug}
      template={page.template}
      published={Boolean(page.published)}
      hero={json(page.hero, {})}
      sections={sections}
      version={version}
      schema={schema}
      addable={ADDABLE}
      blanks={Object.fromEntries(ADDABLE.map((a) => [a.type, blankContent(a.type)]))}
      save={save}
      pages={pages}
      products={products}
      nav={await readNav({ q })}
      theme={await readTheme({ q1 })}
      createPage={createPage}
      setPublished={setPublished}
    />
  );
}
