/* صور الحضور والتسجيل من المجلد الخاص (lib/private.ts): للسوبر أدمن، أو
   للموظف نفسه في صوره هو. لا تُخزَّن في أي ذاكرة وسيطة. */
import fs from 'node:fs/promises';
import { currentUser } from '@/lib/auth';
import { isSuper } from '@/lib/permissions';
import { privateFile } from '@/lib/private';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u) return new Response('Unauthorized', { status: 401 });
  const rel = new URL(req.url).searchParams.get('f') ?? '';
  if (!/^(attendance\/\d{4}-\d{2}\/u\d+-|faces\/\d+\/)[\w.-]+\.jpg$/.test(rel)) return new Response('Not found', { status: 404 });
  const owner = Number((rel.match(/^attendance\/\d{4}-\d{2}\/u(\d+)-/) ?? rel.match(/^faces\/(\d+)\//))?.[1]);
  if (!isSuper(u) && owner !== u.id) return new Response('Forbidden', { status: 403 });
  const file = privateFile(rel);
  if (!file) return new Response('Not found', { status: 404 });
  try {
    const buf = await fs.readFile(file);
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
