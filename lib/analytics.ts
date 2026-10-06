/* =============================================================================
   عدّ الزيارات — من الخادم، بلا كوكي ولا سكربت تتبّع ولا خدمة خارجية.

   كل صفحة يرسمها الخادم لزائر حقيقي تزيد عدّادات اليوم: الصفحة، ومن أين جاء
   (جوجل، فيسبوك، رابط مباشر، حملة utm)، والجهاز، واللغة. والزائر يُعدّ مرة في
   اليوم ببصمة تتغيّر يوميًا بمفتاح سري، فلا يُعرف من هو ولا يُتتبّع من يوم ليوم.
   الروبوتات وأدوات الاختبار وزيارات الأدمن لا تُعدّ.
============================================================================= */
import { createHash } from 'node:crypto';
import { q } from './db';

const BOT = /bot|crawl|spider|slurp|preview|monitor|curl|wget|python|httpclient|headless|lighthouse|node|undici|powershell|axios|go-http|facebookexternalhit|whatsapp|telegram/i;

/** اليوم بتوقيت القاهرة */
function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function sourceOf(referer: string | null, utm: string | null, host: string | null): string {
  if (utm) return `حملة: ${utm.slice(0, 60).toLowerCase()}`;
  if (!referer) return 'مباشر';
  let h = '';
  try { h = new URL(referer).hostname.replace(/^www\./, '').toLowerCase(); } catch { return 'مباشر'; }
  if (!h || (host && h === host.replace(/^www\./, '').split(':')[0])) return 'داخلي';
  if (/(^|\.)google\./.test(h)) return 'Google';
  if (/(^|\.)bing\.com$/.test(h)) return 'Bing';
  if (/facebook\.com$|fb\.com$|^l\.facebook|^lm\.facebook/.test(h)) return 'Facebook';
  if (/instagram\.com$/.test(h)) return 'Instagram';
  if (/linkedin\.com$|lnkd\.in$/.test(h)) return 'LinkedIn';
  if (/youtube\.com$|youtu\.be$/.test(h)) return 'YouTube';
  if (/t\.co$|twitter\.com$|x\.com$/.test(h)) return 'X';
  if (/whatsapp|wa\.me$/.test(h)) return 'WhatsApp';
  if (/chatgpt\.com$|openai\.com$|perplexity\.ai$|gemini\.google/.test(h)) return 'مساعد ذكاء اصطناعي';
  return h.slice(0, 80);
}

export function deviceOf(ua: string): string {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'تابلت';
  if (/mobi|iphone|android/i.test(ua)) return 'موبايل';
  return 'كمبيوتر';
}

/** يُستدعى بلا انتظار من صفحات الموقع؛ أي خطأ فيه لا يمسّ الصفحة */
export function recordView(o: { path: string; lang: string; ua: string | null; ip: string | null; referer: string | null; utm: string | null; host: string | null; product?: string | null }) {
  const ua = o.ua ?? '';
  if (!ua || BOT.test(ua)) return;
  const day = today();
  const rows: [string, string][] = [
    ['page', o.path.slice(0, 190)],
    ['source', sourceOf(o.referer, o.utm, o.host)],
    ['device', deviceOf(ua)],
    ['lang', o.lang === 'en' ? 'English' : 'عربي'],
  ];
  /* «داخلي» = تنقّل داخل الموقع، لا مصدر زيارة */
  const list = rows.filter(([d, k]) => !(d === 'source' && k === 'داخلي'));
  const vhash = createHash('sha256').update(`${day}|${o.ip ?? ''}|${ua}|${process.env.AUTH_SECRET ?? ''}`).digest('hex').slice(0, 32);
  (async () => {
    await q(`INSERT INTO traffic_daily (day, dim, k, n) VALUES ${list.map(() => '(?,?,?,1)').join(',')}
             ON DUPLICATE KEY UPDATE n = n + 1`, list.flatMap(([d, k]) => [day, d, k]));
    await q('INSERT IGNORE INTO visitors_daily (day, vhash) VALUES (?, ?)', [day, vhash]);
    /* مشاهدة المنتج (للمنتجات: مشاهدة ← طلب) بنفس شروط الزيارة */
    if (o.product) {
      await q(`INSERT INTO product_stats (product_id, day, views) SELECT id, ?, 1 FROM products WHERE (slug = ? OR ref = ?) AND published = 1 LIMIT 1
               ON DUPLICATE KEY UPDATE views = views + 1`, [day, o.product, o.product]);
    }
  })().catch(() => {});
}

/** مسح بصمات الزوار بعد 190 يومًا (تكفي مقارنة 90 يومًا بالـ 90 قبلها) والعدّادات بعد 400 يوم — مع مسح مدة الاحتفاظ اليومي */
export async function purgeTraffic() {
  await q('DELETE FROM visitors_daily WHERE day < CURDATE() - INTERVAL 190 DAY');
  await q('DELETE FROM traffic_daily WHERE day < CURDATE() - INTERVAL 400 DAY');
}
