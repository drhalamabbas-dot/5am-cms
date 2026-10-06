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

const AR_PRODUCT = ['عندكم {n}؟', 'ايه مواصفات {n}؟', '{n} يناسب ايه؟', 'عايز اعرف تفاصيل عن {n}', 'هل {n} متوفر وفيه صيانة؟', 'عايز عرض سعر على {n}'];
const EN_PRODUCT = ['Do you have the {n}?', 'What are the specifications of the {n}?', 'What is the {n} used for?', 'Can I get a quote for the {n}?'];
const AR_PAGE = ['ايه خدمات {n} عندكم؟', 'احكيلي عن {n}', 'عايز اعرف اكتر عن {n}'];
const EN_PAGE = ['Tell me about your {n}', 'What do you offer for {n}?'];
const GENERAL: Item[] = [
  { q: 'انتو مين وبتعملوا ايه؟', lang: 'ar' }, { q: 'فين مكانكم؟', lang: 'ar' }, { q: 'ايه رقم التليفون؟', lang: 'ar' },
  { q: 'بتعملوا صيانة للمولدات؟', lang: 'ar' }, { q: 'عندكم تأجير مولدات؟', lang: 'ar' }, { q: 'بتوصلوا لكل محافظات مصر؟', lang: 'ar' },
  { q: 'ازاي احسب قدرة المولد اللي محتاجه؟', lang: 'ar' }, { q: 'ايه الفرق بين المولد المفتوح وأبو كابينة؟', lang: 'ar' },
  { q: 'عندكم قطع غيار أصلية؟', lang: 'ar' }, { q: 'عايز اكلم المبيعات', lang: 'ar' },
  { q: 'Who are you and what do you do?', lang: 'en' }, { q: 'Where are you located?', lang: 'en' },
  { q: 'Do you offer generator maintenance?', lang: 'en' }, { q: 'Do you rent generators?', lang: 'en' },
  { q: 'Are you the Federal Signal dealer in Egypt?', lang: 'en' },
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
