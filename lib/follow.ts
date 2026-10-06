/* =============================================================================
   كروت تتبع القسم الذي تنقل إليه.

   كارت في قسم «كروت» ينقل إلى قسم في صفحة أخرى (fabrication.html#canopies)
   يأخذ — إن طُلب ذلك بـ follow أو followAll — عنوانه وشرحه وصورته من ذلك القسم
   نفسه، أو من أعلى الصفحة إن كان ينقل إلى الصفحة كلها. فتعديل القسم هناك يظهر
   في الكارت هنا بلا تعديل ثانٍ.

   يُحسب عند رسم الصفحة: لا يُكتب في الكارت شيء، فإلغاء الخيار يعيده كما كان.
   ما لا يوجد في القسم المتبوع (قسم بلا صورة مثلًا) يبقى من الكارت نفسه.
============================================================================= */
import { q, json } from './db';

type Any = Record<string, any>;
const on = (v: unknown) => v === true || v === 'on' || v === 1 || v === '1';
const has = (v: any) => v != null && v !== '' && !(typeof v === 'object' && !Array.isArray(v) && !Object.values(v).some((x) => typeof x === 'string' && x.trim()));

/** «ينقل إلى» داخلي: الصفحة والقسم. null للروابط الخارجية. */
function target(href: unknown): { slug: string; anchor: string | null } | null {
  if (typeof href !== 'string' || !href.trim() || /^(https?:|mailto:|tel:|#)/i.test(href.trim())) return null;
  const [path, hash] = href.trim().replace(/^\//, '').split('#');
  const slug = path.split('?')[0].replace(/\.html$/i, '') || 'index';
  return /^[\w-]+$/.test(slug) ? { slug, anchor: hash ? decodeURIComponent(hash) : null } : null;
}

/** أول جملة من الشرح — الكارت ملخّص لا نسخة من القسم، وشرح القسم الكامل كان
 *  يطيل الكارت أضعافًا. حدّ أقصى ~160 حرفًا يُقطع عند كلمة. */
function brief(v: any): any {
  const cut = (s: unknown) => {
    if (typeof s !== 'string') return s;
    const t = s.replace(/\s+/g, ' ').trim();
    const m = t.match(/^.{20,180}?[.!؟?](\s|$)/);
    const first = m ? m[0].trim() : t;
    if (first.length <= 170) return first;
    const w = first.slice(0, 160);
    return w.slice(0, w.lastIndexOf(' ') > 100 ? w.lastIndexOf(' ') : 160).replace(/[،,;:\s]+$/, '') + '…';
  };
  return v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, s]) => [k, cut(s)])) : cut(v);
}

/** ما يُؤخذ من القسم المتبوع: عنوانه وشرحه (أول جملة) وصورته، بأسماء حقولها الشائعة. */
function pick(c: Any): Any {
  const text = [c.text, c.lede, c.note, c.d].find(has);
  return {
    title: [c.title, c.h].find(has),
    text: text ? brief(text) : undefined,
    img: [c.img, c.image, Array.isArray(c.imgs) ? c.imgs[0] : null, Array.isArray(c.images) ? c.images[0] : null].find(has),
  };
}

/**
 * يملأ الكروت المتبوعة في أقسام الصفحة. الصفحات المنشورة وحدها تُتبع للزائر،
 * والمسوّدات أيضًا لصاحب الموقع (كما تُعرض له).
 */
export async function followCards<S extends { type: string; content: Any }>(sections: S[], draft = false): Promise<S[]> {
  const wanted = new Set<string>();
  for (const s of sections) {
    if (s.type !== 'cards' || !Array.isArray(s.content?.cards)) continue;
    for (const c of s.content.cards) {
      const t = (on(s.content.followAll) || on(c?.follow)) ? target(c?.href) : null;
      if (t) wanted.add(t.slug);
    }
  }
  if (!wanted.size) return sections;

  const slugs = [...wanted];
  const pages = await q<any>(
    `SELECT id, slug, hero FROM pages WHERE slug IN (${slugs.map(() => '?').join(',')})
       ${draft ? '' : 'AND published = 1'} AND redirect_to IS NULL`, slugs
  );
  if (!pages.length) return sections;
  const secs = await q<any>(
    `SELECT page_id, anchor, position, content FROM sections
      WHERE page_id IN (${pages.map(() => '?').join(',')}) ${draft ? '' : 'AND published = 1'}
      ORDER BY position, id`, pages.map((p) => p.id)
  );
  const bySlug = new Map(pages.map((p) => [p.slug, {
    hero: json<Any>(p.hero, {}),
    sections: secs.filter((s) => s.page_id === p.id).map((s, i) => ({
      /* بلا مرساة محفوظة يأخذ القسم section-رقمه، كما في رسم الصفحة */
      anchor: s.anchor || `section-${i + 1}`, content: json<Any>(s.content, {}),
    })),
  }]));

  return sections.map((s) => {
    if (s.type !== 'cards' || !Array.isArray(s.content?.cards)) return s;
    let changed = false;
    const cards = s.content.cards.map((c: Any) => {
      if (!(on(s.content.followAll) || on(c?.follow))) return c;
      const t = target(c?.href);
      const pg = t ? bySlug.get(t.slug) : null;
      if (!t || !pg) return c;
      const from = t.anchor ? pg.sections.find((x) => x.anchor === t.anchor)?.content : pg.hero;
      if (!from) return c;
      const got = pick(t.anchor ? from : { title: from.title, text: from.lede, img: from.img });
      changed = true;
      return { ...c, ...(got.title ? { title: got.title } : {}), ...(got.text ? { text: got.text } : {}), ...(got.img ? { img: got.img } : {}) };
    });
    return changed ? { ...s, content: { ...s.content, cards } } : s;
  });
}
