/* =============================================================================
   يستخرج محتوى الموقع الحالي كما هو.

   الطريقة: تشغيل ملفات الموقع نفسها داخل بيئة متصفح وهمية، وأخذ البيانات من
   الذاكرة مباشرة. بهذا لا يُعاد كتابة أي نص بيد بشرية، فلا يضيع ولا يتغيّر حرف.

   الناتج: scripts/extracted.json — يُراجَع قبل إدخاله قاعدة البيانات.
============================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { log } from './lib.mjs';

const SRC = process.env.SITE_SRC
  || 'C:\\Users\\Mohamed Nagy\\OneDrive - Arab Open University - AOU\\Desktop\\5am-website - Copy';
const JS = path.join(SRC, 'assets', 'js');
const read = (f) => fs.readFileSync(path.join(JS, f), 'utf8');

/* ------------------------------------------------ بيئة متصفح وهمية مبسّطة
   الملفات تُعرّف بياناتها عند التحميل ثم تنتظر DOMContentLoaded كي ترسم.
   الحدث لا يقع هنا، فلا يُنفَّذ أي كود رسم — نأخذ البيانات فقط. */
function makeSandbox(lang = 'en') {
  const noop = () => {};
  /* الهدف دالة كي يعمل الاستدعاء والقراءة معًا: el().hasAttribute('x') */
  const el = () => new Proxy(function () {}, {
    get(t, k) {
      if (k === 'style' || k === 'dataset' || k === 'classList') return el();
      if (k === 'children' || k === 'childNodes' || k === 'files') return [];
      if (k === 'textContent' || k === 'innerHTML' || k === 'value' || k === 'className') return '';
      if (k === 'length') return 0;
      if (typeof k === 'symbol') return undefined;
      return el();
    },
    apply: () => el(),
    construct: () => el(),
    set: () => true,
    has: () => true,
  });
  const document = {
    documentElement: { lang, dir: lang === 'ar' ? 'rtl' : 'ltr', classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, style: {} },
    body: el(),
    head: el(),
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => el(),
    createRange: () => el(),
    currentScript: { src: 'http://localhost/assets/js/x.js?v=1' },
    scripts: [],
    title: '',
  };
  /* i18n.js يقرأ اللغة من ?lang= في العنوان لا من وسم <html>، فتُضبط هنا
     وإلا عادت كل النصوص إنجليزية مهما كان lang. */
  const search = lang === 'ar' ? '?lang=ar' : '';
  const window = {
    document,
    location: { href: 'http://localhost/index.html' + search, search, pathname: '/index.html', origin: 'http://localhost', protocol: 'http:' },
    navigator: { userAgent: 'node', language: lang },
    addEventListener: noop,
    removeEventListener: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    requestAnimationFrame: noop,
    setTimeout, clearTimeout, setInterval, clearInterval,
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    URL, URLSearchParams, console,
  };
  window.window = window; window.globalThis = window; window.self = window;
  /* pages2.js يفكّك window.UI عند التحميل، فنقدّم البديل الأدنى الذي يحتاجه.
     لا نشغّل site.js لأنه يرسم الهيدر ويسجّل أحداثًا لا لزوم لها هنا. */
  window.UI = {
    qs: () => null, qsa: () => [],
    esc: (s) => String(s ?? ''),
    pic: (src, alt) => `<img src="${src}" alt="${alt || ''}">`,
    ico: new Proxy({}, { get: () => '<svg></svg>' }),
    icon: () => '', icons: noop, init: noop, reveal: noop, mount: noop,
    brandOf: () => null, subLabel: (s) => s, figure: () => '',
    productCard: () => '', industryCard: () => '', projectCard: () => '', brandCell: () => '',
    reduced: false,
  };
  const ctx = vm.createContext(window);
  ctx.document = document;
  return ctx;
}

function run(ctx, code, name) {
  try { vm.runInContext(code, ctx, { filename: name }); return true; }
  catch (e) { log.fail(`${name}: ${e.message}`); return false; }
}

/* ------------------------------------------------------------- 1) البيانات */
log.step('استخراج data.js — الشركة والمنتجات والماركات');
const ctxEn = makeSandbox('en');
run(ctxEn, read('data.js'), 'data.js');
const SITE = ctxEn.window.SITE;
if (!SITE) { log.fail('window.SITE لم يُعرَّف'); process.exit(1); }
log.ok(`منتجات: ${SITE.products.length} · ماركات: ${Object.keys(SITE.brands).length} · قطاعات: ${SITE.industries?.length ?? 0}`);

/* ------------------------------------------------- 2) الترجمة العربية */
log.step('استخراج i18n.ar.js — نصوص الواجهة والنسخة العربية من البيانات');
/* i18n.ar.js يسلّم قاموسه عبر I18N.register، فنعترض الاستدعاء ونأخذه منه.
   الحزمة نصفان: UI مفاتيح منقوطة للواجهة، و phrases ترجمة جملة بجملة
   وهي التي تُعرِّب أسماء المنتجات ومواصفاتها. */
const ctxAr = makeSandbox('ar');
run(ctxAr, read('data.js'), 'data.js');
run(ctxAr, read('i18n.js'), 'i18n.js');
let arUI = {}, arPhrases = {};
const realRegister = ctxAr.window.I18N?.register;
ctxAr.window.I18N.register = function (code, dict, content) {
  if (code === 'ar') { arUI = dict || {}; arPhrases = (content && content.phrases) || {}; }
  try { return realRegister.apply(this, arguments); } catch { /* الرسم لا يعنينا */ }
};
run(ctxAr, read('i18n.ar.js'), 'i18n.ar.js');
const siteAr = ctxAr.window.SITE;
log.ok(`مفاتيح واجهة عربية: ${Object.keys(arUI).length}`);
log.ok(`جمل مترجمة: ${Object.keys(arPhrases).length}`);

/* ------------------------------------------------------------- 3) الصفحات */
log.step('استخراج pages2.js — صفحات الموقع وسكاشنها');
/* PAGES ثابت داخل إغلاق pages2.js ولا يُصدَّر. نكشفه بسطر واحد يُحقن قبل
   تسجيل حدث الرسم — المنطق كما هو، ولا يُنفَّذ أي رسم. */
function extractPages(lang) {
  const ctx = makeSandbox(lang);
  run(ctx, read('data.js'), 'data.js');
  const code = read('pages2.js').replace(
    /D\.addEventListener\('DOMContentLoaded'/,
    "globalThis.__PAGES = PAGES; D.addEventListener('DOMContentLoaded'"
  );
  run(ctx, code, 'pages2.js');
  return ctx.window.__PAGES ?? ctx.__PAGES;
}
const PAGES = extractPages('en');
if (!PAGES) { log.fail('لم يُعثر على PAGES'); process.exit(1); }
const pageKeys = Object.keys(PAGES);
log.ok(`صفحات: ${pageKeys.length} — ${pageKeys.join(', ')}`);
let secCount = 0;
for (const p of Object.values(PAGES)) secCount += (p.sections || []).length;
log.ok(`سكاشن: ${secCount}`);

/* ------------------------------------------------- 4) المنيو العلوي والفوتر
   buildNav و footerOnePage محبوستان داخل إغلاق site.js. نكشفهما بسطر واحد
   ثم نستدعيهما مرة بالإنجليزية ومرة بالعربية. الفوتر يعيد HTML، فتُقرأ أعمدته
   منه — أدقّ من إعادة كتابتها بيد. */
log.step('استخراج المنيو والفوتر');
function extractNav(lang) {
  const ctx = makeSandbox(lang);
  run(ctx, read('data.js'), 'data.js');
  run(ctx, read('i18n.js'), 'i18n.js');
  if (lang === 'ar') run(ctx, read('i18n.ar.js'), 'i18n.ar.js');
  const code = read('site.js').replace(
    /window\.UI = \{/,
    'globalThis.__buildNav = buildNav; globalThis.__footer = footerOnePage; window.UI = {'
  );
  run(ctx, code, 'site.js');
  const w = ctx.window;
  let nav = null, footerHtml = null;
  try { nav = w.__buildNav?.(); } catch (e) { log.warn(`buildNav(${lang}): ${e.message}`); }
  try { footerHtml = w.__footer?.(); } catch (e) { log.warn(`footer(${lang}): ${e.message}`); }
  return { nav, footerHtml };
}

/** يقرأ أعمدة الفوتر من الـ HTML الذي يولّده الموقع نفسه. */
const unent = (s) => String(s ?? '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ');

function parseFooter(html) {
  if (!html) return [];
  const cols = [];
  const re = /<h2 class="ftr__h">([\s\S]*?)<\/h2>\s*<ul>([\s\S]*?)<\/ul>/g;
  let m;
  while ((m = re.exec(html))) {
    const links = [];
    const lre = /<a href="([^"]*)">([\s\S]*?)<\/a>/g;
    let l;
    while ((l = lre.exec(m[2]))) links.push({ href: unent(l[1]), label: unent(l[2].trim()) });
    cols.push({ title: unent(m[1].trim()), links });
  }
  return cols;
}

const navEn = extractNav('en');
const navAr = extractNav('ar');
const footerEn = parseFooter(navEn.footerHtml);
const footerAr = parseFooter(navAr.footerHtml);
log.ok(`عناصر المنيو: ${navEn.nav?.length ?? 0}`);
log.ok(`أعمدة الفوتر: ${footerEn.length} (عربي ${footerAr.length})`);

/* ------------------------------- 5) علاقات الصفحات من ux.js
   ux.js يضيف بالجافاسكريبت: أزرار الهيرو، وشريط محتويات الصفحة، وقسم «وصول
   مباشر للخدمات». الأخير مبني على خرائط ثابتة داخل الملف، وهي بيانات لا منطق،
   فتُنقل إلى قاعدة البيانات ليصير تعديلها من الداش بورد. */
log.step('استخراج علاقات الصفحات من ux.js');
function literal(code, name, open = '[') {
  const close = open === '[' ? ']' : '}';
  const at = code.indexOf(`const ${name}=`) >= 0 ? code.indexOf(`const ${name}=`) : code.indexOf(`const ${name} =`);
  if (at < 0) return null;
  const s = code.indexOf(open, at);
  let depth = 0;
  for (let i = s; i < code.length; i++) {
    if (code[i] === open) depth++;
    else if (code[i] === close) { depth--; if (!depth) return vm.runInNewContext('(' + code.slice(s, i + 1) + ')'); }
  }
  return null;
}
const ux = read('ux.js');
const uxPages    = literal(ux, 'pages', '[')     ?? [];
const uxGroups   = literal(ux, 'groups', '{')    ?? {};
const uxSolution = literal(ux, 'solution', '{')  ?? {};
const uxRelated  = literal(ux, 'mapping', '{')   ?? {};
log.ok(`صفحات معروفة: ${uxPages.length} · مجموعات: ${Object.keys(uxGroups).length} · روابط مقترحة: ${Object.keys(uxRelated).length}`);

/* --------------------------------------------------------------- 6) الحفظ */
const out = {
  extractedAt: new Date().toISOString(),
  source: SRC,
  site: {
    company: SITE.company, story: SITE.story, brands: SITE.brands,
    categories: SITE.categories, products: SITE.products,
    engineering: SITE.engineering, repoweringSteps: SITE.repoweringSteps,
    federal: SITE.federal, scope: SITE.scope, storyShort: SITE.storyShort,
    services: SITE.services, lifecycle: SITE.lifecycle,
    industries: SITE.industries, projects: SITE.projects, whyUs: SITE.whyUs,
  },
  arUI,
  arPhrases,
  pages: PAGES,
  nav: { en: navEn.nav, ar: navAr.nav },
  footer: { en: footerEn, ar: footerAr },
  ux: { pages: uxPages, groups: uxGroups, solution: uxSolution, related: uxRelated },
};
const file = path.join(import.meta.dirname, 'extracted.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1), 'utf8');
log.step('تم');
log.ok(`${file}  (${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB)`);
