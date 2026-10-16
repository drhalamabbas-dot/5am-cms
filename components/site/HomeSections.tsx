/* =============================================================================
   سكاشن الصفحة الرئيسية — منقولة عن index.html و assets/js/home.js.

   ما كان يُكتب في المتصفح صار يُرسم من السيرفر: شريط اللوجوهات، وكروت
   الوكالات، وصفوف كروت الأقسام. والسلايدر يبقى تفاعله في المتصفح، أما صوره
   وتبويباته فتُرسم هنا كي يراها محرك البحث ويظهر أول مشهد بلا انتظار.

   ملاحظة على النصوص: الموقع القديم كان يكتب بعض العناوين مرتين — مرة في
   index.html ومرة يستبدلها ux.js بعد التحميل. المخزَّن هو ما كان يراه الزائر
   فعلًا، أي نسخة ux.js.
============================================================================= */
import type { T } from '@/lib/i18n';
import type { Brand } from '@/lib/content';
import { Icon } from './Icon';
import { Pic } from './Pic';
import { ASSET_V } from '@/lib/version';

type Any = Record<string, any>;

const abs = (u: string) => (/^(https?:|data:|\/)/i.test(u) ? u : '/' + u.replace(/^\.?\//, ''));
const ver = (u: string) => (ASSET_V && !/[?#]/.test(u) ? `${abs(u)}?v=${ASSET_V}` : abs(u));

/* ------------------------------------------------------------ سلايدر الهيرو
   الصورة الأولى تُحمَّل فورًا، والبقية بـ data-src ليأخذها السلايدر عند
   اقترابها — كما في الموقع الحالي، فلا يُنزَّل 26 صورة على الزائر. */
export function HeroSlider({ s, t, underHeader = false }: { s: Any; t: T; underHeader?: boolean }) {
  const slides: Any[] = s.slides ?? [];
  /* أول صورة كل تبويب تُحسب من مجموعته لا من رقم مخزَّن: إضافة صورة أو حذفها
     كانت تُزيح الأرقام فيفتح كل تبويب على صور غيره. والرقم المخزَّن احتياط
     لتبويب لا صور لمجموعته. */
  const tabs: Any[] = (s.tabs ?? []).map((tb: Any) => {
    const first = slides.findIndex((sl) => sl.group === tb.group);
    return { ...tb, slide: first >= 0 ? first : tb.slide };
  });
  return (
    <section className={`vhero${underHeader ? ' under-hdr' : ''}`} id="hero">
      <div className="vhero__media">
        <video className="vhero__video" autoPlay loop muted playsInline poster={ver(s.video?.poster ?? '')}>
          {(s.video?.sources ?? []).map((v: Any) => (
            <source key={v.src} src={ver(v.src)} type={v.type} />
          ))}
        </video>
        <div className="vhero__slides" id="heroSlides" aria-label={t.t(s.slidesAria || '', 'Equipment showcase')}>
          {slides.map((sl, i) => {
            /* الصورتان الأوليان تُحمَّلان فورًا والأولى بأولوية، بحكم موضعهما
               لا بعلامة مخزّنة: الصورة المستبدَلة تفقد علاماتها (هي مربوطة
               بمسار الصورة)، فكانت الأولى تظهر فارغة حتى يصلها السلايدر. */
            const preload = i < 2 || sl.preload === true;
            return (
              <div className={`vhero__slide${i === 0 ? ' is-active' : ''}`} data-index={i} data-group={sl.group} key={i}>
                <img
                  {...(preload ? { src: ver(sl.img) } : { 'data-src': ver(sl.img) })}
                  alt={t.tx(sl.alt)}
                  className="vhero__img"
                  width={sl.w ?? undefined}
                  height={sl.h ?? undefined}
                  {...(i === 0 ? { fetchPriority: 'high' as const } : { decoding: 'async' as const })}
                />
              </div>
            );
          })}
        </div>
        <span className="vhero__scrim" aria-hidden="true" />
      </div>

      <div className="vhero__spacer" aria-hidden="true" />

      <div className="vhero__foot">
        <div className="vhero__tabs" id="heroTabs" role="tablist"
             aria-label={t.ar ? 'المعدات المعروضة' : 'Featured equipment slides'}>
          {tabs.map((tb, i) => (
            <button className={`vhero__tab${i === 0 ? ' is-active' : ''}`} type="button" role="tab"
                    data-group={tb.group} data-slide={tb.slide} aria-selected={i === 0}
                    aria-label={`${tb.title} — ${t.tx(tb.sub)}`} key={tb.group}>
              <span className="vhero__tab-idx">{tb.idx}</span>
              <span className="vhero__tab-info">
                <b className="vhero__tab-title">{tb.title}</b>
                <span className="vhero__tab-sub">{t.tx(tb.sub)}</span>
              </span>
              <span className="vhero__tab-bar"><span className="vhero__tab-fill" /></span>
            </button>
          ))}
        </div>

        <div className="vhero__nav" role="group" aria-label={t.ar ? 'تنقّل بين المنتجات' : 'Browse products'}>
          <button className="vhero__navbtn" type="button" id="heroPrev" aria-controls="heroTabs"
                  aria-label={t.ar ? 'المنتج السابق' : 'Previous product'}
                  title={t.ar ? 'المنتج السابق' : 'Previous product'}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button className="vhero__navbtn" type="button" id="heroNext" aria-controls="heroTabs"
                  aria-label={t.ar ? 'المنتج التالي' : 'Next product'}
                  title={t.ar ? 'المنتج التالي' : 'Next product'}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------- شريط لوجوهات الشركات
   المجموعة مكرّرة مرتين كي تدور الحركة بلا قطع — كما في home.js. */
export function Logostrip({ s, brands, t, uid }: {
  s: Any; brands: Record<string, Brand>; t: T;
  /** يُمرَّر حين يُضاف الشريط إلى صفحة عادية، كي لا يتكرّر المعرّف لو وُضع مرتين.
      الرئيسية لا تمرّره، فتبقى مخرجاتها كما هي حرفًا بحرف. */
  uid?: string | number;
}) {
  const hid = uid == null ? 'logostripH' : `logostripH-${uid}`;
  const sid = uid == null ? 'brandStrip' : `brandStrip-${uid}`;
  const items = (s.brands ?? [])
    .map((id: string) => brands[id])
    .filter((b: Brand | undefined) => b && b.logo);
  const group = (hidden: boolean) => (
    <div className="logostrip__group" {...(hidden ? { 'aria-hidden': true } : {})}>
      {items.map((b: Brand) => (
        <div className="logostrip__item" key={b.slug}>
          <img src={b.logo!} alt={b.name} decoding="async" />
        </div>
      ))}
    </div>
  );
  return (
    <section className="logostrip" aria-labelledby={hid}>
      <div className="wrap logostrip__in">
        <h2 className="logostrip__label" id={hid}>{t.tx(s.title)}</h2>
        <div className="logostrip__marquee">
          <div className="logostrip__track" id={sid}>{group(false)}{group(true)}</div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------ ترويسة سكشن الرئيسية */
function Lead({ s, t, row }: { s: Any; t: T; row: boolean }) {
  return (
    <div className={`lead${row ? ' lead--row' : ''}`} data-reveal>
      {row ? (
        <>
          <div>
            {t.tx(s.eyebrow).trim() ? <p className="lead__eyebrow">{t.tx(s.eyebrow)}</p> : null}
            <h2 className="lead__title">{t.tx(s.title)}</h2>
          </div>
          {s.cta ? (
            /* السهم كان يختفي في النسخة العربية: الترجمة تُكتب بـ textContent
               فتمحو العنصر الذي يحمله. يظهر هنا بلغتيه كما هو في كل زر آخر. */
            <a className="btn btn--ghost" href={t.href(s.cta.href)}>
              {t.tx(s.cta.label)} <span><Icon name="arrow" /></span>
            </a>
          ) : null}
        </>
      ) : (
        <>
          {t.tx(s.eyebrow).trim() ? <p className="lead__eyebrow">{t.tx(s.eyebrow)}</p> : null}
          <h2 className="lead__title">{t.tx(s.title)}</h2>
          {s.lede ? <p className="lead__lede">{t.tx(s.lede)}</p> : null}
        </>
      )}
    </div>
  );
}

const tone = (v?: string) => (v ? ` sec--${v}` : '');

/* ------------------------------------ كروت الوكالات: Elgin وVactor وGuzzler */
export function BrandCards({ s, brands, t }: { s: Any; brands: Record<string, Brand>; t: T }) {
  return (
    <section className={`sec${tone(s.tone)}`} id="federal">
      <div className="wrap">
        <Lead s={s} t={t} row={false} />
        <div className="fscards" id="fsCards" data-reveal data-d="1" data-stagger>
          {(s.cards ?? []).map((c: Any) => {
            const b = brands[c.brand];
            const title = b?.name ?? c.brand;
            return (
              <a className="fscard" href={t.href(c.href ?? s.brandPage?.[c.brand] ?? 'environment.html')}
                 aria-label={title} key={c.brand}>
                <span className="fscard__fig"><Pic src={c.image} alt={t.tx(c.alt)} /></span>
                <span className="fscard__in">
                  <div className="fscard__head">
                    <span className="fscard__sub">{t.ar ? b?.sub_ar || b?.sub_en : b?.sub_en}</span>
                    <h3 className="fscard__h">{title}</h3>
                  </div>
                  <span className="fscard__d">{t.tx(c.d)}</span>
                  <span className="fscard__lines">
                    {(c.lines ?? []).map((x: Any, i: number) => <i key={i}>{t.tx(x)}</i>)}
                  </span>
                  <span className="fscard__foot">
                    <span className="fscard__n">{t.tx(s.dealerLabel)}</span>
                    <CardCta label={t.tx(s.cardCta)} />
                  </span>
                </span>
              </a>
            );
          })}
        </div>
        <SwipeHint t={t} />
      </div>
    </section>
  );
}

/* رابط «اعرف المزيد» في كارت القسم.
   الموقع القديم كان يرسم داخله عنصرين ثم يعيد ux.js كتابة محتواه نصًّا وسهمًا
   بلا أغلفة. المرسوم هنا هو الناتج النهائي، فلا فرق في الشكل ولا عناصر زائدة. */
function CardCta({ label }: { label: string }) {
  return <span className="fscard__cta-link">{label} <Icon name="arrow" /></span>;
}

/* تلميح السحب أسفل صف الكروت — يظهر على الشاشات الضيقة حيث يُسحب الصف. */
function SwipeHint({ t }: { t: T }) {
  return (
    <p className="ux-swipe-hint" aria-hidden="true">
      <Icon name="arrow" /><span>{t.ar ? 'اسحب لرؤية المزيد' : 'Swipe for more'}</span>
    </p>
  );
}

/* ----------------------------------------- صف كروت قسم (طاقة، تصنيع، خدمات…) */
export function CardRow({ s, anchor, t }: { s: Any; anchor: string | null; t: T }) {
  return (
    <section className={`sec${tone(s.tone)}`} id={anchor ?? ''}>
      <div className="wrap">
        <Lead s={s} t={t} row />
        <div className="fscards mt-32" id={s.key ?? undefined} data-reveal data-d="1" data-stagger>
          {(s.cards ?? []).map((c: Any, i: number) => {
            const title = t.tx(c.h);
            return (
              <a className="fscard" href={t.href(c.href)} aria-label={title} key={i}>
                <span className="fscard__fig"><Pic src={c.img} alt={title} /></span>
                <span className="fscard__in">
                  <div className="fscard__head">
                    <span className="fscard__sub">{t.tx(c.sub)}</span>
                    <h3 className="fscard__h">{title}</h3>
                  </div>
                  <span className="fscard__d">{t.tx(c.d)}</span>
                  <span className="fscard__lines">
                    {(c.lines ?? []).map((x: Any, k: number) => <i key={k}>{t.tx(x)}</i>)}
                  </span>
                  <span className="fscard__foot">
                    <span className="fscard__n">{t.tx(c.who)}</span>
                    <CardCta label={t.tx(s.cardCta)} />
                  </span>
                </span>
              </a>
            );
          })}
        </div>
        <SwipeHint t={t} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ التوزيع */
export function HomeSection({
  s, brands, t, underHeader = false,
}: { s: { type: string; anchor: string | null; content: Any }; brands: Record<string, Brand>; t: T; underHeader?: boolean }) {
  switch (s.type) {
    case 'heroSlider': return <HeroSlider s={s.content} t={t} underHeader={underHeader} />;
    case 'logostrip':  return <Logostrip s={s.content} brands={brands} t={t} />;
    case 'brandCards': return <BrandCards s={s.content} brands={brands} t={t} />;
    case 'cardRow':    return <CardRow s={s.content} anchor={s.anchor} t={t} />;
    default:           return null;
  }
}
