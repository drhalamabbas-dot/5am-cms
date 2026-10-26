/* =============================================================================
   5A&M — تفاعل الموقع.

   منقول عن assets/js/site.js و ux.js و home.js و model.js في الموقع القديم،
   بالنصف الذي يخصّ التفاعل وحده. أما نصفها الآخر — بناء الهيدر والفوتر
   والسكاشن والكروت — فصار يُرسم من السيرفر، فحُذف من هنا.

   لا بيانات في هذا الملف: ما يحتاجه من نصوص وروابط ونتائج بحث يأتيه من
   السيرفر في <script id="ux-data"> كي يبقى قابلًا للتعديل من الداش بورد.

   بلا مكتبات، ويحترم prefers-reduced-motion كما كان.
============================================================================= */
(function () {
  'use strict';
  const D = document, H = D.documentElement;
  const qs = (s, r) => (r || D).querySelector(s);
  const qsa = (s, r) => Array.prototype.slice.call((r || D).querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rtl = () => H.dir === 'rtl';

  const DATA = (function () {
    const el = qs('#ux-data');
    try { return el ? JSON.parse(el.textContent) : {}; } catch (e) { return {}; }
  })();
  const UI = DATA.ui || {};
  const ICO = DATA.ico || {};
  const page = DATA.page || '';

  /* ==================================================== 1) الظهور بالتمرير
     [data-stagger] يمنح كل ابن رقمه فيأتي الصف واحدًا بعد واحد بتأخير من CSS. */
  function reveal(root) {
    const scope = root || D;
    qsa('[data-stagger]', scope).forEach(function (box) {
      Array.prototype.forEach.call(box.children, function (child, i) {
        child.style.setProperty('--i', Math.min(i, 11));
      });
    });
    const els = qsa('[data-reveal], [data-stagger]', scope);
    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('is-in'); });
      return;
    }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ============================================================ 2) العدّادات
     القيمة النهائية تُكتب أولًا كي لا يظهر الرقم فارغًا، ثم تُحرَّك عند الظهور. */
  function counters() {
    const els = qsa('[data-count]');
    if (!els.length) return;
    els.forEach(function (el) { el.textContent = el.dataset.count + (el.dataset.suffix || ''); });
    if (reduced || !('IntersectionObserver' in window)) return;
    const run = function (el) {
      const to = parseFloat(el.dataset.count), suffix = el.dataset.suffix || '';
      el.dataset.done = '1';
      const t0 = performance.now(), dur = 1100;
      const step = function (t) {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(to * e) + suffix;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        if (x.isIntersecting && !x.target.dataset.done) { run(x.target); io.unobserve(x.target); }
      });
    }, { threshold: 0.5 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ============================================== 3) إزاحة خفيفة لصور الهيرو */
  function parallax() {
    if (reduced) return;
    const imgs = qsa('[data-parallax]');
    if (!imgs.length) return;
    let ticking = false;
    const apply = function () {
      const y = window.scrollY;
      imgs.forEach(function (im) {
        im.style.transform = 'translate3d(0,' + Math.min(y * 0.16, 90) + 'px,0) scale(1.06)';
      });
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }, { passive: true });
    apply();
  }

  /* ========================================= 4) صفوف الكروت القابلة للتمرير
     منطقة overflow لا تُمرَّر بالكيبورد إلا إن أمكنها استقبال التركيز. */
  function wireRails() {
    qsa('.railwrap').forEach(function (w) {
      const rail = qs('.rail', w);
      if (!rail || w.dataset.railed) return;
      w.dataset.railed = '1';
      const prev = qs('.railnav--prev', w), next = qs('.railnav--next', w);
      if (!rail.hasAttribute('tabindex')) {
        rail.tabIndex = 0;
        rail.setAttribute('role', 'group');
        if (!rail.getAttribute('aria-label') && UI.scrollList) rail.setAttribute('aria-label', UI.scrollList);
      }
      const sync = function () {
        const max = rail.scrollWidth - rail.clientWidth;
        const canPrev = rail.scrollLeft > 4;
        const canNext = max > 4 && rail.scrollLeft < max - 4;
        w.classList.toggle('can-prev', canPrev);
        w.classList.toggle('can-next', canNext);
        if (prev) prev.disabled = !canPrev;
        if (next) next.disabled = !canNext;
      };
      qsa('.railnav', w).forEach(function (btn) {
        btn.addEventListener('click', function () {
          rail.scrollBy({
            left: (btn.classList.contains('railnav--prev') ? -1 : 1) * Math.round(rail.clientWidth * 0.8),
            behavior: reduced ? 'auto' : 'smooth',
          });
        });
      });
      rail.addEventListener('scroll', sync, { passive: true });
      window.addEventListener('resize', sync);
      if ('ResizeObserver' in window) new ResizeObserver(sync).observe(rail);
      if ('MutationObserver' in window) new MutationObserver(sync).observe(rail, { childList: true });
      sync();
    });
  }

  /* ================================================ 5) شريط المقارنة قبل/بعد
     v هو بعد المقبض عن حافة البداية. في الإنجليزية هي اليسار فتمتلئ «بعد» نحو
     اليمين، وفي العربية ينعكس الترتيب — وإلا انقلبت التسميتان دون الصورتين. */
  function wireCompare() {
    qsa('.ba').forEach(function (el) {
      const after = qs('.ba__after', el), handle = qs('.ba__handle', el), range = qs('.ba__range', el);
      if (!after || !handle || !range || el.dataset.baWired) return;
      el.dataset.baWired = '1';
      const MIN = +range.min || 2, MAX = +range.max || 98;
      const isRtl = rtl();
      const set = function (v) {
        v = Math.max(MIN, Math.min(MAX, v));
        range.value = v;
        after.style.clipPath = isRtl ? 'inset(0 ' + v + '% 0 0)' : 'inset(0 0 0 ' + v + '%)';
        handle.style.left = (isRtl ? 100 - v : v) + '%';
      };
      const touched = function () { el.classList.add('is-touched'); };
      const fromX = function (clientX) {
        const r = el.getBoundingClientRect();
        return isRtl ? ((r.right - clientX) / r.width) * 100 : ((clientX - r.left) / r.width) * 100;
      };
      set(+range.value);
      range.addEventListener('input', function () { touched(); set(+range.value); });
      let dragging = false;
      el.addEventListener('pointerdown', function (e) {
        dragging = true; touched();
        el.classList.add('is-dragging');
        el.setPointerCapture(e.pointerId);
        set(fromX(e.clientX));
      });
      el.addEventListener('pointermove', function (e) {
        if (dragging) { e.preventDefault(); set(fromX(e.clientX)); }
      });
      const end = function (e) {
        if (!dragging) return;
        dragging = false;
        el.classList.remove('is-dragging');
        if (e.pointerId != null && el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) {
          el.releasePointerCapture(e.pointerId);
        }
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      /* المرور بالماوس يكشف الفرق فورًا على الحاسب */
      if (!reduced && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
        el.addEventListener('pointermove', function (e) { if (!dragging) set(fromX(e.clientX)); });
        el.addEventListener('pointerleave', function () { if (!dragging) set(50); });
      }
      range.addEventListener('focus', touched);
    });
  }

  /* ============================== 6) المنيو يتابع السكشن الظاهر في الرئيسية */
  function spy() {
    if (!D.body.hasAttribute('data-onepage') || !('IntersectionObserver' in window)) return;
    const links = {};
    qsa('.hdr__nav a[href^="#"]').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    const ids = Object.keys(links);
    if (!ids.length) return;
    const seen = {};
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { seen[en.target.id] = en.intersectionRatio; });
      let best = null, top = 0;
      ids.forEach(function (id) { if ((seen[id] || 0) > top) { top = seen[id]; best = id; } });
      ids.forEach(function (id) { links[id].classList.toggle('is-active', id === best); });
    }, { threshold: [0, 0.18, 0.4, 0.7] });
    ids.forEach(function (id) { const el = D.getElementById(id); if (el) io.observe(el); });
  }

  /* ======================================================== 7) الهيدر والمنيو */
  function wireHeader() {
    const hdr = qs('#hdr');
    let openIdx = null, openSubIdx = null;
    const panels = qsa('[data-mega-panel]');
    const subPanels = qsa('[data-sub-panel]');
    const subBtns = qsa('[data-sub]');

    const closeSub = function () {
      subPanels.forEach(function (p) { p.classList.remove('is-open'); });
      subBtns.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      openSubIdx = null;
    };
    const close = function () {
      panels.forEach(function (p) { p.classList.remove('is-open'); });
      qsa('[data-mega]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      openIdx = null;
      closeSub();
    };

    qsa('[data-mega]').forEach(function (btn) {
      const i = btn.dataset.mega;
      const open = function () {
        if (openIdx === i) return;
        close();
        const p = qs('[data-mega-panel="' + i + '"]');
        if (p) { p.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); openIdx = i; }
      };
      btn.addEventListener('click', function (e) { e.preventDefault(); openIdx === i ? close() : open(); });
    });

    subBtns.forEach(function (btn) {
      const idx = btn.dataset.sub;
      const p = qs('[data-sub-panel="' + idx + '"]');
      if (!p) return;
      const openSub = function () {
        if (openSubIdx === idx) return;
        close();
        p.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        openSubIdx = idx;
      };
      btn.addEventListener('click', function (e) { e.preventDefault(); openSubIdx === idx ? closeSub() : openSub(); });
      p.addEventListener('click', function (e) { if (e.target.closest('a')) closeSub(); });
    });

    if (hdr) {
      hdr.addEventListener('mouseleave', function () { close(); closeSub(); });
      hdr.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        const b = qs('[aria-expanded="true"]', hdr);
        close();
        if (b) b.focus();
      });
      hdr.addEventListener('focusout', function () {
        setTimeout(function () { if (!hdr.contains(D.activeElement)) close(); }, 0);
      });
    }
    D.addEventListener('click', function (e) { if (hdr && !hdr.contains(e.target)) { close(); closeSub(); } });

    const burger = qs('#burger'), mnav = qs('#mnav');
    if (burger && mnav) {
      qsa(':scope > *', mnav).forEach(function (el, i) { el.style.setProperty('--i', i); });
      const setNav = function (on) {
        mnav.classList.toggle('is-open', on);
        mnav.inert = !on;
        D.body.classList.toggle('ux-menu-open', on);
        ['main', '.ftr', '.ux-contact-dock'].forEach(function (s) {
          const el = qs(s); if (el) el.inert = on;
        });
        burger.classList.toggle('is-open', on);
        burger.setAttribute('aria-expanded', String(on));
        burger.setAttribute('aria-label', on ? (UI.closeMenu || 'Close menu') : (UI.openMenu || 'Open menu'));
        if (on && hdr) {
          hdr.classList.remove('hdr--hidden');
          requestAnimationFrame(function () { const f = qs('summary, a', mnav); if (f) f.focus(); });
        }
        D.body.style.overflow = on ? 'hidden' : '';
      };
      /* حلقة التركيز: منيو لا يُغلق إلا بزرّه الصغير فخٌّ على الهاتف */
      D.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab' || !mnav.classList.contains('is-open')) return;
        const items = [burger].concat(qsa('summary, a, button', mnav).filter(function (el) {
          return el.getClientRects().length;
        }));
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && D.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && D.activeElement === last) { e.preventDefault(); first.focus(); }
      });
      qsa('details', mnav).forEach(function (group) {
        group.addEventListener('toggle', function () {
          if (group.open) {
            qsa('details', mnav).filter(function (el) { return el !== group; })
              .forEach(function (el) { el.open = false; });
          }
        });
      });
      burger.addEventListener('click', function () { setNav(!mnav.classList.contains('is-open')); });
      mnav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });
      D.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && mnav.classList.contains('is-open')) { setNav(false); burger.focus(); }
      });
      window.addEventListener('resize', function () {
        if (window.innerWidth > 1080 && mnav.classList.contains('is-open')) setNav(false);
      });
    }

    const sb = qs('#searchBtn');
    if (sb) sb.addEventListener('click', function () { D.dispatchEvent(new CustomEvent('ux-search')); });

    /* تبديل اللغة: العنوان نفسه مع ?lang الأخرى، فيحفظ المكان والصفحة */
    const lb = qs('#langBtn');
    if (lb) {
      lb.addEventListener('click', function () {
        const url = new URL(location.href);
        url.searchParams.set('lang', DATA.lang === 'ar' ? 'en' : 'ar');
        location.href = url.toString();
      });
    }

    /* نسخة الهاتف من زرّي البحث واللغة داخل المنيو: الأصلان مخفيّان هناك،
       وهذه تنقر عليهما فيعمل مستمعهما وحده. والمنيو يُغلق أولًا كي لا تُفتح
       نافذة البحث خلف قائمةٍ تغطّيها. */
    D.querySelectorAll('.mnav__tool[data-proxy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const target = qs('#' + btn.getAttribute('data-proxy'));
        if (!target) return;
        if (burger && mnav && mnav.classList.contains('is-open')) burger.click();
        target.click();
      });
    });

    stickyHeader(hdr, mnav);
  }

  /* الهيدر لاصق، فهو يحجز مكانه في الصفحة: لمّا يقصر بـ hdr--compact يقصر معه
     ارتفاع المستند فيقفز ما تحته. وبعتبة واحدة يقلب الصنف ذهابًا وإيابًا حولها
     فيتكرر القفز — وهذا هو الاهتزاز. لذا لكل حالة عتبتان متباعدتان:
     تُفتح عند حد وتُغلق عند حد أقل منه بكثير. */
  function stickyHeader(hdr, mnav) {
    if (!hdr) return;
    let last = window.scrollY, ticking = false;
    let stuck = false, compact = false;
    const apply = function () {
      const y = Math.max(0, window.scrollY);
      if (stuck ? y < 2 : y > 10) hdr.classList.toggle('is-stuck', (stuck = !stuck));
      if (compact ? y < 80 : y > 150) hdr.classList.toggle('hdr--compact', (compact = !compact));
      const menuOpen = mnav && mnav.classList.contains('is-open');
      /* الهيدر يبقى ظاهرًا أثناء تصفّح الصفحات الطويلة */
      if (y < last - 4 || y <= 260 || menuOpen) hdr.classList.remove('hdr--hidden');
      last = y;
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }, { passive: true });
    apply();
  }

  /* ============================== 8) شريط محتويات الصفحة يتابع موضع القراءة */
  function jumpSpy() {
    const nav = qs('.ux-jump');
    const root = qs('#pageRoot');
    if (!nav || !root || !('IntersectionObserver' in window)) return;
    const links = qsa('a', nav);
    const sections = qsa(':scope > .sec', root).filter(function (s) { return qs('h2', s); });
    if (!sections.length) return;
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          const active = a.hash === '#' + entry.target.id;
          a.classList.toggle('is-active', active);
          if (!active) { a.removeAttribute('aria-current'); return; }
          a.setAttribute('aria-current', 'location');
          const w = a.parentElement;
          if (w && w.scrollWidth > w.clientWidth) {
            const r = a.getBoundingClientRect(), b = w.getBoundingClientRect();
            if (r.left < b.left || r.right > b.right) {
              w.scrollBy({ left: (r.left + r.width / 2) - (b.left + b.width / 2), behavior: 'smooth' });
            }
          }
        });
      });
    }, { rootMargin: '-15% 0px -60% 0px', threshold: 0 });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ==================================================== 9) سلايدر الرئيسية
     كل تبويب يمثّل مجموعة صور لا صورة واحدة، ولكل مجموعة مدة إجمالية: منتج
     بعشر صور لا يأخذ عشرة أضعاف وقت منتج بصورة. */
  function heroSlider() {
    /* شريحةٌ مقصورةٌ على جهازٍ آخر تُنزَع من الدورة كلها لا تُخفى وحدها:
       لو بقيت في القائمة لوقف السلايدر عندها فظهر فراغ. ونزعُها من الـDOM
       يجعل كل ما بعده — المجموعات والمُدد وأرقام التبويبات — على المرئيّ. */
    const phone = window.matchMedia('(max-width:768px)').matches;
    qsa('.vhero__slide').forEach(function (el) {
      const only = el.dataset.only;
      if ((only === 'desktop' && phone) || (only === 'mobile' && !phone)) el.remove();
    });

    const slides = qsa('.vhero__slide');
    const tabs = qsa('.vhero__tab');
    const video = qs('.vhero__video');
    if (!slides.length && !video) return;

    const groupOf = function (el) { return el && el.dataset ? el.dataset.group : null; };
    const tabForSlide = function (i) {
      const g = groupOf(slides[i]);
      return tabs.filter(function (t) { return groupOf(t) === g; })[0] || null;
    };
    /* هدف التبويب يُحسب من مجموعته لا من data-slide: ذاك رقمٌ في القائمة
       الكاملة، وقد نُزع منها ما لا يخصّ هذا الجهاز. */
    const slideForTab = function (tab) {
      const g = groupOf(tab);
      for (let i = 0; i < slides.length; i++) if (groupOf(slides[i]) === g) return i;
      return 0;
    };
    /* لا شريحة على هذا الجهاز: يبقى الفيديو وحده، ويُنزع شريط التبويبات
       والسهمان معه — سهمٌ لا ينقل إلى شيء. */
    if (!slides.length) { const foot = qs('.vhero__foot'); if (foot) foot.remove(); return; }
    /* تبويبٌ لا شريحة له على هذا الجهاز لا يُعرض: نقرُه كان يرجع إلى الأولى. */
    tabs.slice().forEach(function (tab) {
      const g = groupOf(tab);
      const has = slides.filter(function (s) { return groupOf(s) === g; }).length;
      if (!has) { tab.remove(); tabs.splice(tabs.indexOf(tab), 1); }
    });

    const BASE_INTERVAL = 4300, MAX_GROUP = 20000, MIN_INTERVAL = 2600;
    const groups = [];
    slides.forEach(function (el, i) {
      const key = groupOf(el) || ('s' + i);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.count++;
      else groups.push({ key: key, start: i, count: 1 });
    });
    groups.forEach(function (g) {
      g.interval = Math.max(MIN_INTERVAL, Math.min(BASE_INTERVAL, MAX_GROUP / g.count));
      g.total = g.interval * g.count;
    });
    const FALLBACK = { key: null, start: 0, count: 1, interval: BASE_INTERVAL, total: BASE_INTERVAL };
    const groupAt = function (i) {
      return groups.filter(function (g) { return i >= g.start && i < g.start + g.count; })[0]
        || groups[0] || FALLBACK;
    };

    /* الشريط يعبّر عن التقدّم في المنتج كله لا في صورة واحدة */
    function paintProgress(idx, running) {
      const g = groupAt(idx), pos = idx - g.start;
      tabs.forEach(function (tab) {
        const fill = qs('.vhero__tab-fill', tab);
        if (!fill) return;
        fill.style.animation = 'none';
        fill.style.animationDelay = '';
        if (running && groupOf(tab) === g.key) {
          void fill.offsetWidth;
          fill.style.animation = 'heroProgress ' + g.total + 'ms linear forwards';
          fill.style.animationDelay = '-' + (pos * g.interval) + 'ms';
        }
      });
    }
    /* الصور تُحمَّل عند الحاجة لا كلها مرة واحدة.

       وقَصّة الهاتف مؤجَّلة مثلها في <source data-srcset>: مصدرٌ مطابق بلا
       تأجيل كان ينزّل قَصّات الشرائح السبع عشرة فور فتح الصفحة على الهاتف.
       تُرفَع قبل src كي يختار المتصفح القَصّة لا الصورة العريضة. */
    function hydrate(i) {
      const s = slides[(i + slides.length) % slides.length];
      if (!s) return;
      const src = qs('source[data-srcset]', s);
      if (src) { src.srcset = src.dataset.srcset; src.removeAttribute('data-srcset'); }
      const img = qs('img[data-src]', s);
      if (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
    }

    if (video) video.play().catch(function () {});

    let current = 0, timer = null, isPlaying = !reduced, hoverPause = false, slidesReveal = null;

    function showSlide(idx) {
      current = (idx + slides.length) % slides.length;
      slides.forEach(function (s, i) {
        const active = i === current;
        s.classList.toggle('is-active', active);
        s.setAttribute('aria-hidden', String(!active));
      });
      hydrate(current); hydrate(current + 1);
      const activeGroup = groupOf(slides[current]);
      tabs.forEach(function (tab) {
        const active = groupOf(tab) === activeGroup;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      paintProgress(current, isPlaying);
      if (slidesReveal) slidesReveal();
    }

    function startTimer() {
      stopTimer();
      if (isPlaying && !reduced && !hoverPause) {
        timer = setTimeout(function () { showSlide(current + 1); startTimer(); }, groupAt(current).interval);
      }
    }
    function stopTimer() { if (timer) { clearTimeout(timer); timer = null; } }
    function setPlayingState(play) {
      isPlaying = play;
      if (video) { if (isPlaying) video.play().catch(function () {}); else video.pause(); }
      if (isPlaying) { startTimer(); paintProgress(current, true); }
      else { stopTimer(); paintProgress(current, false); }
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('keydown', function (e) {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
        e.preventDefault();
        const next = e.key === 'Home' ? 0
          : e.key === 'End' ? tabs.length - 1
          : (i + ((e.key === 'ArrowRight') !== rtl() ? 1 : -1) + tabs.length) % tabs.length;
        setPlayingState(false);
        showSlide(slideForTab(tabs[next]));
        tabs[next].focus();
      });
      tab.addEventListener('click', function () {
        showSlide(slideForTab(tab));
        if (isPlaying) startTimer();
      });
    });

    /* السهمان ينقلان إلى المنتج السابق/التالي ويزحزقان الشريط ليبان تبويبه */
    const strip = qs('#heroTabs'), prevBtn = qs('#heroPrev'), nextBtn = qs('#heroNext');
    function revealTab(tab) {
      if (!strip || !tab) return;
      const pad = 12;
      const left = tab.offsetLeft - strip.offsetLeft;
      const min = left + tab.offsetWidth + pad - strip.clientWidth;
      const max = left - pad;
      let to = strip.scrollLeft;
      if (to < min) to = min;
      if (to > max) to = max;
      if (to !== strip.scrollLeft) {
        if (strip.scrollTo) strip.scrollTo({ left: to, behavior: 'smooth' });
        else strip.scrollLeft = to;
      }
    }
    function goGroup(dir) {
      if (!groups.length) return;
      const gi = groups.indexOf(groupAt(current));
      const g = groups[(gi + dir + groups.length) % groups.length];
      showSlide(g.start);
      revealTab(tabs.filter(function (t) { return groupOf(t) === g.key; })[0]);
      startTimer();
    }
    if (prevBtn) prevBtn.addEventListener('click', function () { goGroup(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goGroup(1); });
    slidesReveal = function () { revealTab(tabForSlide(current)); };

    D.addEventListener('visibilitychange', function () {
      if (D.hidden) stopTimer();
      else if (isPlaying) startTimer();
    });

    /* يتوقّف حين يقف المؤشر على النص كي يتمكّن الزائر من القراءة */
    const hero = qs('#hero');
    [qs('.vhero__in'), qs('.vhero__foot')].filter(Boolean).forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        hoverPause = true; stopTimer();
        if (hero) hero.classList.add('is-held');
      });
      el.addEventListener('mouseleave', function () {
        hoverPause = false;
        if (hero) hero.classList.remove('is-held');
        if (isPlaying) { showSlide(current); startTimer(); }
      });
    });

    if (hero) {
      let x0 = null, y0 = null;
      hero.addEventListener('touchstart', function (e) {
        x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
      }, { passive: true });
      hero.addEventListener('touchend', function (e) {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
        x0 = null;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        showSlide(current + ((dx < 0) !== rtl() ? 1 : -1));
        if (isPlaying) startTimer();
      }, { passive: true });
    }

    showSlide(0);
    setPlayingState(isPlaying);
  }

  /* ================================================== 10) عارض صور المعرض
     بلاطة واحدة قد تختصر عدة صور، فالقائمة كاملة تأتي في data-shots. */
  function galleryViewer() {
    const grids = qsa('[data-gallery]');
    if (!grids.length) return;
    const box = D.createElement('div');
    box.className = 'plb';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<div class="plb__scrim"></div><div class="plb__box">'
      + '<button class="plb__btn plb__close" type="button" aria-label="' + (UI.close || 'Close') + '">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
      + '<img class="plb__img" src="" alt="">'
      + '<div class="plb__bar"><span class="plb__num"></span><div class="plb__nav">'
      + '<button class="plb__btn plb__prev" type="button" aria-label="' + (UI.prev || 'Previous') + '">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button>'
      + '<button class="plb__btn plb__next" type="button" aria-label="' + (UI.next || 'Next') + '">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg></button>'
      + '</div></div></div>';
    D.body.appendChild(box);
    const img = qs('.plb__img', box), num = qs('.plb__num', box);
    let shots = [], at = 0, last = null;

    const show = function (i) {
      at = (i + shots.length) % shots.length;
      img.src = shots[at];
      num.textContent = (at + 1) + ' / ' + shots.length;
    };
    const open = function (list, i) {
      shots = list;
      last = D.activeElement;
      show(i);
      box.hidden = false;
      H.style.overflow = 'hidden';
      qs('.plb__close', box).focus();
    };
    const close = function () {
      box.hidden = true;
      H.style.overflow = '';
      if (last && last.focus) last.focus();
    };

    grids.forEach(function (grid) {
      let list = null;
      try { list = JSON.parse(grid.dataset.shots || 'null'); } catch (e) { list = null; }
      if (!list) {
        list = qsa('img', grid).map(function (im) { return im.currentSrc || im.src; });
      }
      grid.addEventListener('click', function (e) {
        const b = e.target.closest('.mshot');
        if (b) open(list, Number(b.dataset.i) || 0);
      });
    });

    box.addEventListener('click', function (e) {
      if (e.target.closest('.plb__prev')) return show(at - 1);
      if (e.target.closest('.plb__next')) return show(at + 1);
      if (e.target.closest('.plb__close') || e.target.closest('.plb__scrim')) close();
    });
    D.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(rtl() ? at + 1 : at - 1);
      else if (e.key === 'ArrowRight') show(rtl() ? at - 1 : at + 1);
    });
  }

  /* =========================================== 11) صورة المنتج: تكبير وتبديل
     وكل معرض بالشكل نفسه في الصفحة — صفحة المنتج، وقسم «صورة ونص» بصور معرض
     (story__gal). كان يعمل على أول معرض في الصفحة وحده. */
  function productZoom() {
    qsa('[data-zoom]').forEach(zoomOne);
  }
  function zoomOne(wrap) {
    const main = qs('.pdp__main:not(.pdp__main--plate), .story__media', wrap);
    const img = main && qs('img', main);
    const button = main && qs('.ux-zoom', main);
    if (!img || !button) return;

    const thumbs = qs('.ux-thumbnails', wrap);
    if (thumbs) {
      const btns = qsa('button', thumbs);
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          const src = qs('img', b);
          if (!src) return;
          const source = qs('source', main);
          if (source) source.remove();
          img.src = src.getAttribute('src');
          btns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        });
      });
    }

    const modal = D.createElement('dialog');
    modal.className = 'ux-lightbox';
    modal.setAttribute('aria-label', UI.productPhoto || 'Product photo');
    modal.innerHTML = '<button class="ux-close" type="button" aria-label="'
      + (UI.closePhoto || 'Close photo') + '">×</button><img alt="">';
    D.body.append(modal);
    button.addEventListener('click', function () {
      const m = qs('img', modal);
      m.src = img.currentSrc || img.src;
      m.alt = img.alt;
      modal.showModal();
      D.body.classList.add('ux-dialog-open');
    });
    qs('button', modal).addEventListener('click', function () { modal.close(); });
    modal.addEventListener('close', function () {
      D.body.classList.remove('ux-dialog-open');
      button.focus();
    });
  }

  /* ================================================ 12) شريط مقاطع الفيديو
     مقطع واحد على الشاشة. مغادرة المقطع تفكّ مشغّله، وإلا ظلّ تضمين يوتيوب
     يعمل خارج الشاشة أو ظلّ صوت الفيديو المحلي يعمل. */
  function videoSlider() {
    const film = qs('[data-vfilm]');
    if (!film) return;
    const track = qs('.vslider__track', film);
    const slides = qsa('.vslide', film);
    const caps = qsa('.vslider__cap', film);
    const dots = qsa('.vslider__dot', film);
    const atOut = qs('.vfilm__at', film);
    const posters = slides.map(function (fig) {
      const hit = qs('.vslide__hit', fig);
      return hit ? hit.outerHTML : null;
    });
    let at = 0;

    function reset(i) {
      const fig = slides[i];
      if (!fig) return;
      if (qs('iframe', fig) && posters[i]) fig.innerHTML = posters[i];
      const vid = qs('video', fig);
      if (vid && !vid.paused) vid.pause();
    }
    function show(i) {
      const next = (i + slides.length) % slides.length;
      if (next !== at) reset(at);
      at = next;
      if (track) track.style.setProperty('--at', at);
      slides.forEach(function (el, n) {
        const on = n === at;
        /* setAttribute لا toggleAttribute: الثانية تكتب aria-hidden="" ولا
           يعدّه المتصفح ولا قارئ الشاشة مخفيًا. */
        if (on) el.removeAttribute('aria-hidden');
        else el.setAttribute('aria-hidden', 'true');
        const hit = qs('.vslide__hit, .vslide__player', el);
        if (hit) hit.tabIndex = on ? 0 : -1;
      });
      caps.forEach(function (el, n) { el.classList.toggle('is-on', n === at); });
      dots.forEach(function (el, n) {
        el.classList.toggle('is-on', n === at);
        el.setAttribute('aria-selected', String(n === at));
      });
      if (atOut) atOut.textContent = at + 1;
    }

    /* العلامة تتبع حالة المشغّل الحقيقية، فالفيديو المُوقَف من أزراره الأصلية
       يظهر عليه رمز التشغيل في وسطه. */
    qsa('.vslide__player', film).forEach(function (vid) {
      const fig = vid.closest('.vslide');
      const sync = function () {
        fig.classList.toggle('is-playing', !vid.paused && !vid.ended);
        const btn = qs('.vslide__toggle', fig);
        if (btn) btn.setAttribute('aria-label', vid.paused ? (UI.playVideo || 'Play video') : (UI.pauseVideo || 'Pause video'));
      };
      ['play', 'pause', 'ended'].forEach(function (ev) { vid.addEventListener(ev, sync); });
    });

    film.addEventListener('click', function (e) {
      const tgl = e.target.closest('.vslide__toggle');
      if (tgl) {
        const vid = qs('.vslide__player', tgl.closest('.vslide'));
        if (vid) { if (vid.paused) vid.play().catch(function () {}); else vid.pause(); }
        return;
      }
      if (e.target.closest('.vslider__nav--prev')) return show(at - 1);
      if (e.target.closest('.vslider__nav--next')) return show(at + 1);
      const dot = e.target.closest('.vslider__dot');
      if (dot) return show(Number(dot.dataset.i) || 0);
      const hit = e.target.closest('.vslide__hit');
      if (!hit || !hit.dataset.yt) return;
      /* المشغّل الذي يقدّمه يوتيوب نفسه، مع التشغيل التلقائي لأن الزائر ضغط
         «تشغيل» مرة بالفعل ليصل إلى هنا. */
      hit.parentNode.innerHTML = '<iframe src="https://www.youtube.com/embed/' + hit.dataset.yt
        + '?autoplay=1&rel=0&playsinline=1" title="' + (hit.getAttribute('aria-label') || '')
        + '" frameborder="0" allowfullscreen'
        + ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"'
        + ' referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    });

    film.addEventListener('keydown', function (e) {
      if (['ArrowLeft', 'ArrowRight'].indexOf(e.key) < 0) return;
      if (e.target.closest('.vslide__player')) return;   // اترك للمشغّل تقديمه
      e.preventDefault();
      show(at + ((e.key === 'ArrowLeft') === rtl() ? 1 : -1));
    });

    show(0);
  }

  /* ============================================================= 13) البحث */
  function searchDialog() {
    const records = DATA.search || [];
    if (!records.length) return;
    const dialog = D.createElement('dialog');
    dialog.className = 'ux-search';
    dialog.setAttribute('aria-labelledby', 'ux-search-title');
    dialog.innerHTML = '<div class="ux-dialog-head"><h2 id="ux-search-title">'
      + (UI.searchTitle || 'Find a product or service') + '</h2>'
      + '<button type="button" class="ux-close" aria-label="' + (UI.searchClose || 'Close search') + '">×</button></div>'
      + '<label class="sr" for="ux-search-input">' + (UI.search || 'Search') + '</label>'
      + '<input id="ux-search-input" type="search" autocomplete="off" placeholder="'
      + (UI.searchPlaceholder || '') + '">'
      + '<p class="ux-search-count" role="status" aria-live="polite"></p>'
      + '<div class="ux-search-results"></div>';
    D.body.append(dialog);

    const input = qs('input', dialog);
    const results = qs('.ux-search-results', dialog);
    const count = qs('.ux-search-count', dialog);
    const arrow = ICO.arrow || '';
    const esc = function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    };
    /* تسوية النص: تُزال الحركات والتطويل، وتُوحَّد الألف والياء، كي يجد
       الزائر «مولد» ولو كتبها «مولّد». */
    const normalize = function (s) {
      return String(s).toLowerCase().normalize('NFKD')
        .replace(/[ً-ٰٟـ̀-ͯ]/g, '')
        .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').trim();
    };
    const lang = DATA.lang === 'ar' ? 'ar' : 'en';
    const withLang = function (h) {
      if (!h) return h;
      const u = new URL(h, location.href);
      u.searchParams.set('lang', lang);
      return u.pathname.replace(/^\//, '') + u.search + u.hash;
    };

    function paint() {
      const tokens = normalize(input.value).split(/\s+/).filter(Boolean);
      const matches = tokens.length
        ? records.filter(function (r) {
            return tokens.every(function (tk) { return normalize(r.terms).indexOf(tk) >= 0; });
          })
        : records.slice(0, 8);
      const shown = matches.slice(0, 30);
      count.textContent = !tokens.length ? (UI.quickAccess || 'Quick access')
        : matches.length
          ? (UI.results || '{n} results').replace('{n}', matches.length)
            + (matches.length > 30 ? (UI.firstThirty || '') : '')
          : (UI.noMatches || 'No matches.');
      results.innerHTML = shown.map(function (r) {
        return '<a href="' + esc(withLang(r.href)) + '"><span><b>' + esc(r.name)
          + '</b><small>' + esc(r.type) + '</small></span>' + arrow + '</a>';
      }).join('') || ('<a href="' + esc(DATA.quoteHref || 'quote.html') + '">'
        + (UI.askTeam || 'Ask our team to help you choose') + ' ' + arrow + '</a>');
    }

    input.addEventListener('input', paint);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); const a = qs('a', results); if (a) a.focus(); }
    });
    qs('.ux-close', dialog).addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    });
    dialog.addEventListener('close', function () {
      D.body.classList.remove('ux-dialog-open');
      const b = qs('#searchBtn');
      if (b) b.focus();
    });
    D.addEventListener('ux-search', function () {
      paint();
      dialog.showModal();
      D.body.classList.add('ux-dialog-open');
      input.focus();
    });
  }

  /* ============================== 14) شريط التواصل السريع والعودة إلى أعلى */
  function contactDock() {
    if (page === 'quote' || !DATA.phoneIntl) return;
    const dock = D.createElement('nav');
    dock.className = 'ux-contact-dock';
    dock.setAttribute('aria-label', UI.quickContact || 'Quick contact');
    dock.innerHTML = '<a href="tel:' + DATA.phoneIntl + '">' + (ICO.phone || '')
      + '<span>' + (UI.callUs || 'Call us') + '</span></a>'
      + '<a href="' + (DATA.quoteHref || 'quote.html') + '" class="ux-dock-primary">' + (ICO.doc || '')
      + '<span>' + (UI.requestQuote || 'Request a quote') + '</span></a>';
    D.body.append(dock);
  }

  function backToTop() {
    if (page === 'index' || D.body.scrollHeight < window.innerHeight * 1.8) return;
    const button = D.createElement('button');
    button.type = 'button';
    button.className = 'ux-top';
    button.setAttribute('aria-label', UI.backToTop || 'Back to top');
    button.innerHTML = ICO.arrow || '';
    D.body.append(button);
    const update = function () { button.classList.toggle('is-visible', window.scrollY > 560); };
    window.addEventListener('scroll', update, { passive: true });
    update();
    button.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  /* ================================================ 15) بحث كتالوج المعدات
     يضيّق القوائم ولا يحوّلها إلى نتائج بحث: الصف يظهر أو يختفي، والمجموعة
     التي خلت تختفي معه، فيبقى ترتيب الصفحة مقروءًا.

     كل صف يحمل نصّه المطويّ باللغتين في data-find، فتنجح الكلمة العربية في
     النسخة الإنجليزية والعكس — وهو ما لم يكن ممكنًا في الموقع القديم. */
  function equipmentFinder() {
    const finder = qs('[data-finder]');
    const input = qs('#q');
    if (!finder || !input) return;
    const clear = qs('#qClear');
    const rows = qsa('[data-find]');
    const groups = qsa('[data-group]');
    const blocks = qsa('[data-block]');
    const sections = qsa('[data-lcsec]');

    const norm = (v) => String(v || '').toLowerCase()
      .replace(/[ً-ْـ]/g, '')
      .replace(/[آأإ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ').trim();

    /* رسالة «لا نتيجة» تُبنى عند أول بحث خائب لا قبله، كي تبقى الصفحة كما هي
       ما دامت هناك نتائج. */
    let none = null;
    const showNone = (on) => {
      if (!on) { if (none) none.hidden = true; return; }
      if (!none) {
        none = D.createElement('section');
        none.className = 'sec';
        none.innerHTML = '<div class="wrap"><div class="empty">'
          + '<b>' + (finder.dataset.emptyTitle || '') + '</b>'
          + '<p class="card__desc">' + (finder.dataset.emptyText || '') + '</p>'
          + '<a class="btn mt-16" href="' + (DATA.quoteHref || 'quote.html') + '">'
          + (UI.requestQuote || 'Request a quote') + ' ' + (ICO.arrow || '') + '</a></div></div>';
        (qs('#ranges') || finder).append(none);
      }
      none.hidden = false;
    };

    function run() {
      const query = norm(input.value);
      let shown = 0;
      rows.forEach((r) => {
        const on = !query || r.dataset.find.indexOf(query) > -1;
        r.hidden = !on;
        if (on) shown++;
      });
      /* المجموعة أو الكتلة التي خلت من الصفوف تختفي بعنوانها */
      const anyIn = (box, sel) => qsa(sel, box).some((x) => !x.hidden);
      groups.forEach((g) => { g.hidden = !anyIn(g, '[data-find]'); });
      blocks.forEach((b) => { b.hidden = !anyIn(b, '[data-find]'); });
      sections.forEach((s) => { s.hidden = !anyIn(s, '[data-find]'); });
      showNone(shown === 0);
      if (clear) clear.hidden = !input.value;

      const u = new URL(location.href);
      if (input.value.trim()) u.searchParams.set('q', input.value.trim());
      else u.searchParams.delete('q');
      history.replaceState(null, '', u);
    }

    let timer;
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 180); });
    if (clear) clear.addEventListener('click', () => { input.value = ''; run(); input.focus(); });

    /* ?q= في الرابط يُطبَّق قبل أول رسم، فلا ترتدّ الصفحة من الكل إلى المصفّى */
    const seed = new URLSearchParams(location.search).get('q');
    if (seed) { input.value = seed; run(); } else if (clear) clear.hidden = true;

    /* الروابط القادمة من المنيو تصل إلى مدى بعينه */
    if (location.hash) {
      const target = qs(location.hash);
      if (target) target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  }

  /* ---------------------------------------------------------------- تشغيل */
  function init() {
    reveal(D);
    counters();
    parallax();
    wireRails();
    wireCompare();
    spy();
    wireHeader();
    jumpSpy();
    heroSlider();
    galleryViewer();
    productZoom();
    videoSlider();
    searchDialog();
    equipmentFinder();
    contactDock();
    backToTop();
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init);
  else init();
})();
