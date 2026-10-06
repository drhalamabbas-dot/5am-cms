/* إعدادات الصفحة: اسمها، وأعلاها، وبيانات محركات البحث، والروابط المقترحة.
   مكوّن عميل لأن حقل الصورة يعرض معاينة أثناء الكتابة. */
'use client';
import { FieldView } from './Fields';

type Any = Record<string, any>;

const j = (v: any): any => {
  if (v == null) return {};
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return {}; } }
  return v;
};

const SOLUTIONS = [
  ['', 'بلا خدمة محدّدة'],
  ['environmental', 'حلول البيئة'],
  ['power', 'بيع المولدات'],
  ['rental', 'إيجار المولدات'],
  ['repowering', 'رفع الكفاءة والعمرات'],
  ['engineering', 'التصنيع والتركيبات'],
  ['parts', 'قطع الغيار'],
  ['service', 'الخدمة والصيانة'],
];

export function PageForm({ page, allPages, action }: { page: Any; allPages: Any[]; action: any }) {
  const hero = j(page.hero);
  /* عمود related قد يكون فارغًا في القاعدة، فيعود كائنًا لا قائمة. */
  const r = j(page.related);
  const related: string[] = Array.isArray(r) ? r : [];

  return (
    <form action={action}>
      <div className="panel" style={{ marginBottom: 22 }}>
        <div className="panel__head" id="top"><h2>أعلى الصفحة</h2></div>
        <div className="panel__body">
          <FieldView f={{ name: 'hero.img', label: 'صورة الخلفية', kind: 'image' }} name="hero.img" value={hero.img} />
          <FieldView f={{ name: 'hero.kicker', label: 'السطر الصغير فوق العنوان', kind: 'dual' }} name="hero.kicker" value={hero.kicker} />
          <FieldView f={{ name: 'hero.title', label: 'العنوان الرئيسي', kind: 'dual' }} name="hero.title" value={hero.title} />
          <FieldView f={{ name: 'hero.lede', label: 'الفقرة تحته', kind: 'long' }} name="hero.lede" value={hero.lede} />
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 22 }}>
        <div className="panel__head"><h2>إعدادات الصفحة</h2></div>
        <div className="panel__body">
          <div className="row">
            <div className="field">
              <label htmlFor="crumb_ar">اسم الصفحة بالعربية</label>
              <input id="crumb_ar" name="crumb_ar" type="text" defaultValue={page.crumb_ar ?? ''} />
            </div>
            <div className="field">
              <label htmlFor="crumb_en">اسم الصفحة بالإنجليزية</label>
              <input id="crumb_en" name="crumb_en" type="text" dir="ltr" defaultValue={page.crumb_en ?? ''} />
            </div>
          </div>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
            <input type="checkbox" name="published" defaultChecked={Boolean(page.published)} style={{ width: 'auto' }} />
            منشورة — يراها الزائر
          </label>
        </div>

        <details className="more" style={{ border: 0, borderTop: '1px solid var(--line)', borderRadius: 0 }}>
          <summary>خيارات إضافية</summary>
          <div className="more__body">
            <div className="row">
              <div className="field">
                <label htmlFor="parent_slug">الصفحة الأعلى في المسار</label>
                <select id="parent_slug" name="parent_slug" defaultValue={page.parent_slug ?? ''}>
                  <option value="">لا شيء</option>
                  {allPages.filter((p) => p.slug !== page.slug).map((p) => (
                    <option value={p.slug} key={p.slug}>{p.crumb_ar || p.crumb_en || p.slug}</option>
                  ))}
                </select>
                <p className="field__hint">تظهر في شريط المسار أعلى الصفحة: الرئيسية / الأعلى / هذه الصفحة.</p>
              </div>
              <div className="field">
                <label htmlFor="quote_solution">الخدمة في نموذج عرض السعر</label>
                <select id="quote_solution" name="quote_solution" defaultValue={page.quote_solution ?? ''}>
                  {SOLUTIONS.map(([v, l]) => <option value={v} key={v}>{l}</option>)}
                </select>
                <p className="field__hint">الزائر القادم من هذه الصفحة يجد الخدمة مختارة له سلفًا.</p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="related">روابط «وصول مباشر للخدمات» أسفل الصفحة</label>
              <textarea id="related" name="related" dir="ltr" defaultValue={related.join('\n')} />
              <p className="field__hint">
                مسار صفحة في كل سطر، مثل <code>parts</code>. هذه هي الروابط التي تنقل الزائر إلى الصفحة التالية.
                <br />المتاح: {allPages.map((p) => p.slug).join(' · ')}
              </p>
            </div>
          </div>
        </details>
      </div>

      <details className="more" style={{ marginBottom: 22 }} id="seo">
        <summary>محركات البحث — ما يظهر في نتيجة جوجل وعند مشاركة الرابط</summary>
        <div className="more__body">
          <div className="row">
            <div className="field">
              <label htmlFor="title_ar">عنوان الصفحة بالعربية</label>
              <input id="title_ar" name="title_ar" type="text" defaultValue={page.title_ar ?? ''} />
              <p className="field__hint">اتركه فارغًا: يُستعمل اسم الصفحة بالعربية.</p>
            </div>
            <div className="field">
              <label htmlFor="title_en">عنوان الصفحة بالإنجليزية</label>
              <input id="title_en" name="title_en" type="text" dir="ltr" defaultValue={page.title_en ?? ''} />
              <p className="field__hint">نحو 60 حرفًا. يظهر سطرًا أزرق في نتيجة البحث.</p>
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="description_ar">وصف الصفحة بالعربية</label>
              <textarea id="description_ar" name="description_ar" defaultValue={page.description_ar ?? ''} />
              <p className="field__hint">اتركه فارغًا: يُستعمل الإنجليزي.</p>
            </div>
            <div className="field">
              <label htmlFor="description_en">وصف الصفحة بالإنجليزية</label>
              <textarea id="description_en" name="description_en" dir="ltr" defaultValue={page.description_en ?? ''} />
              <p className="field__hint">نحو 155 حرفًا. السطران تحت العنوان في نتيجة البحث.</p>
            </div>
          </div>
          <FieldView f={{ name: 'og_image', label: 'صورة المشاركة', kind: 'image', hint: 'تظهر حين يُشارَك رابط الصفحة على واتساب أو فيسبوك.' }}
                     name="og_image" value={page.og_image} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
            <input type="checkbox" name="noindex" defaultChecked={Boolean(page.noindex)} style={{ width: 'auto' }} />
            اطلب من جوجل ألّا يفهرس هذه الصفحة
          </label>
        </div>
      </details>

      <button className="btn" type="submit">احفظ إعدادات الصفحة</button>
    </form>
  );
}
