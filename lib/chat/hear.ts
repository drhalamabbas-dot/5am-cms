/* =============================================================================
   البوت يسمع الرسالة الصوتية.

   عميلٌ في موقع عملٍ ويداه متّسختان يتكلّم أسرع مما يكتب، وبالعامية التي
   يعرفها. فتُحوَّل رسالته نصًّا، ويردّ عليها بوتُ المبيعات كأنها كُتبت.

   والمقطع يُرسَل مضمَّنًا (base64) كالصور: الموقع قد يكون خلف حسابٍ أو على
   جهازٍ محلّي، فرابطه لا يصل إلى المزوّد.

   وما لا يُسمَع لا يُخمَّن: إن غاب الموديل أو فشل، تُقال الحقيقة ويُعرَض
   موظفٌ يسمعها بنفسه — لا ردٌّ على كلامٍ لم يُفهَم.
============================================================================= */
import fs from 'node:fs';
import { uploadFile } from '../uploads';
import { getSecret } from '../secrets';
import { getChatSettings } from './provider';

/** أكبر مقطعٍ يُرسَل. دقيقتان من Opus أصغر من هذا بكثير. */
const MAX_BYTES = 9 * 1024 * 1024;

export type HeardOut =
  | { ok: true; text: string; model: string }
  | { ok: false; why: 'off' | 'nokey' | 'read' | 'big' | 'model'; detail?: string };

/** الصيغة كما يسمّيها المزوّد، من امتداد الملف. */
function fmtOf(rel: string): string | null {
  const e = (rel.split('.').pop() ?? '').toLowerCase();
  return e === 'mp3' ? 'mp3' : e === 'ogg' ? 'ogg' : e === 'm4a' ? 'm4a' : e === 'weba' ? 'webm' : null;
}

/**
 * يحوّل رسالةً صوتية إلى نصّ.
 *
 * @param rel مسار داخل media/ كما يُحفَظ في الرسالة
 */
export async function hearVoice(rel: string, lang: 'ar' | 'en'): Promise<HeardOut> {
  const s = await getChatSettings();
  if (s.provider === 'off' || !s.hearModel || s.hearModel === 'none') return { ok: false, why: 'off' };
  const key = await getSecret('openrouter');
  if (!key) return { ok: false, why: 'nokey' };

  const file = uploadFile(rel);
  const fmt = fmtOf(rel);
  if (!file || !fmt || !fs.existsSync(file)) return { ok: false, why: 'read' };
  const st = fs.statSync(file);
  if (st.size > MAX_BYTES) return { ok: false, why: 'big' };

  const b64 = fs.readFileSync(file).toString('base64');

  const ask = lang === 'ar'
    ? 'اكتب اللي اتقال في التسجيل ده بالعربي، حرفيًّا وبس. من غير أي شرح ولا مقدمة. لو مفيش كلام مفهوم اكتب: (مش واضح).'
    : 'Transcribe exactly what is said in this recording. Text only, no preamble. If nothing intelligible, write: (unclear).';

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 40_000);
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': process.env.SITE_URL?.trim() || 'https://www.5a-eg.com',
        'X-Title': '5A&M',
      },
      body: JSON.stringify({
        model: s.hearModel,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: ask },
            { type: 'input_audio', input_audio: { data: b64, format: fmt } },
          ],
        }],
        temperature: 0,
        /* سخيٌّ: موديلات السمع المجانية تفكّر داخليًّا من الحدّ نفسه */
        max_tokens: 1800,
      }),
    });
    const d: any = await r.json().catch(() => ({}));
    const text = String(d?.choices?.[0]?.message?.content ?? '').trim();
    if (r.status !== 200 || !text) {
      const why = d?.error?.message ?? `HTTP ${r.status}`;
      console.warn('[hear] لم يُسمَع:', s.hearModel, why);
      return { ok: false, why: 'model', detail: String(why).slice(0, 160) };
    }
    /* «مش واضح» جوابٌ صحيح لا نصٌّ يُردّ عليه */
    if (/^\(?\s*(مش واضح|غير واضح|unclear)\s*\)?\.?$/i.test(text)) {
      return { ok: false, why: 'model', detail: 'غير واضح' };
    }
    return { ok: true, text: text.slice(0, 1000), model: s.hearModel };
  } catch (e: any) {
    console.warn('[hear] خطأ:', e?.message ?? e);
    return { ok: false, why: 'model', detail: String(e?.message ?? e).slice(0, 160) };
  } finally {
    clearTimeout(timer);
  }
}
