/* =============================================================================
   تطبيع النص للبحث والمطابقة — عربي وإنجليزي.

   «عايز مولد ٥٠٠ ك.ف.أ» و«عاوز مولّد 500 kva» يصيران الكلمات نفسها تقريبًا:
   حروف موحّدة (أ إ آ ← ا، ى ← ي، ة ← ه)، بلا تشكيل ولا تطويل، وأرقام لاتينية،
   وبلا «ال» و«و» في أول الكلمة، وبلا الكلمات التي لا تفرّق (في، عايز، the…).
============================================================================= */

const AR_STOP = new Set(('في من على عن الي الى ما هل هو هي انا انت احنا عايز عاوز عايزه محتاج ايه ازاي كام ممكن لو مع يا ده دي دا ' +
  'اللي التي الذي هذا هذه كان يكون عند عندكم عندك بس كمان او ام ثم لكن لا لم لن اي اريد ابغي ابي حاجه شيء شي هل').split(' '));
const EN_STOP = new Set(('the a an is are was were what which how much many do does did you your i me my we our to for of in on at ' +
  'with can could please want need would like it this that there have has be about any some and or tell show give get').split(' '));

export function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')            // تشكيل وتطويل
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** كلمات البحث: مطبّعة، بلا كلمات الربط، وبلا «ال»/«و» في أولها */
export function tokens(s: string): string[] {
  const out: string[] = [];
  for (let w of normalize(s).split(' ')) {
    if (!w) continue;
    if (/^\p{Script=Arabic}/u.test(w)) {
      if (w.length > 4 && w.startsWith('وال')) w = w.slice(3);
      else if (w.length > 3 && w.startsWith('ال')) w = w.slice(2);
      else if (w.length > 3 && w.startsWith('و') && !AR_STOP.has(w)) w = w.slice(1);
      if (AR_STOP.has(w)) continue;
    } else if (EN_STOP.has(w)) continue;
    if (w.length < 2 && !/\d/.test(w)) continue;
    out.push(w);
  }
  return out;
}

/** تشابه سؤالين (0–1): الكلمات المشتركة إلى كل الكلمات */
export function similarity(a: string[], b: string[]): number {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / (A.size + B.size - both);
}

export const isArabic = (s: string) => /\p{Script=Arabic}/u.test(s);

/** لغة الرسالة نفسها: الأغلب بين الحروف العربية واللاتينية. null = لا حروف (رقم مثلًا) */
export function langOf(s: string): 'ar' | 'en' | null {
  const ar = (s.match(/\p{Script=Arabic}/gu) ?? []).length;
  const en = (s.match(/[A-Za-z]/g) ?? []).length;
  if (!ar && !en) return null;
  return ar >= en ? 'ar' : 'en';
}

/** هل يطلب التحدث مع إنسان؟ */
export function wantsHuman(s: string): boolean {
  const n = normalize(s);
  return /(موظف|حد يكلمني|اكلم حد|اتكلم مع حد|كلموني|كلمني|اتصلو|اتصلوا|خدمه العملاء|المبيعات|مندوب|انسان|بشري|عايز اتواصل|اتواصل مع)/.test(n)
    || /\b(human|agent|representative|sales team|salesperson|call me|contact me|talk to (a )?(person|someone|human|sales)|real person)\b/.test(n);
}
