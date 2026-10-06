/* يصدّر بيانات تدريب موديلنا من الموقع الشغّال إلى ملف JSONL (نفس زر «بيانات التدريب»).
   --checked : المقبول + الجديد السليم في الفحص التلقائي (للتدريب التجريبي)
   node scripts/model/export-data.mjs <ملف_الخروج> [--checked] [منفذ] */
import fs from 'node:fs';
import path from 'node:path';
import { SignJWT } from 'jose';
import { connect, loadEnv } from '../lib.mjs';

const out = process.argv[2];
if (!out) { console.error('اكتب مسار ملف الخروج'); process.exit(1); }
const checked = process.argv.includes('--checked');
const port = process.argv.find((a) => /^\d{4,5}$/.test(a)) ?? '3000';
const env = loadEnv(); const db = await connect();
const [[u]] = await db.query('SELECT id, email, role, session_ver FROM users ORDER BY is_owner DESC, id LIMIT 1');
await db.end();
const tok = await new SignJWT({ email: u.email, role: u.role, sv: u.session_ver }).setProtectedHeader({ alg: 'HS256' })
  .setSubject(String(u.id)).setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(env.AUTH_SECRET));
const r = await fetch(`http://localhost:${port}/api/admin/chat-training/export${checked ? '?include=checked' : ''}`, { headers: { cookie: `5am_session=${tok}` } });
if (!r.ok) { console.error('فشل التصدير:', r.status); process.exit(1); }
const text = await r.text();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, text);
console.log(`${text.trim().split('\n').filter(Boolean).length} مثال → ${out}`);
