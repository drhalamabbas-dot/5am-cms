/* حضوري وانصرافي: لكل أدمن داخل. أول مرة يسجّل وجهه، ثم كل يوم «حضور» عند
   الوصول و«انصراف» عند الخروج — بصورة من الكاميرا ومن المكتب فقط. */
import { requireUser } from '@/lib/auth';
import { q, q1, when } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { AttendanceCam } from '@/components/admin/AttendanceCam';
import { isSuper } from '@/lib/permissions';
import { cairoNow, duration, ATT_STATUS } from '@/lib/attendance';

export const dynamic = 'force-dynamic';

const time = (v: unknown) => (v ? when(v).split(' · ')[1] : '—');

export default async function MyAttendance() {
  const me = await requireUser();
  const { day, at } = cairoNow();
  const [profile, today, open, recent] = await Promise.all([
    q1<any>('SELECT created_at FROM face_profiles WHERE user_id = ?', [me.id]),
    q1<any>('SELECT * FROM attendance WHERE user_id = ? AND day = ?', [me.id, day]),
    q1<any>(`SELECT * FROM attendance WHERE user_id = ? AND check_in IS NOT NULL AND check_out IS NULL
              AND check_in >= ? - INTERVAL 20 HOUR ORDER BY check_in DESC LIMIT 1`, [me.id, at]),
    q<any>('SELECT * FROM attendance WHERE user_id = ? ORDER BY day DESC LIMIT 14', [me.id]),
  ]);
  const mode = !profile ? 'enroll' : open ? 'out' : today?.check_in || today?.check_out ? null : 'in';

  return (
    <Shell user={me} here="/admin/attendance" title="حضوري وانصرافي" trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub="من المكتب فقط، بصورة من الكاميرا. الساعات مرنة: يُسجَّل وقت وصولك وخروجك والمدة."
           actions={isSuper(me) ? <a className="btn btn--ghost" href="/admin/attendance/table">جدول حضور الأدمنز</a> : null}>
      <div className="reqgrid">
        <div className="panel">
          <div className="panel__head">
            <h2>{mode === 'enroll' ? 'أول مرة: سجّل وجهك' : mode === 'out' ? 'أنت في الشغل الآن' : mode === 'in' ? 'لم تسجّل حضورك اليوم' : 'يومك مسجّل'}</h2>
            {open ? <span className="tag tag--on">من {time(open.check_in)}</span> : null}
          </div>
          <div className="panel__body">
            {mode === 'enroll' ? (
              <p style={{ marginTop: 0 }}>صورة واحدة لوجهك يتعرّف بها النظام عليك بعد كده. قف في إضاءة جيدة وانظر للكاميرا مباشرة، بلا نظارة شمس أو كمامة.</p>
            ) : null}
            {mode ? <AttendanceCam mode={mode} /> : (
              <p style={{ margin: 0 }}>حضور {time(today?.check_in)} · انصراف {time(today?.check_out)} · المدة {duration(today?.check_in, today?.check_out)}. إلى بكرة!</p>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel__head"><h2>آخر أيامي</h2></div>
          {recent.length ? (
            <table>
              <thead><tr><th>اليوم</th><th>حضور</th><th>انصراف</th><th>المدة</th><th /></tr></thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td><small dir="ltr">{when(r.day).split(' · ')[0]}</small></td>
                    <td>{time(r.check_in)}</td>
                    <td>{time(r.check_out)}</td>
                    <td><small>{duration(r.check_in, r.check_out)}</small></td>
                    <td>{r.status !== 'ok' ? <span className={`tag ${ATT_STATUS[r.status]?.[1] ?? ''}`} title={r.note ?? ''}>{ATT_STATUS[r.status]?.[0] ?? r.status}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="panel__body"><p style={{ margin: 0 }} className="field__hint">لا أيام مسجّلة بعد.</p></div>}
        </div>
      </div>
    </Shell>
  );
}
