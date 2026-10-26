/* يصدّر قاعدة البيانات كاملة إلى ملف SQL واحد، جاهز للاستيراد على الخادم.

   لا يعتمد على mysqldump: الاستضافة المشتركة قد لا تتيحه، والملف الناتج هنا
   مكتوب بترميز utf8mb4 صراحةً فلا تتشوّه العربية عند الاستيراد.

   node scripts/dump-db.mjs           → scripts/dump.sql
   node scripts/dump-db.mjs out.sql   → مسار آخر */
import fs from 'node:fs';
import path from 'node:path';
import { connect, log } from './lib.mjs';

const out = process.argv[2] || path.join(import.meta.dirname, 'dump.sql');

const db = await connect();

/* الجداول تُقرأ من القاعدة لا من قائمةٍ مكتوبة: كانت عشرةً من تسعةٍ
   وعشرين، فكان ما يُنقل إلى الخادم بلا حسابات العملاء ولا محادثاتهم ولا
   طلباتهم — وما ينقص لا يُفتقَد إلا بعد النشر. وكل جدولٍ جديد يدخل وحده.

   وrows المُستثناة: رموز دخولٍ عمرها عشر دقائق، لا معنى لنقلها. */
const SKIP_ROWS = new Set(['login_codes']);
const [found] = await db.query(
  `SELECT TABLE_NAME t FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`
);
const TABLES = found.map((r) => r.t);
const parts = [
  '-- 5A&M — نسخة قاعدة البيانات',
  `-- ${new Date().toISOString()}`,
  'SET NAMES utf8mb4;',
  'SET FOREIGN_KEY_CHECKS = 0;',
  '',
];

/** قيمة جاهزة للكتابة في SQL. */
const val = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
  if (Buffer.isBuffer(v)) return `0x${v.toString('hex')}`;
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
};

let rowsTotal = 0;
for (const t of TABLES) {
  const [[create]] = await db.query(`SHOW CREATE TABLE \`${t}\``);
  parts.push(`DROP TABLE IF EXISTS \`${t}\`;`);
  parts.push(create['Create Table'] + ';', '');

  if (SKIP_ROWS.has(t)) { log.ok(`${t.padEnd(20)} (البنية فقط)`); continue; }
  const [rows] = await db.query(`SELECT * FROM \`${t}\``);
  if (!rows.length) { log.ok(`${t.padEnd(20)} فارغ`); continue; }
  const cols = Object.keys(rows[0]);
  /* دفعات لا صفًّا صفًّا: ملف أصغر واستيراد أسرع */
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    parts.push(
      `INSERT INTO \`${t}\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES`
      + chunk.map((r) => `\n(${cols.map((c) => val(r[c])).join(', ')})`).join(',')
      + ';'
    );
  }
  parts.push('');
  rowsTotal += rows.length;
  log.ok(`${t.padEnd(20)} ${rows.length} صف`);
}

parts.push('SET FOREIGN_KEY_CHECKS = 1;', '');
fs.writeFileSync(out, parts.join('\n'), 'utf8');
await db.end();
log.step('تم');
log.ok(`${out}  (${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB · ${rowsTotal} صف)`);
