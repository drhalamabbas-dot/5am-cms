/* نتائج البحث في محتوى الموقع. */
import { requireUser } from '@/lib/auth';
import { Shell } from '@/components/admin/Shell';
import { searchAll, fold, type Hit } from '@/lib/adminSearch';

export const dynamic = 'force-dynamic';

const KIND: Record<Hit['kind'], string> = {
  section: 'أقسام', page: 'صفحات', product: 'منتجات', nav: 'المنيو والفوتر', text: 'نصوص الواجهة',
};

/* نمط يطابق الكلمة بكل صورها: «الصيانه» يلوّن «الصيانة»، و«مولد» يلوّن
   «مولّد». كل حرف يقبل أشكاله، وبين الحروف يُقبل تشكيل اختياري. */
const VARIANTS: Record<string, string> = {
  'ا': '[اأإآٱ]', 'ه': '[هة]', 'ي': '[يى]',
};
const esc = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function pattern(words: string[]): RegExp | null {
  if (!words.length) return null;
  const one = (w: string) => [...w].map((c) => VARIANTS[c] ?? esc(c)).join('[\\u064B-\\u065F\\u0670\\u0640]*');
  return new RegExp(`(${words.map(one).join('|')})`, 'gi');
}

/** يلوّن كل كلمات البحث في المقتطف. */
function Mark({ text, words }: { text: string; words: string[] }) {
  const re = pattern(words);
  if (!re) return <>{text}</>;
  const parts = text.split(re);
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}

export default async function SearchPage({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const term = ((await searchParams).q ?? '').trim();
  const hits = term ? await searchAll(term) : [];
  const words = fold(term).split(' ').filter((w) => w.length >= 2);

  const groups = (Object.keys(KIND) as Hit['kind'][])
    .map((k) => ({ k, rows: hits.filter((h) => h.kind === k) }))
    .filter((g) => g.rows.length);

  return (
    <Shell user={user} here="/admin/search" title="ابحث في الموقع"
           trail={[{ label: 'لوحة التحكم', href: '/admin' }]}
           sub="اكتب أي كلمة تراها على الموقع، وتصل إلى مكانها لتعدّله.">
      <form method="get" className="panel" style={{ marginBottom: 20 }}>
        <div className="panel__body" style={{ display: 'flex', gap: 10 }}>
          <input type="search" name="q" defaultValue={term} autoFocus
                 placeholder="مثلًا: قطع الغيار، 2500، Pelican، الضمان…"
                 style={{ flex: 1, fontSize: 16, padding: '11px 14px' }} />
          <button className="btn" type="submit">ابحث</button>
        </div>
      </form>

      {!term ? (
        <p className="empty">
          ابحث بالعربية أو الإنجليزية. البحث لا يفرّق بين «مولّد» و«مولد»، ولا بين «ة» و«ه».
        </p>
      ) : hits.length === 0 ? (
        <p className="empty">لا شيء يطابق «{term}». جرّب كلمة أقصر.</p>
      ) : (
        <>
          <p className="field__hint" style={{ marginBottom: 14 }}>
            {hits.length} نتيجة لـ «{term}»
          </p>
          {groups.map(({ k, rows }) => (
            <div className="panel" style={{ marginBottom: 18 }} key={k}>
              <div className="panel__head">
                <h2>{KIND[k]}</h2>
                <small>{rows.length}</small>
              </div>
              <ul className="hits">
                {rows.map((h, i) => (
                  <li key={i}>
                    <a href={h.href}>
                      <span className="hits__top">
                        <b>{h.title}</b>
                        <small>{h.where}</small>
                      </span>
                      {h.snippet ? <span className="hits__snip"><Mark text={h.snippet} words={words} /></span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </Shell>
  );
}
