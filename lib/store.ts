/* =============================================================================
   المتجر: صفحة واحدة (store.html) فيها كل المنتجات وقطع الغيار، وسلة «طلب
   عرض سعر» يرسلها العميل فتصل للمبيعات في «الطلبات».

   سويتش واحد (settings.store.enabled) يقفل المتجر أو يفتحه. القفل لا يحذف شيئًا:
   الصفحة ومنتجاتها وإعداداتها باقية، ويختفي فقط ظهورها للزائر — رابطها في
   المنيو والفوتر، والبحث، وخريطة الموقع، والصفحة نفسها (تحويل للرئيسية أو
   «قريبًا»). وإعادة الفتح ترجع كل شيء كما كان. الأدمن يعاينها وهي مقفولة.
============================================================================= */
import { getSetting } from './content';

export const STORE_SLUG = 'store';

export type StoreSettings = {
  enabled: boolean;
  /** المقفول: home يحوّل الزائر للرئيسية، soon يعرض «المتجر قريبًا» */
  closed: 'home' | 'soon';
};

export async function getStore(): Promise<StoreSettings> {
  const s = await getSetting<Partial<StoreSettings>>('store', {});
  return { enabled: s.enabled !== false, closed: s.closed === 'soon' ? 'soon' : 'home' };
}

/** رابط يشير إلى صفحة المتجر (store.html، أو /store.html#…، أو store) */
export const isStoreHref = (href: string | null | undefined) =>
  !!href && /^\/?store(\.html)?([?#].*)?$/i.test(href.trim());
