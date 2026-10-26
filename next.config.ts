import type { NextConfig } from 'next';

/* ترويسات أمان على كل صفحة.

   سياسة المحتوى (CSP) ليست هنا بل في proxy.ts: هي تحتاج نصًّا عشوائيًّا
   (nonce) يتغيّر مع كل طلب، وهذا الملف يُقرأ مرّة عند الإقلاع.  */
const securityHeaders = [
  /* لا يُخمَّن نوع الملف من محتواه: صورة مرفوعة لا تُنفَّذ كسكربت */
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  /* لا يُوضع الموقع داخل إطار في موقع آخر — يمنع خداع النقر.
     (وCSP تقول frame-ancestors، وهذه للمتصفحات الأقدم.) */
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  /* لا يُسرَّب العنوان الكامل إلى المواقع الخارجية */
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  /* لا حاجة لهذه الأجهزة في موقع تعريفي */
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  /* المتصفح لا يطلب الموقع بـ http مرة أخرى حتى لو كُتب العنوان بلا s.
     سنتان، وبنطاقاته الفرعية. لا تُرسَل في التطوير: localhost بلا شهادة،
     وتثبيتها في المتصفح يقفل http://localhost لكل مشاريعك لا هذا وحده. */
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
  /* نافذة فتحها موقع آخر لا تصل إلى نافذتنا */
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  /* موارد الموقع لا تُضمَّن من نطاق آخر */
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  /* خادم واحد خلف وسيط الاستضافة */
  poweredByHeader: false,
  compress: true,

  /* وجودُ proxy.ts يجعل Next يحتجز جسمَ كل طلبٍ في الذاكرة ليمرّ عليه، وحدُّه
     عشرة ميجا. ففيديو من تليفون — وهو أكثر ما يُرفَع — كان يصل مبتورًا فيفشل
     تحليلُه بـ«Failed to parse body as FormData»، لا برسالةِ حجمٍ مفهومة.

     مئتان تطابق أقصى ما يقبله lib/media للفيديو، فيصير الرفضُ من فحصِ الحجم
     هناك برسالةٍ تقول السبب، لا من حدٍّ خفيٍّ قبله.

     والاسم proxyClientMaxBodySize لا middlewareClientMaxBodySize: الثاني
     مهجورٌ في هذه النسخة، كما صار الملف proxy.ts لا middleware.ts. */
  experimental: {
    proxyClientMaxBodySize: 200 * 1024 * 1024,
  },

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
        /* حساب العميل فيه المحادثة، وفيها رسالة صوتية — والمايك مقفول على
           الموقع كلّه بالسياسة أعلاه، فكان المتصفّح يرفض التسجيل قبل أن يسأل
           صاحبه أصلًا. يُفتَح هنا وحده: المحادثة لا تكون إلا في هذه الصفحة.

           و(self) إذنٌ للصفحة أن تطلب، لا إذنٌ بالتسجيل: المستخدم يبقى هو من
           يسمح أو يمنع من متصفّحه. والكاميرا تبقى مقفولة — الصور تُختار من
           الملفات، ومُدخِل الملف يفتح الكاميرا على الهاتف بلا هذا الإذن. */
        source: '/account',
        headers: [{ key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), interest-cohort=()' }],
      },
      {
        /* محادثة الموظف: يردّ على رسالة العميل الصوتية بصوته — أسرع من كتابة
           شرحٍ طويل، وأوضح في وصف قطعة أو عطل. المايك مقفول على اللوحة كلها
           بالسياسة أعلاه، فيُفتَح هنا وحده. و(self) إذنٌ بالطلب لا بالتسجيل. */
        source: '/admin/chats/:path*',
        headers: [{ key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), interest-cohort=()' }],
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
