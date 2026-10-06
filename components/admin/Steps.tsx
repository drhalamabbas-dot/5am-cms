/* شريط خطوات المعالج: يقول أين أنت وكم بقي. */
const STEPS = ['الاسم والشكل', 'المحتوى', 'النشر'];

export function Steps({ at }: { at: 1 | 2 | 3 }) {
  return (
    <ol className="wiz" aria-label="خطوات إنشاء الصفحة">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const state = n < at ? 'is-done' : n === at ? 'is-now' : '';
        return (
          <li key={s} className={state} aria-current={n === at ? 'step' : undefined}>
            <span className="wiz__n">{n < at ? '✓' : n}</span>
            <span className="wiz__t">{s}</span>
          </li>
        );
      })}
    </ol>
  );
}
