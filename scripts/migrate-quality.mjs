/* المرحلة 3 (ب) — عمود مشاكل الجودة لبيانات التدريب (يُشغَّل مرة). node scripts/migrate-quality.mjs */
import { connect, log } from './lib.mjs';
const db = await connect();
const [[c]] = await db.query("SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_cache' AND COLUMN_NAME = 'issues'");
if (!c.n) await db.query("ALTER TABLE chat_cache ADD COLUMN issues VARCHAR(255) NULL AFTER status");
log.ok('chat_cache.issues');
await db.end();
