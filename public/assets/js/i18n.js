/* =============================================================================
   5A&M — bilingual layer (English / العربية)
   Loaded in <head>, before anything paints, so `lang` and `dir` are already
   correct on the first frame and the page never flashes in the wrong
   direction.

   How it works
   ------------
   English lives in the markup and in data.js — it is the source of truth and
   the fallback. Arabic lives in assets/js/i18n.ar.js as
     • a dictionary of UI strings keyed by dotted paths, and
     • a content overlay merged into window.SITE.
   A missing Arabic key silently falls back to the English already in the page,
   so a half-finished translation degrades instead of breaking.

   Marking text up for translation
   -------------------------------
     <h2 data-i18n="home.env.title">Cleaner cities.</h2>
     <input data-i18n-attr="placeholder:form.name.ph">
     <body data-page="index">            → meta.index.title / meta.index.desc
   ========================================================================== */
(function () {
  'use strict';

  /* Bump on every release so browsers fetch the new Arabic bundle. */
  var VERSION = '20260927';
  var STORE = '5am-lang';
  var DEFAULT = 'en';
  var SUPPORTED = ['en', 'ar'];
  var RTL = ['ar'];

  function param() {
    var m = /[?&]lang=([a-z-]+)/i.exec(location.search);
    return m ? m[1].toLowerCase() : null;
  }
  function stored() {
    try { return localStorage.getItem(STORE); } catch (e) { return null; }
  }
  function remember(l) {
    try { localStorage.setItem(STORE, l); } catch (e) { /* private mode */ }
  }
  function valid(l) { return l && SUPPORTED.indexOf(l) > -1; }

  /* An explicit ?lang= wins and is remembered; otherwise the last choice;
     otherwise English. Browser language is deliberately not sniffed — the
     site is published English-first. */
  var chosen = param();
  if (valid(chosen)) remember(chosen);
  else chosen = valid(stored()) ? stored() : DEFAULT;

  var lang = chosen;
  var rtl = RTL.indexOf(lang) > -1;

  var root = document.documentElement;
  root.lang = lang;
  root.dir = rtl ? 'rtl' : 'ltr';

  var dicts = {};

  function get(key) {
    var d = dicts[lang];
    return d ? d[key] : undefined;
  }

  /* t('nav.home', 'Home') — the second argument is the English already on the
     page, so callers never have to maintain an English dictionary. */
  function t(key, en) {
    var v = get(key);
    if (v === undefined || v === null || v === '') return en === undefined ? key : en;
    return v;
  }

  function register(code, dict, content) {
    dicts[code] = dict || {};
    if (content) I18N.content[code] = content;
  }

  /* Translate the live SITE data in place, before any page module reads it, so
     every card, filter, mega-menu column and detail page picks Arabic up
     without a single call site changing.

     The overlay is keyed by the exact English string rather than by product
     slug. Two reasons: the 62 products share a great deal of wording, so one
     entry covers every place a phrase appears; and a phrase with no entry
     simply stays English instead of leaving a hole. Only fields listed in
     FIELDS are touched — model names, ratings, units and image paths are
     never rewritten.

     `subcategory` is deliberately absent below: it doubles as the filter key
     in the catalogue, the mega menu and the ?sub= query parameter, so it stays
     English and is translated at render time via the `sub.*` keys instead. */
  var FIELDS = {
    products:         ['name', 'type', 'description', 'features', 'applications'],
    categories:       ['name', 'blurb'],
    industries:       ['name', 'd'],
    projects:         ['name', 'sub', 'd'],
    services:         ['name', 'd'],
    engineering:      ['name', 'note'],
    federal:          ['d'],
    scope:            ['name', 'd', 'points'],
    storyShort:       ['k', 't', 'd'],
    repoweringSteps:  ['t', 'd'],
    whyUs:            ['k', 'v'],
    story:            ['title', 'text']
  };

  function applyContent() {
    var S = window.SITE, c = I18N.content[lang];
    if (!S || !c || !c.phrases || S.__i18nApplied === lang) return;
    var P = c.phrases;
    var tr = function (v) { return (typeof v === 'string' && P[v]) ? P[v] : v; };
    var trArr = function (a) { return Array.isArray(a) ? a.map(tr) : a; };

    Object.keys(FIELDS).forEach(function (listName) {
      var list = S[listName];
      if (!Array.isArray(list)) return;
      list.forEach(function (item) {
        FIELDS[listName].forEach(function (f) {
          if (Array.isArray(item[f])) item[f] = trArr(item[f]);
          else if (typeof item[f] === 'string') item[f] = tr(item[f]);
        });
      });
    });

    /* Product extras: chip labels, spec row labels and download names. Spec
       *values* are left alone — they carry units and model numbers. */
    (S.products || []).forEach(function (p) {
      if (p.meta) {
        var meta = {};
        Object.keys(p.meta).forEach(function (k) { meta[tr(k)] = tr(p.meta[k]); });
        p.meta = meta;
      }
      /* Labels always; values only where the phrase map has an entry, so
         "18 in Hg at 3500 CFM" survives while "Single fan or dual fan" does not. */
      (p.specifications || []).forEach(function (s) { s.k = tr(s.k); s.v = tr(s.v); });
      (p.downloads || []).forEach(function (d) { d.label = tr(d.label); });
    });

    if (Array.isArray(S.lifecycle)) S.lifecycle = trArr(S.lifecycle);
    Object.keys(S.brands || {}).forEach(function (k) { S.brands[k].sub = tr(S.brands[k].sub); });
    if (S.company) {
      ['dealership', 'intro', 'vision', 'mission', 'valuesStatement', 'activity', 'tagline', 'address', 'legalName']
        .forEach(function (f) { S.company[f] = tr(S.company[f]); });
      (S.company.values || []).forEach(function (v) { v.k = tr(v.k); v.v = tr(v.v); });
    }

    S.__i18nApplied = lang;
  }

  /* Swap every [data-i18n] node and translated attribute in a subtree. */
  function apply(root) {
    if (lang === DEFAULT) return;
    var scope = root || document;

    var nodes = scope.querySelectorAll('[data-i18n]');
    Array.prototype.forEach.call(nodes, function (el) {
      var v = get(el.getAttribute('data-i18n'));
      if (v !== undefined && v !== null && v !== '') el.innerHTML = v;
    });

    var attrNodes = scope.querySelectorAll('[data-i18n-attr]');
    Array.prototype.forEach.call(attrNodes, function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var bits = pair.split(':');
        if (bits.length < 2) return;
        var v = get(bits[1].trim());
        if (v !== undefined && v !== '') el.setAttribute(bits[0].trim(), v);
      });
    });
  }

  /* <title> and the meta description, keyed off <body data-page="…">. */
  function applyMeta() {
    if (lang === DEFAULT) return;
    var page = document.body && document.body.getAttribute('data-page');
    if (!page) return;
    var title = get('meta.' + page + '.title');
    var desc = get('meta.' + page + '.desc');
    if (title) document.title = title;
    if (desc) {
      var m = document.querySelector('meta[name="description"]');
      if (m) m.setAttribute('content', desc);
    }
  }

  function switchTo(next) {
    if (!valid(next) || next === lang) return;
    remember(next);
    var url = location.pathname + location.search.replace(/([?&])lang=[a-z-]+&?/i, '$1').replace(/[?&]$/, '');
    url += (url.indexOf('?') > -1 ? '&' : '?') + 'lang=' + next;
    location.href = url + location.hash;
  }

  /* Pull in the Arabic bundle only when it is actually needed. Called from a
     one-line inline script placed after data.js, so document.write lands in
     the right place in the parse order and English visitors download nothing
     extra. */
  function load() {
    if (lang === DEFAULT) return;
    document.write('<scr' + 'ipt src="assets/js/i18n.' + lang + '.js?v=' + VERSION + '"></scr' + 'ipt>');
  }

  /* Arabic webfont — only fetched for Arabic readers. IBM Plex Sans Arabic is
     a grotesque, so it sits next to Archivo/Inter without a visible seam. */
  if (rtl) {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap';
    document.head.appendChild(l);
  }

  var I18N = {
    lang: lang,
    rtl: rtl,
    other: lang === 'ar' ? 'en' : 'ar',
    supported: SUPPORTED,
    content: {},
    t: t,
    register: register,
    apply: apply,
    applyMeta: applyMeta,
    applyContent: applyContent,
    switchTo: switchTo,
    load: load
  };
  window.I18N = I18N;

  document.addEventListener('DOMContentLoaded', function () {
    applyContent();
    applyMeta();
    apply(document);
  });
})();
