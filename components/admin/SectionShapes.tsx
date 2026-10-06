/* =============================================================================
   رسم مصغّر لكل نوع قسم.

   اسم النوع وحده لا يقول شيئًا لمن لم يبنِ الصفحة: «حكاية» و«صف مميّز» كلاهما
   كلام. الرسم يقول في لمحة: صورة على اليمين ونصّ على اليسار، أو ثلاثة كروت،
   أو قائمة نقاط. فيختار صاحب الموقع بعينه لا بحدسه.

   رسوم مجرّدة لا صور: تبقى واضحة بأي حجم، ولا تحتاج ملفات.
============================================================================= */

const C = {
  box: '#cbd5e3',      // كتلة صورة
  line: '#dfe5ee',     // سطر نص
  strong: '#9fb0c4',   // عنوان
  brand: '#e8a784',    // زرّ أو تمييز
  dark: '#334155',
};

/** أسطر نصّ متدرّجة الطول، كما يبدو النصّ حقًّا. */
const Lines = ({ x, y, w, n = 3, gap = 7 }: { x: number; y: number; w: number; n?: number; gap?: number }) => (
  <>
    {Array.from({ length: n }).map((_, i) => (
      <rect key={i} x={x} y={y + i * gap} width={i === n - 1 ? w * 0.6 : w} height="3.5" rx="1.75"
            fill={C.line} />
    ))}
  </>
);

const Head = ({ x, y, w }: { x: number; y: number; w: number }) => (
  <rect x={x} y={y} width={w} height="6" rx="3" fill={C.strong} />
);

const Frame = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 160 90" width="100%" role="img" aria-hidden="true"
       style={{ display: 'block', height: 'auto', borderRadius: 6, background: '#fff' }}>
    {children}
  </svg>
);

/* ------------------------------------------------------------- الأشكال */
const SHAPES: Record<string, React.ReactNode> = {
  /* صورة على جهة ونصّ على الأخرى */
  story: (
    <>
      <rect x="8" y="14" width="66" height="62" rx="4" fill={C.box} />
      <Head x={84} y={20} w={56} />
      <Lines x={84} y={34} w={64} n={4} />
    </>
  ),
  feature: (
    <>
      <rect x="8" y="20" width="60" height="50" rx="4" fill={C.box} />
      <Head x={78} y={28} w={50} />
      <Lines x={78} y={42} w={66} n={3} />
    </>
  ),
  /* ثلاثة كروت، كلٌّ بصورة وعنوان */
  cards: (
    <>
      <Head x={8} y={10} w={44} />
      {[8, 60, 112].map((x) => (
        <g key={x}>
          <rect x={x} y={24} width="40" height="26" rx="3" fill={C.box} />
          <rect x={x} y={55} width="32" height="4" rx="2" fill={C.strong} />
          <rect x={x} y={63} width="40" height="3" rx="1.5" fill={C.line} />
          <rect x={x} y={70} width="26" height="3" rx="1.5" fill={C.line} />
        </g>
      ))}
    </>
  ),
  /* قائمة بعلامات صح */
  list: (
    <>
      <Head x={8} y={12} w={44} />
      {[30, 44, 58, 72].map((y) => (
        <g key={y}>
          <circle cx="12" cy={y} r="4" fill="none" stroke={C.brand} strokeWidth="1.6" />
          <path d={`M10 ${y} l1.6 1.6 l3-3`} fill="none" stroke={C.brand} strokeWidth="1.4" strokeLinecap="round" />
          <rect x="22" y={y - 2} width="112" height="3.5" rx="1.75" fill={C.line} />
        </g>
      ))}
    </>
  ),
  /* خطوات مرقّمة */
  steps: (
    <>
      <Head x={8} y={10} w={44} />
      {[8, 60, 112].map((x, i) => (
        <g key={x}>
          <text x={x} y={38} fontSize="13" fontWeight="700" fill={C.brand}>0{i + 1}</text>
          <rect x={x} y={46} width="30" height="4" rx="2" fill={C.strong} />
          <rect x={x} y={56} width="40" height="3" rx="1.5" fill={C.line} />
          <rect x={x} y={63} width="34" height="3" rx="1.5" fill={C.line} />
        </g>
      ))}
    </>
  ),
  /* صورة كبيرة وبجانبها بلاطات */
  gallery: (
    <>
      <Head x={8} y={10} w={44} />
      <rect x="8" y="24" width="68" height="52" rx="3" fill={C.box} />
      {[[82, 24], [120, 24], [82, 52], [120, 52]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="32" height="24" rx="3" fill={C.box} opacity="0.75" />
      ))}
    </>
  ),
  /* كروت منتجات */
  products: (
    <>
      <Head x={8} y={10} w={44} />
      {[8, 60, 112].map((x) => (
        <g key={x}>
          <rect x={x} y={24} width="40" height="28" rx="3" fill={C.box} />
          <rect x={x} y={57} width="36" height="4" rx="2" fill={C.strong} />
          <rect x={x} y={66} width="24" height="3" rx="1.5" fill={C.brand} />
        </g>
      ))}
    </>
  ),
  /* ثلاث بطاقات بأيقونة */
  vmv: (
    <>
      <Head x={8} y={10} w={44} />
      {[8, 60, 112].map((x) => (
        <g key={x}>
          <circle cx={x + 10} cy={34} r="8" fill="none" stroke={C.brand} strokeWidth="1.8" />
          <rect x={x} y={48} width="28" height="4" rx="2" fill={C.strong} />
          <rect x={x} y={57} width="40" height="3" rx="1.5" fill={C.line} />
          <rect x={x} y={64} width="32" height="3" rx="1.5" fill={C.line} />
        </g>
      ))}
    </>
  ),
  /* صورتان ومقبض بينهما */
  compare: (
    <>
      <Head x={8} y={10} w={44} />
      <rect x="8" y="24" width="144" height="52" rx="4" fill={C.box} />
      <rect x="8" y="24" width="72" height="52" rx="4" fill={C.dark} opacity="0.35" />
      <line x1="80" y1="24" x2="80" y2="76" stroke="#fff" strokeWidth="2.5" />
      <circle cx="80" cy="50" r="7" fill="#fff" stroke={C.strong} strokeWidth="1.5" />
    </>
  ),
  /* شريط داكن فيه زرّ */
  cta: (
    <>
      <rect x="8" y="22" width="144" height="46" rx="5" fill={C.dark} />
      <rect x="20" y="34" width="60" height="5" rx="2.5" fill="#fff" opacity="0.9" />
      <rect x="20" y="46" width="78" height="3.5" rx="1.75" fill="#fff" opacity="0.45" />
      <rect x="110" y="38" width="32" height="14" rx="7" fill={C.brand} />
    </>
  ),
};

/* =========================================================== معاينة الصفحة
   القالب يُعرض صفحةً مصغّرة لا أشرطة مجرّدة: هيدر، ثم شريط لكل قسم يرسم
   شكله، ثم فوتر. فيرى صاحب الموقع ما سيحصل عليه قبل أن يضغط.

   كل شريط دالة ترسم في ارتفاعها المحجوز، فتُرصّ الأقسام واحدًا تحت الآخر. */
type Band = { h: number; draw: (y: number) => React.ReactNode };

const band = (h: number, draw: (y: number) => React.ReactNode): Band => ({ h, draw });

const BANDS: Record<string, Band> = {
  /* الهيرو: صورة عريضة وفوقها عنوان — في أعلى كل صفحة */
  hero: band(40, (y) => (
    <g>
      <rect x="6" y={y} width="148" height="36" rx="3" fill={C.box} />
      <rect x="14" y={y + 14} width="60" height="6" rx="3" fill="#fff" opacity="0.95" />
      <rect x="14" y={y + 24} width="84" height="3.5" rx="1.75" fill="#fff" opacity="0.6" />
    </g>
  )),
  story: band(34, (y) => (
    <g>
      <rect x="6" y={y} width="62" height="30" rx="3" fill={C.box} />
      <rect x="76" y={y + 4} width="48" height="5" rx="2.5" fill={C.strong} />
      <rect x="76" y={y + 14} width="72" height="3" rx="1.5" fill={C.line} />
      <rect x="76" y={y + 21} width="60" height="3" rx="1.5" fill={C.line} />
    </g>
  )),
  feature: band(32, (y) => (
    <g>
      <rect x="6" y={y} width="56" height="28" rx="3" fill={C.box} />
      <rect x="70" y={y + 4} width="44" height="5" rx="2.5" fill={C.strong} />
      <rect x="70" y={y + 14} width="78" height="3" rx="1.5" fill={C.line} />
      <rect x="70" y={y + 21} width="64" height="3" rx="1.5" fill={C.line} />
    </g>
  )),
  cards: band(34, (y) => (
    <g>
      <rect x="6" y={y} width="40" height="5" rx="2.5" fill={C.strong} />
      {[6, 58, 110].map((x) => (
        <g key={x}>
          <rect x={x} y={y + 11} width="44" height="14" rx="2.5" fill={C.box} />
          <rect x={x} y={y + 28} width="34" height="3" rx="1.5" fill={C.line} />
        </g>
      ))}
    </g>
  )),
  list: band(30, (y) => (
    <g>
      <rect x="6" y={y} width="40" height="5" rx="2.5" fill={C.strong} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx="10" cy={y + 13 + i * 7} r="2.6" fill="none" stroke={C.brand} strokeWidth="1.2" />
          <rect x="18" y={y + 11.5 + i * 7} width="124" height="3" rx="1.5" fill={C.line} />
        </g>
      ))}
    </g>
  )),
  steps: band(32, (y) => (
    <g>
      <rect x="6" y={y} width="40" height="5" rx="2.5" fill={C.strong} />
      {[6, 58, 110].map((x, i) => (
        <g key={x}>
          <text x={x} y={y + 21} fontSize="9" fontWeight="700" fill={C.brand}>0{i + 1}</text>
          <rect x={x} y={y + 25} width="36" height="3" rx="1.5" fill={C.line} />
        </g>
      ))}
    </g>
  )),
  gallery: band(36, (y) => (
    <g>
      <rect x="6" y={y} width="40" height="5" rx="2.5" fill={C.strong} />
      <rect x="6" y={y + 11} width="68" height="24" rx="2.5" fill={C.box} />
      {[[80, 0], [118, 0], [80, 13], [118, 13]].map(([x, dy]) => (
        <rect key={`${x}-${dy}`} x={x} y={y + 11 + dy} width="34" height="11" rx="2"
              fill={C.box} opacity="0.72" />
      ))}
    </g>
  )),
  cta: band(26, (y) => (
    <g>
      <rect x="6" y={y} width="148" height="22" rx="3" fill={C.dark} />
      <rect x="14" y={y + 7} width="52" height="4" rx="2" fill="#fff" opacity="0.9" />
      <rect x="14" y={y + 14} width="36" height="3" rx="1.5" fill="#fff" opacity="0.4" />
      <rect x="118" y={y + 8} width="28" height="9" rx="4.5" fill={C.brand} />
    </g>
  )),
};

/** صفحة مصغّرة من أنواع أقسامها. */
export function PageShape({ sections }: { sections: string[] }) {
  const bands = [BANDS.hero, ...sections.map((s) => BANDS[s]).filter(Boolean)];
  const inner = bands.reduce((a, b) => a + b.h + 5, 0);
  const total = 12 + inner + 14;   // هيدر + الأقسام + فوتر
  let y = 12 + 0;

  return (
    <svg viewBox={`0 0 160 ${total}`} width="100%" role="img" aria-hidden="true"
         style={{ display: 'block', height: 'auto', borderRadius: 5, background: '#fff' }}>
      {/* الهيدر */}
      <rect x="0" y="0" width="160" height="9" fill={C.dark} />
      <rect x="6" y="3" width="16" height="3" rx="1.5" fill="#fff" opacity="0.85" />
      {[112, 128, 144].map((x) => (
        <rect key={x} x={x} y="3.5" width="10" height="2" rx="1" fill="#fff" opacity="0.5" />
      ))}

      {bands.map((b, i) => {
        const node = <g key={i}>{b.draw(y)}</g>;
        y += b.h + 5;
        return node;
      })}

      {/* الفوتر */}
      <rect x="0" y={total - 12} width="160" height="12" fill="#1e293b" />
      {[6, 46, 86, 126].map((x) => (
        <rect key={x} x={x} y={total - 8} width="26" height="2.5" rx="1.25" fill="#fff" opacity="0.35" />
      ))}
    </svg>
  );
}

export const hasShape = (type: string) => type in SHAPES;

export function SectionShape({ type }: { type: string }) {
  const s = SHAPES[type];
  if (!s) {
    return (
      <Frame>
        <Head x={8} y={20} w={60} />
        <Lines x={8} y={38} w={140} n={4} />
      </Frame>
    );
  }
  return <Frame>{s}</Frame>;
}
