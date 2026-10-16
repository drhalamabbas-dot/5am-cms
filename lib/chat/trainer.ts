/* =============================================================================
   مولّد بيانات تدريب موديلنا — «يتعلّم من Qwen»:

   أسئلة عملاء واقعية تُبنى من محتوى الموقع نفسه (كل منتج وكل صفحة، عربي
   وإنجليزي، بصيغ مختلفة)، ويجيب عنها البوت بخطّه الكامل (Qwen + معلومات الموقع
   + فلتر الأسعار والأرقام). الإجابات تدخل «للمراجعة» في «تدريب البوت»: الفريق
   يقبل الصحيح ويصحّح الباقي، والمقبول هو بيانات تدريب موديلنا على Colab.

   يعمل على دفعات صغيرة: الحساب المجاني على OpenRouter له حد يومي.
============================================================================= */
import { q } from '../db';
import { getDocs } from './kb';
import { normalize } from './text';
import { reply } from './bot';

type Item = { q: string; lang: 'ar' | 'en' };

/* الأسئلة على عائلات تشبه ما يقوله عميل حقيقي، لا استعلامًا عن مواصفة فقط:
   يسأل عن منتج، ويقارن، ويعترض، ويسأل عن الشراء والخدمة بعده. الموديل يتعلّم
   من إجابات هذه كلها كيف يبيع، لا كيف يسرد مواصفات. */
const AR_PRODUCT = [
  'عندكم {n}؟', 'ايه مواصفات {n}؟', '{n} يناسب ايه؟', 'عايز اعرف تفاصيل عن {n}',
  'هل {n} متوفر وفيه صيانة؟', 'عايز عرض سعر على {n}',
  'ليه اختار {n} بالذات؟', 'ايه الفرق بين {n} وغيره عندكم؟',
  '{n} مناسب لشغل كتير يومي؟', 'بعد ما اشتري {n} بتوفروا قطع غياره؟',
];
const EN_PRODUCT = [
  'Do you have the {n}?', 'What are the specifications of the {n}?', 'What is the {n} used for?',
  'Can I get a quote for the {n}?', 'Why should I choose the {n}?', 'Do you support the {n} after delivery?',
];
const AR_PAGE = ['ايه خدمات {n} عندكم؟', 'احكيلي عن {n}', 'عايز اعرف اكتر عن {n}', 'ليه اتعامل معاكم في {n}؟'];
const EN_PAGE = ['Tell me about your {n}', 'What do you offer for {n}?'];

/* حاجة العميل لا اسم المنتج: هنا يتعلّم الموديل أن يرشّح. */
const NEEDS: Item[] = [
  { q: 'عندي مصنع وعايز مولد يشغّله، ايه اللي يناسبني؟', lang: 'ar' },
  { q: 'عندي ورشة صغيرة، ايه اصغر مولد ينفع؟', lang: 'ar' },
  { q: 'محتاج مولد احتياطي لمستشفى', lang: 'ar' },
  { q: 'عايز حاجة تنضف بالوعات الصرف', lang: 'ar' },
  { q: 'محتاج معدة تشفط مخلفات في مصنع', lang: 'ar' },
  { q: 'عايز مكنسة تنضف شوارع في مدينة صغيرة', lang: 'ar' },
  { q: 'عندي مزرعة ومحتاج طاقة للري', lang: 'ar' },
  { q: 'محتاج مولد لموقع انشاءات مؤقت', lang: 'ar' },
  { q: 'ايه اللي تنصحني بيه لشركة مقاولات بتشتغل في اكتر من موقع؟', lang: 'ar' },
  { q: 'I need a generator for a factory, what do you recommend?', lang: 'en' },
  { q: 'I need equipment to clean sewer lines', lang: 'en' },
  { q: 'What do you recommend for a municipality street cleaning fleet?', lang: 'en' },
];

/* اعتراضات: الموديل يتعلّم أن يردّ بحقيقة من الموقع لا بمجادلة. */
const OBJECTIONS: Item[] = [
  { q: 'ليه اشتري منكم انتو بالذات؟', lang: 'ar' },
  { q: 'في حد تاني بيبيع نفس الحاجة ارخص', lang: 'ar' },
  { q: 'انا مش متأكد، لسه بدور', lang: 'ar' },
  { q: 'المعدات دي غالية', lang: 'ar' },
  { q: 'وبعد ما اشتري هتسيبوني؟', lang: 'ar' },
  { q: 'ازاي اثق ان القطع اصلية؟', lang: 'ar' },
  { q: 'Why should I buy from you and not another dealer?', lang: 'en' },
  { q: 'What happens after the sale?', lang: 'en' },
];

/* خطوات الشراء والخدمة. */
const PROCESS: Item[] = [
  { q: 'ازاي اطلب عرض سعر؟', lang: 'ar' },
  { q: 'ايه الخطوات من الطلب لحد التسليم؟', lang: 'ar' },
  { q: 'بتركبوا المعدة في الموقع؟', lang: 'ar' },
  { q: 'بتدربوا الفريق على التشغيل؟', lang: 'ar' },
  { q: 'فيه عقود صيانة دورية؟', lang: 'ar' },
  { q: 'How do I request a quotation?', lang: 'en' },
  { q: 'Do you install and commission on site?', lang: 'en' },
  { q: 'Do you offer maintenance contracts?', lang: 'en' },
];

const GENERAL: Item[] = [
  { q: 'انتو مين وبتعملوا ايه؟', lang: 'ar' }, { q: 'فين مكانكم؟', lang: 'ar' }, { q: 'ايه رقم التليفون؟', lang: 'ar' },
  { q: 'بتعملوا صيانة للمولدات؟', lang: 'ar' }, { q: 'عندكم تأجير مولدات؟', lang: 'ar' }, { q: 'بتوصلوا لكل محافظات مصر؟', lang: 'ar' },
  { q: 'ازاي احسب قدرة المولد اللي محتاجه؟', lang: 'ar' }, { q: 'ايه الفرق بين المولد المفتوح وأبو كابينة؟', lang: 'ar' },
  { q: 'عندكم قطع غيار أصلية؟', lang: 'ar' }, { q: 'عايز اكلم المبيعات', lang: 'ar' },
  { q: 'ايه الماركات اللي بتمثلوها؟', lang: 'ar' }, { q: 'انتو وكلاء رسميين؟', lang: 'ar' },
  { q: 'Who are you and what do you do?', lang: 'en' }, { q: 'Where are you located?', lang: 'en' },
  { q: 'Do you offer generator maintenance?', lang: 'en' }, { q: 'Do you rent generators?', lang: 'en' },
  { q: 'Are you the Federal Signal dealer in Egypt?', lang: 'en' },
  ...NEEDS, ...OBJECTIONS, ...PROCESS,
];

export async function allQuestions(): Promise<Item[]> {
  const out: Item[] = [...GENERAL];
  for (const lang of ['ar', 'en'] as const) {
    for (const d of await getDocs(lang)) {
      if (d.kind === 'contact') continue;
      const tpl = d.kind === 'product' ? (lang === 'ar' ? AR_PRODUCT : EN_PRODUCT) : (lang === 'ar' ? AR_PAGE : EN_PAGE);
      const name = d.title.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      if (!name || name.length > 80) continue;
      for (const t of tpl) out.push({ q: t.replace('{n}', name), lang });
    }
  }
  /* بلا تكرار */
  const seen = new Set<string>();
  return out.filter((i) => { const k = normalize(i.q); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** الأسئلة التي لم تُجَب بعد (ليست في الذاكرة) */
export async function pending(): Promise<Item[]> {
  const have = new Set((await q<any>('SELECT q_norm FROM chat_cache')).map((r) => r.q_norm));
  return (await allQuestions()).filter((i) => !have.has(normalize(i.q).slice(0, 1000)));
}

/** دفعة: يجيب حتى `count` سؤالًا، ويتوقف عند أول فشل (الحد اليومي غالبًا) */
export async function generateBatch(count: number): Promise<{ stored: number; failed: boolean; remaining: number }> {
  const todo = (await pending()).sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.min(10, count)));
  let stored = 0, failed = false;
  for (const it of todo) {
    const r = await reply(it.q, it.lang, []);
    if (r.source === 'qwen' || r.source === 'own' || r.source === 'deepseek' || r.source === 'backup') stored++;
    else if (r.source === 'kb') { failed = true; break; }   // الموديل لم يرد — نكمّل في دفعة لاحقة
  }
  return { stored, failed, remaining: (await pending()).length };
}
