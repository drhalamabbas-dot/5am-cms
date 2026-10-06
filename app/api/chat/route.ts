/* المحادثة من جهة الزائر (components/site/ChatWidget.tsx).

   GET  ?after=<آخر رقم رسالة>  ← الحالة والرسائل الجديدة (ردود الموظف تصل هكذا)
   POST { text, lang, page }    ← رسالة الزائر، وردّ البوت إن كانت مع البوت
   POST { handoff: { name, phone, email }, lang } ← «عايز أكلم موظف»

   عام بلا دخول، فالحدود هنا: 1000 حرف للرسالة، و20 رسالة كل 10 دقائق لكل
   محادثة، و10 محادثات جديدة في الساعة لكل عنوان. */
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { q, q1 } from '@/lib/db';
import { currentCustomer } from '@/lib/customerAuth';
import { findConv, addMessage, messages, notifyAgents } from '@/lib/chat/conv';
import { reply } from '@/lib/chat/bot';
import { getChatSettings } from '@/lib/chat/provider';
import { createRequest, ipHash, clip } from '@/lib/requests';
import { normPhone } from '@/lib/customers';
import { langOf } from '@/lib/chat/text';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (v: unknown, status = 200) => NextResponse.json(v, { status, headers: { 'Cache-Control': 'no-store' } });
const hits = new Map<string, number[]>();
function limited(key: string, max: number, ms: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < ms);
  if (list.length >= max) { hits.set(key, list); return true; }
  list.push(now); hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return false;
}
const L = (lang: 'ar' | 'en', ar: string, en: string) => (lang === 'ar' ? ar : en);

export async function GET(req: Request) {
  const s = await getChatSettings();
  if (!s.enabled) return json({ enabled: false });
  const acc = await currentCustomer();
  const conv = await findConv(acc);
  const after = Number(new URL(req.url).searchParams.get('after')) || 0;
  return json({
    enabled: true,
    greeting: s.greeting,
    status: conv?.status ?? null,
    account: acc ? { name: acc.name, email: acc.email, phone: acc.phone_norm } : null,
    messages: conv ? await messages(conv.id, after) : [],
  });
}

export async function POST(req: Request) {
  const s = await getChatSettings();
  if (!s.enabled) return json({ ok: false, error: 'off' }, 403);
  let b: any;
  try { b = JSON.parse((await req.text()).slice(0, 6000)); } catch { return json({ ok: false, error: 'format' }, 400); }
  /* لغة الصفحة — والرد نفسه بلغة ما كتبه العميل (تحت) */
  const pageLang: 'ar' | 'en' = b?.lang === 'en' ? 'en' : 'ar';
  let lang = pageLang;
  const h = await headers();
  const ip = ipHash((h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null);
  const acc = await currentCustomer();

  /* ------------------------------------------------------- طلب موظف */
  if (b?.handoff) {
    const conv = await findConv(acc);
    if (!conv) return json({ ok: false, error: 'none' }, 400);
    const name = clip(b.handoff.name, 120) ?? acc?.name ?? null;
    const phone = clip(b.handoff.phone, 40) ?? acc?.phone_norm ?? null;
    const email = clip(b.handoff.email, 160)?.toLowerCase() ?? acc?.email ?? null;
    if (!phone && !email) return json({ ok: false, error: 'contact' }, 400);
    if (phone && !normPhone(phone)) return json({ ok: false, error: 'phone' }, 400);
    if (conv.status === 'human') return json({ ok: true, already: true });
    /* آخر ما قاله في المحادثة يصل مع الطلب، فلا يُسأل من الأول */
    const last = await q<any>("SELECT role, text FROM chat_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 8", [conv.id]);
    const transcript = last.reverse().map((m) => `${m.role === 'user' ? 'العميل' : 'البوت'}: ${m.text}`).join('\n').slice(0, 3500);
    const reqId = await createRequest({
      kind: 'chat', name, phone: phone ? normPhone(phone) : null, email, company: null, city: null,
      message: transcript, items: [], source: 'chat', page: `/admin/chats/${conv.id}`, lang, ip: null,
    }, { notify: false });
    const r = await q1<any>('SELECT customer_id FROM requests WHERE id = ?', [reqId]);
    await q("UPDATE chat_conversations SET status = 'human', handoff_at = NOW(), customer_id = COALESCE(customer_id, ?) WHERE id = ?", [r?.customer_id ?? null, conv.id]);
    await addMessage(conv.id, 'system', L(lang, 'وصل طلبك لفريقنا — هيرد عليك موظف هنا في نفس المحادثة، أو يتصل بيك.',
      'Your request reached our team — someone will reply here in this chat or call you.'));
    await notifyAgents({ ...conv, assigned_to: null }, `عميل يطلب موظفًا في المحادثة: ${name ?? phone ?? email}`, transcript.split('\n').slice(-2).join(' · '));
    return json({ ok: true });
  }

  /* ------------------------------------------------------- رسالة */
  const text = clip(b?.text, 1000);
  /* عميل كتب بالعربي في الصفحة الإنجليزية (أو العكس): يُرد عليه بلغته */
  if (text) lang = langOf(text) ?? pageLang;
  if (!text) return json({ ok: false, error: 'empty' }, 400);
  const existing = await findConv(acc);
  if (!existing && limited(`new:${ip}`, 10, 3600_000)) return json({ ok: false, error: 'wait' }, 429);
  const conv = existing && existing.status !== 'closed' ? existing
    : await findConv(acc, { create: true, lang, page: clip(b?.page, 250), ipHash: ip });
  if (!conv) return json({ ok: false, error: 'none' }, 500);
  if (limited(`msg:${conv.id}`, 20, 600_000)) return json({ ok: false, error: 'wait' }, 429);

  const before = (await q1<any>('SELECT COALESCE(MAX(id), 0) n FROM chat_messages WHERE conversation_id = ?', [conv.id]))?.n ?? 0;
  const history = (await q<any>("SELECT role, text FROM chat_messages WHERE conversation_id = ? AND role IN ('user','bot') ORDER BY id DESC LIMIT 6", [conv.id])).reverse();
  await addMessage(conv.id, 'user', text);

  let handoff = false;
  if (conv.status === 'human' || s.provider === 'off') {
    /* مع موظف (أو بلا بوت): الرسالة له، والبوت يسكت */
    await notifyAgents(conv, `رسالة جديدة في المحادثة #${conv.id}`, text);
    if (conv.status !== 'human') {
      handoff = true;
      await addMessage(conv.id, 'bot', L(lang, 'اكتب اسمك ورقم موبايلك علشان فريقنا يرد عليك.', 'Please leave your name and mobile so our team can reply.'));
    }
  } else {
    const r = await reply(text, lang, history);
    handoff = Boolean(r.handoff);
    await addMessage(conv.id, 'bot', r.text, { source: r.source, cacheId: r.cacheId });
  }
  return json({ ok: true, handoff, status: conv.status, messages: await messages(conv.id, before) });
}
