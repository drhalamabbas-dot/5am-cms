/* يطبع محتوى قسم بعينه كاملًا.  node scripts/peek-section.mjs <صفحة> <رقم الترتيب> */
import { connect, log } from './lib.mjs';

const [slug, pos] = process.argv.slice(2);
const db = await connect();
const [[p]] = await db.query('SELECT id FROM pages WHERE slug = ?', [slug]);
if (!p) { log.fail('صفحة غير موجودة'); await db.end(); process.exit(1); }
const [rows] = await db.query(
  pos == null
    ? 'SELECT id, position, type, anchor, content FROM sections WHERE page_id = ? ORDER BY position'
    : 'SELECT id, position, type, anchor, content FROM sections WHERE page_id = ? AND position = ?',
  pos == null ? [p.id] : [p.id, Number(pos)]
);
await db.end();
for (const r of rows) {
  log.ok(`#${r.id} · ${r.type} · موضع ${r.position}${r.anchor ? ' · #' + r.anchor : ''}`);
  const c = typeof r.content === 'string' ? JSON.parse(r.content) : r.content;
  console.log(JSON.stringify(c, null, 1));
}
