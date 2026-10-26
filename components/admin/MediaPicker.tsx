'use client';
/* =============================================================================
   اختيار صورة من المكتبة بالضغط عليها.

   قبل هذا كان على المحرّر أن يكتب مسار الصورة بيده — خطوة تحتاج معرفة بمجلدات
   الموقع، وحرف ناقص فيها يكسر الصورة. صار: زرّ واحد، ثم شبكة صور، ثم ضغطة.
   والرفع من داخل النافذة نفسها، فلا يغادر المحرّر ما هو فيه.
============================================================================= */
import { useEffect, useRef, useState } from 'react';

export type Item = { id: number; path: string; kind: string; bytes: number | null; width: number | null; height: number | null };

const KINDS: [string, string][] = [['image', 'صور'], ['video', 'فيديو'], ['document', 'ملفات'], ['all', 'الكل']];
const kb = (n: number | null) => (n == null ? '' : n > 1e6 ? (n / 1e6).toFixed(1) + ' م.ب' : Math.round(n / 1024) + ' ك.ب');

/* ترتيب الصور المختارة معًا قبل إضافتها */
const ORDERS: [string, string][] = [['click', 'بترتيب الضغط'], ['name', 'بالاسم'], ['new', 'الأحدث أولًا']];
/* ملفات الموقع الأصلية تُختار ولا تُحذف: حذفها يكسر صفحات منقولة
   (مثل MediaLibrary، والتحقّق مكرّر هنا لأن lib/media يتصل بالقاعدة). */
const own = (p: string) => p.startsWith('media/');
/** مقارنة أسماء بأرقامها (صورة-2 قبل صورة-10) — أسماء صور الهاتف تحمل الوقت، فالاسم ترتيب زمني */
export const byName = (a: string, b: string) => {
  /* بلا اللاحقة العشوائية التي يضيفها الرفع (lib/media.ts) — كانت تؤخّر أول صورة
     في مجموعة واحدة («…am» بلا رقم) بعد «…am-1» و«…am-2» */
  const base = (p: string) => p.split('/').pop()!.replace(/(-[0-9a-f]{8})?\.\w+$/i, '');
  return base(a).localeCompare(base(b), 'en', { numeric: true, sensitivity: 'base' });
};

export function MediaPicker({
  open, kind = 'image', onPick, onPickMany, already = [], onClose,
}: {
  open: boolean; kind?: string; onPick: (p: string) => void; onClose: () => void;
  /** اختيار عدّة ملفات معًا (معرض صور): الضغط يحدّد ولا يغلق، وزرّ يضيفها كلها */
  onPickMany?: (paths: string[]) => void;
  /** ما في المعرض أصلًا — يُعلَّم «مضافة» */
  already?: string[];
}) {
  const multi = Boolean(onPickMany);
  const [chosen, setChosen] = useState<string[]>([]);
  const [order, setOrder] = useState('click');
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState(kind);
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [pct, setPct] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const depth = useRef(0);

  async function load(k = filter, qq = term) {
    const r = await fetch(`/api/admin/media?kind=${encodeURIComponent(k)}&q=${encodeURIComponent(qq)}`);
    const j = await r.json();
    setItems(j.items ?? []);
  }

  useEffect(() => { if (open) { load(); setChosen([]); } /* eslint-disable-next-line */ }, [open]);

  const toggle = (p: string) => setChosen((c) => (c.includes(p) ? c.filter((x) => x !== p) : [...c, p]));
  /** المختار بالترتيب المطلوب. «الأحدث» بترتيب المكتبة (الأحدث رفعًا أولًا). */
  const ordered = () => {
    if (order === 'name') return [...chosen].sort(byName);
    if (order === 'new') { const at = new Map(items.map((it, i) => [it.path, i])); return [...chosen].sort((a, b) => (at.get(a) ?? 0) - (at.get(b) ?? 0)); }
    return chosen;
  };
  const addAll = () => { if (!chosen.length) return; onPickMany!(ordered()); onClose(); };

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, onClose]);

  function upload(list: FileList | null) {
    if (!list || !list.length) return;
    setBusy(true); setMsg(''); setPct(0);
    const fd = new FormData();
    Array.from(list).forEach((f) => fd.append('files', f));
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/media');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = async () => {
      setBusy(false); setPct(0);
      let j: any = {};
      try { j = JSON.parse(xhr.responseText); } catch { /* رد غير متوقّع */ }
      if (xhr.status !== 200) { setMsg(j.error ?? `تعذّر الرفع (${xhr.status})`); return; }
      if (j.failed?.length) setMsg(j.failed.join(' · '));
      else setMsg(`تم رفع ${j.added?.length ?? 0} ملف`);
      await load();
      /* اختيار عدّة: ما رُفع الآن يُحدَّد كله بترتيب رفعه، فتكفي بعده ضغطة «أضف» */
      if (multi) { const up = (j.added ?? []).map((a: any) => a.path); setChosen((c) => [...c, ...up.filter((p: string) => !c.includes(p))]); return; }
      /* ملف واحد مرفوع؟ هو المقصود على الأرجح، فيُختار مباشرة. */
      if (j.added?.length === 1 && !j.failed?.length) { onPick(j.added[0].path); onClose(); }
    };
    xhr.onerror = () => { setBusy(false); setPct(0); setMsg('انقطع الاتصال أثناء الرفع.'); };
    xhr.send(fd);
  }

  /* الحذف من اللوحة نفسها: كان على المحرّر أن يغادرها إلى شاشة المكتبة
     ليمسح ملفًا رآه الآن، فيفقد ما كان فيه. ويُسأل أولًا أين يُستعمل الملف
     فلا تختفي صورة من صفحة دون أن يدري. */
  async function removeItem(it: Item) {
    const r = await fetch(`/api/admin/media?used=${encodeURIComponent(it.path)}`);
    const used = (await r.json()).used ?? [];
    const where = used.length
      ? `\n\nمستعمل في:\n${[...new Set(used.map((u: any) => u.where))].slice(0, 8).join('\n')}`
      : '\n\nغير مستعمل في أي صفحة.';
    if (!confirm(`حذف «${it.path.split('/').pop()}»؟${where}`)) return;
    const d = await fetch(`/api/admin/media?id=${it.id}`, { method: 'DELETE' });
    const j = await d.json().catch(() => ({}));
    if (!j.ok) { setMsg(j.error ?? 'تعذّر الحذف'); return; }
    setMsg('حُذف الملف');
    setChosen((c) => c.filter((p) => p !== it.path));
    load();
  }

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="اختيار ملف من المكتبة"
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
         style={{
           position: 'fixed', inset: 0, background: 'rgba(12,20,33,.55)', zIndex: 60,
           display: 'grid', placeItems: 'center', padding: 20,
         }}>
      <div ref={boxRef}
           onDragEnter={(e) => {
             if (!e.dataTransfer.types.includes('Files')) return;
             depth.current++;
             boxRef.current?.classList.add('is-drop');
           }}
           onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
           onDragLeave={() => {
             depth.current = Math.max(0, depth.current - 1);
             if (!depth.current) boxRef.current?.classList.remove('is-drop');
           }}
           onDrop={(e) => {
             e.preventDefault();
             depth.current = 0;
             boxRef.current?.classList.remove('is-drop');
             upload(e.dataTransfer.files);
           }}
           style={{
             background: '#fff', borderRadius: 12, width: 'min(920px, 100%)', maxHeight: '86vh',
             display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(12,20,33,.3)',
           }}>
        <div className="panel__head" style={{ flex: '0 0 auto' }}>
          <h2>{multi ? 'اختر الصور — اضغط على كل صورة تريدها' : 'اختر ملفًا'}</h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>إغلاق</button>
        </div>

        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {KINDS.map(([k, label]) => (
              <button key={k} type="button"
                      className={`btn btn--sm ${filter === k ? '' : 'btn--ghost'}`}
                      onClick={() => { setFilter(k); load(k, term); }}>{label}</button>
            ))}
          </div>
          <input type="search" placeholder="ابحث بالاسم…" value={term} style={{ flex: '1 1 160px', width: 'auto' }}
                 onChange={(e) => { setTerm(e.target.value); load(filter, e.target.value); }} />
          <button type="button" className="btn btn--sm" disabled={busy}
                  onClick={() => fileRef.current?.click()}>
            {busy ? `جارٍ الرفع… ${pct}%` : '+ ارفع من جهازك'}
          </button>
          <input ref={fileRef} type="file" multiple hidden
                 accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.pdf"
                 onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
        </div>

        {msg ? <p className="msg" style={{ margin: 12 }}>{msg}</p> : null}

        <div style={{ overflow: 'auto', padding: 16, flex: '1 1 auto' }}>
          <div className="drop" style={{ padding: '16px 14px', marginBottom: 14 }}
               onClick={() => !busy && fileRef.current?.click()} role="button" tabIndex={0}
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}>
            <b>اسحب ملفًا إلى هنا</b>
            <span>{multi
              ? 'أو اضغط لاختيار صور من جهازك — ما ترفعه يُحدَّد وحده، ثم «أضف» في الأسفل'
              : 'أو اضغط لاختياره من جهازك — ثم اضغط على أي ملف بالأسفل لاستعماله'}</span>
            {busy ? <div className="upbar"><span style={{ width: `${pct}%` }} /></div> : null}
          </div>
          {items.length === 0 ? (
            <p className="empty">لا ملفات هنا.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(132px,1fr))', gap: 12 }}>
              {items.map((it) => {
                const n = multi ? chosen.indexOf(it.path) + 1 : 0;
                return (
                /* الغلاف لأن زرّ الحذف أخٌ للمصغّرة لا ابنٌ لها: زرٌّ داخل
                   زرٍّ ترفضه المتصفّحات ولا يصل إليه الضغط. */
                <div key={it.id} style={{ position: 'relative' }}>
                <button type="button" title={it.path} aria-pressed={multi ? n > 0 : undefined}
                        onClick={() => { if (multi) toggle(it.path); else { onPick(it.path); onClose(); } }}
                        style={{
                          border: n ? '2px solid var(--brand)' : '1px solid var(--line)', borderRadius: 8,
                          background: n ? '#fff7f1' : '#fff', position: 'relative',
                          padding: n ? 5 : 6, cursor: 'pointer', textAlign: 'start', font: 'inherit',
                          width: '100%', display: 'block',
                        }}>
                  {n ? (
                    <b style={{
                      position: 'absolute', top: 8, insetInlineStart: 8, zIndex: 1, minWidth: 24, height: 24, padding: '0 6px',
                      borderRadius: 99, background: 'var(--brand)', color: '#fff', fontSize: 12.5, display: 'grid', placeItems: 'center',
                      boxShadow: '0 1px 4px rgba(0,0,0,.25)',
                    }}>{n}</b>
                  ) : null}
                  {multi && already.includes(it.path) ? (
                    <small style={{
                      position: 'absolute', top: 8, insetInlineEnd: 8, zIndex: 1, background: 'rgba(15,27,45,.8)', color: '#fff',
                      borderRadius: 5, padding: '1px 6px', fontSize: 11,
                    }}>مضافة</small>
                  ) : null}
                  <div style={{ height: 86, display: 'grid', placeItems: 'center', background: '#f5f8fc', borderRadius: 6, overflow: 'hidden' }}>
                    {it.kind === 'image'
                      ? <img src={'/' + it.path} alt="" loading="lazy"
                             style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      : <span style={{ fontSize: 13, color: 'var(--muted)' }}>{it.kind === 'video' ? '▶ فيديو' : 'PDF'}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.5, wordBreak: 'break-all', color: 'var(--muted)' }}>
                    {it.path.split('/').pop()}
                    <br />{kb(it.bytes)}
                  </div>
                </button>
                {own(it.path) ? (
                  <button type="button" className="pick__del" title="احذف الملف"
                          aria-label={`احذف ${it.path.split('/').pop()}`}
                          onClick={(e) => { e.stopPropagation(); removeItem(it); }}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                    </svg>
                  </button>
                ) : null}
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* اختيار عدّة: عدد المختار، وترتيبه، وزرّ يضيفه كله */}
        {multi ? (
          <div style={{
            flex: '0 0 auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
            padding: '12px 18px', borderTop: '1px solid var(--line)', background: '#fbfcfe',
          }}>
            <b style={{ fontSize: 14 }}>{chosen.length ? `${chosen.length} مختارة` : 'لم تختر صورًا بعد'}</b>
            <button type="button" className="btn btn--ghost btn--sm"
                    onClick={() => setChosen(items.filter((it) => it.kind === 'image').map((it) => it.path))}>اختر الكل</button>
            {chosen.length ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => setChosen([])}>إلغاء الاختيار</button> : null}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginInlineStart: 'auto' }}>
              رتّبها
              <select value={order} onChange={(e) => setOrder(e.target.value)} style={{ width: 'auto', height: 32 }}>
                {ORDERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <button type="button" className="btn" disabled={!chosen.length} onClick={addAll}>
              {chosen.length ? `أضف ${chosen.length} ${chosen.length === 1 ? 'صورة' : 'صور'}` : 'أضف'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
