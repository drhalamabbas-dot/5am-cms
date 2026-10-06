'use client';
/* زر «ولّد أسئلة تدريب»: دفعات من 5 حتى العدد المطلوب، ويقف وحده لو الحد
   اليومي للحساب المجاني خلص (يكمّل بكرة من حيث وقف). */
import { useEffect, useState } from 'react';

export function TrainGenerator() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [msg, setMsg] = useState('');

  useEffect(() => { fetch('/api/admin/chat-training/generate').then((r) => r.json()).then((d) => setRemaining(d.remaining ?? null)).catch(() => {}); }, []);

  async function run(target: number) {
    setBusy(true); setMsg(''); setDone(0);
    let total = 0;
    try {
      while (total < target) {
        const r = await fetch('/api/admin/chat-training/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: Math.min(5, target - total) }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { setMsg(d.error ?? 'تعذّر التوليد'); break; }
        total += d.stored; setDone(total); setRemaining(d.remaining);
        if (d.failed) { setMsg('Qwen وقف يرد (غالبًا الحد اليومي للحساب المجاني خلص) — كمّل بكرة من نفس الزر.'); break; }
        if (!d.remaining) { setMsg('خلصت كل الأسئلة المتاحة من محتوى الموقع.'); break; }
      }
      if (total) setMsg((m) => m || `اتولّد ${total} سؤال وجواب — راجعهم تحت في «للمراجعة».`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="traingen">
      <p style={{ margin: 0 }}>
        {remaining == null ? '…' : <>فيه <b>{remaining}</b> سؤال عميل جاهز من محتوى الموقع (عربي وإنجليزي) لسه ما اتجاوبش.</>}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn--sm" disabled={busy || !remaining} onClick={() => run(10)}>ولّد 10</button>
        <button type="button" className="btn btn--sm btn--ghost" disabled={busy || !remaining} onClick={() => run(30)}>ولّد 30</button>
        {busy ? <span>جاري… {done} جاهز</span> : null}
        {!busy && done ? <a className="btn btn--sm btn--ghost" href="/admin/chat-training?s=new">راجعهم</a> : null}
      </div>
      {msg ? <p className="field__hint" style={{ margin: 0 }}>{msg}</p> : null}
    </div>
  );
}
