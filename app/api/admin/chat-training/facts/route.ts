/* بيانات تدريب من قاعدة البيانات نفسها (lib/chat/facts.ts) — بلا نداء لموديل.
   POST            ← يبني ويحفظ الجديد «للمراجعة»
   POST ?dry=1     ← يبني ويعرض بلا حفظ */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { q, q1 } from '@/lib/db';
import { factPairs } from '@/lib/chat/facts';
import { normalize } from '@/lib/chat/text';
import { recheck } from '@/lib/chat/quality';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const json = (v: unknown, status = 200) => NextResponse.json(v, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return json({ error: 'غير مصرّح' }, 401);
  if (!can(u, 'chat.train')) return json({ error: 'ليست لديك صلاحية' }, 403);

  const pairs = await factPairs();
  const dry = new URL(req.url).searchParams.get('dry') === '1';
  const sample = pairs.slice(0, 3);
  if (dry) return json({ built: pairs.length, added: 0, skipped: 0, sample });

  let added = 0, skipped = 0;
  for (const p of pairs) {
    const qn = normalize(p.q).slice(0, 1000);
    const had = await q1<any>('SELECT id FROM chat_cache WHERE lang = ? AND q_norm = ?', [p.lang, qn]);
    if (had) { skipped++; continue; }
    const r = await q('INSERT INTO chat_cache (lang, question, q_norm, answer, source) VALUES (?,?,?,?,?)',
      [p.lang, p.q.slice(0, 1000), qn, p.a, 'facts']) as unknown as { insertId: number };
    await recheck(r.insertId).catch(() => {});
    added++;
  }
  return json({ built: pairs.length, added, skipped, sample });
}
