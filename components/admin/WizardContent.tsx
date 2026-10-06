'use client';
/* الخطوة الثانية: كل أقسام الصفحة في نموذج واحد.

   يُعرض من كل قسم حقوله الأساسية وحدها — ما يُكتب في كل صفحة. والتفاصيل
   النادرة تبقى في محرّر القسم بعد الإنشاء، فلا تُثقل أول تجربة.
============================================================================= */
import { FieldView } from './Fields';
import { SectionShape } from './SectionShapes';
import { SECTION_TYPES } from '@/lib/sectionSchema';

type S = { id: number; type: string; label: string; content: any };

export function WizardContent({
  hero, sections, action, slug,
}: { hero: any; sections: S[]; action: any; slug: string }) {
  return (
    <form action={action}>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <h2>أعلى الصفحة</h2>
          <small>أول ما يراه الزائر</small>
        </div>
        <div className="panel__body">
          <FieldView f={{ name: 'hero.img', label: 'الصورة الكبيرة', kind: 'image' }}
                     name="hero.img" value={hero?.img} />
          <FieldView f={{ name: 'hero.title', label: 'العنوان الرئيسي', kind: 'dual' }}
                     name="hero.title" value={hero?.title} />
          <FieldView f={{ name: 'hero.lede', label: 'سطر أو سطران تحته', kind: 'long' }}
                     name="hero.lede" value={hero?.lede} />
        </div>
      </div>

      {sections.length === 0 ? (
        <p className="msg">
          هذه الصفحة بلا أقسام. تقدر تضيفها بعد الحفظ من شاشة الصفحة.
        </p>
      ) : null}

      {sections.map((s, i) => {
        const spec = SECTION_TYPES[s.type];
        const main = (spec?.fields ?? []).filter((f) => !f.advanced);
        return (
          <div className="panel" style={{ marginBottom: 20 }} key={s.id}>
            <div className="panel__head">
              <h2>القسم {i + 1} — {s.label}</h2>
              <small>{spec?.pick ?? ''}</small>
            </div>
            <div className="panel__body">
              {/* علامة أن القسم كان في النموذج: قسم فُرِّغت كل صوره لا يرسل
                  غيرها، وبدونها يبدو كأنه لم يكن هنا فلا يُحفظ تفريغه. */}
              <input type="hidden" name="sec" value={s.id} />
              <div className="wiz__row">
                <div className="wiz__prev"><SectionShape type={s.type} /></div>
                <div className="wiz__fields">
                  {main.map((f) => (
                    <FieldView key={f.name} f={f} name={`s${s.id}.${f.name}`} value={s.content?.[f.name]} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn" type="submit">احفظ وتابع ←</button>
        {/* زرّ حفظ لا رابط: الرابط يغلق ويُضيع ما كُتب. */}
        <button className="btn btn--ghost" type="submit" name="go" value="close">احفظ وأكمل لاحقًا</button>
      </div>
      <p className="field__hint">
        اترك أي حقل فارغًا الآن وأكمله بعدين — لا شيء يضيع، والصفحة مسوّدة حتى تنشرها.
      </p>
    </form>
  );
}
