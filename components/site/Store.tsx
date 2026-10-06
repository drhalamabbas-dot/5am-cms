/* =============================================================================
   صفحة المتجر: كل المنتجات وقطع الغيار في صفحة واحدة (lib/store.ts).

   القائمة كلها تُرسم من السيرفر فتظهر بلا جافاسكريبت وتفهرسها محركات البحث،
   والبحث والفلاتر والترتيب وسلة «طلب عرض السعر» يربطها StoreBehaviour في
   المتصفح. النصوص من الترجمة (store.*) فتُعدَّل من «نصوص الأزرار والترجمة».
============================================================================= */
import type { Product } from '@/lib/content';
import type { T } from '@/lib/i18n';
import { Pic } from './Pic';
import { Icon } from './Icon';
import { StoreBehaviour } from './StoreBehaviour';

const CATS = ['power', 'environmental', 'parts'] as const;
const CAT_EN: Record<string, string> = { power: 'Power generation', environmental: 'Environmental', parts: 'Spare parts' };

export const STORE_TEXT: Record<string, [string, string]> = {
  'store.search': ['Search by name, part number or brand', 'ابحث بالاسم أو رقم القطعة أو الماركة'],
  'store.all': ['All', 'الكل'],
  'store.cat.power': ['Power generation', 'توليد الطاقة'],
  'store.cat.environmental': ['Environmental', 'المعدات البيئية'],
  'store.cat.parts': ['Spare parts', 'قطع الغيار'],
  'store.allBrands': ['All brands', 'كل الماركات'],
  'store.allTypes': ['All types', 'كل الأنواع'],
  'store.sort.default': ['Featured', 'المقترح'],
  'store.sort.name': ['Name A–Z', 'الاسم'],
  'store.sort.brand': ['Brand', 'الماركة'],
  'store.count': ['{n} items', '{n} منتج'],
  'store.none': ['No products match your search.', 'لا منتجات تطابق بحثك.'],
  'store.reset': ['Clear filters', 'امسح الفلاتر'],
  'store.details': ['Details', 'التفاصيل'],
  'store.add': ['Add to quote', 'أضف لطلب السعر'],
  'store.added': ['In your quote', 'في طلبك'],
  'store.pn': ['P/N', 'رقم القطعة'],
  'store.cart': ['Quote request', 'طلب عرض السعر'],
  'store.cart.empty': ['Your quote request is empty. Add products with “Add to quote”.', 'طلبك فارغ. أضف منتجات بزر «أضف لطلب السعر».'],
  'store.qty': ['Qty', 'الكمية'],
  'store.remove': ['Remove', 'احذف'],
  'store.form.title': ['Your details', 'بياناتك'],
  'store.form.name': ['Name', 'الاسم'],
  'store.form.phone': ['Mobile', 'الموبايل'],
  'store.form.email': ['Email', 'البريد الإلكتروني'],
  'store.form.company': ['Company', 'الشركة'],
  'store.form.city': ['City', 'المدينة'],
  'store.form.message': ['Notes', 'ملاحظات'],
  'store.form.send': ['Send quote request', 'أرسل طلب عرض السعر'],
  'store.form.sending': ['Sending…', 'جارٍ الإرسال…'],
  'store.form.ok': ['Thank you — we received your request and our sales team will contact you shortly.', 'شكرًا — وصلنا طلبك وسيتواصل معك فريق المبيعات قريبًا.'],
  'store.form.err': ['Please enter your name and a valid mobile number.', 'اكتب اسمك ورقم موبايل صحيح.'],
  'store.form.fail': ['Could not send right now. Please try again or call us.', 'تعذّر الإرسال الآن. حاول مرة أخرى أو اتصل بنا.'],
  'store.close': ['Close', 'إغلاق'],
  'store.form.consent': ['By sending, you agree that 5A&M keeps your details to contact you about this request. Ask us any time to delete them.',
    'بإرسال الطلب توافق على أن تحتفظ 5A&M ببياناتك للتواصل معك بخصوص طلبك، وتقدر تطلب مسحها في أي وقت.'],
  'store.soon.title': ['The store is coming soon', 'المتجر قريبًا'],
  'store.soon.text': ['Meanwhile, request a quote and our team will help you.', 'إلى أن يفتح، اطلب عرض سعر وسيساعدك فريقنا.'],
};

export function Store({ products, t, quoteHref }: { products: Product[]; t: T; quoteHref: string }) {
  const L = (k: string) => t.t(k, STORE_TEXT[k]?.[0] ?? k);
  const name = (p: Product) => (t.ar ? p.name_ar || t.phrase(p.name_en) : p.name_en) ?? p.ref;
  const kind = (p: Product) => (t.ar ? p.type_ar || t.phrase(p.type_en) : p.type_en) || t.t(`sub.${p.subcategory}`, p.subcategory ?? '');
  const brands = [...new Map(products.filter((p) => p.brand_slug).map((p) => [p.brand_slug!, p.brand_name ?? p.brand_slug!])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const subs = [...new Set(products.map((p) => p.subcategory).filter(Boolean) as string[])]
    .map((s) => [s, t.t(`sub.${s}`, s)] as const).sort((a, b) => a[1].localeCompare(b[1]));
  const cats = CATS.filter((c) => products.some((p) => p.category === c));
  const find = (p: Product) => [p.name_en, p.name_ar, p.type_en, p.type_ar, p.brand_name, p.sku, p.subcategory,
    t.t(`sub.${p.subcategory}`, ''), p.description_en, p.description_ar].filter(Boolean).join(' ').toLowerCase();

  return (
    <section className="sec sec--tight store" id="store">
      <div className="wrap">
        <div className="store__bar" role="search">
          <label className="store__search">
            <Icon name="search" />
            <span className="sr">{L('store.search')}</span>
            <input type="search" id="storeQ" placeholder={L('store.search')} autoComplete="off" />
          </label>
          <div className="store__cats" role="group" aria-label={L('store.all')}>
            <button type="button" className="store__chip" data-cat="" aria-pressed="true">{L('store.all')}</button>
            {cats.map((c) => (
              <button type="button" className="store__chip" data-cat={c} aria-pressed="false" key={c}>
                {t.t(`store.cat.${c}`, CAT_EN[c])}
              </button>
            ))}
          </div>
          <div className="store__selects">
            {brands.length > 1 ? (
              <select id="storeBrand" aria-label={L('store.allBrands')} defaultValue="">
                <option value="">{L('store.allBrands')}</option>
                {brands.map(([slug, n]) => <option value={slug} key={slug}>{n}</option>)}
              </select>
            ) : null}
            {subs.length > 1 ? (
              <select id="storeSub" aria-label={L('store.allTypes')} defaultValue="">
                <option value="">{L('store.allTypes')}</option>
                {subs.map(([s, n]) => <option value={s} key={s}>{n}</option>)}
              </select>
            ) : null}
            <select id="storeSort" aria-label={L('store.sort.default')} defaultValue="">
              <option value="">{L('store.sort.default')}</option>
              <option value="name">{L('store.sort.name')}</option>
              <option value="brand">{L('store.sort.brand')}</option>
            </select>
          </div>
        </div>
        <p className="store__count" id="storeCount" aria-live="polite">{L('store.count').replace('{n}', String(products.length))}</p>

        <ul className="store__grid" id="storeGrid">
          {products.map((p, i) => (
            <li className="scard" key={p.ref} data-ref={p.ref} data-cat={p.category ?? ''} data-brand={p.brand_slug ?? ''}
                data-sub={p.subcategory ?? ''} data-find={find(p)} data-name={name(p)} data-bname={p.brand_name ?? ''} data-pos={i}>
              <a className="scard__fig" href={t.href(`model.html?p=${encodeURIComponent(p.slug)}`)} tabIndex={-1} aria-hidden="true">
                {p.hero_image ? <Pic src={p.hero_image} alt="" />
                  : <span className="scard__plate">{p.brand_logo ? <img src={p.brand_logo} alt="" /> : <b>{p.brand_name ?? ''}</b>}</span>}
              </a>
              <div className="scard__body">
                <span className="scard__brand">{p.brand_name ?? ''}</span>
                <h3 className="scard__name"><a href={t.href(`model.html?p=${encodeURIComponent(p.slug)}`)}>{name(p)}</a></h3>
                {kind(p) ? <span className="scard__type">{kind(p)}</span> : null}
                {p.sku ? <span className="scard__pn">{L('store.pn')}: <bdi dir="ltr">{p.sku}</bdi></span> : null}
                <div className="scard__actions">
                  <a className="btn btn--ghost btn--sm" href={t.href(`model.html?p=${encodeURIComponent(p.slug)}`)}>{L('store.details')}</a>
                  <button type="button" className="btn btn--sm scard__add" data-add={p.ref} data-name={name(p)}
                          data-img={p.hero_image ?? ''} data-pn={p.sku ?? ''} hidden>
                    {L('store.add')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="store__empty" id="storeEmpty" hidden>
          <p>{L('store.none')}</p>
          <button type="button" className="btn btn--ghost btn--sm" id="storeReset">{L('store.reset')}</button>
          <a className="btn btn--sm" href={quoteHref}>{t.t('cta.requestQuote', 'Request a quote')}</a>
        </div>
      </div>

      <StoreBehaviour lang={t.lang} text={Object.fromEntries(Object.keys(STORE_TEXT).map((k) => [k, L(k)]))} />
    </section>
  );
}

/** المتجر مقفول والإعداد «قريبًا»: رسالة قصيرة وطريق لعرض السعر */
export function StoreSoon({ t, quoteHref }: { t: T; quoteHref: string }) {
  const L = (k: string) => t.t(k, STORE_TEXT[k]?.[0] ?? k);
  return (
    <section className="sec">
      <div className="wrap store__soon">
        <h2>{L('store.soon.title')}</h2>
        <p>{L('store.soon.text')}</p>
        <a className="btn" href={quoteHref}>{t.t('cta.requestQuote', 'Request a quote')} <Icon name="arrow" /></a>
      </div>
    </section>
  );
}
