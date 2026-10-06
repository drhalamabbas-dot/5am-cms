/* إحصاء ما يبحث عنه الزوار في المتجر: الكلمة وعدد النتائج في اليوم، بلا أي
   بيانات عن الزائر. كلمة بلا نتائج = منتج يطلبه الناس وليس عندنا.
   ما يشبه رقم موبايل أو بريدًا لا يُحفظ، كي لا تدخل بيانات شخصية الإحصاء. */
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { q } from '@/lib/db';
import { ipHash } from '@/lib/requests';
import { recordView } from '@/lib/analytics';
import { currentUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const seen = new Map<string, number[]>();
const WINDOW = 10 * 60 * 1000;

export async function POST(req: Request) {
  const ok = new NextResponse(null, { status: 204 });
  let b: any;
  try { b = JSON.parse((await req.text()).slice(0, 2000)); } catch { return ok; }

  /* زيارة صفحة (components/site/TrackView.tsx) — نفس شروط lib/analytics.ts */
  if (b?.kind === 'view') {
    const h = await headers();
    const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null;
    const key = `v:${ipHash(ip) ?? 'x'}`;
    const now = Date.now();
    const list = (seen.get(key) ?? []).filter((t) => now - t < WINDOW);
    if (list.length >= 200) return ok;
    list.push(now); seen.set(key, list);
    const path = typeof b.path === 'string' && /^\/[\w./?=&%-]{0,189}$/.test(b.path) ? b.path : null;
    const product = typeof b.product === 'string' && /^[\w-]{1,120}$/.test(b.product) ? b.product : null;
    if (!path || (await currentUser())) return ok;              // الأدمن لا تُعدّ زيارته
    recordView({
      path, lang: b.lang === 'en' ? 'en' : 'ar', ua: h.get('user-agent'), ip, host: h.get('host'),
      referer: typeof b.ref === 'string' ? b.ref.slice(0, 500) : null,
      utm: typeof b.utm === 'string' ? b.utm.slice(0, 60) : null, product,
    });
    return ok;
  }
  const term = String(b?.term ?? '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
  if (term.length < 2 || /@/.test(term) || (term.replace(/[^\d٠-٩]/g, '').length >= 7)) return ok;
  const results = Math.max(0, Math.min(10000, Math.floor(Number(b?.results) || 0)));

  /* 30 كلمة لكل زائر في 10 دقائق — يكفي لإنسان ويمنع الإغراق */
  const h = await headers();
  const key = ipHash((h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null) ?? 'x';
  const now = Date.now();
  const list = (seen.get(key) ?? []).filter((t) => now - t < WINDOW);
  if (list.length >= 30) return ok;
  list.push(now); seen.set(key, list);
  if (seen.size > 5000) seen.clear();

  await q(
    `INSERT INTO search_stats (term, day, hits, results) VALUES (?, CURDATE(), 1, ?)
     ON DUPLICATE KEY UPDATE hits = hits + 1, results = VALUES(results)`, [term, results]
  ).catch(() => {});
  return ok;
}
