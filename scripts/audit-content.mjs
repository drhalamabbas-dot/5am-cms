/* =============================================================================
   مراجعة المحتوى: ما لا يكشفه فحص الصفحات (test-site.mjs) لأنه نصّ لا رابط.

   • نصّ تجريبي أو مؤقت: حرف واحد، حرف مكرّر (تتتت)، «اكتب … هنا»، أرقام بلا معنى.
   • لغة في غير مكانها: عربي في الحقل الإنجليزي (يظهر في الموقع الإنجليزي).
   • لغة ناقصة: عربي بلا إنجليزي أو العكس — النسخة الأخرى تعرض البديل أو لا شيء.
   • مسافات زائدة في أول النص أو آخره.
   • روابط داخلية إلى صفحة أو منتج غير موجود، وصور غير موجودة على القرص —
     في المسوّدات والأقسام المخفية أيضًا.
   • سطر «خدمات ما بعد البيع» الافتراضي فوق قسم «صورة ونص» في صفحة أخرى.

   node scripts/audit-content.mjs          يعرض فقط
   node scripts/audit-content.mjs --json   النتيجة JSON (للأدوات)
============================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { connect } from './lib.mjs';

const ROOT = path.join(import.meta.dirname, '..');
const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];
const J = (v) => (typeof v === 'string' ? JSON.parse(v) : v) ?? {};

const pages = await q('SELECT id, slug, template, published, crumb_ar, crumb_en, parent_slug, hero, redirect_to FROM pages');
const sections = await q('SELECT s.id, s.page_id, s.type, s.published, s.content, p.slug FROM sections s JOIN pages p ON p.id = s.page_id ORDER BY p.slug, s.position');
const products = await q('SELECT id, slug, ref, published, name_ar, name_en, type_ar, type_en, description_ar, description_en, hero_image, subcategory, data FROM products');
const nav = await q('SELECT id, area, label_ar, label_en, href, published, parent_id FROM nav_items');
const media = new Set((await q('SELECT path FROM media')).map((r) => r.path));
const slugs = new Set(pages.map((p) => p.slug));
const prodSlugs = new Set(products.flatMap((p) => [p.slug, p.ref]));
const uploadDir = process.env.UPLOAD_DIR || path.join(ROOT, 'storage', 'uploads');

const issues = [];
const add = (where, kind, detail, fix = null) => issues.push({ where, kind, detail, fix });

const AR = /[؀-ۿ]/;
const LATIN = /[A-Za-z]/;
const junk = (s) => {
  const t = s.trim();
  if (!t) return false;
  if (/^(.)\1{2,}$/u.test(t.replace(/\s/g, ''))) return 'حرف مكرّر';
  if ([...t].length === 1 && !/\d/.test(t)) return 'حرف واحد';
  if (/^(اكتب|أضف) .* هنا$|^Write .* here$/i.test(t)) return 'نصّ مؤقت من المحرّر';
  /* كلمة كاملة لا بداية كلمة: «Tested & handed over» نصّ حقيقي */
  if (/^(test|testing|lorem\b.*|asdf\w*|zz\w*)$/i.test(t) || /^1{3,}$/.test(t)) return 'نصّ تجريبي';
  return false;
};
const fileExists = (p) => {
  const clean = p.replace(/^\//, '').split(/[?#]/)[0];
  if (clean.startsWith('media/')) return media.has(clean) || fs.existsSync(path.join(uploadDir, clean.slice(6)));
  return fs.existsSync(path.join(ROOT, 'public', clean));
};
const isImgPath = (s) => /^\/?(assets|media)\/.+\.(jpe?g|png|webp|gif|svg|mp4|webm|pdf)$/i.test(s.split(/[?#]/)[0]);
const linkOk = (h) => {
  if (!h || /^(https?:|mailto:|tel:|#)/i.test(h)) return true;
  const [p, qs] = h.replace(/^\//, '').split('#')[0].split('?');
  if (p === 'model.html') return prodSlugs.has(new URLSearchParams(qs).get('p') ?? '');
  if (/\.html$/.test(p) || p === '') return slugs.has(p.replace(/\.html$/, '') || 'index') || ['index', 'equipment', 'quote'].includes(p.replace(/\.html$/, ''));
  if (isImgPath(p)) return fileExists(p);
  return true;
};

/** يمرّ على المحتوى: نصوص بلغتيها، وروابط، وصور */
function walk(where, v, pathStr = '') {
  if (v == null) return;
  if (typeof v === 'string') {
    if (isImgPath(v) && !fileExists(v)) add(where, 'صورة مفقودة', `${pathStr}: ${v}`);
    return;
  }
  if (Array.isArray(v)) { v.forEach((x, i) => walk(where, x, pathStr ? `${pathStr}.${i}` : String(i))); return; }
  if (typeof v !== 'object') return;
  const keys = Object.keys(v);
  /* حقل بلغتين */
  if (keys.length && keys.every((k) => k === 'ar' || k === 'en') && keys.some((k) => typeof v[k] === 'string')) {
    const ar = v.ar ?? '', en = v.en ?? '';
    for (const [lang, s] of [['ar', ar], ['en', en]]) {
      if (typeof s !== 'string' || !s) continue;
      const j = junk(s);
      if (j) add(where, 'نصّ تجريبي', `${pathStr}.${lang} = «${s.slice(0, 40)}» (${j})`);
      if (s !== s.trim()) add(where, 'مسافة زائدة', `${pathStr}.${lang} = «${s}»`, { path: `${pathStr}.${lang}`, trim: true });
    }
    if (en && AR.test(en) && !LATIN.test(en)) add(where, 'عربي في الحقل الإنجليزي', `${pathStr}.en = «${en.slice(0, 50)}»`);
    if (ar.trim() && !en.trim() && LATIN.test(ar) === false) add(where, 'إنجليزي ناقص', `${pathStr}: «${ar.slice(0, 40)}» بلا ترجمة`);
    if (en.trim() && !ar.trim() && !AR.test(en)) add(where, 'عربي ناقص', `${pathStr}: «${en.slice(0, 40)}» بلا عربي`);
    return;
  }
  for (const k of keys) {
    if (k === 'href' && typeof v[k] === 'string' && !linkOk(v[k])) add(where, 'رابط مكسور', `${pathStr ? pathStr + '.' : ''}href = ${v[k]}`);
    /* prefill وأخواته قوالب تُلصق بها كلمات، فمسافتها الأخيرة مقصودة */
    if (k === 'design' || /prefill|prefix|suffix/i.test(k)) continue;
    walk(where, v[k], pathStr ? `${pathStr}.${k}` : k);
  }
}

for (const p of pages) {
  const where = `صفحة ${p.slug}${p.published ? '' : ' (مسوّدة)'}`;
  walk(`${where} › أعلى الصفحة`, J(p.hero), 'hero');
  if (p.parent_slug && !slugs.has(p.parent_slug)) add(where, 'صفحة أم غير موجودة', p.parent_slug);
  if (!p.crumb_ar?.trim() || !p.crumb_en?.trim()) add(where, 'اسم ناقص', `crumb_ar=«${p.crumb_ar ?? ''}» crumb_en=«${p.crumb_en ?? ''}»`);
  if (p.redirect_to && !linkOk(p.redirect_to)) add(where, 'تحويل إلى صفحة غير موجودة', p.redirect_to);
}
const storyEyebrowPages = new Set();
for (const s of sections) {
  const where = `صفحة ${s.slug} › قسم ${s.id} (${s.type})${s.published ? '' : ' [مخفي]'}`;
  const c = J(s.content);
  walk(where, c);
  /* «خدمات ما بعد البيع» صحيح في صفحتها وفي الصفحات التي تحتها (صيانة المواقع) */
  const underAftersales = s.slug === 'aftersales' || pages.find((p) => p.slug === s.slug)?.parent_slug === 'aftersales'
    || nav.some((n) => n.href?.startsWith(`${s.slug}.html`) && nav.find((x) => x.id === n.parent_id)?.href?.startsWith('aftersales.html'));
  if (s.type === 'story' && !c.eyebrow && c.eyebrowStyle !== 'none' && !underAftersales) {
    add(where, 'سطر افتراضي خاطئ', '«خدمات ما بعد البيع» يظهر فوق العنوان لأن السطر الصغير فارغ', { section: s.id, eyebrowOf: s.slug });
    storyEyebrowPages.add(s.slug);
  }
  if (Array.isArray(c.imgs) && new Set(c.imgs).size !== c.imgs.length) add(where, 'صورة مكرّرة في المعرض', `${c.imgs.length - new Set(c.imgs).size} تكرار`);
}
for (const p of products) {
  const where = `منتج ${p.slug}${p.published ? '' : ' (مسوّدة)'}`;
  walk(where, J(p.data));
  for (const [k, v] of Object.entries({ name_ar: p.name_ar, name_en: p.name_en, type_ar: p.type_ar, description_ar: p.description_ar })) {
    if (typeof v === 'string' && v !== v.trim()) add(where, 'مسافة زائدة', `${k} = «${v}»`);
    if (typeof v === 'string' && junk(v)) add(where, 'نصّ تجريبي', `${k} = «${v}»`);
  }
  if (p.hero_image && !fileExists(p.hero_image)) add(where, 'صورة مفقودة', `hero_image: ${p.hero_image}`);
  if (p.published && !p.subcategory) add(where, 'تصنيف فرعي ناقص', 'لا يظهر في مجموعات الكتالوج');
  const gal = J(p.data).gallery ?? [];
  if (new Set(gal).size !== gal.length) add(where, 'صورة مكرّرة في المعرض', `${gal.length - new Set(gal).size} تكرار`);
}
for (const n of nav) {
  const where = `منيو ${n.area} › «${n.label_ar}»${n.published ? '' : ' [مخفي]'}`;
  if (n.href && !linkOk(n.href)) add(where, 'رابط مكسور', n.href);
  for (const [k, v] of [['label_ar', n.label_ar], ['label_en', n.label_en]]) {
    if (typeof v === 'string' && v !== v.trim()) add(where, 'مسافة زائدة', `${k} = «${v}»`);
    if (typeof v === 'string' && junk(v)) add(where, 'نصّ تجريبي', `${k} = «${v}»`);
  }
  if (n.label_en && AR.test(n.label_en) && !LATIN.test(n.label_en)) add(where, 'عربي في الحقل الإنجليزي', n.label_en);
}

if (process.argv.includes('--json')) console.log(JSON.stringify(issues, null, 1));
else {
  const by = {};
  for (const i of issues) (by[i.kind] ??= []).push(i);
  for (const [k, list] of Object.entries(by)) {
    console.log(`\n▸ ${k} (${list.length})`);
    for (const i of list.slice(0, 40)) console.log(`  ${i.where}: ${i.detail}`);
    if (list.length > 40) console.log(`  … و${list.length - 40} أخرى`);
  }
  console.log(`\n${issues.length} ملاحظة`);
}
await db.end();
