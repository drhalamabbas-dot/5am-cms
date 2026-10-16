'use client';
/* =============================================================================
   حركة الدخول في لوحة التحكم — GSAP.

   القاعدة الوحيدة المهمّة هنا: لا يُخفى شيء في الـ CSS. كل حركة من gsap.from،
   أي أن العنصر مرسوم ومقروء أصلًا، والحركة تبدأ من حالة مؤقّتة وتنتهي عنده.
   فإن تعطّل السكربت أو تأخّر، تظهر الشاشة كاملة لا فارغة.

   وتُلغى كلها لمن طلب تقليل الحركة من نظامه.
============================================================================= */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { gsap } from 'gsap';

export function Motion() {
  const path = usePathname();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      const ease = 'power2.out';

      /* شاشات اللوحة تختلف في عناصرها: صفحة الدخول بلا قائمة ولا بطاقات مثلًا.
         وgsap ينبّه في الطرفية على كل محدِّد لا يطابق شيئًا، فكان سجلّ التطوير
         يمتلئ بتحذيرات لا تعني خطأً. فلا نحرّك إلا ما هو موجود فعلًا. */
      const from = (sel: string, vars: gsap.TweenVars) => {
        const els = document.querySelectorAll(sel);
        if (els.length) gsap.from(els, vars);
      };

      /* روابط القائمة تتتابع مرة واحدة عند أول فتح، لا مع كل تنقّل */
      if (!sessionStorage.getItem('adminSideIn')) {
        sessionStorage.setItem('adminSideIn', '1');
        from('.side a, .side__sep, .bell, .side__search', {
          x: 12, duration: .3, stagger: .02, ease, clearProps: 'all',
        });
      }

      /* بلا تلاشٍ على ما يحمل نصًّا: التلاشي كان يجعل أول لحظة من كل فتحة
         باهتةً، فيبدو التصميم مغبَّشًا. الإزاحة وحدها تكفي، والنصّ معتم دائمًا. */
      from('.top > *', { y: 8, duration: .3, stagger: .05, ease, clearProps: 'all' });
      from('.stat', { y: 14, duration: .36, stagger: .045, ease, clearProps: 'all' });
      from('.panel, .wiz, .board__col', {
        y: 10, duration: .34, stagger: .05, delay: .06, ease, clearProps: 'all',
      });

      /* الأرقام تعدّ من الصفر — لكن النصّ الأصلي يبقى هو المرجع، فلو انقطعت
         الحركة في منتصفها أعادته onComplete كما هو. */
      document.querySelectorAll<HTMLElement>('.stat b').forEach((el) => {
        const text = (el.textContent || '').trim();
        if (!/^\d[\d,]*$/.test(text)) return;
        const end = Number(text.replace(/,/g, ''));
        if (!Number.isFinite(end) || end === 0) return;
        const o = { v: 0 };
        gsap.to(o, {
          v: end, duration: Math.min(1.1, .4 + end / 400), ease: 'power1.out',
          onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('en-US'); },
          onComplete: () => { el.textContent = text; },
        });
      });
    });

    return () => ctx.revert();
  }, [path]);

  return null;
}
