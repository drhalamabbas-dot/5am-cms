/* يبيّن الحقول التي تختلف عن المصدر الأصلي (extracted.json) في كل قسم: القيمة
   الأصلية والحالية، ومتى تغيّر القسم في سجل التعديلات — لتمييز التعديل المقصود
   عمّا ضاع خطأً.  node scripts/diff-content.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { connect } from './lib.mjs';

const data = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'extracted.json'), 'utf8'));
const db = await connect();
const empty = (v) => v == null || v === '' || (Array.isArray(v) && !v.length)
  || (v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(empty));
const canon = (v) => Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter((k) => !empty(v[k])).map((k) => [k, canon(v[k])])) : v;
const S = (v) => JSON.stringify(canon(v));
const short = (v) => { const s = JSON.stringify(v); return s && s.length > 160 ? s.slice(0, 160) + '…' : s; };

for (const [slug, pg] of Object.entries(data.pages)) {
  const [secs] = await db.query(
    `SELECT s.id, s.type, s.content FROM sections s JOIN pages p ON p.id = s.page_id WHERE p.slug = ? ORDER BY s.position`, [slug]);
  for (const [i, src] of (pg.sections || []).entries()) {
    const got = secs[i];
    if (!got) { console.log(`\n${slug}[${i}] ${src.type}: القسم غير موجود`); continue; }
    const { type, id, ...want } = src;
    const have = typeof got.content === 'string' ? JSON.parse(got.content) : got.content;
    const keys = [...new Set([...Object.keys(want), ...Object.keys(have)])];
    const diffs = keys.filter((k) => S(want[k]) !== S(have[k]));
    if (!diffs.length) continue;
    console.log(`\n${slug}[${i}] ${got.type} (قسم ${got.id})`);
    for (const k of diffs) console.log(`  ${k}:\n    الأصل : ${short(want[k])}\n    الآن  : ${short(have[k])}`);
    const [revs] = await db.query(
      `SELECT id, created_at FROM revisions WHERE entity = 'section' AND entity_id = ? ORDER BY id`, [got.id]);
    console.log(`  السجل: ${revs.map((r) => `#${r.id} ${r.created_at}`).join(' · ') || '—'}`);
  }
}
await db.end();
