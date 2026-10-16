/* =============================================================================
   مصدر ردود البوت — سويتش في يد السوبر أدمن (settings.chat.provider):

   • qwen: موديل Qwen المجاني عبر OpenRouter. المفتاح في OPENROUTER_API_KEY
     بملف الإعدادات (يضعه صاحب الحساب بنفسه)، والموديل يُختار من شاشة التدريب.
   • own: موديلنا الذي تدرّب على Colab من ردود Qwen المراجَعة — أي خادم يتكلم
     بصيغة OpenAI (ownUrl)، ومفتاحه إن وُجد في OWN_MODEL_KEY.
   • off: بلا بوت — رسائل العملاء تذهب للموظفين مباشرةً.

   الطلب يُلغى بعد 25 ثانية، والفشل لا يكسر المحادثة: البوت يردّ من الموقع
   نفسه ويعرض التحويل لموظف (lib/chat/bot.ts).
============================================================================= */
import { getSetting } from '../content';
import { getSecret } from '../secrets';

export type ChatSettings = {
  enabled: boolean;
  provider: 'qwen' | 'own' | 'deepseek' | 'off';
  model: string;
  ownUrl: string;
  ownModel: string;
  /** موديل DeepSeek (من حسابه على platform.deepseek.com) */
  deepseekModel: string;
  /** موديل مجاني احتياطي حين يكون Qwen مشغولًا. 'none' = بلا احتياطي */
  backupModel: string;
  /** لا تُفتح المحادثة إلا لمن سجّل دخوله بحساب عميل */
  requireLogin: boolean;
  greeting: { ar: string; en: string };
};

/** موديل افتراضي إن لم يُختر واحد من الشاشة. الموديلات المجانية تتغيّر على
    OpenRouter، فلو اختفى المحفوظ يُختار أول Qwen مجاني متاح تلقائيًا (complete) */
export const DEFAULT_MODEL = 'qwen/qwen3.8-27b:free';
/** الأفضل عربيًا بين المجانية في الاختبار (عامية مصرية سليمة) — والفلتر يمنع ما يخترعه */
export const DEFAULT_BACKUP = 'nvidia/nemotron-3-ultra-550b-a55b:free';
/** الأرخص والأسرع في حساب DeepSeek (الموديلات المتاحة تظهر في «تدريب البوت») */
export const DEFAULT_DEEPSEEK = 'deepseek-flash';

export async function getChatSettings(): Promise<ChatSettings> {
  const s = await getSetting<Partial<ChatSettings>>('chat', {});
  return {
    enabled: s.enabled !== false,
    provider: s.provider === 'own' || s.provider === 'off' || s.provider === 'deepseek' ? s.provider : 'qwen',
    model: (s.model || '').trim(),
    ownUrl: (s.ownUrl || '').trim(),
    ownModel: (s.ownModel || '').trim(),
    deepseekModel: (s.deepseekModel || '').trim(),
    backupModel: (s.backupModel || '').trim(),
    /* الافتراضي: المحادثة مفتوحة للزائر. تُقفل بتفعيل الإعداد من الشاشة. */
    requireLogin: s.requireLogin === true,
    greeting: { ar: s.greeting?.ar ?? '', en: s.greeting?.en ?? '' },
  };
}

export type Msg = { role: 'system' | 'user' | 'assistant'; content: string };
export type Completion = { ok: true; text: string; source: 'qwen' | 'own' | 'deepseek' | 'backup' } | { ok: false; error: string };

/** هل المصدر المختار جاهز؟ (للشاشة) — المفتاح من اللوحة أو من ملف الإعدادات (lib/secrets.ts) */
export async function providerReady(s: ChatSettings): Promise<{ ok: boolean; why?: string }> {
  if (s.provider === 'off') return { ok: false, why: 'البوت متوقف (بلا بوت).' };
  if (s.provider === 'qwen' && !(await getSecret('openrouter'))) return { ok: false, why: 'مفتاح OpenRouter غير موجود — ضعه من «مفتاح OpenRouter» تحت.' };
  if (s.provider === 'own' && !/^https?:\/\//.test(s.ownUrl)) return { ok: false, why: 'رابط موديلنا غير مضبوط.' };
  if (s.provider === 'deepseek' && !(await getSecret('deepseek'))) return { ok: false, why: 'مفتاح DeepSeek غير موجود — ضعه من «المفاتيح» تحت. لحد ما يتحط، Qwen بيرد.' };
  return { ok: true };
}

/* آخر موديل نجح، لو اختفى المحفوظ من المجاني */
let fallbackModel: string | null = null;
/* وآخر احتياطي ردّ فعلًا: الطلب التالي يبدأ منه بدل أن يعيد المرور على
   الصامتين من أوله في كل مرة. */
let lastBackup: string | null = null;

/** مهلة المرور على الاحتياطيات كلها. الزائر ينتظر، فالبحث عن موديل فاضٍ
    لا يصحّ أن يمتدّ دقائق: نمرّ على أكبر عدد يسعه هذا الحدّ ثم نتوقّف. */
const BACKUP_BUDGET_MS = 25_000;

/* ترتيب الاحتياطيات: ما يصلح للمحادثة أولًا. القائمة المجانية فيها مصنِّف
   أمان ونماذج برمجة ورؤية — تردّ ردًّا لا يشبه كلام بائع، فتؤخَّر إلى آخر
   الصفّ ولا تُحذف: موديل ناطق متأخّر خير من لا ردّ. */
const LATE = /(content-safety|guard|moderation|-code|coder|vl\b|vision|embed|rerank|ocr|tts|whisper)/i;
const rankBackups = (ids: string[]) =>
  [...ids].sort((a, b) => Number(LATE.test(a)) - Number(LATE.test(b)));

async function call(url: string, key: string | null, body: object, own: boolean) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const r = await fetch(url, {
      method: 'POST', signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        /* OpenRouter يعرض اسم الموقع في لوحته */
        ...(own ? {} : { 'HTTP-Referer': process.env.SITE_URL?.trim() || 'https://www.5a-eg.com', 'X-Title': '5A&M' }),
      },
      body: JSON.stringify(body),
    });
    return { status: r.status, d: (await r.json().catch(() => ({}))) as any };
  } finally {
    clearTimeout(timer);
  }
}

/* آخر أخطاء الموديلات (في الذاكرة) — تظهر في «تدريب البوت» بدل التخمين */
const errors: { at: string; model: string; error: string }[] = [];
function logError(model: string, error: string) {
  errors.unshift({ at: new Date().toISOString(), model, error: error.slice(0, 200) });
  errors.length = Math.min(errors.length, 15);
  console.warn('[chat] الموديل لم يرد:', model, error);
}
export const modelErrors = () => [...errors];

const busy = (s: number) => s === 429 || s === 408 || s >= 500;
const errOf = (status: number, d: any) => (d?.error?.metadata?.raw ? `${status}: ${String(d.error.metadata.raw)}` : d?.error?.message ? `${status}: ${d.error.message}` : `HTTP ${status}`);
/* حرف لاتيني ملتصق بحرف عربي بلا مسافة: «تachtاج»، «الangenehme». لا تكتب
   العربية هكذا أبدًا، فهي علامة أن الموديل خلط لغتين داخل الكلمة الواحدة.
   والأسماء الأجنبية المفصولة بمسافة (Pelican وCrosswind) تمرّ: هي من كلامنا.

   والحروف وحدها لا المدى العربي كلّه: الفاصلة «،» وعلامة الاستفهام «؟» في
   المدى نفسه، فـ«Pelican، مكنسة» كان يُرفض وهو كلام سليم.

   والشرطة السفلية تُعدّ لصقًا («و_fraction»): لا تصل بين عربية ولاتينية في
   كلام سليم، بخلاف المسافة والشرطة العادية. */
const GLUED_LATIN = /[ء-يٱ-ۓ]_?[A-Za-z]|[A-Za-z]_?[ء-يٱ-ۓ]/;

/* الرد بلا «تفكير». ويُعامل كفشل — فيُعاد أو يُستبدل بموديل آخر — إن كان فيه
   حروف صينية (Qwen يخلط أحيانًا) أو كلمات ملزوقة بلغتين (الموديلات المجانية
   الضعيفة تفعلها، وقد صرنا نمرّ عليها كلها). */
const textOf = (d: any) => {
  const t = String(d?.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(t)) return '';
  if (GLUED_LATIN.test(t)) return '';
  return t;
};

/** موديل على OpenRouter: حتى 3 محاولات لو مشغول (بعد 1.5 ثم 3.5 ثانية) */
async function tryOpenRouter(model: string, messages: Msg[], key: string, tries = 3): Promise<{ text?: string; status: number; d: any }> {
  const body = { model, messages, temperature: 0.3, max_tokens: 600, reasoning: { enabled: false } };
  let last = { status: 0, d: {} as any };
  for (let i = 0; i < tries; i++) {
    if (i) await new Promise((r) => setTimeout(r, i === 1 ? 1500 : 3500));
    try {
      last = await call('https://openrouter.ai/api/v1/chat/completions', key, body, false);
    } catch (e: any) {
      last = { status: 0, d: { error: { message: e?.name === 'AbortError' ? 'انتهت المهلة' : 'تعذّر الاتصال' } } };
    }
    const text = last.status === 200 ? textOf(last.d) : '';
    /* الموديل المجاني يقطع الرد أحيانًا («لوحة التزام»): أقل من 25 حرفًا = فشل يُعاد */
    if (text.length >= 25) return { text, ...last };
    if (last.status === 200) last = { status: 502, d: { error: { message: text ? `ردّ مقطوع: «${text}»` : 'ردّ فارغ' } } };
    if (!busy(last.status) && last.status !== 0) break;      // خطأ ثابت (مفتاح/موديل): لا فائدة من التكرار
  }
  return last;
}

/**
 * ردّ الموديل، بالترتيب:
 *   موديلنا (لو هو المختار) ← Qwen (3 محاولات) ← الموديل الاحتياطي المجاني.
 * أي ردّ من أي موديل يمرّ بعدها بفلتر الأسعار والأرقام (lib/chat/bot.ts → guard).
 */
export async function complete(messages: Msg[], s: ChatSettings): Promise<Completion> {
  const ready = await providerReady(s);
  if (!ready.ok && s.provider !== 'own' && s.provider !== 'deepseek') return { ok: false, error: ready.why! };

  /* DeepSeek (بمفتاحه): محاولتان، ولو الرصيد خلص أو مشغول ← Qwen المجاني يكمّل */
  if (s.provider === 'deepseek') {
    const dk = await getSecret('deepseek');
    const dm = s.deepseekModel || DEFAULT_DEEPSEEK;
    if (!dk) logError('DeepSeek', 'مفتاح DeepSeek غير موجود');
    else for (let i = 0; i < 2; i++) {
      if (i) await new Promise((r) => setTimeout(r, 1500));
      try {
        const { status, d } = await call('https://api.deepseek.com/chat/completions', dk, { model: dm, messages, temperature: 0.3, max_tokens: 600 }, true);
        const text = status === 200 ? textOf(d) : '';
        if (text.length >= 25) return { ok: true, text: text.slice(0, 3000), source: 'deepseek' };
        logError(dm, status === 200 ? (text ? `ردّ مقطوع: «${text}»` : 'ردّ فارغ') : errOf(status, d));
        if (!busy(status)) break;
      } catch (e: any) { logError(dm, e?.name === 'AbortError' ? 'انتهت المهلة' : 'تعذّر الاتصال'); }
    }
  }

  if (s.provider === 'own' && /^https?:\/\//.test(s.ownUrl)) {
    const url = `${s.ownUrl.replace(/\/+$/, '').replace(/\/v1$/, '')}/v1/chat/completions`;
    try {
      const { status, d } = await call(url, await getSecret('own_model'), { model: s.ownModel || 'default', messages, temperature: 0.3, max_tokens: 600 }, true);
      const text = status === 200 ? textOf(d) : '';
      if (text.length >= 25) return { ok: true, text: text.slice(0, 3000), source: 'own' };
      logError(s.ownModel || 'موديلنا', status === 200 ? (text ? `ردّ مقطوع: «${text}»` : 'ردّ فارغ') : errOf(status, d));
    } catch (e: any) {
      logError(s.ownModel || 'موديلنا', e?.name === 'AbortError' ? 'انتهت المهلة (الـ Space نايم؟)' : 'تعذّر الاتصال');
    }
    /* موديلنا لم يرد (الـ Space المجاني ينام): Qwen يكمّل بدله لو مفتاحه موجود */
  }

  const key = await getSecret('openrouter');
  if (!key) return { ok: false, error: 'مفتاح OpenRouter غير موجود' };
  let model = fallbackModel ?? (s.model || DEFAULT_MODEL);
  let r = await tryOpenRouter(model, messages, key);
  /* الموديل المحفوظ لم يعد موجودًا: أول Qwen مجاني متاح */
  if (!r.text && (r.status === 400 || r.status === 404) && /model|not found|no endpoints/i.test(JSON.stringify(r.d?.error ?? ''))) {
    const alt = (await freeQwenModels()).map((m) => m.id).find((id) => id !== model);
    if (alt) { model = alt; r = await tryOpenRouter(model, messages, key); if (r.text) fallbackModel = alt; }
  }
  if (r.text) return { ok: true, text: r.text.slice(0, 3000), source: 'qwen' };
  logError(model, errOf(r.status, r.d));

  /* Qwen مشغول: نمرّ على الموديلات المجانية كلها حتى يردّ واحد.

     كان احتياطيًّا واحدًا، فإن كان هو الآخر مشغولًا سكت البوت أمام العميل
     بلا سبب يفهمه. والمجاني كثير التوقّف بطبعه، فواحدٌ لا يكفي.

     الترتيب: المختار من الشاشة أولًا (رأي صاحب الموقع أسبق)، ثم ما نجح آخر
     مرة، ثم الباقي. محاولتان للأول ومحاولة لكلّ ما بعده — من صمت مرة في هذه
     اللحظة غالبًا صامت، والوقت ملك الزائر لا ملكنا. */
  if (s.backupModel !== 'none') {
    const chosen = s.backupModel || DEFAULT_BACKUP;
    const rest = rankBackups((await freeModels()).filter((m) => m !== chosen && m !== lastBackup));
    const chain = [chosen, ...(lastBackup && lastBackup !== chosen ? [lastBackup] : []), ...rest];
    const until = Date.now() + BACKUP_BUDGET_MS;
    let tried = 0;
    for (const m of chain) {
      const b = await tryOpenRouter(m, messages, key, m === chosen ? 2 : 1);
      tried++;
      if (b.text) {
        lastBackup = m;
        return { ok: true, text: b.text.slice(0, 3000), source: 'backup' };
      }
      logError(m, errOf(b.status, b.d));
      if (Date.now() >= until) {
        if (tried < chain.length) logError('الاحتياطيات', `انتهت المهلة بعد ${tried} من ${chain.length} موديل`);
        break;
      }
    }
  }
  return { ok: false, error: errOf(r.status, r.d) };
}
/** كل الموديلات المجانية على OpenRouter الآن (لاختيار الاحتياطي) */
export async function freeModels(): Promise<string[]> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch('https://openrouter.ai/api/v1/models', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    const d: any = await r.json();
    return (d?.data ?? []).map((m: any) => String(m.id)).filter((id: string) => id.endsWith(':free')).sort();
  } catch {
    return [];
  }
}

/** موديلات Qwen المجانية على OpenRouter الآن (للاختيار من الشاشة) — القائمة عامة بلا مفتاح */
export async function freeQwenModels(): Promise<{ id: string; name: string; context: number }[]> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch('https://openrouter.ai/api/v1/models', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    const d: any = await r.json();
    return (d?.data ?? [])
      .filter((m: any) => /qwen/i.test(m.id) && (String(m.id).endsWith(':free') || (Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0)))
      .map((m: any) => ({ id: m.id, name: m.name ?? m.id, context: Number(m.context_length) || 0 }))
      .sort((a: any, b: any) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}
