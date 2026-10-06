'use client';
/* عدّ الزيارة من متصفح الزائر — مرة واحدة لكل تحميل حقيقي للصفحة.
   تحديثات Next في الخلفية والتحميل المسبق والروبوتات بلا جافاسكريبت لا تمرّ
   من هنا، فلا تُعدّ. بلا كوكي: يرسل المسار والمصدر فقط (/api/stats). */
import { useEffect } from 'react';

export function TrackView({ path, lang, product }: { path: string; lang: string; product?: string | null }) {
  useEffect(() => {
    /* timeOrigin ثابت طوال تحميل الصفحة الواحد: إعادة تشغيل التأثير لا تكرّر العدّ */
    const w = window as any;
    const key = `${performance.timeOrigin}|${path}`;
    if (w.__5amView === key) return;
    w.__5amView = key;
    const utm = new URLSearchParams(location.search).get('utm_source');
    const body = JSON.stringify({ kind: 'view', path, lang, product: product ?? null, ref: document.referrer || null, utm });
    if (!navigator.sendBeacon?.('/api/stats', new Blob([body], { type: 'application/json' }))) {
      fetch('/api/stats', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
    }
  }, [path, lang, product]);
  return null;
}
