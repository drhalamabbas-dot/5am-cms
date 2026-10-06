/* سجل التعديلات والرجوع خطوة إلى الوراء.

   قبل كل تعديل أو حذف تُحفَظ نسخة من الصفّ كما كان. هذه الشاشة تعرضها وتعيدها
   عند الحاجة — فالخطأ ليس نهائيًا، والحذف ليس فقدًا. */
import { redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { q, q1, json, when, tx } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { refreshSite } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const ENTITY_AR: Record<string, string> = {
  page: 'صفحة', section: 'قسم', product: 'منتج', nav: 'عنصر منيو', theme: 'ألوان وخطوط الموقع',
};

/** ألوان الموقع وخطوطه (إعداد theme، lib/design.ts): نسختها { theme: {...} } —
 *  إعداد واحد لا صفوف، فيُستعاد بكتابته كما كان، مع نسخة مما قبل الاستعادة. */
async function restoreTheme(snap: any, userId: number): Promise<'ok' | 'fail'> {
  if (!snap || typeof snap.theme !== 'object') return 'fail';
  return tx(async (db) => {
    const cur = await db.q1<any>("SELECT `value` FROM settings WHERE `key` = 'theme' FOR UPDATE");
    await db.q('INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)',
      ['theme', 0, JSON.stringify({ theme: cur ? json<any>(cur.value, {}) : {} }), userId]);
    await db.q(
      `INSERT INTO settings (\`key\`, \`value\`, \`group\`, label_en, label_ar) VALUES ('theme', ?, 'design', 'Site colours and fonts', 'ألوان وخطوط الموقع')
       ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
      [JSON.stringify(snap.theme ?? {})]
    );
    return 'ok' as const;
  }).catch(() => 'fail' as const);
}
const TABLE: Record<string, string> = {
  page: 'pages', section: 'sections', product: 'products', nav: 'nav_items',
};
/** يرتّب صفوف شجرة بحيث يسبق كل أبٍ أبناءه — شرط إعادة كتابتها. */
function parentsFirst(rows: any[]): any[] {
  const ids = new Set(rows.map((r) => r.id));
  const out: any[] = [];
  const done = new Set<number>();
  let left = [...rows];
  while (left.length) {
    const ready = left.filter((r) => r.parent_id == null || !ids.has(r.parent_id) || done.has(r.parent_id));
    if (!ready.length) return [...out, ...left];   // حلقة لا ينبغي أن توجد؛ لا نعلق فيها
    for (const r of ready) { out.push(r); done.add(r.id); }
    left = left.filter((r) => !done.has(r.id));
  }
  return out;
}

/* =============================================================================
   أشكال النسخة المحفوظة — القديمة والجديدة معًا:
   • صفٌّ واحد بمفاتيحه.
   • { tree: [...] }: عنصر منيو بما تحته، الآباء أولًا.
   • { bundle: { pages, sections, nav_items, … } }: صفحة حُذفت بأقسامها
     وروابطها وما تغيّر حولها.
   • { absent, ids }: «لم تكن هذه موجودة» — تُسجَّل حين يُعاد محذوف، كي يُتراجع
     عن الإعادة نفسها. ids قائمة (جدول العنصر) أو { جدول: قائمة }.
============================================================================= */
type Bundle = Record<string, any[]>;
/** الآباء قبل الأبناء: الصفحة قبل أقسامها. */
const ORDER = ['pages', 'sections', 'products', 'nav_items'];

function toBundle(entity: string, snap: any): Bundle | null {
  const ok = (rows: any) => Array.isArray(rows) && rows.length > 0 && rows.every((r) => r?.id != null);
  if (snap?.bundle && typeof snap.bundle === 'object') {
    const out: Bundle = {};
    for (const t of ORDER) if (ok(snap.bundle[t])) out[t] = snap.bundle[t];
    return Object.keys(out).length ? out : null;
  }
  const rows = Array.isArray(snap?.tree) ? snap.tree : [snap];
  return ok(rows) ? { [TABLE[entity]]: rows } : null;
}

function toAbsent(entity: string, snap: any): Record<string, number[]> | null {
  if (snap?.absent !== true) return null;
  if (Array.isArray(snap.ids)) return snap.ids.length ? { [TABLE[entity]]: snap.ids.map(Number) } : null;
  if (snap.ids && typeof snap.ids === 'object') {
    const out: Record<string, number[]> = {};
    for (const t of ORDER) if (Array.isArray(snap.ids[t]) && snap.ids[t].length) out[t] = snap.ids[t].map(Number);
    return Object.keys(out).length ? out : null;
  }
  return null;
}

/** يحفظ مجموعة صفوف بأبسط شكل يصفها، فيقرؤها السجل كما يقرأ القديم. */
function pack(entity: string, b: Bundle) {
  const tables = Object.keys(b);
  if (tables.length === 1 && tables[0] === TABLE[entity]) {
    const rows = b[tables[0]];
    return rows.length === 1 ? rows[0] : { tree: parentsFirst(rows) };
  }
  return { bundle: b };
}

const ERR: Record<string, string> = {
  '1': 'تعذّرت الاستعادة — النسخة غير مكتملة.',
  slug: 'مسار هذه الصفحة (أو معرّف المنتج) صار لعنصر آخر بعد الحذف. غيّر مسار العنصر الآخر أولًا، ثم استعد.',
  parent: 'القائمة التي كان تحتها هذا العنصر محذوفة. أعِدها أولًا، ثم أعِد هذا العنصر.',
  page: 'الصفحة التي كان فيها هذا القسم محذوفة. أعِدها أولًا، ثم أعِد القسم.',
  fail: 'تعذّرت الاستعادة، ولم يتغيّر شيء.',
};

export default async function HistoryPage({
  searchParams,
}: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const user = await requirePerm('history.restore');
  const sp = await searchParams;

  const rows = await q<any>(
    `SELECT r.id, r.entity, r.entity_id, r.created_at, r.snapshot, u.name AS who
       FROM revisions r LEFT JOIN users u ON u.id = r.user_id
      ORDER BY r.id DESC LIMIT 60`
  );

  /* هل العنصر ما زال موجودًا؟ الاستعادة تعني الكتابة فوقه أو إعادته. */
  const alive = new Set<string>();
  for (const e of Object.keys(TABLE)) {
    const ids = rows.filter((r) => r.entity === e).map((r) => r.entity_id);
    if (!ids.length) continue;
    const found = await q<any>(
      `SELECT id FROM \`${TABLE[e]}\` WHERE id IN (${ids.map(() => '?').join(',')})`, ids
    );
    for (const f of found) alive.add(`${e}:${f.id}`);
  }

  async function restore(form: FormData) {
    'use server';
    const u = await requirePerm('history.restore');
    const id = Number(form.get('id'));
    const rev = await q1<any>('SELECT * FROM revisions WHERE id = ?', [id]);
    const snap = rev ? json<any>(rev.snapshot, null) : null;
    if (rev?.entity === 'theme') {
      const r = await restoreTheme(snap, u.id);
      if (r !== 'ok') redirect('/admin/history?e=fail');
      await audit(u, 'history.restore', { entity: 'theme', id: rev.entity_id, summary: `نسخة #${id}` });
      refreshSite();
      redirect('/admin/history?ok=1');
    }
    if (!rev || !TABLE[rev.entity] || !snap) redirect('/admin/history?e=1');

    /* النسخة تصف حالة يُرجَع إليها بخطوة واحدة: صفوف تُكتب كما كانت، و/أو
       صفوف لم تكن موجودة فتُحذف. */
    const remove = toAbsent(rev.entity, snap);
    const upsert = toBundle(rev.entity, snap);
    if (!remove && !upsert) redirect('/admin/history?e=1');

    const result = await tx(async (db) => {
      const record = (value: unknown) => db.q(
        'INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)',
        [rev.entity, rev.entity_id, JSON.stringify(value), u.id]
      );
      const select = (table: string, ids: number[]) => ids.length
        ? db.q<any>(`SELECT * FROM \`${table}\` WHERE id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`, ids)
        : Promise.resolve([] as any[]);

      const b: Bundle = upsert ?? {};
      const has = (t: string, id: unknown) => (b[t] ?? []).some((r) => r.id === id);

      /* ما يتعلّق به من خارج النسخة يجب أن يكون موجودًا: لا يُعاد قسم إلى
         صفحة محذوفة، ولا عنصر منيو تحت قائمة محذوفة. */
      for (const s of b.sections ?? []) {
        if (!has('pages', s.page_id) && !(await db.q1('SELECT id FROM pages WHERE id = ?', [s.page_id]))) return 'page';
      }
      for (const n of b.nav_items ?? []) {
        if (n.parent_id != null && !has('nav_items', n.parent_id)
            && !(await db.q1('SELECT id FROM nav_items WHERE id = ?', [n.parent_id]))) return 'parent';
      }
      /* مسار الصفحة ومعرّف المنتج لا يتكرّران. إن أخذهما عنصر جديد بعد الحذف،
         فالاستعادة كانت ستكتب فوقه بصمت — فتُرفض بدلًا من ذلك. */
      for (const p of b.pages ?? []) {
        if (await db.q1('SELECT id FROM pages WHERE slug = ? AND id <> ?', [p.slug, p.id])) return 'slug';
      }
      for (const p of b.products ?? []) {
        if (await db.q1('SELECT id FROM products WHERE (slug = ? OR ref = ?) AND id <> ?', [p.slug, p.ref, p.id])) return 'slug';
      }

      /* ما سيُحذف، ومعه ما يتبعه في الحذف (أقسام الصفحة، وما تحت عنصر
         المنيو) كي لا يضيع شيء أُضيف بعد الإعادة. */
      const doomed: Bundle = {};
      for (const t of ORDER) {
        let rows = await select(t, remove?.[t] ?? []);
        if (t === 'nav_items' && rows.length) {
          let level = rows;
          while (level.length) {
            level = await db.q<any>(
              `SELECT * FROM nav_items WHERE parent_id IN (${level.map(() => '?').join(',')}) FOR UPDATE`,
              level.map((r) => r.id)
            );
            rows = [...rows, ...level.filter((r) => !rows.some((x) => x.id === r.id))];
          }
        }
        if (rows.length) doomed[t] = rows;
      }
      if (doomed.pages?.length) {
        const extra = await db.q<any>(
          `SELECT * FROM sections WHERE page_id IN (${doomed.pages.map(() => '?').join(',')}) FOR UPDATE`,
          doomed.pages.map((p) => p.id)
        );
        doomed.sections = [...(doomed.sections ?? []), ...extra.filter((s) => !doomed.sections?.some((x) => x.id === s.id))];
      }

      /* الحالة الراهنة قبل الاستعادة تُحفظ في نسخة واحدة، فالرجوع عنها خطوة
         واحدة أيضًا: ما كان موجودًا يُنسخ كما هو، وما كان غائبًا يُسجَّل غيابه. */
      const before: Bundle = {};
      const missing: Record<string, number[]> = {};
      for (const t of ORDER) {
        const ids = (b[t] ?? []).map((r) => r.id);
        const found = await select(t, ids);
        const rows = [...(doomed[t] ?? []), ...found.filter((r) => !doomed[t]?.some((x) => x.id === r.id))];
        if (rows.length) before[t] = rows;
        const had = new Set(found.map((r) => r.id));
        const gone = ids.filter((x) => !had.has(x));
        if (gone.length) missing[t] = gone;
      }
      const hasBefore = Object.keys(before).length > 0;
      if (Object.keys(missing).length) {
        await record({ absent: true, ids: missing, ...(hasBefore ? { bundle: before } : {}) });
      } else if (hasBefore) {
        await record(pack(rev.entity, before));
      }

      for (const t of [...ORDER].reverse()) {
        const ids = (doomed[t] ?? []).map((r) => r.id);
        if (ids.length) await db.q(`DELETE FROM \`${t}\` WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
      }

      /* تُكتب كما هي، وتُعاد إن كانت قد حُذفت — بمعرّفاتها نفسها كي تبقى
         الروابط إليها صحيحة، وبمواضعها وحالة ظهورها. الجداول بترتيب الآباء
         أولًا، وعناصر المنيو كذلك داخل جدولها.

         أسماء الأعمدة تُبنى في نصّ الاستعلام لا كوسائط، فتُقارن بأعمدة الجدول
         الفعلية أولًا: ما لا يطابق عمودًا موجودًا يُهمَل. */
      for (const t of ORDER) {
        const rows = t === 'nav_items' ? parentsFirst(b[t] ?? []) : (b[t] ?? []);
        if (!rows.length) continue;
        const real = await db.q<{ COLUMN_NAME: string }>(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [t]
        );
        const allowed = new Set(real.map((c) => c.COLUMN_NAME));
        for (const r of rows) {
          const cols = Object.keys(r).filter((k) => allowed.has(k) && k !== 'created_at' && k !== 'updated_at');
          const vals = cols.map((k) => (r[k] !== null && typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k]));
          await db.q(
            `INSERT INTO \`${t}\` (${cols.map((c) => `\`${c}\``).join(',')})
             VALUES (${cols.map(() => '?').join(',')})
             ON DUPLICATE KEY UPDATE ${cols.filter((c) => c !== 'id').map((c) => `\`${c}\` = VALUES(\`${c}\`)`).join(',')}`,
            vals
          );
        }
      }
      return 'ok';
    }).catch((e) => {
      console.error('[history] تعذّرت الاستعادة:', e);
      return 'fail';
    });

    if (result !== 'ok') redirect(`/admin/history?e=${result}`);
    await audit(u, 'history.restore', { entity: rev.entity, id: rev.entity_id, summary: `نسخة #${id}` });
    refreshSite();
    redirect('/admin/history?ok=1');
  }

  const label = (r: any) => {
    const s0 = json<any>(r.snapshot, {});
    if (r.entity === 'theme') {
      const n = Object.keys(s0.theme ?? {}).length;
      return n ? `الألوان والخطوط قبل تغييرها (${n} إعداد مغيَّر عن الأصل)` : 'الألوان والخطوط الأصلية قبل تغييرها';
    }
    if (s0.note === 'nav') return `المنيو العلوي قبل تعديله من المحرّر (${s0.bundle?.nav_items?.length ?? 0} عنصر)`;
    if (s0.absent) {
      const ids = Array.isArray(s0.ids) ? s0.ids : Object.values(s0.ids ?? {}).flat();
      return s0.bundle
        ? `الحالة قبل الإعادة — يحذف ${ids.length} عنصر أُعيد ويرجع ما تغيّر حوله`
        : `لم يكن موجودًا قبل إعادته (${ids.length} عنصر)`;
    }
    if (s0.note === 'order') return `ترتيب أقسام الصفحة #${r.entity_id} قبل تحريكها`;
    if (s0.bundle && !s0.bundle.pages?.length) {
      return `أقسام الصفحة #${r.entity_id} (${s0.bundle.sections?.length ?? 0})`;
    }
    if (s0.bundle) {
      const p = s0.bundle.pages?.[0] ?? {};
      const n = s0.bundle.sections?.length ?? 0;
      return `${p.slug ?? `#${r.entity_id}`} — صفحة كاملة بـ ${n} قسم`;
    }
    const s = Array.isArray(s0.tree) ? s0.tree[0] ?? {} : s0;
    const more = Array.isArray(s0.tree) && s0.tree.length > 1 ? ` + ${s0.tree.length - 1} تحته` : '';
    return (s.slug || s.name_en || s.label_ar || s.label_en
      || (s.type ? `${s.type}` : '') || `#${r.entity_id}`) + more;
  };

  return (
    <Shell user={user} here="/admin/history" title="سجل التعديلات"
           trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub="نسخة محفوظة قبل كل تعديل وقبل كل حذف. اضغط «استعد» لإرجاع الحالة السابقة.">
      {sp.ok ? <p className="msg msg--ok">تمت الاستعادة.</p> : null}
      {sp.e ? <p className="msg msg--bad">{ERR[sp.e] ?? ERR.fail}</p> : null}

      <div className="panel">
        <div className="panel__head">
          <h2>آخر {rows.length} تعديل</h2>
        </div>
        {rows.length === 0 ? (
          <p className="empty">لا تعديلات بعد.</p>
        ) : (
          <table>
            <thead>
              <tr><th>ماذا</th><th>العنصر</th><th>من</th><th>متى</th><th>الحالة</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const still = r.entity === 'theme' || alive.has(`${r.entity}:${r.entity_id}`);
                return (
                  <tr key={r.id}>
                    <td>{ENTITY_AR[r.entity] ?? r.entity}</td>
                    <td><code dir="ltr" style={{ fontSize: 12.5 }}>{label(r)}</code></td>
                    <td><small>{r.who ?? '—'}</small></td>
                    <td><small dir="ltr">{when(r.created_at)}</small></td>
                    <td>
                      {still
                        ? <span className="tag">موجود</span>
                        : <span className="tag tag--off">محذوف</span>}
                    </td>
                    <td style={{ textAlign: 'end' }}>
                      <form action={restore}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="btn btn--ghost btn--sm" type="submit">
                          {json<any>(r.snapshot, {}).absent ? 'تراجع عن الإعادة'
                            : still ? 'استعد هذه النسخة' : 'أعِد العنصر'}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}
