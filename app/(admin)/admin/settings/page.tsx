/* بيانات الشركة والتواصل.

   هذه البيانات تظهر في الهيدر والفوتر وصفحة التواصل ونموذج عرض السعر معًا،
   فتغييرها هنا يغيّرها في كل مكان — لا يُبحث عنها صفحةً صفحة.

   ما لا يظهر في هذا النموذج من مفاتيح يبقى كما هو: النموذج يكتب فوق نسخة من
   الإعداد لا يستبدلها. */
import { redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { q } from '@/lib/db';
import { getSetting } from '@/lib/content';
import { Shell } from '@/components/admin/Shell';
import { refreshSite, str, J } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({
  searchParams,
}: { searchParams: Promise<{ ok?: string }> }) {
  const user = await requirePerm('settings.edit');
  const saved = (await searchParams).ok;
  const c = await getSetting<any>('company', {});

  async function save(form: FormData) {
    'use server';
    const who = await requirePerm('settings.edit');
    const before = await getSetting<any>('company', {});
    const next = {
      ...before,
      legalName: str(form, 'legalName') ?? before.legalName,
      short: str(form, 'short') ?? before.short,
      tagline: str(form, 'tagline') ?? before.tagline,
      phone: str(form, 'phone') ?? before.phone,
      phoneIntl: str(form, 'phoneIntl') ?? before.phoneIntl,
      email: str(form, 'email') ?? before.email,
      address: str(form, 'address') ?? before.address,
      geo: str(form, 'geo') ?? before.geo,
      hq: { en: str(form, 'hq.en') ?? '', ar: str(form, 'hq.ar') ?? '' },
      serviceCenter: {
        en: str(form, 'sc.en') ?? '',
        ar: str(form, 'sc.ar') ?? '',
        map: str(form, 'sc.map') ?? '',
      },
      social: {
        ...(before.social ?? {}),
        linkedin: str(form, 'social.linkedin') ?? '#',
        facebook: str(form, 'social.facebook') ?? '#',
        youtube: str(form, 'social.youtube') ?? '#',
      },
    };
    await q('UPDATE settings SET `value` = ? WHERE `key` = ?', [J(next), 'company']);
    /* بيانات التواصل مخزّنة مرتين في الموقع القديم؛ تُحدَّث معها كي لا تتفرّقا. */
    await q('UPDATE settings SET `value` = ? WHERE `key` = ?', [
      J({
        phone: next.phone, phoneIntl: next.phoneIntl, email: next.email,
        address: next.address, geo: next.geo, hq: next.hq, serviceCenter: next.serviceCenter,
      }),
      'contact',
    ]);
    await audit(who, 'settings.save', { entity: 'setting', id: 'company', before, after: next });
    refreshSite();
    redirect('/admin/settings?ok=1');
  }

  return (
    <Shell user={user} here="/admin/settings" title="بيانات الشركة والتواصل"
           trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub="تظهر في الهيدر والفوتر وصفحة التواصل ونموذج عرض السعر. تغييرها هنا يغيّرها في كل مكان.">
      {saved ? <p className="msg msg--ok">حُفظت البيانات.</p> : null}

      <form action={save}>
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head"><h2>التواصل</h2></div>
          <div className="panel__body">
            <div className="row">
              <div className="field">
                <label htmlFor="phone">رقم الهاتف كما يظهر</label>
                <input id="phone" name="phone" type="text" dir="ltr" defaultValue={c.phone ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="phoneIntl">الرقم للاتصال</label>
                <input id="phoneIntl" name="phoneIntl" type="text" dir="ltr" defaultValue={c.phoneIntl ?? ''} />
                <p className="field__hint">بصيغة دولية بلا مسافات، مثل +201113974600. هو ما يُطلَب عند الضغط.</p>
              </div>
            </div>
            <div className="field">
              <label htmlFor="email">البريد الإلكتروني</label>
              <input id="email" name="email" type="email" dir="ltr" defaultValue={c.email ?? ''} />
              <p className="field__hint">تصل إليه طلبات عرض السعر.</p>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="social.linkedin">لينكدإن</label>
                <input id="social.linkedin" name="social.linkedin" type="text" dir="ltr" defaultValue={c.social?.linkedin ?? '#'} />
              </div>
              <div className="field">
                <label htmlFor="social.facebook">فيسبوك</label>
                <input id="social.facebook" name="social.facebook" type="text" dir="ltr" defaultValue={c.social?.facebook ?? '#'} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="social.youtube">يوتيوب</label>
              <input id="social.youtube" name="social.youtube" type="text" dir="ltr" defaultValue={c.social?.youtube ?? '#'} />
              <p className="field__hint">اتركها # إن لم يكن هناك حساب — الأيقونة تبقى بلا وجهة.</p>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head"><h2>العناوين والخرائط</h2></div>
          <div className="panel__body">
            <div className="row">
              <div className="field">
                <label htmlFor="hq.ar">المقر الرئيسي بالعربية</label>
                <textarea id="hq.ar" name="hq.ar" defaultValue={c.hq?.ar ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="hq.en">Head office</label>
                <textarea id="hq.en" name="hq.en" dir="ltr" defaultValue={c.hq?.en ?? ''} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="geo">إحداثيات المقر</label>
              <input id="geo" name="geo" type="text" dir="ltr" defaultValue={c.geo ?? ''} />
              <p className="field__hint">
                خطّا الطول والعرض مفصولين بفاصلة. تجدهما بالضغط المطوّل على المكان في خرائط Google.
                هما ما ترسمه الخريطة في صفحة التواصل.
              </p>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="sc.ar">مركز الخدمة بالعربية</label>
                <textarea id="sc.ar" name="sc.ar" defaultValue={c.serviceCenter?.ar ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="sc.en">Service center</label>
                <textarea id="sc.en" name="sc.en" dir="ltr" defaultValue={c.serviceCenter?.en ?? ''} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="sc.map">مركز الخدمة على الخريطة</label>
              <input id="sc.map" name="sc.map" type="text" dir="ltr" defaultValue={c.serviceCenter?.map ?? ''} />
              <p className="field__hint">اسم المكان كما تبحث عنه في خرائط Google، مثل Mostorod, Qalyubia, Egypt.</p>
            </div>
            <div className="field">
              <label htmlFor="address">العنوان في بيانات محركات البحث</label>
              <input id="address" name="address" type="text" dir="ltr" defaultValue={c.address ?? ''} />
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head"><h2>اسم الشركة</h2></div>
          <div className="panel__body">
            <div className="field">
              <label htmlFor="legalName">الاسم الرسمي</label>
              <input id="legalName" name="legalName" type="text" dir="ltr" defaultValue={c.legalName ?? ''} />
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="short">الاسم المختصر</label>
                <input id="short" name="short" type="text" dir="ltr" defaultValue={c.short ?? ''} />
              </div>
              <div className="field">
                <label htmlFor="tagline">الشعار</label>
                <input id="tagline" name="tagline" type="text" dir="ltr" defaultValue={c.tagline ?? ''} />
              </div>
            </div>
          </div>
        </div>

        <button className="btn" type="submit">احفظ</button>
      </form>
    </Shell>
  );
}
