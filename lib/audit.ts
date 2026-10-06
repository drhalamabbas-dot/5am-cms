/* =============================================================================
   سجل العمليات: مين عمل إيه، وإمتى، وكان إيه وبقى إيه.

   كل عملية مهمة في اللوحة تكتب سطرًا هنا (تعديل منتج، تغيير حالة طلب، تغيير
   صلاحية، تصدير، دخول…). السوبر أدمن يقرؤه من «سجل العمليات» بفلاتر.

   الكتابة في السجل لا تُفشل العملية نفسها: خطأ في السجل يُطبع ولا يوقف الحفظ.
   وكلمات المرور لا تُكتب فيه أبدًا — تُحذف من القيم قبل الحفظ.
============================================================================= */
import { headers } from 'next/headers';
import { type Exec, direct } from './db';

type Who = { id: number; name?: string | null; email?: string } | null;

const SECRET = /pass|hash|token|secret/i;
function scrub(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>)
      .filter(([k]) => !SECRET.test(k)).map(([k, x]) => [k, scrub(x)]));
  }
  return v;
}

export async function audit(
  who: Who,
  action: string,
  o: { entity?: string; id?: string | number | null; summary?: string; before?: unknown; after?: unknown; db?: Exec } = {},
) {
  try {
    let ip: string | null = null;
    try {
      const h = await headers();
      ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null;
    } catch { /* خارج طلب (سكربت) */ }
    const db = o.db ?? direct;
    await db.q(
      `INSERT INTO audit_log (user_id, user_name, action, entity, entity_id, summary, before_val, after_val, ip)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        who?.id ?? null, who ? (who.name || who.email || `#${who.id}`) : null,
        action, o.entity ?? null, o.id == null ? null : String(o.id), o.summary?.slice(0, 400) ?? null,
        o.before === undefined ? null : JSON.stringify(scrub(o.before)),
        o.after === undefined ? null : JSON.stringify(scrub(o.after)),
        ip,
      ]
    );
  } catch (e) {
    console.error('[audit] تعذّرت الكتابة في السجل:', e);
  }
}

/** أسماء العمليات بالعربية لشاشة السجل */
export const ACTION_AR: Record<string, string> = {
  'login': 'دخول',
  'login.failed': 'محاولة دخول فاشلة',
  'user.create': 'إضافة أدمن',
  'user.update': 'تعديل بيانات أدمن',
  'user.perms': 'تغيير صلاحيات',
  'user.password': 'تغيير كلمة مرور',
  'user.activate': 'تفعيل حساب',
  'user.deactivate': 'إيقاف حساب',
  'user.delete': 'حذف حساب',
  'account.password': 'غيّر كلمة مروره',
  'page.save': 'حفظ صفحة',
  'page.publish': 'نشر صفحة',
  'page.unpublish': 'سحب صفحة من النشر',
  'page.create': 'إنشاء صفحة',
  'page.delete': 'حذف صفحة',
  'product.create': 'إضافة منتج',
  'product.update': 'تعديل منتج',
  'product.delete': 'حذف منتج',
  'store.enable': 'تشغيل المتجر',
  'store.disable': 'إيقاف المتجر',
  'request.status': 'تغيير حالة طلب',
  'request.claim': 'استلام طلب',
  'request.assign': 'تحويل طلب',
  'request.note': 'ملاحظة على طلب',
  'request.delete': 'حذف طلب',
  'request.export': 'تصدير الطلبات',
  'customer.create': 'إضافة عميل',
  'customer.update': 'تعديل بيانات عميل',
  'customer.note': 'ملاحظة على عميل',
  'customer.delete': 'حذف عميل',
  'customer.export': 'تصدير ملف العملاء',
  'deal.create': 'صفقة جديدة',
  'deal.update': 'تعديل صفقة',
  'deal.stage': 'تحريك صفقة',
  'deal.delete': 'حذف صفقة',
  'privacy.save': 'تغيير مدة الاحتفاظ بالبيانات',
  'chat.settings': 'تغيير إعدادات المحادثة',
  'chat.review': 'مراجعة ردّ للبوت',
  'chat.export': 'تصدير بيانات تدريب البوت',
  'chat.key': 'تغيير مفتاح خدمة',
  'attendance.enroll': 'سجّل بصمة وجهه',
  'attendance.reset': 'مسح بصمة وجه',
  'attendance.review': 'مراجعة حضور',
  'attendance.settings': 'تغيير موقع المكتب',
  'attendance.export': 'تصدير الحضور',
  'privacy.purge': 'مسح بيانات انتهت مدتها',
  'nav.save': 'تعديل المنيو',
  'theme.save': 'تعديل الألوان والخطوط',
  'translations.save': 'تعديل الترجمة',
  'settings.save': 'تعديل بيانات الشركة',
  'history.restore': 'استعادة من السجل',
  'media.upload': 'رفع ملفات',
  'media.delete': 'حذف ملف',
};
