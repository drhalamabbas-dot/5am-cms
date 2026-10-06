/* =============================================================================
   يستخرج ما تبقّى من الموقع الحالي: الصفحة الرئيسية وصفحة المنتج ونموذج
   عرض السعر.

   محتوى هذه الصفحات لم يكن في data.js، بل مكتوبًا داخل ملفاتها:
     • index.html  — سلايدر الهيرو (الصور والتبويبات)
     • home.js     — STRIP (شريط اللوجوهات) و ROWS (كروت الأقسام)
     • model.html  — شريط الدعوة أسفل صفحة المنتج
     • quote.js    — خيارات الخدمة، ونصوص النموذج والجانب

   لا يُعاد كتابة أي نص بيد: القوائم تُقرأ بتشغيل تعريفاتها، والعناصر تُقرأ من
   الـ HTML نفسه. النصوص الإنجليزية تأتي من المصدر، والعربية من قاموس i18n.ar.

   الناتج: scripts/extracted-rest.json
============================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { log } from './lib.mjs';

const SRC = process.env.SITE_SRC
  || 'C:\\Users\\Mohamed Nagy\\OneDrive - Arab Open University - AOU\\Desktop\\5am-website - Copy';
const readSrc = (...p) => fs.readFileSync(path.join(SRC, ...p), 'utf8');

/* قاموس الواجهة العربية المستخرج سابقًا — يُستخدم لملء النسخة العربية من
   النصوص التي كان الموقع يترجمها بمفتاح data-i18n. */
const prev = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'extracted.json'), 'utf8'));
const arUI = prev.arUI || {};
const arPhrases = prev.arPhrases || {};

/** نص بلغتيه: الإنجليزية من المصدر، والعربية من القاموس بالمفتاح أو بالجملة. */
const dual = (en, key) => ({
  en,
  ar: (key && arUI[key]) || arPhrases[en] || '',
});

const unent = (s) => String(s ?? '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ');

/** يقرأ قيمة `const NAME = …` من ملف، مع إتاحة ما تحتاجه من دوال مساعدة. */
function literal(code, name, open, scope = {}) {
  const close = open === '[' ? ']' : '}';
  const at = code.search(new RegExp(`const\\s+${name}\\s*=`));
  if (at < 0) throw new Error(`${name} غير موجود`);
  const s = code.indexOf(open, at);
  let depth = 0;
  for (let i = s; i < code.length; i++) {
    if (code[i] === open) depth++;
    else if (code[i] === close) {
      depth--;
      if (!depth) return vm.runInNewContext('(' + code.slice(s, i + 1) + ')', { ...scope });
    }
  }
  throw new Error(`${name} غير مكتمل`);
}

/** يقرأ سمات وسم HTML واحد. */
function attrs(tag) {
  const out = {};
  const re = /([a-zA-Z_:][-\w:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+)))?/g;
  let m;
  re.exec(tag); // اسم الوسم
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = unent(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

/* ============================================================ 1) الرئيسية */
log.step('الصفحة الرئيسية — سلايدر الهيرو');
const indexHtml = readSrc('index.html');

/* الفيديو الخلفي */
const videoTag = indexHtml.match(/<video class="vhero__video"[^>]*>([\s\S]*?)<\/video>/);
const video = {
  poster: attrs(videoTag[0].match(/<video[^>]*>/)[0]).poster || '',
  sources: [...videoTag[1].matchAll(/<source([^>]*)>/g)].map((m) => {
    const a = attrs('<source' + m[1] + '>');
    return { src: a.src, type: a.type };
  }),
};

/* الصور: الترتيب والمجموعة والمقاس ومن يُحمَّل فورًا — كما هي في الوسوم */
const slidesBlock = indexHtml.match(/<div class="vhero__slides"[^>]*>([\s\S]*?)<span class="vhero__scrim"/)[1];
const slidesHost = attrs(indexHtml.match(/<div class="vhero__slides"[^>]*>/)[0]);
const slides = [...slidesBlock.matchAll(/<div class="vhero__slide([^"]*)"\s+data-index="(\d+)"\s+data-group="([^"]+)">\s*<img([^>]*)>/g)]
  .map((m) => {
    const a = attrs('<img' + m[4] + '>');
    const key = (a['data-i18n-attr'] || '').replace(/^alt:/, '');
    return {
      img: a.src || a['data-src'],
      /* الصورة الأولى فقط كانت تُحمَّل فورًا، والبقية بعد ظهورها */
      eager: Boolean(a.src) && a.fetchpriority === 'high',
      preload: Boolean(a.src),
      group: m[3],
      w: Number(a.width) || null,
      h: Number(a.height) || null,
      alt: dual(a.alt, key),
    };
  });

/* التبويبات أسفل السلايدر */
const tabsBlock = indexHtml.match(/<div class="vhero__tabs"[^>]*>([\s\S]*?)<\/div>\s*\n\s*<div class="vhero__nav"/)[1];
const tabs = [...tabsBlock.matchAll(/<button class="vhero__tab[^"]*"[\s\S]*?data-group="([^"]+)" data-slide="(\d+)"[\s\S]*?<span class="vhero__tab-idx">([^<]*)<\/span>[\s\S]*?<b class="vhero__tab-title">([^<]*)<\/b>\s*<span class="vhero__tab-sub" data-i18n="([^"]+)">([^<]*)<\/span>/g)]
  .map((m) => ({
    group: m[1],
    slide: Number(m[2]),
    idx: m[3],
    title: unent(m[4]),
    sub: dual(unent(m[6]), m[5]),
  }));
log.ok(`صور: ${slides.length} · تبويبات: ${tabs.length} · مصادر فيديو: ${video.sources.length}`);

/* ---- شريط اللوجوهات وكروت الأقسام من home.js ---- */
log.step('الصفحة الرئيسية — شريط اللوجوهات وكروت الأقسام');
const homeJs = readSrc('assets', 'js', 'home.js');
const STRIP = literal(homeJs, 'STRIP', '[');
const BRAND_PAGE = literal(homeJs, 'BRAND_PAGE', '{');
const ROWS = literal(homeJs, 'ROWS', '{', {
  LL: (en, ar) => ({ en, ar }),
  IMG: 'assets/img/range/',
  PH: 'assets/img/photos/',
});
log.ok(`لوجوهات: ${STRIP.length} · صفوف كروت: ${Object.keys(ROWS).join(', ')}`);

/* ---- ترويسات سكاشن الرئيسية كما في index.html ----
   كل سكشن له: صنف النغمة، ومعرّف، وعنوان صغير وكبير، وربما زر إلى صفحة. */
function homeLead(anchor) {
  const re = new RegExp(`<section class="([^"]*)" id="${anchor}">[\\s\\S]*?<\\/section>`);
  const m = indexHtml.match(re);
  if (!m) throw new Error(`سكشن ${anchor} غير موجود`);
  const block = m[0];
  const g = (cls) => {
    const x = block.match(new RegExp(`<(?:p|h2) class="${cls}" data-i18n="([^"]+)">([\\s\\S]*?)<\\/(?:p|h2)>`));
    return x ? dual(unent(x[2].trim()), x[1]) : null;
  };
  const lede = block.match(/<p class="lead__lede" data-i18n="([^"]+)">([\s\S]*?)<\/p>/);
  const cta = block.match(/<a class="btn btn--ghost" href="([^"]+)" data-i18n="([^"]+)">([\s\S]*?)<span/);
  return {
    tone: /sec--light/.test(m[1]) ? 'light' : /sec--paper/.test(m[1]) ? 'paper' : '',
    eyebrow: g('lead__eyebrow'),
    title: g('lead__title'),
    lede: lede ? dual(unent(lede[2].replace(/\s+/g, ' ').trim()), lede[1]) : null,
    cta: cta ? { href: cta[1], label: dual(unent(cta[3].trim()), cta[2]) } : null,
  };
}

const logostripLabel = (() => {
  const m = indexHtml.match(/<h2 class="logostrip__label" id="logostripH" data-i18n="([^"]+)">([^<]*)<\/h2>/);
  return dual(unent(m[2]), m[1]);
})();

/* ---- ما تكتبه ux.js فوق الرئيسية بعد رسمها ----
   دالة homepage() في ux.js تستبدل عناوين السكاشن ونصّ federal ونصّ زر الكروت
   بعد التحميل، فهذه هي النصوص التي يراها الزائر فعلًا. تُخزَّن هي لا ما في
   index.html، وإلا ظهر نصّ غير الذي في الموقع. */
log.step('نصوص ux.js التي تُكتب فوق الرئيسية');
const uxJs = readSrc('assets', 'js', 'ux.js');
const homeTitleOverrides = Object.fromEntries(
  [...uxJs.matchAll(/\['#(\w[\w-]*) \.lead__title','((?:[^'\\]|\\.)*)','((?:[^'\\]|\\.)*)'\]/g)]
    .map((m) => [m[1], { en: m[2].replace(/\\'/g, "'"), ar: m[3].replace(/\\'/g, "'") }])
);
const federalLedeOverride = (() => {
  const m = uxJs.match(/#federal \.lead__lede'\);if\(intro\)intro\.textContent=L\('((?:[^'\\]|\\.)*)','((?:[^'\\]|\\.)*)'\)/);
  return m ? { en: m[1], ar: m[2] } : null;
})();
const cardCtaOverride = (() => {
  const m = uxJs.match(/if\(cta\)cta\.innerHTML=L\('((?:[^'\\]|\\.)*)','((?:[^'\\]|\\.)*)'\)/);
  return m ? { en: m[1], ar: m[2] } : null;
})();
log.ok(`عناوين مستبدلة: ${Object.keys(homeTitleOverrides).join(', ')}`);
log.ok(`نص زر الكروت: ${cardCtaOverride?.en} / ${cardCtaOverride?.ar}`);

const home = {
  hero: { video, slides, tabs, slidesAria: slidesHost['aria-label'] || '' },
  logostrip: { title: logostripLabel, brands: STRIP },
  federal: {
    ...homeLead('federal'),
    title: homeTitleOverrides.federal ?? homeLead('federal').title,
    lede: federalLedeOverride ?? homeLead('federal').lede,
    cardCta: cardCtaOverride,
    brandPage: BRAND_PAGE,
    dealerLabel: dual('Exclusive dealer in Egypt', 'label.exclusiveDealer'),
    /* أسطر البطاقة كانت تُترجم بمفتاح sub.<القيمة>، وتُحفظ هنا بلغتيها كي
       تُحرَّر من الداش بورد كأي نص آخر. */
    /* رابط كل كارت يُحفظ معه لا في خريطة منفصلة، كي يُحرَّر من الداش بورد */
    cards: prev.site.federal.map((f) => ({
      ...f,
      href: BRAND_PAGE[f.brand] ?? 'environment.html',
      alt: dual(f.alt),
      d: dual(f.d),
      lines: f.lines.map((x) => dual(x, 'sub.' + x)),
    })),
  },
  rows: [
    { anchor: 'power', key: 'powerCards', ...homeLead('power') },
    { anchor: 'fabrication', key: 'fabCards', ...homeLead('fabrication') },
    { anchor: 'aftersales', key: 'afterCards', ...homeLead('aftersales') },
    { anchor: 'projects', key: 'projCards', ...homeLead('projects') },
  ].map((r) => ({
    ...r,
    title: homeTitleOverrides[r.anchor] ?? r.title,
    cardCta: cardCtaOverride,
    cards: ROWS[r.key],
  })),
  meta: (() => {
    const g = (re) => (indexHtml.match(re) || [, ''])[1];
    return {
      title: unent(g(/<title>([\s\S]*?)<\/title>/)),
      description: unent(g(/<meta name="description" content="([^"]*)"/)),
      ogImage: unent(g(/<meta property="og:image" content="([^"]*)"/)),
    };
  })(),
};
log.ok(`سكاشن الرئيسية: هيرو + لوجوهات + federal + ${home.rows.length} صفوف`);

/* ======================================================= 2) صفحة المنتج */
log.step('صفحة المنتج — شريط الدعوة وسير الشركات');
const modelHtml = readSrc('model.html');
const modelJs = readSrc('assets', 'js', 'model.js');

const ctaBand = (() => {
  const b = modelHtml.match(/<section class="ctaband">([\s\S]*?)<\/section>/)[1];
  const img = attrs(b.match(/<img[^>]*>/)[0]);
  const h2 = b.match(/<h2 data-i18n="([^"]+)">([\s\S]*?)<br><span class="accent" data-i18n="([^"]+)">([\s\S]*?)<\/span><\/h2>/);
  const p = b.match(/<p data-i18n="([^"]+)">([\s\S]*?)<\/p>/);
  const btn = b.match(/<a class="btn" id="quoteCta" href="[^"]*" data-i18n="([^"]+)">([\s\S]*?)<span/);
  const figs = [...b.matchAll(/<div class="fig"><i data-ico="([^"]+)"><\/i><b data-i18n="([^"]+)">([^<]*)<\/b><span data-i18n="([^"]+)">([^<]*)<\/span><\/div>/g)]
    .map((m) => ({ icon: m[1], title: dual(unent(m[3]), m[2]), text: dual(unent(m[5]), m[4]) }));
  return {
    img: img.src,
    title: dual(unent(h2[2].trim()), h2[1]),
    accent: dual(unent(h2[4].trim()), h2[3]),
    text: dual(unent(p[2].replace(/\s+/g, ' ').trim()), p[1]),
    cta: dual(unent(btn[2].trim()), btn[1]),
    figs,
  };
})();

const relatedHead = (() => {
  const b = modelHtml.match(/<section class="sec sec--paper" id="relatedSec" hidden>([\s\S]*?)<\/section>/)[1];
  const e = b.match(/<p class="shead__eyebrow" data-i18n="([^"]+)">([^<]*)<\/p>/);
  const t = b.match(/<h2 class="shead__title" data-i18n="([^"]+)">([^<]*)<\/h2>/);
  return { eyebrow: dual(unent(e[2]), e[1]), title: dual(unent(t[2]), t[1]) };
})();

/* سير الشركات المشاركة في المنتج — بيانات لا منطق، فتُنقل كي تُحرَّر */
const BIO = literal(modelJs, 'BIO', '{', { L: (en, ar) => ({ en, ar }) });
const BY_CAT = literal(modelJs, 'BY_CAT', '{');
log.ok(`شريط الدعوة: ${ctaBand.figs.length} بطاقة · سير شركات: ${Object.keys(BIO).length}`);

const model = { ctaBand, relatedHead, bio: BIO, byCategory: BY_CAT };

/* ==================================================== 3) نموذج عرض السعر */
log.step('نموذج عرض السعر');
const quoteHtml = readSrc('quote.html');
const quoteJs = readSrc('assets', 'js', 'quote.js');

/* quote.js يستبدل النموذج الثابت بالكامل عند التحميل، فالمرجع هو نصوصه. */
const options = literal(quoteJs, 'options', '[').map(([value, en, ar, icon]) => ({
  value, icon, label: { en, ar },
}));

/* الهيرو: نصّه النهائي يضبطه quote.js في آخر خطوة، لا ما في الـ HTML. */
const heroFinal = (() => {
  const h1 = quoteJs.match(/const title=q\('\.phero h1'\);if\(title\)title\.textContent=L\('([^']*)','([^']*)'\)/);
  const p = quoteJs.match(/const intro=q\('\.phero__in > p'\);if\(intro\)intro\.textContent=L\('([^']*)','([^']*)'\)/);
  const img = attrs(quoteHtml.match(/<section class="phero">[\s\S]*?<img[^>]*>/)[0].match(/<img[^>]*>/)[0]);
  const crumb = quoteHtml.match(/<span class="now" data-i18n="([^"]+)">([^<]*)<\/span>/);
  return {
    img: img.src,
    title: { en: h1[1], ar: h1[2] },
    lede: { en: p[1], ar: p[2] },
    crumb: dual(unent(crumb[2]), crumb[1]),
  };
})();

/** كل نصوص النموذج كما تكتبها quote.js بالدالة L('en','ar'). */
const qtext = (() => {
  const pick = (re) => {
    const m = quoteJs.match(re);
    if (!m) throw new Error('نص غير موجود: ' + re);
    return { en: m[1], ar: m[2] };
  };
  const after = (anchor, n = 1) => {
    const at = quoteJs.indexOf(anchor);
    if (at < 0) throw new Error('علامة غير موجودة: ' + anchor);
    const re = /L\('((?:[^'\\]|\\.)*)','((?:[^'\\]|\\.)*)'\)/g;
    re.lastIndex = at;
    let m, i = 0;
    while ((m = re.exec(quoteJs))) if (++i === n) return { en: m[1].replace(/\\'/g, "'"), ar: m[2].replace(/\\'/g, "'") };
    throw new Error('نص غير موجود بعد ' + anchor);
  };
  return {
    introTitle: after('ux-quote-intro', 1),
    introText: after('ux-quote-intro', 2),
    name: after("field('name'", 1),
    phone: after("field('phone'", 1),
    email: after("field('email'", 1),
    company: after("field('company'", 1),
    solutionLabel: after("id=\"solution-label\"", 1),
    solutionPlaceholder: after("id=\"solution-label\"", 2),
    solutionError: after('id="solution-error"', 1),
    message: after('for="message"', 1),
    messagePlaceholder: after('for="message"', 2),
    duration: after("field('duration'", 1),
    durationPlaceholder: after("field('duration'", 2),
    start: after("field('start'", 1),
    details: after('id="technicalDetails"', 1),
    product: after('for="product"', 1),
    power: after("field('power'", 1),
    powerPlaceholder: after("field('power'", 2),
    location: after("field('location'", 1),
    submit: after('class="btn" type="submit"', 1),
    submitHint: after('class="btn" type="submit"', 2),
    reviewTitle: after('id="reviewTitle"', 1),
    openEmail: after('id="openEmail"', 1),
    copy: after('id="copyRequest"', 1),
    download: after('id="downloadRequest"', 1),
    reviewNote: after('ux-review-note', 1),
    reviewNote2: after('ux-review-note', 2),
    anyProduct: pick(/select\.innerHTML=`<option value="">\$\{L\('([^']*)','([^']*)'\)\}/),
    errGeneric: pick(/L\('(Please complete this field\.)','([^']*)'\)/),
    errEmail: pick(/L\('(Enter a valid email address\.)','([^']*)'\)/),
    errPhone: pick(/L\('(Enter a valid contact number\.)','([^']*)'\)/),
    errCheck: pick(/L\('(Please check the highlighted fields\.)','([^']*)'\)/),
    requestHeading: pick(/const rows=\[L\('([^']*)','([^']*)'\)\]/),
    sourceLabel: pick(/rows\.push\(L\('(Source page)','([^']*)'\)/),
    mailSubject: pick(/encodeURIComponent\(L\('(Request — 5A&M)','([^']*)'\)\)/),
    prefill: pick(/q\('#message'\)\.value=L\('([^']*)','([^']*)'\)/),
    copied: pick(/L\('(Request copied[^']*)','([^']*)'\)/),
    copyFailed: pick(/L\('(Copy is unavailable[^']*)','([^']*)'\)/),
    asideTitle: after("qside\"><h2>", 1),
    asideText: after("qside\"><h2>", 2),
    asidePhone: after("qside\"><h2>", 3),
    asideEmail: after("qside\"><h2>", 4),
    coverTitle: after('qside__cover', 1),
  };
})();

/* ما يشمله عرض السعر — قائمة داخل اللوحة الجانبية */
const coverItems = (() => {
  const at = quoteJs.indexOf('qside__cover');
  const block = quoteJs.slice(quoteJs.indexOf('<ul>', at), quoteJs.indexOf('</ul>', at));
  return [...block.matchAll(/L\('((?:[^'\\]|\\.)*)','((?:[^'\\]|\\.)*)'\)/g)]
    .map((m) => ({ en: m[1].replace(/\\'/g, "'"), ar: m[2].replace(/\\'/g, "'") }));
})();

const quote = { hero: heroFinal, options, text: qtext, cover: coverItems };
log.ok(`خدمات: ${options.length} · نصوص: ${Object.keys(qtext).length} · بنود التغطية: ${coverItems.length}`);

/* ================================================ 4) كتالوج المعدات
   صفحة «المعدات التي نورّدها»: ثلاثة أقسام، كلٌّ يعرض موديلات من المنتجات.
   إعدادها كان مكتوبًا في equipment.js، فيُنقل كي يُحرَّر من الداش بورد. */
log.step('كتالوج المعدات');
const eqHtml = readSrc('equipment.html');
const eqJs = readSrc('assets', 'js', 'equipment.js');

/** كل نداء t('key','English') في الملف — المفتاح ونصّه بلغتيه. */
const eqT = (() => {
  const map = {};
  const re = /\bt\('([\w.]+)',\s*'((?:[^'\\]|\\.)*)'\)/g;
  let m;
  while ((m = re.exec(eqJs))) map[m[1]] = dual(m[2].replace(/\\'/g, "'"), m[1]);
  return map;
})();
/** نصّ من وسم data-i18n في equipment.html. */
const eqHtmlT = (key) => {
  const m = eqHtml.match(new RegExp(`data-i18n="${key.replace('.', '\\.')}"[^>]*>([\\s\\S]*?)<`));
  return dual(m ? unent(m[1].replace(/\s+/g, ' ').trim()) : '', key);
};
/** قائمة نصية مكتوبة داخل نداء في المصدر، مثل ['A','B']. */
const eqList = (after, n = 1) => {
  const at = eqJs.indexOf(after);
  if (at < 0) throw new Error('غير موجود: ' + after);
  const re = /\[((?:\s*'[^']*'\s*,?)+)\]/g;
  re.lastIndex = at;
  let m, i = 0;
  while ((m = re.exec(eqJs))) if (++i === n) return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  throw new Error('قائمة غير موجودة بعد ' + after);
};

const equipment = {
  hero: {
    img: attrs(eqHtml.match(/<section class="phero">[\s\S]*?<img[^>]*>/)[0].match(/<img[^>]*>/)[0]).src,
    title: eqHtmlT('eq.heroTitle'),
    lede: eqHtmlT('eq.heroLede'),
    crumb: dual('Equipment', 'nav.equipment'),
  },
  /* الروابط الثلاثة أعلى الصفحة، وحقل البحث */
  jump: {
    links: [
      { href: '#environmental', title: dual('Environmental Equipment', 'nav.environmental'), text: eqHtmlT('eq.jump.env') },
      { href: '#power', title: dual('Power Generation', 'nav.power'), text: eqHtmlT('eq.jump.power') },
      { href: '#parts', title: dual('Spare Parts', 'nav.parts'), text: eqHtmlT('eq.jump.parts') },
    ],
    findLabel: eqHtmlT('eq.findLabel'),
    findHint: eqHtmlT('eq.findHint'),
    findClear: eqHtmlT('eq.findClear'),
    findPlaceholder: dual(
      unent(eqHtml.match(/<input type="search" id="q" placeholder="([^"]*)"/)[1]), 'eq.findPh'
    ),
  },
  sections: [
    {
      anchor: 'environmental', tone: 'paper', idx: '01',
      eyebrow: dual('Environmental Equipment', 'nav.environmental'),
      title: eqT['eq.env.title'], lede: eqT['eq.env.lede'],
      brandBlocks: [
        { brand: 'elgin', blurb: eqT['eq.elgin.blurb'], subs: eqList("brandBlock('elgin'") },
        { brand: 'vactor', blurb: eqT['eq.vactor.blurb'], subs: eqList("brandBlock('vactor'") },
        { brand: 'guzzler', blurb: eqT['eq.guzzler.blurb'], subs: eqList("brandBlock('guzzler'") },
      ],
    },
    {
      anchor: 'power', tone: '', idx: '02',
      eyebrow: dual('Power Generation', 'nav.power'),
      title: eqT['eq.power.title'], lede: eqT['eq.power.lede'],
      groups: [
        { style: 'ratings', title: eqT['eq.power.sets'], note: eqT['eq.power.setsNote'], category: 'power', subs: ['Generator Sets'] },
        { style: 'ratings', title: eqT['eq.power.rental'], note: eqT['eq.power.rentalNote'], category: 'power', subs: ['Rental Generators'] },
        { style: 'rows', title: eqT['eq.power.control'], category: 'power', subs: eqList("eq.power.control") },
        { style: 'rows', title: eqT['eq.power.fab'], category: 'power', subs: eqList("eq.power.fab") },
      ],
    },
    {
      anchor: 'parts', tone: 'paper', idx: '03',
      eyebrow: dual('Spare Parts', 'nav.parts'),
      title: eqT['eq.parts.title'], lede: eqT['eq.parts.lede'],
      groups: [{ style: 'rows', title: eqT['eq.parts.group'], category: 'parts', subs: [] }],
      brandCells: eqList('eq.parts.group'),
    },
  ],
  /* الحقل الذي يفرّق بين الموديلات المتشابهة، بالترتيب الذي يُبحث به */
  deciding: eqList('const DECIDING'),
  empty: { title: eqT['eq.emptyH'], text: eqT['eq.emptyP'] },
  ctaBand: (() => {
    const b = eqHtml.match(/<section class="ctaband">([\s\S]*?)<\/section>/)[1];
    const h2 = b.match(/<h2 data-i18n="([^"]+)">([\s\S]*?)<br><span class="accent">([\s\S]*?)<\/span><\/h2>/);
    const p = b.match(/<p data-i18n="([^"]+)">([\s\S]*?)<\/p>/);
    const btn = b.match(/<a class="btn" href="[^"]*" data-i18n="([^"]+)">([\s\S]*?)<span/);
    const figs = [...b.matchAll(/<div class="fig"><i data-ico="([^"]+)"><\/i><b(?: data-i18n="([^"]+)")?(?: data-count="(\d+)" data-suffix="([^"]*)")?>([^<]*)<\/b><span data-i18n="([^"]+)">([^<]*)<\/span><\/div>/g)]
      .map((m) => ({
        icon: m[1],
        count: m[3] ? { to: Number(m[3]), suffix: m[4] } : null,
        title: m[2] ? dual(unent(m[5]), m[2]) : null,
        text: dual(unent(m[7]), m[6]),
      }));
    /* الترجمة العربية لهذا المفتاح تحمل الوسوم داخلها («…<br><span
       class="accent">…</span>»)، فتُفصل هنا إلى شطرين كالإنجليزية. */
    const arWhole = arUI[h2[1]] ?? '';
    const split = arWhole.match(/^([\s\S]*?)<br>\s*<span class="accent">([\s\S]*?)<\/span>\s*$/);
    return {
      img: attrs(b.match(/<img[^>]*>/)[0]).src,
      title: { en: unent(h2[2].trim()), ar: unent((split ? split[1] : arWhole).trim()) },
      accent: { en: unent(h2[3].trim()), ar: unent((split ? split[2] : '').trim()) },
      text: dual(unent(p[2].replace(/\s+/g, ' ').trim()), p[1]),
      cta: dual(unent(btn[2].trim()), btn[1]),
      figs,
    };
  })(),
  meta: {
    title: unent((eqHtml.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1]),
    description: unent((eqHtml.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1]),
  },
};
log.ok(`أقسام: ${equipment.sections.length} · روابط علوية: ${equipment.jump.links.length} · بطاقات الدعوة: ${equipment.ctaBand.figs.length}`);

/* ---------------------------------------------------------------- الحفظ */
const out = { extractedAt: new Date().toISOString(), source: SRC, home, model, quote, equipment };
const file = path.join(import.meta.dirname, 'extracted-rest.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1), 'utf8');
log.step('تم');
log.ok(`${file}  (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
