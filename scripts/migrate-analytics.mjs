/* =============================================================================
   المرحلة 4 — التحليلات (يُشغَّل مرة، وتشغيله ثانيةً لا يغيّر شيئًا).

   • traffic_daily: عدّاد يومي — الصفحة، والمصدر (جوجل/فيسبوك/مباشر…)، والجهاز،
     واللغة. أرقام فقط، بلا أي بيانات عن الزائر.
   • visitors_daily: بصمة زائر لليوم الواحد (تتغيّر كل يوم بمفتاح سري) لعدّ
     الزوار المختلفين — لا كوكي، ولا يمكن تتبّع زائر من يوم ليوم. تُمسح بعد 190 يومًا.

   node scripts/migrate-analytics.mjs
============================================================================= */
import { connect, log } from './lib.mjs';

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];

log.step('عدّادات الزيارات');
await q(`CREATE TABLE IF NOT EXISTS traffic_daily (
  day   DATE NOT NULL,
  dim   VARCHAR(10) NOT NULL,          -- page · source · device · lang
  k     VARCHAR(190) NOT NULL,
  n     INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (day, dim, k),
  INDEX idx_traffic_dim (dim, day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
await q(`CREATE TABLE IF NOT EXISTS visitors_daily (
  day    DATE NOT NULL,
  vhash  CHAR(32) NOT NULL,
  PRIMARY KEY (day, vhash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
log.ok('traffic_daily · visitors_daily');

await db.end();
log.step('تم');
