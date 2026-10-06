/* إدارة حساب أدمن واحد — للسوبر أدمن وحده.

   بياناته، وصلاحياته (سويتشات)، وتفعيله أو إيقافه، وتغيير كلمة مروره، وحذفه.
   التغيير يسري فورًا: الصلاحيات تُقرأ مع كل طلب، والإيقاف وتغيير كلمة المرور
   يرفعان نسخة الجلسة فيخرج صاحبها من اللوحة.

   حماية: الحساب الأساسي لا يُحذف ولا يُوقف ولا يُنزَل دوره، ولا يحذف أحد نفسه
   أو يوقفها. وكل عملية في سجل العمليات بقيمتها قبل وبعد (بلا كلمات مرور). */
import { notFound, redirect } from 'next/navigation';
import { requireSuper, hashPassword } from '@/lib/auth';
import { q, q1, when } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { PermSwitches, PasswordField } from '@/components/admin/PermSwitches';
import { ConfirmButton } from '@/components/ConfirmButton';
import { PRESETS, cleanPerms, PERMISSION_LABEL } from '@/lib/permissions';
import { audit } from '@/lib/audit';
import { removePrivate } from '@/lib/private';

export const dynamic = 'force-dynamic';

const MSG: Record<string, [string, boolean]> = {
  saved: ['حُفظت البيانات.', true],
  perms: ['حُفظت الصلاحيات — تسري من الضغطة التالية للموظف.', true],
  password: ['غُيّرت كلمة المرور، وخرج الموظف من أي جهاز كان داخلًا منه.', true],
  on: ['فُعّل الحساب.', true],
  off: ['أُوقف الحساب، وخرج صاحبه من اللوحة فورًا.', true],
  email: ['البريد غير صحيح.', false],
  dup: ['هذا البريد مستعمل في حساب آخر.', false],
  short: ['كلمة المرور قصيرة — 10 أحرف على الأقل.', false],
  owner: ['الحساب الأساسي محمي: لا يُحذف ولا يُوقف ولا يتغيّر دوره.', false],
  self: ['لا تقدر توقف حسابك أو تحذفه بنفسك.', false],
};

const parsePerms = (v: any): string[] => {
  try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a : []; } catch { return []; }
};
/* كل عملية تقرأ الحساب من جديد: ما رُسم قد يكون قديمًا.
   خارج الصفحة عمدًا: دالة داخلها لا تُمرَّر لإجراءات الخادم. */
async function fresh(id: number) {
  const r = await q1<any>('SELECT * FROM users WHERE id = ?', [id]);
  if (!r) redirect('/admin/users');
  return r;
}

const pub = (r: any) => ({ email: r.email, name: r.name, phone: r.phone, role: r.role, active: r.active, preset: r.preset, perms: parsePerms(r.perms) });

export default async function UserPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; e?: string }> }) {
  const me = await requireSuper();
  const id = Number((await params).id);
  const sp = await searchParams;
  const user = await q1<any>('SELECT * FROM users WHERE id = ?', [id]);
  if (!user) notFound();
  const back = `/admin/users/${id}`;
  const isSelf = user.id === me.id;
  const owner = Boolean(user.is_owner);


  async function saveInfo(form: FormData) {
    'use server';
    const u = await requireSuper();
    const before = await fresh(id);
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const name = String(form.get('name') ?? '').trim() || null;
    const phone = String(form.get('phone') ?? '').trim() || null;
    const role = before.is_owner ? 'super' : (form.get('role') === 'super' ? 'super' : 'admin');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect(`${back}?e=email`);
    if (await q1('SELECT id FROM users WHERE email = ? AND id <> ?', [email, id])) redirect(`${back}?e=dup`);
    if (before.is_owner && form.get('role') === 'admin') redirect(`${back}?e=owner`);
    await q('UPDATE users SET email = ?, name = ?, phone = ?, role = ? WHERE id = ?', [email, name, phone, role, id]);
    await audit(u, 'user.update', {
      entity: 'user', id, summary: name ?? email,
      before: { email: before.email, name: before.name, phone: before.phone, role: before.role },
      after: { email, name, phone, role },
    });
    redirect(`${back}?ok=saved`);
  }

  async function savePerms(form: FormData) {
    'use server';
    const u = await requireSuper();
    const before = await fresh(id);
    let perms: string[] = [];
    try { perms = cleanPerms(JSON.parse(String(form.get('perms') ?? '[]'))); } catch { /* فارغة */ }
    const preset = PRESETS.some((p) => p.key === form.get('preset')) ? String(form.get('preset')) : null;
    await q('UPDATE users SET perms = ?, preset = ? WHERE id = ?', [JSON.stringify(perms), preset, id]);
    const was = parsePerms(before.perms);
    const added = perms.filter((p) => !was.includes(p)), removed = was.filter((p) => !perms.includes(p));
    await audit(u, 'user.perms', {
      entity: 'user', id,
      summary: `${before.name ?? before.email}: ${[
        added.length ? `فُتح ${added.map((p) => PERMISSION_LABEL[p] ?? (p === '*' ? 'الكل' : p)).join('، ')}` : '',
        removed.length ? `قُفل ${removed.map((p) => PERMISSION_LABEL[p] ?? (p === '*' ? 'الكل' : p)).join('، ')}` : '',
      ].filter(Boolean).join(' · ') || 'بلا تغيير'}`,
      before: { perms: was, preset: before.preset }, after: { perms, preset },
    });
    redirect(`${back}?ok=perms`);
  }

  async function setPassword(form: FormData) {
    'use server';
    const u = await requireSuper();
    const before = await fresh(id);
    const password = String(form.get('password') ?? '');
    if (password.length < 10) redirect(`${back}?e=short`);
    /* نسخة جلسة جديدة: كل جلسة قديمة لهذا الحساب تبطل — إلا جلستي إن غيّرت كلمتي */
    await q('UPDATE users SET password_hash = ?, session_ver = session_ver + 1 WHERE id = ?', [await hashPassword(password), id]);
    await audit(u, 'user.password', { entity: 'user', id, summary: before.name ?? before.email });
    if (before.id === u.id) redirect('/admin/login');
    redirect(`${back}?ok=password`);
  }

  async function setActive(form: FormData) {
    'use server';
    const u = await requireSuper();
    const before = await fresh(id);
    const on = form.get('on') === '1';
    if (!on && before.is_owner) redirect(`${back}?e=owner`);
    if (!on && before.id === u.id) redirect(`${back}?e=self`);
    await q(`UPDATE users SET active = ?${on ? '' : ', session_ver = session_ver + 1'} WHERE id = ?`, [on ? 1 : 0, id]);
    await audit(u, on ? 'user.activate' : 'user.deactivate', { entity: 'user', id, summary: before.name ?? before.email });
    redirect(`${back}?ok=${on ? 'on' : 'off'}`);
  }

  async function remove() {
    'use server';
    const u = await requireSuper();
    const before = await fresh(id);
    if (before.is_owner) redirect(`${back}?e=owner`);
    if (before.id === u.id) redirect(`${back}?e=self`);
    /* طلباته تبقى، وتصير بلا مسؤول فتظهر للباقين */
    await q('UPDATE requests SET assigned_to = NULL WHERE assigned_to = ?', [id]);
    await q('DELETE FROM notifications WHERE user_id = ?', [id]);
    /* صور الوجه والحضور على القرص (الصفوف تُحذف مع الحساب) — بيانات حيوية لا تبقى بعده */
    const pics = await q<any>(
      `SELECT photo AS p FROM face_profiles WHERE user_id = ?
        UNION ALL SELECT in_photo FROM attendance WHERE user_id = ? UNION ALL SELECT out_photo FROM attendance WHERE user_id = ?`, [id, id, id]
    );
    await q('DELETE FROM users WHERE id = ?', [id]);
    for (const x of pics) await removePrivate(x.p);
    await audit(u, 'user.delete', { entity: 'user', id, summary: before.name ?? before.email, before: pub(before) });
    redirect('/admin/users?ok=deleted');
  }

  const msg = sp.ok ? MSG[sp.ok] : sp.e ? MSG[sp.e] : null;
  const isSuperUser = user.role === 'super';

  return (
    <Shell user={me} here="/admin/users" title={user.name || user.email}
           sub={`${isSuperUser ? 'سوبر أدمن' : 'أدمن'}${owner ? ' · الحساب الأساسي (محمي)' : ''} · آخر دخول: ${user.last_login_at ? when(user.last_login_at) : 'لم يدخل بعد'}`}
           trail={[{ label: 'لوحة التحكم', href: '/admin' }, { label: 'الأدمنز والصلاحيات', href: '/admin/users' }]}>
      {msg ? <p className={`msg ${msg[1] ? 'msg--ok' : 'msg--bad'}`}>{msg[0]}</p> : null}
      {!user.active ? <p className="msg msg--bad">هذا الحساب موقوف: لا يقدر صاحبه يدخل اللوحة.</p> : null}

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__head"><h2>البيانات</h2></div>
        <div className="panel__body">
          <form action={saveInfo}>
            <div className="row">
              <div className="field"><label htmlFor="name">الاسم</label><input id="name" name="name" type="text" defaultValue={user.name ?? ''} /></div>
              <div className="field"><label htmlFor="email">البريد (للدخول)</label><input id="email" name="email" type="email" dir="ltr" defaultValue={user.email} required /></div>
            </div>
            <div className="row">
              <div className="field"><label htmlFor="phone">الموبايل</label><input id="phone" name="phone" type="tel" dir="ltr" defaultValue={user.phone ?? ''} /></div>
              <div className="field">
                <label htmlFor="role">الدور</label>
                <select id="role" name="role" defaultValue={user.role} disabled={owner}>
                  <option value="admin">أدمن — بالصلاحيات</option>
                  <option value="super">سوبر أدمن — كل شيء</option>
                </select>
                {owner ? <p className="field__hint">الحساب الأساسي سوبر أدمن دائمًا.</p> : null}
              </div>
            </div>
            <button className="btn" type="submit">احفظ البيانات</button>
          </form>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__head"><h2>الصلاحيات</h2></div>
        <div className="panel__body">
          {isSuperUser ? (
            <p className="field__hint" style={{ margin: 0 }}>السوبر أدمن عنده كل الصلاحيات. لتحديد صلاحياته، غيّر دوره إلى «أدمن» أولًا.</p>
          ) : (
            <form action={savePerms}>
              <PermSwitches initial={parsePerms(user.perms)} preset={user.preset} />
              <button className="btn" type="submit" style={{ marginTop: 16 }}>احفظ الصلاحيات</button>
            </form>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__head"><h2>كلمة المرور</h2></div>
        <div className="panel__body">
          <form action={setPassword}>
            <PasswordField label="كلمة مرور جديدة" />
            <ConfirmButton className="btn" message={isSelf ? 'تغيير كلمة مرورك؟ ستحتاج تدخل بها من جديد.' : 'تغيير كلمة المرور؟ سيخرج الموظف من أي جهاز كان داخلًا منه.'}>
              غيّر كلمة المرور
            </ConfirmButton>
          </form>
        </div>
      </div>

      {!owner && !isSelf ? (
        <div className="panel" style={{ borderColor: '#f3c7c2' }}>
          <div className="panel__head"><h2>الحساب</h2></div>
          <div className="panel__body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <form action={setActive}>
              <input type="hidden" name="on" value={user.active ? '0' : '1'} />
              {user.active
                ? <ConfirmButton className="btn btn--ghost" message="إيقاف الحساب؟ سيخرج صاحبه من اللوحة فورًا، وتقدر تفعّله بعدين.">أوقف الحساب</ConfirmButton>
                : <button className="btn" type="submit">فعّل الحساب</button>}
            </form>
            <form action={remove}>
              <ConfirmButton className="btn btn--bad" message={`حذف حساب «${user.name || user.email}» نهائيًا؟\nطلباته تبقى وتصير بلا مسؤول. الأفضل غالبًا «أوقف الحساب».`}>
                احذف الحساب
              </ConfirmButton>
            </form>
            <span className="field__hint" style={{ margin: 0 }}>الإيقاف يحفظ الحساب وتاريخه — والحذف نهائي.</span>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
