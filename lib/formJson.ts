/* =============================================================================
   يعيد تركيب محتوى السيكشن من النموذج.

   حقول النموذج تحمل أسماء منقوطة تصف موضعها في الـ JSON:
       cards.0.title.ar        →  { cards: [ { title: { ar: … } } ] }
   والرقم يعني عنصر قائمة. فتُبنى الشجرة هنا مرة واحدة بدل أن يعرف كل حقل
   شكل المحتوى.

   قاعدتان تحفظان نظافة البيانات:
   • الحقل الفارغ تمامًا يُحذف، فلا تمتلئ القاعدة بـ {"en":"","ar":""}.
   • فجوات القوائم تُزال بعد الحذف، فتبقى الفهارس متتابعة.
============================================================================= */
import type { Field } from './sectionSchema';

type Any = Record<string, any>;

const isIndex = (s: string) => /^\d+$/.test(s);

/** يرتّب مفاتيح الكائنات: MySQL يعيد ترتيبها في أعمدة JSON. */
const canon = (v: any): any =>
  Array.isArray(v) ? v.map(canon)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
    : v;

/** هل المحتويان متساويان قيمةً، بصرف النظر عن ترتيب المفاتيح؟ */
export const sameContent = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/** يضع قيمة في مكانها من الشجرة حسب المسار المنقوط. */
function put(root: Any, path: string[], value: string) {
  let node: Any = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const nextIsIndex = isIndex(path[i + 1]);
    if (node[key] == null) node[key] = nextIsIndex ? [] : {};
    node = node[key];
  }
  node[path[path.length - 1]] = value;
}

/** يزيل الفراغات: نص فارغ، وكائن كل قيمه فارغة، وقائمة بلا عناصر. */
function prune(v: any): any {
  if (Array.isArray(v)) {
    const out = v.map(prune).filter((x) => x !== undefined);
    return out.length ? out : undefined;
  }
  if (v && typeof v === 'object') {
    const out: Any = {};
    for (const k of Object.keys(v)) {
      const p = prune(v[k]);
      if (p !== undefined) out[k] = p;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (typeof v === 'string') return v.trim() === '' ? undefined : v;
  return v;
}

/**
 * يبني محتوى السيكشن من النموذج.
 *
 * الحقول المعروفة فقط تُقرأ من النموذج، فلا يُحقن مفتاح لا يعرفه العرض.
 * وما كان في المحتوى ولا يصفه الجدول يبقى كما هو: نقص في وصف نوع لا يجوز أن
 * يمحو بيانات حقيقية عند أول حفظ.
 */
export function contentFromForm(form: FormData, fields: Field[], previous?: Any): Any {
  const allow = new Set(fields.map((f) => f.name));
  const raw: Any = {};

  for (const [key, val] of form.entries()) {
    if (typeof val !== 'string') continue;
    const path = key.split('.');
    if (!allow.has(path[0])) continue;   // حقول النموذج الأخرى (الزرّ، الرمز…)
    put(raw, path, val);
  }

  /* خانات الاختيار: الاسم يصل فقط إن كانت مختارة، فيُقرأ وجودها لا قيمتها. */
  for (const f of fields) {
    if (f.kind === 'bool') raw[f.name] = form.get(f.name) ? true : undefined;
  }

  /* القوائم تأتي ككائن مفاتيحه أرقام حين تتخللها فجوات — تُحوَّل إلى مصفوفة. */
  const arrays = (v: any): any => {
    if (Array.isArray(v)) return v.map(arrays);
    if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      if (keys.length && keys.every(isIndex)) {
        return keys.sort((a, b) => Number(a) - Number(b)).map((k) => arrays(v[k]));
      }
      const out: Any = {};
      for (const k of keys) out[k] = arrays(v[k]);
      return out;
    }
    return v;
  };

  const built = arrays(raw);

  /* الأرقام تُكتب نصًّا في النموذج، فتُعاد أرقامًا كما كانت في المصدر. */
  const numbers = (node: any, spec: Field[]) => {
    for (const f of spec) {
      if (f.kind === 'num' && node?.[f.name] != null && node[f.name] !== '') {
        const n = Number(node[f.name]);
        if (!Number.isNaN(n)) node[f.name] = n;
      }
      if ((f.kind === 'repeat' || f.kind === 'group') && f.of) {
        const v = node?.[f.name];
        if (Array.isArray(v)) v.forEach((row) => numbers(row, f.of!));
        else if (v) numbers(v, f.of!);
      }
    }
  };
  numbers(built, fields);

  /* بيانات العنصر التي لا يعرضها النموذج — مقاس صورة السلايدر مثلًا — تُنقل
     من العنصر القديم الذي يحمل المعرّف نفسه، فلا تضيع بإعادة ترتيب أو حذف. */
  for (const f of fields) {
    if (f.kind !== 'repeat' || !f.keyBy || !f.of) continue;
    const before = (previous as Any)?.[f.name];
    if (!Array.isArray(before)) continue;
    const sub = new Set(f.of.map((x) => x.name));
    const byKey = new Map(before.filter((r: Any) => r?.[f.keyBy!] != null).map((r: Any) => [String(r[f.keyBy!]), r]));
    const rows = built[f.name];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const old = byKey.get(String(row?.[f.keyBy]));
      if (!old) continue;
      for (const k of Object.keys(old)) if (!sub.has(k)) row[k] = old[k];
    }
  }

  const known = new Set(fields.map((f) => f.name));
  const out: Any = {};
  /* ما لا يصفه الجدول يُنقل كما هو قبل كتابة الحقول المعروفة فوقه. */
  for (const k of Object.keys(previous ?? {})) {
    if (!known.has(k)) out[k] = (previous as Any)[k];
  }
  for (const f of fields) {
    /* الحقل المنطقي يبقى حتى حين يكون false؟ لا: غيابه هو false في العرض،
       فحذفه يوفّر ضجيجًا في الـ JSON. */
    if (f.kind === 'bool') { if (built[f.name]) out[f.name] = true; continue; }
    const v = prune(built[f.name]);
    if (v !== undefined) out[f.name] = v;
  }
  return out;
}
