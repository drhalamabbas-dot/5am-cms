/* الهيدر — منقول عن header() في assets/js/site.js بنفس البنية والأصناف.
   يُرسم على السيرفر؛ والتفاعل (فتح القوائم، منيو الهاتف، تبديل اللغة)
   في components/site/SiteScripts.tsx. */
import type { T } from '@/lib/i18n';
import { Icon } from './Icon';
import type { NavItem } from '@/lib/nav';
import type { Company } from '@/lib/content';
import { ASSET_V } from '@/lib/version';


export function Header({
  nav, company, t, page, quoteHref, before, hideAdminLink = false, homeHero = false,
}: {
  nav: NavItem[]; company: Company; t: T; page: string; quoteHref: string;
  /** اخفِ رابط الدخول حين يكون صاحب الموقع مسجلًا بالفعل. */
  hideAdminLink?: boolean;
  /** الشفافية مرتبطة بهيرو مرسوم خلف الهيدر من أول تحميل. */
  homeHero?: boolean;
  /** يُرسم قبل <header> مباشرةً — علامة المحرّر المرئي في المعاينة وحدها */
  before?: React.ReactNode;
}) {
  const other = t.ar ? 'en' : 'ar';
  const isActive = (h: string) => h.split(/[?#]/)[0] === page;
  const openLabel = t.ar ? 'فتح القائمة' : 'Open submenu';
  const allOf = (label: string) =>
    `${t.t('nav.allOf', 'All')} ${t.ar ? label : label.toLowerCase()}`;

  return (
    <>
      <a className="skip" href="#main">{t.t('a11y.skip', 'Skip to content')}</a>
      {before}
      <header className={`hdr${homeHero ? ' hdr--home-hero' : ''}`} id="hdr">
        <div className="wrap hdr__in">
          <a className="hdr__logo" href={t.href('index.html')}
             aria-label={`${company.legalName} — ${t.t('a11y.home', 'home')}`}>
            <img src={`assets/img/brands/5am-logo-white.png?v=${ASSET_V}`}
                 alt="5A&M — Import, Export and Contracting" className="hdr__logo-img" />
          </a>

          <nav className="hdr__nav" aria-label={t.t('a11y.primaryNav', 'Primary')}>
            {nav.map((n, i) => {
              if (n.kind === 'submenu') {
                return (
                  <div className="hdr__item hdr__item--has-sub" key={n.id}>
                    <div className="ux-nav-pair">
                      <a className="hdr__link" href={t.href(n.href)}>{t.tx(n.label)}</a>
                      <button className="ux-nav-toggle" type="button" data-sub={i}
                              aria-label={`${t.tx(n.label)} — ${openLabel}`}
                              aria-expanded="false" aria-controls={`subnav-${i}`}>
                        <Icon name="caret" />
                      </button>
                    </div>
                    <div className="hdr__subnav" id={`subnav-${i}`} data-sub-panel={i}>
                      <div className="hdr__subnav-in">
                        <div className="hdr__subnav-head">
                          <span className="hdr__subnav-tag">{t.tx(n.tag ?? n.label)}</span>
                          <span className="hdr__subnav-desc">{n.desc ? t.tx(n.desc) : ''}</span>
                        </div>
                        <ul className="hdr__subnav-list">
                          {n.links.map((l, k) => (
                            <li key={k}>
                              <a className="hdr__subnav-link" href={t.href(l.href)}>
                                <div className="hdr__subnav-main">
                                  <span className="hdr__subnav-text">{t.tx(l.label)}</span>
                                  {l.desc ? <span className="hdr__subnav-sub">{t.tx(l.desc)}</span> : null}
                                </div>
                                <span className="hdr__subnav-arrow" aria-hidden="true"><Icon name="arrow" /></span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              }
              if (n.kind === 'mega') {
                return (
                  <div className="ux-nav-pair" key={n.id}>
                    <a className="hdr__link" href={t.href(n.href)}>{t.tx(n.label)}</a>
                    <button className="ux-nav-toggle" type="button" data-mega={i}
                            aria-label={`${t.tx(n.label)} — ${openLabel}`}
                            aria-expanded="false" aria-controls={`mega-${i}`}>
                      <Icon name="caret" />
                    </button>
                  </div>
                );
              }
              return (
                <a className={`hdr__link ${isActive(n.href) ? 'is-active' : ''}`}
                   href={t.href(n.href)} key={n.id}>{t.tx(n.label)}</a>
              );
            })}
          </nav>

          <div className="hdr__tools">
            <button className="iconbtn" type="button" id="searchBtn"
                    aria-label={t.ar ? 'ابحث عن منتج أو خدمة' : 'Search products and services'}>
              <Icon name="search" />
            </button>
            <button className="lang" type="button" id="langBtn" lang={other}
                    aria-label={t.t('a11y.switchLang', 'Switch to Arabic')}
                    title={t.t('a11y.switchLang', 'Switch to Arabic')}>
              <Icon name="globe" />{' '}
              <span className="lang__code">{other === 'ar' ? 'العربية' : 'EN'}</span>
            </button>
            {/* مدخل لوحة التحكم. أيقونته مرسومة هنا لا في lib/icons.ts لأن ذلك
                الملف مولَّد آليًا من الموقع القديم، ولم يكن فيه مدخل إدارة.
                nofollow كي لا تتبع محركات البحث الرابط. */}
            {!hideAdminLink ? (
              <a className="iconbtn" href="/admin" rel="nofollow"
                 aria-label={t.ar ? 'دخول لوحة التحكم' : 'Dashboard sign-in'}
                 title={t.ar ? 'دخول لوحة التحكم' : 'Dashboard sign-in'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="10.5" width="16" height="10" rx="2" />
                  <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
                  <circle cx="12" cy="15.5" r="1.3" />
                </svg>
              </a>
            ) : null}

            <button className="iconbtn burger" type="button" id="burger" aria-controls="mnav"
                    aria-label={t.t('a11y.openMenu', 'Open menu')} aria-expanded="false">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
          </div>
        </div>

        {nav.map((n, i) =>
          n.kind !== 'mega' ? null : (
            <div className="mega" id={`mega-${i}`} data-mega-panel={i} key={n.id}>
              <div className="wrap"><div className="mega__in">
                {n.columns.map((c, k) => (
                  <div className="mega__col" key={k}>
                    <h4>{t.tx(c.title)}</h4>
                    {c.links.map((l, j) => <a href={t.href(l.href)} key={j}>{t.tx(l.label)}</a>)}
                  </div>
                ))}
                {n.promo ? (
                  <div className="mega__promo">
                    <div>
                      <h4>{t.tx({ en: n.promo.en?.h, ar: n.promo.ar?.h })}</h4>
                      <p>{t.tx({ en: n.promo.en?.p, ar: n.promo.ar?.p })}</p>
                    </div>
                    <a className="tlink" style={{ color: '#fff' }} href={t.href(n.promo.en?.href ?? '#')}>
                      {t.tx({ en: n.promo.en?.cta, ar: n.promo.ar?.cta })} <Icon name="arrow" />
                    </a>
                  </div>
                ) : null}
              </div></div>
            </div>
          )
        )}
      </header>

      {/* المنيو مغلق عند التحميل، فلا يصله التركيز ولا قارئ الشاشة حتى يُفتح */}
      <div className="mnav" id="mnav" aria-label={t.t('a11y.primaryNav', 'Primary')} inert>
        {nav.map((n) => {
          if (n.kind === 'submenu') {
            return (
              <details className="mnav__group" key={n.id}>
                <summary className="mnav__summary"><span>{t.tx(n.label)}</span></summary>
                <div className="mnav__sub">
                  <a href={t.href(n.href)} className="mnav__sub-all">{allOf(t.tx(n.label))}</a>
                  {n.links.map((l, k) => <a href={t.href(l.href)} key={k}>{t.tx(l.label)}</a>)}
                </div>
              </details>
            );
          }
          if (n.kind === 'mega') {
            return (
              <details key={n.id}>
                <summary>{t.tx(n.label)}</summary>
                <div className="mnav__sub">
                  <a href={t.href(n.href)}>{allOf(t.tx(n.label))}</a>
                  {n.columns.map((c, k) => (
                    <div className="ux-mobile-group" key={k}>
                      <b>{t.tx(c.title)}</b>
                      {c.links.map((l, j) => <a href={t.href(l.href)} key={j}>{t.tx(l.label)}</a>)}
                    </div>
                  ))}
                </div>
              </details>
            );
          }
          return <a className="mnav__top" href={t.href(n.href)} key={n.id}>{t.tx(n.label)}</a>;
        })}
        <a className="btn btn--block mt-24" href={quoteHref}>
          {t.t('cta.requestQuote', 'Request a quote')} <Icon name="arrow" />
        </a>
      </div>
    </>
  );
}
