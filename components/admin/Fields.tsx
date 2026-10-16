'use client';
/* =============================================================================
   حقول محرّر القسم.

   النموذج كله HTML عادي يُرسَل إلى إجراء على السيرفر: كل حقل له اسم منقوط
   («cards.0.title.ar») والسيرفر يعيد تركيب الـ JSON منه. فلا حالة مشتركة ولا
   حفظ ناقص، والصفحة تعمل حتى لو تعطّلت الجافاسكريبت.

   الجافاسكريبت هنا لأمرين فقط: إضافة عنصر إلى قائمة وحذفه، وتغيير ترتيبه.
============================================================================= */
import { useEffect, useState } from 'react';
import type { Field } from '@/lib/sectionSchema';
import { MediaPicker, byName } from './MediaPicker';

type Any = Record<string, any>;

const D = (v: any) => (v && typeof v === 'object' ? v : { en: v ?? '', ar: '' });

/* --------------------------------------------------------- نص بلغتيه */
function Dual({ name, label, hint, value, long, suggest }: Any) {
  /* الاقتراح يكتب في الحقل، والحقل غير محكوم (defaultValue) كي لا يُعاد رسمه
     مع كل حرف. فيُعاد تركيبه بمفتاح جديد ليظهر ما كُتب فيه. */
  const [v, setV] = useState<any>(value);
  const [rev, setRev] = useState(0);
  return (
    <div className="field" key={rev}>
      <label>{label}</label>
      <Suggest list={suggest} mode="fill"
               onPick={(s) => { setV(s); setRev((r) => r + 1); }} />
      <div className="row">
        <div>
          <small>عربي</small>
          {long
            ? <textarea name={`${name}.ar`} defaultValue={D(v).ar ?? ''} />
            : <input type="text" name={`${name}.ar`} defaultValue={D(v).ar ?? ''} />}
        </div>
        <div dir="ltr">
          <small style={{ display: 'block', textAlign: 'start' }}>English</small>
          {long
            ? <textarea name={`${name}.en`} defaultValue={D(v).en ?? ''} />
            : <input type="text" name={`${name}.en`} defaultValue={D(v).en ?? ''} />}
        </div>
      </div>
      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------ صورة
   خطوة واحدة: «اختر صورة» ← اضغط على الصورة. المسار يبقى محفوظًا في حقل
   مخفي، فلا يحتاج المحرّر أن يعرفه أو يكتبه. */
function ImageField({ name, label, hint, value, kind = 'image' }: Any) {
  const [src, setSrc] = useState<string>(value ?? '');
  const [open, setOpen] = useState(false);
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{
          width: 120, height: 80, flex: '0 0 auto', border: '1px solid var(--line)',
          borderRadius: 8, background: '#f7f9fc', display: 'grid', placeItems: 'center', overflow: 'hidden',
        }}>
          {src
            ? (kind === 'video'
                ? <span style={{ fontSize: 13, color: 'var(--muted)' }}>▶ فيديو</span>
                : <img src={'/' + src.replace(/^\//, '')} alt=""
                       style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />)
            : <small>لا شيء</small>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--sm" onClick={() => setOpen(true)}>
              {src ? 'غيّر' : 'اختر من المكتبة'}
            </button>
            {src ? (
              <button type="button" className="btn btn--bad btn--sm" onClick={() => setSrc('')}>احذف</button>
            ) : null}
          </div>
          {src ? (
            <p className="field__hint" dir="ltr" style={{ wordBreak: 'break-all' }}>{src}</p>
          ) : null}
        </div>
      </div>
      <input type="hidden" name={name} value={src} />
      {hint ? <p className="field__hint">{hint}</p> : null}
      <MediaPicker open={open} kind={kind} onPick={setSrc} onClose={() => setOpen(false)} />
    </div>
  );
}

/* ------------------------------------------- قائمة نصوص، كلٌّ بلغتيه */
function ListField({ name, label, hint, value, suggest }: Any) {
  const [items, setItems] = useState<any[]>(Array.isArray(value) ? value : []);
  const set = (i: number, k: 'en' | 'ar', v: string) =>
    setItems(items.map((x, n) => (n === i ? { ...D(x), [k]: v } : x)));
  return (
    <div className="field">
      <label>{label}</label>
      <Suggest list={suggest} used={items} onPick={(v) => setItems([...items, v])} />
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input type="text" name={`${name}.${i}.ar`} value={D(it).ar ?? ''}
                 onChange={(e) => set(i, 'ar', e.target.value)} placeholder="عربي" />
          <input type="text" name={`${name}.${i}.en`} dir="ltr" value={D(it).en ?? ''}
                 onChange={(e) => set(i, 'en', e.target.value)} placeholder="English" />
          <button type="button" className="btn btn--bad btn--sm"
                  onClick={() => setItems(items.filter((_, n) => n !== i))}>حذف</button>
        </div>
      ))}
      <button type="button" className="btn btn--ghost btn--sm"
              onClick={() => setItems([...items, { en: '', ar: '' }])}>+ سطر</button>
      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}

/* ----------------------------------------------------- معرض صور
   الصور تُختار من المكتبة — عدّة صور معًا بترتيب يُختار — ويُغيَّر ترتيبها
   بالسحب أو بسهمين. الترتيب هنا هو ترتيب الظهور، والصورة الأولى هي الكبيرة. */
function ImageList({ name, label, hint, value }: Any) {
  const [items, setItems] = useState<string[]>(Array.isArray(value) ? value : []);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const c = items.slice();
    [c[i], c[j]] = [c[j], c[i]];
    setItems(c);
  };
  /** سحب صورة إلى مكان أخرى */
  const dropAt = (to: number) => {
    if (drag == null || drag === to) return;
    const c = items.slice();
    const [x] = c.splice(drag, 1);
    c.splice(to, 0, x);
    setItems(c);
  };
  return (
    <div className="field">
      <label>{label}</label>
      {items.length > 1 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
          <small style={{ color: 'var(--muted)' }}>{items.length} صورة — اسحب صورة لتغيير مكانها.</small>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setItems([...items].sort(byName))}>رتّب بالاسم</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setItems([...items].reverse())}>اعكس الترتيب</button>
          <button type="button" className="btn btn--ghost btn--sm"
                  onClick={() => { if (confirm(`حذف الصور كلها (${items.length}) من هذا المعرض؟ تبقى في المكتبة.`)) setItems([]); }}>امسح الكل</button>
        </div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10 }}>
        {items.map((src, i) => (
          <div key={src + i} draggable
               onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); setDrag(i); }}
               onDragOver={(e) => { if (drag != null) e.preventDefault(); }}
               onDrop={(e) => { e.preventDefault(); dropAt(i); setDrag(null); }}
               onDragEnd={() => setDrag(null)}
               style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 6, cursor: 'grab', opacity: drag === i ? 0.4 : 1, position: 'relative' }}>
            <b style={{ position: 'absolute', top: 10, insetInlineStart: 10, background: 'rgba(15,27,45,.75)', color: '#fff',
                        borderRadius: 99, minWidth: 20, height: 20, fontSize: 11, display: 'grid', placeItems: 'center', padding: '0 5px' }}>{i + 1}</b>
            <input type="hidden" name={`${name}.${i}`} value={src} />
            <div style={{ height: 78, display: 'grid', placeItems: 'center', background: '#f5f8fc', borderRadius: 6, overflow: 'hidden' }}>
              <img src={'/' + src.replace(/^\//, '')} alt="" loading="lazy"
                   style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'center' }}>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, -1)} disabled={i === 0} title="قبل">→</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} title="بعد">←</button>
              <button type="button" className="btn btn--bad btn--sm"
                      onClick={() => setItems(items.filter((_, n) => n !== i))}>حذف</button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setOpen(true)}
                style={{
                  border: '2px dashed var(--line)', borderRadius: 8, background: '#fbfcfe',
                  minHeight: 118, cursor: 'pointer', font: 'inherit', color: 'var(--muted)',
                }}>
          + أضف صورًا
        </button>
      </div>
      {hint ? <p className="field__hint">{hint}</p> : null}
      {/* عدّة صور معًا: تُضاف بعد الموجود بالترتيب المختار، بلا تكرار صورة موجودة */}
      <MediaPicker open={open} kind="image" onClose={() => setOpen(false)} already={items}
                   onPick={(p) => setItems([...items, p])}
                   onPickMany={(ps) => setItems((cur) => [...cur, ...ps.filter((p) => !cur.includes(p))])} />
    </div>
  );
}

/* --------------------------------------------- اقتراحات تُضاف بضغطة
   الحقل الفارغ أصعب من الحقل الممتلئ: من يفتح قسمًا جديدًا يرى حقولًا بيضاء
   ولا يعرف بم يبدأ. فتُعرض هنا صيغ جاهزة يضغطها فتُضاف ثم يعدّل عليها.

   وما يُضغط هو ما يُضاف فقط: لا نملأ القسم بنصّ لم يختره أحد فيُنشر سهوًا. */
function Suggest({ list, used, onPick, mode = 'add' }: {
  list?: { label: string; value: any }[];
  /** ما أُضيف بالفعل فلا يُعرض ثانيةً (بالمقارنة النصّية للقيمة) */
  used?: any[];
  onPick: (v: any) => void;
  /** add: يُضاف إلى القائمة · fill: يملأ حقلًا واحدًا */
  mode?: 'add' | 'fill';
}) {
  if (!list?.length) return null;
  const seen = new Set((used ?? []).map((v) => JSON.stringify(v)));
  const rest = list.filter((s) => !seen.has(JSON.stringify(s.value)));
  if (!rest.length) return null;
  return (
    <div className="sugg">
      <small>{mode === 'fill' ? 'اقتراحات — اضغط ليُكتب' : 'اقتراحات — اضغط ليُضاف'}</small>
      <div className="sugg__row">
        {rest.map((s, i) => (
          <button type="button" key={i} className="sugg__one"
                  onClick={() => onPick(structuredClone(s.value))}>{s.label}</button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------- قائمة نصوص مفردة */
function PlainList({ name, label, hint, value, placeholder, suggest }: Any) {
  const [items, setItems] = useState<string[]>(Array.isArray(value) ? value : []);
  return (
    <div className="field">
      <label>{label}</label>
      <Suggest list={suggest} used={items} onPick={(v) => setItems([...items, v])} />
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input type="text" name={`${name}.${i}`} dir="ltr" value={it} placeholder={placeholder}
                 onChange={(e) => setItems(items.map((x, n) => (n === i ? e.target.value : x)))} />
          <button type="button" className="btn btn--bad btn--sm"
                  onClick={() => setItems(items.filter((_, n) => n !== i))}>حذف</button>
        </div>
      ))}
      <button type="button" className="btn btn--ghost btn--sm"
              onClick={() => setItems([...items, ''])}>+ سطر</button>
      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------- اختيار لوجوهات بالضغط
   شريط اللوجوهات كان حقل أسطر: تكتب معرّف كل ماركة بسطر وتحفظه عن ظهر قلب.
   وهي بيانات موجودة عندنا أصلًا، فالأولى أن تُعرض ليضغط عليها.

   ما يُحفظ لم يتغيّر: مصفوفة معرّفات بنفس الأسماء المنقوطة، فالصفحات القديمة
   تُقرأ كما هي، ومعرّف لم يعد له ماركة يبقى ظاهرًا ليُحذف بوعي لا أن يختفي. */
function BrandsField({ name, label, hint, value }: Any) {
  const [picked, setPicked] = useState<string[]>(
    Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []);
  const [all, setAll] = useState<{ slug: string; name: string; logo: string | null }[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/admin/brands')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (alive) setAll(d.brands ?? []); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const by = new Map((all ?? []).map((b) => [b.slug, b]));
  const rest = (all ?? []).filter((b) => !picked.includes(b.slug));
  const move = (i: number, d: number) => {
    const n = [...picked]; const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    setPicked(n);
  };
  /* ماركة بلا لوجو لا تظهر في الشريط (يرشّحها Logostrip)، فالأوضح تنبيه من
     يختارها هنا بدل أن يحفظ ثم يسأل لماذا لا يراها. */
  const noLogo = (slug: string) => by.has(slug) && !by.get(slug)!.logo;

  return (
    <div className="field">
      <label>{label}</label>
      {picked.map((slug, i) => (
        <input key={`v-${i}`} type="hidden" name={`${name}.${i}`} value={slug} />
      ))}

      {picked.length ? (
        <ul className="brandpick__on">
          {picked.map((slug, i) => (
            <li key={slug + i}>
              <span className="brandpick__thumb">
                {by.get(slug)?.logo
                  ? <img src={by.get(slug)!.logo!} alt="" />
                  : <b dir="ltr">{slug}</b>}
              </span>
              <span className="brandpick__name">
                {by.get(slug)?.name ?? slug}
                {noLogo(slug) ? <em>بلا لوجو — لن تظهر في الشريط</em> : null}
                {all && !by.has(slug) ? <em>ماركة محذوفة</em> : null}
              </span>
              <span className="brandpick__acts">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, -1)}
                        disabled={i === 0} aria-label="قدّمها">↑</button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, 1)}
                        disabled={i === picked.length - 1} aria-label="أخّرها">↓</button>
                <button type="button" className="btn btn--bad btn--sm"
                        onClick={() => setPicked(picked.filter((_, n) => n !== i))}>احذفها</button>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="field__hint" style={{ marginTop: 0 }}>لم تختر ماركة بعد.</p>}

      {failed ? (
        <p className="field__hint">تعذّر تحميل قائمة الماركات. حدّث الصفحة.</p>
      ) : !all ? (
        <p className="field__hint">يُحمّل الماركات…</p>
      ) : rest.length ? (
        <>
          <div className="brandpick__head">
            <small>اضغط لتضيفها</small>
            <button type="button" className="btn btn--ghost btn--sm"
                    onClick={() => setPicked([...picked, ...rest.filter((b) => b.logo).map((b) => b.slug)])}>
              أضف كل ما له لوجو
            </button>
          </div>
          <div className="brandpick">
            {rest.map((b) => (
              <button type="button" key={b.slug} className="brandpick__one"
                      onClick={() => setPicked([...picked, b.slug])}>
                {b.logo ? <img src={b.logo} alt="" /> : <span className="brandpick__nologo">بلا لوجو</span>}
                <small>{b.name}</small>
              </button>
            ))}
          </div>
        </>
      ) : <p className="field__hint">كل الماركات مختارة.</p>}

      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  );
}

/* --------------------------------------------------- رابط ونصّه */
function LinkField({ name, label, hint, value }: Any) {
  const v = value ?? {};
  return (
    <fieldset style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
      <legend style={{ fontWeight: 600, fontSize: 14, padding: '0 6px' }}>{label}</legend>
      <div className="field">
        <label>ينقل إلى</label>
        <input type="text" name={`${name}.href`} dir="ltr" defaultValue={v.href ?? ''}
               placeholder="overhaul.html#repower" />
      </div>
      <Dual name={`${name}.label`} label="نص الزر" value={v.label} />
      {hint ? <p className="field__hint">{hint}</p> : null}
    </fieldset>
  );
}

/* ---------------------------------------- قائمة عناصر لكلٍّ حقوله */
function Repeat({ name, label, hint, value, of, item, suggest }: Any) {
  const [rows, setRows] = useState<any[]>(Array.isArray(value) ? value : value ? [value] : []);
  const [rev, setRev] = useState(0);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const copy = rows.slice();
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setRows(copy);
  };
  return (
    <div className="field">
      <label>{label}</label>
      {hint ? <p className="field__hint" style={{ marginTop: 0, marginBottom: 10 }}>{hint}</p> : null}
      {/* الصفوف مركّبة بالمفتاح rev: الاقتراح يضيف صفًّا بقيم، وحقول الصفّ
          تحتفظ بقيمتها الابتدائية داخلها، فبلا إعادة تركيب يظهر الصفّ فارغًا. */}
      <Suggest list={suggest} used={rows}
               onPick={(v) => { setRows([...rows, v]); setRev((r) => r + 1); }} />
      {rows.map((row, i) => (
        <div key={`${rev}-${i}`} style={{
          border: '1px solid var(--line)', borderRadius: 8, padding: 14,
          marginBottom: 12, background: '#fbfcfe',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <b style={{ fontSize: 14 }}>{item} {i + 1}</b>
            <span style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>↓</button>
              <button type="button" className="btn btn--bad btn--sm"
                      onClick={() => setRows(rows.filter((_, n) => n !== i))}>حذف</button>
            </span>
          </div>
          {(of as Field[]).map((f) => (
            <FieldView key={f.name} f={f} name={`${name}.${i}.${f.name}`} value={row?.[f.name]} />
          ))}
        </div>
      ))}
      <button type="button" className="btn btn--ghost btn--sm"
              onClick={() => setRows([...rows, {}])}>+ {item}</button>
    </div>
  );
}

/* ------------------------------------------------------------ التوزيع */
export function FieldView({ f, name, value }: { f: Field; name: string; value: any }) {
  switch (f.kind) {
    case 'dual': return <Dual name={name} label={f.label} hint={f.hint} value={value} suggest={f.suggest} />;
    case 'long': return <Dual name={name} label={f.label} hint={f.hint} value={value} suggest={f.suggest} long />;
    case 'image': return <ImageField name={name} label={f.label} hint={f.hint} value={value} />;
    case 'list': return <ListField name={name} label={f.label} hint={f.hint} value={value} suggest={f.suggest} />;
    case 'images': return <ImageList name={name} label={f.label} hint={f.hint} value={value} />;
    case 'video': return <ImageField name={name} label={f.label} hint={f.hint} value={value} kind="video" />;
    case 'file': return <ImageField name={name} label={f.label} hint={f.hint ?? 'ارفعه أولًا من «الصور والفيديو»، ثم اختره من هنا.'} value={value} kind="document" />;
    case 'texts': return <PlainList name={name} label={f.label} hint={f.hint} value={value} suggest={f.suggest} placeholder="" />;
    case 'brands': return <BrandsField name={name} label={f.label} hint={f.hint} value={value} />;
    case 'num':
      return (
        <div className="field">
          <label>{f.label}</label>
          <input type="number" name={name} defaultValue={value ?? ''} />
          {f.hint ? <p className="field__hint">{f.hint}</p> : null}
        </div>
      );
    case 'refs': return <PlainList name={name} label={f.label} hint={f.hint ?? 'معرّف منتج في كل سطر.'} value={value} placeholder="genset-canopy" />;
    case 'link': return <LinkField name={name} label={f.label} hint={f.hint} value={value} />;
    case 'repeat': return <Repeat name={name} label={f.label} hint={f.hint} value={value} of={f.of} item={f.item ?? 'عنصر'} suggest={f.suggest} />;
    case 'group':
      return (
        <fieldset style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <legend style={{ fontWeight: 600, fontSize: 14, padding: '0 6px' }}>{f.label}</legend>
          {(f.of ?? []).map((sub) => (
            <FieldView key={sub.name} f={sub} name={`${name}.${sub.name}`} value={value?.[sub.name]} />
          ))}
          {f.hint ? <p className="field__hint">{f.hint}</p> : null}
        </fieldset>
      );
    case 'choice':
      return (
        <div className="field">
          <label>{f.label}</label>
          <select name={name} defaultValue={value ?? ''}>
            {(f.options ?? []).map(([v, l]) => <option value={v} key={v}>{l}</option>)}
          </select>
          {f.hint ? <p className="field__hint">{f.hint}</p> : null}
        </div>
      );
    case 'bool':
      return (
        <div className="field">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
            <input type="checkbox" name={name} defaultChecked={Boolean(value)} style={{ width: 'auto' }} />
            {f.label}
          </label>
          {f.hint ? <p className="field__hint">{f.hint}</p> : null}
        </div>
      );
    default:
      return (
        <div className="field">
          <label>{f.label}</label>
          <input type="text" name={name} dir="ltr" defaultValue={value ?? ''} />
          {f.hint ? <p className="field__hint">{f.hint}</p> : null}
        </div>
      );
  }
}
