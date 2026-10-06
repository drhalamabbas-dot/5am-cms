'use client';
/* =============================================================================
   الهيدر داخل المحرّر المرئي: أسماء عناصر المنيو، وأماكنها، وروابطها.

   الهيدر مشترك بين كل الصفحات، فتعديله هنا يظهر في كل الموقع بعد «احفظ».
   ويُعاين فورًا في الصفحة المفتوحة، كأي تعديل آخر في المحرّر.

   الشجرة كما في القاعدة: عناصر عليا، تحت بعضها قائمة منسدلة أو أعمدة،
   وتحت العمود روابطه. الترتيب بالأسهم بين الإخوة؛ والإخفاء يُبقي العنصر في
   القاعدة دون أن يظهر.
============================================================================= */
import { useState } from 'react';
import { Ico } from './EditorIcons';
import type { NavRow } from '@/lib/nav';

type Props = {
  rows: NavRow[];
  onChange: (rows: NavRow[], key?: string) => void;
  onLink: (id: number) => void;
  newId: () => number;
};

const kindOf = (r: NavRow) => (r.extra && typeof r.extra === 'object' ? r.extra.kind : null) as string | null;
const KIND_AR: Record<string, string> = { mega: 'قائمة كبيرة بأعمدة', submenu: 'قائمة منسدلة', column: 'عمود' };

export function NavPanel({ rows, onChange, onLink, newId }: Props) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const kids = (parent: number | null) =>
    rows.filter((r) => r.parent_id === parent).sort((a, b) => a.position - b.position || a.id - b.id);

  const patch = (id: number, p: Partial<NavRow>, key?: string) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...p } : r)), key);

  /** يحرّك العنصر بين إخوته، ويعيد ترقيم مواضعهم بالترتيب. */
  const move = (id: number, d: number) => {
    const me = rows.find((r) => r.id === id)!;
    const sibs = kids(me.parent_id);
    const i = sibs.findIndex((r) => r.id === id);
    const j = i + d;
    if (j < 0 || j >= sibs.length) return;
    [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
    const pos = new Map(sibs.map((r, k) => [r.id, k]));
    onChange(rows.map((r) => (pos.has(r.id) ? { ...r, position: pos.get(r.id)! } : r)));
  };

  const remove = (id: number) => {
    const all = new Set([id]);
    let grew = true;
    while (grew) {           // العنصر وكل ما تحته
      grew = false;
      for (const r of rows) if (r.parent_id != null && all.has(r.parent_id) && !all.has(r.id)) { all.add(r.id); grew = true; }
    }
    const me = rows.find((r) => r.id === id);
    if (!confirm(`حذف «${me?.label_ar || me?.label_en}»${all.size > 1 ? ` و${all.size - 1} عنصر تحته` : ''} من المنيو؟\nتقدر تتراجع قبل الحفظ.`)) return;
    onChange(rows.filter((r) => !all.has(r.id)));
  };

  const add = (parent: number | null, kind?: string) => {
    const sibs = kids(parent);
    const id = newId();
    onChange([...rows, {
      id, parent_id: parent, area: 'header', position: sibs.length,
      label_en: kind === 'column' ? 'Column' : 'New item', label_ar: kind === 'column' ? 'عمود جديد' : 'عنصر جديد',
      href: kind === 'column' ? null : '#', desc_en: null, desc_ar: null,
      extra: kind ? { kind } : null, published: 1,
    }]);
    if (parent != null) setOpen((s) => new Set(s).add(parent));
  };

  const toggleOpen = (id: number) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  /* دالة ترسم لا مكوّن: مكوّن معرَّف داخل مكوّن يُعاد تركيبه مع كل حرف، فيخرج
     المؤشّر من الحقل بعد كل ضغطة. */
  const item = (r: NavRow, depth: number) => {
    const children = kids(r.id);
    const sibs = kids(r.parent_id);
    const i = sibs.findIndex((x) => x.id === r.id);
    const kind = kindOf(r);
    const isOpen = open.has(r.id);
    const canHaveKids = kind === 'mega' || kind === 'submenu' || kind === 'column';
    return (
      <li key={r.id} className={`ved__nav-item${r.published ? '' : ' is-off'}`} style={{ marginInlineStart: depth * 14 }}>
        <div className="ved__nav-row">
          {canHaveKids ? (
            <button type="button" className="ved__nav-caret" onClick={() => toggleOpen(r.id)}
                    aria-expanded={isOpen} aria-label={isOpen ? 'اطوِ' : 'افتح'}>{isOpen ? '▾' : '◂'}</button>
          ) : <span className="ved__nav-caret" />}
          <input type="text" value={r.label_ar} aria-label="الاسم بالعربية" placeholder="الاسم بالعربية"
                 onChange={(e) => patch(r.id, { label_ar: e.target.value }, `nav:${r.id}:ar`)} />
          <span className="ved__nav-acts">
            <button type="button" onClick={() => move(r.id, -1)} disabled={i <= 0} title="قدّمه"><Ico name="up" size={14} /></button>
            <button type="button" onClick={() => move(r.id, 1)} disabled={i >= sibs.length - 1} title="أخّره"><Ico name="down" size={14} /></button>
            <button type="button" onClick={() => patch(r.id, { published: r.published ? 0 : 1 })}
                    title={r.published ? 'أخفِه من المنيو' : 'أظهره في المنيو'}><Ico name={r.published ? 'eye' : 'eyeOff'} size={14} /></button>
            <button type="button" className="is-bad" onClick={() => remove(r.id)} title="احذفه"><Ico name="trash" size={14} /></button>
          </span>
        </div>
        <div className="ved__nav-sub">
          <input type="text" dir="ltr" value={r.label_en} aria-label="الاسم بالإنجليزية" placeholder="English"
                 onChange={(e) => patch(r.id, { label_en: e.target.value }, `nav:${r.id}:en`)} />
          {kind === 'column' ? <small className="ved__chip">عمود</small> : (
            <button type="button" className="ved__nav-link" onClick={() => onLink(r.id)} title="غيّر الرابط">
              <Ico name="link" size={13} /><span dir="ltr">{r.href || 'بلا رابط'}</span>
            </button>
          )}
          {kind && kind !== 'column' ? <small className="ved__chip">{KIND_AR[kind] ?? kind}</small> : null}
        </div>
        {canHaveKids && isOpen ? (
          <ul className="ved__nav-list">
            {children.map((c) => item(c, 0))}
            <li className="ved__nav-addrow">
              {kind === 'mega' ? (
                <button type="button" onClick={() => add(r.id, 'column')}><Ico name="plus" size={13} /> عمود</button>
              ) : (
                <button type="button" onClick={() => add(r.id)}><Ico name="plus" size={13} /> رابط تحته</button>
              )}
            </li>
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <div className="ved__nav">
      <p className="ved__note" style={{ margin: '0 0 12px' }}>
        <span>الهيدر مشترك بين كل صفحات الموقع: ما تغيّره هنا يظهر في كلها بعد «احفظ».</span>
      </p>
      <ul className="ved__nav-list">
        {kids(null).map((r) => item(r, 0))}
      </ul>
      <button type="button" className="ved__add" style={{ marginTop: 10 }} onClick={() => add(null)}>
        <Ico name="plus" size={16} /> عنصر جديد في المنيو
      </button>
    </div>
  );
}
