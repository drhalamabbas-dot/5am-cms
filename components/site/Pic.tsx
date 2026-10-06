/* نسخة مطابقة لدالة pic في assets/js/site.js:
   صورة jpg تُلَفّ في <picture> مع بديل webp، وغيرها يبقى <img> مجرّدًا.

   الفرق عن القديم: البديل يُذكر فقط إن كان موجودًا فعلًا. المتصفح الذي يدعم
   webp يختار <source> ولا يعود إلى <img> إن لم يجده، فتظهر الصورة مكسورة.
   وبعض صور الموقع (الشعارات وأغلفة الفيديو) لا بديل لها. */
import { ASSET_V } from '@/lib/version';
import { hasWebp } from '@/lib/uploads';

/* المسارات محفوظة نسبية («assets/img/…») كما في الموقع القديم. تُجعل مطلقة
   هنا كي تصحّ من أي عنوان، وتُوسم بنسخة كي يحصل الزائر على آخر صورة بعد النشر. */
const abs = (u: string) => (/^(https?:|data:|\/)/i.test(u) ? u : '/' + u.replace(/^\.?\//, ''));
const ver = (u: string) => {
  const a = abs(u);
  return ASSET_V && !/[?#]/.test(a) ? `${a}?v=${ASSET_V}` : a;
};

export function Pic({
  src, alt = '', priority = false, className,
}: { src?: string | null; alt?: string; priority?: boolean; className?: string }) {
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
  if (!/\.jpe?g$/i.test(src) || !hasWebp(src)) return img;
  return (
    <picture>
      <source srcSet={ver(src.replace(/\.jpe?g$/i, '.webp'))} type="image/webp" />
      {img}
    </picture>
  );
}

/** أيقونة SVG جاهزة من مجموعة الموقع. */
export function Ico({ svg, className }: { svg: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
