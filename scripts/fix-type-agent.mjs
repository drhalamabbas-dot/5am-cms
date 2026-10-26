/* =============================================================================
   يصلّح «اكتب موظف» في الذاكرة والرسائل المحفوظة.

   السبب الجذري أُصلح في lib/chat/bot.ts (تعبير TYPE_AGENT كان ينكسر عند
   علامات Markdown)، وهذا يطهّر ما حُفظ قبل الإصلاح — وإلّا بقي يُقدَّم من
   الذاكرة بلا مرورٍ بالفلتر، ويُقرأ في المحادثات القديمة.

   node scripts/fix-type-agent.mjs          ← عرضٌ بلا تعديل
   node scripts/fix-type-agent.mjs --apply  ← تنفيذ
============================================================================= */
import { connect, log } from './lib.mjs';

const APPLY = process.argv.includes('--apply');
const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];

const OPEN = String.raw`[*_«"'“]*\s*`;
const CLOSE = String.raw`[*_»"'”]*`;
const ALT = String.raw`(?:\s*[/|]\s*${OPEN}(?:موظف|مندوب|agent|human|staff|support)${CLOSE})?`;
const TYPE_AGENT = new RegExp(
  String.raw`(?:اكتب|أكتب|ابعت|اب[عـ]تلي|اكتبلي|قول|ارسل|أرسل)\s*(?:كلمة\s*)?${OPEN}(?:موظف|مندوب|ادمن|أدمن)${CLOSE}${ALT}`
  + '|'
  + String.raw`(?:type|write|send|say)\s+(?:the\s+word\s+)?${OPEN}(?:agent|human|staff|support)${CLOSE}${ALT}`,
  'gi',
);
const fix = (t) => String(t ?? '').replace(TYPE_AGENT, (m) => (/[A-Za-z]/.test(m)
  ? 'tap the “Talk to a person” button below'
  : 'اضغط زرّ «كلّم موظف» تحت'));

console.log(APPLY ? '\n== تنفيذ ==' : '\n== عرض فقط (أضف --apply للتنفيذ) ==');

let n1 = 0;
for (const r of await q('SELECT id, answer FROM chat_cache')) {
  const out = fix(r.answer);
  if (out === r.answer) continue;
  n1++;
  console.log(`  cache #${r.id}`);
  if (APPLY) await q('UPDATE chat_cache SET answer = ? WHERE id = ?', [out, r.id]);
}
log.ok(`${n1} ردّ في الذاكرة`);

let n2 = 0;
for (const r of await q("SELECT id, text FROM chat_messages WHERE role IN ('bot','agent')")) {
  const out = fix(r.text);
  if (out === r.text) continue;
  n2++;
  console.log(`  msg #${r.id}`);
  if (APPLY) await q('UPDATE chat_messages SET text = ? WHERE id = ?', [out, r.id]);
}
log.ok(`${n2} رسالة`);

console.log(APPLY ? '\nتم.' : '\nلم يُعدَّل شيء. أعد التشغيل بـ --apply.');
await db.end();
