/* =============================================================================
   حساب العميل (/account): يدخل برمز على بريده أو بموبايله وكلمة مرور، ثم يرى
   محادثاته ويكمّلها، وطلباته وحالتها، ويقدر يمسح حسابه وبياناته.

   البريد المنتظِر لرمزه يُحفظ في كوكي قصير لا في العنوان — بيانات شخصية لا
   تظهر في سجلات الخادم ولا في سجل المتصفح.
============================================================================= */
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { q, tx, when } from '@/lib/db';
import { getDict, makeT, pickLang } from '@/lib/i18n';
import { getNav, getFooterColumns } from '@/lib/nav';
import { getCompany, getSearchIndex, getSetting } from '@/lib/content';
import { themeCss, type Theme } from '@/lib/design';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { SiteScripts } from '@/components/site/SiteScripts';
import { ChatWidget } from '@/components/site/ChatWidget';
import { OpenChat } from '@/components/site/OpenChat';
import { ConfirmButton } from '@/components/ConfirmButton';
import { getChatSettings } from '@/lib/chat/provider';
import { currentCustomer, requestCode, verifyCode, registerPhone, loginPhone, endCustomerSession } from '@/lib/customerAuth';
import { eraseCustomer } from '@/lib/customers';
import { ipHash } from '@/lib/requests';
import { mailReady } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const ar = pickLang((await searchParams).lang) === 'ar';
  return { title: ar ? 'حسابي — 5A&M' : 'My account — 5A&M', robots: { index: false, follow: false } };
}

const PENDING = '5am_code_email';

const TX = {
  ar: {
    title: 'حسابي', sub: 'كمّل محادثتك مع فريقنا وتابع طلباتك من أي جهاز.',
    byEmail: 'برمز على البريد', byPhone: 'بالموبايل وكلمة مرور',
    email: 'البريد الإلكتروني', sendCode: 'ابعت لي رمز الدخول', codeSent: 'بعتنا رمز من 6 أرقام على', code: 'الرمز', enter: 'دخول',
    otherEmail: 'بريد تاني', phone: 'رقم الموبايل', password: 'كلمة المرور', login: 'دخول', name: 'الاسم', register: 'حساب جديد',
    registerHint: 'كلمة المرور 8 أحرف على الأقل.', hello: 'أهلًا', logout: 'خروج',
    chats: 'محادثاتي', noChats: 'لا محادثات بعد.', continue: 'كمّل المحادثة', requests: 'طلباتي', noRequests: 'لا طلبات بعد.',
    replied: 'فريقنا ردّ عليك', waiting: 'في انتظار ردّنا', msgs: 'رسالة', showChat: 'اعرض المحادثة',
    who: { user: 'أنت', bot: 'المساعد', agent: 'فريق 5A&M', system: '' } as Record<string, string>,
    convStatus: { bot: 'مع المساعد', human: 'مع فريقنا', closed: 'مقفولة' } as Record<string, string>,
    myInfo: 'بياناتي', myInfoSub: 'بتساعد فريقنا يرد عليك أسرع ويعرف طبيعة شغلك.',
    pname: 'الاسم', company: 'الشركة', city: 'المدينة', save: 'احفظ', saved: 'اتحفظت بياناتك.',
    erase: 'امسح حسابي وبياناتي', eraseConfirm: 'مسح حسابك ومحادثاتك وبياناتك الشخصية نهائيًا؟',
    privacy: 'نحفظ بياناتك للتواصل معك بخصوص طلباتك فقط، وتقدر تمسحها في أي وقت.',
    devNote: 'وضع التطوير: البريد غير مضبوط، فالرمز مطبوع في نافذة الموقع.',
    err: { email: 'اكتب بريدًا صحيحًا.', wait: 'محاولات كتير — استنى ربع ساعة.', mail: 'تعذّر إرسال البريد الآن. جرّب الدخول بالموبايل.',
      code: 'الرمز غير صحيح.', expired: 'الرمز انتهى أو اتستعمل — اطلب رمزًا جديدًا.', phone: 'اكتب رقم موبايل صحيح.',
      short: 'كلمة المرور قصيرة (8 أحرف على الأقل).', taken: 'الرقم ده له حساب — ادخل بكلمة المرور.', wrong: 'الرقم أو كلمة المرور غير صحيحة.' } as Record<string, string>,
    status: { new: 'وصلنا', contacted: 'تواصلنا معك', confirmed: 'مؤكد', processing: 'قيد التنفيذ', done: 'تم', cancelled: 'ملغي' } as Record<string, string>,
    kinds: { quote: 'عرض سعر', store: 'طلب من المتجر', callback: 'اتصال', chat: 'محادثة' } as Record<string, string>,
  },
  en: {
    title: 'My account', sub: 'Continue your chat with our team and follow your requests from any device.',
    byEmail: 'With an email code', byPhone: 'With mobile & password',
    email: 'Email', sendCode: 'Send me a sign-in code', codeSent: 'We sent a 6-digit code to', code: 'Code', enter: 'Sign in',
    otherEmail: 'Use another email', phone: 'Mobile number', password: 'Password', login: 'Sign in', name: 'Name', register: 'Create account',
    registerHint: 'At least 8 characters.', hello: 'Hello', logout: 'Sign out',
    chats: 'My conversations', noChats: 'No conversations yet.', continue: 'Continue the chat', requests: 'My requests', noRequests: 'No requests yet.',
    replied: 'Our team replied', waiting: 'Waiting for our reply', msgs: 'messages', showChat: 'Show the conversation',
    who: { user: 'You', bot: 'Assistant', agent: '5A&M team', system: '' } as Record<string, string>,
    convStatus: { bot: 'With the assistant', human: 'With our team', closed: 'Closed' } as Record<string, string>,
    myInfo: 'My details', myInfoSub: 'They help our team reply faster and understand your work.',
    pname: 'Name', company: 'Company', city: 'City', save: 'Save', saved: 'Your details were saved.',
    erase: 'Delete my account and data', eraseConfirm: 'Permanently delete your account, conversations and personal data?',
    privacy: 'We keep your details only to contact you about your requests, and you can delete them any time.',
    devNote: 'Development mode: email is not configured, so the code is printed in the site window.',
    err: { email: 'Enter a valid email.', wait: 'Too many attempts — wait 15 minutes.', mail: 'Could not send email now. Try signing in with your mobile.',
      code: 'Wrong code.', expired: 'The code expired or was used — request a new one.', phone: 'Enter a valid mobile number.',
      short: 'Password too short (8+ characters).', taken: 'This number has an account — sign in with your password.', wrong: 'Wrong number or password.' } as Record<string, string>,
    status: { new: 'Received', contacted: 'We contacted you', confirmed: 'Confirmed', processing: 'In progress', done: 'Done', cancelled: 'Cancelled' } as Record<string, string>,
    kinds: { quote: 'Quote', store: 'Store order', callback: 'Call back', chat: 'Chat' } as Record<string, string>,
  },
};

type SP = { lang?: string; e?: string; dev?: string; ok?: string };

/* خارج الصفحة عمدًا: دالة داخلها لا تُمرَّر لإجراءات الخادم */
async function ipOf() {
  const h = await headers();
  return ipHash((h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null) ?? 'x';
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const lang = pickLang(sp.lang);
  const x = TX[lang];
  const self = `/account?lang=${lang}`;
  const jar = await cookies();
  const pending = jar.get(PENDING)?.value ?? '';
  const acc = await currentCustomer();

  async function sendCode(form: FormData) {
    'use server';
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const r = await requestCode(email, await ipOf(), lang);
    if (!r.ok) redirect(`${self}&e=${r.error}`);
    (await cookies()).set(PENDING, email, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/account', maxAge: 900 });
    redirect(r.dev ? `${self}&dev=1` : self);
  }
  async function checkCode(form: FormData) {
    'use server';
    const email = (await cookies()).get(PENDING)?.value ?? '';
    const r = await verifyCode(email, String(form.get('code') ?? ''));
    if (!r.ok) redirect(`${self}&e=${r.error}`);
    (await cookies()).delete({ name: PENDING, path: '/account' });
    redirect(self);
  }
  async function otherEmail() {
    'use server';
    (await cookies()).delete({ name: PENDING, path: '/account' });
    redirect(self);
  }
  async function phoneLogin(form: FormData) {
    'use server';
    const r = await loginPhone(String(form.get('phone') ?? ''), String(form.get('password') ?? ''), await ipOf());
    redirect(r.ok ? self : `${self}&e=${r.error}#phone`);
  }
  async function phoneRegister(form: FormData) {
    'use server';
    const r = await registerPhone(String(form.get('name') ?? '').trim(), String(form.get('phone') ?? ''), String(form.get('password') ?? ''), await ipOf());
    redirect(r.ok ? self : `${self}&e=${r.error}#phone`);
  }
  async function logout() {
    'use server';
    await endCustomerSession();
    redirect(self);
  }
  /* بيانات العميل: يكتبها بنفسه فيراها الموظف في المحادثة وفي شاشة العملاء.
     تُكتب في سجلّ العميل نفسه، لا في جدول منفصل. */
  async function saveProfile(form: FormData) {
    'use server';
    const a = await currentCustomer();
    if (!a?.customer_id) redirect(self);
    const s = (k: string, max: number) => {
      const v = String(form.get(k) ?? '').trim().slice(0, max);
      return v || null;
    };
    const name = s('pname', 120);
    await q('UPDATE customers SET name = COALESCE(?, name), company = ?, city = ? WHERE id = ?',
      [name, s('company', 160), s('city', 120), a.customer_id]);
    if (name) await q('UPDATE customer_accounts SET name = COALESCE(name, ?) WHERE id = ?', [name, a.id]);
    redirect(`${self}&ok=profile`);
  }
  async function erase() {
    'use server';
    const a = await currentCustomer();
    if (!a) redirect(self);
    /* حقّه في المسح (151/2020): الحساب ومحادثاته، وبياناته الشخصية من الطلبات */
    await tx(async (db) => {
      await db.q('DELETE FROM chat_conversations WHERE account_id = ?', [a.id]);
      if (a.customer_id) await eraseCustomer(a.customer_id, db);
      await db.q('DELETE FROM customer_accounts WHERE id = ?', [a.id]);
    });
    await q(`INSERT INTO audit_log (user_id, user_name, action, entity, entity_id, summary) VALUES (NULL, 'العميل نفسه', 'customer.delete', 'account', ?, 'مسح حسابه وبياناته من صفحة حسابه')`, [String(a.id)]);
    await endCustomerSession();
    redirect(self);
  }

  const [dict, nav, footer, company, search, theme, chat] = await Promise.all([
    getDict(), getNav(), getFooterColumns(), getCompany(), getSearchIndex(lang), getSetting<Theme>('theme', {}), getChatSettings(),
  ]);
  const t = makeT(lang, dict);
  const quote = `quote.html?source=account&lang=${lang}`;
  /* المحادثة كاملة لا آخر سطر: العميل يراجع ما قيل له قبل أن يكمّل.
     و«ردّ فريقنا» = آخر رسالة من موظف — فيعرف أن عليه دورًا بلا عمود جديد. */
  const [convs, reqs, profile] = acc ? await Promise.all([
    q<any>(`SELECT c.id, c.status, c.last_message_at,
              (SELECT role FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_role,
              (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id) AS n
             FROM chat_conversations c WHERE c.account_id = ? ORDER BY c.last_message_at DESC LIMIT 10`, [acc.id]),
    acc.customer_id ? q<any>('SELECT id, kind, status, items, created_at FROM requests WHERE customer_id = ? ORDER BY id DESC LIMIT 20', [acc.customer_id]) : Promise.resolve([]),
    acc.customer_id ? q<any>('SELECT name, company, city, email, phone FROM customers WHERE id = ?', [acc.customer_id]) : Promise.resolve([]),
  ]) : [[], [], []];
  const me = profile[0] ?? {};
  /* رسائل كل محادثة — بلا الرسائل الداخلية التي لا تخصّ العميل */
  const threads: Record<number, any[]> = {};
  if (convs.length) {
    const rows = await q<any>(
      `SELECT conversation_id, role, text, created_at FROM chat_messages
        WHERE conversation_id IN (${convs.map(() => '?').join(',')}) AND role IN ('user','bot','agent','system')
        ORDER BY id`, convs.map((c: any) => c.id)
    );
    for (const r of rows) (threads[r.conversation_id] ??= []).push(r);
  }
  const items = (v: any) => { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a : []; } catch { return []; } };
  const err = sp.e ? x.err[sp.e] : null;
  const css = themeCss(theme);

  return (
    <>
      {css ? <style data-theme="">{css}</style> : null}
      <Header nav={nav} company={company} t={t} page="account.html" quoteHref={quote} />
      <main id="main">
        <section className="sec acct">
          <div className="wrap acct__wrap">
            <h1 className="acct__title">{acc ? `${x.hello}${acc.name ? ` ${acc.name}` : ''}` : x.title}</h1>
            <p className="acct__sub">{x.sub}</p>
            {err ? <p className="formmsg is-err" role="alert">{err}</p> : null}
            {sp.ok === 'profile' ? <p className="formmsg is-ok" role="status">{x.saved}</p> : null}

            {!acc ? (
              <div className="acct__grid">
                <div className="acct__card">
                  <h2>{x.byEmail}</h2>
                  {sp.dev && !mailReady() ? <p className="acct__note">{x.devNote}</p> : null}
                  {pending ? (
                    <>
                      <p>{x.codeSent} <bdi dir="ltr">{pending}</bdi></p>
                      <form action={checkCode} className="acct__form">
                        <label>{x.code}<input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required dir="ltr" /></label>
                        <button className="btn" type="submit">{x.enter}</button>
                      </form>
                      <form action={otherEmail}><button className="acct__link" type="submit">{x.otherEmail}</button></form>
                    </>
                  ) : (
                    <form action={sendCode} className="acct__form">
                      <label>{x.email}<input name="email" type="email" autoComplete="email" required dir="ltr" /></label>
                      <button className="btn" type="submit">{x.sendCode}</button>
                    </form>
                  )}
                </div>
                <div className="acct__card" id="phone">
                  <h2>{x.byPhone}</h2>
                  <form action={phoneLogin} className="acct__form">
                    <label>{x.phone}<input name="phone" type="tel" autoComplete="tel" required dir="ltr" /></label>
                    <label>{x.password}<input name="password" type="password" autoComplete="current-password" required dir="ltr" /></label>
                    <button className="btn" type="submit">{x.login}</button>
                  </form>
                  <details className="acct__reg">
                    <summary>{x.register}</summary>
                    <form action={phoneRegister} className="acct__form">
                      <label>{x.name}<input name="name" autoComplete="name" maxLength={120} /></label>
                      <label>{x.phone}<input name="phone" type="tel" autoComplete="tel" required dir="ltr" /></label>
                      <label>{x.password}<input name="password" type="password" autoComplete="new-password" minLength={8} required dir="ltr" /></label>
                      <small>{x.registerHint}</small>
                      <button className="btn btn--ghost" type="submit">{x.register}</button>
                    </form>
                  </details>
                </div>
              </div>
            ) : (
              <div className="acct__grid">
                <div className="acct__card acct__card--wide">
                  <h2>{x.chats}</h2>
                  {convs.length ? (
                    <div className="acct__convs">
                      {convs.map((c: any) => (
                        <details className="conv" key={c.id} {...(c.last_role === 'agent' ? { open: true } : {})}>
                          <summary>
                            <span className={`conv__dot${c.last_role === 'agent' ? ' is-new' : ''}`} aria-hidden="true" />
                            <b>{c.last_role === 'agent' ? x.replied : x.convStatus[c.status] ?? c.status}</b>
                            <small dir="ltr">{when(c.last_message_at)} · {c.n} {x.msgs}</small>
                          </summary>
                          <ol className="conv__thread">
                            {(threads[c.id] ?? []).map((m: any, i: number) => (
                              <li key={i} className={`conv__m conv__m--${m.role}`}>
                                {x.who[m.role] ? <b>{x.who[m.role]}</b> : null}
                                <span>{m.text}</span>
                              </li>
                            ))}
                          </ol>
                        </details>
                      ))}
                    </div>
                  ) : <p>{x.noChats}</p>}
                  <OpenChat label={x.continue} />
                </div>
                <div className="acct__card">
                  <h2>{x.requests}</h2>
                  {reqs.length ? (
                    <ul className="acct__list">
                      {reqs.map((r: any) => (
                        <li key={r.id}>
                          <small dir="ltr">#{r.id} · {when(r.created_at)}</small>
                          <span>{x.kinds[r.kind] ?? r.kind} — <b>{x.status[r.status] ?? r.status}</b></span>
                          {items(r.items).length ? <small>{items(r.items).map((i: any) => `${i.name} × ${i.qty}`).join('، ')}</small> : null}
                        </li>
                      ))}
                    </ul>
                  ) : <p>{x.noRequests}</p>}
                </div>
                {acc.customer_id ? (
                  <div className="acct__card">
                    <h2>{x.myInfo}</h2>
                    <p className="acct__note" style={{ marginTop: 0 }}>{x.myInfoSub}</p>
                    <form action={saveProfile} className="acct__form">
                      <label>{x.pname}<input name="pname" defaultValue={me.name ?? acc.name ?? ''} maxLength={120} autoComplete="name" /></label>
                      <label>{x.company}<input name="company" defaultValue={me.company ?? ''} maxLength={160} autoComplete="organization" /></label>
                      <label>{x.city}<input name="city" defaultValue={me.city ?? ''} maxLength={120} autoComplete="address-level2" /></label>
                      <button className="btn btn--ghost btn--sm" type="submit">{x.save}</button>
                    </form>
                  </div>
                ) : null}

                <div className="acct__card acct__card--wide">
                  <p className="acct__me"><bdi dir="ltr">{acc.email ?? acc.phone_norm}</bdi></p>
                  <div className="acct__actions">
                    <form action={logout}><button className="btn btn--ghost btn--sm" type="submit">{x.logout}</button></form>
                    <form action={erase}><ConfirmErase label={x.erase} message={x.eraseConfirm} /></form>
                  </div>
                  <p className="acct__note">{x.privacy}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer columns={footer} company={company} t={t} />
      {chat.enabled ? <ChatWidget lang={lang} greeting={chat.greeting[lang] || ''} /> : null}
      <SiteScripts t={t} page="account" quoteHref={quote} phoneIntl={company.phoneIntl} search={search} />
    </>
  );
}

function ConfirmErase({ label, message }: { label: string; message: string }) {
  return <ConfirmButton className="acct__link acct__link--bad" message={message}>{label}</ConfirmButton>;
}
