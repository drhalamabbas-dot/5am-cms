/* اختبار حذف عنصر منيو بما تحته واستعادته كاملًا.

   setup  : شجرة مؤقتة مخفية في الفوتر — جذر، تحته A و B، وتحت A حفيد.
   (ثم تُحذف من /admin/nav وتُستعاد من /admin/history)
   state  : يطبع ما بقي من الشجرة وآخر نسخة في السجل.
   clean  : يحذف الشجرة ونسخها.

     node scripts/test-nav-restore.mjs setup|state|clean */
import { connect, log } from './lib.mjs';

const TAG = 'zz-nav-test';
const db = await connect();
const cmd = process.argv[2];

const tree = async () => (await db.query(
  'SELECT id, parent_id, position, published, label_en FROM nav_items WHERE href LIKE ? ORDER BY id', [`${TAG}%`]
))[0];

if (cmd === 'setup') {
  const ins = async (parent, pos, label, pub) => (await db.query(
    `INSERT INTO nav_items (area, parent_id, position, label_en, label_ar, href, published)
     VALUES ('footer', ?, ?, ?, ?, ?, ?)`, [parent, pos, label, label, `${TAG}-${label}.html`, pub]
  ))[0].insertId;
  const root = await ins(null, 99, 'root', 0);          // مخفي: لا يظهر للزائر أثناء الاختبار
  const a = await ins(root, 0, 'A', 1);
  await ins(root, 1, 'B', 0);
  await ins(a, 0, 'A1', 1);
  log.ok(`الجذر ${root}`);
  console.table(await tree());
}

if (cmd === 'state') {
  console.table(await tree());
  const [revs] = await db.query(
    "SELECT id, entity_id, JSON_LENGTH(JSON_EXTRACT(snapshot, '$.tree')) n FROM revisions WHERE entity = 'nav' ORDER BY id DESC LIMIT 3"
  );
  console.table(revs);
}

if (cmd === 'clean') {
  const rows = await tree();
  const [revs] = await db.query(
    "SELECT id, snapshot FROM revisions WHERE entity = 'nav' AND CAST(snapshot AS CHAR) LIKE ?", [`%${TAG}%`]
  );
  /* نسخ «لم يكن موجودًا» لا تحمل الوسم، فتُعرف بمعرّفات عناصر الاختبار */
  const ids = new Set(rows.map((r) => r.id));
  for (const r of revs) {
    const s = typeof r.snapshot === 'string' ? JSON.parse(r.snapshot) : r.snapshot;
    for (const x of s.tree ?? [s]) ids.add(x.id);
  }
  const [absent] = ids.size ? await db.query(
    "SELECT id FROM revisions WHERE entity = 'nav' AND entity_id IN (?) AND JSON_EXTRACT(snapshot, '$.absent') = true",
    [[...ids]]
  ) : [[]];
  revs.push(...absent);
  if (revs.length) await db.query('DELETE FROM revisions WHERE id IN (?)', [revs.map((r) => r.id)]);
  const roots = rows.filter((r) => !rows.some((x) => x.id === r.parent_id));
  for (const r of roots) await db.query('DELETE FROM nav_items WHERE id = ?', [r.id]);
  log.ok(`حُذفت ${rows.length} عناصر و${revs.length} نسخ`);
}
await db.end();
