'use server';
/* =============================================================================
   أزرار شريط التحرير فوق كل قسم على الموقع: أعلى، أسفل، إخفاء، حذف.

   كل إجراء يتحقّق من الجلسة على الخادم أولًا — وجود الزرّ في الصفحة ليس
   صلاحية. ثم يعود إلى الصفحة نفسها عند القسم ذاته، فيرى صاحب الموقع أثر ما
   فعل مكانه.
============================================================================= */
import { redirect } from 'next/navigation';
import { requirePerm } from './auth';
import { q1 } from './db';
import { refreshSite } from './admin';
import { moveSection, toggleSection, deleteSection } from './sectionOps';

/** يعود إلى صفحة من الموقع فقط: مسار يبدأ بشرطة واحدة، لا عنوان موقع آخر. */
function back(form: FormData, hash = '') {
  const raw = String(form.get('back') ?? '/');
  const safe = /^\/(?![/\\])[^\s]*$/.test(raw) ? raw.replace(/#.*$/, '') : '/';
  redirect(safe + hash);
}

async function target(form: FormData) {
  const id = Number(form.get('id'));
  const s = id ? await q1<any>('SELECT id, page_id FROM sections WHERE id = ?', [id]) : null;
  return s as { id: number; page_id: number } | null;
}

export async function siteMoveSection(form: FormData) {
  const u = await requirePerm('pages.edit');
  const s = await target(form);
  if (s) {
    await moveSection(s.page_id, s.id, Number(form.get('dir')), u.id);
    refreshSite();
  }
  back(form, s ? `#ux-sec-${s.id}` : '');
}

export async function siteToggleSection(form: FormData) {
  const u = await requirePerm('pages.edit');
  const s = await target(form);
  if (s) {
    await toggleSection(s.page_id, s.id, u.id);
    refreshSite();
  }
  back(form, s ? `#ux-sec-${s.id}` : '');
}

export async function siteDeleteSection(form: FormData) {
  const u = await requirePerm('pages.edit');
  const s = await target(form);
  if (s) {
    await deleteSection(s.page_id, s.id, u.id);
    refreshSite();
  }
  back(form);
}
