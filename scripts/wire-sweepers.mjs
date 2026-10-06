/* =============================================================================
   يربط السلسلة:  حلول البيئة  →  مكانس الطرق (3 كروت)  →  صفحة الموديل.

   يفعل ثلاثة أشياء:
   1) يجعل كروت الصفحة الجديدة بشكل «موديلات»: الماركة والنوع وزرّ المواصفات.
   2) ينشر الصفحة.
   3) يحوّل زرّ «اعرض المعدة» في قسم مكانس الطرق من منتج واحد إلى الصفحة.

   كل خطوة تُطبع، ويمكن التراجع عنها من سجل التعديلات أو بتعديل القسم.
============================================================================= */
import { connect, log } from './lib.mjs';

const db = await connect();

/* --------------------------------------------------- 1) شكل الكروت */
const [[pg]] = await db.query('SELECT id FROM pages WHERE slug = ?', ['elgin-sweepers']);
if (!pg) { log.fail('صفحة elgin-sweepers غير موجودة — شغّل make-sweepers-page.mjs'); process.exit(1); }

const [[sec]] = await db.query(
  "SELECT id, content FROM sections WHERE page_id = ? AND type = 'products'", [pg.id]
);
const c = typeof sec.content === 'string' ? JSON.parse(sec.content) : sec.content;
c.style = 'models';
await db.execute('UPDATE sections SET content = ? WHERE id = ?', [JSON.stringify(c), sec.id]);
log.ok(`شكل الكروت: موديلات · ${c.ids.length} كروت — ${c.ids.join(' · ')}`);

/* ------------------------------------------------------- 2) النشر */
await db.execute('UPDATE pages SET published = 1 WHERE id = ?', [pg.id]);
log.ok('نُشرت صفحة «مكانس الطرق»');

/* ------------------------- 3) زرّ «اعرض المعدة» ينقل إلى الصفحة */
const [[envSec]] = await db.query(
  `SELECT s.id, s.content FROM sections s JOIN pages p ON p.id = s.page_id
    WHERE p.slug = 'environment' AND s.position = 0`
);
const e = typeof envSec.content === 'string' ? JSON.parse(envSec.content) : envSec.content;
/* نسخة قبل التغيير كي يمكن الرجوع */
await db.execute(
  'INSERT INTO revisions (entity, entity_id, snapshot) VALUES (?,?,?)',
  ['section', envSec.id, JSON.stringify({ id: envSec.id, content: e })]
);
delete e.product;                       // كان ينقل إلى موديل واحد
e.cta = {
  href: 'elgin-sweepers.html',
  label: { ar: 'اعرض المعدة', en: 'See the equipment' },
};
await db.execute('UPDATE sections SET content = ? WHERE id = ?', [JSON.stringify(e), envSec.id]);
log.ok('زرّ «اعرض المعدة» صار ينقل إلى صفحة مكانس الطرق');

await db.end();
log.step('السلسلة');
log.info('  حلول البيئة  →  مكانس الطرق (3 كروت)  →  صفحة الموديل');
