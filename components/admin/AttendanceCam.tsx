'use client';
/* =============================================================================
   كاميرا الحضور والانصراف (app/admin/attendance).

   يفتح الكاميرا الأمامية ويطلب الموقع معًا، ويحمّل نموذج الوجه (face-api،
   7 ميجا مرة واحدة ثم من ذاكرة المتصفح) من /models/face. عند «التقط»: يحسب
   بصمة الوجه في المتصفح نفسه ويرسلها مع صورة صغيرة والموقع إلى
   /api/admin/attendance، ويعرض ردّ الخادم كما هو (تعرّف / لم يتعرّف / بعيد).
   الصورة لا تُرسل لأي جهة خارجية: النموذج يعمل على الجهاز.
============================================================================= */
import { useEffect, useRef, useState } from 'react';

type Mode = 'enroll' | 'in' | 'out';
type Fix = { lat: number; lng: number; accuracy: number } | null;
const TITLE: Record<Mode, string> = { enroll: 'سجّل وجهك', in: 'سجّل الحضور', out: 'سجّل الانصراف' };

let modelsReady: Promise<any> | null = null;
function loadModels() {
  modelsReady ??= (async () => {
    const faceapi: any = await import('@vladmandic/face-api');
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models/face'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models/face'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models/face'),
    ]);
    /* أول تعرّف يجهّز كارت الشاشة (~8 ثوانٍ): يُجرى على صورة فارغة والكاميرا
       تُفتح، فلا ينتظر الموظف بعد «التقط» */
    const blank = document.createElement('canvas');
    blank.width = 320; blank.height = 240;
    try {
      await faceapi.detectSingleFace(blank, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 })).withFaceLandmarks().withFaceDescriptor();
    } catch { /* التجهيز فقط — لا يهم ناتجه */ }
    return faceapi;
  })().catch((e) => { modelsReady = null; throw e; });
  return modelsReady;
}

export function AttendanceCam({ mode }: { mode: Mode }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<'idle' | 'starting' | 'ready' | 'working' | 'done'>('idle');
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'bad' | 'info' } | null>(null);
  const [fix, setFix] = useState<Fix>(null);
  const [locErr, setLocErr] = useState('');
  const [consent, setConsent] = useState(false);

  const stop = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  useEffect(() => stop, []);

  async function start() {
    setMsg(null); setPhase('starting');
    if (mode !== 'enroll') {
      navigator.geolocation?.getCurrentPosition(
        (p) => { setFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); setLocErr(''); },
        () => setLocErr('لم نعرف موقعك. اسمح للمتصفح بالموقع (من علامة القفل بجانب العنوان) ثم أعد المحاولة.'),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
      );
    }
    try {
      const [s] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }),
        loadModels(),
      ]);
      stream.current = s;
      if (video.current) { video.current.srcObject = s; await video.current.play(); }
      setPhase('ready');
    } catch (e: any) {
      stop(); setPhase('idle');
      setMsg({ tone: 'bad', text: e?.name === 'NotAllowedError'
        ? 'المتصفح منع الكاميرا. اسمح بها (من علامة القفل بجانب العنوان) ثم اضغط مرة أخرى.'
        : 'تعذّر فتح الكاميرا أو تحميل نموذج الوجه. تأكد من الاتصال وأن الكاميرا غير مستعملة في برنامج آخر.' });
    }
  }

  async function capture() {
    const v = video.current;
    if (!v) return;
    if (mode === 'enroll' && !consent) { setMsg({ tone: 'bad', text: 'وافق أولًا على حفظ بصمة وجهك.' }); return; }
    if (mode !== 'enroll' && !fix) { setMsg({ tone: 'bad', text: locErr || 'ننتظر تحديد موقعك… لحظة ثم اضغط مرة أخرى.' }); return; }
    setPhase('working'); setMsg({ tone: 'info', text: 'نتعرّف على الوجه…' });
    try {
      const faceapi = await loadModels();
      const c = document.createElement('canvas');
      const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(v, 0, 0, w, h);
      const det = await faceapi.detectSingleFace(c, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks().withFaceDescriptor();
      if (mode === 'enroll' && !det) {
        setPhase('ready'); setMsg({ tone: 'bad', text: 'لم يظهر وجه واضح. قف في إضاءة جيدة، وانظر للكاميرا مباشرة، ثم التقط مرة أخرى.' });
        return;
      }
      const r = await fetch('/api/admin/attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: mode, consent: mode === 'enroll' ? consent : undefined,
          descriptor: det ? Array.from(det.descriptor as Float32Array) : null,
          photo: c.toDataURL('image/jpeg', 0.8), ...(fix ?? {}),
        }),
      });
      const d = await r.json().catch(() => ({ ok: false, message: 'تعذّر الاتصال بالخادم.' }));
      if (!d.ok) { setPhase('ready'); setMsg({ tone: 'bad', text: d.message }); return; }
      stop(); setPhase('done');
      setMsg({ tone: d.status === 'review' ? 'bad' : 'ok', text: d.message });
      setTimeout(() => location.reload(), d.status === 'review' ? 5000 : 2500);
    } catch {
      setPhase('ready'); setMsg({ tone: 'bad', text: 'حدث خطأ أثناء التعرّف. حاول مرة أخرى.' });
    }
  }

  return (
    <div className="attcam">
      {mode === 'enroll' ? (
        <label className="attcam__consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>أوافق على أن تحفظ الشركة بصمة وجهي (أرقام يحسبها المتصفح) وصورة التسجيل، لاستعمالهما في الحضور والانصراف فقط، وتُمسح عند انتهاء عملي.</span>
        </label>
      ) : null}
      <div className={`attcam__frame${phase === 'idle' ? ' is-off' : ''}`}>
        <video ref={video} playsInline muted aria-label="صورة الكاميرا" />
        {phase === 'idle' ? <span>الكاميرا مقفولة</span> : null}
        {phase === 'starting' ? <span>نفتح الكاميرا ونحمّل نموذج الوجه…</span> : null}
        {phase === 'ready' || phase === 'working' ? <i className="attcam__oval" aria-hidden="true" /> : null}
      </div>
      {mode !== 'enroll' && phase !== 'idle' && phase !== 'done' ? (
        <p className="field__hint" style={{ margin: 0 }}>{fix ? `الموقع محدد (دقة ${Math.round(fix.accuracy)} متر).` : locErr || 'نحدّد موقعك…'}</p>
      ) : null}
      {msg ? <p className={`msg ${msg.tone === 'ok' ? 'msg--ok' : msg.tone === 'bad' ? 'msg--bad' : ''}`} role="status" style={{ margin: 0 }}>{msg.text}</p> : null}
      {phase === 'idle' ? <button type="button" className="btn" onClick={start}>{TITLE[mode]} — افتح الكاميرا</button> : null}
      {phase === 'ready' || phase === 'working' ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={capture} disabled={phase === 'working'}>{phase === 'working' ? 'لحظة…' : `التقط و${TITLE[mode]}`}</button>
          <button type="button" className="btn btn--ghost" onClick={() => { stop(); setPhase('idle'); setMsg(null); }}>إلغاء</button>
        </div>
      ) : null}
    </div>
  );
}
