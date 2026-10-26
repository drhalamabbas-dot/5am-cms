/* =============================================================================
   عروض السكاشن — منقولة عن assets/js/pages2.js بنفس البنية والأصناف.

   قاعدة هذا الملف: لا يتغيّر شكل الصفحة. أي فرق في اسم صنف أو ترتيب عنصر
   يغيّر التصميم، فالمرجع هنا هو الكود القديم لا الذوق.
============================================================================= */
import type { T } from '@/lib/i18n';
import { Icon } from './Icon';
import type { Brand, Product } from '@/lib/content';
import { Pic, Ico } from './Pic';
import { Logostrip } from './HomeSections';
import { ytId } from '@/lib/youtube';

type Any = Record<string, any>;

export type Ctx = {
  t: T;
  brands: Record<string, Brand>;
  products: Record<string, Product>;
  /** رابط نموذج عرض السعر محمّلًا ببيانات الصفحة الحالية. */
  quoteHref: string;
  company: any;
  /** عناوين أقسام الصفحة ومعرّفاتها — يبني منها قسمُ «محتويات الصفحة» روابطه */
  jump?: { id: string; label: string }[];
};


/* ------------------------------------------------------------ ترويسة السيكشن */
function SectionHead({ title, note, t }: { title: any; note?: any; t: T }) {
  return (
    <div className="shead mb-32" data-reveal>
      <span className="shead__rule" aria-hidden="true" />
      <div>
        <h2 className="shead__title">{t.tx(title)}</h2>
        {note ? <p className="shead__lede">{t.tx(note)}</p> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- هيرو الصفحة
   أزرار «ناقش متطلباتك» و«تحدث مع فريقنا» كان ux.js يحقنها بعد التحميل؛
   صارت تُرسم من السيرفر فتظهر فورًا ويقرؤها محرك البحث. */
export function PageHero({
  hero, crumb, parent, quoteHref, phoneIntl, t,
}: {
  hero: Any | null; crumb: any;
  parent?: { href: string; label: any } | null;
  quoteHref?: string | null; phoneIntl?: string | null; t: T;
}) {
  return (
    <section className="phero">
      {/* أعلى الصفحة وحده يملؤه صندوقٌ طوليّ على الهاتف، فهو وحده يطلب
          القَصّة التلقائية. والبطاقات والصفوف تبقى على الصورة العريضة. */}
      <Pic src={hero?.img} mobile={hero?.imgMobile} autoMobile alt={t.tx(crumb)} priority />
      <div className="wrap phero__in">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href={t.href('index.html')}>{t.ar ? 'الرئيسية' : 'Home'}</a>
          <span>/</span>
          {parent ? (
            <>
              <a href={t.href(parent.href)}>{t.tx(parent.label)}</a>
              <span aria-hidden="true">/</span>
            </>
          ) : null}
          <span className="now">{t.tx(crumb)}</span>
        </nav>
        {hero?.kicker ? <p className="phero__kicker">{t.tx(hero.kicker)}</p> : null}
        <h1>{t.tx(hero?.title)}</h1>
        {hero?.lede ? <p>{t.tx(hero.lede)}</p> : null}
        {quoteHref ? (
          <div className="ux-hero-actions">
            <a className="btn" href={quoteHref}>
              {t.ar ? 'ناقش متطلباتك' : 'Discuss your requirements'} <Icon name="arrow" />
            </a>
            {phoneIntl ? (
              <a className="ux-hero-call" href={`tel:${phoneIntl}`}>
                <Icon name="phone" /> {t.ar ? 'تحدث مع فريقنا' : 'Talk to our team'}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* شريط محتويات الصفحة — كان يُبنى في المتصفح من عناوين السكاشن. */
export function JumpNav({ items, least = 2, t }: { items: { id: string; label: string }[]; least?: number; t: T }) {
  if (items.length < least) return null;
  return (
    <nav className="ux-jump" aria-label={t.ar ? 'محتويات الصفحة' : 'On this page'}>
      <div className="wrap">
        {items.map((i) => <a href={`#${i.id}`} key={i.id}>{i.label}</a>)}
      </div>
    </nav>
  );
}

/**
 * الشريط نفسه قسمًا في الصفحة، فيُخفى ويُحذف ويُحرَّك ويُعدَّل من الكانفاز
 * كأي قسم. كان يُرسَم خارج قائمة الأقسام فلا يراه المحرّر أصلًا.
 *
 * الروابط الفارغة تعني «ابنِه من عناوين الأقسام» كما كان يفعل دائمًا — وهو
 * السلوك الذي يتابع الصفحة: يُضاف قسم أو يتغيّر عنوانه فيظهر هنا بلا عمل.
 * وأول رابط يُكتب يدويًّا يتولّى المكتوبُ الأمرَ كاملًا.
 */
export function JumpSection({ s, auto, t }: { s: Any; auto: { id: string; label: string }[]; t: T }) {
  const manual = (Array.isArray(s?.links) ? s.links : [])
    .map((l: Any) => ({ id: String(l?.href ?? '').replace(/^#/, ''), label: t.tx(l?.label) || '' }))
    .filter((l: { id: string; label: string }) => l.id && l.label);
  /* شريطٌ آليٌّ برابطٍ واحد لا معنى له فيُسكت عنه؛ أمّا المكتوب باليد فيظهر
     كما كُتب ولو رابطًا واحدًا — وإلّا اختفى القسم بلا سبب ظاهر لمن كتبه. */
  return manual.length
    ? <JumpNav items={manual} least={1} t={t} />
    : <JumpNav items={auto} t={t} />;
}

/* «وصول مباشر للخدمات» — الصفحات المقترحة أسفل الصفحة. */
export function RelatedPages({ items, t }: { items: { href: string; label: string }[]; t: T }) {
  if (!items.length) return null;
  return (
    <section className="sec ux-related">
      <div className="wrap">
        <h2>{t.ar ? 'وصول مباشر للخدمات' : 'Explore the right service'}</h2>
        <div className="ux-related-grid">
          {items.map((i) => (
            <a href={t.href(i.href)} key={i.href}>
              <span>{i.label}</span>
              <Icon name="arrow" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- الكروت */
function Cards({ s, t }: { s: Any; t: T }) {
  return (
    <section className="sec">
      <div className="wrap">
        <SectionHead title={s.title} note={s.note} t={t} />
        <div className="pgcards" data-reveal data-d="1">
          {(s.cards ?? []).map((c: Any, i: number) => {
            const body = (
              <span className="pgcard__body">
                <b>{t.tx(c.title)}</b>
                <span className="pgcard__d">{t.tx(c.text)}</span>
                {c.href ? (
                  <span className="pgcard__go">
                    {t.ar ? 'اعرف المزيد' : 'Learn more'} <Icon name="arrow" />
                  </span>
                ) : null}
              </span>
            );
            const fig = (
              <span className="pgcard__fig">
                <Pic src={c.img} alt={t.tx(c.title)} />
              </span>
            );
            return c.href ? (
              <a className="pgcard" href={t.href(c.href)} key={i}>{fig}{body}</a>
            ) : (
              <div className="pgcard pgcard--static" key={i}>{fig}{body}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- صف صورة ونص (feature) */
function BrandMark({ id, brands }: { id: string; brands: Record<string, Brand> }) {
  const b = brands[id];
  if (!b || !b.logo) return <p className="prow__kicker">{b?.name ?? id}</p>;
  return (
    <p className="prow__brand">
      <img src={b.logo} alt={b.name} loading="lazy" decoding="async" />
    </p>
  );
}

function Feature({ s, anchor, ctx }: { s: Any; anchor: string | null; ctx: Ctx }) {
  const { t, brands, products } = ctx;
  const product = s.product ? products[s.product] : null;
  return (
    <section className={`sec ${s.flip ? 'sec--paper' : ''}`} id={anchor || ''}>
      <div className="wrap">
        {s.alsoId ? <span id={s.alsoId} className="anchor-alias" aria-hidden="true" /> : null}
        <div className={`prow ${s.flip ? 'prow--flip' : ''}`} data-reveal>
          <div className="prow__media"><Pic src={s.img} alt={t.tx(s.title)} /></div>
          <div className="prow__copy">
            {s.brandId ? <BrandMark id={s.brandId} brands={brands} />
              : s.brand ? <p className="prow__kicker">{s.brand}</p> : null}
            <h2>{t.tx(s.title)}</h2>
            <p>{t.tx(s.text)}</p>
            {s.when ? (
              <p className="prow__when">
                <b>{t.ar ? 'متى تختاره' : 'When it is the right call'}</b>
                <span>{t.tx(s.when)}</span>
              </p>
            ) : null}
            {product ? (
              <a className="tlink mt-16" href={t.href(`model.html?p=${product.slug}`)}>
                <span>{t.ar ? 'اعرض المعدة' : 'See the equipment'}</span>
                <span className="tlink__arrow" aria-hidden="true"><Icon name="arrow" /></span>
              </a>
            ) : s.cta ? (
              <a className="tlink mt-16" href={t.href(s.cta.href)}>
                <span>{t.tx(s.cta.label)}</span>
                <span className="tlink__arrow" aria-hidden="true"><Icon name="arrow" /></span>
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- القوائم */
function List({ s, t }: { s: Any; t: T }) {
  return (
    <section className="sec sec--paper">
      <div className="wrap">
        <SectionHead title={s.title} t={t} />
        <ul className="pglist" data-reveal data-d="1">
          {(s.items ?? []).map((i: any, k: number) => (
            <li key={k}>
              <span className="pglist__tick" aria-hidden="true"><Icon name="tick" /></span>
              <span>{t.tx(i)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- الخطوات */
function Steps({ s, anchor, t }: { s: Any; anchor: string | null; t: T }) {
  return (
    <section className="sec" {...(anchor ? { id: anchor } : {})}>
      <div className="wrap">
        <SectionHead title={s.title} t={t} />
        <ol className="pgsteps" data-reveal data-d="1">
          {(s.steps ?? []).map((st: Any, i: number) => (
            <li key={i}>
              <span className="pgsteps__n">{String(i + 1).padStart(2, '0')}</span>
              <b>{t.tx(st.t)}</b>
              <p>{t.tx(st.d)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- المعرض */
function Gallery({ s, anchor, t }: { s: Any; anchor: string | null; t: T }) {
  const shots: string[] = (s.imgs ?? []).filter(Boolean);
  if (!shots.length) return null;
  const COLS = 4, LEAD = COLS;
  const big = shots.length >= 6;
  const fit = big ? Math.max(0, Math.floor((shots.length - 1 + LEAD) / COLS) * COLS - LEAD) : shots.length - 1;
  const shown = shots.slice(0, fit + 1);
  const extra = shots.length - shown.length;
  const alt = t.tx(s.title);
  return (
    <section className="sec sec--paper" id={anchor || ''}>
      <div className="wrap">
        <SectionHead title={s.title} note={s.note} t={t} />
        <div className={`mshots${big ? '' : ' mshots--even'}`} data-gallery data-reveal data-d="1">
          {shown.map((src, i) => {
            const last = extra > 0 && i === shown.length - 1;
            return (
              <button
                className={`mshot${big && i === 0 ? ' mshot--lead' : ''}`}
                type="button" data-i={i} key={i}
                aria-label={t.ar ? `افتح الصورة ${i + 1}` : `Open photo ${i + 1}`}
              >
                <Pic src={src} alt={alt} />
                <span className="mshot__veil" aria-hidden="true" />
                {last ? (
                  <span className="mshot__more" aria-hidden="true">+{extra}<small>{t.ar ? 'أخرى' : 'more'}</small></span>
                ) : (
                  <span className="mshot__zoom" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6M11 8.4v5.2M8.4 11h5.2" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ كروت المنتجات
   شكلان: «شرح» يعرض وصف المنتج، و«موديلات» يعرض الماركة والنوع وزرّ المواصفات.
   الثاني أنسب حين تكون الكروت موديلات من ماركة واحدة، فالوصف يتكرّر بينها
   والذي يفرّق هو نوع المعدة. */
function ProductFigure({ p, t }: { p: Product; t: T }) {
  const name = (t.ar ? p.name_ar || t.phrase(p.name_en) : p.name_en) ?? '';
  if (p.hero_image) return <div className="card__fig"><Pic src={p.hero_image} alt={name} /></div>;
  return (
    <div className="card__fig card__fig--plate">
      {p.brand_logo ? <img className="plate__logo" src={p.brand_logo} alt={p.brand_name ?? ''} />
                    : <span className="plate__word">{p.brand_name ?? ''}</span>}
      <span className="plate__name">{name}</span>
    </div>
  );
}

function Products({ s, ctx }: { s: Any; ctx: Ctx }) {
  const { t, products } = ctx;
  const list = (s.ids ?? []).map((id: string) => products[id]).filter(Boolean);
  const nameOf = (p: Product) => (t.ar ? p.name_ar || t.phrase(p.name_en) : p.name_en) ?? '';

  const body = s.style === 'models' ? (
    <div className="relcards relcards--section" data-reveal data-d="1">
      {list.map((p: Product) => (
        <a className="relcard" href={t.href(`model.html?p=${p.slug}`)} key={p.ref}>
          <ProductFigure p={p} t={t} />
          <span className="relcard__body">
            <span className="relcard__brand">{p.brand_name ?? ''}</span>
            <b className="relcard__name">{nameOf(p)}</b>
            <span className="relcard__type">{t.t(`sub.${p.subcategory}`, p.subcategory ?? '')}</span>
            <span className="relcard__foot">
              <span className="relcard__cta">{t.t('cta.specifications', 'Specifications')}</span>
              <span className="relcard__go" aria-hidden="true"><Icon name="arrow" /></span>
            </span>
          </span>
          <span className="sr">{`${t.t('eq.specsFor', 'Specifications for')} ${nameOf(p)}`}</span>
        </a>
      ))}
    </div>
  ) : (
    <div className="pgcards" data-reveal data-d="1">
      {list.map((p: Product) => (
        <a className="pgcard" href={t.href(`model.html?p=${p.slug}`)} key={p.ref}>
          <span className="pgcard__fig"><Pic src={p.hero_image} alt={t.phrase(p.name_en)} /></span>
          <span className="pgcard__body">
            <b>{nameOf(p)}</b>
            <span className="pgcard__d">{t.ar ? p.description_ar || t.phrase(p.description_en) : p.description_en}</span>
            <span className="pgcard__go">{t.ar ? 'كل التفاصيل' : 'Full details'} <Icon name="arrow" /></span>
          </span>
        </a>
      ))}
    </div>
  );

  return (
    <section className="sec">
      <div className="wrap">
        <SectionHead title={s.title} note={s.note} t={t} />
        {body}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- صف الحكاية (story) */
/* أشكال قسم «صورة ونص» — صنف واحد يغيّر التخطيط، والقائمة مغلقة فلا يصل إلى
   صفحة الزائر صنف لم يُكتب هنا. */
const STORY_VARIANTS = new Set(['stack', 'card', 'tall', 'plain']);

function Story({ s, anchor, n, t }: { s: Any; anchor: string | null; n: number; t: T }) {
  const num = String(n).padStart(2, '0');
  const variant = STORY_VARIANTS.has(s.variant) ? ` story--${s.variant}` : '';
  const cls = `sec story${s.flip ? ' story--flip sec--paper' : ''}${s.points ? ' story--long' : ''}${variant}`;
  /* الصورة الأساسية أولًا، ثم صور المعرض بلا تكرار */
  const gallery = [...new Set([s.img, ...(Array.isArray(s.imgs) ? s.imgs : [])].filter(Boolean))] as string[];
  return (
    <section className={cls} id={anchor || ''}>
      <div className="wrap">
        <div className="story__row">
          {gallery.length > 1 ? (
            /* معرض كصفحة المنتج: صورة كبيرة بزرّ تكبير، وتحتها صور مصغّرة تبدّلها
               (app.js: galleryZoom). بلا «صور المعرض» يبقى القسم بصورته الواحدة. */
            <div className="story__gal" data-zoom>
              <figure className="story__media">
                <Pic src={gallery[0]} alt={t.tx(s.title)} />
                {t.tx(s.tag).trim() && !s.hideTag ? <figcaption className="story__tag">{t.tx(s.tag)}</figcaption> : null}
                <button type="button" className="ux-zoom">
                  <Icon name="search" /> {t.ar ? 'تكبير الصورة' : 'Enlarge photo'}
                </button>
              </figure>
              <div className="ux-thumbnails" aria-label={t.ar ? 'صور' : 'Photos'}>
                {gallery.map((src: string, i: number) => (
                  <button type="button" aria-pressed={i === 0} key={src + i}
                          aria-label={`${t.ar ? 'عرض الصورة' : 'View photo'} ${i + 1}`}>
                    <img src={src.startsWith('/') ? src : '/' + src} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
          <figure className="story__media">
            <Pic src={s.img} alt={t.tx(s.title)} />
            {/* تسمية فُرّغ نصّها بلغتيها لا يُرسم لها مربّع فارغ */}
            {t.tx(s.tag).trim() && !s.hideTag ? <figcaption className="story__tag">{t.tx(s.tag)}</figcaption> : null}
          </figure>
          )}
          <div className="story__copy">
            {/* الرقم والسطر الصغير: يظهران معًا كما كانا، أو السطر وحده، أو لا شيء */}
            {s.eyebrowStyle === 'none' ? null : (
              <p className="story__eyebrow">
                {s.eyebrowStyle === 'text' ? null : <span>{num}</span>}
                {s.eyebrow ? t.tx(s.eyebrow) : t.ar ? 'خدمات ما بعد البيع' : 'After-sales services'}
              </p>
            )}
            <h2>{t.tx(s.title)}</h2>
            {s.text ? <p className="story__text">{t.tx(s.text)}</p> : null}
            {s.text2 ? <p className="story__text">{t.tx(s.text2)}</p> : null}
            {s.facts ? (
              <dl className="story__facts">
                {s.facts.map((f: Any, i: number) => (
                  <div key={i}><dt>{t.tx(f.k)}</dt><dd>{t.tx(f.v)}</dd></div>
                ))}
              </dl>
            ) : null}
            {s.points ? (
              <div className="story__points">
                {t.tx(s.pointsTitle).trim() ? <b>{t.tx(s.pointsTitle)}</b> : null}
                <ul>
                  {s.points.map((p: any, i: number) => (
                    <li key={i}>
                      <span className="story__tick" aria-hidden="true"><Icon name="tick" /></span>
                      <span>{t.tx(p)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {s.note ? (
              <aside className="story__note">
                <b>{t.tx(s.note.t)}</b>
                <p>{t.tx(s.note.d)}</p>
              </aside>
            ) : null}
            {s.cta ? (
              <a className="btn story__cta" href={t.href(s.cta.href)}>
                {t.tx(s.cta.label)} <Icon name="arrow" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------ الرؤية والرسالة والقيم (vmv) */
function Vmv({ s, anchor, t }: { s: Any; anchor: string | null; t: T }) {
  return (
    <section className="sec sec--paper" id={anchor || ''}>
      <div className="wrap">
        <SectionHead title={s.title} t={t} />
        <div className="vmv3">
          {(s.cards ?? []).map((c: Any, i: number) => (
            <article className="vmv3__card" key={i}>
              <i className="vmv3__ico" aria-hidden="true">
                <Icon name={c.icon} />
              </i>
              <h3>{t.tx(c.t)}</h3>
              <p>{t.tx(c.d)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ نداء الإجراء
   الزر يقود إلى نموذج عرض السعر محمّلًا بخدمة الصفحة ومصدرها، لا إلى صفحة
   التواصل — هكذا كان ux.js يعيد ضبطه بعد الرسم في الموقع القديم. */
function Cta({ s, quoteHref, t }: { s: Any; quoteHref: string; t: T }) {
  return (
    <section className="sec sec--dark">
      <div className="wrap pgcta" data-reveal>
        <div>
          <h2>{t.tx(s.title)}</h2>
          <p>{t.tx(s.text)}</p>
        </div>
        <a className="btn" href={quoteHref}>
          {t.ar ? 'ناقش متطلباتك' : 'Discuss your requirements'} <Icon name="arrow" />
        </a>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- قبل وبعد */
function Compare({ s, anchor, t }: { s: Any; anchor: string | null; t: T }) {
  const L2 = (en: string, ar: string) => (t.ar ? ar : en);
  return (
    <section className="sec sec--paper" id={anchor || ''}>
      <div className="wrap">
        <SectionHead title={s.title} note={s.note} t={t} />
        <div className="ba" data-reveal>
          <Pic src={s.before} alt={t.tx(s.title)} />
          <div className="ba__after"><Pic src={s.after} alt={t.tx(s.title)} /></div>
          <span className="ba__label ba__label--l">{L2('Before', 'قبل')}<small>{t.tx(s.beforeLabel)}</small></span>
          <span className="ba__label ba__label--r">{L2('After', 'بعد')}<small>{t.tx(s.afterLabel)}</small></span>
          <span className="ba__hint" aria-hidden="true">
            <Icon name="drag" /><span>{L2('Drag to compare', 'اسحب للمقارنة')}</span>
          </span>
          <span className="ba__handle" aria-hidden="true" />
          <input className="ba__range" type="range" min={2} max={98} defaultValue={50}
                 aria-label={L2('Compare before and after', 'قارن بين قبل وبعد')} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ صفحة التواصل */
function Contact({ company, t }: { company: any; t: T }) {
  const hl = t.lang;
  const A = (v: any) => (t.ar ? v?.ar : v?.en) ?? '';
  const geo = company.geo || '30.005014419555664,31.472177505493164';
  const dirLabel = t.ar ? 'الاتجاهات على خرائط Google' : 'Directions on Google Maps';
  const scQ = encodeURIComponent(company.serviceCenter?.map ?? '');

  const Row = ({ href, icon, label, value }: { href: string; icon: string; label: string; value: string }) => (
    <a className="cnt__row" href={href}>
      <i aria-hidden="true"><Icon name={icon} /></i>
      <span><small>{label}</small><b dir="ltr">{value}</b></span>
    </a>
  );

  const Place = ({ label, addr, embedQ, dir }: { label: string; addr: string; embedQ: string; dir: string }) => (
    <article className="cnt__place">
      <a className="cnt__map" href={dir} target="_blank" rel="noopener" aria-label={`${label} — ${dirLabel}`}>
        <iframe title={label}
                src={`https://maps.google.com/maps?q=${embedQ}&z=14&hl=${hl}&output=embed`}
                loading="lazy" referrerPolicy="no-referrer-when-downgrade" tabIndex={-1} aria-hidden="true" />
      </a>
      <div className="cnt__body">
        <span className="cnt__badge"><Icon name="pin" /> {label}</span>
        <p className="cnt__addr">{addr}</p>
        <a className="cnt__dir" href={dir} target="_blank" rel="noopener">{dirLabel} <Icon name="arrow" /></a>
      </div>
    </article>
  );

  return (
    <section className="sec sec--paper cnt" id="contact">
      <div className="wrap">
        <div className="cnt__grid">
          <div className="cnt__panel">
            <h2>{t.ar ? 'تواصل معنا' : 'Get in touch'}</h2>
            <p>{t.ar ? 'فريقنا جاهز للرد على استفساراتك وطلباتك.' : 'Our team is ready to answer your questions and requests.'}</p>
            <Row href={`tel:${company.phoneIntl}`} icon="phone" label={t.ar ? 'التليفون' : 'Phone'} value={company.phone} />
            <Row href={`mailto:${company.email}`} icon="mail" label={t.ar ? 'البريد الإلكتروني' : 'Email'} value={company.email} />
            <a className="btn cnt__quote" href={`quote.html?source=contact&lang=${hl}`}>
              {t.ar ? 'اطلب عرض سعر' : 'Request a quote'} <Icon name="arrow" />
            </a>
          </div>
          <div className="cnt__places">
            <h2 className="cnt__h">{t.ar ? 'العنوان' : 'Address'}</h2>
            <Place label={t.ar ? 'المقر الرئيسي' : 'Head office'} addr={A(company.hq)}
                   embedQ={geo} dir={`https://www.google.com/maps/dir/?api=1&destination=${geo}`} />
            <Place label={t.ar ? 'مركز الخدمة' : 'Service center'} addr={A(company.serviceCenter)}
                   embedQ={scQ} dir={`https://www.google.com/maps/search/?api=1&query=${scQ}`} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ أسئلة شائعة
   details/summary: يُفتح ويُطوى بلا جافاسكريبت، ومحرّك البحث يقرأ السؤال
   وجوابه معًا حتى والجواب مطويّ. */
function Faq({ s, anchor, t }: { s: Any; anchor: string | null; t: T }) {
  const items = (s.items ?? []).filter((i: Any) => t.tx(i.q));
  if (!items.length) return null;
  return (
    <section className="sec" id={anchor ?? undefined}>
      <div className="wrap">
        <SectionHead title={s.title} note={s.note} t={t} />
        <div className="faq">
          {items.map((i: Any, n: number) => (
            <details className="faq__i" key={n} {...(s.open && n === 0 ? { open: true } : {})}>
              <summary className="faq__q">
                <span>{t.tx(i.q)}</span>
                <i className="faq__sign" aria-hidden="true" />
              </summary>
              <div className="faq__a"><p>{t.tx(i.a)}</p></div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- أرقام وإنجازات */
function Stats({ s, anchor, t }: { s: Any; anchor: string | null; t: T }) {
  const items = (s.items ?? []).filter((i: Any) => String(i.v ?? '').trim());
  if (!items.length) return null;
  return (
    <section className={`sec${s.tone === 'paper' ? ' sec--paper' : s.tone === 'light' ? ' sec--light' : ''}`}
             id={anchor ?? undefined}>
      <div className="wrap">
        {t.tx(s.title) ? <SectionHead title={s.title} note={s.note} t={t} /> : null}
        <dl className="nums">
          {items.map((i: Any, n: number) => (
            <div className="nums__i" key={n}>
              <dt className="nums__v">{i.v}</dt>
              <dd className="nums__k">{t.tx(i.k)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ آراء العملاء */
function Quotes({ s, anchor, t }: { s: Any; anchor: string | null; t: T }) {
  const items = (s.items ?? []).filter((i: Any) => t.tx(i.text));
  if (!items.length) return null;
  return (
    <section className="sec" id={anchor ?? undefined}>
      <div className="wrap">
        <SectionHead title={s.title} note={s.note} t={t} />
        <div className="says">
          {items.map((i: Any, n: number) => (
            <figure className="say" key={n}>
              <blockquote className="say__t">{t.tx(i.text)}</blockquote>
              <figcaption className="say__by">
                <b>{t.tx(i.who)}</b>
                {t.tx(i.role) ? <span>{t.tx(i.role)}</span> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- فيديو
   تضمين كسول ومن نطاق youtube-nocookie: لا يُحمَّل المشغّل ولا تُكتب كوكي
   إلا حين يقترب الزائر من الفيديو. */
function Videos({ s, anchor, t }: { s: Any; anchor: string | null; t: T }) {
  const items = (s.items ?? []).map((i: Any) => ({ ...i, id: ytId(i.yt) })).filter((i: Any) => i.id);
  if (!items.length) return null;
  return (
    <section className="sec" id={anchor ?? undefined}>
      <div className="wrap">
        {t.tx(s.title) ? <SectionHead title={s.title} note={s.note} t={t} /> : null}
        <div className={`vids${items.length === 1 ? ' vids--one' : ''}`}>
          {items.map((i: Any, n: number) => (
            <figure className="vid" key={n}>
              <div className="vid__box">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${i.id}`}
                  title={t.tx(i.cap) || t.tx(s.title) || 'YouTube'}
                  loading="lazy" allowFullScreen
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin" />
              </div>
              {t.tx(i.cap) ? <figcaption className="vid__cap">{t.tx(i.cap)}</figcaption> : null}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- ملفات للتحميل
   الملف يُفتح في تبويب جديد لا يحلّ محلّ الصفحة: من فتح كتالوجًا لا يقصد أن
   يغادر ما كان يقرأ. وdownload يجعل المتصفح يحفظه باسمه بدل عرضه أحيانًا. */
function Downloads({ s, anchor, t }: { s: Any; anchor: string | null; t: T }) {
  const items = (s.items ?? []).filter((i: Any) => String(i.file ?? '').trim());
  if (!items.length) return null;
  const ext = (p: string) => (p.split('.').pop() ?? '').toUpperCase().slice(0, 4);
  return (
    <section className="sec" id={anchor ?? undefined}>
      <div className="wrap">
        {t.tx(s.title) ? <SectionHead title={s.title} note={s.note} t={t} /> : null}
        <ul className="dlist">
          {items.map((i: Any, n: number) => (
            <li key={n}>
              {/* dlist لا dl: ‎.dl‎ مأخوذ في model.css لقائمة أخرى، وإعادة
                  استعماله هنا كانت تقلب الصفّ عموديًّا. */}
              <a className="dlist__a" href={i.file} target="_blank" rel="noopener" download>
                <span className="dlist__ext" aria-hidden="true">{ext(i.file)}</span>
                <span className="dlist__txt">
                  <b>{t.tx(i.label) || i.file.split('/').pop()}</b>
                  {t.tx(i.note) ? <small>{t.tx(i.note)}</small> : null}
                </span>
                <svg className="dlist__go" viewBox="0 0 24 24" width="18" height="18" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                     aria-hidden="true"><path d="M12 4v12m-5-5 5 5 5-5M4 20h16" /></svg>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ مسيرة بالسنوات */
function Timeline({ s, anchor, t }: { s: Any; anchor: string | null; t: T }) {
  const items = (s.items ?? []).filter((i: Any) => String(i.y ?? '').trim() || t.tx(i.t));
  if (!items.length) return null;
  return (
    <section className={`sec${s.tone === 'paper' ? ' sec--paper' : s.tone === 'light' ? ' sec--light' : ''}`}
             id={anchor ?? undefined}>
      <div className="wrap">
        {t.tx(s.title) ? <SectionHead title={s.title} note={s.note} t={t} /> : null}
        <ol className="tline">
          {items.map((i: Any, n: number) => (
            <li className="tline__i" key={n}>
              {String(i.y ?? '').trim() ? <b className="tline__y" dir="ltr">{i.y}</b> : null}
              <div className="tline__b">
                {t.tx(i.t) ? <h3>{t.tx(i.t)}</h3> : null}
                {t.tx(i.d) ? <p>{t.tx(i.d)}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- جدول مواصفات
   جدول حقيقي لا شبكة divs: قارئ الشاشة يقول «المواصفة: القيمة»، وعلى الهاتف
   تُرصّ الصفوف بـ CSS فيبقى مقروءًا بلا تمرير أفقي. */
function Specs({ s, anchor, t }: { s: Any; anchor: string | null; t: T }) {
  const rows = (s.rows ?? []).filter((r: Any) => t.tx(r.k) || t.tx(r.v));
  if (!rows.length) return null;
  return (
    <section className={`sec${s.tone === 'paper' ? ' sec--paper' : s.tone === 'light' ? ' sec--light' : ''}`}
             id={anchor ?? undefined}>
      <div className="wrap">
        {t.tx(s.title) ? <SectionHead title={s.title} note={s.note} t={t} /> : null}
        <table className="spex">
          <tbody>
            {rows.map((r: Any, n: number) => (
              <tr key={n}>
                <th scope="row">{t.tx(r.k)}</th>
                <td>{t.tx(r.v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- فريق العمل */
function Team({ s, anchor, t }: { s: Any; anchor: string | null; t: T }) {
  const items = (s.items ?? []).filter((i: Any) => t.tx(i.name));
  if (!items.length) return null;
  return (
    <section className="sec" id={anchor ?? undefined}>
      <div className="wrap">
        {t.tx(s.title) ? <SectionHead title={s.title} note={s.note} t={t} /> : null}
        <ul className="crew">
          {items.map((i: Any, n: number) => (
            <li className="crew__i" key={n}>
              {i.img
                ? <img className="crew__img" src={i.img} alt={t.tx(i.name)} loading="lazy" decoding="async" />
                : <span className="crew__img crew__img--none" aria-hidden="true">{t.tx(i.name).trim().charAt(0)}</span>}
              <b>{t.tx(i.name)}</b>
              {t.tx(i.role) ? <small>{t.tx(i.role)}</small> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- ملاحظة بارزة */
function Callout({ s, anchor, ctx }: { s: Any; anchor: string | null; ctx: Ctx }) {
  const { t } = ctx;
  if (!t.tx(s.title) && !t.tx(s.text)) return null;
  return (
    <section className={`sec sec--tight${s.tone === 'paper' ? ' sec--paper' : s.tone === 'light' ? ' sec--light' : ''}`}
             id={anchor ?? undefined}>
      <div className="wrap">
        {/* flag لا note: ‎.note‎ مأخوذ في model.css */}
        <aside className="flag">
          <span className="flag__ico" aria-hidden="true"><Icon name={s.icon || 'info'} /></span>
          <div className="flag__b">
            {t.tx(s.title) ? <b>{t.tx(s.title)}</b> : null}
            {t.tx(s.text) ? <p>{t.tx(s.text)}</p> : null}
            {s.cta?.href ? (
              <a className="tlink" href={t.href(s.cta.href)}>
                <span>{t.tx(s.cta.label)}</span>
                <span className="tlink__arrow" aria-hidden="true"><Icon name="arrow" /></span>
              </a>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ التوزيع */
export function Section({ s, ctx, storyIndex }: { s: { type: string; anchor: string | null; content: Any }; ctx: Ctx; storyIndex: number }) {
  const c = s.content, a = s.anchor, { t } = ctx;
  switch (s.type) {
    case 'jump':     return <JumpSection s={c} auto={ctx.jump ?? []} t={t} />;
    case 'cards':    return <Cards s={c} t={t} />;
    case 'feature':  return <Feature s={c} anchor={a} ctx={ctx} />;
    case 'list':     return <List s={c} t={t} />;
    case 'steps':    return <Steps s={c} anchor={a} t={t} />;
    case 'gallery':  return <Gallery s={c} anchor={a} t={t} />;
    case 'products': return <Products s={c} ctx={ctx} />;
    case 'story':    return <Story s={c} anchor={a} n={storyIndex} t={t} />;
    case 'vmv':      return <Vmv s={c} anchor={a} t={t} />;
    case 'cta':      return <Cta s={c} quoteHref={ctx.quoteHref} t={t} />;
    case 'compare':  return <Compare s={c} anchor={a} t={t} />;
    case 'contact':  return <Contact company={ctx.company} t={t} />;
    case 'faq':      return <Faq s={c} anchor={a} t={t} />;
    case 'stats':    return <Stats s={c} anchor={a} t={t} />;
    case 'quotes':   return <Quotes s={c} anchor={a} t={t} />;
    case 'video':    return <Videos s={c} anchor={a} t={t} />;
    case 'downloads': return <Downloads s={c} anchor={a} t={t} />;
    case 'timeline': return <Timeline s={c} anchor={a} t={t} />;
    case 'specs':    return <Specs s={c} anchor={a} t={t} />;
    case 'team':     return <Team s={c} anchor={a} t={t} />;
    case 'callout':  return <Callout s={c} anchor={a} ctx={ctx} />;
    /* شريط اللوجوهات كان للرئيسية وحدها؛ صار يُضاف لأي صفحة. رسمه واحد في
       HomeSections كي لا يوجد شكلان للشريط نفسه. */
    case 'logostrip': return <Logostrip s={c} brands={ctx.brands} t={t} uid={a ?? 'p'} />;
    default:         return null;
  }
}
