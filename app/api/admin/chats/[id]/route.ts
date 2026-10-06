/* محادثة من جهة الموظف (components/admin/AgentChat.tsx).
   GET ?after=            ← الرسائل الجديدة وحالة المحادثة (يتابع البوت والعميل مباشرةً).
   POST { text, keepBot } ← ردّ الموظف. keepBot=false (الافتراضي): الموظف يستلم والبوت يسكت.
                            keepBot=true: ردّ الموظف يدخل والبوت يكمّل بعده.
   POST { suggest: true } ← «اقتراح البوت»: ردّه على آخر رسالة للعميل بلا إرسال ولا حفظ. */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { q, q1 } from '@/lib/db';
import { addMessage } from '@/lib/chat/conv';
import { reply } from '@/lib/chat/bot';
import { langOf } from '@/lib/chat/text';
import { clip } from '@/lib/requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (v: unknown, status = 200) => NextResponse.json(v, { status, headers: { 'Cache-Control': 'no-store' } });
type Ctx = { params: Promise<{ id: string }> };

async function guard() {
  const u = await currentUser();
  if (!u) return { res: json({ error: 'غير مصرّح' }, 401) };
  if (!can(u, 'chat.handle')) return { res: json({ error: 'ليست لديك صلاحية' }, 403) };
  return { u };
}

export async function GET(req: Request, ctx: Ctx) {
  const { res } = await guard();
  if (res) return res;
  const id = Number((await ctx.params).id);
  const c = await q1<any>('SELECT c.id, c.status, c.assigned_to, u.name AS agent FROM chat_conversations c LEFT JOIN users u ON u.id = c.assigned_to WHERE c.id = ?', [id]);
  if (!c) return json({ error: 'غير موجودة' }, 404);
  const after = Number(new URL(req.url).searchParams.get('after')) || 0;
  const messages = await q<any>(
    `SELECT m.id, m.role, m.text, m.source, m.created_at, u.name AS who FROM chat_messages m LEFT JOIN users u ON u.id = m.user_id
      WHERE m.conversation_id = ? AND m.id > ? ORDER BY m.id LIMIT 300`, [id, after]
  );
  return json({ status: c.status, assigned_to: c.assigned_to, agent: c.agent, messages });
}

export async function POST(req: Request, ctx: Ctx) {
  const { u, res } = await guard();
  if (res) return res;
  const id = Number((await ctx.params).id);
  const c = await q1<any>('SELECT id, status, lang, assigned_to FROM chat_conversations WHERE id = ?', [id]);
  if (!c) return json({ error: 'غير موجودة' }, 404);
  let b: any = {};
  try { b = await req.json(); } catch { /* فارغ */ }

  /* ---------------------------------------------- اقتراح البوت (لا يُرسل) */
  if (b?.suggest) {
    const hist = (await q<any>("SELECT role, text FROM chat_messages WHERE conversation_id = ? AND role IN ('user','bot','agent') ORDER BY id DESC LIMIT 8", [id])).reverse();
    const lastUser = [...hist].reverse().find((m) => m.role === 'user');
    if (!lastUser) return json({ error: 'العميل لم يكتب شيئًا بعد' }, 400);
    const before = hist.slice(0, hist.lastIndexOf(lastUser)).map((m) => ({ role: m.role === 'user' ? 'user' : 'bot', text: m.text }));
    const lang = langOf(lastUser.text) ?? (c.lang === 'en' ? 'en' : 'ar');
    const r = await reply(lastUser.text, lang, before, { dryRun: true });
    return json({ ok: true, text: r.text, source: r.source, handoff: Boolean(r.handoff) });
  }

  if (c.status === 'closed') return json({ error: 'المحادثة مغلقة' }, 400);
  const text = clip(b?.text, 2000);
  if (!text) return json({ error: 'فارغة' }, 400);
  if (b?.keepBot && c.status === 'bot') {
    /* ردّ بجانب البوت: يدخل الرد والبوت يكمّل مع الرسالة الجاية */
    await addMessage(id, 'agent', text, { userId: u!.id });
  } else {
    /* الموظف يستلم: البوت يسكت في هذه المحادثة */
    await q("UPDATE chat_conversations SET status = 'human', assigned_to = COALESCE(assigned_to, ?) WHERE id = ?", [u!.id, id]);
    await addMessage(id, 'agent', text, { userId: u!.id });
  }
  await q('UPDATE notifications SET read_at = NOW() WHERE link = ? AND read_at IS NULL', [`/admin/chats/${id}`]);
  return json({ ok: true });
}
