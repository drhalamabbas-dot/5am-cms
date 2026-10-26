/* محادثة واحدة: الرسائل وتتحدّث وحدها، والرد للعميل، واستلامها أو إرجاعها
   للبوت أو إغلاقها. ومعها بيانات العميل وطلبه إن طلب موظفًا. */
import { notFound, redirect } from 'next/navigation';
import { requirePerm } from '@/lib/auth';
import { q, q1, when } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { AgentChat } from '@/components/admin/AgentChat';
import { can } from '@/lib/permissions';
import { CHAT_STATUS, messages, answerPending } from '@/lib/chat/conv';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePerm('chat.handle');
  const id = Number((await params).id);
  const c = await q1<any>(
    `SELECT c.*, u.name AS agent, cu.name AS cname, cu.phone AS cphone, cu.email AS cemail, cu.company AS ccompany, a.email AS aemail
       FROM chat_conversations c LEFT JOIN users u ON u.id = c.assigned_to
       LEFT JOIN customers cu ON cu.id = c.customer_id LEFT JOIN customer_accounts a ON a.id = c.account_id WHERE c.id = ?`, [id]
  );
  /* محادثةٌ لم تعد موجودة: صفحةُ 404 فارغة تترك الموظف يظنّ العطب في
     اللوحة. ويُنظَّف ما بقي يشير إليها — تنبيهٌ يقود إلى لا شيء يُضغَط
     ثانيةً وثالثة. */
  if (!c) {
    await q('DELETE FROM notifications WHERE link = ?', [`/admin/chats/${id}`]);
    return (
      <Shell title="محادثة" user={me} here="/admin/chats">
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <h2 style={{ marginTop: 0 }}>المحادثة دي مش موجودة</h2>
          <p className="field__hint" style={{ maxWidth: 440, margin: '8px auto 20px' }}>
            يمكن تكون اتمسحت، أو العميل مسح حسابه وبياناته. شِلنا التنبيه اللي كان بيوصّل لها.
          </p>
          <a className="btn" href="/admin/chats">كل المحادثات</a>
        </div>
      </Shell>
    );
  }
  const [initial, req] = await Promise.all([
    messages(id),
    q1<any>("SELECT id FROM requests WHERE kind = 'chat' AND page = ? ORDER BY id DESC LIMIT 1", [`/admin/chats/${id}`]),
  ]);
  await q('UPDATE chat_conversations SET unread_agent = 0 WHERE id = ? AND assigned_to = ?', [id, me.id]);
  await q('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND link = ? AND read_at IS NULL', [me.id, `/admin/chats/${id}`]);

  const clang = c.lang === 'en' ? 'en' : 'ar';
  async function setState(form: FormData) {
    'use server';
    const u = await requirePerm('chat.handle');
    const to = String(form.get('to'));
    if (to === 'take') await q("UPDATE chat_conversations SET status = 'human', assigned_to = ? WHERE id = ?", [u.id, id]);
    if (to === 'bot') await q("UPDATE chat_conversations SET status = 'bot', assigned_to = NULL, unread_agent = 0 WHERE id = ?", [id]);
    if (to === 'close') await q("UPDATE chat_conversations SET status = 'closed', unread_agent = 0 WHERE id = ?", [id]);
    if (to === 'close' || to === 'bot') {
      await q("INSERT INTO chat_messages (conversation_id, role, text) VALUES (?, 'system', ?)",
        [id, to === 'close' ? (clang === 'en' ? 'This conversation was closed. Write again any time to start a new one.' : 'اتقفلت المحادثة. اكتب لنا في أي وقت تبدأ محادثة جديدة.')
                            : (clang === 'en' ? 'You are back with the assistant.' : 'رجعت للمساعد الآلي.')]);
    }
    /* سؤال وصل والمحادثة مع موظف يبقى بلا جواب: البوت يصمت عمدًا كي لا يقاطع
       الموظف، فإن أعادها الموظف إلى البوت ولم يكن ردّ، ظلّ العميل ينتظر ردًّا
       لن يأتي. فيُجاب هنا على آخر سؤال لم يُجَب. */
    if (to === 'bot') await answerPending(id, clang);
    redirect(`/admin/chats/${id}`);
  }

  const wa = c.cphone ? String(c.cphone).replace(/\D/g, '').replace(/^0(?=1\d{9}$)/, '20') : '';
  return (
    <Shell user={me} here="/admin/chats" title={`محادثة #${id}`}
           trail={[{ label: 'لوحة التحكم', href: '/admin' }, { label: 'المحادثات', href: '/admin/chats' }]}
           sub={`${CHAT_STATUS[c.status]?.[0] ?? c.status}${c.agent ? ` · مع ${c.agent}` : ''} · بدأت ${when(c.created_at)}${c.page ? ` · من ${c.page}` : ''}`}>
      <div className="reqgrid">
        <div className="panel">
          <div className="panel__body"><AgentChat id={id} initial={initial} closed={c.status === 'closed'} status={c.status} /></div>
        </div>
        <div>
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel__head"><h2>العميل</h2></div>
            <div className="panel__body">
              <table className="kv"><tbody>
                <tr><th>الاسم</th><td>{c.cname ?? '—'}{c.ccompany ? ` · ${c.ccompany}` : ''}</td></tr>
                <tr><th>الموبايل</th><td>{c.cphone ? <><a href={`tel:${c.cphone}`} dir="ltr">{c.cphone}</a>{wa ? <> · <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener">واتساب ↗</a></> : null}</> : '—'}</td></tr>
                <tr><th>البريد</th><td dir="ltr">{c.cemail ?? c.aemail ?? '—'}</td></tr>
                <tr><th>حساب</th><td>{c.account_id ? 'داخل بحسابه — يكمّل من أي جهاز' : 'زائر بلا حساب'}</td></tr>
              </tbody></table>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {c.customer_id && can(me, 'customers.view') ? <a className="btn btn--ghost btn--sm" href={`/admin/customers/${c.customer_id}`}>صفحة العميل</a> : null}
                {req && can(me, 'requests.view') ? <a className="btn btn--ghost btn--sm" href={`/admin/requests/${req.id}`}>طلبه #{req.id}</a> : null}
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel__head"><h2>المحادثة</h2></div>
            <div className="panel__body">
              <form action={setState} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {c.assigned_to !== me.id && c.status !== 'closed' ? <button className="btn btn--sm" name="to" value="take" type="submit">استلمها</button> : null}
                {c.status === 'human' ? <button className="btn btn--sm btn--ghost" name="to" value="bot" type="submit">رجّعها للبوت</button> : null}
                {c.status !== 'closed' ? <button className="btn btn--sm btn--ghost" name="to" value="close" type="submit">أغلقها</button> : null}
              </form>
              <p className="field__hint">ردّك يستلم المحادثة ويُسكت البوت (إلا لو اخترت «خلّي البوت يكمّل»). «رجّعها للبوت» لما تخلص.</p>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
