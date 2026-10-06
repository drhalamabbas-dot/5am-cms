/* =============================================================================
   أزرار التحرير التي تظهر على الموقع نفسه — لصاحب الموقع وحده.

   المشكلة التي تحلّها: لتغيير سطر كان على صاحب الموقع أن يفتح اللوحة، ويبحث
   عن الصفحة بين اثنتين وعشرين، ويفتحها، ثم يبحث عن القسم بين أقسامها بلا أن
   يرى أيّها أيّ. هنا يرى القسم على الشاشة، وفوقه كل ما يُفعل به: يعدّله،
   يحرّكه، يخفيه، يحذفه، أو يضيف قسمًا تحته.

   الزائر لا يرى من هذا شيئًا: لا تُرسَم هذه العناصر إلا حين تثبت الجلسة على
   السيرفر. ولا تُرسل إلى المتصفح أصلًا دونها. وكل زرّ يعيد التحقّق من
   الجلسة عند الضغط (lib/siteEdit.ts).
============================================================================= */
import { ConfirmButton } from '@/components/ConfirmButton';
import { siteMoveSection, siteToggleSection, siteDeleteSection } from '@/lib/siteEdit';

/** شريط عائم أسفل الشاشة: اسم الصفحة أو المنتج، وزرّ يفتحه في اللوحة. */
export function EditBar({ href, label, draft }: { href: string; label: string; draft?: boolean }) {
  return (
    <div className="ux-editbar" dir="rtl">
      <span className="ux-editbar__who">
        {draft ? <b className="ux-editbar__draft">مسوّدة — لا يراها الزائر</b> : null}
        {label}
      </span>
      <a className="ux-editbar__go" href={href}>عدّل هذه الصفحة</a>
      <a className="ux-editbar__out" href="/admin" title="لوحة التحكم">لوحة التحكم</a>
    </div>
  );
}

const Pen = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

/** شريط فوق القسم: اسمه، وكل ما يُفعل به. */
export function EditSection({
  slug, id, label, index, count, hidden, back,
}: {
  slug: string; id: number; label: string;
  index: number; count: number; hidden: boolean;
  /** عنوان الصفحة الحالية بلغتها، يُعاد إليه بعد كل زرّ */
  back: string;
}) {
  const Hidden = () => (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
    </>
  );
  return (
    <div className={`ux-edittools${hidden ? ' is-hidden' : ''}`} id={`ux-sec-${id}`} dir="rtl">
     <div className="ux-edittools__bar">
      <a className="ux-edittools__main" href={`/admin/pages/${slug}/sections/${id}`}
         title={`عدّل: ${label}`}>
        <Pen /><span>{label}</span>
      </a>
      {hidden ? <b className="ux-edittools__flag">مخفي عن الزائر</b> : null}

      <form action={siteMoveSection}>
        <Hidden /><input type="hidden" name="dir" value={-1} />
        <button type="submit" disabled={index === 0} title="انقله لأعلى" aria-label="انقل القسم لأعلى">↑</button>
      </form>
      <form action={siteMoveSection}>
        <Hidden /><input type="hidden" name="dir" value={1} />
        <button type="submit" disabled={index === count - 1} title="انقله لأسفل" aria-label="انقل القسم لأسفل">↓</button>
      </form>
      <form action={siteToggleSection}>
        <Hidden />
        <button type="submit">{hidden ? 'أظهره' : 'أخفِه'}</button>
      </form>
      <a href={`/admin/pages/${slug}?after=${id}#add-section`} title="أضف قسمًا جديدًا تحت هذا">+ قسم تحته</a>
      <form action={siteDeleteSection}>
        <Hidden />
        <ConfirmButton
          className="ux-edittools__del"
          message={`حذف قسم «${label}»؟\n\nتقدر ترجعه بعدين من «التراجع عن تعديل» في لوحة التحكم.\nلو عاوز تخفيه بس من غير حذف، اضغط «إلغاء» واختر «أخفِه».`}
        >
          حذف
        </ConfirmButton>
      </form>
     </div>
    </div>
  );
}
