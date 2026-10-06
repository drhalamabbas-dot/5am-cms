/* حسابي: بيانات الموظف وصلاحياته، وتغيير كلمة مروره بنفسه (بكلمته الحالية).
   تغيير الكلمة يُخرجه من أي جهاز آخر كان داخلًا منه. */
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { requireUser, hashPassword, startSession } from '@/lib/auth';
import { q, q1 } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { PasswordField } from '@/components/admin/PermSwitches';
import { PERMISSION_GROUPS, can, isSuper } from '@/lib/permissions';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ ok?: string; e?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;

  async function changePassword(form: FormData) {
    'use server';
    const u = await requireUser();
    const row = await q1<any>('SELECT password_hash FROM users WHERE id = ?', [u.id]);
    if (!row || !(await bcrypt.compare(String(form.get('current') ?? ''), row.password_hash))) redirect('/admin/account?e=current');
    const password = String(form.get('password') ?? '');
    if (password.length < 10) redirect('/admin/account?e=short');
    await q('UPDATE users SET password_hash = ?, session_ver = session_ver + 1 WHERE id = ?', [await hashPassword(password), u.id]);
    /* جلسة جديدة لهذا الجهاز بالنسخة الجديدة؛ الأجهزة الأخرى تخرج */
    await startSession(u);
    await audit(u, 'account.password', { entity: 'user', id: u.id });
    redirect('/admin/account?ok=1');
  }

  return (
    <Shell user={me} here="/admin/account" title="حسابي" trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub={`${me.email} · ${isSuper(me) ? 'سوبر أدمن' : 'أدمن'}`}>
      {sp.ok ? <p className="msg msg--ok">غُيّرت كلمة المرور. أي جهاز آخر كنت داخلًا منه خرج.</p> : null}
      {sp.e === 'current' ? <p className="msg msg--bad">كلمة المرور الحالية غير صحيحة.</p> : null}
      {sp.e === 'short' ? <p className="msg msg--bad">كلمة المرور الجديدة قصيرة — 10 أحرف على الأقل.</p> : null}

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__head"><h2>تغيير كلمة المرور</h2></div>
        <div className="panel__body">
          <form action={changePassword}>
            <div className="field">
              <label htmlFor="current">كلمة المرور الحالية</label>
              <input id="current" name="current" type="password" dir="ltr" required autoComplete="current-password" />
            </div>
            <PasswordField label="كلمة المرور الجديدة" hint="10 أحرف على الأقل. احفظها في مكان آمن؛ أي جهاز آخر داخل بحسابك سيخرج." />
            <button className="btn" type="submit">غيّر كلمة المرور</button>
          </form>
        </div>
      </div>

      <div className="panel">
        <div className="panel__head"><h2>صلاحياتي</h2></div>
        <div className="panel__body">
          {isSuper(me) ? <p style={{ margin: 0 }}>سوبر أدمن: كل الصلاحيات، وإدارة حسابات الأدمنز.</p> : (
            PERMISSION_GROUPS.map((g) => (
              <div key={g.title} style={{ marginBottom: 12 }}>
                <b style={{ fontSize: 14 }}>{g.title}</b>
                <ul style={{ margin: '6px 0 0', paddingInlineStart: 18, fontSize: 14 }}>
                  {g.items.map(([k, l]) => (
                    <li key={k} style={{ color: can(me, k) ? 'var(--ink)' : 'var(--muted)' }}>
                      {can(me, k) ? '✓' : '—'} {l}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
          <p className="field__hint">لتغيير صلاحياتك، كلّم السوبر أدمن.</p>
        </div>
      </div>
    </Shell>
  );
}
