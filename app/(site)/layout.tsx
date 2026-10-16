/* التخطيط الجذر — يعيد إنتاج <head> و<body> بنفس ما في صفحات الموقع الحالي:
   الخطوط نفسها، وملفات CSS نفسها بالترتيب نفسه، وسمة data-page على body. */
import { headers } from 'next/headers';
import { ASSET_V } from '@/lib/version';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

/* أساس الروابط الكاملة في رأس الصفحة (روابط اللغة الأخرى لمحركات البحث) — من
   SITE_URL على الاستضافة، وإلا عنوان الموقع الحقيقي */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL?.trim() || 'https://www.5a-eg.com'),
};

/* ما كان site.css يستورده يُربط هنا مباشرةً بالترتيب نفسه (فالترتيب في
   المتصفح واحد)، ومع رقم النسخة: الاستيراد كان برقم ثابت لا يتغيّر، فتعديل
   base.css وأخواته لم يكن يصل إلى من زار الموقع قبله — والملفات تُخزَّن عامًا. */
const CSS = ['base', 'home', 'equipment', 'model', 'quote', 'services', 'about', 'ux', 'motion', 'story', 'store', 'chat', 'blocks'];

export default async function RootLayout({ children }: { children: ReactNode }) {
  const h = await headers();
  const lang = h.get('x-lang') === 'ar' ? 'ar' : 'en';
  const path = h.get('x-path') ?? '/';
  const page = (path.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';

  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/assets/img/brands/icon-192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#0E1B2E" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=Cairo:wght@600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {CSS.map((f) => (
          <link key={f} rel="stylesheet" href={`/assets/css/${f}.css?v=${ASSET_V}`} />
        ))}
      </head>
      {/* data-onepage على الرئيسية فقط، كما في index.html: يشغّل متابعة
          السكشن الظاهر في المنيو. */}
      <body data-page={page} {...(page === 'index' ? { 'data-onepage': '' } : {})}>{children}</body>
    </html>
  );
}
