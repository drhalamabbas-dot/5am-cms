'use client';
/* =============================================================================
   حقول محرّر القسم.

   النموذج كله HTML عادي يُرسَل إلى إجراء على السيرفر: كل حقل له اسم منقوط
   («cards.0.title.ar») والسيرفر يعيد تركيب الـ JSON منه. فلا حالة مشتركة ولا
   حفظ ناقص، والصفحة تعمل حتى لو تعطّلت الجافاسكريبت.

   الجافاسكريبت هنا لأمرين فقط: إضافة عنصر إلى قائمة وحذفه، وتغيير ترتيبه.
============================================================================= */
import { useState } from 'react';
import type { Field } from '@/lib/sectionSchema';
import { MediaPicker, byName } from './MediaPicker';

type Any = Record<string, any>;

const D = (v: any) => (v && typeof v === 'object' ? v : { en: v ?? '', ar: '' });

/* --------------------------------------------------------- نص بلغتيه */
function Dual({ name, label, hint, value, long }: Any) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="row">
        <div>
          <small>عربي</small>
          {long
            ? <textarea name={`${name}.ar`} defaultValue={D(value).ar ?? ''} />
            : <input type="text" name={`${name}.ar`} defaultValue={D(value).ar ?? ''} />}
        </div>
        <div dir="ltr">
          <small style={{ display: 'block', textAlign: 'start' }}>English</small>
          {long
            ? <textarea name={`${name}.en`} defaultValue={D(value).en ?? ''} />
            : <input type="text" name={`${name}.en`} defaultValue={D(value).en ?? ''} />}
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
function ListField({ name, label, hint, value }: Any) {
  const [items, setItems] = useState<any[]>(Array.isArray(value) ? value : []);
  const set = (i: number, k: 'en' | 'ar', v: string) =>
    setItems(items.map((x, n) => (n === i ? { ...D(x), [k]: v } : x)));
  return (
    <div className="field">
      <label>{label}</label>
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

/* ------------------------------------------------- قائمة نصوص مفردة */
function PlainList({ name, label, hint, value, placeholder }: Any) {
  const [items, setItems] = useState<string[]>(Array.isArray(value) ? value : []);
  return (
    <div className="field">
      <label>{label}</label>
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
function Repeat({ name, label, hint, value, of, item }: Any) {
  const [rows, setRows] = useState<any[]>(Array.isArray(value) ? value : value ? [value] : []);
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
      {rows.map((row, i) => (
        <div key={i} style={{
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
    case 'dual': return <Dual name={name} label={f.label} hint={f.hint} value={value} />;
    case 'long': return <Dual name={name} label={f.label} hint={f.hint} value={value} long />;
    case 'image': return <ImageField name={name} label={f.label} hint={f.hint} value={value} />;
    case 'list': return <ListField name={name} label={f.label} hint={f.hint} value={value} />;
    case 'images': return <ImageList name={name} label={f.label} hint={f.hint} value={value} />;
    case 'video': return <ImageField name={name} label={f.label} hint={f.hint} value={value} kind="video" />;
    case 'texts': return <PlainList name={name} label={f.label} hint={f.hint} value={value} placeholder="" />;
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
    case 'repeat': return <Repeat name={name} label={f.label} hint={f.hint} value={value} of={f.of} item={f.item ?? 'عنصر'} />;
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
