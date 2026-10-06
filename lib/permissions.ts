/* =============================================================================
   الصلاحيات: ما يقدر كل موظف يعمله في لوحة التحكم.

   السوبر أدمن يقدر كل شيء، ويفتح ويقفل لكل أدمن كل صلاحية هنا بسويتش. ولكل
   صلاحية مفتاح ثابت يُتحقَّق منه على الخادم في كل عملية — لا الزرّ وحده.

   الأدوار الجاهزة اختصار: تختار «مبيعات» فتُضبط السويتشات، ثم تعدّل ما تريد.
   إدارة حسابات الأدمنز للسوبر أدمن وحده، ولا تُعطى صلاحيةً.

   بلا اعتماد على الخادم: يُستورد في الشاشات (للسويتشات) وفي الفحص.
============================================================================= */

export const PERMISSION_GROUPS: { title: string; items: [string, string, string?][] }[] = [
  {
    title: 'المحتوى',
    items: [
      ['pages.edit', 'تعديل الصفحات والأقسام', 'المحرّر المرئي وشاشات الأقسام'],
      ['pages.publish', 'نشر الصفحات وسحبها'],
      ['pages.create', 'إنشاء صفحات جديدة'],
      ['pages.delete', 'حذف الصفحات'],
      ['nav.edit', 'المنيو والفوتر'],
      ['design.edit', 'ألوان الموقع وخطوطه'],
      ['translations.edit', 'نصوص الأزرار والترجمة'],
      ['settings.edit', 'بيانات الشركة والتواصل'],
      ['media.manage', 'رفع الصور والملفات وحذفها'],
      ['history.restore', 'التراجع عن تعديل (الاستعادة من السجل)'],
    ],
  },
  {
    title: 'المنتجات والمتجر',
    items: [
      ['products.edit', 'إضافة المنتجات وتعديلها'],
      ['products.publish', 'نشر المنتجات وسحبها'],
      ['products.delete', 'حذف المنتجات'],
      ['store.toggle', 'تشغيل المتجر وإيقافه'],
    ],
  },
  {
    title: 'الطلبات',
    items: [
      ['requests.view', 'عرض الطلبات', 'طلبات عرض السعر و«كلّموني»'],
      ['requests.handle', 'استلام الطلبات وتغيير حالتها', 'ويصله تنبيه بكل طلب جديد'],
      ['requests.delete', 'حذف الطلبات'],
      ['requests.export', 'تصدير الطلبات (إكسيل)'],
    ],
  },
  {
    /* تصدير ملف العملاء (إكسيل) للسوبر أدمن وحده — ليس صلاحية تُعطى */
    title: 'العملاء والصفقات',
    items: [
      ['customers.view', 'عرض العملاء', 'بياناتهم وطلباتهم وملاحظاتهم'],
      ['customers.edit', 'إضافة العملاء وتعديلهم والملاحظات'],
      ['customers.delete', 'حذف العملاء', 'يمسح بياناتهم الشخصية نهائيًا'],
      ['deals.view', 'عرض الصفقات'],
      ['deals.edit', 'إضافة الصفقات وتحريكها بين المراحل'],
    ],
  },
  {
    /* تشغيل البوت وتبديل Qwen بموديلنا للسوبر أدمن وحده */
    title: 'المحادثات',
    items: [
      ['chat.handle', 'الرد على محادثات العملاء', 'ويصله تنبيه حين يطلب عميل موظفًا'],
      ['chat.train', 'تدريب البوت', 'مراجعة ردوده وتصدير بيانات التدريب'],
    ],
  },
  {
    title: 'التحليلات',
    items: [
      ['analytics.view', 'عرض التحليلات', 'الزيارات والمنتجات والطلبات والصفقات وأداء الفريق'],
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map(([k]) => k));
export const PERMISSION_LABEL: Record<string, string> =
  Object.fromEntries(PERMISSION_GROUPS.flatMap((g) => g.items.map(([k, l]) => [k, l])));

/** أدوار جاهزة: نقطة بداية للسويتشات، لا قيد عليها */
export const PRESETS: { key: string; label: string; perms: string[] }[] = [
  { key: 'sales', label: 'مبيعات', perms: ['requests.view', 'requests.handle', 'requests.export', 'customers.view', 'customers.edit', 'deals.view', 'deals.edit', 'chat.handle'] },
  { key: 'support', label: 'خدمة عملاء', perms: ['requests.view', 'requests.handle', 'customers.view', 'customers.edit', 'chat.handle', 'chat.train'] },
  { key: 'content', label: 'محتوى', perms: ['pages.edit', 'pages.publish', 'pages.create', 'nav.edit', 'translations.edit', 'media.manage'] },
  { key: 'products', label: 'المنتجات', perms: ['products.edit', 'products.publish', 'media.manage'] },
  { key: 'manager', label: 'مدير (كل شيء ما عدا الحسابات)', perms: ['*'] },
];

export type Who = { role: string; perms?: string[] | null; active?: number | boolean };

export const isSuper = (u: Who | null | undefined) => u?.role === 'super';

/** هل يقدر هذا المستخدم على هذه الصلاحية؟ */
export function can(u: Who | null | undefined, perm: string): boolean {
  if (!u || u.active === 0 || u.active === false) return false;
  if (isSuper(u)) return true;
  const p = Array.isArray(u.perms) ? u.perms : [];
  return p.includes('*') || p.includes(perm);
}

/** الصلاحيات بعد الفحص: المعروفة وحدها، أو «*» لكل شيء */
export function cleanPerms(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  if (v.includes('*')) return ['*'];
  return [...new Set(v.filter((x): x is string => typeof x === 'string' && ALL_PERMISSIONS.includes(x)))];
}
