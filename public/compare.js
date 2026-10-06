/* أداة مقارنة الشكل بين الموقع القديم والجديد — للتطوير فقط.

   تُحمَّل الصفحتان في إطارين من المصدر نفسه (القديم يمرّ عبر /old-site)، ثم
   تُقارن شجرة العناصر داخل #pageRoot: الوسم والأصناف والمعرّف والنص.

   ما يُتجاهَل عمدًا: أصناف تظهر بتوقيت الحركة (mo-in) أو بموضع التمرير
   (is-active)، والمعرّفات المولّدة تلقائيًا (section-N)، وفروق المسافات.
   ما عدا ذلك، أي اختلاف هو تغيير حقيقي في الشكل. */
(function () {
  const IGNORE_CLASS = new Set(['mo-in', 'is-active', 'is-in', 'under-hdr']);

  /* أزرار التحرير لا يراها الزائر، فلا تدخل المقارنة ولو كان من يقارن داخلًا
     بحسابه. */
  const isEditOnly = (el) =>
    typeof el.className === 'string' && /\bux-edit/.test(el.className);

  function sig(root) {
    const out = [];
    (function walk(el, d) {
      if (!el || el.nodeType !== 1) return;
      if (isEditOnly(el)) return;
      const cls = (typeof el.className === 'string' ? el.className : '')
        .trim().split(/\s+/).filter((c) => c && !IGNORE_CLASS.has(c)).sort().join('.');
      const id = el.id && !/^section-\d+$/.test(el.id) ? '#' + el.id : '';
      const txt = [...el.childNodes].filter((n) => n.nodeType === 3)
        .map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
      out.push('  '.repeat(d) + el.tagName.toLowerCase() + id + (cls ? '.' + cls : '') + (txt ? ' «' + txt + '»' : ''));
      [...el.children].forEach((c) => walk(c, d + 1));
    })(root, 0);
    return out;
  }

  function load(url, width) {
    return new Promise((resolve) => {
      const f = document.createElement('iframe');
      f.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:900px;opacity:0;border:0;pointer-events:none`;
      f.src = url;
      f.onload = () => setTimeout(() => resolve(f), 2200);
      setTimeout(() => resolve(f), 9000);
      document.body.appendChild(f);
    });
  }

  /** يقارن صفحة واحدة بلغة واحدة وعرض واحد. */
  window.comparePage = async function (slug, lang, width, query) {
    width = width || 1280;
    const qs = query ? '&' + query : '';
    const [oldF, newF] = await Promise.all([
      load(`/old-site/${slug}.html?lang=${lang}${qs}`, width),
      load(`/${slug}.html?lang=${lang}${qs}`, width),
    ]);
    /* صفحات المحتوى تضع سكاشنها في #pageRoot. الرئيسية وصفحة المنتج ونموذج
       عرض السعر لا تفعل، فتُقارَن من <main> نفسه. */
    const pick = (f) => {
      const d = f.contentDocument;
      return { root: d && (d.querySelector('#pageRoot') || d.querySelector('main#main')), doc: d };
    };
    const a = pick(oldF), b = pick(newF);
    const res = { slug, lang, width, ok: true, notes: [] };
    if (!a.root || !b.root) {
      res.ok = false;
      res.notes.push(!a.root ? 'القديم: لا يوجد جذر للمقارنة' : 'الجديد: لا يوجد جذر للمقارنة');
      oldF.remove(); newF.remove();
      return res;
    }
    const sa = sig(a.root), sb = sig(b.root);
    res.lines = { old: sa.length, new: sb.length };

    // أول فرق في كل اتجاه
    const diffs = [];
    const max = Math.max(sa.length, sb.length);
    for (let i = 0, shown = 0; i < max && shown < 12; i++) {
      if (sa[i] !== sb[i]) { diffs.push({ at: i, old: sa[i] ?? '—', new: sb[i] ?? '—' }); shown++; }
    }
    res.ok = diffs.length === 0;
    res.diffs = diffs;

    // مقارنة عدد العناصر الأساسية
    const count = (d, sel) =>
      [...d.querySelectorAll(sel)].filter((el) => !el.closest('[class*="ux-edit"]') && !isEditOnly(el)).length;
    res.counts = {};
    for (const sel of ['section', 'img', 'a', 'h2', '.btn']) {
      const ca = count(a.root, sel), cb = count(b.root, sel);
      if (ca !== cb) res.counts[sel] = { old: ca, new: cb };
    }
    oldF.remove(); newF.remove();
    return res;
  };

  /** يقارن قائمة صفحات ويعيد ملخّصًا. */
  window.compareAll = async function (slugs, langs, width) {
    const out = [];
    for (const s of slugs) {
      for (const l of langs || ['ar', 'en']) {
        out.push(await window.comparePage(s, l, width));
      }
    }
    return out;
  };
})();
