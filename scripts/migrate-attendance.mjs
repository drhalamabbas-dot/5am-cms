/* =============================================================================
   المرحلة 2 (ب) — الحضور والانصراف (يُشغَّل مرة، وتشغيله ثانيةً لا يغيّر شيئًا).

   • face_profiles: بصمة وجه كل أدمن (128 رقمًا يحسبها المتصفح، لا الصورة
     نفسها) وصورة التسجيل في مجلد خاص غير منشور. بموافقته عند أول تسجيل.
   • attendance: يوم كل أدمن — وقت الحضور والانصراف، وصورتاهما، ومدى تطابق
     الوجه، والمكان وبعده عن المكتب، وحالته (سليم / للمراجعة / مرفوض).
   • settings.attendance: موقع المكتب (من بيانات الشركة) ونصف قطر 200 متر،
     وحدّ التطابق. ساعات العمل مرنة: يُسجَّل الوقت والمدة بلا «تأخير».

   node scripts/migrate-attendance.mjs
============================================================================= */
import { connect, log } from './lib.mjs';

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];

log.step('بصمات الوجه');
await q(`CREATE TABLE IF NOT EXISTS face_profiles (
  user_id      INT UNSIGNED NOT NULL PRIMARY KEY,
  descriptor   JSON NOT NULL,
  photo        VARCHAR(255) NULL,          -- داخل المجلد الخاص (lib/private.ts)
  consent_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_face_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
log.ok('face_profiles');

log.step('الحضور والانصراف');
await q(`CREATE TABLE IF NOT EXISTS attendance (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id      INT UNSIGNED NOT NULL,
  day          DATE NOT NULL,
  check_in     DATETIME NULL,
  check_out    DATETIME NULL,
  in_photo     VARCHAR(255) NULL,
  out_photo    VARCHAR(255) NULL,
  in_match     DECIMAL(5,3) NULL,          -- مسافة البصمة: الأقل أقرب (حتى 0.5 = نفس الشخص)
  out_match    DECIMAL(5,3) NULL,
  in_lat       DECIMAL(10,7) NULL,
  in_lng       DECIMAL(10,7) NULL,
  in_dist      INT NULL,                   -- بالمتر من المكتب
  out_lat      DECIMAL(10,7) NULL,
  out_lng      DECIMAL(10,7) NULL,
  out_dist     INT NULL,
  status       VARCHAR(12) NOT NULL DEFAULT 'ok',   -- ok · review · rejected
  note         VARCHAR(255) NULL,
  reviewed_by  INT UNSIGNED NULL,
  reviewed_at  TIMESTAMP NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_att_day (user_id, day),
  INDEX idx_att_day (day),
  CONSTRAINT fk_att_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
log.ok('attendance');

log.step('إعداد الحضور');
/* موقع المكتب من خانة geo في بيانات الشركة (lat,lng) */
const [co] = await q("SELECT `value` FROM settings WHERE `key` = 'company'");
const company = co ? (typeof co.value === 'string' ? JSON.parse(co.value) : co.value) : {};
const [lat, lng] = String(company.geo ?? '').split(',').map(Number);
const ok = Number.isFinite(lat) && Number.isFinite(lng);
await q(`INSERT IGNORE INTO settings (\`key\`, \`value\`, \`group\`, label_en, label_ar) VALUES ('attendance', ?, 'attendance', 'Attendance', 'الحضور والانصراف')`,
  [JSON.stringify({ lat: ok ? lat : null, lng: ok ? lng : null, radius: 200, threshold: 0.5 })]);
log.ok(ok ? `المكتب: ${lat}, ${lng} · 200 متر` : 'موقع المكتب غير موجود — يُضبط من شاشة الحضور');

await db.end();
log.step('تم');
