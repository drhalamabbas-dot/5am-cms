/* =============================================================================
   فحص جودة تلقائي لكل سؤال وجواب قبل ما يدخل تدريب موديلنا.

   الموديل الصغير يتعلّم كل ما في البيانات — الصح والغلط. فقبل مراجعة الفريق،
   كل جواب يُفحص هنا، والمشاكل تُكتب عليه في «تدريب البوت»:
     • حروف صينية/يابانية (Qwen يخلط أحيانًا)       • لغة الجواب غير لغة السؤال
     • سعر أو مبلغ                                   • وعد غير موثّق (ضمان، تمويل، خصم،
     • رابط لصفحة أو منتج غير موجود                    نسبة توفير، موعد تسليم…)
     • قصير جدًا أو طويل جدًا
   الفحص لا يقبل ولا يرفض وحده: يساعد المراجع يركّز على ما يحتاج نظرًا.
============================================================================= */
import { q } from '../db';
import { langOf } from './text';
import { getDocs } from './kb';

let siteCache: { at: number; text: string } | null = null;
/** كل نصوص الموقع (المنتجات والصفحات والتواصل) بالعربي والإنجليزي، حروف صغيرة */
async function siteText(): Promise<string> {
  if (siteCache && Date.now() - siteCache.at < 5 * 60_000) return siteCache.text;
  const docs = [...(await getDocs('ar')), ...(await getDocs('en'))];
  siteCache = { at: Date.now(), text: docs.map((d) => `${d.title}\n${d.text}`).join('\n').toLowerCase().replace(/\s+/g, ' ') };
  return siteCache.text;
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const PRICE = /(\d[\d,.\s]*\s*(ألف|الف|مليون)?\s*(جنيه|ج\.م|EGP|دولار|USD|يورو|\$|€))|((EGP|USD|\$|€)\s*\d)|الأسعار بتتحدد حسب المواصفات|Prices depend on the specification/i;
/* وعود تجارية لا يقولها البوت إلا لو مكتوبة في الموقع */
const CLAIMS = /(ضمان|بضمان|warrant|guarantee|تمويل|financing|تقسيط|installment|خصم|discount|عرض خاص|special offer|\d+\s*%|٪|سنين خبرة|سنة خبرة|years? of experience|توصيل مجاني|free delivery|شحن مجاني|free shipping|خلال \d+ ?(ساعة|ساعات|يوم|أيام)|within \d+ ?(hours?|days?)|24\s*\/\s*7|طول اليوم|ISO ?\d{3,5})/i;
const LINK = /\]\((\/[^)\s]+)\)|(?<![\w/])(\/(?:[\w-]+\.html|model\.html\?p=[\w-]+)[^\s)]*)/g;

let known: { at: number; pages: Set<string>; products: Set<string> } | null = null;
async function knownLinks() {
  if (known && Date.now() - known.at < 5 * 60_000) return known;
  const pages = new Set((await q<any>('SELECT slug FROM pages WHERE published = 1')).map((r) => r.slug));
  const products = new Set((await q<any>('SELECT slug FROM products WHERE published = 1')).map((r) => r.slug));
  known = { at: Date.now(), pages, products };
  return known;
}

export const ISSUE_AR: Record<string, string> = {
  cjk: 'حروف صينية', lang: 'لغة غير لغة السؤال', price: 'فيه سعر', claim: 'وعد غير موثّق',
  link: 'رابط غير موجود', short: 'قصير جدًا', long: 'طويل جدًا',
};

export async function checkPair(question: string, answer: string, lang: 'ar' | 'en'): Promise<string[]> {
  const out: string[] = [];
  if (CJK.test(answer)) out.push('cjk');
  const al = langOf(answer.replace(LINK, ' ').replace(/\b(kVA|kW|ATS|DSE|ComAp|Perkins|Cummins|Volvo|Elgin|Vactor|Guzzler|Stamford|Leroy-Somer|5A&M)\b/gi, ''));
  if (al && al !== lang) out.push('lang');
  if (PRICE.test(answer)) out.push('price');
  /* الوعد مقبول لو مكتوب في محتوى الموقع نفسه (صفحة التأجير مثلًا تقول 24/7) */
  const site = await siteText();
  const claims = [...answer.matchAll(new RegExp(CLAIMS.source, 'gi'))].map((m) => m[0].toLowerCase().replace(/\s+/g, ' ').trim());
  if (claims.some((c) => !site.includes(c) && !question.toLowerCase().includes(c))) out.push('claim');
  const k = await knownLinks();
  for (const m of answer.matchAll(LINK)) {
    const path = (m[1] ?? m[2] ?? '').split('#')[0];
    const prod = path.match(/model\.html\?p=([\w-]+)/)?.[1];
    const page = path.match(/^\/([\w-]+)\.html/)?.[1];
    if ((prod && !k.products.has(prod)) || (!prod && page && page !== 'model' && !k.pages.has(page))) { out.push('link'); break; }
  }
  if (answer.trim().length < 40) out.push('short');
  if (answer.length > 1400) out.push('long');
  return out;
}

/** يفحص صفًّا ويكتب مشاكله (null = سليم) */
export async function recheck(id: number) {
  const r = (await q<any>('SELECT question, answer, lang FROM chat_cache WHERE id = ?', [id]))[0];
  if (!r) return;
  const issues = await checkPair(r.question, r.answer, r.lang === 'en' ? 'en' : 'ar');
  await q('UPDATE chat_cache SET issues = ? WHERE id = ?', [issues.length ? issues.join(',') : null, id]);
}

export async function recheckAll(): Promise<{ checked: number; flagged: number }> {
  const rows = await q<any>("SELECT id FROM chat_cache WHERE status <> 'rejected'");
  for (const r of rows) await recheck(r.id);
  const [{ n }] = await q<any>("SELECT COUNT(*) n FROM chat_cache WHERE status <> 'rejected' AND issues IS NOT NULL");
  return { checked: rows.length, flagged: Number(n) };
}
