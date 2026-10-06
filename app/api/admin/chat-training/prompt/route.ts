/* رسالة النظام التي يرسلها الموقع للموديل عن سؤال معيّن (معلومات الموقع المناسبة +
   القواعد) — لتقييم موديلنا بنفس ما سيأخذه وهو يعمل. لمن عنده «تدريب البوت».
   GET ?q=<السؤال>&lang=ar|en */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { search } from '@/lib/chat/kb';
import { systemPrompt } from '@/lib/chat/bot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || !can(u, 'chat.train')) return NextResponse.json({ error: 'ليست لديك صلاحية' }, { status: u ? 403 : 401 });
  const sp = new URL(req.url).searchParams;
  const question = (sp.get('q') ?? '').slice(0, 1000);
  const lang = sp.get('lang') === 'en' ? 'en' : 'ar';
  const docs = await search(question, lang, 5);
  return NextResponse.json({ messages: [{ role: 'system', content: systemPrompt(lang, docs) }, { role: 'user', content: question }] },
    { headers: { 'Cache-Control': 'no-store' } });
}
