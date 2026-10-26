/* =============================================================================
   المحادثة تصير كما اعتادها الناس: وقتٌ وعلامةُ قراءة وردٌّ على رسالةٍ بعينها.

   • reply_to — الرسالة المردود عليها. مفتاحٌ أجنبيّ بحذفٍ يُفرِغ لا يحذف:
     حذفُ رسالةٍ لا يجوز أن يحذف الردود عليها.
   • read_at  — متى قُرئت. علامةُ القراءة تُبنى منه لا من تخمين.
   • cust_read_at / agent_read_at على المحادثة — إلى أين وصل كلٌّ في القراءة،
     فلا يُكتب صفٌّ لكل رسالةٍ تُقرأ.
   • agent_typing_at — نبضةٌ يكتبها الموظف وهو يكتب، يقرؤها العميل فيرى
     «بيكتب الآن». وقتٌ لا رايةٌ: الراية تَعلَق مرفوعةً إن أُغلق المتصفّح،
     والوقت يَبلى وحده بعد ثوانٍ.

   node scripts/migrate-chat-wa.mjs   ← تشغيله ثانيةً لا يغيّر شيئًا
============================================================================= */
import { connect, log } from './lib.mjs';

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];

async function has(table, col) {
  const [r] = await q(
    `SELECT COUNT(*) n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [table, col]
  );
  return r.n > 0;
}
async function add(table, col, def) {
  if (await has(table, col)) { log.ok(`${table}.${col} موجود`); return; }
  await q(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
  log.ok(`${table}.${col}`);
}

await add('chat_messages', 'reply_to', 'BIGINT UNSIGNED NULL AFTER files');
await add('chat_messages', 'read_at', 'TIMESTAMP NULL AFTER created_at');
await add('chat_conversations', 'cust_read_at', 'TIMESTAMP NULL');
await add('chat_conversations', 'agent_read_at', 'TIMESTAMP NULL');
await add('chat_conversations', 'agent_typing_at', 'TIMESTAMP NULL');

/* فهرسٌ على الردود: تُجلب الرسائل المردود عليها دفعةً واحدة */
const [idx] = await q(
  `SELECT COUNT(*) n FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_messages' AND INDEX_NAME = 'idx_msg_reply'`
);
if (idx.n) log.ok('فهرس الردود موجود');
else { await q('ALTER TABLE `chat_messages` ADD INDEX `idx_msg_reply` (`reply_to`)'); log.ok('فهرس الردود'); }

await db.end();
