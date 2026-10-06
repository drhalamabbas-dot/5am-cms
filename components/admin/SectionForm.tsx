'use client';
/* نموذج القسم.

   ما يُحرَّر كل مرة ظاهر، وما يُضبط مرة ثم يُنسى مطويّ تحت «خيارات إضافية».
   شاشة من أربعة حقول تُملأ؛ وشاشة من ثلاثة عشر تُؤجَّل. */
import { FieldView } from './Fields';
import type { TypeSpec } from '@/lib/sectionSchema';

export function SectionForm({
  spec, content, anchor, action, slug,
}: { spec: TypeSpec; content: any; anchor: string | null; action: any; slug: string }) {
  const main = spec.fields.filter((f) => !f.advanced);
  const extra = spec.fields.filter((f) => f.advanced);
  /* الدرج يبقى مغلقًا، لكنه يقول كم حقلًا فيه محتوى — فلا يُفاجأ من يحرّر
     بنصّ لم يره، ولا يُغرَق بثلاثة عشر حقلًا ليعدّل عنوانًا. */
  const filled = extra.filter((f) => {
    const v = content?.[f.name];
    return Array.isArray(v) ? v.length > 0 : v != null && v !== '' && v !== false;
  }).length;

  return (
    <form action={action}>
      {spec.hint ? (
        <p className="msg" style={{ background: '#eef3fa', color: '#3b4c64' }}>{spec.hint}</p>
      ) : null}

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel__body">
          {spec.fields.length === 0 ? (
            <p className="empty">هذا القسم لا نصوص فيه — محتواه من إعدادات أخرى.</p>
          ) : (
            main.map((f) => (
              <FieldView key={f.name} f={f} name={f.name} value={content?.[f.name]} />
            ))
          )}
        </div>
      </div>

      {extra.length ? (
        <details className="more" style={{ marginBottom: 18 }}>
          <summary>
            خيارات إضافية
            {filled ? <span className="tag" style={{ marginInlineStart: 8 }}>{filled} مملوء</span> : null}
          </summary>
          <div className="more__body">
            {extra.map((f) => (
              <FieldView key={f.name} f={f} name={f.name} value={content?.[f.name]} />
            ))}

            <div className="field">
              <label htmlFor="anchor">رابط مباشر لهذا القسم</label>
              <input id="anchor" name="anchor" type="text" dir="ltr" defaultValue={anchor ?? ''}
                     placeholder="repower" />
              <p className="field__hint">
                اسم قصير بالإنجليزية يصير رابطًا يفتح الصفحة عند هذا القسم:
                <code dir="ltr"> {slug}.html#{anchor || 'الاسم'}</code>.
                اتركه فارغًا إن لم تحتجه.
              </p>
            </div>
          </div>
        </details>
      ) : (
        <input type="hidden" name="anchor" value={anchor ?? ''} />
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn" type="submit">احفظ</button>
        <a className="btn btn--ghost" href={`/admin/pages/${slug}`}>إلغاء</a>
      </div>
    </form>
  );
}
