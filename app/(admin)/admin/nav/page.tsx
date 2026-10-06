/* محرّر المنيو العلوي والفوتر.

   الشجرة كلها في نموذج واحد: تُعدَّل الأسماء والروابط حيث هي، وأزرار الترتيب
   والحذف والإضافة داخل النموذج نفسه. وكل ضغطة تحفظ ما كتبته أولًا ثم تنفّذ
   ما طلبته — فلا يضيع تعديل لأن المحرّر ضغط «أسفل» قبل «احفظ». */
import { redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { q, q1, json, tx } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { refreshSite, str, J } from '@/lib/admin';
import { siteHref } from '@/lib/links';

export const dynamic = 'force-dynamic';

type Row = {
  id: number; parent_id: number | null; area: 'header' | 'footer'; position: number;
  label_en: string; label_ar: string; href: string | null;
  desc_en: string | null; desc_ar: string | null; extra: any; published: number;
};

const KIND_AR: Record<string, string> = {
  plain: 'رابط', mega: 'قائمة كبيرة بأعمدة', submenu: 'قائمة منسدلة', column: 'عمود',
};

export default async function NavPage({
  searchParams,
}: { searchParams: Promise<{ ok?: string }> }) {
  const user = await requirePerm('nav.edit');
  const saved = (await searchParams).ok;
  const rows = await q<Row>(
    `SELECT id, parent_id, area, position, label_en, label_ar, href, desc_en, desc_ar, extra, published
       FROM nav_items ORDER BY area, position, id`
  );
  const kids = (area: string, parent: number | null) =>
    rows.filter((r) => r.area === area && r.parent_id === parent);

  async function submit(form: FormData) {
    'use server';
    const u = await requirePerm('nav.edit');

    /* 1) ما كُتب في الخانات يُحفظ دائمًا */
    for (const r of rows) {
      const en = form.get(`i${r.id}.label_en`);
      if (en == null) continue;
      await q(
        'UPDATE nav_items SET label_en = ?, label_ar = ?, href = ?, desc_en = ?, desc_ar = ? WHERE id = ?',
        [
          String(en).trim(), String(form.get(`i${r.id}.label_ar`) ?? '').trim(),
          str(form, `i${r.id}.href`) ? siteHref(str(form, `i${r.id}.href`)!) : null, str(form, `i${r.id}.desc_en`), str(form, `i${r.id}.desc_ar`), r.id,
        ]
      );
    }

    /* 2) ثم ما طلبه الزرّ المضغوط، إن كان زرَّ بنية */
    const op = String(form.get('op') ?? '');
    const [what, ...rest] = op.split(':');
    let msg = 'save';

    if (what === 'move') {
      const [id, dir] = [Number(rest[0]), Number(rest[1])];
      const me = await q1<Row>('SELECT * FROM nav_items WHERE id = ?', [id]);
      if (me) {
        const sibs = await q<Row>(
          'SELECT id FROM nav_items WHERE area = ? AND parent_id <=> ? ORDER BY position, id',
          [me.area, me.parent_id]
        );
        const i = sibs.findIndex((s) => s.id === id);
        const j = i + dir;
        if (j >= 0 && j < sibs.length) {
          [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
          /* تُعاد كتابة المواضع كلها بالترتيب الجديد فلا تتصادم */
          for (let k = 0; k < sibs.length; k++) {
            await q('UPDATE nav_items SET position = ? WHERE id = ?', [k, sibs[k].id]);
          }
        }
      }
      msg = 'move';
    } else if (what === 'del') {
      /* حذف العنصر يحذف ما تحته معه (المفتاح الأجنبي cascade)، فتُحفظ الشجرة
         كلها في نسخة واحدة — العنصر ثم أبناؤه مستوًى مستوًى — كي تعيدها
         الاستعادة كاملة. والنسخ والحذف في معاملة واحدة. */
      const id = Number(rest[0]);
      await tx(async (db) => {
        const tree: Row[] = [];
        let level = await db.q<Row>('SELECT * FROM nav_items WHERE id = ? FOR UPDATE', [id]);
        while (level.length) {
          tree.push(...level);
          level = await db.q<Row>(
            `SELECT * FROM nav_items WHERE parent_id IN (${level.map(() => '?').join(',')})
              ORDER BY position, id FOR UPDATE`,
            level.map((r) => r.id)
          );
        }
        if (!tree.length) return;
        await db.q(
          'INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)',
          ['nav', id, JSON.stringify({ tree }), u.id]
        );
        await db.q('DELETE FROM nav_items WHERE id = ?', [id]);
      });
      msg = 'del';
    } else if (what === 'vis') {
      await q('UPDATE nav_items SET published = 1 - published WHERE id = ?', [Number(rest[0])]);
      msg = 'vis';
    } else if (what === 'add' || what === 'after') {
      /* add:   يضيف في آخر المستوى
         after: يضيف مباشرةً بعد عنصر بعينه — لإدخال عنصر بين عنصرين بلا
                رحلةِ أسهم إلى أعلى. */
      let area: 'header' | 'footer';
      let parent: number | null;
      let kind: string;
      let at: number;

      const sibs = async (a: string, p: number | null) =>
        q<Row>('SELECT id FROM nav_items WHERE area = ? AND parent_id <=> ? ORDER BY position, id', [a, p]);

      if (what === 'after') {
        const ref = await q1<Row>('SELECT * FROM nav_items WHERE id = ?', [Number(rest[0])]);
        if (!ref) redirect('/admin/nav');
        area = ref.area;
        parent = ref.parent_id;
        kind = rest[1] || 'plain';
        const list = await sibs(area, parent);
        at = list.findIndex((s) => s.id === ref.id) + 1;
        for (let k = list.length - 1; k >= at; k--) {
          await q('UPDATE nav_items SET position = ? WHERE id = ?', [k + 1, list[k].id]);
        }
      } else {
        area = rest[0] === 'footer' ? 'footer' : 'header';
        parent = rest[1] === '0' ? null : Number(rest[1]);
        kind = rest[2] || 'plain';
        at = (await sibs(area, parent)).length;
      }

      await q(
        `INSERT INTO nav_items (area, parent_id, position, label_en, label_ar, href, extra, published)
         VALUES (?,?,?,?,?,?,?,1)`,
        [area, parent, at, 'New item', 'عنصر جديد', kind === 'column' ? null : '#',
         kind !== 'plain' ? J({ kind }) : null]
      );
      msg = 'add';
    }

    await audit(u, 'nav.save', { entity: 'nav', summary: op ? `${what}${rest.length ? ` ${rest.join(':')}` : ''}` : 'حفظ النصوص والروابط' });
    refreshSite();
    redirect(`/admin/nav?ok=${msg}`);
  }

  /* ------------------------------------------------------------ العرض */
  const Op = ({ op, label, disabled, cls = 'btn--ghost', title }:
    { op: string; label: string; disabled?: boolean; cls?: string; title?: string }) => (
    <button className={`btn btn--sm ${cls}`} type="submit" name="op" value={op}
            disabled={disabled} title={title}>{label}</button>
  );

  const Item = ({ r, depth, index, count, area }:
    { r: Row; depth: number; index: number; count: number; area: string }) => {
    const kind = json<any>(r.extra, {}).kind ?? 'plain';
    const children = kids(area, r.id);
    const canHaveChildren = kind === 'mega' || kind === 'submenu' || kind === 'column';
    return (
      <div style={{ marginInlineStart: depth * 20, marginBottom: 10 }}>
        <div style={{
          border: '1px solid var(--line)', borderRadius: 8, padding: 12,
          background: depth === 0 ? '#fbfcfe' : '#fff', opacity: r.published ? 1 : 0.55,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <b style={{ fontSize: 14 }}>{r.label_ar || r.label_en}</b>
              <span className="tag">{KIND_AR[kind] ?? kind}</span>
              {r.published ? null : <span className="tag tag--off">مخفي</span>}
            </span>
            <span style={{ display: 'inline-flex', gap: 5 }}>
              <Op op={`move:${r.id}:-1`} label="↑" disabled={index === 0} title="أعلى" />
              <Op op={`move:${r.id}:1`} label="↓" disabled={index === count - 1} title="أسفل" />
              <Op op={`after:${r.id}:${kind === 'column' ? 'plain' : kind === 'mega' ? 'mega' : 'plain'}`}
                  label="+ تحته" title="أضف عنصرًا جديدًا تحت هذا مباشرةً" />
              <Op op={`vis:${r.id}`} label={r.published ? 'إخفاء' : 'إظهار'} />
              <Op op={`del:${r.id}`} label="حذف" cls="btn--bad" />
            </span>
          </div>

          <div className="row" style={{ gap: 10 }}>
            <input type="text" name={`i${r.id}.label_ar`} defaultValue={r.label_ar ?? ''} placeholder="الاسم بالعربية" />
            <input type="text" dir="ltr" name={`i${r.id}.label_en`} defaultValue={r.label_en ?? ''} placeholder="English" />
          </div>

          {kind === 'column' ? (
            <input type="hidden" name={`i${r.id}.href`} value={r.href ?? ''} />
          ) : (
            <div style={{ marginTop: 10 }}>
              <input type="text" dir="ltr" name={`i${r.id}.href`} defaultValue={r.href ?? ''}
                     placeholder="ينقل إلى — مثل parts.html أو generators.html#rental" />
            </div>
          )}

          {depth > 0 && kind !== 'column' ? (
            <div className="row" style={{ gap: 10, marginTop: 10 }}>
              <input type="text" name={`i${r.id}.desc_ar`} defaultValue={r.desc_ar ?? ''} placeholder="وصف صغير بالعربية (اختياري)" />
              <input type="text" dir="ltr" name={`i${r.id}.desc_en`} defaultValue={r.desc_en ?? ''} placeholder="Small description (optional)" />
            </div>
          ) : null}

          {canHaveChildren ? (
            <div style={{ marginTop: 10 }}>
              <Op op={`add:${area}:${r.id}:${kind === 'mega' ? 'column' : 'plain'}`}
                  label={kind === 'mega' ? '+ عمود جديد' : '+ رابط جديد'} />
            </div>
          ) : null}
        </div>

        {children.map((c, i) => (
          <Item key={c.id} r={c} depth={depth + 1} index={i} count={children.length} area={area} />
        ))}
      </div>
    );
  };

  const MSG: Record<string, string> = {
    save: 'حُفظت الأسماء والروابط.', add: 'أُضيف عنصر — عدّل اسمه ورابطه ثم احفظ.',
    del: 'حُذف العنصر وما تحته — تقدر ترجعه كاملًا من «التراجع عن تعديل».', move: 'تغيّر الترتيب.', vis: 'تغيّرت حالة الظهور.',
  };

  const header = kids('header', null);
  const footer = kids('footer', null);

  return (
    <Shell user={user} here="/admin/nav" title="المنيو والفوتر"
           trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub="القائمة أعلى الموقع والأعمدة أسفله. الترتيب هنا هو ترتيب الظهور.">
      {saved ? <p className="msg msg--ok">{MSG[saved] ?? 'تم.'}</p> : null}

      <form action={submit}>
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head">
            <h2>القائمة أعلى الموقع</h2>
            <span style={{ display: 'flex', gap: 6 }}>
              <Op op="add:header:0:plain" label="+ رابط" />
              <Op op="add:header:0:submenu" label="+ قائمة منسدلة" />
              <Op op="add:header:0:mega" label="+ قائمة بأعمدة" />
            </span>
          </div>
          <div className="panel__body">
            {header.map((r, i) => (
              <Item key={r.id} r={r} depth={0} index={i} count={header.length} area="header" />
            ))}
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel__head">
            <h2>أعمدة الفوتر</h2>
            <Op op="add:footer:0:column" label="+ عمود" />
          </div>
          <div className="panel__body">
            {footer.map((r, i) => (
              <Item key={r.id} r={r} depth={0} index={i} count={footer.length} area="footer" />
            ))}
          </div>
        </div>

        <button className="btn" type="submit">احفظ</button>
        <p className="field__hint">
          أي زرّ هنا يحفظ ما كتبته أولًا ثم ينفّذ ما طلبه، فلا يضيع تعديل.
        </p>
      </form>
    </Shell>
  );
}
