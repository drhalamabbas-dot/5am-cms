/* أدوات مشتركة بين سكربتات الإعداد والنقل. */
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

/** يقرأ .env.local بدون أي مكتبة خارجية. */
export function loadEnv(root = process.cwd()) {
  const file = path.join(root, '.env.local');
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

export async function connect({ database } = {}) {
  const e = { ...loadEnv(), ...process.env };
  return mysql.createConnection({
    host: e.DB_HOST || '127.0.0.1',
    port: Number(e.DB_PORT || 3306),
    user: e.DB_USER || 'root',
    password: e.DB_PASSWORD || '',
    database: database === null ? undefined : (database || e.DB_NAME),
    charset: 'utf8mb4',
    multipleStatements: true,
    dateStrings: true,
  });
}

/** يقسّم ملف SQL إلى أوامر منفصلة، مع تجاهل التعليقات. */
export function splitSql(sql) {
  return sql
    .split(/;\s*$/m)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);
}

export const log = {
  step: (m) => console.log(`\n\u001b[36m▸ ${m}\u001b[0m`),
  ok:   (m) => console.log(`  \u001b[32m✓\u001b[0m ${m}`),
  warn: (m) => console.log(`  \u001b[33m!\u001b[0m ${m}`),
  fail: (m) => console.log(`  \u001b[31m✗\u001b[0m ${m}`),
  info: (m) => console.log(`    ${m}`),
};
