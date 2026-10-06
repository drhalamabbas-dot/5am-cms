/* التصنيفات الفرعية المستعملة في المنتجات، بأسمائها العربية من الترجمات.
   الكتالوج يجمع المنتجات بالتصنيف الفرعي حرفًا بحرف، فمنتج بتصنيف مكتوب
   بشكل مختلف لا يظهر في مجموعته — فيُختار من القائمة لا يُكتب. */
import { q } from './db';

export type Subcat = { category: string; value: string; ar: string | null; n: number };

export async function getSubcats(): Promise<Subcat[]> {
  return q<Subcat>(
    `SELECT p.category, p.subcategory AS value, MAX(t.ar) AS ar, COUNT(*) AS n
       FROM products p LEFT JOIN translations t ON t.\`key\` = CONCAT('sub.', p.subcategory)
      WHERE p.subcategory IS NOT NULL AND p.subcategory <> ''
      GROUP BY p.category, p.subcategory
      ORDER BY p.category, n DESC, p.subcategory`
  );
}
