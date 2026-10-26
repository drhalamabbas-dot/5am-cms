/* =============================================================================
   فحص نظام المحادثة والموديلات — هل يردّ، وبأيّ مصدر، وهل الفلاتر تعمل.
   node scripts/audit-chat.mjs
============================================================================= */
import { connect, log } from './lib.mjs';
import fs from 'node:fs';

const ENV = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
for (const [k, v] of Object.entries(ENV)) process.env[k] ??= v;

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];
let bad = 0, warn = 0;
const ok = (m) => log.ok(m);
const fail = (m) => { bad++; log.fail(m); };
const note = (m) => { warn++; console.log(`  ! ${m}`); };

console.log('\n=== 1) إعدادات المحادثة ===');
const [row] = await q("SELECT value FROM settings WHERE `key` = 'chat'");
const s = row ? (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) : {};
ok(`مفعّلة: ${s.enabled !== false}`);
ok(`المزوّد: ${s.provider ?? '(افتراضي)'}`);
ok(`موديل النص: ${s.model || '(افتراضي)'}`);
ok(`موديل الصور: ${s.visionModel || '(افتراضي)'}`);
ok(`موديل الصوت: ${s.hearModel || '(افتراضي)'}`);
if (!process.env.OPENROUTER_API_KEY) fail('OPENROUTER_API_KEY غير مضبوط');
else ok(`مفتاح OpenRouter موجود (${process.env.OPENROUTER_API_KEY.slice(0, 12)}…)`);

console.log('\n=== 2) الرصيد والحصة ===');
try {
  const r = await fetch('https://openrouter.ai/api/v1/key', {
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
  });
  const d = await r.json();
  const k = d?.data ?? {};
  console.log(`  الاستخدام: $${k.usage ?? '?'} | الحد: ${k.limit ?? 'بلا حد'} | باقٍ: ${k.limit_remaining ?? '?'}`);
  if (k.is_free_tier) note('حساب مجاني — الموديلات المجانية عليها حصة يومية، والصوت يحتاج رصيد');
  else ok('حساب مدفوع');
} catch (e) { note(`تعذّر قراءة الرصيد: ${e.message}`); }

console.log('\n=== 3) ردّ البوت فعليًا ===');
/* عبر «اقتراح البوت» في اللوحة: يستدعي reply() نفسها ولا يحفظ شيئًا ولا
   يُرسل للعميل — فلا تتلوّث محادثةٌ حقيقية برسائل فحص. ويعمل مهما كانت
   حالة المحادثة، بخلاف POST /api/chat الذي يسكت فيها البوت حين status='human'. */
const { SignJWT } = await import('jose');
const BASE = process.env.BASE || 'http://localhost:3000';

const [admin] = await q("SELECT id, email, role, session_ver FROM users WHERE active = 1 ORDER BY is_owner DESC LIMIT 1");
const [conv] = await q("SELECT id FROM chat_conversations ORDER BY id DESC LIMIT 1");

const TYPE_AGENT_RE = /(?:اكتب|أكتب|ابعت|قول|ارسل|أرسل)\s*(?:كلمة\s*)?[*_«"'“]*\s*(?:موظف|مندوب)|(?:type|write|send|say)\s+(?:the\s+word\s+)?[*_"'“]*\s*(?:agent|human|staff)/i;
const PRICE_RE = /\d[\d,. ]*\s*(?:ألف|الف|مليون)?\s*(?:جنيه|جنية|EGP|\bLE\b|دولار|USD|\$)/i;

if (!admin || !conv) note('لا مستخدم لوحة أو لا محادثة — تُخطّى تجربة البوت');
else {
  const tok = await new SignJWT({ email: admin.email, role: admin.role, sv: admin.session_ver ?? 1 })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(String(admin.id))
    .setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET ?? ''));
  const cookie = `5am_session=${tok}`;

  /* آخر رسالة للعميل في المحادثة هي ما يردّ عليه الاقتراح، فتُزرع مؤقتًا
     ثم تُمسح — في محادثةٍ تُنشأ للفحص وتُحذف، لا في محادثة عميل. */
  const r0 = await q(
    "INSERT INTO chat_conversations (token_hash, lang, status, last_message_at) VALUES (REPEAT('f',48), 'ar', 'bot', NOW())"
  );
  const testConv = r0.insertId;
  let failed = false;
  try {
    for (const [text, lang] of [
      ['عندكم مكانس شوارع؟', 'ar'],
      ['What generators do you have?', 'en'],
      ['بكام مكنسة إلجين بيليكان؟', 'ar'],
    ]) {
      await q('DELETE FROM chat_messages WHERE conversation_id = ?', [testConv]);
      await q("INSERT INTO chat_messages (conversation_id, role, text) VALUES (?, 'user', ?)", [testConv, text]);
      const r = await fetch(`${BASE}/api/admin/chats/${testConv}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ suggest: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { fail(`"${text}" ← ${r.status} ${d.error ?? ''}`); failed = true; continue; }
      const body = String(d.text ?? '');
      if (!body) { fail(`"${text}" ← ردّ فارغ`); failed = true; continue; }
      const issues = [];
      if (TYPE_AGENT_RE.test(body)) issues.push('يقول «اكتب موظف»');
      if (PRICE_RE.test(body)) issues.push('فيه سعر');
      if (lang === 'ar' && !/[؀-ۿ]/.test(body)) issues.push('ردّ بغير العربية');
      if (lang === 'en' && /[؀-ۿ]/.test(body)) issues.push('ردّ بغير الإنجليزية');
      if (issues.length) { fail(`"${text}" [${d.source}] ← ${issues.join(' + ')} :: ${body.slice(0, 110)}`); failed = true; }
      else ok(`"${text}" [${d.source}] ← ${body.slice(0, 80).replace(/\n/g, ' ')}…`);
    }
  } finally {
    await q('DELETE FROM chat_messages WHERE conversation_id = ?', [testConv]);
    await q('DELETE FROM chat_conversations WHERE id = ?', [testConv]);
    if (!failed) ok('محادثة الفحص اتمسحت');
  }
}

console.log('\n=== 4) فلتر الأسعار والأرقام ===');
/* الفلتر في guard() — يُفحَص على الذاكرة: لا ردّ محفوظ فيه سعر */
/* «LE» بحدّ كلمةٍ لا غير: بدونه طابقت «**Le**roy‑Somer» فأبلغت عن سعرٍ لا وجود له */
const priced = await q(
  `SELECT id, question, answer FROM chat_cache
    WHERE answer REGEXP '[0-9][0-9,. ]*(ألف|الف|مليون)?[ ]*(جنيه|جنية|EGP|\\\\bLE\\\\b|دولار|USD|\\\\$)'
    LIMIT 5`
);
if (priced.length) fail(`${priced.length} ردّ محفوظ فيه سعر: ${priced.map((r) => '#' + r.id).join(', ')}`);
else ok('لا ردّ محفوظ فيه سعر');

const typeAgent = await q(
  `SELECT COUNT(*) n FROM chat_cache
    WHERE answer LIKE '%اكتب كلمة%موظف%' OR answer LIKE '%اكتب "موظف"%'
       OR answer LIKE '%type the word%agent%' OR answer LIKE '%اكتب موظف%'`
);
if (typeAgent[0].n) fail(`${typeAgent[0].n} ردّ محفوظ يقول «اكتب موظف» بدل الزرّ`);
else ok('لا ردّ يقول «اكتب موظف»');

console.log('\n=== 5) الذاكرة ===');
const [cc] = await q('SELECT COUNT(*) n FROM chat_cache');
const byStatus = await q('SELECT status, COUNT(*) n FROM chat_cache GROUP BY status');
ok(`${cc.n} ردّ محفوظ`);
byStatus.forEach((r) => console.log(`    ${r.status}: ${r.n}`));

console.log('\n=== 6) الرسائل والمرفقات ===');
const [mc] = await q('SELECT COUNT(*) n FROM chat_messages');
const [withFiles] = await q('SELECT COUNT(*) n FROM chat_messages WHERE files IS NOT NULL');
const [emptyBoth] = await q("SELECT COUNT(*) n FROM chat_messages WHERE (text IS NULL OR text = '') AND files IS NULL");
ok(`${mc.n} رسالة · ${withFiles.n} فيها مرفقات`);
if (emptyBoth.n) fail(`${emptyBoth.n} رسالة فارغة تمامًا (بلا نصّ ولا مرفق)`);
else ok('لا رسالة فارغة');

const [badReply] = await q(
  `SELECT COUNT(*) n FROM chat_messages m
    WHERE m.reply_to IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM chat_messages r
                       WHERE r.id = m.reply_to AND r.conversation_id = m.conversation_id)`
);
if (badReply.n) fail(`${badReply.n} ردّ يشير لرسالة من محادثة أخرى أو محذوفة`);
else ok('كل الردود تشير لرسائل في المحادثة نفسها');

console.log('\n========================================');
if (bad) console.log(`  ${bad} مشكلة${warn ? ` و${warn} تنبيه` : ''}`);
else console.log(`  المحادثة سليمة${warn ? ` (${warn} تنبيه)` : ''}`);

await db.end();
process.exit(bad ? 1 : 0);
