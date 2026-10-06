'use client';
/* =============================================================================
   لوحتا التصميم في المحرّر المرئي (القيم وقواعدها في lib/design.ts):
   • DesignPanel — تصميم قسم واحد: ألوانه، وخطّه وأحجامه، ومحاذاته، وصورته،
     ومسافاته، وظهوره على الهاتف والحاسب.
   • ThemePanel  — ألوان الموقع كله وخطوطه.

   كل خانة تبدأ «تلقائي» (تصميم الموقع كما هو)، وزرّ ↺ بجانبها يعيدها إليه.
   التغيير يظهر في الصفحة بعد لحظة، ولا يُحفظ إلا بـ «احفظ».
============================================================================= */
import { FONTS, IMG_POS, THEME_DEFAULTS, type Design, type Theme } from '@/lib/design';

/** تعديل جزئي: قيمة جديدة، أو دالة تحسبها من أحدث قيمة (للضغط المتتالي على +)،
 *  أو undefined للرجوع إلى «تلقائي». null يعني إعادة الكل إلى الأصل. */
export type Patch<T> = { [K in keyof T]?: T[K] | undefined | ((cur: T[K] | undefined) => T[K] | undefined) } | null;

/** يطبّق التعديل الجزئي على أحدث نسخة. */
export function applyPatch<T extends object>(cur: T, patch: Patch<T>): T {
  if (patch === null) return {} as T;
  const out: any = { ...cur };
  for (const [k, v] of Object.entries(patch)) {
    const val = typeof v === 'function' ? (v as any)(out[k]) : v;
    if (val === undefined) delete out[k]; else out[k] = val;
  }
  return out;
}

/* ألوان جاهزة: ألوان الهوية أولًا، ثم ألوان شائعة */
const SWATCHES = [
  '#F26522', '#C2410C', '#060B14', '#0F172A', '#28374B', '#526176', '#F8FAFC', '#FFFFFF',
  '#1D4ED8', '#0E7490', '#15803D', '#B91C1C', '#7C3AED', '#CA8A04', '#000000', '#E2E8F0',
];

function Reset({ on, onClick }: { on: boolean; onClick: () => void }) {
  return on
    ? <button type="button" className="dz__reset" onClick={onClick} title="رجوع إلى تصميم الموقع">↺</button>
    : <span className="dz__reset is-off" />;
}

function ColorRow({ label, value, onChange, hint }: {
  label: string; value?: string; onChange: (v?: string) => void; hint?: string;
}) {
  return (
    <div className="dz__row">
      <div className="dz__label"><span>{label}</span><Reset on={!!value} onClick={() => onChange(undefined)} /></div>
      <div className="dz__colors">
        <label className={`dz__pick${value ? ' is-set' : ''}`} title="اختر أي لون"
               style={value ? { background: value } : undefined}>
          <input type="color" value={value ?? '#F26522'} onChange={(e) => onChange(e.target.value.toUpperCase())} />
          {value ? null : <span>تلقائي</span>}
        </label>
        {SWATCHES.map((c) => (
          <button key={c} type="button" className={`dz__sw${value === c ? ' is-on' : ''}`} style={{ background: c }}
                  onClick={() => onChange(c)} title={c} aria-label={c} />
        ))}
      </div>
      {hint ? <p className="dz__hint">{hint}</p> : null}
    </div>
  );
}

function SizeRow({ label, value, min, max, step = 1, unit = 'px', onChange }: {
  label: string; value?: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v?: number | ((cur?: number) => number)) => void;
}) {
  const mid = Math.round((min + max) / 2);
  /* − و + من أحدث قيمة لا من آخر رسم: ضغطات سريعة متتالية تُحسب كلها */
  const by = (d: number) => onChange((cur) => Math.max(min, Math.min(max, (cur ?? mid) + d)));
  return (
    <div className="dz__row">
      <div className="dz__label">
        <span>{label}</span>
        <b className="dz__val">{value == null ? 'تلقائي' : `${value}${unit}`}</b>
        <Reset on={value != null} onClick={() => onChange(undefined)} />
      </div>
      <div className="dz__range">
        <button type="button" onClick={() => by(-step)} aria-label="أصغر">−</button>
        <input type="range" min={min} max={max} step={step} value={value ?? mid}
               className={value == null ? 'is-auto' : ''} onChange={(e) => onChange(Number(e.target.value))} />
        <button type="button" onClick={() => by(step)} aria-label="أكبر">+</button>
      </div>
    </div>
  );
}

function FontRow({ label, value, onChange, ar, auto = 'خط الموقع' }: {
  label: string; value?: string; onChange: (v?: string) => void; ar?: boolean; auto?: string;
}) {
  const list = [...FONTS].sort((a, b) => (a.ar === b.ar ? 0 : a.ar === !!ar ? -1 : 1));
  return (
    <div className="dz__row">
      <div className="dz__label"><span>{label}</span><Reset on={!!value} onClick={() => onChange(undefined)} /></div>
      <select className="dz__select" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}
              style={value ? { fontFamily: `"${value}"` } : undefined}>
        <option value="">{auto}</option>
        <optgroup label="خطوط عربية (تكتب الإنجليزية أيضًا)">
          {list.filter((f) => f.ar).map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
        </optgroup>
        <optgroup label="خطوط إنجليزية">
          {list.filter((f) => !f.ar).map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
        </optgroup>
      </select>
    </div>
  );
}

function Seg<T extends string>({ label, value, options, onChange }: {
  label: string; value?: T; options: [T | '', string][]; onChange: (v?: T) => void;
}) {
  return (
    <div className="dz__row">
      <div className="dz__label"><span>{label}</span></div>
      <div className="dz__seg">
        {options.map(([v, l]) => (
          <button key={v || 'auto'} type="button" className={(value ?? '') === v ? 'is-on' : ''}
                  onClick={() => onChange((v || undefined) as T | undefined)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value?: boolean; onChange: (v?: boolean) => void }) {
  return (
    <label className="dz__toggle">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked || undefined)} />
      <span>{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------- تصميم القسم */
export function DesignPanel({ value, onChange, hero }: {
  value: Design | undefined; onChange: (p: Patch<Design>) => void; hero?: boolean;
}) {
  const d = value ?? {};
  const set = <K extends keyof Design>(k: K) => (v: any) => onChange({ [k]: v } as Patch<Design>);
  const any = Object.keys(d).length > 0;
  return (
    <div className="dz">
      <p className="dz__intro">
        كل ما هنا لهذا {hero ? 'الجزء' : 'القسم'} وحده. «تلقائي» يعني تصميم الموقع كما هو.
        {any ? <button type="button" className="dz__all" onClick={() => onChange(null)}>↺ رجوع للتصميم الأصلي</button> : null}
      </p>

      <h3 className="dz__h">الألوان</h3>
      <ColorRow label="لون الخلفية" value={d.bg} onChange={set('bg')}
                hint="خلفية داكنة؟ اجعل لون العنوان والنص فاتحًا." />
      <ColorRow label="لون العناوين" value={d.title} onChange={set('title')} />
      <ColorRow label="لون النص" value={d.text} onChange={set('text')} />
      <ColorRow label="اللون المميّز" value={d.accent} onChange={set('accent')}
                hint="الأزرار والخط فوق العنوان والروابط في هذا القسم." />

      <h3 className="dz__h">الخط</h3>
      <FontRow label="خط العناوين" value={d.font} onChange={set('font')} ar />
      <SizeRow label="حجم العنوان" value={d.titleSize} min={16} max={80} onChange={set('titleSize')} />
      <Seg label="سُمك العنوان" value={d.titleWeight ? String(d.titleWeight) as any : undefined}
           options={[['', 'تلقائي'], ['400', 'عادي'], ['600', 'متوسط'], ['700', 'عريض'], ['900', 'أعرض']]}
           onChange={(v) => set('titleWeight')(v ? Number(v) : undefined)} />
      <SizeRow label="حجم النص" value={d.textSize} min={12} max={26} onChange={set('textSize')} />
      <Seg label="المحاذاة" value={d.align}
           options={[['', 'تلقائي'], ['right', 'يمين'], ['center', 'وسط'], ['left', 'يسار']]}
           onChange={set('align')} />

      <h3 className="dz__h">الصورة</h3>
      <SizeRow label="عرض الصورة بإطارها (من الصفّ)" value={d.imgShare} min={30} max={75} step={5} unit="%" onChange={set('imgShare')} />
      <SizeRow label="ارتفاع الصورة بإطارها" value={d.imgHeight} min={120} max={800} step={10} onChange={set('imgHeight')} />
      {d.imgFx ? (
        <div className="dz__row">
          <div className="dz__label">
            <span>تكبير صور بعينها ({Object.keys(d.imgFx).length})</span>
            <Reset on onClick={() => set('imgFx')(undefined)} />
          </div>
          <p className="dz__hint" style={{ marginTop: 0 }}>من الصفحة: مرّر على الصورة واستعمل − و+ والأسهم.</p>
        </div>
      ) : null}
      <SizeRow label="تكبير/تصغير داخل الإطار" value={d.imgZoom} min={50} max={200} step={5} unit="%" onChange={set('imgZoom')} />
      <Seg label="الجزء الظاهر من الصورة" value={d.imgPos as any} options={IMG_POS as any} onChange={set('imgPos') as any} />
      <SizeRow label="استدارة الأركان" value={d.imgRadius} min={0} max={40} onChange={set('imgRadius')} />

      <h3 className="dz__h">المسافات والظهور</h3>
      <SizeRow label="مسافة فوق" value={d.padTop} min={0} max={200} step={4} onChange={set('padTop')} />
      <SizeRow label="مسافة تحت" value={d.padBottom} min={0} max={200} step={4} onChange={set('padBottom')} />
      <Toggle label="أخفِه على الموبايل" value={d.hideMobile} onChange={set('hideMobile')} />
      <Toggle label="أخفِه على الكمبيوتر" value={d.hideDesktop} onChange={set('hideDesktop')} />
    </div>
  );
}

/* ------------------------------------------------------- ألوان الموقع وخطوطه */
export function ThemePanel({ value, onChange }: { value: Theme; onChange: (p: Patch<Theme>) => void }) {
  const set = <K extends keyof Theme>(k: K) => (v: any) => onChange({ [k]: v } as Patch<Theme>);
  const any = Object.keys(value).length > 0;
  return (
    <div className="dz">
      <p className="dz__intro">
        تتغيّر في كل صفحات الموقع بعد «احفظ». تجربتها هنا لا تظهر للزائر قبل الحفظ.
        {any ? <button type="button" className="dz__all" onClick={() => onChange(null)}>↺ الألوان والخطوط الأصلية</button> : null}
      </p>

      <h3 className="dz__h">الألوان</h3>
      <ColorRow label="اللون الأساسي (البرتقالي)" value={value.brand} onChange={set('brand')}
                hint={`الأزرار والروابط والخطوط المميّزة. الأصلي ${THEME_DEFAULTS.brand}`} />
      <ColorRow label="اللون الداكن" value={value.navy} onChange={set('navy')}
                hint="الهيدر والفوتر والأشرطة الداكنة." />
      <ColorRow label="لون العناوين" value={value.ink} onChange={set('ink')} />
      <ColorRow label="لون النص" value={value.body} onChange={set('body')} />
      <ColorRow label="الخلفية الفاتحة" value={value.paper} onChange={set('paper')}
                hint="الأقسام الرملية الفاتحة بين الأقسام البيضاء." />

      <h3 className="dz__h">الخطوط — العربية</h3>
      <FontRow label="خط العناوين" value={value.fontArDisplay} onChange={set('fontArDisplay')} ar auto={`الأصلي (${THEME_DEFAULTS.fontArDisplay})`} />
      <FontRow label="خط النص" value={value.fontArText} onChange={set('fontArText')} ar auto={`الأصلي (${THEME_DEFAULTS.fontArText})`} />
      <h3 className="dz__h">الخطوط — الإنجليزية</h3>
      <FontRow label="خط العناوين" value={value.fontEnDisplay} onChange={set('fontEnDisplay')} auto={`الأصلي (${THEME_DEFAULTS.fontEnDisplay})`} />
      <FontRow label="خط النص" value={value.fontEnText} onChange={set('fontEnText')} auto={`الأصلي (${THEME_DEFAULTS.fontEnText})`} />
    </div>
  );
}
