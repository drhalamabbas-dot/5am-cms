'use client';
/* زر «استعمل موقعي الآن»: يملأ خانتي موقع المكتب من موقع الجهاز — يُضغط وأنت في المكتب */
import { useState } from 'react';

export function OfficeLocate() {
  const [msg, setMsg] = useState('');
  const go = () => {
    setMsg('نحدّد موقعك…');
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const set = (id: string, v: number) => { const el = document.getElementById(id) as HTMLInputElement | null; if (el) el.value = v.toFixed(7); };
        set('office_lat', p.coords.latitude); set('office_lng', p.coords.longitude);
        setMsg(`تم (دقة ${Math.round(p.coords.accuracy)} متر). اضغط «احفظ».`);
      },
      () => setMsg('لم نعرف موقعك — اسمح للمتصفح بالموقع.'),
      { enableHighAccuracy: true, timeout: 20000 },
    );
  };
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" className="btn btn--ghost btn--sm" onClick={go}>استعمل موقعي الآن</button>
      {msg ? <small>{msg}</small> : null}
    </span>
  );
}
