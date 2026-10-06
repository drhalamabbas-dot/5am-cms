/* اللغة والترجمة — تتبع سلوك الموقع الحالي حرفيًا.

   الموقع الحالي يختار اللغة من ?lang=ar، ويترجم بطريقتين:
     • مفاتيح منقوطة لنصوص الواجهة:  t('nav.about', 'About')
     • مطابقة الجملة الإنجليزية لبيانات المحتوى: phrase('Spare Parts')
   وما لا ترجمة له يظهر بالإنجليزية كما هو الحال اليوم. */
import { q } from './db';

export type Lang = 'en' | 'ar';
export type Dual = { en?: string | null; ar?: string | null } | string | null | undefined;

export function pickLang(v: string | string[] | undefined): Lang {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export type Dict = { keys: Record<string, string>; phrases: Record<string, string> };

/* الترجمات تُحفظ في الذاكرة — ~1800 صفّ لكل طلب كثير — لكن بعلامة من القاعدة
   نفسها (عدد الصفوف وآخر وقت تعديل) تُقرأ مع كل طلب: تعديل ترجمة يظهر للزائر في
   الطلب التالي مباشرةً، ولو كان على الاستضافة أكثر من نسخة من الخادم. (كانت
   تُحفظ دقيقة كاملة، فقد يرى الزائر النصّ القديم بعد الحفظ.) */
let cache: { stamp: string; dict: Dict } | null = null;

/** يُنسي الترجمات المحفوظة — يُستدعى مع كل حفظ (refreshSite). */
export function forgetDict() { cache = null; }

export async function getDict(): Promise<Dict> {
  const [s] = await q<{ n: number; m: string | null }>('SELECT COUNT(*) AS n, MAX(updated_at) AS m FROM translations');
  const stamp = `${s?.n}|${s?.m}`;
  if (cache && cache.stamp === stamp) return cache.dict;
  const rows = await q<{ key: string; en: string | null; ar: string | null; group: string | null }>(
    'SELECT `key`, en, ar, `group` FROM translations'
  );
  const dict: Dict = { keys: {}, phrases: {} };
  for (const r of rows) {
    if (!r.ar) continue;
    if (r.group === 'phrase') { if (r.en) dict.phrases[r.en] = r.ar; }
    else dict.keys[r.key] = r.ar;
  }
  cache = { stamp, dict };
  return dict;
}

/** أدوات الترجمة الجاهزة للغة صفحة بعينها. */
export function makeT(lang: Lang, dict: Dict) {
  const ar = lang === 'ar';
  return {
    lang,
    ar,
    /** نص واجهة بمفتاح منقوط، مع الإنجليزية كقيمة افتراضية. */
    t: (key: string, en: string) => (ar ? dict.keys[key] ?? en : en),
    /** حقل مخزّن بلغتيه {en, ar}. */
    tx: (v: Dual): string => {
      if (v == null) return '';
      if (typeof v === 'string') return ar ? dict.phrases[v] ?? v : v;
      return (ar ? v.ar || v.en : v.en) ?? '';
    },
    /** نص إنجليزي مفرد يُترجم بمطابقة الجملة. */
    phrase: (en: string | null | undefined) => (!en ? '' : ar ? dict.phrases[en] ?? en : en),
    /** يضيف ?lang=ar إلى الروابط الداخلية كما يفعل الموقع الحالي. */
    href: (h: string) => {
      if (!h || /^(#|mailto:|tel:|https?:|data:)/i.test(h)) return h;
      const [p, hash] = h.split('#');
      const sep = p.includes('?') ? '&' : '?';
      return `${p}${sep}lang=${lang}${hash ? '#' + hash : ''}`;
    },
  };
}

export type T = ReturnType<typeof makeT>;
