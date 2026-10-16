/* =============================================================================
   ألوان الموقع وخطوطه، وتصميم كل قسم — من المحرّر المرئي.

   مستويان:
   • الموقع كله (إعداد theme): اللون الأساسي والداكن، ولون العناوين والنص
     والخلفية الفاتحة، وخطوط العناوين والنص بالعربية والإنجليزية. يُطبَّق بتغيير
     متغيّرات CSS التي بُني عليها التصميم (base.css)، فيصل إلى كل مكان.
   • القسم الواحد (content.design): خلفيته وألوانه وخطّه وأحجامه ومحاذاته
     وصورته ومسافاته وظهوره على الهاتف والحاسب. يُطبَّق بقواعد CSS محصورة فيه.

   القاعدة: ما لم يُغيَّر لا يُكتب له شيء — فالموقع بلا إعدادات هو الموقع كما
   كان حرفًا بحرف. وكل قيمة تُفحص قبل أن تصير CSS (ألوان hex، وأرقام في مدى،
   وخطوط من القائمة)، فلا يُحقن في الصفحة ما لم يُقصد.

   بلا اعتماد على الخادم: يُستورد في المحرّر (للقوائم) وفي الصفحة (للرسم).
============================================================================= */

export type Theme = {
  brand?: string; navy?: string; ink?: string; body?: string; paper?: string;
  fontArDisplay?: string; fontArText?: string; fontEnDisplay?: string; fontEnText?: string;
};

export type Design = {
  bg?: string; title?: string; text?: string; accent?: string;
  font?: string; titleSize?: number; textSize?: number; titleWeight?: number;
  align?: 'right' | 'center' | 'left';
  padTop?: number; padBottom?: number;
  imgHeight?: number; imgZoom?: number; imgPos?: string; imgRadius?: number;
  /** عرض الصورة بإطارها: نصيبها من صفّ «صورة ونص» بالمئة (الباقي للنص) */
  imgShare?: number;
  /** حركة دخول القسم مع التمرير (مفتاح من ANIMS). */
  anim?: string;
  hideMobile?: boolean; hideDesktop?: boolean;
  /** تكبير صورة بعينها داخل إطارها، ومركز التكبير (أي جزء منها يبقى ظاهرًا).
   *  المفتاح مسار الصورة كما يُخزَّن؛ z نسبة مئوية، وx وy موضع المركز 0–100. */
  imgFx?: Record<string, ImgFx>;
};
export type ImgFx = { z?: number; x?: number; y?: number };

/* ------------------------------------------------------------------ الخطوط
   خطوط Google المجانية، بالأوزان المتاحة لكلٍّ منها (الطلب بوزن غير متاح يفشل). */
export const FONTS: { name: string; ar: boolean; weights: string; stack: string }[] = [
  { name: 'Cairo', ar: true, weights: '400;600;700;800;900', stack: 'sans-serif' },
  { name: 'IBM Plex Sans Arabic', ar: true, weights: '400;500;600;700', stack: 'sans-serif' },
  { name: 'Tajawal', ar: true, weights: '400;500;700;800;900', stack: 'sans-serif' },
  { name: 'Almarai', ar: true, weights: '400;700;800', stack: 'sans-serif' },
  { name: 'Noto Kufi Arabic', ar: true, weights: '400;500;600;700;800;900', stack: 'sans-serif' },
  { name: 'Readex Pro', ar: true, weights: '400;500;600;700', stack: 'sans-serif' },
  { name: 'Alexandria', ar: true, weights: '400;500;600;700;800;900', stack: 'sans-serif' },
  { name: 'Changa', ar: true, weights: '400;500;600;700;800', stack: 'sans-serif' },
  { name: 'Rubik', ar: true, weights: '400;500;600;700;800;900', stack: 'sans-serif' },
  { name: 'El Messiri', ar: true, weights: '400;500;600;700', stack: 'sans-serif' },
  { name: 'Noto Naskh Arabic', ar: true, weights: '400;500;600;700', stack: 'serif' },
  { name: 'Amiri', ar: true, weights: '400;700', stack: 'serif' },
  { name: 'Archivo', ar: false, weights: '400;500;600;700;800;900', stack: 'sans-serif' },
  { name: 'Inter', ar: false, weights: '400;500;600;700;800', stack: 'sans-serif' },
  { name: 'Poppins', ar: false, weights: '400;500;600;700;800;900', stack: 'sans-serif' },
  { name: 'Montserrat', ar: false, weights: '400;500;600;700;800;900', stack: 'sans-serif' },
  { name: 'Roboto', ar: false, weights: '400;500;700;900', stack: 'sans-serif' },
  { name: 'Open Sans', ar: false, weights: '400;500;600;700;800', stack: 'sans-serif' },
  { name: 'Lato', ar: false, weights: '400;700;900', stack: 'sans-serif' },
  { name: 'Manrope', ar: false, weights: '400;500;600;700;800', stack: 'sans-serif' },
  { name: 'DM Sans', ar: false, weights: '400;500;600;700;800;900', stack: 'sans-serif' },
  { name: 'Playfair Display', ar: false, weights: '400;500;600;700;800;900', stack: 'serif' },
];
const fontOf = (n?: string) => FONTS.find((f) => f.name === n);
/* محمّلة أصلًا في رأس كل صفحة (app/(site)/layout.tsx) */
const PRELOADED = new Set(['Archivo', 'Cairo', 'IBM Plex Sans Arabic', 'Inter']);
const stack = (n: string) => `"${n}", ${fontOf(n)?.stack ?? 'sans-serif'}`;

/** رابط Google Fonts لما اختير من خطوط غير المحمّلة أصلًا، أو null. */
export function fontsHref(names: (string | undefined)[]): string | null {
  const want = [...new Set(names.filter((n): n is string => !!n && !!fontOf(n) && !PRELOADED.has(n)))];
  if (!want.length) return null;
  const fam = want.map((n) => `family=${n.replace(/ /g, '+')}:wght@${fontOf(n)!.weights}`).join('&');
  return `https://fonts.googleapis.com/css2?${fam}&display=swap`;
}

/* ----------------------------------------------------------------- الألوان */
export const THEME_DEFAULTS: Required<Theme> = {
  brand: '#F26522', navy: '#060B14', ink: '#0F172A', body: '#28374B', paper: '#F8FAFC',
  fontArDisplay: 'Cairo', fontArText: 'IBM Plex Sans Arabic', fontEnDisplay: 'Archivo', fontEnText: 'Inter',
};

const HEX = /^#[0-9a-f]{6}$/i;
const color = (v: unknown) => (typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : undefined);
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => '#' + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('').toUpperCase();
/** يمزج اللون بالأبيض (t>0) أو بالأسود (t<0) بنسبة |t| */
const shade = (h: string, t: number) => hex(rgb(h).map((x) => (t > 0 ? x + (255 - x) * t : x * (1 + t))));
const num = (v: unknown, lo: number, hi: number) => {
  const n = Number(v);
  return v === '' || v == null || !Number.isFinite(n) ? undefined : Math.round(Math.max(lo, Math.min(hi, n)));
};
const font = (v: unknown) => (typeof v === 'string' && fontOf(v) ? v : undefined);
const drop = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== false)) as T;

/** كل درجات اللون الأساسي في base.css، مشتقّةً من لون واحد بنسب قريبة من
 *  علاقتها بالبرتقالي الأصلي (أفتح على الداكن، أغمق للنص والأزرار). */
function brandVars(b: string): string[] {
  return [
    `--brand:${b}`, `--brand-strong:${shade(b, -0.2)}`, `--brand-600:${shade(b, -0.36)}`,
    `--brand-on-dark:${shade(b, 0.22)}`, `--brand-300:${shade(b, 0.48)}`, `--brand-light:${shade(b, 0.25)}`,
    `--brand-hi:${shade(b, 0.3)}`, `--brand-soft:${shade(b, 0.45)}`, `--brand-pale:${shade(b, 0.75)}`,
    `--brand-grad-a:${shade(b, 0.06)}`, `--brand-grad-b:${shade(b, -0.08)}`, `--brand-brown:${shade(b, -0.55)}`,
    `--brand-tint:${shade(b, 0.94)}`,
  ];
}

/** إعدادات الموقع بعد الفحص، بلا ما يساوي الأصل. */
export function cleanTheme(v: any): Theme {
  const t: Theme = drop({
    brand: color(v?.brand), navy: color(v?.navy), ink: color(v?.ink), body: color(v?.body), paper: color(v?.paper),
    fontArDisplay: font(v?.fontArDisplay), fontArText: font(v?.fontArText),
    fontEnDisplay: font(v?.fontEnDisplay), fontEnText: font(v?.fontEnText),
  });
  for (const k of Object.keys(t) as (keyof Theme)[]) {
    if (String(t[k]).toUpperCase() === String(THEME_DEFAULTS[k]).toUpperCase()) delete t[k];
  }
  return t;
}

/** CSS إعدادات الموقع: متغيّرات base.css بالقيم الجديدة، مشتقّةً درجاتها. */
export function themeCss(raw: any): string {
  const t = cleanTheme(raw);
  const root: string[] = [];
  if (t.brand) {
    const b = t.brand;
    root.push(...brandVars(b));
  }
  if (t.navy) {
    const n = t.navy;
    root.push(`--navy:${n}`, `--navy-900:${shade(n, -0.4)}`, `--navy-800:${shade(n, 0.03)}`,
      `--navy-700:${shade(n, 0.07)}`, `--navy-500:${shade(n, 0.14)}`);
  }
  if (t.ink) root.push(`--ink:${t.ink}`);
  if (t.body) root.push(`--body:${t.body}`, `--muted:${shade(t.body, 0.22)}`);
  if (t.paper) root.push(`--paper:${t.paper}`, `--paper-2:${shade(t.paper, -0.03)}`);
  if (t.fontArDisplay) root.push(`--display-ar:${stack(t.fontArDisplay)}`);
  if (t.fontArText) root.push(`--text-ar:${stack(t.fontArText)}`);
  let css = root.length ? `:root{${root.join(';')}}` : '';
  /* الإنجليزية: [lang=ar] يعيد --display إلى العربية، فتُحصر في غير العربية */
  const en: string[] = [];
  if (t.fontEnDisplay) en.push(`--display:${stack(t.fontEnDisplay)}`);
  if (t.fontEnText) en.push(`--text:${stack(t.fontEnText)}`);
  if (en.length) css += `html:not([lang="ar"]){${en.join(';')}}`;
  return css;
}

/* --------------------------------------------------------------- تصميم القسم */
export const IMG_POS: [string, string][] = [
  ['', 'الوسط'], ['top', 'أعلى'], ['bottom', 'أسفل'], ['right', 'يمين'], ['left', 'يسار'],
];

/* ------------------------------------------------------------- حركة الدخول
   الحركة مربوطة بالتمرير نفسه (animation-timeline:view)، فتتقدّم مع حركة
   إصبع الزائر لا بمؤقّت — ولا تحتاج جافاسكريبت أصلًا.

   وهي مكتوبة بحيث لا تخفي شيئًا أبدًا: المتصفح الذي لا يعرف هذه الخاصية لا
   يُكتب له القاعدة من أساسها (@supports)، فيرى القسم كاملًا بلا حركة. ومن
   طلب تقليل الحركة من نظامه لا تصله كذلك. */
export const ANIMS: [string, string][] = [
  ['', 'بلا حركة'],
  ['fade', 'ظهور تدريجي'],
  ['up', 'يصعد من تحت'],
  ['zoom', 'يكبر برفق'],
  ['start', 'يدخل من أول السطر'],
  ['end', 'يدخل من آخر السطر'],
];

/** الحالة التي تبدأ منها كل حركة. تنتهي كلها عند الوضع الطبيعي. */
const ANIM_FROM: Record<string, string> = {
  fade: 'opacity:0',
  up: 'opacity:0;transform:translateY(30px)',
  zoom: 'opacity:0;transform:scale(.94)',
  /* منطقيّة في الاتجاهين: في العربية «أول السطر» يمين، وفي الإنجليزية يسار */
  start: 'opacity:0;transform:translateX(calc(44px * -1))',
  end: 'opacity:0;transform:translateX(44px)',
};

/** تصميم القسم بعد الفحص. فارغ إن لم يُغيَّر شيء. */
export function cleanDesign(v: any): Design {
  return drop({
    bg: color(v?.bg), title: color(v?.title), text: color(v?.text), accent: color(v?.accent),
    font: font(v?.font),
    titleSize: num(v?.titleSize, 14, 96), textSize: num(v?.textSize, 11, 32),
    titleWeight: num(v?.titleWeight, 300, 900),
    align: ['right', 'center', 'left'].includes(v?.align) ? v.align : undefined,
    padTop: num(v?.padTop, 0, 240), padBottom: num(v?.padBottom, 0, 240),
    imgHeight: num(v?.imgHeight, 80, 900), imgZoom: num(v?.imgZoom, 50, 250),
    imgPos: IMG_POS.some(([k]) => k && k === v?.imgPos) ? v.imgPos : undefined,
    imgRadius: num(v?.imgRadius, 0, 60),
    imgShare: num(v?.imgShare, 25, 80),
    anim: ANIMS.some(([k]) => k && k === v?.anim) ? v.anim : undefined,
    hideMobile: v?.hideMobile === true || undefined, hideDesktop: v?.hideDesktop === true || undefined,
    imgFx: cleanFx(v?.imgFx),
  });
}

/** مسار صورة يصلح لمحدِّد CSS: حروف المسارات وحدها، بلا علامات تنصيص. */
const IMG_PATH = /^[\w\-./]{3,200}$/;

function cleanFx(v: any): Record<string, ImgFx> | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const out: Record<string, ImgFx> = {};
  for (const [p, fx] of Object.entries(v as Record<string, any>).slice(0, 60)) {
    if (!IMG_PATH.test(p) || !fx || typeof fx !== 'object') continue;
    const z = num(fx.z, 50, 300), x = num(fx.x, 0, 100), y = num(fx.y, 0, 100);
    const f: ImgFx = drop({ z: z === 100 ? undefined : z, x: x === 50 ? undefined : x, y: y === 50 ? undefined : y });
    if (Object.keys(f).length) out[p] = f;
  }
  return Object.keys(out).length ? out : undefined;
}

export const hasDesign = (v: any) => Object.keys(cleanDesign(v)).length > 0;

/**
 * قواعد تصميم قسم واحد. تُوضع في <style data-sd="…"> قبل القسم مباشرةً (أو قبل
 * علامة المحرّر التي تسبقه)، فتصيبه وحده بمحدِّد «العنصر التالي».
 */
export function designCss(id: string | number, raw: any, tools = false, preview = false): string {
  const d = cleanDesign(raw);
  if (!Object.keys(d).length) return '';
  const sid = String(id).replace(/[^\w-]/g, '');
  const k = `style[data-sd="${sid}"]`;
  /* للزائر: القسم يلي القواعد مباشرةً. لصاحب الموقع وفي المحرّر تسبقه علامة أو
     شريط تحرير، فيُتخطّيان — ولا تُذكر أسماؤهما في صفحة الزائر. */
  const S = tools ? `:is(${k}+:is(.ux-mark,.ux-edittools)+*,${k}+:not(.ux-mark):not(.ux-edittools))` : `${k}+*`;
  const r: string[] = [];
  const self: string[] = [];
  if (d.bg) self.push(`background:${d.bg}!important`);
  if (d.accent) self.push(...brandVars(d.accent));
  if (d.title) self.push(`--ink:${d.title}`);
  if (d.text) self.push(`--body:${d.text}`, `--muted:${d.text}`);
  if (d.padTop != null) self.push(`padding-top:${d.padTop}px!important`);
  if (d.padBottom != null) self.push(`padding-bottom:${d.padBottom}px!important`);
  if (self.length) r.push(`${S}{${self.join(';')}}`);

  const head: string[] = [];
  if (d.title) head.push(`color:${d.title}!important`);
  if (d.font) head.push(`font-family:${stack(d.font)}!important`);
  if (d.titleSize) head.push(`font-size:${d.titleSize}px!important`, 'line-height:1.25!important');
  if (d.titleWeight) head.push(`font-weight:${d.titleWeight}!important`);
  if (head.length) r.push(`${S} :is(h1,h2){${head.join(';')}}`);
  if (d.title || d.font) r.push(`${S} :is(h3,h4){${[d.title && `color:${d.title}!important`, d.font && `font-family:${stack(d.font)}!important`].filter(Boolean).join(';')}}`);

  const body: string[] = [];
  if (d.text) body.push(`color:${d.text}!important`);
  if (d.textSize) body.push(`font-size:${d.textSize}px!important`);
  if (body.length) r.push(`${S} :is(p,li,dd,dt,blockquote,figcaption):not(.btn *){${body.join(';')}}`);

  if (d.align) r.push(`${S} :is(h1,h2,h3,h4,p,li,dd,dt,blockquote){text-align:${d.align}!important}`);

  /* الصور: لا شعارات الماركات */
  const IMG = `${S} img:not([src*="/brands/"]):not([class*="logo"])`;
  const img: string[] = [];
  if (d.imgHeight) img.push(`height:${d.imgHeight}px!important`, 'max-height:none!important', 'object-fit:cover!important');
  if (d.imgPos) img.push(`object-position:${d.imgPos}!important`);
  /* ux.css يلغي أيّ تكبير للصور (scale:1 !important) كي لا تُقصّ — هنا مطلوب صراحةً */
  if (d.imgZoom && d.imgZoom !== 100) img.push(`scale:${d.imgZoom / 100}!important`);
  if (d.imgRadius != null) img.push(`border-radius:${d.imgRadius}px!important`);
  if (img.length) r.push(`${IMG}{${img.join(';')}}`);
  /* الصورة بإطارها أعرض أو أضيق: نصيبها من صفّ الصورة والنص. في الصفّ المعكوس
     تأتي الصورة ثانيةً. على الهاتف الصفّ عمود واحد أصلًا، فلا يُمسّ. */
  if (d.imgShare) {
    const a = `minmax(0,${d.imgShare}fr) minmax(0,${100 - d.imgShare}fr)`;
    const b = `minmax(0,${100 - d.imgShare}fr) minmax(0,${d.imgShare}fr)`;
    /* كلٌّ عند الحدّ الذي يصير عنده عمودين في ملفات الموقع (story.css 960، home.css 1080) */
    r.push(`@media (min-width:961px){${S}:not(.story--flip) .story__row{grid-template-columns:${a}!important}`
      + `${S}.story--flip .story__row{grid-template-columns:${b}!important}}`);
    r.push(`@media (min-width:1081px){${S} .prow:not(.prow--flip){grid-template-columns:${a}!important}`
      + `${S} .prow--flip{grid-template-columns:${b}!important}}`);
  }
  /* صورة بعينها: تكبيرها، ومركزه (الجزء الذي يبقى ظاهرًا حين تكبر) */
  for (const [p, fx] of Object.entries(d.imgFx ?? {})) {
    const z = fx.z ?? 100;
    const rules = [`transform-origin:${fx.x ?? 50}% ${fx.y ?? 50}%!important`];
    if (z !== 100) rules.push(`scale:${z / 100}!important`);
    r.push(`${S} img[src*="${p}"]{${rules.join(';')}}`);
  }
  /* التقريب يكبّر الصورة داخل إطارها، لا فوق ما حولها */
  if ((d.imgZoom && d.imgZoom !== 100) || d.imgFx) r.push(`${S} :is(figure,picture,[class*="fig"],[class*="media"]):has(>img,>picture){overflow:hidden!important}`);

  /* حركة الدخول — انظر ANIMS أعلاه. الاسم يحمل معرّف القسم فلا تتضارب قسمان
     في الصفحة الواحدة. */
  if (d.anim && ANIM_FROM[d.anim]) {
    const name = `sdin-${sid}`;
    r.push(`@keyframes ${name}{from{${ANIM_FROM[d.anim]}}to{opacity:1;transform:none}}`);
    if (preview) {
      /* المعاينة تلغي كل الحركات عمدًا كي لا ترفرف مع كل تعديل، وإطارها بطول
         الصفحة فلا يمرّر أصلًا — فالحركة المربوطة بالتمرير تنتهي قبل أن تُرى.
         هنا تُعرض مرة واحدة بمؤقّت ليرى من يختارها ما اختار. */
      r.push('@media (prefers-reduced-motion:no-preference){'
        + `${S}{animation:${name} .9s cubic-bezier(.16,1,.3,1) both !important}}`);
    } else {
      r.push('@media (prefers-reduced-motion:no-preference){'
        + '@supports (animation-timeline:view()){'
        + `${S}{animation:${name} 1s linear both;animation-timeline:view();`
        + 'animation-range:entry 0% cover 32%}}}');
    }
  }

  if (d.hideMobile) r.push(`@media (max-width:820px){${S}{display:none!important}}`);
  if (d.hideDesktop) r.push(`@media (min-width:821px){${S}{display:none!important}}`);
  return r.join('');
}
