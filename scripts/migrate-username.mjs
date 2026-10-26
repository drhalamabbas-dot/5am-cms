/* =============================================================================
   اسم مستخدم لحساب العميل.

   كان الحساب يُعرَف ببريده أو بموبايله. وهنا اسمٌ يختاره العميل، ويدخل به أو
   ببريده — كلاهما يدلّ على الحساب نفسه.

   العمود NULL يقبل: الحسابات القائمة بلا اسم مستخدم تظلّ تدخل ببريدها أو
   موبايلها، ولا يُجبَر أحدٌ على اسمٍ لم يختره.

   node scripts/migrate-username.mjs   ← تشغيله ثانيةً لا يغيّر شيئًا
============================================================================= */
import { connect, log } from './lib.mjs';

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];

const [c] = await q(
  `SELECT COUNT(*) n FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_accounts' AND COLUMN_NAME = 'username'`
);
if (c.n) log.ok('customer_accounts.username موجود');
else {
  /* فريدٌ لا مفهرسٌ فقط: اسمان متطابقان يجعلان الدخول غامضًا */
  await q('ALTER TABLE `customer_accounts` ADD COLUMN `username` VARCHAR(40) NULL UNIQUE AFTER `name`');
  log.ok('customer_accounts.username');
}

await db.end();
