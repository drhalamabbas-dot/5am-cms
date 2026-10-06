/* استعلامات المحتوى. كل دالة ترجع الشكل الذي تحتاجه العروض مباشرة. */
import { q, q1, json } from './db';

export type Hero = {
  img?: string;
  kicker?: { en?: string; ar?: string };
  title?: { en?: string; ar?: string };
  lede?: { en?: string; ar?: string };
  /** تصميم أعلى الصفحة من المحرّر (lib/design.ts) */
  design?: import('./design').Design;
};

export type SectionRow = {
  id: number;
  type: string;
  anchor: string | null;
  position: number;
  /** 0 = مخفي عن الزائر. لا يصل إلى العرض إلا لصاحب الموقع (draft). */
  published: number;
  content: any;
};

export type PageRow = {
  id: number;
  slug: string;
  /** sections للصفحات العادية، وonepage للرئيسية، وproduct وquote لصفحتيهما. */
  template: string;
  crumb_en: string | null;
  crumb_ar: string | null;
  parent_slug: string | null;
  title_en: string | null;
  description_en: string | null;
  /** عنوان الصفحة ووصفها لمحركات البحث بالعربية — إن كُتبا */
  title_ar: string | null;
  description_ar: string | null;
  og_image: string | null;
  noindex: number;
  published: number;
  redirect_to: string | null;
  quote_solution: string | null;
  hero: Hero | null;
  related: string[];
  sections: SectionRow[];
};

/**
 * صفحة بأقسامها.
 *
 * `draft` يتيح رؤية المسوّدات وأقسامها المخفيّة — يُمرَّر لصاحب الموقع وهو
 * داخل بحسابه كي يعاين عمله قبل نشره. الزائر لا يراها: تُعامَل كغير موجودة.
 */
export async function getPage(slug: string, draft = false): Promise<PageRow | null> {
  const p = await q1<any>(
    `SELECT id, slug, template, crumb_en, crumb_ar, parent_slug, title_en, description_en, title_ar, description_ar,
            og_image, noindex, published, redirect_to, quote_solution, hero, related
       FROM pages WHERE slug = ?${draft ? '' : ' AND published = 1'}`,
    [slug]
  );
  if (!p) return null;
  const rows = await q<any>(
    `SELECT id, type, anchor, position, published, content FROM sections
      WHERE page_id = ?${draft ? '' : ' AND published = 1'} ORDER BY position`,
    [p.id]
  );
  return {
    ...p,
    hero: json<Hero | null>(p.hero, null),
    related: json<string[]>(p.related, []),
    sections: rows.map((r) => ({ ...r, content: json(r.content, {}) })),
  };
}

/** أسماء الصفحات في الروابط بين الصفحات.
    تُقدَّم قائمة الروابط على اسم المسار لأنها هي ما كان يظهر في الموقع القديم،
    والفرق بينهما أحيانًا حرف كبير أو صغير. */
export async function getPageLabels(): Promise<Record<string, { en: string; ar: string }>> {
  const [rows, links] = await Promise.all([
    q<any>('SELECT slug, crumb_en, crumb_ar FROM pages'),
    getSetting<{ slug: string; en: string; ar: string }[]>('pageLinks', []),
  ]);
  const out: Record<string, { en: string; ar: string }> = Object.fromEntries(
    rows.map((r) => [r.slug, { en: r.crumb_en ?? r.slug, ar: r.crumb_ar ?? r.crumb_en ?? r.slug }])
  );
  for (const l of links) out[l.slug] = { en: l.en, ar: l.ar };
  return out;
}

export async function getPageSlugs(): Promise<string[]> {
  const rows = await q<{ slug: string }>('SELECT slug FROM pages WHERE published = 1');
  return rows.map((r) => r.slug);
}

export type Product = {
  id: number; ref: string; slug: string; category: string | null; subcategory: string | null;
  brand_slug: string | null; brand_name: string | null; brand_logo: string | null;
  name_en: string | null; name_ar: string | null;
  type_en: string | null; type_ar: string | null;
  description_en: string | null; description_ar: string | null;
  hero_image: string | null;
  published: number;
  /** رقم القطعة أو الموديل، ومخفي من صفحة المتجر */
  sku?: string | null; store_hidden?: number;
  data: {
    gallery: string[];
    specifications: { k: string; v: string }[];
    features: string[];
    applications: string[];
    downloads: { label: string; href?: string }[];
    videos: any[];
    /** شرائح المواصفات بترتيبها في المصدر — قائمة لا كائن، حفاظًا على الترتيب. */
    meta: { k: string; v: string }[];
    related: string[];
  };
};

const PRODUCT_COLS = `p.id, p.ref, p.slug, p.category, p.subcategory,
  b.slug AS brand_slug, b.name AS brand_name, b.logo AS brand_logo,
  p.name_en, p.name_ar, p.type_en, p.type_ar,
  p.description_en, p.description_ar, p.hero_image, p.published, p.sku, p.store_hidden, p.data`;

const shape = (r: any): Product => ({
  ...r,
  data: json(r.data, { gallery: [], specifications: [], features: [], applications: [], downloads: [], videos: [], meta: [], related: [] }),
});

export async function getProducts(): Promise<Product[]> {
  const rows = await q<any>(
    `SELECT ${PRODUCT_COLS} FROM products p LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.published = 1 ORDER BY p.position`
  );
  return rows.map(shape);
}

/**
 * منتج واحد. `draft` لصاحب الموقع وحده — يُمرَّر فقط بعد التحقّق من الجلسة
 * على الخادم، كي يعاين المنتج قبل نشره. وكل قوائم المنتجات (الكتالوج، البحث،
 * المرتبطة) تبقى للمنشور وحده.
 */
export async function getProduct(slugOrRef: string, draft = false): Promise<Product | null> {
  const r = await q1<any>(
    `SELECT ${PRODUCT_COLS} FROM products p LEFT JOIN brands b ON b.id = p.brand_id
      WHERE (p.slug = ? OR p.ref = ?)${draft ? '' : ' AND p.published = 1'}`,
    [slugOrRef, slugOrRef]
  );
  return r ? shape(r) : null;
}

export async function getProductsByRefs(refs: string[]): Promise<Product[]> {
  if (!refs.length) return [];
  const rows = await q<any>(
    `SELECT ${PRODUCT_COLS} FROM products p LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.ref IN (${refs.map(() => '?').join(',')}) AND p.published = 1`,
    refs
  );
  const by = new Map(rows.map((r) => [r.ref, shape(r)]));
  return refs.map((r) => by.get(r)).filter(Boolean) as Product[];
}

/** موديلات أخرى تُعرض أسفل صفحة المنتج — الترتيب نفسه الذي في model.js:
    ما نصّ عليه المنتج أولًا، ثم بقية موديلات التصنيف الفرعي، بلا تكرار، وثلاثة. */
export async function getRelatedProducts(p: Product): Promise<Product[]> {
  const named = await getProductsByRefs(p.data.related ?? []);
  const sameSub = await q<any>(
    `SELECT ${PRODUCT_COLS} FROM products p LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.category = ? AND p.subcategory = ? AND p.ref <> ? AND p.published = 1
      ORDER BY p.position`,
    [p.category, p.subcategory, p.ref]
  );
  const out: Product[] = [];
  for (const r of [...named, ...sameSub.map(shape)]) {
    if (r.ref === p.ref || out.some((x) => x.ref === r.ref)) continue;
    out.push(r);
    if (out.length === 3) break;
  }
  return out;
}

/** الصفحة التي تعرض هذا المنتج في قسم «كروت منتجات».
 *
 *  مسار التنقّل في صفحة المنتج كان ثابتًا: الرئيسية / المعدات / التصنيف /
 *  التصنيف الفرعي. فإن أُنشئت صفحة وسيطة تعرض المنتج — «مكانس الطرق» مثلًا —
 *  صار المسار يكذب على الزائر: يقول إنه جاء من مكان لم يأتِ منه.
 *
 *  لا حقل جديد يُملأ باليد: الصفحة التي تذكر المنتج هي أمّه. فإن نُقل المنتج
 *  من صفحة إلى أخرى تبع مسارُه مكانَه وحده. */
export async function getProductParent(
  ref: string
): Promise<{ slug: string; crumb_en: string | null; crumb_ar: string | null } | null> {
  const rows = await q<any>(
    `SELECT pg.slug, pg.crumb_en, pg.crumb_ar
       FROM sections s JOIN pages pg ON pg.id = s.page_id
      WHERE s.type = 'products' AND s.published = 1
        AND pg.published = 1 AND pg.redirect_to IS NULL
        AND JSON_CONTAINS(JSON_EXTRACT(s.content, '$.ids'), JSON_QUOTE(?))
      ORDER BY pg.position
      LIMIT 1`,
    [ref]
  );
  return rows[0] ?? null;
}

export type Brand = {
  id: number; slug: string; name: string; logo: string | null;
  sub_en: string | null; sub_ar: string | null; group: string | null; site: string | null;
};

export async function getBrands(): Promise<Record<string, Brand>> {
  const rows = await q<any>('SELECT id, slug, name, logo, sub_en, sub_ar, `group`, site FROM brands ORDER BY position');
  return Object.fromEntries(rows.map((b) => [b.slug, b]));
}

export async function getSetting<T = any>(key: string, fallback: T): Promise<T> {
  const r = await q1<{ value: any }>('SELECT `value` FROM settings WHERE `key` = ?', [key]);
  return r ? json<T>(r.value, fallback) : fallback;
}

export type Company = {
  legalName: string; short: string; established: number; tagline: string;
  phone: string; phoneIntl: string; email: string; address: string; geo: string;
  hq?: { en: string; ar: string };
  serviceCenter?: { en: string; ar: string; map: string };
  dealership?: string;
  [k: string]: any;
};

export const getCompany = () => getSetting<Company>('company', {} as Company);

/** فهرس البحث: الصفحات ثم المنتجات، بالشكل الذي كان ux.js يبنيه.
    حقل terms يجمع ما يُبحث فيه — بالعربية والإنجليزية معًا كي تنجح الكلمة
    بأي لغة كتبها الزائر. الأسماء المرادفة تُحفظ مع الصفحة في القاعدة. */
export type SearchRecord = { name: string; href: string; type: string; terms: string };

export async function getSearchIndex(lang: 'en' | 'ar'): Promise<SearchRecord[]> {
  const ar = lang === 'ar';
  const [links, pageRows, products] = await Promise.all([
    getSetting<{ slug: string; en: string; ar: string; terms?: string }[]>('pageLinks', []),
    q<any>(
      `SELECT slug, crumb_en, crumb_ar, title_en, description_en FROM pages
        WHERE published = 1 AND redirect_to IS NULL AND noindex = 0
          AND template NOT IN ('product','quote')
        ORDER BY position`
    ),
    getProducts(),
  ]);
  /* الأساس هو الصفحات المنشورة نفسها، لا قائمة أسماء ثابتة — فالصفحة التي
     تُنشأ من الداش بورد تدخل البحث بمجرّد نشرها. وpageLinks تضيف لها اسمًا
     أفضل وكلمات بحث إضافية إن وُجدت. */
  const extra = Object.fromEntries(links.map((l) => [l.slug, l]));
  /* المتجر المقفول لا يظهر في البحث (lib/store.ts) */
  const storeOn = (await getSetting<{ enabled?: boolean }>('store', {})).enabled !== false;
  const pages: SearchRecord[] = pageRows.filter((r) => storeOn || r.slug !== 'store').map((r) => {
    const l = extra[r.slug];
    const en = l?.en || r.crumb_en || r.slug;
    const arName = l?.ar || r.crumb_ar || en;
    return {
      name: ar ? arName : en,
      href: `${r.slug}.html`,
      type: ar ? 'خدمة / صفحة' : 'Service / page',
      terms: [r.slug, en, arName, r.crumb_en, r.crumb_ar, r.title_en, r.description_en, l?.terms ?? '']
        .filter(Boolean).join(' '),
    };
  });
  const items: SearchRecord[] = products.map((p) => ({
    name: (ar ? p.name_ar || p.name_en : p.name_en) ?? '',
    href: `model.html?p=${encodeURIComponent(p.slug)}`,
    type: ar ? 'منتج' : 'Product',
    terms: [
      p.name_en, p.name_ar, p.type_en, p.type_ar, p.subcategory,
      p.description_en, p.description_ar, p.brand_name, p.sku,
    ].filter(Boolean).join(' '),
  }));
  return [...pages, ...items];
}
