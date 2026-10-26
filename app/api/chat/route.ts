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
import { findConv, addMessage, messages, markRead, notifyAgents, answerPending, type ChatFile } from '@/lib/chat/conv';
import { reply } from '@/lib/chat/bot';
import { readImages } from '@/lib/chat/vision';
import { hearVoice } from '@/lib/chat/hear';
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

/** دقائقُ صمتٍ بعدها يُعرَض المساعد على من ينتظر موظفًا. أربعٌ: أطولُ من
 *  تأخّرٍ عابر، وأقصرُ من أن يملّ المنتظر ويغلق الصفحة. */
const WAIT_MINS = 4;

const KINDS = new Set(['image', 'video', 'audio', 'file']);
/** مسارٌ داخل مجلد الرفع وحده: بلا «..» ولا مسارات متفرّعة */
const MEDIA = /^media\/[a-z]+\/[A-Za-z0-9._-]+\.[a-z0-9]{2,4}$/;
/**
 * المرفقات كما تُقبل: مسارٌ داخل media/ بامتدادٍ معروف، ونوعٌ من ثلاثة.
 *
 * ما يرسله المتصفّح لا يُصدَّق: الرفع يُرجع مسارًا، وقد يُرسَل غيره. فلو
 * قُبِل مسارٌ عشوائيّ لأمكن تعليق أي ملفٍ على الخادم في محادثة ويُعرَض منه.
 */
function cleanFiles(v: unknown, signedIn: boolean): ChatFile[] {
  if (!signedIn || !Array.isArray(v)) return [];
  const out: ChatFile[] = [];
  for (const f of v.slice(0, 4)) {
    const url = String((f as any)?.url ?? '').replace(/^\//, '');
    const kind = String((f as any)?.kind ?? '');
    /* media/<مجلد>/<اسم>.<امتداد> — بلا «..» ولا مسارات متفرّعة */
    if (!MEDIA.test(url)) continue;
    if (!KINDS.has(kind)) continue;
    const n = (x: unknown) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.round(Number(x)) : null);
    /* الملصق واللقطات مسارات كغيرها، تمرّ بنفس الفحص: لا يُصدَّق ما يرسله
       المتصفّح، وإلا عُلِّق أيُّ ملفٍ على الخادم في محادثة. */
    const path1 = (v: unknown) => {
      const p = String(v ?? '').replace(/^\//, '');
      return MEDIA.test(p) ? p : null;
    };
    out.push({
      url, kind: kind as ChatFile['kind'],
      name: String((f as any)?.name ?? '').slice(0, 120) || null,
      bytes: n((f as any)?.bytes), w: n((f as any)?.w), h: n((f as any)?.h), secs: n((f as any)?.secs),
      poster: path1((f as any)?.poster),
      frames: (Array.isArray((f as any)?.frames) ? (f as any).frames : [])
        .slice(0, 6).map(path1).filter(Boolean) as string[],
    });
  }
  return out;
}

/** وصفٌ نصّيّ للمرفقات، لتنبيه الموظف حين تأتي بلا كلام */
function describe(files: ChatFile[], lang: 'ar' | 'en') {
  const n = (k: string) => files.filter((f) => f.kind === k).length;
  const bits: string[] = [];
  if (n('image')) bits.push(L(lang, `${n('image')} صورة`, `${n('image')} image(s)`));
  if (n('video')) bits.push(L(lang, `${n('video')} فيديو`, `${n('video')} video(s)`));
  if (n('audio')) bits.push(L(lang, 'رسالة صوتية', 'a voice message'));
  return bits.length ? L(lang, `بعت ${bits.join(' و')}`, `Sent ${bits.join(' and ')}`) : '';
}

export async function GET(req: Request) {
  const s = await getChatSettings();
  if (!s.enabled) return json({ enabled: false });
  const acc = await currentCustomer();
  const conv = await findConv(acc);
  const after = Number(new URL(req.url).searchParams.get('after')) || 0;
  const rows = conv ? await messages(conv.id, after) : [];
  /* فتحُ الصفحة قراءةٌ: ما وصله من ردود صار مقروءًا، فيراه الموظف كذلك */
  if (conv && rows.some((m) => m.role !== 'user')) await markRead(conv.id, 'cust');

  /* «بيكتب الآن»: نبضةٌ عمرها ثوانٍ. تُحسَب هنا لا في المتصفّح كي لا تختلف
     الساعتان فتبقى معلّقةً إلى الأبد. */
  const typing = Boolean(conv?.agent_typing_at && Date.now() - new Date(conv.agent_typing_at).getTime() < 8000);

  /* انتظارٌ بلا ردّ: العميل طلب موظفًا وكتب، ومضت دقائق ولم يردّ أحد — وهو
     ما يحدث بالليل وفي الإجازات. فيُعرَض عليه المساعد ريثما يفرغ أحدهم،
     بدل أن يُترَك أمام شاشةٍ صامتة فيغلقها.

     ويُقاس بآخر رسالةٍ فعلًا لا بساعات عملٍ مكتوبة: الساعاتُ تكذب حين
     يتأخّر الموظف داخلها، وآخرُ رسالةٍ لا تكذب. */
  let waiting = 0;
  if (conv && conv.status === 'human' && !typing) {
    const last = await q1<any>(
      "SELECT role, created_at FROM chat_messages WHERE conversation_id = ? AND role IN ('user','agent') ORDER BY id DESC LIMIT 1",
      [conv.id]
    );
    if (last?.role === 'user') {
      const mins = Math.floor((Date.now() - new Date(last.created_at).getTime()) / 60000);
      if (mins >= WAIT_MINS) waiting = mins;
    }
  }

  return json({
    enabled: true,
    greeting: s.greeting,
    status: conv?.status ?? null,
    typing,
    /* دقائقُ انتظارٍ بلا ردّ — تعرضها الواجهة وتعرض معها المساعد */
    waiting,
    /* تخبر الواجهة أن تطلب الدخول قبل الكتابة. والمنع نفسه في POST تحت. */
    requireLogin: s.requireLogin,
    account: acc ? { name: acc.name, email: acc.email, phone: acc.phone_norm } : null,
    messages: rows,
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

  /* المحادثة مقصورة على أصحاب الحسابات: المنع هنا لا في الواجهة وحدها، فمن
     يرسل للـ API مباشرةً يُمنع كذلك. */
  if (s.requireLogin && !acc) return json({ ok: false, error: 'login' }, 401);

  /* ---------------------------------------------- نبضة «العميل بيكتب»

     تُكتب ولا تُعيد شيئًا: هي أخفُّ ما يُرسَل، وتُطلَب مرّةً كل أربع ثوانٍ
     على الأكثر مهما كتب. ولا تُنشئ محادثةً: من لم يبدأ بعدُ لا يُكتَب له
     صفٌّ لأنه لمس لوحة المفاتيح. */
  if (b?.typing) {
    const conv = await findConv(acc);
    if (conv) await q('UPDATE chat_conversations SET cust_typing_at = NOW() WHERE id = ?', [conv.id]);
    return json({ ok: true });
  }

  /* ------------------------------------------- «اسأل المساعد» أثناء الانتظار

     العميل طلب موظفًا ولم يردّ أحد، فاختار المساعد ريثما يفرغون. تعود
     المحادثة إلى البوت ويُجيب عن سؤاله المعلّق — فلا يُعيد كتابته.

     ولا يُلغى طلبه: الموظف يرى المحادثة كما هي ويستلمها متى شاء، والعميل
     يطلبه ثانيةً بزرّه. */
  if (b?.toBot) {
    const conv = await findConv(acc);
    if (!conv) return json({ ok: false, error: 'none' }, 400);
    if (conv.status !== 'human') return json({ ok: true, already: true });
    const before = (await q1<any>('SELECT COALESCE(MAX(id), 0) n FROM chat_messages WHERE conversation_id = ?', [conv.id]))?.n ?? 0;
    await q("UPDATE chat_conversations SET status = 'bot' WHERE id = ?", [conv.id]);
    await addMessage(conv.id, 'system', L(lang,
      'رجّعناك للمساعد الآلي لحد ما حد من الفريق يفضى. اضغط «كلّم موظف» في أي وقت.',
      "You're back with the assistant until someone from our team is free. Tap “Talk to a person” any time."));
    const said = await answerPending(conv.id, lang);
    return json({ ok: true, answered: Boolean(said), status: 'bot', messages: await messages(conv.id, before) });
  }

  /* ------------------------------------------------------- طلب موظف */
  if (b?.handoff) {
    /* تُنشأ إن لم تكن: العميل قد يطلب موظفًا من أول ضغطةٍ قبل أن يكتب شيئًا —
       وهو ما يفعله زرّ «كلّم موظف» في بداية المحادثة. */
    const conv = (await findConv(acc))
      ?? (await findConv(acc, { create: true, lang, page: clip(b?.page, 250), ipHash: ip }));
    if (!conv) return json({ ok: false, error: 'none' }, 400);
    const name = clip(b.handoff.name, 120) ?? acc?.name ?? null;
    const phone = clip(b.handoff.phone, 40) ?? acc?.phone_norm ?? null;
    const email = clip(b.handoff.email, 160)?.toLowerCase() ?? acc?.email ?? null;
    if (!phone && !email) return json({ ok: false, error: 'contact' }, 400);
    if (phone && !normPhone(phone)) return json({ ok: false, error: 'phone' }, 400);
    if (conv.status === 'human') return json({ ok: true, already: true });
    /* آخر ما قاله في المحادثة يصل مع الطلب، فلا يُسأل من الأول */
    const last = await q<any>("SELECT role, text FROM chat_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 8", [conv.id]);
    const transcript = last.reverse().map((m) => `${m.role === 'user' ? 'العميل' : 'البوت'}: ${m.text}`).join('\n').slice(0, 3500)
      /* طلبٌ من أول ضغطة: لا كلام بعدُ، فيُقال ذلك بدل نصٍّ فارغ يحيّر الموظف */
      || L(lang, 'طلب موظفًا من أول المحادثة، قبل أن يكتب شيئًا.', 'Asked for a person at the start, before writing anything.');
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
  /* المرفقات: ما رفعه العميل لتوّه عبر api/chat/upload. تُنظَّف هنا ولا
     يُصدَّق ما يرسله المتصفّح كما هو — المسار لا بد أن يكون داخل media/.
     والملفات لأصحاب الحسابات: مرفقٌ بلا صاحبٍ معروف لا يُقبل. */
  const files = cleanFiles(b?.files, Boolean(acc));
  /* عميل كتب بالعربي في الصفحة الإنجليزية (أو العكس): يُرد عليه بلغته */
  if (text) lang = langOf(text) ?? pageLang;
  /* صورةٌ وحدها رسالةٌ صحيحة، فالفراغ إنما هو خلوّها من الاثنين */
  if (!text && !files.length) return json({ ok: false, error: 'empty' }, 400);
  const existing = await findConv(acc);
  if (!existing && limited(`new:${ip}`, 10, 3600_000)) return json({ ok: false, error: 'wait' }, 429);
  const conv = existing && existing.status !== 'closed' ? existing
    : await findConv(acc, { create: true, lang, page: clip(b?.page, 250), ipHash: ip });
  if (!conv) return json({ ok: false, error: 'none' }, 500);
  if (limited(`msg:${conv.id}`, 20, 600_000)) return json({ ok: false, error: 'wait' }, 429);

  /* المرفقات للموظف وحده. المساعد يقرأ الكلام لا الصور ولا الصوت، فقبولها
     منه يوهم العميل أنها وصلت وفُهمت ثم يردّ على ما لم يره. والواجهة تخفي
     الأزرار، وهذا يمنع ما يُرسَل من حولها. وحين لا بوت أصلًا (provider=off)
     فالرسالة للموظف على كل حال، فتُقبل — كما في الفرع تحت. */
  if (files.length && conv.status !== 'human' && s.provider !== 'off') {
    return json({ ok: false, error: 'noFiles' }, 400);
  }

  const before = (await q1<any>('SELECT COALESCE(MAX(id), 0) n FROM chat_messages WHERE conversation_id = ?', [conv.id]))?.n ?? 0;
  const history = (await q<any>("SELECT role, text FROM chat_messages WHERE conversation_id = ? AND role IN ('user','bot') ORDER BY id DESC LIMIT 6", [conv.id])).reverse();
  const replyTo = Number(b?.replyTo) > 0 ? Number(b.replyTo) : null;
  await addMessage(conv.id, 'user', text ?? '', { files, replyTo });

  /* ما يصف المرفقات حين لا نصّ معها: للتنبيه وللبوت، لا يُكتب في المحادثة */
  const said = text || describe(files, lang);

  let handoff = false;
  if (conv.status === 'human' || s.provider === 'off') {
    /* مع موظف (أو بلا بوت): الرسالة له، والبوت يسكت */
    await notifyAgents(conv, `رسالة جديدة في المحادثة #${conv.id}`, said);
    if (conv.status !== 'human') {
      handoff = true;
      await addMessage(conv.id, 'bot', L(lang, 'اكتب اسمك ورقم موبايلك علشان فريقنا يرد عليك.', 'Please leave your name and mobile so our team can reply.'));
    }
  } else if (files.some((f) => f.kind === 'image' || (f.kind === 'video' && f.frames?.length))) {
    /* صورة — أو لقطاتُ فيديو استخرجها المتصفّح: تُقرأ ويُقال ما فيها. وما لا
       يُقرأ لا يُدَّعى — إن تعذّر، تُقال الحقيقة ويُنبَّه موظفٌ يراه بعينه. */
    const imgs = files.flatMap((f) =>
      f.kind === 'image' ? [f.url] : f.kind === 'video' ? (f.frames ?? []) : []);
    const isClip = files.some((f) => f.kind === 'video');
    const v = await readImages(imgs, text ?? '', lang, { clip: isClip });
    if (v.ok) {
      /* خطوتان: العينُ تتعرّف، وبوت المبيعات يبيع. فهو وحده يعرف الكتالوج
         والصفحات، وردُّه يمرّ على فلتر الأسعار — وموديلُ الرؤية لا يرى شيئًا
         من ذلك، فلو باع لباع من خياله.

         ولا يُحفظ في الذاكرة: مفتاحُها نصُّ السؤال، وصورتان مختلفتان قد
         يتشابه وصفُهما فيُردّ عن صورةٍ بجواب أخرى. */
      const seen = L(lang, `العميل بعت ${isClip ? 'فيديو' : 'صورة'}، واللي فيه: ${v.text}`,
        `The customer sent ${isClip ? 'a video' : 'a photo'} showing: ${v.text}`);
      const ask = L(lang,
        `${seen}\n\nوسؤاله: ${text || '(ما كتبش سؤال)'}\n\nردّ عليه كبائع: ابدأ بسطر واحد يقول اللي إنت شايفه، وبعدين قول إحنا بنوفّر إيه ليه بالظبط من اللي عندنا (موديل أو قطعة أو خدمة صيانة)، واعرض عليه عرض سعر.`,
        `${seen}\n\nTheir question: ${text || '(none written)'}\n\nReply as a salesperson: open with one line on what you see, then say exactly what we can offer for it from our range (a model, a part, or a service), and offer a quote.`);
      const sale = await reply(ask, lang, history, { dryRun: true });
      await addMessage(conv.id, 'bot', sale.text || v.text, { source: sale.source ?? 'vision' });
      handoff = Boolean(sale.handoff);
    } else {
      await addMessage(conv.id, 'bot', L(lang,
        'وصلتني الصورة بس ما قدرتش أقراها دلوقتي. وصّلت الموضوع لفريقنا وهيشوفها بنفسه ويرد عليك — أو اكتبلي اللي شايفه فيها.',
        "The photo arrived but I couldn't read it right now. I've passed it to our team to look at it themselves — or tell me what you see in it."));
      await notifyAgents(conv, `صورة في المحادثة #${conv.id} تعذّر قراءتها`, said);
    }
  } else if (files.some((f) => f.kind === 'audio')) {
    /* رسالة صوتية: تُسمَع فتصير نصًّا، ويردّ عليها بوت المبيعات كأنها كُتبت.
       وما لا يُسمَع لا يُخمَّن — يُسلَّم لموظفٍ يسمعها بنفسه. */
    const clip = files.find((f) => f.kind === 'audio')!;
    const heard = await hearVoice(clip.url, lang);
    if (heard.ok) {
      const q = [text, heard.text].filter(Boolean).join('\n');
      const sale = await reply(q, lang, history, { dryRun: true });
      if (sale.handoff) handoff = true;
      await addMessage(conv.id, 'bot',
        L(lang, `سمعتك بتقول: «${heard.text}»\n\n${sale.text}`, `I heard: “${heard.text}”\n\n${sale.text}`),
        { source: sale.source ?? 'hear' });
    } else {
      await addMessage(conv.id, 'bot', L(lang,
        'وصلتني الرسالة الصوتية بس ما قدرتش أسمعها كويس. وصّلتها لفريقنا وحد هيسمعها ويرد عليك — أو اكتبلي اللي عايزه.',
        "Your voice message arrived but I couldn't make it out. I've passed it to our team to listen and reply — or write what you need."));
      await notifyAgents(conv, `رسالة صوتية في المحادثة #${conv.id}`, said);
    }
  } else if (!text && files.length) {
    /* فيديو بلا لقطات، أو ملف: البوت لا يفتحها، فادّعاء الفهم كذب.
       يُسلَّم لموظفٍ يفتحها بعينه بدل ردٍّ مخترَع عمّا لم يُقرأ. */
    await addMessage(conv.id, 'bot', L(lang,
      'وصلتني، بس أنا ما بفتحش الملفات دي. اكتبلي سؤالك معاها، أو اضغط «كلّم موظف» وحد من فريقنا يفتحها ويرد عليك.',
      "Got it — but I can't open these files. Write your question with it, or tap “Talk to a person” and someone from our team will open it and reply."));
    await notifyAgents(conv, `مرفق في المحادثة #${conv.id}`, said);
  } else {
    const r = await reply(text!, lang, history);
    handoff = Boolean(r.handoff);
    await addMessage(conv.id, 'bot', r.text, { source: r.source, cacheId: r.cacheId });
  }
  return json({ ok: true, handoff, status: conv.status, messages: await messages(conv.id, before) });
}
