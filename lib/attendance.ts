/* =============================================================================
   الحضور والانصراف للأدمنز.

   المتصفح يصوّر الموظف ويحسب «بصمة» وجهه (128 رقمًا، بنموذج face-api مفتوح
   المصدر يعمل في المتصفح)، ويرسلها مع الصورة والموقع. الخادم:
   1) يرفض إن كان أبعد من نصف القطر عن المكتب (الحضور من المكتب فقط).
   2) يقارن البصمة ببصمة التسجيل: قريبة = «سليم»، بعيدة أو لا وجه = يُسجَّل
      «للمراجعة» ويظهر للموظف أن وجهه لم يُتعرَّف عليه. السوبر أدمن يراجع
      الصورة ويقبل أو يرفض.
   الساعات مرنة: يُسجَّل وقت الحضور والانصراف والمدة، بلا «تأخير».

   البصمة تُحسب في المتصفح، فموظف عابث قد يرسل بصمة غيره — لذلك تُحفظ صورة كل
   حضور وانصراف، وهي الدليل عند المراجعة.
============================================================================= */
import { getSetting } from './content';

export type AttSettings = { lat: number | null; lng: number | null; radius: number; threshold: number };

export async function getAttSettings(): Promise<AttSettings> {
  const s = await getSetting<Partial<AttSettings>>('attendance', {});
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    lat: n(s.lat), lng: n(s.lng),
    radius: Math.max(50, Math.min(5000, n(s.radius) ?? 200)),
    threshold: Math.max(0.3, Math.min(0.7, n(s.threshold) ?? 0.5)),
  };
}

/** المسافة بالمتر بين نقطتين على الأرض */
export function meters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** بصمة صالحة: 128 رقمًا محدودًا */
export function cleanDescriptor(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length !== 128) return null;
  const out = v.map(Number);
  return out.every((x) => Number.isFinite(x) && Math.abs(x) < 2) ? out : null;
}

/** المسافة بين بصمتين: حتى 0.5 تقريبًا = الشخص نفسه */
export function faceDistance(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < 128; i++) s += (a[i] - b[i]) ** 2;
  return Math.round(Math.sqrt(s) * 1000) / 1000;
}

/** الآن بتوقيت القاهرة: اليوم والوقت بالصيغة التي تحفظها القاعدة */
export function cairoNow(): { day: string; at: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  const day = `${p.year}-${p.month}-${p.day}`;
  return { day, at: `${day} ${p.hour}:${p.minute}:${p.second}` };
}

/** «7 س 25 د» من وقتين */
export function duration(a: unknown, b: unknown): string {
  if (!a || !b) return '—';
  const m = Math.round((new Date(String(b)).getTime() - new Date(String(a)).getTime()) / 60000);
  if (!Number.isFinite(m) || m < 0) return '—';
  return `${Math.floor(m / 60)} س ${m % 60} د`;
}
export const minutes = (a: unknown, b: unknown) => {
  if (!a || !b) return 0;
  const m = Math.round((new Date(String(b)).getTime() - new Date(String(a)).getTime()) / 60000);
  return Number.isFinite(m) && m > 0 ? m : 0;
};

export const ATT_STATUS: Record<string, [string, string]> = {
  ok: ['سليم', 'tag--on'], review: ['للمراجعة', 'tag--todo'], rejected: ['مرفوض', 'tag--off'],
};
