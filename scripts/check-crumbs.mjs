/* يبيّن أي المنتجات تغيّر مسار تنقّلها بعد ربط المسار بالصفحة التي تعرضه.
   node scripts/check-crumbs.mjs */
import { connect, log } from './lib.mjs';

const db = await connect();
const [secs] = await db.query(
  `SELECT p.slug, p.crumb_ar, s.content FROM sections s JOIN pages p ON p.id = s.page_id
    WHERE s.type = 'products' AND s.published = 1 AND p.published = 1 AND p.redirect_to IS NULL
    ORDER BY p.position`
);
const parent = {};
for (const x of secs) {
  const c = typeof x.content === 'string' ? JSON.parse(x.content) : x.content;
  for (const id of c.ids || []) if (!parent[id]) parent[id] = { page: x.slug, crumb: x.crumb_ar };
}

const [prods] = await db.query(
  'SELECT ref, name_ar, name_en, category, subcategory FROM products WHERE published = 1 ORDER BY position'
);
await db.end();

log.step('المسار الجديد (الرئيسية / الصفحة / المنتج)');
let n = 0;
for (const p of prods) {
  if (!parent[p.ref]) continue;
  n++;
  log.info(`${p.ref.padEnd(26)} → ${parent[p.ref].crumb}`);
}
log.ok(`${n} من ${prods.length} منتج`);

const rest = prods.filter((p) => !parent[p.ref]);
if (rest.length) {
  log.step('بلا تغيير — تبقى على كتالوج المعدات');
  rest.forEach((p) => log.info(`${p.ref.padEnd(26)} (${p.subcategory})`));
}
