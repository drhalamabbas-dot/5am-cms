/* ممر للموقع القديم أثناء التطوير فقط.

   لماذا: المقارنة بين القديم والجديد تحتاج قراءة شجرة عناصر الاثنين من نفس
   الصفحة، والمتصفح يمنع ذلك عبر المنافذ المختلفة. بتمرير القديم تحت
   /__old يصير المصدر واحدًا فتصحّ المقارنة آليًا لكل الصفحات.

   لا يعمل في الإنتاج. */
const OLD = process.env.OLD_SITE_URL || 'http://127.0.0.1:8000';

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('not available', { status: 404 });
  }
  const { path } = await params;
  const search = new URL(req.url).search;
  let upstream: Response;
  try {
    upstream = await fetch(`${OLD}/${path.join('/')}${search}`, { cache: 'no-store' });
  } catch {
    return new Response(`الموقع القديم غير مشغّل على ${OLD}\nشغّله بـ: node scripts/serve-old.mjs 8000`, {
      status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  const type = upstream.headers.get('content-type') ?? 'application/octet-stream';
  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: upstream.status,
    headers: { 'Content-Type': type, 'Cache-Control': 'no-store' },
  });
}
