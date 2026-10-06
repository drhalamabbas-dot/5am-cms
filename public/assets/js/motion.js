/* ==========================================================================
   5A&M — motion.js
   Transitions for the whole site. Loaded last on every page.
   · Scroll reveal: headings fade up, cards in a row come in one after another.
   · Page transitions: cross-document View Transitions where the browser has
     them, a short fade-out on internal links everywhere else.
   · Header over the hero: transparent at the top of pages that open with a
     dark hero, solid as soon as the visitor scrolls.
   Everything is skipped when the visitor asks for reduced motion.
   ========================================================================== */
(function () {
  'use strict';
  const D = document, H = D.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------- header over the hero */
  function overlayHeader() {
    const main = D.getElementById('main');
    if (!main) return;
    const skip = function (el) {
      return el.tagName === 'NOSCRIPT' || el.hidden ||
        el.tagName === 'STYLE' || el.classList.contains('ux-mark') ||
        el.classList.contains('ux-edittools');
    };
    let first = main.firstElementChild;
    while (first && skip(first)) first = first.nextElementSibling;
    if (first && first.id === 'pageRoot') {
      first = first.firstElementChild;
      while (first && skip(first)) first = first.nextElementSibling;
    }
    if (first && (first.classList.contains('vhero') || first.classList.contains('phero'))) {
      first.classList.add('under-hdr');
      D.body.classList.add('has-overlay-hdr');
    }
  }

  /* ------------------------------------------------------ scroll reveal */
  const SKIP = '.vhero, .phero, .ux-jump, .logostrip, #site-footer, footer';
  function isScroller(el) {
    const cs = getComputedStyle(el);
    return /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 4;
  }
  function isGrid(el) {
    const d = getComputedStyle(el).display;
    return (d === 'grid' || d === 'flex') && el.children.length >= 2 &&
      [...el.children].every((c) => c.getBoundingClientRect().height > 60);
  }

  let io = null;
  function mark(el, delay) {
    if (el.hasAttribute('data-mo')) return;
    const r = el.getBoundingClientRect();
    if (r.height === 0) return;
    if (r.top < window.innerHeight * 0.92) return; // already on screen: leave it alone
    el.setAttribute('data-mo', '');
    if (delay) el.style.setProperty('--mo-d', delay + 'ms');
    io.observe(el);
  }
  function collect(root) {
    root.querySelectorAll('main section, main > div > section').forEach((sec) => {
      if (sec.matches(SKIP) || sec.closest(SKIP)) return;
      const wraps = sec.querySelectorAll(':scope > .wrap, :scope > div > .wrap');
      (wraps.length ? wraps : [sec]).forEach((wrap) => {
        [...wrap.children].forEach((child) => {
          if (child.matches(SKIP)) return;
          if (isGrid(child) && !isScroller(child)) {
            [...child.children].forEach((c, i) => mark(c, (i % 4) * 90));
          } else {
            mark(child, 0);
          }
        });
      });
    });
  }
  function reveal() {
    if (!('IntersectionObserver' in window)) return;
    io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('mo-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    collect(D);
    /* Cards rendered later (tabs, language switch) join in. */
    let t = null;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => collect(D), 120); })
      .observe(D.getElementById('main') || D.body, { childList: true, subtree: true });
  }

  /* --------------------------------------------------- page transitions */
  const crossDocVT = 'onpagereveal' in window; // Chrome/Edge 126+: CSS @view-transition handles it
  function pageTransitions() {
    if (crossDocVT) return;
    D.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin && location.protocol !== 'file:') return;
      if (url.protocol !== location.protocol) return;
      if (!/\.html?$/.test(url.pathname) && !url.pathname.endsWith('/')) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page / hash
      e.preventDefault();
      H.classList.add('is-leaving');
      setTimeout(() => { location.href = a.href; }, 200);
    });
    window.addEventListener('pageshow', () => H.classList.remove('is-leaving'));
  }

  function init() {
    overlayHeader();
    if (reduced) return;
    H.classList.add('motion');
    reveal();
    pageTransitions();
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init);
  else init();
})();
