/* =============================================================================
   عمليات الكتابة التي يستعملها الداش بورد.

   قاعدتان في هذا الملف:
   • كل تعديل يُحفظ نسخة منه قبل تغييره في جدول revisions، فيمكن الرجوع خطوة.
   • كل كتابة تمرّ من هنا لا من الصفحات، كي يبقى التحقّق ومسح الكاش في مكان واحد.
============================================================================= */
import { revalidatePath } from 'next/cache';
import { direct, type Exec } from './db';
import { forgetDict } from './i18n';

/**
 * ينسخ الصفّ كما هو قبل تغييره. الرجوع خطوة إلى الوراء يقرأ من هنا.
 * داخل معاملة يُمرَّر db المعاملة، كي تُلغى النسخة مع التعديل إن فشل.
 */
export async function snapshot(entity: string, id: number, userId: number | null, db: Exec = direct) {
  const table = { page: 'pages', section: 'sections', product: 'products', nav: 'nav_items' }[entity];
  if (!table) return;
  const row = await db.q1<any>(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
  if (!row) return;
  await db.q(
    'INSERT INTO revisions (entity, entity_id, snapshot, user_id) VALUES (?,?,?,?)',
    [entity, id, JSON.stringify(row), userId]
  );
}

/** يُنسي Next الصفحات المخزّنة والترجمات المحفوظة في الذاكرة، كي يرى الزائر التعديل فورًا. */
export function refreshSite() {
  forgetDict();
  revalidatePath('/', 'layout');
}

export const J = (v: unknown) => JSON.stringify(v ?? null);

export { CORE_TEMPLATES, EDITABLE_TEMPLATES } from './templates';

/** نص بلغتيه كما يأتي من النموذج. الفارغ يبقى فارغًا ولا يُترجم هنا. */
export function dual(form: FormData, name: string) {
  const en = String(form.get(`${name}.en`) ?? '').trim();
  const ar = String(form.get(`${name}.ar`) ?? '').trim();
  return en || ar ? { en, ar } : null;
}

export const str = (form: FormData, name: string) => {
  const v = String(form.get(name) ?? '').trim();
  return v === '' ? null : v;
};

export const bool = (form: FormData, name: string) => (form.get(name) ? 1 : 0);

/** قائمة نصوص من حقل يُكتب فيه سطر لكل عنصر. */
export const lines = (form: FormData, name: string) =>
  String(form.get(name) ?? '').split('\n').map((s) => s.trim()).filter(Boolean);

/** مسار جديد صالح: حروف إنجليزية وأرقام وشرطات فقط. */
export function slugify(v: string) {
  return v.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
