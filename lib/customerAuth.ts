/* =============================================================================
   حسابات العملاء على الموقع — منفصلة تمامًا عن حسابات الأدمنز.

   طريقتان للدخول:
   1) رمز من 6 أرقام يصل على البريد (صالح 10 دقائق، 5 محاولات، 3 رموز كل
      15 دقيقة لكل بريد) — يُنشأ الحساب أول مرة تلقائيًا.
   2) الموبايل وكلمة مرور (8 أحرف على الأقل) — بلا تحقق من ملكية الرقم، فالرسائل
      القصيرة بفلوس.

   الجلسة كوكي باسم آخر (5am_cust) وموقّعة بمفتاح مشتق آخر: رمز عميل لا يصلح
   أبدًا جلسةَ أدمن ولو نُسخ في كوكي اللوحة، والعكس.
============================================================================= */
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { q, q1, tx } from './db';
import { normPhone, findOrCreateCustomer } from './customers';
import { sendMail } from './mailer';

const COOKIE = '5am_cust';
const DAYS = 60;

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET غير مضبوط');
  return new TextEncoder().encode(createHmac('sha256', s).update('5am-customer-session').digest('hex'));
}
const hmac = (v: string) => createHmac('sha256', process.env.AUTH_SECRET ?? '').update(`code|${v}`).digest('hex');

export type Account = { id: number; customer_id: number | null; name: string | null; email: string | null; phone_norm: string | null };

export async function currentCustomer(): Promise<Account | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, key());
    if (payload.typ !== 'cust') return null;
    const a = await q1<any>('SELECT id, customer_id, name, email, phone_norm, session_ver FROM customer_accounts WHERE id = ?', [Number(payload.sub)]);
    if (!a || Number(payload.sv) !== Number(a.session_ver)) return null;
    return { id: a.id, customer_id: a.customer_id, name: a.name, email: a.email, phone_norm: a.phone_norm };
  } catch { return null; }
}

async function startSession(id: number) {
  const a = await q1<any>('SELECT session_ver FROM customer_accounts WHERE id = ?', [id]);
  const token = await new SignJWT({ typ: 'cust', sv: a?.session_ver ?? 1 }).setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(id)).setIssuedAt().setExpirationTime(`${DAYS}d`).sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: DAYS * 86400 });
  await q('UPDATE customer_accounts SET last_login_at = NOW() WHERE id = ?', [id]);
}

/* الخروج يمسح كوكي المحادثة أيضًا: على جهاز مشترك لا يرى من بعده محادثة صاحب
   الحساب. ويرجع له كل شيء بمجرّد أن يدخل تاني. */
export async function endCustomerSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete('5am_chat');
}

/* محاولات خاطئة: في الذاكرة، كما في دخول اللوحة */
const tries = new Map<string, { n: number; until: number }>();
function blocked(k: string, limit: number, minutes: number, add: boolean): boolean {
  const now = Date.now();
  const cur = tries.get(k);
  if (cur && now > cur.until) tries.delete(k);
  const c = tries.get(k) ?? { n: 0, until: now + minutes * 60_000 };
  if (c.n >= limit) return true;
  if (add) { c.n++; tries.set(k, c); }
  if (tries.size > 3000) for (const [x, v] of tries) if (now > v.until) tries.delete(x);
  return false;
}

/* --------------------------------------------------------- رمز البريد */
export async function requestCode(emailRaw: string, ip: string, lang: 'ar' | 'en'): Promise<{ ok: boolean; error?: string; dev?: boolean }> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return { ok: false, error: 'email' };
  if (blocked(`code:${email}`, 3, 15, true) || blocked(`codeip:${ip}`, 10, 15, true)) return { ok: false, error: 'wait' };
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await q("UPDATE login_codes SET used_at = NOW() WHERE email = ? AND used_at IS NULL", [email]);
  await q('INSERT INTO login_codes (email, code_hash, expires_at) VALUES (?, ?, NOW() + INTERVAL 10 MINUTE)', [email, hmac(`${email}|${code}`)]);
  const ar = lang === 'ar';
  const r = await sendMail(email,
    ar ? `رمز الدخول إلى 5A&M: ${code}` : `Your 5A&M sign-in code: ${code}`,
    ar ? `رمز الدخول: ${code}\nصالح لمدة 10 دقائق. لو لم تطلبه تجاهل هذه الرسالة.\n\n5A&M`
       : `Your sign-in code: ${code}\nValid for 10 minutes. If you didn't request it, ignore this email.\n\n5A&M`);
  return r.ok ? { ok: true, dev: r.dev } : { ok: false, error: 'mail' };
}

export async function verifyCode(emailRaw: string, codeRaw: string): Promise<{ ok: boolean; error?: string }> {
  const email = emailRaw.trim().toLowerCase();
  const code = codeRaw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');
  const row = await q1<any>(
    'SELECT id, code_hash, attempts FROM login_codes WHERE email = ? AND used_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1', [email]
  );
  if (!row) return { ok: false, error: 'expired' };
  if (row.attempts >= 5) return { ok: false, error: 'expired' };
  const want = Buffer.from(row.code_hash, 'hex'), got = Buffer.from(hmac(`${email}|${code}`), 'hex');
  if (code.length !== 6 || want.length !== got.length || !timingSafeEqual(want, got)) {
    await q('UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?', [row.id]);
    return { ok: false, error: 'code' };
  }
  await q('UPDATE login_codes SET used_at = NOW() WHERE id = ?', [row.id]);
  const id = await tx(async (db) => {
    const a = await db.q1<any>('SELECT id FROM customer_accounts WHERE email = ? FOR UPDATE', [email]);
    const cust = await findOrCreateCustomer(db, { name: null, phone: null, email, company: null, city: null, source: 'account' });
    if (a) {
      await db.q('UPDATE customer_accounts SET email_verified_at = COALESCE(email_verified_at, NOW()), customer_id = COALESCE(customer_id, ?) WHERE id = ?', [cust, a.id]);
      return a.id as number;
    }
    const r = await db.q('INSERT INTO customer_accounts (email, email_verified_at, customer_id) VALUES (?, NOW(), ?)', [email, cust]) as unknown as { insertId: number };
    return r.insertId;
  });
  await startSession(id);
  return { ok: true };
}

/* ------------------------------------------------- موبايل وكلمة مرور */
export async function registerPhone(name: string, phoneRaw: string, password: string, ip: string): Promise<{ ok: boolean; error?: string }> {
  const phone = normPhone(phoneRaw);
  if (!phone || phone.length < 10) return { ok: false, error: 'phone' };
  if (password.length < 8) return { ok: false, error: 'short' };
  if (blocked(`reg:${ip}`, 5, 60, true)) return { ok: false, error: 'wait' };
  if (await q1('SELECT id FROM customer_accounts WHERE phone_norm = ?', [phone])) return { ok: false, error: 'taken' };
  const hash = await bcrypt.hash(password, 12);
  const id = await tx(async (db) => {
    const cust = await findOrCreateCustomer(db, { name: name || null, phone, email: null, company: null, city: null, source: 'account' });
    const r = await db.q('INSERT INTO customer_accounts (name, phone_norm, password_hash, customer_id) VALUES (?,?,?,?)',
      [name.slice(0, 120) || null, phone, hash, cust]) as unknown as { insertId: number };
    return r.insertId;
  });
  await startSession(id);
  return { ok: true };
}

export async function loginPhone(phoneRaw: string, password: string, ip: string): Promise<{ ok: boolean; error?: string }> {
  const phone = normPhone(phoneRaw) ?? '';
  if (blocked(`pw:${phone}`, 5, 15, false) || blocked(`pwip:${ip}`, 15, 15, false)) return { ok: false, error: 'wait' };
  const a = await q1<any>('SELECT id, password_hash FROM customer_accounts WHERE phone_norm = ?', [phone]);
  const good = await bcrypt.compare(password, a?.password_hash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
  if (!a || !a.password_hash || !good) {
    blocked(`pw:${phone}`, 5, 15, true); blocked(`pwip:${ip}`, 15, 15, true);
    return { ok: false, error: 'wrong' };
  }
  tries.delete(`pw:${phone}`);
  await startSession(a.id);
  return { ok: true };
}
