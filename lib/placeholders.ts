/* =============================================================================
   نصوص مؤقتة للحقول الفارغة داخل المحرّر المرئي — على طريقة Elementor.

   قسم جديد عنوانه فارغ لا يظهر منه شيء في الصفحة، فلا مكان يُضغط ليُكتب فيه.
   في المعاينة وحدها يُرسم مكان كل حقل فارغ نصٌّ مؤقت («اكتب العنوان هنا»)،
   والمحرّر يعرف هذا النصّ نفسه فيربطه بالحقل: يُضغط ويُكتب فيه كأي نصّ آخر.

   لا شيء من هذا يُحفظ ولا يراه الزائر: المعاينة تُرسم من نسخة، والحالة في
   المحرّر تبقى فارغة حتى يُكتب فيها. وملف واحد للخادم والمحرّر كي يتّفقا على
   النصّ حرفًا بحرف.
============================================================================= */
import type { Field } from './sectionSchema';

export type Hole = { path: string; text: string };

const empty = (v: any, lang: 'ar' | 'en') =>
  v == null || (typeof v === 'object' && !Array.isArray(v) && !String(v[lang] ?? '').trim());

/**
 * أماكن النصوص المؤقتة في محتوى قسم: الحقول النصّية الظاهرة الفارغة، وأول
 * عنصر في قائمة فارغة (كي يُبدأ ملؤها من الصفحة).
 */
export function holesOf(fields: Field[], content: any, lang: 'ar' | 'en'): Hole[] {
  const out: Hole[] = [];
  for (const f of fields) {
    if (f.advanced) continue;
    if ((f.kind === 'dual' || f.kind === 'long') && empty(content?.[f.name], lang)) {
      out.push({ path: `${f.name}.${lang}`, text: `اكتب ${f.label} هنا` });
    }
    if (f.kind === 'repeat' && f.of && !(Array.isArray(content?.[f.name]) && content[f.name].length)) {
      for (const sub of f.of) {
        if (sub.kind === 'dual' || sub.kind === 'long') {
          out.push({ path: `${f.name}.0.${sub.name}.${lang}`, text: `${f.item ?? 'عنصر'} ١ — ${sub.label}` });
        }
      }
    }
    if (f.kind === 'list' && !(Array.isArray(content?.[f.name]) && content[f.name].length)) {
      out.push({ path: `${f.name}.0.${lang}`, text: `${f.label} — أول بند` });
    }
  }
  return out;
}

/** نسخة من المحتوى فيها النصوص المؤقتة مكان الفارغ — للمعاينة وحدها. */
export function withHoles(fields: Field[], content: any, lang: 'ar' | 'en') {
  const out = structuredClone(content ?? {});
  for (const h of holesOf(fields, content, lang)) {
    const parts = h.path.split('.');
    let n = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (n[parts[i]] == null || typeof n[parts[i]] !== 'object') n[parts[i]] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      n = n[parts[i]];
    }
    n[parts[parts.length - 1]] = h.text;
  }
  return out;
}

/** حقول أعلى الصفحة كما يحرّرها المحرّر. */
export const HERO_FIELDS: Field[] = [
  { name: 'img', label: 'الصورة الكبيرة', kind: 'image' },
  { name: 'kicker', label: 'سطر صغير فوق العنوان', kind: 'dual', advanced: true },
  { name: 'title', label: 'العنوان الرئيسي', kind: 'dual' },
  { name: 'lede', label: 'سطر أو سطران تحته', kind: 'long' },
];
