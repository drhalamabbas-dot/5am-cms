/* تسجيل الحضور والانصراف وتسجيل الوجه (lib/attendance.ts).

   POST { kind: 'enroll' | 'in' | 'out', descriptor, photo, lat, lng, accuracy, consent }
   الردّ دائمًا { ok, status?, message } — والرسالة تظهر للموظف كما هي. */
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { audit } from '@/lib/audit';
import { saveJpeg } from '@/lib/private';
import { getAttSettings, meters, cleanDescriptor, faceDistance, cairoNow } from '@/lib/attendance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reply = (ok: boolean, message: string, extra: object = {}, status = 200) =>
  NextResponse.json({ ok, message, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return reply(false, 'انتهت جلستك — ادخل من جديد.', {}, 401);
  const raw = await req.text();
  if (raw.length > 900_000) return reply(false, 'الصورة أكبر من المسموح.', {}, 413);
  let b: any;
  try { b = JSON.parse(raw); } catch { return reply(false, 'صيغة غير صالحة.', {}, 400); }
  const kind = b?.kind;
  const desc = cleanDescriptor(b?.descriptor);
  const { day, at } = cairoNow();
  const s = await getAttSettings();

  /* ---------------------------------------------------- تسجيل الوجه أول مرة */
  if (kind === 'enroll') {
    if (b?.consent !== true) return reply(false, 'لازم توافق على حفظ بصمة وجهك أولًا.');
    if (!desc) return reply(false, 'لم يظهر وجه واضح في الصورة. قف في إضاءة جيدة وانظر للكاميرا.');
    if (await q1('SELECT user_id FROM face_profiles WHERE user_id = ?', [u.id])) {
      return reply(false, 'وجهك مسجّل من قبل. لإعادة التسجيل اطلب من السوبر أدمن مسح البصمة القديمة.');
    }
    const photo = await saveJpeg(b?.photo, `faces/${u.id}`, 'enroll');
    if (!photo) return reply(false, 'تعذّر حفظ الصورة. حاول مرة أخرى.');
    await q('INSERT INTO face_profiles (user_id, descriptor, photo) VALUES (?, ?, ?)', [u.id, JSON.stringify(desc), photo]);
    await audit(u, 'attendance.enroll', { entity: 'user', id: u.id, summary: u.name ?? u.email });
    return reply(true, 'سُجّل وجهك. تقدر الآن تسجّل الحضور والانصراف.', { status: 'enrolled' });
  }
  if (kind !== 'in' && kind !== 'out') return reply(false, 'طلب غير معروف.', {}, 400);

  /* ------------------------------------------------------- المكان: المكتب فقط */
  const lat = Number(b?.lat), lng = Number(b?.lng), acc = Math.max(0, Number(b?.accuracy) || 0);
  if (s.lat == null || s.lng == null) return reply(false, 'موقع المكتب غير مضبوط. اطلب من السوبر أدمن ضبطه من شاشة الحضور.');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return reply(false, 'لازم تسمح للمتصفح بمعرفة موقعك: الحضور والانصراف من المكتب فقط.');
  }
  const dist = meters(s.lat, s.lng, lat, lng);
  /* دقة الموقع في المباني ضعيفة أحيانًا: يُسامَح بها حتى 100 متر */
  if (dist - Math.min(acc, 100) > s.radius) {
    return reply(false, `أنت على بعد ${dist.toLocaleString('en-US')} متر من المكتب. الحضور والانصراف من المكتب فقط (حتى ${s.radius} متر).`);
  }

  /* -------------------------------------------------------------- الوجه */
  const prof = await q1<any>('SELECT descriptor FROM face_profiles WHERE user_id = ?', [u.id]);
  if (!prof) return reply(false, 'سجّل وجهك أولًا (مرة واحدة).', { need: 'enroll' });
  const known = cleanDescriptor(typeof prof.descriptor === 'string' ? JSON.parse(prof.descriptor) : prof.descriptor);
  const match = desc && known ? faceDistance(desc, known) : null;
  const recognised = match != null && match <= s.threshold;
  const photo = await saveJpeg(b?.photo, `attendance/${day.slice(0, 7)}`, `u${u.id}-${day}-${kind}`);
  if (!photo) return reply(false, 'تعذّر حفظ الصورة. حاول مرة أخرى.');

  if (kind === 'in') {
    const row = await q1<any>('SELECT id, check_in FROM attendance WHERE user_id = ? AND day = ?', [u.id, day]);
    if (row?.check_in) return reply(false, 'سجّلت حضورك اليوم بالفعل.');
    const status = recognised ? 'ok' : 'review';
    const note = recognised ? null : (match == null ? 'لم يظهر وجه في صورة الحضور' : 'الوجه لا يطابق التسجيل');
    if (row) {
      await q(`UPDATE attendance SET check_in = ?, in_photo = ?, in_match = ?, in_lat = ?, in_lng = ?, in_dist = ?,
                 status = IF(status = 'ok', ?, status), note = COALESCE(?, note) WHERE id = ?`,
        [at, photo, match, lat, lng, dist, status, note, row.id]);
    } else {
      await q(`INSERT INTO attendance (user_id, day, check_in, in_photo, in_match, in_lat, in_lng, in_dist, status, note)
               VALUES (?,?,?,?,?,?,?,?,?,?)`, [u.id, day, at, photo, match, lat, lng, dist, status, note]);
    }
    return reply(true, recognised
      ? `أهلًا ${u.name ?? ''} — سُجّل حضورك الساعة ${at.slice(11, 16)}.`
      : 'لم نتعرّف على وجهك بوضوح — سُجّل حضورك وسيراجعه السوبر أدمن. جرّب إضاءة أفضل المرة القادمة.',
    { status });
  }

  /* الانصراف: آخر حضور مفتوح خلال 20 ساعة (يغطي من يخرج بعد منتصف الليل) */
  const open = await q1<any>(
    `SELECT id, check_in FROM attendance WHERE user_id = ? AND check_in IS NOT NULL AND check_out IS NULL
       AND check_in >= ? - INTERVAL 20 HOUR ORDER BY check_in DESC LIMIT 1`, [u.id, at]
  );
  const status = recognised ? 'ok' : 'review';
  const faceNote = recognised ? null : (match == null ? 'لم يظهر وجه في صورة الانصراف' : 'الوجه لا يطابق التسجيل');
  if (open) {
    await q(`UPDATE attendance SET check_out = ?, out_photo = ?, out_match = ?, out_lat = ?, out_lng = ?, out_dist = ?,
               status = IF(status = 'ok', ?, status), note = COALESCE(note, ?) WHERE id = ?`,
      [at, photo, match, lat, lng, dist, status, faceNote, open.id]);
  } else {
    const today = await q1<any>('SELECT id, check_out FROM attendance WHERE user_id = ? AND day = ?', [u.id, day]);
    if (today?.check_out) return reply(false, 'سجّلت انصرافك اليوم بالفعل.');
    /* انصراف بلا حضور (نسي يسجّل): يُحفظ للمراجعة */
    await q(`INSERT INTO attendance (user_id, day, check_out, out_photo, out_match, out_lat, out_lng, out_dist, status, note)
             VALUES (?,?,?,?,?,?,?,?, 'review', ?)`,
      [u.id, day, at, photo, match, lat, lng, dist, ['انصراف بلا تسجيل حضور', faceNote].filter(Boolean).join(' · ')]);
    return reply(true, 'سُجّل انصرافك — لكن لا يوجد حضور مسجّل اليوم، فسيراجعه السوبر أدمن.', { status: 'review' });
  }
  return reply(true, recognised
    ? `مع السلامة — سُجّل انصرافك الساعة ${at.slice(11, 16)}.`
    : 'لم نتعرّف على وجهك بوضوح — سُجّل انصرافك وسيراجعه السوبر أدمن.', { status });
}
