/* دمج بيانات التدريب الأصلية + المولّدة + فصل train/test */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const dir = 'training-data';
const original = fs.readFileSync(path.join(dir, 'training.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const augmented = fs.readFileSync(path.join(dir, 'augmented.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));

const all = [...original, ...augmented];

/* خلط عشوائي ثابت (seeded shuffle) */
const seed = 'fiveam-2026';
function hash(s, i) { return crypto.createHash('md5').update(`${s}-${i}`).digest('hex'); }
all.sort((a, b) => hash(seed, all.indexOf(a)).localeCompare(hash(seed, all.indexOf(b))));

/* فصل 15% للاختبار */
const testSize = Math.round(all.length * 0.15);
const test = all.slice(0, testSize);
const train = all.slice(testSize);

fs.writeFileSync(path.join(dir, 'train.jsonl'), train.map(r => JSON.stringify(r)).join('\n'), 'utf8');
fs.writeFileSync(path.join(dir, 'test.jsonl'), test.map(r => JSON.stringify(r)).join('\n'), 'utf8');
fs.writeFileSync(path.join(dir, 'all.jsonl'), all.map(r => JSON.stringify(r)).join('\n'), 'utf8');

/* إحصائيات */
const stats = {
  total: all.length,
  train: train.length,
  test: test.length,
  split: `${Math.round(train.length/all.length*100)}/${Math.round(test.length/all.length*100)}`,
  by_source: {},
  by_type: {},
  by_lang: { ar: 0, en: 0 },
};
for (const r of all) {
  const s = r.metadata.source; stats.by_source[s] = (stats.by_source[s] || 0) + 1;
  const t = r.metadata.type; stats.by_type[t] = (stats.by_type[t] || 0) + 1;
  stats.by_lang[r.metadata.lang]++;
}
fs.writeFileSync(path.join(dir, 'stats.json'), JSON.stringify(stats, null, 2), 'utf8');

console.log(`الإجمالي: ${all.length}`);
console.log(`تدريب: ${train.length} | اختبار: ${test.length} (${stats.split})`);
console.log('\nبالمصدر:');
for (const [s, c] of Object.entries(stats.by_source).sort((a, b) => b[1] - a[1])) console.log(`  ${s}: ${c}`);
console.log('\nبالنوع:');
for (const [t, c] of Object.entries(stats.by_type).sort((a, b) => b[1] - a[1])) console.log(`  ${t}: ${c}`);
console.log(`\nعربي: ${stats.by_lang.ar} | إنجليزي: ${stats.by_lang.en}`);
