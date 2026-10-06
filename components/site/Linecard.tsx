/* =============================================================================
   كتالوج المعدات — منقول عن equipment.html و assets/js/equipment.js.

   هذه بطاقة خطوط لا متجر: المديات مرتّبة لتُقرأ، مجموعةً بحسب الوكالة التي
   تأتي منها، والموديلات صفوف مرجعية لا كروت شراء. وحقل البحث يضيّق القوائم
   ولا يحوّلها إلى نتائج بحث.

   فرق واحد عن القديم لصالح الزائر: البحث كان يعمل بلغة الصفحة وحدها، فمن كتب
   كلمة عربية في النسخة الإنجليزية لم يجد شيئًا. صار كل صف يحمل نصّه بلغتيه،
   فالكلمة تنجح بأي منهما.
============================================================================= */
import type { T } from '@/lib/i18n';
import type { Brand, Product } from '@/lib/content';
import { Icon } from './Icon';
import { Pic } from './Pic';

type Any = Record<string, any>;

const pName = (p: Product, t: T) => (t.ar ? p.name_ar || t.phrase(p.name_en) : p.name_en) ?? '';
const pType = (p: Product, t: T) => (t.ar ? p.type_ar || t.phrase(p.type_en) : p.type_en) ?? '';
const pDesc = (p: Product, t: T) => (t.ar ? p.description_ar || t.phrase(p.description_en) : p.description_en) ?? '';

/** طيّ الحروف كي تنجح كتابات العربية المختلفة: الهمزات والتاء والياء والتشكيل. */
const norm = (v: string) => String(v || '').toLowerCase()
  .replace(/[ً-ْـ]/g, '')
  .replace(/[آأإ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ى/g, 'ي')
  .replace(/\s+/g, ' ')
  .trim();

/** ما يُبحث فيه عن الموديل — باللغتين معًا. */
const haystack = (p: Product, t: T) => norm([
  p.name_en, p.name_ar, p.type_en, p.type_ar, p.subcategory,
  t.t(`sub.${p.subcategory}`, p.subcategory ?? ''),
  p.description_en, p.description_ar, p.brand_name,
  (p.data.applications ?? []).join(' '),
  (p.data.meta ?? []).map((m: Any) => m.v).join(' '),
].filter(Boolean).join(' '));

/** الحقل الذي يفرّق بين الموديلات المتشابهة: سعة، قدرة، عرض كنس.
    يُقرأ من المواصفات لا من الشرائح، كما في الموقع القديم. */
function deciding(p: Product, keys: string[], t: T) {
  const specs = p.data.specifications ?? [];
  for (const k of keys) {
    const s = specs.find((x: Any) => x.k === t.t(`spec.${k}`, k) || x.k === k);
    if (s?.v) return t.phrase(s.v);
  }
  return t.phrase(specs.map((s: Any) => s.v).filter(Boolean)[0] ?? '');
}

/* ------------------------------------------------- صفّ موديل واحد */
function Row({ p, keys, t }: { p: Product; keys: string[]; t: T }) {
  return (
    <li className="lrow" data-slug={p.slug} data-find={haystack(p, t)}>
      <a className="lrow__link" href={t.href(`model.html?p=${encodeURIComponent(p.slug)}`)}>
        <span className="lrow__name">{pName(p, t)}</span>
        <span className="lrow__type">{pType(p, t)}</span>
        <span className="lrow__detail">{deciding(p, keys, t)}</span>
        <span className="lrow__go" aria-hidden="true"><Icon name="arrow" /></span>
        <span className="sr">{`${t.t('eq.specsFor', 'Specifications for')} ${pName(p, t)}`}</span>
      </a>
    </li>
  );
}

/* خمس عشرة قدرة تشترك في نوع واحد وبناء واحد: عرضها صفوفًا يكرّر الوصف نفسه
   خمس عشرة مرة ولا يقول شيئًا. القدرة نفسها هي ما يفرّق، فيُقرأ المدى سلّمًا. */
function Ratings({ list, title, note, t }: { list: Product[]; title: any; note?: any; t: T }) {
  if (!list.length) return null;
  return (
    <div className="lgroup" data-group>
      <h4 className="lgroup__h">{t.tx(title)}</h4>
      {note ? <p className="lgroup__note">{t.tx(note)}</p> : null}
      <ul className="ratings">
        {list.map((p) => {
          /* القدرة هي ما يفرّق بين هذه الموديلات، فهي ما يظهر. في النسخة
             العربية كان اسم الموديل كاملًا يظهر بدلها لأن الترجمة تُعرّب مفتاح
             الشريحة فينكسر البحث عنه — والنتيجة تكرار الاسم في كل صف. */
          const cap = (p.data.meta ?? []).find((m: Any) => m.k === 'Capacity')?.v;
          return (
            <li key={p.ref} data-find={haystack(p, t)}>
              <a href={t.href(`model.html?p=${encodeURIComponent(p.slug)}`)}>
                <b>{t.phrase(cap) || pName(p, t)}</b>
                <span className="sr">{`${t.t('eq.specsFor', 'Specifications for')} ${pName(p, t)}`}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Group({ list, title, keys, t }: { list: Product[]; title: any; keys: string[]; t: T }) {
  if (!list.length) return null;
  return (
    <div className="lgroup" data-group>
      <h4 className="lgroup__h">{t.tx(title)}</h4>
      <ul className="lrows">
        {list.map((p) => <Row p={p} keys={keys} t={t} key={p.ref} />)}
      </ul>
    </div>
  );
}

/* كتلة وكالة: من هو المصنّع ولماذا تحمله 5A&M — السؤال الذي يسبق قائمة
   الموديلات في ذهن المشتري. */
function BrandBlock({
  b, block, products, keys, t,
}: { b: Brand | undefined; block: Any; products: Product[]; keys: string[]; t: T }) {
  const mine = products.filter((p) => p.brand_slug === block.brand);
  const groups = (block.subs ?? [])
    .map((sub: string) => ({ sub, list: mine.filter((p) => p.subcategory === sub) }))
    .filter((g: Any) => g.list.length);
  if (!groups.length) return null;
  return (
    <article className="lbrand" id={block.brand} data-reveal data-block>
      <header className="lbrand__head">
        <div className="lbrand__mark">
          {b?.logo ? <img src={b.logo} alt={b.name} /> : <b>{b?.name ?? block.brand}</b>}
          <span>{(t.ar ? b?.sub_ar || b?.sub_en : b?.sub_en) ?? ''}</span>
        </div>
        <p className="lbrand__blurb">{t.tx(block.blurb)}</p>
      </header>
      <div className="lbrand__body">
        {groups.map((g: Any) => (
          <Group key={g.sub} list={g.list} title={t.t(`sub.${g.sub}`, g.sub)} keys={keys} t={t} />
        ))}
      </div>
    </article>
  );
}

/* --------------------------------------------- قسم من الكتالوج */
export function Linecard({
  s, anchor, products, brands, t,
}: { s: Any; anchor: string | null; products: Product[]; brands: Record<string, Brand>; t: T }) {
  const keys: string[] = s.deciding ?? [];
  const pick = (g: Any) => products.filter(
    (p) => p.category === g.category && (!g.subs?.length || g.subs.includes(p.subcategory))
  );

  const blocks = (s.brandBlocks ?? []).map((b: Any) => (
    <BrandBlock key={b.brand} b={brands[b.brand]} block={b} products={products} keys={keys} t={t} />
  ));
  const groups = (s.groups ?? []).map((g: Any, i: number) =>
    g.style === 'ratings'
      ? <Ratings key={i} list={pick(g)} title={g.title} note={g.note} t={t} />
      : <Group key={i} list={pick(g)} title={g.title} keys={keys} t={t} />
  );
  const cells = (s.brandCells ?? []).map((id: string) => brands[id]).filter(Boolean);

  return (
    <section className={`sec ${s.tone ? `sec--${s.tone}` : ''}`} id={anchor ?? ''} data-lcsec>
      <div className="wrap">
        <div className="shead shead--wide" data-reveal>
          <span className="shead__idx">{s.idx}</span>
          <span className="shead__rule" aria-hidden="true" />
          <div>
            <p className="shead__eyebrow">{t.tx(s.eyebrow)}</p>
            <h2 className="shead__title">{t.tx(s.title)}</h2>
            <p className="shead__lede shead__lede--wide">{t.tx(s.lede)}</p>
          </div>
        </div>
        {blocks}
        {groups.length ? <div className="lplain" data-reveal data-block>{groups}</div> : null}
        {cells.length ? (
          <div className="lbrands" data-reveal data-stagger>
            {cells.map((b: Brand) => (
              <div className={`brandcell ${b.logo ? '' : 'brandcell--text'}`} key={b.slug}>
                {b.logo ? <img src={b.logo} alt={b.name} /> : <b>{b.name}</b>}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------ الروابط العلوية وحقل البحث */
export function LinecardJump({ s, empty, t }: { s: Any; empty: Any; t: T }) {
  return (
    <section className="sec sec--tight">
      <div className="wrap">
        <div className="linecard__jump" data-reveal data-stagger>
          {(s.links ?? []).map((l: Any, i: number) => (
            <a href={l.href} key={i}>
              <b>{t.tx(l.title)}</b>
              <span>{t.tx(l.text)}</span>
            </a>
          ))}
        </div>

        <div className="finder" data-reveal data-finder
             data-empty-title={t.tx(empty?.title)} data-empty-text={t.tx(empty?.text)}>
          <label htmlFor="q">{t.tx(s.findLabel)}</label>
          <div className="finder__row">
            <span className="finder__ico"><Icon name="search" /></span>
            <input type="search" id="q" placeholder={t.tx(s.findPlaceholder)} aria-describedby="findHint" />
            <button className="btn btn--ghost btn--sm" type="button" id="qClear" hidden>
              {t.tx(s.findClear)}
            </button>
          </div>
          <p className="finder__hint" id="findHint">{t.tx(s.findHint)}</p>
        </div>
      </div>
    </section>
  );
}

/* شريط الدعوة أسفل الكتالوج — فيه عدّاد رقمي إلى جانب البطاقات النصية. */
export function CtaBandWide({ s, quoteHref, t }: { s: Any; quoteHref: string; t: T }) {
  return (
    <section className="ctaband">
      <Pic src={s.img} alt="" />
      <div className="wrap ctaband__in">
        <div data-reveal>
          <h2>{t.tx(s.title)}<br /><span className="accent">{t.tx(s.accent)}</span></h2>
          <p>{t.tx(s.text)}</p>
          <a className="btn" href={quoteHref}>{t.tx(s.cta)} <span><Icon name="arrow" /></span></a>
        </div>
        <div className="figs" data-reveal data-d="1" data-stagger>
          {(s.figs ?? []).map((f: Any, i: number) => (
            <div className="fig" key={i}>
              <i><Icon name={f.icon} /></i>
              {f.count
                ? <b data-count={f.count.to} data-suffix={f.count.suffix}>{`${f.count.to}${f.count.suffix}`}</b>
                : <b>{t.tx(f.title)}</b>}
              <span>{t.tx(f.text)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
