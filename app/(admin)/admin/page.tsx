/* نظرة عامة: أرقام الموقع، وآخر ما عُدِّل، ومداخل سريعة لأكثر ما يُستعمل. */
import { requireUser } from '@/lib/auth';
import { q, when } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { PERMISSION_LABEL } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

async function counts() {
  const one = async (sql: string) => (await q<{ n: number }>(sql))[0].n;
  const [pages, sections, products, media, translations] = await Promise.all([
    one('SELECT COUNT(*) n FROM pages WHERE published = 1'),
    one('SELECT COUNT(*) n FROM sections'),
    one('SELECT COUNT(*) n FROM products WHERE published = 1'),
    one('SELECT COUNT(*) n FROM media'),
    one('SELECT COUNT(*) n FROM translations'),
  ]);
  return { pages, sections, products, media, translations };
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const deniedMsg = !denied ? null : denied === 'super'
    ? 'هذه الشاشة للسوبر أدمن وحده.'
    : `ليست لديك صلاحية «${PERMISSION_LABEL[denied] ?? denied}». اطلبها من السوبر أدمن.`;
  const n = await counts();
  const recent = await q<any>(
    `SELECT slug, crumb_ar, crumb_en, updated_at FROM pages
      ORDER BY updated_at DESC LIMIT 6`
  );

  return (
    <Shell user={user} here="/admin" title={`أهلًا، ${user.name || 'بك'}`}
           sub="كل ما في الموقع يُعدَّل من هنا، ويظهر للزائر فور الحفظ.">
      {deniedMsg ? <p className="msg msg--bad" role="alert">{deniedMsg}</p> : null}
      <div className="grid grid--4" style={{ marginBottom: 22 }}>
        <div className="stat stat--fill stat--1"><b>{n.pages}</b><span>صفحة منشورة</span></div>
        <div className="stat stat--fill stat--2"><b>{n.sections}</b><span>قسم</span></div>
        <div className="stat stat--fill stat--3"><b>{n.products}</b><span>منتج</span></div>
        <div className="stat stat--4"><b>{n.media}</b><span>ملف في المكتبة</span></div>
        <div className="stat"><b>{n.translations}</b><span>نص مترجم</span></div>
      </div>

      <div className="panel">
        <div className="panel__head">
          <h2>آخر ما عُدِّل</h2>
          <a className="btn btn--ghost btn--sm" href="/admin/pages">كل الصفحات</a>
        </div>
        <table>
          <thead><tr><th>الصفحة</th><th>المسار</th><th>آخر تعديل</th><th /></tr></thead>
          <tbody>
            {recent.map((p) => (
              <tr key={p.slug}>
                <td>{p.crumb_ar || p.crumb_en || p.slug}</td>
                <td><code dir="ltr">{p.slug}.html</code></td>
                <td><small dir="ltr">{when(p.updated_at)}</small></td>
                <td style={{ textAlign: 'end' }}>
                  <a className="btn btn--ghost btn--sm" href={`/admin/pages/${p.slug}`}>تعديل</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
