/* تنبيهات الأدمن: الجرس في اللوحة يسأل هنا كل نصف دقيقة.
   ومع كل سؤال تُصعَّد الطلبات المتأخرة (lib/requests.ts) — فلا مهمة مجدولة. */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { escalateOverdue } from '@/lib/requests';
import { purgeExpired } from '@/lib/customers';
import { escalateChats } from '@/lib/chat/conv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (v: unknown, status = 200) => NextResponse.json(v, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  const u = await currentUser();
  if (!u) return json({ error: 'غير مصرّح' }, 401);
  await escalateOverdue().catch((e) => console.error('[notifications] التصعيد:', e));
  await escalateChats().catch((e) => console.error('[notifications] تصعيد المحادثات:', e));
  /* مرة في اليوم: مسح بيانات من انتهت مدة الاحتفاظ بها (lib/customers.ts) */
  await purgeExpired().catch((e) => console.error('[notifications] مدة الاحتفاظ:', e));
  const [items, count] = await Promise.all([
    q<any>(`SELECT id, kind, title, body, link, read_at, created_at FROM notifications
             WHERE user_id = ? ORDER BY id DESC LIMIT 15`, [u.id]),
    q1<{ n: number }>('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL', [u.id]),
  ]);
  return json({ unread: count?.n ?? 0, items });
}

/** { id } يعلّم تنبيهًا مقروءًا، و{ all: true } يعلّمها كلها */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return json({ error: 'غير مصرّح' }, 401);
  let b: any = {};
  try { b = await req.json(); } catch { /* فارغ */ }
  if (b?.all) await q('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [u.id]);
  else if (Number.isInteger(b?.id)) await q('UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL', [b.id, u.id]);
  return json({ ok: true });
}
