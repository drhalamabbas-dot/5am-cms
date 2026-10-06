/* =============================================================================
   البحث داخل محتوى الموقع من لوحة التحكم.

   المشكلة: 23 صفحة و61 قسمًا و20 منتجًا و1798 نصًّا. السؤال اليومي «فين
   الجملة دي؟» لا يُجاب عنه بفتح الصفحات واحدةً واحدة.

   لماذا المطابقة هنا لا في SQL: البحث العربي يحتاج طيًّا — «الصيانه» يجد
   «الصيانة»، و«مولد» يجد «مولّد»، و«اسعار» يجد «أسعار». LIKE في MySQL لا يفعل
   هذا على أعمدة JSON (ترتيبها ثنائي)، ومحاكاته بأنماط بديلة هشّة. والمحتوى
   كله دون ميجابايت، فقراءته وطيّه في الذاكرة أبسط وأصحّ وأسرع من أي فهرس.
   إن كبر الموقع يومًا عشرات الأضعاف، يُستبدل هذا بفهرس FULLTEXT.
============================================================================= */
import { q, json } from './db';

export type Hit = {
  kind: 'page' | 'section' | 'product' | 'nav' | 'text';
  title: string;
  where: string;
  snippet: string;
  href: string;
};

/** يطوي الحروف: التشكيل والتطويل يُحذفان، والهمزات والتاء والياء تُوحَّد. */
export const fold = (s: string) =>
  String(s ?? '').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[⁦-⁩‎‏]/g, '')   // علامات الاتجاه في النص العربي
    .replace(/\s+/g, ' ')
    .trim();

/** كل كلمة في البحث يجب أن توجد — «قطع غيار مولد» تجد ما فيه الثلاث. */
const matches = (text: string, words: string[]) => {
  const f = fold(text);
  return words.every((w) => f.includes(w));
};

/** ما حول أول كلمة مطابقة، كي يرى الباحث سياقها. */
function snippet(text: string, words: string[], span = 70): string {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  const f = fold(flat);
  const i = words.length ? f.indexOf(words[0]) : -1;
  /* الطيّ يحذف حروفًا فيزيح المواضع قليلًا؛ المقتطف تقريبي عمدًا وهامشه يكفي */
  if (i < 0) return flat.slice(0, span * 2);
  const from = Math.max(0, i - span);
  const to = Math.min(flat.length, i + words[0].length + span);
  return (from ? '…' : '') + flat.slice(from, to) + (to < flat.length ? '…' : '');
}

function flatten(v: any, out: string[] = []): string[] {
  if (v == null) return out;
  if (typeof v === 'string') { if (v.trim()) out.push(v); return out; }
  if (Array.isArray(v)) { v.forEach((x) => flatten(x, out)); return out; }
  if (typeof v === 'object') { Object.values(v).forEach((x) => flatten(x, out)); return out; }
  return out;
}

/** أول نص فيه كل الكلمات، أو أول نص فيه أيّها. */
const best = (texts: string[], words: string[]) =>
  texts.find((x) => matches(x, words))
  ?? texts.find((x) => words.some((w) => fold(x).includes(w)))
  ?? texts[0] ?? '';

export async function searchAll(raw: string): Promise<Hit[]> {
  const words = fold(raw).split(' ').filter((w) => w.length >= 2);
  if (!words.length) return [];
  const hits: Hit[] = [];

  const [pages, sections, products, nav, texts] = await Promise.all([
    q<any>('SELECT slug, crumb_ar, crumb_en, title_en, description_en, hero, published FROM pages ORDER BY position'),
    q<any>(`SELECT s.id, s.content, pg.slug, pg.crumb_ar, pg.crumb_en
              FROM sections s JOIN pages pg ON pg.id = s.page_id ORDER BY pg.position, s.position`),
    q<any>(`SELECT slug, name_ar, name_en, type_ar, type_en, description_ar, description_en, data
              FROM products ORDER BY position`),
    q<any>('SELECT area, label_ar, label_en, href FROM nav_items ORDER BY area, position'),
    q<any>('SELECT `key`, en, ar FROM translations'),
  ]);

  for (const p of pages) {
    const all = [p.crumb_ar, p.crumb_en, p.title_en, p.description_en, ...flatten(json(p.hero, {}))]
      .filter(Boolean);
    if (!matches(all.join(' '), words)) continue;
    hits.push({
      kind: 'page',
      title: p.crumb_ar || p.crumb_en || p.slug,
      where: `صفحة${p.published ? '' : ' (مسوّدة)'}`,
      snippet: snippet(best(all, words), words),
      href: `/admin/pages/${p.slug}`,
    });
  }

  for (const s of sections) {
    const c = json<any>(s.content, {});
    const all = flatten(c);
    if (!matches(all.join(' '), words)) continue;
    hits.push({
      kind: 'section',
      title: c?.title?.ar || c?.title?.en || c?.h?.ar || 'قسم',
      where: `في صفحة ${s.crumb_ar || s.crumb_en || s.slug}`,
      snippet: snippet(best(all, words), words),
      href: `/admin/pages/${s.slug}/sections/${s.id}`,
    });
  }

  for (const p of products) {
    const all = [p.name_ar, p.name_en, p.type_ar, p.type_en, p.description_ar, p.description_en,
      ...flatten(json(p.data, {}))].filter(Boolean);
    if (!matches(all.join(' '), words)) continue;
    hits.push({
      kind: 'product',
      title: p.name_ar || p.name_en || p.slug,
      where: 'منتج',
      snippet: snippet(best(all, words), words),
      href: `/admin/products/${p.slug}`,
    });
  }

  for (const n of nav) {
    const all = [n.label_ar, n.label_en, n.href].filter(Boolean);
    if (!matches(all.join(' '), words)) continue;
    hits.push({
      kind: 'nav',
      title: n.label_ar || n.label_en,
      where: n.area === 'footer' ? 'عنصر في الفوتر' : 'عنصر في المنيو',
      snippet: n.href ?? '',
      href: '/admin/nav',
    });
  }

  let nText = 0;
  for (const t of texts) {
    if (nText >= 25) break;     // نصوص الواجهة كثيرة؛ أول خمسة وعشرين تكفي للدلالة
    if (!matches(`${t.en ?? ''} ${t.ar ?? ''}`, words)) continue;
    nText++;
    hits.push({
      kind: 'text',
      title: t.ar || t.en || t.key,
      where: 'نص واجهة',
      snippet: t.en ?? '',
      href: `/admin/translations?q=${encodeURIComponent(raw.trim())}`,
    });
  }

  /* الأقسام أولًا: هي ما يُبحث عنه غالبًا، ونصوص الواجهة آخرًا لكثرتها. */
  const order: Hit['kind'][] = ['section', 'page', 'product', 'nav', 'text'];
  return hits.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}
