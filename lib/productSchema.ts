/* وصف حقول عمود data في المنتج — نفس فكرة sectionSchema، لتُبنى الشاشة منه
   ويُعاد تركيب الـ JSON بالطريقة نفسها بلا فقد. */
import type { Field } from './sectionSchema';

export const PRODUCT_FIELDS: Field[] = [
  { name: 'gallery', label: 'صور المنتج', kind: 'images', hint: 'الصورة الأولى تظهر كبيرة في المعرض. الترتيب هنا هو ترتيب الظهور.' },
  {
    name: 'specifications', label: 'المواصفات', kind: 'repeat', item: 'مواصفة', keyBy: 'k',
    of: [
      { name: 'k', label: 'البند', kind: 'text' },
      { name: 'v', label: 'القيمة', kind: 'text' },
    ],
  },
  {
    name: 'meta', label: 'الشرائح أعلى الصفحة', kind: 'repeat', item: 'شريحة', keyBy: 'k',
    of: [
      { name: 'k', label: 'الاسم', kind: 'text' },
      { name: 'v', label: 'القيمة', kind: 'text' },
    ],
  },
  { name: 'features', label: 'المميزات', kind: 'texts' },
  { name: 'applications', label: 'الاستخدامات', kind: 'texts' },
  {
    name: 'downloads', label: 'الملفات والبروشورات', kind: 'repeat', item: 'ملف', keyBy: 'label',
    of: [
      { name: 'label', label: 'اسم الملف كما يظهر', kind: 'text' },
      { name: 'href', label: 'الملف', kind: 'image', hint: 'اختر ملف PDF من المكتبة. اتركه فارغًا ليظهر «متاح عند الطلب».' },
    ],
  },
  {
    name: 'videos', label: 'مقاطع الفيديو', kind: 'repeat', item: 'مقطع', keyBy: 'poster',
    of: [
      { name: 'yt', label: 'رابط فيديو يوتيوب', kind: 'text', hint: 'الصق رابط الفيديو كما هو من يوتيوب. املأه أو ارفع ملفًا أدناه، لا الاثنين. بلا صورة غلاف يظهر غلاف يوتيوب.' },
      { name: 'src', label: 'ملف فيديو مرفوع', kind: 'video', hint: 'بديل يوتيوب: ارفع الملف من المكتبة.' },
      { name: 'poster', label: 'صورة الغلاف', kind: 'image', hint: 'ما يراه الزائر قبل التشغيل.' },
      { name: 'en', label: 'الوصف بالإنجليزية', kind: 'text' },
      { name: 'ar', label: 'الوصف بالعربية', kind: 'text' },
      { name: 'len', label: 'المدة', kind: 'text', hint: 'مثل 1:42' },
    ],
  },
  { name: 'related', label: 'منتجات مرتبطة', kind: 'refs', hint: 'معرّف منتج في كل سطر. تظهر أسفل صفحة المنتج.' },
];
