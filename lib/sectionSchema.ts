/* =============================================================================
   وصف حقول كل نوع سيكشن.

   المحتوى مخزَّن JSON لأن كل نوع يختلف عن الآخر. وهذا الملف يقول للداش بورد
   ما الذي يحتويه كل نوع، فيرسم له حقولًا مفهومة بدل أن يطلب من صاحب الموقع
   تحرير JSON.

   أنواع الحقول:
     dual      نص بالعربية والإنجليزية  ({en, ar})
     long      مثله لكن متعدّد الأسطر
     image     مسار صورة من المكتبة
     text      نص واحد بلا ترجمة (معرّف، اسم ماركة…)
     bool      نعم/لا
     link      رابط مع نصّه بلغتيه
     list      قائمة نصوص، كلٌّ بلغتيه
     images    قائمة صور
     refs      قائمة معرّفات منتجات
     repeat    قائمة عناصر لكلٍّ منها حقوله
     group     عنصر واحد له حقوله (لا قائمة)
     choice    اختيار من قائمة ثابتة
     texts     قائمة نصوص مفردة بلا ترجمة
     num       رقم
     video     ملف فيديو من المكتبة
============================================================================= */
export type FieldKind =
  | 'dual' | 'long' | 'image' | 'text' | 'bool' | 'link' | 'list' | 'images' | 'refs'
  | 'repeat' | 'group' | 'choice' | 'texts' | 'num' | 'video';

export type Field = {
  name: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  /** حقل لا يُلمَس غالبًا: يُطوى تحت «خيارات إضافية» فتبقى الشاشة قصيرة.
      القاعدة: ما يُحرَّر في كل مرة يبقى ظاهرًا، وما يُضبط مرة ثم يُنسى يُطوى. */
  advanced?: boolean;
  /** لحقل choice: القيمة ونصّها. */
  options?: [string, string][];
  /** لحقل repeat: حقول العنصر الواحد. */
  of?: Field[];
  /** لحقل repeat: الحقل الذي يعرَّف به العنصر، كي تُحفظ بياناته غير المعروضة
      (مقاس الصورة مثلًا) حين يُعاد ترتيب القائمة أو يُحذف منها عنصر. */
  keyBy?: string;
  /** اسم العنصر في زرّ الإضافة. */
  item?: string;
};

export type TypeSpec = {
  label: string;
  /** شرح يظهر داخل المحرّر. */
  hint?: string;
  /** سطر قصير يظهر تحت الرسم المصغّر عند الاختيار. */
  pick?: string;
  fields: Field[];
  addable?: boolean;
};

const TITLE: Field = { name: 'title', label: 'العنوان', kind: 'dual' };
const NOTE: Field = { name: 'note', label: 'سطر تحت العنوان', kind: 'long', advanced: true };
const FLIP: Field = {
  name: 'flip', label: 'اعكس الجهة — الصورة على الناحية الأخرى', kind: 'bool', advanced: true,
};
const CTA: Field = {
  name: 'cta', label: 'زرّ في آخر القسم', kind: 'link', advanced: true,
  hint: 'ينقل الزائر إلى صفحة أخرى.',
};
/** خلفية القسم — تتبادل الصفحة بين الأبيض والرملي كي ينفصل قسم عن قسم. */
const TONE: Field = {
  name: 'tone', label: 'لون خلفية القسم', kind: 'choice', advanced: true,
  options: [['', 'أبيض'], ['paper', 'رملي'], ['light', 'فاتح']],
};

export const SECTION_TYPES: Record<string, TypeSpec> = {
  story: {
    label: 'صورة ونص',
    pick: 'الأكثر استعمالًا في صفحات الخدمات',
    hint: 'صورة على جهة، وشرح وقائمة نقاط على الأخرى. الأكثر استعمالًا في صفحات الخدمات.',
    addable: true,
    fields: [
      TITLE,
      { name: 'text', label: 'الشرح', kind: 'long' },
      { name: 'img', label: 'الصورة', kind: 'image' },
      {
        name: 'imgs', label: 'صور المعرض', kind: 'images',
        hint: 'أضف صورًا هنا فتصير الصورة معرضًا كصفحة المنتج: الكبيرة بزرّ «تكبير الصورة»، وتحتها صور صغيرة يُضغط عليها لتبديلها. اتركه فارغًا لصورة واحدة.',
      },
      { name: 'points', label: 'النقاط', kind: 'list' },
      {
        name: 'eyebrowStyle', label: 'الرقم والسطر الصغير فوق العنوان', kind: 'choice',
        options: [['', 'يظهر الرقم والسطر (مثل: 01 مشروعاتنا)'], ['text', 'السطر وحده بلا رقم'], ['none', 'إخفاء الاثنين']],
        hint: 'نص السطر نفسه في «خيارات إضافية».',
      },
      {
        name: 'hideTag', label: 'أخفِ التسمية فوق الصورة', kind: 'bool',
        hint: 'مثل «في الموقع مع فريقنا». نصّها يبقى محفوظًا في «خيارات إضافية» لو أردت إظهارها لاحقًا.',
      },

      { name: 'eyebrow', label: 'سطر صغير فوق العنوان', kind: 'dual', advanced: true },
      { name: 'text2', label: 'فقرة ثانية', kind: 'long', advanced: true },
      { name: 'tag', label: 'تسمية فوق الصورة', kind: 'dual', advanced: true },
      FLIP,
      { name: 'pointsTitle', label: 'عنوان فوق النقاط', kind: 'dual', advanced: true },
      {
        name: 'facts', label: 'أرقام وحقائق', kind: 'repeat', item: 'رقم', advanced: true,
        of: [{ name: 'k', label: 'الاسم', kind: 'dual' }, { name: 'v', label: 'القيمة', kind: 'dual' }],
      },
      {
        name: 'note', label: 'ملاحظة جانبية', kind: 'group', advanced: true,
        of: [{ name: 't', label: 'العنوان', kind: 'dual' }, { name: 'd', label: 'النص', kind: 'long' }],
      },
      CTA,
    ],
  },

  feature: {
    label: 'صورة وشرح',
    pick: 'صفّ واحد: صورة وعنوان وفقرة',
    hint: 'صف واحد فيه صورة وعنوان وفقرة. يصلح لعرض معدة أو خدمة بعينها.',
    addable: true,
    fields: [
      TITLE,
      { name: 'text', label: 'الشرح', kind: 'long' },
      { name: 'img', label: 'الصورة', kind: 'image' },

      { name: 'when', label: 'سطر «متى تختاره»', kind: 'long', advanced: true },
      { name: 'brandId', label: 'لوجو ماركة فوق العنوان', kind: 'text', advanced: true, hint: 'اسم الماركة بالإنجليزية، مثل elgin.' },
      { name: 'brand', label: 'نص فوق العنوان', kind: 'text', advanced: true, hint: 'يظهر بدل اللوجو إن لم تحدّد ماركة.' },
      { name: 'product', label: 'اربطه بمنتج', kind: 'text', advanced: true, hint: 'مسار المنتج. يضيف زر «اعرض المعدة».' },
      FLIP,
      { name: 'alsoId', label: 'رابط مباشر إضافي', kind: 'text', advanced: true, hint: 'كي يظل رابط قديم يصل إلى هنا.' },
      CTA,
    ],
  },

  cards: {
    label: 'كروت',
    pick: 'ثلاثة كروت أو أكثر، كلٌّ ينقل لصفحة',
    hint: 'شبكة كروت، كلٌّ بصورة وعنوان وشرح، وقد ينقل الزائر إلى صفحة.',
    addable: true,
    fields: [
      TITLE,
      {
        name: 'cards', label: 'الكروت', kind: 'repeat', item: 'كارت',
        of: [
          { name: 'img', label: 'الصورة', kind: 'image' },
          { name: 'title', label: 'العنوان', kind: 'dual' },
          { name: 'text', label: 'الشرح', kind: 'long' },
          { name: 'href', label: 'ينقل إلى', kind: 'text', hint: 'مثل: parts.html — اتركه فارغًا لكارت بلا رابط.' },
          {
            name: 'follow', label: 'يتبع القسم الذي ينقل إليه', kind: 'bool',
            hint: 'عنوان الكارت وشرحه وصورته من ذلك القسم (أو من أعلى الصفحة): تعديله هناك يظهر هنا تلقائيًا.',
          },
        ],
      },
      {
        name: 'followAll', label: 'كل الكروت تتبع الأقسام التي تنقل إليها', kind: 'bool',
        hint: 'مثل «يتبع القسم» في كل كارت: كل كارت يأخذ عنوانه وشرحه وصورته من القسم الذي ينقل إليه.',
      },
      NOTE,
    ],
  },

  list: {
    label: 'قائمة نقاط',
    pick: 'بنود بعلامة صح',
    addable: true,
    fields: [TITLE, { name: 'items', label: 'البنود', kind: 'list' }],
  },

  steps: {
    label: 'خطوات مرقّمة',
    pick: 'شرح طريقة عمل بالترتيب',
    addable: true,
    fields: [
      TITLE,
      {
        name: 'steps', label: 'الخطوات', kind: 'repeat', item: 'خطوة',
        of: [{ name: 't', label: 'العنوان', kind: 'dual' }, { name: 'd', label: 'الشرح', kind: 'long' }],
      },
    ],
  },

  gallery: {
    label: 'معرض صور',
    pick: 'صور تُفتح بالضغط',
    hint: 'الصورة الأولى تظهر كبيرة، والباقي بجانبها، وتُفتح كلها بالضغط.',
    addable: true,
    fields: [TITLE, { name: 'imgs', label: 'الصور', kind: 'images' }, NOTE],
  },

  products: {
    label: 'كروت منتجات',
    pick: 'تُسحب من صفحة المنتجات',
    hint: 'اسم كل كارت ووصفه وصورته من المنتج نفسه: مرّر على الكارت في الصفحة واضغط «عدّل المنتج». ومن هنا تختار أيّ المنتجات تظهر وبأيّ ترتيب.',
    addable: true,
    fields: [
      TITLE,
      { name: 'ids', label: 'المنتجات', kind: 'refs' },
      {
        name: 'style', label: 'شكل الكارت', kind: 'choice',
        options: [['', 'بالوصف — يظهر شرح المنتج'], ['models', 'موديلات — تظهر الماركة والنوع']],
        hint: 'اختر «موديلات» حين تكون الكروت موديلات من ماركة واحدة.',
      },
      NOTE,
    ],
  },

  vmv: {
    label: 'الرؤية والرسالة والقيم',
    pick: 'ثلاث بطاقات بأيقونة',
    addable: true,
    fields: [
      TITLE,
      {
        name: 'cards', label: 'البطاقات', kind: 'repeat', item: 'بطاقة',
        of: [
          { name: 'icon', label: 'الأيقونة', kind: 'text', hint: 'اسم أيقونة من مجموعة الموقع، مثل eye أو target.' },
          { name: 't', label: 'العنوان', kind: 'dual' },
          { name: 'd', label: 'النص', kind: 'long' },
        ],
      },
    ],
  },

  compare: {
    label: 'مقارنة قبل وبعد',
    pick: 'صورتان يسحب الزائر بينهما',
    hint: 'صورتان يسحب الزائر بينهما.',
    addable: true,
    fields: [
      TITLE,
      { name: 'before', label: 'صورة «قبل»', kind: 'image' },
      { name: 'after', label: 'صورة «بعد»', kind: 'image' },
      NOTE,
      { name: 'beforeLabel', label: 'تسمية تحت كلمة «قبل»', kind: 'dual', advanced: true },
      { name: 'afterLabel', label: 'تسمية تحت كلمة «بعد»', kind: 'dual', advanced: true },
    ],
  },

  cta: {
    label: 'دعوة للتواصل',
    pick: 'شريط داكن بزرّ، في آخر الصفحة',
    hint: 'الشريط الداكن قبل الفوتر. زرّه ينقل دائمًا إلى نموذج عرض السعر.',
    addable: true,
    fields: [TITLE, { name: 'text', label: 'النص', kind: 'long' }],
  },

  contact: {
    label: 'بيانات التواصل والخرائط',
    hint: 'محتواه من «بيانات الشركة والتواصل»، فلا يُحرَّر هنا.',
    fields: [],
  },

  /* --------------------------------------------------- سكاشن الرئيسية */
  heroSlider: {
    label: 'سلايدر الرئيسية',
    hint: 'كل تبويب يمثّل مجموعة صور، ويفتح على أول صورة في مجموعته تلقائيًا.',
    fields: [
      {
        name: 'slides', label: 'الصور', kind: 'repeat', item: 'صورة', keyBy: 'img',
        of: [
          { name: 'img', label: 'الصورة', kind: 'image' },
          { name: 'group', label: 'المجموعة', kind: 'text', hint: 'تربط الصورة بتبويبها، مثل elgin.' },
          { name: 'alt', label: 'وصف الصورة', kind: 'dual' },
        ],
      },
      {
        name: 'tabs', label: 'التبويبات', kind: 'repeat', item: 'تبويب', keyBy: 'group',
        of: [
          { name: 'idx', label: 'الرقم', kind: 'text' },
          { name: 'title', label: 'الاسم', kind: 'text' },
          { name: 'sub', label: 'الوصف', kind: 'dual' },
          { name: 'group', label: 'المجموعة', kind: 'text', hint: 'الاسم نفسه المكتوب في صور هذا التبويب، مثل elgin.' },
          /* «slide» لم يعد يُحرَّر: يُحسب من أول صورة في المجموعة (HeroSlider).
             قيمته القديمة تبقى في المحتوى احتياطًا، وتُحفظ بالمطابقة بـ group. */
        ],
      },
    ],
  },

  logostrip: {
    label: 'شريط لوجوهات الشركات',
    fields: [
      TITLE,
      { name: 'brands', label: 'الماركات', kind: 'texts', hint: 'معرّف ماركة في كل سطر، مثل elgin. الترتيب هو ترتيب الظهور.' },
    ],
  },

  brandCards: {
    label: 'كروت الوكالات (Elgin وVactor وGuzzler)',
    fields: [
      TITLE,
      { name: 'lede', label: 'الفقرة', kind: 'long' },
      { name: 'eyebrow', label: 'سطر صغير فوق العنوان', kind: 'dual', advanced: true },
      TONE,
      { name: 'cardCta', label: 'نص الرابط في الكارت', kind: 'dual', advanced: true },
      { name: 'dealerLabel', label: 'سطر أسفل الكارت', kind: 'dual', advanced: true },
      {
        name: 'cards', label: 'الكروت', kind: 'repeat', item: 'كارت',
        of: [
          { name: 'brand', label: 'الماركة', kind: 'text' },
          { name: 'href', label: 'ينقل إلى', kind: 'text', hint: 'مثل: environment.html#elgin' },
          { name: 'image', label: 'الصورة', kind: 'image' },
          { name: 'alt', label: 'وصف الصورة', kind: 'dual' },
          { name: 'd', label: 'الشرح', kind: 'long' },
          { name: 'lines', label: 'الأسطر', kind: 'list' },
        ],
      },
    ],
  },

  cardRow: {
    label: 'صف كروت في الرئيسية',
    fields: [
      TITLE,
      { name: 'eyebrow', label: 'سطر صغير فوق العنوان', kind: 'dual', advanced: true },
      TONE,
      { name: 'cta', label: 'زرّ «كل …» بجانب العنوان', kind: 'link', advanced: true },
      { name: 'cardCta', label: 'نص الرابط في الكارت', kind: 'dual', advanced: true },
      {
        name: 'cards', label: 'الكروت', kind: 'repeat', item: 'كارت',
        of: [
          { name: 'img', label: 'الصورة', kind: 'image' },
          { name: 'href', label: 'ينقل إلى', kind: 'text' },
          { name: 'sub', label: 'السطر الصغير', kind: 'dual' },
          { name: 'h', label: 'العنوان', kind: 'dual' },
          { name: 'd', label: 'الشرح', kind: 'long' },
          { name: 'lines', label: 'الأسطر الصغيرة', kind: 'list' },
          { name: 'who', label: 'السطر السفلي', kind: 'dual' },
        ],
      },
    ],
  },

  ctaband: {
    label: 'شريط الدعوة أسفل صفحة المنتج',
    fields: [
      TITLE,
      { name: 'accent', label: 'الشطر الملوّن من العنوان', kind: 'dual' },
      { name: 'text', label: 'النص', kind: 'long' },
      { name: 'img', label: 'صورة الخلفية', kind: 'image' },
      { name: 'cta', label: 'نص الزر', kind: 'dual', advanced: true },
      {
        name: 'figs', label: 'البطاقات الصغيرة', kind: 'repeat', item: 'بطاقة', keyBy: 'icon', advanced: true,
        of: [
          { name: 'icon', label: 'الأيقونة', kind: 'text' },
          { name: 'title', label: 'العنوان', kind: 'dual', hint: 'اتركه فارغًا في البطاقة التي تعرض رقمًا.' },
          { name: 'text', label: 'النص', kind: 'dual' },
        ],
      },
    ],
  },

  /* ------------------------------------------------ كتالوج المعدات */
  linecardJump: {
    label: 'روابط الكتالوج وحقل البحث',
    fields: [
      {
        name: 'links', label: 'الروابط الثلاثة', kind: 'repeat', item: 'رابط', keyBy: 'href',
        of: [
          { name: 'href', label: 'ينقل إلى', kind: 'text', hint: 'مثل: #power' },
          { name: 'title', label: 'العنوان', kind: 'dual' },
          { name: 'text', label: 'الشرح', kind: 'long' },
        ],
      },
      { name: 'findLabel', label: 'عنوان حقل البحث', kind: 'dual' },
      { name: 'findPlaceholder', label: 'النص داخل حقل البحث', kind: 'dual', advanced: true },
      { name: 'findHint', label: 'السطر تحت حقل البحث', kind: 'dual', advanced: true },
      { name: 'findClear', label: 'نص زرّ المسح', kind: 'dual', advanced: true },
    ],
  },

  linecard: {
    label: 'قسم في كتالوج المعدات',
    hint: 'الموديلات تُسحب من المنتجات بالتصنيف والتصنيف الفرعي، فإضافة منتج جديد تظهر هنا وحدها.',
    fields: [
      TITLE,
      { name: 'lede', label: 'الفقرة', kind: 'long' },
      { name: 'eyebrow', label: 'سطر صغير فوق العنوان', kind: 'dual', advanced: true },
      { name: 'idx', label: 'رقم القسم', kind: 'text', advanced: true, hint: 'مثل 01' },
      TONE,
      {
        name: 'brandBlocks', label: 'كتل الوكالات', kind: 'repeat', item: 'وكالة', keyBy: 'brand',
        of: [
          { name: 'brand', label: 'الماركة', kind: 'text', hint: 'معرّفها، مثل elgin.' },
          { name: 'blurb', label: 'نبذة عن الماركة', kind: 'long' },
          { name: 'subs', label: 'التصنيفات الفرعية المعروضة', kind: 'texts', hint: 'اسم تصنيف في كل سطر، بالترتيب.' },
        ],
      },
      {
        name: 'groups', label: 'المجموعات', kind: 'repeat', item: 'مجموعة', keyBy: 'category',
        of: [
          {
            name: 'style', label: 'طريقة العرض', kind: 'choice',
            options: [['rows', 'صفوف بالاسم والوصف'], ['ratings', 'قدرات فقط (للمولدات)']],
          },
          { name: 'title', label: 'عنوان المجموعة', kind: 'dual' },
          { name: 'note', label: 'سطر تحت العنوان', kind: 'long' },
          { name: 'category', label: 'التصنيف', kind: 'text', hint: 'power أو environmental أو parts.' },
          { name: 'subs', label: 'التصنيفات الفرعية', kind: 'texts', hint: 'اتركها فارغة لعرض التصنيف كله.' },
        ],
      },
      { name: 'brandCells', label: 'لوجوهات أسفل القسم', kind: 'texts', advanced: true, hint: 'اسم ماركة في كل سطر.' },
      { name: 'deciding', label: 'حقول التفرقة بين الموديلات', kind: 'texts', advanced: true, hint: 'اسم مواصفة في كل سطر، بالترتيب. أول ما يوجد منها يظهر في عمود التفاصيل.' },
    ],
  },

  productRelated: {
    label: 'ترويسة «موديلات أخرى»',
    fields: [TITLE, { name: 'eyebrow', label: 'سطر صغير فوق العنوان', kind: 'dual', advanced: true }],
  },
};

/** الأنواع التي يجوز إضافتها إلى صفحة محتوى، ومعها سطر يشرح كلًّا منها. */
export const ADDABLE = Object.entries(SECTION_TYPES)
  .filter(([, s]) => s.addable)
  .map(([type, s]) => ({ type, label: s.label, hint: s.pick ?? '' }));

export const typeLabel = (t: string) => SECTION_TYPES[t]?.label ?? t;

/** محتوى ابتدائي لسيكشن جديد: الحقول موجودة وفارغة كي تظهر في النموذج. */
export function blankContent(type: string) {
  const spec = SECTION_TYPES[type];
  const out: Record<string, any> = {};
  for (const f of spec?.fields ?? []) {
    if (f.kind === 'dual' || f.kind === 'long') out[f.name] = { en: '', ar: '' };
    else if (f.kind === 'list' || f.kind === 'images' || f.kind === 'refs' || f.kind === 'repeat') out[f.name] = [];
  }
  return out;
}
