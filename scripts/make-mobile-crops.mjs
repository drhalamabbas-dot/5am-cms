/* =============================================================================
   قَصّات الهاتف لصور الهيرو.

   الصورة العريضة (1920×1080 مثلًا) داخل صندوقٍ طوليّ على الهاتف تُقَصّ
   أطرافها فيضيع نصف المشهد. فلكلّ صورة قَصّةٌ طولية 768×1376 باسمها نفسه
   + «-mobile.jpg» بجانبها، يلتقطها lib/uploads.ts تلقائيًّا.

   هذا يبحث عن كل صورة هيرو في القاعدة لا قَصّةَ لها ويولّدها.
   والقَصّ بـattention: sharp يختار الجزء الذي فيه التفاصيل، فلا تُقطَع
   المعدّة من نصفها كما يفعل القصّ من المركز.

   القَصّة تُستعمل أينما ظهرت الصورة لا في الهيرو وحده (components/site/Pic.tsx)،
   فصورةٌ في بطاقةٍ عريضة تتغيّر معها. لذا يُحدَّد ما يُولَّد بـ--only.

   node scripts/make-mobile-crops.mjs                   ← عرضٌ بلا كتابة
   node scripts/make-mobile-crops.mjs --only=<جزء> --apply
============================================================================= */
import { connect, log } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const APPLY = process.argv.includes('--apply');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice('--only='.length);
const W = 768, H = 1376;
const ROOT = process.cwd();
const UPLOADS = process.env.UPLOAD_DIR?.trim() || path.join(ROOT, 'storage', 'uploads');
const PUBLIC = path.join(ROOT, 'public');

/** المسار على القرص لصورةٍ كما تُكتب في القاعدة */
function diskOf(rel) {
  const clean = String(rel || '').replace(/[?#].*$/, '').replace(/^\//, '');
  if (!clean) return null;
  if (clean.startsWith('media/')) return path.join(UPLOADS, clean.slice('media/'.length));
  return path.join(PUBLIC, clean);
}
const mobileRel = (rel) => String(rel).replace(/[?#].*$/, '').replace(/\.(webp|jpe?g|png)$/i, '-mobile.jpg');

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];

/* كل الصور داخل أقسام الصفحات: الهيرو والسلايدر وما يشبههما */
const rows = await q("SELECT id, page_id, type, content FROM sections WHERE content IS NOT NULL");
const seen = new Map();          // rel -> [{section, where}]
const pick = (v) => (typeof v === 'string' ? v.trim() : '');

for (const r of rows) {
  const d = typeof r.content === 'string' ? JSON.parse(r.content) : (r.content ?? {});
  const add = (img, imgMobile, where) => {
    const src = pick(img);
    if (!src || /-mobile\.(jpe?g|webp|png)$/i.test(src)) return;
    /* قَصّةٌ مكتوبة في اللوحة تُغني عن الملف المجاور */
    if (pick(imgMobile)) return;
    if (!seen.has(src)) seen.set(src, []);
    seen.get(src).push(`#${r.id} ${r.type} ${where}`);
  };
  add(d.img, d.imgMobile, 'hero');
  for (const [i, s] of (Array.isArray(d.slides) ? d.slides : []).entries()) {
    add(s?.img, s?.imgMobile, `slides[${i}]`);
  }
}

/* وأيضًا صورة الهيرو المخزّنة على الصفحة نفسها */
const pages = await q("SELECT id, slug, hero FROM pages WHERE hero IS NOT NULL AND hero <> ''");
for (const p of pages) {
  const src = pick(p.hero);
  if (src && !/-mobile\./i.test(src)) {
    if (!seen.has(src)) seen.set(src, []);
    seen.get(src).push(`page:${p.slug}`);
  }
}

const missing = [];
for (const [src, uses] of seen) {
  const orig = diskOf(src);
  if (!orig || !fs.existsSync(orig)) { missing.push({ src, uses, state: 'الأصل غير موجود' }); continue; }
  const mob = diskOf(mobileRel(src));
  if (mob && fs.existsSync(mob)) continue;            // لها قَصّة
  const meta = await sharp(orig).metadata().catch(() => null);
  if (!meta) { missing.push({ src, uses, state: 'تعذّرت قراءتها' }); continue; }
  /* الطولية أصلًا لا تحتاج قَصّة: الصندوق طوليّ مثلها */
  if (meta.height >= meta.width) continue;
  missing.push({ src, uses, state: 'ناقصة', orig, mob, size: `${meta.width}×${meta.height}` });
}

console.log(`\n${seen.size} صورة هيرو مستعملة · ${missing.length} بلا قَصّة هاتف\n`);
for (const m of missing) {
  console.log(`  ${m.state}  ${m.size ?? ''}  ${m.src}`);
  console.log(`      في: ${m.uses.join(' · ')}`);
}

if (APPLY) {
  if (!ONLY) {
    console.log('\nلم يُولَّد شيء: حدّد ما تريد بـ--only=<جزء من المسار>.');
    await db.end();
    process.exit(1);
  }
  let made = 0;
  for (const m of missing) {
    if (m.state !== 'ناقصة' || !m.src.includes(ONLY)) continue;
    await sharp(m.orig)
      .resize(W, H, { fit: 'cover', position: sharp.strategy.attention })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(m.mob);
    /* نسخة webp بجانبها كما لبقيّة الصور */
    await sharp(m.orig)
      .resize(W, H, { fit: 'cover', position: sharp.strategy.attention })
      .webp({ quality: 80 })
      .toFile(m.mob.replace(/\.jpg$/i, '.webp'))
      .catch(() => {});
    made++;
    log.ok(`${path.basename(m.mob)}`);
  }
  console.log(`\nتم توليد ${made} قَصّة.`);
} else if (missing.some((m) => m.state === 'ناقصة')) {
  console.log('\nللتوليد: node scripts/make-mobile-crops.mjs --apply');
}

await db.end();
