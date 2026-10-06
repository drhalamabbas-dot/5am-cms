/* اختبار معاينة مسوّدة المنتج: يراها صاحب الموقع وحده، ولا تُفهرس، ولا تظهر
   في الكتالوج ولا البحث.

   ينشئ منتجًا مسوّدة مؤقتًا، ويطلب صفحته مرة بلا جلسة ومرة بجلسة، ثم يحذفه.
     node scripts/test-product-draft.mjs [http://localhost:3000] */
import { SignJWT } from 'jose';
import { connect, loadEnv, log } from './lib.mjs';

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const SLUG = 'zz-draft-product';
const NAME = 'Draft Test Sweeper ZZ';

const env = { ...loadEnv(), ...process.env };
const db = await connect();
const [[user]] = await db.query('SELECT id, email, role, session_ver FROM users ORDER BY id LIMIT 1');
const token = await new SignJWT({ email: user.email, role: user.role, sv: user.session_ver }).setProtectedHeader({ alg: 'HS256' })
  .setSubject(String(user.id)).setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(env.AUTH_SECRET));

await db.query('DELETE FROM products WHERE slug = ?', [SLUG]);
await db.query(
  `INSERT INTO products (ref, slug, category, subcategory, published, name_en, data, position)
   VALUES (?, ?, 'environmental', 'Sweepers', 0, ?, '{}', 9999)`,
  [SLUG, SLUG, NAME]
);

let bad = 0;
const check = (cond, m) => { if (cond) log.ok(m); else { bad++; log.fail(m); } };
const page = async (p, auth) => {
  const r = await fetch(BASE + p, { headers: auth ? { cookie: `5am_session=${token}` } : {} });
  return { status: r.status, html: await r.text(), cache: r.headers.get('cache-control') ?? '' };
};

try {
  log.step('زائر بلا جلسة');
  const anon = await page(`/model.html?p=${SLUG}`, false);
  check(!anon.html.includes(NAME), 'لا يرى المنتج المسوّدة');
  check(!anon.html.includes('ux-editbar'), 'ولا شريط التحرير');

  log.step('صاحب الموقع');
  const own = await page(`/model.html?p=${SLUG}`, true);
  check(own.html.includes(NAME), 'يرى المنتج المسوّدة');
  check(own.html.includes('مسوّدة — لا يراها الزائر'), 'والشريط يقول إنه مسوّدة');
  check(own.html.includes(`/admin/products/${SLUG}`), 'وزرّ التحرير يفتح محرّر المنتج');
  check(/<meta name="robots" content="noindex/.test(own.html), 'ولا تُفهرس (noindex)');
  check(!/public/.test(own.cache), `ولا تُخزَّن في كاش مشترك (${own.cache || 'بلا Cache-Control'})`);

  log.step('القوائم');
  for (const p of ['/equipment.html', '/environment.html', '/']) {
    const r = await page(p, true);
    check(!r.html.includes(NAME), `${p} لا يذكره حتى لصاحب الموقع`);
  }

  log.step('منتج منشور لم يتأثر');
  const pub = await page('/model.html?p=elgin-pelican', false);
  check(pub.html.includes('Pelican') && !/<meta name="robots" content="noindex/.test(pub.html), 'elgin-pelican يظهر ويُفهرس');
} finally {
  await db.query('DELETE FROM products WHERE slug = ?', [SLUG]);
  await db.end();
}

log.step(bad ? `${bad} مشكلة` : 'معاينة المسوّدة سليمة');
process.exitCode = bad ? 1 : 0;
