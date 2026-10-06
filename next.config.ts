import type { NextConfig } from 'next';

/* ترويسات أمان على كل صفحة.

   لا سياسة محتوى (CSP) هنا: صفحات الموقع تحمل أنماطًا داخل السمات وسكربتات
   من نطاقات خارجية (خطوط Google، تضمين يوتيوب)، وسياسة ضيّقة تكسرها. المذكور
   أدناه يمنع أكثر ما يُستغَلّ بلا أثر على الشكل.  */
const securityHeaders = [
  /* لا يُخمَّن نوع الملف من محتواه: صورة مرفوعة لا تُنفَّذ كسكربت */
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  /* لا يُوضع الموقع داخل إطار في موقع آخر — يمنع خداع النقر */
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  /* لا يُسرَّب العنوان الكامل إلى المواقع الخارجية */
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  /* لا حاجة لهذه الأجهزة في موقع تعريفي */
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
];

const nextConfig: NextConfig = {
  /* خادم واحد خلف وسيط الاستضافة */
  poweredByHeader: false,
  compress: true,

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        /* لوحة التحكم لا تُفهرس ولا تُخزَّن */
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
      {
        /* الحضور والانصراف وحدها تحتاج الكاميرا والموقع (بعد السابقة فتحلّ محلّها
           هنا فقط)؛ وباقي الموقع واللوحة يبقيان بلا كاميرا ولا موقع */
        source: '/admin/attendance/:path*',
        headers: [{ key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self), interest-cohort=()' }],
      },
      {
        /* نموذج الوجه (7 ميجا) لا يتغيّر: يُحمَّل مرة ويبقى في المتصفح شهرًا،
           فلا يُعاد مع كل حضور وانصراف */
        source: '/models/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }],
      },
      {
        /* الصور والملفات ثابتة ومُوسَمة بنسخة، فتُخزَّن طويلًا. أثناء التطوير
           تُراجَع مع كل تحميل: رقم النسخة يُحسب مرة عند تشغيل الخادم، فتعديل CSS
           بعده كان يبقى خلف نسخة قديمة مخزّنة «لعام» في المتصفح. */
        source: '/assets/:path*',
        headers: [{
          key: 'Cache-Control',
          value: process.env.NODE_ENV === 'production' ? 'public, max-age=31536000, immutable' : 'no-cache',
        }],
      },
    ];
  },
};

export default nextConfig;
