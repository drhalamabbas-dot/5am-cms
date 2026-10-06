'use client';
/* =============================================================================
   المحادثة من جهة الموظف — تتحدّث كل 3 ثوانٍ، فيُرى العميل والبوت وهما بيتكلموا.

   • «خلّي البوت يكمّل بعد ردي»: ردّك يدخل والبوت يفضل يرد (المحادثة مع البوت).
     من غيرها: ردّك يستلم المحادثة والبوت يسكت.
   • «اقتراح البوت»: ردّ الذكاء الاصطناعي على آخر رسالة للعميل يظهر في خانة
     الرد — تعدّله وترسله أو تتجاهله. لا يصل للعميل إلا لو أنت أرسلته.
   • تحت كل ردّ للبوت مصدره (Qwen، الذاكرة، DeepSeek…).
============================================================================= */
import { useCallback, useEffect, useRef, useState } from 'react';

type Msg = { id: number; role: string; text: string; created_at: string; source?: string | null; who?: string | null };
const WHO: Record<string, string> = { user: 'العميل', bot: 'البوت', agent: 'الفريق', system: 'النظام' };
const SRC: Record<string, string> = { qwen: 'Qwen', cache: 'من الذاكرة', own: 'موديلنا', deepseek: 'DeepSeek', backup: 'الاحتياطي', kb: 'من صفحات الموقع' };

export function AgentChat({ id, initial, closed, status: initialStatus }: { id: number; initial: Msg[]; closed: boolean; status: string }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [status, setStatus] = useState(initialStatus);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [keepBot, setKeepBot] = useState(false);
  const [note, setNote] = useState('');
  const last = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/chats/${id}?after=${last.current}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.status) setStatus(d.status);
      if (d.messages?.length) {
        last.current = Math.max(last.current, ...d.messages.map((m: Msg) => m.id));
        setMsgs((c) => [...c, ...d.messages.filter((m: Msg) => !c.some((x) => x.id === m.id))]);
      }
    } catch { /* المرة القادمة */ }
  }, [id]);
  /* أول تحميل يجيب المصدر واسم الموظف لكل رسالة */
  useEffect(() => { setMsgs([]); last.current = 0; poll(); }, [poll]);
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === 'visible') poll(); }, 3000); return () => clearInterval(t); }, [poll]);
  useEffect(() => { if (atBottom.current) box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs]);

  async function send() {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true); setNote('');
    try {
      const r = await fetch(`/api/admin/chats/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: v, keepBot: keepBot && status === 'bot' }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setNote(d.error || 'تعذّر الإرسال'); return; }
      setText(''); atBottom.current = true; await poll();
    } finally { setBusy(false); }
  }

  async function suggest() {
    setSuggesting(true); setNote('');
    try {
      const r = await fetch(`/api/admin/chats/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suggest: true }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setNote(d.error || 'تعذّر الاقتراح'); return; }
      setText(d.text);
      setNote(`اقتراح البوت (${SRC[d.source] ?? 'رد ثابت'}) — عدّله لو حابب، ولا يصل للعميل إلا لو ضغطت «أرسل».`);
    } finally { setSuggesting(false); }
  }

  const time = (s: string) => new Date(s).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="achat">
      <div className={`achat__mode achat__mode--${status}`}>
        {status === 'bot' ? 'البوت هو اللي بيرد دلوقتي — أنت بتتابع مباشرةً. ردّك يستلم المحادثة (إلا لو اخترت إن البوت يكمّل).'
          : status === 'human' ? 'الفريق بيرد — البوت ساكت في المحادثة دي. «اقتراح البوت» يوريك رده من غير ما يتبعت.'
          : 'المحادثة مغلقة.'}
      </div>
      <div className="achat__list" ref={box}
           onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}>
        {msgs.map((m) => (
          <div key={m.id} className={`achat__msg achat__msg--${m.role}`}>
            <small>
              {m.role === 'agent' && m.who ? m.who : WHO[m.role] ?? m.role} · {time(m.created_at)}
              {m.role === 'bot' && m.source ? <> · <em>{SRC[m.source] ?? m.source}</em></> : null}
            </small>
            <p>{m.text}</p>
          </div>
        ))}
      </div>
      {closed || status === 'closed' ? <p className="field__hint">المحادثة مغلقة. لو كتب العميل تاني تبدأ محادثة جديدة.</p> : (
        <>
          <form className="achat__input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000}
                      placeholder="اكتب ردك للعميل… (Enter للإرسال، Shift+Enter لسطر جديد)" aria-label="ردك"
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <div className="achat__actions">
              <button className="btn" type="submit" disabled={busy || !text.trim()}>{busy ? '…' : 'أرسل'}</button>
              <button className="btn btn--ghost btn--sm" type="button" onClick={suggest} disabled={suggesting}>{suggesting ? 'البوت بيفكّر…' : 'اقتراح البوت'}</button>
            </div>
          </form>
          {status === 'bot' ? (
            <label className="achat__keep">
              <input type="checkbox" checked={keepBot} onChange={(e) => setKeepBot(e.target.checked)} />
              خلّي البوت يكمّل بعد ردي (من غيرها: أنا أستلم المحادثة والبوت يسكت)
            </label>
          ) : null}
        </>
      )}
      {note ? <p className="field__hint" style={{ margin: 0 }}>{note}</p> : null}
    </div>
  );
}
