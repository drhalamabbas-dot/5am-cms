/* =============================================================================
   المرحلة 3 — المحادثة (يُشغَّل مرة، وتشغيله ثانيةً لا يغيّر شيئًا).

   • chat_conversations / chat_messages: محادثة كل زائر — مع البوت ثم مع موظف
     لو طلب، وتكمل من حسابه بعد ما يقفل الموقع.
   • chat_cache: أسئلة أُجيبت قبل كده؛ السؤال المشابه يُجاب منها بلا استهلاك
     Qwen. والموظف يراجعها (يقبل/يعدّل/يرفض) فتصير بيانات تدريب لموديلنا.
   • customer_accounts / login_codes: حساب العميل (رمز بالبريد، أو موبايل
     وكلمة مرور).
   • settings.chat: تشغيل البوت، ومصدر الردود (Qwen أو موديلنا أو بلا بوت).

   node scripts/migrate-chat.mjs
============================================================================= */
import { connect, log } from './lib.mjs';

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];

log.step('حسابات العملاء');
await q(`CREATE TABLE IF NOT EXISTS customer_accounts (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id    INT UNSIGNED NULL,
  name           VARCHAR(190) NULL,
  email          VARCHAR(190) NULL,
  phone_norm     VARCHAR(30)  NULL,
  password_hash  VARCHAR(100) NULL,
  email_verified_at TIMESTAMP NULL,
  session_ver    INT UNSIGNED NOT NULL DEFAULT 1,
  last_login_at  TIMESTAMP NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_acc_email (email),
  UNIQUE KEY uq_acc_phone (phone_norm),
  INDEX idx_acc_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
await q(`CREATE TABLE IF NOT EXISTS login_codes (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(190) NOT NULL,
  code_hash   VARCHAR(100) NOT NULL,
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_code_email (email, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
log.ok('customer_accounts · login_codes');

log.step('المحادثات');
await q(`CREATE TABLE IF NOT EXISTS chat_conversations (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  token_hash       CHAR(64) NOT NULL,                 -- بصمة كوكي الزائر، لا الكوكي نفسه
  account_id       INT UNSIGNED NULL,
  customer_id      INT UNSIGNED NULL,
  lang             VARCHAR(5) NULL,
  status           VARCHAR(10) NOT NULL DEFAULT 'bot',  -- bot · human · closed
  assigned_to      INT UNSIGNED NULL,
  handoff_at       TIMESTAMP NULL,
  unread_agent     INT UNSIGNED NOT NULL DEFAULT 0,     -- رسائل العميل التي لم يقرأها موظف
  page             VARCHAR(255) NULL,
  ip_hash          VARCHAR(64) NULL,
  last_message_at  TIMESTAMP NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_chat_token (token_hash),
  INDEX idx_chat_status (status, last_message_at),
  INDEX idx_chat_account (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
await q(`CREATE TABLE IF NOT EXISTS chat_messages (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id  INT UNSIGNED NOT NULL,
  role             VARCHAR(10) NOT NULL,     -- user · bot · agent · system
  user_id          INT UNSIGNED NULL,        -- الموظف صاحب الرد
  text             TEXT NOT NULL,
  source           VARCHAR(10) NULL,         -- qwen · own · cache · kb
  cache_id         INT UNSIGNED NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_msg_conv (conversation_id, id),
  CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
await q(`CREATE TABLE IF NOT EXISTS chat_cache (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lang          VARCHAR(5) NOT NULL,
  question      VARCHAR(1000) NOT NULL,
  q_norm        VARCHAR(1000) NOT NULL,     -- السؤال مطبّعًا (للمطابقة)
  answer        TEXT NOT NULL,
  source        VARCHAR(10) NOT NULL,       -- qwen · own · staff
  status        VARCHAR(10) NOT NULL DEFAULT 'new',  -- new · approved · rejected
  hits          INT UNSIGNED NOT NULL DEFAULT 0,
  reviewed_by   INT UNSIGNED NULL,
  last_hit_at   TIMESTAMP NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cache_lang (lang, status),
  FULLTEXT KEY ft_cache_q (q_norm)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
log.ok('chat_conversations · chat_messages · chat_cache');

log.step('إعداد المحادثة');
await q(`INSERT IGNORE INTO settings (\`key\`, \`value\`, \`group\`, label_en, label_ar) VALUES ('chat', ?, 'chat', 'Chat', 'المحادثة')`, [JSON.stringify({
  enabled: true,
  provider: 'qwen',                     // qwen · own · off (بلا بوت: الرسائل للموظفين مباشرةً)
  model: '',                            // موديل OpenRouter — يُختار من شاشة التدريب
  ownUrl: '', ownModel: '',             // موديلنا: أي خادم متوافق مع OpenAI
  greeting: {
    ar: 'أهلًا بك في 5A&M 👋 اسألني عن المولدات أو المعدات البيئية أو قطع الغيار، أو اطلب التحدث مع موظف.',
    en: 'Welcome to 5A&M 👋 Ask me about generators, environmental equipment or spare parts — or ask to talk to our team.',
  },
})]);
log.ok('settings.chat');

await db.end();
log.step('تم');
