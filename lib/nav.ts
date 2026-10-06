/* يعيد بناء شجرة المنيو والفوتر من قاعدة البيانات بالشكل الذي كان
   buildNav() في الموقع القديم يعطيه، فيبقى الرسم كما هو. */
import { q, json } from './db';
import { getStore, isStoreHref } from './store';

export type NavRow = {
  id: number; parent_id: number | null; area: string; position: number;
  label_en: string; label_ar: string; href: string | null;
  desc_en: string | null; desc_ar: string | null; extra: any;
  published?: number;
};
type Row = NavRow;

export type NavLink = { label: { en: string; ar: string }; href: string; desc?: { en: string; ar: string } | null };
export type NavColumn = { title: { en: string; ar: string }; links: NavLink[] };
export type NavItem = {
  id: number;
  label: { en: string; ar: string };
  href: string;
  kind: 'plain' | 'mega' | 'submenu';
  columns: NavColumn[];
  links: NavLink[];
  tag?: { en: string; ar: string } | null;
  desc?: { en: string; ar: string } | null;
  promo?: { en: any; ar: any } | null;
};

const dual = (r: Row) => ({ en: r.label_en, ar: r.label_ar || r.label_en });
const ddesc = (r: Row) => (r.desc_en || r.desc_ar ? { en: r.desc_en ?? '', ar: r.desc_ar ?? r.desc_en ?? '' } : null);

/** المتجر المقفول لا يظهر له رابط في المنيو ولا الفوتر (lib/store.ts) */
async function withoutClosedStore(rows: Row[]): Promise<Row[]> {
  if ((await getStore()).enabled) return rows;
  return rows.filter((r) => !isStoreHref(r.href));
}

export async function getNav(): Promise<NavItem[]> {
  const rows = await q<Row>(
    `SELECT id, parent_id, area, position, label_en, label_ar, href, desc_en, desc_ar, extra
       FROM nav_items WHERE area = 'header' AND published = 1 ORDER BY position`
  );
  return buildNav(await withoutClosedStore(rows));
}

/**
 * الشجرة من صفوف المنيو العلوي المنشورة. منفصلة عن القراءة كي يرسم المحرّر
 * المرئي الهيدر من تعديلاته قبل حفظها (المعاينة)، بالبناء نفسه حرفًا بحرف.
 */
export function buildNav(all: Row[]): NavItem[] {
  const rows = all
    .filter((r) => (r.area ?? 'header') === 'header' && (r.published ?? 1) === 1)
    .sort((a, b) => a.position - b.position || a.id - b.id);
  const kids = (id: number) => rows.filter((r) => r.parent_id === id);
  return rows
    .filter((r) => r.parent_id === null)
    .map((top) => {
      const extra = json<any>(top.extra, {});
      const children = kids(top.id);
      const columns: NavColumn[] = [];
      const links: NavLink[] = [];
      for (const c of children) {
        const ce = json<any>(c.extra, {});
        if (ce.kind === 'column') {
          columns.push({
            title: dual(c),
            links: kids(c.id).map((l) => ({ label: dual(l), href: l.href ?? '#', desc: ddesc(l) })),
          });
        } else {
          links.push({ label: dual(c), href: c.href ?? '#', desc: ddesc(c) });
        }
      }
      return {
        id: top.id,
        label: dual(top),
        href: top.href ?? '#',
        kind: (extra.kind as NavItem['kind']) ?? 'plain',
        columns, links,
        tag: extra.tag ?? null,
        desc: extra.desc ?? null,
        promo: extra.promo ?? null,
      };
    });
}

export type FooterColumn = { title: { en: string; ar: string }; links: NavLink[] };

export async function getFooterColumns(): Promise<FooterColumn[]> {
  const rows = await q<Row>(
    `SELECT id, parent_id, area, position, label_en, label_ar, href, desc_en, desc_ar, extra
       FROM nav_items WHERE area = 'footer' AND published = 1 ORDER BY position`
  ).then(withoutClosedStore);
  return rows
    .filter((r) => r.parent_id === null)
    .map((col) => ({
      title: dual(col),
      links: rows.filter((r) => r.parent_id === col.id).map((l) => ({ label: dual(l), href: l.href ?? '#' })),
    }));
}
