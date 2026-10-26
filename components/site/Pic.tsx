/* نسخة مطابقة لدالة pic في assets/js/site.js:
   صورة jpg تُلَفّ في <picture> مع بديل webp، وغيرها يبقى <img> مجرّدًا.

   الفرق عن القديم: البديل يُذكر فقط إن كان موجودًا فعلًا. المتصفح الذي يدعم
   webp يختار <source> ولا يعود إلى <img> إن لم يجده، فتظهر الصورة مكسورة.
   وبعض صور الموقع (الشعارات وأغلفة الفيديو) لا بديل لها. */
import { ASSET_V } from '@/lib/version';
import { hasWebp, mobileOf } from '@/lib/uploads';

/** العرض الذي تُستبدل عنده الصورة بقَصّتها الطولية — يطابق نقطة الهاتف في CSS */
export const MOBILE_AT = 768;

/* المسارات محفوظة نسبية («assets/img/…») كما في الموقع القديم. تُجعل مطلقة
   هنا كي تصحّ من أي عنوان، وتُوسم بنسخة كي يحصل الزائر على آخر صورة بعد النشر. */
const abs = (u: string) => (/^(https?:|data:|\/)/i.test(u) ? u : '/' + u.replace(/^\.?\//, ''));
const ver = (u: string) => {
  const a = abs(u);
  return ASSET_V && !/[?#]/.test(a) ? `${a}?v=${ASSET_V}` : a;
};

export function Pic({
  src, alt = '', priority = false, className, mobile, autoMobile = false,
}: {
  src?: string | null; alt?: string; priority?: boolean; className?: string;
  /** قَصّة الهاتف: تُكتب من اللوحة */
  mobile?: string | null;
  /**
   * ابحث عن «‎-mobile.jpg» بجانب الصورة إن لم تُكتب قَصّة.
   *
   * لا يُطلب إلا حيث يملأ الصورةَ صندوقٌ طوليّ على الهاتف — أعلى الصفحة.
   * وكان البحث يجري لكل صورة، فالصورة الواحدة تظهر في أعلى الصفحة وفي
   * بطاقةٍ عريضة، فتأخذ البطاقةُ القَصّةَ الطولية فتصير شريطًا ضيّقًا
   * بين فراغين. والقَصّة وصفٌ لموضعٍ لا للصورة، فمن يعرف موضعه يطلبها.
   */
  autoMobile?: boolean;
}) {
  if (!src) return null;
  const img = (
    <img
      src={ver(src)}
      alt={alt}
      className={className}
      {...(priority
        ? { fetchPriority: 'high' as const, decoding: 'async' as const }
        : { loading: 'lazy' as const, decoding: 'async' as const })}
    />
  );
  const phone = mobile?.trim() || (autoMobile ? mobileOf(src) : null);
  const webp = /\.jpe?g$/i.test(src) && hasWebp(src) ? src.replace(/\.jpe?g$/i, '.webp') : null;
  if (!phone && !webp) return img;
  return (
    <picture>
      {/* ترتيب المصادر يحكم: المتصفح يأخذ أول ما يطابق، فقَصّة الهاتف أولًا */}
      {phone ? <source media={`(max-width:${MOBILE_AT}px)`} srcSet={ver(phone)} /> : null}
      {webp ? <source srcSet={ver(webp)} type="image/webp" /> : null}
      {img}
    </picture>
  );
}

/** أيقونة SVG جاهزة من مجموعة الموقع. */
export function Ico({ svg, className }: { svg: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
