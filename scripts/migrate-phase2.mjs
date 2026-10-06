/* =============================================================================
   المرحلة 2 (أ) — العملاء والصفقات (يُشغَّل مرة، وتشغيله ثانيةً لا يغيّر شيئًا).

   • customers: العميل مرة واحدة مهما طلب — يُعرف برقم موبايله (أو بريده).
   • customer_events: سجلّ العميل — ملاحظات ومكالمات وطلبات وصفقات.
   • deals: الصفقات بمراحلها (عميل محتمل ← عرض سعر ← تفاوض ← ربح/خسارة).
   • requests.customer_id: كل طلب مربوط بعميله، والطلبات القديمة تُربط هنا.
   • settings.privacy: مدة الاحتفاظ ببيانات العملاء (قانون 151/2020).

   node scripts/migrate-phase2.mjs
============================================================================= */
import { connect, log } from './lib.mjs';

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];
async function hasColumn(table, col) {
  const [r] = await q('SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [table, col]);
  return r.n > 0;
}

log.step('العملاء');
await q(`CREATE TABLE IF NOT EXISTS customers (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(190) NULL,
  phone            VARCHAR(60)  NULL,
  phone_norm       VARCHAR(30)  NULL,                -- أرقام فقط بصيغة 01xxxxxxxxx — للمطابقة
  email            VARCHAR(190) NULL,
  company          VARCHAR(190) NULL,
  city             VARCHAR(120) NULL,
  notes            TEXT NULL,
  source           VARCHAR(40)  NULL,                -- store · quote · product · manual
  owner_id         INT UNSIGNED NULL,                -- الموظف المسؤول عنه
  consent_at       TIMESTAMP NULL,                   -- متى وافق على استخدام بياناته
  last_contact_at  TIMESTAMP NULL,
  created_by       INT UNSIGNED NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cust_phone (phone_norm),
  INDEX idx_cust_email (email),
  INDEX idx_cust_owner (owner_id),
  INDEX idx_cust_last (last_contact_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
log.ok('customers');

await q(`CREATE TABLE IF NOT EXISTS deals (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT UNSIGNED NOT NULL,
  request_id      INT UNSIGNED NULL,
  title           VARCHAR(255) NOT NULL,
  value           DECIMAL(14,2) NULL,
  currency        VARCHAR(5)   NOT NULL DEFAULT 'EGP',
  stage           VARCHAR(20)  NOT NULL DEFAULT 'lead',  -- lead quoted negotiation won lost
  owner_id        INT UNSIGNED NULL,
  expected_close  DATE NULL,
  lost_reason     VARCHAR(255) NULL,
  notes           TEXT NULL,
  closed_at       TIMESTAMP NULL,
  created_by      INT UNSIGNED NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_deal_stage (stage, updated_at),
  INDEX idx_deal_owner (owner_id, stage),
  CONSTRAINT fk_deal_cust FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
log.ok('deals');

await q(`CREATE TABLE IF NOT EXISTS customer_events (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id  INT UNSIGNED NOT NULL,
  user_id      INT UNSIGNED NULL,
  kind         VARCHAR(20) NOT NULL,          -- note call request deal stage edit
  deal_id      INT UNSIGNED NULL,
  request_id   INT UNSIGNED NULL,
  text         TEXT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cev_cust (customer_id, created_at),
  CONSTRAINT fk_cev_cust FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
log.ok('customer_events');

log.step('ربط الطلبات بالعملاء');
if (!(await hasColumn('requests', 'customer_id'))) {
  await q('ALTER TABLE requests ADD COLUMN customer_id INT UNSIGNED NULL AFTER kind, ADD INDEX idx_req_cust (customer_id)');
}
/* الطلبات القديمة: عميل لكل رقم موبايل (أو بريد) — بالمطابقة نفسها التي في lib/customers.ts */
const norm = (p) => {
  if (!p) return null;
  let d = String(p).replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\D/g, '');
  if (d.startsWith('0020')) d = '0' + d.slice(4);
  else if (d.startsWith('20') && d.length === 12) d = '0' + d.slice(2);
  else if (d.length === 10 && d.startsWith('1')) d = '0' + d;
  return d.length >= 7 ? d : null;
};
const orphans = await q('SELECT * FROM requests WHERE customer_id IS NULL ORDER BY id');
let linked = 0;
for (const r of orphans) {
  const pn = norm(r.phone);
  const em = r.email ? r.email.trim().toLowerCase() : null;
  if (!pn && !em) continue;
  let [c] = pn ? await q('SELECT id FROM customers WHERE phone_norm = ?', [pn]) : [];
  if (!c && em) [c] = await q('SELECT id FROM customers WHERE email = ? LIMIT 1', [em]);
  if (!c) {
    const res = await q(
      `INSERT INTO customers (name, phone, phone_norm, email, company, city, source, owner_id, consent_at, last_contact_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [r.name, r.phone, pn, em, r.company, r.city, r.source, r.assigned_to, r.created_at, r.created_at, r.created_at]
    );
    c = { id: res.insertId };
  }
  await q('UPDATE requests SET customer_id = ? WHERE id = ?', [c.id, r.id]);
  await q("INSERT INTO customer_events (customer_id, kind, request_id, text, created_at) VALUES (?, 'request', ?, NULL, ?)", [c.id, r.id, r.created_at]);
  linked++;
}
log.ok(`${linked} طلب رُبط بعميله`);

log.step('إعداد الخصوصية');
await q(`INSERT IGNORE INTO settings (\`key\`, \`value\`, \`group\`, label_en, label_ar)
         VALUES ('privacy', JSON_OBJECT('retentionMonths', 24), 'privacy', 'Customer data retention', 'مدة الاحتفاظ ببيانات العملاء')`);
log.ok('settings.privacy (24 شهرًا افتراضيًا)');

await db.end();
log.step('تم');
