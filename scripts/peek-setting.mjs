/* يطبع قيمة إعداد واحد كما هي في القاعدة.  node scripts/peek-setting.mjs company */
import { connect } from './lib.mjs';
const key = process.argv[2];
const db = await connect();
const [rows] = await db.query('SELECT `key`, `value` FROM settings WHERE `key` = ?', [key]);
await db.end();
if (!rows.length) { console.log('غير موجود'); process.exit(1); }
const v = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
console.log(JSON.stringify(v, null, 1));
