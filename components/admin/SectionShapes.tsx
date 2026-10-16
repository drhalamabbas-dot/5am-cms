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
  /* صفوف مطويّة، أولها مفتوح فيظهر جوابه */
  faq: (
    <>
      <Head x={8} y={10} w={44} />
      <rect x="8" y="24" width="144" height="14" rx="3" fill="#fff" stroke={C.line} />
      <rect x="14" y="29" width="54" height="4" rx="2" fill={C.strong} />
      <rect x="140" y="29" width="7" height="4" rx="2" fill={C.brand} />
      <rect x="8" y="38" width="144" height="16" rx="3" fill={C.line} opacity="0.45" />
      <Lines x={14} y={43} w={100} n={2} gap={6} />
      {[58, 70].map((y) => (
        <g key={y}>
          <rect x="8" y={y} width="144" height="10" rx="3" fill="#fff" stroke={C.line} />
          <rect x="14" y={y + 3} width="46" height="4" rx="2" fill={C.line} />
          <rect x="140" y={y + 3} width="7" height="4" rx="2" fill={C.box} />
        </g>
      ))}
    </>
  ),
  /* أرقام كبيرة في خانات، فوق كلٍّ شعرة ملوّنة */
  stats: (
    <>
      <Head x={8} y={10} w={44} />
      <rect x="8" y="26" width="144" height="46" rx="3" fill="#fff" stroke={C.line} />
      {[8, 44, 80, 116].map((x, i) => (
        <g key={x}>
          {i ? <line x1={x} y1="26" x2={x} y2="72" stroke={C.line} /> : null}
          <rect x={x + 8} y="26" width="14" height="2.5" fill={C.brand} />
          <rect x={x + 8} y="38" width="20" height="10" rx="2" fill={C.strong} />
          <rect x={x + 8} y="53" width="24" height="3.5" rx="1.75" fill={C.line} />
        </g>
      ))}
    </>
  ),
  /* بطاقتا اقتباس، في كلٍّ علامة تنصيص ثم اسم */
  quotes: (
    <>
      <Head x={8} y={10} w={44} />
      {[8, 82].map((x) => (
        <g key={x}>
          <rect x={x} y="24" width="70" height="52" rx="4" fill="#fff" stroke={C.line} />
          <text x={x + 8} y="42" fontSize="20" fill={C.brand} opacity="0.55">”</text>
          <Lines x={x + 8} y={44} w={54} n={2} gap={6} />
          <line x1={x + 8} y1="62" x2={x + 62} y2="62" stroke={C.line} />
          <rect x={x + 8} y="66" width="30" height="4" rx="2" fill={C.strong} />
        </g>
      ))}
    </>
  ),
  /* إطار فيديو بزرّ تشغيل في وسطه */
  video: (
    <>
      <Head x={8} y={10} w={44} />
      <rect x="8" y="24" width="144" height="52" rx="4" fill={C.dark} />
      <circle cx="80" cy="50" r="13" fill="#fff" opacity="0.92" />
      <path d="M76 44 L88 50 L76 56 Z" fill={C.dark} />
    </>
  ),
  /* ملفات للتحميل: ورقة مثنيّة الركن وسهم نزول بجانب اسم الملف */
  downloads: (
    <>
      <Head x={8} y={10} w={44} />
      {[26, 50].map((y) => (
        <g key={y}>
          <rect x="8" y={y} width="144" height="18" rx="3" fill="#fff" stroke={C.line} />
          <path d={`M16 ${y + 4} h8 l4 4 v6 h-12 z`} fill={C.box} />
          <rect x="36" y={y + 6} width="54" height="4" rx="2" fill={C.strong} />
          <path d={`M140 ${y + 6} v5 m-3 -3 l3 3 l3 -3`} stroke={C.brand} strokeWidth="1.6" fill="none" />
        </g>
      ))}
    </>
  ),
  /* خطّ زمني: نقاط على خطّ رأسي، لكلٍّ سنة ونصّ */
  timeline: (
    <>
      <Head x={8} y={10} w={44} />
      <line x1="18" y1="26" x2="18" y2="78" stroke={C.line} strokeWidth="2" />
      {[28, 48, 68].map((y) => (
        <g key={y}>
          <circle cx="18" cy={y} r="4" fill="#fff" stroke={C.brand} strokeWidth="2" />
          <rect x="30" y={y - 5} width="22" height="4" rx="2" fill={C.brand} opacity="0.75" />
          <rect x="30" y={y + 2} width="92" height="3" rx="1.5" fill={C.line} />
        </g>
      ))}
    </>
  ),
  /* جدول مواصفات: صفوف بخطّين، الاسم ثم القيمة */
  specs: (
    <>
      <Head x={8} y={10} w={44} />
      {[26, 40, 54, 68].map((y, i) => (
        <g key={y}>
          <rect x="8" y={y} width="144" height="12" rx="2" fill={i % 2 ? '#fff' : C.line} opacity={i % 2 ? 1 : 0.45} />
          <rect x="14" y={y + 4} width="44" height="4" rx="2" fill={C.strong} />
          <rect x="94" y={y + 4} width="50" height="4" rx="2" fill={C.line} />
        </g>
      ))}
    </>
  ),
  /* فريق العمل: وجوه دائرية تحتها اسم */
  team: (
    <>
      <Head x={8} y={10} w={44} />
      {[26, 66, 106].map((x) => (
        <g key={x}>
          <circle cx={x + 24} cy="44" r="14" fill={C.box} />
          <rect x={x + 8} y="64" width="32" height="4" rx="2" fill={C.strong} />
          <rect x={x + 14} y="72" width="20" height="3" rx="1.5" fill={C.line} />
        </g>
      ))}
    </>
  ),
  /* ملاحظة بارزة: إطار بحدّ ملوّن على الجهة وأيقونة */
  callout: (
    <>
      <rect x="8" y="26" width="144" height="38" rx="4" fill={C.line} opacity="0.4" />
      <rect x="8" y="26" width="4" height="38" rx="2" fill={C.brand} />
      <circle cx="30" cy="45" r="7" fill="none" stroke={C.brand} strokeWidth="2" />
      <rect x="30" y="44" width="0" height="0" />
      <rect x="46" y="36" width="56" height="5" rx="2.5" fill={C.strong} />
      <Lines x={46} y={48} w={92} n={2} gap={7} />
    </>
  ),
  /* لوجوهات تمرّ في صفّ — الأخير مقصوص ليقول إن الشريط يكمل ويتحرّك */
  logostrip: (
    <>
      <rect x="8" y="14" width="40" height="4" rx="2" fill={C.strong} />
      <rect x="8" y="30" width="144" height="34" rx="4" fill={C.line} opacity="0.5" />
      {[16, 52, 88, 124].map((x, i) => (
        <rect key={x} x={x} y={38} width={i === 3 ? 20 : 28} height="18" rx="3"
              fill={C.box} opacity={i === 3 ? 0.45 : 1} />
      ))}
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
  faq: band(30, (y) => (
    <g>
      <rect x="6" y={y} width="40" height="5" rx="2.5" fill={C.strong} />
      {[11, 21].map((dy, i) => (
        <g key={dy}>
          <rect x="6" y={y + dy} width="148" height="8" rx="2" fill="#fff" stroke={C.line} />
          <rect x="11" y={y + dy + 2.5} width={i ? 40 : 56} height="3" rx="1.5" fill={i ? C.line : C.strong} />
          <rect x="144" y={y + dy + 2.5} width="5" height="3" rx="1.5" fill={i ? C.box : C.brand} />
        </g>
      ))}
    </g>
  )),
  stats: band(26, (y) => (
    <g>
      <rect x="6" y={y} width="148" height="24" rx="3" fill="#fff" stroke={C.line} />
      {[6, 43, 80, 117].map((x, i) => (
        <g key={x}>
          {i ? <line x1={x} y1={y} x2={x} y2={y + 24} stroke={C.line} /> : null}
          <rect x={x + 6} y={y} width="11" height="2" fill={C.brand} />
          <rect x={x + 6} y={y + 7} width="16" height="7" rx="2" fill={C.strong} />
          <rect x={x + 6} y={y + 17} width="20" height="3" rx="1.5" fill={C.line} />
        </g>
      ))}
    </g>
  )),
  quotes: band(30, (y) => (
    <g>
      <rect x="6" y={y} width="40" height="5" rx="2.5" fill={C.strong} />
      {[6, 82].map((x) => (
        <g key={x}>
          <rect x={x} y={y + 11} width="72" height="19" rx="3" fill="#fff" stroke={C.line} />
          <rect x={x + 6} y={y + 16} width="48" height="3" rx="1.5" fill={C.line} />
          <rect x={x + 6} y={y + 23} width="28" height="3.5" rx="1.75" fill={C.strong} />
        </g>
      ))}
    </g>
  )),
  video: band(32, (y) => (
    <g>
      <rect x="6" y={y} width="148" height="32" rx="3" fill={C.dark} />
      <circle cx="80" cy={y + 16} r="8" fill="#fff" opacity="0.92" />
      <path d={`M77 ${y + 12} L84 ${y + 16} L77 ${y + 20} Z`} fill={C.dark} />
    </g>
  )),
  logostrip: band(18, (y) => (
    <g>
      <rect x="6" y={y} width="148" height="16" rx="3" fill={C.line} opacity="0.5" />
      {[14, 48, 82, 116].map((x, i) => (
        <rect key={x} x={x} y={y + 5} width={i === 3 ? 18 : 26} height="7" rx="2"
              fill={C.box} opacity={i === 3 ? 0.45 : 1} />
      ))}
    </g>
  )),
  downloads: band(28, (y) => (
    <g>
      <rect x="6" y={y} width="40" height="5" rx="2.5" fill={C.strong} />
      {[y + 10, y + 20].map((ry) => (
        <g key={ry}>
          <rect x="6" y={ry} width="148" height="8" rx="2" fill="#fff" stroke={C.line} />
          <rect x="11" y={ry + 2.5} width="6" height="4" rx="1" fill={C.box} />
          <rect x="22" y={ry + 3} width="46" height="3" rx="1.5" fill={C.line} />
          <path d={`M146 ${ry + 2.5} v3 m-2 -2 l2 2 l2 -2`} stroke={C.brand} strokeWidth="1.2" fill="none" />
        </g>
      ))}
    </g>
  )),
  timeline: band(34, (y) => (
    <g>
      <rect x="6" y={y} width="40" height="5" rx="2.5" fill={C.strong} />
      <line x1="12" y1={y + 12} x2="12" y2={y + 32} stroke={C.line} strokeWidth="1.6" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx="12" cy={y + 14 + i * 9} r="2.8" fill="#fff" stroke={C.brand} strokeWidth="1.4" />
          <rect x="22" y={y + 12.5 + i * 9} width="18" height="3" rx="1.5" fill={C.brand} opacity="0.7" />
          <rect x="46" y={y + 12.5 + i * 9} width="96" height="3" rx="1.5" fill={C.line} />
        </g>
      ))}
    </g>
  )),
  specs: band(32, (y) => (
    <g>
      <rect x="6" y={y} width="40" height="5" rx="2.5" fill={C.strong} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="6" y={y + 11 + i * 6} width="148" height="5" rx="1.5"
                fill={i % 2 ? '#fff' : C.line} opacity={i % 2 ? 1 : 0.4} />
          <rect x="10" y={y + 12.5 + i * 6} width="40" height="2.5" rx="1.25" fill={C.strong} />
          <rect x="96" y={y + 12.5 + i * 6} width="50" height="2.5" rx="1.25" fill={C.line} />
        </g>
      ))}
    </g>
  )),
  team: band(34, (y) => (
    <g>
      <rect x="6" y={y} width="40" height="5" rx="2.5" fill={C.strong} />
      {[20, 64, 108].map((x) => (
        <g key={x}>
          <circle cx={x + 16} cy={y + 20} r="9" fill={C.box} />
          <rect x={x + 2} y={y + 32} width="28" height="3" rx="1.5" fill={C.line} />
        </g>
      ))}
    </g>
  )),
  callout: band(20, (y) => (
    <g>
      <rect x="6" y={y} width="148" height="18" rx="3" fill={C.line} opacity="0.4" />
      <rect x="6" y={y} width="3" height="18" rx="1.5" fill={C.brand} />
      <circle cx="20" cy={y + 9} r="4" fill="none" stroke={C.brand} strokeWidth="1.4" />
      <rect x="30" y={y + 5} width="56" height="4" rx="2" fill={C.strong} />
      <rect x="30" y={y + 12} width="90" height="2.5" rx="1.25" fill={C.line} />
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
