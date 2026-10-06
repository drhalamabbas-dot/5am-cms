'use client';
/* التصنيف الفرعي: قائمة بما هو مستعمل في التصنيف المختار، و«تصنيف جديد»
   لمن يحتاج مجموعة لم توجد بعد. يتبع اختيار التصنيف في النموذج نفسه. */
import { useEffect, useState } from 'react';
import type { Subcat } from '@/lib/subcats';

export function SubcatField({ subs, value, categoryId = 'category' }: {
  subs: Subcat[]; value: string | null; categoryId?: string;
}) {
  const [cat, setCat] = useState<string>('');
  const known = subs.some((s) => s.value === value);
  const [pick, setPick] = useState<string>(value ? (known ? value : '__new') : '');
  const [custom, setCustom] = useState<string>(value && !known ? value : '');

  /* التصنيف الرئيسي في النموذج نفسه: تتغيّر القائمة معه */
  useEffect(() => {
    const el = document.getElementById(categoryId) as HTMLSelectElement | null;
    if (!el) return;
    setCat(el.value);
    const on = () => setCat(el.value);
    el.addEventListener('change', on);
    return () => el.removeEventListener('change', on);
  }, [categoryId]);

  const list = subs.filter((s) => s.category === cat);
  const out = pick === '__new' ? custom.trim() : pick;
  return (
    <div className="field">
      <label htmlFor="subcategory_pick">التصنيف الفرعي</label>
      <input type="hidden" name="subcategory" value={out} />
      <select id="subcategory_pick" value={pick} onChange={(e) => setPick(e.target.value)}>
        <option value="">— اختر —</option>
        {list.map((s) => (
          <option key={s.value} value={s.value}>{s.ar ? `${s.ar} — ${s.value}` : s.value} ({s.n})</option>
        ))}
        {/* قيمة محفوظة من تصنيف رئيسي آخر: تبقى ظاهرة حتى تُغيَّر */}
        {pick && pick !== '__new' && !list.some((s) => s.value === pick) ? <option value={pick}>{pick}</option> : null}
        <option value="__new">+ تصنيف فرعي جديد…</option>
      </select>
      {pick === '__new' ? (
        <input type="text" dir="ltr" value={custom} onChange={(e) => setCustom(e.target.value)}
               placeholder="Generator Sets" style={{ marginTop: 8 }} autoFocus />
      ) : null}
      <p className="field__hint">
        {out ? 'يظهر المنتج في هذه المجموعة داخل كتالوج المعدات.' : 'بدون تصنيف فرعي لا يظهر المنتج في مجموعات الكتالوج.'}
        {pick === '__new' ? ' التصنيف الجديد يحتاج أن يُضاف لمجموعة في صفحة الكتالوج كي يظهر فيها.' : ''}
      </p>
    </div>
  );
}
