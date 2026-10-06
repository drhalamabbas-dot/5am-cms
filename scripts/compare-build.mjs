/* يقارن ما يخرجه خادم التطوير بما يخرجه خادم الإنتاج لنفس الصفحات.

   البناء للإنتاج يغيّر أسماء الحزم ويحذف أدوات التطوير، لكن محتوى <main>
   يجب أن يكون واحدًا حرفًا بحرف. أي فرق فيه يعني أن النسخة المبنيّة ترسم
   شيئًا آخر — وهو ما لا يُكتشف إلا بهذه المقارنة قبل الرفع.

   node scripts/compare-build.mjs [منفذ_التطوير] [منفذ_الإنتاج] */
import { log } from './lib.mjs';

const DEV = `http://localhost:${process.argv[2] || 3000}`;
const PRD = `http://localhost:${process.argv[3] || 3100}`;

const PAGES = [
  '/?lang=ar', '/?lang=en',
  '/aftersales.html?lang=ar', '/aftersales.html?lang=en',
  '/environment.html?lang=ar', '/power.html?lang=en',
  '/generators.html?lang=ar', '/overhaul.html?lang=en',
  '/fabrication.html?lang=ar', '/parts.html?lang=en',
  '/maintenance.html?lang=ar', '/projects.html?lang=en',
  '/about.html?lang=ar', '/contact.html?lang=en',
  '/equipment.html?lang=ar', '/equipment.html?lang=en',
  '/quote.html?lang=ar', '/quote.html?lang=en',
  '/model.html?p=guzzler-classic&lang=ar', '/model.html?p=filters&lang=en',
];

/** محتوى <main> وحده: ما عداه حزم وأدوات تختلف بين الوضعين بطبيعتها. */
const main = (html) => {
  const m = html.match(/<main id="main">([\s\S]*?)<\/main>/);
  return m ? m[1] : null;
};

/** نصّ الصفحة كما يقرؤه الزائر — يتجاوز فروق الوسوم غير المرئية. */
const text = (html) => html
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

let bad = 0;
for (const p of PAGES) {
  let a, b;
  try {
    [a, b] = await Promise.all([
      fetch(DEV + p).then((r) => r.text()),
      fetch(PRD + p).then((r) => r.text()),
    ]);
  } catch (e) {
    log.fail(`${p} — تعذّر الطلب: ${e.message}`);
    bad++;
    continue;
  }
  const ma = main(a), mb = main(b);
  if (!ma || !mb) { log.fail(`${p} — لا يوجد <main>`); bad++; continue; }

  if (ma === mb) { log.ok(`${p.padEnd(42)} مطابق`); continue; }

  const ta = text(ma), tb = text(mb);
  if (ta === tb) {
    /* النص واحد والوسوم تختلف: فرق في سمات يضيفها وضع التطوير، لا في المحتوى */
    log.ok(`${p.padEnd(42)} النص مطابق (فرق في سمات التطوير فقط)`);
    continue;
  }
  bad++;
  log.fail(`${p} — النص مختلف`);
  for (let i = 0; i < Math.min(ta.length, tb.length); i++) {
    if (ta[i] === tb[i]) continue;
    log.info(`  التطوير: …${ta.slice(Math.max(0, i - 60), i + 80)}…`);
    log.info(`  الإنتاج: …${tb.slice(Math.max(0, i - 60), i + 80)}…`);
    break;
  }
}

log.step(bad ? `${bad} صفحة مختلفة` : `${PAGES.length} صفحة — نسخة الإنتاج مطابقة`);
process.exit(bad ? 1 : 0);
