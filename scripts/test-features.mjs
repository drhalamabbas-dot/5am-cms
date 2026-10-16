/* =============================================================================
   اختبار كل خصائص المشروع من أولها لآخرها — كما يستعملها الزائر والموظف
   والسوبر أدمن، على الموقع الشغّال:

     الصلاحيات والجلسات · الطلبات والتنبيهات والتصعيد · العملاء والصفقات ·
     المتجر وقفله · المحادثة (اللغة، الذاكرة، طلب موظف، رد الموظف، الفلتر،
     موديلنا ورجوعه لـ Qwen) · الحضور والانصراف · التحليلات · التصدير · الأمان

   ينشئ بيانات اختبار خاصة به (حساب أدمن تجريبي، طلبات بأرقام 0109900…)، وفي
   النهاية يمسح كل ما أنشأه ويرجّع أي إعداد غيّره — بياناتك الحقيقية لا تُمسّ.

   يستهلك 2–3 رسائل من حد Qwen اليومي (المجاني 50 رسالة).

   node scripts/test-features.mjs [منفذ]          (الافتراضي 3000)
============================================================================= */
import http from 'node:http';
import { createHmac } from 'node:crypto';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { connect, loadEnv, log } from './lib.mjs';

const BASE = `http://localhost:${process.argv[2] || 3000}`;
const env = loadEnv();
const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];
const one = async (s, a = []) => (await q(s, a))[0];

let ok = 0, bad = 0;
const check = (cond, msg) => { if (cond) ok++; else { bad++; log.fail(msg); } };
const step = (s) => log.step(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const ip = () => `198.51.100.${Math.floor(Math.random() * 250) + 1}`;

/* ------------------------------------------------ لقطة قبل الاختبار */
const maxId = async (t) => Number((await one(`SELECT COALESCE(MAX(id),0) n FROM ${t}`)).n);
const before = {};
for (const t of ['requests', 'customers', 'deals', 'notifications', 'audit_log', 'chat_conversations', 'chat_cache', 'users', 'attendance', 'customer_accounts', 'login_codes']) before[t] = await maxId(t);
const settingsBefore = Object.fromEntries((await q("SELECT `key`, `value` FROM settings WHERE `key` IN ('chat','store','attendance')"))
  .map((r) => [r.key, typeof r.value === 'string' ? r.value : JSON.stringify(r.value)]));
const trafficBefore = await q('SELECT * FROM traffic_daily WHERE day = CURDATE()');
const visitorsBefore = await q('SELECT * FROM visitors_daily WHERE day = CURDATE()');
const statsBefore = await q('SELECT * FROM product_stats WHERE day = CURDATE()');
const setSetting = (k, v) => q('UPDATE settings SET `value` = ? WHERE `key` = ?', [JSON.stringify(v), k]);

const token = async (u) => new SignJWT({ email: u.email, role: u.role, sv: u.session_ver }).setProtectedHeader({ alg: 'HS256' })
  .setSubject(String(u.id)).setIssuedAt().setExpirationTime('30m').sign(new TextEncoder().encode(env.AUTH_SECRET));
const owner = await one('SELECT id, email, role, session_ver FROM users ORDER BY is_owner DESC, id LIMIT 1');
const SUPER = { cookie: `5am_session=${await token(owner)}` };
const get = (p, h = {}) => fetch(BASE + p, { headers: h, redirect: 'manual' });
const post = (p, body, h = {}) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip(), ...h }, body: JSON.stringify(body), redirect: 'manual' });
const html = async (p, h) => { const r = await get(p, h); return { status: r.status, loc: r.headers.get('location') ?? '', text: r.status === 200 ? await r.text() : '' }; };
const noError = (t) => !/Application error|digest/.test(t);

let mock;
try {
  /* ============================================================ الصلاحيات */
  step('الصلاحيات والجلسات');
  const hash = await bcrypt.hash('qa-test-password-123', 4);
  const res = await q("INSERT INTO users (email, password_hash, name, role, perms, active, created_by) VALUES ('qa-test-admin@5am.test', ?, 'QA-TEST موظف', 'admin', ?, 1, ?)",
    [hash, JSON.stringify(['requests.view', 'requests.handle', 'chat.handle']), owner.id]);
  const staff = await one('SELECT id, email, role, session_ver FROM users WHERE id = ?', [res.insertId]);
  const STAFF = { cookie: `5am_session=${await token(staff)}` };
  for (const [p, want] of [['/admin', 200], ['/admin/requests', 200], ['/admin/chats', 200], ['/admin/users', 307], ['/admin/pages', 307], ['/admin/analytics', 307], ['/admin/audit', 307], ['/admin/customers', 307]]) {
    const r = await get(p, STAFF);
    check(r.status === want, `موظف مبيعات ← ${p}: ${r.status} بدل ${want}`);
  }
  const den = await get('/admin/users', STAFF);
  check((den.headers.get('location') ?? '').includes('denied='), 'الرفض لا يحوّل لرسالة «ليست لديك صلاحية»');
  for (const p of ['/admin/users', '/admin/analytics', '/admin/audit', '/admin/attendance/table', '/admin/chat-training', '/admin/store', '/admin/deals']) {
    const r = await html(p, SUPER);
    check(r.status === 200 && noError(r.text), `سوبر أدمن ← ${p}: ${r.status}`);
  }
  await q('UPDATE users SET session_ver = session_ver + 1 WHERE id = ?', [staff.id]);
  check((await get('/admin', STAFF)).status === 307, 'جلسة قديمة بعد تغيير كلمة المرور ما زالت تعمل');
  const staff2 = await one('SELECT id, email, role, session_ver FROM users WHERE id = ?', [staff.id]);
  const STAFF2 = { cookie: `5am_session=${await token(staff2)}` };
  await q('UPDATE users SET active = 0 WHERE id = ?', [staff.id]);
  check((await get('/admin', STAFF2)).status === 307, 'حساب موقوف ما زال يدخل');
  await q('UPDATE users SET active = 1 WHERE id = ?', [staff.id]);
  /* رمز عميل في كوكي الأدمن لا يصلح (مفتاح مشتق آخر) */
  const custKey = new TextEncoder().encode(createHmac('sha256', env.AUTH_SECRET).update('5am-customer-session').digest('hex'));
  const custTok = await new SignJWT({ typ: 'cust', sv: 1 }).setProtectedHeader({ alg: 'HS256' }).setSubject(String(owner.id)).setIssuedAt().setExpirationTime('5m').sign(custKey);
  check((await get('/admin', { cookie: `5am_session=${custTok}` })).status === 307, 'رمز عميل دخل لوحة الأدمن!');
  log.ok('صلاحيات وجلسات');

  /* ============================================================ الطلبات */
  step('الطلبات والتنبيهات والتصعيد');
  const prod = await one('SELECT slug FROM products WHERE published = 1 AND store_hidden = 0 LIMIT 1');
  const r1 = await (await post('/api/requests', { kind: 'store', source: 'store', name: 'QA-TEST عميل', phone: '01099000001', items: [{ ref: prod.slug, qty: 2 }] })).json();
  check(r1.ok && r1.id, 'طلب المتجر لم يُحفظ');
  const r2 = await (await post('/api/requests', { kind: 'quote', name: 'QA-TEST عميل', phone: '+20 109 900 0001', message: 'طلب تاني' })).json();
  const two = await q('SELECT customer_id FROM requests WHERE id IN (?, ?)', [r1.id, r2.id]);
  check(two.length === 2 && two[0].customer_id && two[0].customer_id === two[1].customer_id, 'رقمان بصيغتين لم يصيرا عميلًا واحدًا');
  check((await post('/api/requests', { name: 'QA-TEST', phone: '12' })).status === 400, 'رقم غلط اتقبل');
  check((await (await post('/api/requests', { name: 'QA-TEST', phone: '01099000002', website: 'x' })).json()).ok, 'فخ الروبوت لا يرد بنجاح صامت');
  check(Number((await one("SELECT COUNT(*) n FROM requests WHERE phone = '01099000002'")).n) === 0, 'طلب الروبوت اتحفظ');
  const notes = Number((await one('SELECT COUNT(*) n FROM notifications WHERE request_id = ? AND user_id = ?', [r1.id, staff.id])).n);
  check(notes === 1, 'موظف المبيعات لم يصله تنبيه الطلب');
  await q('UPDATE requests SET created_at = NOW() - INTERVAL 6 MINUTE WHERE id = ?', [r2.id]);
  await get('/api/admin/notifications', SUPER);
  check(Boolean((await one('SELECT escalated_at FROM requests WHERE id = ?', [r2.id])).escalated_at), 'الطلب المتأخر لم يُصعَّد');
  const ex = await get('/api/admin/requests/export?s=all', SUPER);
  const exBuf = Buffer.from(await ex.arrayBuffer());
  check(ex.status === 200 && exBuf[0] === 0xef && exBuf.toString().includes('QA-TEST'), 'تصدير الطلبات');
  check((await get('/api/admin/requests/export', STAFF2)).status === 403, 'تصدير الطلبات بلا صلاحية اتسمح');
  log.ok('طلبات');

  /* ============================================================ العملاء والصفقات */
  step('العملاء والصفقات');
  const cid = two[0].customer_id;
  for (const p of [`/admin/customers/${cid}`, '/admin/customers?q=01099000001', `/admin/requests/${r1.id}`]) {
    const r = await html(p, SUPER);
    check(r.status === 200 && noError(r.text) && r.text.includes('QA-TEST'), `${p}`);
  }
  const dRes = await q("INSERT INTO deals (customer_id, request_id, title, value, stage, owner_id) VALUES (?, ?, 'QA-TEST صفقة', 100000, 'quoted', ?)", [cid, r1.id, owner.id]);
  const dp = await html(`/admin/deals/${dRes.insertId}`, SUPER);
  check(dp.status === 200 && noError(dp.text), 'صفحة الصفقة');
  const board = await html('/admin/deals', SUPER);
  check(board.text.includes('QA-TEST صفقة'), 'الصفقة لا تظهر في اللوحة');
  const cex = await get('/api/admin/customers/export', SUPER);
  check(cex.status === 200 && (await cex.text()).includes('QA-TEST'), 'ملف العملاء للسوبر أدمن');
  check((await get('/api/admin/customers/export', STAFF2)).status === 403, 'ملف العملاء لغير السوبر أدمن اتسمح');
  log.ok('عملاء وصفقات');

  /* ============================================================ المتجر */
  step('المتجر');
  /* يُفتح أولًا: الاختبار يفحص السلوك في الحالتين، فلا يصحّ أن يتعلّق بما هو
     محفوظ وقت التشغيل. صاحب الموقع قد يترك متجره مقفولًا، وذلك ليس عطلًا. */
  const storeSet = JSON.parse(settingsBefore.store ?? '{}');
  await setSetting('store', { ...storeSet, enabled: true });
  const st = await html('/store.html?lang=ar');
  check(st.status === 200 && (st.text.match(/class="scard"/g) ?? []).length > 0, 'صفحة المتجر بلا منتجات');
  await setSetting('store', { ...storeSet, enabled: false, closed: 'home' });
  const closed = await get('/store.html?lang=ar');
  check(closed.status === 307, 'المتجر المقفول لا يحوّل الزائر');
  check(!(await html('/?lang=ar')).text.includes('store.html'), 'رابط المتجر المقفول ما زال في المنيو');
  check((await get('/store.html?lang=ar', SUPER)).status === 200, 'الأدمن لا يعاين المتجر المقفول');
  await setSetting('store', { ...storeSet, enabled: true });
  check((await get('/store.html?lang=ar')).status === 200, 'إعادة فتح المتجر');
  log.ok('متجر');

  /* ============================================================ المحادثة */
  step('المحادثة والبوت');
  let chatCookie = '';
  const chat = async (body) => {
    const r = await post('/api/chat', body, chatCookie ? { cookie: chatCookie } : {});
    const sc = r.headers.get('set-cookie'); if (sc) chatCookie = sc.split(';')[0];
    const d = await r.json(); return { ...d, bot: d.messages?.filter((m) => m.role === 'bot').at(-1)?.text ?? '' };
  };
  /* قفل المحادثة على أصحاب الحسابات: يُختبر أولًا، ثم تُفتح لبقية الاختبارات
     التي تحاكي زائرًا بلا حساب. */
  const chatBase = { ...JSON.parse(settingsBefore.chat), requireLogin: false };
  await setSetting('chat', { ...chatBase, requireLogin: true });
  const gated = await post('/api/chat', { text: 'عندكم مكانس شوارع؟', lang: 'ar' });
  check(gated.status === 401, `المحادثة المقفولة على أصحاب الحسابات ردّت ${gated.status} بدل 401 لزائر`);
  const gatedGet = await (await fetch(`${BASE}/api/chat`)).json().catch(() => ({}));
  check(gatedGet.requireLogin === true, 'الواجهة لا تعرف أن المحادثة تطلب تسجيل الدخول');
  await setSetting('chat', chatBase);

  const g = await chat({ text: 'السلام عليكم', lang: 'en' });
  check(/أهل/.test(g.bot), 'التحية بالعربي من صفحة إنجليزية لم يُرد عليها بالعربي');
  const c1 = await chat({ text: 'ايه رقم التليفون والعنوان بتاعكم؟', lang: 'ar' });
  check(c1.ok && c1.bot.length > 10, 'سؤال التواصل بلا رد');
  const cv = (await one("SELECT `value` FROM settings WHERE `key` = 'company'")).value;
  const company = typeof cv === 'string' ? JSON.parse(cv) : cv;
  /* موديلنا (خادم وهمي متوافق مع OpenAI) بردّ فيه سعر ورقم مخترعان */
  mock = http.createServer((req, res) => { req.resume(); req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: 'المولد ده سعره يبدأ من 350 ألف جنيه. كلمنا على 01099943428 أو sales@fake.com.' } }] }));
  }); }).listen(3998, '127.0.0.1');
  await setSetting('chat', { ...chatBase, provider: 'own', ownUrl: 'http://127.0.0.1:3998', ownModel: 'qa-mock' });
  const own = await chat({ text: 'QA-TEST عايز مولد 450 كيلو لمزرعة', lang: 'ar' });
  check(!/350|جنيه/.test(own.bot), `الفلتر سمح بسعر: ${own.bot}`);
  check(!own.bot.includes('01099943428') && !own.bot.includes('fake.com'), 'الفلتر سمح برقم/بريد مخترع');
  check(own.bot.includes(company.phone) || own.bot.includes('عرض سعر'), 'الفلتر لم يضع بيانات الشركة أو ملاحظة عرض السعر');
  check((await one('SELECT source FROM chat_messages WHERE role = "bot" ORDER BY id DESC LIMIT 1')).source === 'own', 'الرد لم يأتِ من موديلنا');
  mock.close(); mock = null; await sleep(300);
  const fb = await chat({ text: 'QA-TEST هل عندكم مولدات بمحركات كامنز؟', lang: 'ar' });
  const fbSrc = (await one('SELECT source FROM chat_messages WHERE role = "bot" ORDER BY id DESC LIMIT 1')).source;
  check(['qwen', 'backup', 'kb'].includes(fbSrc) && fb.bot.length > 10, 'موديلنا نايم ولم يكمّل غيره');
  if (fbSrc === 'kb') log.warn('Qwen والاحتياطي لم يردا الآن (الحد اليومي أو زحمة) — البوت ردّ من صفحات الموقع كما يجب');
  /* DeepSeek مصدرًا: بمفتاحه يرد هو، وبلا مفتاح أو رصيد يكمّل Qwen — العميل لا يقف */
  await setSetting('chat', { ...chatBase, provider: 'deepseek' });
  const ds = await chat({ text: 'QA-TEST ايه الفرق بين المولد المفتوح وأبو كابينة؟', lang: 'ar' });
  const dsSrc = (await one('SELECT source FROM chat_messages WHERE role = "bot" ORDER BY id DESC LIMIT 1')).source;
  check(ds.bot.length > 10 && ['deepseek', 'qwen', 'backup', 'kb'].includes(dsSrc), 'مصدر DeepSeek: البوت لم يرد');
  log.ok(`DeepSeek مصدرًا ← ردّ من: ${dsSrc}`);
  await setSetting('chat', chatBase);
  /* الذاكرة: نفس السؤال مرة ثانية لا يكلّم أي موديل */
  if (fbSrc !== 'kb') {
    const again = await chat({ text: 'QA-TEST هل عندكم مولدات بمحركات كامنز؟', lang: 'ar' });
    check((await one('SELECT source FROM chat_messages WHERE role = "bot" ORDER BY id DESC LIMIT 1')).source === 'cache' && again.bot === fb.bot, 'السؤال المكرّر لم يُجب من الذاكرة');
  }
  const h1 = await chat({ text: 'عايز اكلم موظف', lang: 'ar' });
  check(h1.handoff === true, 'طلب الموظف لم يُفهم');
  const h2 = await (await post('/api/chat', { lang: 'ar', handoff: { name: 'QA-TEST محادثة', phone: '01099000003' } }, { cookie: chatCookie })).json();
  check(h2.ok, 'تسجيل طلب الموظف');
  const conv = await one('SELECT id, status FROM chat_conversations ORDER BY id DESC LIMIT 1');
  check(conv.status === 'human', 'المحادثة لم تتحوّل لموظف');
  check(Number((await one('SELECT COUNT(*) n FROM notifications WHERE link = ? AND user_id = ?', [`/admin/chats/${conv.id}`, staff.id])).n) === 1, 'موظف المحادثات لم يصله تنبيه');
  const silent = await chat({ text: 'انا مستني', lang: 'ar' });
  check(!silent.messages.some((m) => m.role === 'bot'), 'البوت رد وهي مع موظف');
  const rep = await post(`/api/admin/chats/${conv.id}`, { text: 'QA-TEST أهلًا، معاك الفريق' }, SUPER);
  check(rep.status === 200, 'رد الموظف');
  const seen = await (await get('/api/chat?after=0', { cookie: chatCookie })).json();
  check(seen.messages.some((m) => m.role === 'agent'), 'العميل لا يرى رد الموظف');
  check((await get(`/api/admin/chats/${conv.id}`)).status === 401, 'محادثة الأدمن بلا دخول اتفتحت');
  for (const p of ['/admin/chats', `/admin/chats/${conv.id}`, '/admin/chat-training']) {
    const r = await html(p, SUPER); check(r.status === 200 && noError(r.text), p);
  }
  const tex = await get('/api/admin/chat-training/export', SUPER);
  check(tex.status === 200 && /jsonl/.test(tex.headers.get('content-type') ?? ''), 'تصدير بيانات التدريب');
  const nb = await get('/api/admin/chat-training/notebook', SUPER);
  check(nb.status === 200 && JSON.parse(await nb.text()).cells.length > 5, 'دفتر Colab');
  check((await (await get('/api/admin/chat-training/generate', SUPER)).json()).remaining > 0, 'مولّد بيانات التدريب لا يرى أسئلة');
  log.ok('محادثة وبوت');

  /* ============================================================ الحضور */
  step('الحضور والانصراف');
  const att = JSON.parse(settingsBefore.attendance ?? '{}');
  const jpg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(3000, 7)]).toString('base64');
  const base = Array.from({ length: 128 }, (_, i) => Math.sin(i) * 0.1);
  const A = (body) => post('/api/admin/attendance', body, STAFF2).then((r) => r.json());
  check(/وافق/.test((await A({ kind: 'enroll', descriptor: base, photo: jpg })).message), 'تسجيل الوجه بلا موافقة اتقبل');
  check((await A({ kind: 'enroll', descriptor: base, photo: jpg, consent: true })).ok, 'تسجيل الوجه');
  if (att.lat != null) {
    check(/متر/.test((await A({ kind: 'in', descriptor: base, photo: jpg, lat: att.lat + 0.3, lng: att.lng, accuracy: 20 })).message), 'حضور من بعيد اتقبل');
    const inn = await A({ kind: 'in', descriptor: base.map((x) => x + 0.005), photo: jpg, lat: att.lat, lng: att.lng, accuracy: 15 });
    check(inn.ok && inn.status === 'ok', `حضور من المكتب بوجه مطابق: ${inn.message}`);
    const out = await A({ kind: 'out', descriptor: base.map((x, i) => x + (i % 2 ? 0.09 : -0.09)), photo: jpg, lat: att.lat, lng: att.lng, accuracy: 15 });
    check(out.ok && out.status === 'review', 'وجه مختلف في الانصراف لم يتحوّل للمراجعة');
    const row = await one('SELECT in_photo FROM attendance WHERE user_id = ?', [staff.id]);
    check((await get(`/api/admin/attendance/photo?f=${encodeURIComponent(row.in_photo)}`)).status === 401, 'صورة الحضور ظاهرة بلا دخول');
    check((await get(`/api/admin/attendance/photo?f=${encodeURIComponent(row.in_photo)}`, SUPER)).status === 200, 'السوبر أدمن لا يرى صورة الحضور');
  } else log.warn('موقع المكتب غير مضبوط — تخطّي اختبار الحضور');
  const at = await html('/admin/attendance/table', SUPER);
  check(at.status === 200 && noError(at.text), 'جدول الحضور');
  const ax = await get('/api/admin/attendance/export', SUPER);
  check(ax.status === 200, 'تصدير الحضور');
  log.ok('حضور');

  /* ============================================================ التحليلات */
  step('التحليلات');
  const pageViews = async () => Number((await one("SELECT COALESCE(SUM(n),0) n FROM traffic_daily WHERE day = CURDATE() AND dim = 'page'")).n);
  const v0 = await pageViews();
  await post('/api/stats', { kind: 'view', path: '/qa-test.html', lang: 'ar', ref: 'https://www.google.com/' }, { 'user-agent': UA });
  await post('/api/stats', { kind: 'view', path: '/qa-test.html', lang: 'ar' }, { 'user-agent': 'Googlebot/2.1' });
  await post('/api/stats', { kind: 'view', path: '/qa-test.html', lang: 'ar' }, { 'user-agent': UA, ...SUPER });
  await sleep(500);
  check(await pageViews() === v0 + 1, 'عدّ الزيارات غلط (لازم يعدّ الزائر بس، مش الروبوت ولا الأدمن)');
  for (const r of [7, 30, 90]) { const a = await html(`/admin/analytics?r=${r}`, SUPER); check(a.status === 200 && noError(a.text), `التحليلات ${r} يوم`); }
  log.ok('تحليلات');

  /* ============================================================ صفحات الموقع */
  step('صفحات الموقع وحساب العميل');
  for (const p of ['/?lang=ar', '/?lang=en', '/account?lang=ar', '/account?lang=en', '/quote.html?lang=ar', '/sitemap.xml']) {
    const r = await html(p); check(r.status === 200 && noError(r.text), `${p}: ${r.status}`);
  }
  const acc = await html('/account?lang=ar');
  check(acc.text.includes('برمز على البريد') && acc.text.includes('بالموبايل وكلمة مرور'), 'صفحة الحساب بلا طريقتي الدخول');
  log.ok('صفحات');
} catch (e) {
  bad++; log.fail(`توقف الاختبار: ${e?.stack ?? e}`);
} finally {
  /* ============================================================ تنظيف */
  if (mock) mock.close();
  for (const [k, v] of Object.entries(settingsBefore)) await q('UPDATE settings SET `value` = ? WHERE `key` = ?', [v, k]);
  const testUsers = (await q("SELECT id FROM users WHERE email = 'qa-test-admin@5am.test'")).map((r) => r.id);
  const fs = await import('node:fs'); const path = await import('node:path');
  const priv = env.PRIVATE_DIR || path.join(env.UPLOAD_DIR || path.join(process.cwd(), 'storage', 'uploads')) + '-private';
  for (const uid of testUsers) {
    for (const r of await q('SELECT photo p FROM face_profiles WHERE user_id = ? UNION ALL SELECT in_photo FROM attendance WHERE user_id = ? UNION ALL SELECT out_photo FROM attendance WHERE user_id = ?', [uid, uid, uid])) {
      if (r.p) fs.rmSync(path.join(priv, r.p), { force: true });
    }
  }
  if (testUsers.length) await q(`DELETE FROM users WHERE id IN (${testUsers.join(',')})`);
  await q('DELETE FROM chat_conversations WHERE id > ?', [before.chat_conversations]);
  await q('DELETE FROM chat_cache WHERE id > ?', [before.chat_cache]);
  await q('DELETE FROM deals WHERE id > ?', [before.deals]);
  await q('DELETE FROM notifications WHERE id > ?', [before.notifications]);
  await q('DELETE FROM requests WHERE id > ?', [before.requests]);
  await q('DELETE FROM customers WHERE id > ?', [before.customers]);
  await q('DELETE FROM audit_log WHERE id > ?', [before.audit_log]);
  await q('DELETE FROM traffic_daily WHERE day = CURDATE()'); await q('DELETE FROM visitors_daily WHERE day = CURDATE()'); await q('DELETE FROM product_stats WHERE day = CURDATE()');
  for (const r of trafficBefore) await q('INSERT INTO traffic_daily SET ?', [r]);
  for (const r of visitorsBefore) await q('INSERT INTO visitors_daily SET ?', [r]);
  for (const r of statsBefore) await q('INSERT INTO product_stats SET ?', [r]);
  for (const t of ['requests', 'customers', 'deals', 'chat_conversations', 'chat_messages', 'chat_cache', 'attendance']) {
    const [[c]] = await db.query(`SELECT COUNT(*) n FROM ${t}`);
    if (!c.n) await db.query(`ALTER TABLE ${t} AUTO_INCREMENT = 1`);
  }
  log.step(`${ok} فحص ناجح · ${bad} خطأ — وبيانات الاختبار اتمسحت والإعدادات رجعت`);
  await db.end();
  process.exit(bad ? 1 : 0);
}
