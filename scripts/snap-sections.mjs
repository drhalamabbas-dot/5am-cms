/* يلتقط محتوى السكاشن أو يقارنه بلقطة سابقة.

   يُستعمل لاختبار الداش بورد: تُلتقط لقطة، ثم يُفتح السيكشن ويُحفظ بلا تغيير،
   ثم تُقارَن. أي فرق يعني أن المحرّر يفقد شيئًا من المحتوى.

   node scripts/snap-sections.mjs save
   node scripts/snap-sections.mjs diff */
import fs from 'node:fs';
import path from 'node:path';
import { connect, log } from './lib.mjs';

const FILE = path.join(import.meta.dirname, '.sections-snapshot.json');
const mode = process.argv[2] ?? 'diff';

const db = await connect();
const [rows] = await db.query('SELECT id, type, anchor, content FROM sections ORDER BY id');
const now = Object.fromEntries(rows.map((r) => [r.id, {
  type: r.type, anchor: r.anchor,
  content: typeof r.content === 'string' ? JSON.parse(r.content) : r.content,
}]));
await db.end();

/* ترتيب مفاتيح الكائن لا يعني شيئًا في JSON، فيُوحَّد قبل المقارنة. والنص
   الفارغ والقائمة الفارغة والمفتاح الغائب تظهر للزائر سواءً، فتُعدّ واحدًا. */
const empty = (v) => v === '' || v == null || (Array.isArray(v) && v.length === 0);
const canon = (v) => {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v).sort().filter((k) => !empty(v[k])).map((k) => [k, canon(v[k])])
    );
  }
  return v;
};
const S = (v) => JSON.stringify(canon(v));

if (mode === 'save') {
  fs.writeFileSync(FILE, JSON.stringify(now, null, 1), 'utf8');
  log.ok(`لقطة لـ ${Object.keys(now).length} سيكشن`);
  process.exit(0);
}

if (!fs.existsSync(FILE)) { log.fail('لا لقطة — شغّل save أولًا'); process.exit(1); }
const before = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let bad = 0;
for (const [id, b] of Object.entries(before)) {
  const a = now[id];
  if (!a) { log.fail(`سيكشن ${id} اختفى`); bad++; continue; }
  if (S(a.content) === S(b.content) && a.anchor === b.anchor) continue;
  bad++;
  log.fail(`سيكشن ${id} (${b.type}) اختلف`);
  for (const k of new Set([...Object.keys(b.content ?? {}), ...Object.keys(a.content ?? {})])) {
    if (S(b.content?.[k]) === S(a.content?.[k])) continue;
    log.info(`  ${k}:`);
    log.info(`    قبل : ${String(S(b.content?.[k])).slice(0, 240)}`);
    log.info(`    بعد : ${String(S(a.content?.[k])).slice(0, 240)}`);
  }
}
if (bad) log.fail(`${bad} سيكشن اختلف`);
else log.ok(`${Object.keys(before).length} سيكشن — لا فرق`);
process.exit(bad ? 1 : 0);
