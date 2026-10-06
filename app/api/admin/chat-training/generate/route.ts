/* دفعة من مولّد بيانات التدريب (lib/chat/trainer.ts) — لمن عنده «تدريب البوت».
   GET ← كم سؤالًا متبقيًا (و?list=1 ← الأسئلة نفسها، لكتابة إجاباتها من خارج الموقع).
   POST { count } ← يجيب حتى 10 أسئلة ويضعها «للمراجعة». */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { pending, generateBatch } from '@/lib/chat/trainer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const json = (v: unknown, status = 200) => NextResponse.json(v, { status, headers: { 'Cache-Control': 'no-store' } });
let running = false;

async function guard() {
  const u = await currentUser();
  if (!u) return json({ error: 'غير مصرّح' }, 401);
  if (!can(u, 'chat.train')) return json({ error: 'ليست لديك صلاحية' }, 403);
  return null;
}

export async function GET(req: Request) {
  const g = await guard(); if (g) return g;
  const list = await pending();
  return new URL(req.url).searchParams.get('list') === '1'
    ? json({ remaining: list.length, items: list })
    : json({ remaining: list.length });
}

export async function POST(req: Request) {
  const g = await guard(); if (g) return g;
  if (running) return json({ error: 'دفعة شغّالة بالفعل' }, 409);
  let b: any = {};
  try { b = await req.json(); } catch { /* فارغ */ }
  running = true;
  try {
    return json(await generateBatch(Number(b?.count) || 5));
  } finally {
    running = false;
  }
}
