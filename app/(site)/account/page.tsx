/* =============================================================================
   حساب العميل (/account) — الحسابُ وحده، والدخول في /login.

   كانت الصفحة الواحدة تعرض الدخول أو الحساب بحسب الجلسة: عنوانٌ واحد لشيئين.
   وهنا من لم يدخل يُحوَّل إلى /login، فلهذا العنوان معنًى واحد: ما عندك.

   وترتيب ما يُعرَض ترتيبُ ما جاء له: طلباته أولًا — وهي سبب دخوله — ثم
   محادثاته مطويّةً (لا تُسكَب في الصفحة حائطَ كلام)، ثم بياناته. ومسحُ
   الحساب لا يُجاور «خروج» في قلب الصفحة: فعلٌ لا يُستردّ، فله حيّزه آخرها.

   وطلبات المتجر تتبع المتجر: يقفله السوبر أدمن فيختفي قسمها هنا كما يختفي
   رابطه من المنيو — ولا يُحذف طلبٌ ولا يضيع، ويعود كلُّه بفتحه.
============================================================================= */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { q, tx, when } from '@/lib/db';
import { getDict, makeT, pickLang } from '@/lib/i18n';
import { getNav, getFooterColumns } from '@/lib/nav';
import { getCompany, getSearchIndex, getSetting } from '@/lib/content';
import { getStore } from '@/lib/store';
import { themeCss, type Theme } from '@/lib/design';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { SiteScripts } from '@/components/site/SiteScripts';
import { AccountChat } from '@/components/site/AccountChat';
import { ConfirmButton } from '@/components/ConfirmButton';
import { getChatSettings } from '@/lib/chat/provider';
import { currentCustomer, endCustomerSession } from '@/lib/customerAuth';
import { eraseCustomer } from '@/lib/customers';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const ar = pickLang((await searchParams).lang) === 'ar';
  return { title: ar ? 'حسابي — 5A&M' : 'My account — 5A&M', robots: { index: false, follow: false } };
}

const TX = {
  ar: {
    hello: 'أهلًا', you: 'حسابك', logout: 'خروج', sections: 'أقسام حسابك',
    sumReq: 'طلب', sumOpen: 'قيد التنفيذ', sumChat: 'محادثة',
    requests: 'طلباتي', reqSub: 'كل طلب بعتهولنا وحالته دلوقتي.',
    store: 'طلباتي من المتجر', storeSub: 'المعدات وقطع الغيار اللي طلبتها من المتجر.',
    browse: 'افتح المتجر', noStore: 'لسه ما طلبتش حاجة من المتجر.',
    noRequests: 'لسه ما بعتّش طلبات.', askQuote: 'اطلب عرض سعر',
    chats: 'كلّم فريقنا', chatSub: 'اكتب، أو ابعت صورة أو فيديو للمعدة، أو رسالة صوتية.',
    older: 'محادثات سابقة', olderSub: 'اللي اتقفل أو بدأته قبل كده.',
    replied: 'فريقنا ردّ عليك', msgs: 'رسالة',
    who: { user: 'أنت', bot: 'المساعد', agent: 'فريق 5A&M', system: '' } as Record<string, string>,
    convStatus: { bot: 'مع المساعد', human: 'مع فريقنا', closed: 'مقفولة' } as Record<string, string>,
    myInfo: 'بياناتي', myInfoSub: 'بتساعد فريقنا يرد عليك أسرع ويعرف طبيعة شغلك.',
    pname: 'الاسم', company: 'الشركة', city: 'المدينة', save: 'احفظ', saved: 'اتحفظت بياناتك.',
    danger: 'مسح الحساب', erase: 'امسح حسابي وبياناتي',
    eraseWhat: 'ده بيمسح حسابك ومحادثاتك وبياناتك الشخصية نهائيًّا، ومش بيترجع.',
    eraseConfirm: 'مسح حسابك ومحادثاتك وبياناتك الشخصية نهائيًا؟',
    privacy: 'بنحفظ بياناتك للتواصل معك بخصوص طلباتك بس.',
    status: { new: 'وصلنا', contacted: 'تواصلنا معك', confirmed: 'مؤكد', processing: 'قيد التنفيذ', done: 'تم', cancelled: 'ملغي' } as Record<string, string>,
    kinds: { quote: 'عرض سعر', store: 'طلب من المتجر', callback: 'اتصال', chat: 'محادثة' } as Record<string, string>,
  },
  en: {
    hello: 'Hello', you: 'Your account', logout: 'Sign out', sections: 'Account sections',
    sumReq: 'requests', sumOpen: 'in progress', sumChat: 'conversations',
    requests: 'My requests', reqSub: 'Every request you sent us and where it stands.',
    store: 'My store orders', storeSub: 'The equipment and parts you ordered from the store.',
    browse: 'Open the store', noStore: "You haven't ordered from the store yet.",
    noRequests: "You haven't sent any requests yet.", askQuote: 'Request a quote',
    chats: 'Talk to our team', chatSub: 'Write, or send a photo or video of the equipment, or a voice message.',
    older: 'Earlier conversations', olderSub: 'Closed ones, or ones you started before.',
    replied: 'Our team replied', msgs: 'messages',
    who: { user: 'You', bot: 'Assistant', agent: '5A&M team', system: '' } as Record<string, string>,
    convStatus: { bot: 'With the assistant', human: 'With our team', closed: 'Closed' } as Record<string, string>,
    myInfo: 'My details', myInfoSub: 'They help our team reply faster and understand your work.',
    pname: 'Name', company: 'Company', city: 'City', save: 'Save', saved: 'Your details were saved.',
    danger: 'Delete account', erase: 'Delete my account and data',
    eraseWhat: 'This permanently deletes your account, conversations and personal data. It cannot be undone.',
    eraseConfirm: 'Permanently delete your account, conversations and personal data?',
    privacy: 'We keep your details only to contact you about your requests.',
    status: { new: 'Received', contacted: 'We contacted you', confirmed: 'Confirmed', processing: 'In progress', done: 'Done', cancelled: 'Cancelled' } as Record<string, string>,
    kinds: { quote: 'Quote', store: 'Store order', callback: 'Call back', chat: 'Chat' } as Record<string, string>,
  },
};

/* لون الحالة: الجارية تُبرَز، والمنتهية تهدأ، والملغاة تُحيَّد */
const TONE: Record<string, string> = {
  new: 'is-live', contacted: 'is-live', confirmed: 'is-live', processing: 'is-live',
  done: 'is-done', cancelled: 'is-off',
};
const OPEN = new Set(['new', 'contacted', 'confirmed', 'processing']);

type SP = { lang?: string; ok?: string; tab?: string };

export default async function AccountPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const lang = pickLang(sp.lang);
  const x = TX[lang];
  const self = `/account?lang=${lang}`;

  /* لا دخولَ في هذه الصفحة: من لا جلسة له مكانه /login */
  const acc = await currentCustomer();
  if (!acc) redirect(`/login?lang=${lang}`);

  async function logout() {
    'use server';
    await endCustomerSession();
    redirect(`/login?lang=${lang}`);
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
    /* حقّه في المسح (151/2020): الحساب ومحادثاته، وبياناته الشخصية من الطلبات.

       ومعها التنبيهاتُ التي تشير إليها: تنبيهٌ يبقى بعد محادثته يقود الموظف
       إلى صفحةٍ لا شيء فيها، ويحمل في عنوانه ما مُحي من أثر صاحبه. */
    await tx(async (db) => {
      const mine = await db.q<any>('SELECT id FROM chat_conversations WHERE account_id = ?', [a.id]);
      for (const v of mine) {
        await db.q('DELETE FROM notifications WHERE link = ?', [`/admin/chats/${v.id}`]);
      }
      await db.q('DELETE FROM chat_conversations WHERE account_id = ?', [a.id]);
      if (a.customer_id) await eraseCustomer(a.customer_id, db);
      await db.q('DELETE FROM customer_accounts WHERE id = ?', [a.id]);
    });
    await q(`INSERT INTO audit_log (user_id, user_name, action, entity, entity_id, summary) VALUES (NULL, 'العميل نفسه', 'customer.delete', 'account', ?, 'مسح حسابه وبياناته من صفحة حسابه')`, [String(a.id)]);
    await endCustomerSession();
    redirect(`/login?lang=${lang}`);
  }

  const [dict, nav, footer, company, search, theme, chat, store] = await Promise.all([
    getDict(), getNav(), getFooterColumns(), getCompany(), getSearchIndex(lang), getSetting<Theme>('theme', {}), getChatSettings(), getStore(),
  ]);
  const t = makeT(lang, dict);
  const quote = `quote.html?source=account&lang=${lang}`;
  /* المحادثة كاملة لا آخر سطر: العميل يراجع ما قيل له قبل أن يكمّل.
     و«ردّ فريقنا» = آخر رسالة من موظف — فيعرف أن عليه دورًا بلا عمود جديد. */
  const [convs, reqs, profile] = await Promise.all([
    q<any>(`SELECT c.id, c.status, c.last_message_at,
              (SELECT role FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_role,
              (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id) AS n
             FROM chat_conversations c WHERE c.account_id = ? ORDER BY c.last_message_at DESC LIMIT 10`, [acc.id]),
    acc.customer_id ? q<any>('SELECT id, kind, status, items, created_at FROM requests WHERE customer_id = ? ORDER BY id DESC LIMIT 30', [acc.customer_id]) : Promise.resolve([]),
    acc.customer_id ? q<any>('SELECT name, company, city, email, phone FROM customers WHERE id = ?', [acc.customer_id]) : Promise.resolve([]),
  ]);
  const me = profile[0] ?? {};
  /* رسائل كل محادثة — بلا الرسائل الداخلية التي لا تخصّ العميل */
  const threads: Record<number, any[]> = {};
  if (convs.length) {
    const rows = await q<any>(
      `SELECT conversation_id, role, text, files, created_at FROM chat_messages
        WHERE conversation_id IN (${convs.map(() => '?').join(',')}) AND role IN ('user','bot','agent','system')
        ORDER BY id`, convs.map((c: any) => c.id)
    );
    for (const r of rows) {
      const f = !r.files ? [] : typeof r.files === 'string' ? (() => { try { return JSON.parse(r.files); } catch { return []; } })() : r.files;
      (threads[r.conversation_id] ??= []).push({ ...r, files: Array.isArray(f) ? f : [] });
    }
  }
  /* الجارية تُدار في اللوحة فوق، فالقائمة تحتها لما سواها */
  const older = chat.enabled ? convs.filter((c: any) => c.status === 'closed').concat(convs.filter((c: any) => c.status !== 'closed').slice(1)) : convs;
  const items = (v: any) => { try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a : []; } catch { return []; } };

  /* طلبات المتجر تُفرَز وحدها، وتعود إلى العامّة حين يُقفل المتجر — فلا
     يختفي طلبٌ من حساب صاحبه لأن المتجر أُقفل بعد أن طلبه. */
  const storeReqs = store.enabled ? reqs.filter((r: any) => r.kind === 'store') : [];
  const otherReqs = store.enabled ? reqs.filter((r: any) => r.kind !== 'store') : reqs;
  const openN = reqs.filter((r: any) => OPEN.has(r.status)).length;
  const unread = convs.filter((c: any) => c.last_role === 'agent').length;
  const css = themeCss(theme);

  /* الأقسام: ما يُعرَض منها يتبع المتجر وحالة المحادثة، فتُبنى هنا مرّةً
     ويُقرأ منها الشريطُ الجانبي والمحتوى معًا — فلا يفترقان. */
  const ico = (d: string) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
  );
  const tabs = [
    ...(chat.enabled ? [{
      id: 'chat', label: x.chats, n: unread,
      icon: ico('M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.7L3 21l1.9-5A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z'),
    }] : []),
    ...(store.enabled ? [{
      id: 'store', label: x.store, n: storeReqs.length,
      icon: ico('M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2'),
    }] : []),
    { id: 'orders', label: x.requests, n: otherReqs.length, icon: ico('M8 4h9l3 3v13H8zM8 4H5v16h3M11 10h6M11 14h6') },
    ...(older.length ? [{ id: 'older', label: x.older, n: older.length, icon: ico('M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0') }] : []),
    ...(acc.customer_id ? [{ id: 'profile', label: x.myInfo, n: 0, icon: ico('M12 11.5a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2zM4.8 20a7.2 7.2 0 0 1 14.4 0') }] : []),
    { id: 'danger', label: x.danger, n: 0, icon: ico('M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3') },
  ];
  /* الافتراضي: المحادثة — هو في حسابه ليكلّمنا قبل أن يقرأ قائمة */
  const tab = tabs.some((v) => v.id === sp.tab) ? sp.tab! : tabs[0].id;

  const Req = (r: any) => (
    <li className="acct__req" key={r.id}>
      <span className={`acct__pill ${TONE[r.status] ?? 'is-off'}`}>{x.status[r.status] ?? r.status}</span>
      <b>{x.kinds[r.kind] ?? r.kind}</b>
      <small dir="ltr">#{r.id} · {when(r.created_at)}</small>
      {items(r.items).length ? (
        <p>{items(r.items).map((i: any) => `${i.name} × ${i.qty}`).join('، ')}</p>
      ) : null}
    </li>
  );

  return (
    <>
      {css ? <style data-theme="">{css}</style> : null}
      <Header nav={nav} company={company} t={t} page="account.html" quoteHref={quote} />
      <main id="main">
        <section className="sec acct">
          <div className="wrap acct__wrap">
            {/* ترويسة الحساب: من أنت، وأين أنت، والخروج — في مكانٍ واحد
                ثابت بدل كارتٍ ضائع في آخر الصفحة. */}
            <div className="acct__shell">
            {/* قائمةٌ جانبية لا كروتٌ مرصوصة: الأقسام تطول وتزيد، ورصُّها
                يجعل الصفحة شريطًا يُمرَّر لا لوحةً يُنتقل فيها. وهي روابط
                بعنوانٍ لكلٍّ (?tab=) لا تبويباتُ متصفّح: يُحفَظ الرابط،
                ويعود الزرُّ إلى القسم السابق، وتُرسَم في الخادم بلا سكربت. */}
            <aside className="acct__nav">
              <div className="acct__who">
                <span className="acct__avatar" aria-hidden="true">
                  {(acc.name ?? acc.email ?? '؟').trim().charAt(0).toUpperCase()}
                </span>
                <div>
                  <b>{acc.name || x.you}</b>
                  {/* اسم المستخدم هو ما يدخل به، فيُعرَض ليراه لا ليتذكّره */}
                  <small><bdi dir="ltr">{acc.username ? `@${acc.username}` : (acc.email ?? acc.phone_norm)}</bdi></small>
                </div>
              </div>

              <nav className="acct__menu" aria-label={x.sections}>
                {tabs.map((v) => (
                  <a key={v.id} href={`${self}&tab=${v.id}`} className={tab === v.id ? 'is-on' : ''}
                     aria-current={tab === v.id ? 'page' : undefined}>
                    {v.icon}
                    <span>{v.label}</span>
                    {v.n ? <u>{v.n}</u> : null}
                  </a>
                ))}
              </nav>

              <form action={logout} className="acct__out">
                <button type="submit">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2M10 12h10m0 0-3-3m3 3-3 3" />
                  </svg>
                  <span>{x.logout}</span>
                </button>
              </form>
            </aside>

            <div className="acct__body">
            {sp.ok === 'profile' ? <p className="formmsg is-ok" role="status">{x.saved}</p> : null}

            {/* شريطُ الأرقام يبقى فوق كل قسم: هو ملخَّصُ الحساب لا قسمًا منه */}
            <div className="acct__stats">
              <span className="acct__stat"><b>{reqs.length}</b> {x.sumReq}</span>
              <span className="acct__stat"><b>{openN}</b> {x.sumOpen}</span>
              <span className="acct__stat"><b>{convs.length}</b> {x.sumChat}</span>
            </div>

            {tab === 'chat' && chat.enabled ? (
              <section className="acct__box acct__box--chat">
                <div className="acct__boxhead">
                  <div><h2>{x.chats}</h2><p>{x.chatSub}</p></div>
                </div>
                <AccountChat lang={lang} greeting={chat.greeting[lang] || ''} />
              </section>
            ) : null}

            {/* المتجر مفتوحًا: طلباته قسمٌ قائم بذاته. ومقفولًا: لا قسم ولا
                بندٌ في القائمة، وطلباته تندرج في «طلباتي» فلا تختفي من حساب
                صاحبها لأن المتجر أُقفل بعد أن طلبها. */}
            {tab === 'store' && store.enabled ? (
              <section className="acct__box">
                <div className="acct__boxhead">
                  <div><h2>{x.store}</h2><p>{x.storeSub}</p></div>
                  <a className="btn btn--ghost btn--sm" href={t.href('store.html')}>{x.browse}</a>
                </div>
                {storeReqs.length ? (
                  <ul className="acct__list">{storeReqs.map(Req)}</ul>
                ) : (
                  <div className="acct__empty">
                    <p>{x.noStore}</p>
                    <a className="btn btn--sm" href={t.href('store.html')}>{x.browse}</a>
                  </div>
                )}
              </section>
            ) : null}

            {tab === 'orders' ? (
              <section className="acct__box">
                <div className="acct__boxhead">
                  <div><h2>{x.requests}</h2><p>{x.reqSub}</p></div>
                  <a className="btn btn--ghost btn--sm" href={quote}>{x.askQuote}</a>
                </div>
                {otherReqs.length ? (
                  <ul className="acct__list">{otherReqs.map(Req)}</ul>
                ) : (
                  <div className="acct__empty">
                    <p>{x.noRequests}</p>
                    <a className="btn btn--sm" href={quote}>{x.askQuote}</a>
                  </div>
                )}
              </section>
            ) : null}

            {tab === 'older' ? (
              <section className="acct__box">
                <div className="acct__boxhead">
                  <div><h2>{x.older}</h2><p>{x.olderSub}</p></div>
                </div>
                <div className="acct__convs">
                  {older.map((c: any) => (
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
                            {(m.files ?? []).map((f: any, k: number) => <ConvFile key={k} f={f} />)}
                            {m.text ? <span>{m.text}</span> : null}
                          </li>
                        ))}
                      </ol>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}

            {tab === 'profile' && acc.customer_id ? (
              <section className="acct__box">
                <div className="acct__boxhead"><div><h2>{x.myInfo}</h2><p>{x.myInfoSub}</p></div></div>
                <form action={saveProfile} className="acct__form">
                  <label><span>{x.pname}</span><input name="pname" defaultValue={me.name ?? acc.name ?? ''} maxLength={120} autoComplete="name" /></label>
                  <label><span>{x.company}</span><input name="company" defaultValue={me.company ?? ''} maxLength={160} autoComplete="organization" /></label>
                  <label><span>{x.city}</span><input name="city" defaultValue={me.city ?? ''} maxLength={120} autoComplete="address-level2" /></label>
                  <button className="btn btn--ghost btn--sm" type="submit">{x.save}</button>
                </form>
                <p className="acct__note">{x.privacy}</p>
              </section>
            ) : null}

            {/* قسمٌ قائمٌ بذاته لا ذيلٌ تحت البيانات: فعلٌ لا يُستردّ، فلا
                يُضغط سهوًا وهو يمرّ تحت عين من جاء يعدّل اسمه. */}
            {tab === 'danger' ? (
              <section className="acct__box acct__danger">
                <h2>{x.danger}</h2>
                <p>{x.eraseWhat}</p>
                <form action={erase}>
                  <ConfirmButton className="acct__link acct__link--bad" message={x.eraseConfirm}>{x.erase}</ConfirmButton>
                </form>
              </section>
            ) : null}
            </div>
            </div>
          </div>
        </section>
      </main>
      <Footer columns={footer} company={company} t={t} />
      {/* لا نافذةَ ركنٍ هنا: المحادثة في وسط الصفحة، ونافذتان لمحادثةٍ
          واحدة تربكان ولا تضيفان. */}
      <SiteScripts t={t} page="account" quoteHref={quote} phoneIntl={company.phoneIntl} search={search} />
    </>
  );
}

/** مرفق في محادثةٍ سابقة — معروضًا لا قابلًا للرفع */
function ConvFile({ f }: { f: any }) {
  const src = '/' + String(f?.url ?? '').replace(/^\//, '');
  if (!f?.url) return null;
  if (f.kind === 'image') {
    return <a className="conv__f" href={src} target="_blank" rel="noreferrer"><img src={src} alt={f.name ?? ''} loading="lazy" /></a>;
  }
  if (f.kind === 'video') return <video className="conv__f" src={src} controls preload="none" playsInline />;
  return <audio className="conv__f" src={src} controls preload="none" />;
}
