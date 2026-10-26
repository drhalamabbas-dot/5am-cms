/* =============================================================================
   دخول العميل (/login) — صفحةٌ وحدها، والحساب في /account.

   كانت الاثنتان عنوانًا واحدًا يعرض الدخول أو الحساب بحسب الجلسة: عنوانٌ
   واحد لشيئين، وترويسةٌ تقول «حسابي» لمن لا حساب له. وهنا لكلٍّ عنوانه،
   فيُشارَك رابط الدخول ويُحفظ رابط الحساب، ويعرف الزائر أين هو.

   وطريقةٌ أولى لا طريقتان متساويتان: رمزٌ على البريد — بلا كلمة مرور تُنسى،
   ويُنشئ الحساب أول مرة وحده، فلا «تسجيل» منفصل أصلًا. والموبايل وكلمة
   المرور تحته لمن له حساب بها، مطويًّا كي لا يُقسَم الانتباه.

   البريد المنتظِر لرمزه يُحفظ في كوكي قصير لا في العنوان — بيانات شخصية لا
   تظهر في سجلات الخادم ولا في سجل المتصفح.
============================================================================= */
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getDict, makeT, pickLang } from '@/lib/i18n';
import { getNav, getFooterColumns } from '@/lib/nav';
import { getCompany, getSearchIndex, getSetting } from '@/lib/content';
import { themeCss, type Theme } from '@/lib/design';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { SiteScripts } from '@/components/site/SiteScripts';
import { currentCustomer, requestCode, verifyCode, registerAccount, loginAccount } from '@/lib/customerAuth';
import { ipHash } from '@/lib/requests';
import { mailReady } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const ar = pickLang((await searchParams).lang) === 'ar';
  return { title: ar ? 'دخول العملاء — 5A&M' : 'Customer sign-in — 5A&M', robots: { index: false, follow: false } };
}

const PENDING = '5am_code_email';

const TX = {
  ar: {
    title: 'ادخل إلى حسابك', titleNew: 'اعمل حساب جديد',
    sub: 'تابع طلباتك وعروض الأسعار، وكمّل محادثتك مع فريقنا من أي جهاز.',
    perks: ['طلباتك وعروض أسعارك وحالة كل واحد', 'محادثاتك مع فريقنا، تكمّلها من حيث وقفت', 'بياناتك تتكتب مرة، فنرد عليك أسرع'],
    tabIn: 'تسجيل دخول', tabNew: 'حساب جديد',
    who: 'اسم المستخدم أو البريد', whoHint: 'اللي اخترته وإنت بتعمل الحساب.',
    password: 'كلمة المرور', login: 'دخول',
    name: 'الاسم', username: 'اسم المستخدم', email: 'البريد الإلكتروني',
    usernameHint: 'حروف إنجليزية وأرقام و(. _ -)، من 3 لـ40 حرف.',
    emailHintNew: 'هنراسلك عليه بخصوص طلباتك، وتسترجع بيه كلمة المرور.',
    passHint: '8 أحرف على الأقل.', create: 'إنشاء الحساب',
    forgot: 'نسيت كلمة المرور؟', forgotHead: 'ابعت لي رمز دخول على بريدي',
    emailOnly: 'بريدك الإلكتروني', sendCode: 'ابعت لي الرمز',
    codeSent: 'بعتنا رمز من 6 أرقام على', codeHint: 'صالح 10 دقايق. لو ما وصلش، بصّ في البريد غير المرغوب.',
    code: 'الرمز', enter: 'دخول', otherEmail: 'غيّر البريد',
    back: 'رجوع للموقع', privacy: 'بنحفظ بياناتك للتواصل معك بخصوص طلباتك بس، وتقدر تمسحها في أي وقت من حسابك.',
    devNote: 'وضع التطوير: البريد غير مضبوط، فالرمز مطبوع في نافذة الموقع.',
    err: { email: 'اكتب بريدًا صحيحًا.', wait: 'محاولات كتير — استنى ربع ساعة.', mail: 'تعذّر إرسال البريد الآن.',
      code: 'الرمز غير صحيح.', expired: 'الرمز انتهى أو اتستعمل — اطلب رمزًا جديدًا.',
      username: 'اسم المستخدم لازم يكون حروف إنجليزية وأرقام و(. _ -)، من 3 لـ40 حرف.',
      userTaken: 'اسم المستخدم ده محجوز — اختار غيره.', mailTaken: 'البريد ده له حساب — ادخل بكلمة المرور.',
      short: 'كلمة المرور قصيرة (8 أحرف على الأقل).', wrong: 'اسم المستخدم أو كلمة المرور غير صحيحة.' } as Record<string, string>,
  },
  en: {
    title: 'Sign in to your account', titleNew: 'Create an account',
    sub: 'Follow your requests and quotes, and continue your chat with our team from any device.',
    perks: ['Your requests and quotes, and where each one stands', 'Your conversations with our team, picked up where you left off', 'Your details written once, so we reply faster'],
    tabIn: 'Sign in', tabNew: 'New account',
    who: 'Username or email', whoHint: 'The one you chose when you created the account.',
    password: 'Password', login: 'Sign in',
    name: 'Name', username: 'Username', email: 'Email',
    usernameHint: 'Latin letters, digits and (. _ -), 3 to 40 characters.',
    emailHintNew: "We'll write to you about your requests, and you reset your password with it.",
    passHint: 'At least 8 characters.', create: 'Create account',
    forgot: 'Forgot your password?', forgotHead: 'Send me a sign-in code by email',
    emailOnly: 'Your email', sendCode: 'Send me the code',
    codeSent: 'We sent a 6-digit code to', codeHint: "Valid for 10 minutes. If it hasn't arrived, check your spam folder.",
    code: 'Code', enter: 'Sign in', otherEmail: 'Change email',
    back: 'Back to the site', privacy: 'We keep your details only to contact you about your requests, and you can delete them any time from your account.',
    devNote: 'Development mode: email is not configured, so the code is printed in the site window.',
    err: { email: 'Enter a valid email.', wait: 'Too many attempts — wait 15 minutes.', mail: 'Could not send email now.',
      code: 'Wrong code.', expired: 'The code expired or was used — request a new one.',
      username: 'Username must be Latin letters, digits and (. _ -), 3 to 40 characters.',
      userTaken: 'That username is taken — pick another.', mailTaken: 'This email has an account — sign in with your password.',
      short: 'Password too short (8+ characters).', wrong: 'Wrong username or password.' } as Record<string, string>,
  },
};

type SP = { lang?: string; e?: string; dev?: string; tab?: string };

/* خارج الصفحة عمدًا: دالة داخلها لا تُمرَّر لإجراءات الخادم */
async function ipOf() {
  const h = await headers();
  return ipHash((h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null) ?? 'x';
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const lang = pickLang(sp.lang);
  const x = TX[lang];
  const self = `/login?lang=${lang}`;
  const home = `/account?lang=${lang}`;

  /* من دخل بالفعل لا يُعرض عليه الدخول ثانيةً */
  if (await currentCustomer()) redirect(home);

  const pending = (await cookies()).get(PENDING)?.value ?? '';

  async function sendCode(form: FormData) {
    'use server';
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const r = await requestCode(email, await ipOf(), lang);
    if (!r.ok) redirect(`${self}&e=${r.error}`);
    (await cookies()).set(PENDING, email, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/login', maxAge: 900 });
    redirect(r.dev ? `${self}&dev=1` : self);
  }
  async function checkCode(form: FormData) {
    'use server';
    const email = (await cookies()).get(PENDING)?.value ?? '';
    const r = await verifyCode(email, String(form.get('code') ?? ''));
    if (!r.ok) redirect(`${self}&e=${r.error}`);
    (await cookies()).delete({ name: PENDING, path: '/login' });
    redirect(home);
  }
  async function otherEmail() {
    'use server';
    (await cookies()).delete({ name: PENDING, path: '/login' });
    redirect(self);
  }
  async function signIn(form: FormData) {
    'use server';
    const r = await loginAccount(String(form.get('who') ?? ''), String(form.get('password') ?? ''), await ipOf());
    redirect(r.ok ? home : `${self}&e=${r.error}`);
  }
  async function signUp(form: FormData) {
    'use server';
    const r = await registerAccount({
      name: String(form.get('name') ?? ''),
      username: String(form.get('username') ?? ''),
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    }, await ipOf());
    redirect(r.ok ? home : `${self}&tab=new&e=${r.error}`);
  }

  const [dict, nav, footer, company, search, theme] = await Promise.all([
    getDict(), getNav(), getFooterColumns(), getCompany(), getSearchIndex(lang), getSetting<Theme>('theme', {}),
  ]);
  const t = makeT(lang, dict);
  const quote = `quote.html?source=login&lang=${lang}`;
  const err = sp.e ? x.err[sp.e] : null;
  const isNew = sp.tab === 'new';
  const css = themeCss(theme);

  return (
    <>
      {css ? <style data-theme="">{css}</style> : null}
      <Header nav={nav} company={company} t={t} page="login.html" quoteHref={quote} />
      <main id="main">
        <section className="sec signin">
          <div className="wrap signin__wrap">
            {/* عمودان: النموذج أولًا في القراءة، وما يناله بجانبه لا فوقه —
                فلا يُدفَع النموذج تحت الطيّ بكلامٍ عنه. */}
            <div className="signin__card">
              {/* تبويبان لا نموذجان متجاوران: لكلٍّ غرضٌ مختلف، ومن يعرف
                  أيَّهما يريد لا يقرأ الآخر. والمنتظِر لرمزه لا تبويبَ له. */}
              {!pending ? (
                <div className="signin__tabs" role="tablist">
                  <a className={`signin__tab${isNew ? '' : ' is-on'}`} href={`${self}`}
                     role="tab" aria-selected={!isNew}>{x.tabIn}</a>
                  <a className={`signin__tab${isNew ? ' is-on' : ''}`} href={`${self}&tab=new`}
                     role="tab" aria-selected={isNew}>{x.tabNew}</a>
                </div>
              ) : null}

              <h1 className="signin__title">{isNew && !pending ? x.titleNew : x.title}</h1>
              <p className="signin__sub">{x.sub}</p>
              {err ? <p className="formmsg is-err" role="alert">{err}</p> : null}
              {sp.dev && !mailReady() ? <p className="signin__note">{x.devNote}</p> : null}

              {pending ? (
                <>
                  <p className="signin__sent">{x.codeSent} <bdi dir="ltr">{pending}</bdi></p>
                  <form action={checkCode} className="signin__form">
                    <label>
                      <span>{x.code}</span>
                      <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                             required dir="ltr" autoFocus className="signin__code" />
                    </label>
                    <small>{x.codeHint}</small>
                    <button className="btn btn--block" type="submit">{x.enter}</button>
                  </form>
                  <form action={otherEmail}><button className="signin__link" type="submit">{x.otherEmail}</button></form>
                </>
              ) : isNew ? (
                <form action={signUp} className="signin__form">
                  <label><span>{x.name}</span><input name="name" autoComplete="name" maxLength={120} required autoFocus /></label>
                  <label>
                    <span>{x.username}</span>
                    <input name="username" autoComplete="username" required dir="ltr"
                           minLength={3} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{1,38}[A-Za-z0-9]" />
                  </label>
                  <small>{x.usernameHint}</small>
                  <label><span>{x.email}</span><input name="email" type="email" autoComplete="email" required dir="ltr" /></label>
                  <small>{x.emailHintNew}</small>
                  <label><span>{x.password}</span><input name="password" type="password" autoComplete="new-password" minLength={8} required dir="ltr" /></label>
                  <small>{x.passHint}</small>
                  <button className="btn btn--block" type="submit">{x.create}</button>
                </form>
              ) : (
                <>
                  <form action={signIn} className="signin__form">
                    <label>
                      <span>{x.who}</span>
                      <input name="who" autoComplete="username" required dir="ltr" autoFocus />
                    </label>
                    <small>{x.whoHint}</small>
                    <label><span>{x.password}</span><input name="password" type="password" autoComplete="current-password" required dir="ltr" /></label>
                    <button className="btn btn--block" type="submit">{x.login}</button>
                  </form>

                  {/* استعادةٌ لا طريقةُ دخولٍ ثانية: الرمز على البريد المسجَّل */}
                  <details className="signin__alt">
                    <summary>{x.forgot}</summary>
                    <form action={sendCode} className="signin__form">
                      <label><span>{x.emailOnly}</span><input name="email" type="email" autoComplete="email" required dir="ltr" /></label>
                      <small>{x.forgotHead}</small>
                      <button className="btn btn--ghost btn--block" type="submit">{x.sendCode}</button>
                    </form>
                  </details>
                </>
              )}
            </div>

            <aside className="signin__aside">
              <ul className="signin__perks">
                {x.perks.map((p, i) => (
                  <li key={i}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <p className="signin__privacy">{x.privacy}</p>
              <a className="signin__link" href={t.href('index.html')}>{x.back}</a>
            </aside>
          </div>
        </section>
      </main>
      <Footer columns={footer} company={company} t={t} />
      <SiteScripts t={t} page="login" quoteHref={quote} phoneIntl={company.phoneIntl} search={search} />
    </>
  );
}
