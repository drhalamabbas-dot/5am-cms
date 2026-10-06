/* =============================================================================
   معاينة المحرّر المرئي قبل الحفظ.

   ما يكتبه صاحب الموقع في المحرّر يُعرض في الصفحة الحقيقية قبل أن يُحفظ،
   فيُخزَّن هنا مؤقتًا — في ذاكرة الخادم لا في القاعدة: الزائر لا يمرّ به، ولا
   شيء منه يبقى إن أُغلق المحرّر بلا حفظ.

   لماذا الذاكرة: الاستضافة عملية Node واحدة، والمعاينة تُكتب مع كل توقّف عن
   الكتابة. إن صار الخادم أكثر من عملية يومًا، تُنقل إلى جدول مسوّدات.

   الحدود: كل معاينة مربوطة بمستخدم وصفحة، بمفتاح عشوائي، وتنتهي بعد ساعة
   بلا استعمال. وحجمها وعددها محدودان كي لا تُملأ الذاكرة.
============================================================================= */
import crypto from 'node:crypto';

export type PreviewSection = {
  id: number;            // سالب = قسم جديد لم يُحفظ بعد
  type: string;
  published: number;
  anchor: string | null;
  content: any;
};
/** nav: صفوف المنيو العلوي كما في المحرّر — الهيدر مشترك، فيُعاين معه أيضًا. */
export type PreviewData = {
  hero: any; sections: PreviewSection[]; nav?: import('./nav').NavRow[];
  /** ألوان الموقع وخطوطه كما في المحرّر (lib/design.ts) */
  theme?: import('./design').Theme;
};

/* rev: رقم الحالة عند المحرّر. طلبان متتاليان قد يصلان بعكس ترتيبهما، فلا
   يُكتب فوق حالة أحدث بأقدم منها. */
type Entry = { userId: number; slug: string; data: PreviewData; seen: number; rev: number };

const TTL = 60 * 60 * 1000;
const MAX_ENTRIES = 50;
export const MAX_BYTES = 1024 * 1024;

declare global {
  // eslint-disable-next-line no-var
  var __fiveamPreview: Map<string, Entry> | undefined;
}
const store: Map<string, Entry> = (globalThis.__fiveamPreview ??= new Map());

function sweep() {
  const now = Date.now();
  for (const [k, e] of store) if (now - e.seen > TTL) store.delete(k);
  /* فوق الحد: الأقدم استعمالًا يخرج أولًا */
  while (store.size > MAX_ENTRIES) {
    const oldest = [...store.entries()].sort((a, b) => a[1].seen - b[1].seen)[0];
    store.delete(oldest[0]);
  }
}

/** يحفظ المعاينة ويعيد مفتاحها. المفتاح القديم يُعاد استعماله إن كان لنفس المستخدم والصفحة. */
export function putPreview(userId: number, slug: string, data: PreviewData, token?: string, rev = 0): string {
  sweep();
  const old = token ? store.get(token) : undefined;
  if (old && old.userId === userId && old.slug === slug) {
    if (rev >= old.rev) store.set(token!, { userId, slug, data, seen: Date.now(), rev });
    else old.seen = Date.now();          // وصل متأخرًا: الأحدث يبقى
    return token!;
  }
  const key = crypto.randomBytes(16).toString('hex');
  store.set(key, { userId, slug, data, seen: Date.now(), rev });
  return key;
}

/** المعاينة لصاحبها فقط، وللصفحة التي أُنشئت لها فقط. */
export function getPreview(token: string, userId: number, slug: string): PreviewData | null {
  const e = store.get(token);
  if (!e || e.userId !== userId || e.slug !== slug) return null;
  if (Date.now() - e.seen > TTL) { store.delete(token); return null; }
  e.seen = Date.now();
  return e.data;
}

export function dropPreview(token: string, userId: number) {
  const e = store.get(token);
  if (e && e.userId === userId) store.delete(token);
}
