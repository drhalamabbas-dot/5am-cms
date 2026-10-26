/* محادثة من جهة الموظف (components/admin/AgentChat.tsx).
   GET ?after=            ← الرسائل الجديدة وحالة المحادثة (يتابع البوت والعميل مباشرةً).
   POST { text, keepBot } ← ردّ الموظف. keepBot=false (الافتراضي): الموظف يستلم والبوت يسكت.
                            keepBot=true: ردّ الموظف يدخل والبوت يكمّل بعده.
   POST { suggest: true } ← «اقتراح البوت»: ردّه على آخر رسالة للعميل بلا إرسال ولا حفظ. */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { q, q1 } from '@/lib/db';
import { addMessage, markRead, asFiles, type ChatFile } from '@/lib/chat/conv';
import { reply } from '@/lib/chat/bot';
import { langOf } from '@/lib/chat/text';
import { clip } from '@/lib/requests';

/** مسارٌ داخل مجلد الرفع وحده: بلا «..» ولا مسارات متفرّعة */
const MEDIA = /^media\/[a-z]+\/[A-Za-z0-9._-]+\.[a-z0-9]{2,4}$/;
const KIND: Record<string, ChatFile['kind']> = {
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', gif: 'image',
  mp4: 'video', webm: 'video',
  weba: 'audio', m4a: 'audio', ogg: 'audio', mp3: 'audio',
  pdf: 'file',
};

/** مرفقات ردّ الموظف: النوع يُقرأ من الامتداد لا ممّا يدّعيه المتصفّح. */
function cleanFiles(v: unknown): ChatFile[] {
  if (!Array.isArray(v)) return [];
  const out: ChatFile[] = [];
  for (const f of v.slice(0, 4)) {
    const url = String((f as any)?.url ?? '').replace(/^\//, '');
    if (!MEDIA.test(url)) continue;
    const kind = KIND[(url.split('.').pop() ?? '').toLowerCase()];
    if (!kind) continue;
    const n = (x: unknown) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.round(Number(x)) : null);
    out.push({
      url, kind,
      name: String((f as any)?.name ?? '').slice(0, 120) || null,
      bytes: n((f as any)?.bytes), w: n((f as any)?.w), h: n((f as any)?.h),
      /* مدّة الرسالة الصوتية: يحسبها المتصفّح عند التسجيل، وبها يُرسَم
         الشريط عند العميل بلا تحميل الملف كلّه أولًا */
      secs: n((f as any)?.secs),
    });
  }
  return out;
}

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
  const c = await q1<any>('SELECT c.id, c.status, c.assigned_to, c.cust_typing_at, u.name AS agent FROM chat_conversations c LEFT JOIN users u ON u.id = c.assigned_to WHERE c.id = ?', [id]);
  if (!c) return json({ error: 'غير موجودة' }, 404);
  const after = Number(new URL(req.url).searchParams.get('after')) || 0;
  /* اللمحة عن الرسالة المردود عليها تُجلب بالضمّ نفسه: الموظف يحتاج أن يرى
     على أيّ رسالةٍ ردّ العميل، كما يراها العميل. */
  const rows = await q<any>(
    `SELECT m.id, m.role, m.text, m.files, m.reply_to, m.source, m.created_at, m.read_at, u.name AS who,
            r.role AS q_role, r.text AS q_text, r.files AS q_files
       FROM chat_messages m
       LEFT JOIN users u ON u.id = m.user_id
       LEFT JOIN chat_messages r ON r.id = m.reply_to AND r.conversation_id = m.conversation_id
      WHERE m.conversation_id = ? AND m.id > ? ORDER BY m.id LIMIT 300`, [id, after]
  );
  /* عمود JSON قد يعود نصًّا بحسب إعداد السائق، فيُوحَّد شكله للواجهة */
  const messages = rows.map((m) => ({
    id: m.id, role: m.role, text: m.text, source: m.source, created_at: m.created_at,
    read_at: m.read_at, who: m.who,
    files: asFiles(m.files),
    reply: m.reply_to && m.q_role ? { id: m.reply_to, role: m.q_role, text: m.q_text, files: asFiles(m.q_files) } : null,
  }));
  /* فتحُ الموظف للمحادثة قراءةٌ لما كتبه العميل، فيرى العميل ✓✓ */
  if (messages.some((m) => m.role === 'user')) await markRead(id, 'agent');
  /* «العميل بيكتب»: تُحسَب هنا لا في المتصفّح كي لا تختلف الساعتان */
  const typing = Boolean(c.cust_typing_at && Date.now() - new Date(c.cust_typing_at).getTime() < 8000);
  return json({ status: c.status, assigned_to: c.assigned_to, agent: c.agent, typing, messages });
}

export async function POST(req: Request, ctx: Ctx) {
  const { u, res } = await guard();
  if (res) return res;
  const id = Number((await ctx.params).id);
  const c = await q1<any>('SELECT id, status, lang, assigned_to FROM chat_conversations WHERE id = ?', [id]);
  if (!c) return json({ error: 'غير موجودة' }, 404);
  let b: any = {};
  try { b = await req.json(); } catch { /* فارغ */ }

  /* ---------------------------------------------- نبضة «بيكتب الآن» */
  if (b?.typing) {
    await q('UPDATE chat_conversations SET agent_typing_at = NOW() WHERE id = ?', [id]);
    return json({ ok: true });
  }

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
  const text = clip(b?.text, 2000) ?? '';
  /* المرفقات: صورةُ القطعة أو عرضُ سعرٍ PDF يقولان ما لا تقوله فقرة. ترفع
     من مكتبة اللوحة (api/admin/media) وتُمرَّر مساراتها هنا، فتُفحَص كما
     تُفحَص مرفقات العميل — لا يُصدَّق مسارٌ يرسله المتصفّح. */
  const files = cleanFiles(b?.files);
  if (!text && !files.length) return json({ error: 'فارغة' }, 400);
  const replyTo = Number(b?.replyTo) > 0 ? Number(b.replyTo) : null;
  if (b?.keepBot && c.status === 'bot') {
    /* ردّ بجانب البوت: يدخل الرد والبوت يكمّل مع الرسالة الجاية */
    await addMessage(id, 'agent', text, { userId: u!.id, replyTo, files });
  } else {
    /* الموظف يستلم: البوت يسكت في هذه المحادثة */
    await q("UPDATE chat_conversations SET status = 'human', assigned_to = COALESCE(assigned_to, ?) WHERE id = ?", [u!.id, id]);
    await addMessage(id, 'agent', text, { userId: u!.id, replyTo, files });
  }
  /* الموظف أرسل، فقد قرأ: تُختَم رسائل العميل مقروءةً */
  await markRead(id, 'agent');
  await q('UPDATE notifications SET read_at = NOW() WHERE link = ? AND read_at IS NULL', [`/admin/chats/${id}`]);
  return json({ ok: true });
}
