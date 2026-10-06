'use client';
/* =============================================================================
   تفاعل صفحة المتجر (components/site/Store.tsx).

   1) البحث والفلاتر والترتيب تعمل على القائمة المرسومة من السيرفر: تُخفى
      الكروت وتُرتَّب بلا إعادة تحميل، وتُحفظ في العنوان (?cat=&q=) فيُشارَك
      الرابط بفلتره.
   2) سلة «طلب عرض السعر»: تُحفظ في المتصفح (localStorage) فتبقى لو خرج الزائر
      ورجع، وتُرسَل مع بياناته إلى /api/requests فتصل للمبيعات بتنبيه.
   3) ما يبحث عنه الزائر يُعدّ (بلا بيانات شخصية) — لمعرفة ما يطلبه العملاء.
============================================================================= */
import { useCallback, useEffect, useRef, useState } from 'react';

type Line = { ref: string; name: string; img: string; pn: string; qty: number };
const KEY = '5am-quote-cart';

const read = (): Line[] => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter((l) => l?.ref) : []; } catch { return []; }
};
const write = (v: Line[]) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* وضع خاص */ } };
/* الأرقام العربية والفارسية إلى لاتينية — للتحقّق من الموبايل */
const digits = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

export function StoreBehaviour({ lang, text }: { lang: string; text: Record<string, string> }) {
  const L = (k: string) => text[k] ?? k;
  const [cart, setCart] = useState<Line[]>([]);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'err' | 'fail'>('idle');
  const dlg = useRef<HTMLDialogElement>(null);
  const loaded = useRef(false);

  /* ------------------------------------------------------- السلة */
  useEffect(() => { setCart(read()); loaded.current = true; }, []);
  useEffect(() => {
    if (!loaded.current) return;
    write(cart);
    const inCart = new Set(cart.map((l) => l.ref));
    document.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((b) => {
      const on = inCart.has(b.dataset.add!);
      b.classList.toggle('is-in', on);
      b.setAttribute('aria-pressed', String(on));
      b.textContent = on ? `✓ ${L('store.added')}` : L('store.add');
    });
  }, [cart]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = useCallback((b: HTMLButtonElement) => {
    const ref = b.dataset.add!;
    setCart((c) => c.some((l) => l.ref === ref)
      ? c.filter((l) => l.ref !== ref)
      : [...c, { ref, name: b.dataset.name ?? ref, img: b.dataset.img ?? '', pn: b.dataset.pn ?? '', qty: 1 }]);
    setState((s) => (s === 'ok' ? 'idle' : s));
  }, []);

  useEffect(() => {
    const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-add]'));
    const on = (e: Event) => add(e.currentTarget as HTMLButtonElement);
    btns.forEach((b) => { b.hidden = false; b.addEventListener('click', on); });
    return () => btns.forEach((b) => b.removeEventListener('click', on));
  }, [add]);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const qty = (ref: string, v: number) => setCart((c) => c.map((l) => (l.ref === ref ? { ...l, qty: Math.min(9999, Math.max(1, v || 1)) } : l)));
  const drop = (ref: string) => setCart((c) => c.filter((l) => l.ref !== ref));
  const count = cart.reduce((n, l) => n + l.qty, 0);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? '').trim();
    if (f.get('website')) return;
    if (!v('name') || digits(v('phone')).replace(/\D/g, '').length < 7) { setState('err'); return; }
    setState('sending');
    try {
      const r = await fetch('/api/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'store', source: 'store', lang, page: location.pathname + location.search,
          name: v('name'), phone: v('phone'), email: v('email') || undefined, company: v('company') || undefined,
          city: v('city') || undefined, message: v('message') || undefined,
          items: cart.map((l) => ({ ref: l.ref, qty: l.qty })),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setState(d?.error === 'phone' || d?.error === 'contact' ? 'err' : 'fail'); return; }
      setCart([]);
      setState('ok');
      (e.target as HTMLFormElement).reset();
    } catch { setState('fail'); }
  }

  /* ------------------------------------------- البحث والفلاتر والترتيب */
  useEffect(() => {
    const D = document;
    const grid = D.getElementById('storeGrid');
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLLIElement>('.scard'));
    const qIn = D.getElementById('storeQ') as HTMLInputElement | null;
    const brand = D.getElementById('storeBrand') as HTMLSelectElement | null;
    const sub = D.getElementById('storeSub') as HTMLSelectElement | null;
    const sort = D.getElementById('storeSort') as HTMLSelectElement | null;
    const chips = Array.from(D.querySelectorAll<HTMLButtonElement>('.store__chip'));
    const countEl = D.getElementById('storeCount');
    const empty = D.getElementById('storeEmpty');
    let cat = '';
    let statTimer: ReturnType<typeof setTimeout> | undefined;
    let lastStat = '';

    /* من العنوان: ?cat=parts&q=filter */
    const sp = new URLSearchParams(location.search);
    if (sp.get('cat') && chips.some((c) => c.dataset.cat === sp.get('cat'))) cat = sp.get('cat')!;
    if (qIn && sp.get('q')) qIn.value = sp.get('q')!;
    if (brand && sp.get('brand')) brand.value = sp.get('brand')!;

    const norm = (s: string) => digits(s).toLowerCase().replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();

    function apply(push = true) {
      const words = norm(qIn?.value ?? '').split(/\s+/).filter(Boolean);
      let n = 0;
      for (const c of cards) {
        const hay = norm(c.dataset.find ?? '');
        const ok = (!cat || c.dataset.cat === cat)
          && (!brand?.value || c.dataset.brand === brand.value)
          && (!sub?.value || c.dataset.sub === sub.value)
          && words.every((w) => hay.includes(w));
        c.hidden = !ok;
        if (ok) n++;
      }
      const by = sort?.value;
      const key = (c: HTMLElement) => (by === 'name' ? c.dataset.name ?? '' : by === 'brand' ? `${c.dataset.bname} ${c.dataset.name}` : '');
      const sorted = [...cards].sort((a, b) => (by ? key(a).localeCompare(key(b), lang) : 0) || Number(a.dataset.pos) - Number(b.dataset.pos));
      sorted.forEach((c) => grid!.append(c));
      chips.forEach((c) => c.setAttribute('aria-pressed', String((c.dataset.cat ?? '') === cat)));
      if (countEl) countEl.textContent = L('store.count').replace('{n}', String(n));
      if (empty) empty.hidden = n > 0;
      if (push) {
        const u = new URL(location.href);
        for (const [k, v] of [['cat', cat], ['q', qIn?.value.trim() ?? ''], ['brand', brand?.value ?? '']] as const) {
          if (v) u.searchParams.set(k, v); else u.searchParams.delete(k);
        }
        history.replaceState(history.state, '', u);
      }
      /* إحصاء البحث بعد أن يتوقف الكتابة: الكلمة وعدد النتائج فقط */
      clearTimeout(statTimer);
      const term = (qIn?.value ?? '').trim().toLowerCase();
      if (term.length >= 2 && term !== lastStat) {
        statTimer = setTimeout(() => {
          lastStat = term;
          const body = JSON.stringify({ term, results: n });
          if (!navigator.sendBeacon?.('/api/stats', new Blob([body], { type: 'application/json' }))) {
            fetch('/api/stats', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
          }
        }, 1500);
      }
    }

    const onChip = (e: Event) => { cat = (e.currentTarget as HTMLElement).dataset.cat ?? ''; apply(); };
    const onInput = () => apply();
    const reset = () => {
      cat = ''; if (qIn) qIn.value = ''; if (brand) brand.value = ''; if (sub) sub.value = ''; if (sort) sort.value = '';
      apply();
    };
    chips.forEach((c) => c.addEventListener('click', onChip));
    qIn?.addEventListener('input', onInput);
    [brand, sub, sort].forEach((s) => s?.addEventListener('change', onInput));
    D.getElementById('storeReset')?.addEventListener('click', reset);
    apply(false);
    return () => {
      clearTimeout(statTimer);
      chips.forEach((c) => c.removeEventListener('click', onChip));
      qIn?.removeEventListener('input', onInput);
      [brand, sub, sort].forEach((s) => s?.removeEventListener('change', onInput));
      D.getElementById('storeReset')?.removeEventListener('click', reset);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button type="button" className={`scart__fab${count ? ' has-items' : ''}`} onClick={() => setOpen(true)}
              aria-haspopup="dialog" aria-label={`${L('store.cart')} (${count})`}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5.2 4l.4 2H20a1 1 0 0 1 1 1.2l-1.5 7A1 1 0 0 1 18.5 15H8a1 1 0 0 1-1-.8L4.4 3H2V1h3.2a1 1 0 0 1 1 .8L6.4 4H5.2Z"/></svg>
        <span>{L('store.cart')}</span>
        {count ? <b>{count}</b> : null}
      </button>

      <dialog ref={dlg} className="scart" aria-labelledby="scartTitle" onClose={() => setOpen(false)}
              onClick={(e) => { if (e.target === dlg.current) setOpen(false); }}>
        <div className="scart__in">
          <header className="scart__head">
            <h2 id="scartTitle">{L('store.cart')}{count ? ` (${count})` : ''}</h2>
            <button type="button" className="scart__x" onClick={() => setOpen(false)} aria-label={L('store.close')}>×</button>
          </header>

          {state === 'ok' ? <p className="formmsg is-ok" role="status">{L('store.form.ok')}</p> : null}

          {cart.length ? (
            <>
              <ul className="scart__list">
                {cart.map((l) => (
                  <li key={l.ref}>
                    {l.img ? <img src={`/${l.img.replace(/^\//, '')}`} alt="" /> : <span className="scart__ph" />}
                    <span className="scart__name"><b>{l.name}</b>{l.pn ? <small dir="ltr">{l.pn}</small> : null}</span>
                    <label className="scart__qty">
                      <span className="sr">{L('store.qty')}</span>
                      <button type="button" onClick={() => qty(l.ref, l.qty - 1)} aria-label="−">−</button>
                      <input type="number" min={1} max={9999} value={l.qty} inputMode="numeric"
                             onChange={(e) => qty(l.ref, Number(digits(e.target.value)))} />
                      <button type="button" onClick={() => qty(l.ref, l.qty + 1)} aria-label="+">+</button>
                    </label>
                    <button type="button" className="scart__rm" onClick={() => drop(l.ref)}>{L('store.remove')}</button>
                  </li>
                ))}
              </ul>

              <form className="scart__form" onSubmit={send} noValidate>
                <h3>{L('store.form.title')}</h3>
                {state === 'err' ? <p className="formmsg is-err" role="alert">{L('store.form.err')}</p> : null}
                {state === 'fail' ? <p className="formmsg is-err" role="alert">{L('store.form.fail')}</p> : null}
                <div className="scart__grid">
                  <label>{L('store.form.name')} *<input name="name" required autoComplete="name" maxLength={120} /></label>
                  <label>{L('store.form.phone')} *<input name="phone" type="tel" required autoComplete="tel" dir="ltr" maxLength={40} /></label>
                  <label>{L('store.form.email')}<input name="email" type="email" autoComplete="email" dir="ltr" maxLength={160} /></label>
                  <label>{L('store.form.company')}<input name="company" autoComplete="organization" maxLength={160} /></label>
                  <label>{L('store.form.city')}<input name="city" autoComplete="address-level2" maxLength={100} /></label>
                  <label className="scart__full">{L('store.form.message')}<textarea name="message" rows={3} maxLength={4000} /></label>
                </div>
                <div className="hp" aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>
                <button className="btn" type="submit" disabled={state === 'sending'}>
                  {state === 'sending' ? L('store.form.sending') : L('store.form.send')}
                </button>
                <p className="scart__consent">{L('store.form.consent')}</p>
              </form>
            </>
          ) : state !== 'ok' ? <p className="scart__empty">{L('store.cart.empty')}</p> : null}
        </div>
      </dialog>
    </>
  );
}
