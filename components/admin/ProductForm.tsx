'use client';
/* نموذج المنتج: بياناته الأساسية أولًا ثم تفاصيله، وكلٌّ في لوحة مستقلة كي
   تبقى الشاشة مقروءة رغم طولها. */
import { FieldView } from './Fields';
import { PRODUCT_FIELDS } from '@/lib/productSchema';
import { SubcatField } from './SubcatField';
import type { Subcat } from '@/lib/subcats';
import { ConfirmButton } from '@/components/ConfirmButton';

type Any = Record<string, any>;

const CATS: [string, string][] = [
  ['power', 'توليد الطاقة'],
  ['environmental', 'المعدات البيئية'],
  ['parts', 'قطع الغيار'],
];

export function ProductForm({
  p, data, brands, all, subs, action, remove, usedIn = [], canEdit = true, canPublish = true,
}: {
  p: Any; data: Any; brands: Any[]; all: Any[]; subs: Subcat[]; action: any; remove: any;
  usedIn?: { slug: string; title: string }[]; canEdit?: boolean; canPublish?: boolean;
}) {
  const where = usedIn.map((u) => u.title).join('، ');
  return (
    <>
      <form action={action}>
        {!canEdit ? <p className="msg msg--bad">عندك صلاحية النشر فقط: تقدر تنشر المنتج أو تسحبه، ولا تعدّل بياناته.</p> : null}
        <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head"><h2>البيانات الأساسية</h2></div>
          <div className="panel__body">
            <div className="row">
              <div className="field">
                <label htmlFor="name_ar">الاسم بالعربية</label>
                <input id="name_ar" name="name_ar" type="text" defaultValue={p.name_ar ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="name_en">الاسم بالإنجليزية</label>
                <input id="name_en" name="name_en" type="text" dir="ltr" defaultValue={p.name_en ?? ''} />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="type_ar">النوع بالعربية</label>
                <input id="type_ar" name="type_ar" type="text" defaultValue={p.type_ar ?? ''} />
                <p className="field__hint">السطر الصغير تحت الاسم، مثل «مولد ديزل بكابينة».</p>
              </div>
              <div className="field">
                <label htmlFor="type_en">النوع بالإنجليزية</label>
                <input id="type_en" name="type_en" type="text" dir="ltr" defaultValue={p.type_en ?? ''} />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="description_ar">الوصف بالعربية</label>
                <textarea id="description_ar" name="description_ar" defaultValue={p.description_ar ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="description_en">الوصف بالإنجليزية</label>
                <textarea id="description_en" name="description_en" dir="ltr" defaultValue={p.description_en ?? ''} />
              </div>
            </div>

            <FieldView f={{ name: 'hero_image', label: 'الصورة الرئيسية', kind: 'image', hint: 'تظهر في كروت المنتج وأعلى صفحته.' }}
                       name="hero_image" value={p.hero_image} />

            <div className="row">
              <div className="field">
                <label htmlFor="category">التصنيف</label>
                <select id="category" name="category" defaultValue={p.category ?? 'power'}>
                  {CATS.map(([c, l]) => <option value={c} key={c}>{l}</option>)}
                </select>
              </div>
              <SubcatField subs={subs} value={p.subcategory ?? null} />
            </div>
            <div className="field">
              <label htmlFor="brand_id">الماركة</label>
              <select id="brand_id" name="brand_id" defaultValue={p.brand_id ?? ''}>
                <option value="">بلا ماركة</option>
                {brands.map((b) => <option value={b.id} key={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="sku">رقم القطعة / الموديل</label>
                <input id="sku" name="sku" type="text" dir="ltr" defaultValue={p.sku ?? ''} placeholder="P/N 1R-0750" />
                <p className="field__hint">اختياري. يظهر في المتجر ويُبحث به.</p>
              </div>
              <div className="field">
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500, marginTop: 26 }}>
                  <input type="checkbox" name="store_hidden" defaultChecked={Boolean(p.store_hidden)} style={{ width: 'auto' }} />
                  أخفِه من صفحة المتجر
                </label>
                <p className="field__hint">يبقى في الكتالوج وصفحته، ولا يظهر في المتجر.</p>
              </div>
            </div>
          </div>
        </div>

        {PRODUCT_FIELDS.map((f) => (
          <div className="panel" style={{ marginBottom: 20 }} key={f.name}>
            <div className="panel__head"><h2>{f.label}</h2></div>
            <div className="panel__body">
              <FieldView f={{ ...f, label: '' }} name={f.name} value={data?.[f.name]} />
            </div>
          </div>
        ))}
        </fieldset>

        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__body">
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
              <input type="checkbox" name="published" defaultChecked={Boolean(p.published)} disabled={!canPublish} style={{ width: 'auto' }} />
              منشور — يظهر للزائر في الكتالوج والبحث والمتجر
            </label>
            {!canPublish ? <p className="field__hint">النشر والسحب لمن عنده صلاحية «نشر المنتجات».</p> : null}
          </div>
        </div>

        <button className="btn" type="submit">احفظ المنتج</button>
      </form>

      {remove ? (
        <form action={remove} style={{ marginTop: 34, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
          {usedIn.length ? (
            <p className="msg msg--bad">
              هذا المنتج ظاهر في كروت: {usedIn.map((u, i) => <span key={u.slug}>{i ? '، ' : ''}<a href={`/admin/edit/${u.slug}`}>{u.title}</a></span>)}.
              لو حذفته يختفي كارته منها.
            </p>
          ) : null}
          <ConfirmButton className="btn btn--bad"
                         message={`حذف «${p.name_ar || p.name_en || p.slug}»؟${where ? ` سيختفي من كروت: ${where}.` : ''} تبقى نسخة منه في «التراجع عن تعديل».`}>
            احذف هذا المنتج
          </ConfirmButton>
          <p className="field__hint">تُحفظ نسخة منه في «التراجع عن تعديل» قبل الحذف، فتقدر ترجعه.</p>
        </form>
      ) : null}
    </>
  );
}
