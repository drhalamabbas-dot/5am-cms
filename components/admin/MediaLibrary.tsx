'use client';
/* =============================================================================
   شاشة المكتبة.

   الرفع بالسحب أو بالزر، والحذف يسأل أولًا أين يُستعمل الملف — فلا تختفي صورة
   من صفحة دون أن يعرف صاحب الموقع.

   ملفات الموقع الأصلية تظهر للاختيار ولا تُحذف من هنا: حذفها يكسر صفحات
   منقولة، والاستبدال أسلم من الحذف.
============================================================================= */
import { useRef, useState } from 'react';

import type { MediaRow } from '@/lib/media';

const KINDS: [string, string][] = [['all', 'الكل'], ['image', 'صور'], ['video', 'فيديو'], ['document', 'ملفات']];
const size = (n: number | null) => (n == null ? '' : n > 1e6 ? (n / 1e6).toFixed(1) + ' م.ب' : Math.round(n / 1024) + ' ك.ب');
/* مثل isUpload في lib/media؛ مكرّرة هنا لأن ذلك الملف يتصل بالقاعدة ولا يصل إلى المتصفح. */
const own = (p: string) => p.startsWith('media/');

export function MediaLibrary({ initial }: { initial: MediaRow[] }) {
  const [items, setItems] = useState<MediaRow[]>(initial);
  const [kind, setKind] = useState('all');
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  /* عدّاد لا راية: السحب فوق عنصر ابن يطلق dragleave على الأب، فتنطفئ الإضاءة
     والملف ما زال فوق المنطقة. */
  const depth = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  async function load(k = kind, t = term) {
    const r = await fetch(`/api/admin/media?kind=${encodeURIComponent(k)}&q=${encodeURIComponent(t)}`);
    setItems((await r.json()).items ?? []);
  }

  /* الرفع بـ XHR لا fetch كي يظهر تقدّمه: ملف فيديو بمئتي ميجابايت يأخذ وقتًا،
     وشريط يتحرّك أوضح من زرّ يقول «جارٍ الرفع» بلا نهاية معلومة. */
  function upload(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true); setMsg(null); setPct(0);
    const fd = new FormData();
    Array.from(list).forEach((f) => fd.append('files', f));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/media');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setBusy(false); setPct(0);
      let j: any = {};
      try { j = JSON.parse(xhr.responseText); } catch { /* رد غير متوقّع */ }
      if (xhr.status !== 200) {
        setMsg({ text: j.error ?? `تعذّر الرفع (${xhr.status})`, bad: true });
        return;
      }
      setMsg(j.failed?.length
        ? { text: j.failed.join(' · '), bad: true }
        : { text: `تم رفع ${j.added?.length ?? 0} ملف` });
      load();
    };
    xhr.onerror = () => {
      setBusy(false); setPct(0);
      setMsg({ text: 'انقطع الاتصال أثناء الرفع. جرّب مرة أخرى.', bad: true });
    };
    xhr.send(fd);
  }

  async function remove(row: MediaRow) {
    const r = await fetch(`/api/admin/media?used=${encodeURIComponent(row.path)}`);
    const used = (await r.json()).used ?? [];
    const where = used.length
      ? `\n\nمستعمل في:\n${[...new Set(used.map((u: any) => u.where))].slice(0, 8).join('\n')}`
      : '\n\nغير مستعمل في أي صفحة.';
    if (!confirm(`حذف «${row.path.split('/').pop()}»؟${where}`)) return;
    const d = await fetch(`/api/admin/media?id=${row.id}`, { method: 'DELETE' });
    const j = await d.json();
    if (!j.ok) { setMsg({ text: j.error ?? 'تعذّر الحذف', bad: true }); return; }
    setMsg({ text: 'حُذف الملف' });
    load();
  }

  return (
    <div
      ref={zoneRef}
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        depth.current++;
        zoneRef.current?.classList.add('is-drop');
      }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) zoneRef.current?.classList.remove('is-drop');
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        zoneRef.current?.classList.remove('is-drop');
        upload(e.dataTransfer.files);
      }}
    >
      {msg ? <p className={`msg ${msg.bad ? 'msg--bad' : 'msg--ok'}`}>{msg.text}</p> : null}

      <div className="drop" onClick={() => !busy && fileRef.current?.click()}
           role="button" tabIndex={0}
           onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}>
        <b>اسحب الصور والفيديو إلى هنا</b>
        <span>أو اضغط لاختيارها من جهازك</span>
        {busy ? (
          <>
            <span className="drop__busy">جارٍ الرفع… {pct}%</span>
            <div className="upbar"><span style={{ width: `${pct}%` }} /></div>
          </>
        ) : null}
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel__body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {KINDS.map(([k, label]) => (
              <button key={k} type="button" className={`btn btn--sm ${kind === k ? '' : 'btn--ghost'}`}
                      onClick={() => { setKind(k); load(k, term); }}>{label}</button>
            ))}
          </div>
          <input type="search" placeholder="ابحث بالاسم…" value={term} style={{ flex: '1 1 200px', width: 'auto' }}
                 onChange={(e) => { setTerm(e.target.value); load(kind, e.target.value); }} />
          <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? 'جارٍ الرفع…' : '+ ارفع ملفات'}
          </button>
          <input ref={fileRef} type="file" multiple hidden
                 accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.pdf"
                 onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
        </div>
      </div>

      <p className="field__hint" style={{ marginBottom: 14 }}>
        السحب يعمل في أي مكان من هذه الصفحة، لا في المربّع وحده.
        الصور حتى 20 ميجابايت، والفيديو حتى 200، وملفات PDF حتى 40.
        الصور الكبيرة تُصغَّر تلقائيًا فتخفّ على الموقع، ولا تحتاج تجهيزها قبل الرفع.
        الفيديو الأطول من ذلك ارفعه على يوتيوب وضع رابطه في المنتج.
      </p>

      <div className="panel">
        <div className="panel__head">
          <h2>{items.length} ملف</h2>
        </div>
        <div className="panel__body">
          {items.length === 0 ? <p className="empty">لا ملفات مطابقة.</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 14 }}>
              {items.map((it) => (
                <figure key={it.id} style={{ margin: 0, border: '1px solid var(--line)', borderRadius: 8, padding: 8, background: '#fff' }}>
                  <div style={{ height: 100, display: 'grid', placeItems: 'center', background: '#f5f8fc', borderRadius: 6, overflow: 'hidden' }}>
                    {it.kind === 'image'
                      ? <img src={'/' + it.path} alt={it.alt_ar ?? ''} loading="lazy"
                             style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      : <span style={{ color: 'var(--muted)', fontSize: 13 }}>{it.kind === 'video' ? '▶ فيديو' : 'PDF'}</span>}
                  </div>
                  <figcaption style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6, color: 'var(--muted)', wordBreak: 'break-all' }}>
                    {it.path.split('/').pop()}
                    <br />{size(it.bytes)}{it.width ? ` · ${it.width}×${it.height}` : ''}
                  </figcaption>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <a className="btn btn--ghost btn--sm" href={'/' + it.path} target="_blank" rel="noopener">فتح</a>
                    {own(it.path)
                      ? <button type="button" className="btn btn--bad btn--sm" onClick={() => remove(it)}>حذف</button>
                      : <span className="tag" title="من ملفات الموقع الأصلية">أصلي</span>}
                  </div>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
