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

export type Conv = { id: number; status: string; lang: string | null; account_id: number | null; customer_id: number | null; assigned_to: number | null };

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
  return conv ? { id: conv.id, status: conv.status, lang: conv.lang, account_id: conv.account_id, customer_id: conv.customer_id, assigned_to: conv.assigned_to } : null;
}

export async function addMessage(convId: number, role: 'user' | 'bot' | 'agent' | 'system', text: string, extra: { userId?: number; source?: string | null; cacheId?: number } = {}) {
  const r = await q('INSERT INTO chat_messages (conversation_id, role, user_id, text, source, cache_id) VALUES (?,?,?,?,?,?)',
    [convId, role, extra.userId ?? null, text, extra.source ?? null, extra.cacheId ?? null]) as unknown as { insertId: number };
  await q(`UPDATE chat_conversations SET last_message_at = NOW()${role === 'user' ? ', unread_agent = unread_agent + 1' : role === 'agent' ? ', unread_agent = 0' : ''} WHERE id = ?`, [convId]);
  return r.insertId;
}

export async function messages(convId: number, after = 0, limit = 200) {
  return q<any>('SELECT id, role, text, created_at FROM chat_messages WHERE conversation_id = ? AND id > ? ORDER BY id LIMIT ?', [convId, after, limit]);
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
