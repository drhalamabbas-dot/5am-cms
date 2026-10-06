/* ينسخ أيقونات SVG ودالة pic من الموقع الحالي إلى ملف TypeScript،
   حتى يكون الرسم مطابقًا للأصل حرفًا بحرف بدل إعادة كتابته باليد. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { log } from './lib.mjs';

const SRC = process.env.SITE_SRC
  || 'C:\\Users\\Mohamed Nagy\\OneDrive - Arab Open University - AOU\\Desktop\\5am-website - Copy';
const code = fs.readFileSync(path.join(SRC, 'assets', 'js', 'site.js'), 'utf8');

/* ico كائن ثابت داخل إغلاق site.js: نقتطع نصّه ونقيّمه وحده،
   فلا نشغّل أي كود يمسّ الصفحة. */
const start = code.indexOf('const ico = {');
if (start < 0) { log.fail('لم يُعثر على كائن الأيقونات'); process.exit(1); }
let depth = 0, end = -1;
for (let i = code.indexOf('{', start); i < code.length; i++) {
  if (code[i] === '{') depth++;
  else if (code[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
const ico = vm.runInNewContext('(' + code.slice(code.indexOf('{', start), end) + ')');

const names = Object.keys(ico);
log.ok(`${names.length} أيقونة: ${names.join(' ')}`);

/* تُفكّك الأيقونة إلى خصائص ومحتوى كي تُرسم <svg> مباشرة بلا غلاف.
   الغلاف يغيّر شجرة العناصر عن الموقع القديم، وبعض قواعد CSS تعتمد عليها. */
const CAMEL = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const RENAME = { class: 'className', for: 'htmlFor' };
function split(svg) {
  const m = svg.match(/^<svg([^>]*)>([\s\S]*)<\/svg>$/);
  if (!m) return null;
  const attrs = {};
  for (const a of m[1].matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) {
    attrs[RENAME[a[1]] ?? CAMEL(a[1])] = a[2];
  }
  return { attrs, inner: m[2] };
}

const parsed = {};
for (const [k, v] of Object.entries(ico)) {
  const p = split(v);
  if (!p) { log.warn(`تعذّر تفكيك «${k}» — ستُرسم كما هي`); continue; }
  parsed[k] = p;
}
log.ok(`${Object.keys(parsed).length} أيقونة مفكّكة`);

const out = `/* مولَّد آليًا من assets/js/site.js — لا يُحرَّر بيد.
   أعِد التوليد بـ:  node scripts/extract-icons.mjs
   الغرض: أن يكون شكل الأيقونات في الموقع الجديد مطابقًا للقديم تمامًا. */

/** نص الأيقونة كما هو في الموقع القديم. */
export const ico = ${JSON.stringify(ico, null, 2)} as const;

/** الأيقونة مفكّكة إلى خصائص ومحتوى، لترسم <svg> بلا عنصر غلاف. */
export const icoParts: Record<string, { attrs: Record<string, string>; inner: string }> =
  ${JSON.stringify(parsed, null, 2)};

export type IconName = keyof typeof ico;
`;
const file = path.join(process.cwd(), 'lib', 'icons.ts');
fs.writeFileSync(file, out, 'utf8');
log.ok(file);
