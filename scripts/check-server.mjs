/* فحص جاهزية الخادم قبل التشغيل وبعده.

   يُشغَّل على الخادم نفسه: يتأكّد أن الإعدادات موجودة، وأن القاعدة تُوصَل
   ويُقرأ منها، وأن المجلدات قابلة للكتابة، وأن هناك مستخدمًا للوحة.

   node scripts/check-server.mjs */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { connect, loadEnv, log } from './lib.mjs';

let bad = 0;
const fail = (m) => { bad++; log.fail(m); };

/* ------------------------------------------------------------ 1) الإعدادات */
log.step('الإعدادات');
const env = { ...loadEnv(), ...process.env };
for (const k of ['DB_USER', 'DB_NAME', 'AUTH_SECRET']) {
  if (!env[k]) fail(`${k} غير مضبوط في .env.local`);
}
if (env.AUTH_SECRET && env.AUTH_SECRET.length < 32) fail('AUTH_SECRET أقصر من 32 حرفًا');
if (!bad) log.ok('كل المفاتيح المطلوبة موجودة');

/* ------------------------------------------------------- 2) قاعدة البيانات */
log.step('قاعدة البيانات');
let db;
try {
  db = await connect();
  const [[v]] = await db.query('SELECT VERSION() v');
  log.ok(`متصلة — MySQL ${v.v}`);
} catch (e) {
  fail(`تعذّر الاتصال: ${e.message}`);
}

if (db) {
  const need = { pages: 1, sections: 1, products: 1, brands: 1, nav_items: 1, translations: 1, users: 1 };
  for (const [t, min] of Object.entries(need)) {
    try {
      const [[r]] = await db.query(`SELECT COUNT(*) n FROM \`${t}\``);
      if (r.n < min) fail(`الجدول ${t} فارغ`);
      else log.ok(`${t.padEnd(14)} ${r.n}`);
    } catch {
      fail(`الجدول ${t} غير موجود — استورد scripts/dump.sql`);
    }
  }
  /* الترميز: قاعدة بترميز غير utf8mb4 تُفسد العربية بصمت */
  try {
    const [[c]] = await db.query(
      'SELECT DEFAULT_CHARACTER_SET_NAME c FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()'
    );
    if (c.c !== 'utf8mb4') fail(`ترميز القاعدة ${c.c} لا utf8mb4 — ستتشوّه العربية`);
    else log.ok('الترميز utf8mb4');
  } catch { /* لا صلاحية لقراءة information_schema على بعض الاستضافات */ }

  const [[u]] = await db.query('SELECT COUNT(*) n FROM users');
  if (!u.n) fail('لا مستخدم للوحة — أنشئه بـ node scripts/add-user.mjs');
  await db.end();
}

/* ----------------------------------------------------- 3) مجلد الرفع
   المرفوعات خارج public (انظر lib/uploads.ts). على الخادم يجب أن يكون المجلد
   خارج مجلد الإصدار، وإلا محاه أول نشر جديد. */
log.step('مجلد الرفع');
const prod = env.NODE_ENV === 'production' || process.argv.includes('--prod');
const uploadDir = env.UPLOAD_DIR?.trim()
  ? path.resolve(env.UPLOAD_DIR.trim())
  : prod ? null : path.join(process.cwd(), 'storage', 'uploads');
if (!uploadDir) {
  fail('UPLOAD_DIR غير مضبوط — بدونه يُرفض رفع الصور على الخادم');
} else {
  /* مثل insideApp في lib/uploads.ts: المجلد نفسه أو ما تحته، بعد حلّ الروابط الرمزية */
  const real = (p) => {
    let cur = path.resolve(p);
    const rest = [];
    for (;;) {
      try { return path.join(fs.realpathSync(cur), ...rest); }
      catch {
        const up = path.dirname(cur);
        if (up === cur) return path.resolve(p);
        rest.unshift(path.basename(cur));
        cur = up;
      }
    }
  };
  const rel = path.relative(real(process.cwd()), real(uploadDir));
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    (prod ? fail : log.warn)(`${uploadDir} داخل مجلد المشروع — على الخادم ضعه خارجه كي لا يُمحى عند النشر`);
  }
  try {
    for (const sub of ['img', 'video', 'docs']) {
      const full = path.join(uploadDir, sub);
      await fsp.mkdir(full, { recursive: true });
      const probe = path.join(full, '.write-test');
      await fsp.writeFile(probe, 'x');
      await fsp.unlink(probe);
    }
    log.ok(`${uploadDir} — قابل للكتابة`);
  } catch (e) {
    fail(`${uploadDir} غير قابل للكتابة: ${e.message}`);
  }
}

/* ----------------------------------------------------- معالجة الصور */
try {
  await import('sharp');
  log.ok('sharp تعمل — الصور تُصغَّر ويُصنع لها webp عند الرفع');
} catch (e) {
  fail(`sharp لا تعمل (${e.message.split('\n')[0]}) — رفع الصور سيُرفض. أعد npm ci على الخادم نفسه`);
}

/* ------------------------------------------------------------ 4) البناء */
log.step('نسخة الإنتاج');
if (fs.existsSync(path.join(process.cwd(), '.next'))) log.ok('مجلد .next موجود');
else fail('لا يوجد .next — شغّل npm run build');

log.step(bad ? `${bad} مشكلة — أصلحها قبل التشغيل` : 'الخادم جاهز');
process.exit(bad ? 1 : 0);
