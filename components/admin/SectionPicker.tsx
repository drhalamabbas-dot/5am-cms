'use client';
/* اختيار نوع القسم بالصورة، وموضعه في الصفحة.

   الاسم وحده لا يقول شيئًا لمن لم يبنِ الصفحة: «حكاية» و«صف مميّز» كلاهما
   كلام. هنا يرى الشكل ويضغط عليه.

   والموضع يُختار هنا أيضًا، فإدخال قسم بين قسمين لا يحتاج إضافةً في الآخر ثم
   صعودًا بالأسهم. وزرّ «+ تحته» في كل صفّ يضع العلامة في العنوان، فيصل إلى
   هنا والموضع مختار سلفًا.
*/
import { useEffect, useState } from 'react';
import { SectionShape } from './SectionShapes';

type Opt = { type: string; label: string; hint?: string };
type Where = { id: number; label: string };

export function SectionPicker({
  options, after = [], initialAfter = 0,
}: { options: Opt[]; after?: Where[]; initialAfter?: number }) {
  const [picked, setPicked] = useState(options[0]?.type ?? '');
  /* «+ قسم هنا» على الموقع يفتح المحرّر والموضع مختار مسبقًا */
  const [where, setWhere] = useState(
    after.some((a) => a.id === initialAfter) ? String(initialAfter) : '0'
  );

  /* زرّ «+ تحته» في صفّ القسم يحمل data-add-after، فيُختار الموضع هنا
     ويُنزَل إلى النموذج — بدل أن يبحث المستعمل عنه. */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.('[data-add-after]') as HTMLElement | null;
      if (!a) return;
      setWhere(a.dataset.addAfter ?? '0');
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <>
      <input type="hidden" name="type" value={picked} />

      {after.length ? (
        <div className="field" style={{ maxWidth: 420 }}>
          <label htmlFor="after">مكانه في الصفحة</label>
          <select id="after" name="after" value={where} onChange={(e) => setWhere(e.target.value)}>
            <option value="0">في آخر الصفحة</option>
            {after.map((a, i) => (
              <option value={a.id} key={a.id}>بعد: {i + 1} · {a.label}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="shapes">
        {options.map((o) => (
          <button type="button" key={o.type}
                  className={`shape ${picked === o.type ? 'is-on' : ''}`}
                  aria-pressed={picked === o.type}
                  onClick={() => setPicked(o.type)}>
            <SectionShape type={o.type} />
            <b>{o.label}</b>
            {o.hint ? <small>{o.hint}</small> : null}
          </button>
        ))}
      </div>
    </>
  );
}
