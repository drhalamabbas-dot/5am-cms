/* =============================================================================
   مكان الملفات المرفوعة على القرص.

   لماذا ليست في public: Next في وضع الإنتاج يقرأ قائمة ملفات public مرة واحدة
   عند التشغيل، فالملف المرفوع بعدها لا يُعرض حتى يُعاد تشغيل الخادم (اختُبر
   على نسخة إنتاج). ومجلد public جزء من الإصدار، فإعادة النشر قد تمحوه.

   لذلك تُحفظ في مجلد دائم خارج الكود، ويعرضها المسار app/media. والمسار
   المحفوظ في القاعدة «media/img/…»، فيُقرأ من أي صفحة كما تُقرأ «assets/…».

   هذا الملف بلا قاعدة بيانات عمدًا: يستعمله عارض الصور ومسار العرض أيضًا.
============================================================================= */
import fs from 'node:fs';
import path from 'node:path';

/** بادئة كل ملف مرفوع في القاعدة وفي العنوان. */
export const MEDIA_PREFIX = 'media/';

/**
 * مجلد الرفع. في الإنتاج يجب أن يُضبط UPLOAD_DIR صراحةً على مجلد دائم خارج
 * مجلد الإصدار؛ بدونه يُرفض الرفع بدل أن تُكتب ملفات ستضيع عند أول نشر.
 */
export function uploadRoot(): string | null {
  const env = process.env.UPLOAD_DIR?.trim();
  if (env) return path.resolve(env);
  if (process.env.NODE_ENV === 'production') return null;
  return path.join(process.cwd(), 'storage', 'uploads');
}

/**
 * المسار الحقيقي بعد حلّ الروابط الرمزية: مجلد يبدو خارج الموقع قد يشير إلى
 * داخله. وإن لم يوجد المجلد بعد، يُحلّ أقرب أب موجود له.
 */
function realPath(p: string): string {
  let cur = path.resolve(p);
  const rest: string[] = [];
  for (;;) {
    try { return path.join(fs.realpathSync(cur), ...rest); }
    catch {
      const up = path.dirname(cur);
      if (up === cur) return path.resolve(p);
      rest.unshift(path.basename(cur));
      cur = up;
    }
  }
}

/**
 * هل المجلد هو مجلد التطبيق أو داخله؟ مكان كهذا يُمحى مع إعادة النشر.
 * path.relative على ويندوز لا يفرّق بين الحروف الكبيرة والصغيرة، كما القرص.
 */
export function insideApp(dir: string): boolean {
  const rel = path.relative(realPath(process.cwd()), realPath(dir));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * المسار على القرص لملف مرفوع، أو null إن خرج عن مجلد الرفع.
 * يقبل «media/img/x.jpg» أو «img/x.jpg».
 */
export function uploadFile(rel: string): string | null {
  const root = uploadRoot();
  if (!root) return null;
  const inner = rel.replace(/^\/?media\//, '');
  if (!inner || inner.includes('\0')) return null;
  const full = path.resolve(root, inner);
  return full.startsWith(root + path.sep) ? full : null;
}

/** على القرص: ملف الموقع الأصلي في public، أو الملف المرفوع. */
function diskPath(src: string): string | null {
  const clean = src.replace(/[?#].*$/, '').replace(/^\.?\//, '');
  if (/^(https?:|data:)/i.test(clean)) return null;
  if (clean.startsWith(MEDIA_PREFIX)) return uploadFile(clean);
  const pub = path.join(process.cwd(), 'public');
  const full = path.resolve(pub, clean);
  return full.startsWith(pub + path.sep) ? full : null;
}

/* تُحفظ الإجابة كي لا يُسأل القرص عن الصورة نفسها مع كل زائر.

   وتَبلى بعد دقيقة: «لا نسخة لها» كان يُحفظ إلى الأبد، فمن يرفع قَصّة هاتف
   أو نسخة webp من اللوحة يظلّ الموقع يعرض الصورة القديمة حتى يُعاد تشغيل
   الخادم — ولا أحد يربط بين الأمرين. والدقيقة تكفي لتوفير الأسئلة على
   زائرٍ يتصفّح، وتقصر عن أن يُلاحَظ انتظارها. */
const TTL = 60_000;
type Cached<T> = { at: number; val: T };

function cached<T>(store: Map<string, Cached<T>>, key: string, make: () => T): T {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.val;
  const val = make();
  if (store.size > 5000) store.clear();
  store.set(key, { at: Date.now(), val });
  return val;
}

const webpKnown = new Map<string, Cached<boolean>>();

/** هل لهذه الصورة نسخة webp بجانبها؟ */
export function hasWebp(src: string): boolean {
  return cached(webpKnown, src, () => {
    const file = diskPath(src);
    return !!file && fs.existsSync(file.replace(/\.jpe?g$/i, '.webp'));
  });
}

/* ------------------------------------------------- نسخة الهاتف من الصورة
   صور الهيرو مصوَّرة عريضةً (1920×1080): يملؤها الشاشة الواسعة، وعلى الهاتف
   إمّا تُقَصّ أطرافها فيضيع نصف المشهد، أو تُصغَّر فيبقى فوقها وتحتها فراغ.

   فتُجهَّز لكلٍّ قَصّةٌ طولية (768×1376) باسم الصورة نفسه + «-mobile.jpg»،
   كما تُجهَّز نسخة webp بجانب الـjpg. ووجودها اختياري: ما لا نسخة له يظهر
   كما كان على كل المقاسات. */
const mobileKnown = new Map<string, Cached<string | null>>();

/** مسار نسخة الهاتف إن وُجدت بجانب الصورة، وإلا null. */
export function mobileOf(src: string): string | null {
  if (!src) return null;
  return cached(mobileKnown, src, () => {
    const clean = src.replace(/[?#].*$/, '');
    /* الصورة التي هي نفسها نسخة هاتف لا نسخة لها */
    const url = /-mobile\.(jpe?g|webp|png)$/i.test(clean)
      ? null
      : clean.replace(/\.(webp|jpe?g|png)$/i, '-mobile.jpg');
    const file = url ? diskPath(url) : null;
    return file && fs.existsSync(file) ? url : null;
  });
}
