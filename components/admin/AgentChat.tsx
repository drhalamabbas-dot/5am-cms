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

type File_ = { url: string; kind: 'image' | 'video' | 'audio' | 'file'; name?: string | null; bytes?: number | null; secs?: number | null };
/** الامتداد الذي يميّز الصوت عن الفيديو مع أن وعاءهما واحد (lib/media.ts) */
const audioExt = (mime: string) =>
  (mime.includes('webm') ? 'weba' : mime.includes('ogg') ? 'ogg' : 'm4a');
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
type Quote = { id: number; role: string; text: string | null; files?: File_[] } | null;
type Msg = {
  id: number; role: string; text: string; files?: File_[]; reply?: Quote;
  created_at: string; read_at?: string | null; source?: string | null; who?: string | null;
};
const WHO: Record<string, string> = { user: 'العميل', bot: 'البوت', agent: 'الفريق', system: 'النظام' };
const SRC: Record<string, string> = { qwen: 'Qwen', cache: 'من الذاكرة', own: 'موديلنا', deepseek: 'DeepSeek', backup: 'الاحتياطي', kb: 'من صفحات الموقع' };
/** وصف الرسالة المقتبسة حين لا نصّ فيها */
const kindOf = (k?: string) => (k === 'image' ? 'صورة' : k === 'video' ? 'فيديو' : k === 'audio' ? 'رسالة صوتية' : k === 'file' ? 'ملف' : '');
/** النوع من الامتداد — كما يحسبه الخادم، فلا يختلف ما يُعرَض عمّا يُحفَظ */
const KINDS: Record<string, File_['kind']> = {
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', gif: 'image',
  mp4: 'video', webm: 'video', weba: 'audio', m4a: 'audio', ogg: 'audio', mp3: 'audio', pdf: 'file',
};
const kindOfPath = (p: string) => KINDS[(p.split('.').pop() ?? '').toLowerCase()];

export function AgentChat({ id, initial, closed, status: initialStatus }: { id: number; initial: Msg[]; closed: boolean; status: string }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [status, setStatus] = useState(initialStatus);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [keepBot, setKeepBot] = useState(false);
  const [note, setNote] = useState('');
  /* مرفقاتٌ رُفعت ولم تُرسَل بعد: تُعرَض ليراجعها قبل أن تصل العميل */
  const [pend, setPend] = useState<File_[]>([]);
  const [uping, setUping] = useState(false);
  /* العميل يكتب الآن: كان الموظف لا يدري فيردّ على نصف كلام أو يُغلقها */
  const [custTyping, setCustTyping] = useState(false);
  /* تسجيلٌ صوتي: العميل يبعت صوتًا، وكان الموظف لا يملك إلا أن يكتب */
  const [rec, setRec] = useState(0);              // ثوانٍ، و0 أي لا تسجيل
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const keep = useRef(true);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const last = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  /* «بيكتب الآن» عند العميل: نبضةٌ كل أربع ثوانٍ على الأكثر مهما كتب،
     فلا يُرسَل طلبٌ مع كل حرف. */
  const lastPing = useRef(0);
  const ping = useCallback(() => {
    const now = Date.now();
    if (now - lastPing.current < 4000) return;
    lastPing.current = now;
    fetch(`/api/admin/chats/${id}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ typing: true }),
    }).catch(() => {});
  }, [id]);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/chats/${id}?after=${last.current}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.status) setStatus(d.status);
      setCustTyping(Boolean(d.typing));
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
    if ((!v && !pend.length) || busy) return;
    setBusy(true); setNote('');
    try {
      const r = await fetch(`/api/admin/chats/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: v, files: pend, keepBot: keepBot && status === 'bot' }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setNote(d.error || 'تعذّر الإرسال'); return; }
      setText(''); setPend([]); atBottom.current = true; await poll();
    } finally { setBusy(false); }
  }

  /* مرفقات الموظف: صورةُ القطعة أو عرضُ سعرٍ PDF يقولان ما لا تقوله فقرة.
     تُرفع إلى مكتبة اللوحة نفسها (فتبقى عنده ويعيد إرسالها لعميلٍ آخر)،
     ثم تُضمّ إلى الرسالة عند الإرسال لا قبله — فله أن يتراجع. */
  async function attach(e: React.ChangeEvent<HTMLInputElement>) {
    const list = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!list.length) return;
    setUping(true); setNote('');
    try {
      const fd = new FormData();
      for (const f of list.slice(0, 4)) fd.append('files', f);
      const r = await fetch('/api/admin/media', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      const added = (d?.added ?? []).map((row: any) => ({
        url: row.path, kind: kindOfPath(row.path), name: row.path.split('/').pop(), bytes: row.bytes, w: row.width, h: row.height,
      })).filter((f: File_) => f.kind);
      if (!added.length) setNote(d?.failed?.[0] ?? 'تعذّر رفع الملف');
      setPend((p) => [...p, ...added].slice(0, 4));
    } catch { setNote('تعذّر رفع الملف'); } finally { setUping(false); }
  }

  /* رسالةٌ صوتية من الموظف: تُرفع كأيّ مرفق ثم تنتظر «أرسل» مثله — فله أن
     يسمعها ويتراجع قبل أن تصل العميل. وضغطةٌ تبدأ وأخرى تقف: الموظف على
     حاسوبٍ يكتب بيديه، لا على هاتفٍ يضغط مطوّلًا. */
  async function startRec() {
    if (uping || rec) return;
    setNote('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setNote('المتصفّح مش بيسمح بالتسجيل هنا.'); return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm', 'audio/ogg', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = []; keep.current = true;
      let secs = 0;
      mr.ondataavailable = (ev) => { if (ev.data.size) chunks.current.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (tick.current) { clearInterval(tick.current); tick.current = null; }
        setRec(0);
        if (!keep.current || !chunks.current.length || secs < 1) return;
        const type = mr.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunks.current, { type });
        setUping(true);
        try {
          const fd = new FormData();
          fd.append('files', blob, `voice-${Date.now()}.${audioExt(type)}`);
          const r = await fetch('/api/admin/media', { method: 'POST', body: fd });
          const d = await r.json().catch(() => ({}));
          const row = (d?.added ?? [])[0];
          if (!row) { setNote(d?.failed?.[0] ?? 'تعذّر رفع الصوت'); return; }
          const one: File_ = {
            url: row.path, kind: 'audio', name: row.path.split('/').pop(), bytes: row.bytes, secs,
          };
          setPend((p) => [...p, one].slice(0, 4));
        } catch { setNote('تعذّر رفع الصوت'); } finally { setUping(false); }
      };
      recorder.current = mr;
      mr.start();
      setRec(1);
      tick.current = setInterval(() => {
        secs += 1;
        setRec(secs);
        /* دقيقتان تكفيان شرحَ قطعةٍ أو عطل، وتبقيان الملف صغيرًا */
        if (secs >= 120) stopRec(true);
      }, 1000);
    } catch (e: any) {
      const n = e?.name;
      setNote(n === 'NotFoundError' || n === 'DevicesNotFoundError' ? 'مفيش مايك متوصّل بالجهاز.'
        : n === 'NotAllowedError' || n === 'SecurityError' ? 'المايك مرفوض. افتحه من قفل العنوان فوق ← الميكروفون ← اسمح.'
          : 'المتصفّح مش بيسمح بالتسجيل هنا.');
    }
  }
  function stopRec(save: boolean) {
    keep.current = save;
    recorder.current?.stop();
  }
  /* مغادرةُ الصفحة والمايك شغّال تتركه مضاءً، فيُوقَف مع التفكيك */
  useEffect(() => () => {
    if (tick.current) clearInterval(tick.current);
    if (recorder.current?.state === 'recording') { keep.current = false; recorder.current.stop(); }
  }, []);

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
            {m.reply ? (
              <span className="achat__qt">
                <b>{WHO[m.reply.role] ?? m.reply.role}</b>
                <span dir="auto">{m.reply.text?.trim()?.slice(0, 90) || kindOf(m.reply.files?.[0]?.kind)}</span>
              </span>
            ) : null}
            {/* المرفق أولًا والكلام تحته تعليقًا عليه — كما يراه العميل */}
            {(m.files ?? []).map((f, i) => <Attach key={i} f={f} />)}
            {/* dir="auto": اللوحة عربية، فكان النصّ الإنجليزي يُرسَم باتجاهها
                فتقع نقطتُه في أوّل السطر («‎.need» مكان «need.»). والمتصفّح
                يستنتج الاتجاه من أول حرفٍ قويّ، فيصحّ العربيّ والإنجليزيّ معًا. */}
            {m.text ? <p dir="auto">{m.text}</p> : null}
          </div>
        ))}
        {custTyping ? (
          <div className="achat__msg achat__msg--user achat__dots" aria-label="العميل بيكتب">
            <i /><i /><i />
          </div>
        ) : null}
      </div>
      {closed || status === 'closed' ? <p className="field__hint">المحادثة مغلقة. لو كتب العميل تاني تبدأ محادثة جديدة.</p> : (
        <>
          <form className="achat__input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea value={text} dir="auto" onChange={(e) => { setText(e.target.value); ping(); }} rows={3} maxLength={2000}
                      placeholder="اكتب ردك للعميل… (Enter للإرسال، Shift+Enter لسطر جديد)" aria-label="ردك"
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            {pend.length ? (
              <div className="achat__pend">
                {pend.map((f, i) => (
                  <span key={i}>
                    {f.kind === 'image'
                      ? <img src={'/' + f.url} alt="" />
                      : <b>{kindOf(f.kind)}</b>}
                    <small>{f.kind === 'audio' && f.secs ? mmss(f.secs) : f.name}</small>
                    <button type="button" aria-label="شيل المرفق"
                            onClick={() => setPend((p) => p.filter((_, n) => n !== i))}>×</button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="achat__actions">
              <button className="btn" type="submit" disabled={busy || (!text.trim() && !pend.length)}>{busy ? '…' : 'أرسل'}</button>
              <label className={`btn btn--ghost btn--sm${uping ? ' is-busy' : ''}`}>
                <input type="file" multiple accept="image/*,video/*,audio/*,.pdf" hidden onChange={attach} disabled={uping || Boolean(rec)} />
                {uping ? 'بيترفع…' : 'أرفق ملف'}
              </label>
              {rec ? (
                <>
                  <button className="btn btn--sm achat__rec" type="button" onClick={() => stopRec(true)}>
                    <i aria-hidden="true" /> وقّف وأضف · <time dir="ltr">{mmss(rec)}</time>
                  </button>
                  <button className="btn btn--ghost btn--sm" type="button" onClick={() => stopRec(false)}>إلغاء</button>
                </>
              ) : (
                <button className="btn btn--ghost btn--sm" type="button" onClick={startRec} disabled={uping}>
                  سجّل صوت
                </button>
              )}
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

/* مرفقات العميل: الموظف يفتحها بعينه — صورةُ لوحة عدّادات أو صوتُ محرّك
   تقول ما لا يُكتب، والبوت لا يراها أصلًا. */
function Attach({ f }: { f: File_ }) {
  if (!f?.url) return null;
  const src = '/' + String(f.url).replace(/^\//, '');
  if (f.kind === 'image') {
    return (
      <a className="achat__f" href={src} target="_blank" rel="noreferrer" title={f.name ?? 'صورة'}>
        <img src={src} alt={f.name ?? ''} loading="lazy" />
      </a>
    );
  }
  if (f.kind === 'video') return <video className="achat__f" src={src} controls preload="metadata" playsInline />;
  return <audio className="achat__f achat__f--aud" src={src} controls preload="metadata" />;
}
