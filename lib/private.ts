/* =============================================================================
   ملفات خاصة لا تُنشر أبدًا: صور الحضور والانصراف وصور تسجيل الوجه.

   مجلد الرفع العام (lib/uploads.ts) يعرضه app/media لأي زائر، فالصور الخاصة في
   مجلد آخر بجانبه لا مسار يعرضه — تُقرأ فقط من مسار في اللوحة يفحص الصلاحية.
   PRIVATE_DIR يضبطه على الاستضافة صراحةً، وإلا «<مجلد الرفع>-private».
============================================================================= */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { uploadRoot, insideApp } from './uploads';

export function privateRoot(): string | null {
  const env = process.env.PRIVATE_DIR?.trim();
  if (env) return path.resolve(env);
  const up = uploadRoot();
  return up ? `${up}-private` : null;
}

/** مسار ملف خاص على القرص، أو null إن خرج عن المجلد */
export function privateFile(rel: string): string | null {
  const root = privateRoot();
  if (!root || !rel || rel.includes('\0')) return null;
  const full = path.resolve(root, rel);
  return full.startsWith(root + path.sep) ? full : null;
}

/** صورة JPEG من المتصفح (data:image/jpeg;base64,…) بحدّ 600 كيلوبايت. يعيد مسارها النسبي */
export async function saveJpeg(dataUrl: unknown, folder: string, name: string): Promise<string | null> {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/jpeg;base64,')) return null;
  const buf = Buffer.from(dataUrl.slice(23), 'base64');
  /* صورة JPEG فعلًا (توقيعها FF D8 FF)، وبحجم معقول */
  if (buf.length < 1000 || buf.length > 600_000 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return null;
  const root = privateRoot();
  if (!root) return null;
  if (process.env.NODE_ENV === 'production' && insideApp(root)) return null;
  const rel = path.posix.join(folder, `${name}-${crypto.randomBytes(6).toString('hex')}.jpg`);
  const full = privateFile(rel);
  if (!full) return null;
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buf);
  return rel;
}

export async function removePrivate(rel: string | null | undefined) {
  const full = rel ? privateFile(rel) : null;
  if (full) await fs.unlink(full).catch(() => {});
}
