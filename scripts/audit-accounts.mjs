/* =============================================================================
   فحص فصل الحسابات — يتأكد أن حساب العميل لا يُخلط بحساب الموظف/الأدمن.
   node scripts/audit-accounts.mjs
============================================================================= */
import fs from 'node:fs';
import { connect, log } from './lib.mjs';

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];
let bad = 0, warn = 0;
const ok = (m) => log.ok(m);
const fail = (m) => { bad++; log.fail(m); };
const note = (m) => { warn++; console.log(`  ! ${m}`); };

console.log('\n=== 1) الجدولان منفصلان ===');
const [u] = await q('SELECT COUNT(*) n FROM users');
const [c] = await q('SELECT COUNT(*) n FROM customer_accounts');
ok(`users (موظفون/أدمن): ${u.n}`);
ok(`customer_accounts (عملاء): ${c.n}`);

const cols = await q(
  `SELECT COLUMN_NAME c FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_accounts'`
);
const names = cols.map((r) => r.c);
const dangerous = names.filter((n) => /^(user_id|role|is_admin|permissions|staff)$/i.test(n));
if (dangerous.length) fail(`customer_accounts فيه عمود صلاحيات: ${dangerous.join(', ')}`);
else ok(`customer_accounts بلا عمود صلاحيات (${names.join(', ')})`);

const overlap = await q(
  `SELECT ca.email FROM customer_accounts ca
     JOIN users u ON LOWER(u.email) = LOWER(ca.email) WHERE ca.email IS NOT NULL`
);
if (overlap.length) note(`${overlap.length} بريد مشترك بين الجدولين: ${overlap.map((r) => r.email).join(', ')}`);
else ok('لا بريد مشترك بين العملاء والموظفين');

console.log('\n=== 2) الجلسات ===');
const auth = fs.readFileSync('lib/auth.ts', 'utf8');
const cust = fs.readFileSync('lib/customerAuth.ts', 'utf8');
const cookieOf = (s) => [...s.matchAll(/(?:COOKIE|cookieName)\s*=\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
const a = cookieOf(auth), b = cookieOf(cust);
console.log(`  كعكة اللوحة: ${a.join(', ') || '(لم تُقرأ)'}`);
console.log(`  كعكة العميل: ${b.join(', ') || '(لم تُقرأ)'}`);
if (a.length && b.length && a.some((x) => b.includes(x))) fail('الكعكتان متطابقتان — خطر خلط الجلسات');
else if (a.length && b.length) ok('كعكتا الجلسة مختلفتان');
else note('تعذّرت قراءة اسم إحدى الكعكتين من الكود');

console.log('\n=== 3) محادثات العملاء ===');
const [convTotal] = await q('SELECT COUNT(*) n FROM chat_conversations');
ok(`${convTotal.n} محادثة`);
const [noAcct] = await q(
  `SELECT COUNT(*) n FROM chat_conversations c
    WHERE c.account_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM customer_accounts a WHERE a.id = c.account_id)`
);
if (noAcct.n) fail(`${noAcct.n} محادثة مربوطة بحساب عميل محذوف`);
else ok('كل محادثة مربوطة بحساب موجود (أو زائر بلا حساب)');

console.log('\n=== 4) ملفات المحادثة ===');
const [cf] = await q('SELECT COUNT(*) n FROM chat_files');
ok(`${cf.n} ملف في chat_files`);
const [badFile] = await q(
  `SELECT COUNT(*) n FROM chat_files f
    WHERE f.account_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM customer_accounts a WHERE a.id = f.account_id)`
);
if (badFile.n) fail(`${badFile.n} ملف مملوك لحساب محذوف — يتعذّر التحقق من مالكه`);
else ok('كل ملف مربوط بحساب موجود');

const [noOwner] = await q('SELECT COUNT(*) n FROM chat_files WHERE account_id IS NULL');
if (noOwner.n) note(`${noOwner.n} ملف بلا مالك — يُفتح لمن يعرف مساره فقط`);
else ok('كل ملف له مالك');

console.log('\n=== 5) التنبيهات اليتيمة ===');
const [orphan] = await q(
  `SELECT COUNT(*) n FROM notifications
    WHERE link LIKE '/admin/chats/%'
      AND NOT EXISTS (
        SELECT 1 FROM chat_conversations c
         WHERE c.id = CAST(SUBSTRING_INDEX(link, '/', -1) AS UNSIGNED))`
);
if (orphan.n) fail(`${orphan.n} تنبيه يشير لمحادثة محذوفة (يعطي 404)`);
else ok('لا تنبيهات يتيمة');

console.log('\n=== 6) طلبات بلا عميل ===');
const [badReq] = await q(
  `SELECT COUNT(*) n FROM requests r
    WHERE r.customer_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM customers x WHERE x.id = r.customer_id)`
);
if (badReq.n) fail(`${badReq.n} طلب مربوط بعميل محذوف`);
else ok('كل طلب مربوط بعميل موجود (أو بلا عميل)');

console.log('\n========================================');
if (bad) console.log(`  ${bad} مشكلة${warn ? ` و${warn} تنبيه` : ''}`);
else console.log(`  كل الفحوص سليمة${warn ? ` (${warn} تنبيه)` : ''}`);

await db.end();
process.exit(bad ? 1 : 0);
