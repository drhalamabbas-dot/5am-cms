/* =============================================================================
   «العميل بيكتب» عند الموظف.

   النبضةُ كانت في اتجاهٍ واحد: الموظف يكتب فيرى العميلُ ثلاثَ نقاط، أمّا
   العميل فيكتب والموظف لا يدري — فيغلق المحادثة أو يردّ على نصف كلام.

   وقتٌ لا رايةٌ، كما في agent_typing_at: الرايةُ تَعلَق مرفوعةً إن أُغلق
   المتصفّح، والوقتُ يَبلى وحده بعد ثوانٍ.

   node scripts/migrate-cust-typing.mjs   ← تشغيله ثانيةً لا يغيّر شيئًا
============================================================================= */
import { connect, log } from './lib.mjs';

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];

const [c] = await q(
  `SELECT COUNT(*) n FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_conversations' AND COLUMN_NAME = 'cust_typing_at'`
);
if (c.n) log.ok('chat_conversations.cust_typing_at موجود');
else {
  await q('ALTER TABLE `chat_conversations` ADD COLUMN `cust_typing_at` TIMESTAMP NULL AFTER `agent_typing_at`');
  log.ok('chat_conversations.cust_typing_at');
}

await db.end();
