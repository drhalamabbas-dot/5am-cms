/* يتأكّد أن ملف النسخة يُستورَد فعلًا ويعيد المحتوى كما هو.

   الطريقة: يُنشأ مخزن مؤقّت، ويُستورَد فيه الملف، ثم تُقارن أعداد الصفوف
   وعيّنة من النصوص العربية بالأصل، ثم يُحذف المخزن.

   نسخة لا تُستورَد ليست نسخة، فالفحص جزء من عمل الرفع لا زيادة عليه. */
import fs from 'node:fs';
import path from 'node:path';
import { connect, loadEnv, log, splitSql } from './lib.mjs';

const file = process.argv[2] || path.join(import.meta.dirname, 'dump.sql');
if (!fs.existsSync(file)) { log.fail('لا ملف نسخة — شغّل dump-db.mjs أولًا'); process.exit(1); }

const env = { ...loadEnv(), ...process.env };
const SRC = env.DB_NAME || 'fiveam_cms';
const TMP = `${SRC}_dumptest`;

const root = await connect({ database: null });
await root.query(`DROP DATABASE IF EXISTS \`${TMP}\``);
await root.query(`CREATE DATABASE \`${TMP}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await root.end();

const db = await connect({ database: TMP });
await db.query('SET NAMES utf8mb4');
const sql = fs.readFileSync(file, 'utf8');
try {
  for (const stmt of splitSql(sql)) await db.query(stmt);
} catch (e) {
  log.fail(`الاستيراد تعثّر: ${e.message}`);
  await db.end();
  process.exit(1);
}
log.ok('استُورد الملف بلا خطأ');

const src = await connect();
let bad = 0;
const TABLES = ['settings', 'pages', 'sections', 'brands', 'products',
  'nav_items', 'media', 'translations', 'users'];
for (const t of TABLES) {
  const [[a]] = await src.query(`SELECT COUNT(*) n FROM \`${t}\``);
  const [[b]] = await db.query(`SELECT COUNT(*) n FROM \`${t}\``);
  if (a.n !== b.n) { bad++; log.fail(`${t}: ${a.n} في الأصل · ${b.n} في النسخة`); }
}
if (!bad) log.ok(`${TABLES.length} جدول — الأعداد متطابقة`);

/* العربية أولى ما يتشوّه في نقل غير مضبوط الترميز، فتُقارن حرفًا بحرف. */
const [arSrc] = await src.query(
  "SELECT `key`, ar FROM translations WHERE ar IS NOT NULL ORDER BY `key` LIMIT 300"
);
const [arDst] = await db.query(
  "SELECT `key`, ar FROM translations WHERE ar IS NOT NULL ORDER BY `key` LIMIT 300"
);
const byKey = Object.fromEntries(arDst.map((r) => [r.key, r.ar]));
let arBad = 0;
for (const r of arSrc) if (byKey[r.key] !== r.ar) arBad++;
if (arBad) { bad++; log.fail(`${arBad} نص عربي اختلف بعد الاستيراد`); }
else log.ok(`${arSrc.length} نص عربي مطابق حرفًا بحرف`);

/* أعمدة JSON: تُقارن بعد توحيد ترتيب المفاتيح */
const canon = (v) => {
  const x = typeof v === 'string' ? JSON.parse(v) : v;
  const c = (o) => (Array.isArray(o) ? o.map(c)
    : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, c(o[k])]))
    : o);
  return JSON.stringify(c(x));
};
const [sSrc] = await src.query('SELECT id, content FROM sections ORDER BY id');
const [sDst] = await db.query('SELECT id, content FROM sections ORDER BY id');
const dstById = Object.fromEntries(sDst.map((r) => [r.id, r.content]));
let jBad = 0;
for (const r of sSrc) {
  try { if (canon(dstById[r.id]) !== canon(r.content)) jBad++; } catch { jBad++; }
}
if (jBad) { bad++; log.fail(`${jBad} سيكشن اختلف محتواه`); }
else log.ok(`${sSrc.length} سيكشن — المحتوى مطابق`);

await src.end();
await db.end();
const cleanup = await connect({ database: null });
await cleanup.query(`DROP DATABASE \`${TMP}\``);
await cleanup.end();

log.step(bad ? 'النسخة غير سليمة' : 'النسخة سليمة وقابلة للاستيراد');
process.exit(bad ? 1 : 0);
