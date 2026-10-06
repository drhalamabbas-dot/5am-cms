/* =============================================================================
   نموذج عرض السعر — منقول عن assets/js/quote.js.

   الموقع القديم كان يبني النموذج بالجافاسكريبت، فلا يراه محرك البحث ولا يظهر
   قبل تحميل السكربت. صار يُرسم من السيرفر بالبنية والأصناف نفسها، والتفاعل
   (اختيار الخدمة، تصفية المنتجات، المراجعة) في مُكوِّن عميل صغير.

   ما لا يتغيّر: الطلب لا يُرسل من هنا. الزائر يراجع نصّه ثم يفتحه في تطبيق
   بريده أو ينسخه — كما هو اليوم بالحرف.
============================================================================= */
import type { T } from '@/lib/i18n';
import type { Product } from '@/lib/content';
import { Icon } from './Icon';
import { QuoteBehaviour } from './QuoteBehaviour';

type Any = Record<string, any>;

/** حقل نصّي واحد بالبنية نفسها التي كانت دالة field تبنيها. */
function Field({
  id, label, type = 'text', required, error, placeholder, full, ...rest
}: Any) {
  return (
    <div className={`field${full ? ' field--full' : ''}`}>
      <label htmlFor={id}>{label}{required ? <> <span aria-hidden="true">*</span></> : null}</label>
      <input id={id} name={id} type={type} {...(required ? { required: true } : {})}
             {...(placeholder ? { placeholder } : {})} {...rest} />
      <span className="err" id={`${id}-error`}>{error}</span>
    </div>
  );
}

export function QuoteForm({
  s, products, company, t, preset,
}: {
  s: Any; products: Product[]; company: Any; t: T;
  preset: { solution: string; product: string; source: string };
}) {
  const x = s.text as Record<string, { en: string; ar: string }>;
  const L = (k: string) => t.tx(x[k]);
  const options: Any[] = s.options ?? [];

  /* قائمة المنتجات كاملة، والتصفية بالخدمة تجري في المتصفح كما كانت. */
  const productOptions = products.map((p) => ({
    slug: p.slug,
    category: p.category,
    label: `${p.brand_name ?? ''} — ${t.ar ? p.name_ar || p.name_en : p.name_en}`,
  }));

  return (
    <section className="sec sec--tight">
      <div className="wrap qlayout" id="quoteLayout">
        <form className="ux-form" id="quoteForm" noValidate>
          <div className="ux-quote-intro">
            <h2>{L('introTitle')}</h2>
            <p>{L('introText')}</p>
          </div>
          <div id="formMsg" className="formmsg" role="alert" />

          <Field id="name" label={L('name')} required error={L('errGeneric')}
                 autoComplete="name" maxLength={100} />
          <Field id="phone" label={L('phone')} type="tel" required error={L('errPhone')}
                 autoComplete="tel" inputMode="tel" maxLength={30} />
          <Field id="email" label={L('email')} type="email" error={L('errEmail')}
                 autoComplete="email" maxLength={150} />
          <Field id="company" label={L('company')} error={L('errGeneric')}
                 autoComplete="organization" maxLength={150} />

          <div className="field field--full">
            <label htmlFor="solution" id="solution-label">
              {L('solutionLabel')} <span aria-hidden="true">*</span>
            </label>
            <select id="solution" name="solution" required className="sr" tabIndex={-1}
                    aria-hidden="true" defaultValue={preset.solution}>
              <option value="">{L('solutionPlaceholder')}</option>
              {options.map((o) => <option value={o.value} key={o.value}>{t.tx(o.label)}</option>)}
            </select>
            <div className="svc" role="radiogroup" aria-labelledby="solution-label" aria-describedby="solution-error">
              {options.map((o) => (
                <button type="button" className="svc__opt" role="radio"
                        aria-checked={o.value === preset.solution} data-v={o.value} key={o.value}>
                  <i aria-hidden="true"><Icon name={o.icon} /></i>
                  <span>{t.tx(o.label)}</span>
                </button>
              ))}
            </div>
            <span className="err" id="solution-error">{L('solutionError')}</span>
          </div>

          <div className="field field--full">
            <label htmlFor="message">{L('message')}</label>
            <textarea name="message" id="message" maxLength={2500} placeholder={L('messagePlaceholder')} />
          </div>

          <div id="rentalDetails" className="field--full ux-optional-grid" hidden>
            <Field id="duration" label={L('duration')} error={L('errGeneric')}
                   placeholder={L('durationPlaceholder')} maxLength={100} />
            <Field id="start" label={L('start')} type="date" error={L('errGeneric')} />
          </div>

          <details className="field--full" id="technicalDetails" {...(preset.product ? { open: true } : {})}>
            <summary>{L('details')}</summary>
            <div className="ux-optional-grid">
              <div className="field">
                <label htmlFor="product">{L('product')}</label>
                <select id="product" name="product" defaultValue={preset.product}>
                  <option value="">{L('anyProduct')}</option>
                  {productOptions.map((p) => (
                    <option value={p.slug} data-cat={p.category ?? ''} key={p.slug}>{p.label}</option>
                  ))}
                </select>
              </div>
              <Field id="power" label={L('power')} error={L('errGeneric')}
                     placeholder={L('powerPlaceholder')} maxLength={100} />
              <Field id="location" label={L('location')} error={L('errGeneric')}
                     autoComplete="address-level2" maxLength={200} />
            </div>
          </details>

          <div className="field--full">
            {/* فخّ الآليّات: لا يراه أحد، ومن يملؤه يُهمَل طلبه. ليس تحقّقًا بصريًا
                لكنه يوقف معظم الرسائل الآلية بلا أي عبء على الزائر. */}
            <div className="hp" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <button className="btn" type="submit">{L('submit')} <Icon name="arrow" /></button>
            <p className="hint">{L('submitHint')}</p>
          </div>

          <section className="field--full ux-review" id="requestReview" hidden tabIndex={-1}
                   aria-labelledby="reviewTitle">
            <h2 id="reviewTitle">{L('reviewTitle')}</h2>
            <pre id="requestText" />
            <div className="ux-review-actions">
              <a className="btn" id="openEmail" href="#">{L('openEmail')} <Icon name="mail" /></a>
              <button className="btn btn--ghost" id="copyRequest" type="button">{L('copy')}</button>
              <button className="btn btn--ghost" id="downloadRequest" type="button">{L('download')}</button>
            </div>
            <p className="ux-review-note">
              {L('reviewNote')} <a href={`mailto:${company.email}`} dir="ltr">{company.email}</a>. {L('reviewNote2')}
            </p>
            <p id="copyStatus" role="status" aria-live="polite" />
          </section>
        </form>

        <aside>
          <div className="cnt__panel qside">
            <h2>{L('asideTitle')}</h2>
            <p>{L('asideText')}</p>
            <a className="cnt__row" href={`tel:${company.phoneIntl}`}>
              <i aria-hidden="true"><Icon name="phone" /></i>
              <span><small>{L('asidePhone')}</small><b dir="ltr">{company.phone}</b></span>
            </a>
            <a className="cnt__row" href={`mailto:${company.email}`}>
              <i aria-hidden="true"><Icon name="mail" /></i>
              <span><small>{L('asideEmail')}</small><b dir="ltr">{company.email}</b></span>
            </a>
            <div className="qside__cover">
              <b>{L('coverTitle')}</b>
              <ul>
                {(s.cover ?? []).map((c: Any, i: number) => (
                  <li key={i}><Icon name="tick" /><span>{t.tx(c)}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>

      <QuoteBehaviour
        lang={t.lang}
        email={company.email}
        source={preset.source}
        prefill={preset.product ? `${L('prefill')}${
          products.find((p) => p.slug === preset.product)
            ? (t.ar
                ? products.find((p) => p.slug === preset.product)!.name_ar
                  || products.find((p) => p.slug === preset.product)!.name_en
                : products.find((p) => p.slug === preset.product)!.name_en)
            : ''
        }` : ''}
        text={{
          errCheck: L('errCheck'),
          mailSubject: L('mailSubject'),
          requestHeading: L('requestHeading'),
          sourceLabel: L('sourceLabel'),
          copied: L('copied'),
          copyFailed: L('copyFailed'),
          received: L('received') || (t.ar
            ? 'وصلنا طلبك، وسيتواصل معك فريقنا قريبًا. وتقدر كمان ترسله بالبريد من تحت.'
            : 'We have received your request — our team will contact you shortly. You can also send it by email below.'),
        }}
      />
    </section>
  );
}
