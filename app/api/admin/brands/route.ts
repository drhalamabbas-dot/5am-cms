/* قائمة الماركات للوحة: يسألها حقل اختيار اللوجوهات في محرّر الأقسام، فيعرضها
   للأدمن ليضغط عليها بدل كتابة معرّف كل ماركة بسطر.

   للقراءة فقط ولمن له جلسة: أسماء الماركات ولوجوهاتها تظهر للزائر أصلًا، لكن
   لا داعي لفتح نقطة وصول جديدة بلا حاجة. */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { getBrands } from '@/lib/content';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!await currentUser()) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  /* مسارات اللوجوهات محفوظة نسبيةً («assets/img/…») لأن صفحات الموقع في جذره.
     وشاشات اللوحة متداخلة (‎/admin/pages/x/sections/9‎)، فالمسار النسبي يُحسب
     من مكان الشاشة لا من الجذر فلا تظهر صورة. تُجذَّر هنا لا في قاعدة البيانات
     كي لا يتغيّر ما يرسمه الموقع. */
  const root = (p: string | null) =>
    (!p || /^(https?:)?\/\//.test(p) || p.startsWith('/') ? p : `/${p}`);
  const brands = Object.values(await getBrands())
    .map((b) => ({ slug: b.slug, name: b.name, logo: root(b.logo ?? null) }));
  return NextResponse.json({ brands }, { headers: { 'Cache-Control': 'no-store' } });
}
