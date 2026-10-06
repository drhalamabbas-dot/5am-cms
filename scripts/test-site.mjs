/* فحص شامل للموقع ولوحة التحكم على خادم شغّال، بلا تعديل في البيانات.

   الزائر: كل صفحة منشورة بلغتيها، وكل منتج منشور، والمسوّدات مخفية، وكل رابط
   داخلي يصل، وكل صورة وملف موجود، ولا أثر لأدوات التحرير في الصفحات.
   لوحة التحكم: تحمي نفسها بلا دخول، وكل شاشة فيها تفتح بلا خطأ بجلسة مؤقتة.
   الأمان: مسار الملفات المرفوعة لا يخرج من مجلده، وواجهة المعاينة تطلب دخولًا.

   node scripts/test-site.mjs [منفذ]          (الافتراضي 3000) */
import { SignJWT } from 'jose';
import { connect, loadEnv, log } from './lib.mjs';

const BASE = `http://localhost:${process.argv[2] || 3000}`;
const env = loadEnv();
const db = await connect();
const q = async (sql, args = []) => (await db.query(sql, args))[0];

let bad = 0, warn = 0, okCount = 0;
const fail = (m) => { bad++; log.fail(m); };
const warning = (m) => { warn++; log.warn(m); };
const pass = () => { okCount++; };

/* جلسة مؤقتة لساعة لأول مستخدم في القاعدة — لا كلمة مرور ولا تُحفظ في شيء */
const [user] = await q('SELECT id, email, role, session_ver FROM users ORDER BY id LIMIT 1');
const token = await new SignJWT({ email: user.email, role: user.role, sv: user.session_ver })
  .setProtectedHeader({ alg: 'HS256' }).setSubject(String(user.id))
  .setIssuedAt().setExpirationTime('1h')
  .sign(new TextEncoder().encode(env.AUTH_SECRET));
const ADMIN = { cookie: `5am_session=${token}` };

async function get(path, { admin = false, method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(BASE + path, {
    method, body, redirect: 'manual',
    headers: { ...(admin ? ADMIN : {}), ...headers },
  });
  const text = method === 'HEAD' ? '' : await r.text();
  return { status: r.status, text, location: r.headers.get('location') };
}

/** علامات صفحة خطأ من Next في وضعي التطوير والإنتاج */
const crashed = (html) => /id="__next_error__"|Application error|Internal Server Error|Unhandled Runtime Error/.test(html);

/* ================================================================ الزائر */
log.step('صفحات الموقع كما يراها الزائر');
const pages = await q('SELECT slug, template, published, redirect_to FROM pages ORDER BY position, id');
const urlOf = (slug) => (slug === 'index' ? '/' : `/${slug}.html`);
const visited = new Map();       // url -> html  (للروابط والصور بعدها)

for (const p of pages) {
  for (const lang of ['ar', 'en']) {
    if (p.template === 'product') continue;                       // تُفحص مع المنتجات
    const url = `${urlOf(p.slug)}?lang=${lang}`;
    const r = await get(url);
    if (p.redirect_to) {
      if (r.status >= 300 && r.status < 400) pass(); else fail(`${url} — صفحة تحويل ردّت ${r.status}`);
      continue;
    }
    if (!p.published) {
      if (r.status === 404) pass(); else fail(`${url} — مسوّدة ظاهرة للزائر (${r.status})`);
      continue;
    }
    if (r.status !== 200) { fail(`${url} — ${r.status}`); continue; }
    if (crashed(r.text)) { fail(`${url} — صفحة خطأ`); continue; }
    if (!r.text.includes('<main id="main"')) fail(`${url} — لا يوجد <main>`);
    const want = lang === 'ar' ? /<html[^>]*lang="ar"[^>]*dir="rtl"|<html[^>]*dir="rtl"[^>]*lang="ar"/ : /<html[^>]*lang="en"/;
    if (!want.test(r.text)) fail(`${url} — لغة/اتجاه الصفحة غير صحيح`);
    if (/class="ux-mark|ux-edittools|data-ux-|ux-ed-host|editbar/.test(r.text)) fail(`${url} — أدوات التحرير ظاهرة للزائر`);
    if (!/<title>[^<]+<\/title>/.test(r.text)) fail(`${url} — بلا عنوان`);
    visited.set(url, r.text);
    pass();
  }
}
log.ok(`${visited.size} صفحة منشورة (بلغتيها) تفتح سليمة`);

log.step('صفحات المنتجات');
const products = await q('SELECT ref, slug, name_en, name_ar, published, category, subcategory, hero_image FROM products');
let nProd = 0;
for (const p of products) {
  const url = `/model.html?p=${encodeURIComponent(p.slug)}&lang=ar`;
  const r = await get(url);
  if (r.status !== 200 && r.status !== 404) { fail(`${url} — ${r.status}`); continue; }
  if (crashed(r.text)) { fail(`${url} — صفحة خطأ`); continue; }
  /* «غير موجود» يُرسم داخل id="pdp" أيضًا، فالعلامة صحيفة المواصفات نفسها */
  const shown = r.text.includes('class="pdp"');
  if (p.published && !shown) fail(`${url} — منتج منشور لا يظهر`);
  else if (!p.published && shown) fail(`${url} — مسوّدة منتج ظاهرة للزائر`);
  else pass();
  if (p.published) {
    visited.set(url, r.text);
    nProd++;
    if (!p.subcategory) warning(`المنتج «${p.name_ar || p.name_en}» بلا تصنيف فرعي — لا يظهر في مجموعات الكتالوج`);
    if (!p.hero_image) warning(`المنتج «${p.name_ar || p.name_en}» بلا صورة رئيسية`);
  }
}
const missing = await get('/model.html?p=__no_such_product__&lang=ar');
if ((missing.status === 200 || missing.status === 404) && !missing.text.includes('class="pdp"')) pass();
else fail(`منتج غير موجود ردّ ${missing.status}`);
if (/name="robots" content="noindex/.test(missing.text)) pass(); else fail('صفحة «منتج غير موجود» قابلة للفهرسة');
log.ok(`${nProd} منتج منشور · ${products.length - nProd} مسوّدة مخفية`);

/* الحفظ يصل للزائر فورًا بشرط ألا تُخزَّن الصفحات: لا في المتصفح ولا في أي
   وسيط بينهما. لو أضاف أحدٌ revalidate أو كاشًا للصفحات، يفشل هذا الفحص. */
log.step('الصفحات لا تُخزَّن (الحفظ يصل للزائر فورًا)');
/* الإنتاج يرسل no-store، وخادم التطوير no-cache — كلاهما يمنع عرض نسخة قديمة */
let cacheBad = 0;
for (const url of ['/?lang=ar', '/about.html?lang=en', `/model.html?p=${products.find((p) => p.published)?.slug}&lang=ar`, '/equipment.html?lang=ar']) {
  const r = await fetch(BASE + url, { redirect: 'manual' });
  const cc = r.headers.get('cache-control') ?? '';
  if (/no-store|no-cache/.test(cc) && !/public|s-maxage|max-age=[1-9]/.test(cc)) pass();
  else { cacheBad++; fail(`${url} — Cache-Control «${cc}»: قد يحتفظ متصفح أو وسيط بنسخة قديمة بعد الحفظ`); }
}
if (!cacheBad) log.ok('كل صفحة تُطلب جديدة من الخادم');

log.step('صفحة غير موجودة');
const nf = await get('/no-such-page-zz.html?lang=ar');
if (nf.status === 404) pass(); else fail(`صفحة غير موجودة ردّت ${nf.status}`);
log.ok('404 كما يجب');

/* ------------------------------------------------- الروابط الداخلية */
log.step('الروابط الداخلية');
const pageSlugs = new Map(pages.map((p) => [p.slug, p]));
const prodBySlug = new Map(products.map((p) => [p.slug, p]));
const links = new Map();         // target -> أول صفحة ظهر فيها
for (const [from, html] of visited) {
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
    const href = m[1].replace(/&amp;/g, '&');
    if (/^(https?:|mailto:|tel:|#|javascript:|\/admin|\/_next)/i.test(href)) continue;
    const clean = href.replace(/^\//, '');
    if (!links.has(clean)) links.set(clean, from);
  }
}
let nLinks = 0;
const brokenLinks = new Set();
for (const [href, from] of links) {
  const [pathPart, query = ''] = href.split('#')[0].split('?');
  const params = new URLSearchParams(query);
  let ok = true, why = '';
  if (pathPart === 'model.html') {
    const pr = prodBySlug.get(params.get('p') ?? '');
    ok = !!pr && !!pr.published;
    why = pr ? 'منتج غير منشور' : 'منتج غير موجود';
  } else if (pathPart === '' || pathPart.endsWith('.html')) {
    const slug = pathPart.replace(/\.html$/, '') || 'index';
    const pg = pageSlugs.get(slug);
    ok = !!pg && (!!pg.published || !!pg.redirect_to);
    why = pg ? 'صفحة غير منشورة' : 'صفحة غير موجودة';
  } else if (/^(assets|media)\//.test(pathPart)) {
    const r = await get('/' + pathPart, { method: 'HEAD' });
    ok = r.status === 200; why = `ملف ${r.status}`;
  } else {
    const r = await get('/' + href);
    ok = r.status === 200; why = `${r.status}`;
  }
  nLinks++;
  if (ok) pass();
  else if (!brokenLinks.has(href)) { brokenLinks.add(href); fail(`رابط مكسور «${href}» (${why}) — في ${from}`); }
}
log.ok(`${nLinks} رابط داخلي مختلف فُحص`);

/* ------------------------------------------------- الصور والملفات */
log.step('الصور والفيديو والملفات');
const assets = new Map();
for (const [from, html] of visited) {
  const add = (v) => {
    v = v.replace(/&amp;/g, '&').trim();
    if (!v || /^(https?:|data:|\/_next|blob:)/.test(v)) return;
    const clean = v.replace(/^\//, '').split('?')[0].split('#')[0];
    if (!/^(assets|media)\//.test(clean)) return;
    if (!assets.has(clean)) assets.set(clean, from);
  };
  for (const m of html.matchAll(/\b(?:src|data-src|poster|data-poster)="([^"]+)"/g)) add(m[1]);
  for (const m of html.matchAll(/\b(?:srcset|data-srcset)="([^"]+)"/g)) m[1].split(',').forEach((s) => add(s.trim().split(/\s+/)[0]));
  for (const m of html.matchAll(/<link\b[^>]*href="([^"]+)"/g)) add(m[1]);
  for (const m of html.matchAll(/data-shots="([^"]+)"/g)) {
    try { JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')).forEach(add); } catch {}
  }
  for (const m of html.matchAll(/url\(([^)]+)\)/g)) add(m[1].replace(/['"]/g, ''));
}
let nAssets = 0;
for (const [a, from] of assets) {
  const r = await get('/' + encodeURI(a), { method: 'HEAD' });
  nAssets++;
  if (r.status === 200) pass(); else fail(`ملف مفقود «${a}» (${r.status}) — في ${from}`);
}
log.ok(`${nAssets} صورة وملف مختلف فُحص`);

/* ============================================================ لوحة التحكم */
log.step('لوحة التحكم بلا دخول');
for (const path of ['/admin', '/admin/pages', '/admin/products', '/admin/edit/environment', '/admin/history']) {
  const r = await get(path);
  if (r.status >= 300 && r.status < 400 && /\/admin\/login/.test(r.location ?? '')) pass();
  else if (r.status === 200 && /name="password"/.test(r.text)) pass();
  else fail(`${path} بلا دخول ردّ ${r.status} — المفروض صفحة الدخول`);
}
const login = await get('/admin/login');
if (login.status === 200 && /type="password"/.test(login.text)) pass(); else fail(`صفحة الدخول ${login.status}`);
const api = await get('/api/admin/preview', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
if (api.status === 401 || api.status === 403) pass(); else fail(`واجهة المعاينة بلا دخول ردّت ${api.status}`);
const apiMedia = await get('/api/admin/media', { method: 'POST', body: '' });
if (apiMedia.status === 401 || apiMedia.status === 403 || (apiMedia.status >= 300 && apiMedia.status < 400)) pass();
else fail(`رفع الملفات بلا دخول ردّ ${apiMedia.status}`);
log.ok('محمية');

log.step('كل شاشات لوحة التحكم (بجلسة مؤقتة)');
const sections = await q('SELECT s.id, p.slug FROM sections s JOIN pages p ON p.id = s.page_id');
const CORE = ['onepage', 'product', 'quote', 'equipment'];
const EDITABLE = ['sections', 'onepage'];
const screens = [
  '/admin', '/admin/pages', '/admin/pages/new', '/admin/products',
  ...pages.filter((p) => p.template === 'sections' && !p.redirect_to).slice(0, 3).map((p) => `/admin/pages/new/copy?from=${p.slug}`),
  '/admin/media', '/admin/settings', '/admin/translations', '/admin/nav', '/admin/history',
  `/admin/search?q=${encodeURIComponent('مولد')}`,
  ...pages.map((p) => `/admin/pages/${p.slug}`),
  ...pages.filter((p) => !CORE.includes(p.template)).map((p) => `/admin/pages/${p.slug}/delete`),
  ...pages.filter((p) => EDITABLE.includes(p.template) && !p.redirect_to).map((p) => `/admin/edit/${p.slug}`),
  ...sections.map((s) => `/admin/pages/${s.slug}/sections/${s.id}`),
  ...products.map((p) => `/admin/products/${encodeURIComponent(p.slug)}`),
];
let nScreens = 0;
for (const path of screens) {
  const r = await get(path, { admin: true });
  nScreens++;
  if (r.status !== 200) { fail(`${path} — ${r.status}${r.location ? ' → ' + r.location : ''}`); continue; }
  if (crashed(r.text)) { fail(`${path} — صفحة خطأ`); continue; }
  pass();
}
log.ok(`${nScreens} شاشة تفتح بلا خطأ`);

log.step('المعاينة لصاحب الموقع');
const draftPages = pages.filter((p) => !p.published && !p.redirect_to && p.template !== 'product');
for (const p of draftPages) {
  const r = await get(`${urlOf(p.slug)}?lang=ar`, { admin: true });
  if (r.status === 200 && !crashed(r.text)) pass(); else fail(`مسوّدة ${p.slug} لا تفتح لصاحب الموقع (${r.status})`);
}
for (const p of products.filter((x) => !x.published)) {
  const r = await get(`/model.html?p=${encodeURIComponent(p.slug)}&lang=ar`, { admin: true });
  if (r.status === 200 && r.text.includes('class="pdp"') && /noindex/.test(r.text)) pass();
  else fail(`مسوّدة المنتج ${p.slug} لا تظهر لصاحب الموقع أو بلا noindex`);
}
log.ok(`${draftPages.length} صفحة و${products.filter((x) => !x.published).length} منتج مسوّدة تظهر لصاحب الموقع وحده`);

/* ================================================================ الأمان */
log.step('مسار الملفات المرفوعة');
for (const evil of ['/media/../.env.local', '/media/..%2f.env.local', '/media/%2e%2e/%2e%2e/.env.local', '/media/..%5c.env.local', '/media/x.html']) {
  const r = await get(evil);
  if (r.status === 404 || r.status === 400) pass();
  else if (/AUTH_SECRET|DB_PASSWORD/.test(r.text)) fail(`${evil} — سرّب ملف الإعدادات!`);
  else fail(`${evil} — ردّ ${r.status} بدل 404`);
}
log.ok('لا خروج من مجلد الملفات');

/* ================================================================ المحتوى */
log.step('ملاحظات على المحتوى');
const navRows = await q(`SELECT id, parent_id, label_ar, href, published FROM nav_items WHERE area = 'header' AND published = 1`);
for (const n of navRows) {
  if (!n.href || n.href === '#') {
    const kids = navRows.some((k) => k.parent_id === n.id);
    if (!kids) warning(`عنصر في الهيدر «${n.label_ar}» ظاهر للزائر وبلا رابط`);
  }
}
for (const p of pages.filter((x) => x.published && !x.redirect_to && x.template === 'sections')) {
  const [{ n }] = await q('SELECT COUNT(*) n FROM sections s JOIN pages p ON p.id = s.page_id WHERE p.slug = ? AND s.published = 1', [p.slug]);
  if (!n) warning(`الصفحة «${p.slug}» منشورة وليس فيها أي قسم ظاهر`);
}

/* ================================================================ الحصيلة */
console.log('');
log.step(`${okCount} فحص ناجح · ${bad} خطأ · ${warn} ملاحظة`);
await db.end();
process.exit(bad ? 1 : 0);
