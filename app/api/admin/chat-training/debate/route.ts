/* جولة نقاش بين موديلنا والموديل الكبير (lib/chat/debate.ts) — لمن عنده «تدريب البوت».
   POST { question, lang }   ← جولة واحدة، وتُرجع الحكم وسبب الخطأ والإجابة المصحّحة.
   POST { count }            ← دفعة من الأسئلة التي لم تُجَب بعد. */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { debateOne, debateBatch } from '@/lib/chat/debate';
import { pending } from '@/lib/chat/trainer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const json = (v: unknown, status = 200) => NextResponse.json(v, { status, headers: { 'Cache-Control': 'no-store' } });
let running = false;

export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return json({ error: 'غير مصرّح' }, 401);
  if (!can(u, 'chat.train')) return json({ error: 'ليست لديك صلاحية' }, 403);
  if (running) return json({ error: 'جولة شغّالة بالفعل' }, 409);

  let b: any = {};
  try { b = await req.json(); } catch { /* فارغ */ }

  running = true;
  try {
    const question = String(b?.question ?? '').trim();
    if (question) {
      const lang = b?.lang === 'en' ? 'en' : 'ar';
      const r = await debateOne(question, lang);
      return 'error' in r ? json(r, 502) : json(r);
    }
    const todo = (await pending()).sort(() => Math.random() - 0.5);
    if (!todo.length) return json({ error: 'مفيش أسئلة متبقية — كلها اتجابت.' }, 409);
    return json(await debateBatch(todo.map((i) => ({ q: i.q, lang: i.lang })), Number(b?.count) || 3));
  } finally {
    running = false;
  }
}
