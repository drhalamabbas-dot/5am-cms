/* ينشئ مستخدمًا للداش بورد أو يغيّر كلمة مروره.

   node scripts/add-user.mjs <البريد> <كلمة المرور> [الاسم]

   كلمة المرور لا تُحفظ كما هي: يُحفظ تجزئتها بـ bcrypt. ولا تُكتب في أي سجل.
   ويضيف السكربت AUTH_SECRET إلى .env.local إن لم يكن موجودًا. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { connect, log } from './lib.mjs';

const [email, password, name] = process.argv.slice(2);
if (!email || !password) {
  console.log('الاستعمال: node scripts/add-user.mjs <البريد> <كلمة المرور> [الاسم]');
  process.exit(1);
}
if (password.length < 10) {
  log.fail('كلمة المرور قصيرة — 10 أحرف على الأقل');
  process.exit(1);
}

/* مفتاح توقيع الجلسات: يُولَّد مرة ويبقى. تغييره يُخرج الجميع من الداش بورد. */
const envFile = path.join(process.cwd(), '.env.local');
let env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
if (!/^AUTH_SECRET=/m.test(env)) {
  const key = crypto.randomBytes(48).toString('base64url');
  env = env.replace(/\s*$/, '\n') + `AUTH_SECRET=${key}\n`;
  fs.writeFileSync(envFile, env, 'utf8');
  log.ok('أُضيف AUTH_SECRET إلى .env.local');
}

const db = await connect();
const hash = await bcrypt.hash(password, 12);
await db.execute(
  `INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,'admin')
   ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name)`,
  [email.trim().toLowerCase(), hash, name ?? null]
);
const [[row]] = await db.query('SELECT id, email, name, role FROM users WHERE email = ?', [email.trim().toLowerCase()]);
log.ok(`جاهز — ${row.email} (${row.role})`);
await db.end();
