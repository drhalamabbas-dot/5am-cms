/* =============================================================================
   دخول الداش بورد.

   كلمة المرور تُحفظ مجزّأة بـ bcrypt ولا تُخزَّن أبدًا كما هي. والجلسة رمز
   موقَّع (JWT) في كوكي HttpOnly، فلا يقرؤه سكربت في الصفحة ولا يُزوَّر بلا
   المفتاح السرّي.

   المفتاح في AUTH_SECRET بملف .env.local، ويجب تغييره على الخادم.
============================================================================= */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { q1, q } from './db';
import { can, isSuper } from './permissions';

const COOKIE = '5am_session';
const DAYS = 7;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error('AUTH_SECRET غير مضبوط في .env.local (32 حرفًا على الأقل)');
  }
  return new TextEncoder().encode(s);
}

/** role: super (سوبر أدمن — كل شيء وحسابات الأدمنز) أو admin (بالصلاحيات في perms) */
export type User = {
  id: number; email: string; name: string | null; role: 'super' | 'admin' | string;
  perms: string[]; is_owner: number; phone: string | null;
};

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);

/* ------------------------------------------------- تقييد محاولات الدخول
   /admin عنوان معروف على الإنترنت، فبلا تقييد تُجرَّب كلمات المرور آليًا بلا
   حدّ. خمس محاولات خائبة لكل بريد ولكل عنوان، ثم انتظار خمس عشرة دقيقة.

   العدّ في الذاكرة: يكفي لخادم واحد وهو ما تعمل به الخطة، ويُصفَّر بإعادة
   التشغيل. البديل جدول في القاعدة، ولا يستحقه الحجم هنا. */
const WINDOW = 15 * 60 * 1000;
const LIMIT = 5;
const tries = new Map<string, { n: number; until: number }>();

function bump(key: string, ok: boolean) {
  const now = Date.now();
  const cur = tries.get(key);
  if (ok) { tries.delete(key); return; }
  if (!cur || now > cur.until) tries.set(key, { n: 1, until: now + WINDOW });
  else cur.n++;
  /* تنظيف ما انتهت مدّته كي لا تكبر الخريطة بلا حدّ */
  if (tries.size > 500) for (const [k, v] of tries) if (now > v.until) tries.delete(k);
}

function blocked(key: string) {
  const cur = tries.get(key);
  if (!cur) return 0;
  if (Date.now() > cur.until) { tries.delete(key); return 0; }
  return cur.n >= LIMIT ? Math.ceil((cur.until - Date.now()) / 60000) : 0;
}

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; waitMinutes?: number };

/** يتحقّق من البريد وكلمة المرور. `ip` للتقييد فقط. */
export async function checkLogin(email: string, password: string, ip = '?'): Promise<LoginResult> {
  const id = email.trim().toLowerCase();
  const keys = [`m:${id}`, `i:${ip}`];
  const wait = Math.max(...keys.map(blocked));
  if (wait > 0) return { ok: false, waitMinutes: wait };

  const row = await q1<any>(
    'SELECT id, email, name, role, perms, is_owner, phone, active, password_hash FROM users WHERE email = ?', [id]
  );
  /* المقارنة تجري حتى مع بريد غير موجود، كي لا يكشف زمن الردّ من له حساب.
     والحساب الموقوف يُرفض بالرسالة نفسها، فلا يُعرف أنه موجود. */
  const hash = row?.password_hash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const good = (await bcrypt.compare(password, hash)) && Boolean(row) && Boolean(row?.active);
  for (const k of keys) bump(k, good);
  if (!good) return { ok: false };

  await q('UPDATE users SET last_login_at = NOW() WHERE id = ?', [row.id]);
  return { ok: true, user: shape(row) };
}

function shape(row: any): User {
  let perms: unknown = row.perms;
  if (typeof perms === 'string') { try { perms = JSON.parse(perms); } catch { perms = []; } }
  return {
    id: row.id, email: row.email, name: row.name, role: row.role,
    perms: Array.isArray(perms) ? perms : [], is_owner: row.is_owner ?? 0, phone: row.phone ?? null,
  };
}

export async function startSession(user: User) {
  /* sv: نسخة الجلسة — تغيير كلمة المرور أو إيقاف الحساب يرفعها فتبطل كل جلسة قديمة */
  const sv = (await q1<{ session_ver: number }>('SELECT session_ver FROM users WHERE id = ?', [user.id]))?.session_ver ?? 1;
  const token = await new SignJWT({ email: user.email, role: user.role, sv })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${DAYS}d`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/**
 * المستخدم الحالي، أو null إن لم تكن هناك جلسة صالحة.
 *
 * يُقرأ من القاعدة مع كل طلب، فما يغيّره السوبر أدمن يسري فورًا: حساب موقوف لا
 * يُقبل، وصلاحية قُفلت لا تُستعمل في الضغطة التالية، وجلسة سبقت تغيير كلمة
 * المرور (نسخة جلسة أقدم) تبطل.
 */
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const row = await q1<any>(
      'SELECT id, email, name, role, perms, is_owner, phone, active, session_ver FROM users WHERE id = ?',
      [Number(payload.sub)]
    );
    if (!row || !row.active) return null;
    if (Number(payload.sv ?? 1) !== Number(row.session_ver ?? 1)) return null;
    return shape(row);
  } catch {
    return null;
  }
}

/** يُستدعى في كل صفحة داخل الداش بورد. */
export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect('/admin/login');
  return u;
}

/**
 * يُستدعى في كل شاشة وكل عملية تحتاج صلاحية. بلا الصلاحية: إلى لوحة التحكم
 * برسالة «ليست لديك صلاحية» — والعملية لا تتمّ، أيًّا كان مصدر الطلب.
 */
export async function requirePerm(perm: string): Promise<User> {
  const u = await requireUser();
  if (!can(u, perm)) redirect(`/admin?denied=${encodeURIComponent(perm)}`);
  return u;
}

/** شاشة يدخلها من عنده أيّ واحدة من الصلاحيات (والعمليات داخلها تفحص صلاحيتها) */
export async function requireAnyPerm(perms: string[]): Promise<User> {
  const u = await requireUser();
  if (!perms.some((p) => can(u, p))) redirect(`/admin?denied=${encodeURIComponent(perms[0])}`);
  return u;
}

/** حسابات الأدمنز وكل ما للسوبر أدمن وحده */
export async function requireSuper(): Promise<User> {
  const u = await requireUser();
  if (!isSuper(u)) redirect('/admin?denied=super');
  return u;
}
