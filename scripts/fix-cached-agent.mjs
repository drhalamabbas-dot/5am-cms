/* =============================================================================
   يصلح ما حُفظ في ذاكرة البوت من ردودٍ تقول «اكتب موظف».

   الزرّ صار أمام العميل، والتعليمات نُهيت عن توجيهه إلى كتابة كلمة. لكن ما
   حُفظ قبل ذلك يُصرَف كما هو من الذاكرة بلا مرورٍ بالموديل، فيبقى يقول له
   «اكتب» إلى الأبد. فيُستبدَل هنا بما يقوله الفلتر اليوم.

   node scripts/fix-cached-agent.mjs   ← تشغيله ثانيةً لا يغيّر شيئًا
============================================================================= */
import { connect, log } from './lib.mjs';

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];

/* النمط نفسه الذي في lib/chat/bot.ts — ولو تغيّر هناك يُحدَّث هنا */
const TYPE_AGENT =
  /(?:اكتب|أكتب|ابعت|اب[عـ]تلي|اكتبلي|قول|ارسل|أرسل)\s*(?:كلمة\s*)?[«"'“]?\s*(?:موظف|مندوب|ادمن|أدمن)\s*[»"'”]?|(?:type|write|send|say)\s+(?:the\s+word\s+)?["'“]?\s*(?:agent|human|staff|support)\s*["'”]?/gi;

const rows = await q('SELECT id, answer FROM chat_cache WHERE answer IS NOT NULL');
let n = 0;
for (const r of rows) {
  const txt = String(r.answer ?? '');
  TYPE_AGENT.lastIndex = 0;
  if (!TYPE_AGENT.test(txt)) continue;
  const fixed = txt.replace(TYPE_AGENT, (m) => (/[A-Za-z]/.test(m)
    ? 'tap the “Talk to a person” button below'
    : 'اضغط زرّ «كلّم موظف» تحت'));
  await q('UPDATE chat_cache SET answer = ? WHERE id = ?', [fixed, r.id]);
  n++;
}
log.ok(`أُصلح ${n} ردًّا محفوظًا من ${rows.length}`);

await db.end();
