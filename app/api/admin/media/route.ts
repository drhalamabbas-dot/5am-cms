/* واجهة المكتبة: قراءة القائمة ورفع الملفات وحذفها.

   مسار لا إجراء خادم، لأن الإجراءات مقيّدة بحجم جسم صغير والفيديو يتجاوزه.
   كل طلب يتحقّق من الجلسة أولًا: المكتبة ليست عامة.

   من يعدّل صفحة أو منتجًا يختار صورًا ويرفعها من داخل المحرّر، فالقراءة
   والرفع له أيضًا. والحذف من المكتبة لصاحب صلاحية «الصور والفيديو» وحده. */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { listMedia, saveUpload, deleteMedia, usedBy } from '@/lib/media';
import { mobileOf } from '@/lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const deny = () => NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
const forbid = () => NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
const USE = ['media.manage', 'pages.edit', 'products.edit', 'design.edit'];
async function who(perms: string[]) {
  const u = await currentUser();
  if (!u) return { res: deny() };
  if (!perms.some((p) => can(u, p))) return { res: forbid() };
  return { u };
}

export async function GET(req: Request) {
  const { res } = await who(USE);
  if (res) return res;
  const u = new URL(req.url);
  const path = u.searchParams.get('used');
  if (path) return NextResponse.json({ used: await usedBy(path) });

  /* أي الصور لها قَصّة هاتف بجانبها على القرص. القرص لا تراه اللوحة، وتجربة
     تحميل الصورة تكذب مع loading="lazy" — فالخادم يُسأل، وبنفس الدالة التي
     يختار بها الموقع القَصّة، فما تعرضه اللوحة هو ما سيراه الزائر. */
  const probe = u.searchParams.get('mobile');
  if (probe !== null) {
    const out: Record<string, string> = {};
    for (const p of probe.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200)) {
      const hit = mobileOf(p);
      if (hit) out[p] = hit;
    }
    return NextResponse.json({ mobile: out });
  }
  const rows = await listMedia({
    kind: u.searchParams.get('kind') ?? undefined,
    q: u.searchParams.get('q') ?? undefined,
  });
  return NextResponse.json({ items: rows });
}

export async function POST(req: Request) {
  const { u, res } = await who(USE);
  if (res) return res;
  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: 'لا ملفات' }, { status: 400 });

  const added: any[] = [];
  const failed: string[] = [];
  for (const f of files) {
    const r = await saveUpload(f);
    if (r.ok) added.push(r.row);
    else failed.push(r.error);
  }
  if (added.length) await audit(u!, 'media.upload', { entity: 'media', summary: added.map((r) => r.path).slice(0, 10).join('، ') });
  return NextResponse.json({ added, failed });
}

export async function DELETE(req: Request) {
  const { u, res } = await who(['media.manage']);
  if (res) return res;
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'بلا معرّف' }, { status: 400 });
  const r = await deleteMedia(id);
  if (r.ok) await audit(u!, 'media.delete', { entity: 'media', id });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
