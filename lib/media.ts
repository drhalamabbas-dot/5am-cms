/* =============================================================================
   مكتبة الوسائط: الصور والفيديو والملفات.

   ملفات الموقع الأصلية في public/assets ولا تُحذف من هنا. والمرفوعات في مجلد
   دائم خارج الكود (lib/uploads.ts)، وصفٌّ لكل ملف في جدول media كي يظهر في
   المكتبة ويُبحث فيه.

   القيود هنا قيود أمان لا ذوق: الامتداد يُفحص، ومحتوى الملف يُطابَق بنوعه،
   والاسم يُنظَّف، والمسار يُتحقَّق أنه داخل مجلد الرفع.

   الصور تُعالَج عند الرفع: تُصغَّر إلى 2560 بكسل على الأكثر وتُدار حسب
   اتجاه الكاميرا، وتُحذف بياناتها المخفية (ومنها موقع التصوير)، ويُصنع لصور
   jpg بديل webp يختاره المتصفح. الصور الحية (gif) تبقى كما هي.
============================================================================= */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { q, q1 } from './db';
import { MEDIA_PREFIX, uploadRoot, uploadFile, insideApp } from './uploads';

export type MediaKind = 'image' | 'video' | 'audio' | 'document';

export type MediaRow = {
  id: number; path: string; kind: MediaKind;
  width: number | null; height: number | null; bytes: number | null;
  alt_en: string | null; alt_ar: string | null; folder: string | null;
};

/** ما يُقبل رفعه، ومجلده، وأقصى حجم له، وأول بايتاته.
 *  SVG غير مقبول: هو مستند قد يحمل سكربتًا، وتنظيفه بأمان مشروع وحده. */
const TYPES: Record<string, { kind: MediaKind; dir: string; max: number; magic: (b: Buffer) => boolean }> = {
  jpg: { kind: 'image', dir: 'img', max: 20, magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  jpeg: { kind: 'image', dir: 'img', max: 20, magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  png: { kind: 'image', dir: 'img', max: 20, magic: (b) => b.toString('hex', 0, 4) === '89504e47' },
  webp: { kind: 'image', dir: 'img', max: 20, magic: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  gif: { kind: 'image', dir: 'img', max: 20, magic: (b) => b.toString('ascii', 0, 4) === 'GIF8' },
  mp4: { kind: 'video', dir: 'video', max: 200, magic: (b) => b.toString('ascii', 4, 8) === 'ftyp' },
  webm: { kind: 'video', dir: 'video', max: 200, magic: (b) => b.toString('hex', 0, 4) === '1a45dfa3' },
  pdf: { kind: 'document', dir: 'docs', max: 40, magic: (b) => b.toString('ascii', 0, 5) === '%PDF-' },

  /* الصوت — الرسائل الصوتية في المحادثة.

     المسجّل في المتصفّح يُخرج ما يدعمه: كروم وفَيَرفُكس يعطيان Opus في وعاء
     WebM، وسَفاري يعطي AAC في وعاء MP4. و«weba» و«m4a» امتدادان يميّزان
     الصوت عن الفيديو مع أن وعاءهما نفسه، فلا يظهر صوتٌ في شاشة الفيديو.
     وبصمة البايتات واحدة لأن الوعاء واحد — وهذا ما يُفحَص. */
  weba: { kind: 'audio', dir: 'audio', max: 25, magic: (b) => b.toString('hex', 0, 4) === '1a45dfa3' },
  m4a: { kind: 'audio', dir: 'audio', max: 25, magic: (b) => b.toString('ascii', 4, 8) === 'ftyp' },
  ogg: { kind: 'audio', dir: 'audio', max: 25, magic: (b) => b.toString('ascii', 0, 4) === 'OggS' },
  mp3: {
    kind: 'audio', dir: 'audio', max: 25,
    magic: (b) => b.toString('ascii', 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  },
};

export const ACCEPT = Object.keys(TYPES).map((e) => '.' + e).join(',');
export const MAX_MB = Math.max(...Object.values(TYPES).map((t) => t.max));

/** أكبر ضلع للصورة بعد الرفع: يكفي شاشة عريضة بدقة عالية. */
const MAX_SIDE = 2560;

/** اسم ملف آمن: حروف وأرقام وشرطات، بلا مسارات ولا حروف تكسر العناوين. */
function safeName(name: string) {
  const ext = path.extname(name).toLowerCase().replace('.', '');
  const base = path.basename(name, path.extname(name))
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ\s._-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60);
  return { base: base || 'file', ext };
}

/**
 * يكتب الملف باسم جديد لم يُستعمل من قبل. لاحقة عشوائية تجعل الاسم لا يتكرّر
 * أبدًا، فيُخزَّن الملف في المتصفح طويلًا بلا خوف من أن يتغيّر محتواه. والفتح
 * بـ wx يفشل إن وُجد الاسم، فلا يستبدل رفعان متزامنان أحدهما الآخر.
 */
async function writeNew(dir: string, base: string, ext: string, data: Buffer): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const name = `${base}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const full = path.join(dir, name);
    try {
      await fs.writeFile(full, data, { flag: 'wx' });
      return name;
    } catch (e: any) {
      if (e?.code === 'EEXIST') continue;
      /* كتابة انقطعت في منتصفها (قرص ممتلئ مثلًا) تترك ملفًا ناقصًا باسمنا */
      await fs.unlink(full).catch(() => {});
      throw e;
    }
  }
  throw new Error('تعذّر اختيار اسم للملف');
}

/**
 * يكتب الملف كاملًا تحت اسم مؤقت ثم ينقله إلى اسمه. وجود الاسم النهائي هو ما
 * يعتمد عليه العارض (hasWebp)، فلا يجوز أن يظهر قبل اكتمال الكتابة.
 */
async function writeComplete(full: string, data: Buffer) {
  const tmp = `${full}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  try {
    await fs.writeFile(tmp, data, { flag: 'wx' });
    await fs.rename(tmp, full);
  } catch (e) {
    await fs.unlink(tmp).catch(() => {});
    throw e;
  }
}

/* sharp مكتبة بملفات مبنية لكل نظام. إن لم تُحمَّل على الخادم تُرفض الصور
   برسالة واضحة بدل أن تُحفظ بلا فحص ولا تصغير وبموقع تصويرها — والفيديو
   وملفات PDF تُرفع كالعادة. npm run check يكشف ذلك قبل التشغيل. */
type Sharp = typeof import('sharp').default;
let sharpLoad: Promise<Sharp | null> | null = null;
const loadSharp = () =>
  (sharpLoad ??= import('sharp').then((m) => (m.default ?? m) as unknown as Sharp).catch((e) => {
    console.warn('[media] sharp غير متاح، تُحفظ الصور بلا معالجة:', e?.message ?? e);
    return null;
  }));

type Processed = { data: Buffer; width: number | null; height: number | null; webp: Buffer | null };

/** يصغّر الصورة ويديرها ويحذف بياناتها المخفية، ويصنع بديل webp لصور jpg. */
async function processImage(buf: Buffer, ext: string): Promise<Processed | { error: string }> {
  const sharp = await loadSharp();
  if (!sharp) return { error: 'معالجة الصور غير متاحة على الخادم الآن (sharp). شغّل npm run check' };
  try {
    /* الصورة الحية تُفحص أنها صورة سليمة ولا يُعاد ترميزها، كي تبقى حركتها. */
    if (ext === 'gif') {
      const meta = await sharp(buf, { failOn: 'error', animated: true }).metadata();
      return { data: buf, width: meta.width ?? null, height: meta.pageHeight ?? meta.height ?? null, webp: null };
    }

    let pipe = sharp(buf, { failOn: 'error' })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
    pipe = ext === 'png' ? pipe.png({ compressionLevel: 9 })
      : ext === 'webp' ? pipe.webp({ quality: 82 })
      : pipe.jpeg({ quality: 82, mozjpeg: true });
    /* الناتج يُستعمل دائمًا ولو كان أكبر قليلًا من الأصل: إعادة الترميز هي
       ما يحذف بيانات الكاميرا المخفية، ومنها موقع التصوير. */
    const { data, info } = await pipe.toBuffer({ resolveWithObject: true });

    let webp: Buffer | null = null;
    if (ext === 'jpg' || ext === 'jpeg') {
      try { webp = await sharp(data).webp({ quality: 80 }).toBuffer(); }
      catch { webp = null; }   // البديل تحسين؛ بدونه تُعرض jpg
    }
    return { data, width: info.width, height: info.height, webp };
  } catch {
    return { error: 'الصورة تالفة أو بصيغة لا تُقرأ' };
  }
}

export type UploadResult = { ok: true; row: MediaRow } | { ok: false; error: string };

/**
 * يحفظ ملفًا مرفوعًا.
 *
 * `owner` يجعله خاصًّا: يُكتَب في «chat/» ويُسجَّل صاحبُه، فلا يصرفه
 * ‎/media‎ إلا له أو لموظفٍ يتابع المحادثات. وبدونه يدخل مكتبةَ الموقع
 * العامّة — وهي عامّةٌ بطبعها: صورُ المنتجات والكتالوجات يراها الزائر.
 *
 * الصورةُ التي يبعثها عميلٌ من موقع عمله ليست من ذلك: كانت تُحفَظ في
 * المكتبة نفسها فيفتحها كلُّ من يملك الرابط.
 */
export async function saveUpload(file: File, owner?: { accountId: number }): Promise<UploadResult> {
  const { base, ext } = safeName(file.name);
  const spec = TYPES[ext];
  if (!spec) {
    return { ok: false, error: `${file.name}: نوع غير مسموح (${ext || 'بلا امتداد'}). المسموح: صور jpg و png و webp و gif، وفيديو mp4 و webm، وملفات pdf.` };
  }
  if (file.size > spec.max * 1024 * 1024) {
    return { ok: false, error: `${file.name}: الحجم أكبر من ${spec.max} ميجابايت` };
  }
  if (file.size === 0) return { ok: false, error: `${file.name}: ملف فارغ` };

  const root = uploadRoot();
  if (!root) return { ok: false, error: 'مجلد الرفع غير مضبوط على الخادم (UPLOAD_DIR). راجع DEPLOY.md.' };
  if (process.env.NODE_ENV === 'production' && insideApp(root)) {
    return { ok: false, error: 'مجلد الرفع (UPLOAD_DIR) داخل مجلد الموقع، فسيُمحى عند النشر. ضعه خارجه — راجع DEPLOY.md.' };
  }

  const raw = Buffer.from(await file.arrayBuffer());
  if (!spec.magic(raw)) {
    return { ok: false, error: `${file.name}: محتوى الملف لا يطابق امتداده` };
  }

  let data: Buffer = raw;
  let width: number | null = null;
  let height: number | null = null;
  let webp: Buffer | null = null;
  if (spec.kind === 'image') {
    const p = await processImage(raw, ext);
    if ('error' in p) return { ok: false, error: `${file.name}: ${p.error}` };
    ({ data, width, height, webp } = p);
  }

  /* مرفقات المحادثات في مجلدها، فيكفي المسارُ وحده ليعرف ‎/media‎ أنها
     خاصّةٌ تُحرَس، ولا تختلط بصور الموقع في شاشة المكتبة. */
  const sub = owner ? `chat/${spec.dir}` : spec.dir;
  const dir = path.join(root, ...sub.split('/'));
  await fs.mkdir(dir, { recursive: true });

  /* 1) الملفات على القرص. لا ملف بلا صفّ: ما كُتب يُحذف إن فشل ما بعده. */
  const written: string[] = [];
  const cleanup = () => Promise.all(written.map((f) => fs.unlink(f).catch(() => {})));
  let name: string;
  try {
    name = await writeNew(dir, base, ext, data);
    written.push(path.join(dir, name));

    /* البديل باسم الأصل نفسه: «x-1a2b.jpg» ← «x-1a2b.webp»، فيجده العارض. */
    if (webp) {
      const alt = path.join(dir, name.replace(/\.jpe?g$/i, '.webp'));
      try {
        await writeComplete(alt, webp);
        written.push(alt);
      } catch { /* يُعرض الأصل وحده */ }
    }
  } catch (e) {
    await cleanup();
    console.error('[media] تعذّرت الكتابة:', e);
    return { ok: false, error: `${file.name}: تعذّر حفظ الملف` };
  }

  /* 2) التسجيل. بعد نجاحه الملفات ملك الصفّ، فلا تُحذف مهما حدث بعده. */
  const rel = `${MEDIA_PREFIX}${sub}/${name}`;
  let id: number;
  try {
    const res = await q(
      'INSERT INTO media (path, kind, bytes, folder, width, height) VALUES (?,?,?,?,?,?)',
      [rel, spec.kind, data.length, sub, width, height]
    ) as unknown as { insertId: number };
    id = res.insertId;
    /* صاحب الملف: عليه يقوم الحارس في ‎/media‎ */
    if (owner) {
      await q('INSERT INTO chat_files (path, account_id) VALUES (?,?) ON DUPLICATE KEY UPDATE account_id = VALUES(account_id)',
        [rel, owner.accountId]);
    }
  } catch (e) {
    await cleanup();
    console.error('[media] تعذّر التسجيل:', e);
    return { ok: false, error: `${file.name}: تعذّر حفظ الملف` };
  }

  /* 3) قراءة الصفّ للعرض. إن تعذّرت يُبنى مما هو معروف — الرفع نفسه تمّ. */
  const row = await q1<MediaRow>('SELECT * FROM media WHERE id = ?', [id]).catch(() => null);
  return {
    ok: true,
    row: row ?? {
      id, path: rel, kind: spec.kind, width, height, bytes: data.length,
      alt_en: null, alt_ar: null, folder: spec.dir,
    },
  };
}

/** ملف رفعه صاحب الموقع، لا من ملفات الموقع الأصلية. */
export const isUpload = (p: string) => p.startsWith(MEDIA_PREFIX);

/** حذف ملف من المكتبة ومن القرص. الملفات الأصلية للموقع لا تُحذف. */
export async function deleteMedia(id: number): Promise<{ ok: boolean; error?: string }> {
  const row = await q1<MediaRow>('SELECT * FROM media WHERE id = ?', [id]);
  if (!row) return { ok: false, error: 'غير موجود' };
  if (!isUpload(row.path)) {
    return { ok: false, error: 'هذا ملف من ملفات الموقع الأصلية، لا يُحذف من هنا.' };
  }
  await q('DELETE FROM media WHERE id = ?', [id]);
  const file = uploadFile(row.path);
  if (file) {
    await fs.unlink(file).catch(() => {});
    if (/\.jpe?g$/i.test(file)) await fs.unlink(file.replace(/\.jpe?g$/i, '.webp')).catch(() => {});
  }
  return { ok: true };
}

/** أين يُستعمل هذا الملف؟ يُسأل قبل الحذف. */
export async function usedBy(p: string): Promise<{ where: string; what: string }[]> {
  const like = `%${p}%`;
  const [sections, products, pages] = await Promise.all([
    q<any>(
      `SELECT pg.slug, s.type FROM sections s JOIN pages pg ON pg.id = s.page_id
        WHERE JSON_SEARCH(s.content, 'one', ?) IS NOT NULL OR CAST(s.content AS CHAR) LIKE ?`,
      [p, like]
    ),
    q<any>('SELECT slug, name_en FROM products WHERE hero_image = ? OR CAST(data AS CHAR) LIKE ?', [p, like]),
    q<any>('SELECT slug FROM pages WHERE og_image = ? OR CAST(hero AS CHAR) LIKE ?', [p, like]),
  ]);
  return [
    ...sections.map((r) => ({ where: `صفحة ${r.slug}`, what: 'سيكشن' })),
    ...products.map((r) => ({ where: `منتج ${r.name_en ?? r.slug}`, what: 'منتج' })),
    ...pages.map((r) => ({ where: `صفحة ${r.slug}`, what: 'هيرو أو صورة مشاركة' })),
  ];
}

export async function listMedia(opts: { kind?: string; q?: string; limit?: number } = {}) {
  /* مرفقات المحادثات ليست من مكتبة الموقع: يرفعها العملاء في محادثاتهم —
     صورُ أعطالهم وأوراقهم ووجوههم أحيانًا، وفيها إيصالُ دفعٍ وُجد بينها.
     وكانت تظهر هنا بين صور الموقع، فيراها كل من يفتح لوحة اختيار صورة،
     وقد تُوضع على صفحةٍ عامة بغلطة ضغطة.

     والاستثناء بجدول chat_files لا بالمسار وحده: المرفقات القديمة سبقت
     مجلد ‎media/chat‎ فهي في ‎media/img‎ و‎media/audio‎ بين صور الموقع،
     وجدولُ المالكين وحده يعرفها. وصفُّها يبقى في media: المحادثة تقرأ
     منه حجم الملف ومقاسه. */
  const where: string[] = [
    "path NOT LIKE 'media/chat/%'",
    'NOT EXISTS (SELECT 1 FROM chat_files f WHERE f.path = media.path)',
  ];
  const args: any[] = [];
  if (opts.kind && opts.kind !== 'all') { where.push('kind = ?'); args.push(opts.kind); }
  if (opts.q) { where.push('path LIKE ?'); args.push(`%${opts.q}%`); }
  const sql = `SELECT id, path, kind, width, height, bytes, alt_en, alt_ar, folder FROM media
    WHERE ${where.join(' AND ')}
    ORDER BY id DESC LIMIT ${Math.min(Number(opts.limit) || 400, 1000)}`;
  return q<MediaRow>(sql, args);
}
