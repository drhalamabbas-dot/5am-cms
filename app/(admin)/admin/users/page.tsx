/* الأدمنز والصلاحيات — للسوبر أدمن وحده.

   قائمة كل الحسابات بحالتها وآخر دخول، وإضافة أدمن جديد بصلاحياته (سويتشات أو
   دور جاهز). كل إضافة تُسجَّل في سجل العمليات. */
import { redirect } from 'next/navigation';
import { requireSuper, hashPassword } from '@/lib/auth';
import { q, q1, when } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { PermSwitches, PasswordField } from '@/components/admin/PermSwitches';
import { PRESETS, cleanPerms } from '@/lib/permissions';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const MSG: Record<string, [string, boolean]> = {
  created: ['أُضيف الحساب. أعطِ الموظف بريده وكلمة المرور التي كتبتها.', true],
  deleted: ['حُذف الحساب.', true],
  email: ['البريد غير صحيح.', false],
  dup: ['هذا البريد مستعمل في حساب آخر.', false],
  short: ['كلمة المرور قصيرة — 10 أحرف على الأقل.', false],
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const me = await requireSuper();
  const sp = await searchParams;
  const users = await q<any>(
    `SELECT id, email, name, phone, role, preset, perms, active, is_owner, last_login_at, created_at
       FROM users ORDER BY is_owner DESC, role = 'super' DESC, active DESC, name, id`
  );

  async function create(form: FormData) {
    'use server';
    const u = await requireSuper();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const name = String(form.get('name') ?? '').trim() || null;
    const phone = String(form.get('phone') ?? '').trim() || null;
    const password = String(form.get('password') ?? '');
    const role = form.get('role') === 'super' ? 'super' : 'admin';
    let perms: string[] = [];
    try { perms = cleanPerms(JSON.parse(String(form.get('perms') ?? '[]'))); } catch { /* فارغة */ }
    const preset = PRESETS.some((p) => p.key === form.get('preset')) ? String(form.get('preset')) : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect('/admin/users?e=email');
    if (password.length < 10) redirect('/admin/users?e=short');
    if (await q1('SELECT id FROM users WHERE email = ?', [email])) redirect('/admin/users?e=dup');

    const res = await q(
      `INSERT INTO users (email, password_hash, name, phone, role, perms, preset, active, created_by)
       VALUES (?,?,?,?,?,?,?,1,?)`,
      [email, await hashPassword(password), name, phone, role, JSON.stringify(role === 'super' ? [] : perms), preset, u.id]
    ) as unknown as { insertId: number };
    await audit(u, 'user.create', {
      entity: 'user', id: res.insertId, summary: `${name ?? email} (${role === 'super' ? 'سوبر أدمن' : 'أدمن'})`,
      after: { email, name, phone, role, perms, preset },
    });
    redirect('/admin/users?ok=created');
  }

  const presetLabel = (k: string | null) => PRESETS.find((p) => p.key === k)?.label;
  const permCount = (p: any) => {
    const arr = typeof p === 'string' ? JSON.parse(p) : p;
    return Array.isArray(arr) ? (arr.includes('*') ? 'كل الصلاحيات' : `${arr.length} صلاحية`) : '—';
  };
  const msg = sp.ok ? MSG[sp.ok] : sp.e ? MSG[sp.e] : null;

  return (
    <Shell user={me} here="/admin/users" title="الأدمنز والصلاحيات"
           trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub="أنت وحدك (السوبر أدمن) تضيف الحسابات وتحذفها وتغيّر كلمات مرورها وتفتح الصلاحيات وتقفلها.">
      {msg ? <p className={`msg ${msg[1] ? 'msg--ok' : 'msg--bad'}`}>{msg[0]}</p> : null}

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__head"><h2>{users.length} حساب</h2></div>
        <table>
          <thead><tr><th>الاسم</th><th>الدور</th><th>الصلاحيات</th><th>الحالة</th><th>آخر دخول</th><th /></tr></thead>
          <tbody>
            {users.map((r) => (
              <tr key={r.id} style={r.active ? undefined : { opacity: 0.6 }}>
                <td>
                  <strong>{r.name || '—'}</strong>{r.id === me.id ? <small className="tag" style={{ marginInlineStart: 6 }}>أنت</small> : null}
                  <br /><small dir="ltr">{r.email}</small>
                </td>
                <td>
                  {r.role === 'super'
                    ? <span className="tag tag--on">سوبر أدمن{r.is_owner ? ' · أساسي' : ''}</span>
                    : <span className="tag">أدمن{presetLabel(r.preset) ? ` · ${presetLabel(r.preset)}` : ''}</span>}
                </td>
                <td><small>{r.role === 'super' ? 'كل شيء' : permCount(r.perms)}</small></td>
                <td>{r.active ? <span className="tag tag--on">نشط</span> : <span className="tag tag--off">موقوف</span>}</td>
                <td><small dir="ltr">{r.last_login_at ? when(r.last_login_at) : 'لم يدخل بعد'}</small></td>
                <td style={{ textAlign: 'end' }}><a className="btn btn--sm" href={`/admin/users/${r.id}`}>إدارة</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel__head"><h2>إضافة أدمن</h2></div>
        <div className="panel__body">
          <form action={create}>
            <div className="row">
              <div className="field"><label htmlFor="name">الاسم</label><input id="name" name="name" type="text" required /></div>
              <div className="field"><label htmlFor="email">البريد (للدخول)</label><input id="email" name="email" type="email" dir="ltr" required autoComplete="off" /></div>
            </div>
            <div className="row">
              <div className="field"><label htmlFor="phone">الموبايل</label><input id="phone" name="phone" type="tel" dir="ltr" /></div>
              <div className="field">
                <label htmlFor="role">الدور</label>
                <select id="role" name="role" defaultValue="admin">
                  <option value="admin">أدمن — بالصلاحيات اللي تحددها تحت</option>
                  <option value="super">سوبر أدمن — كل شيء، ويدير الحسابات</option>
                </select>
              </div>
            </div>
            <PasswordField />
            <h3 style={{ margin: '18px 0 8px', fontSize: 15 }}>الصلاحيات</h3>
            <p className="field__hint" style={{ marginTop: 0 }}>للأدمن فقط — السوبر أدمن عنده كل شيء.</p>
            <PermSwitches initial={[]} />
            <button className="btn" type="submit" style={{ marginTop: 16 }}>أضف الحساب</button>
          </form>
        </div>
      </div>
    </Shell>
  );
}
