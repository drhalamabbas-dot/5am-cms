/* =============================================================================
   مرفقات رسائل المحادثة: صور وفيديو ورسائل صوتية.

   عمود JSON في الرسالة لا جدول مرفقات: المرفق لا يُقرأ ولا يُبحَث فيه إلا
   مع رسالته، ولا يُشارَك بين رسالتين — فجدولٌ له ضمٌّ في كل قراءة بلا مقابل.

   شكله: [{ "url": "media/img/x.jpg", "kind": "image", "name": "...",
            "bytes": 12345, "w": 1280, "h": 720, "secs": 7 }]

   والنصّ يصير قد يكون فارغًا: رسالةٌ صورةٌ وحدها رسالةٌ صحيحة.

   node scripts/migrate-chat-files.mjs   ← تشغيله ثانيةً لا يغيّر شيئًا
============================================================================= */
import { connect, log } from './lib.mjs';

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];

const [c] = await q(
  `SELECT COUNT(*) n FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_messages' AND COLUMN_NAME = 'files'`
);
if (c.n) log.ok('chat_messages.files موجود');
else {
  await q('ALTER TABLE `chat_messages` ADD COLUMN `files` JSON NULL AFTER `text`');
  log.ok('chat_messages.files');
}

/* النصّ كان NOT NULL في بعض النسخ: رسالة الصورة وحدها بلا نصّ */
const [t] = await q(
  `SELECT IS_NULLABLE n FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_messages' AND COLUMN_NAME = 'text'`
);
if (t && t.n === 'NO') {
  await q('ALTER TABLE `chat_messages` MODIFY `text` TEXT NULL');
  log.ok('chat_messages.text صار يقبل الفراغ');
} else log.ok('chat_messages.text يقبل الفراغ');

await db.end();
