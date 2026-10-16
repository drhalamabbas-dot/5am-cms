/* هيكل صفحات الداش بورد: القائمة الجانبية وترويسة الصفحة.
   القائمة تُبنى من مصفوفة واحدة كي تبقى الصفحات والروابط في مكان واحد. */
import type { ReactNode } from 'react';
import { endSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { can, isSuper, type Who } from '@/lib/permissions';
import { Bell } from './Bell';

/* الترتيب يتبع ما يُفتح كثيرًا: الصفحات أولًا، وما يُضبط مرة في الأسفل.
   كل رابط يظهر لمن عنده صلاحيته (أيّ واحدة من need)، و«super» للسوبر أدمن وحده. */
type Link = { href: string; label: string; group?: string; need?: string[] | 'super' };

const LINKS: Link[] = [
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

/* أيقونة لكل رابط — الأيقونة تُمسح بالعين أسرع من السطر، فتُعرف الشاشة قبل
   قراءة اسمها. خطّ واحد بسُمك موحّد كي تبدو المجموعة كطقم واحد. */
const P: Record<string, string> = {
  '/admin': 'M4 11 12 4l8 7M6 10v9h12v-9',
  '/admin/analytics': 'M4 19V9M10 19V5M16 19v-6M22 19H2',
  '/admin/requests': 'M5 4h14v16l-7-3-7 3zM9 9h6',
  '/admin/customers': 'M4 20a6 6 0 0 1 12 0M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 20a5 5 0 0 0-3-4.6',
  '/admin/deals': 'M3 7h18v12H3zM3 11h18M8 7V4h8v3',
  '/admin/chats': 'M4 5h16v10H9l-5 4z',
  '/admin/chat-training': 'M12 3v3M7 6h10v6a5 5 0 0 1-10 0zM9 20h6M10 10h.01M14 10h.01',
  '/admin/pages': 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  '/admin/products': 'M3 8l9-5 9 5-9 5zM3 8v8l9 5 9-5V8',
  '/admin/store': 'M4 8h16l-1 12H5zM9 8V5a3 3 0 0 1 6 0v3',
  '/admin/media': 'M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6',
  '/admin/nav': 'M4 6h16M4 12h16M4 18h10',
  '/admin/settings': 'M6 4h12v16H6zM9 9h6M9 13h6M9 17h3',
  '/admin/translations': 'M4 6h8M8 6v12M14 12h6M17 12l-3 7M17 12l3 7',
  '/admin/history': 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2',
  '/admin/attendance': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  '/admin/users': 'M4 20a6 6 0 0 1 12 0M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M18 8v4M16 10h4',
  '/admin/attendance/table': 'M3 5h18v14H3zM3 10h18M9 10v9M15 10v9',
  '/admin/audit': 'M6 3h8l4 4v14H6zM14 3v4h4M9 13l2 2 4-4',
};

function NavIcon({ href }: { href: string }) {
  const d = P[href];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export type Crumb = { label: string; href?: string };

/** المجموعة التي يقع فيها الرابط: آخر عنوان مجموعة قبله في LINKS */
function groupOf(href: string): string | undefined {
  let g: string | undefined;
  for (const l of LINKS) { if (l.group) g = l.group; if (l.href === href) return g; }
  return g;
}

/** يحوّل القائمة المسطّحة إلى مجموعات متتابعة، كلٌّ بعنوانها وروابطها. */
function groupLinks(shown: Link[]): { name?: string; items: Link[] }[] {
  const out: { name?: string; items: Link[] }[] = [];
  for (const l of shown) {
    const name = groupOf(l.href);
    const last = out[out.length - 1];
    if (last && last.name === name) last.items.push(l);
    else out.push({ name, items: [l] });
  }
  return out;
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
        {groupLinks(LINKS.filter((l) => !l.need || (l.need === 'super'
          ? isSuper(user as Who)
          : l.need.some((p) => can({ role: user.role ?? 'admin', perms: user.perms ?? ['*'] }, p))))).map((g) => {
          const link = (l: Link) => (
            <a key={l.href} href={l.href} className={here === l.href ? 'is-on' : ''}
               aria-current={here === l.href ? 'page' : undefined}>
              <NavIcon href={l.href} />{l.label}
            </a>
          );
          /* ما لا مجموعة له يبقى في الأعلى مباشرةً */
          if (!g.name) return g.items.map(link);
          /* details/summary: يطوى ويُفتح بلا جافاسكريبت، ومجموعة الشاشة الحالية
             مفتوحة كي يرى المستخدم أين هو فور فتح اللوحة.

             وopen هنا قيمة ابتدائية فقط: بعد أول نقرة يصير المتصفح هو مالكها،
             فيختلف ما في الصفحة عمّا رسمه الخادم — وهو اختلاف صحيح لا خطأ، لكن
             React كان ينبّه عليه في كل تحميل. suppressHydrationWarning يسكت
             التنبيه عن هذه السمة وحدها دون أن يغيّر سلوكًا. */
          return (
            <details className="side__grp" key={g.name} suppressHydrationWarning
                     open={g.items.some((l) => l.href === here)}>
              <summary className="side__sep">{g.name}</summary>
              <div className="side__sub">{g.items.map(link)}</div>
            </details>
          );
        })}
        <div className="side__foot">
          {/* الاسم نفسه مدخل «حسابي»: مساحة الضغط كبيرة بدل رابط بكلمة واحدة */}
          <a className="side__me" href="/admin/account">
            <i aria-hidden="true">{(user.name || user.email).trim().charAt(0)}</i>
            <span>
              <b>{user.name || user.email}</b>
              <em>حسابي</em>
            </span>
          </a>
          <div className="side__acts">
            <a className="sbtn" href="/" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
              </svg>
              فتح الموقع
            </a>
            <form action={logout}>
              <button className="sbtn sbtn--out" type="submit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5M16 16l4-4-4-4M20 12H9" />
                </svg>
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
