/* =============================================================================
   محادثة الزائر: تُعرف بكوكي في متصفحه (5am_chat — يُحفظ في القاعدة بصمته
   فقط)، أو بحسابه لو داخل (فيكمّل من أي جهاز). لا كوكي قبل أول رسالة.

   حين يطلب موظفًا تصير المحادثة «مع موظف»: البوت يسكت، ويصل تنبيه لمن عنده
   «الرد على محادثات العملاء» — أو للمسؤول عنها وحده لو استلمها أحد.
============================================================================= */
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { q, q1 } from '../db';
import { can } from '../permissions';
import type { Account } from '../customerAuth';

const COOKIE = '5am_chat';
const hash = (t: string) => createHash('sha256').update(t).digest('hex');

export type Conv = {
  id: number; status: string; lang: string | null;
  account_id: number | null; customer_id: number | null; assigned_to: number | null;
  /* آخر نبضةٍ كتبها الموظف وهو يكتب — يُبنى منها «بيكتب الآن» */
  agent_typing_at?: string | Date | null;
};

/** المحادثة الحالية: بالحساب أولًا، ثم بكوكي المتصفح. create = تُنشأ لو غير موجودة */
export async function findConv(acc: Account | null, opts?: { create?: boolean; lang?: string; page?: string | null; ipHash?: string | null }): Promise<Conv | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  let conv: any = null;
  if (token && /^[a-f0-9]{48}$/.test(token)) conv = await q1<any>('SELECT * FROM chat_conversations WHERE token_hash = ?', [hash(token)]);
  if (acc) {
    if (conv && !conv.account_id) {
      /* الزائر سجّل دخوله: محادثة متصفحه تصير محادثة حسابه */
      await q('UPDATE chat_conversations SET account_id = ?, customer_id = COALESCE(customer_id, ?) WHERE id = ?', [acc.id, acc.customer_id, conv.id]);
      conv.account_id = acc.id;
    } else if (!conv || conv.account_id !== acc.id) {
      conv = await q1<any>("SELECT * FROM chat_conversations WHERE account_id = ? ORDER BY (status <> 'closed') DESC, last_message_at DESC LIMIT 1", [acc.id]) ?? null;
    }
  }
  if (conv && conv.status === 'closed' && opts?.create) conv = null;   // المغلقة لا تُكمل: تبدأ جديدة
  if (!conv && opts?.create) {
    const t = randomBytes(24).toString('hex');
    const r = await q(
      'INSERT INTO chat_conversations (token_hash, account_id, customer_id, lang, page, ip_hash, last_message_at) VALUES (?,?,?,?,?,?, NOW())',
      [hash(t), acc?.id ?? null, acc?.customer_id ?? null, opts.lang ?? null, opts.page ?? null, opts.ipHash ?? null]
    ) as unknown as { insertId: number };
    jar.set(COOKIE, t, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 180 * 86400 });
    conv = await q1<any>('SELECT * FROM chat_conversations WHERE id = ?', [r.insertId]);
  }
  /* تُنتقى الحقول ولا يُمرَّر الصفُّ كما هو: فيه token_hash وip_hash ولا
     شأن لمن يستدعي بهما. وكلُّ حقلٍ جديدٍ يُحتاج يُضاف هنا صراحةً. */
  return conv ? {
    id: conv.id, status: conv.status, lang: conv.lang,
    account_id: conv.account_id, customer_id: conv.customer_id, assigned_to: conv.assigned_to,
    agent_typing_at: conv.agent_typing_at ?? null,
  } : null;
}

/** مرفق في رسالة: صورة أو فيديو أو رسالة صوتية. */
export type ChatFile = {
  url: string; kind: 'image' | 'video' | 'audio' | 'file';
  name?: string | null; bytes?: number | null;
  w?: number | null; h?: number | null; secs?: number | null;
  /** للفيديو: صورةٌ تُعرَض قبل التشغيل، ولقطاتٌ يقرؤها البوت ولا تُعرَض.
   *  المتصفّح يستخرجها — الخادم لا يفكّ ترميز الفيديو بلا ffmpeg. */
  poster?: string | null;
  frames?: string[];
};

export async function addMessage(
  convId: number, role: 'user' | 'bot' | 'agent' | 'system', text: string,
  extra: { userId?: number; source?: string | null; cacheId?: number; files?: ChatFile[]; replyTo?: number | null } = {}
) {
  const files = extra.files?.length ? JSON.stringify(extra.files) : null;
  /* الردّ على رسالةٍ من محادثةٍ أخرى لا معنى له، ويكشف نصَّها لغير صاحبها */
  const replyTo = extra.replyTo
    ? (await q1<any>('SELECT id FROM chat_messages WHERE id = ? AND conversation_id = ?', [extra.replyTo, convId]))?.id ?? null
    : null;
  const r = await q('INSERT INTO chat_messages (conversation_id, role, user_id, text, files, reply_to, source, cache_id) VALUES (?,?,?,?,?,?,?,?)',
    [convId, role, extra.userId ?? null, text, files, replyTo, extra.source ?? null, extra.cacheId ?? null]) as unknown as { insertId: number };
  await q(`UPDATE chat_conversations SET last_message_at = NOW()${role === 'user' ? ', unread_agent = unread_agent + 1' : role === 'agent' ? ', unread_agent = 0' : ''} WHERE id = ?`, [convId]);
  return r.insertId;
}

/**
 * رسائل المحادثة، ومعها لمحةٌ عن الرسالة المردود عليها.
 *
 * اللمحة تُجلب بضمٍّ واحد لا بطلبٍ لكل ردّ: محادثةٌ فيها عشرون ردًّا لا
 * تُكلِّف عشرين رحلةً إلى القاعدة.
 */
export async function messages(convId: number, after = 0, limit = 200) {
  const rows = await q<any>(
    `SELECT m.id, m.role, m.text, m.files, m.reply_to, m.created_at, m.read_at,
            r.role AS q_role, r.text AS q_text, r.files AS q_files
       FROM chat_messages m
       LEFT JOIN chat_messages r ON r.id = m.reply_to AND r.conversation_id = m.conversation_id
      WHERE m.conversation_id = ? AND m.id > ? ORDER BY m.id LIMIT ?`,
    [convId, after, limit]
  );
  /* mysql2 يفكّ عمود JSON وحده، وقد يعيده نصًّا بحسب الإعداد — فيُوحَّد هنا
     كي لا تتعامل الواجهة مع شكلين. */
  return rows.map((m) => ({
    id: m.id, role: m.role, text: m.text, created_at: m.created_at, read_at: m.read_at,
    files: asFiles(m.files),
    reply: m.reply_to && m.q_role
      ? { id: m.reply_to, role: m.q_role, text: m.q_text, files: asFiles(m.q_files) }
      : null,
  }));
}

export function asFiles(v: unknown): ChatFile[] {
  if (!v) return [];
  if (Array.isArray(v)) return v as ChatFile[];
  if (typeof v !== 'string') return [];
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
}

/**
 * «قرأتُ إلى هنا» على المحادثة، لا صفٌّ لكل رسالةٍ تُقرأ.
 *
 * ويُختم read_at على رسائل الطرف الآخر وحدها: علامةُ القراءة تُقال لمن كتب،
 * وقارئُ رسالته هو الآخر.
 */
/**
 * كم رسالةً تنتظر العميل ولم يقرأها.
 *
 * تُحسَب من read_at لا من عدّادٍ يُزاد ويُصفَّر: العدّاد يختلّ إن فُتحت
 * المحادثة في جهازين، وهذا لا يختلّ.
 */
export async function unreadForCustomer(accountId: number): Promise<number> {
  const r = await q1<{ n: number }>(
    `SELECT COUNT(*) n FROM chat_messages m
       JOIN chat_conversations c ON c.id = m.conversation_id
      WHERE c.account_id = ? AND m.read_at IS NULL AND m.role IN ('agent','bot')`,
    [accountId]
  );
  return Number(r?.n ?? 0);
}

export async function markRead(convId: number, who: 'cust' | 'agent') {
  const col = who === 'cust' ? 'cust_read_at' : 'agent_read_at';
  const theirs = who === 'cust' ? "('bot','agent','system')" : "('user')";
  await q(`UPDATE chat_conversations SET ${col} = NOW() WHERE id = ?`, [convId]);
  await q(`UPDATE chat_messages SET read_at = NOW()
            WHERE conversation_id = ? AND read_at IS NULL AND role IN ${theirs}`, [convId]);
}

/**
 * يجيب البوت على آخر سؤال لم يُجَب في المحادثة.
 *
 * يُستدعى حين يُعيد الموظف المحادثة إلى البوت: في وضع الموظف يصمت البوت عمدًا
 * كي لا يقاطع، فإن كتب العميل ولم يردّ الموظف ثم أعادها، بقي السؤال معلّقًا
 * بلا جواب والعميل ينتظر. وقد حدث فعلًا في المحادثة #1.
 *
 * ولا يفعل شيئًا إن كان آخر كلام في المحادثة ردًّا أصلًا.
 */
export async function answerPending(convId: number, lang: 'ar' | 'en') {
  const last = await q1<any>(
    "SELECT role, text FROM chat_messages WHERE conversation_id = ? AND role IN ('user','bot','agent') ORDER BY id DESC LIMIT 1", [convId]);
  if (last?.role !== 'user' || !String(last.text ?? '').trim()) return false;

  const history = (await q<any>(
    "SELECT role, text FROM chat_messages WHERE conversation_id = ? AND role IN ('user','bot') ORDER BY id DESC LIMIT 6", [convId]))
    .reverse().slice(0, -1);          // بلا السؤال نفسه، فهو يُمرَّر وحده

  const { reply } = await import('./bot');
  try {
    const r = await reply(String(last.text), lang, history);
    await addMessage(convId, 'bot', r.text, { source: r.source, cacheId: r.cacheId });
    return true;
  } catch (e) {
    console.error('[chat] تعذّر الردّ على السؤال المعلّق:', e);
    return false;
  }
}

/** تنبيه الموظفين بمحادثة: المسؤول عنها وحده لو موجود، وإلا كل من يرد على المحادثات.
    لا يتكرّر لمن عنده تنبيه غير مقروء بالمحادثة نفسها. */
export async function notifyAgents(conv: Conv, title: string, body: string) {
  const link = `/admin/chats/${conv.id}`;
  let targets: number[];
  if (conv.assigned_to) targets = [conv.assigned_to];
  else {
    const users = await q<any>('SELECT id, role, perms, active FROM users WHERE active = 1');
    targets = users.filter((u) => can({ role: u.role, perms: typeof u.perms === 'string' ? JSON.parse(u.perms) : u.perms, active: u.active }, 'chat.handle')).map((u) => u.id);
  }
  for (const uid of targets) {
    const had = await q1('SELECT id FROM notifications WHERE user_id = ? AND link = ? AND read_at IS NULL', [uid, link]);
    if (had) continue;
    await q('INSERT INTO notifications (user_id, kind, title, body, link) VALUES (?,?,?,?,?)', [uid, 'chat', title.slice(0, 250), body.slice(0, 480), link]);
  }
}

/** محادثة «مع الفريق» فيها رسالة من العميل بلا رد خلال 5 دقائق: تنبيه للسوبر أدمن،
    مرة لكل انتظار (لا يتكرّر وتنبيهه السابق لم يُقرأ). يُفحص مع سؤال الجرس. */
export async function escalateChats() {
  const late = await q<any>(
    `SELECT c.id FROM chat_conversations c
      WHERE c.status = 'human' AND c.unread_agent > 0 AND c.last_message_at < NOW() - INTERVAL 5 MINUTE
        AND NOT EXISTS (SELECT 1 FROM chat_messages m WHERE m.conversation_id = c.id AND m.role = 'agent' AND m.id > (
              SELECT COALESCE(MAX(u.id), 0) FROM chat_messages u WHERE u.conversation_id = c.id AND u.role = 'user'))
      LIMIT 20`
  );
  if (!late.length) return;
  const supers = await q<any>("SELECT id FROM users WHERE active = 1 AND role = 'super'");
  for (const c of late) {
    const link = `/admin/chats/${c.id}`;
    for (const s of supers) {
      const had = await q1('SELECT id FROM notifications WHERE user_id = ? AND link = ? AND read_at IS NULL', [s.id, link]);
      if (had) continue;
      await q('INSERT INTO notifications (user_id, kind, title, body, link) VALUES (?,?,?,?,?)',
        [s.id, 'chat.late', `عميل ينتظر ردًّا في المحادثة #${c.id} منذ أكثر من 5 دقائق`, 'لم يرد أحد من الفريق بعد — رد أو حوّلها لموظف.', link]);
    }
  }
}

export const CHAT_STATUS: Record<string, [string, string]> = {
  bot: ['مع البوت', ''], human: ['مع موظف', 'tag--todo'], closed: ['مغلقة', 'tag--off'],
};
