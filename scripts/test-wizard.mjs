/* اختبار حفظ معالج «صفحة جديدة» — هل يمحو «الخيارات الإضافية»؟

   setup  : ينشئ صفحة مسوّدة مؤقتة zz-wizard-test بقسمين ممتلئين بكل الحقول،
            منها المتقدمة وحقل لا يصفه الجدول.
   (ثم تُفتح /admin/pages/new/zz-wizard-test ويُغيَّر عنوان ويُفرَّغ عنوان
    أعلى الصفحة ويُضغط «احفظ وتابع»)
   verify : يقارن المحفوظ بالمتوقع.
   clean  : يحذف الصفحة وسجلّاتها.

     node scripts/test-wizard.mjs setup|verify|clean */
import { connect, log } from './lib.mjs';

const SLUG = 'zz-wizard-test';
const STORY = {
  title: { en: 'Story title', ar: 'عنوان القصة' },
  text: { en: 'Body', ar: 'نص' },
  img: 'assets/img/brands/5am-logo-white.png',
  points: [{ en: 'One', ar: 'واحد' }],
  eyebrow: { en: 'Eyebrow', ar: 'فوق العنوان' },
  text2: { en: 'Second', ar: 'فقرة ثانية' },
  flip: true,
  facts: [{ k: { en: 'Year', ar: 'سنة' }, v: { en: '1990', ar: '١٩٩٠' } }],
  note: { t: { en: 'Note', ar: 'ملاحظة' }, d: { en: 'Detail', ar: 'تفصيل' } },
  cta: { href: 'contact.html', label: { en: 'Call', ar: 'اتصل' } },
  bg: 'dark',                         // ليس في الجدول أصلًا
};
const FEATURE = {
  title: { en: 'Feature', ar: 'ميزة' },
  text: { en: 'Text', ar: 'نص' },
  product: 'elgin-pelican', brandId: 'elgin', when: { en: 'When', ar: 'متى' }, flip: true,
};

/* قسم كل حقوله الأساسية قوائم: حين تُحذف كل صوره لا يرسل النموذج منها شيئًا */
const SLIDER = {
  slides: [{ img: 'assets/img/brands/5am-logo-white.png', group: 'elgin', alt: { en: 'a', ar: 'أ' } }],
  tabs: [{ group: 'elgin', title: 'Elgin', sub: { en: 's', ar: 'س' }, start: 0 }],
};

const db = await connect();
const cmd = process.argv[2];
const [[page]] = await db.query('SELECT id, hero FROM pages WHERE slug = ?', [SLUG]);

if (cmd === 'setup') {
  if (page) { log.fail('الصفحة موجودة — شغّل clean أولًا'); process.exit(1); }
  const [r] = await db.query(
    `INSERT INTO pages (slug, template, published, crumb_en, crumb_ar, hero, position)
     VALUES (?, 'sections', 0, 'Wizard test', 'اختبار المعالج', ?, 9999)`,
    [SLUG, JSON.stringify({ img: 'assets/img/brands/5am-logo-white.png', title: { en: 'Hero', ar: 'هيرو' }, kicker: { en: 'K', ar: 'ك' } })]
  );
  await db.query('INSERT INTO sections (page_id, type, position, content) VALUES (?,?,?,?),(?,?,?,?),(?,?,?,?)',
    [r.insertId, 'story', 0, JSON.stringify(STORY), r.insertId, 'feature', 1, JSON.stringify(FEATURE),
     r.insertId, 'heroSlider', 2, JSON.stringify(SLIDER)]);
  log.ok(`أُنشئت ${SLUG} — افتح /admin/pages/new/${SLUG}`);
}

if (cmd === 'verify') {
  const [rows] = await db.query('SELECT id, type, content FROM sections WHERE page_id = ? ORDER BY position', [page.id]);
  const c = (t) => { const v = rows.find((x) => x.type === t).content; return typeof v === 'string' ? JSON.parse(v) : v; };
  const story = c('story'), feat = c('feature');
  const hero = typeof page.hero === 'string' ? JSON.parse(page.hero) : page.hero;
  let bad = 0;
  /* MySQL يعيد ترتيب مفاتيح JSON، فتُقارَن القيم بعد ترتيب المفاتيح */
  const canon = (v) => Array.isArray(v) ? v.map(canon)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
  const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
  const check = (cond, m) => { if (cond) log.ok(m); else { bad++; log.fail(m); } };

  check(story.title.ar === 'عنوان معدّل', `العنوان المعدّل حُفظ: ${story.title.ar}`);
  for (const k of ['eyebrow', 'text2', 'flip', 'facts', 'note', 'cta', 'bg']) {
    check(same(story[k], STORY[k]), `story.${k} بقي كما هو`);
  }
  for (const k of ['product', 'brandId', 'when', 'flip']) {
    check(same(feat[k], FEATURE[k]), `feature.${k} بقي كما هو`);
  }
  check(!hero.title, 'عنوان أعلى الصفحة المُفرَّغ حُذف فعلًا');
  if (process.argv.includes('--emptied')) {
    const sl = c('heroSlider');
    check(!sl.slides, 'السلايدر الذي حُذفت كل صوره حُفظ فارغًا');
    check(Array.isArray(sl.tabs) && sl.tabs.length === 1, 'وتبويباته بقيت');
  }
  check(same(hero.kicker, { en: 'K', ar: 'ك' }), 'hero.kicker (ليس في النموذج) بقي');
  const [[rev]] = await db.query(
    "SELECT COUNT(*) n FROM revisions WHERE (entity='section' AND entity_id IN (?)) OR (entity='page' AND entity_id=?)",
    [rows.map((x) => x.id), page.id]
  );
  check(rev.n >= 2, `${rev.n} نسخة في السجل (الصفحة والقسم المعدّل)`);
  log.step(bad ? `${bad} مشكلة` : 'المعالج لا يمحو شيئًا');
  process.exitCode = bad ? 1 : 0;
}

if (cmd === 'clean' && page) {
  const [secs] = await db.query('SELECT id FROM sections WHERE page_id = ?', [page.id]);
  if (secs.length) await db.query("DELETE FROM revisions WHERE entity='section' AND entity_id IN (?)", [secs.map((s) => s.id)]);
  await db.query("DELETE FROM revisions WHERE entity='page' AND entity_id=?", [page.id]);
  await db.query('DELETE FROM pages WHERE id = ?', [page.id]);
  log.ok('حُذفت الصفحة المؤقتة وسجلّاتها');
}
await db.end();
