/* =============================================================================
   طلبات العملاء: عرض سعر، وسلة المتجر، و«كلّموني».

   كل طلب يُحفظ في جدول requests، ويصل تنبيه لكل أدمن عنده صلاحية «استلام
   الطلبات». أول من يضغط «استلمته» يصير مسؤولًا عنه فيختفي التنبيه عند الباقين.
   طلب جديد لم يستلمه أحد خلال 5 دقائق يُصعَّد للسوبر أدمن.

   التصعيد بلا مهمة مجدولة: يُفحص مع كل سؤال عن التنبيهات من أي لوحة مفتوحة
   (lib/requests.ts → escalateOverdue)، فلا يحتاج الخادم شيئًا يعمل في الخلفية.

   بيانات العميل شخصية (قانون حماية البيانات المصري 151/2020): لا تُعرض إلا
   لمن عنده صلاحية الطلبات، ولا تُصدَّر إلا بصلاحية التصدير، وكلاهما في السجل.
============================================================================= */
import { createHash } from 'node:crypto';
import { q, q1, tx, type Exec } from './db';
import { can, isSuper } from './permissions';
import { linkCustomer } from './customers';

export const STATUSES = [
  ['new', 'جديد', 'tag--todo'],
  ['contacted', 'تم التواصل', ''],
  ['confirmed', 'مؤكَّد', 'tag--on'],
  ['processing', 'قيد التنفيذ', ''],
  ['done', 'تم', 'tag--on'],
  ['cancelled', 'ملغي', 'tag--off'],
] as const;
export type Status = (typeof STATUSES)[number][0];
export const STATUS_AR: Record<string, string> = Object.fromEntries(STATUSES.map(([k, l]) => [k, l]));
export const STATUS_TAG: Record<string, string> = Object.fromEntries(STATUSES.map(([k, , c]) => [k, c]));
export const isStatus = (v: unknown): v is Status => STATUSES.some(([k]) => k === v);
export const OPEN = ['new', 'contacted', 'confirmed', 'processing'];

export const KIND_AR: Record<string, string> = { quote: 'عرض سعر', store: 'طلب من المتجر', callback: 'كلّموني', chat: 'محادثة' };
export const SOURCE_AR: Record<string, string> = { store: 'المتجر', quote: 'نموذج عرض السعر', product: 'صفحة منتج', contact: 'التواصل', chat: 'المحادثة' };

/** بعد كم دقيقة يُصعَّد الطلب الجديد غير المستلَم للسوبر أدمن */
export const ESCALATE_MIN = 5;

export type Item = { ref: string; slug?: string; name?: string; sku?: string | null; qty: number };
export type NewRequest = {
  kind: string; name: string | null; phone: string | null; email: string | null; company: string | null;
  city: string | null; message: string | null; items: Item[]; source: string | null; page: string | null;
  lang: string | null; ip: string | null;
};

/** العنوان لا يُحفظ كما هو: بصمة منه تكفي لمنع الإغراق ولا تكشف الزائر */
export const ipHash = (ip: string | null) =>
  ip ? createHash('sha256').update(`${ip}|${process.env.AUTH_SECRET ?? ''}`).digest('hex').slice(0, 32) : null;

/* حدّ الإرسال: 5 طلبات لكل عنوان في 10 دقائق — في الذاكرة، يكفي لخادم واحد */
const WINDOW = 10 * 60 * 1000;
const sent = new Map<string, number[]>();
export function tooMany(key: string | null) {
  if (!key) return false;
  const now = Date.now();
  const list = (sent.get(key) ?? []).filter((t) => now - t < WINDOW);
  if (list.length >= 5) { sent.set(key, list); return true; }
  list.push(now); sent.set(key, list);
  if (sent.size > 2000) for (const [k, v] of sent) if (!v.some((t) => now - t < WINDOW)) sent.delete(k);
  return false;
}

/** من يصله تنبيه الطلبات: كل حساب نشط عنده «استلام الطلبات» (والسوبر أدمن) */
async function handlers(db: Exec): Promise<{ id: number; role: string }[]> {
  const rows = await db.q<any>('SELECT id, role, perms, active FROM users WHERE active = 1');
  return rows.filter((r) => can({ role: r.role, perms: typeof r.perms === 'string' ? JSON.parse(r.perms) : r.perms, active: r.active }, 'requests.handle'));
}

const who = (r: { name: string | null; company: string | null; phone: string | null }) =>
  [r.name, r.company].filter(Boolean).join(' — ') || r.phone || 'عميل';

/** notify: false = بلا تنبيه «طلب جديد» (المحادثة ترسل تنبيهها هي برابط المحادثة) */
export async function createRequest(r: NewRequest, opts: { notify?: boolean } = {}): Promise<number> {
  return tx(async (db) => {
    const res = await db.q(
      `INSERT INTO requests (kind, status, name, phone, email, company, city, message, items, source, page, lang, ip_hash)
       VALUES (?, 'new', ?,?,?,?,?,?,?,?,?,?,?)`,
      [r.kind, r.name, r.phone, r.email, r.company, r.city, r.message,
       r.items.length ? JSON.stringify(r.items) : null, r.source, r.page, r.lang, ipHash(r.ip)]
    ) as unknown as { insertId: number };
    const id = res.insertId;
    await db.q("INSERT INTO request_events (request_id, kind, to_status) VALUES (?, 'created', 'new')", [id]);
    /* العميل نفسه مهما طلب: يُربط برقمه أو بريده (lib/customers.ts) */
    await linkCustomer(db, { name: r.name, phone: r.phone, email: r.email, company: r.company, city: r.city, source: r.source }, id);
    /* عدّاد الطلبات لكل منتج في اليوم — للتحليل */
    for (const it of r.items) {
      await db.q(
        `INSERT INTO product_stats (product_id, day, requests)
         SELECT id, CURDATE(), 1 FROM products WHERE ref = ?
         ON DUPLICATE KEY UPDATE requests = requests + 1`, [it.ref]
      );
    }
    const title = `${KIND_AR[r.kind] ?? 'طلب'} جديد: ${who(r)}`;
    const body = r.items.length
      ? r.items.slice(0, 3).map((i) => `${i.name ?? i.ref} × ${i.qty}`).join('، ') + (r.items.length > 3 ? ` و${r.items.length - 3} غيرها` : '')
      : (r.message ?? '').slice(0, 140);
    for (const h of opts.notify === false ? [] : await handlers(db)) {
      await db.q('INSERT INTO notifications (user_id, kind, title, body, link, request_id) VALUES (?,?,?,?,?,?)',
        [h.id, 'request.new', title, body || null, `/admin/requests/${id}`, id]);
    }
    return id;
  });
}

/** طلب استُلم: تنبيهه عند الباقين يُعلَّم مقروءًا كي لا يتصل به اثنان */
export async function clearOthers(requestId: number, keepUser: number, db: Exec = { q, q1 }) {
  await db.q(
    `UPDATE notifications SET read_at = NOW()
      WHERE request_id = ? AND user_id <> ? AND read_at IS NULL AND kind IN ('request.new', 'request.escalated')`,
    [requestId, keepUser]
  );
}

/** الطلبات الجديدة التي لم يستلمها أحد بعد المهلة: تنبيه للسوبر أدمن، مرة واحدة */
export async function escalateOverdue() {
  const late = await q<any>(
    `SELECT id, kind, name, company, phone FROM requests
      WHERE status = 'new' AND assigned_to IS NULL AND escalated_at IS NULL
        AND created_at < NOW() - INTERVAL ${ESCALATE_MIN} MINUTE LIMIT 20`
  );
  if (!late.length) return;
  const supers = (await q<any>("SELECT id, role FROM users WHERE active = 1 AND role = 'super'")).filter(isSuper);
  for (const r of late) {
    /* الشرط مرة أخرى في التحديث: لوحتان تسألان معًا لا تصعّدان مرتين */
    const res = await q("UPDATE requests SET escalated_at = NOW() WHERE id = ? AND escalated_at IS NULL", [r.id]) as unknown as { affectedRows: number };
    if (!res.affectedRows) continue;
    await q("INSERT INTO request_events (request_id, kind, note) VALUES (?, 'escalate', ?)",
      [r.id, `لم يستلمه أحد خلال ${ESCALATE_MIN} دقائق`]);
    for (const s of supers) {
      await q('INSERT INTO notifications (user_id, kind, title, body, link, request_id) VALUES (?,?,?,?,?,?)',
        [s.id, 'request.escalated', `طلب ينتظر ${ESCALATE_MIN} دقائق بلا مسؤول: ${who(r)}`, 'لم يستلمه أحد بعد — حوّله لموظف أو استلمه.',
         `/admin/requests/${r.id}`, r.id]);
    }
  }
}

/** نصّ قصير وآمن من حقل حرّ */
export const clip = (v: unknown, n: number) => {
  const s = typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() : '';
  return s ? s.slice(0, n) : null;
};
