/* اختبار شريط الأقسام على الموقع، وحذف صفحة واستعادتها كاملة.

   setup : صفحة مسوّدة zz-del-test بثلاثة أقسام، ورابط لها مخفي في الفوتر،
           وصفحة ابنة zz-del-child تحتها وتشير إليها في «وصول مباشر».
   state : يطبع حالة كل ذلك.
   clean : يحذف الكل ونسخه من السجل.

     node scripts/test-page-delete.mjs setup|state|clean */
import { connect, log } from './lib.mjs';

const SLUG = 'zz-del-test';
const CHILD = 'zz-del-child';
const db = await connect();
const cmd = process.argv[2];

async function state() {
  const [pages] = await db.query(
    'SELECT id, slug, published, parent_slug, related FROM pages WHERE slug IN (?, ?) ORDER BY id', [SLUG, CHILD]
  );
  const page = pages.find((p) => p.slug === SLUG);
  const [secs] = page
    ? await db.query(
      `SELECT id, type, position, published, JSON_UNQUOTE(JSON_EXTRACT(content, '$.title.ar')) AS title
         FROM sections WHERE page_id = ? ORDER BY position`, [page.id])
    : [[]];
  const [nav] = await db.query('SELECT id, href, published FROM nav_items WHERE href LIKE ?', [`${SLUG}%`]);
  return { pages, secs, nav };
}

if (cmd === 'setup') {
  const [r] = await db.query(
    `INSERT INTO pages (slug, template, published, crumb_en, crumb_ar, position, hero)
     VALUES (?, 'sections', 0, 'Delete test', 'اختبار الحذف', 9998, '{}')`, [SLUG]
  );
  /* الوسم داخل المحتوى يجعل نسخ الأقسام في السجل قابلة للتعرّف عند التنظيف */
  const t = (en, ar) => JSON.stringify({ title: { en, ar }, text: { en: 'x', ar: 'س' }, zzTest: SLUG });
  await db.query(
    'INSERT INTO sections (page_id, type, position, content) VALUES (?,?,?,?),(?,?,?,?),(?,?,?,?)',
    [r.insertId, 'feature', 0, t('One', 'الأول'), r.insertId, 'feature', 1, t('Two', 'الثاني'),
     r.insertId, 'feature', 2, t('Three', 'الثالث')]
  );
  await db.query(
    `INSERT INTO nav_items (area, parent_id, position, label_en, label_ar, href, published)
     VALUES ('footer', NULL, 98, 'Del test', 'اختبار الحذف', ?, 0)`, [`${SLUG}.html`]
  );
  await db.query(
    `INSERT INTO pages (slug, template, published, crumb_en, crumb_ar, parent_slug, related, position, hero)
     VALUES (?, 'sections', 0, 'Child', 'ابنة', ?, ?, 9999, '{}')`, [CHILD, SLUG, JSON.stringify([SLUG, 'contact'])]
  );
  log.ok(`أُنشئت ${SLUG} (${r.insertId}) و${CHILD}`);
}

if (cmd === 'state') {
  const s = await state();
  console.table(s.pages.map((p) => ({ ...p, related: JSON.stringify(p.related) })));
  console.table(s.secs);
  console.table(s.nav);
}

if (cmd === 'clean') {
  const s = await state();
  const ids = { pages: s.pages.map((p) => p.id), sections: s.secs.map((x) => x.id), nav: s.nav.map((n) => n.id) };
  /* النسخ التي تخصّ عناصر الاختبار: بالمعرّف، أو بذكر المسار داخلها */
  const [revs] = await db.query(
    `SELECT id FROM revisions WHERE CAST(snapshot AS CHAR) LIKE ? OR CAST(snapshot AS CHAR) LIKE ?
        OR (entity = 'page' AND entity_id IN (?)) OR (entity = 'section' AND entity_id IN (?))`,
    [`%${SLUG}%`, `%${CHILD}%`, ids.pages.length ? ids.pages : [0], ids.sections.length ? ids.sections : [0]]
  );
  /* نسخ «لم يكن موجودًا» لا تحمل إلا معرّفات: تُعرف بمعرّفات صفحات الاختبار
     الظاهرة في النسخ الأخرى */
  const [all] = await db.query('SELECT id, snapshot FROM revisions WHERE id IN (?)', [revs.length ? revs.map((r) => r.id) : [0]]);
  const pageIds = new Set(ids.pages);
  for (const r of all) {
    const s = typeof r.snapshot === 'string' ? JSON.parse(r.snapshot) : r.snapshot;
    for (const p of s?.bundle?.pages ?? []) pageIds.add(p.id);
  }
  const [absent] = pageIds.size ? await db.query(
    "SELECT id FROM revisions WHERE entity = 'page' AND entity_id IN (?) AND JSON_EXTRACT(snapshot, '$.absent') = true",
    [[...pageIds]]
  ) : [[]];
  revs.push(...absent.filter((a) => !revs.some((r) => r.id === a.id)));
  if (revs.length) await db.query('DELETE FROM revisions WHERE id IN (?)', [revs.map((r) => r.id)]);
  if (ids.nav.length) await db.query('DELETE FROM nav_items WHERE id IN (?)', [ids.nav]);
  if (ids.pages.length) await db.query('DELETE FROM pages WHERE id IN (?)', [ids.pages]);
  log.ok(`حُذفت ${ids.pages.length} صفحات و${ids.nav.length} روابط و${revs.length} نسخ`);
}
await db.end();
