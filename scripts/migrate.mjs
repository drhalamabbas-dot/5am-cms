/* =============================================================================
   يُدخل المحتوى المستخرج في قاعدة البيانات.

   مبدأ: نقل حرفي. لا يُعاد صوغ نص، ولا يُختصر، ولا يُخترع. ما لا يوجد له
   مقابل عربي يُترك فارغًا بدل أن يُترجم هنا.

   آمن للتشغيل أكثر من مرة: يفرّغ الجداول ثم يعيد البناء من المصدر.
============================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { connect, log } from './lib.mjs';

const SRC = process.env.SITE_SRC
  || 'C:\\Users\\Mohamed Nagy\\OneDrive - Arab Open University - AOU\\Desktop\\5am-website - Copy';
const data = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'extracted.json'), 'utf8'));
const { site, arUI, arPhrases, pages } = data;

const db = await connect();
await db.query('SET NAMES utf8mb4');

/* العربية في الموقع الحالي تُستخرج بمطابقة الجملة الإنجليزية. */
const ar = (en) => (typeof en === 'string' && arPhrases[en]) || null;
/* الحقول ثنائية اللغة مخزّنة أصلًا {en, ar}؛ وما عداها نص إنجليزي مفرد. */
const en_ = (v) => (v && typeof v === 'object' && 'en' in v ? v.en : v) ?? null;
const ar_ = (v) => (v && typeof v === 'object' && 'ar' in v ? v.ar : ar(v)) ?? null;
const J = (v) => (v === undefined ? null : JSON.stringify(v));

/* ----------------------------------------------- بيانات SEO من ملفات HTML */
function metaOf(slug) {
  const file = path.join(SRC, `${slug}.html`);
  if (!fs.existsSync(file)) return {};
  const html = fs.readFileSync(file, 'utf8');
  const pick = (re) => (html.match(re)?.[1] ?? null);
  const unescape = (s) => s && s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return {
    title: unescape(pick(/<title>([^<]*)<\/title>/)),
    description: unescape(pick(/<meta name="description" content="([^"]*)"/)),
    og_image: pick(/<meta property="og:image" content="[^"]*?([^\/"]+\.(?:jpg|png|webp))"/) ? pick(/<meta property="og:image" content="([^"]*)"/) : null,
    noindex: /<meta name="robots" content="[^"]*noindex/.test(html) ? 1 : 0,
    redirect_to: pick(/http-equiv="refresh" content="0; url=([^"]+)"/),
  };
}

log.step('تفريغ الجداول');
await db.query('SET FOREIGN_KEY_CHECKS = 0');
for (const t of ['sections', 'pages', 'products', 'brands', 'nav_items', 'settings', 'translations', 'media', 'revisions']) {
  await db.query(`TRUNCATE TABLE \`${t}\``);
}
await db.query('SET FOREIGN_KEY_CHECKS = 1');
log.ok('جاهزة');

/* ------------------------------------------------------------- 1) الماركات */
log.step('الماركات');
const brandId = {};
let pos = 0;
for (const [slug, b] of Object.entries(site.brands)) {
  const [r] = await db.execute(
    `INSERT INTO brands (slug, name, logo, sub_en, sub_ar, \`group\`, site, position)
     VALUES (?,?,?,?,?,?,?,?)`,
    [slug, b.name ?? slug, b.logo ?? null, b.sub ?? null, ar(b.sub), b.group ?? null, b.site ?? null, pos++]
  );
  brandId[slug] = r.insertId;
}
log.ok(`${pos} ماركة`);

/* ------------------------------------------------------------- 2) المنتجات */
log.step('المنتجات');
pos = 0;
for (const p of site.products) {
  await db.execute(
    `INSERT INTO products
       (ref, slug, brand_id, category, subcategory, position, published,
        name_en, name_ar, type_en, type_ar, description_en, description_ar, hero_image, data)
     VALUES (?,?,?,?,?,?,1,?,?,?,?,?,?,?,?)`,
    [
      p.id, p.slug, brandId[p.brand] ?? null, p.category ?? null, p.subcategory ?? null, pos++,
      p.name ?? null, ar(p.name),
      p.type ?? null, ar(p.type),
      p.description ?? null, ar(p.description),
      p.heroImage ?? null,
      J({
        gallery: p.gallery ?? [],
        specifications: p.specifications ?? [],
        features: p.features ?? [],
        applications: p.applications ?? [],
        downloads: p.downloads ?? [],
        videos: p.videos ?? [],
        /* قائمة مرتّبة لا كائن: ترتيب مفاتيح كائن JSON لا يُحفظ في MySQL،
           فكانت شرائح المواصفات تظهر بترتيب غير ترتيب المصدر. */
        meta: Object.entries(p.meta ?? {}).map(([k, v]) => ({ k, v })),
        related: p.related ?? [],
      }),
    ]
  );
}
log.ok(`${pos} منتج`);

/* -------------------------------------------------- 3) الصفحات والسكاشن */
log.step('الصفحات والسكاشن');
/* علاقات الصفحات كما كان ux.js يحسبها: الصفحة الأعلى في المسار، والصفحات
   المقترحة أسفلها، والخدمة التي يبدأ بها نموذج عرض السعر. بيانات لا منطق،
   فمكانها قاعدة البيانات ليصير تعديلها من الداش بورد. */
const uxGroups = data.ux?.groups ?? {};
const uxRelated = data.ux?.related ?? {};
const uxSolution = data.ux?.solution ?? {};
const parentOf = (slug) => {
  for (const [head, members] of Object.entries(uxGroups)) {
    if (head !== slug && members.includes(slug)) return head;
  }
  return null;
};

let nPages = 0, nSections = 0;
pos = 0;
for (const [slug, pg] of Object.entries(pages)) {
  const m = metaOf(slug);
  const [r] = await db.execute(
    `INSERT INTO pages
       (slug, template, position, published, crumb_en, crumb_ar, parent_slug,
        title_en, title_ar, description_en, description_ar, og_image, noindex,
        hero, related, quote_solution, redirect_to)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      slug, 'sections', pos++, 1,
      en_(pg.crumb), ar_(pg.crumb), parentOf(slug),
      m.title ?? null, null,
      m.description ?? null, null,
      m.og_image ?? null, m.noindex ?? 0,
      pg.hero ? J(pg.hero) : null,
      uxRelated[slug] ? J(uxRelated[slug]) : null,
      uxSolution[slug] ?? null,
      m.redirect_to ?? null,
    ]
  );
  nPages++;
  let sp = 0;
  for (const s of pg.sections ?? []) {
    const { type, id, ...content } = s;
    await db.execute(
      `INSERT INTO sections (page_id, type, anchor, position, published, content) VALUES (?,?,?,?,1,?)`,
      [r.insertId, type, id ?? null, sp++, J(content)]
    );
    nSections++;
  }
}
log.ok(`${nPages} صفحة · ${nSections} سيكشن`);

/* ------------------------------------------------------------ 4) الإعدادات */
log.step('الإعدادات وبيانات الشركة');
const c = site.company;
const settings = [
  ['company',   c,                       'company', 'بيانات الشركة'],
  ['contact',   { phone: c.phone, phoneIntl: c.phoneIntl, email: c.email, address: c.address, geo: c.geo, hq: c.hq, serviceCenter: c.serviceCenter }, 'contact', 'بيانات التواصل'],
  ['story',     site.story ?? [],        'about',   'قصة الشركة'],
  ['whyUs',     site.whyUs ?? [],        'about',   'لماذا 5A&M'],
  ['industries', site.industries ?? [],  'content', 'القطاعات'],
  ['projects',  site.projects ?? [],     'content', 'المشروعات'],
  ['services',  site.services ?? [],     'content', 'الخدمات'],
  ['lifecycle', site.lifecycle ?? [],    'content', 'دورة حياة المعدة'],
  ['categories', site.categories ?? [],  'content', 'التصنيفات'],
  ['federal',   site.federal ?? null,    'home',    'سيكشن Federal Signal'],
  ['scope',     site.scope ?? null,      'home',    'نطاق العمل'],
  ['storyShort', site.storyShort ?? null,'home',    'نبذة مختصرة'],
  ['engineering', site.engineering ?? null, 'content', 'الأعمال الهندسية'],
  ['repoweringSteps', site.repoweringSteps ?? null, 'content', 'خطوات رفع الكفاءة'],
  /* أسماء الصفحات كما تظهر في الروابط بين الصفحات. تختلف قليلًا عن اسم الصفحة
     في المسار (مثل «Power solutions» مقابل «Power Solutions»)، فتُحفظ كما هي. */
  /* terms كلمات يبحث بها الزائر عن الصفحة ولا تظهر له — كانت العنصر الرابع
     في قائمة ux.js. */
  ['pageLinks', (data.ux?.pages ?? []).map(([slug, en, ar, terms]) => ({ slug, en, ar, terms: terms ?? '' })), 'content', 'أسماء الصفحات في الروابط'],
];
for (const [k, v, g, label] of settings) {
  await db.execute(
    'INSERT INTO settings (`key`, `value`, `group`, label_ar) VALUES (?,?,?,?)',
    [k, J(v), g, label]
  );
}
log.ok(`${settings.length} إعداد`);

/* ------------------------------------------------------------- 5) الترجمة */
log.step('نصوص الواجهة');
let nT = 0;
for (const [k, v] of Object.entries(arUI)) {
  await db.execute(
    'INSERT INTO translations (`key`, en, ar, `group`) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE ar = VALUES(ar)',
    [k, null, v, k.split('.')[0]]
  );
  nT++;
}
/* الجمل المترجمة: المفتاح بصمة النص الإنجليزي، والنص كاملًا في عمود en.
   بصمة لا نص، لأن النص قد يتجاوز طول المفتاح (أطول جملة 248 حرفًا). */
let nP = 0;
for (const [en, arv] of Object.entries(arPhrases)) {
  const key = 'phrase:' + createHash('sha1').update(en, 'utf8').digest('hex');
  await db.execute(
    'INSERT INTO translations (`key`, en, ar, `group`) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE ar = VALUES(ar)',
    [key, en, arv, 'phrase']
  );
  nP++;
}
log.ok(`${nT} مفتاح واجهة · ${nP} جملة`);

/* ------------------------------------------------- 6) المنيو العلوي والفوتر
   ثلاثة مستويات: عنصر رئيسي ← عمود (في القوائم الكبيرة) ← رابط.
   النسختان العربية والإنجليزية مستخرجتان معًا، فتُدمجان بالترتيب نفسه. */
log.step('المنيو والفوتر');
const navIns = async (area, parent, position, en, ar, href, dEn, dAr, extra) => {
  const [r] = await db.execute(
    `INSERT INTO nav_items (area, parent_id, position, label_en, label_ar, href, desc_en, desc_ar, extra)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [area, parent, position, en ?? '', ar ?? en ?? '', href ?? null, dEn ?? null, dAr ?? null, extra ? J(extra) : null]
  );
  return r.insertId;
};

let nNav = 0;
const navEn = data.nav?.en ?? [], navAr = data.nav?.ar ?? [];
for (let i = 0; i < navEn.length; i++) {
  const e = navEn[i], a = navAr[i] ?? {};
  const extra = {};
  if (e.promo) extra.promo = { en: e.promo, ar: a.promo ?? null };
  if (e.submenuTag) extra.tag = { en: e.submenuTag, ar: a.submenuTag ?? null };
  if (e.submenuDesc) extra.desc = { en: e.submenuDesc, ar: a.submenuDesc ?? null };
  if (e.mega) extra.kind = 'mega';
  else if (e.submenu) extra.kind = 'submenu';
  const top = await navIns('header', null, i, e.label, a.label, e.href, null, null,
    Object.keys(extra).length ? extra : null);
  nNav++;
  // قائمة كبيرة: أعمدة تحتها روابط
  for (let c = 0; c < (e.mega?.length ?? 0); c++) {
    const ec = e.mega[c], ac = a.mega?.[c] ?? {};
    const col = await navIns('header', top, c, ec.title, ac.title, null, null, null, { kind: 'column' });
    nNav++;
    for (let k = 0; k < (ec.links?.length ?? 0); k++) {
      await navIns('header', col, k, ec.links[k].label, ac.links?.[k]?.label, ec.links[k].href);
      nNav++;
    }
  }
  // قائمة بسيطة: روابط مباشرة بوصف
  for (let c = 0; c < (e.submenu?.length ?? 0); c++) {
    const ec = e.submenu[c], ac = a.submenu?.[c] ?? {};
    await navIns('header', top, c, ec.label, ac.label, ec.href, ec.desc, ac.desc);
    nNav++;
  }
}

const fEn = data.footer?.en ?? [], fAr = data.footer?.ar ?? [];
for (let i = 0; i < fEn.length; i++) {
  const e = fEn[i], a = fAr[i] ?? {};
  const col = await navIns('footer', null, i, e.title, a.title, null, null, null, { kind: 'column' });
  nNav++;
  for (let k = 0; k < (e.links?.length ?? 0); k++) {
    await navIns('footer', col, k, e.links[k].label, a.links?.[k]?.label, e.links[k].href);
    nNav++;
  }
}
log.ok(`${nNav} عنصر (${navEn.length} في المنيو · ${fEn.length} عمود في الفوتر)`);

/* ------------------------- 7) الرئيسية وصفحة المنتج ونموذج عرض السعر
   محتوى هذه الثلاث لم يكن في data.js بل داخل ملفاتها، فاستُخرج على حدة.
   وتُخزَّن هنا سكاشنَ عادية كبقية الصفحات، فتُحرَّر من الداش بورد بالطريقة نفسها. */
log.step('الرئيسية وصفحة المنتج ونموذج عرض السعر');
const restFile = path.join(import.meta.dirname, 'extracted-rest.json');
if (!fs.existsSync(restFile)) {
  log.fail('extracted-rest.json غير موجود — شغّل scripts/extract-rest.mjs أولًا');
} else {
  const rest = JSON.parse(fs.readFileSync(restFile, 'utf8'));

  /** يُدخل صفحة وسكاشنها. */
  async function addPage(page, sections) {
    const [r] = await db.execute(
      `INSERT INTO pages
         (slug, template, position, published, crumb_en, crumb_ar, parent_slug,
          title_en, title_ar, description_en, description_ar, og_image, noindex,
          hero, related, quote_solution, redirect_to)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        page.slug, page.template, pos++, 1,
        page.crumb?.en ?? null, page.crumb?.ar ?? null, null,
        page.title ?? null, null,
        page.description ?? null, null,
        page.ogImage ?? null, page.noindex ?? 0,
        page.hero ? J(page.hero) : null, null, null, null,
      ]
    );
    let sp = 0;
    for (const [type, anchor, content] of sections) {
      await db.execute(
        'INSERT INTO sections (page_id, type, anchor, position, published, content) VALUES (?,?,?,?,1,?)',
        [r.insertId, type, anchor, sp++, J(content)]
      );
      nSections++;
    }
    nPages++;
  }

  const h = rest.home;
  await addPage(
    {
      slug: 'index', template: 'onepage',
      crumb: { en: 'Home', ar: arUI['nav.home'] ?? 'الرئيسية' },
      title: h.meta.title, description: h.meta.description, ogImage: h.meta.ogImage,
    },
    [
      ['heroSlider', 'hero', h.hero],
      ['logostrip', null, h.logostrip],
      ['brandCards', 'federal', h.federal],
      ...h.rows.map((r) => ['cardRow', r.anchor, r]),
    ]
  );

  const m = rest.model;
  await addPage(
    {
      slug: 'model', template: 'product',
      crumb: { en: 'Equipment', ar: arUI['nav.equipment'] ?? 'المعدات' },
      title: 'Equipment specification — 5A&M',
      description: 'Specification, features and applications for equipment supplied and supported by 5A&M in Egypt.',
      ogImage: 'https://www.5a-eg.com/assets/img/photos/genset-5am-canopy.jpg',
    },
    [
      ['productRelated', 'relatedSec', m.relatedHead],
      ['ctaband', null, m.ctaBand],
    ]
  );

  const qp = rest.quote;
  await addPage(
    {
      slug: 'quote', template: 'quote',
      crumb: qp.hero.crumb,
      title: 'Request a quote — 5A&M',
      description: 'Send us the load, the site and the operating conditions, and our team will come back with a quotation.',
      hero: { img: qp.hero.img, title: qp.hero.title, lede: qp.hero.lede },
    },
    [['quoteForm', null, { options: qp.options, text: qp.text, cover: qp.cover }]]
  );

  const eq = rest.equipment;
  await addPage(
    {
      slug: 'equipment', template: 'equipment',
      crumb: eq.hero.crumb,
      title: eq.meta.title, description: eq.meta.description,
      hero: { img: eq.hero.img, title: eq.hero.title, lede: eq.hero.lede },
    },
    [
      ['linecardJump', null, eq.jump],
      ...eq.sections.map((s) => ['linecard', s.anchor, { ...s, deciding: eq.deciding }]),
      ['ctaband', null, eq.ctaBand],
    ]
  );
  await db.execute(
    'INSERT INTO settings (`key`, `value`, `group`, label_ar) VALUES (?,?,?,?)',
    ['equipmentEmpty', J(eq.empty), 'content', 'نص «لا نتيجة» في كتالوج المعدات']
  );

  /* أدوار الشركات في المنتج — بيانات حقيقية كانت في model.js ولم تكن تُعرض.
     تُحفظ كي لا تضيع، ويقرر صاحب الموقع من الداش بورد إن أراد إظهارها. */
  await db.execute(
    'INSERT INTO settings (`key`, `value`, `group`, label_ar) VALUES (?,?,?,?)',
    ['brandRoles', J(m.bio), 'content', 'أدوار الشركات في المنتج (غير معروضة)']
  );
  log.ok(`4 صفحات · ${h.rows.length + 3} سيكشن للرئيسية · ${eq.sections.length + 2} لكتالوج المعدات`);
}

/* --------------------------------------------------------- 8) مكتبة الصور */
log.step('مكتبة الصور');
const IMG = path.join(SRC, 'assets', 'img');
const SKIP = /_removed|_replaced|raw-source|[\\/]صور[\\/]|\.zip$/i;
let nM = 0;
/* النوع يُحدَّد بالامتداد: صورة، فيديو، ملف. مكتبة الداش بورد تعرض الثلاثة. */
const KIND = { jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', svg: 'image', gif: 'image',
  mp4: 'video', webm: 'video', mov: 'video', pdf: 'document' };
function walk(dir, base) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (SKIP.test(full)) continue;
    if (e.isDirectory()) { walk(full, base); continue; }
    const kind = KIND[path.extname(e.name).slice(1).toLowerCase()];
    if (!kind) continue;
    const rel = path.relative(SRC, full).replace(/\\/g, '/');
    const folder = path.relative(base, path.dirname(full)).replace(/\\/g, '/') || '.';
    nM++;
    pendingMedia.push([rel, kind, fs.statSync(full).size, folder]);
  }
}
const pendingMedia = [];
if (fs.existsSync(IMG)) walk(IMG, IMG);
for (const sub of ['video', 'docs', 'files']) {
  const dir = path.join(SRC, 'assets', sub);
  if (fs.existsSync(dir)) walk(dir, path.join(SRC, 'assets'));
}
for (let i = 0; i < pendingMedia.length; i += 200) {
  const chunk = pendingMedia.slice(i, i + 200);
  await db.query(
    'INSERT IGNORE INTO media (path, kind, bytes, folder) VALUES ?',
    [chunk]
  );
}
log.ok(`${nM} ملف`);

/* ------------------------------------------------------------- الحصيلة */
log.step('الحصيلة في قاعدة البيانات');
for (const t of ['pages', 'sections', 'products', 'brands', 'settings', 'translations', 'media']) {
  const [[row]] = await db.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
  log.info(`${t.padEnd(14)} ${row.n}`);
}
await db.end();
