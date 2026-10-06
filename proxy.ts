/* يمرّر اللغة والمسار إلى التخطيط عبر ترويسات الطلب.
   التخطيط في App Router لا يقرأ معاملات العنوان، وهو يحتاج اللغة ليضبط
   lang و dir على وسم <html> قبل أول رسم.

   كان اسم هذا الملف middleware.ts؛ وNext 16 سمّى هذه الطبقة proxy. */
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get('lang')?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  const headers = new Headers(req.headers);
  headers.set('x-lang', lang);
  headers.set('x-path', req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/|assets/|media/|favicon.ico|robots.txt|site.webmanifest|apple-touch-icon.png).*)'],
};
