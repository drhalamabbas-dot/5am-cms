/* عرض سريع لمحتوى جدول — للفحص أثناء التطوير.
   الاستعمال:  node scripts/peek.mjs nav|pages|products|settings */
import { connect } from './lib.mjs';

const what = process.argv[2] || 'nav';
const db = await connect();

if (what === 'nav') {
  const [rows] = await db.query(
    "SELECT id, parent_id, area, position, label_en, label_ar, href, extra FROM nav_items ORDER BY area, position, id"
  );
  const kids = (id) => rows.filter((r) => r.parent_id === id);
  for (const area of ['header', 'footer']) {
    console.log(`\n=== ${area}`);
    for (const t of rows.filter((r) => r.area === area && r.parent_id === null)) {
      const e = typeof t.extra === 'string' ? JSON.parse(t.extra || '{}') : (t.extra || {});
      console.log(`  ${(t.label_en || '').padEnd(26)} | ${t.label_ar || '(فارغ)'}   ${e.kind ? '[' + e.kind + ']' : ''}`);
      for (const c of kids(t.id)) {
        console.log(`     └ ${(c.label_en || '').padEnd(23)} | ${c.label_ar || '(فارغ)'}`);
        for (const g of kids(c.id)) console.log(`         · ${(g.label_en || '').padEnd(20)} | ${g.label_ar || '(فارغ)'}`);
      }
    }
  }
} else if (what === 'pages') {
  const [rows] = await db.query(
    'SELECT p.slug, p.crumb_en, p.crumb_ar, p.redirect_to, COUNT(s.id) n FROM pages p LEFT JOIN sections s ON s.page_id=p.id GROUP BY p.id ORDER BY p.position'
  );
  for (const r of rows) console.log(`  ${r.slug.padEnd(18)} ${String(r.n).padStart(2)} سيكشن  ${r.crumb_ar || ''} ${r.redirect_to ? '→ ' + r.redirect_to : ''}`);
} else if (what === 'products') {
  const [rows] = await db.query('SELECT ref, slug, name_en, name_ar, category FROM products ORDER BY position');
  for (const r of rows) console.log(`  ${r.ref.padEnd(26)} ${(r.name_en || '').slice(0, 40).padEnd(42)} ${r.name_ar || '(فارغ)'}`);
} else if (what === 'settings') {
  const [rows] = await db.query('SELECT `key`, `group`, CHAR_LENGTH(`value`) len FROM settings ORDER BY `group`, `key`');
  for (const r of rows) console.log(`  ${r.key.padEnd(18)} ${String(r.group).padEnd(10)} ${r.len} حرف`);
}
await db.end();
