/* =============================================================================
   المرحلة 1 — إنشاء المتجر (يُشغَّل مرة، وتشغيله ثانيةً لا يكرّر شيئًا).

   • صفحة store.html بقالب store، منشورة، بعنوان ووصف تُعدَّل من «الصفحات».
   • رابط «المتجر» في المنيو العلوي بعد «حلول الطاقة» (يُنقل من «المنيو والفوتر»).
   • نصوص المتجر (store.*) في الترجمة، فتُعدَّل من «نصوص الأزرار والترجمة».
   • كل ما يُضاف يُسجَّل في «التراجع عن تعديل» كـ«لم يكن موجودًا»، فيُحذف بخطوة.

   القفل والفتح من «المتجر» في لوحة التحكم، لا من هنا.
   node scripts/setup-store.mjs
============================================================================= */
import fs from 'node:fs';
import { connect, log } from './lib.mjs';

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];
const [owner] = await q('SELECT id FROM users ORDER BY is_owner DESC, id LIMIT 1');

log.step('صفحة المتجر');
let [page] = await q("SELECT id FROM pages WHERE slug = 'store'");
if (page) log.ok('موجودة من قبل — لا تغيير');
else {
  const [{ n }] = await q('SELECT COALESCE(MAX(position), 0) + 1 n FROM pages');
  const hero = {
    kicker: { en: 'Store', ar: 'المتجر' },
    title: { en: 'Equipment & spare parts', ar: 'المعدات وقطع الغيار' },
    lede: {
      en: 'Every generator, environmental unit and genuine spare part we supply — in one place. Add what you need to your quote request and our sales team will reply with prices and availability.',
      ar: 'كل المولدات والمعدات البيئية وقطع الغيار الأصلية التي نوردها في مكان واحد. أضف ما تحتاجه لطلب عرض السعر، ويرد عليك فريق المبيعات بالأسعار والتوافر.',
    },
  };
  const res = await q(
    `INSERT INTO pages (slug, template, position, published, crumb_en, crumb_ar, title_en, description_en, title_ar, description_ar, hero, quote_solution)
     VALUES ('store', 'store', ?, 1, 'Store', 'المتجر', ?, ?, ?, ?, ?, NULL)`,
    [n, 'Store — Equipment & Spare Parts | 5A&M',
     'Browse 5A&M generators, environmental equipment and genuine spare parts, and request a quote for several items at once.',
     'المتجر — المعدات وقطع الغيار | 5A&M',
     'تصفح مولدات 5A&M والمعدات البيئية وقطع الغيار الأصلية، واطلب عرض سعر لأكثر من منتج مرة واحدة.',
     JSON.stringify(hero)]
  );
  page = { id: res.insertId };
  await q('INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)',
    ['page', page.id, JSON.stringify({ absent: true, ids: { pages: [page.id] } }), owner?.id ?? null]);
  log.ok(`أُنشئت (#${page.id})`);
}

log.step('رابط المنيو العلوي');
const [link] = await q("SELECT id FROM nav_items WHERE area = 'header' AND href IN ('store.html', '/store.html')");
if (link) log.ok('موجود من قبل — لا تغيير');
else {
  const tops = await q("SELECT * FROM nav_items WHERE area = 'header' AND parent_id IS NULL ORDER BY position, id");
  const power = tops.find((r) => r.href === 'power.html' || r.label_ar === 'حلول الطاقة');
  const at = power ? power.position + 1 : tops.length;
  /* نسخة المنيو كما كان قبل الإضافة، فيرجع بخطوة */
  const before = await q("SELECT * FROM nav_items WHERE area = 'header'");
  await q("UPDATE nav_items SET position = position + 1 WHERE area = 'header' AND parent_id IS NULL AND position >= ?", [at]);
  const res = await q(
    "INSERT INTO nav_items (area, parent_id, position, label_en, label_ar, href, published) VALUES ('header', NULL, ?, 'Store', 'المتجر', 'store.html', 1)",
    [at]
  );
  await q('INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)',
    ['nav', tops[0]?.id ?? 0, JSON.stringify({ absent: true, ids: { nav_items: [res.insertId] }, bundle: { nav_items: before }, note: 'nav' }), owner?.id ?? null]);
  log.ok(`أُضيف بعد «${power?.label_ar ?? 'آخر رابط'}»`);
}

log.step('نصوص المتجر في الترجمة');
/* القائمة نفسها التي في components/site/Store.tsx (STORE_TEXT) */
const src = fs.readFileSync(new URL('../components/site/Store.tsx', import.meta.url), 'utf8');
const pairs = [...src.matchAll(/'(store\.[\w.]+)':\s*\['((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\]/g)];
let added = 0;
for (const [, key, en, ar] of pairs) {
  const r = await q("INSERT IGNORE INTO translations (`key`, en, ar, `group`) VALUES (?, ?, ?, 'store')", [key, en, ar]);
  added += r.affectedRows;
}
log.ok(`${added} نص جديد من ${pairs.length}`);

/* إعداد المتجر موجود من migrate-phase1؛ يُضمن هنا إن لم يُشغَّل */
await q(`INSERT IGNORE INTO settings (\`key\`, \`value\`, \`group\`, label_en, label_ar)
         VALUES ('store', JSON_OBJECT('enabled', true, 'closed', 'home'), 'store', 'Store', 'المتجر')`);
await db.end();
log.step('تم');
