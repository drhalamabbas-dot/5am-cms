/* =============================================================================
   يُرجع قسمًا محذوفًا من نسخته المحفوظة في جدول revisions.

   node scripts/restore-section.mjs <revisionId>          ← عرضٌ بلا كتابة
   node scripts/restore-section.mjs <revisionId> --apply  ← إرجاع
============================================================================= */
import { connect, log } from './lib.mjs';

const REV = Number(process.argv[2]);
const APPLY = process.argv.includes('--apply');
if (!REV) { console.log('استعمل: node scripts/restore-section.mjs <revisionId> [--apply]'); process.exit(1); }

const d = await connect();
const q = async (s, a = []) => (await d.query(s, a))[0];

const [r] = await q('SELECT id, entity, entity_id, snapshot FROM revisions WHERE id = ?', [REV]);
if (!r) { console.log('لا نسخة بهذا الرقم'); await d.end(); process.exit(1); }
if (r.entity !== 'section') { console.log('هذه النسخة ليست لقسم بل لـ', r.entity); await d.end(); process.exit(1); }

const s = typeof r.snapshot === 'string' ? JSON.parse(r.snapshot) : r.snapshot;
const content = typeof s.content === 'string' ? s.content : JSON.stringify(s.content);

const exists = await q('SELECT id FROM sections WHERE id = ?', [s.id]);
console.log(`القسم #${s.id} (${s.type}) في الصفحة ${s.page_id} · الترتيب ${s.position}`);
console.log(exists.length ? 'موجود بالفعل — لن يُكتب فوقه' : 'محذوف — سيُرجَع');

if (!APPLY) { console.log('\nللإرجاع: أضف --apply'); await d.end(); process.exit(0); }
if (exists.length) { console.log('لا شيء ليُعمل.'); await d.end(); process.exit(0); }

/* التاريخ يعود من JSON بصيغة ISO، وMySQL يرفض الزاي في آخرها */
const sql = (v) => {
  const t = v ? new Date(v) : new Date();
  return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 19).replace('T', ' ');
};

/* يُرجَع بمعرّفه نفسه كي تبقى الإشارات إليه صحيحة */
await q(
  `INSERT INTO sections (id, page_id, type, anchor, position, published, content, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?, NOW())`,
  [s.id, s.page_id, s.type, s.anchor ?? null, s.position ?? 0, s.published ?? 1, content, sql(s.created_at)]
);
log.ok(`أُرجع القسم #${s.id} (${s.type})`);

const after = await q('SELECT id, type, position FROM sections WHERE page_id = ? ORDER BY position', [s.page_id]);
console.log('\nأقسام الصفحة الآن:');
for (const x of after) console.log(`  #${x.id} pos${x.position} ${x.type}`);

await d.end();
