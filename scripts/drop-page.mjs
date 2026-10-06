/* يحذف صفحة ورابطها من المنيو — لتنظيف صفحات التجربة.
   node scripts/drop-page.mjs walk-test */
import { connect, log } from './lib.mjs';

const slug = process.argv[2];
if (!slug) { log.fail('اكتب مسار الصفحة'); process.exit(1); }

const db = await connect();
const [nav] = await db.execute('DELETE FROM nav_items WHERE href LIKE ?', [`${slug}.html%`]);
const [pg] = await db.execute('DELETE FROM pages WHERE slug = ?', [slug]);
const [[p]] = await db.query('SELECT COUNT(*) n FROM pages');
const [[s]] = await db.query('SELECT COUNT(*) n FROM sections');
await db.end();

log.ok(`حُذفت ${pg.affectedRows} صفحة و${nav.affectedRows} رابط منيو`);
log.info(`المتبقّي: ${p.n} صفحة · ${s.n} قسم`);
