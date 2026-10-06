/* =============================================================================
   تنظيف المحتوى مما كشفته scripts/audit-content.mjs — بلا تغيير في معناه:
   • مسافات وأسطر فارغة في أول النصّ وآخره تُحذف.
   • سطر جديد داخل عنوان (حقل سطر واحد) يصير مسافة.
   • صورة مكرّرة في معرض تُحذف (تبقى الأولى).
   • وصف بديل عربي لصور الماركات في الرئيسية (كان إنجليزيًا وحده).

   قبل كل تعديل نسخة من الصفّ في سجل التعديلات، فيُتراجع عنه من «سجل التعديلات».
   التشغيل مرة ثانية لا يغيّر شيئًا.

   node scripts/fix-content.mjs            يعرض ما سيتغيّر فقط
   node scripts/fix-content.mjs --apply    يطبّقه
============================================================================= */
import { connect, log } from './lib.mjs';

const apply = process.argv.includes('--apply');
const db = await connect();
const q = async (s, a = []) => (await db.query(s, a))[0];
const J = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const [[user]] = await q('SELECT id FROM users ORDER BY id LIMIT 1').then((r) => [r]);

const TITLE_KEYS = new Set(['title', 'h', 't', 'label', 'k', 'name']);
const PATHLIKE = /^(\/?(assets|media)\/|https?:|mailto:|tel:)/i;
let notes = [];

/** ينظّف شجرة المحتوى ويعيد [الجديد، ما تغيّر] */
function clean(v, key = '', path = '') {
  if (typeof v === 'string') {
    if (PATHLIKE.test(v)) return v;
    let s = v.replace(/^[\s‏‎]+|[\s‏‎]+$/g, '');
    if (TITLE_KEYS.has(key)) s = s.replace(/\s*\n\s*/g, ' ');
    if (s !== v) notes.push(`${path}: «${v.slice(0, 50).replace(/\n/g, '⏎')}» ← «${s.slice(0, 50).replace(/\n/g, '⏎')}»`);
    return s;
  }
  if (Array.isArray(v)) {
    let arr = v.map((x, i) => clean(x, key, `${path}.${i}`));
    /* معرض: صورة مكرّرة */
    if ((key === 'imgs' || key === 'gallery') && arr.every((x) => typeof x === 'string')) {
      const uniq = [...new Set(arr)];
      if (uniq.length !== arr.length) { notes.push(`${path}: ${arr.length - uniq.length} صورة مكرّرة حُذفت`); arr = uniq; }
    }
    return arr;
  }
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      /* حقل بلغتين: مفتاحا ar/en يرثان اسم الحقل (title.ar عنوانٌ أيضًا) */
      const inherit = (k === 'ar' || k === 'en') ? key : k;
      /* نصوص تُلصق بها كلمات أخرى (prefill: «أرغب في عرض سعر لـ » + اسم المنتج):
         مسافتها الأخيرة مقصودة */
      out[k] = k === 'design' || /prefill|prefix|suffix/i.test(k) ? x : clean(x, inherit, path ? `${path}.${k}` : k);
    }
    return out;
  }
  return v;
}

/* وصف بديل عربي لصور كروت الماركات في الرئيسية */
const ALT_AR = {
  'An Elgin regenerative-air street sweeper': 'مكنسة شوارع Elgin بنظام الهواء المتجدد',
  'A Vactor 2100i combination sewer cleaner': 'وحدة Vactor 2100i المشتركة لتنظيف شبكات الصرف',
  'A Guzzler industrial vacuum truck': 'شاحنة شفط صناعي من Guzzler',
};
function altAr(c) {
  if (!Array.isArray(c?.cards)) return c;
  return { ...c, cards: c.cards.map((card, i) => {
    const en = card?.alt?.en;
    if (en && !card.alt.ar && ALT_AR[en]) { notes.push(`cards.${i}.alt.ar ← «${ALT_AR[en]}»`); return { ...card, alt: { ...card.alt, ar: ALT_AR[en] } }; }
    return card;
  }) };
}

let changed = 0;
await db.beginTransaction();
try {
  /* الأقسام */
  for (const s of await q('SELECT * FROM sections')) {
    /* نموذج عرض السعر: نصوصه قوالب تُركَّب منها رسالة — لا تُمسّ */
    if (s.type === 'quoteForm') continue;
    notes = [];
    const before = J(s.content);
    let after = clean(before);
    if (s.type === 'brandCards') after = altAr(after);
    if (!notes.length) continue;
    const [pg] = await q('SELECT slug FROM pages WHERE id = ?', [s.page_id]);
    log.info(`صفحة ${pg?.slug} › قسم ${s.id} (${s.type})`);
    for (const n of notes) log.info(`    ${n}`);
    changed++;
    if (!apply) continue;
    await db.query('INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)', ['section', s.id, JSON.stringify(s), user.id]);
    await db.query('UPDATE sections SET content = ? WHERE id = ?', [JSON.stringify(after), s.id]);
  }
  /* أعلى الصفحات وأسماؤها */
  for (const p of await q('SELECT * FROM pages')) {
    notes = [];
    const hero = p.hero ? clean(J(p.hero)) : null;
    const crumbs = { crumb_ar: p.crumb_ar, crumb_en: p.crumb_en };
    for (const k of Object.keys(crumbs)) {
      if (typeof crumbs[k] === 'string' && crumbs[k] !== crumbs[k].trim().replace(/\s*\n\s*/g, ' ')) {
        notes.push(`${k}: «${crumbs[k]}»`); crumbs[k] = crumbs[k].trim().replace(/\s*\n\s*/g, ' ');
      }
    }
    if (!notes.length) continue;
    log.info(`صفحة ${p.slug} › أعلاها`); for (const n of notes) log.info(`    ${n}`);
    changed++;
    if (!apply) continue;
    await db.query('INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)', ['page', p.id, JSON.stringify(p), user.id]);
    await db.query('UPDATE pages SET hero = ?, crumb_ar = ?, crumb_en = ? WHERE id = ?', [hero ? JSON.stringify(hero) : null, crumbs.crumb_ar, crumbs.crumb_en, p.id]);
  }
  /* المنتجات */
  for (const p of await q('SELECT * FROM products')) {
    notes = [];
    const data = clean(J(p.data) ?? {});
    const cols = {};
    for (const k of ['name_ar', 'name_en', 'type_ar', 'type_en', 'description_ar', 'description_en']) {
      const v = p[k];
      if (typeof v === 'string') {
        const s = /^name|^type/.test(k) ? v.trim().replace(/\s*\n\s*/g, ' ') : v.trim();
        if (s !== v) { notes.push(`${k}: «${v.slice(0, 40)}»`); cols[k] = s; }
      }
    }
    if (!notes.length) continue;
    log.info(`منتج ${p.slug}`); for (const n of notes) log.info(`    ${n}`);
    changed++;
    if (!apply) continue;
    await db.query('INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)', ['product', p.id, JSON.stringify(p), user.id]);
    const sets = ['data = ?', ...Object.keys(cols).map((k) => `${k} = ?`)];
    await db.query(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, [JSON.stringify(data), ...Object.values(cols), p.id]);
  }
  /* المنيو */
  for (const n of await q('SELECT * FROM nav_items')) {
    const fix = {};
    for (const k of ['label_ar', 'label_en', 'desc_ar', 'desc_en', 'href']) {
      const v = n[k];
      if (typeof v === 'string' && v !== v.trim()) fix[k] = v.trim();
    }
    if (!Object.keys(fix).length) continue;
    log.info(`منيو «${n.label_ar}»: ${Object.keys(fix).join('، ')}`);
    changed++;
    if (!apply) continue;
    await db.query('INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)', ['nav', n.id, JSON.stringify(n), user.id]);
    await db.query(`UPDATE nav_items SET ${Object.keys(fix).map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...Object.values(fix), n.id]);
  }
  if (apply) await db.commit(); else await db.rollback();
  log.step(apply ? `طُبّق: ${changed} عنصر` : `${changed} عنصر سيتغيّر — أعد التشغيل بـ --apply للتطبيق`);
} catch (e) {
  await db.rollback();
  log.fail(`لم يتغيّر شيء: ${e.message}`);
  process.exitCode = 1;
}
await db.end();
