/* يقارن ما في قاعدة البيانات بالمصدر حقلًا بحقل، ويُبلغ عن أي اختلاف. */
import fs from 'node:fs';
import path from 'node:path';
import { connect, log } from './lib.mjs';

const data = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'extracted.json'), 'utf8'));
const db = await connect();
let bad = 0;
const check = (ok, what, extra = '') => { if (ok) return; bad++; log.fail(`${what} ${extra}`); };

/* MySQL يعيد ترتيب مفاتيح JSON عند التخزين، فالمقارنة تتم بعد ترتيب موحّد
   للطرفين. القيم نفسها هي المهمة، لا ترتيب المفاتيح.

   والمفتاح الغائب والقيمة الفارغة سواء: العرض يقرأ الاثنين واحدًا
   (`s.v == null ? 'عند الطلب' : s.v`)، ومحرّر الداش بورد يحذف الفراغ بدل أن
   يخزّنه. فالتسوية هنا كي يبقى هذا الفحص كاشفًا لفقد المحتوى وحده. */
const empty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
const canon = (v) => {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v).sort().filter((k) => !empty(v[k])).map((k) => [k, canon(v[k])])
    );
  }
  return v;
};
/* القيمة الغائبة والقائمة الفارغة سواء عند الطرفين أيضًا، لا داخل الكائنات فقط. */
const norm = (v) => (empty(v) ? null : canon(v));
const same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

/* ------------------------------------------------------------ الصفحات */
log.step('الصفحات والسكاشن');
const [rows] = await db.query(
  `SELECT p.slug, p.crumb_en, p.crumb_ar, p.hero,
          (SELECT COUNT(*) FROM sections s WHERE s.page_id = p.id) AS n
     FROM pages p`
);
const bySlug = Object.fromEntries(rows.map((r) => [r.slug, r]));
for (const [slug, pg] of Object.entries(data.pages)) {
  const r = bySlug[slug];
  check(!!r, `الصفحة ${slug} غير موجودة`);
  if (!r) continue;
  const want = (pg.sections || []).length;
  check(r.n === want, `${slug}: عدد السكاشن`, `(قاعدة ${r.n} ≠ مصدر ${want})`);
  check(r.crumb_ar === (pg.crumb?.ar ?? null), `${slug}: اسم المسار بالعربي`);
  if (pg.hero) {
    const h = typeof r.hero === 'string' ? JSON.parse(r.hero) : r.hero;
    check(h?.img === pg.hero.img, `${slug}: صورة الهيرو`);
    check((h?.title?.ar ?? null) === (pg.hero.title?.ar ?? null), `${slug}: عنوان الهيرو بالعربي`);
  }
}
log.ok(`${Object.keys(data.pages).length} صفحة`);

/* -------- مقارنة محتوى كل سيكشن بالكامل: أي فرق في أي حقل يظهر هنا -------- */
log.step('محتوى السكاشن (مقارنة كاملة)');
let nSec = 0;
for (const [slug, pg] of Object.entries(data.pages)) {
  const [secs] = await db.query(
    `SELECT s.type, s.anchor, s.content FROM sections s
       JOIN pages p ON p.id = s.page_id WHERE p.slug = ? ORDER BY s.position`,
    [slug]
  );
  (pg.sections || []).forEach((src, i) => {
    const got = secs[i];
    if (!got) { check(false, `${slug}[${i}]: سيكشن ناقص`); return; }
    check(got.type === src.type, `${slug}[${i}]: النوع`, `(${got.type} ≠ ${src.type})`);
    check((got.anchor ?? null) === (src.id ?? null), `${slug}[${i}]: المرساة`);
    const { type, id, ...want } = src;
    const have = typeof got.content === 'string' ? JSON.parse(got.content) : got.content;
    if (!same(want, have)) {
      const wk = Object.keys(want).sort().join(','), hk = Object.keys(have).sort().join(',');
      check(false, `${slug}[${i}] (${src.type}): المحتوى مختلف`,
        wk !== hk ? `(حقول: مصدر [${wk}] ≠ قاعدة [${hk}])` : '(قيمة مختلفة)');
    }
    nSec++;
  });
}
log.ok(`${nSec} سيكشن مطابق`);

/* ------------------------------------------------------------ المنتجات */
log.step('المنتجات');
const [prods] = await db.query('SELECT ref, slug, name_en, name_ar, description_en, hero_image, data FROM products');
const byRef = Object.fromEntries(prods.map((r) => [r.ref, r]));
for (const p of data.site.products) {
  const r = byRef[p.id];
  check(!!r, `المنتج ${p.id} غير موجود`);
  if (!r) continue;
  check(r.slug === p.slug, `${p.id}: المعرّف`);
  check(r.name_en === (p.name ?? null), `${p.id}: الاسم`);
  check(r.description_en === (p.description ?? null), `${p.id}: الوصف`);
  check(r.hero_image === (p.heroImage ?? null), `${p.id}: الصورة الرئيسية`);
  const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  check(d.gallery.length === (p.gallery ?? []).length, `${p.id}: عدد الصور`);
  check(same(d.specifications, p.specifications ?? []), `${p.id}: المواصفات`);
  check(same(d.features, p.features ?? []), `${p.id}: المميزات`);
  check(same(d.applications, p.applications ?? []), `${p.id}: الاستخدامات`);
  check(same(d.downloads, p.downloads ?? []), `${p.id}: الملفات`);
  check(same(d.videos, p.videos ?? []), `${p.id}: الفيديوهات`);
  check(same(d.related, p.related ?? []), `${p.id}: المنتجات المرتبطة`);
  /* الشرائح تُقارن بترتيبها لا بمحتواها فقط: ترتيبها هو ما يظهر على الشاشة. */
  const metaSrc = Object.entries(p.meta ?? {}).map(([k, v]) => ({ k, v }));
  check(JSON.stringify(d.meta ?? []) === JSON.stringify(metaSrc), `${p.id}: الشرائح وترتيبها`);
}
log.ok(`${data.site.products.length} منتج`);

/* ------------------------------------------------------------- الترجمة */
log.step('الترجمة');
const [[{ n: nUI }]] = await db.query("SELECT COUNT(*) n FROM translations WHERE `group` <> 'phrase'");
const [[{ n: nPh }]] = await db.query("SELECT COUNT(*) n FROM translations WHERE `group` = 'phrase'");
check(nUI === Object.keys(data.arUI).length, 'عدد مفاتيح الواجهة', `(${nUI} ≠ ${Object.keys(data.arUI).length})`);
log.ok(`${nUI} مفتاح · ${nPh} جملة`);
const [[t1]] = await db.query("SELECT ar FROM translations WHERE `key` = 'nav.about'");
check(t1?.ar === data.arUI['nav.about'], 'nav.about');

/* ------------------------------------------------- سلامة الترميز العربي */
log.step('سلامة النص العربي بعد الحفظ');
/* المقارنة ثنائية: الترتيب الافتراضي لا يفرّق بين الحروف اللاتينية وما يشبهها
   من حروف عربية، فكان يبلّغ عن تلف وهمي. */
const [[{ mangled }]] = await db.query(
  "SELECT COUNT(*) AS mangled FROM translations " +
  "WHERE ar COLLATE utf8mb4_bin LIKE '%Ã%' OR ar COLLATE utf8mb4_bin LIKE '%Ø§%' OR ar COLLATE utf8mb4_bin LIKE '%Ù%'"
);
check(mangled === 0, 'صفوف بترميز تالف', `(${mangled})`);
/* مقارنة فعلية بين نص في قاعدة البيانات ونظيره في المصدر */
const sample = Object.entries(data.arUI).slice(0, 200);
let mismatched = 0;
for (const [k, v] of sample) {
  const [[row]] = await db.query('SELECT ar FROM translations WHERE `key` = ?', [k]);
  if (!row || row.ar !== v) mismatched++;
}
check(mismatched === 0, 'نصوص عربية مختلفة عن المصدر', `(${mismatched} من ${sample.length})`);
log.ok(`${sample.length} نص عربي مطابق للمصدر حرفًا بحرف`);

/* ------------------------------------------------------------- الحصيلة */
console.log('');
if (bad === 0) log.ok('\u001b[32mمطابقة تامة — لم يضع أي حقل\u001b[0m');
else log.fail(`\u001b[31m${bad} اختلاف\u001b[0m`);
await db.end();
process.exit(bad ? 1 : 0);
