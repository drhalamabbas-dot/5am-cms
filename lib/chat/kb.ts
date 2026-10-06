/* =============================================================================
   معرفة البوت: محتوى الموقع نفسه — المنتجات المنشورة، والصفحات المنشورة
   بأقسامها، وبيانات التواصل. البوت لا يجيب إلا منها (lib/chat/bot.ts)، فما
   يُعدَّل في اللوحة يعرفه البوت خلال دقائق بلا تدريب.

   البحث بالكلمات المطبّعة (lib/chat/text.ts) مع مطابقة بداية الكلمة، ويُحفظ
   الفهرس في الذاكرة 5 دقائق.
============================================================================= */
import { q, json } from '../db';
import { getProducts, getCompany } from '../content';
import { tokens } from './text';

export type Doc = { url: string; title: string; text: string; kind: 'product' | 'page' | 'contact'; words: string[] };

let built: { at: number; docs: Doc[] } | null = null;

/** كل النصوص داخل كائن الأقسام بلغة واحدة (نصوص {en, ar} أو نصوص عادية) */
function strings(v: any, lang: 'ar' | 'en', out: string[] = []): string[] {
  if (v == null) return out;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s && !/^(https?:|\/|media\/|assets\/|#)/.test(s) && !/\.(jpe?g|png|webp|mp4|pdf)$/i.test(s) && s.length > 2) out.push(s);
    return out;
  }
  if (Array.isArray(v)) { for (const x of v) strings(x, lang, out); return out; }
  if (typeof v === 'object') {
    if ('en' in v || 'ar' in v) { strings(v[lang] || v.en || v.ar, lang, out); return out; }
    for (const [k, x] of Object.entries(v)) if (!/^(design|img|imgs|href|icon|style|anchor|follow|tone|video|yt)$/.test(k)) strings(x, lang, out);
  }
  return out;
}

export async function getDocs(lang: 'ar' | 'en'): Promise<Doc[]> {
  if (built && Date.now() - built.at < 5 * 60_000) return built.docs.filter((d) => d.url.endsWith(`lang=${lang}`) || d.kind === 'contact');
  const docs: Doc[] = [];
  const [products, company, pages, sections] = await Promise.all([
    getProducts(),
    getCompany(),
    q<any>(`SELECT id, slug, crumb_ar, crumb_en, title_ar, title_en, description_ar, description_en, hero FROM pages
             WHERE published = 1 AND redirect_to IS NULL AND template NOT IN ('product') ORDER BY position`),
    q<any>(`SELECT s.page_id, s.content FROM sections s JOIN pages p ON p.id = s.page_id
             WHERE s.published = 1 AND p.published = 1 ORDER BY s.page_id, s.position`),
  ]);
  for (const L of ['ar', 'en'] as const) {
    for (const p of products) {
      if (p.store_hidden && p.category === 'parts') continue;
      const name = (L === 'ar' ? p.name_ar || p.name_en : p.name_en || p.name_ar) ?? p.ref;
      const specs = (p.data?.specifications ?? []).slice(0, 12).map((s: any) => `${s.k}: ${s.v}`).join('؛ ');
      const text = [
        `${name}${p.brand_name ? ` — ${p.brand_name}` : ''}${p.sku ? ` (P/N ${p.sku})` : ''}`,
        L === 'ar' ? p.type_ar || p.type_en : p.type_en, L === 'ar' ? p.description_ar || p.description_en : p.description_en,
        specs, (p.data?.features ?? []).slice(0, 6).join('؛ '),
      ].filter(Boolean).join('\n');
      docs.push({ kind: 'product', url: `/model.html?p=${encodeURIComponent(p.slug)}&lang=${L}`, title: name, text,
        words: tokens(`${p.name_en} ${p.name_ar ?? ''} ${p.brand_name ?? ''} ${p.sku ?? ''} ${p.subcategory ?? ''} ${p.category ?? ''} ${text}`) });
    }
    for (const pg of pages) {
      const title = (L === 'ar' ? pg.crumb_ar || pg.crumb_en : pg.crumb_en || pg.crumb_ar) ?? pg.slug;
      const body = [
        L === 'ar' ? pg.description_ar || pg.description_en : pg.description_en,
        ...strings(json(pg.hero, {}), L),
        ...sections.filter((s) => s.page_id === pg.id).flatMap((s) => strings(json(s.content, {}), L)),
      ].filter(Boolean);
      const text = [...new Set(body)].join('\n').slice(0, 4000);
      docs.push({ kind: 'page', url: `/${pg.slug === 'index' ? '' : `${pg.slug}.html`}?lang=${L}`, title, text,
        words: tokens(`${pg.slug} ${pg.crumb_en ?? ''} ${pg.crumb_ar ?? ''} ${pg.title_en ?? ''} ${text}`) });
    }
  }
  const c: any = company;
  docs.push({
    kind: 'contact', url: '/contact.html', title: 'تواصل / Contact',
    text: [c.legalName, `Phone/الهاتف: ${c.phone ?? ''}`, `Email/البريد: ${c.email ?? ''}`, `Address/العنوان: ${c.address ?? ''}`,
      c.hq?.ar && `المقر: ${c.hq.ar}`, c.hq?.en && `HQ: ${c.hq.en}`, c.serviceCenter?.ar && `مركز الخدمة: ${c.serviceCenter.ar}`,
      c.serviceCenter?.en && `Service center: ${c.serviceCenter.en}`].filter(Boolean).join('\n'),
    words: tokens('تواصل اتصال تليفون هاتف رقم موبايل بريد ايميل عنوان مكان فين مقر فرع مواعيد contact phone call email address location where office hours whatsapp واتساب'),
  });
  built = { at: Date.now(), docs };
  return docs.filter((d) => d.url.endsWith(`lang=${lang}`) || d.kind === 'contact');
}

/** أقرب المستندات للسؤال: كلمة كاملة = 3، بداية كلمة = 1، والعنوان يضاعف */
export async function search(question: string, lang: 'ar' | 'en', limit = 5): Promise<Doc[]> {
  const qw = [...new Set(tokens(question))];
  if (!qw.length) return [];
  const scored = (await getDocs(lang)).map((d) => {
    const set = new Set(d.words);
    const titleWords = new Set(tokens(d.title));
    let s = 0;
    for (const w of qw) {
      if (set.has(w)) s += titleWords.has(w) ? 6 : 3;
      else if (w.length >= 3 && d.words.some((x) => x.startsWith(w) || (x.length >= 4 && w.startsWith(x)))) s += 1;
    }
    return { d, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.d);
}

export const forgetDocs = () => { built = null; };
