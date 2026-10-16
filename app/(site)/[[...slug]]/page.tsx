/* مسار واحد يخدم كل صفحات الموقع.

   العناوين تبقى كما هي اليوم (aftersales.html) كي لا تنكسر الروابط
   المفهرسة في جوجل، ويُقبل كذلك الشكل بلا امتداد.

   أربعة قوالب: sections لصفحات المحتوى، وonepage للرئيسية، وproduct لصحيفة
   المواصفات، وquote لنموذج عرض السعر. القالب مخزّن مع الصفحة، فإضافة صفحة
   جديدة من الداش بورد تختار قالبها. */
import { Fragment } from 'react';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import {
  getPage, getProducts, getProduct, getRelatedProducts, getBrands, getCompany,
  getPageLabels, getSetting, getSearchIndex, getProductParent, type Product,
} from '@/lib/content';
import { getNav, getFooterColumns, buildNav } from '@/lib/nav';
import { getDict, makeT, pickLang, type Lang, type T } from '@/lib/i18n';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { PageHero, JumpNav, RelatedPages, Section, type Ctx } from '@/components/site/Sections';
import { HomeSection } from '@/components/site/HomeSections';
import { ProductPage, pName } from '@/components/site/Product';
import { Linecard, LinecardJump, CtaBandWide } from '@/components/site/Linecard';
import { QuoteForm } from '@/components/site/QuoteForm';
import { SiteScripts } from '@/components/site/SiteScripts';
import { EditBar, EditSection } from '@/components/site/EditBar';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getPreview } from '@/lib/previewStore';
import { EDITABLE_TEMPLATES } from '@/lib/admin';
import { typeLabel as typeName, SECTION_TYPES } from '@/lib/sectionSchema';
import { withHoles, HERO_FIELDS } from '@/lib/placeholders';
import { themeCss, fontsHref, cleanTheme, cleanDesign, designCss, type Theme } from '@/lib/design';
import { followCards } from '@/lib/follow';
import { getStore } from '@/lib/store';
import { TrackView } from '@/components/site/TrackView';
import { Store, StoreSoon } from '@/components/site/Store';
import { q } from '@/lib/db';
import { getChatSettings } from '@/lib/chat/provider';
import { ChatWidget } from '@/components/site/ChatWidget';

type Params = { slug?: string[] };
type Search = { [k: string]: string | string[] | undefined };

const slugOf = (p?: string[]) => {
  const last = p?.[p.length - 1] ?? '';
  return last.replace(/\.html$/i, '') || 'index';
};
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** رابط نموذج عرض السعر محمّلًا بالخدمة والصفحة التي أتى منها — كما في ux.js. */
const quoteUrl = (slug: string, solution: string | null, lang: Lang, product?: string) => {
  const p = new URLSearchParams();
  if (solution) p.set('solution', solution);
  p.set('source', slug);
  if (product) p.set('product', product);
  p.set('lang', lang);
  return `quote.html?${p}`;
};

export async function generateMetadata(
  { params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }
): Promise<Metadata> {
  const slug = slugOf((await params).slug);
  const sp = await searchParams;
  const lang = pickLang(sp.lang);
  const page = await getPage(slug);
  if (!page) return {};
  const t = makeT(lang, await getDict());
  /* الصفحة نفسها باللغة الأخرى — لمحركات البحث، فتعرض لكل باحث لغته */
  const path = slug === 'index' ? '/' : `/${slug}.html`;
  const pq = page.template === 'product' && one(sp.p) ? `p=${encodeURIComponent(one(sp.p))}&` : '';
  const alternates = {
    canonical: `${path}?${pq}lang=${lang}`,
    languages: { ar: `${path}?${pq}lang=ar`, en: `${path}?${pq}lang=en` },
  };

  /* صفحة المنتج عنوانها ووصفها من المنتج نفسه، كما كان model.js يضبطهما.
     ومسوّدة المنتج (يراها صاحب الموقع وحده) لا تُفهرس احتياطًا. */
  if (page.template === 'product') {
    const p = one(sp.p) ? await getProduct(one(sp.p), Boolean(await currentUser())) : null;
    if (p) {
      const brandName = p.brand_name ?? '';
      return {
        title: pName(p, t) + (brandName === '5A&M' ? ' | 5A&M' : ` — ${brandName} | 5A&M`),
        description: (t.ar ? p.description_ar || p.description_en : p.description_en) ?? undefined,
        robots: p.published ? undefined : { index: false, follow: false },
        alternates,
      };
    }
    /* «المنتج غير موجود» يُرسم في الصفحة نفسها برمز 200، فيُمنع من الفهرسة
       كي لا تظهر في جوجل صفحة فارغة لكل رابط قديم أو خاطئ. */
    return { robots: { index: false, follow: true } };
  }

  /* العنوان والوصف بلغة الصفحة. بالعربية: ترجمة الموقع الأصلي (meta.<الصفحة>.title)،
     ثم العنوان العربي إن كُتب، ثم اسم الصفحة — كانت الصفحات العربية كلها بعنوان إنجليزي. */
  const title = t.ar
    ? t.t(`meta.${slug}.title`, '') || page.title_ar || `${page.crumb_ar || page.crumb_en} — 5A&M`
    : page.title_en || `${page.crumb_en || page.crumb_ar} — 5A&M`;
  const description = (t.ar
    ? t.t(`meta.${slug}.desc`, '') || page.description_ar || page.description_en
    : page.description_en) || undefined;
  return {
    title,
    description,
    alternates,
    robots: sp.preview ? { index: false, follow: false }
      : page.noindex || (page.template === 'store' && !(await getStore()).enabled) ? { index: false, follow: true } : undefined,
    openGraph: page.og_image ? { images: [page.og_image] } : undefined,
  };
}

export default async function Page(
  { params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }
) {
  const slug = slugOf((await params).slug);
  const sp = await searchParams;
  const lang = pickLang(sp.lang);

  /* صاحب الموقع وهو داخل بحسابه يعاين المسوّدات ويرى أزرار التحرير.
     الزائر لا يصله شيء من هذا، والمسوّدة عنده غير موجودة. */
  const editor = await currentUser();
  /* أزرار التحرير لمن يملك صلاحيتها؛ والمعاينة والمسوّدات لكل أدمن داخل */
  const canPages = Boolean(editor && can(editor, 'pages.edit'));

  const page = await getPage(slug, Boolean(editor));
  if (!page) notFound();
  /* إليها يعود شريط التحرير بعد كل زرّ، باللغة نفسها */
  const here = `/${slug === 'index' ? '' : `${slug}.html`}?lang=${lang}`;

  /* داخل المحرّر المرئي: الصفحة تُرسم بما كُتب ولم يُحفظ بعد. المفتاح لا
     يُقرأ إلا لصاحبه وهو داخل بحسابه (lib/previewStore.ts). وتُرسم علامات
     صغيرة قبل كل قسم يعرف بها المحرّر أيّ قسم ضُغط، بدل أزرار التحرير. */
  const preview = editor && one(sp.preview) && EDITABLE_TEMPLATES.includes(page.template)
    ? getPreview(one(sp.preview), editor.id, slug) : null;
  if (preview) {
    /* الحقول الفارغة تُرسم بنصّ مؤقت يُكتب فيه من الصفحة (lib/placeholders.ts) */
    page.hero = withHoles(HERO_FIELDS, preview.hero, lang);
    page.sections = preview.sections.map((s, i) => ({
      ...s, position: i,
      content: SECTION_TYPES[s.type] ? withHoles(SECTION_TYPES[s.type].fields, s.content, lang) : s.content,
    }));
  }
  const Mark = ({ id, hidden }: { id: number | 'hero' | 'nav'; hidden?: boolean }) =>
    <i className={`ux-mark${hidden ? ' is-hidden' : ''}`} data-sec={id} id={`ux-sec-${id}`} aria-hidden="true" />;
  /* تصميم القسم (lib/design.ts): قواعده قبله مباشرةً، ولا شيء إن لم يُصمَّم */
  const Design = ({ id, d }: { id: number | 'hero'; d: any }) => {
    const css = designCss(id, d, Boolean(editor), Boolean(preview));
    return css ? <style data-sd={id}>{css}</style> : null;
  };

  /* كروت تتبع القسم الذي تنقل إليه (lib/follow.ts) — وفي المعاينة كذلك */
  page.sections = await followCards(page.sections, Boolean(editor));

  /* صفحات قديمة تحوّل إلى مكانها الجديد، فتُحفظ الروابط الخارجية */
  if (page.redirect_to) {
    const [to, hash] = page.redirect_to.split('#');
    permanentRedirect(`/${to.replace(/^\//, '')}?lang=${lang}${hash ? '#' + hash : ''}`);
  }

  /* عدّ الزيارة من متصفح الزائر (components/site/TrackView.tsx) — لا للأدمن ولا للمعاينة */
  const trackProduct = page.template === 'product' ? one(sp.p) || null : null;
  const trackPath = trackProduct ? `/model.html?p=${trackProduct}` : slug === 'index' ? '/' : `/${slug}.html`;

  const [dict, savedNav, footer, company, search, savedTheme, chat] = await Promise.all([
    getDict(), getNav(), getFooterColumns(), getCompany(), getSearchIndex(lang), getSetting<Theme>('theme', {}), getChatSettings(),
  ]);
  /* ألوان الموقع وخطوطه: في المعاينة من المحرّر، وإلا المحفوظة. وخطوط Google
     لما اختير منها في الموقع وفي أقسام هذه الصفحة. */
  const theme = preview?.theme ?? savedTheme;
  const siteCss = themeCss(theme);
  const fontLink = fontsHref([
    ...Object.values(cleanTheme(theme)),
    cleanDesign(page.hero?.design).font,
    ...page.sections.map((s) => cleanDesign(s.content?.design).font),
  ].map(String));
  /* في المعاينة: الهيدر من تعديلات المحرّر غير المحفوظة */
  const nav = preview?.nav ? buildNav(preview.nav) : savedNav;
  const t = makeT(lang, dict);

  /* رابط «اطلب عرض سعر» في الهيدر والفوتر يحمل خدمة الصفحة ومصدرها، كما كان
     ux.js يعيد ضبطه بعد الرسم. وعلى صفحة المنتج يحمل الموديل نفسه. */
  const pageQuote = page.template === 'product' && one(sp.p)
    ? quoteUrl('model', null, lang, one(sp.p))
    : quoteUrl(slug, page.quote_solution, lang);

  /* منتج مسوّدة يعاينه صاحب الموقع: يُجلب قبل الرسم كي يعلن الشريط أنه مسوّدة
     ويفتح محرّر المنتج لا محرّر صفحة القالب. */
  const product = page.template === 'product' && one(sp.p)
    ? await getProduct(one(sp.p), Boolean(editor))
    : null;

  const homeHero = page.template === 'onepage' && page.sections[0]?.type === 'heroSlider';

  const shell = (body: React.ReactNode) => (
    <>
      {fontLink ? <link rel="stylesheet" href={fontLink} /> : null}
      {siteCss ? <style data-theme="">{siteCss}</style> : null}
      <Header nav={nav} company={company} t={t} page={`${slug}.html`} quoteHref={pageQuote}
              homeHero={homeHero}
              hideAdminLink={slug === 'index' && Boolean(editor)}
              before={preview ? <Mark id="nav" /> : null} />
      <main id="main">{body}</main>
      {/* المعاينة تُعاد مع كل تعديل: حركات الظهور كانت ستعيد وميضها كل مرة */}
      {/* ولا انتقال بين الصفحات: الإطار المخفي في المحرّر يُحمَّل من جديد، فكان
          المتصفح يبدأ انتقالًا لا يقدر على تصويره ويلغيه برسالة خطأ */}
      {preview ? <style>{'@view-transition{navigation:none}*,*::before,*::after{transition:none!important;animation:none!important}'}</style> : null}
      <Footer columns={footer} company={company} t={t} />
      {/* المحادثة في كل صفحة (lib/chat) — لا في معاينة المحرّر */}
      {chat.enabled && !preview ? <ChatWidget lang={lang} greeting={chat.greeting[lang] || ''} /> : null}
      {!editor && !preview ? <TrackView path={trackPath} lang={lang} product={trackProduct} /> : null}
      <SiteScripts t={t} page={slug} quoteHref={pageQuote} phoneIntl={company.phoneIntl}
                   search={search} edit={Boolean(editor)} />
      {editor && !preview && (product ? can(editor, 'products.edit') : canPages) ? (
        product ? (
          <EditBar
            href={`/admin/products/${product.slug}`}
            label={pName(product, t)}
            draft={!product.published}
          />
        ) : (
          <EditBar
            href={EDITABLE_TEMPLATES.includes(page.template) ? `/admin/edit/${slug}` : `/admin/pages/${slug}`}
            label={t.tx({ en: page.crumb_en, ar: page.crumb_ar }) || slug}
            draft={!page.published}
          />
        )
      ) : null}
    </>
  );

  /* ---------------------------------------------------------- الرئيسية */
  if (page.template === 'onepage') {
    const brands = await getBrands();
    return shell(
      page.sections.map((s, i) => (
        <Fragment key={s.id}>
          <Design id={s.id} d={s.content?.design} />
          {preview ? <Mark id={s.id} hidden={!s.published} /> : canPages ? (
            <EditSection slug={slug} id={s.id} index={i} count={page.sections.length}
                         hidden={!s.published} back={here}
                         label={t.tx(s.content?.title) || typeName(s.type)} />
          ) : null}
          <HomeSection s={s} brands={brands} t={t} underHeader={homeHero && i === 0} />
        </Fragment>
      ))
    );
  }

  /* ------------------------------------------------------ صفحة المنتج */
  if (page.template === 'product') {
    const p = product;
    if (!p) return shell(<ProductNotFound t={t} />);
    const [brands, related, categories, parent] = await Promise.all([
      getBrands(), getRelatedProducts(p), getSetting<any[]>('categories', []),
      getProductParent(p.ref),
    ]);
    return shell(
      <ProductPage
        p={p}
        brand={p.brand_slug ? brands[p.brand_slug] ?? null : null}
        related={related}
        sections={page.sections}
        categories={categories}
        quoteHref={quoteUrl('model', p.category, lang, p.slug)}
        parent={parent}
        t={t}
      />
    );
  }

  /* ----------------------------------------------- كتالوج المعدات */
  if (page.template === 'equipment') {
    const [productList, brands, empty] = await Promise.all([
      getProducts(), getBrands(), getSetting<any>('equipmentEmpty', {}),
    ]);
    return shell(
      <>
        <PageHero
          hero={page.hero}
          crumb={{ en: page.crumb_en, ar: page.crumb_ar }}
          quoteHref={null}
          t={t}
        />
        {page.sections.filter((s) => s.type === 'linecardJump').map((s) => (
          <LinecardJump s={s.content} empty={empty} t={t} key={s.id} />
        ))}
        {/* الأقسام داخل #ranges كما في الموقع القديم: هو الحاوية التي كان
            equipment.js يعيد رسمها عند كل بحث. */}
        <div id="ranges">
          {page.sections.filter((s) => s.type === 'linecard').map((s) => (
            <Linecard s={s.content} anchor={s.anchor} products={productList} brands={brands} t={t} key={s.id} />
          ))}
        </div>
        {page.sections.filter((s) => s.type === 'ctaband').map((s) => (
          <CtaBandWide s={s.content} quoteHref={pageQuote} t={t} key={s.id} />
        ))}
      </>
    );
  }

  /* ------------------------------------------------------- المتجر
     مقفول: الزائر يُحوَّل للرئيسية أو يرى «قريبًا»، والأدمن يعاينه بشريط ينبّهه.
     كل بياناته باقية، فإعادة فتحه ترجعه كما كان (lib/store.ts). */
  if (page.template === 'store') {
    const store = await getStore();
    const hero = <PageHero hero={page.hero} crumb={{ en: page.crumb_en, ar: page.crumb_ar }} quoteHref={null} t={t} />;
    if (!store.enabled && !editor) {
      if (store.closed === 'home') redirect(`/?lang=${lang}`);
      return shell(<>{hero}<StoreSoon t={t} quoteHref={pageQuote} /></>);
    }
    const list = (await getProducts()).filter((p) => !p.store_hidden);
    return shell(
      <>
        {!store.enabled ? (
          <div className="store__closed" role="note">
            المتجر مقفول للزوار — تراه أنت لأنك داخل بحساب الأدمن. افتحه من «المتجر» في لوحة التحكم.
          </div>
        ) : null}
        {hero}
        <Store products={list} t={t} quoteHref={pageQuote} />
      </>
    );
  }

  /* ------------------------------------------------- نموذج عرض السعر */
  if (page.template === 'quote') {
    const products = await getProducts();
    const form = page.sections.find((s) => s.type === 'quoteForm');
    return shell(
      <>
        {/* الهيرو بلا أزرار: ux.js كان يضيفها داخل #pageRoot فقط، وصفحة
            النموذج ليست منه، فبقيت بمسار تنقّل وعنوان ونصّ. */}
        <PageHero
          hero={page.hero}
          crumb={{ en: page.crumb_en, ar: page.crumb_ar }}
          quoteHref={null}
          t={t}
        />
        {form ? (
          <QuoteForm
            s={form.content}
            products={products}
            company={company}
            t={t}
            preset={{
              solution: one(sp.solution) || (products.find((x) => x.slug === one(sp.product))?.category ?? ''),
              product: one(sp.product),
              source: one(sp.source),
            }}
          />
        ) : null}
      </>
    );
  }

  /* ------------------------------------------------- صفحات المحتوى */
  const [productList, brands, labels] = await Promise.all([
    getProducts(), getBrands(), getPageLabels(),
  ]);
  const products: Record<string, Product> = Object.fromEntries(productList.map((p) => [p.ref, p]));
  const quoteHref = quoteUrl(slug, page.quote_solution, lang);
  const ctx: Ctx = { t, brands, products, quoteHref, company };

  /* شريط المحتويات: كل سيكشن له عنوان ظاهر. المعرّف يُستكمل عند غيابه
     بالطريقة نفسها التي كان ux.js يتبعها (section-1، section-2 …). */
  const jump = page.sections
    .map((s, i) => ({
      id: s.anchor || `section-${i + 1}`,
      label: t.tx(s.content?.title) || '',
      has: Boolean(s.content?.title) && s.type !== 'contact',
    }))
    .filter((x) => x.has && x.label);

  const related = (page.related ?? [])
    .filter((r) => labels[r])
    .map((r) => ({ href: `${r}.html`, label: t.tx(labels[r]) }));

  const parent = page.parent_slug && labels[page.parent_slug]
    ? { href: `${page.parent_slug}.html`, label: labels[page.parent_slug] }
    : null;

  /* القسم الأخير إن كان نداءً للتواصل يسبقه «وصول مباشر للخدمات» — ترتيب ux.js */
  const ctaAt = page.sections.findIndex((s) => s.type === 'cta');
  let storyN = 0;

  return shell(
    <div id="pageRoot" data-pg={slug}>
      <Design id="hero" d={page.hero?.design} />
      {preview ? <Mark id="hero" /> : null}
      <PageHero
        hero={page.hero}
        crumb={{ en: page.crumb_en, ar: page.crumb_ar }}
        parent={parent}
        quoteHref={slug === 'contact' ? null : quoteHref}
        phoneIntl={company.phoneIntl}
        t={t}
      />
      <JumpNav items={jump} t={t} />
      {page.sections.map((s, i) => (
        <Fragment key={s.id}>
          {ctaAt === i && related.length ? <RelatedPages items={related} t={t} /> : null}
          <Design id={s.id} d={s.content?.design} />
          {preview ? <Mark id={s.id} hidden={!s.published} /> : canPages ? (
            <EditSection slug={slug} id={s.id} index={i} count={page.sections.length}
                         hidden={!s.published} back={here}
                         label={t.tx(s.content?.title) || typeName(s.type)} />
          ) : null}
          <Section
            s={{ ...s, anchor: s.anchor || `section-${i + 1}` }}
            ctx={ctx}
            storyIndex={s.type === 'story' ? ++storyN : 0}
          />
        </Fragment>
      ))}
      {ctaAt < 0 && related.length ? <RelatedPages items={related} t={t} /> : null}
    </div>
  );
}

/** موديل غير موجود في الكتالوج — النص نفسه الذي كان في model.js. */
function ProductNotFound({ t }: { t: T }) {
  return (
    <section className="sec sec--tight" style={{ paddingTop: 26 }}>
      <div className="wrap">
        <nav className="crumbs crumbs--light" id="crumbs" aria-label="Breadcrumb">
          <a href={t.href('index.html')}>{t.t('nav.home', 'Home')}</a><span>/</span>
          <a href={t.href('equipment.html')}>{t.t('nav.equipment', 'Equipment')}</a>
        </nav>
        <div id="pdp">
          <div className="empty">
            <b>{t.t('pdp.notFoundH', 'That product isn’t in the catalogue')}</b>
            <p className="card__desc">
              {t.t('pdp.notFoundP', 'It may have been renamed, or the link may be incomplete.')}
            </p>
            <a className="btn mt-16" href={t.href('equipment.html')}>
              {t.t('cta.browseAll', 'See the equipment we supply')}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
