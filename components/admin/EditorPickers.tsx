'use client';
/* =============================================================================
   نافذتا اختيار للمحرّر المرئي.

   ProductPicker — بدل كتابة أكواد المنتجات سطرًا سطرًا: قائمة بالصورة والاسم،
   يُختار منها بعلامة ✓، ويُرتَّب المختار بالأسهم. الترتيب هنا هو ترتيب الكروت.

   LinkPicker — وجهة زرّ أو كارت: صفحة من الموقع، أو منتج، أو نموذج عرض
   السعر، أو أي رابط يُكتب. بدل أن يُحفظ اسم ملف بلا خطأ إملائي.
============================================================================= */
import { useMemo, useState } from 'react';
import { Ico } from './EditorIcons';
import { siteHref, looksLikeLink } from '@/lib/links';

export type PickProduct = { ref: string; slug: string; name: string; img: string | null; category: string | null; published: number };

const CAT_AR: Record<string, string> = { environmental: 'المعدات البيئية', power: 'توليد الطاقة', parts: 'قطع الغيار' };
const fold = (s: string) => s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

export function ProductPicker({
  products, value, onDone, onClose,
}: { products: PickProduct[]; value: string[]; onDone: (ids: string[]) => void; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>(value.filter(Boolean));
  const [term, setTerm] = useState('');
  const byRef = useMemo(() => new Map(products.map((p) => [p.ref, p])), [products]);
  const shown = products.filter((p) => !term || fold(`${p.name} ${p.ref}`).includes(fold(term)));
  const groups = [...new Set(shown.map((p) => p.category ?? ''))];

  const toggle = (ref: string) =>
    setPicked((xs) => (xs.includes(ref) ? xs.filter((x) => x !== ref) : [...xs, ref]));
  const move = (i: number, d: number) => setPicked((xs) => {
    const j = i + d;
    if (j < 0 || j >= xs.length) return xs;
    const c = [...xs]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });

  return (
    <div className="ved__modal" role="dialog" aria-modal="true" aria-label="اختر المنتجات"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ved__modal-box ved__pp">
        <div className="ved__modal-head">
          <div>
            <h2>اختر المنتجات</h2>
            <p>علّم ✓ على كل منتج تريده كارتًا. الترتيب على اليسار هو ترتيب الكروت في الصفحة.</p>
          </div>
          <button type="button" className="ved__iconbtn ved__iconbtn--light" onClick={onClose} aria-label="إغلاق">×</button>
        </div>

        <div className="ved__pp-body">
          <div className="ved__pp-all">
            <input type="search" placeholder="ابحث باسم المنتج…" value={term} onChange={(e) => setTerm(e.target.value)} autoFocus />
            {groups.map((g) => (
              <div key={g}>
                <h3>{CAT_AR[g] ?? (g || 'أخرى')}</h3>
                <div className="ved__pp-grid">
                  {shown.filter((p) => (p.category ?? '') === g).map((p) => {
                    const on = picked.includes(p.ref);
                    return (
                      <button type="button" key={p.ref} className={`ved__pp-card${on ? ' is-on' : ''}`} onClick={() => toggle(p.ref)}
                              aria-pressed={on}>
                        <span className="ved__pp-img">
                          {p.img ? <img src={'/' + p.img.replace(/^\//, '')} alt="" loading="lazy" /> : null}
                          <i>{on ? <Ico name="check" size={14} /> : null}</i>
                        </span>
                        <b>{p.name}</b>
                        {p.published ? null : <small className="ved__badge">مسوّدة</small>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {shown.length === 0 ? <p className="empty">لا منتج بهذا الاسم.</p> : null}
          </div>

          <aside className="ved__pp-sel">
            <h3>المختار ({picked.length})</h3>
            {picked.length === 0 ? <p className="field__hint">لم تختر شيئًا بعد.</p> : null}
            <ol>
              {picked.map((ref, i) => (
                <li key={ref}>
                  <span>{byRef.get(ref)?.name ?? ref}</span>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="قدّمه"><Ico name="up" size={14} /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === picked.length - 1} aria-label="أخّره"><Ico name="down" size={14} /></button>
                  <button type="button" onClick={() => toggle(ref)} aria-label="أزله" className="is-bad"><Ico name="trash" size={14} /></button>
                </li>
              ))}
            </ol>
            <button type="button" className="ved__save" style={{ width: '100%', justifyContent: 'center', margin: 0 }}
                    onClick={() => onDone(picked)}>تمّ</button>
          </aside>
        </div>
      </div>
    </div>
  );
}

export type NewPageStart = 'products' | 'copy' | 'blank';

/** صفحة جديدة تحت الصفحة المفتوحة: اسمها، وبماذا تبدأ. */
export function NewPageDialog({
  parent, onCreate, onClose,
}: {
  parent: string;
  onCreate: (v: { ar: string; en: string; start: NewPageStart }) => Promise<string | null>;
  onClose: () => void;
}) {
  const [ar, setAr] = useState('');
  const [en, setEn] = useState('');
  const [start, setStart] = useState<NewPageStart>('products');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const slug = en.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const starts: { k: NewPageStart; t: string; d: string }[] = [
    { k: 'products', t: 'كروت منتجات', d: 'موديلات تختارها من المنتجات، وشريط تواصل — مثل «مكانس الطرق».' },
    { k: 'copy', t: `نسخة من «${parent}»`, d: 'نفس أقسام هذه الصفحة بنصوصها وصورها، وتعدّلها.' },
    { k: 'blank', t: 'فارغة', d: 'أعلى الصفحة فقط، وتضيف الأقسام بنفسك.' },
  ];
  const go = async () => {
    if (!ar.trim() && !en.trim()) { setErr('اكتب اسم الصفحة'); return; }
    setBusy(true); setErr('');
    const e = await onCreate({ ar, en, start });
    if (e) { setErr(e); setBusy(false); }
  };
  return (
    <div className="ved__modal" role="dialog" aria-modal="true" aria-label="صفحة جديدة"
         onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="ved__modal-box ved__lp ved__np">
        <div className="ved__modal-head">
          <div>
            <h2>صفحة جديدة</h2>
            <p>تُضاف تحت «{parent}» في مسار التنقّل، وتبدأ مسوّدة لا يراها الزائر حتى تنشرها.</p>
          </div>
          <button type="button" className="ved__iconbtn ved__iconbtn--light" onClick={onClose} disabled={busy} aria-label="إغلاق">×</button>
        </div>
        <div className="ved__lp-body">
          <label className="field">
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>اسم الصفحة</span>
            <input type="text" value={ar} onChange={(e) => setAr(e.target.value)} placeholder="مثال: وحدات الطرق" autoFocus />
          </label>
          <label className="field">
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>الاسم بالإنجليزية</span>
            <input type="text" dir="ltr" value={en} onChange={(e) => setEn(e.target.value)} placeholder="Road units" />
            <small className="ved__np-url" dir="ltr">{slug ? `${slug}.html` : 'يُكوَّن الرابط من الاسم الإنجليزي'}</small>
          </label>
          <h3>تبدأ بـ</h3>
          <div className="ved__np-starts">
            {starts.map((s) => (
              <button type="button" key={s.k} className={start === s.k ? 'is-on' : ''} onClick={() => setStart(s.k)} aria-pressed={start === s.k}>
                <b>{s.t}</b><small>{s.d}</small>
              </button>
            ))}
          </div>
          {err ? <p className="ved__np-err">{err}</p> : null}
        </div>
        <div className="ved__lp-foot">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>إلغاء</button>
          <button type="button" className="ved__save" style={{ margin: 0 }} onClick={go} disabled={busy}>
            {busy ? 'جارٍ الإنشاء…' : 'أنشئ وافتحها'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LinkPicker({
  value, pages, products, onDone, onClose,
}: {
  value: string;
  pages: { slug: string; title: string }[];
  products: PickProduct[];
  onDone: (href: string) => void; onClose: () => void;
}) {
  /* رابط محفوظ قديمًا بعنوان الجهاز يظهر بصيغته الصحيحة، فيُعلَّم اختياره في القائمة */
  const [href, setHref] = useState(siteHref(value ?? ''));
  const choices: { group: string; items: { href: string; label: string }[] }[] = [
    { group: 'صفحات الموقع', items: [
      { href: 'index.html', label: 'الرئيسية' },
      ...pages.map((p) => ({ href: `${p.slug}.html`, label: p.title })),
      { href: 'equipment.html', label: 'كتالوج المعدات' },
      { href: 'quote.html', label: 'نموذج عرض السعر' },
    ] },
    { group: 'المنتجات', items: products.filter((p) => p.published).map((p) => ({ href: `model.html?p=${p.slug}`, label: p.name })) },
  ];
  return (
    <div className="ved__modal" role="dialog" aria-modal="true" aria-label="وجهة الرابط"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ved__modal-box ved__lp">
        <div className="ved__modal-head">
          <div>
            <h2>إلى أين ينقل؟</h2>
            <p>اختر صفحة أو منتجًا، أو اكتب الرابط بنفسك.</p>
          </div>
          <button type="button" className="ved__iconbtn ved__iconbtn--light" onClick={onClose} aria-label="إغلاق">×</button>
        </div>
        <div className="ved__lp-body">
          <label className="field">
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>الرابط</span>
            <input type="text" dir="ltr" value={href} onChange={(e) => setHref(e.target.value)}
                   placeholder="contact.html  أو  https://…" autoFocus />
          </label>
          {choices.map((c) => (
            <div key={c.group}>
              <h3>{c.group}</h3>
              <div className="ved__lp-list">
                {c.items.map((it) => (
                  <button type="button" key={it.href} className={href === it.href ? 'is-on' : ''} onClick={() => setHref(it.href)}>
                    <b>{it.label}</b><small dir="ltr">{it.href}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {href.trim() && !looksLikeLink(href) ? (
          <p className="ved__np-err" style={{ margin: '0 22px 10px' }}>
            هذا لا يبدو رابطًا: اختر صفحة أو منتجًا من القائمة، أو اكتب رابطًا كاملًا يبدأ بـ https://
          </p>
        ) : null}
        <div className="ved__lp-foot">
          <button type="button" className="btn btn--ghost" onClick={() => onDone('')}>بلا رابط</button>
          <button type="button" className="ved__save" style={{ margin: 0 }} onClick={() => onDone(siteHref(href))}>تمّ</button>
        </div>
      </div>
    </div>
  );
}
