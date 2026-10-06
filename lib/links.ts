/* الروابط الداخلية تُحفظ قصيرة: about.html أو model.html?p=… — لا كما تُنسخ
   من شريط المتصفح.

   رابط منسوخ من المتصفح يحمل عنوان الجهاز (http://localhost:3000/…) فينكسر
   على الاستضافة، ويحمل لغة الصفحة (lang=ar) فتفتح النسخة الإنجليزية الصفحة
   العربية — والموقع يضيف اللغة بنفسه لكل رابط داخلي (t.href). */

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(?=\/|$)/i;

/** رابط واحد بصيغته المحفوظة. ما ليس رابطًا داخليًا يبقى كما هو. */
export function siteHref(v: string, ownOrigin?: string | null): string {
  let h = String(v ?? '').trim();
  if (!h) return h;
  if (LOCAL.test(h)) h = h.replace(LOCAL, '');
  else if (ownOrigin && h.toLowerCase().startsWith(ownOrigin.toLowerCase())) h = h.slice(ownOrigin.length);
  else if (/^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith('//') || h.startsWith('#')) return h;
  h = h.replace(/^\/+/, '');
  const [pathQ, hash] = h.split('#');
  const [path, query] = pathQ.split('?');
  const params = new URLSearchParams(query ?? '');
  params.delete('lang');
  const qs = params.toString();
  return `${path || 'index.html'}${qs ? `?${qs}` : ''}${hash ? `#${hash}` : ''}`;
}

/** كل حقل اسمه href في محتوى قسم (مهما كان عمقه) بصيغته المحفوظة. */
export function cleanLinks<T>(v: T, ownOrigin?: string | null): T {
  if (Array.isArray(v)) return v.map((x) => cleanLinks(x, ownOrigin)) as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      out[k] = k === 'href' && typeof x === 'string' ? siteHref(x, ownOrigin) : cleanLinks(x, ownOrigin);
    }
    return out as T;
  }
  return v;
}

/** هل يبدو الرابط صالحًا؟ للتنبيه في نافذة الرابط قبل الحفظ، لا للمنع. */
export function looksLikeLink(h: string): boolean {
  const v = h.trim();
  if (!v) return true;
  return /^(https?:\/\/[^\s]+\.[^\s]+|mailto:\S+@\S+|tel:[+\d][\d\s-]*|#[\w-]*)$/i.test(v)
    || /^[\w./-]+\.(html|pdf|jpe?g|png|webp)(\?[^\s#]*)?(#[\w-]*)?$/i.test(siteHref(v));
}
