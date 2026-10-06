/* =============================================================================
   صفحة المنتج — منقولة عن model.html و assets/js/model.js.

   هذه صحيفة مواصفات لا صفحة بيع: الصورة مرجعية واحدة، والإجراء «اسأل عن هذا
   الموديل» لا شراء. المعرض والفيديو يظهران للموديلات التي لها صور فعلًا.

   ما كان في model.js ولم يُنقل: دالتا specRows و companies — كانتا معرَّفتين
   ولا تُستدعيان، فلم يكن يظهر منهما شيء. بيانات الشركات محفوظة في إعداد
   brandRoles كي لا تضيع.
============================================================================= */
import type { T } from '@/lib/i18n';
import type { Brand, Product } from '@/lib/content';
import { Icon } from './Icon';
import { Pic } from './Pic';
import { ico } from '@/lib/icons';
import { ytId, ytPoster } from '@/lib/youtube';

type Any = Record<string, any>;

/* اسم المنتج ووصفه: العربية إن وُجدت، وإلا الإنجليزية كما هي اليوم. */
export const pName = (p: Product, t: T) => (t.ar ? p.name_ar || t.phrase(p.name_en) : p.name_en) ?? '';
const pType = (p: Product, t: T) => (t.ar ? p.type_ar || t.phrase(p.type_en) : p.type_en) ?? '';
const pDesc = (p: Product, t: T) => (t.ar ? p.description_ar || t.phrase(p.description_en) : p.description_en) ?? '';

/* --------------------------------------------------------------- مسار التنقل
   إن كانت هناك صفحة تعرض هذا المنتج، فهي طريقه: الرئيسية / تلك الصفحة /
   المنتج. وإلا بقي المسار على كتالوج المعدات كما كان. */
function Crumbs({ p, t, categories, parent }: { p: Product; t: T; categories: Any[]; parent?: Any | null }) {
  if (parent) {
    return (
      <nav className="crumbs crumbs--light" id="crumbs" aria-label="Breadcrumb">
        <a href={t.href('index.html')}>{t.t('nav.home', 'Home')}</a><span>/</span>
        <a href={t.href(`${parent.slug}.html`)}>
          {t.tx({ en: parent.crumb_en, ar: parent.crumb_ar })}
        </a>
        <span>/</span><span className="now">{pName(p, t)}</span>
      </nav>
    );
  }
  const cat = categories.find((c) => c.id === p.category);
  const catName = t.phrase(cat?.name ?? p.category);
  const sub = t.t(`sub.${p.subcategory}`, p.subcategory ?? '');
  return (
    <nav className="crumbs crumbs--light" id="crumbs" aria-label="Breadcrumb">
      <a href={t.href('index.html')}>{t.t('nav.home', 'Home')}</a><span>/</span>
      <a href={t.href('equipment.html')}>{t.t('nav.equipment', 'Equipment')}</a><span>/</span>
      <a href={t.href(`equipment.html?category=${p.category}`)}>{catName}</a><span>/</span>
      <a href={t.href(`equipment.html?category=${p.category}&sub=${encodeURIComponent(p.subcategory ?? '')}`)}>{sub}</a>
      <span>/</span><span className="now">{pName(p, t)}</span>
    </nav>
  );
}

/* ---------------------------------------------------------------- الصورة */
function Gallery({ p, brand, t }: { p: Product; brand: Brand | null; t: T }) {
  const imgs = [...new Set([p.hero_image, ...(p.data.gallery ?? [])])].filter(Boolean) as string[];
  if (!imgs.length) {
    return (
      <div className="pdp__gallery">
        <figure className="pdp__main pdp__main--plate" style={{ margin: 0 }}>
          {brand?.logo ? <img src={brand.logo} alt={brand.name} /> : null}
          <b>{pName(p, t)}</b>
          <small>{t.t('pdp.photoPending', 'Product photography to be supplied')}</small>
        </figure>
        <p className="hint mt-8">
          {t.t('pdp.askPhotos', 'Ask us for photographs and the manufacturer datasheet for this model.')}
        </p>
      </div>
    );
  }
  /* زرّ التكبير وشريط الصور المصغّرة كان ux.js يضيفهما بعد التحميل، فصارا
     مرسومين هنا: يظهران فورًا ويعملان بلا انتظار سكربت. */
  return (
    <div className="pdp__gallery" data-zoom>
      <figure className="pdp__main" style={{ margin: 0 }}>
        <Pic src={imgs[0]} alt={pName(p, t)} priority />
        <button type="button" className="ux-zoom">
          <Icon name="search" /> {t.ar ? 'تكبير الصورة' : 'Enlarge photo'}
        </button>
      </figure>
      {imgs.length > 1 ? (
        <div className="ux-thumbnails" aria-label={t.ar ? 'صور المنتج' : 'Product photos'}>
          {imgs.map((src, i) => (
            <button type="button" aria-pressed={i === 0} key={src}
                    aria-label={`${t.ar ? 'عرض الصورة' : 'View photo'} ${i + 1}`}>
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
      <p className="hint mt-8">
        {t.t('pdp.imgNote', 'Images are representative. Final configuration and finish are confirmed at order.')}
      </p>
    </div>
  );
}

/* ------------------------------------------------------ الملفات والبروشورات */
function Downloads({ p, t }: { p: Product; t: T }) {
  return (
    <div className="dl">
      {(p.data.downloads ?? []).map((d: Any, i: number) =>
        d.href ? (
          <a href={d.href} download rel="noopener" key={i}>
            <Icon name="doc" />{t.phrase(d.label)}
          </a>
        ) : (
          <span key={i}>
            <Icon name="doc" />{t.phrase(d.label)} — {t.t('pdp.onRequest', 'available on request')}
          </span>
        )
      )}
    </div>
  );
}

/* ------------------------------------------------- المعرض ومقاطع الفيديو
   الترتيب نفسه: إطار كبير ثم بلاطات بجانبه، والبقية تُطوى في عدد على آخر
   بلاطة. حساب الصفوف منقول كما هو كي لا ينكسر الصف الأخير. */
function Media({ p, t }: { p: Product; t: T }) {
  const shots = (p.data.gallery ?? []).filter(Boolean);
  const vids = (p.data.videos ?? []).filter(Boolean);
  if (shots.length < 2 && !vids.length) return null;

  const COLS = 4, LEAD = COLS;
  const big = shots.length >= 6;
  const fit = big ? Math.max(0, Math.floor((shots.length - 1 + LEAD) / COLS) * COLS - LEAD) : shots.length - 1;
  const shown = shots.slice(0, fit + 1);
  const extra = shots.length - shown.length;
  const vcap = (v: Any) => (t.ar ? v.ar : v.en) || pName(p, t);

  const CHEV = (d: string) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
  );

  return (
    <section className="sec sec--paper" id="mediaSec" data-gallery-host>
      <div className="wrap">
        <div className="shead mb-24">
          <span className="shead__rule" aria-hidden="true" />
          <div>
            <p className="shead__eyebrow">{t.t('pdp.mediaEyebrow', 'Gallery')}</p>
            <h2 className="shead__title">{t.t('pdp.mediaTitle', 'The machine in the field')}</h2>
          </div>
        </div>

        {/* data-shots تحمل المجموعة كاملة كي يفتحها العارض وإن لم تُعرض بلاطة
            لكل صورة — سمة لا عنصر، فلا تُضاف عقدة إلى الشجرة. */}
        {shots.length < 2 ? null : (
          <div className={`mshots${big ? '' : ' mshots--even'}`} data-gallery
               data-shots={JSON.stringify(shots)}>
            {shown.map((src: string, i: number) => {
              const last = extra > 0 && i === shown.length - 1;
              return (
                <button className={`mshot${big && i === 0 ? ' mshot--lead' : ''}`} type="button" data-i={i} key={i}
                        aria-label={last ? t.t('pdp.morePhotos', 'See all photos')
                                         : `${t.t('pdp.openPhoto', 'Open photo')} ${i + 1}`}>
                  <img src={src} alt={pName(p, t)} loading={i < 3 ? 'eager' : 'lazy'} decoding="async" />
                  <span className="mshot__veil" aria-hidden="true" />
                  {last ? (
                    <span className="mshot__more" aria-hidden="true">
                      {`+${extra}`}<small>{t.t('pdp.morePhotosShort', 'more')}</small>
                    </span>
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
        )}

        {!vids.length ? null : (
          <div className="vfilm" data-vfilm>
            <div className="vfilm__head">
              <div>
                <p className="vfilm__eyebrow">{t.t('pdp.mediaEyebrow2', 'Video')}</p>
                <h3 className="vfilm__title">{t.t('pdp.video', 'Watch it working')}</h3>
              </div>
              <span className="vfilm__count"><b className="vfilm__at">1</b> / {vids.length}</span>
            </div>

            <div className="vslider">
              <div className="vslider__view">
                <div className="vslider__track" style={{ ['--n' as any]: vids.length }}>
                  {vids.map((v: Any, i: number) => (
                    <figure className="vslide" data-i={i} {...(i ? { 'aria-hidden': true } : {})} key={i}>
                      {ytId(v.yt) ? (
                        <button className="vslide__hit" type="button" data-yt={ytId(v.yt)}
                                {...(i ? { tabIndex: -1 } : {})}
                                aria-label={`${t.t('pdp.playVideo', 'Play video')}: ${vcap(v)}`}>
                          {/* بلا غلاف مرفوع: غلاف يوتيوب نفسه بدل مربّع فارغ */}
                          <img src={v.poster || ytPoster(ytId(v.yt))} alt="" loading={i < 2 ? 'eager' : 'lazy'} decoding="async" />
                          <span className="vslide__shade" aria-hidden="true" />
                          <span className="vslide__play" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                          </span>
                          <span className="vslide__brand" aria-hidden="true">YouTube</span>
                        </button>
                      ) : (
                        <>
                          <video className="vslide__player" controls preload="none" playsInline
                                 poster={v.poster || undefined} aria-label={vcap(v)}>
                            <source src={v.src} type="video/mp4" />
                          </video>
                          <button className="vslide__toggle" type="button" {...(i ? { tabIndex: -1 } : {})}
                                  aria-label={`${t.t('pdp.playVideo', 'Play video')}: ${vcap(v)}`}>
                            <svg className="vslide__ico vslide__ico--play" viewBox="0 0 24 24"
                                 fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                            <svg className="vslide__ico vslide__ico--pause" viewBox="0 0 24 24"
                                 fill="currentColor" aria-hidden="true"><path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z" /></svg>
                          </button>
                        </>
                      )}
                    </figure>
                  ))}
                </div>
              </div>

              {vids.length > 1 ? (
                <>
                  <button className="vslider__nav vslider__nav--prev" type="button"
                          aria-label={t.t('a11y.prev', 'Previous')}>{CHEV('m15 6-6 6 6 6')}</button>
                  <button className="vslider__nav vslider__nav--next" type="button"
                          aria-label={t.t('a11y.next', 'Next')}>{CHEV('m9 6 6 6-6 6')}</button>
                </>
              ) : null}
            </div>

            <div className="vslider__bar">
              <p className="vslider__caption">
                {vids.map((v: Any, i: number) => (
                  <span className={`vslider__cap${i ? '' : ' is-on'}`} data-i={i} key={i}>
                    {vcap(v)}{v.len ? <i className="vslider__len">{v.len}</i> : null}
                  </span>
                ))}
              </p>
              {vids.length > 1 ? (
                <div className="vslider__dots" role="tablist">
                  {vids.map((v: Any, i: number) => (
                    <button className={`vslider__dot${i ? '' : ' is-on'}`} type="button" role="tab"
                            data-i={i} aria-label={vcap(v)} aria-selected={i === 0} key={i} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* صورة كارت المنتج — نسخة من figure في site.js: صورة إن وُجدت، وإلا لوحة
   تقنية باسم الماركة بدل صورة لا علاقة لها بالموديل. */
function Figure({ p, t }: { p: Product; t: T }) {
  if (p.hero_image) {
    return <div className="card__fig"><Pic src={p.hero_image} alt={pName(p, t)} /></div>;
  }
  return (
    <div className="card__fig card__fig--plate">
      {p.brand_logo
        ? <img className="plate__logo" src={p.brand_logo} alt={p.brand_name ?? ''} />
        : <span className="plate__word">{p.brand_name ?? ''}</span>}
      <span className="plate__name">{pName(p, t)}</span>
    </div>
  );
}

/* ---------------------------------------------- موديلات أخرى في المدى نفسه */
function Related({ list, head, t }: { list: Product[]; head: Any; t: T }) {
  if (!list.length) return null;
  return (
    <section className="sec sec--paper" id="relatedSec">
      <div className="wrap">
        <div className="shead mb-24">
          <span className="shead__rule" aria-hidden="true" />
          <div>
            <p className="shead__eyebrow">{t.tx(head.eyebrow)}</p>
            <h2 className="shead__title">{t.tx(head.title)}</h2>
          </div>
        </div>
        <div id="related">
          <div className="relcards">
            {list.map((r) => (
              <a className="relcard" href={t.href(`model.html?p=${encodeURIComponent(r.slug)}`)} key={r.ref}>
                <Figure p={r} t={t} />
                <span className="relcard__body">
                  <span className="relcard__brand">{r.brand_name ?? ''}</span>
                  <b className="relcard__name">{pName(r, t)}</b>
                  <span className="relcard__type">{t.t(`sub.${r.subcategory}`, r.subcategory ?? '')}</span>
                  <span className="relcard__foot">
                    <span className="relcard__cta">{t.t('cta.specifications', 'Specifications')}</span>
                    <span className="relcard__go" aria-hidden="true"><Icon name="arrow" /></span>
                  </span>
                </span>
                <span className="sr">{`${t.t('eq.specsFor', 'Specifications for')} ${pName(r, t)}`}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------- شريط الدعوة أسفل الصفحة */
function CtaBand({ s, quoteHref, t }: { s: Any; quoteHref: string; t: T }) {
  return (
    <section className="ctaband">
      <Pic src={s.img} alt="" />
      <div className="wrap ctaband__in">
        <div>
          <h2>{t.tx(s.title)}<br /><span className="accent">{t.tx(s.accent)}</span></h2>
          <p>{t.tx(s.text)}</p>
          {/* السهم داخل عنصر كما في model.html. في النسخة العربية كانت الترجمة
              تمحوه لأنها تُكتب بـ textContent، وهنا يظهر بلغتيه. */}
          <a className="btn" id="quoteCta" href={quoteHref}>
            {t.tx(s.cta)} <span><Icon name="arrow" /></span>
          </a>
        </div>
        <div className="figs">
          {(s.figs ?? []).map((f: Any, i: number) => (
            <div className="fig" key={i}>
              <i dangerouslySetInnerHTML={{ __html: (ico as Record<string, string>)[f.icon] ?? '' }} />
              <b>{t.tx(f.title)}</b>
              <span>{t.tx(f.text)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- الصفحة كاملة */
export function ProductPage({
  p, brand, related, sections, categories, quoteHref, parent, t,
}: {
  p: Product; brand: Brand | null; related: Product[];
  sections: { type: string; content: Any }[];
  categories: Any[]; quoteHref: string; parent?: Any | null; t: T;
}) {
  const relHead = sections.find((s) => s.type === 'productRelated')?.content ?? {};
  const band = sections.find((s) => s.type === 'ctaband')?.content;
  const meta = p.data.meta ?? [];
  return (
    <>
      <section className="sec sec--tight" style={{ paddingTop: 26 }}>
        <div className="wrap">
          <Crumbs p={p} t={t} categories={categories} parent={parent} />
          <div id="pdp">
            <div className="pdp">
              <Gallery p={p} brand={brand} t={t} />
              <div className="pdp__info">
                <div className="pdp__brandrow">
                  {brand?.logo ? <img src={brand.logo} alt={brand.name} />
                               : <span className="card__brand">{brand?.name ?? ''}</span>}
                  <span className="chip">{t.t(`sub.${p.subcategory}`, p.subcategory ?? '')}</span>
                </div>
                <h1>{pName(p, t)}</h1>
                <p className="card__type mt-8">{pType(p, t)}</p>
                <p className="pdp__over">{pDesc(p, t)}</p>
                <div className="card__meta mt-16">
                  {meta.map((m) => (
                    <span className="chip" key={m.k}>
                      <b style={{ color: 'var(--ink)' }}>{`${t.phrase(m.k)}:`}</b> {t.phrase(m.v)}
                    </span>
                  ))}
                </div>
                <div className="hero__cta" style={{ marginTop: 26 }}>
                  <a className="btn" href={quoteHref}>
                    {t.t('cta.askModel', 'Ask us about this model')} <Icon name="arrow" />
                  </a>
                  <a className="btn btn--ghost" href={t.href(`equipment.html#${p.category}`)}>
                    {t.t('cta.backToRange', 'Back to the range')} <Icon name="arrow" />
                  </a>
                </div>
                <h2 className="blockhead">{t.t('pdp.downloads', 'Downloads & resources')}</h2>
                <Downloads p={p} t={t} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Media p={p} t={t} />
      <Related list={related} head={relHead} t={t} />
      {band ? <CtaBand s={band} quoteHref={quoteHref} t={t} /> : null}
    </>
  );
}
