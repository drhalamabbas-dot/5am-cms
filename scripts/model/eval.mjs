/* =============================================================================
   تقييم موديلنا (على Ollama في جهازك) — بنفس رسالة النظام التي يرسلها الموقع.

   1) أسئلة محجوزة لم يتدرّب عليها (heldout.json من مجلد النسخة) ← مقارنة بالجواب
      المقبول: نسبة الكلمات المشتركة (F1).
   2) أسئلة اختبار ثابتة: عربي/إنجليزي، فخ السعر، التواصل، سؤال خارج الشغل.
   لكل جواب: اللغة صح؟ حروف صينية؟ سعر؟ طول معقول؟ رابط من الموقع؟ وزمن الرد.
   النتيجة: report.md وresults.json في مجلد النسخة، ونفس الأسئلة على Qwen المعلّم
   للمقارنة لو --teacher (يستهلك من حد OpenRouter).

   node scripts/model/eval.mjs <مجلد_النسخة> <اسم_موديل_Ollama> [--teacher]
============================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { SignJWT } from 'jose';
import { connect, loadEnv } from '../lib.mjs';

const [runDir, model] = process.argv.slice(2);
const withTeacher = process.argv.includes('--teacher');
if (!runDir || !model) { console.error('node eval.mjs <مجلد_النسخة> <موديل_Ollama> [--teacher]'); process.exit(1); }
const env = loadEnv(); const db = await connect();
const [[u]] = await db.query('SELECT id, email, role, session_ver FROM users ORDER BY is_owner DESC, id LIMIT 1');
await db.end();
const tok = await new SignJWT({ email: u.email, role: u.role, sv: u.session_ver }).setProtectedHeader({ alg: 'HS256' })
  .setSubject(String(u.id)).setIssuedAt().setExpirationTime('60m').sign(new TextEncoder().encode(env.AUTH_SECRET));
const prompt = async (q, lang) => (await (await fetch(`http://localhost:3000/api/admin/chat-training/prompt?${new URLSearchParams({ q, lang })}`, { headers: { cookie: `5am_session=${tok}` } })).json()).messages;

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const PRICE = /(\d[\d,.\s]*\s*(ألف|الف|مليون)?\s*(جنيه|ج\.م|EGP|دولار|USD|\$|€))|((EGP|USD|\$|€)\s*\d)/i;
const langOf = (s) => { const a = (s.match(/\p{Script=Arabic}/gu) ?? []).length, e = (s.match(/[A-Za-z]/g) ?? []).length; return !a && !e ? null : a >= e ? 'ar' : 'en'; };
const norm = (s) => s.toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1);
const f1 = (a, b) => {
  const A = norm(a), B = norm(b); if (!A.length || !B.length) return 0;
  const cnt = new Map(); for (const w of B) cnt.set(w, (cnt.get(w) ?? 0) + 1);
  let hit = 0; for (const w of A) if (cnt.get(w) > 0) { hit++; cnt.set(w, cnt.get(w) - 1); }
  if (!hit) return 0; const p = hit / A.length, r = hit / B.length; return (2 * p * r) / (p + r);
};

async function ask(where, messages) {
  const t = Date.now();
  const local = where === 'student';
  const r = await fetch(local ? 'http://127.0.0.1:11434/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(local ? {} : { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` }) },
    body: JSON.stringify({ model: local ? model : 'qwen/qwen3.8-27b:free', messages, temperature: 0.3, max_tokens: 500, ...(local ? {} : { reasoning: { enabled: false } }) }),
  });
  const d = await r.json().catch(() => ({}));
  return { text: String(d.choices?.[0]?.message?.content ?? '').trim(), ms: Date.now() - t, status: r.status };
}
function judge(q, lang, a, ref) {
  return {
    langOk: langOf(a) === lang, cjk: CJK.test(a), price: PRICE.test(a), lenOk: a.length >= 40 && a.length <= 1400,
    link: /\]\(\/[^)]+\)/.test(a) || /\/[\w-]+\.html/.test(a), f1: ref ? +f1(a, ref).toFixed(3) : null,
  };
}

const heldout = JSON.parse(fs.readFileSync(path.join(runDir, 'heldout.json'), 'utf8'));
const PROBES = [
  ['عايز مولد لمصنع فيه موتور 30 كيلووات تشغيل مباشر، احتاج قدرة كام؟', 'ar'],
  ['المولد بتاعي قديم والموتور بايظ بس الدينامو سليم، اعمل ايه؟', 'ar'],
  ['بكام المولد 500 كيلو؟', 'ar'],
  ['ايه رقم التليفون والعنوان؟', 'ar'],
  ['عندكم مكانس شوارع؟', 'ar'],
  ['How much does a 250 kVA generator cost?', 'en'],
  ['Do you supply Vactor trucks in Egypt?', 'en'],
  ['مين كسب ماتش الأهلي امبارح؟', 'ar'],
];
const results = [];
console.log(`تقييم ${model} — ${heldout.length} سؤال محجوز + ${PROBES.length} سؤال اختبار${withTeacher ? ' (ومقارنة بـ Qwen المعلّم)' : ''}`);
for (const h of heldout) {
  const msgs = h.messages.slice(0, 2), ref = h.messages[2].content, q = msgs[1].content;
  const lang = langOf(q) ?? 'ar';
  const s = await ask('student', msgs);
  const row = { kind: 'heldout', q, lang, ref, student: s.text, ms: s.ms, ...judge(q, lang, s.text, ref) };
  if (withTeacher) { const t = await ask('teacher', msgs); row.teacher = t.text; row.teacherF1 = +f1(t.text, ref).toFixed(3); }
  results.push(row); process.stdout.write('.');
}
for (const [q, lang] of PROBES) {
  const msgs = await prompt(q, lang);
  const s = await ask('student', msgs);
  const row = { kind: 'probe', q, lang, student: s.text, ms: s.ms, ...judge(q, lang, s.text, null) };
  if (withTeacher) row.teacher = (await ask('teacher', msgs)).text;
  results.push(row); process.stdout.write('.');
}
console.log();

const pct = (k, rows = results) => `${Math.round((rows.filter((r) => r[k]).length / rows.length) * 100)}%`;
const ho = results.filter((r) => r.kind === 'heldout');
const avg = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3) : 0);
const summary = {
  model, at: new Date().toISOString(), heldout: ho.length, probes: PROBES.length,
  langOk: pct('langOk'), noCJK: `${100 - parseInt(pct('cjk'))}%`, noPrice: `${100 - parseInt(pct('price'))}%`, lenOk: pct('lenOk'), withLink: pct('link'),
  heldoutF1: avg(ho.map((r) => r.f1)), teacherF1: withTeacher ? avg(ho.map((r) => r.teacherF1)) : null, avgSeconds: +(avg(results.map((r) => r.ms)) / 1000).toFixed(2),
};
fs.writeFileSync(path.join(runDir, 'results.json'), JSON.stringify({ summary, results }, null, 1));
const md = [
  `# تقييم ${model}`, '', `التاريخ: ${summary.at}`, '',
  '| المقياس | النتيجة |', '|---|---|',
  `| يرد بلغة السؤال | ${summary.langOk} |`, `| بلا حروف صينية | ${summary.noCJK} |`, `| بلا أسعار | ${summary.noPrice} |`,
  `| طول معقول | ${summary.lenOk} |`, `| فيه رابط من الموقع | ${summary.withLink} |`,
  `| تطابق مع الجواب المقبول (F1، أسئلة لم يرها) | ${summary.heldoutF1}${withTeacher ? ` (المعلّم: ${summary.teacherF1})` : ''} |`,
  `| متوسط زمن الرد | ${summary.avgSeconds} ثانية |`, '',
  '## الإجابات', '',
  ...results.map((r) => `### ${r.kind === 'heldout' ? 'محجوز' : 'اختبار'}: ${r.q}\n**موديلنا** (${(r.ms / 1000).toFixed(1)}ث${r.f1 != null ? ` · F1 ${r.f1}` : ''}${r.langOk ? '' : ' · ⚠ لغة'}${r.cjk ? ' · ⚠ صيني' : ''}${r.price ? ' · ⚠ سعر' : ''}):\n\n${r.student || '(فارغ)'}\n${r.teacher ? `\n**Qwen المعلّم:**\n\n${r.teacher}\n` : ''}${r.ref ? `\n**المقبول:**\n\n${r.ref}\n` : ''}`),
].join('\n');
fs.writeFileSync(path.join(runDir, 'report.md'), md);
console.log(JSON.stringify(summary, null, 1));
console.log('التقرير:', path.join(runDir, 'report.md'));
