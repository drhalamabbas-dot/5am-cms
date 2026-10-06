/* =============================================================================
   المرحلة 1 — تحديث قاعدة البيانات (يُشغَّل مرة، وتشغيله ثانيةً لا يغيّر شيئًا).

   • users: دور (super / admin)، وتفعيل الحساب، وصلاحيات كل موظف (سويتشات)،
     والحساب الأساسي المحمي، ونسخة الجلسة (تغيير كلمة المرور أو إيقاف الحساب
     يُخرج صاحبه فورًا)، والهاتف.
   • audit_log: سجل «مين عمل إيه وإمتى وكان إيه وبقى إيه».
   • requests / request_events: طلبات عرض السعر و«كلّموني» وتاريخ كل طلب.
   • notifications: تنبيهات الأدمنز (الجرس).
   • product_stats / search_stats: مشاهدات المنتجات وبحث المتجر — للتحليل لاحقًا.

   node scripts/migrate-phase1.mjs
============================================================================= */
import { connect, log } from './lib.mjs';

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];

async function hasColumn(table, col) {
  const [r] = await q('SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [table, col]);
  return r.n > 0;
}
async function addColumn(table, col, def) {
  if (await hasColumn(table, col)) return;
  await q(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
  log.ok(`${table}.${col}`);
}

log.step('المستخدمون والصلاحيات');
/* الدور: نصّ لا ENUM — كي يُضاف دور لاحقًا بلا تعديل الجدول */
await q("ALTER TABLE users MODIFY role VARCHAR(20) NOT NULL DEFAULT 'admin'");
await addColumn('users', 'active', 'TINYINT(1) NOT NULL DEFAULT 1');
await addColumn('users', 'perms', 'JSON NULL');
await addColumn('users', 'preset', 'VARCHAR(40) NULL');
await addColumn('users', 'phone', 'VARCHAR(40) NULL');
await addColumn('users', 'is_owner', 'TINYINT(1) NOT NULL DEFAULT 0');
await addColumn('users', 'session_ver', 'INT UNSIGNED NOT NULL DEFAULT 1');
await addColumn('users', 'created_by', 'INT UNSIGNED NULL');
await addColumn('users', 'updated_at', 'TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP');

/* الحساب الأول هو صاحب الموقع: سوبر أدمن محمي، إن لم يكن هناك صاحب بعد */
const [owner] = await q('SELECT id FROM users WHERE is_owner = 1 LIMIT 1');
if (!owner) {
  const [first] = await q('SELECT id, email FROM users ORDER BY id LIMIT 1');
  if (first) {
    await q("UPDATE users SET role = 'super', is_owner = 1, active = 1 WHERE id = ?", [first.id]);
    log.ok(`${first.email} ← سوبر أدمن أساسي (محمي)`);
  }
}
/* من كانوا admin قبل الصلاحيات يبقون بكل صلاحياتهم الحالية حتى يُعدَّلوا */
await q("UPDATE users SET perms = JSON_ARRAY('*') WHERE perms IS NULL AND role <> 'super'");

log.step('سجل العمليات');
await q(`CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NULL,
  user_name   VARCHAR(190) NULL,
  action      VARCHAR(60)  NOT NULL,
  entity      VARCHAR(40)  NULL,
  entity_id   VARCHAR(80)  NULL,
  summary     VARCHAR(400) NULL,
  before_val  JSON NULL,
  after_val   JSON NULL,
  ip          VARCHAR(64)  NULL,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_audit_time (created_at),
  INDEX idx_audit_user (user_id, created_at),
  INDEX idx_audit_entity (entity, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
log.ok('audit_log');

log.step('الطلبات والتنبيهات');
await q(`CREATE TABLE IF NOT EXISTS requests (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind          VARCHAR(20)  NOT NULL DEFAULT 'quote',      -- quote: عرض سعر · callback: كلّموني
  status        VARCHAR(20)  NOT NULL DEFAULT 'new',        -- new contacted confirmed processing done cancelled
  name          VARCHAR(190) NULL,
  phone         VARCHAR(60)  NULL,
  email         VARCHAR(190) NULL,
  company       VARCHAR(190) NULL,
  city          VARCHAR(120) NULL,
  message       TEXT NULL,
  items         JSON NULL,                                  -- [{ref, slug, name, qty}]
  source        VARCHAR(40)  NULL,                          -- store · quote · product · contact
  page          VARCHAR(255) NULL,
  lang          VARCHAR(5)   NULL,
  assigned_to   INT UNSIGNED NULL,
  claimed_at    TIMESTAMP NULL,
  escalated_at  TIMESTAMP NULL,
  closed_at     TIMESTAMP NULL,
  ip_hash       VARCHAR(64)  NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_req_status (status, created_at),
  INDEX idx_req_assigned (assigned_to, status),
  INDEX idx_req_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
log.ok('requests');

await q(`CREATE TABLE IF NOT EXISTS request_events (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id  INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NULL,
  kind        VARCHAR(20) NOT NULL,                         -- created status claim assign note escalate
  from_status VARCHAR(20) NULL,
  to_status   VARCHAR(20) NULL,
  note        TEXT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rev_req (request_id, created_at),
  CONSTRAINT fk_revt_req FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
log.ok('request_events');

await q(`CREATE TABLE IF NOT EXISTS notifications (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  kind        VARCHAR(30)  NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        VARCHAR(500) NULL,
  link        VARCHAR(255) NULL,
  request_id  INT UNSIGNED NULL,
  read_at     TIMESTAMP NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id, read_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
log.ok('notifications');

log.step('إحصاءات (للتحليل لاحقًا)');
await q(`CREATE TABLE IF NOT EXISTS product_stats (
  product_id  INT UNSIGNED NOT NULL,
  day         DATE NOT NULL,
  views       INT UNSIGNED NOT NULL DEFAULT 0,
  requests    INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
await q(`CREATE TABLE IF NOT EXISTS search_stats (
  term        VARCHAR(120) NOT NULL,
  day         DATE NOT NULL,
  hits        INT UNSIGNED NOT NULL DEFAULT 0,
  results     INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (term, day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
log.ok('product_stats · search_stats');

log.step('المنتجات: قطع الغيار');
await addColumn('products', 'sku', 'VARCHAR(80) NULL');                 // رقم القطعة
await addColumn('products', 'store_hidden', 'TINYINT(1) NOT NULL DEFAULT 0'); // منشور في الموقع ومخفي من المتجر

log.step('إعداد المتجر');
await q(`INSERT IGNORE INTO settings (\`key\`, \`value\`, \`group\`, label_en, label_ar)
         VALUES ('store', JSON_OBJECT('enabled', true, 'closed', 'home'), 'store', 'Store', 'المتجر')`);
log.ok('settings.store');

await db.end();
log.step('تم');
