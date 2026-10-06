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
import { useState } from 'react';
import { MediaPicker } from './MediaPicker';
import { Ico } from './EditorIcons';

type Slide = { img: string; group?: string; alt?: { ar?: string; en?: string }; [k: string]: any };
type Tab = { group: string; title?: string; sub?: { ar?: string; en?: string } };

const src = (p: string) => '/' + String(p ?? '').replace(/^\//, '');

export function SlidesField({ name, value, tabs }: { name: string; value: Slide[]; tabs: Tab[] }) {
  const [slides, setSlides] = useState<Slide[]>(Array.isArray(value) ? value : []);
  const [sel, setSel] = useState<number | null>(null);
  const [pick, setPick] = useState<{ mode: 'replace'; index: number } | { mode: 'add'; group: string } | null>(null);

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
    if (pick.mode === 'replace') {
      /* صورة جديدة: مقاسات القديمة لا تصلح لها، فتُحذف ويأخذ المتصفح مقاس الجديدة */
      const { w, h, ...rest } = slides[pick.index];
      update(slides.map((s, n) => (n === pick.index ? { ...rest, img: p } : s)));
    } else {
      const tab = tabs.find((t) => t.group === pick.group);
      const last = slides.map((s) => s.group).lastIndexOf(pick.group);
      const at = last >= 0 ? last + 1 : slides.length;
      const next = [...slides];
      next.splice(at, 0, { img: p, group: pick.group, alt: { ar: tab?.sub?.ar ?? '', en: tab?.sub?.en ?? '' } });
      update(next);
      setSel(at);
    }
    setPick(null);
  };

  const cur = sel != null ? slides[sel] : null;

  return (
    <div className="field">
      <label>صور السلايدر</label>
      <p className="field__hint" style={{ marginTop: 0 }}>اضغط صورة لتغييرها أو حذفها، و«+» لإضافة صورة إلى التبويب.</p>

      {/* ما يقرؤه المحرّر: مسار كل صورة ومجموعتها ووصفها، بترتيبها */}
      {slides.map((s, i) => (
        <span key={i} hidden>
          <input type="hidden" name={`${name}.${i}.img`} value={s.img ?? ''} />
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
              {idx.map((i, n) => (
                <button type="button" key={i} className={`ved__slide${sel === i ? ' is-on' : ''}`}
                        onClick={() => setSel(sel === i ? null : i)} title={slides[i].alt?.ar ?? ''}>
                  <img src={src(slides[i].img)} alt="" loading="lazy" />
                  {i === 0 ? <i title="أول صورة يراها الزائر">١</i> : n === 0 ? <i title="أول صورة في التبويب">●</i> : null}
                </button>
              ))}
              <button type="button" className="ved__slide ved__slide--add" onClick={() => setPick({ mode: 'add', group: g.group })}
                      title="أضف صورة إلى هذا التبويب" aria-label={`أضف صورة إلى ${g.title}`}>
                <Ico name="plus" size={18} />
              </button>
            </div>
          </div>
        );
      })}

      {cur ? (
        <div className="ved__slide-edit">
          <img src={src(cur.img)} alt="" />
          <div className="ved__slide-acts">
            <button type="button" className="btn btn--sm" onClick={() => setPick({ mode: 'replace', index: sel! })}>غيّر الصورة</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(sel!, -1)} title="قدّمها"><Ico name="up" size={14} /></button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(sel!, 1)} title="أخّرها"><Ico name="down" size={14} /></button>
            <button type="button" className="btn btn--bad btn--sm" onClick={() => remove(sel!)}>احذف</button>
          </div>
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
