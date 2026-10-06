'use client';
/* =============================================================================
   جرس التنبيهات في اللوحة: يسأل /api/admin/notifications كل 30 ثانية (وفور
   الرجوع للتبويب)، ويصدر نغمة قصيرة إن وصل جديد، ويكتب العدد في عنوان التبويب
   كي يُرى والموظف في تبويب آخر.

   النغمة تُولَّد بالمتصفح (Web Audio) بلا ملف صوت. والمتصفح لا يسمح بالصوت قبل
   أول ضغطة في الصفحة — فإن مُنع، يبقى العدد والعنوان.
============================================================================= */
import { useCallback, useEffect, useRef, useState } from 'react';

type Note = { id: number; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

function chime() {
  try {
    const A = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new A();
    const tone = (f: number, at: number) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + 0.4);
    };
    tone(880, 0); tone(1320, 0.18);
    setTimeout(() => ctx.close(), 1000);
  } catch { /* بلا صوت */ }
}

const ago = (s: string) => {
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} د`;
  const h = Math.round(m / 60);
  return h < 24 ? `منذ ${h} س` : new Date(s).toLocaleDateString('ar-EG');
};

export function Bell() {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);
  const last = useRef<number | null>(null);
  const baseTitle = useRef('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/notifications', { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      const newest = d.items?.[0]?.id ?? 0;
      /* أول تحميل لا يرنّ: الجديد هو ما وصل بعد فتح الصفحة */
      if (last.current !== null && newest > last.current && d.items.some((n: Note) => n.id > last.current! && !n.read_at)) chime();
      last.current = Math.max(last.current ?? 0, newest);
      setUnread(d.unread ?? 0);
      setItems(d.items ?? []);
    } catch { /* الشبكة: المرة القادمة */ }
  }, []);

  useEffect(() => {
    baseTitle.current = document.title.replace(/^\(\d+\)\s*/, '');
    load();
    const t = setInterval(load, 30000);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  /* العنوان يُقرأ من جديد كل مرة: الانتقال بين شاشات اللوحة يغيّره */
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '') || baseTitle.current;
    if (base) baseTitle.current = base;
    document.title = unread ? `(${unread}) ${baseTitle.current}` : baseTitle.current;
  }, [unread]);
  useEffect(() => {
    const head = document.querySelector('title');
    if (!head) return;
    const mo = new MutationObserver(() => {
      if (!/^\(\d+\)/.test(document.title) && unread) {
        baseTitle.current = document.title || baseTitle.current;
        document.title = `(${unread}) ${baseTitle.current}`;
      }
    });
    mo.observe(head, { childList: true, characterData: true, subtree: true });
    return () => mo.disconnect();
  }, [unread]);

  /* تُغلق بـ Esc أو بضغطة خارجها */
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  const mark = async (body: object) => {
    await fetch('/api/admin/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
    load();
  };

  return (
    <div className="bell" ref={box}>
      <button type="button" className={`bell__btn${unread ? ' has-new' : ''}`} onClick={() => setOpen((o) => !o)}
              aria-expanded={open} aria-label={unread ? `${unread} تنبيه جديد` : 'التنبيهات'}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"/></svg>
        <span>التنبيهات</span>
        {unread ? <b>{unread > 99 ? '99+' : unread}</b> : null}
      </button>
      {open ? (
        <div className="bell__panel" role="dialog" aria-label="التنبيهات">
          <div className="bell__head">
            <b>التنبيهات</b>
            {unread ? <button type="button" onClick={() => mark({ all: true })}>علّم الكل مقروءًا</button> : null}
          </div>
          {items.length ? (
            <ul>
              {items.map((n) => (
                <li key={n.id} className={n.read_at ? '' : 'is-new'}>
                  <a href={n.link ?? '#'} onClick={() => { if (!n.read_at) mark({ id: n.id }); }}>
                    <b>{n.title}</b>
                    {n.body ? <span>{n.body}</span> : null}
                    <small>{ago(n.created_at)}</small>
                  </a>
                </li>
              ))}
            </ul>
          ) : <p>لا تنبيهات بعد.</p>}
        </div>
      ) : null}
    </div>
  );
}
