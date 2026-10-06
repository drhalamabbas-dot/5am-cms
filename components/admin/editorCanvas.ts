/* =============================================================================
   أدوات المحرّر داخل الصفحة نفسها — على طريقة Elementor وShopify.
   الهدف: كل ما يُعدَّل في الصفحة يُعدَّل وأنت تراه، من الصفحة نفسها.

   ما يُركَّب على الصفحة المعروضة في الإطار:

   1. شريط فوق القسم الذي يمرّ عليه المؤشّر: اسمه، وأعلى، وأسفل، وتكرار،
      وإخفاء، وحذف — و«اختر المنتجات» لأقسام كروت المنتجات. وزرّ «أضف قسمًا
      هنا» على حدّه السفلي.

   2. الكتابة في الصفحة مباشرةً: كل نصّ ظاهر يطابق حقلًا في محتوى القسم يصير
      قابلًا للكتابة فيه. والحقول الفارغة تُرسم في المعاينة بنصّ مؤقت
      (lib/placeholders.ts) فيُكتب فيها كذلك.

   3. الصور: كل صورة يطابق مسارها حقل صورة تُغيَّر بالضغط عليها.

   4. عناصر القوائم (كروت، بنود، خطوات): شريط صغير على العنصر — تكرار،
      تقديم، تأخير، حذف.

   5. الروابط: زرّ أو كارت ينقل إلى صفحة يظهر عليه «الرابط» لتغيير وجهته.

   المطابقة كلها بالمحتوى نفسه (النصّ، مسار الصورة) — لا يحتاج أيّ مكوّن من
   مكوّنات الموقع أن يعرف بالمحرّر. وحذِرة: ما يتكرّر لا يُربط، فيُعدَّل من
   القائمة الجانبية بدل أن يُكتب في حقل غير المقصود.

   الأدوات كلها داخل Shadow DOM: لا يصلها CSS الموقع، ولا يصل CSSها إليه.
   وكل فعل يمرّ إلى المحرّر عبر api() — دالة تعيد أحدث نسخة من أفعاله، لأن
   المستمعات تُركَّب مرة مع كل تحميل للصفحة.
============================================================================= */
import type { Field } from '@/lib/sectionSchema';
import { holesOf } from '@/lib/placeholders';

/** قسم برقمه، أو «أعلى الصفحة»، أو الهيدر (مشترك بين الصفحات) */
export type Id = 'hero' | 'nav' | number;
export type ItemAct = 'dup' | 'up' | 'down' | 'del';

export type CanvasApi = {
  select: (id: Id) => void;
  move: (id: number, d: number) => void;
  toggle: (id: number) => void;
  remove: (id: number) => void;
  duplicate: (id: number) => void;
  insertAfter: (id: Id) => void;
  /** كتابة في نصّ داخل الصفحة. path مسار الحقل داخل المحتوى، مثل title.ar */
  inline: (id: Id, path: string, value: string) => void;
  inlineEnd: () => void;
  /** تغيير صورة: يفتح المكتبة، ويضع المختار في path */
  pickImage: (id: Id, path: string) => void;
  /** عنصر في قائمة: field اسم القائمة، index موضعه */
  itemAct: (id: number, field: string, index: number, act: ItemAct) => void;
  /** وجهة رابط: path مسار href داخل المحتوى */
  editLink: (id: Id, path: string) => void;
  pickProducts: (id: number) => void;
  /** معرّف المنتج المحفوظ في ids من مساره في الرابط (model.html?p=…) */
  productRef: (slug: string) => string | null;
  /** يفتح محرّر المنتج: نصوص الكارت وصورته من المنتج نفسه لا من الصفحة */
  editProduct: (slug: string) => void;
  /** يفتح تبويب «التصميم» للقسم */
  openDesign: (id: Id) => void;
  /** تنسيق نصّ من الصفحة: لون العناوين أو النص في القسم، وحجمه، وسُمكه. null يعيده كما كان */
  styleText: (id: Id, role: 'title' | 'text', s: { color?: string; size?: number; weight?: number } | null) => void;
  /** تصميم القسم الآن، وتعديله جزئيًا (قيمة، أو دالة من أحدث قيمة، أو undefined للإلغاء) */
  designOf: (id: Id) => any;
  patchDesign: (id: Id, patch: Record<string, any>) => void;
  /** يفتح المكتبة لاختيار عدّة صور تُضاف إلى قائمة صور في القسم (معرض) */
  addImages: (id: Id, field: string) => void;
  contentOf: (id: Id) => any;
  fieldsOf: (id: Id) => Field[];
  typeOf: (id: Id) => string;
  labelOf: (id: Id) => string;
  posOf: (id: number) => { index: number; count: number; hidden: boolean };
  lang: 'ar' | 'en';
};

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const isAsset = (s: string) => /^\/?(assets|media)\/.+\.(jpe?g|png|webp|gif|svg)$/i.test(s);
/** مسار الصورة كما يُخزَّن، من src كما رُسم (‎/assets/x.jpg?v=…‎ ← assets/x.jpg) */
const srcPath = (src: string) => decodeURIComponent(src.replace(/^https?:\/\/[^/]+/, '').replace(/[?#].*$/, '').replace(/^\//, ''));

/** مفاتيح لا تُعرض نصًّا: مسارات وصور ومعرّفات. */
const SKIP_KEY = /^(href|img|image|src|poster|icon|id|ids|type|brand|brandId|product|alsoId|anchor|group|tone|yt|logo|before|after|imgs|images|related|refs|style|idx)$/;

/** كل نصّ في المحتوى مع مساره. النصّ بلغتيه يُؤخذ منه لغة المعاينة وحدها. */
function textLeaves(content: any, lang: 'ar' | 'en'): { path: string; value: string }[] {
  const out: { path: string; value: string }[] = [];
  const walk = (v: any, path: string) => {
    if (v == null) return;
    if (typeof v === 'string') {
      if (v.trim() && !/^(assets\/|media\/|https?:|\/)/.test(v)) out.push({ path, value: v });
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, path ? `${path}.${i}` : String(i))); return; }
    if (typeof v === 'object') {
      if (typeof v.ar === 'string' || typeof v.en === 'string') {
        const s = v[lang];
        if (typeof s === 'string' && s.trim()) out.push({ path: `${path}.${lang}`, value: s });
        return;
      }
      for (const k of Object.keys(v)) {
        if (SKIP_KEY.test(k)) continue;
        walk(v[k], path ? `${path}.${k}` : k);
      }
    }
  };
  walk(content, '');
  return out;
}

/** كل مسار صورة في المحتوى مع موضعه. */
function imageLeaves(content: any): { path: string; value: string }[] {
  const out: { path: string; value: string }[] = [];
  const walk = (v: any, path: string) => {
    if (typeof v === 'string') {
      /* بعض المسارات المنقولة تحمل ?v=… — تُقارن بلاه، كما يُقرأ src */
      const bare = v.replace(/[?#].*$/, '').replace(/^\//, '');
      if (isAsset(bare)) out.push({ path, value: bare });
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, path ? `${path}.${i}` : String(i))); return; }
    if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], path ? `${path}.${k}` : k);
  };
  walk(content, '');
  return out;
}

const get = (obj: any, path: string) => path.split('.').reduce((n, k) => (n == null ? n : n[k]), obj);

const CSS = `
:host{all:initial}
*{box-sizing:border-box;font-family:'IBM Plex Sans Arabic',system-ui,sans-serif}
svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}
.t{position:absolute;left:0;top:0;pointer-events:auto;opacity:0;visibility:hidden;transition:opacity .12s,transform .12s,visibility 0s .12s;direction:rtl}
.t.on{opacity:1;visibility:visible;transition:opacity .12s,transform .12s}
.bar{display:flex;align-items:stretch;height:32px;border-radius:8px;overflow:hidden;
  background:#c2410c;color:#fff;box-shadow:0 4px 14px rgba(15,27,45,.28);transform:translateY(-4px)}
.bar.on{transform:none}
.bar .name{display:flex;align-items:center;gap:6px;padding:0 12px;font-size:12.5px;font-weight:700;
  max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#9a3412}
button{font:inherit}
.bar button{border:0;background:transparent;color:#fff;min-width:32px;display:flex;align-items:center;justify-content:center;gap:5px;cursor:pointer;padding:0 6px;font-size:12px;font-weight:700}
.bar button:hover{background:rgba(255,255,255,.18)}
.bar button:disabled{opacity:.35;cursor:default;background:transparent}
.bar button.del:hover{background:#b42318}
.bar .prod{background:#0f1b2d;padding:0 10px}
.bar .prod:hover{background:#1e2d45}
.add{display:flex;align-items:center;gap:6px;height:30px;padding:0 14px;border-radius:99px;
  border:2px solid #fff;background:#0f1b2d;color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;
  box-shadow:0 4px 14px rgba(15,27,45,.3);transform:scale(.9)}
.add.on{transform:none}
.add:hover{background:#c2410c}
.line{position:absolute;left:0;top:0;height:2px;background:#c2410c;pointer-events:none;opacity:0;transition:opacity .12s}
.line.on{opacity:.9}
.chip{display:flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:8px;border:0;
  background:rgba(15,27,45,.88);color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;
  box-shadow:0 2px 10px rgba(0,0,0,.3)}
.chip:hover{background:#c2410c}
.item{display:flex;height:28px;border-radius:7px;overflow:hidden;background:#0f1b2d;color:#fff;
  box-shadow:0 3px 10px rgba(15,27,45,.3)}
.item span{display:flex;align-items:center;padding:0 9px;font-size:11.5px;font-weight:700;background:#1e2d45;white-space:nowrap}
.item button{border:0;background:transparent;color:#fff;width:28px;display:grid;place-items:center;cursor:pointer;padding:0}
.item button:hover{background:rgba(255,255,255,.16)}
.item button:disabled{opacity:.3;cursor:default;background:transparent}
.item button.del:hover{background:#b42318}
.item svg{width:14px;height:14px}
.fmt{display:flex;align-items:stretch;height:32px;border-radius:8px;overflow:hidden;background:#0f1b2d;color:#fff;
  box-shadow:0 4px 14px rgba(15,27,45,.32)}
.fmt button{border:0;background:transparent;color:#fff;min-width:34px;padding:0 8px;cursor:pointer;font-size:12.5px;font-weight:800;
  display:grid;place-items:center}
.fmt button:hover{background:rgba(255,255,255,.16)}
.fmt .fmt__b{font-family:Georgia,serif;font-size:15px}
.fmt__color{position:relative;width:38px;display:grid;place-items:center;cursor:pointer;border-inline-end:1px solid rgba(255,255,255,.14)}
.fmt__color i{width:18px;height:18px;border-radius:5px;border:2px solid #fff;display:block}
.fmt__color input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.imgt{display:flex;align-items:stretch;gap:2px;border-radius:9px;overflow:hidden;background:rgba(15,27,45,.94);color:#fff;
  box-shadow:0 4px 16px rgba(0,0,0,.35);font-size:12px;max-width:calc(100vw - 16px);flex-wrap:wrap}
.imgt__g{display:flex;align-items:center;padding:3px 4px;gap:1px}
.imgt__g + .imgt__g{border-inline-start:1px solid rgba(255,255,255,.16)}
.imgt__g b{font-size:11px;font-weight:700;color:#cbd5e1;padding:0 6px;white-space:nowrap}
.imgt button{border:0;background:transparent;color:#fff;min-width:28px;height:28px;padding:0 7px;border-radius:6px;cursor:pointer;
  font-size:12.5px;font-weight:800;white-space:nowrap}
.imgt button:hover{background:#c2410c}
.imgt__gal{background:#c2410c!important;margin:3px;border-radius:6px!important}
.imgt__gal:hover{background:#9a3412!important}
.imgt__reset{border-inline-start:1px solid rgba(255,255,255,.16)!important;border-radius:0!important;padding:0 12px!important;font-size:15px!important}
`;

const I: Record<string, string> = {
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  dup: '<path d="M9 9h10v10H9zM5 15V5h10"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/>',
  del: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>',
  prev: '<path d="M9 6l6 6-6 6"/>',
  next: '<path d="M15 6l-6 6 6 6"/>',
  palette: '<path d="M12 21a9 9 0 1 1 9-9c0 2.5-2 3.5-4 3.5h-1.5a1.5 1.5 0 0 0-1 2.6c.6.6.3 2.9-2.5 2.9z"/><path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01M16.5 11h.01"/>',
};
const svg = (k: string) => `<svg viewBox="0 0 24 24">${I[k]}</svg>`;
const CSS_ESC = (s: string) => s.replace(/["\\]/g, '\\$&');

/** آخر نصّ ظهر عليه شريط التنسيق — يبقى بين تحميلات المعاينة (الوحدة نفسها في
 *  نافذة المحرّر، والإطار يُعاد تحميله). */
let lastFmt: { sec: string; path: string } | null = null;
/** وآخر صورة ظهر عليها شريط الحجم، للسبب نفسه */
let lastImg: { sec: string; path: string } | null = null;

function sectionOfEl(doc: Document, el: Element | null) {
  for (let n = el; n && n !== doc.body; n = n.parentElement) {
    const p = n.previousElementSibling as HTMLElement | null;
    if (p?.classList.contains('ux-mark')) {
      const raw = p.dataset.sec!;
      return { id: idOf(raw), el: n as HTMLElement };
    }
  }
  return null;
}
const idOf = (raw: string): Id => (raw === 'hero' || raw === 'nav' ? raw : Number(raw));

/**
 * يُركَّب فور تحميل الصفحة، قبل أي شيء: الضغط يختار القسم، ولا تُفتح روابط
 * ولا تُرسل نماذج داخل المحرّر. لا يغيّر في الصفحة شيئًا، فلا يربك React.
 */
export function guardCanvas(doc: Document, api: () => CanvasApi) {
  doc.addEventListener('click', (e) => {
    if (e.composedPath().some((n) => (n as HTMLElement).id === 'ux-ed-host')) return;   // أزرار المحرّر نفسه
    const target = e.target as HTMLElement;
    /* أزرار الصفحة التي لا تنقل (تبويبات السلايدر وأسهمه، فتح القوائم) تعمل
       كما هي، كي يُوصل إلى كل صورة في السلايدر وكل عنصر في القوائم. الروابط
       والإرسال وحدهما يُمنعان. */
    const btn = target?.closest?.('button') as HTMLButtonElement | null;
    if (btn && !btn.closest('a') && btn.type !== 'submit' && !target.closest('[data-ux-path]')) {
      const s = sectionOfEl(doc, target);
      if (s) api().select(s.id);
      return;
    }
    e.preventDefault(); e.stopPropagation();
    /* صورة مربوطة بحقل: الضغط عليها يغيّرها */
    const img = (e.target as HTMLElement)?.closest?.('[data-ux-img]') as HTMLElement | null;
    if (img && !(e.target as HTMLElement).closest('[data-ux-path]')) {
      api().pickImage(idOf(img.dataset.uxSec!), img.dataset.uxImg!);
    }
    const s = sectionOfEl(doc, e.target as Element);
    if (s) api().select(s.id);
  }, true);
  doc.addEventListener('submit', (e) => e.preventDefault(), true);
}

/** يركّب الأدوات على الصفحة. يُستدعى بعد أن يُكمل React تجهيزها. */
export function installCanvas(doc: Document, api: () => CanvasApi) {
  const win = doc.defaultView!;
  if (doc.getElementById('ux-ed-host')) return;

  const host = doc.createElement('div');
  host.id = 'ux-ed-host';
  host.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483000;pointer-events:none';
  doc.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>
    <div class="line"></div>
    <div class="t bar" role="toolbar" aria-label="أدوات القسم">
      <span class="name">${svg('pen')}<b></b></span>
      <button data-act="prod" class="prod" title="اختر المنتجات المعروضة">${svg('box')}المنتجات</button>
      <button data-act="design" title="ألوان القسم وخطّه وصورته">${svg('palette')}</button>
      <button data-act="up" title="انقل القسم لأعلى">${svg('up')}</button>
      <button data-act="down" title="انقل القسم لأسفل">${svg('down')}</button>
      <button data-act="dup" title="كرّر القسم">${svg('dup')}</button>
      <button data-act="hide" title="أخفِه عن الزائر">${svg('eye')}</button>
      <button data-act="del" class="del" title="احذف القسم">${svg('del')}</button>
    </div>
    <button class="t add" type="button">${svg('plus')}أضف قسمًا هنا</button>
    <button class="t chip img" type="button">${svg('img')}غيّر الصورة</button>
    <button class="t chip link" type="button">${svg('link')}الرابط</button>
    <button class="t chip prod" type="button" title="اسم الكارت ووصفه وصورته من المنتج نفسه">${svg('pen')}عدّل المنتج</button>
    <div class="t fmt" role="toolbar" aria-label="تنسيق النص">
      <label class="fmt__color" title="لون هذا النوع من النص في القسم"><i></i><input type="color"></label>
      <button data-f="smaller" title="أصغر">A−</button>
      <button data-f="bigger" title="أكبر">A+</button>
      <button data-f="bold" class="fmt__b" title="أعرض / أخفّ">B</button>
      <button data-f="reset" title="رجوع إلى الأصل">↺</button>
      <button data-f="more" title="كل تصميم القسم">${svg('palette')}</button>
    </div>
    <div class="t imgt" role="toolbar" aria-label="حجم الصورة">
      <span class="imgt__g imgt__frame"><b>الإطار</b>
        <button data-i="narrow" class="imgt__w" title="الصورة بإطارها أضيق">أضيق</button>
        <button data-i="wide" class="imgt__w" title="الصورة بإطارها أعرض">أعرض</button>
        <button data-i="short" title="الإطار أقصر">أقصر</button>
        <button data-i="tall" title="الإطار أطول">أطول</button>
      </span>
      <span class="imgt__g"><b>داخل الإطار</b>
        <button data-i="out" title="تصغير الصورة داخل إطارها">−</button>
        <button data-i="in" title="تكبير الصورة داخل إطارها">+</button>
        <button data-i="left" title="أظهر الجزء الأيسر">←</button>
        <button data-i="right" title="أظهر الجزء الأيمن">→</button>
        <button data-i="up" title="أظهر الجزء العلوي">↑</button>
        <button data-i="down" title="أظهر الجزء السفلي">↓</button>
      </span>
      <button data-i="gallery" class="imgt__gal" title="صور إضافية تظهر صغيرة تحت هذه الصورة، كصفحة المنتج">+ صور للمعرض</button>
      <button data-i="reset" class="imgt__reset" title="الصورة وإطارها كما كانا">↺</button>
    </div>
    <div class="t item" role="toolbar" aria-label="أدوات العنصر">
      <span></span>
      <button data-act="up" title="قدّمه">${svg('prev')}</button>
      <button data-act="down" title="أخّره">${svg('next')}</button>
      <button data-act="dup" title="كرّره">${svg('dup')}</button>
      <button data-act="del" class="del" title="احذفه">${svg('del')}</button>
    </div>`;
  const $ = (s: string) => root.querySelector(s) as HTMLElement;
  const bar = $('.bar'), add = $('.add'), line = $('.line'), chipImg = $('.chip.img'), chipLink = $('.chip.link'), item = $('.item');
  const chipProd = $('.chip.prod');
  const name = bar.querySelector('b') as HTMLElement;

  const box = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { top: r.top + win.scrollY, left: r.left + win.scrollX, w: r.width, h: r.height };
  };
  const at = (t: HTMLElement, top: number, left: number) => { t.style.top = `${top}px`; t.style.left = `${left}px`; };
  const show = (t: HTMLElement, on: boolean) => t.classList.toggle('on', on);

  /* ---------------------------------------------------- شريط القسم */
  let current: { id: Id; el: HTMLElement } | null = null;
  function place(s: { id: Id; el: HTMLElement }) {
    current = s;
    const a = api();
    const b = box(s.el);
    name.textContent = a.labelOf(s.id);
    const isHero = typeof s.id !== 'number';   // أعلى الصفحة والهيدر: لا ترتيب ولا حذف
    for (const btn of bar.querySelectorAll('button')) (btn as HTMLElement).style.display = isHero ? 'none' : '';
    (bar.querySelector('[data-act=prod]') as HTMLElement).style.display = !isHero && a.typeOf(s.id) === 'products' ? '' : 'none';
    /* التصميم لكل قسم ولأعلى الصفحة — لا للهيدر المشترك بين الصفحات */
    (bar.querySelector('[data-act=design]') as HTMLElement).style.display = s.id === 'nav' ? 'none' : '';
    if (!isHero) {
      const p = a.posOf(s.id as number);
      (bar.querySelector('[data-act=up]') as HTMLButtonElement).disabled = p.index === 0;
      (bar.querySelector('[data-act=down]') as HTMLButtonElement).disabled = p.index >= p.count - 1;
      const hide = bar.querySelector('[data-act=hide]') as HTMLElement;
      hide.innerHTML = svg(p.hidden ? 'eyeOff' : 'eye');
      hide.title = p.hidden ? 'أظهره للزائر' : 'أخفِه عن الزائر';
    }
    show(bar, true);
    /* الشريط على جهة البداية (اليمين في العربية) أعلى القسم، داخل حدوده */
    at(bar, Math.max(b.top + 8, win.scrollY + 8), Math.max(b.left + 8, b.left + b.w - bar.offsetWidth - 8));
    show(add, true);
    at(add, b.top + b.h - 15, b.left + b.w / 2 - add.offsetWidth / 2);
    line.style.top = `${b.top + b.h - 1}px`; line.style.left = `${b.left}px`; line.style.width = `${b.w}px`;
  }

  bar.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest('button') as HTMLButtonElement | null;
    if (btn?.dataset.act === 'design' && current && current.id !== 'nav') { api().openDesign(current.id); return; }
    if (!btn || !current || typeof current.id !== 'number' || btn.disabled) return;
    const a = api();
    const id = current.id as number;
    ({
      up: () => a.move(id, -1), down: () => a.move(id, 1), dup: () => a.duplicate(id),
      hide: () => a.toggle(id), del: () => a.remove(id), prod: () => a.pickProducts(id),
      design: () => a.openDesign(id),
    } as Record<string, () => void>)[btn.dataset.act!]?.();
  });
  add.addEventListener('click', () => { if (current) api().insertAfter(current.id); });
  add.addEventListener('mouseenter', () => line.classList.add('on'));
  add.addEventListener('mouseleave', () => line.classList.remove('on'));

  /* ------------------------------------------------- الصورة والرابط والعنصر */
  let imgTarget: HTMLElement | null = null;
  let linkTarget: { id: Id; path: string } | null = null;
  let itemTarget: { id: number; field: string; index: number; el: HTMLElement } | null = null;

  chipImg.addEventListener('click', () => {
    if (imgTarget) api().pickImage(idOf(imgTarget.dataset.uxSec!), imgTarget.dataset.uxImg!);
  });
  chipLink.addEventListener('click', () => { if (linkTarget) api().editLink(linkTarget.id, linkTarget.path); });
  let prodTarget: string | null = null;
  chipProd.addEventListener('click', () => { if (prodTarget) api().editProduct(prodTarget); });
  item.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest('button') as HTMLButtonElement | null;
    if (!btn || !itemTarget || btn.disabled) return;
    api().itemAct(itemTarget.id, itemTarget.field, itemTarget.index, btn.dataset.act as ItemAct);
  });
  for (const t of [bar, chipImg, chipLink, chipProd, item]) t.addEventListener('mousedown', (e) => e.preventDefault());   // لا تسرق المؤشّر من نصّ يُكتب فيه

  const inTools = (e: Event) => e.composedPath().includes(host);

  doc.addEventListener('mouseover', (e) => {
    if (inTools(e)) return;
    const target = e.target as HTMLElement;
    const s = sectionOfEl(doc, target);
    doc.querySelectorAll('.ux-hov').forEach((n) => { if (n !== s?.el) n.classList.remove('ux-hov'); });
    if (!s) return;
    s.el.classList.add('ux-hov');
    if (current?.el !== s.el) place(s);

    /* صورة: زرّ «غيّر الصورة» في ركنها */
    const img = target.closest?.('[data-ux-img]') as HTMLElement | null;
    imgTarget = img;
    show(chipImg, Boolean(img));
    if (img) { const b = box(img); at(chipImg, b.top + 10, b.left + 10); }

    /* رابط: زرّ «الرابط» تحت العنصر الذي ينقل */
    const ln = target.closest?.('[data-ux-href]') as HTMLElement | null;
    linkTarget = ln ? { id: idOf(ln.dataset.uxSec!), path: ln.dataset.uxHref! } : null;
    show(chipLink, Boolean(ln));
    if (ln) { const b = box(ln); at(chipLink, b.top + b.h + 6, b.left + b.w - chipLink.offsetWidth); }

    /* كارت منتج: «عدّل المنتج» في ركنه الآخر */
    const pc = target.closest?.('[data-ux-product]') as HTMLElement | null;
    prodTarget = pc?.dataset.uxProduct ?? null;
    show(chipProd, Boolean(pc));
    if (pc) { const b = box(pc); at(chipProd, b.top + 8, b.left + b.w - chipProd.offsetWidth - 8); }

    /* عنصر في قائمة: شريطه الصغير في ركنه العلوي */
    const it = target.closest?.('[data-ux-item]') as HTMLElement | null;
    if (it && /^-?\d+$/.test(it.dataset.uxSec ?? '')) {
      const [field, idx] = it.dataset.uxItem!.split('.');
      const id = Number(it.dataset.uxSec);
      const index = Number(idx);
      const list = get(api().contentOf(id), field);
      const n = Array.isArray(list) ? list.length : 1;
      itemTarget = { id, field, index, el: it };
      (item.querySelector('span') as HTMLElement).textContent = `${index + 1} / ${n}`;
      (item.querySelector('[data-act=up]') as HTMLButtonElement).disabled = index === 0;
      (item.querySelector('[data-act=down]') as HTMLButtonElement).disabled = index >= n - 1;
      /* المنتج نفسه مرتين في القسم لا معنى له: لا تكرار لكارت منتج */
      (item.querySelector('[data-act=dup]') as HTMLElement).style.display = field === 'ids' ? 'none' : '';
      show(item, true);
      const b = box(it);
      at(item, b.top + 6, b.left + 6);
    } else {
      itemTarget = null;
      show(item, false);
    }
  });
  doc.documentElement.addEventListener('mouseleave', () => {
    doc.querySelectorAll('.ux-hov').forEach((n) => n.classList.remove('ux-hov'));
    current = null;
    for (const t of [bar, add, chipImg, chipLink, chipProd, item, line, $('.imgt')]) show(t, false);
  });

  /* ------------------------------------------ الكتابة في الصفحة مباشرةً */
  bind(doc, api);

  doc.addEventListener('input', (e) => {
    const el = e.target as HTMLElement;
    const path = el?.dataset?.uxPath;
    if (!path) return;
    el.classList.remove('ux-ph');
    api().inline(idOf(el.dataset.uxSec!), path, el.innerText.replace(/\n+$/, ''));
    if (current) place(current);           // ارتفاع القسم قد تغيّر
  });
  /* النصّ المؤقت يُحدَّد كله عند الضغط، فأول حرف يُكتب يحلّ محلّه */
  doc.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement;
    if (!el?.classList?.contains('ux-ph')) return;
    const r = doc.createRange(); r.selectNodeContents(el);
    const sel = win.getSelection(); sel?.removeAllRanges(); sel?.addRange(r);
  });
  /* ------------------------------------------- تنسيق النصّ من الصفحة
     عند الكتابة في نصّ يظهر فوقه شريط صغير: لونه، وأصغر/أكبر، وأعرض (للعناوين)،
     وكل تصميم القسم. التنسيق لنوع النصّ في القسم كله (عناوينه أو فقراته) — فتبقى
     عناوين القسم الواحد متّسقة — ويُحفظ في تصميم القسم (lib/design.ts). */
  const fmt = $('.fmt');
  const fmtColor = fmt.querySelector('input') as HTMLInputElement;
  const fmtSw = fmt.querySelector('i') as HTMLElement;
  let fmtTarget: { id: Id; role: 'title' | 'text'; el: HTMLElement; sized: boolean } | null = null;
  const TITLE = 'h1,h2,h3,h4', TEXT = 'p,li,dd,dt,blockquote,figcaption';
  const hexOf = (c: string) => {
    const m = c.match(/\d+(\.\d+)?/g);
    return m ? '#' + m.slice(0, 3).map((x) => Math.round(Number(x)).toString(16).padStart(2, '0')).join('') : '#000000';
  };
  function showFmt(el: HTMLElement) {
    const id = idOf(el.dataset.uxSec ?? '');
    const title = el.closest(TITLE), text = el.closest(TEXT);
    if (id === 'nav' || (!title && !text)) { show(fmt, false); fmtTarget = null; return; }
    fmtTarget = { id, role: title ? 'title' : 'text', el, sized: title ? Boolean(el.closest('h1,h2')) : true };
    lastFmt = { sec: el.dataset.uxSec!, path: el.dataset.uxPath! };
    const cs = win.getComputedStyle(el);
    fmtColor.value = hexOf(cs.color);
    fmtSw.style.background = cs.color;
    for (const b of fmt.querySelectorAll<HTMLElement>('[data-f=smaller],[data-f=bigger]')) b.style.display = fmtTarget.sized ? '' : 'none';
    (fmt.querySelector('[data-f=bold]') as HTMLElement).style.display = fmtTarget.role === 'title' && fmtTarget.sized ? '' : 'none';
    show(fmt, true);
    const b = box(el);
    at(fmt, Math.max(win.scrollY + 4, b.top - 40), Math.max(4, b.left + b.w - fmt.offsetWidth));
  }
  doc.addEventListener('focusin', (e) => {
    const el = (e.target as HTMLElement)?.closest?.('[data-ux-path]') as HTMLElement | null;
    if (el) showFmt(el);
  });
  doc.addEventListener('mousedown', (e) => {
    if (inTools(e) || (e.target as HTMLElement)?.closest?.('[data-ux-path]')) return;
    show(fmt, false); fmtTarget = null; lastFmt = null;
  });
  /* الأزرار لا تأخذ المؤشّر من النصّ؛ اختيار اللون وحده يحتاجه */
  fmt.addEventListener('mousedown', (e) => { if (!(e.target as HTMLElement).closest('label')) e.preventDefault(); });
  /* change لا input: المعاينة تُعاد رسمها بعد كل تغيير، فيُطبَّق اللون حين يُختار */
  fmtColor.addEventListener('change', () => {
    if (!fmtTarget) return;
    fmtSw.style.background = fmtColor.value;
    api().styleText(fmtTarget.id, fmtTarget.role, { color: fmtColor.value.toUpperCase() });
  });
  fmt.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest('button') as HTMLButtonElement | null;
    if (!btn || !fmtTarget) return;
    const t = fmtTarget;
    const el = (t.role === 'title' ? t.el.closest('h1,h2') : t.el.closest(TEXT)) as HTMLElement | null ?? t.el;
    const cs = win.getComputedStyle(el);
    const px = parseFloat(cs.fontSize) || 16;
    const f = btn.dataset.f;
    if (f === 'smaller' || f === 'bigger') api().styleText(t.id, t.role, { size: Math.round(px + (f === 'bigger' ? 2 : -2)) });
    if (f === 'bold') api().styleText(t.id, t.role, { weight: Number(cs.fontWeight) >= 700 ? 400 : 900 });
    if (f === 'reset') api().styleText(t.id, t.role, null);
    if (f === 'more') api().openDesign(t.id);
  });
  /* ------------------------------------------- الصورة: إطارها وما بداخله
     على كل صورة في قسم: الإطار أعرض/أضيق (نصيب الصورة من صفّ «صورة ونص») وأطول/
     أقصر، والصورة داخل الإطار أكبر/أصغر والجزء الظاهر منها، و↺ يعيد الكل. يُحفظ في
     تصميم القسم (lib/design.ts: imgShare وimgHeight، وimgFx لكل صورة). */
  const imgt = $('.imgt');
  let imgTarget2: { id: Id; path: string; img: HTMLImageElement; frame: HTMLElement; row: HTMLElement | null } | null = null;
  const ROW = '.story__row,.prow';
  function showImgt(img: HTMLImageElement) {
    const s = sectionOfEl(doc, img);
    if (!s || s.id === 'nav') return;
    if (/\/brands\/|logo/i.test(img.getAttribute('src') ?? '') || /logo/i.test(img.className)) return;
    if (img.closest('.ux-thumbnails')) return;     // المصغّرات تحت المعرض: الشريط للصورة الكبيرة
    const path = srcPath(img.getAttribute('src') ?? img.getAttribute('data-src') ?? '');
    if (!path) return;
    /* الإطار: أقرب وعاء للصورة؛ وصفّ «صورة ونص» إن كانت الصورة (أو معرضها) أحد عموديه */
    const frame = (img.closest('figure,[class*="media"],[class*="fig"]') as HTMLElement | null) ?? img;
    const cell = frame.parentElement?.matches('.story__gal') ? frame.parentElement : frame;
    const row = cell.parentElement?.matches(ROW) ? cell.parentElement : null;
    imgTarget2 = { id: s.id, path, img, frame, row };
    lastImg = { sec: String(s.id), path };
    for (const b of imgt.querySelectorAll<HTMLElement>('.imgt__w')) b.style.display = row ? '' : 'none';
    /* «صور للمعرض» في الأقسام التي لها حقل صور معرض */
    const galField = typeof s.id === 'number' ? api().fieldsOf(s.id).find((f) => f.kind === 'images')?.name : undefined;
    (imgt.querySelector('.imgt__gal') as HTMLElement).style.display = galField ? '' : 'none';
    (imgt.querySelector('.imgt__gal') as HTMLElement).dataset.field = galField ?? '';
    show(imgt, true);
    const b = box(frame);
    at(imgt, b.top + Math.max(8, b.h - imgt.offsetHeight - 10), Math.max(4, b.left + (b.w - imgt.offsetWidth) / 2));
  }
  doc.addEventListener('mouseover', (e) => {
    if (inTools(e)) return;
    const t = e.target as HTMLElement;
    const img = (t.tagName === 'IMG' ? t : t.closest?.('picture,figure,[class*="media"]')?.querySelector('img')) as HTMLImageElement | null;
    if (img && sectionOfEl(doc, img)) { if (imgTarget2?.img !== img) showImgt(img); }
    else if (imgTarget2 && !imgTarget2.frame.contains(t)) { show(imgt, false); imgTarget2 = null; }
  });
  imgt.addEventListener('mousedown', (e) => e.preventDefault());
  imgt.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest('button') as HTMLButtonElement | null;
    const t = imgTarget2;
    if (!btn || !t) return;
    const a = api();
    const k = btn.dataset.i;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));
    if (k === 'narrow' || k === 'wide') {
      /* النصيب الحالي من عرض الصفّ (بلا الفراغ بين العمودين) */
      const gap = parseFloat(win.getComputedStyle(t.row!).columnGap) || 0;
      const now = (t.frame.getBoundingClientRect().width / (t.row!.getBoundingClientRect().width - gap)) * 100;
      a.patchDesign(t.id, { imgShare: (cur?: number) => clamp((cur ?? now) + (k === 'wide' ? 5 : -5), 25, 80) });
    }
    if (k === 'short' || k === 'tall') {
      /* صورة لم تُحمَّل بعد ارتفاعها صفر: يُؤخذ الإطار، أو ثلثا عرضه */
      const fr = t.frame.getBoundingClientRect();
      const now = t.img.getBoundingClientRect().height || fr.height || fr.width * (2 / 3) || 360;
      a.patchDesign(t.id, { imgHeight: (cur?: number) => clamp((cur ?? now) + (k === 'tall' ? 40 : -40), 80, 900) });
    }
    const fx = (f: (cur: { z?: number; x?: number; y?: number }) => { z?: number; x?: number; y?: number }) =>
      a.patchDesign(t.id, { imgFx: (all?: Record<string, any>) => ({ ...(all ?? {}), [t.path]: f(all?.[t.path] ?? {}) }) });
    if (k === 'in' || k === 'out') fx((c) => ({ ...c, z: clamp((c.z ?? 100) + (k === 'in' ? 10 : -10), 50, 300) }));
    /* المركز يتحرّك نحو الجهة المطلوبة فيظهر جزؤها؛ يبدأ التكبير إن لم يكن، فلا تحريك بلا تكبير */
    const nudge = (dx: number, dy: number) => fx((c) => ({
      z: Math.max(c.z ?? 100, 120), x: clamp((c.x ?? 50) + dx, 0, 100), y: clamp((c.y ?? 50) + dy, 0, 100),
    }));
    if (k === 'left') nudge(-15, 0);
    if (k === 'right') nudge(15, 0);
    if (k === 'up') nudge(0, -15);
    if (k === 'down') nudge(0, 15);
    if (k === 'gallery' && btn.dataset.field) { a.addImages(t.id, btn.dataset.field); return; }
    if (k === 'reset') {
      a.patchDesign(t.id, {
        imgFx: (all?: Record<string, any>) => { const o = { ...(all ?? {}) }; delete o[t.path]; return Object.keys(o).length ? o : undefined; },
        imgShare: undefined, imgHeight: undefined,
      });
    }
  });
  if (lastImg) {
    const again = [...doc.querySelectorAll<HTMLImageElement>('img')]
      .find((im) => srcPath(im.getAttribute('src') ?? im.getAttribute('data-src') ?? '') === lastImg!.path && String(sectionOfEl(doc, im)?.id) === lastImg!.sec);
    if (again) showImgt(again); else lastImg = null;
  }

  /* بعد إعادة رسم المعاينة يعود الشريط إلى النصّ نفسه، فيُضغط «أكبر» مرات متتالية */
  if (lastFmt) {
    const again = doc.querySelector<HTMLElement>(`[data-ux-sec="${CSS_ESC(lastFmt.sec)}"][data-ux-path="${CSS_ESC(lastFmt.path)}"]`);
    if (again) showFmt(again); else lastFmt = null;
  }

  doc.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement;
    if (!el?.dataset?.uxPath) return;
    /* Enter ينهي الكتابة — النصوص هنا سطر أو فقرة، لا مستند */
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') el.blur();
  });
  doc.addEventListener('focusout', (e) => {
    if ((e.target as HTMLElement)?.dataset?.uxPath) api().inlineEnd();
  });
  /* انتقال المؤشّر إلى القائمة الجانبية لا يُطلق focusout داخل الإطار */
  win.addEventListener('blur', () => {
    if ((doc.activeElement as HTMLElement | null)?.dataset?.uxPath) api().inlineEnd();
  });
  doc.addEventListener('paste', (e) => {
    const el = e.target as HTMLElement;
    if (!el?.closest?.('[data-ux-path]')) return;
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    doc.execCommand('insertText', false, text.replace(/\s*\n\s*/g, ' '));
  });
}

/** يربط ما في الصفحة بحقول المحتوى: النصوص، والنصوص المؤقتة، والصور، والعناصر، والروابط. */
function bind(doc: Document, api: () => CanvasApi) {
  const a = api();
  /* المتصفح الذي لا يعرف plaintext-only يقبل لصق تنسيق وسحب عناصر داخل
     النصّ. بدل أن يظهر ما لن يُحفظ، تبقى الكتابة فيه من القائمة الجانبية. */
  const plain = (() => {
    const t = doc.createElement('div');
    t.contentEditable = 'plaintext-only';
    return t.contentEditable === 'plaintext-only';
  })();

  const count = (xs: string[]) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>());

  for (const mark of doc.querySelectorAll<HTMLElement>('.ux-mark')) {
    const id = idOf(mark.dataset.sec!);
    const el = mark.nextElementSibling as HTMLElement | null;
    if (!el) continue;
    const content = a.contentOf(id) ?? {};
    const sec = String(id);

    /* ------------------------------------------------------ النصوص
       الربط حذِر: نصّ يتكرّر — في المحتوى أو في عناصر القسم — لا يُربط. لا
       يُعرف يقينًا أيّ العنصرين هو أيّ الحقلين، وقد يكون أحدهما نصًّا ثابتًا من
       التصميم. ربطٌ خاطئ يكتب في حقل غير الذي يراه صاحب الموقع. */
    if (plain) {
      const holes = holesOf(a.fieldsOf(id), content, a.lang);
      const want = [...textLeaves(content, a.lang), ...holes.map((h) => ({ path: h.path, value: h.text, hole: true }))];
      /* الظاهر وحده: منيو الهاتف مخفي على الحاسب (والعكس) وفيه النصوص نفسها،
         فلو عُدّ لصار كل اسم في المنيو «متكرّرًا» ولم يُربط شيء. */
      const candidates = [...el.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,p,span,b,strong,em,li,a,small,dt,dd,figcaption,label,blockquote,div,button')]
        .filter((n) => !n.classList.contains('ux-mark')
          && [...n.children].every((c) => c.tagName === 'BR')
          && norm(n.textContent ?? '') !== ''
          && n.getClientRects().length > 0);
      const inContent = count(want.map((l) => norm(l.value)));
      const inPage = count(candidates.map((n) => norm(n.textContent ?? '')));
      /* الاستثناء الوحيد للتكرار: الحقل نفسه في عناصر قائمة واحدة (كارت مكرَّر
         لم يُعدَّل بعد). عددها في المحتوى = عددها في الصفحة، ومساراتها لا تختلف
         إلا برقم العنصر — فتُطابَق بالترتيب: الأول للأول. */
      const shape = (p: string) => p.replace(/^(\w+)\.\d+\./, '$1.#.');
      const pairs = new Map<string, HTMLElement>();
      for (const [v, k] of inContent) {
        if (k < 2 || inPage.get(v) !== k) continue;
        const leavesOfV = want.filter((l) => norm(l.value) === v);
        const one = new Set(leavesOfV.map((l) => shape(l.path)));
        if (one.size !== 1 || !/^\w+\.#\./.test([...one][0])) continue;
        const nodes = candidates.filter((n) => norm(n.textContent ?? '') === v);
        leavesOfV.sort((x, y) => Number(x.path.split('.')[1]) - Number(y.path.split('.')[1]))
          .forEach((l, i) => pairs.set(l.path, nodes[i]));
      }
      for (const leaf of want) {
        const v = norm(leaf.value);
        const paired = pairs.get(leaf.path);
        if (!paired && (inContent.get(v) !== 1 || inPage.get(v) !== 1)) continue;
        const hit = paired ?? candidates.find((n) => norm(n.textContent ?? '') === v);
        if (!hit) continue;
        hit.dataset.uxPath = leaf.path;
        hit.dataset.uxSec = sec;
        hit.contentEditable = 'plaintext-only';
        hit.spellcheck = false;
        hit.title = 'اكتب هنا مباشرةً';
        if ((leaf as any).hole) hit.classList.add('ux-ph');
      }
    }

    /* ------------------------------------------------------ الصور
       بالمسار نفسه: الصورة المرسومة src مسارها، أو <picture> فيه source webp
       وimg بمسار الأصل. مسار يتكرّر في القسم لا يُربط، للسبب نفسه. */
    const imgs = imageLeaves(content);
    const pathCount = count(imgs.map((x) => x.value));
    const drawn = [...el.querySelectorAll<HTMLImageElement>('img')];
    for (const leaf of imgs) {
      if (pathCount.get(leaf.value) !== 1) continue;
      /* صور السلايدر غير الظاهرة بعد تحمل مسارها في data-src حتى يصلها الدور */
      const hits = drawn.filter((im) => srcPath(im.getAttribute('src') ?? im.getAttribute('data-src') ?? '') === leaf.value);
      if (hits.length !== 1) continue;
      const target = (hits[0].closest('picture') as HTMLElement | null) ?? hits[0];
      target.dataset.uxImg = leaf.path;
      target.dataset.uxSec = sec;
    }

    /* ------------------------------------------------------ عناصر القوائم
       العنصر هو أعلى ما يحوي حقول موضعٍ واحد من القائمة دون غيره: لكارتٍ
       عنوانه وشرحه وصورته، فأعلى ما يحويها دون الكارت التالي هو الكارت. */
    if (typeof id === 'number') {
      const bound = [...el.querySelectorAll<HTMLElement>('[data-ux-path],[data-ux-img]')]
        .map((n) => ({ n, path: n.dataset.uxPath ?? n.dataset.uxImg! }))
        .map((x) => ({ ...x, m: /^(\w+)\.(\d+)(\.|$)/.exec(x.path) }))
        .filter((x) => x.m && Array.isArray(content[x.m[1]]) && content[x.m[1]].length);
      const done = new Set<string>();
      for (const { n, m } of bound) {
        const field = m![1], index = Number(m![2]);
        const key = `${field}.${index}`;
        if (done.has(key)) continue;
        done.add(key);
        let root: HTMLElement | null = n;
        if (content[field].length === 1) {
          /* عنصر وحيد: لا عنصر ثانٍ تُعرف به حدوده، فيُؤخذ أقرب وعاء على شكل
             عنصر في تصميم الموقع (كارت، بند، رابط). */
          /* اسم الصنف كاملًا لا جزءًا منه: pgcard عنصر، أما pgcard__body فجزء
             منه، وpgcards الشبكة التي تحوي العناصر. */
          const itemLike = (x: HTMLElement) => /^(LI|A|ARTICLE)$/.test(x.tagName)
            || [...x.classList].some((c) => /^[a-z]*(card|item|step|fact)$/.test(c));
          root = null;
          for (let x: HTMLElement | null = n; x && x !== el; x = x.parentElement) {
            if (itemLike(x)) { root = x; break; }
          }
        } else {
          while (root.parentElement && root.parentElement !== el) {
            const p: HTMLElement = root.parentElement;
            const others = [...p.querySelectorAll<HTMLElement>(`[data-ux-path^="${field}."],[data-ux-img^="${field}."]`)]
              .some((o) => !(o.dataset.uxPath ?? o.dataset.uxImg!).startsWith(`${key}.`) && (o.dataset.uxPath ?? o.dataset.uxImg) !== key);
            if (others) break;
            root = p;
          }
        }
        if (!root) continue;
        root.dataset.uxItem = key;
        root.dataset.uxSec = sec;
        /* عنصر يقبل رابطًا حسب وصف حقوله (كارت فيه «ينقل إلى»): زرّ «الرابط»
           يظهر عليه ولو لم يكن له رابط بعد، فيُضاف الرابط من الصفحة نفسها. */
        const spec = a.fieldsOf(id).find((f) => f.name === field);
        if (spec?.of?.some((x) => x.name === 'href') && !root.dataset.uxHref) {
          root.dataset.uxHref = `${key}.href`;
        }
      }
    }

    /* ------------------------------------------------------ الروابط
       نصّ مربوط داخل <a>، وفي المحتوى بجانبه href: الزرّ أو الكارت ينقل، ووجهته
       تُغيَّر من «الرابط». مسار الكائن = مسار النصّ بلا آخر جزأين (title.ar). */
    for (const t of el.querySelectorAll<HTMLElement>('[data-ux-path]')) {
      const a2 = t.closest('a') as HTMLElement | null;
      if (!a2 || !el.contains(a2) || a2.dataset.uxHref) continue;
      const parts = t.dataset.uxPath!.split('.');
      for (let cut = 2; cut <= parts.length - 1; cut++) {
        const objPath = parts.slice(0, parts.length - cut).join('.');
        const obj = objPath ? get(content, objPath) : content;
        if (obj && typeof obj === 'object' && 'href' in obj) {
          a2.dataset.uxHref = objPath ? `${objPath}.href` : 'href';
          a2.dataset.uxSec = sec;
          break;
        }
      }
    }

    /* كروت المنتجات: نصّها وصورتها من المنتج لا من القسم، فلا يُكتب فيها هنا.
       كل كارت يُعرف بمنتجه (رابطه model.html?p=…) وموضعه في ids: يُقدَّم ويُؤخَّر
       ويُحذف من القسم كعنصر، و«عدّل المنتج» يفتح محرّر المنتج نفسه. */
    if (typeof id === 'number' && a.typeOf(id) === 'products' && Array.isArray(content.ids)) {
      for (const card of el.querySelectorAll<HTMLElement>('a[href*="model.html?p="]')) {
        const slug = new URLSearchParams((card.getAttribute('href') ?? '').split('?')[1] ?? '').get('p');
        const ref = slug ? a.productRef(slug) : null;
        const index = ref ? content.ids.indexOf(ref) : -1;
        if (!slug || index < 0) continue;
        card.dataset.uxItem = `ids.${index}`;
        card.dataset.uxSec = sec;
        card.dataset.uxProduct = slug;
      }
    }

    /* كروت منتجات لم تُختر بعد: القسم عنوان وحده، ولا شيء يُضغط لاختيارها.
       زرّ في مكان الكروت يفتح نافذة الاختيار. */
    if (typeof id === 'number' && a.typeOf(id) === 'products'
        && !(Array.isArray(content.ids) && content.ids.length) && !el.querySelector('.ux-pickcards')) {
      const box = doc.createElement('div');
      box.className = 'ux-pickcards';
      box.setAttribute('style', 'max-width:1200px;margin:24px auto;padding:0 24px');
      const b = doc.createElement('button');
      b.type = 'button';
      b.textContent = a.lang === 'en' ? '+ Choose the products' : '+ اختر المنتجات اللي تظهر هنا';
      b.setAttribute('style', 'width:100%;padding:34px 16px;border:2px dashed #f26b1d;border-radius:14px;background:#fff7f1;color:#c2410c;font:inherit;font-weight:700;font-size:17px;cursor:pointer');
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); api().pickProducts(id); });
      box.append(b);
      (el.querySelector('.container, .wrap') ?? el).append(box);
    }

    /* زرّ «اعرض المعدة» في قسم مربوط بمنتج: نصّه من التصميم لا من المحتوى،
       فلا يُربط بالطريقة السابقة. وجهته تُغيَّر من «الرابط» كذلك — لمنتج آخر،
       أو لصفحة (فيصير زرًّا عاديًّا بالنصّ نفسه). */
    if (typeof content.product === 'string' && content.product) {
      const btns = [...el.querySelectorAll<HTMLElement>('a[href*="model.html?p="]')].filter((x) => !x.dataset.uxHref);
      if (btns.length === 1) {
        btns[0].dataset.uxHref = PRODUCT_LINK;
        btns[0].dataset.uxSec = sec;
      }
    }
  }
}

/** مسار خاص لزرّ «اعرض المعدة» — ليس حقلًا في المحتوى (انظر bind). */
export const PRODUCT_LINK = '__product';
