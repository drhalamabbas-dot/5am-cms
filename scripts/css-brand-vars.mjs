/* يحوّل ألوان الهوية المكتوبة صراحةً في ملفات CSS إلى متغيّراتها في base.css،
   كي يصل تغيير «اللون الأساسي» من لوحة التحكم إلى كل مكان. القيم الافتراضية
   للمتغيّرات هي الألوان نفسها، فلا يتغيّر شكل الموقع شيئًا قبل أي تعديل.

     #F26522 → var(--brand)            #C2410C → var(--brand-strong)
     #FB923C → var(--brand-on-dark)    #9A3412 → var(--brand-600)
     #FFF7ED → var(--brand-tint)       #FF8B4D → var(--brand-light)
     rgba(242,101,34,a) → color-mix(in srgb, var(--brand) a%, transparent)

   لا يُمسّ: تعريفات المتغيّرات نفسها، والبديل داخل var(--x, #لون)، وملف أدوات
   المحرّر edit.css (لا يراه الزائر). تشغيله مرة ثانية لا يغيّر شيئًا.

   node scripts/css-brand-vars.mjs */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(import.meta.dirname, '..', 'public', 'assets', 'css');
const NOT_FALLBACK = String.raw`(?<!var\(--[\w-]+,\s?)`;
const pct = (a) => `${+(a * 100).toFixed(2)}%`;
const mix = (v, a) => `color-mix(in srgb, var(${v}) ${pct(a)}, transparent)`;

/* [نمط، دالة تعطي البديل من المجموعات الملتقطة] — الشفاف قبل الصريح */
const RULES = [
  [/rgba\(\s*242\s*,\s*101\s*,\s*34\s*,\s*([.\d]+)\s*\)/gi, (a) => mix('--brand', Number(a))],
  [/rgba\(\s*255\s*,\s*139\s*,\s*77\s*,\s*([.\d]+)\s*\)/gi, (a) => mix('--brand-light', Number(a))],
  [new RegExp(NOT_FALLBACK + '#fb923c2e\\b', 'gi'), () => mix('--brand-on-dark', 0x2e / 255)],
  ...[
    ['#fb923c', '--brand-on-dark'], ['#c2410c', '--brand-strong'], ['#9a3412', '--brand-600'],
    ['#fff7ed', '--brand-tint'], ['#f26522', '--brand'], ['#ff8b4d', '--brand-light'],
    ['#ff9a5c', '--brand-hi'], ['#ffb38a', '--brand-soft'], ['#ffd9c4', '--brand-pale'],
    ['#f57236', '--brand-grad-a'], ['#e0561a', '--brand-grad-b'], ['#7a4420', '--brand-brown'],
  ].map(([hex, v]) => [new RegExp(NOT_FALLBACK + hex + '\\b', 'gi'), () => `var(${v})`]),
];

/* درجات برتقالية لم يكن لها متغيّر: تُعرَّف بقيمها نفسها فلا يتغيّر شيء */
const NEW_VARS = [
  ['--brand-light', '#FF8B4D', 'lighter stop in brand gradients'],
  ['--brand-hi', '#FF9A5C', 'active menu link on navy'],
  ['--brand-soft', '#FFB38A', 'hover text on navy'],
  ['--brand-pale', '#FFD9C4', 'pale text on navy'],
  ['--brand-grad-a', '#F57236', 'button gradient, top'],
  ['--brand-grad-b', '#E0561A', 'button gradient, bottom'],
  ['--brand-brown', '#7A4420', 'dark text on brand tint'],
];

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.css') && x !== 'edit.css').sort()) {
  const file = path.join(dir, f);
  let n = 0;
  const out = fs.readFileSync(file, 'utf8').split('\n').map((line) => {
    if (/^\s*--brand[\w-]*\s*:\s*#/i.test(line)) return line;          // تعريف اللون نفسه
    for (const [re, to] of RULES) {
      /* m[1] المجموعة الملتقطة الأولى (الشفافية) — لا الموضع الذي يمرّره replace بعدها */
      line = line.replace(re, (...m) => { n++; return to(m[1]); });
    }
    return line;
  }).join('\n');
  if (n) fs.writeFileSync(file, out);
  console.log(`${f.padEnd(14)} ${n}`);
}

const base = path.join(dir, 'base.css');
let b = fs.readFileSync(base, 'utf8');
for (const [name, value, note] of NEW_VARS) {
  if (b.includes(`${name}:`)) continue;
  b = b.replace(/(--brand-tint:\s*#FFF7ED;[^\n]*)/, `${(name + ':').padEnd(16)}${value};   /* ${note} */\n  $1`);
  console.log(`base.css       + ${name}`);
}
fs.writeFileSync(base, b);
