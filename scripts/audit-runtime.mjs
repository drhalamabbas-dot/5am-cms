/* =============================================================================
   فحص فصل الحسابات وقت التشغيل — محاولات اختراق فعلية على الخادم الشغّال.

   يجرّب:
   1) زائر بلا جلسة يدخل اللوحة
   2) جلسة عميل تدخل اللوحة
   3) جلسة عميل مزوّرة (نفس الكعكة، توقيع تاني)
   4) كعكة العميل تُوضَع مكان كعكة اللوحة
   5) عميل يقرأ محادثة ليست له
   6) ملف محادثة بلا جلسة صاحبه
   7) واجهات اللوحة بلا صلاحية

   node scripts/audit-runtime.mjs
============================================================================= */
import { connect, log } from './lib.mjs';
import { SignJWT } from 'jose';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';

/* السرّ من .env.local — المفتاحان مشتقّان منه بطريقتين مختلفتين:
   اللوحة تستعمله خامًا، والعميل HMAC(secret,'5am-customer-session'). */
const ENV = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const AUTH_SECRET = process.env.AUTH_SECRET || ENV.AUTH_SECRET || '';
const custKey = () => new TextEncoder().encode(
  createHmac('sha256', AUTH_SECRET).update('5am-customer-session').digest('hex')
);
const adminKey = () => new TextEncoder().encode(AUTH_SECRET);

const BASE = process.env.BASE || 'http://localhost:3000';
const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];
let bad = 0;
const ok = (m) => log.ok(m);
const fail = (m) => { bad++; log.fail(m); };

/** يرجّع {status, location, body} بلا اتّباع التحويل */
async function hit(path, cookie) {
  const r = await fetch(BASE + path, {
    redirect: 'manual',
    headers: cookie ? { cookie } : {},
  });
  const body = r.status < 400 ? (await r.text()).slice(0, 400) : '';
  return { status: r.status, loc: r.headers.get('location') ?? '', body };
}

/* الممنوع: 401/403/404، أو تحويل لصفحة دخول */
const denied = (r) => [401, 403, 404].includes(r.status)
  || (r.status >= 300 && r.status < 400 && /login|signin|admin\/login/i.test(r.loc));

console.log('\n=== 1) زائر بلا جلسة ===');
for (const p of ['/admin', '/admin/chats', '/admin/users', '/api/admin/chats/1']) {
  const r = await hit(p);
  if (denied(r)) ok(`${p} ← ممنوع (${r.status}${r.loc ? ' → ' + r.loc : ''})`);
  else fail(`${p} ← مفتوح! (${r.status})`);
}

console.log('\n=== 2) جلسة عميل حقيقية تدخل اللوحة ===');
const [acct] = await q('SELECT id, session_ver FROM customer_accounts LIMIT 1');
if (!acct) { console.log('  (لا حساب عميل للاختبار)'); }
else {
  const custTok = await new SignJWT({ typ: 'cust', sv: acct.session_ver ?? 0 })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(String(acct.id))
    .setIssuedAt().setExpirationTime('7d').sign(custKey());
  const custCookie = `5am_cust=${custTok}`;

  /* شرطُ دلالةِ ما بعده: لو لم تفتح صفحته فالتوكن غير صالح أصلًا */
  const mine = await hit('/account', custCookie);
  if (mine.status === 200) ok('/account بجلسة العميل ← يفتح (200) — التوكن صالح، فالمنع بعده حقيقي');
  else fail(`/account بجلسة عميل صحيحة ← ${mine.status}؛ الاختبار غير دالّ`);

  for (const p of ['/admin', '/admin/chats', '/admin/users', '/api/admin/chats/1']) {
    const r = await hit(p, custCookie);
    if (denied(r)) ok(`${p} بجلسة عميل ← ممنوع (${r.status}${r.loc ? ' → ' + r.loc : ''})`);
    else fail(`${p} بجلسة عميل ← مفتوح! (${r.status})`);
  }

  console.log('\n=== 3) كعكة العميل مكان كعكة اللوحة ===');
  for (const p of ['/admin', '/api/admin/chats/1']) {
    const r = await hit(p, `5am_session=${custTok}`);
    if (denied(r)) ok(`${p} بكعكة عميل باسم اللوحة ← ممنوع (${r.status})`);
    else fail(`${p} بكعكة عميل باسم اللوحة ← مفتوح! (${r.status})`);
  }

  console.log('\n=== 3b) توكن موقَّع بمفتاح اللوحة يُقدَّم كعميل ===');
  /* لو كان المفتاحان واحدًا لقُبِل هذا — وهو ما يفصل الجهتين فعلًا */
  const asAdminKey = await new SignJWT({ typ: 'cust', sv: acct.session_ver ?? 0 })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(String(acct.id))
    .setIssuedAt().setExpirationTime('7d').sign(adminKey());
  const r3b = await hit('/account', `5am_cust=${asAdminKey}`);
  if (denied(r3b)) ok(`/account بتوكن مفتاحه مفتاح اللوحة ← ممنوع (${r3b.status}) — المفتاحان منفصلان`);
  else fail(`/account قَبِل توكنًا بمفتاح اللوحة! (${r3b.status})`);

  console.log('\n=== 4) جلسة مزوّرة (توقيع غلط) ===');
  const forged = await new SignJWT({ typ: 'cust', sv: 0 })
    .setProtectedHeader({ alg: 'HS256' }).setSubject('1')
    .setIssuedAt().setExpirationTime('7d')
    .sign(new TextEncoder().encode('not-the-real-secret-0000000000000000'));
  for (const [name, p] of [['5am_cust', '/account'], ['5am_session', '/admin']]) {
    const r = await hit(p, `${name}=${forged}`);
    if (denied(r)) ok(`${p} بتوقيع مزوّر ← ممنوع (${r.status}${r.loc ? ' → ' + r.loc : ''})`);
    else fail(`${p} بتوقيع مزوّر ← مفتوح! (${r.status})`);
  }

  console.log('\n=== 5) محادثة ليست للعميل ===');
  /* الدلالةُ في هُويّةِ ما رجع لا في كونِه رجع: الواجهة تتجاهل الباراميتر
     وتردّ بمحادثة الحساب — فيُتحقَّق أن أيًّا من رسائل المحادثة الأخرى لم يظهر. */
  const other = await q(
    'SELECT id FROM chat_conversations WHERE account_id IS NULL OR account_id <> ? LIMIT 1', [acct.id]
  );
  if (other.length) {
    const otherIds = (await q('SELECT id FROM chat_messages WHERE conversation_id = ?', [other[0].id])).map((r) => r.id);
    const r = await fetch(`${BASE}/api/chat?conversation=${other[0].id}`, { headers: { cookie: custCookie } });
    const d = await r.json().catch(() => ({}));
    const got = (d.messages ?? []).map((m) => m.id);
    const leaked = got.filter((id) => otherIds.includes(id));
    if (leaked.length) fail(`سرّب ${leaked.length} رسالة من محادثة #${other[0].id}`);
    else ok(`محادثة #${other[0].id} (${otherIds.length} رسالة) لم تظهر — رجع ${got.length} رسالة من محادثته هو`);
  } else ok('لا محادثة أخرى للاختبار');

  console.log('\n=== 5b) كوكي محادثة مزوَّر ===');
  /* token_hash مخزّن مجزَّأً، فلا يُستخرج؛ ويُجرَّب رمز عشوائي بالشكل نفسه */
  const fakeTok = 'a'.repeat(48);
  const r5b = await fetch(`${BASE}/api/chat`, { headers: { cookie: `${custCookie}; 5am_chat=${fakeTok}` } });
  const d5b = await r5b.json().catch(() => ({}));
  const ids5b = (d5b.messages ?? []).map((m) => m.id);
  const mineIds = (await q(
    'SELECT m.id FROM chat_messages m JOIN chat_conversations c ON c.id = m.conversation_id WHERE c.account_id = ?', [acct.id]
  )).map((r) => r.id);
  const stray = ids5b.filter((id) => !mineIds.includes(id));
  if (stray.length) fail(`كوكي محادثة مزوَّر جلب ${stray.length} رسالة ليست له`);
  else ok(`كوكي محادثة مزوَّر ← رجع ${ids5b.length} رسالة، كلها من محادثته`);
}

console.log('\n=== 6) ملف محادثة بلا جلسة صاحبه ===');
const [f] = await q('SELECT path FROM chat_files LIMIT 1');
if (f) {
  const r = await hit('/' + f.path);
  if (denied(r)) ok(`${f.path} بلا جلسة ← ممنوع (${r.status})`);
  else fail(`${f.path} بلا جلسة ← مفتوح! (${r.status})`);
} else ok('لا ملفات محادثة للاختبار');

console.log('\n========================================');
if (bad) console.log(`  ${bad} ثغرة`);
else console.log('  لا ثغرات — الحسابات منفصلة');

await db.end();
process.exit(bad ? 1 : 0);
