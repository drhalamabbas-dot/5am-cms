/* ينشئ قاعدة البيانات ويطبّق التصميم. آمن للتشغيل أكثر من مرة. */
import fs from 'node:fs';
import path from 'node:path';
import { connect, splitSql, loadEnv, log } from './lib.mjs';

const env = { ...loadEnv(), ...process.env };
const dbName = env.DB_NAME || 'fiveam_cms';

log.step(`تجهيز قاعدة البيانات «${dbName}»`);

const server = await connect({ database: null });
await server.query(
  `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
);
await server.end();
log.ok('قاعدة البيانات موجودة');

const db = await connect();
const sql = fs.readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf8');
for (const stmt of splitSql(sql)) await db.query(stmt);
log.ok('الجداول اتطبّقت');

const [tables] = await db.query(
  `SELECT TABLE_NAME AS name, TABLE_ROWS AS approx_rows
     FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
  [dbName]
);
console.log('');
for (const t of tables) log.info(`${t.name.padEnd(14)} ${t.approx_rows ?? 0} صف`);

const [[v]] = await db.query('SELECT VERSION() AS v');
log.ok(`MySQL ${v.v}`);
await db.end();
