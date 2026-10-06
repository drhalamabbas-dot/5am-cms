/* اختبار الرفع والعرض على خادم يعمل فعلًا — يُشغَّل على نسخة الإنتاج.

   يرفع صورة وفيديو صغيرين، ويتأكّد أنهما يُعرضان فورًا، وأن الصورة صُغِّرت
   وصُنع لها webp، وأن الفيديو يُطلب أجزاءً، وأن المسارات الخطرة تُرفض، وأن كل
   بديل webp تذكره صفحات الموقع موجود. ثم يحذف ما رفعه.

   الجلسة تُصنع من AUTH_SECRET مباشرةً، فلا كلمة مرور في الاختبار.

     node scripts/test-media.mjs http://localhost:3100            رفع ثم حذف
     node scripts/test-media.mjs http://localhost:3100 --keep     يُبقي الملفات
     node scripts/test-media.mjs http://localhost:3100 --check a,b يفحص ملفات سابقة فقط

   --keep و--check معًا يختبران البقاء بعد إعادة التشغيل: ارفع بـ --keep،
   أعد تشغيل الخادم، ثم افحص بـ --check بالمسارات التي طبعها. */
import { SignJWT } from 'jose';
import { connect, loadEnv, log } from './lib.mjs';

const BASE = (process.argv[2] ?? 'http://localhost:3100').replace(/\/$/, '');
const KEEP = process.argv.includes('--keep');
const CHECK = process.argv.includes('--check') ? process.argv[process.argv.indexOf('--check') + 1].split(',') : null;

let bad = 0;
const expect = (cond, okMsg, failMsg) => { if (cond) log.ok(okMsg); else { bad++; log.fail(failMsg ?? okMsg); } };

/* ------------------------------------------------------------ الجلسة */
const env = { ...loadEnv(), ...process.env };
const db = await connect();
const [[user]] = await db.query('SELECT id, email, role, session_ver FROM users ORDER BY id LIMIT 1');
await db.end();
const token = await new SignJWT({ email: user.email, role: user.role, sv: user.session_ver })
  .setProtectedHeader({ alg: 'HS256' }).setSubject(String(user.id))
  .setIssuedAt().setExpirationTime('10m')
  .sign(new TextEncoder().encode(env.AUTH_SECRET));
const cookie = `5am_session=${token}`;

const get = (p, headers = {}) => fetch(BASE + p, { headers, redirect: 'manual' });

async function checkServed(paths) {
  log.step('العرض');
  for (const p of paths) {
    const r = await get('/' + p);
    expect(r.status === 200, `${p} — ${r.status} ${r.headers.get('content-type')}`, `${p} — ${r.status}`);
  }
}

/* process.exit مع sharp محمّلة يُسقط Node على ويندوز، فيُضبط رمز الخروج
   ويُترك البرنامج ينتهي وحده. */
const done = (msg) => { log.step(bad ? `${bad} مشكلة` : msg); process.exitCode = bad ? 1 : 0; };

if (CHECK) {
  await checkServed(CHECK);
  done('كل الملفات ما زالت تُعرض');
} else {
  await full();
}

async function full() {
const { default: sharp } = await import('sharp');

/* ------------------------------------------------------------- الرفع */
log.step('الرفع');
/* صورة 3200×2000 بلا ضغط، فيُرى التصغير والضغط معًا */
const big = await sharp({ create: { width: 3200, height: 2000, channels: 3, background: '#2a6' } })
  .jpeg({ quality: 100 }).toBuffer();
/* فيديو mp4 مزيّف بترويسة صحيحة: الرفع لا يحلّله، والعرض يُختبر بالأجزاء */
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(5000, 7)]);

async function upload(name, buf, type) {
  const fd = new FormData();
  fd.append('files', new Blob([buf], { type }), name);
  const r = await fetch(BASE + '/api/admin/media', { method: 'POST', body: fd, headers: { cookie } });
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
}

const up = await upload('Test Photo.jpg', big, 'image/jpeg');
expect(up.added?.length === 1, `صورة رُفعت: ${up.added?.[0]?.path}`, `رفع الصورة فشل: ${JSON.stringify(up)}`);
const img = up.added?.[0];
expect(img && img.width <= 2560 && img.height <= 2560, `صُغِّرت إلى ${img?.width}×${img?.height}`);
expect(img && img.bytes < big.length, `الحجم ${big.length} ← ${img?.bytes} بايت`);

const upv = await upload('clip.mp4', mp4, 'video/mp4');
const vid = upv.added?.[0];
expect(!!vid, `فيديو رُفع: ${vid?.path}`, `رفع الفيديو فشل: ${JSON.stringify(upv)}`);

/* صورة صغيرة فيها بيانات كاميرا: يجب أن تُحذف ولو كانت أصغر من حدّ التصغير */
const exifJpg = await sharp({ create: { width: 120, height: 80, channels: 3, background: '#555' } })
  .jpeg({ quality: 60 }).withExif({ IFD0: { Copyright: 'exif-leak-test' } }).toBuffer();
const upe = await upload('small-exif.jpg', exifJpg, 'image/jpeg');
const exifRow = upe.added?.[0];
expect(!!exifRow, `صورة ببيانات كاميرا رُفعت: ${exifRow?.path}`);

const gif = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#f00' } }).gif().toBuffer();
const upg = await upload('anim.gif', gif, 'image/gif');
const gifRow = upg.added?.[0];
expect(!!gifRow && gifRow.width === 16, `GIF سليم قُبل (${gifRow?.width}×${gifRow?.height})`);

log.step('الرفض');
const badGif = await upload('broken.gif', Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(40, 3)]), 'image/gif');
expect(badGif.failed?.length === 1 && !badGif.added?.length, 'GIF تالف مرفوض');
const svg = await upload('x.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image/svg+xml');
expect(svg.failed?.length === 1 && !svg.added?.length, 'SVG مرفوض');
const fake = await upload('fake.jpg', Buffer.from('<html><script>alert(1)</script></html>'), 'image/jpeg');
expect(fake.failed?.length === 1 && !fake.added?.length, 'ملف HTML باسم jpg مرفوض');
const anon = await fetch(BASE + '/api/admin/media', { method: 'POST', body: new FormData() });
expect(anon.status === 401, 'الرفع بلا جلسة مرفوض (401)');

/* ------------------------------------------------------------- العرض */
const paths = [img?.path, img?.path.replace(/\.jpg$/, '.webp'), vid?.path].filter(Boolean);
await checkServed(paths);

if (img) {
  const r = await get('/' + img.path);
  expect(/immutable/.test(r.headers.get('cache-control') ?? ''), 'تُخزَّن في المتصفح (immutable)');
  expect(r.headers.get('x-content-type-options') === 'nosniff', 'nosniff');
  const meta = await sharp(Buffer.from(await r.arrayBuffer())).metadata();
  expect(meta.width <= 2560, `المعروضة ${meta.width}×${meta.height}`);
}

if (exifRow) {
  const r = await get('/' + exifRow.path);
  const buf = Buffer.from(await r.arrayBuffer());
  const meta = await sharp(buf).metadata();
  expect(!meta.exif && !buf.includes('exif-leak-test'), 'بيانات الكاميرا حُذفت من الصورة المعروضة');
}

if (vid) {
  log.step('الفيديو بالأجزاء');
  const r = await get('/' + vid.path, { range: 'bytes=0-99' });
  expect(r.status === 206 && (await r.arrayBuffer()).byteLength === 100, `Range 0-99 ← ${r.status}، ${r.headers.get('content-range')}`);
  const h = await fetch(BASE + '/' + vid.path, { method: 'HEAD' });
  expect(h.status === 200 && h.headers.get('content-length') === String(vid.bytes), `HEAD ← ${h.status}، ${h.headers.get('content-length')} بايت`);
  const bad416 = await get('/' + vid.path, { range: 'bytes=999999-' });
  expect(bad416.status === 416, `نطاق خارج الملف ← ${bad416.status}`);
}

log.step('مسارات خطرة');
for (const p of ['/media/..%2F..%2Fpackage.json', '/media/img/..%2F..%2F..%2F.env.local', '/media/img/nothing.jpg', '/media/x.svg', '/media']) {
  const r = await get(p);
  expect(r.status === 404, `${p} ← ${r.status}`);
}

/* ------------------------------------- بدائل webp في صفحات الموقع */
log.step('بدائل webp في الصفحات');
let checked = 0, broken = [];
for (const page of ['/', '/environment.html', '/power.html', '/aftersales.html', '/projects.html', '/about.html', '/model.html?p=elgin-pelican', '/equipment.html']) {
  const html = await (await get(page)).text();
  for (const m of html.matchAll(/<source srcSet="([^"]+\.webp[^"]*)"/g)) {
    checked++;
    const r = await get(m[1].replace(/&amp;/g, '&'));
    if (r.status !== 200) broken.push(`${page} → ${m[1]}`);
  }
}
expect(!broken.length, `${checked} بديل webp كلها موجودة`, `بدائل مكسورة:\n      ${broken.join('\n      ')}`);

/* ------------------------------------------------------------- الحذف */
if (!KEEP) {
  log.step('الحذف');
  for (const row of [img, vid, exifRow, gifRow].filter(Boolean)) {
    const r = await fetch(`${BASE}/api/admin/media?id=${row.id}`, { method: 'DELETE', headers: { cookie } });
    expect(r.status === 200, `حُذف ${row.path}`);
  }
  for (const p of paths) {
    const r = await get('/' + p);
    expect(r.status === 404, `${p} لم يعد يُعرض (${r.status})`);
  }
} else {
  log.info(`أُبقيت الملفات. بعد إعادة التشغيل:\n    node scripts/test-media.mjs ${BASE} --check ${paths.join(',')}`);
}

done('الرفع والعرض سليمان');
}
