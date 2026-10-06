/* فجوات المحتوى لتقرير الحالة: روابط المنيو إلى صفحات بعينها، ونصوص بلا
   ترجمة.   node scripts/report-gaps.mjs */
import { connect } from './lib.mjs';
const db = await connect();
const [nav] = await db.query(
  "SELECT label_ar, href, area, published FROM nav_items WHERE href LIKE 'elegin%' OR href LIKE 'elgin-sweepers%' OR href LIKE 'social%'"
);
const [miss] = await db.query(
  "SELECT `key`, en FROM translations WHERE `group` <> 'phrase' AND (ar IS NULL OR ar = '')"
);
await db.end();
console.log(JSON.stringify({ nav, missingArabic: miss }, null, 1));
