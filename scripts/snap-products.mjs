/* يلتقط بيانات المنتجات أو يقارنها بلقطة سابقة — كاختبار snap-sections تمامًا:
   يُفتح المنتج في الداش بورد ويُحفظ بلا تغيير، فإن اختلف شيء فالمحرّر يفقده.

   node scripts/snap-products.mjs save
   node scripts/snap-products.mjs diff */
import fs from 'node:fs';
import path from 'node:path';
import { connect, log } from './lib.mjs';

const FILE = path.join(import.meta.dirname, '.products-snapshot.json');
const mode = process.argv[2] ?? 'diff';

const db = await connect();
const [rows] = await db.query(
  `SELECT slug, ref, category, subcategory, brand_id, published,
          name_en, name_ar, type_en, type_ar, description_en, description_ar, hero_image, data
     FROM products ORDER BY slug`
);
await db.end();
const now = Object.fromEntries(rows.map((r) => [r.slug, {
  ...r, data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
}]));

const empty = (v) => v === '' || v == null || (Array.isArray(v) && v.length === 0);
const canon = (v) => {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().filter((k) => !empty(v[k])).map((k) => [k, canon(v[k])]));
  }
  return v;
};
const S = (v) => JSON.stringify(canon(v));

if (mode === 'save') {
  fs.writeFileSync(FILE, JSON.stringify(now, null, 1), 'utf8');
  log.ok(`لقطة لـ ${Object.keys(now).length} منتج`);
  process.exit(0);
}

if (!fs.existsSync(FILE)) { log.fail('لا لقطة — شغّل save أولًا'); process.exit(1); }
const before = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let bad = 0;
for (const [slug, b] of Object.entries(before)) {
  const a = now[slug];
  if (!a) { log.fail(`المنتج ${slug} اختفى`); bad++; continue; }
  if (S(a) === S(b)) continue;
  bad++;
  log.fail(`المنتج ${slug} اختلف`);
  for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (S(b[k]) === S(a[k])) continue;
    if (k === 'data') {
      for (const dk of new Set([...Object.keys(b.data ?? {}), ...Object.keys(a.data ?? {})])) {
        if (S(b.data?.[dk]) === S(a.data?.[dk])) continue;
        log.info(`  data.${dk}:`);
        log.info(`    قبل : ${String(S(b.data?.[dk])).slice(0, 220)}`);
        log.info(`    بعد : ${String(S(a.data?.[dk])).slice(0, 220)}`);
      }
      continue;
    }
    log.info(`  ${k}: قبل «${String(S(b[k])).slice(0, 120)}» بعد «${String(S(a[k])).slice(0, 120)}»`);
  }
}
if (bad) log.fail(`${bad} منتج اختلف`);
else log.ok(`${Object.keys(before).length} منتج — لا فرق`);
process.exit(bad ? 1 : 0);
