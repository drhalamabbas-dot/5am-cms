/* =============================================================================
   يبني بيانات تدريب من قاعدة البيانات نفسها (lib/chat/facts.ts) ويضعها
   «للمراجعة» — بلا أيّ نداء لموديل، فلا حدّ يوميًّا ولا تكلفة.

   يُشغَّل بعد كل تغيير كبير في المنتجات أو الصفحات:
     node scripts/seed-facts.mjs            ← يضيف الجديد فقط
     node scripts/seed-facts.mjs --dry      ← يعرض بلا حفظ

   لا يلمس صفًّا موجودًا: ما سبق حفظه أو مراجعته يبقى كما هو.
============================================================================= */
import { pathToFileURL } from 'node:url';
import { log } from './lib.mjs';

const ROOT = process.cwd();
const dry = process.argv.includes('--dry');

/* المولّد والفحص في TypeScript داخل التطبيق، فيُستدعيان عبر خادم التطوير. */
const BASE = `http://localhost:${process.env.PORT || 3000}`;

const r = await fetch(`${BASE}/api/admin/chat-training/facts${dry ? '?dry=1' : ''}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie: process.env.SEED_COOKIE ?? '' },
}).catch(() => null);

if (!r) {
  log.bad('الخادم مش شغّال. شغّل «npm run dev» الأول.');
  process.exit(1);
}
if (!r.ok) {
  const d = await r.json().catch(() => ({}));
  log.bad(d.error ?? `الخادم ردّ ${r.status}`);
  process.exit(1);
}
const d = await r.json();
log.ok(`${d.built} زوج مبنيّ من القاعدة · ${d.added} جديد اتحفظ · ${d.skipped} موجود قبل كده`);
if (d.sample?.length) {
  console.log('\nعيّنة:');
  for (const s of d.sample) console.log(`\n  س: ${s.q}\n  ج: ${String(s.a).split('\n').join('\n     ')}`);
}
