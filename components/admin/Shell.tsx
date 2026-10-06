/* هيكل صفحات الداش بورد: القائمة الجانبية وترويسة الصفحة.
   القائمة تُبنى من مصفوفة واحدة كي تبقى الصفحات والروابط في مكان واحد. */
import type { ReactNode } from 'react';
import { endSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { can, isSuper, type Who } from '@/lib/permissions';
import { Bell } from './Bell';

/* الترتيب يتبع ما يُفتح كثيرًا: الصفحات أولًا، وما يُضبط مرة في الأسفل.
   كل رابط يظهر لمن عنده صلاحيته (أيّ واحدة من need)، و«super» للسوبر أدمن وحده. */
const LINKS: { href: string; label: string; group?: string; need?: string[] | 'super' }[] = [
  { href: '/admin', label: 'نظرة عامة' },
  { href: '/admin/analytics', label: 'التحليلات', need: ['analytics.view'] },
  { href: '/admin/requests', label: 'الطلبات', group: 'العملاء', need: ['requests.view'] },
  { href: '/admin/customers', label: 'العملاء', need: ['customers.view'] },
  { href: '/admin/deals', label: 'الصفقات', need: ['deals.view'] },
  { href: '/admin/chats', label: 'المحادثات', need: ['chat.handle'] },
  { href: '/admin/chat-training', label: 'تدريب البوت', need: ['chat.train'] },
  { href: '/admin/pages', label: 'الصفحات', group: 'ما تعدّله كثيرًا', need: ['pages.edit', 'pages.create', 'pages.publish', 'pages.delete'] },
  { href: '/admin/products', label: 'المنتجات', need: ['products.edit', 'products.publish', 'products.delete'] },
  { href: '/admin/store', label: 'المتجر', need: ['store.toggle', 'products.edit'] },
  { href: '/admin/media', label: 'الصور والفيديو', need: ['media.manage'] },
  { href: '/admin/nav', label: 'المنيو والفوتر', group: 'إعدادات الموقع', need: ['nav.edit'] },
  { href: '/admin/settings', label: 'بيانات التواصل', need: ['settings.edit'] },
  { href: '/admin/translations', label: 'نصوص الأزرار والترجمة', need: ['translations.edit'] },
  { href: '/admin/history', label: 'التراجع عن تعديل', need: ['history.restore'] },
  { href: '/admin/attendance', label: 'حضوري وانصرافي', group: 'الفريق' },
  { href: '/admin/users', label: 'الأدمنز والصلاحيات', group: 'السوبر أدمن', need: 'super' },
  { href: '/admin/attendance/table', label: 'جدول الحضور', need: 'super' },
  { href: '/admin/audit', label: 'سجل العمليات', need: 'super' },
];

export type Crumb = { label: string; href?: string };

/** المجموعة التي يقع فيها الرابط: آخر عنوان مجموعة قبله في LINKS */
function groupOf(href: string): string | undefined {
  let g: string | undefined;
  for (const l of LINKS) { if (l.group) g = l.group; if (l.href === href) return g; }
  return g;
}

export function Shell({
  user, here, title, sub, actions, trail = [], children,
}: {
  user: { name: string | null; email: string } & Partial<Who>;
  here: string;
  title: string;
  sub?: string;
  actions?: ReactNode;
  /** مسار الوصول إلى هذه الشاشة، بلا الشاشة نفسها. */
  trail?: Crumb[];
  children: ReactNode;
}) {
  async function logout() {
    'use server';
    await endSession();
    redirect('/admin/login');
  }

  return (
    <div className="shell">
      <nav className="side" aria-label="أقسام لوحة التحكم">
        <div className="side__brand"><b>5A&amp;M</b><span>لوحة التحكم</span></div>
        <Bell />
        {/* البحث في كل شاشة: «فين الجملة دي؟» سؤال يأتي من أي مكان */}
        <form action="/admin/search" method="get" className="side__search" role="search">
          <input type="search" name="q" placeholder="ابحث في الموقع…" aria-label="ابحث في محتوى الموقع" />
        </form>
        {LINKS.filter((l) => !l.need || (l.need === 'super'
          ? isSuper(user as Who)
          : l.need.some((p) => can({ role: user.role ?? 'admin', perms: user.perms ?? ['*'] }, p)))).map((l, i, shown) => (
          <span key={l.href}>
            {/* عنوان المجموعة مع أول رابط ظاهر منها */}
            {groupOf(l.href) && (i === 0 || groupOf(shown[i - 1].href) !== groupOf(l.href))
              ? <div className="side__sep">{groupOf(l.href)}</div> : null}
            <a href={l.href} className={here === l.href ? 'is-on' : ''}
               aria-current={here === l.href ? 'page' : undefined}>
              {l.label}
            </a>
          </span>
        ))}
        <div className="side__foot">
          <div>{user.name || user.email}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/admin/account">حسابي</a>
            <a href="/" target="_blank" rel="noopener">فتح الموقع ↗</a>
            <form action={logout}>
              <button type="submit"
                      style={{ background: 'none', border: 0, color: '#8fa0b8', font: 'inherit', cursor: 'pointer', padding: 0 }}>
                خروج
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="main">
        {/* مسار الوصول: يقول أين أنت، ويرجعك خطوة واحدة بضغطة. */}
        {trail.length ? (
          <nav className="acrumbs" aria-label="مسار الصفحة">
            {trail.map((c, i) => (
              <span key={i}>
                {c.href ? <a href={c.href}>{c.label}</a> : <span>{c.label}</span>}
                <i aria-hidden="true">/</i>
              </span>
            ))}
            <b>{title}</b>
          </nav>
        ) : null}

        <div className="top">
          <div>
            <h1>{title}</h1>
            {sub ? <p className="top__sub">{sub}</p> : null}
          </div>
          {actions ? <div style={{ display: 'flex', gap: 10 }}>{actions}</div> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
