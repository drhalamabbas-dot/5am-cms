/* غلاف الداش بورد — مستقلّ تمامًا عن الموقع: لا يحمّل CSS الموقع ولا خطوطه،
   فلا يؤثّر أحدهما في الآخر. واجهته بالعربية من اليمين إلى اليسار. */
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { ASSET_V } from '@/lib/version';

export const metadata: Metadata = {
  title: 'لوحة تحكم 5A&M',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet"
              href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" />
        {/* موسوم ببصمة المحتوى: بعد كل تحديث يصل التصميم الجديد لا المخزَّن */}
        <link rel="stylesheet" href={`/admin.css?v=${ASSET_V}`} />
      </head>
      <body>{children}</body>
    </html>
  );
}
