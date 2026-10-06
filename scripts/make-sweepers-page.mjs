/* =============================================================================
   ينشئ صفحة «مكانس الطرق» الوسيطة بين «حلول البيئة» وصفحات المنتجات.

   المشكلة التي تحلّها: قسم «مكانس الطرق» في صفحة حلول البيئة كان زرّه ينقل
   إلى موديل واحد (Crosswind) مباشرةً، فيبقى الموديلان الآخران — Whirlwind
   و Pelican — بلا طريق إليهما من الصفحة.

   تُنشأ مسوّدة: لا يراها الزائر حتى تُنشر من الداش بورد.

   node scripts/make-sweepers-page.mjs
============================================================================= */
import { connect, log } from './lib.mjs';

const SLUG = 'elgin-sweepers';
const db = await connect();

const [[exists]] = await db.query('SELECT id FROM pages WHERE slug = ?', [SLUG]);
if (exists) {
  log.warn(`الصفحة ${SLUG} موجودة بالفعل — لم يُغيَّر شيء.`);
  await db.end();
  process.exit(0);
}

/* الهيرو مأخوذ من القسم نفسه في صفحة حلول البيئة، فيتّصل المشهدان */
const [[envSec]] = await db.query(
  `SELECT s.content FROM sections s JOIN pages p ON p.id = s.page_id
    WHERE p.slug = 'environment' AND s.position = 0`
);
const src = typeof envSec.content === 'string' ? JSON.parse(envSec.content) : envSec.content;

const [[pos]] = await db.query('SELECT COALESCE(MAX(position),0)+1 n FROM pages');
await db.execute(
  `INSERT INTO pages
     (slug, template, position, published, crumb_en, crumb_ar, parent_slug,
      title_en, description_en, hero)
   VALUES (?, 'sections', ?, 0, ?, ?, 'environment', ?, ?, ?)`,
  [
    SLUG, pos.n,
    'Road sweepers', 'مكانس الطرق',
    'Elgin road sweepers — Crosswind, Whirlwind and Pelican | 5A&M',
    'The three Elgin street sweeper ranges 5A&M supplies in Egypt: regenerative air, pure vacuum and mechanical broom.',
    JSON.stringify({
      img: src.img,
      title: src.title,
      lede: src.text,
    }),
  ]
);
const [[page]] = await db.query('SELECT id FROM pages WHERE slug = ?', [SLUG]);

/* القسم الأول: الكروت الثلاثة. نوع products يسحب الصورة والاسم والوصف من
   المنتجات نفسها، فتعديل المنتج يظهر هنا بلا عمل إضافي. */
await db.execute(
  'INSERT INTO sections (page_id, type, anchor, position, published, content) VALUES (?,?,?,?,1,?)',
  [
    page.id, 'products', 'models', 0,
    JSON.stringify({
      title: { ar: 'الموديلات التي نورّدها', en: 'The models we supply' },
      note: {
        ar: 'ثلاثة مديات من Elgin، يختلف كلٌّ منها بطريقة الكنس: الهواء المتجدد، والشفط الكامل، والفرشاة الميكانيكية.',
        en: 'Three Elgin ranges, each with a different sweeping method: regenerative air, pure vacuum and mechanical broom.',
      },
      ids: ['elgin-crosswind', 'elgin-whirlwind', 'elgin-pelican'],
    }),
  ]
);

/* القسم الثاني: دعوة للتواصل، كما في بقية صفحات الخدمات */
await db.execute(
  'INSERT INTO sections (page_id, type, position, published, content) VALUES (?,?,?,1,?)',
  [
    page.id, 'cta', 1,
    JSON.stringify({
      title: { ar: 'لست متأكدًا أي مكنسة تناسب طريقك؟', en: 'Not sure which sweeper suits your route?' },
      text: {
        ar: 'أخبرنا بنوع المخلفات وطبيعة الطريق وساعات التشغيل، ونرشّح لك المدى المناسب.',
        en: 'Tell us the debris type, the route and the operating hours, and we will recommend the right range.',
      },
    }),
  ]
);

log.ok(`أُنشئت «مكانس الطرق» (${SLUG}) — مسوّدة، بقسمين`);
log.info('الكروت: Crosswind · Whirlwind · Pelican');
log.info(`عاينها: http://localhost:3000/${SLUG}.html?lang=ar`);
log.info('لنشرها: الداش بورد ← الصفحات ← مكانس الطرق ← «انشر الآن»');

await db.end();
