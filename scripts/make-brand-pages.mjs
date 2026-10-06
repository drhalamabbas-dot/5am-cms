/* =============================================================================
   صفحات وسيطة لـ Vactor و Guzzler على نمط «مكانس الطرق»:
     حلول البيئة  →  صفحة الماركة (كروت موديلات)  →  صفحة الموديل

   لكل ماركة: صفحة بأعلى مأخوذ من قسمها في «حلول البيئة»، وكروت منتجاتها
   بشكل «موديلات»، وشريط تواصل. ثم يصير زرّ «اعرض المعدة» في قسمها ينقل إلى
   الصفحة بدل موديل واحد.

   كله في معاملة واحدة، ومعه في السجل: «لم تكن موجودة» لكل صفحة جديدة، ونسخة
   من كل قسم قبل تغيير زرّه — فيُتراجع عن أي جزء من «سجل التعديلات».
   ما وُجد من قبل لا يُعاد إنشاؤه.

   node scripts/make-brand-pages.mjs
============================================================================= */
import { connect, log } from './lib.mjs';

const PAGES = [
  {
    slug: 'vactor-units', anchor: 'vactor', brand: 'vactor',
    crumb: { ar: 'وحدات الطرق والبنية التحتية', en: 'Road & infrastructure units' },
    title_en: 'Vactor sewer & infrastructure units | 5A&M',
    description_en: 'Vactor combination units 5A&M supplies in Egypt for sewer cleaning, catch-basin cleaning and hydro-excavation.',
    cta: {
      title: { ar: 'لست متأكدًا أي وحدة تناسب شبكتك؟', en: 'Not sure which unit suits your network?' },
      text: {
        ar: 'أخبرنا بأقطار الخطوط وطبيعة الرواسب وعمق الشبكة، ونرشّح لك الوحدة المناسبة.',
        en: 'Tell us the line diameters, the debris and the network depth, and we will recommend the right unit.',
      },
    },
  },
  {
    slug: 'guzzler-vacuums', anchor: 'guzzler', brand: 'guzzler',
    crumb: { ar: 'معدات الشفط الصناعي', en: 'Industrial vacuum equipment' },
    title_en: 'Guzzler industrial vacuum loaders | 5A&M',
    description_en: 'Guzzler industrial vacuum loaders 5A&M supplies in Egypt for industrial, environmental and material-recovery work.',
    cta: {
      title: { ar: 'لست متأكدًا أي معدة شفط تناسب موقعك؟', en: 'Not sure which vacuum loader suits your site?' },
      text: {
        ar: 'أخبرنا بنوع المادة المسحوبة والمسافة وظروف التشغيل، ونرشّح لك المعدة المناسبة.',
        en: 'Tell us the material, the distance and the operating conditions, and we will recommend the right loader.',
      },
    },
  },
];

const J = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const db = await connect();
const [[user]] = await db.query('SELECT id FROM users ORDER BY id LIMIT 1');
await db.beginTransaction();
try {
  for (const P of PAGES) {
    log.step(P.crumb.ar);
    const [[env]] = await db.query(
      `SELECT s.* FROM sections s JOIN pages p ON p.id = s.page_id
        WHERE p.slug = 'environment' AND s.anchor = ? FOR UPDATE`, [P.anchor]);
    if (!env) { log.fail(`قسم ${P.anchor} غير موجود في حلول البيئة — تخطّيته`); continue; }
    const src = J(env.content);

    /* كروت الماركة: منتجاتها المنشورة بترتيبها */
    const [prods] = await db.query(
      `SELECT p.ref FROM products p JOIN brands b ON b.id = p.brand_id
        WHERE b.slug = ? AND p.published = 1 ORDER BY p.position, p.id`, [P.brand]);
    const ids = prods.map((r) => r.ref);

    const [[exists]] = await db.query('SELECT id FROM pages WHERE slug = ?', [P.slug]);
    if (exists) {
      log.warn(`الصفحة ${P.slug} موجودة بالفعل — لم تُغيَّر`);
    } else {
      const [[pos]] = await db.query("SELECT position + 1 n FROM pages WHERE slug = 'elgin-sweepers'");
      const [res] = await db.query(
        `INSERT INTO pages (slug, template, position, published, crumb_en, crumb_ar, parent_slug,
                            title_en, description_en, hero)
         VALUES (?, 'sections', ?, 1, ?, ?, 'environment', ?, ?, ?)`,
        [P.slug, pos?.n ?? 0, P.crumb.en, P.crumb.ar, P.title_en, P.description_en,
         JSON.stringify({ img: src.img, title: src.title, lede: src.text })]);
      const pageId = res.insertId;
      await db.query(
        'INSERT INTO sections (page_id, type, anchor, position, published, content) VALUES (?,?,?,?,1,?)',
        [pageId, 'products', 'models', 0, JSON.stringify({ ids, style: 'models' })]);
      await db.query(
        'INSERT INTO sections (page_id, type, position, published, content) VALUES (?,?,?,1,?)',
        [pageId, 'cta', 1, JSON.stringify(P.cta)]);
      await db.query('INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)',
        ['page', pageId, JSON.stringify({ absent: true, ids: { pages: [pageId] } }), user.id]);
      log.ok(`أُنشئت ${P.slug}.html ومنشورة — ${ids.length} كارت: ${ids.join(' · ')}`);
    }

    /* زرّ «اعرض المعدة» في حلول البيئة: إلى الصفحة بدل موديل واحد */
    if (src.cta?.href === `${P.slug}.html`) { log.warn('الزرّ ينقل إلى الصفحة بالفعل'); continue; }
    await db.query('INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)',
      ['section', env.id, JSON.stringify(env), user.id]);
    const next = { ...src };
    delete next.product;
    next.cta = { href: `${P.slug}.html`, label: { ar: 'اعرض المعدة', en: 'See the equipment' } };
    await db.query('UPDATE sections SET content = ? WHERE id = ?', [JSON.stringify(next), env.id]);
    log.ok(`زرّ «اعرض المعدة» في «${src.title?.ar}» صار ينقل إلى ${P.slug}.html`);
  }
  await db.commit();
} catch (e) {
  await db.rollback();
  log.fail(`لم يتغيّر شيء: ${e.message}`);
  process.exitCode = 1;
}
await db.end();
