/* =============================================================================
   البوت يقرأ الصور.

   عميلُ معدّاتٍ يصوّر لوحةَ عدّادات أو تسريبًا أو لوحةَ موديلٍ على المكنسة؛
   وصفُ ما في الصورة بالكلام أصعبُ من تصويرها. فتُقرأ الصورة ويُقال ما فيها.

   الصورة تُصغَّر وتُرسَل مضمَّنةً (base64) لا برابطها: الموقع قد يكون خلف
   حسابٍ أو على جهازٍ محلّي، فرابطُه لا يصل إلى المزوّد. والتصغير يخفض الطلب
   من ميغابايتات إلى عشرات الكيلوبايتات بلا فقدِ ما يُقرأ في صورة عطل.

   وما لا يُقرأ لا يُدَّعى: إن غاب الموديل أو فشل، تُقال الحقيقة ويُعرَض
   موظفٌ — لا وصفٌ مخترَعٌ لصورةٍ لم تُرَ.
============================================================================= */
import sharp from 'sharp';
import fs from 'node:fs';
import { uploadFile } from '../uploads';
import { getSecret } from '../secrets';
import { getChatSettings } from './provider';

/** أكبر ضلع يُرسَل. رُفِع إلى 1600: لوحةُ الموديل أرقامٌ صغيرة على معدنٍ
 *  متّسخ، وكل بكسلٍ يضيع منها يضيع رقمًا — وهي ما يُبنى عليه اختيارُ القطعة. */
const SIDE = 1600;
/** حدٌّ للطلب كلّه بعد الترميز، كي لا يُرفَض من المزوّد */
const MAX_B64 = 1_400_000;

export type VisionOut =
  | { ok: true; text: string; model: string }
  | { ok: false; why: 'off' | 'nokey' | 'read' | 'model'; detail?: string };

/** الصورة مصغَّرةً ومُرمَّزة data:URL، أو null إن تعذّر قراءتها.
 *  `crop` يقتطع وسطَها ثم يُكبّره: أرقامٌ صغيرة في صورةٍ كبيرة تذوب حين
 *  تُصغَّر الصورة كلّها، وتُقرأ حين يُقتطَع موضعُها وحده. */
async function inline(rel: string, crop = false): Promise<string | null> {
  const file = uploadFile(rel);
  if (!file || !fs.existsSync(file)) return null;
  try {
    let q = 80;
    for (let i = 0; i < 3; i++) {
      let pipe = sharp(file, { failOn: 'error' }).rotate();
      if (crop) {
        const meta = await sharp(file).metadata();
        const w = meta.width ?? 0, h = meta.height ?? 0;
        /* النصف الأوسط: العميل يصوّر اللوحة في وسط الكادر */
        if (w > 700 && h > 500) {
          pipe = pipe.extract({
            left: Math.round(w * 0.22), top: Math.round(h * 0.22),
            width: Math.round(w * 0.56), height: Math.round(h * 0.56),
          });
        } else return null;              // صغيرةٌ أصلًا: القصّ لا يضيف
      }
      const buf = await pipe
        .resize({ width: SIDE, height: SIDE, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: q, mozjpeg: true })
        .toBuffer();
      const b64 = buf.toString('base64');
      if (b64.length <= MAX_B64) return `data:image/jpeg;base64,${b64}`;
      /* صورةٌ ضخمة التفاصيل: تُعاد بجودةٍ أقلّ بدل أن تُرفَض */
      q -= 22;
    }
    return null;
  } catch { return null; }
}

/** هل السؤال عن رقمٍ أو لوحةِ موديل؟ عندها تُرسَل لقطةٌ مقرَّبة معها. */
const WANTS_PLATE = /موديل|لوحة|رقم|سيريال|تسلسل|شاسيه|قطع|قطعة|model|serial|plate|part ?no|chassis/i;

/* قصيرةٌ عمدًا: الموديل يفكّر داخليًّا بقدر ما يُملى عليه، والتعليماتُ الطويلة
   تستهلك حدَّ الردّ في التفكير فيعود فارغًا. هذه تقول الدور والتركيز في
   ثلاثة أسطر، وجُرِّبت فردّت.

   ودورها التعرّفُ لا البيع: ما تخرجه يُسلَّم إلى بوت المبيعات (lib/chat/bot)
   الذي يعرف الكتالوج ويمرّ ردّه على فلتر الأسعار. فلو باعت هنا لباعت من
   خيالها — وهي لا ترى المخزون ولا الأسعار. */
const SYS_AR = `إنت فنّي معدّات في 5A&M (مكانس Elgin، شفط Vactor وGuzzler، مولدات وقطع غيار).
اتفرّج على الصور وقول بالترتيب: نوع المعدة وماركتها وموديلها لو باين، أي أرقام أو لوحة موديل أو لوجو،
الحالة (نضيفة/مستعملة/فيها عطل أو تسريب أو تآكل)، أي قراءة عدّاد أو لمبة تحذير، والقطعة اللي الصورة مركّزة عليها لو فيه.
عامية مصرية ومختصر. قول المؤكد بس ومتخمّنش. متقولش أسعار ولا مواعيد ولا توفّر.`;

const SYS_EN = `You are an equipment technician at 5A&M (Elgin sweepers, Vactor and Guzzler vacuum units, generators and spare parts).
Look at the images and state, in order: the equipment type, brand and model if visible; any numbers, model plate or logo;
its condition (clean / used / any fault, leak or wear); any gauge reading or warning light; and the specific part the photo focuses on, if any.
Be brief. Say only what you are sure of, do not guess. No prices, dates or availability.`;

/**
 * يقرأ صورةً (أو صورتين) ويصف ما فيها، ومعها سؤال العميل إن كتبه.
 *
 * @param paths مسارات داخل media/ كما تُحفَظ في الرسالة
 */
export async function readImages(
  paths: string[], question: string, lang: 'ar' | 'en', opts: { clip?: boolean } = {}
): Promise<VisionOut> {
  const s = await getChatSettings();
  if (s.provider === 'off' || !s.visionModel || s.visionModel === 'none') return { ok: false, why: 'off' };
  const key = await getSecret('openrouter');
  if (!key) return { ok: false, why: 'nokey' };

  /* لقطاتُ مقطعٍ تُقرأ معًا فتُفهَم الحركة، وصورتان تكفيان لغير ذلك */
  const cap = opts.clip ? 4 : 2;
  const urls = (await Promise.all(paths.slice(0, cap).map((p) => inline(p)))).filter(Boolean) as string[];
  if (!urls.length) return { ok: false, why: 'read' };

  /* سؤالٌ عن رقمٍ أو لوحة: تُضاف لقطةٌ مقرَّبة من الأولى. الصورةُ كاملةً
     تقول أيُّ معدّة، والمقرَّبةُ تقول أيُّ رقم — وكلاهما لازم. */
  const plate = !opts.clip && WANTS_PLATE.test(question);
  if (plate) {
    const zoom = await inline(paths[0], true);
    if (zoom) urls.push(zoom);
  }

  /* يُقال للموديل إنها لقطاتٌ من مقطعٍ واحد بالترتيب، وإلا وصفها صورًا
     منفصلة فقال «ثلاث صور» عن مقطعٍ واحد. */
  const clipNote = opts.clip
    ? (lang === 'ar'
      ? `\n\nدي ${urls.length} لقطات من فيديو واحد بالترتيب من أوله لآخره — اوصف المقطع كمقطع واحد، ولو في حاجة بتتغيّر بينهم قولها.`
      : `\n\nThese are ${urls.length} frames from one video, in order — describe it as a single clip, and say what changes between them.`)
    : '';

  /* حين يُسأل عن رقم: يُقال له إن الأخيرة تقريبٌ للأولى، وإلا عدّها صورةً
     ثانية فقال «معدّتان». ويُطلَب نسخُ ما يقرؤه حرفًا حرفًا لا تفسيرُه. */
  const plateNote = plate
    ? (lang === 'ar'
      ? '\n\nالصورة الأخيرة هي نفس الأولى مكبّرة. اقرا أي أرقام أو حروف على اللوحات حرفًا حرفًا زي ما هي، ولو حرف مش واضح حطّ مكانه «؟» ومتخمّنوش.'
      : '\n\nThe last image is the same as the first, zoomed in. Transcribe any numbers or letters on plates character by character exactly as they appear; put “?” for any character you cannot read, and do not guess it.')
    : '';

  const ask = (question.trim()
    || (lang === 'ar' ? (opts.clip ? 'إيه اللي في الفيديو ده؟' : 'إيه اللي في الصورة دي؟')
      : (opts.clip ? 'What is in this video?' : 'What is in this image?'))) + clipNote + plateNote;

  const body = {
    model: s.visionModel,
    messages: [
      { role: 'system', content: lang === 'ar' ? SYS_AR : SYS_EN },
      {
        role: 'user',
        content: [
          { type: 'text', text: ask },
          ...urls.map((url) => ({ type: 'image_url', image_url: { url } })),
        ],
      },
    ],
    temperature: 0.2,
    /* سخيٌّ عمدًا: موديلات الرؤية المجانية تفكّر داخليًّا من الحدّ نفسه،
       وبعضها يرفض إيقاف التفكير («Reasoning is mandatory for this
       endpoint»). فبحدٍّ ضيّق كان التفكير يستهلكه كلّه ويعود المحتوى فارغًا
       بـfinish_reason: "length" — فيُقرأ كأنّه عجز عن رؤية الصورة. */
    max_tokens: 2200,
  };

  /* سلسلةٌ لا موديلٌ واحد: الموديلات المجانية تنفد حصّتها يومًا وتختفي يومًا،
     وبواحدٍ كان عطبُه يعني ألّا يفهم البوت الصورةَ أصلًا. تُجرَّب المختار ثم
     ما يتاح من موديلات الرؤية المجانية — كما يفعل البوت النصّي. */
  const chain = [s.visionModel, ...(await freeVision(key)).filter((m) => m !== s.visionModel)].slice(0, 5);
  let why = 'لا موديل';
  for (const model of chain) {
    const r = await askOne({ ...body, model }, key);
    if (r.ok) return { ok: true, text: r.text, model };
    why = r.why;
    console.warn('[vision] لم يُقرأ:', model, why);
    /* مفتاحٌ خطأ أو رصيدٌ ناقص: لا يصلحه موديلٌ آخر */
    if (/insufficient credits|invalid api key|balance/i.test(why)) break;
  }
  return { ok: false, why: 'model', detail: why.slice(0, 160) };
}

async function askOne(body: object, key: string): Promise<{ ok: true; text: string } | { ok: false; why: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30_000);
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': process.env.SITE_URL?.trim() || 'https://www.5a-eg.com',
        'X-Title': '5A&M',
      },
      body: JSON.stringify(body),
    });
    const d: any = await r.json().catch(() => ({}));
    const text = String(d?.choices?.[0]?.message?.content ?? '').trim();
    if (r.status === 200 && text) return { ok: true, text };
    /* 200 بلا نصّ: استهلك الحدَّ في تفكيره — يُقال كما هو لا «HTTP 200» */
    const fin = d?.choices?.[0]?.finish_reason;
    return { ok: false, why: d?.error?.message ?? (fin ? `ردّ فارغ (${fin})` : `HTTP ${r.status}`) };
  } catch (e: any) {
    return { ok: false, why: e?.name === 'AbortError' ? 'انتهت المهلة' : String(e?.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}

/* قائمة الموديلات المجانية التي تقبل صورًا. تُسأل مرّةً كل ساعة: هي تتغيّر
   على OpenRouter، وسؤالها مع كل صورة رحلةٌ زائدة. */
let freeCache: { at: number; ids: string[] } = { at: 0, ids: [] };
async function freeVision(key: string): Promise<string[]> {
  if (Date.now() - freeCache.at < 3600_000 && freeCache.ids.length) return freeCache.ids;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${key}` } });
    const d: any = await r.json();
    const ids = (d?.data ?? [])
      .filter((x: any) => (x?.architecture?.input_modalities ?? []).includes('image')
        && Number(x?.pricing?.prompt ?? 1) === 0 && Number(x?.pricing?.completion ?? 1) === 0)
      /* مصنِّفات الأمان ونماذج البرمجة تردّ ردًّا لا يصف صورة، فتؤخَّر */
      .map((x: any) => String(x.id))
      .sort((a: string, b: string) => Number(/safety|guard|moderation|code|embed/i.test(a)) - Number(/safety|guard|moderation|code|embed/i.test(b)));
    freeCache = { at: Date.now(), ids };
    return ids;
  } catch { return freeCache.ids; }
}
