/* خريطة الموقع لمحركات البحث (/sitemap.xml) — robots.txt يشير إليها منذ
   الموقع القديم، ولم تكن موجودة.

   تُبنى من القاعدة عند كل طلب: كل صفحة منشورة بلغتيها، وكل منتج منشور. صفحات
   التحويل والمخفية عن الفهرسة (noindex) والمسوّدات لا تدخلها. والعنوان الأساسي
   من SITE_URL على الاستضافة. */
import type { MetadataRoute } from 'next';
import { q } from '@/lib/db';
import { getStore, STORE_SLUG } from '@/lib/store';

export const dynamic = 'force-dynamic';

const BASE = (() => {
  const u = process.env.SITE_URL?.trim();
  return u && !/localhost|127\.0\.0\.1/.test(u) ? u.replace(/\/+$/, '') : 'https://www.5a-eg.com';
})();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await q<any>(
    `SELECT slug, template, updated_at FROM pages
      WHERE published = 1 AND redirect_to IS NULL AND noindex = 0 ORDER BY position, id`
  );
  const products = await q<any>('SELECT slug, updated_at FROM products WHERE published = 1 ORDER BY position, id');
  /* المتجر المقفول لا يدخل الخريطة (lib/store.ts) */
  const store = await getStore();

  const entry = (path: string, updated: Date | string, priority: number): MetadataRoute.Sitemap => {
    const join = path.includes('?') ? '&' : '?';
    const url = (lang: string) => `${BASE}/${path}${join}lang=${lang}`;
    return ['ar', 'en'].map((lang) => ({
      url: url(lang),
      lastModified: new Date(updated),
      priority,
      alternates: { languages: { ar: url('ar'), en: url('en') } },
    }));
  };

  return [
    /* صفحة المنتج قالب لا صفحة بذاتها: المنتجات تدخل بأسمائها */
    ...pages.filter((p) => p.template !== 'product' && (store.enabled || p.slug !== STORE_SLUG)).flatMap((p) =>
      entry(p.slug === 'index' ? '' : `${p.slug}.html`, p.updated_at, p.slug === 'index' ? 1 : 0.8)),
    ...products.flatMap((p) => entry(`model.html?p=${encodeURIComponent(p.slug)}`, p.updated_at, 0.6)),
  ];
}
