/* بيانات تدريب موديلنا: كل سؤال وجواب «مقبول» بصيغة المحادثة (JSONL) التي
   يفهمها دفتر Colab — وبنفس رسالة النظام ومعلومات الموقع التي يأخذها الموديل
   وهو يعمل، فيتعلّم أن يجيب من الموقع لا من خياله. لمن عنده «تدريب البوت»،
   وكل تصدير في السجل. لا بيانات عملاء فيها: أسئلة وأجوبة فقط. */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { q } from '@/lib/db';
import { audit } from '@/lib/audit';
import { search } from '@/lib/chat/kb';
import { systemPrompt } from '@/lib/chat/bot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });
  if (!can(u, 'chat.train')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: 403 });
  /* ?include=checked: المقبول + الجديد السليم في الفحص التلقائي — للتدريب التجريبي فقط */
  const checked = new URL(req.url).searchParams.get('include') === 'checked';
  const rows = await q<any>(checked
    ? "SELECT lang, question, answer FROM chat_cache WHERE status = 'approved' OR (status = 'new' AND issues IS NULL) ORDER BY id"
    : "SELECT lang, question, answer FROM chat_cache WHERE status = 'approved' ORDER BY id");
  const lines: string[] = [];
  for (const r of rows) {
    const lang = r.lang === 'en' ? 'en' : 'ar';
    const docs = await search(r.question, lang, 5);
    lines.push(JSON.stringify({ messages: [
      { role: 'system', content: systemPrompt(lang, docs) },
      { role: 'user', content: r.question },
      { role: 'assistant', content: r.answer },
    ] }));
  }
  await audit(u, 'chat.export', { entity: 'chat_cache', summary: `${rows.length} سؤال وجواب${checked ? ' (تجريبي: مقبول + سليم تلقائيًا)' : ''}` });
  return new NextResponse(lines.join('\n') + '\n', {
    headers: {
      'Content-Type': 'application/jsonl; charset=utf-8',
      'Content-Disposition': `attachment; filename="5am-chat-train-${new Date().toISOString().slice(0, 10)}.jsonl"`,
      'Cache-Control': 'no-store',
    },
  });
}
