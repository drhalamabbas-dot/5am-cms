/* يطبع أقسام صفحة بترتيبها.  node scripts/peek-page.mjs training-centre */
import { connect, log } from './lib.mjs';

const slug = process.argv[2];
const db = await connect();
const [[p]] = await db.query('SELECT id, published FROM pages WHERE slug = ?', [slug]);
if (!p) { log.fail('صفحة غير موجودة'); await db.end(); process.exit(1); }
const [rows] = await db.query(
  'SELECT id, position, type, content FROM sections WHERE page_id = ? ORDER BY position', [p.id]
);
await db.end();

log.ok(`${slug} — ${p.published ? 'منشورة' : 'مسوّدة'} · ${rows.length} قسم`);
for (const r of rows) {
  const c = typeof r.content === 'string' ? JSON.parse(r.content) : r.content;
  const t = c?.title?.ar || c?.title?.en || '(فارغ)';
  log.info(`${String(r.position).padStart(2)}  ${String(r.type).padEnd(10)} ${t}`);
}
