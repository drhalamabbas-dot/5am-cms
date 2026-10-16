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
     brands    ماركات تُختار بالضغط على لوجوهاتها (تُحفظ كقائمة معرّفات)
     num       رقم
     video     ملف فيديو من المكتبة
     file      ملف من المكتبة (PDF وما شابهه)
============================================================================= */
export type FieldKind =
  | 'dual' | 'long' | 'image' | 'text' | 'bool' | 'link' | 'list' | 'images' | 'refs'
  | 'repeat' | 'group' | 'choice' | 'texts' | 'brands' | 'num' | 'video' | 'file';

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
  /** اقتراحات جاهزة تُضاف بضغطة بدل كتابتها من الصفر.

      القسم الجديد يبدأ فارغًا، فيقف صاحب الموقع أمام حقول بيضاء لا يدري بم
      يملؤها. هنا صيغ مكتوبة بلغتيها من شغل 5A&M نفسه: يضغط فتُضاف ثم يعدّل
      عليها. وهي اقتراح لا إلزام — ما لا يُضغط لا يظهر في الموقع.

      القيمة بحسب نوع الحقل: صفّ كامل لـ repeat، و{en,ar} لـ list وdual
      وlong، ونصّ مفرد لـ texts. */
  suggest?: { label: string; value: any }[];
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
/* ------------------------------------------------------------ الاقتراحات
   صيغ جاهزة من شغل 5A&M نفسها — استيراد وتصدير ومقاولات، توليد طاقة وحلول
   بيئية — يضغطها صاحب الموقع فتُضاف ثم يعدّل عليها.

   ما لا يُعرَف لا يُقترَح: لا أرقام مخترَعة ولا آراء عملاء مكتوبة من عندنا.
   الأرقام تُترك فارغة ليكتبها صاحبها، وقسم الآراء لا اقتراح لنصّه أصلًا —
   رأي لم يقله عميل لا يُكتب باسمه. */
const dual = (ar: string, en: string) => ({ ar, en });

const BULLETS: { label: string; value: { ar: string; en: string } }[] = [
  { label: 'قطع غيار أصلية', value: dual('قطع غيار أصلية من الوكيل مباشرةً', 'Genuine spare parts, straight from the agent') },
  { label: 'فريق فني معتمد', value: dual('فريق فني معتمد من الشركة المصنِّعة', 'Service engineers certified by the manufacturer') },
  { label: 'ضمان', value: dual('ضمان على التوريد والتركيب', 'Warranty on supply and installation') },
  { label: 'تدريب المشغّلين', value: dual('تدريب المشغّلين على المعدة قبل التسليم', 'Operator training before handover') },
  { label: 'صيانة دورية', value: dual('عقود صيانة دورية بمواعيد ثابتة', 'Scheduled maintenance contracts') },
  { label: 'دعم فني', value: dual('دعم فني ومتابعة بعد البيع', 'Technical support and after-sales follow-up') },
  { label: 'مطابقة المواصفات', value: dual('مطابقة لمواصفات الجهات الحكومية', 'Compliant with government specifications') },
];

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
      { name: 'points', label: 'النقاط', kind: 'list', suggest: BULLETS },
      {
        name: 'variant', label: 'شكل القسم', kind: 'choice',
        options: [
          ['', 'الافتراضي — صورة بجانب النص'],
          ['stack', 'صورة عريضة فوق، والنصّ تحتها'],
          ['card', 'الصفّ كلّه داخل بطاقة بيضاء'],
          ['tall', 'صورة طولية، ومساحة أوسع للنص'],
          ['plain', 'صورة هادئة بحدّ رفيع بلا ظلّ'],
        ],
        hint: 'الصورة العريضة تناسب صور المواقع والمعدّات الطويلة، والطولية تناسب الصور الرأسية.',
      },
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
    fields: [TITLE, { name: 'items', label: 'البنود', kind: 'list', suggest: BULLETS }],
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
        /* رحلة العميل عندنا من أول مكالمة إلى الصيانة — بالترتيب، فمن يضغطها
           واحدةً بعد أخرى يخرج بقسم كامل. */
        suggest: [
          { label: '1 · طلب عرض سعر', value: {
            t: dual('تطلب عرض سعر', 'You request a quote'),
            d: dual('تقول لنا طبيعة الشغل وحجمه، ونرد بعرض مفصّل.',
              'Tell us the job and its size, and we reply with a detailed quotation.') } },
          { label: '2 · معاينة', value: {
            t: dual('نعاين الموقع', 'We survey the site'),
            d: dual('زيارة لتحديد المعدة المناسبة ومتطلبات التركيب.',
              'A visit to determine the right equipment and installation requirements.') } },
          { label: '3 · توريد', value: {
            t: dual('نورّد المعدة', 'We supply the equipment'),
            d: dual('من المخزن أو باستيراد مباشر من الوكيل.',
              'From stock, or imported directly from the agent.') } },
          { label: '4 · تركيب وتشغيل', value: {
            t: dual('نركّب ونشغّل', 'We install and commission'),
            d: dual('فريقنا يسلّمك المعدة وهي تعمل في موقعك.',
              'Our team hands over a running machine on your site.') } },
          { label: '5 · تدريب', value: {
            t: dual('ندرّب المشغّلين', 'We train the operators'),
            d: dual('تدريب عملي على التشغيل الصحيح والصيانة اليومية.',
              'Hands-on training on correct operation and daily maintenance.') } },
          { label: '6 · صيانة', value: {
            t: dual('نتابع بالصيانة', 'We keep it running'),
            d: dual('زيارات دورية وقطع غيار أصلية ودعم فني عند الحاجة.',
              'Scheduled visits, genuine parts and technical support when needed.') } },
        ],
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
        /* البطاقات الثلاث المعتادة بأيقوناتها — والنصّ صيغة تُعدَّل، فالرؤية
           والرسالة كلام صاحب الشركة لا كلامنا. */
        suggest: [
          { label: 'الرؤية', value: {
            icon: 'eye', t: dual('رؤيتنا', 'Our vision'),
            d: dual('أن نكون المرجع الأول في مصر لمعدّات البيئة وتوليد الطاقة.',
              'To be Egypt’s first reference for environmental and power generation equipment.') } },
          { label: 'الرسالة', value: {
            icon: 'target', t: dual('رسالتنا', 'Our mission'),
            d: dual('نورّد معدّات موثوقة وندعمها بخدمة وقطع غيار تبقيها شغّالة.',
              'We supply reliable equipment and back it with service and parts that keep it running.') } },
          { label: 'القيم', value: {
            icon: 'gem', t: dual('قيمنا', 'Our values'),
            d: dual('الصدق في الوعد، والالتزام بالموعد، والمتابعة بعد البيع.',
              'Honest promises, kept schedules, and follow-up after the sale.') } },
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

  faq: {
    label: 'أسئلة شائعة',
    pick: 'سؤال يُفتح بالضغط فيظهر جوابه',
    hint: 'كل سؤال مطويّ ويُفتح بالضغط. مفيد أيضًا لمحركات البحث: تقرأ السؤال والجواب معًا.',
    addable: true,
    fields: [
      TITLE,
      {
        name: 'items', label: 'الأسئلة', kind: 'repeat', item: 'سؤال',
        of: [
          { name: 'q', label: 'السؤال', kind: 'dual' },
          { name: 'a', label: 'الجواب', kind: 'long' },
        ],
        /* أكثر ما يُسأل في مكالمات البيع. الأجوبة صيغ عامة تُعدَّل بما يناسب
           كل صفحة — لا وعد برقم أو مدة لم يقرّها صاحب الموقع. */
        suggest: [
          { label: 'الضمان', value: {
            q: dual('ما مدة الضمان؟', 'How long is the warranty?'),
            a: dual('يشمل التوريد والتركيب، وتختلف مدته باختلاف المعدة. نوضّحها في عرض السعر قبل الاتفاق.',
              'It covers supply and installation; the period depends on the equipment and is stated in the quotation.') } },
          { label: 'قطع الغيار', value: {
            q: dual('قطع الغيار متوفرة؟', 'Are spare parts available?'),
            a: dual('نحتفظ بمخزون من القطع سريعة الاستهلاك، وما ليس متوفرًا نستورده من الوكيل مباشرةً.',
              'We keep fast-moving parts in stock, and order the rest directly from the agent.') } },
          { label: 'الصيانة', value: {
            q: dual('هل عندكم عقود صيانة؟', 'Do you offer maintenance contracts?'),
            a: dual('نعم، عقود بمواعيد ثابتة تشمل الزيارات الدورية والقطع المستهلكة.',
              'Yes — scheduled contracts covering periodic visits and consumables.') } },
          { label: 'التركيب والتشغيل', value: {
            q: dual('هل التركيب والتشغيل عليكم؟', 'Do you handle installation and commissioning?'),
            a: dual('فريقنا يركّب ويشغّل ويسلّم المعدة وهي تعمل، ويدرّب المشغّلين قبل المغادرة.',
              'Our team installs, commissions and hands over a running machine, and trains the operators before leaving.') } },
          { label: 'مدة التوريد', value: {
            q: dual('التوريد ياخد قد إيه؟', 'What is the delivery time?'),
            a: dual('المتوفر في المخزن يُسلَّم فورًا، وما يُطلب من الخارج تُحدَّد مدته في عرض السعر.',
              'Stock items ship immediately; imported items have their lead time stated in the quotation.') } },
          { label: 'التدريب', value: {
            q: dual('هل تدرّبون المشغّلين؟', 'Do you train the operators?'),
            a: dual('نعم، تدريب عملي على المعدة في موقع العمل ضمن التسليم.',
              'Yes — hands-on training on site, included in the handover.') } },
        ],
      },
      { name: 'open', label: 'افتح أول سؤال', kind: 'bool', advanced: true },
      NOTE,
    ],
  },

  stats: {
    label: 'أرقام وإنجازات',
    pick: 'أرقام كبيرة: سنوات خبرة، عملاء…',
    hint: 'صفّ أرقام كبيرة تحت كلٍّ منها كلمة. اكتب الرقم كما تريده أن يظهر: 35 أو +500 أو 24/7.',
    addable: true,
    fields: [
      TITLE,
      {
        name: 'items', label: 'الأرقام', kind: 'repeat', item: 'رقم',
        of: [
          { name: 'v', label: 'الرقم', kind: 'text', hint: 'مثل 35 أو +500' },
          { name: 'k', label: 'الكلمة تحته', kind: 'dual' },
        ],
        /* الكلمة جاهزة والرقم فارغ عمدًا: الرقم حقيقة عن الشركة لا يعرفها
           إلا صاحبها، واقتراح رقم هنا يعني نشر رقم لم يقله أحد. */
        suggest: [
          { label: 'سنة خبرة', value: { v: '', k: dual('سنة خبرة', 'Years of experience') } },
          { label: 'عميل', value: { v: '', k: dual('عميل', 'Clients') } },
          { label: 'وحدة مورَّدة', value: { v: '', k: dual('وحدة مورَّدة', 'Units supplied') } },
          { label: 'مشروع منفَّذ', value: { v: '', k: dual('مشروع منفَّذ', 'Projects delivered') } },
          { label: 'محافظة', value: { v: '', k: dual('محافظة نخدمها', 'Governorates served') } },
          { label: 'ماركة عالمية', value: { v: '', k: dual('ماركة عالمية', 'Global brands') } },
          { label: 'دعم 24/7', value: { v: '24/7', k: dual('دعم فني', 'Technical support') } },
        ],
      },
      TONE,
      NOTE,
    ],
  },

  quotes: {
    label: 'آراء العملاء',
    pick: 'كلام عميل باسمه وجهة عمله',
    hint: 'لا تكتب رأيًا لم يُقَل: ما هنا يظهر للزائر منسوبًا لصاحبه.',
    addable: true,
    fields: [
      TITLE,
      {
        name: 'items', label: 'الآراء', kind: 'repeat', item: 'رأي',
        of: [
          { name: 'text', label: 'نصّ الرأي', kind: 'long' },
          { name: 'who', label: 'الاسم', kind: 'dual' },
          /* الصفة وحدها هي ما يُقترَح هنا: مسمًّى وظيفي لا رأيًا. ونصّ الرأي
             بلا اقتراح عمدًا — كلام ينسب لعميل لا يُكتب إلا كما قاله. */
          { name: 'role', label: 'الصفة أو الشركة', kind: 'dual', suggest: [
            { label: 'مدير المشتريات', value: dual('مدير المشتريات', 'Procurement Manager') },
            { label: 'مدير الصيانة', value: dual('مدير الصيانة', 'Maintenance Manager') },
            { label: 'مدير المشروع', value: dual('مدير المشروع', 'Project Manager') },
            { label: 'مدير التشغيل', value: dual('مدير التشغيل', 'Operations Manager') },
            { label: 'رئيس القطاع الفني', value: dual('رئيس القطاع الفني', 'Head of Technical') },
          ] },
        ],
      },
      NOTE,
    ],
  },

  video: {
    label: 'فيديو',
    pick: 'فيديو يوتيوب داخل الصفحة',
    hint: 'الصق رابط الفيديو من يوتيوب كما تنسخه من المتصفح. لا يُحمَّل الفيديو إلا حين يصل إليه الزائر.',
    addable: true,
    fields: [
      TITLE,
      {
        name: 'items', label: 'الفيديوهات', kind: 'repeat', item: 'فيديو', keyBy: 'yt',
        of: [
          { name: 'yt', label: 'رابط يوتيوب', kind: 'text' },
          { name: 'cap', label: 'سطر تحت الفيديو', kind: 'dual' },
        ],
      },
      NOTE,
    ],
  },

  downloads: {
    label: 'ملفات للتحميل',
    pick: 'كتالوجات وكراسات PDF',
    hint: 'الكتالوج في يد العميل يبيع وأنت نائم. ارفع الملف من «الصور والفيديو» ثم اختره هنا.',
    addable: true,
    fields: [
      TITLE,
      {
        name: 'items', label: 'الملفات', kind: 'repeat', item: 'ملف', keyBy: 'file',
        of: [
          { name: 'file', label: 'الملف', kind: 'file' },
          { name: 'label', label: 'اسم الملف كما يظهر', kind: 'dual' },
          { name: 'note', label: 'سطر تحته', kind: 'dual' },
        ],
        suggest: [
          { label: 'كتالوج المعدة', value: {
            file: '', label: dual('كتالوج المعدة', 'Equipment brochure'),
            note: dual('المواصفات الكاملة والمقاسات', 'Full specifications and dimensions') } },
          { label: 'كراسة فنية', value: {
            file: '', label: dual('الكراسة الفنية', 'Technical datasheet'),
            note: dual('بيانات الأداء والتشغيل', 'Performance and operating data') } },
          { label: 'قائمة قطع الغيار', value: {
            file: '', label: dual('قائمة قطع الغيار', 'Spare parts list'),
            note: dual('أرقام القطع المعتمدة', 'Approved part numbers') } },
        ],
      },
      NOTE,
    ],
  },

  timeline: {
    label: 'مسيرة بالسنوات',
    pick: 'محطات الشركة سنةً بعد سنة',
    hint: 'خطّ زمني: سنة ومعها ما حدث فيها. يصلح لصفحة «من نحن» ولمسيرة وكالة.',
    addable: true,
    fields: [
      TITLE,
      {
        name: 'items', label: 'المحطات', kind: 'repeat', item: 'محطة',
        of: [
          { name: 'y', label: 'السنة', kind: 'text', hint: 'مثل 2022' },
          { name: 't', label: 'العنوان', kind: 'dual' },
          { name: 'd', label: 'الشرح', kind: 'long' },
        ],
        /* السنوات فارغة: تاريخ الشركة لا يُقترَح عليها */
        suggest: [
          { label: 'التأسيس', value: { y: '', t: dual('تأسيس الشركة', 'The company is founded'),
            d: dual('بدأنا بتوريد المعدات الثقيلة للسوق المصري.', 'We began supplying heavy equipment to the Egyptian market.') } },
          { label: 'وكالة جديدة', value: { y: '', t: dual('وكالة جديدة', 'A new agency'),
            d: dual('أصبحنا الوكيل المعتمد لماركة عالمية في مصر.', 'We became the authorised agent for a global brand in Egypt.') } },
          { label: 'مركز خدمة', value: { y: '', t: dual('افتتاح مركز الخدمة', 'Service centre opens'),
            d: dual('ورشة وقطع غيار تخدم العملاء بعد البيع.', 'A workshop and parts store serving customers after the sale.') } },
          { label: 'توسّع', value: { y: '', t: dual('توسّع في التغطية', 'Wider coverage'),
            d: dual('وصلت خدمتنا إلى محافظات جديدة.', 'Our service reached new governorates.') } },
        ],
      },
      TONE,
      NOTE,
    ],
  },

  specs: {
    label: 'جدول مواصفات',
    pick: 'صفّان: الاسم وقيمته',
    hint: 'جدول بسيط من سطرين في كل صفّ: اسم المواصفة وقيمتها. يُقرأ على الهاتف سطرًا سطرًا.',
    addable: true,
    fields: [
      TITLE,
      {
        name: 'rows', label: 'الصفوف', kind: 'repeat', item: 'صفّ',
        of: [
          { name: 'k', label: 'المواصفة', kind: 'dual' },
          { name: 'v', label: 'القيمة', kind: 'dual' },
        ],
        /* أسماء المواصفات جاهزة والقيم فارغة — القيمة تخصّ معدةً بعينها */
        suggest: [
          { label: 'سعة الخزان', value: { k: dual('سعة الخزان', 'Tank capacity'), v: dual('', '') } },
          { label: 'المحرك', value: { k: dual('المحرك', 'Engine'), v: dual('', '') } },
          { label: 'القدرة', value: { k: dual('القدرة', 'Power output'), v: dual('', '') } },
          { label: 'الوزن', value: { k: dual('الوزن التشغيلي', 'Operating weight'), v: dual('', '') } },
          { label: 'الأبعاد', value: { k: dual('الأبعاد', 'Dimensions'), v: dual('', '') } },
          { label: 'الاستهلاك', value: { k: dual('استهلاك الوقود', 'Fuel consumption'), v: dual('', '') } },
          { label: 'بلد الصنع', value: { k: dual('بلد الصنع', 'Country of origin'), v: dual('', '') } },
          { label: 'الضمان', value: { k: dual('الضمان', 'Warranty'), v: dual('', '') } },
        ],
      },
      TONE,
      NOTE,
    ],
  },

  team: {
    label: 'فريق العمل',
    pick: 'صور الفريق بأسمائهم',
    hint: 'وجه ومسمّى وظيفي يطمئن العميل أن خلف الشركة ناسًا. الصورة اختيارية.',
    addable: true,
    fields: [
      TITLE,
      {
        name: 'items', label: 'الأشخاص', kind: 'repeat', item: 'شخص',
        of: [
          { name: 'img', label: 'الصورة', kind: 'image' },
          { name: 'name', label: 'الاسم', kind: 'dual' },
          { name: 'role', label: 'المسمّى الوظيفي', kind: 'dual', suggest: [
            { label: 'المدير العام', value: dual('المدير العام', 'General Manager') },
            { label: 'مدير المبيعات', value: dual('مدير المبيعات', 'Sales Manager') },
            { label: 'مدير الخدمة', value: dual('مدير الخدمة والصيانة', 'Service Manager') },
            { label: 'مهندس تطبيقات', value: dual('مهندس تطبيقات', 'Application Engineer') },
            { label: 'مسؤول قطع الغيار', value: dual('مسؤول قطع الغيار', 'Parts Specialist') },
          ] },
        ],
      },
      NOTE,
    ],
  },

  callout: {
    label: 'ملاحظة بارزة',
    pick: 'سطر مهم في إطار ملوّن',
    hint: 'لِما لا يصحّ أن يفوت القارئ: شرط، أو تنبيه، أو عرض لفترة. سطر أو سطران لا فقرة.',
    addable: true,
    fields: [
      {
        ...TITLE,
        suggest: [
          { label: 'توصيل مجاني', value: dual('التوصيل والتركيب داخل القاهرة والجيزة مجانًا', 'Free delivery and installation in Cairo and Giza') },
          { label: 'متوفر في المخزن', value: dual('متوفر في المخزن — تسليم فوري', 'In stock — immediate delivery') },
          { label: 'قطع غيار مضمونة', value: dual('قطع الغيار مضمونة طول عمر المعدة', 'Spare parts guaranteed for the life of the machine') },
        ],
      },
      { name: 'text', label: 'الشرح', kind: 'long' },
      {
        name: 'icon', label: 'الأيقونة', kind: 'choice',
        options: [['info', 'معلومة'], ['alert', 'تنبيه'], ['tick', 'علامة صح'], ['bolt', 'طاقة'], ['truck', 'توريد'], ['wrench', 'صيانة'], ['shield', 'ضمان']],
      },
      TONE,
      CTA,
      NOTE,
    ],
  },

  cta: {
    label: 'دعوة للتواصل',
    pick: 'شريط داكن بزرّ، في آخر الصفحة',
    hint: 'الشريط الداكن قبل الفوتر. زرّه ينقل دائمًا إلى نموذج عرض السعر.',
    addable: true,
    fields: [
      {
        ...TITLE,
        suggest: [
          { label: 'محتاج معدة؟', value: dual('محتاج معدة لمشروعك؟', 'Need equipment for your project?') },
          { label: 'نساعدك تختار', value: dual('مش متأكد من المقاس المناسب؟', 'Not sure which size fits?') },
          { label: 'اطلب عرض سعر', value: dual('اطلب عرض سعر النهارده', 'Request a quote today') },
        ],
      },
      {
        name: 'text', label: 'النص', kind: 'long',
        suggest: [
          { label: 'نرد في يوم عمل', value: dual('ابعت لنا تفاصيل شغلك ونرد عليك بعرض مفصّل خلال يوم عمل.',
            'Send us your requirements and we’ll reply with a detailed quotation within one working day.') },
          { label: 'نساعدك تختار', value: dual('قول لنا طبيعة الشغل وفريقنا يرشّح لك المعدة المناسبة.',
            'Tell us about the job and our team will recommend the right machine.') },
        ],
      },
    ],
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
    pick: 'لوجوهات تمرّ في شريط متحرّك',
    hint: 'شريط اللوجوهات يمرّ أفقيًّا بلا توقّف. اللوجو والاسم من صفحة الماركات، فتعديلهما هناك يظهر هنا.',
    addable: true,
    fields: [
      TITLE,
      { name: 'brands', label: 'الماركات', kind: 'brands', hint: 'اضغط اللوجو لتضيفه، والسهمان يرتّبان الظهور. اللوجو والاسم من صفحة الماركات.' },
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
