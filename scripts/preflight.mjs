/* =============================================================================
   فحص ما قبل الرفع على الخادم.

   يقارن .env.local بالمطلوب في .env.example، ويتحقّق من الإعدادات التي
   يختلف أثرها بين الجهاز والخادم — وهي التي تُنسى فيقع الخلل بعد النشر
   لا قبله: مجلد الرفع، وقوّة مفتاح الجلسات، وعنوان الموقع، والبريد.

   node scripts/preflight.mjs
============================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { connect } from './lib.mjs';

const read = (f) => (fs.existsSync(f)
  ? Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
  : null);

const env = read('.env.local');
const tmpl = read('.env.example');
let bad = 0, warn = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const fail = (m) => { bad++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };
const note = (m) => { warn++; console.log(`  \x1b[33m!\x1b[0m ${m}`); };

if (!env) { fail('.env.local غير موجود'); process.exit(1); }

console.log('\n=== 1) المفاتيح الناقصة مقارنةً بالقالب ===');
const missing = Object.keys(tmpl ?? {}).filter((k) => !(k in env));
if (missing.length) note(`غير مذكورة في .env.local: ${missing.join(', ')}`);
else ok('كل مفاتيح القالب موجودة');

console.log('\n=== 2) ما يلزم الخادم تحديدًا ===');
/* مجلد الرفع: في الإنتاج يُرفض الرفع بدونه (lib/uploads.ts) */
if (!env.UPLOAD_DIR) fail('UPLOAD_DIR فارغ — على الخادم يُرفض كل رفع، والصور الموجودة لا تُقرأ');
else ok(`UPLOAD_DIR = ${env.UPLOAD_DIR}`);
if (!env.PRIVATE_DIR) note('PRIVATE_DIR فارغ — سيُشتقّ «<UPLOAD_DIR>-private» تلقائيًّا');
else ok(`PRIVATE_DIR = ${env.PRIVATE_DIR}`);

/* مفتاح الجلسات */
const s = env.AUTH_SECRET ?? '';
if (s.length < 32) fail(`AUTH_SECRET طوله ${s.length} — المطلوب 32 حرفًا فأكثر وإلا رُفض الإقلاع`);
else if (/^(dev|test|secret|changeme|123)/i.test(s)) fail('AUTH_SECRET يبدو قيمة تجريبية — ولّد غيره للخادم');
else ok(`AUTH_SECRET بطول ${s.length} حرفًا`);

/* عنوان الموقع */
if (!env.SITE_URL) note('SITE_URL فارغ — الروابط المطلقة وخريطة الموقع ستبني على المضيف الحالي');
else if (/localhost|127\.0\.0\.1/.test(env.SITE_URL)) fail(`SITE_URL = ${env.SITE_URL} — عنوان محلّي لا يصلح للخادم`);
else ok(`SITE_URL = ${env.SITE_URL}`);

if (env.NODE_ENV && env.NODE_ENV !== 'production') note(`NODE_ENV = ${env.NODE_ENV} — على الخادم يكون production`);

console.log('\n=== 3) البريد (رموز دخول العملاء) ===');
if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
  note('SMTP ناقص — «نسيت كلمة المرور» لن يرسل رمزًا، وباقي الموقع يعمل');
} else ok(`SMTP عبر ${env.SMTP_HOST} بحساب ${env.SMTP_USER}`);

console.log('\n=== 4) المحادثة ===');
if (!env.OPENROUTER_API_KEY) note('OPENROUTER_API_KEY فارغ — البوت سيرد من صفحات الموقع فقط');
else ok('مفتاح OpenRouter موجود');

console.log('\n=== 5) الأسرار لا تُرفع إلى git ===');
const gi = fs.readFileSync('.gitignore', 'utf8');
for (const p of ['.env', '/storage/', '/training-data/']) {
  if (gi.includes(p)) ok(`${p} مستثنى`);
  else fail(`${p} غير مستثنى في .gitignore`);
}

console.log('\n=== 6) القاعدة ===');
try {
  const db = await connect();
  const q = async (x, a = []) => (await db.query(x, a))[0];
  const [t] = await q('SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
  ok(`متصلة · ${t.n} جدول`);
  /* أعمدة أضافتها الترحيلات: غيابها على الخادم يعني ترحيلًا لم يُشغَّل */
  const need = [
    ['chat_conversations', 'cust_typing_at'], ['chat_conversations', 'agent_typing_at'],
    ['chat_messages', 'reply_to'], ['chat_messages', 'files'],
    ['customer_accounts', 'username'], ['chat_files', 'account_id'],
  ];
  for (const [tb, c] of need) {
    const [r] = await q(
      `SELECT COUNT(*) n FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [tb, c]
    );
    if (!r.n) fail(`${tb}.${c} غير موجود — شغّل ترحيلاته على الخادم`);
  }
  ok('كل أعمدة الترحيلات موجودة');
  const [u] = await q('SELECT COUNT(*) n FROM users WHERE active = 1');
  if (!u.n) fail('لا مستخدم لوحة فعّال — لن تستطيع الدخول بعد الرفع');
  else ok(`${u.n} مستخدم لوحة فعّال`);
  await db.end();
} catch (e) {
  fail(`تعذّر الاتصال بالقاعدة: ${String(e.message).slice(0, 70)}`);
}

console.log('\n========================================');
if (bad) console.log(`  \x1b[31m${bad} مانع للرفع\x1b[0m${warn ? ` و${warn} تنبيه` : ''}`);
else console.log(`  \x1b[32mجاهز للرفع\x1b[0m${warn ? ` (${warn} تنبيه)` : ''}`);
process.exit(bad ? 1 : 0);
