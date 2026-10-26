/* يمرّر اللغة والمسار إلى التخطيط عبر ترويسات الطلب، ويضع سياسة أمان المحتوى.

   التخطيط في App Router لا يقرأ معاملات العنوان، وهو يحتاج اللغة ليضبط
   lang و dir على وسم <html> قبل أول رسم.

   كان اسم هذا الملف middleware.ts؛ وNext 16 سمّى هذه الطبقة proxy. */
import { NextResponse, type NextRequest } from 'next/server';

/* ============================================================ سياسة المحتوى
   خط الدفاع الأخير: إن تسرّب نصّ من زائر إلى صفحة — من اسم في نموذج، أو ردّ
   موديل، أو حقل حرّره موظف — فالمتصفح يرفض تشغيله سكربتًا.

   النصّ (nonce) يُولَّد لكل طلب، وNext يضعه على سكربتاته تلقائيًّا، فما لا
   يحمله لا يعمل. ولا يُخمَّن: عشوائي في كل مرة.

   وتكلفة هذا عادةً أن كل صفحة تصير ديناميكية فتبطؤ — وصفحات هذا الموقع
   ديناميكية أصلًا (المحتوى من قاعدة البيانات ويتغيّر بالحفظ)، فالثمن مدفوع.

   ما سُمح به وسببه:
   • الأنماط inline: المحرّر واللوحة يكتبان style= على العناصر، وألوان الموقع
     تُحقَن في <style> من إعدادات اللوحة. وحقن الأنماط أضيق خطرًا من السكربت
     بكثير، والبديل إعادة كتابة شاشات اللوحة كلّها.
   • خطوط جوجل: تُحمَّل من googleapis وgstatic.
   • إطارات يوتيوب والخرائط: قسم الفيديو وقسم «أين نحن».
   • unsafe-eval في التطوير وحده: React يستعمل eval ليُظهر أصل الخطأ. */
function csp(nonce: string, dev: boolean) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    /* blob: لازمٌ لما يُنشئه المتصفّح نفسه: مقطعٌ يختاره العميل يُقرأ من
       blob قبل رفعه لتُستخرَج لقطاته. وبدونه يردّ العنصر بـ«صيغة غير
       مدعومة» وإن كان الكودِك مدعومًا — وهو خطأٌ يصعب ردّه إلى سببه. */
    "media-src 'self' blob:",
    "frame-src 'self' https://www.youtube-nocookie.com https://maps.google.com https://www.google.com",
    `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/* المسارات التي يجوز أن يصلها جسمٌ كبير — ورفعُ الملفات وحده منها.
   (next.config.ts يرفع الحدّ إلى 200 ميجا من أجلها، وهو حدٌّ عامٌّ لا
   يُضبَط لمسار؛ فبدون هذا الفحص صار كلُّ مسارٍ في الموقع — وفيه ما لا
   يحتاج دخولًا — بابًا لإغراق الخادم بأجسامٍ ضخمة.) */
const BIG_OK = /^\/api\/(chat\/upload|admin\/media)$/;
/** ما سواها: ميجا واحد يكفي أي نموذجٍ أو طلبِ JSON في الموقع. */
const SMALL_MAX = 1024 * 1024;

export function proxy(req: NextRequest) {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const len = Number(req.headers.get('content-length') ?? 0);
    if (len > SMALL_MAX && !BIG_OK.test(req.nextUrl.pathname)) {
      return new NextResponse('Payload too large', { status: 413 });
    }
  }

  const lang = req.nextUrl.searchParams.get('lang')?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const dev = process.env.NODE_ENV === 'development';
  const policy = csp(nonce, dev);

  const headers = new Headers(req.headers);
  headers.set('x-lang', lang);
  headers.set('x-path', req.nextUrl.pathname);
  /* Next يقرأ النصّ من هذه الترويسة في الطلب ليضعه على سكربتاته */
  headers.set('content-security-policy', policy);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', policy);
  return res;
}

export const config = {
  matcher: ['/((?!_next/|assets/|media/|favicon.ico|robots.txt|site.webmanifest|apple-touch-icon.png).*)'],
};
