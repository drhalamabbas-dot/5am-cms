/* =============================================================================
   مرفقات المحادثات تصير خاصّةً بأصحابها.

   كانت تُحفَظ في مكتبة الموقع، و‎/media‎ يصرفها بلا سؤال — وهو الصواب لصور
   المنتجات والكتالوجات، وليس لصورةٍ يبعثها عميلٌ من موقع عمله. فمن ملك
   الرابط فتحها، ولو لم يكن صاحبها ولا موظفًا.

   هذا الجدول يقول: هذا الملف لهذا الحساب. و‎/media‎ يسأله قبل أن يصرف أي
   ملفٍ تحت «media/chat/»، فلا يفتحه إلا صاحبه أو موظفٌ يتابع المحادثات.

   والقديم يبقى حيث هو: نقلُه يكسر روابطه في الرسائل المحفوظة. وما يُرفَع
   بعد اليوم يُكتَب في مجلده المحروس.

   node scripts/migrate-chat-files-acl.mjs   ← تشغيله ثانيةً لا يغيّر شيئًا
============================================================================= */
import { connect, log } from './lib.mjs';

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];

const [t] = await q(
  `SELECT COUNT(*) n FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_files'`
);
if (t.n) log.ok('chat_files موجود');
else {
  await q(`
    CREATE TABLE chat_files (
      path       VARCHAR(190) NOT NULL PRIMARY KEY,
      account_id INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cf_acc (account_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  log.ok('chat_files');
}

/* ما رُفع في المحادثات قبل اليوم: يُنسَب لصاحبه كي يُحرَس هو أيضًا. المسار
   لا يتغيّر — تغييرُه يكسر الروابط في الرسائل المحفوظة. */
/* q تعيد الصفوف نفسها (lib.mjs يفكّ [rows, fields])، فلا تُفكّ ثانيةً */
const msgs = await q(
  "SELECT m.files, c.account_id FROM chat_messages m JOIN chat_conversations c ON c.id = m.conversation_id WHERE m.files IS NOT NULL AND c.account_id IS NOT NULL"
);
let n = 0;
for (const r of msgs) {
  const list = typeof r.files === 'string' ? JSON.parse(r.files || '[]') : (r.files ?? []);
  for (const f of (Array.isArray(list) ? list : [])) {
    for (const p of [f?.url, f?.poster, ...(Array.isArray(f?.frames) ? f.frames : [])]) {
      if (!p) continue;
      await q('INSERT IGNORE INTO chat_files (path, account_id) VALUES (?,?)', [String(p), r.account_id]);
      n++;
    }
  }
}
log.ok(`نُسب ${n} ملفًا قديمًا لأصحابها`);

await db.end();
