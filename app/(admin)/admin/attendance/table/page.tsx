/* جدول حضور الأدمنز — للسوبر أدمن وحده: الشهر كله، مجموع كل موظف، وصورة كل
   حضور وانصراف. ما لم يتعرّف فيه النظام على الوجه يظهر «للمراجعة» فيُقبل أو
   يُرفض. ومنه يُضبط موقع المكتب، وتُمسح بصمة وجه لإعادة تسجيلها. */
import { redirect } from 'next/navigation';
import { requireSuper } from '@/lib/auth';
import { q, q1, when } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { ConfirmButton } from '@/components/ConfirmButton';
import { OfficeLocate } from '@/components/admin/OfficeLocate';
import { audit } from '@/lib/audit';
import { removePrivate } from '@/lib/private';
import { getAttSettings, cairoNow, duration, minutes, ATT_STATUS } from '@/lib/attendance';
import { clip } from '@/lib/requests';
import { refreshSite } from '@/lib/admin';

export const dynamic = 'force-dynamic';

type SP = { m?: string; u?: string; s?: string; ok?: string };
const time = (v: unknown) => (v ? when(v).split(' · ')[1] : '—');
const photo = (rel: string | null, label: string) => rel
  ? <a href={`/api/admin/attendance/photo?f=${encodeURIComponent(rel)}`} target="_blank" rel="noopener" title={label}>
      <img className="att__thumb" src={`/api/admin/attendance/photo?f=${encodeURIComponent(rel)}`} alt={label} loading="lazy" />
    </a>
  : null;
const hm = (m: number) => `${Math.floor(m / 60)} س ${m % 60} د`;

export default async function AttendanceTable({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireSuper();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? '') ? sp.m! : cairoNow().day.slice(0, 7);
  const uid = Number(sp.u) || 0;
  const s = await getAttSettings();

  const where = ['a.day BETWEEN ? AND LAST_DAY(?)'];
  const args: unknown[] = [`${month}-01`, `${month}-01`];
  if (uid) { where.push('a.user_id = ?'); args.push(uid); }
  if (sp.s === 'review') where.push("a.status = 'review'");
  const [rows, users, faces, pending] = await Promise.all([
    q<any>(`SELECT a.*, u.name, u.email FROM attendance a JOIN users u ON u.id = a.user_id
             WHERE ${where.join(' AND ')} ORDER BY a.day DESC, u.name`, args),
    q<any>('SELECT id, name, email, active FROM users ORDER BY name'),
    q<any>('SELECT f.user_id, f.photo, f.created_at FROM face_profiles f'),
    q1<any>("SELECT COUNT(*) n FROM attendance WHERE status = 'review'"),
  ]);
  const faceOf = new Map(faces.map((f) => [f.user_id, f]));
  /* مجموع الشهر لكل موظف */
  const totals = new Map<number, { name: string; days: number; mins: number; review: number }>();
  for (const r of rows) {
    const t = totals.get(r.user_id) ?? { name: r.name || r.email, days: 0, mins: 0, review: 0 };
    if (r.check_in && r.status !== 'rejected') t.days++;
    if (r.status !== 'rejected') t.mins += minutes(r.check_in, r.check_out);
    if (r.status === 'review') t.review++;
    totals.set(r.user_id, t);
  }

  async function review(form: FormData) {
    'use server';
    const u = await requireSuper();
    const id = Number(form.get('id'));
    const to = form.get('to') === 'rejected' ? 'rejected' : 'ok';
    const row = await q1<any>('SELECT a.id, a.day, u.name, u.email FROM attendance a JOIN users u ON u.id = a.user_id WHERE a.id = ?', [id]);
    if (!row) redirect('/admin/attendance/table');
    const note = clip(form.get('note'), 200);
    await q('UPDATE attendance SET status = ?, note = COALESCE(?, note), reviewed_by = ?, reviewed_at = NOW() WHERE id = ?', [to, note, u.id, id]);
    await audit(u, 'attendance.review', { entity: 'attendance', id, summary: `${row.name || row.email} · ${when(row.day).split(' · ')[0]}: ${to === 'ok' ? 'قُبل' : 'رُفض'}${note ? ` (${note})` : ''}` });
    redirect(String(form.get('back') || '/admin/attendance/table'));
  }

  async function resetFace(form: FormData) {
    'use server';
    const u = await requireSuper();
    const id = Number(form.get('user'));
    const f = await q1<any>('SELECT f.photo, u.name, u.email FROM face_profiles f JOIN users u ON u.id = f.user_id WHERE f.user_id = ?', [id]);
    if (f) {
      await q('DELETE FROM face_profiles WHERE user_id = ?', [id]);
      await removePrivate(f.photo);
      await audit(u, 'attendance.reset', { entity: 'user', id, summary: f.name || f.email });
    }
    redirect('/admin/attendance/table?ok=reset');
  }

  async function saveOffice(form: FormData) {
    'use server';
    const u = await requireSuper();
    const before = await getAttSettings();
    const lat = Number(form.get('lat')), lng = Number(form.get('lng')), radius = Number(form.get('radius'));
    const next = {
      lat: Number.isFinite(lat) && Math.abs(lat) <= 90 && lat !== 0 ? lat : before.lat,
      lng: Number.isFinite(lng) && Math.abs(lng) <= 180 && lng !== 0 ? lng : before.lng,
      radius: [100, 200, 300, 500, 1000].includes(radius) ? radius : before.radius,
      threshold: before.threshold,
    };
    await q(`INSERT INTO settings (\`key\`, \`value\`, \`group\`, label_en, label_ar) VALUES ('attendance', ?, 'attendance', 'Attendance', 'الحضور والانصراف')
             ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`, [JSON.stringify(next)]);
    await audit(u, 'attendance.settings', { entity: 'setting', id: 'attendance', before, after: next });
    refreshSite();
    redirect('/admin/attendance/table?ok=office');
  }

  const link = (o: Partial<SP>) => {
    const p = new URLSearchParams();
    const m = { m: month, u: uid ? String(uid) : undefined, s: sp.s, ...o };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, String(v));
    return `/admin/attendance/table?${p}`;
  };
  const shift = (n: number) => {
    const [y, mo] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, mo - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  const back = link({});

  return (
    <Shell user={me} here="/admin/attendance/table" title="جدول حضور الأدمنز"
           trail={[{ label: 'لوحة التحكم', href: '/admin' }, { label: 'حضوري وانصرافي', href: '/admin/attendance' }]}
           sub={`شهر ${month}${pending?.n ? ` · ${pending.n} للمراجعة` : ''}. الساعات مرنة: الجدول يحسب المدة، بلا «تأخير».`}
           actions={<a className="btn btn--ghost" href={`/api/admin/attendance/export?m=${month}${uid ? `&u=${uid}` : ''}`}>تصدير الشهر (Excel)</a>}>
      {sp.ok === 'reset' ? <p className="msg msg--ok">مُسحت بصمة الوجه وصورتها. يسجّل الموظف وجهه من جديد عند أول دخول لشاشة الحضور.</p> : null}
      {sp.ok === 'office' ? <p className="msg msg--ok">حُفظ موقع المكتب.</p> : null}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <a className="btn btn--sm btn--ghost" href={link({ m: shift(-1) })}>→ الشهر السابق</a>
          <b>{month}</b>
          <a className="btn btn--sm btn--ghost" href={link({ m: shift(1) })}>الشهر التالي ←</a>
          <span style={{ flex: 1 }} />
          <a className={`btn btn--sm ${sp.s === 'review' ? '' : 'btn--ghost'}`} href={link({ s: sp.s === 'review' ? undefined : 'review' })}>للمراجعة فقط</a>
          <form method="get" style={{ display: 'flex', gap: 6 }}>
            <input type="hidden" name="m" value={month} />
            {sp.s ? <input type="hidden" name="s" value={sp.s} /> : null}
            <select name="u" defaultValue={uid || ''} aria-label="الموظف" style={{ width: 'auto' }}>
              <option value="">كل الأدمنز</option>
              {users.map((x) => <option key={x.id} value={x.id}>{x.name || x.email}</option>)}
            </select>
            <button className="btn btn--sm btn--ghost" type="submit">اعرض</button>
          </form>
        </div>
      </div>

      {totals.size ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel__head"><h2>مجموع الشهر</h2></div>
          <table>
            <thead><tr><th>الموظف</th><th>أيام الحضور</th><th>مجموع الساعات</th><th>متوسط اليوم</th><th>للمراجعة</th></tr></thead>
            <tbody>
              {[...totals.entries()].map(([id, t]) => (
                <tr key={id}>
                  <td><a href={link({ u: String(id) })}>{t.name}</a></td>
                  <td>{t.days}</td><td>{hm(t.mins)}</td><td>{t.days ? hm(Math.round(t.mins / t.days)) : '—'}</td>
                  <td>{t.review ? <span className="tag tag--todo">{t.review}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="panel" style={{ marginBottom: 20 }}>
        {rows.length ? (
          <table className="att">
            <thead><tr><th>اليوم</th><th>الموظف</th><th>حضور</th><th>انصراف</th><th>المدة</th><th>البعد عن المكتب</th><th>الحالة</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={r.status === 'review' ? { background: '#fff8f0' } : r.status === 'rejected' ? { opacity: 0.6 } : undefined}>
                  <td><small dir="ltr">{when(r.day).split(' · ')[0]}</small></td>
                  <td>{r.name || r.email}</td>
                  <td><span className="att__cell">{photo(r.in_photo, 'صورة الحضور')}<span>{time(r.check_in)}{r.in_match != null ? <small title="مسافة البصمة: حتى 0.5 = نفس الشخص"> · {Number(r.in_match).toFixed(2)}</small> : null}</span></span></td>
                  <td><span className="att__cell">{photo(r.out_photo, 'صورة الانصراف')}<span>{time(r.check_out)}{r.out_match != null ? <small> · {Number(r.out_match).toFixed(2)}</small> : null}</span></span></td>
                  <td><small>{duration(r.check_in, r.check_out)}</small></td>
                  <td><small>{r.in_dist != null ? `${r.in_dist} م` : '—'}{r.out_dist != null ? ` / ${r.out_dist} م` : ''}</small></td>
                  <td>
                    <span className={`tag ${ATT_STATUS[r.status]?.[1] ?? ''}`}>{ATT_STATUS[r.status]?.[0] ?? r.status}</span>
                    {r.note ? <><br /><small>{r.note}</small></> : null}
                    {r.status === 'review' ? (
                      <form action={review} style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        <input type="hidden" name="id" value={r.id} /><input type="hidden" name="back" value={back} />
                        <button className="btn btn--sm" name="to" value="ok" type="submit">اقبل</button>
                        <button className="btn btn--sm btn--bad" name="to" value="rejected" type="submit">ارفض</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="panel__body"><p style={{ margin: 0 }}>لا حضور مسجّل في هذا الشهر{uid || sp.s ? ' بهذا الفلتر' : ''}.</p></div>}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <div className="panel">
          <div className="panel__head"><h2>بصمات الوجه</h2></div>
          <table>
            <tbody>
              {users.filter((x) => x.active).map((x) => {
                const f = faceOf.get(x.id);
                return (
                  <tr key={x.id}>
                    <td>{f ? photo(f.photo, 'صورة التسجيل') : null}</td>
                    <td>{x.name || x.email}<br /><small>{f ? `سجّل وجهه ${when(f.created_at).split(' · ')[0]}` : 'لم يسجّل وجهه بعد'}</small></td>
                    <td style={{ textAlign: 'end' }}>
                      {f ? (
                        <form action={resetFace}>
                          <input type="hidden" name="user" value={x.id} />
                          <ConfirmButton className="btn btn--sm btn--ghost" message="مسح بصمة الوجه وصورتها؟ يسجّل الموظف وجهه من جديد.">امسح البصمة</ConfirmButton>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel__head"><h2>موقع المكتب</h2></div>
          <div className="panel__body">
            <form action={saveOffice}>
              <div className="row">
                <div className="field"><label htmlFor="office_lat">خط العرض</label><input id="office_lat" name="lat" type="text" dir="ltr" defaultValue={s.lat ?? ''} /></div>
                <div className="field"><label htmlFor="office_lng">خط الطول</label><input id="office_lng" name="lng" type="text" dir="ltr" defaultValue={s.lng ?? ''} /></div>
              </div>
              <div className="field">
                <label htmlFor="radius">يُقبل الحضور حتى</label>
                <select id="radius" name="radius" defaultValue={String(s.radius)}>
                  {[100, 200, 300, 500, 1000].map((m) => <option key={m} value={m}>{m} متر من المكتب</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn--sm" type="submit">احفظ</button>
                <OfficeLocate />
              </div>
              <p className="field__hint">
                {s.lat != null ? <a href={`https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noopener">اعرضه على الخريطة ↗</a> : 'غير مضبوط.'}
                {' '}الأدق: اضغط «استعمل موقعي الآن» وأنت داخل المكتب.
              </p>
            </form>
          </div>
        </div>
      </div>
    </Shell>
  );
}
