'use client';
/* =============================================================================
   صور سلايدر الرئيسية — مجمّعة بتبويباتها.

   كانت 26 صورة في قائمة واحدة طويلة، كلٌّ بحقول مسار ومجموعة ووصف، ورقمٌ في
   كل تبويب يدلّ على أول صورته. هنا: كل تبويب صفّ صور مصغّرة؛ تُضغط الصورة
   فتُستبدل أو تُحذف أو تُحرَّك أو يُكتب وصفها، و«+» يضيف صورة إلى التبويب.
   وأول صورة التبويب تُحسب في الموقع من المجموعة، فلا رقم يُضبط باليد.

   الحالة محلّية والحقول المخفية تحملها إلى النموذج، فيقرؤها المحرّر كما
   يقرأ أي حقل: معاينة فورية، وتراجع، وحفظ مع باقي القسم.
============================================================================= */
import { useEffect, useState } from 'react';
import { MediaPicker } from './MediaPicker';
import { Ico } from './EditorIcons';

type Slide = { img: string; imgMobile?: string; group?: string; alt?: { ar?: string; en?: string }; [k: string]: any };
type Tab = { group: string; title?: string; sub?: { ar?: string; en?: string } };

const src = (p: string) => '/' + String(p ?? '').replace(/^\//, '');

/**
 * قَصّة الهاتف للشريحة: المكتوبة صراحةً، أو الموجودة بجانب الصورة تلقائيًّا.
 *
 * الوجود التلقائي يعرفه الخادم من القرص وحده، فيُسأل عنه مرّةً لكل الشرائح
 * (`autos`). وكان يُستنتج هنا بتجربة تحميل الصورة — وذلك يكذب: المصغّرات
 * بـlazy فلا تُحمَّل تحت الشاشة ولا يقع خطأ، فتبقى معلَّمةً «تلقائي» وملفها
 * غير موجود.
 */
function PhoneShot({ slide, auto, onPick, onClear }: {
  slide: Slide; auto: string; onPick: () => void; onClear: () => void;
}) {
  const explicit = (slide.imgMobile ?? '').trim();
  const shown = explicit || auto;
  /* شريحةٌ أُضيفت من هنا: صورتها العريضة هي القَصّة نفسها مؤقّتًا */
  const same = Boolean(explicit) && explicit === String(slide.img ?? '').trim();
  const how = same ? 'دي صورة طولية وهي كمان الصورة العريضة للشريحة — روح «صور الديسكتوب» وحطّ لها واحدة عريضة.'
    : explicit ? 'مضبوطة يدويًا'
      : shown ? 'موجودة بجانب الصورة العريضة — تُستعمل تلقائيًّا'
        : 'مفيش قَصّة هاتف — الصورة العريضة هي اللي هتظهر';

  return (
    <div className="ved__phone">
      <div className="ved__phone-shot">
        {shown ? <img src={src(shown)} alt="" loading="lazy" /> : <span>بلا</span>}
      </div>
      <div className="ved__phone-side">
        <b>صورة الهاتف</b>
        <small className={same ? 'is-warn' : undefined}>{how}</small>
        <span className="ved__phone-acts">
          <button type="button" className="btn btn--sm" onClick={onPick}>
            {explicit ? 'غيّرها' : 'اختر صورة للهاتف'}
          </button>
          {explicit ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onClear}>
              شيل الاختيار
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}

export function SlidesField({ name, value, tabs }: { name: string; value: Slide[]; tabs: Tab[] }) {
  const [slides, setSlides] = useState<Slide[]>(Array.isArray(value) ? value : []);
  const [sel, setSel] = useState<number | null>(null);
  /** أي المجموعتين تُعرَض وتُعدَّل: صور الديسكتوب أم صور الموبايل */
  const [view, setView] = useState<'desktop' | 'mobile'>('desktop');
  /* القَصّات الموجودة على القرص بجانب صورها: صورة عريضة ← قَصّتها. يسألها
     الخادم مرّةً عند فتح قسم الموبايل، بنفس دالة الموقع، فما تُعلّمه اللوحة
     «تلقائي» هو ما سيعرضه الموقع فعلًا. */
  const [autos, setAutos] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<
    { mode: 'replace'; index: number } | { mode: 'phone'; index: number } | { mode: 'add'; group: string } | null
  >(null);

  /* لا يُسأل إلا عمّا لم يُسأل عنه، وعند فتح قسم الموبايل لا قبله: من يعدّل
     صور الديسكتوب لا شأن له بالقرص. */
  const imgs = slides.map((s) => s.img).filter(Boolean).join(',');
  useEffect(() => {
    if (view !== 'mobile') return;
    const want = imgs.split(',').filter((p) => !(p in autos));
    if (!want.length) return;
    let alive = true;
    fetch(`/api/admin/media?mobile=${encodeURIComponent(want.join(','))}`)
      .then((r) => (r.ok ? r.json() : { mobile: {} }))
      /* الغائبة تُسجَّل فارغةً كي لا تُسأل مرّةً أخرى في كل رسم */
      .then((d) => { if (alive) setAutos((a) => ({ ...a, ...Object.fromEntries(want.map((p) => [p, ''])), ...(d.mobile ?? {}) })); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, imgs]);

  const groups = [
    ...tabs.map((t) => ({ group: t.group, title: t.title ?? t.group, sub: t.sub?.ar ?? '' })),
    ...[...new Set(slides.map((s) => s.group ?? ''))]
      .filter((g) => !tabs.some((t) => t.group === g))
      .map((g) => ({ group: g, title: g || 'بلا تبويب', sub: 'لا يفتحها أي تبويب' })),
  ];

  const update = (next: Slide[]) => setSlides(next);
  const move = (i: number, d: number) => {
    /* داخل التبويب نفسه: الجار في الاتجاه المطلوب من المجموعة ذاتها */
    const g = slides[i].group;
    let j = i + d;
    while (j >= 0 && j < slides.length && slides[j].group !== g) j += d;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
    setSel(j);
  };
  const remove = (i: number) => {
    if (!confirm('حذف هذه الصورة من السلايدر؟ تقدر تتراجع قبل الحفظ.')) return;
    update(slides.filter((_, n) => n !== i));
    setSel(null);
  };
  const onPick = (p: string) => {
    if (!pick) return;
    if (pick.mode === 'phone') {
      update(slides.map((s, n) => (n === pick.index ? { ...s, imgMobile: p } : s)));
    } else if (pick.mode === 'replace') {
      /* صورة جديدة: مقاسات القديمة لا تصلح لها، فتُحذف ويأخذ المتصفح مقاس الجديدة.
         وقَصّة الهاتف تتبع صورتها: قَصّةُ صورةٍ أخرى لا تصلح لهذه. */
      const { w, h, imgMobile, ...rest } = slides[pick.index];
      update(slides.map((s, n) => (n === pick.index ? { ...rest, img: p } : s)));
    } else {
      const tab = tabs.find((t) => t.group === pick.group);
      const last = slides.map((s) => s.group).lastIndexOf(pick.group);
      const at = last >= 0 ? last + 1 : slides.length;
      const next = [...slides];
      /* المضافة من قسم الموبايل: المختارة قَصّتُها، وهي أيضًا صورتها العريضة
         مؤقّتًا — الشريحة بلا صورة عريضة تكسر الموقع، والتبويبات مربوطة
         بترتيب الشرائح فلا تصحّ شريحةٌ على الهاتف وحده. تُستبدَل العريضة من
         قسم الديسكتوب، والتنبيه تحت يقولها. */
      next.splice(at, 0, {
        img: p, group: pick.group,
        ...(view === 'mobile' ? { imgMobile: p } : {}),
        alt: { ar: tab?.sub?.ar ?? '', en: tab?.sub?.en ?? '' },
      });
      update(next);
      setSel(at);
    }
    setPick(null);
  };

  const cur = sel != null ? slides[sel] : null;

  return (
    <div className="field">
      <label>صور السلايدر</label>

      {/* مجموعتان لا قائمة واحدة: لكل شريحة صورة عريضة وقَصّة طولية للهاتف،
          وعرضهما معًا في صفٍّ واحد يخلطهما. فيُختار أيّهما يُعرَض ويُعدَّل،
          وتبقى الشرائح وترتيبها كما هي في الحالتين. */}
      <div className="ved__which" role="group" aria-label="أي صور تُعدَّل">
        <button type="button" className={view === 'desktop' ? 'is-on' : ''}
                onClick={() => setView('desktop')}>صور الديسكتوب</button>
        <button type="button" className={view === 'mobile' ? 'is-on' : ''}
                onClick={() => setView('mobile')}>صور الموبايل</button>
      </div>

      <p className="field__hint" style={{ marginTop: 0 }}>
        {view === 'desktop'
          ? 'اضغط صورة لتغييرها أو حذفها، و«+» لإضافة صورة إلى التبويب.'
          : 'الصورة الطولية اللي تظهر على الهاتف بدل العريضة. القلم على كل مصغّرة يختار قَصّتها، و«+» على الفاضية يضيف لها، و«×» ترجّعها للتلقائي. والمعلَّمة «تلقائي» موجودة بجانب صورتها العريضة فتُستعمل وحدها.'}
      </p>

      {/* ما يقرؤه المحرّر: مسار كل صورة ومجموعتها ووصفها، بترتيبها */}
      {slides.map((s, i) => (
        <span key={i} hidden>
          <input type="hidden" name={`${name}.${i}.img`} value={s.img ?? ''} />
          <input type="hidden" name={`${name}.${i}.imgMobile`} value={s.imgMobile ?? ''} />
          <input type="hidden" name={`${name}.${i}.group`} value={s.group ?? ''} />
          <input type="hidden" name={`${name}.${i}.alt.ar`} value={s.alt?.ar ?? ''} />
          <input type="hidden" name={`${name}.${i}.alt.en`} value={s.alt?.en ?? ''} />
        </span>
      ))}

      {groups.map((g) => {
        const idx = slides.map((s, i) => (s.group === g.group ? i : -1)).filter((i) => i >= 0);
        return (
          <div className="ved__slides" key={g.group || '_'}>
            <div className="ved__slides-head">
              <b>{g.title}</b><small>{g.sub}</small><em>{idx.length}</em>
            </div>
            <div className="ved__slides-row">
              {idx.map((i, n) => {
                const s = slides[i];
                if (view === 'desktop') {
                  return (
                    /* سلّةٌ على المصغّرة نفسها: كان الحذف لا يُبلَغ إليه إلا
                       بفتح لوحة التعديل تحت، فيُفتَح ما لا يُراد تعديله. */
                    <span className="ved__slide-wrap" key={i}>
                      <button type="button" className={`ved__slide${sel === i ? ' is-on' : ''}`}
                              onClick={() => setSel(sel === i ? null : i)} title={s.alt?.ar ?? ''}>
                        <img src={src(s.img)} alt="" loading="lazy" />
                        {i === 0 ? <i title="أول صورة يراها الزائر">١</i>
                          : n === 0 ? <i title="أول صورة في التبويب">●</i> : null}
                      </button>
                      <button type="button" className="ved__slide-del" title="احذف الشريحة"
                              aria-label={`احذف ${s.alt?.ar || g.title}`}
                              onClick={() => remove(i)}>
                        <Ico name="trash" size={11} />
                      </button>
                    </span>
                  );
                }
                const explicit = (s.imgMobile ?? '').trim();
                const auto = autos[s.img] || '';
                const show = explicit || auto;
                const what = s.alt?.ar || g.title;
                /* زرّ الاختيار على كل مصغّرة لا على الفاضية وحدها: الفاضية
                   واحدة من سبع عشرة، والباقي له قَصّة تلقائية — فكان التبديل
                   مخبوءًا في لوحة التعديل تحت، فلا يُرى «إضافة» أصلًا. */
                const label = `${what} — ${explicit ? 'قَصّة مضبوطة يدويًا'
                  : show ? 'قَصّة تلقائية' : 'بلا قَصّة هاتف، اضغط لتختار'}`;
                return (
                  <span className="ved__slide-wrap" key={i}>
                    <button type="button" title={label} aria-label={label}
                            className={`ved__slide ved__slide--tall${sel === i ? ' is-on' : ''}${show ? '' : ' ved__slide--none'}`}
                            onClick={() => (show ? setSel(sel === i ? null : i) : setPick({ mode: 'phone', index: i }))}>
                      {show ? <img src={src(show)} alt="" loading="lazy" />
                        : <Ico name="plus" size={16} />}
                      {explicit && explicit === String(s.img ?? '').trim()
                        ? <u className="is-warn" title="الشريحة لسه بلا صورة عريضة">ناقصة</u>
                        : explicit ? <u title="اخترتها بنفسك">يدوي</u>
                          : show ? <u className="is-auto" title="موجودة بجانب الصورة العريضة">تلقائي</u> : null}
                    </button>
                    {show ? (
                      <button type="button" className="ved__slide-pen"
                              title={explicit ? 'غيّر القَصّة' : 'اختر قَصّة بدل التلقائية'}
                              aria-label={`${explicit ? 'غيّر' : 'اختر'} قَصّة هاتف ${what}`}
                              onClick={() => setPick({ mode: 'phone', index: i })}>
                        <Ico name="pen" size={11} />
                      </button>
                    ) : null}
                    {/* سلّةٌ هنا أيضًا: الشريحة واحدة في العرضين، فحذفها من
                        أيّهما يحذفها كلّها — ونصُّ الزرّ يقول ذلك صراحةً كي
                        لا يُظنّ أنه يحذف القَصّة وحدها. */}
                    <button type="button" className="ved__slide-del" title="احذف الشريحة كلها"
                            aria-label={`احذف شريحة ${what}`}
                            onClick={() => remove(i)}>
                      <Ico name="trash" size={11} />
                    </button>
                    {/* وهذا يرفع الاختيار اليدوي لا الشريحة */}
                    {explicit ? (
                      <button type="button" className="ved__slide-x" title="شيل القَصّة المختارة"
                              aria-label={`شيل قَصّة الهاتف من ${what}`}
                              onClick={() => update(slides.map((x, n2) => {
                                if (n2 !== i) return x;
                                const { imgMobile, ...rest } = x;
                                return rest;
                              }))}>×</button>
                    ) : null}
                  </span>
                );
              })}
              {/* الإضافة في القسمين: الشريحة واحدة لها صورتان، ومن يضبط صور
                  الهاتف يحتاج أن يزيد شريحةً كما يحتاجها من يضبط العريضة. */}
              <button type="button"
                      className={`ved__slide ved__slide--add${view === 'mobile' ? ' ved__slide--tall' : ''}`}
                      onClick={() => setPick({ mode: 'add', group: g.group })}
                      title={view === 'mobile' ? 'أضف شريحة بقَصّة هاتف' : 'أضف صورة إلى هذا التبويب'}
                      aria-label={`أضف صورة إلى ${g.title}`}>
                <Ico name="plus" size={18} />
              </button>
            </div>
          </div>
        );
      })}

      {cur ? (
        <div className="ved__slide-edit">
          {/* المعروض والمعدَّل يتبعان القسم المفتوح، فلا يُغيَّر ما لا يُرى */}
          {view === 'desktop' ? (
            <>
              <img src={src(cur.img)} alt="" />
              <div className="ved__slide-acts">
                <button type="button" className="btn btn--sm" onClick={() => setPick({ mode: 'replace', index: sel! })}>غيّر الصورة</button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(sel!, -1)} title="قدّمها"><Ico name="up" size={14} /></button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(sel!, 1)} title="أخّرها"><Ico name="down" size={14} /></button>
                <button type="button" className="btn btn--bad btn--sm" onClick={() => remove(sel!)}>احذف</button>
              </div>
            </>
          ) : (
            <PhoneShot
              slide={cur}
              auto={autos[cur.img] || ''}
              onPick={() => setPick({ mode: 'phone', index: sel! })}
              onClear={() => update(slides.map((s, n) => {
                if (n !== sel) return s;
                const { imgMobile, ...rest } = s;
                return rest;
              }))}
            />
          )}
          <label className="ved__slide-alt">
            <span>وصف الصورة (لمن لا يرى الصور ولجوجل)</span>
            <input type="text" value={cur.alt?.ar ?? ''} placeholder="عربي"
                   onChange={(e) => update(slides.map((s, n) => (n === sel ? { ...s, alt: { ...s.alt, ar: e.target.value } } : s)))} />
            <input type="text" dir="ltr" value={cur.alt?.en ?? ''} placeholder="English"
                   onChange={(e) => update(slides.map((s, n) => (n === sel ? { ...s, alt: { ...s.alt, en: e.target.value } } : s)))} />
          </label>
        </div>
      ) : null}

      <MediaPicker open={Boolean(pick)} kind="image" onClose={() => setPick(null)} onPick={onPick} />
    </div>
  );
}
