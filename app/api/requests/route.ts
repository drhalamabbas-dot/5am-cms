/* يستقبل طلبات الزوار: عرض السعر، وسلة المتجر، و«كلّموني» (lib/requests.ts).

   عام بلا دخول، فكل شيء يُفحص هنا: الحقول تُقصّ لأطوال معقولة، والمنتجات
   تُقبل إن كانت منشورة فقط، وحقل مخفي يملؤه الروبوت وحده، و5 طلبات على الأكثر
   من العنوان نفسه في 10 دقائق. */
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { q } from '@/lib/db';
import { createRequest, tooMany, ipHash, clip, type Item } from '@/lib/requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const KINDS = ['quote', 'store', 'callback'];
const SOURCES = ['store', 'quote', 'product', 'contact'];

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 20000) return bad('too-large', 413);
  let b: any;
  try { b = JSON.parse(raw); } catch { return bad('format'); }

  /* الحقل المخفي: الإنسان لا يراه ولا يملؤه. يُردّ بنجاح كي لا يتعلّم الروبوت */
  if (b?.website) return NextResponse.json({ ok: true });

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null;
  if (tooMany(ipHash(ip))) return bad('too-many', 429);

  const kind = KINDS.includes(b?.kind) ? b.kind : 'quote';
  const name = clip(b?.name, 120);
  /* الأرقام العربية والفارسية تُحفظ لاتينية، فيعمل الاتصال وواتساب من اللوحة مباشرةً */
  const phone = clip(b?.phone, 40)
    ?.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) ?? null;
  const email = clip(b?.email, 160);
  if (!phone && !email) return bad('contact');
  if (phone && phone.replace(/[^\d٠-٩۰-۹]/g, '').length < 7) return bad('phone');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('email');

  /* المنتجات: المنشورة وحدها، بالكمية من 1 إلى 9999، و50 على الأكثر */
  const want: { ref: string; qty: number }[] = (Array.isArray(b?.items) ? b.items : []).slice(0, 50)
    .map((i: any) => ({ ref: clip(i?.ref, 120) ?? '', qty: Math.min(9999, Math.max(1, Math.floor(Number(i?.qty) || 1))) }))
    .filter((i: { ref: string }) => i.ref);
  let items: Item[] = [];
  if (want.length) {
    /* يُقبل معرّف المنتج أو مساره (نموذج عرض السعر يرسل المسار) */
    const marks = want.map(() => '?').join(',');
    const rows = await q<any>(
      `SELECT ref, slug, sku, name_ar, name_en FROM products WHERE published = 1 AND (ref IN (${marks}) OR slug IN (${marks}))`,
      [...want.map((i) => i.ref), ...want.map((i) => i.ref)]
    );
    const byRef = new Map<string, any>();
    for (const r of rows) { byRef.set(r.ref, r); byRef.set(r.slug, r); }
    items = want.filter((i) => byRef.has(i.ref)).map((i) => {
      const r = byRef.get(i.ref);
      return { ref: r.ref, slug: r.slug, sku: r.sku, name: r.name_ar || r.name_en || r.ref, qty: i.qty };
    });
  }
  if (kind === 'store' && !items.length) return bad('empty');

  const id = await createRequest({
    kind, name, phone, email,
    company: clip(b?.company, 160), city: clip(b?.city, 100), message: clip(b?.message, 4000),
    items, source: SOURCES.includes(b?.source) ? b.source : null, page: clip(b?.page, 250),
    lang: b?.lang === 'en' ? 'en' : 'ar', ip,
  });
  return NextResponse.json({ ok: true, id }, { headers: { 'Cache-Control': 'no-store' } });
}
