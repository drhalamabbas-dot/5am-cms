'use client';
/* =============================================================================
   المحرّر المرئي.

   ثلاثة أجزاء: شريط علوي (رجوع، تراجع، حاسب/موبايل، احفظ)، وقائمة جانبية
   (الأقسام، أو حقول القسم المختار)، والصفحة الحقيقية في الوسط.

   كيف تظهر الكتابة في الصفحة قبل الحفظ:
   1. الحقول هي نفسها حقول اللوحة (FieldView)، داخل نموذج. كل نصف ثانية
      يُقرأ النموذج، وإن تغيّر يُعاد بناء محتوى القسم بـ contentFromForm —
      الدالة نفسها التي يحفظ بها الخادم، فما يُعاين هو ما سيُحفظ.
   2. الحالة كلها تُرسل إلى /api/admin/preview بعد توقّف قصير، فيعود مفتاح.
   3. الصفحة تُحمَّل بالمفتاح في إطار خفيّ، ثم يُنقل إليه موضع التمرير
      ويُبدَّل بالظاهر — فلا ترمش الصفحة ولا تقفز. ولكل تحميل رقم، فإن وصل
      تحميل قديم بعد جديد يُهمَل.
   4. الإطار من نفس الموقع، فيُقرأ ضغط القسم فيه مباشرةً: علامة مخفية قبل كل
      قسم (ux-mark) تقول أيّ قسم هو.
============================================================================= */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FieldView } from './Fields';
import { SectionShape } from './SectionShapes';
import { Ico } from './EditorIcons';
import { guardCanvas, installCanvas, PRODUCT_LINK, type CanvasApi, type ItemAct } from './editorCanvas';
import { MediaPicker } from './MediaPicker';
import { ProductPicker, LinkPicker, NewPageDialog, type PickProduct, type NewPageStart } from './EditorPickers';
import { SlidesField } from './SlidesField';
import { NavPanel } from './NavPanel';
import { DesignPanel, ThemePanel, applyPatch, type Patch } from './DesignPanel';
import type { Design, Theme } from '@/lib/design';
import type { NavRow } from '@/lib/nav';
import { contentFromForm } from '@/lib/formJson';
import { HERO_FIELDS } from '@/lib/placeholders';
import { EDITABLE_TEMPLATES, HERO_TEMPLATES } from '@/lib/templates';
import type { TypeSpec } from '@/lib/sectionSchema';

export type EdSection = { id: number; type: string; anchor: string | null; published: number; content: any };
/** nav: صفوف المنيو العلوي — الهيدر يُعدَّل من المحرّر ويُحفظ معه */
/* theme: ألوان الموقع وخطوطه (lib/design.ts) — تُعدَّل من هنا وتُحفظ معه */
type State = { hero: any; sections: EdSection[]; nav: NavRow[]; theme: Theme };
type CanvasId = 'hero' | 'nav' | number;
type Sel = CanvasId | 'theme' | null;
type SaveResult = { ok: true; sections: EdSection[]; hero: any; nav: NavRow[]; theme: Theme; version: string } | { ok: false; error: string };

const titleOf = (s: EdSection, schema: Record<string, TypeSpec>) =>
  s.content?.title?.ar || s.content?.title?.en || s.content?.h?.ar || schema[s.type]?.label || s.type;

const serialize = (form: HTMLFormElement) =>
  JSON.stringify([...new FormData(form).entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '']));

/** نسخة من الكائن بقيمة جديدة في مسار منقوط (title.ar، points.2.en …). */
function setPath(obj: any, path: string, value: unknown) {
  const out = structuredClone(obj ?? {});
  const parts = path.split('.');
  let n = out;
  for (let i = 0; i < parts.length - 1; i++) {
    if (n[parts[i]] == null) n[parts[i]] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    n = n[parts[i]];
  }
  n[parts[parts.length - 1]] = value;
  return out;
}

const newId = () => -Math.floor(Math.random() * 1e9) - 1;

/**
 * المنتجات المختارة في قسم كروت منتجات: صورة واسم لكل منتج، وزرّ يفتح
 * نافذة الاختيار. الحقول المخفية تُبقي القائمة في النموذج، فيُعاد بناؤها
 * منه كما هي (contentFromForm يحذف الحقل المعروف الغائب عن النموذج).
 */
function RefsField({ name, label, ids, products, onOpen }: {
  name: string; label: string; ids: string[]; products: PickProduct[]; onOpen: () => void;
}) {
  const by = new Map(products.map((p) => [p.ref, p]));
  return (
    <div className="field">
      <label>{label}</label>
      {ids.map((id, i) => <input key={i} type="hidden" name={`${name}.${i}`} value={id} />)}
      {ids.length ? (
        <ol className="ved__refs">
          {ids.map((id) => {
            const p = by.get(id);
            return (
              <li key={id} className={p ? '' : 'is-missing'}>
                <span>{p?.img ? <img src={'/' + p.img.replace(/^\//, '')} alt="" /> : null}</span>
                <b>{p?.name ?? id}</b>
                {p ? null : <small>غير موجود</small>}
              </li>
            );
          })}
        </ol>
      ) : <p className="field__hint" style={{ marginTop: 0 }}>لم تُختر منتجات بعد — القسم فارغ في الصفحة.</p>}
      <button type="button" className="btn btn--sm" onClick={onOpen}>
        {ids.length ? 'غيّر المنتجات' : 'اختر المنتجات'}
      </button>
    </div>
  );
}

export function VisualEditor({
  slug, title, template, published, hero, sections: initialSections, version: initialVersion, schema, addable, blanks, save, pages, products,
  nav: initialNav, theme: initialTheme, createPage, setPublished,
}: {
  /** ألوان الموقع وخطوطه المحفوظة */
  theme: Theme;
  /** صفحة جديدة تحت هذه الصفحة — يعيد مسارها أو سبب التعذّر */
  createPage: (v: { ar: string; en: string; start: NewPageStart }) => Promise<{ ok: true; slug: string } | { ok: false; error: string }>;
  /** نشر الصفحة أو سحبها من النشر */
  setPublished: (flag: boolean) => Promise<{ ok: boolean }>;
  /** صفوف المنيو العلوي كلها (المخفي منها أيضًا) */
  nav: NavRow[];
  slug: string; title: string; template: string; published: boolean;
  /** المنتجات لاختيار كروت المنتجات ووجهات الروابط */
  products: PickProduct[];
  /** صفحات أخرى يُتنقَّل إليها من الشريط العلوي دون الخروج من المحرّر */
  pages: { slug: string; title: string }[];
  hero: any; sections: EdSection[]; version: string;
  schema: Record<string, TypeSpec>;
  addable: { type: string; label: string; hint: string }[];
  blanks: Record<string, any>;
  save: (payload: string) => Promise<SaveResult>;
}) {
  /* ------------------------------------------------------------ الحالة */
  const [state, setState] = useState<State>({ hero, sections: initialSections, nav: initialNav, theme: initialTheme });
  const [saved, setSaved] = useState<string>(() => JSON.stringify({ hero, sections: initialSections, nav: initialNav, theme: initialTheme }));
  /** لوحة القسم المختار: حقوله، أو تصميمه */
  const [tab, setTab] = useState<'content' | 'design'>('content');
  const [version, setVersion] = useState(initialVersion);
  const [sel, setSel] = useState<Sel>(null);
  const [formRev, setFormRev] = useState(0);        // يُعيد رسم الحقول بقيمها بعد تراجع أو حفظ
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  /* حقول أعلى الصفحة تتبع الجهاز المعروض: للهيرو صورتان — عريضة للشاشة
     الواسعة وقَصّة طولية للهاتف — وكان يظهران معًا بالترتيب نفسه مهما كان
     المعروض، فيعدّل المحرّر صورةً لا يراها أمامه ويظنّها لم تتغيّر.

     فتتقدّم صورة الجهاز المعروض ويُكتب على اسمها أنها هي المعروضة الآن.
     ولا تُخفى الأخرى: تبديل الصورتين في مكان واحد أوضح من البحث عنهما. */
  const heroFields = useMemo(() => {
    const mob = device === 'mobile';
    const now = ' — المعروضة الآن';
    const named = HERO_FIELDS.map((f) =>
      f.name === 'img' ? { ...f, label: `صورة الشاشة الواسعة${mob ? '' : now}` }
        : f.name === 'imgMobile' ? { ...f, label: `صورة الهاتف${mob ? now : ''}` }
          : f);
    if (!mob) return named;
    const a = named.findIndex((f) => f.name === 'img');
    const b = named.findIndex((f) => f.name === 'imgMobile');
    if (a < 0 || b < 0) return named;
    const out = [...named];
    [out[a], out[b]] = [out[b], out[a]];
    return out;
  }, [device]);
  /* الحاسب يُعرض بعرض حاسب حقيقي (1280) مصغَّرًا ليسع المساحة — كما في محرّر
     Shopify — لا بعرض المساحة نفسها: المساحة أضيق من حدّ تصميم الحاسب، فكان
     الموقع يرسم نسخة الهاتف (المنيو المطويّ) ويخفي ما يُراد تعديله. */
  const DESKTOP_W = 1280;
  const stageRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, width: 0, height: 0 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (device === 'desktop' && w > 0 && w < DESKTOP_W) {
        const scale = w / DESKTOP_W;
        setFit({ scale, width: DESKTOP_W, height: Math.round(h / scale) });
      } else setFit({ scale: 1, width: 0, height: 0 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device]);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [picker, setPicker] = useState(false);
  /** موضع القسم الجديد: بعد هذا الموضع في القائمة (-1 = أول الصفحة). null = بعد المختار أو في الآخر */
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ id: number; over?: number; after?: boolean } | null>(null);
  /* نوافذ الاختيار التي تفتحها أدوات الصفحة */
  const [imgPick, setImgPick] = useState<{ id: CanvasId; path: string } | null>(null);
  const [linkEdit, setLinkEdit] = useState<{ id: CanvasId; path: string; value: string } | null>(null);
  const [prodPick, setProdPick] = useState<{ id: number; field: string } | null>(null);
  /** «+ صور للمعرض» من الصفحة: اختيار عدّة صور تُضاف إلى قائمة صور القسم */
  const [galPick, setGalPick] = useState<{ id: number; field: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [isPub, setIsPub] = useState(published);
  const [reloadN, setReloadN] = useState(0);         // إعادة رسم المعاينة بلا تغيير في الحالة
  const productTabOpen = useRef(false);
  const [newPage, setNewPage] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean; conflict?: boolean } | null>(null);

  const dirty = useMemo(() => JSON.stringify(state) !== saved, [state, saved]);
  const changedCount = useMemo(() => {
    const before = JSON.parse(saved) as State;
    const ids = new Set(before.sections.map((s) => s.id));
    let n = JSON.stringify(before.hero) !== JSON.stringify(state.hero) ? 1 : 0;
    if (JSON.stringify(before.nav) !== JSON.stringify(state.nav)) n++;
    if (JSON.stringify(before.theme) !== JSON.stringify(state.theme)) n++;
    for (const s of state.sections) {
      const b = before.sections.find((x) => x.id === s.id);
      if (!b || JSON.stringify(b) !== JSON.stringify(s)) n++;
    }
    n += [...ids].filter((id) => !state.sections.some((s) => s.id === id)).length;
    if (before.sections.map((s) => s.id).join() !== state.sections.filter((s) => ids.has(s.id)).map((s) => s.id).join()) n++;
    return n;
  }, [state, saved]);

  /* ------------------------------------------------------ التراجع والإعادة
     كل تغيير خطوة، والكتابة المتواصلة في حقل واحد خطوة واحدة. */
  const hist = useRef<{ list: State[]; at: number; last: number; key: string }>({
    list: [{ hero, sections: initialSections, nav: initialNav, theme: initialTheme }], at: 0, last: 0, key: '',
  });
  const [, bump] = useState(0);
  /* كتابة داخل الصفحة نفسها: الصفحة تعرض النصّ الجديد فعلًا، فإعادة تحميلها
     مع كل حرف كانت ستقطع الكتابة. تُحدَّث المعاينة المخزّنة بلا إعادة تحميل. */
  const quiet = useRef(false);
  const commit = useCallback((next: State, key = '') => {
    quiet.current = key.startsWith('inline:');
    const h = hist.current;
    const now = Date.now();
    if (key && key === h.key && now - h.last < 900) {
      h.list[h.at] = next;
    } else {
      h.list = [...h.list.slice(0, h.at + 1), next].slice(-80);
      h.at = h.list.length - 1;
    }
    h.last = now; h.key = key;
    setState(next);
    bump((x) => x + 1);
  }, []);
  const jump = (d: number) => {
    const h = hist.current;
    const at = h.at + d;
    if (at < 0 || at >= h.list.length) return;
    h.at = at; h.key = '';
    quiet.current = false;
    setState(h.list[at]);
    setFormRev((r) => r + 1);
    bump((x) => x + 1);
  };

  /* ------------------------------------------------------- قراءة الحقول */
  const formRef = useRef<HTMLFormElement>(null);
  const lastSer = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  /** يقرأ الحقول الآن، ويعيد الحالة بعدها. يُستدعى دوريًا، وقبل الحفظ مباشرةً
      كي لا تضيع آخر حروف كُتبت قبل الضغط بأقل من نصف ثانية. */
  const flush = useCallback((): State => {
    const cur = stateRef.current;
    const form = formRef.current;
    if (!form || sel == null || sel === 'theme' || sel === 'nav') return cur;
    const ser = serialize(form);
    if (lastSer.current == null) { lastSer.current = ser; return cur; }
    if (ser === lastSer.current) return cur;
    lastSer.current = ser;
    const fd = new FormData(form);
    let next: State;
    if (sel === 'hero') {
      next = { ...cur, hero: contentFromForm(fd, HERO_FIELDS, cur.hero) };
    } else {
      const s = cur.sections.find((x) => x.id === sel);
      const spec = s ? schema[s.type] : null;
      if (!s || !spec) return cur;
      const content = contentFromForm(fd, spec.fields, s.content);
      next = { ...cur, sections: cur.sections.map((x) => (x.id === sel ? { ...x, content } : x)) };
    }
    stateRef.current = next;
    commit(next, sel === 'hero' ? 'hero' : `s${sel}`);
    return next;
  }, [sel, schema, commit]);

  /* الأساس يُقرأ فور رسم الحقول وقبل أن يتمكّن أحد من الكتابة فيها، فكل ما
     يُكتب بعدها تغيير — حتى لو كُتب في أول جزء من الثانية. (useLayoutEffect
     يعمل بعد بناء العناصر وقبل أن تظهر.) القيم الأولى كلها من defaultValue
     والحالة الابتدائية، فهي موجودة في هذه اللحظة. */
  useLayoutEffect(() => {
    lastSer.current = formRef.current ? serialize(formRef.current) : null;
  }, [sel, formRev]);

  useEffect(() => {
    const t = setInterval(flush, 450);
    return () => clearInterval(t);
  }, [flush, formRev]);

  /* ---------------------------------------------------- المعاينة الحيّة */
  const frames = [useRef<HTMLIFrameElement>(null), useRef<HTMLIFrameElement>(null)];
  const [front, setFront] = useState(0);
  const frontRef = useRef(0);
  frontRef.current = front;
  const token = useRef<string | undefined>(undefined);
  const seq = useRef(0);
  const [loading, setLoading] = useState(true);
  const selRef = useRef<Sel>(sel);
  selRef.current = sel;

  /* المستمعات تُركَّب فور التحميل (لا تغيّر الصفحة، وتمنع الروابط من أول
     ضغطة)، أما الأنماط والتحديد فبعد أن يُكمل React تجهيز الصفحة — تغيير
     عناصرها قبله يربكه. */
  const paint = useCallback((frame: HTMLIFrameElement) => {
    const doc = frame.contentDocument;
    if (!doc || doc.getElementById('ux-editor-style')) return;
    const st = doc.createElement('style');
    st.id = 'ux-editor-style';
    st.textContent = `
      html{scroll-behavior:auto!important}
      .ux-hov{outline:2px dashed rgba(194,65,12,.7)!important;outline-offset:-2px}
      .ux-sel{outline:3px solid #c2410c!important;outline-offset:-3px}
      .ux-contact-dock{display:none!important}
      [data-ux-path]{cursor:text;border-radius:3px;transition:outline-color .12s}
      [data-ux-path]:hover{outline:1.5px dashed rgba(194,65,12,.75)!important;outline-offset:3px}
      [data-ux-path]:focus{outline:2px solid #c2410c!important;outline-offset:3px;caret-color:#c2410c}
      @media (max-width:480px){html{scrollbar-width:none}html::-webkit-scrollbar{display:none}}`;
    doc.head.appendChild(st);
    installCanvas(doc, () => apiRef.current);
  }, []);

  const decorate = useCallback((frame: HTMLIFrameElement) => {
    const doc = frame.contentDocument;
    if (doc) guardCanvas(doc, () => apiRef.current);
  }, []);

  const highlight = useCallback((frame: HTMLIFrameElement | null, scroll: boolean) => {
    const doc = frame?.contentDocument;
    if (!doc || !doc.getElementById('ux-editor-style')) return;   // لم تُجهَّز بعد
    doc.querySelectorAll('.ux-sel').forEach((n) => n.classList.remove('ux-sel'));
    const s = selRef.current;
    if (s == null) return;
    const mark = doc.getElementById(`ux-sec-${s}`);
    const el = mark?.nextElementSibling as HTMLElement | null;
    if (!el) return;
    el.classList.add('ux-sel');
    if (scroll) {
      const r = el.getBoundingClientRect();
      const vh = frame!.contentWindow!.innerHeight;
      if (r.top < 0 || r.top > vh * 0.6) el.scrollIntoView({ block: 'start' });
    }
  }, []);

  /* إرسال الحالة بعد توقّف قصير، ثم تحميلها في الإطار الخفيّ */
  useEffect(() => {
    const t = setTimeout(async () => {
      const my = ++seq.current;
      setLoading(true);
      try {
        const r = await fetch('/api/admin/preview', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, token: token.current, rev: my, ...state }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? 'تعذّرت المعاينة');
        token.current = j.token;
        if (my !== seq.current) return;               // جاءت حالة أحدث أثناء الإرسال
        /* كتابة داخل الصفحة: النصّ ظاهر فيها بالفعل، فتكفي المعاينة المخزّنة */
        if (quiet.current) { setLoading(false); return; }
        const back = frames[1 - frontRef.current].current!;
        back.dataset.seq = String(my);
        back.src = `/${slug === 'index' ? '' : `${slug}.html`}?lang=${lang}&preview=${j.token}&v=${my}`;
      } catch (e: any) {
        setNote({ text: e.message ?? 'تعذّرت المعاينة', bad: true });
        setLoading(false);
      }
    }, quiet.current ? 700 : 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lang, slug, reloadN]);

  /* بعد تعديل منتج في نافذة أخرى: العودة إلى المحرّر تعيد رسم المعاينة، فيظهر
     اسم الكارت ووصفه وصورته الجديدة دون تحديث الصفحة وضياع ما لم يُحفظ. */
  useEffect(() => {
    const back = () => {
      if (!productTabOpen.current) return;
      productTabOpen.current = false;
      quiet.current = false;
      setReloadN((n) => n + 1);
    };
    window.addEventListener('focus', back);
    return () => window.removeEventListener('focus', back);
  }, []);

  const onFrameLoad = (i: number) => () => {
    const frame = frames[i].current!;
    if (i === frontRef.current || Number(frame.dataset.seq) !== seq.current) return;
    const old = frames[frontRef.current].current;
    const y = old?.contentWindow?.scrollY ?? 0;
    decorate(frame);
    frame.contentWindow?.scrollTo(0, y);
    setFront(i);
    setLoading(false);
    setTimeout(() => {
      if (frames[frontRef.current].current !== frame) return;
      paint(frame);
      highlight(frame, false);
    }, 600);
  };

  useEffect(() => { highlight(frames[front].current, true); }, [sel, front, highlight]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------------------------------------------- عمليات الأقسام */
  /* الأفعال تقرأ الحالة من stateRef لا من state: أدوات الصفحة تستدعيها من
     مستمعات رُكّبت مع تحميل سابق، وقد تأتي بعد كتابة لم يُرسم أثرها بعد. */
  const sections = state.sections;
  const move = (id: number, d: number) => {
    const cur = stateRef.current;
    const i = cur.sections.findIndex((s) => s.id === id);
    const j = i + d;
    if (i < 0 || j < 0 || j >= cur.sections.length) return;
    const next = [...cur.sections];
    [next[i], next[j]] = [next[j], next[i]];
    commit({ ...cur, sections: next });
  };
  const toggle = (id: number) => {
    const cur = stateRef.current;
    commit({ ...cur, sections: cur.sections.map((s) => (s.id === id ? { ...s, published: s.published ? 0 : 1 } : s)) });
  };
  const remove = (id: number) => {
    const cur = stateRef.current;
    const s = cur.sections.find((x) => x.id === id);
    if (!s || !confirm(`حذف قسم «${titleOf(s, schema)}»؟\n\nلن يُحذف من الموقع إلا بعد «احفظ»، وتقدر تتراجع قبلها.`)) return;
    commit({ ...cur, sections: cur.sections.filter((x) => x.id !== id) });
    if (selRef.current === id) setSel(null);
  };
  const add = (type: string) => {
    const id = newId();
    /* الموضع: حيث ضُغط «أضف قسمًا هنا»، أو تحت المختار، أو في الآخر */
    const at = insertAt != null ? insertAt + 1
      : typeof sel === 'number' ? sections.findIndex((s) => s.id === sel) + 1 : sections.length;
    const s: EdSection = { id, type, anchor: null, published: 1, content: structuredClone(blanks[type] ?? {}) };
    const next = [...sections];
    next.splice(at < 0 || at > sections.length ? sections.length : at, 0, s);
    commit({ ...state, sections: next });
    setPicker(false);
    setInsertAt(null);
    setSel(id);
    setFormRev((r) => r + 1);
  };
  /** نسخة من القسم تحته مباشرةً، بمحتواه كله — أسرع طريق لقسم يشبه قسمًا موجودًا. */
  const duplicate = (id: number) => {
    const cur = stateRef.current;
    const i = cur.sections.findIndex((s) => s.id === id);
    if (i < 0) return;
    const copy: EdSection = { ...structuredClone(cur.sections[i]), id: newId(), anchor: null };
    const next = [...cur.sections];
    next.splice(i + 1, 0, copy);
    commit({ ...cur, sections: next });
    setSel(copy.id);
    setFormRev((r) => r + 1);
  };
  /** سحب وإفلات في القائمة: ينقل القسم قبل أو بعد قسم آخر. */
  const dropOn = (targetId: number, after: boolean) => {
    if (!drag || drag.id === targetId) return;
    const moving = sections.find((s) => s.id === drag.id);
    if (!moving) return;
    const rest = sections.filter((s) => s.id !== drag.id);
    const at = rest.findIndex((s) => s.id === targetId) + (after ? 1 : 0);
    rest.splice(at, 0, moving);
    commit({ ...state, sections: rest });
  };
  const remountT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* ---- الهيدر كـ«محتوى»: أدوات الصفحة تقرأ المحتوى وتكتب فيه بمسارات منقوطة.
     للهيدر يُبنى محتوى من صفوف المنيو (rows.<id>.label.ar …)، ويُترجم المسار
     عند الكتابة إلى عمود الصفّ. الاسم العربي الفارغ يُعرض بالإنجليزي كما في
     الموقع، فيطابق ما يُرى. */
  const navContent = (rows: NavRow[]) => ({
    rows: Object.fromEntries(rows.map((r) => [r.id, {
      label: { ar: r.label_ar || r.label_en, en: r.label_en },
      href: r.href ?? '',
      ...(r.desc_ar || r.desc_en ? { desc: { ar: r.desc_ar ?? '', en: r.desc_en ?? '' } } : {}),
    }])),
  });
  const NAV_COL: Record<string, keyof NavRow> = {
    'label.ar': 'label_ar', 'label.en': 'label_en', href: 'href', 'desc.ar': 'desc_ar', 'desc.en': 'desc_en',
  };
  /** يضع القيمة في مكانها: محتوى قسم، أو أعلى الصفحة، أو صفّ في المنيو. */
  const applyAt = (cur: State, id: CanvasId, path: string, value: unknown): State => {
    if (id === 'hero') return { ...cur, hero: setPath(cur.hero, path, value) };
    if (id === 'nav') {
      const [, rowId, ...rest] = path.split('.');
      const col = NAV_COL[rest.join('.')];
      if (!col) return cur;
      return { ...cur, nav: cur.nav.map((r) => (r.id === Number(rowId) ? { ...r, [col]: value } : r)) };
    }
    return { ...cur, sections: cur.sections.map((s) => (s.id === id ? { ...s, content: setPath(s.content, path, value) } : s)) };
  };
  const contentFor = (id: CanvasId) =>
    id === 'hero' ? stateRef.current.hero
      : id === 'nav' ? navContent(stateRef.current.nav)
      : stateRef.current.sections.find((s) => s.id === id)?.content;

  /** كتابة في نصّ داخل الصفحة: تُحدَّث الحالة دون إعادة رسم الصفحة. */
  const inline = (id: CanvasId, path: string, value: string) => {
    const next = applyAt(stateRef.current, id, path, value);
    stateRef.current = next;
    commit(next, `inline:${id}:${path}`);
    if (selRef.current !== id) setSel(id);
    /* الحقول الجانبية تُعاد رسمها بعد توقّف قصير عن الكتابة — لا تنتظر
       مغادرة النصّ، فقد ينتقل المؤشّر إلى القائمة دون أن تُبلغ الصفحة بذلك،
       وحقل جانبي قديم كان سيكتب فوق ما كُتب في الصفحة. إعادة رسمها لا تمسّ
       المؤشّر داخل الصفحة. */
    clearTimeout(remountT.current);
    remountT.current = setTimeout(() => setFormRev((r) => r + 1), 400);
  };

  /** يضع قيمة في مسار داخل محتوى قسم أو أعلى الصفحة، كخطوة تُعاد معها المعاينة. */
  const setValue = (id: CanvasId, path: string, value: unknown) => {
    const next = applyAt(stateRef.current, id, path, value);
    stateRef.current = next;
    commit(next);
    setFormRev((r) => r + 1);
  };
  /** تصميم قسم أو أعلى الصفحة (lib/design.ts). تحريك المنزلقة خطوة واحدة في التراجع. */
  const setDesign = (id: number | 'hero', patch: Patch<Design>) => {
    const cur = stateRef.current;
    /* على أحدث نسخة (stateRef) لا على ما رُسم آخر مرة: ضغطات متتالية سريعة لا يضيع منها شيء */
    const put = (c: any) => {
      const o = { ...(c ?? {}) };
      const d = applyPatch<Design>(o.design ?? {}, patch);
      if (Object.keys(d).length) o.design = d; else delete o.design;
      return o;
    };
    const next = id === 'hero' ? { ...cur, hero: put(cur.hero) }
      : { ...cur, sections: cur.sections.map((s) => (s.id === id ? { ...s, content: put(s.content) } : s)) };
    stateRef.current = next;
    commit(next, `design:${id}`);
  };
  /* ------------------------------------------------ الرجوع إلى المحفوظ
     لقسم واحد، أو لأعلى الصفحة، أو للهيدر، أو للألوان، أو للكل. خطوة في سجل
     التراجع كأي تعديل، فـ Ctrl+Z يعيد ما أُلغي. */
  const savedState = () => JSON.parse(saved) as State;
  const revert = (what: 'all' | 'hero' | 'nav' | 'theme' | number) => {
    const sv = savedState();
    const cur = stateRef.current;
    let next: State;
    if (what === 'all') next = sv;
    else if (what === 'hero') next = { ...cur, hero: sv.hero };
    else if (what === 'nav') next = { ...cur, nav: sv.nav };
    else if (what === 'theme') next = { ...cur, theme: sv.theme };
    else {
      const old = sv.sections.find((s) => s.id === what);
      if (!old) return;
      next = { ...cur, sections: cur.sections.map((s) => (s.id === what ? old : s)) };
    }
    stateRef.current = next;
    commit(next);
    setFormRev((r) => r + 1);
  };
  /** هل تغيّر هذا الجزء عن المحفوظ؟ (يظهر زرّ الرجوع حينها فقط) */
  const changedFrom = (what: 'hero' | 'nav' | 'theme' | number) => {
    const sv = savedState();
    if (typeof what === 'number') {
      const old = sv.sections.find((s) => s.id === what);
      return Boolean(old) && JSON.stringify(old) !== JSON.stringify(state.sections.find((s) => s.id === what));
    }
    return JSON.stringify(sv[what]) !== JSON.stringify(state[what]);
  };
  const setTheme = (patch: Patch<Theme>) => {
    const next = { ...stateRef.current, theme: applyPatch<Theme>(stateRef.current.theme, patch) };
    stateRef.current = next;
    commit(next, 'theme');
  };
  /** وجهة جديدة لزرّ «اعرض المعدة»: منتج آخر يبقى ربطًا بمنتج، وأيّ وجهة
   *  أخرى تجعله زرًّا عاديًّا (cta) بالنصّ نفسه — كما في «مكانس الطرق». */
  const productLink = (id: number, href: string) => {
    const cur = stateRef.current;
    const next = { ...cur, sections: cur.sections.map((s) => {
      if (s.id !== id) return s;
      const c = { ...s.content };
      const m = /^model\.html\?p=([^&#]+)$/.exec(href);
      if (m) c.product = decodeURIComponent(m[1]);
      else {
        delete c.product;
        c.cta = href ? { href, label: c.cta?.label?.ar || c.cta?.label?.en ? c.cta.label : { ar: 'اعرض المعدة', en: 'See the equipment' } } : undefined;
        if (!c.cta) delete c.cta;
      }
      return { ...s, content: c };
    }) };
    stateRef.current = next;
    commit(next);
    setFormRev((r) => r + 1);
  };
  /** عنصر في قائمة داخل قسم (كارت، بند، خطوة): تكرار، تقديم، تأخير، حذف. */
  const itemAct = (id: number, field: string, index: number, act: ItemAct) => {
    const s = stateRef.current.sections.find((x) => x.id === id);
    const list = Array.isArray(s?.content?.[field]) ? [...s!.content[field]] : null;
    if (!list || index < 0 || index >= list.length) return;
    if (act === 'dup') list.splice(index + 1, 0, structuredClone(list[index]));
    if (act === 'del') {
      if (!confirm(`حذف العنصر ${index + 1}؟ تقدر تتراجع قبل الحفظ.`)) return;
      list.splice(index, 1);
    }
    if (act === 'up' || act === 'down') {
      const j = index + (act === 'up' ? -1 : 1);
      if (j < 0 || j >= list.length) return;
      [list[index], list[j]] = [list[j], list[index]];
    }
    setValue(id, field, list);
    setSel(id);
  };

  /* ما تستدعيه أدوات الصفحة (editorCanvas). يُحدَّث مع كل رسم، فتصل الأدوات
     دائمًا إلى أحدث حالة وأحدث أفعال. */
  const apiRef = useRef<CanvasApi>(null as unknown as CanvasApi);
  apiRef.current = {
    select: (id) => setSel(id),
    move, toggle, remove, duplicate,
    insertAfter: (id) => {
      setInsertAt(id === 'hero' ? -1 : sections.findIndex((s) => s.id === id));
      setPicker(true);
    },
    inline,
    /* انتهت الكتابة في الصفحة: الحقول الجانبية تُعاد رسمها بالقيم الجديدة،
       كي لا تكتب الكتابة القادمة فيها فوق ما كُتب في الصفحة. */
    inlineEnd: () => setFormRev((r) => r + 1),
    pickImage: (id, path) => { setSel(id); setImgPick({ id, path }); },
    itemAct,
    editLink: (id, path) => {
      const value = path === PRODUCT_LINK ? `model.html?p=${contentFor(id)?.product ?? ''}`
        : path.split('.').reduce((n: any, k) => (n == null ? n : n[k]), contentFor(id));
      setSel(id);
      setLinkEdit({ id, path, value: typeof value === 'string' ? value : '' });
    },
    openDesign: (id) => { if (id !== 'nav') { setSel(id); setTab('design'); } },
    designOf: (id) => (id === 'hero' ? stateRef.current.hero?.design
      : id === 'nav' ? undefined : stateRef.current.sections.find((s) => s.id === id)?.content?.design),
    patchDesign: (id, patch) => { if (id !== 'nav') setDesign(id, patch as Patch<Design>); },
    addImages: (id, field) => { if (typeof id === 'number') { setSel(id); setTab('content'); setGalPick({ id, field }); } },
    /* شريط التنسيق في الصفحة: لون عناوين القسم أو نصّه، وحجمه، وسُمك العنوان */
    styleText: (id, role, s) => {
      if (id === 'nav') return;
      /* ↺ في شريط التنسيق: ألوان هذا النوع من النص وحجمه كما في تصميم الموقع */
      if (s === null) {
        setDesign(id, role === 'title'
          ? { title: undefined, titleSize: undefined, titleWeight: undefined, font: undefined }
          : { text: undefined, textSize: undefined });
        return;
      }
      const patch: Patch<Design> = {};
      if (s.color) patch[role === 'title' ? 'title' : 'text'] = s.color;
      if (s.size != null) patch[role === 'title' ? 'titleSize' : 'textSize'] = s.size;
      if (s.weight != null && role === 'title') patch.titleWeight = s.weight;
      setDesign(id, patch);
    },
    productRef: (pslug) => products.find((p) => p.slug === pslug || p.ref === pslug)?.ref ?? null,
    /* في نافذة جديدة: ما لم يُحفظ هنا يبقى كما هو */
    editProduct: (pslug) => {
      productTabOpen.current = true;
      window.open(`/admin/products/${encodeURIComponent(pslug)}`, '_blank', 'noopener');
    },
    pickProducts: (id) => {
      const s = stateRef.current.sections.find((x) => x.id === id);
      const f = s ? schema[s.type]?.fields.find((x) => x.kind === 'refs') : null;
      if (f) { setSel(id); setProdPick({ id, field: f.name }); }
    },
    fieldsOf: (id) => (id === 'hero' ? HERO_FIELDS : id === 'nav' ? []
      : schema[stateRef.current.sections.find((s) => s.id === id)?.type ?? '']?.fields ?? []),
    typeOf: (id) => (typeof id !== 'number' ? id : stateRef.current.sections.find((s) => s.id === id)?.type ?? ''),
    contentOf: contentFor,
    labelOf: (id) => {
      if (id === 'hero') return 'أعلى الصفحة';
      if (id === 'nav') return 'الهيدر — مشترك بين كل الصفحات';
      const s = stateRef.current.sections.find((x) => x.id === id);
      return s ? titleOf(s, schema) : '';
    },
    posOf: (id) => {
      const list = stateRef.current.sections;
      const i = list.findIndex((s) => s.id === id);
      return { index: i, count: list.length, hidden: !list[i]?.published };
    },
    lang,
  };

  /* -------------------------------------------------------------- الحفظ */
  const doSave = async (): Promise<boolean> => {
    setBusy(true); setNote(null);
    const latest = flush();
    const r = await save(JSON.stringify({ version, ...latest }));
    setBusy(false);
    if (!r.ok) {
      setNote(r.error === 'conflict'
        ? { text: 'الصفحة اتعدّلت من مكان تاني بعد ما فتحت المحرّر، فالحفظ اتوقف عشان ميمسحش التعديل ده.', bad: true, conflict: true }
        : { text: r.error, bad: true });
      return false;
    }
    const next = { hero: r.hero, sections: r.sections, nav: r.nav, theme: r.theme };
    /* الأقسام الجديدة صار لها معرّفات حقيقية؛ القسم المختار يتبعها بموضعه */
    if (typeof sel === 'number' && sel < 0) {
      const i = latest.sections.findIndex((s) => s.id === sel);
      setSel(r.sections[i]?.id ?? null);
    }
    setState(next);
    setSaved(JSON.stringify(next));
    setVersion(r.version);
    hist.current = { list: [next], at: 0, last: 0, key: '' };
    setFormRev((x) => x + 1);
    setNote({ text: isPub ? 'اتحفظ — الزائر يشوف التعديلات دلوقتي.' : 'اتحفظ — الصفحة لسه مسوّدة، اضغط «انشر» لما تخلص.' });
    return true;
  };

  /** النشر يحفظ ما لم يُحفظ أولًا: الزائر يرى المحفوظ وحده. */
  const togglePublish = async () => {
    const flag = !isPub;
    if (!flag && !confirm('سحب الصفحة من النشر؟ الزائر مش هيقدر يفتحها لحد ما تنشرها تاني.')) return;
    if (flag && JSON.stringify(flush()) !== savedRef.current && !(await doSave())) return;
    setBusy(true);
    const r = await setPublished(flag);
    setBusy(false);
    if (r.ok) {
      setIsPub(flag);
      setNote({ text: flag ? 'اتنشرت — الزائر يقدر يفتحها دلوقتي. اربطها من المنيو أو من زرّ في صفحة تانية.' : 'اتسحبت من النشر — رجعت مسوّدة.' });
    }
  };

  const doCreate = async (v: { ar: string; en: string; start: NewPageStart }) => {
    if (JSON.stringify(flush()) !== savedRef.current
        && !confirm('في تعديلات هنا لسه ما اتحفظتش. تسيبها وتفتح الصفحة الجديدة؟')) return 'احفظ تعديلاتك الأول، وبعدين أنشئ الصفحة.';
    const r = await createPage(v);
    if (!r.ok) return r.error;
    leaving.current = true;
    location.href = `/admin/edit/${r.slug}`;
    return null;
  };

  /* التحذير يقرأ الحقول لحظة الخروج نفسها: حروف كُتبت قبل أقل من نصف ثانية
     لم تصل إلى الحالة بعد، ويجب أن تُعدّ تعديلًا غير محفوظ. */
  const leaving = useRef(false);
  const savedRef = useRef(saved);
  savedRef.current = saved;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (leaving.current) return;
      if (JSON.stringify(flush()) !== savedRef.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [flush]);

  /* اختصارات: Ctrl+Z تراجع، Ctrl+Y أو Ctrl+Shift+Z إعادة، Ctrl+S حفظ —
     خارج حقول الكتابة، كي لا تتعارض مع تراجع المتصفح داخل الحقل. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); if (dirty && !busy) void doSave(); return; }
      const typing = (e.target as HTMLElement)?.closest?.('input, textarea, select');
      if (typing) return;
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); jump(-1); }
      if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); jump(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ------------------------------------------------------------- العرض */
  if (!EDITABLE_TEMPLATES.includes(template)) {
    return (
      <div className="ved-unsupported">
        <h1>المحرّر المرئي لصفحات المحتوى</h1>
        <p>هذه الصفحة لها شكل خاص (الرئيسية، المنتج، الكتالوج، أو نموذج السعر)، وتُعدَّل الآن من محرّرها المعتاد.</p>
        <a className="btn" href={`/admin/pages/${slug}`}>افتح محرّر الصفحة</a>
      </div>
    );
  }

  const current = typeof sel === 'number' ? sections.find((s) => s.id === sel) : null;
  const spec = current ? schema[current.type] : null;
  const h = hist.current;

  /* المرور على قسم في القائمة يضيئه في الصفحة، فيُعرف أيّ قسم هو قبل فتحه */
  const peek = (id: Sel) => {
    const doc = frames[front].current?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('.ux-hov').forEach((n) => n.classList.remove('ux-hov'));
    if (id == null) return;
    (doc.getElementById(`ux-sec-${id}`)?.nextElementSibling as HTMLElement | null)?.classList.add('ux-hov');
  };

  return (
    <div className="ved">
      <header className="ved__top">
        <div className="ved__start">
          <a className="ved__iconbtn ved__back" href={`/admin/pages/${slug}`} title="ارجع لإعدادات الصفحة">
            <Ico name="back" />
          </a>
          <div className="ved__name">
            {/* التنقّل بين الصفحات من المحرّر نفسه، كما في محرّرات المتاجر */}
            <label className="ved__page">
              <span className="sr-only">الصفحة</span>
              <select value={slug} aria-label="اختر صفحة لتعديلها"
                      onChange={(e) => { location.href = `/admin/edit/${e.target.value}`; }}>
                {pages.some((p) => p.slug === slug) ? null : <option value={slug}>{title}</option>}
                {pages.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
              </select>
            </label>
            <span className={`ved__state${dirty ? ' is-dirty' : ''}`}>
              <i />{dirty ? `${changedCount} تغيير لم يُحفظ` : 'كل شيء محفوظ'}
              <em className={isPub ? '' : 'is-draft'}>{isPub ? 'منشورة' : 'مسوّدة'}</em>
            </span>
          </div>
          <button type="button" className="ved__newpage" onClick={() => setNewPage(true)} title="صفحة جديدة تحت هذه الصفحة">
            <Ico name="plus" size={15} /> صفحة
          </button>
        </div>

        <div className="ved__mid">
          <div className="ved__seg" role="group" aria-label="حجم المعاينة">
            <button type="button" className={device === 'desktop' ? 'is-on' : ''} onClick={() => setDevice('desktop')} title="كمبيوتر"><Ico name="desktop" /></button>
            <button type="button" className={device === 'mobile' ? 'is-on' : ''} onClick={() => setDevice('mobile')} title="موبايل"><Ico name="mobile" /></button>
          </div>
          <div className="ved__seg" role="group" aria-label="لغة المعاينة">
            <button type="button" className={lang === 'ar' ? 'is-on' : ''} onClick={() => { quiet.current = false; setLang('ar'); }}>عربي</button>
            <button type="button" className={lang === 'en' ? 'is-on' : ''} onClick={() => { quiet.current = false; setLang('en'); }}>EN</button>
          </div>
        </div>

        <div className="ved__end">
          <button type="button" className="ved__iconbtn" onClick={() => jump(-1)} disabled={h.at === 0} title="تراجع (Ctrl+Z)"><Ico name="undo" /></button>
          <button type="button" className="ved__iconbtn" onClick={() => jump(1)} disabled={h.at >= h.list.length - 1} title="إعادة (Ctrl+Y)"><Ico name="redo" /></button>
          {dirty ? (
            <button type="button" className="ved__discard" title="الرجوع إلى آخر حفظ — Ctrl+Z يعيد ما أُلغي"
                    onClick={() => { if (confirm(`تجاهل كل التعديلات غير المحفوظة (${changedCount})؟\nتقدر ترجّعها بـ «تراجع» (Ctrl+Z).`)) revert('all'); }}>
              ↺ تجاهل كل التعديلات
            </button>
          ) : null}
          <a className="ved__iconbtn" href={`/${slug}.html?lang=${lang}`} target="_blank" rel="noopener" title="افتح الصفحة كما يراها الزائر"><Ico name="external" /></a>
          <button type="button" className={`ved__pub${isPub ? '' : ' is-draft'}`} onClick={togglePublish} disabled={busy}
                  title={isPub ? 'اسحب الصفحة من النشر' : 'احفظ وانشر الصفحة للزائر'}>
            <Ico name={isPub ? 'eyeOff' : 'globe'} size={16} /> {isPub ? 'إلغاء النشر' : 'انشر'}
          </button>
          <button type="button" className="ved__save" onClick={doSave} disabled={!dirty || busy}>
            {busy ? 'جارٍ الحفظ…' : dirty ? 'احفظ' : <><Ico name="check" size={16} /> محفوظ</>}
          </button>
        </div>
      </header>

      <aside className="ved__side">
        {note ? (
          <div className={`ved__note${note.bad ? ' is-bad' : ''}`}>
            <span>{note.text}</span>
            {note.conflict ? (
              <button type="button" className="btn btn--sm"
                      onClick={() => { if (confirm('هتفتح النسخة الحالية من الموقع، وهتضيع التعديلات اللي هنا. متأكد؟')) { leaving.current = true; location.reload(); } }}>
                افتح النسخة الحالية
              </button>
            ) : <button type="button" className="ved__x" onClick={() => setNote(null)} aria-label="إغلاق">×</button>}
          </div>
        ) : null}

        {sel == null ? (
          <>
            <div className="ved__head">
              <h2>أقسام الصفحة</h2>
              <p>اكتب في أي نصّ في الصفحة مباشرةً، أو اضغط قسمًا لكل حقوله. واسحب ⋮⋮ لترتيب الأقسام.</p>
            </div>
            <ul className="ved__list" onMouseLeave={() => peek(null)}>
              <li onMouseEnter={() => peek('nav')}>
                <button type="button" className="ved__item" onClick={() => setSel('nav')}>
                  <span className="ved__thumb ved__thumb--icon"><Ico name="menu" size={20} /></span>
                  <span className="ved__item-txt">
                    <span className="ved__item-t">الهيدر (المنيو)</span>
                    <small>أسماء العناصر وأماكنها وروابطها — لكل الصفحات</small>
                  </span>
                </button>
              </li>
              <li>
                <button type="button" className="ved__item" onClick={() => setSel('theme')}>
                  <span className="ved__thumb ved__thumb--icon ved__thumb--theme" aria-hidden="true">
                    <i style={{ background: state.theme.brand ?? '#F26522' }} /><i style={{ background: state.theme.navy ?? '#060B14' }} />
                  </span>
                  <span className="ved__item-txt">
                    <span className="ved__item-t">ألوان وخطوط الموقع</span>
                    <small>اللون الأساسي والداكن والخطوط — لكل الصفحات</small>
                  </span>
                </button>
              </li>
              {HERO_TEMPLATES.includes(template) ? (
                <li onMouseEnter={() => peek('hero')}>
                  <button type="button" className="ved__item" onClick={() => setSel('hero')}>
                    <span className="ved__thumb ved__thumb--icon"><Ico name="top" size={20} /></span>
                    <span className="ved__item-txt">
                      <span className="ved__item-t">أعلى الصفحة</span>
                      <small>الصورة الكبيرة والعنوان</small>
                    </span>
                  </button>
                </li>
              ) : null}
              {sections.map((s, i) => (
                <li key={s.id}
                    className={[
                      s.published ? '' : 'is-off',
                      drag?.id === s.id ? 'is-dragging' : '',
                      drag?.over === s.id ? (drag.after ? 'is-drop-after' : 'is-drop-before') : '',
                    ].join(' ')}
                    onMouseEnter={() => peek(s.id)}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(s.id)); setDrag({ id: s.id }); }}
                    onDragOver={(e) => {
                      if (!drag) return;
                      e.preventDefault();
                      const r = e.currentTarget.getBoundingClientRect();
                      const after = e.clientY > r.top + r.height / 2;
                      if (drag.over !== s.id || drag.after !== after) setDrag({ ...drag, over: s.id, after });
                    }}
                    onDrop={(e) => { e.preventDefault(); if (drag) dropOn(s.id, Boolean(drag.after)); setDrag(null); }}
                    onDragEnd={() => setDrag(null)}>
                  <span className="ved__grip" aria-hidden="true" title="اسحب لتغيير الترتيب">⋮⋮</span>
                  <button type="button" className="ved__item" onClick={() => setSel(s.id)}>
                    <span className="ved__thumb"><SectionShape type={s.type} /></span>
                    <span className="ved__item-txt">
                      <span className="ved__item-t">{titleOf(s, schema)}</span>
                      <small>
                        {schema[s.type]?.label ?? s.type}
                        {s.published ? null : <b className="ved__badge">مخفي</b>}
                        {s.id < 0 ? <b className="ved__badge ved__badge--new">جديد</b> : null}
                      </small>
                    </span>
                  </button>
                  <span className="ved__acts">
                    <button type="button" onClick={() => move(s.id, -1)} disabled={i === 0} title="لأعلى" aria-label="انقل لأعلى"><Ico name="up" size={16} /></button>
                    <button type="button" onClick={() => move(s.id, 1)} disabled={i === sections.length - 1} title="لأسفل" aria-label="انقل لأسفل"><Ico name="down" size={16} /></button>
                    <button type="button" onClick={() => duplicate(s.id)} title="كرّر القسم" aria-label="تكرار"><Ico name="dup" size={16} /></button>
                    <button type="button" onClick={() => toggle(s.id)} title={s.published ? 'أخفِه عن الزائر' : 'أظهره للزائر'} aria-label={s.published ? 'إخفاء' : 'إظهار'}>
                      <Ico name={s.published ? 'eye' : 'eyeOff'} size={16} />
                    </button>
                    <button type="button" onClick={() => remove(s.id)} title="احذفه" aria-label="حذف" className="is-bad"><Ico name="trash" size={16} /></button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="ved__addwrap">
              <button type="button" className="ved__add" onClick={() => { setInsertAt(null); setPicker(true); }}><Ico name="plus" size={16} /> أضف قسمًا</button>
            </div>
          </>
        ) : sel === 'theme' ? (
          <>
            <div className="ved__head ved__head--sel">
              <button type="button" className="ved__up" onClick={() => setSel(null)}><Ico name="back" size={16} /> كل الأقسام</button>
              <h2>ألوان وخطوط الموقع</h2>
              <span className="ved__chip">لكل صفحات الموقع</span>
              {changedFrom('theme') ? (
                <button type="button" className="ved__revert" onClick={() => revert('theme')}>↺ ارجع للمحفوظ</button>
              ) : null}
            </div>
            <div className="ved__form">
              <ThemePanel value={state.theme} onChange={setTheme} />
            </div>
          </>
        ) : sel === 'nav' ? (
          <>
            <div className="ved__head ved__head--sel">
              <button type="button" className="ved__up" onClick={() => setSel(null)}><Ico name="back" size={16} /> كل الأقسام</button>
              <h2>الهيدر (المنيو)</h2>
              <span className="ved__chip">مشترك بين كل الصفحات</span>
              {changedFrom('nav') ? (
                <button type="button" className="ved__revert" onClick={() => revert('nav')}>↺ ارجع للمحفوظ</button>
              ) : null}
            </div>
            <div className="ved__form">
              <NavPanel rows={state.nav} newId={newId}
                        onChange={(rows, key) => { const next = { ...stateRef.current, nav: rows }; stateRef.current = next; commit(next, key ?? ''); }}
                        onLink={(id) => apiRef.current.editLink('nav', `rows.${id}.href`)} />
            </div>
          </>
        ) : (
          <>
            <div className="ved__head ved__head--sel">
              <button type="button" className="ved__up" onClick={() => setSel(null)}><Ico name="back" size={16} /> كل الأقسام</button>
              <h2>{sel === 'hero' ? 'أعلى الصفحة' : current ? titleOf(current, schema) : ''}</h2>
              {current ? <span className="ved__chip">{spec?.label}</span> : <span className="ved__chip">الصورة الكبيرة والعنوان</span>}
              {(sel === 'hero' ? changedFrom('hero') : current ? changedFrom(current.id) : false) ? (
                <button type="button" className="ved__revert" title="نصوصه وصوره وتصميمه كما في آخر حفظ"
                        onClick={() => revert(sel === 'hero' ? 'hero' : current!.id)}>↺ ارجع للمحفوظ</button>
              ) : null}
              <div className="ved__tabs" role="tablist">
                <button type="button" role="tab" aria-selected={tab === 'content'} className={tab === 'content' ? 'is-on' : ''}
                        onClick={() => setTab('content')}><Ico name="pen" size={15} /> المحتوى</button>
                <button type="button" role="tab" aria-selected={tab === 'design'} className={tab === 'design' ? 'is-on' : ''}
                        onClick={() => setTab('design')}><Ico name="palette" size={15} /> التصميم
                  {(sel === 'hero' ? state.hero?.design : current?.content?.design) ? <i className="ved__dot" /> : null}
                </button>
              </div>
            </div>
            {tab === 'design' && (sel === 'hero' || current) ? (
              <div className="ved__form">
                <DesignPanel hero={sel === 'hero'}
                             value={sel === 'hero' ? state.hero?.design : current?.content?.design}
                             onChange={(d) => setDesign(sel === 'hero' ? 'hero' : current!.id, d)} />
              </div>
            ) : null}
            {/* الحقول تبقى مركّبة وإن خفيت: قراءتها الدورية لا تنقطع */}
            <form ref={formRef} key={`${sel}-${formRev}`} className="ved__form" onSubmit={(e) => e.preventDefault()}
                  hidden={tab === 'design'}>
              {sel === 'hero' ? (
                heroFields.map((f) => <FieldView key={f.name} f={f} name={f.name} value={state.hero?.[f.name]} />)
              ) : current && spec ? (
                <>
                  {spec.hint ? <p className="field__hint" style={{ marginTop: 0 }}>{spec.hint}</p> : null}
                  {spec.fields.filter((f) => !f.advanced).map((f) => (
                    current.type === 'heroSlider' && f.name === 'slides' ? (
                      <SlidesField key={f.name} name={f.name} value={current.content?.slides ?? []}
                                   tabs={current.content?.tabs ?? []} />
                    ) : f.kind === 'refs' ? (
                      <RefsField key={f.name} name={f.name} label={f.label} ids={current.content?.[f.name] ?? []}
                                 products={products} onOpen={() => setProdPick({ id: current.id, field: f.name })} />
                    ) : <FieldView key={f.name} f={f} name={f.name} value={current.content?.[f.name]} />
                  ))}
                  {spec.fields.some((f) => f.advanced) ? (
                    <details className="more">
                      <summary>خيارات إضافية</summary>
                      <div className="more__body">
                        {spec.fields.filter((f) => f.advanced).map((f) => (
                          <FieldView key={f.name} f={f} name={f.name} value={current.content?.[f.name]} />
                        ))}
                      </div>
                    </details>
                  ) : null}
                </>
              ) : <p className="empty">هذا القسم لا يُحرَّر من هنا.</p>}
            </form>
            {current ? (
              <div className="ved__foot">
                <button type="button" onClick={() => toggle(current.id)}>
                  <Ico name={current.published ? 'eyeOff' : 'eye'} size={16} /> {current.published ? 'أخفِه' : 'أظهره'}
                </button>
                <button type="button" onClick={() => duplicate(current.id)}><Ico name="dup" size={16} /> كرّره</button>
                <button type="button" onClick={() => { setInsertAt(null); setPicker(true); }}><Ico name="plus" size={16} /> قسم تحته</button>
                <button type="button" className="is-bad" onClick={() => remove(current.id)}><Ico name="trash" size={16} /> احذفه</button>
              </div>
            ) : null}
          </>
        )}
      </aside>

      <main className={`ved__canvas is-${device}`}>
        <div className="ved__stage" ref={stageRef}>
          {[0, 1].map((i) => (
            <iframe key={i} ref={frames[i]} title="معاينة الصفحة" onLoad={onFrameLoad(i)}
                    className={i === front ? 'is-front' : 'is-back'}
                    style={fit.scale < 1 ? {
                      width: `${fit.width}px`, height: `${fit.height}px`,
                      transform: `scale(${fit.scale})`, transformOrigin: 'top right',
                    } : undefined} />
          ))}
          <span className={`ved__loading${loading ? ' is-on' : ''}`} aria-live="polite">
            <i />{loading ? 'يحدّث المعاينة…' : ''}
          </span>
        </div>
      </main>

      {/* نوافذ الاختيار التي تفتحها الصفحة أو القائمة */}
      <MediaPicker open={Boolean(imgPick)} kind="image" onClose={() => setImgPick(null)}
                   onPick={(p) => { if (imgPick) setValue(imgPick.id, imgPick.path, p); setImgPick(null); }} />
      {newPage ? <NewPageDialog parent={title} onCreate={doCreate} onClose={() => setNewPage(false)} /> : null}
      {galPick ? (
        <MediaPicker open kind="image" onClose={() => setGalPick(null)} onPick={() => {}}
                     already={stateRef.current.sections.find((s) => s.id === galPick.id)?.content?.[galPick.field] ?? []}
                     onPickMany={(ps) => {
                       const cur = stateRef.current.sections.find((s) => s.id === galPick.id)?.content?.[galPick.field];
                       const list = Array.isArray(cur) ? cur : [];
                       setValue(galPick.id, galPick.field, [...list, ...ps.filter((p) => !list.includes(p))]);
                     }} />
      ) : null}
      {linkEdit ? (
        <LinkPicker value={linkEdit.value} pages={pages} products={products}
                    onClose={() => setLinkEdit(null)}
                    onDone={(href) => {
                      if (linkEdit.path === PRODUCT_LINK && typeof linkEdit.id === 'number') productLink(linkEdit.id, href);
                      else setValue(linkEdit.id, linkEdit.path, href);
                      setLinkEdit(null);
                    }} />
      ) : null}
      {prodPick ? (
        <ProductPicker products={products}
                       value={stateRef.current.sections.find((s) => s.id === prodPick.id)?.content?.[prodPick.field] ?? []}
                       onClose={() => setProdPick(null)}
                       onDone={(ids) => { setValue(prodPick.id, prodPick.field, ids); setProdPick(null); }} />
      ) : null}

      {picker ? (
        <div className="ved__modal" role="dialog" aria-modal="true" aria-label="اختر شكل القسم"
             onClick={(e) => { if (e.target === e.currentTarget) { setPicker(false); setInsertAt(null); } }}>
          <div className="ved__modal-box">
            <div className="ved__modal-head">
              <div>
                <h2>اختر شكل القسم الجديد</h2>
                <p>{insertAt != null ? 'سيُضاف في المكان اللي اخترته في الصفحة'
                  : typeof sel === 'number' ? 'سيُضاف تحت القسم المختار' : 'سيُضاف في آخر الصفحة'}، وتكتب نصوصه بعدها مباشرةً.</p>
              </div>
              <button type="button" className="ved__iconbtn ved__iconbtn--light" onClick={() => { setPicker(false); setInsertAt(null); }} aria-label="إغلاق">×</button>
            </div>
            <div className="ved__grid">
              {addable.map((a) => (
                <button type="button" key={a.type} className="ved__pick" onClick={() => add(a.type)}>
                  <SectionShape type={a.type} />
                  <b>{a.label}</b>
                  <small>{a.hint}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
