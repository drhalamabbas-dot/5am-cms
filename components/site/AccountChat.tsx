'use client';
/* =============================================================================
   المحادثة في حساب العميل — لوحةٌ كاملة في وسط الصفحة، لا نافذةٌ صغيرة.

   وشكلُها ما اعتاده الناس في تطبيقات المراسلة، لأنّ ما اعتادوه لا يُشرَح:
   وقتٌ تحت كل رسالة، وفواصلُ أيام، وعلامةُ قراءة، وردٌّ على رسالةٍ بعينها،
   و«بيكتب الآن»، ولصقٌ وسحبٌ للصور، وضغطٌ مطوّل للتسجيل.

   ويبعث صورةً وفيديو وملفًّا ورسالةً صوتية: عميلُ معدّاتٍ يصف عطلًا — صورةُ
   لوحة العدّادات تغني عن فقرة، وصوتُ محرّكٍ يقول ما لا يُكتب.

   تُنقَل الرسائل بـapi/chat نفسه، فالمحادثة واحدة أينما فُتحت، والموظف
   يراها في مكانٍ واحد.
============================================================================= */
import { useCallback, useEffect, useRef, useState } from 'react';

type Role = 'user' | 'bot' | 'agent' | 'system';
type File_ = {
  url: string; kind: 'image' | 'video' | 'audio' | 'file';
  name?: string | null; bytes?: number | null; secs?: number | null; w?: number | null; h?: number | null;
  poster?: string | null; frames?: string[];
};
type Quote = { id: number; role: Role; text: string | null; files?: File_[] } | null;
type Msg = { id: number; role: Role; text: string | null; files?: File_[]; reply?: Quote; created_at?: string; read_at?: string | null };

const TX = {
  ar: {
    placeholder: 'اكتب رسالتك…', send: 'ابعت',
    attach: 'صورة أو فيديو أو ملف', rec: 'اضغط مطوّل للتسجيل', stop: 'وقّف وابعت', cancel: 'إلغاء',
    recording: 'بسجّل…', slide: 'سيب لتبعت · اسحب للإلغاء',
    talk: 'كلّم موظف', talking: 'مع فريقنا', typing: 'بيكتب…',
    waitHead: 'لسه محدش ردّ عليك',
    waitSub: 'طلبك وصل لفريقنا وهيردّوا عليك هنا. وممكن تسأل المساعد الآلي دلوقتي لحد ما حد يفضى.',
    waitBtn: 'اسأل المساعد دلوقتي', waitKeep: 'أستنى الموظف',
    pickHead: 'تحبّ تكلّم مين؟',
    pickBot: 'المساعد الآلي', pickBotSub: 'بيرد فورًا على أسئلة المعدات والأسعار وقطع الغيار.',
    pickAgent: 'موظف من فريقنا', pickAgentSub: 'لو محتاج حدّ يشوف حالتك بنفسه — بيرد في ساعات العمل.',
    botReady: 'اكتب سؤالك للمساعد تحت.',
    botNoFiles: 'المساعد بيقرأ الكلام بس. اضغط «كلّم موظف» عشان تبعت صورة أو فيديو أو صوت.',
    who: { user: 'أنت', bot: 'المساعد', agent: 'فريق 5A&M', system: '' } as Record<string, string>,
    empty: 'اكتب أول رسالة، أو ابعت صورة للمعدة اللي عندك.',
    sending: 'بيتبعت…', uploading: 'بيترفع…',
    micDenied: 'المايك مرفوض لهذا الموقع. افتحه من قفل العنوان فوق ← الميكروفون ← اسمح.',
    micNone: 'مفيش مايك متوصّل بالجهاز.',
    micBlocked: 'متصفّحك مش بيسمح بالتسجيل هنا. اكتب رسالتك أو ابعت صورة بدلها.',
    badType: 'النوع ده مش مسموح — صور وفيديو وصوت وPDF بس.', failed: 'ما اتبعتش. جرّب تاني.',
    today: 'النهارده', yesterday: 'امبارح',
    reply: 'ردّ', replyTo: 'بتردّ على', photo: 'صورة', video: 'فيديو', voice: 'رسالة صوتية', file: 'ملف',
    down: 'الجديد', drop: 'سيب الملف هنا', emoji: 'رموز', close: 'إغلاق',
    framing: 'بجهّز الفيديو…', tooBig: 'الملف أكبر من {n} ميجا.',
    play: 'شغّل', pause: 'وقّف', openVid: 'شغّل الفيديو',
  },
  en: {
    placeholder: 'Write your message…', send: 'Send',
    attach: 'Photo, video or file', rec: 'Hold to record', stop: 'Stop and send', cancel: 'Cancel',
    recording: 'Recording…', slide: 'Release to send · drag to cancel',
    talk: 'Talk to a person', talking: 'With our team', typing: 'typing…',
    waitHead: 'No one has replied yet',
    waitSub: 'Your request reached our team and they will answer here. You can ask the assistant meanwhile.',
    waitBtn: 'Ask the assistant now', waitKeep: "I'll wait for a person",
    pickHead: 'Who would you like to talk to?',
    pickBot: 'The assistant', pickBotSub: 'Answers right away about equipment, prices and spare parts.',
    pickAgent: 'Someone from our team', pickAgentSub: 'When you need a person to look at your case — replies in working hours.',
    botReady: 'Write your question to the assistant below.',
    botNoFiles: 'The assistant reads text only. Tap “Talk to a person” to send a photo, video or voice note.',
    who: { user: 'You', bot: 'Assistant', agent: '5A&M team', system: '' } as Record<string, string>,
    empty: 'Write your first message, or send a photo of your equipment.',
    sending: 'Sending…', uploading: 'Uploading…',
    micDenied: 'The mic is blocked for this site. Open the padlock in the address bar → Microphone → Allow.',
    micNone: 'No microphone is connected to this device.',
    micBlocked: "Your browser won't allow recording here. Write your message or send a photo instead.",
    badType: 'Not allowed — images, video, audio and PDF only.', failed: "It didn't send. Try again.",
    today: 'Today', yesterday: 'Yesterday',
    reply: 'Reply', replyTo: 'Replying to', photo: 'Photo', video: 'Video', voice: 'Voice message', file: 'File',
    down: 'New', drop: 'Drop the file here', emoji: 'Emoji', close: 'Close',
    framing: 'Preparing the video…', tooBig: 'The file is larger than {n} MB.',
    play: 'Play', pause: 'Pause', openVid: 'Play video',
  },
};

const EMOJI = ['👍', '🙏', '✅', '❌', '⚠️', '🔧', '🚛', '⚙️', '📄', '📷', '🙂', '😅', '😟', '🔥', '💧', '⏱️', '📍', '💬'];

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const kb = (b?: number | null) => (!b ? '' : b < 1024 * 1024 ? `${Math.round(b / 1024)} ك.ب` : `${(b / 1048576).toFixed(1)} م.ب`);

/**
 * لقطاتٌ من مقطعٍ قبل رفعه: الخادم لا يفكّ ترميز الفيديو بلا ffmpeg،
 * والمتصفّح يفكّه أصلًا ليعرضه. أولاها ملصقٌ يُعرَض قبل التشغيل — فلا تبقى
 * مصغّرةٌ مكسورة — وبقيّتها يقرؤها البوت ولا تُعرَض.
 *
 * وما تعذّر استخراجه لا يُعطِّل الإرسال: المقطع يُرفَع بلا ملصقٍ ولا لقطات.
 */
async function grabFrames(file: File, n = 5): Promise<Blob[]> {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = url;
  try {
    const dur = await new Promise<number>((res, rej) => {
      v.onloadedmetadata = () => res(v.duration || 0);
      v.onerror = () => rej(new Error('decode'));
      setTimeout(() => rej(new Error('timeout')), 8000);
    });
    if (!Number.isFinite(dur) || dur <= 0) return [];
    const cv = document.createElement('canvas');
    const side = 960;
    const scale = Math.min(1, side / Math.max(v.videoWidth || side, v.videoHeight || side));
    cv.width = Math.max(1, Math.round((v.videoWidth || side) * scale));
    cv.height = Math.max(1, Math.round((v.videoHeight || side) * scale));
    const g = cv.getContext('2d');
    if (!g) return [];
    const out: Blob[] = [];
    /* مواضع متفرّقة على طول المقطع: ما يتغيّر فيه يظهر بينها */
    for (const at of [0.08, 0.3, 0.5, 0.72, 0.92].slice(0, n)) {
      const t = Math.min(dur * at, Math.max(0, dur - 0.05));
      const ok = await new Promise<boolean>((res) => {
        v.onseeked = () => res(true);
        v.onerror = () => res(false);
        setTimeout(() => res(false), 5000);
        v.currentTime = t;
      });
      if (!ok) continue;
      g.drawImage(v, 0, 0, cv.width, cv.height);
      const b = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/jpeg', 0.8));
      if (b) out.push(b);
    }
    return out;
  } catch { return []; } finally { URL.revokeObjectURL(url); }
}

/** الامتداد الذي يميّز الصوت عن الفيديو مع أن وعاءهما واحد (lib/media.ts) */
function audioExt(mime: string) {
  if (mime.includes('webm')) return 'weba';
  if (mime.includes('ogg')) return 'ogg';
  return 'm4a';
}

const clock = (v?: string, lang: 'ar' | 'en' = 'ar') => {
  if (!v) return '';
  const d = new Date(v.includes('T') || v.includes('Z') ? v : v.replace(' ', 'T'));
  return Number.isNaN(+d) ? '' : d.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
};
const dayKey = (v?: string) => (v ? (v.includes('T') ? v.slice(0, 10) : v.slice(0, 10)) : '');

function dayLabel(key: string, x: typeof TX['ar'], lang: 'ar' | 'en') {
  if (!key) return '';
  const today = new Date(); const y = new Date(Date.now() - 86400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (key === iso(today)) return x.today;
  if (key === iso(y)) return x.yesterday;
  const d = new Date(key + 'T00:00:00');
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** سطرٌ يصف الرسالة المردود عليها حين لا نصّ فيها */
function gist(m: { text?: string | null; files?: File_[] }, x: typeof TX['ar']) {
  if (m.text?.trim()) return m.text.trim().slice(0, 90);
  const k = m.files?.[0]?.kind;
  return k === 'image' ? x.photo : k === 'video' ? x.video : k === 'audio' ? x.voice : k === 'file' ? x.file : '';
}

export function AccountChat({ lang, greeting }: { lang: 'ar' | 'en'; greeting: string }) {
  const x = TX[lang];
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  /* دقائقُ انتظارٍ بلا ردّ، و«أستنى» إن اختارها فلا يُسأل ثانية */
  const [waiting, setWaiting] = useState(0);
  const [noBot, setNoBot] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'' | 'send' | 'up' | 'frames'>('');
  const [err, setErr] = useState('');
  const [rec, setRec] = useState<{ on: boolean; secs: number; cancel: boolean }>({ on: false, secs: 0, cancel: false });
  const [quote, setQuote] = useState<Quote>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [emoji, setEmoji] = useState(false);
  const [drag, setDrag] = useState(false);
  const [behind, setBehind] = useState(0);
  const [pickedBot, setPickedBot] = useState(false);
  /* ما رُفع ولم يُرسَل بعد: يُرى ويُشال، ويخرج مع «ابعت» ومعه الكلام */
  const [pend, setPend] = useState<File_[]>([]);

  const thread = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const lastId = useRef(0);
  const atEnd = useRef(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const keep = useRef(true);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const push = useCallback((rows: Msg[]) => {
    if (!rows?.length) return;
    setMsgs((prev) => {
      const seen = new Map(prev.map((m) => [m.id, m]));
      let touched = false;
      /* الموجودة تُحدَّث لا تُكرَّر: read_at يتغيّر بعد الإرسال */
      for (const r of rows) {
        const old = seen.get(r.id);
        if (!old) { seen.set(r.id, r); touched = true; }
        else if (old.read_at !== r.read_at) { seen.set(r.id, { ...old, read_at: r.read_at }); touched = true; }
      }
      if (!touched) return prev;
      lastId.current = Math.max(lastId.current, ...rows.map((m) => m.id));
      return [...seen.values()].sort((a, b) => a.id - b.id);
    });
  }, []);

  /* أول تحميل ثم سؤالٌ كل بضع ثوانٍ: ردّ الموظف يصل بلا تحديث الصفحة.
     ويُسأل من الصفر كل مرة ليصل تغيّر علامة القراءة على ما مضى. */
  useEffect(() => {
    let alive = true;
    let from = 0;
    const pull = async () => {
      try {
        const r = await fetch(`/api/chat?after=${from}`, { cache: 'no-store' });
        const d = await r.json();
        if (!alive) return;
        setStatus(d.status ?? null);
        setTyping(Boolean(d.typing));
        setWaiting(Number(d.waiting) || 0);
        push(d.messages ?? []);
        /* بعد أول جلبةٍ كاملة يُسأل عن الجديد وحده، وكل خمس جلبات يُعاد
           السؤال من الصفر لتصل علامات القراءة المتأخّرة. */
        from = lastId.current;
      } catch { /* الشبكة تنقطع: المحاولة التالية بعد ثوانٍ */ }
    };
    pull();
    let n = 0;
    const id = setInterval(() => { if (++n % 5 === 0) from = 0; pull(); }, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [push]);

  /* النزول لآخر رسالة: داخل اللوحة وحدها، ولا يُنتزع القارئ من مكانه إن
     كان يقرأ ما فوق — يُعدّ له الجديد في زرٍّ بدلًا من ذلك. */
  useEffect(() => {
    const el = thread.current;
    if (!el) return;
    if (atEnd.current) { el.scrollTop = el.scrollHeight; setBehind(0); }
    else setBehind((n) => n + 1);
  }, [msgs.length]);

  useEffect(() => () => { if (tick.current) clearInterval(tick.current); }, []);

  const toEnd = () => {
    const el = thread.current;
    if (el) { el.scrollTop = el.scrollHeight; atEnd.current = true; setBehind(0); }
  };

  /* «العميل بيكتب» عند الموظف: نبضةٌ كل أربع ثوانٍ على الأكثر مهما كتب،
     فلا يُرسَل طلبٌ مع كل حرف. ولا تُرسَل قبل أن تبدأ المحادثة. */
  const lastPing = useRef(0);
  const ping = useCallback(() => {
    const now = Date.now();
    if (now - lastPing.current < 4000) return;
    lastPing.current = now;
    fetch('/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lang, typing: true }),
    }).catch(() => {});
  }, [lang]);

  async function post(body: any) {
    setErr('');
    const r = await fetch('/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lang, page: location.pathname, ...body }),
    });
    const d = await r.json().catch(() => ({}));
    if (!d?.ok) { setErr(d?.error === 'noFiles' ? x.botNoFiles : x.failed); return false; }
    setStatus(d.status ?? status);
    push(d.messages ?? []);
    atEnd.current = true;
    return true;
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const t = text.trim();
    if ((!t && !pend.length) || busy) return;
    setBusy('send'); setText(''); setEmoji(false);
    const mine = pend; setPend([]);
    const to = quote?.id ?? null; setQuote(null);
    const ok = await post({ text: t, files: mine, replyTo: to });
    /* لا يضيع ما كتبه ولا ما أرفقه حين تفشل الشبكة */
    if (!ok) { setText(t); setPend(mine); }
    setBusy('');
  }

  /** يرفع ملفًا واحدًا ويعيد وصفه، أو رسالةَ خطأ. */
  async function send1(file: Blob, name: string, secs?: number): Promise<File_ | string> {
    const fd = new FormData();
    fd.append('file', file, name);
    if (secs) fd.append('secs', String(Math.round(secs)));
    const r = await fetch('/api/chat/upload', { method: 'POST', body: fd });
    const d = await r.json().catch(() => ({}));
    if (d?.ok) return d.file as File_;
    return d?.error === 'type' ? x.badType
      : d?.error === 'big' ? x.tooBig.replace('{n}', String(d.max ?? 200))
        : d?.error === 'save' ? (d.detail ?? x.failed) : x.failed;
  }

  /**
   * يرفع الملف ويضعه في الانتظار — لا يُرسله.
   *
   * كان يُرسَل بمجرّد اختياره، فلا يملك صاحبه أن يكتب معه سطرًا ولا أن
   * يتراجع عن صورةٍ اختارها بالخطأ. وهو في الانتظار يُرى ويُشال، ويخرج مع
   * «ابعت» ومعه كلامه — كما في لوحة الموظف.
   */
  async function upload(file: Blob, name: string, secs?: number) {
    setBusy('up'); setErr('');
    try {
      const one = await send1(file, name, secs);
      if (typeof one === 'string') { setErr(one); return; }

      /* مقطعٌ: تُستخرَج لقطاته هنا وتُرفَع معه — أولاها ملصقه، وبقيّتها
         يقرؤها البوت. وفشلُها لا يمنع إرسال المقطع نفسه. */
      if (one.kind === 'video' && file instanceof File) {
        setBusy('frames');
        const shots = await grabFrames(file);
        const ups = await Promise.all(shots.map((b, i) => send1(b, `${name.replace(/\.[^.]+$/, '')}-f${i}.jpg`)));
        const good = ups.filter((u): u is File_ => typeof u !== 'string').map((u) => u.url);
        if (good.length) { one.poster = good[0]; one.frames = good; }
      }

      setPend((p) => [...p, one].slice(0, 4));
      input.current?.focus();
    } catch { setErr(x.failed); } finally { setBusy(''); }
  }

  /** الرسالة الصوتية: تُرفَع وتُرسَل في خطوةٍ واحدة */
  async function voiceOut(blob: Blob, name: string, secs: number) {
    setBusy('up'); setErr('');
    const to = quote?.id ?? null; setQuote(null);
    try {
      const one = await send1(blob, name, secs);
      if (typeof one === 'string') { setErr(one); return; }
      await post({ files: [one], replyTo: to });
    } catch { setErr(x.failed); } finally { setBusy(''); }
  }

  /* المرفقات للموظف وحده: المساعد لا يفتحها، فقبولها يوهم العميل أنها وصلت
     وفُهمت. والمنع هنا يغطّي السحب واللصق معًا، لا الزرّ المخفيّ وحده. */
  function take(f: File | null | undefined) {
    if (!f) return;
    if (status !== 'human') { setErr(x.botNoFiles); return; }
    upload(f, f.name);
  }
  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';                 // اختيار الملف نفسه ثانيةً يعمل
    take(f);
  }

  /* اللصق والسحب: لقطةُ شاشةٍ تُلصَق مباشرةً كما في أي تطبيق مراسلة */
  function onPaste(e: React.ClipboardEvent) {
    const f = [...(e.clipboardData?.files ?? [])][0];
    if (f) { e.preventDefault(); take(f); }
  }

  async function startRec() {
    setErr('');
    try {
      /* لا مسجِّل أصلًا (متصفّح قديم، أو صفحة بلا سياقٍ آمن) */
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setErr(x.micBlocked); return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      /* الوعاء الذي يدعمه هذا المتصفّح: كروم وفَيَرفُكس WebM، وسَفاري MP4 */
      const mime = ['audio/webm', 'audio/ogg', 'audio/mp4']
        .find((m) => MediaRecorder.isTypeSupported?.(m)) ?? '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = []; keep.current = true;
      let secs = 0;
      mr.ondataavailable = (ev) => { if (ev.data.size) chunks.current.push(ev.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (tick.current) { clearInterval(tick.current); tick.current = null; }
        setRec({ on: false, secs: 0, cancel: false });
        /* أقلّ من ثانية: ضغطةٌ عابرة لا رسالة */
        if (!keep.current || !chunks.current.length || secs < 1) return;
        /* الصوت يخرج بمجرّد رفع الإصبع، كما في كل تطبيقات المراسلة: هو
           الرسالة نفسها لا مرفقٌ يُكتَب معه. */
        const type = mr.mimeType || mime || 'audio/webm';
        voiceOut(new Blob(chunks.current, { type }), `voice-${Date.now()}.${audioExt(type)}`, secs);
      };
      recorder.current = mr;
      mr.start();
      setRec({ on: true, secs: 0, cancel: false });
      tick.current = setInterval(() => {
        secs += 1;
        /* حدٌّ أعلى: دقيقتان تكفيان وصفَ عطل، وتبقيان الملف صغيرًا */
        if (secs >= 120) { keep.current = true; recorder.current?.stop(); return; }
        setRec((r) => ({ ...r, secs }));
      }, 1000);
    } catch (e: any) {
      /* ثلاث حالات لا واحدة: مرفوضٌ من صاحب الجهاز، أو لا مايك، أو مقفولٌ
         بسياسة الصفحة. ومن يقرأ «أو» لا يعرف أيَّها يصلح. */
      const n = e?.name ?? '';
      setErr(n === 'NotFoundError' || n === 'DevicesNotFoundError' ? x.micNone
        : n === 'NotAllowedError' || n === 'SecurityError' ? x.micDenied
          : x.micBlocked);
    }
  }

  const stopRec = (save: boolean) => { keep.current = save; recorder.current?.stop(); };

  async function talk() {
    if (busy) return;
    setBusy('send');
    await fetch('/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lang, page: location.pathname, handoff: {} }),
    }).catch(() => {});
    setStatus('human');
    /* طلبَ موظفًا من جديد: العرضُ يُستأنف إن طال صمتهم ثانيةً */
    setNoBot(false); setWaiting(0);
    setBusy('');
  }

  /** يعود إلى المساعد ريثما يفرغ موظف — ويُجاب عن سؤاله المعلّق */
  async function toBot() {
    if (busy) return;
    setBusy('send'); setWaiting(0);
    const ok = await post({ toBot: true });
    if (!ok) setWaiting(1);          // فشلت: يبقى العرض قائمًا
    /* مرفقٌ جُهِّز للموظف لا يصلح للمساعد، فيُسقَط ويُقال لِمَ — لا يُترَك
       معلّقًا فوق خانةٍ لم يعد فيها زرٌّ يديره. */
    else if (pend.length) { setPend([]); setErr(x.botNoFiles); }
    setBusy('');
  }

  const human = status === 'human';
  /* محادثةٌ لم تبدأ: يُسأل أولًا مع مَن يتكلّم بدل أن يُترَك يكتب «موظف»
     فيُخمَّن قصدُه. واختياره لا يُخزَّن: هو بدايةُ المحادثة نفسها. */
  const fresh = !msgs.length && !pickedBot && !human;
  let day = '';

  return (
    <div className={`cuchat${drag ? ' is-drop' : ''}`}
         onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
         onDragLeave={() => setDrag(false)}
         onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer?.files?.[0]); }}>

      <div className="cuchat__thread" ref={thread} aria-live="polite"
           onScroll={(e) => {
             const el = e.currentTarget;
             atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 70;
             if (atEnd.current) setBehind(0);
           }}>
        {fresh ? (
          <div className="cuchat__pick">
            <b>{x.pickHead}</b>
            <button type="button" onClick={() => setPickedBot(true)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3.5" y="7.5" width="17" height="12" rx="3" />
                <path d="M12 7.5V4M9 12.5h.01M15 12.5h.01M9.5 16h5" />
              </svg>
              <span><b>{x.pickBot}</b><small>{x.pickBotSub}</small></span>
            </button>
            <button type="button" onClick={() => { setPickedBot(true); talk(); }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="3.6" />
                <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
              </svg>
              <span><b>{x.pickAgent}</b><small>{x.pickAgentSub}</small></span>
            </button>
          </div>
        ) : null}

        {greeting && !msgs.length && pickedBot && !human ? (
          <Bubble role="bot" x={x} lang={lang} m={{ id: 0, role: 'bot', text: greeting }} onReply={null} onZoom={setZoom} />
        ) : null}
        {!msgs.length && !greeting && !fresh ? <p className="cuchat__empty">{x.empty}</p> : null}

        {msgs.map((m, i) => {
          const k = dayKey(m.created_at);
          const first = k && k !== day;
          if (first) day = k;
          /* الرسائل المتتالية من المتكلّم نفسه تُجمَّع: الاسمُ مرّةً، والذيل
             على آخرها وحدها — كما يفعل كل تطبيق مراسلة. */
          const prev = msgs[i - 1];
          const next = msgs[i + 1];
          const sameAsPrev = !first && prev?.role === m.role && dayKey(prev?.created_at) === k;
          const sameAsNext = next?.role === m.role && dayKey(next?.created_at) === k;
          return (
            <div key={m.id} className="cuchat__row">
              {first ? <span className="cuchat__day">{dayLabel(k, x, lang)}</span> : null}
              <Bubble role={m.role} x={x} lang={lang} m={m} onZoom={setZoom}
                      head={!sameAsPrev} tail={!sameAsNext}
                      onReply={m.role === 'system' ? null : () => { setQuote({ id: m.id, role: m.role, text: m.text, files: m.files }); input.current?.focus(); }} />
            </div>
          );
        })}

        {typing ? (
          <div className="cuchat__m cuchat__m--agent cuchat__typing" aria-label={x.typing}>
            <i /><i /><i />
          </div>
        ) : null}

        {/* ينتظر موظفًا ولم يردّ أحد: يُعرَض المساعد ريثما يفرغون — ولا
            يُفرَض عليه، فله أن ينتظر. ورفضُه يُحفَظ لهذه الجلسة فلا يُسأل
            كل بضع ثوانٍ عن شيءٍ قاله مرّة. */}
        {waiting && !noBot ? (
          <div className="cuchat__wait">
            <b>{x.waitHead}</b>
            <p>{x.waitSub}</p>
            <span>
              <button type="button" className="btn btn--sm" onClick={toBot} disabled={Boolean(busy)}>{x.waitBtn}</button>
              <button type="button" className="cuchat__link" onClick={() => setNoBot(true)}>{x.waitKeep}</button>
            </span>
          </div>
        ) : null}
        {busy ? <p className="cuchat__hint">{busy === 'up' ? x.uploading : busy === 'frames' ? x.framing : x.sending}</p> : null}
        {err ? <p className="cuchat__err" role="alert">{err}</p> : null}
      </div>

      {behind ? (
        <button type="button" className="cuchat__down" onClick={toEnd}>
          <span>{behind}</span> {x.down} ↓
        </button>
      ) : null}

      {quote ? (
        <div className="cuchat__quote">
          <div>
            <b>{x.replyTo} {x.who[quote.role] || ''}</b>
            <span>{gist(quote, x)}</span>
          </div>
          <button type="button" aria-label={x.cancel} onClick={() => setQuote(null)}>×</button>
        </div>
      ) : null}

      {/* المرفقات المنتظرة: تُرى قبل أن تصل، ويُشال منها ما اختير بالخطأ */}
      {pend.length ? (
        <div className="cuchat__pend">
          {pend.map((f, i) => (
            <span key={i}>
              {f.kind === 'image' ? <img src={'/' + f.url} alt="" />
                : f.poster ? <img src={'/' + f.poster} alt="" />
                  : <b>{f.kind === 'video' ? x.video : f.kind === 'audio' ? x.voice : x.file}</b>}
              <small>{f.name}</small>
              <button type="button" aria-label={x.cancel}
                      onClick={() => setPend((p) => p.filter((_, n) => n !== i))}>×</button>
            </span>
          ))}
        </div>
      ) : null}

      {fresh ? null : rec.on ? (
        <div className={`cuchat__rec${rec.cancel ? ' is-cancel' : ''}`}>
          <span className="cuchat__dot" aria-hidden="true" />
          <b>{x.recording}</b>
          <time dir="ltr">{mmss(rec.secs)}</time>
          <button type="button" className="btn btn--sm" onClick={() => stopRec(true)}>{x.stop}</button>
          <button type="button" className="cuchat__link" onClick={() => stopRec(false)}>{x.cancel}</button>
        </div>
      ) : (
        <form className="cuchat__bar" onSubmit={send}>
          {/* مع المساعد: لا مشبك ولا مايك — هو يقرأ الكلام وحده */}
          {human ? (
            <label className="cuchat__icon" title={x.attach}>
              <input type="file" accept="image/*,video/*,audio/*,.pdf" onChange={pick} hidden disabled={Boolean(busy)} />
              <span className="sr">{x.attach}</span>
              <Ico d="M21.4 11.6 12.2 20.8a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8" />
            </label>
          ) : null}

          <button type="button" className="cuchat__icon" onClick={() => setEmoji((v) => !v)}
                  title={x.emoji} aria-expanded={emoji} disabled={Boolean(busy)}>
            <span className="sr">{x.emoji}</span>
            <Ico d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 10h.01M15 10h.01M8.5 14.5a4.5 4.5 0 0 0 7 0" />
          </button>

          <input ref={input} className="cuchat__input" value={text} dir="auto" onPaste={onPaste}
                 onChange={(e) => { setText(e.target.value); ping(); }}
                 placeholder={x.placeholder} maxLength={1000} disabled={Boolean(busy)} />

          {text.trim() || pend.length ? (
            /* زرٌّ مستديرٌ بسهم لا زرٌّ بكلمة: هو الفعل الوحيد هنا، ويُعرَف
               بشكله في كل تطبيق مراسلة — ويأخذ حيّزًا أقلّ على الهاتف. */
            <button className="cuchat__go" type="submit" disabled={Boolean(busy)} title={x.send} aria-label={x.send}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3.2 20.3 21 12 3.2 3.7l.01 6.49L15.5 12 3.21 13.81z" />
              </svg>
            </button>
          ) : human ? (
            <button type="button" className="cuchat__icon cuchat__icon--mic" title={x.rec} disabled={Boolean(busy)}
                    onPointerDown={(e) => { e.preventDefault(); startRec(); }}
                    onPointerUp={() => stopRec(true)}
                    onPointerLeave={() => { if (rec.on) stopRec(false); }}>
              <span className="sr">{x.rec}</span>
              <Ico d="M9 5.5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0zM5 11.5a7 7 0 0 0 14 0M12 18.5V21.5M8.5 21.5h7" />
            </button>
          ) : null}
        </form>
      )}

      {emoji ? (
        <div className="cuchat__emoji" role="group" aria-label={x.emoji}>
          {EMOJI.map((e) => (
            <button key={e} type="button" onClick={() => { setText((t) => (t + e).slice(0, 1000)); input.current?.focus(); }}>{e}</button>
          ))}
        </div>
      ) : null}

      {/* بعد الاختيار يبقى الانتقال إلى موظف متاحًا، لا سؤالًا يُعاد */}
      <div className="cuchat__foot">
        {fresh ? null : human ? <span className="cuchat__with">{x.talking}</span>
          : <button type="button" className="cuchat__link" onClick={talk} disabled={Boolean(busy)}>{x.talk}</button>}
      </div>

      {drag ? <div className="cuchat__drop">{x.drop}</div> : null}

      {zoom ? (
        <div className="cuchat__zoom" role="dialog" aria-modal="true" onClick={() => setZoom(null)}>
          <button type="button" aria-label={x.close} onClick={() => setZoom(null)}>×</button>
          <img src={zoom} alt="" />
        </div>
      ) : null}
    </div>
  );
}

function Ico({ d }: { d: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Bubble({ role, m, x, lang, onReply, onZoom, head = true, tail = true }: {
  role: Role; m: Msg; x: typeof TX['ar']; lang: 'ar' | 'en';
  onReply: (() => void) | null; onZoom: (u: string) => void;
  /** أولى المتتاليات: عليها الاسم. وآخرها: عليها الذيل والوقت. */
  head?: boolean; tail?: boolean;
}) {
  const mine = role === 'user';
  return (
    <div className={`cuchat__m cuchat__m--${role}${head ? '' : ' is-cont'}${tail ? ' is-last' : ''}`}>
      {x.who[role] && head ? <b>{x.who[role]}</b> : null}

      {m.reply ? (
        <span className="cuchat__qt">
          <b>{x.who[m.reply.role] || ''}</b>
          <span dir="auto">{gist(m.reply, x)}</span>
        </span>
      ) : null}

      {/* المرفق أولًا والكلام تحته تعليقًا عليه — كما في كل تطبيق مراسلة.
          وكان النصّ فوقه، فيُقرأ «دي صورة الفرشاية» قبل أن تُرى الفرشاية. */}
      {(m.files ?? []).map((f, i) => <Attach key={i} f={f} x={x} onZoom={onZoom} />)}
      {/* dir="auto": الصفحة بلغةٍ واحدة والرسائل قد تأتي بالأخرى، فكانت
          علامات الترقيم تقع في الطرف الخطأ. والاتجاه يُستنتَج من أول حرفٍ قويّ. */}
      {m.text ? <span className="cuchat__tx" dir="auto">{m.text}</span> : null}

      {role !== 'system' ? (
        <span className="cuchat__meta">
          <time dir="ltr">{clock(m.created_at, lang)}</time>
          {/* العلامة لمن كتب وحده: من يقرأ رسالته لا يُخبَر أنه قرأها */}
          {mine && m.id ? <Ticks read={Boolean(m.read_at)} /> : null}
        </span>
      ) : null}

      {onReply && m.id ? (
        <button type="button" className="cuchat__replybtn" onClick={onReply} title={x.reply} aria-label={x.reply}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

/** ✓ وصلت · ✓✓ قُرئت */
function Ticks({ read }: { read: boolean }) {
  return (
    <svg className={`cuchat__tick${read ? ' is-read' : ''}`} width="17" height="12" viewBox="0 0 20 12"
         fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 6.5 4.5 10 11 2.5" />
      {read ? <path d="M8 6.5 11.5 10 18 2.5" /> : null}
    </svg>
  );
}

/** الصورة تُعرَض وتُكبَّر، والفيديو يُشغَّل، والصوت شريطُ تشغيل، والملف يُنزَّل. */
function Attach({ f, x, onZoom }: { f: File_; x: typeof TX['ar']; onZoom: (u: string) => void }) {
  const src = '/' + String(f.url ?? '').replace(/^\//, '');
  if (!f?.url) return null;
  if (f.kind === 'image') {
    return (
      <span className="cuchat__shot">
        <button type="button" className="cuchat__img" onClick={() => onZoom(src)}>
          <img src={src} alt={f.name ?? ''} loading="lazy" width={f.w ?? undefined} height={f.h ?? undefined} />
        </button>
      </span>
    );
  }
  if (f.kind === 'video') return <Clip f={f} x={x} />;
  if (f.kind === 'audio') return <Voice f={f} x={x} />;
  return (
    <a className="cuchat__file" href={src} target="_blank" rel="noreferrer">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      </svg>
      <span>{f.name || x.file}</span>
      {f.bytes ? <small>{kb(f.bytes)}</small> : null}
    </a>
  );
}

/**
 * الرسالة الصوتية: مشغّلٌ مكتوب لا مشغّل المتصفّح الافتراضي.
 *
 * الافتراضي عريضٌ ثابت العرض، فيُزنَق في فقاعةٍ ضيّقة ويختلف شكله من متصفّح
 * لآخر. وهذا زرٌّ وشريطُ تقدّمٍ ومدّةٌ وتنزيل، بعرض ما يتاح له.
 */
function Voice({ f, x }: { f: File_; x: typeof TX['ar'] }) {
  const src = '/' + String(f.url).replace(/^\//, '');
  const el = useRef<HTMLAudioElement>(null);
  const [on, setOn] = useState(false);
  const [at, setAt] = useState(0);
  const [dur, setDur] = useState(f.secs ?? 0);

  const toggle = () => {
    const a = el.current;
    if (!a) return;
    if (a.paused) { a.play().catch(() => {}); } else a.pause();
  };

  return (
    <span className="cuchat__voice">
      <audio ref={el} src={src} preload="metadata"
             onPlay={() => setOn(true)} onPause={() => setOn(false)}
             onEnded={() => { setOn(false); setAt(0); }}
             onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
             onLoadedMetadata={(e) => {
               const d = e.currentTarget.duration;
               if (Number.isFinite(d) && d > 0) setDur(d);
             }} />
      <button type="button" className="cuchat__pbtn" onClick={toggle} aria-label={on ? x.pause : x.play}>
        {on ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6.5" y="4.5" width="4" height="15" rx="1.2" /><rect x="13.5" y="4.5" width="4" height="15" rx="1.2" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7 4.8v14.4a1 1 0 0 0 1.5.87l11.5-7.2a1 1 0 0 0 0-1.74L8.5 3.93A1 1 0 0 0 7 4.8z" />
          </svg>
        )}
      </button>
      <span className="cuchat__wave" aria-hidden="true">
        <i style={{ width: `${dur ? Math.min(100, (at / dur) * 100) : 0}%` }} />
      </span>
      <time dir="ltr">{mmss(on || at ? at : dur)}</time>
    </span>
  );
}

/**
 * المقطع: ملصقه ظاهرٌ قبل التشغيل، فلا تبقى مصغّرةٌ مكسورة كما كانت حين
 * عجز المتصفّح عن استخراج أول إطارٍ وحده. ويُشغَّل عند الضغط لا قبله.
 */
function Clip({ f, x }: { f: File_; x: typeof TX['ar'] }) {
  const src = '/' + String(f.url).replace(/^\//, '');
  const poster = f.poster ? '/' + f.poster.replace(/^\//, '') : null;
  const [play, setPlay] = useState(false);

  if (play || !poster) {
    return (
      <span className="cuchat__clip">
        <video className="cuchat__vid" src={src} poster={poster ?? undefined}
               controls autoPlay={play} preload="metadata" playsInline />
      </span>
    );
  }
  return (
    <span className="cuchat__clip">
      <button type="button" className="cuchat__play" onClick={() => setPlay(true)} aria-label={x.openVid}>
        <img src={poster} alt="" loading="lazy" />
        <i>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7 4.8v14.4a1 1 0 0 0 1.5.87l11.5-7.2a1 1 0 0 0 0-1.74L8.5 3.93A1 1 0 0 0 7 4.8z" />
          </svg>
        </i>
      </button>
    </span>
  );
}
