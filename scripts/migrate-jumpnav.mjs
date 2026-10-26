/* =============================================================================
   شريط «محتويات الصفحة» يصير قسمًا حقيقيًّا في الصفحة.

   كان يُرسَم خارج قائمة الأقسام فلا يراه الكانفاز: لا يُخفى ولا يُحذف ولا
   يُعدَّل. وهنا يُدرَج قسمًا من نوع jump في أول كل صفحة كان يظهر فيها، فيرثه
   المحرّر بأدواته كلها. ومحتواه يبقى فارغًا، ومعناه: ابنِ الروابط من عناوين
   الأقسام كما كنت تفعل — فلا تتجمّد الروابط على ما هي عليه اليوم.

   شرطُ ظهوره كما كان: قسمان بعنوان أو أكثر، وصفحةُ «تواصل» مستثناة.

   node scripts/migrate-jumpnav.mjs   ← تشغيله ثانيةً لا يضيف قسمًا مكرّرًا
============================================================================= */
import { connect, log } from './lib.mjs';

const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];

/* العمود الذي أضافته نسخةٌ سابقة من هذا الملف: صار بلا معنى، والقسم بديله */
const [col] = await q(
  `SELECT COUNT(*) n FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pages' AND COLUMN_NAME = 'hide_jump'`
);
if (col.n) {
  await q('ALTER TABLE `pages` DROP COLUMN `hide_jump`');
  log.ok('أُزيل pages.hide_jump — القسم بديله');
}

/* القوالب التي ترسم أقسامها عبر <Section>؛ وحدها كانت ترسم الشريط. قوالب
   onepage وproduct وequipment وstore وquote لها فروعها الخاصة، وإقحام القسم
   فيها لا يظهر شيئًا — بل يزحزح أول قسم، وصفحة البداية تتعرّف على سلايدرها
   بكونه الأول. */
const OWN = new Set(['onepage', 'product', 'equipment', 'store', 'quote']);

const pages = await q('SELECT id, slug, template FROM pages');
let added = 0, had = 0, skipped = 0, other = 0;

for (const p of pages) {
  if (OWN.has(p.template)) { other++; continue; }
  const secs = await q(
    'SELECT id, type, content, position FROM sections WHERE page_id = ? ORDER BY position', [p.id]
  );
  if (secs.some((s) => s.type === 'jump')) { had++; continue; }

  /* نفس الحساب الذي كانت صفحة الموقع تجريه قبل رسم الشريط */
  const titled = secs.filter((s) => {
    if (s.type === 'contact') return false;
    const c = typeof s.content === 'string' ? JSON.parse(s.content || '{}') : (s.content ?? {});
    const t = c.title;
    return Boolean(t && (typeof t === 'string' ? t.trim() : (t.ar || t.en)));
  });
  if (titled.length < 2) { skipped++; continue; }

  /* موضعٌ قبل الكل: ترتيب الأقسام يزحف واحدًا، والشريط يأخذ الصفر */
  await q('UPDATE sections SET position = position + 1 WHERE page_id = ?', [p.id]);
  await q(
    'INSERT INTO sections (page_id, type, anchor, position, published, content) VALUES (?,?,?,?,?,?)',
    [p.id, 'jump', null, 0, 1, JSON.stringify({ links: [] })]
  );
  added++;
  log.ok(`${p.slug} — ${titled.length} عنوان`);
}

/* تصحيحٌ لتشغيلةٍ سابقة أقحمته في قالبٍ له فرعه الخاص */
for (const p of pages.filter((x) => OWN.has(x.template))) {
  const stray = await q('SELECT id FROM sections WHERE page_id = ? AND type = ?', [p.id, 'jump']);
  if (!stray.length) continue;
  await q('DELETE FROM sections WHERE page_id = ? AND type = ?', [p.id, 'jump']);
  /* الترتيب يُعاد رصُّه من الصفر، فيستردّ أول قسمٍ موضعَه */
  const rest = await q('SELECT id FROM sections WHERE page_id = ? ORDER BY position', [p.id]);
  for (let i = 0; i < rest.length; i++) await q('UPDATE sections SET position = ? WHERE id = ?', [i, rest[i].id]);
  log.ok(`${p.slug} — أُزيل القسم الدخيل وأُعيد الترتيب`);
}

log.step(`أُضيف في ${added} صفحة · موجود في ${had} · لا يظهر في ${skipped} · قوالب لها فرعها ${other}`);
await db.end();
