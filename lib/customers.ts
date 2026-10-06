/* =============================================================================
   العملاء والصفقات.

   العميل يُسجَّل مرة واحدة مهما طلب: يُعرف برقم موبايله بصيغة واحدة
   (01xxxxxxxxx — يقبل +20 و0020 والأرقام العربية)، وإلا ببريده. كل طلب من
   الموقع يُربط بعميله تلقائيًا (lib/requests.ts)، فتظهر في صفحته طلباته
   وصفقاته وملاحظات الموظفين عليه.

   الخصوصية (قانون حماية البيانات 151/2020): بيانات العميل لا تُعرض إلا لمن
   عنده «عرض العملاء»، وملف العملاء (إكسيل) للسوبر أدمن وحده وكل تصدير في
   السجل. ومن لم يتعامل معنا خلال مدة الاحتفاظ (الافتراضي 24 شهرًا) تُمسح
   بياناته الشخصية تلقائيًا (purgeExpired).
============================================================================= */
import { q, q1, type Exec } from './db';
import { getSetting } from './content';
import { purgeTraffic } from './analytics';

export const STAGES = [
  ['lead', 'عميل محتمل', ''],
  ['quoted', 'أُرسل عرض السعر', 'tag--todo'],
  ['negotiation', 'تفاوض', 'tag--todo'],
  ['won', 'ربحناها', 'tag--on'],
  ['lost', 'خسرناها', 'tag--off'],
] as const;
export const STAGE_AR: Record<string, string> = Object.fromEntries(STAGES.map(([k, l]) => [k, l]));
export const STAGE_TAG: Record<string, string> = Object.fromEntries(STAGES.map(([k, , c]) => [k, c]));
export const OPEN_STAGES = ['lead', 'quoted', 'negotiation'];
export const isStage = (v: unknown): v is string => STAGES.some(([k]) => k === v);

export const EVENT_AR: Record<string, string> = {
  note: 'ملاحظة', call: 'مكالمة', request: 'طلب من الموقع', deal: 'صفقة جديدة', stage: 'تحرّكت الصفقة', edit: 'تعديل البيانات',
};

/** رقم الموبايل بصيغة واحدة للمطابقة: أرقام لاتينية فقط، ومصر بصفر في أوله */
export function normPhone(p: string | null | undefined): string | null {
  if (!p) return null;
  let d = String(p)
    .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
    .replace(/\D/g, '');
  if (d.startsWith('0020')) d = '0' + d.slice(4);
  else if (d.startsWith('20') && d.length === 12) d = '0' + d.slice(2);
  else if (d.length === 10 && d.startsWith('1')) d = '0' + d;
  return d.length >= 7 ? d.slice(0, 30) : null;
}

export const money = (v: unknown, cur = 'EGP') => {
  const n = Number(v);
  if (v == null || v === '' || !Number.isFinite(n)) return '—';
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${cur === 'EGP' ? 'ج.م' : cur}`;
};

type Contact = {
  name: string | null; phone: string | null; email: string | null; company: string | null;
  city: string | null; source: string | null;
};

/**
 * عميل الطلب: الموجود برقمه أو بريده (وتُكمَّل خاناته الفارغة)، وإلا عميل جديد.
 * يُستدعى داخل معاملة الطلب نفسها. null إن لم يكن في الطلب رقم ولا بريد.
 */
export async function linkCustomer(db: Exec, c: Contact, requestId: number): Promise<number | null> {
  const id = await findOrCreateCustomer(db, c);
  if (!id) return null;
  await db.q('UPDATE requests SET customer_id = ? WHERE id = ?', [id, requestId]);
  await db.q("INSERT INTO customer_events (customer_id, kind, request_id) VALUES (?, 'request', ?)", [id, requestId]);
  return id;
}

/** العميل برقمه أو بريده (تُكمَّل خاناته الفارغة)، وإلا عميل جديد. null بلا رقم ولا بريد */
export async function findOrCreateCustomer(db: Exec, c: Contact): Promise<number | null> {
  const pn = normPhone(c.phone);
  const em = c.email?.trim().toLowerCase() || null;
  if (!pn && !em) return null;
  let row = pn ? await db.q1<any>('SELECT * FROM customers WHERE phone_norm = ? FOR UPDATE', [pn]) : null;
  if (!row && em) row = await db.q1<any>('SELECT * FROM customers WHERE email = ? ORDER BY id LIMIT 1 FOR UPDATE', [em]);
  let id: number;
  if (row) {
    id = row.id;
    /* ما كان فارغًا يُكمَّل، وما كتبه الموظف لا يُكتب فوقه */
    await db.q(
      `UPDATE customers SET name = COALESCE(name, ?), phone = COALESCE(phone, ?), phone_norm = COALESCE(phone_norm, ?),
         email = COALESCE(email, ?), company = COALESCE(company, ?), city = COALESCE(city, ?),
         consent_at = COALESCE(consent_at, NOW()), last_contact_at = NOW() WHERE id = ?`,
      [c.name, c.phone, pn, em, c.company, c.city, id]
    );
  } else {
    const res = await db.q(
      `INSERT INTO customers (name, phone, phone_norm, email, company, city, source, consent_at, last_contact_at)
       VALUES (?,?,?,?,?,?,?, NOW(), NOW())`,
      [c.name, c.phone, pn, em, c.company, c.city, c.source]
    ) as unknown as { insertId: number };
    id = res.insertId;
  }
  return id;
}

export async function getRetentionMonths(): Promise<number> {
  const s = await getSetting<{ retentionMonths?: number }>('privacy', {});
  const m = Number(s.retentionMonths);
  return Number.isInteger(m) && m >= 0 ? m : 24;
}

/**
 * مسح بيانات من انتهت مدة الاحتفاظ ببياناته: عميل بلا تواصل ولا صفقة مفتوحة
 * طوال المدة يُحذف (ومعه ملاحظاته وصفقاته المغلقة)، وتُمسح البيانات الشخصية
 * من طلباته القديمة المغلقة وتبقى أرقامها للإحصاء. 0 = لا مسح تلقائي.
 * مرة واحدة في اليوم على الأكثر، مع سؤال الجرس (lib/requests.ts).
 */
let lastPurge = '';
export async function purgeExpired(force = false): Promise<{ customers: number; requests: number }> {
  const today = new Date().toISOString().slice(0, 10);
  if (!force && lastPurge === today) return { customers: 0, requests: 0 };
  lastPurge = today;
  await purgeTraffic().catch(() => {});
  const months = await getRetentionMonths();
  if (!months) return { customers: 0, requests: 0 };
  const old = await q<any>(
    `SELECT c.id FROM customers c
      WHERE COALESCE(c.last_contact_at, c.created_at) < NOW() - INTERVAL ? MONTH
        AND NOT EXISTS (SELECT 1 FROM deals d WHERE d.customer_id = c.id AND d.stage IN ('lead','quoted','negotiation'))
        AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.customer_id = c.id AND r.status IN ('new','contacted','confirmed','processing'))
      LIMIT 500`, [months]
  );
  for (const c of old) await eraseCustomer(c.id);
  const res = await q(
    `UPDATE requests SET name = NULL, phone = NULL, email = NULL, company = NULL, city = NULL, message = NULL, ip_hash = NULL, page = NULL
      WHERE status IN ('done','cancelled') AND created_at < NOW() - INTERVAL ? MONTH AND (name IS NOT NULL OR phone IS NOT NULL OR email IS NOT NULL)`,
    [months]
  ) as unknown as { affectedRows: number };
  if (old.length || res.affectedRows) {
    await q(`INSERT INTO audit_log (user_id, user_name, action, entity, summary) VALUES (NULL, 'النظام', 'privacy.purge', 'customer', ?)`,
      [`مدة الاحتفاظ ${months} شهرًا: حُذف ${old.length} عميل، ومُسحت البيانات الشخصية من ${res.affectedRows} طلب قديم`]);
  }
  return { customers: old.length, requests: res.affectedRows };
}

/** حذف العميل نهائيًا: صفحته وملاحظاته وصفقاته، وبياناته الشخصية من طلباته */
export async function eraseCustomer(id: number, db: Exec = { q, q1 }) {
  await db.q(
    `UPDATE requests SET customer_id = NULL, name = NULL, phone = NULL, email = NULL, company = NULL, city = NULL, message = NULL, ip_hash = NULL
      WHERE customer_id = ?`, [id]
  );
  await db.q('DELETE FROM customers WHERE id = ?', [id]);
}
