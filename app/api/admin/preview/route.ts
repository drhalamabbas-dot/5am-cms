/* يستقبل حالة المحرّر المرئي ويحفظها معاينةً مؤقتة (lib/previewStore.ts).
   لا يكتب في القاعدة شيئًا: الحفظ الفعلي زرٌّ منفصل في المحرّر. */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { q1 } from '@/lib/db';
import { SECTION_TYPES } from '@/lib/sectionSchema';
import { EDITABLE_TEMPLATES } from '@/lib/admin';
import { putPreview, MAX_BYTES, type PreviewSection } from '@/lib/previewStore';
import { cleanTheme } from '@/lib/design';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return bad('غير مصرّح', 401);
  if (!can(user, 'pages.edit') && !can(user, 'design.edit') && !can(user, 'nav.edit')) return bad('ليست لديك صلاحية', 403);

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return bad('المعاينة أكبر من المسموح');
  let body: any;
  try { body = JSON.parse(raw); } catch { return bad('صيغة غير صالحة'); }

  const slug = String(body?.slug ?? '');
  const page = await q1<any>('SELECT id, template FROM pages WHERE slug = ?', [slug]);
  if (!page) return bad('الصفحة غير موجودة', 404);
  if (!EDITABLE_TEMPLATES.includes(page.template)) return bad('هذه الصفحة لا تُعاين من المحرّر المرئي', 403);

  /* لا يُعرض إلا ما يعرف الموقع كيف يرسمه */
  const sections: PreviewSection[] = [];
  for (const s of Array.isArray(body.sections) ? body.sections : []) {
    if (!Number.isInteger(s?.id) || !SECTION_TYPES[s?.type]) continue;
    sections.push({
      id: s.id, type: s.type, published: s.published ? 1 : 0,
      anchor: typeof s.anchor === 'string' ? s.anchor : null,
      content: s.content && typeof s.content === 'object' ? s.content : {},
    });
  }
  const hero = body.hero && typeof body.hero === 'object' ? body.hero : {};

  /* صفوف المنيو العلوي: الحقول التي يرسمها الهيدر وحدها، بأنواعها */
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  const nav = Array.isArray(body.nav) ? body.nav
    .filter((r: any) => Number.isInteger(r?.id))
    .map((r: any) => ({
      id: r.id, parent_id: Number.isInteger(r.parent_id) ? r.parent_id : null, area: 'header',
      position: Number(r.position) || 0, label_en: str(r.label_en) ?? '', label_ar: str(r.label_ar) ?? '',
      href: str(r.href), desc_en: str(r.desc_en), desc_ar: str(r.desc_ar),
      extra: r.extra && typeof r.extra === 'object' ? r.extra : null, published: r.published ? 1 : 0,
    })) : undefined;

  /* ألوان الموقع وخطوطه: القيم المعروفة وحدها (lib/design.ts) */
  const theme = body.theme && typeof body.theme === 'object' ? cleanTheme(body.theme) : undefined;

  const token = putPreview(user.id, slug, { hero, sections, nav, theme },
    typeof body.token === 'string' ? body.token : undefined,
    Number.isSafeInteger(body.rev) ? body.rev : 0);
  return NextResponse.json({ token }, { headers: { 'Cache-Control': 'no-store' } });
}
