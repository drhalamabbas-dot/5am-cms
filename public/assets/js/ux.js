/* Shared, framework-free usability improvements. Loaded after each page renderer. */
(function () {
  'use strict';
  const D=document, U=window.UI, S=window.SITE;
  if(!U || !S) return;
  const ar=D.documentElement.lang==='ar', L=(en,arabic)=>ar?arabic:en;
  const q=(s,r=D)=>r.querySelector(s), all=(s,r=D)=>Array.from(r.querySelectorAll(s));
  const pages=[
    ['environment','Environmental solutions','حلول البيئة','بيئة كنس صرف شفط elgin vactor guzzler'],
    ['power','Power solutions','حلول الطاقة','طاقة كهرباء'],
    ['generators','Generator sales & rental','بيع وإيجار المولدات','شراء مولد مولدات كهرباء generators'],
    ['rental','Generator rental','إيجار المولدات','تأجير ايجار اجار مولد rental'],
    ['overhaul','Efficiency upgrades & overhauls','أعمال رفع الكفاءة','اصلاح محرك عمرة عمرات كفاءة'],
    ['fabrication','Fabrication & installation','أعمال الصناعة والتركيبات','كبائن كابينة لوحات تانكات خزانات تركيب'],
    ['aftersales','After-sales services','خدمات ما بعد البيع','دعم خدمة اعطال'],
    ['parts','Genuine spare parts','قطع الغيار الأصلية','فلاتر فلتر قطع غيار parts filters'],
    ['maintenance','Site maintenance & maintenance contracts','صيانة المواقع وعقود الصيانة','عقد صيانة خدمة maintenance'],
    ['projects','Projects','المشروعات','اعمال مشروعات'],
    ['about','About us','من نحن','شركة'],['contact','Contact','التواصل','عنوان هاتف تواصل']
  ];
  const current=(location.pathname.split('/').pop()||'index.html').replace('.html','');
  const groups={environment:['environment'],power:['power','generators','rental','overhaul','fabrication'],aftersales:['aftersales','parts','maintenance'],sectors:['sectors','sector-oil','sector-agri','sector-industry']};
  const solution={environment:'environmental',power:'power',generators:'power',rental:'rental',overhaul:'repowering',fabrication:'engineering',aftersales:'service',parts:'parts',maintenance:'service'};
  /* Stamps the current language onto internal page links so the choice
     survives navigation.

     Two things this must not do, both of which it used to:
     · A file that is not a page — a PDF, an image, a download — has no
       language, and ?lang= on it is noise. Those are returned untouched.
     · Returning only pathname.split('/').pop() threw away every directory, so
       any link into a subfolder (assets/img/.../sheet.pdf) collapsed to the
       bare filename and 404'd. The path is now kept relative to the current
       page instead. */
  const PAGE_LINK = /(^|\/)([^/?#]*\.html?)?([?#]|$)/i;
  function localized(href) {
    if(!href || /^(#|mailto:|tel:|https?:|data:|javascript:)/i.test(href)) return href;
    if(!PAGE_LINK.test(href)) return href;          // a file, not a page
    const url=new URL(href,location.href);
    url.searchParams.set('lang',ar?'ar':'en');
    const dir=new URL('.',location.href).pathname;
    const rel=url.pathname.startsWith(dir) ? url.pathname.slice(dir.length) : url.pathname;
    return rel+url.search+url.hash;
  }
  function quoteUrl() {
    const url=new URL('quote.html',location.href);
    if(solution[current]) url.searchParams.set('solution',solution[current]);
    url.searchParams.set('source',current);
    if(current==='model') {
      const product=new URLSearchParams(location.search).get('p');
      if(product) url.searchParams.set('product',product);
    }
    url.searchParams.set('lang',ar?'ar':'en');
    return 'quote.html'+url.search;
  }
  function search() {
    const dialog=D.createElement('dialog');dialog.className='ux-search';dialog.setAttribute('aria-labelledby','ux-search-title');
    dialog.innerHTML=`<div class="ux-dialog-head"><h2 id="ux-search-title">${L('Find a product or service','ابحث عن منتج أو خدمة')}</h2><button type="button" class="ux-close" aria-label="${L('Close search','إغلاق البحث')}">×</button></div><label class="sr" for="ux-search-input">${L('Search','البحث')}</label><input id="ux-search-input" type="search" autocomplete="off" placeholder="${L('Try generator, rental, filters…','جرّب: مولد، إيجار، فلاتر…')}"><p class="ux-search-count" role="status" aria-live="polite"></p><div class="ux-search-results"></div>`;
    D.body.append(dialog);
    const input=q('input',dialog), results=q('.ux-search-results',dialog), count=q('.ux-search-count',dialog);
    const normalize=s=>String(s).toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670\u0640\u0300-\u036f]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').trim();
    const records=pages.map(p=>({name:L(p[1],p[2]),href:p[0]+'.html',type:L('Service / page','خدمة / صفحة'),terms:p.join(' ')})).concat(S.products.map(p=>({name:p.name,href:'model.html?p='+encodeURIComponent(p.slug),type:L('Product','منتج'),terms:[p.name,p.type,p.subcategory,p.description,(S.brands[p.brand]||{}).name].join(' ')})));
    function paint() {
      const tokens=normalize(input.value).split(/\s+/).filter(Boolean);
      const matches=tokens.length?records.filter(r=>tokens.every(token=>normalize(r.terms).includes(token))):records.slice(0,8);
      const shown=matches.slice(0,30);
      count.textContent=tokens.length?(matches.length?L(`${matches.length} results${matches.length>30?' · showing the first 30':''}`,`${matches.length} نتيجة${matches.length>30?' · أول 30 نتيجة':''}`):L('No matches. Try a brand or a shorter phrase.','لا توجد نتائج. جرّب اسم الماركة أو كلمة أبسط.')):L('Quick access','وصول سريع');
      results.innerHTML=shown.map(r=>`<a href="${U.esc(localized(r.href))}"><span><b>${U.esc(r.name)}</b><small>${r.type}</small></span>${U.ico.arrow}</a>`).join('') || `<a href="${quoteUrl()}">${L('Ask our team to help you choose','اطلب مساعدة فريقنا في الاختيار')} ${U.ico.arrow}</a>`;
    }
    input.addEventListener('input',paint);
    input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();q('a',results)?.focus();}});
    const close=()=>dialog.close();q('.ux-close',dialog).addEventListener('click',close);
    dialog.addEventListener('click',e=>{if(e.target===dialog && (e.clientX<dialog.getBoundingClientRect().left||e.clientX>dialog.getBoundingClientRect().right||e.clientY<dialog.getBoundingClientRect().top||e.clientY>dialog.getBoundingClientRect().bottom))close();});
    dialog.addEventListener('close',()=>{D.body.classList.remove('ux-dialog-open');q('#searchBtn')?.focus();});
    D.addEventListener('ux-search',()=>{paint();dialog.showModal();D.body.classList.add('ux-dialog-open');input.focus();});
  }
  function nav() {
    all('.hdr__nav a').forEach(a=>{
      const file=a.getAttribute('href').split('.')[0];
      const active=(groups[file]||[file]).includes(current);
      a.classList.toggle('is-active',active);
      if(active) a.setAttribute('aria-current',file===current?'page':'true');
    });
    all('a').forEach(a=>{
      const href=a.getAttribute('href')||'';
      if(href==='contact.html' && (a.textContent.includes('عرض سعر')||/quote/i.test(a.textContent))) a.href=quoteUrl();
    });
    all('.hdr__tools .btn, .mnav > .btn, .ftr a.btn').forEach(a=>a.setAttribute('href',quoteUrl()));
    // Page-level CTAs carry the service context into one consistent request flow.
    all('.pgcta > a').forEach(a=>{a.href=quoteUrl();a.innerHTML=L('Discuss your requirements','ناقش متطلباتك')+' '+U.ico.arrow;});
    const hero=q('#pageRoot .phero__in');
    if(hero && current!=='contact') {
      const row=D.createElement('div');row.className='ux-hero-actions';
      row.innerHTML=`<a class="btn" href="${quoteUrl()}">${L('Discuss your requirements','ناقش متطلباتك')} ${U.ico.arrow}</a><a class="ux-hero-call" href="tel:${S.company.phoneIntl}">${U.ico.phone} ${L('Talk to our team','تحدث مع فريقنا')}</a>`;
      hero.append(row);
    }
    const crumbs=q('#pageRoot .crumbs');
    const parent=groups.power.includes(current)&&current!=='power'?'power':groups.aftersales.includes(current)&&current!=='aftersales'?'aftersales':null;
    if(crumbs && parent) {
      const p=pages.find(p=>p[0]===parent);q('.now',crumbs).insertAdjacentHTML('beforebegin',`<a href="${p[0]}.html">${L(p[1],p[2])}</a><span aria-hidden="true">/</span>`);
    }
    if(current!=='quote') {
      const dock=D.createElement('nav');dock.className='ux-contact-dock';dock.setAttribute('aria-label',L('Quick contact','التواصل السريع'));
      dock.innerHTML=`<a href="tel:${S.company.phoneIntl}">${U.ico.phone}<span>${L('Call us','اتصل بنا')}</span></a><a href="${quoteUrl()}" class="ux-dock-primary">${U.ico.doc}<span>${L('Request a quote','اطلب عرض سعر')}</span></a>`;D.body.append(dock);
    }
  }
  function homepage() {
    if(current!=='index') return;
    [['#federal .lead__title','Environmental solutions','حلول البيئة'],['#power .lead__title','Power solutions','حلول الطاقة'],['#fabrication .lead__title','Fabrication & installation','أعمال الصناعة والتركيبات'],['#aftersales .lead__title','Support beyond delivery','خدمات ما بعد البيع'],['#projects .lead__title','Our projects by sector','مشروعاتنا في القطاعات']].forEach(([s,en,arabic])=>{const el=q(s);if(el)el.textContent=L(en,arabic);});
    const intro=q('#federal .lead__lede');if(intro)intro.textContent=L('Street sweeping, sewer cleaning and industrial vacuum equipment from Elgin, Vactor and Guzzler.','معدات كنس الشوارع وتنظيف الصرف والشفط الصناعي من Elgin وVactor وGuzzler.');
    all('.fscard').forEach(a=>{
      /* chips + the responsible company stay — 5A&M asked for both */
      const title=q('.fscard__h',a)?.textContent||'';
      a.setAttribute('aria-label',title);
      const cta=q('.fscard__cta-link',a);if(cta)cta.innerHTML=L('Learn more','استعرض الخدمة')+' '+U.ico.arrow;
    });
    const about=q('.about2__copy');if(about)about.insertAdjacentHTML('beforeend',`<a class="btn btn--ghost mt-16" href="about.html">${L('More about 5A&M','تعرّف على 5A&M')} ${U.ico.arrow}</a>`);
  }
  function jumpLinks() {
    const root=q('#pageRoot');if(!root || current==='contact')return;
    const sections=all(':scope > .sec',root).filter(s=>q('h2',s));
    if(sections.length<2)return;
    const navigation=D.createElement('nav');navigation.className='ux-jump';navigation.setAttribute('aria-label',L('On this page','محتويات الصفحة'));
    navigation.innerHTML='<div class="wrap">'+sections.map((s,i)=>{if(!s.id)s.id='section-'+(i+1);return `<a href="#${s.id}">${U.esc(q('h2',s).textContent)}</a>`;}).join('')+'</div>';
    q('.phero',root).after(navigation);
    const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting)all('a',navigation).forEach(a=>{const active=a.hash==='#'+entry.target.id;a.classList.toggle('is-active',active);if(active){a.setAttribute('aria-current','location');const w=a.parentElement;if(w&&w.scrollWidth>w.clientWidth){const r=a.getBoundingClientRect(),q=w.getBoundingClientRect();if(r.left<q.left||r.right>q.right)w.scrollBy({left:(r.left+r.width/2)-(q.left+q.width/2),behavior:'smooth'});}}else a.removeAttribute('aria-current');});});},{rootMargin:'-15% 0px -60% 0px',threshold:0});
    sections.forEach(s=>observer.observe(s));
  }
  function relatedServices() {
    const mapping={
      'sector-oil':['generators','rental','environment','maintenance'],
      'sector-agri':['generators','overhaul','parts','maintenance'],
      'sector-industry':['generators','fabrication','maintenance'],
      aftersales:['parts','maintenance'],parts:['aftersales','maintenance'],maintenance:['parts','aftersales']
    };
    const related=mapping[current],root=q('#pageRoot');if(!related||!root)return;
    const section=D.createElement('section');section.className='sec ux-related';
    section.innerHTML=`<div class="wrap"><h2>${L('Explore the right service','وصول مباشر للخدمات')}</h2><div class="ux-related-grid">${related.map(id=>{const p=pages.find(p=>p[0]===id);return `<a href="${id}.html"><span>${L(p[1],p[2])}</span>${U.ico.arrow}</a>`;}).join('')}</div></div>`;
    const end=q('.pgcta',root)?.closest('.sec');if(end)end.before(section);else root.append(section);
  }
  function productZoom() {
    const main=q('.pdp__main:not(.pdp__main--plate)');const img=main&&q('img',main);if(!img)return;
    const button=D.createElement('button');button.type='button';button.className='ux-zoom';button.innerHTML=U.ico.search+' '+L('Enlarge photo','تكبير الصورة');main.append(button);
    const product=S.bySlug(new URLSearchParams(location.search).get('p'));
    const images=product?[...new Set([product.heroImage].concat(product.gallery||[]))].filter(Boolean):[];
    if(images.length>1){
      const thumbs=D.createElement('div');thumbs.className='ux-thumbnails';thumbs.setAttribute('aria-label',L('Product photos','صور المنتج'));
      thumbs.innerHTML=images.map((src,i)=>`<button type="button" aria-pressed="${i===0}" aria-label="${L('View photo','عرض الصورة')} ${i+1}"><img src="${U.esc(src)}" alt="" loading="lazy"></button>`).join('');
      main.after(thumbs);
      all('button',thumbs).forEach((b,i)=>b.addEventListener('click',()=>{q('source',main)?.remove();img.src=images[i];all('button',thumbs).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
    }
    const modal=D.createElement('dialog');modal.className='ux-lightbox';modal.setAttribute('aria-label',L('Product photo','صورة المنتج'));
    modal.innerHTML=`<button class="ux-close" type="button" aria-label="${L('Close photo','إغلاق الصورة')}">×</button><img alt="">`;D.body.append(modal);
    button.addEventListener('click',()=>{q('img',modal).src=img.currentSrc||img.src;q('img',modal).alt=img.alt;modal.showModal();D.body.classList.add('ux-dialog-open');});
    q('button',modal).addEventListener('click',()=>modal.close());modal.addEventListener('close',()=>{D.body.classList.remove('ux-dialog-open');button.focus();});
  }
  function backToTop() {
    if (current === 'index' || D.body.scrollHeight < window.innerHeight * 1.8) return;
    const button = D.createElement('button');
    button.type = 'button';
    button.className = 'ux-top';
    button.setAttribute('aria-label', L('Back to top', 'العودة إلى أعلى الصفحة'));
    button.innerHTML = U.ico.arrow;
    D.body.append(button);
    const update = () => button.classList.toggle('is-visible', window.scrollY > 560);
    window.addEventListener('scroll', update, {passive:true});
    update();
    button.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));
  }
  D.addEventListener('DOMContentLoaded',()=>{
    nav();homepage();jumpLinks();relatedServices();search();productZoom();backToTop();
    all('a[href]').forEach(a=>a.setAttribute('href',localized(a.getAttribute('href'))));
    all('img').forEach(img=>{img.decoding='async';});
  });
})();
