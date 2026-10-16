/* =============================================================================
   مناقشة بين موديلنا والموديل الكبير — «يتعلّم بالنقد لا بالتقليد».

   التقليد وحده يعلّم الأسلوب: موديلنا يقرأ إجابات Qwen فيتكلّم مثلها. لكنه لا
   يتعلّم متى يسكت. وهذا بالضبط عيبه اليوم: يجيب بثقة عمّا لا يعرفه.

   هنا تجري الجولة على ثلاث خطوات:
     1) موديلنا يجيب على السؤال ومعه معلومات الموقع.
     2) الموديل الكبير يرى: السؤال، ومعلومات الموقع نفسها، وإجابة موديلنا —
        ويحكم: هل كل جملة مسنودة بمعلومات الموقع؟ هل اخترع؟ هل أجاب عن السؤال
        المسؤول عنه؟ هل أرشد العميل لخطوة تالية؟
     3) يكتب الإجابة الصحيحة، ويُسجَّل معها سبب الخطأ.

   الناتج درسٌ لا جوابًا فقط: الإجابة المصحّحة تدخل «للمراجعة»، وسبب الخطأ
   يظهر للمراجع كي يرى أين يخطئ الموديل. والمقبول منها هو تدريب الإصدار التالي.

   لا شيء من هذا يصل إلى زائر: الجولة تعمل من شاشة «تدريب البوت» وحدها.
============================================================================= */
import { q, q1 } from '../db';
import { search } from './kb';
import { normalize } from './text';
import { systemPrompt, guard as priceGuard } from './bot';
import { getChatSettings, complete, type Msg } from './provider';
import { recheck } from './quality';

/** موديلنا المحلّي حين لا يُضبط رابط في الإعدادات — Ollama على المنفذ المعتاد. */
const LOCAL_URL = 'http://127.0.0.1:11434/v1/chat/completions';
const LOCAL_MODEL = '5am-model:v0.1';

export type Lesson = {
  question: string;
  lang: 'ar' | 'en';
  /** إجابة موديلنا كما هي، قبل أي تصحيح */
  ours: string;
  /** حكم الموديل الكبير */
  verdict: 'ok' | 'invented' | 'off_topic' | 'weak';
  /** ما أمسكه الحَكم، بالعربية، سطرًا لكل مشكلة */
  problems: string[];
  /** الإجابة التي كان ينبغي أن تُقال */
  better: string;
  /** صفّ «للمراجعة» الذي حُفظ فيه الدرس */
  cacheId?: number;
};

/* --------------------------------------------------------- إجابة موديلنا */
async function askOurs(question: string, lang: 'ar' | 'en', sys: string): Promise<{ text?: string; error?: string }> {
  const s = await getChatSettings();
  const url = /^https?:\/\//.test(s.ownUrl) ? s.ownUrl : LOCAL_URL;
  const model = s.ownModel.trim() || LOCAL_MODEL;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60_000);
  try {
    const r = await fetch(url, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, temperature: 0.3, max_tokens: 400,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: question }],
      }),
    });
    if (!r.ok) return { error: `موديلنا لم يردّ (HTTP ${r.status}). تأكّد أن Ollama شغّال أو اضبط رابط موديلنا.` };
    const d: any = await r.json().catch(() => ({}));
    const text = String(d?.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return text ? { text } : { error: 'موديلنا ردّ فارغًا.' };
  } catch (e: any) {
    return { error: e?.name === 'AbortError' ? 'موديلنا تأخّر أكثر من دقيقة.' : 'تعذّر الاتصال بموديلنا (Ollama مش شغّال؟).' };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------- الحَكم */
function judgePrompt(lang: 'ar' | 'en'): string {
  return [
    'You are a strict reviewer training a small sales assistant for 5A&M (Egypt).',
    'You are given: the customer QUESTION, the SITE INFO that is the ONLY allowed source of facts, and the STUDENT ANSWER written by the small model.',
    '',
    'Judge the STUDENT ANSWER on these, in order of importance:',
    '1. GROUNDING — is every factual claim supported by SITE INFO? Any model name, number, specification, capability, warranty or availability that is NOT in SITE INFO is an invention, however plausible it sounds.',
    '2. HONESTY — if SITE INFO does not answer the question, the correct behaviour is to say so plainly and offer the team. Confidently answering anyway is the worst failure.',
    '3. ON TOPIC — did it answer THIS question, about THIS company? Drifting to unrelated industries (cars, turbines, generic advice) is a failure. So is answering a question that has nothing to do with the company instead of declining it.',
    '4. SELLING — does it name a specific fitting product when SITE INFO allows, give one concrete reason, and point to a next step (a quotation, or «موظف» / "agent")? Never prices.',
    '',
    'Be strict. These are failures even when the answer reads well:',
    '- a brand, model or product name that does not appear in SITE INFO,',
    '- a repeated or duplicated item in a list,',
    '- a capability stated with more certainty than SITE INFO supports.',
    '',
    'Then WRITE the answer that should have been given, obeying the same rules the student had:',
    lang === 'ar'
      ? '- بالعامية المصرية المهذبة، 100 كلمة كحدّ أقصى، أسطر قصيرة.'
      : '- Clear friendly English, at most 100 words, short lines.',
    '- Only facts from SITE INFO. No invented specs.',
    '- NEVER mention a price, and NEVER promise to send a price, a cost, availability or a delivery date — not even "we will send you the price". The ONLY correct move is to invite the customer to request a quotation, or to type «موظف» / "agent". Breaking this makes your own answer wrong.',
    '- If SITE INFO genuinely does not cover it, the better answer SAYS SO and offers the team. Do not fabricate a good-looking answer.',
    '',
    'Reply with ONLY a JSON object, no markdown fence, no commentary:',
    '{"verdict":"ok|invented|off_topic|weak","problems":["..."],"better":"..."}',
    '- verdict "ok" only when the student answer is grounded, honest, on topic and usable as is.',
    '- problems: short Arabic sentences naming exactly what went wrong. Empty array when verdict is "ok".',
  ].join('\n');
}

function parseJudge(raw: string): { verdict: Lesson['verdict']; problems: string[]; better: string } | null {
  const s = raw.replace(/```json|```/g, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    const j = JSON.parse(s.slice(a, b + 1));
    const better = String(j.better ?? '').trim();
    if (!better) return null;
    const v = ['ok', 'invented', 'off_topic', 'weak'].includes(j.verdict) ? j.verdict : 'weak';
    const problems = Array.isArray(j.problems) ? j.problems.map((p: any) => String(p).trim()).filter(Boolean).slice(0, 6) : [];
    return { verdict: v, problems, better };
  } catch { return null; }
}

/* ------------------------------------------------------------ جولة واحدة */
export async function debateOne(question: string, lang: 'ar' | 'en'): Promise<Lesson | { error: string }> {
  const docs = await search(question, lang, 5);
  const sys = systemPrompt(lang, docs);

  const mine = await askOurs(question, lang, sys);
  if (mine.error) return { error: mine.error };

  const s = await getChatSettings();
  const msgs: Msg[] = [
    { role: 'system', content: judgePrompt(lang) },
    {
      role: 'user',
      content: [
        `QUESTION:\n${question}`,
        `\nSITE INFO:\n${docs.map((d, i) => `[${i + 1}] ${d.title} — ${d.url}\n${d.text.slice(0, 900)}`).join('\n\n') || '(nothing relevant found)'}`,
        `\nSTUDENT ANSWER:\n${mine.text}`,
      ].join('\n'),
    },
  ];
  /* الحَكم لا يكون موديلنا نفسه: من يخطئ لا يصحّح لنفسه */
  const judgeSettings = { ...s, provider: s.provider === 'own' ? 'qwen' as const : s.provider };
  const r = await complete(msgs, judgeSettings);
  if (!r.ok) return { error: `الموديل الكبير لم يردّ: ${r.error}` };

  const parsed = parseJudge(r.text);
  if (!parsed) return { error: 'الحَكم ردّ بصيغة غير مفهومة.' };

  /* الإجابة المصحّحة تمرّ بفلتر الأسعار مثل أي ردّ يصل إلى عميل */
  const better = await priceGuard(parsed.better, lang);

  const lesson: Lesson = { question, lang, ours: mine.text!, verdict: parsed.verdict, problems: parsed.problems, better };
  lesson.cacheId = await store(lesson);
  return lesson;
}

/** يحفظ الدرس «للمراجعة». الموجود لا يُكرَّر.
 *
 *  ملاحظة على عمود issues: معناه «الإجابة المحفوظة فيها مشكلة». والمحفوظ هنا
 *  هو الإجابة *المصحّحة* لا إجابة موديلنا الخاطئة — فلو كُتب فيه نقدُ الإجابة
 *  الخاطئة لانقلب المعنى، واستُبعدت أنظفُ البيانات من التصدير لأن الحَكم عمل
 *  عمله. لذا يُفحص المحفوظ نفسه بالفحص التلقائي المعتاد، ويبقى النقد في ردّ
 *  الواجهة ليراه من يشغّل الجولة. */
async function store(l: Lesson): Promise<number | undefined> {
  const qn = normalize(l.question).slice(0, 1000);
  const had = await q1<any>("SELECT id FROM chat_cache WHERE lang = ? AND q_norm = ? AND status <> 'rejected'", [l.lang, qn]);
  if (had) return had.id;
  const r = await q(
    'INSERT INTO chat_cache (lang, question, q_norm, answer, source) VALUES (?,?,?,?,?)',
    [l.lang, l.question.slice(0, 1000), qn, l.better, 'debate']
  ) as unknown as { insertId: number };
  await recheck(r.insertId).catch(() => {});
  return r.insertId;
}

/** دفعة: يناقش حتى `count` سؤالًا، ويتوقّف عند أول فشل في الاتصال. */
export async function debateBatch(questions: { q: string; lang: 'ar' | 'en' }[], count: number) {
  const todo = questions.slice(0, Math.max(1, Math.min(10, count)));
  const out: { verdicts: Record<string, number>; done: number; error?: string } = { verdicts: {}, done: 0 };
  for (const it of todo) {
    const r = await debateOne(it.q, it.lang);
    if ('error' in r) { out.error = r.error; break; }
    out.verdicts[r.verdict] = (out.verdicts[r.verdict] ?? 0) + 1;
    out.done++;
  }
  return out;
}
