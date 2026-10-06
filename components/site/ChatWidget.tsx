'use client';
/* =============================================================================
   زر المحادثة ونافذتها في كل صفحات الموقع (/api/chat).

   • لا يُطلب شيء من الخادم قبل أن يفتحها الزائر؛ وبعد أول رسالة تُسأل
     المحادثة كل 4 ثوانٍ وهي مفتوحة، وكل 30 ثانية وهي مقفولة (لتظهر نقطة لو
     ردّ موظف).
   • الروابط في الردود: داخل الموقع فقط ([نص](/مسار) أو /مسار)، وتُرسم عناصر
     React لا HTML، فلا يُحقن شيء في الصفحة.
============================================================================= */
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';

type Msg = { id: number; role: 'user' | 'bot' | 'agent' | 'system'; text: string };
type Acc = { name: string | null; email: string | null; phone: string | null } | null;
const ACTIVE = '5am-chat-active';

const TXT = {
  ar: {
    open: 'تحدث معنا', title: 'مساعد 5A&M', bot: 'يرد فورًا', human: 'مع فريقنا', close: 'إغلاق',
    placeholder: 'اكتب سؤالك…', send: 'إرسال', typing: 'يكتب…', agent: 'فريق 5A&M',
    chips: ['عايز مولد كهرباء', 'قطع غيار أصلية', 'معدات تنظيف الشوارع', 'كلّم موظف'],
    hName: 'الاسم', hPhone: 'رقم الموبايل', hSend: 'كلّموني', hNote: 'هيرد عليك موظف هنا أو يتصل بيك.',
    account: 'سجّل دخولك علشان تكمّل المحادثة بعدين من أي جهاز', accountIn: 'حسابي',
    err: 'تعذّر الإرسال، حاول تاني.', wait: 'رسائل كتير ورا بعض — استنى دقيقة.', phoneErr: 'اكتب رقم موبايل صحيح.',
    privacy: 'المحادثة محفوظة لتحسين الرد عليك.',
  },
  en: {
    open: 'Chat with us', title: '5A&M assistant', bot: 'Replies instantly', human: 'With our team', close: 'Close',
    placeholder: 'Type your question…', send: 'Send', typing: 'Typing…', agent: '5A&M team',
    chips: ['I need a generator', 'Genuine spare parts', 'Street sweepers', 'Talk to an agent'],
    hName: 'Name', hPhone: 'Mobile number', hSend: 'Contact me', hNote: 'Our team will reply here or call you.',
    account: 'Sign in to continue this chat later from any device', accountIn: 'My account',
    err: 'Could not send — try again.', wait: 'Too many messages — wait a minute.', phoneErr: 'Enter a valid mobile number.',
    privacy: 'This chat is saved to help us serve you.',
  },
};

/** نص الرد بروابط داخل الموقع فقط وخط عريض بسيط */
function Rich({ text: raw }: { text: string }) {
  /* نقاط Markdown (* أو -) تظهر نقاطًا، والعناوين (#) نصًّا عاديًا */
  const text = raw.replace(/^[ \t]*[*-][ \t]+/gm, '• ').replace(/^#{1,4}[ \t]+/gm, '');
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]{1,120})\]\((\/[^\s)]{0,300})\)|(?<![\w/])(\/(?:[\w-]+\.html|model\.html)(?:\?[^\s)]*)?)|\*\*([^*]{1,200})\*\*/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<a key={k++} href={m[2]}>{m[1]}</a>);
    else if (m[3]) parts.push(<a key={k++} href={m[3]}>{m[3]}</a>);
    else if (m[4]) parts.push(<b key={k++}>{m[4]}</b>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((p, i) => (typeof p === 'string' ? <Fragment key={`t${i}`}>{p}</Fragment> : p))}</>;
}

export function ChatWidget({ lang, greeting }: { lang: 'ar' | 'en'; greeting: string }) {
  const t = TXT[lang];
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [acc, setAcc] = useState<Acc>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [note, setNote] = useState('');
  const [unseen, setUnseen] = useState(false);
  const lastId = useRef(0);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const merge = useCallback((add: Msg[]) => {
    if (!add?.length) return;
    setMsgs((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      const next = [...cur, ...add.filter((m) => !seen.has(m.id))];
      lastId.current = Math.max(lastId.current, ...next.map((m) => m.id));
      return next;
    });
  }, []);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/chat?after=${lastId.current}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.enabled === false) return;
      setStatus(d.status); setAcc(d.account);
      if (d.messages?.length) {
        merge(d.messages);
        if (d.messages.some((m: Msg) => m.role === 'agent')) setUnseen(true);
      }
    } catch { /* المرة القادمة */ }
  }, [merge]);

  /* محادثة سابقة في هذا المتصفح؟ تُحمَّل بهدوء لتظهر نقطة الرد */
  useEffect(() => {
    let active = false;
    try { active = localStorage.getItem(ACTIVE) === '1'; } catch { /* وضع خاص */ }
    if (active) poll();
  }, [poll]);
  useEffect(() => {
    if (!open && !lastId.current) return;
    const id = setInterval(() => { if (document.visibilityState === 'visible') poll(); }, open ? 4000 : 30000);
    return () => clearInterval(id);
  }, [open, poll]);
  useEffect(() => { if (open) { poll(); setUnseen(false); setTimeout(() => input.current?.focus(), 50); } }, [open, poll]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy, handoff]);
  /* زر «كمّل المحادثة» في صفحة الحساب يفتحها */
  useEffect(() => {
    const o = () => setOpen(true);
    window.addEventListener('5am-chat-open', o);
    return () => window.removeEventListener('5am-chat-open', o);
  }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open]);

  async function send(raw: string) {
    const v = raw.trim();
    if (!v || busy) return;
    setBusy(true); setNote(''); setText('');
    const temp: Msg = { id: -Date.now(), role: 'user', text: v };
    setMsgs((c) => [...c, temp]);
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: v, lang, page: location.pathname + location.search }) });
      const d = await r.json().catch(() => ({}));
      setMsgs((c) => c.filter((m) => m.id !== temp.id));
      if (!r.ok || !d.ok) { setNote(r.status === 429 ? t.wait : t.err); setText(v); return; }
      try { localStorage.setItem(ACTIVE, '1'); } catch { /* */ }
      merge(d.messages); setStatus(d.status ?? 'bot');
      if (d.handoff) setHandoff(true);
    } catch { setMsgs((c) => c.filter((m) => m.id !== temp.id)); setNote(t.err); setText(v); }
    finally { setBusy(false); }
  }

  async function sendHandoff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setNote('');
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, handoff: { name: f.get('name'), phone: f.get('phone') } }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setNote(d?.error === 'phone' || d?.error === 'contact' ? t.phoneErr : t.err); return; }
      setHandoff(false); setStatus('human'); poll();
    } finally { setBusy(false); }
  }

  const accountHref = `/account?lang=${lang}`;
  return (
    <>
      <button type="button" className={`ux-chat__fab${unseen ? ' has-new' : ''}`} onClick={() => setOpen((o) => !o)}
              aria-expanded={open} aria-controls="uxChat" aria-label={t.open}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 6.5a1.5 1.5 0 1 0 0 .01Zm5 0a1.5 1.5 0 1 0 0 .01Zm5 0a1.5 1.5 0 1 0 0 .01Z"/></svg>
        <span>{t.open}</span>
      </button>

      {open ? (
        <section className="ux-chat" id="uxChat" role="dialog" aria-label={t.title}>
          <header className="ux-chat__head">
            <span className="ux-chat__avatar" aria-hidden="true">5A</span>
            <span className="ux-chat__who"><b>{t.title}</b><small>{status === 'human' ? t.human : t.bot}</small></span>
            <button type="button" className="ux-chat__x" onClick={() => setOpen(false)} aria-label={t.close}>×</button>
          </header>

          <div className="ux-chat__list" ref={list} aria-live="polite">
            <p className="ux-chat__msg ux-chat__msg--bot">{greeting}</p>
            {!msgs.length ? (
              <div className="ux-chat__chips">
                {t.chips.map((c) => <button type="button" key={c} onClick={() => send(c)}>{c}</button>)}
              </div>
            ) : null}
            {msgs.map((m) => (
              <div key={m.id} className={`ux-chat__msg ux-chat__msg--${m.role}`}>
                {m.role === 'agent' ? <small className="ux-chat__by">{t.agent}</small> : null}
                <Rich text={m.text} />
              </div>
            ))}
            {busy && !handoff ? <p className="ux-chat__msg ux-chat__msg--bot ux-chat__typing">{t.typing}</p> : null}
            {handoff && status !== 'human' ? (
              <form className="ux-chat__handoff" onSubmit={sendHandoff}>
                <label>{t.hName}<input name="name" defaultValue={acc?.name ?? ''} autoComplete="name" maxLength={120} /></label>
                <label>{t.hPhone}<input name="phone" type="tel" dir="ltr" required defaultValue={acc?.phone ?? ''} autoComplete="tel" maxLength={40} /></label>
                <button className="btn btn--sm" type="submit" disabled={busy}>{t.hSend}</button>
                <small>{t.hNote}</small>
              </form>
            ) : null}
          </div>

          {note ? <p className="ux-chat__note" role="alert">{note}</p> : null}
          <form className="ux-chat__input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <textarea ref={input} rows={1} value={text} maxLength={1000} placeholder={t.placeholder} aria-label={t.placeholder}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }} />
            <button type="submit" disabled={busy || !text.trim()} aria-label={t.send}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3 20.5 21 12 3 3.5 3 10l12 2-12 2z"/></svg>
            </button>
          </form>
          <p className="ux-chat__foot">
            {acc ? <a href={accountHref}>{t.accountIn}</a> : <a href={accountHref}>{t.account}</a>}
            <span> · {t.privacy}</span>
          </p>
        </section>
      ) : null}
    </>
  );
}
