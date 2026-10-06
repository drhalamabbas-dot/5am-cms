/* نصوص الواجهة: الكلمات المتكرّرة التي ليست جزءًا من صفحة بعينها —
   «اعرف المزيد»، «اطلب عرض سعر»، أسماء المواصفات، وترجمة جمل المنتجات.

   1798 نصًّا، فالبحث هو المدخل لا القائمة: يُبحث عن الكلمة الإنجليزية أو
   العربية، ويُعدَّل ما ظهر. */
import { redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { q } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { refreshSite } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const GROUPS: [string, string][] = [
  ['', 'الكل'],
  ['phrase', 'جمل المحتوى'],
  ['cta', 'الأزرار'],
  ['nav', 'المنيو'],
  ['sub', 'أسماء التصنيفات'],
  ['spec', 'أسماء المواصفات'],
  ['a11y', 'نصوص الوصول'],
];

export default async function TranslationsPage({
  searchParams,
}: { searchParams: Promise<{ q?: string; g?: string; ok?: string }> }) {
  const user = await requirePerm('translations.edit');
  const sp = await searchParams;
  const term = (sp.q ?? '').trim();
  const group = sp.g ?? '';

  const where: string[] = [];
  const args: any[] = [];
  if (group) { where.push('`group` = ?'); args.push(group); }
  if (term) { where.push('(`key` LIKE ? OR en LIKE ? OR ar LIKE ?)'); args.push(`%${term}%`, `%${term}%`, `%${term}%`); }

  const rows = await q<any>(
    `SELECT \`key\`, en, ar, \`group\` FROM translations
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY \`group\`, \`key\` LIMIT 200`,
    args
  );
  const [{ n }] = await q<{ n: number }>(
    `SELECT COUNT(*) n FROM translations ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`,
    args
  );

  async function save(form: FormData) {
    'use server';
    const who = await requirePerm('translations.edit');
    const changed: string[] = [];
    for (const r of rows) {
      const v = form.get(`t.${r.key}`);
      if (v == null) continue;
      const ar = String(v).trim();
      if (ar === (r.ar ?? '')) continue;
      await q('UPDATE translations SET ar = ? WHERE `key` = ?', [ar || null, r.key]);
      changed.push(r.key);
    }
    if (changed.length) await audit(who, 'translations.save', { entity: 'translations', summary: `${changed.length} نص: ${changed.slice(0, 8).join('، ')}` });
    refreshSite();
    const u = new URLSearchParams();
    if (term) u.set('q', term);
    if (group) u.set('g', group);
    u.set('ok', '1');
    redirect(`/admin/translations?${u}`);
  }

  return (
    <Shell user={user} here="/admin/translations" title="نصوص الواجهة"
           trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub="الكلمات المتكرّرة في كل الصفحات. ابحث عن النص ثم عدّل ترجمته العربية.">
      {sp.ok ? <p className="msg msg--ok">حُفظت الترجمة.</p> : null}

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel__body">
          <form method="get" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 240px' }}>
              <label htmlFor="q">ابحث</label>
              <input id="q" name="q" type="search" defaultValue={term} placeholder="اكتب كلمة بالعربية أو الإنجليزية…" />
            </div>
            <div style={{ flex: '0 1 200px' }}>
              <label htmlFor="g">المجموعة</label>
              <select id="g" name="g" defaultValue={group}>
                {GROUPS.map(([v, l]) => <option value={v} key={v}>{l}</option>)}
              </select>
            </div>
            <button className="btn" type="submit">ابحث</button>
          </form>
        </div>
      </div>

      <form action={save}>
        <div className="panel">
          <div className="panel__head">
            <h2>{n} نص{n > rows.length ? ` — يظهر منها ${rows.length}` : ''}</h2>
            <small>{n > rows.length ? 'ضيّق البحث لترى الباقي' : ''}</small>
          </div>
          {rows.length === 0 ? <p className="empty">لا نتائج.</p> : (
            <table>
              <thead><tr><th style={{ width: '45%' }}>الإنجليزية</th><th>العربية</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td dir="ltr" style={{ fontSize: 13.5 }}>
                      {r.en || <code>{r.key}</code>}
                      {r.en ? <><br /><small style={{ opacity: 0.6 }}>{r.group}</small></> : null}
                    </td>
                    <td>
                      <input type="text" name={`t.${r.key}`} defaultValue={r.ar ?? ''} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {rows.length ? <button className="btn" type="submit" style={{ marginTop: 18 }}>احفظ الترجمة</button> : null}
      </form>
    </Shell>
  );
}
