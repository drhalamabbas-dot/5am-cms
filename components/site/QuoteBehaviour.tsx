'use client';
/* =============================================================================
   تفاعل نموذج عرض السعر — منقول عن assets/js/quote.js بالسلوك نفسه.

   يتحقّق من الحقول، ثم يجمّع نصّ الطلب ويعرضه للزائر ليفتحه في تطبيق بريده أو
   ينسخه أو يحفظه — ومعه يُرسَل الطلب إلى الموقع (/api/requests) فيصل لفريق
   المبيعات في لوحة التحكم بتنبيه. فشل الإرسال لا يوقف شيئًا: طريق البريد باقٍ.
   النموذج نفسه مرسوم من السيرفر، وهذا الملف يربط سلوكه فقط.
============================================================================= */
import { useEffect } from 'react';

type Text = {
  errCheck: string; mailSubject: string; requestHeading: string;
  sourceLabel: string; copied: string; copyFailed: string; received: string;
};

export function QuoteBehaviour({
  lang, email, source, prefill, text,
}: { lang: string; email: string; source: string; prefill: string; text: Text }) {
  useEffect(() => {
    const D = document;
    const form = D.getElementById('quoteForm') as HTMLFormElement | null;
    if (!form) return;
    const q = <E extends Element>(s: string) => form.querySelector<E>(s) ?? D.querySelector<E>(s);
    const all = <E extends Element>(s: string) => Array.from(form.querySelectorAll<E>(s));

    const solution = q<HTMLSelectElement>('#solution')!;
    const product = q<HTMLSelectElement>('#product')!;
    const msg = q<HTMLDivElement>('#formMsg')!;
    const review = q<HTMLElement>('#requestReview')!;
    const status = q<HTMLParagraphElement>('#copyStatus')!;
    let prepared = '';

    /* المنتجات المعروضة تتبع الخدمة المختارة — التصنيف نفسه الذي في quote.js */
    const allOptions = Array.from(product.options).map((o) => ({
      value: o.value, text: o.text, cat: o.dataset.cat || '',
    }));
    function fillProducts(keep?: string) {
      const v = solution.value;
      const cat = v === 'environmental' ? 'environmental'
        : v === 'parts' ? 'parts'
        : ['power', 'rental', 'repowering', 'engineering'].includes(v) ? 'power'
        : null;
      const want = keep ?? product.value;
      product.innerHTML = '';
      for (const o of allOptions) {
        if (o.value && cat && o.cat !== cat) continue;
        const el = D.createElement('option');
        el.value = o.value; el.textContent = o.text; el.dataset.cat = o.cat;
        product.append(el);
      }
      if (want && Array.from(product.options).some((o) => o.value === want)) product.value = want;
      const rental = q<HTMLElement>('#rentalDetails');
      if (rental) rental.hidden = v !== 'rental';
      const powerField = q<HTMLInputElement>('#power')?.closest('.field') as HTMLElement | null;
      if (powerField) powerField.hidden = ['parts', 'service', 'environmental'].includes(v);
    }

    const labelOf = (id: string) =>
      D.querySelector(`label[for="${id}"]`)?.textContent?.replace('*', '').trim() || id;

    function validate() {
      let first: HTMLElement | null = null;
      for (const input of all<HTMLInputElement | HTMLSelectElement>('input,select')) {
        if (input.closest('[hidden]') || input.id === 'website') continue;
        let bad = input.required && !input.value.trim();
        const type = (input as HTMLInputElement).type;
        if (input.value && type === 'email') bad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
        if (input.value && type === 'tel') bad = input.value.replace(/[^\d٠-٩۰-۹]/g, '').length < 7;
        input.closest('.field')?.classList.toggle('is-bad', bad);
        input.setAttribute('aria-invalid', String(bad));
        if (q(`#${input.id}-error`)) input.setAttribute('aria-describedby', `${input.id}-error`);
        if (bad && !first) first = input;
      }
      if (first) {
        msg.className = 'formmsg is-err';
        msg.textContent = text.errCheck;
        (first.id === 'solution' ? q<HTMLElement>('.svc__opt') : first)?.focus();
        return false;
      }
      msg.className = 'formmsg';
      return true;
    }

    function asText() {
      const rows = [text.requestHeading];
      for (const id of ['name', 'phone', 'email', 'solution', 'company', 'product', 'power', 'location', 'duration', 'start', 'message']) {
        const el = q<HTMLInputElement | HTMLSelectElement>(`#${id}`);
        if (!el || el.closest('[hidden]') || !el.value.trim()) continue;
        const v = el.tagName === 'SELECT'
          ? (el as HTMLSelectElement).selectedOptions[0].textContent ?? ''
          : el.value.trim();
        rows.push(`${labelOf(id)}: ${v}`);
      }
      if (source) rows.push(`${text.sourceLabel}: ${source.replace(/[^a-z-]/gi, '')}`);
      return rows.join('\n');
    }

    /* ---- الربط ---- */
    const pills = all<HTMLButtonElement>('.svc__opt');
    const syncPills = () => pills.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === solution.value)));
    const onPill = (b: HTMLButtonElement) => () => {
      solution.value = b.dataset.v ?? '';
      solution.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const pillHandlers = pills.map((b) => { const h = onPill(b); b.addEventListener('click', h); return h; });

    const onChangeSolution = () => {
      syncPills();
      fillProducts();
      if (solution.value) solution.closest('.field')?.classList.remove('is-bad');
    };
    const hideReview = () => { review.hidden = true; status.textContent = ''; };
    const onSubmit = (e: Event) => {
      e.preventDefault();
      if (q<HTMLInputElement>('#website')?.value || !validate()) return;
      prepared = asText();
      q<HTMLPreElement>('#requestText')!.textContent = prepared;
      q<HTMLAnchorElement>('#openEmail')!.href =
        `mailto:${email}?subject=${encodeURIComponent(text.mailSubject)}&body=${encodeURIComponent(prepared)}`;
      review.hidden = false;
      review.focus();
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      review.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      send();
    };
    /* الطلب نفسه مرة واحدة لكل نصّ: ضغطتان على «أرسل» بلا تغيير لا تصنعان طلبين */
    let sentText = '';
    const val = (id: string) => q<HTMLInputElement>(`#${id}`)?.value.trim() || undefined;
    const send = () => {
      if (prepared === sentText) return;
      sentText = prepared;
      fetch('/api/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'quote', source: product.value ? 'product' : 'quote', lang, page: location.pathname + location.search,
          name: val('name'), phone: val('phone'), email: val('email'), company: val('company'),
          city: val('location'),
          message: prepared, items: product.value ? [{ ref: product.value, qty: 1 }] : [],
          website: val('website'),
        }),
      }).then((r) => r.json()).then((r) => {
        if (r?.ok && text.received) { msg.className = 'formmsg is-ok'; msg.textContent = text.received; }
      }).catch(() => { sentText = ''; });
    };
    const onCopy = async () => {
      try {
        await navigator.clipboard.writeText(prepared);
        status.textContent = text.copied;
      } catch { status.textContent = text.copyFailed; }
    };
    const onDownload = () => {
      const url = URL.createObjectURL(new Blob(['﻿' + prepared], { type: 'text/plain;charset=utf-8' }));
      const a = D.createElement('a');
      a.href = url; a.download = '5AM-request.txt'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    solution.addEventListener('change', onChangeSolution);
    form.addEventListener('input', hideReview);
    form.addEventListener('change', hideReview);
    form.addEventListener('submit', onSubmit);
    q<HTMLButtonElement>('#copyRequest')!.addEventListener('click', onCopy);
    q<HTMLButtonElement>('#downloadRequest')!.addEventListener('click', onDownload);

    syncPills();
    fillProducts(product.value);
    /* منتج مُحدَّد من الصفحة التي جاء منها الزائر: تُملأ الرسالة مسبقًا */
    const message = q<HTMLTextAreaElement>('#message')!;
    if (prefill && !message.value) message.value = prefill;

    return () => {
      pills.forEach((b, i) => b.removeEventListener('click', pillHandlers[i]));
      solution.removeEventListener('change', onChangeSolution);
      form.removeEventListener('input', hideReview);
      form.removeEventListener('change', hideReview);
      form.removeEventListener('submit', onSubmit);
    };
  }, [lang, email, source, prefill, text]);

  return null;
}
