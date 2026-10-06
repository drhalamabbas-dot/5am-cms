/* =============================================================================
   يعرض الملفات المرفوعة من مجلد الرفع الدائم (lib/uploads.ts).

   • الفيديو يُطلب أجزاءً (Range) كي يبدأ قبل اكتمال تحميله ويُقدَّم ويُؤخَّر.
   • لا يُعرض إلا امتداد معروف، وبنوعه الصحيح، ومع nosniff، فلا يُفسَّر ملف
     كصفحة أو سكربت. وللصور والفيديو سياسة محتوى معزولة احتياطًا.
   • المسار يُحلّ إلى مكانه الحقيقي (realpath) ثم يُتحقَّق أنه داخل المجلد،
     فلا يُخرج منه بـ «..» ولا برابط رمزي.
   • أسماء المرفوعات لا تتكرّر، فتُخزَّن في المتصفح عامًا.
============================================================================= */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { uploadRoot } from '@/lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf',
};

type Ctx = { params: Promise<{ path: string[] }> };

const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

async function locate(parts: string[]): Promise<{ file: string; size: number; mtime: Date; type: string } | null> {
  const root = uploadRoot();
  if (!root || !parts?.length) return null;
  if (parts.some((p) => !p || p === '.' || p === '..' || /[\\\0]/.test(p))) return null;
  const type = MIME[path.extname(parts[parts.length - 1]).slice(1).toLowerCase()];
  if (!type) return null;
  try {
    const realRoot = await fsp.realpath(root);
    const file = await fsp.realpath(path.join(root, ...parts));
    if (!file.startsWith(realRoot + path.sep)) return null;
    const st = await fsp.stat(file);
    if (!st.isFile()) return null;
    return { file, size: st.size, mtime: st.mtime, type };
  } catch {
    return null;
  }
}

/** «bytes=start-end» بنطاق واحد. null = لا نطاق، false = نطاق غير صالح. */
function parseRange(h: string | null, size: number): { start: number; end: number } | null | false {
  if (!h) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(h.trim());
  if (!m || (m[1] === '' && m[2] === '')) return false;
  let start: number, end: number;
  if (m[1] === '') {                      // آخر N بايت
    const n = Number(m[2]);
    if (n === 0) return false;
    start = Math.max(0, size - n); end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start <= end && start < size ? { start, end } : false;
}

async function serve(req: Request, ctx: Ctx, head: boolean) {
  const f = await locate((await ctx.params).path);
  if (!f) return notFound();

  const headers = new Headers({
    'Content-Type': f.type,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    'Last-Modified': f.mtime.toUTCString(),
  });
  /* عارض PDF في المتصفح لا يعمل داخل sandbox، فيُستثنى. */
  if (f.type !== 'application/pdf') headers.set('Content-Security-Policy', "default-src 'none'; sandbox");

  const range = parseRange(req.headers.get('range'), f.size);
  if (range === false) {
    headers.set('Content-Range', `bytes */${f.size}`);
    return new Response(null, { status: 416, headers });
  }

  const start = range ? range.start : 0;
  const end = range ? range.end : f.size - 1;
  headers.set('Content-Length', String(f.size ? end - start + 1 : 0));
  if (range) headers.set('Content-Range', `bytes ${start}-${end}/${f.size}`);

  const body = head || f.size === 0
    ? null
    : (Readable.toWeb(fs.createReadStream(f.file, { start, end })) as unknown as ReadableStream);
  return new Response(body, { status: range ? 206 : 200, headers });
}

export const GET = (req: Request, ctx: Ctx) => serve(req, ctx, false);
export const HEAD = (req: Request, ctx: Ctx) => serve(req, ctx, true);
