/* رفع مرفقات المحادثة من جهة العميل: صورة أو فيديو أو رسالة صوتية.

   مسارٌ مستقلّ عن مكتبة اللوحة (api/admin/media) عمدًا: تلك للموظفين بصلاحية،
   وهذه لعميلٍ داخلٍ بحسابه — فلا يُفتَح بابُ المكتبة لأحدٍ من خارجها.

   الحدود هنا، لا في الواجهة وحدها:
   • الدخول شرط — ولو كانت المحادثة مفتوحةً للزوّار، فالملفات تبقى لأصحاب
     الحسابات: ملفٌّ بلا صاحبٍ معروف لا يُقبل.
   • ملف واحد في الطلب، وأنواعٌ ثلاثة لا غير (لا PDF ولا غيره من هنا).
   • 12 ملفًا في الساعة لكل حساب.
   • الحجم والبصمة يفحصهما saveUpload، وهو يعيد ترميز الصور فيمحو بيانات
     الكاميرا المخفية ومنها موقع التصوير.
*/
import { NextResponse } from 'next/server';
import { currentCustomer } from '@/lib/customerAuth';
import { saveUpload } from '@/lib/media';
import { getChatSettings } from '@/lib/chat/provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (v: unknown, status = 200) =>
  NextResponse.json(v, { status, headers: { 'Cache-Control': 'no-store' } });

/** ما يُقبل من هنا: صور وفيديو وصوت وPDF. الامتدادات نفسها التي يعرفها lib/media. */
const OK: Record<string, 'image' | 'video' | 'audio' | 'file'> = {
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', gif: 'image',
  mp4: 'video', webm: 'video',
  weba: 'audio', m4a: 'audio', ogg: 'audio', mp3: 'audio',
  /* كتالوجٌ أو تقريرُ عطل: PDF وحده من المستندات — وهو ما يفحص lib/media
     بصمتَه، فلا يمرّ مستندٌ آخر بامتدادٍ مستعار. */
  pdf: 'file',
};

/* يطابق أقصى ما يقبله lib/media للفيديو، وهو أكبر الأنواع — وما فوقه
   يُرفَض هنا قبل قراءة الجسم. وnext.config.ts يسمح بالقدر نفسه، وإلا قُطع
   الجسم قبل أن يصل. */
const MAX_MB = 200;
const MAX_BYTES = MAX_MB * 1024 * 1024;

const hits = new Map<string, number[]>();
function limited(key: string, max: number, ms: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < ms);
  if (list.length >= max) { hits.set(key, list); return true; }
  list.push(now); hits.set(key, list);
  if (hits.size > 2000) hits.clear();
  return false;
}

export async function POST(req: Request) {
  const s = await getChatSettings();
  if (!s.enabled) return json({ ok: false, error: 'off' }, 403);

  const acc = await currentCustomer();
  if (!acc) return json({ ok: false, error: 'login' }, 401);
  if (limited(`up:${acc.id}`, 12, 3600_000)) return json({ ok: false, error: 'wait' }, 429);

  /* الحجم يُفحَص من الترويسة قبل قراءة الجسم: ما تجاوز الحدّ يصل مبتورًا،
     فيفشل تحليلُه برسالةٍ عن «تنسيق» لا عن حجم — وهي تُحيّر من يقرؤها. */
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) return json({ ok: false, error: 'big', max: MAX_MB }, 413);

  let form: FormData;
  try { form = await req.formData(); } catch (e: any) {
    console.error('[chat/upload] formData', e?.message ?? e);
    /* فشل التحليل بعد اجتياز فحص الترويسة: جسمٌ مقطوع أو ترويسةٌ كاذبة */
    return json({ ok: false, error: 'big', max: MAX_MB }, 413);
  }
  const file = form.get('file');
  if (!(file instanceof File) || !file.size) return json({ ok: false, error: 'empty' }, 400);

  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const kind = OK[ext];
  if (!kind) return json({ ok: false, error: 'type' }, 400);

  /* صاحبُه يُسجَّل معه: ‎/media‎ لا يصرفه لغيره ولا لغير موظّفي المحادثات */
  const r = await saveUpload(file, { accountId: acc.id });
  if (!r.ok) return json({ ok: false, error: 'save', detail: r.error }, 400);

  /* مدّة الصوت يقيسها المتصفّح ويرسلها: قياسها على الخادم يحتاج ffmpeg */
  const secs = Number(form.get('secs'));
  return json({
    ok: true,
    file: {
      url: r.row.path, kind,
      name: file.name.slice(0, 120), bytes: r.row.bytes ?? file.size,
      w: r.row.width, h: r.row.height,
      secs: Number.isFinite(secs) && secs > 0 ? Math.round(secs) : null,
    },
  });
}
