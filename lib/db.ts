/* اتصال واحد مشترك بقاعدة البيانات.
   في التطوير تُعاد تهيئة الوحدات عند كل تعديل، فنحفظ المجمّع على globalThis
   كي لا تتراكم الاتصالات حتى نفاد الحد المسموح. */
import mysql from 'mysql2/promise';

declare global {
  // eslint-disable-next-line no-var
  var __fiveamPool: mysql.Pool | undefined;
}

function create() {
  return mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fiveam_cms',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    // الاستضافة المشتركة تغلق الاتصالات الخاملة، فلا نبقي طابورًا لا نهائيًا
    queueLimit: 0,
    enableKeepAlive: true,
  });
}

export const pool: mysql.Pool = global.__fiveamPool ?? create();
if (process.env.NODE_ENV !== 'production') global.__fiveamPool = pool;

export async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function q1<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

/** ما ينفّذ الاستعلامات: المجمّع مباشرةً، أو اتصال معاملة جارية. */
export type Exec = { q: typeof q; q1: typeof q1 };
export const direct: Exec = { q, q1 };

/**
 * ينفّذ عدة كتابات كوحدة واحدة: تنجح كلها أو لا يُكتب منها شيء.
 *
 * كل استعلام داخل fn يجب أن يمرّ من db الممرَّر إليها، لا من q مباشرةً: q
 * تأخذ اتصالًا آخر من المجمّع، فتقع خارج المعاملة ولا يحميها التراجع.
 */
export async function tx<T>(fn: (db: Exec) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  const db: Exec = {
    q: async (sql, params = []) => (await conn.query(sql, params))[0] as any[],
    q1: async (sql, params = []) => ((await conn.query(sql, params))[0] as any[])[0] ?? null,
  };
  try {
    await conn.beginTransaction();
    const out = await fn(db);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}

/** تاريخ ووقت للعرض: يوم/شهر/سنة وساعة، بأرقام إنجليزية كي تُقرأ في جدول. */
export function when(v: unknown): string {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** أعمدة JSON قد تعود نصًا أو كائنًا حسب الإصدار والسائق. */
export function json<T = any>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return v as T;
}
