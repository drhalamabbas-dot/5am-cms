/* صفحة الدخول. النموذج يُرسَل إلى إجراء على السيرفر، فكلمة المرور لا تمرّ
   بجافاسكريبت في المتصفح ولا تظهر في العنوان. */
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { checkLogin, startSession, currentUser } from '@/lib/auth';
import { audit } from '@/lib/audit';

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ e?: string; w?: string }> }) {
  if (await currentUser()) redirect('/admin');
  const sp = await searchParams;

  async function login(form: FormData) {
    'use server';
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    /* العنوان خلف وسيط الاستضافة، فيُقرأ من الترويسة التي يضعها. */
    const h = await headers();
    const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || '?';

    const r = await checkLogin(email, password, ip);
    if (!r.ok) {
      /* المحاولات الخائبة في السجل بالبريد المكتوب (لا كلمة المرور)، فيرى السوبر أدمن أي تخمين */
      if (!r.waitMinutes) await audit(null, 'login.failed', { summary: email.trim().toLowerCase().slice(0, 120) });
      /* رسالة واحدة للبريد الخطأ ولكلمة المرور الخطأ: لا تكشف من له حساب. */
      redirect(r.waitMinutes ? `/admin/login?w=${r.waitMinutes}` : '/admin/login?e=1');
    }
    await startSession(r.user);
    await audit(r.user, 'login');
    redirect('/admin');
  }

  const err = sp.e;
  const wait = sp.w;

  return (
    <main className="login">
      <form className="login__box" action={login}>
        <div className="login__brand">
          <b>5A&amp;M</b>
          <span>لوحة تحكم الموقع</span>
        </div>
        {err ? <p className="msg msg--bad">البريد أو كلمة المرور غير صحيحة.</p> : null}
        {wait ? (
          <p className="msg msg--bad">
            محاولات كثيرة خاطئة. انتظر {wait} دقيقة ثم أعد المحاولة.
          </p>
        ) : null}
        <div className="field">
          <label htmlFor="email">البريد الإلكتروني</label>
          <input id="email" name="email" type="email" required autoComplete="username" dir="ltr" />
        </div>
        <div className="field">
          <label htmlFor="password">كلمة المرور</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" dir="ltr" />
        </div>
        <button className="btn" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
          دخول
        </button>
      </form>
    </main>
  );
}
