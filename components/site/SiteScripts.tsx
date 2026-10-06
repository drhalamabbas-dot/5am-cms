/* ملفات الجافاسكريبت التي تعطي الصفحة حركتها، وما تحتاجه من بيانات.

   motion.js منقول من الموقع القديم بلا تعديل: يظهر السكاشن عند التمرير، ويجعل
   الهيدر شفافًا فوق الهيرو، وينقل بين الصفحات بتلاشٍ.

   app.js هو نصف site.js و ux.js و home.js و model.js الذي يخصّ التفاعل. ولا
   بيانات فيه: نصوصه ونتائج بحثه تأتيه من هنا، مستخرجة من قاعدة البيانات، كي
   تُحرَّر من الداش بورد لا من ملف جافاسكريبت. */
import Script from 'next/script';
import { ASSET_V } from '@/lib/version';
import { ico } from '@/lib/icons';
import type { T } from '@/lib/i18n';

export type SearchRecord = { name: string; href: string; type: string; terms: string };

export function SiteScripts({
  t, page, quoteHref, phoneIntl, search = [], edit = false,
}: {
  t: T; page: string; quoteHref: string; phoneIntl?: string | null;
  search?: SearchRecord[]; edit?: boolean;
}) {
  const A = (en: string, ar: string) => (t.ar ? ar : en);
  const data = {
    lang: t.lang,
    page,
    quoteHref,
    phoneIntl: phoneIntl ?? null,
    search,
    /* الأيقونات التي يحقنها السكربت في عناصر يبنيها بنفسه */
    ico: { arrow: ico.arrow, phone: ico.phone, doc: ico.doc },
    ui: {
      openMenu: t.t('a11y.openMenu', 'Open menu'),
      closeMenu: A('Close menu', 'إغلاق القائمة'),
      scrollList: t.t('a11y.scrollList', 'Scrollable list — use the arrow keys'),
      prev: t.t('a11y.prev', 'Previous'),
      next: t.t('a11y.next', 'Next'),
      close: t.t('a11y.close', 'Close'),
      search: A('Search', 'البحث'),
      searchTitle: A('Find a product or service', 'ابحث عن منتج أو خدمة'),
      searchClose: A('Close search', 'إغلاق البحث'),
      searchPlaceholder: A('Try generator, rental, filters…', 'جرّب: مولد، إيجار، فلاتر…'),
      quickAccess: A('Quick access', 'وصول سريع'),
      results: A('{n} results', '{n} نتيجة'),
      firstThirty: A(' · showing the first 30', ' · أول 30 نتيجة'),
      noMatches: A('No matches. Try a brand or a shorter phrase.', 'لا توجد نتائج. جرّب اسم الماركة أو كلمة أبسط.'),
      askTeam: A('Ask our team to help you choose', 'اطلب مساعدة فريقنا في الاختيار'),
      callUs: A('Call us', 'اتصل بنا'),
      requestQuote: t.t('cta.requestQuote', 'Request a quote'),
      quickContact: A('Quick contact', 'التواصل السريع'),
      backToTop: A('Back to top', 'العودة إلى أعلى الصفحة'),
      closePhoto: A('Close photo', 'إغلاق الصورة'),
      productPhoto: A('Product photo', 'صورة المنتج'),
      playVideo: t.t('pdp.playVideo', 'Play video'),
      pauseVideo: t.t('pdp.pauseVideo', 'Pause video'),
    },
  };
  return (
    <>
      <script id="ux-data" type="application/json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
      {/* أنماط أزرار التحرير — تُحمَّل مع صاحب الموقع فقط، لا مع الزائر */}
      {edit ? <link rel="stylesheet" href={`/assets/css/edit.css?v=${ASSET_V}`} precedence="site-edit" /> : null}
      <Script src={`/assets/js/app.js?v=${ASSET_V}`} strategy="afterInteractive" />
      <Script src={`/assets/js/motion.js?v=${ASSET_V}`} strategy="afterInteractive" />
    </>
  );
}
