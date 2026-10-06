/* يقارن منتجًا في القاعدة بمصدره في extracted.json، عنصرًا بعنصر.
   ترتيب مفاتيح كائن JSON لا معنى له، فيُوحَّد قبل المقارنة؛ وما يبقى مختلفًا
   فرقٌ حقيقي.  node scripts/diff-product.mjs elgin-whirlwind */
import fs from 'node:fs';
import path from 'node:path';
import { connect, log } from './lib.mjs';

const ref = process.argv[2];
const src = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'extracted.json'), 'utf8'))
  .site.products.find((p) => p.id === ref || p.slug === ref);
if (!src) { log.fail('غير موجود في المصدر'); process.exit(1); }

const db = await connect();
const [[row]] = await db.query('SELECT data FROM products WHERE ref = ?', [src.id]);
await db.end();
const now = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;

const canon = (v) => {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  }
  return v;
};
const S = (v) => JSON.stringify(canon(v));

for (const k of ['gallery', 'specifications', 'features', 'applications', 'downloads', 'videos', 'related']) {
  const a = src[k] ?? [];
  const b = now[k] ?? [];
  if (S(a) === S(b)) continue;
  log.fail(`${k}: ${a.length} في المصدر · ${b.length} في القاعدة`);
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (S(a[i]) === S(b[i])) continue;
    log.info(`  [${i}] المصدر : ${String(S(a[i])).slice(0, 220)}`);
    log.info(`  [${i}] القاعدة: ${String(S(b[i])).slice(0, 220)}`);
  }
}
