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

/* الإجابة لا تتغيّر: ملفات public ثابتة في الإصدار، وأسماء المرفوعات لا تُعاد
   أبدًا. فتُحفظ كي لا يُسأل القرص عن الصورة نفسها مع كل زائر. */
const webpKnown = new Map<string, boolean>();

/** هل لهذه الصورة نسخة webp بجانبها؟ */
export function hasWebp(src: string): boolean {
  const hit = webpKnown.get(src);
  if (hit !== undefined) return hit;
  const file = diskPath(src);
  const yes = !!file && fs.existsSync(file.replace(/\.jpe?g$/i, '.webp'));
  if (webpKnown.size > 5000) webpKnown.clear();
  webpKnown.set(src, yes);
  return yes;
}
