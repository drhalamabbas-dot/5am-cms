'use client';
/* يحدّث الشاشة من السيرفر كل عدد ثوانٍ (والتبويب ظاهر) — لقوائم تتغيّر وأنت بتتفرّج */
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
