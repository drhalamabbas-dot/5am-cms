/* المحادثات: كل محادثات الزوار مع البوت ومع الفريق. «تنتظر رد» أولًا — من طلب
   موظفًا أو كتب لموظف ولم يُرد عليه. */
import { requirePerm } from '@/lib/auth';
import { q, when } from '@/lib/db';
import { Shell } from '@/components/admin/Shell';
import { can } from '@/lib/permissions';
import { CHAT_STATUS } from '@/lib/chat/conv';
import { AutoRefresh } from '@/components/admin/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const me = await requirePerm('chat.handle');
  const f = (await searchParams).f ?? 'live';
  const where = f === 'live' ? "c.status <> 'closed' AND c.last_message_at >= NOW() - INTERVAL 10 MINUTE"
    : f === 'waiting' ? "c.status = 'human' AND c.unread_agent > 0"
    : f === 'human' ? "c.status = 'human'" : f === 'bot' ? "c.status = 'bot'" : f === 'mine' ? 'c.assigned_to = ?' : '1=1';
  const rows = await q<any>(
    `SELECT c.*, u.name AS agent, cu.name AS cname, cu.phone AS cphone, a.email AS aemail,
            (SELECT text FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_text,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.conversation_id = c.id AND m.role = 'user') AS n
       FROM chat_conversations c LEFT JOIN users u ON u.id = c.assigned_to
       LEFT JOIN customers cu ON cu.id = c.customer_id LEFT JOIN customer_accounts a ON a.id = c.account_id
      WHERE ${where} ORDER BY (c.status = 'human' AND c.unread_agent > 0) DESC, c.last_message_at DESC LIMIT 200`,
    f === 'mine' ? [me.id] : []
  );
  const [{ waiting }] = await q<any>("SELECT COUNT(*) waiting FROM chat_conversations WHERE status = 'human' AND unread_agent > 0");
  const [{ live }] = await q<any>("SELECT COUNT(*) live FROM chat_conversations WHERE status <> 'closed' AND last_message_at >= NOW() - INTERVAL 10 MINUTE");
  const tab = (k: string, l: string) => <a className={`btn btn--sm ${f === k ? '' : 'btn--ghost'}`} href={`/admin/chats?f=${k}`}>{l}</a>;

  return (
    <Shell user={me} here="/admin/chats" title="المحادثات" trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub={waiting ? `${waiting} محادثة تنتظر ردك.` : 'محادثات الزوار مع البوت ومع الفريق. من يطلب موظفًا يصلك له تنبيه.'}
           actions={can(me, 'chat.train') ? <a className="btn btn--ghost" href="/admin/chat-training">تدريب البوت</a> : null}>
      <AutoRefresh seconds={8} />
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__body" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tab('live', `مباشر الآن (${live})`)}{tab('waiting', `تنتظر رد (${waiting})`)}{tab('human', 'مع الفريق')}{tab('mine', 'محادثاتي')}{tab('bot', 'مع البوت')}{tab('all', 'الكل')}
        </div>
      </div>
      <div className="panel">
        {rows.length ? (
          <table>
            <thead><tr><th>#</th><th>العميل</th><th>آخر رسالة</th><th>الحالة</th><th>المسؤول</th><th>آخر نشاط</th><th /></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} style={c.status === 'human' && c.unread_agent ? { background: '#fff8f0' } : undefined}>
                  <td><a href={`/admin/chats/${c.id}`}>#{c.id}</a></td>
                  <td>{c.cname || c.aemail || 'زائر'}{c.cphone ? <><br /><small dir="ltr">{c.cphone}</small></> : null}</td>
                  <td style={{ maxWidth: 360 }}><small>{String(c.last_text ?? '').slice(0, 120)}</small></td>
                  <td>
                    <span className={`tag ${CHAT_STATUS[c.status]?.[1] ?? ''}`}>{CHAT_STATUS[c.status]?.[0] ?? c.status}</span>
                    {c.unread_agent && c.status === 'human' ? <> <span className="tag tag--off">{c.unread_agent} جديدة</span></> : null}
                  </td>
                  <td><small>{c.agent ?? '—'}</small></td>
                  <td><small dir="ltr">{when(c.last_message_at ?? c.created_at)}</small></td>
                  <td style={{ textAlign: 'end' }}><a className="btn btn--sm" href={`/admin/chats/${c.id}`}>افتح</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="panel__body"><p style={{ margin: 0 }}>لا محادثات هنا.</p></div>}
      </div>
    </Shell>
  );
}
