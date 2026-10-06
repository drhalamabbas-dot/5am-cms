/* مكتبة الصور والفيديو والملفات: رفع، وبحث، وحذف. */
import { requirePerm } from '@/lib/auth';
import { Shell } from '@/components/admin/Shell';
import { listMedia } from '@/lib/media';
import { MediaLibrary } from '@/components/admin/MediaLibrary';

export const dynamic = 'force-dynamic';

export default async function MediaPage() {
  const user = await requirePerm('media.manage');
  const items = await listMedia({ limit: 400 });
  return (
    <Shell user={user} here="/admin/media" title="الصور والفيديو"
           trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub="ارفع من جهازك، أو اسحب الملفات إلى الصفحة. كل ما هنا يظهر في قوائم اختيار الصور.">
      <MediaLibrary initial={items} />
    </Shell>
  );
}
