'use client';
/* =============================================================================
   رسوم التحليلات — بلا مكتبة. لون واحد (أزرق السلسلة الأولى #2a78d6، مُتحقَّق
   منه على خلفية اللوحة البيضاء)، أعمدة رفيعة ≤ 24px بنهاية مدوّرة 4px عند
   القيمة ومربّعة عند القاعدة، وخطوط الشبكة شعرة رمادية، وتلميح عند المرور،
   و«اعرض كجدول» لكل رسم. النص بألوان النص، لا بلون البيانات.
============================================================================= */
import { useState } from 'react';

const nf = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 });
/** سقف نظيف للمحور: 1 / 2 / 5 × 10^n */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

/* ------------------------------------------------------- أعمدة على الزمن */
export function ColumnChart({ data, unit, label }: { data: { label: string; value: number }[]; unit: string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const W = 720, H = 200, padL = 40, padB = 26, padT = 10;
  const step = (W - padL - 8) / Math.max(1, data.length);
  const bw = Math.min(24, Math.max(2, step - 2));     // فراغ 2px على الأقل بين الأعمدة
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, max / 2, max];
  const xl = data.length > 1 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0];
  const total = data.reduce((n, d) => n + d.value, 0);
  return (
    <figure className="chart">
      <div className="chart__plot" dir="ltr" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${nf(total)} ${unit} في الفترة`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - 4} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart__base' : 'chart__grid'} />
              <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="chart__tick">{nf(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = padL + i * step + (step - bw) / 2;
            const top = y(d.value), h = Math.max(0, y(0) - top);
            const r = Math.min(4, bw / 2, h);
            return (
              <g key={i}>
                {h > 0 ? (
                  <path className={`chart__bar${hover === i ? ' is-on' : ''}`}
                        d={`M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${y(0)} Z`} />
                ) : null}
                {/* هدف المرور أعرض من العمود */}
                <rect x={padL + i * step} y={padT} width={step} height={H - padT - padB} fill="transparent"
                      onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1} />
              </g>
            );
          })}
          {xl.map((i) => (
            <text key={i} x={padL + i * step + step / 2} y={H - 8} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} className="chart__tick">{data[i]?.label}</text>
          ))}
        </svg>
        {hover != null && data[hover] ? (
          <div className="chart__tip" style={{ left: `${((padL + hover * step + step / 2) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%` }}>
            <b>{nf(data[hover].value)} {unit}</b><span>{data[hover].label}</span>
          </div>
        ) : null}
      </div>
      <details className="chart__table">
        <summary>اعرض كجدول</summary>
        <table><thead><tr><th>اليوم</th><th>{unit}</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.label}><td dir="ltr">{d.label}</td><td>{nf(d.value)}</td></tr>)}</tbody></table>
      </details>
    </figure>
  );
}

/* ------------------------------------------------- أشرطة أفقية للترتيب */
export function BarList({ rows, unit, empty = 'لا بيانات في الفترة.' }: {
  rows: { label: string; value: number; href?: string; note?: string }[]; unit: string; empty?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!rows.length) return <p className="field__hint" style={{ margin: 0 }}>{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value)) || 1;
  const total = rows.reduce((n, r) => n + r.value, 0) || 1;
  return (
    <ul className="barlist" onMouseLeave={() => setHover(null)}>
      {rows.map((r, i) => (
        <li key={r.label + i} onMouseEnter={() => setHover(i)} className={hover === i ? 'is-on' : ''}
            title={`${r.label}: ${nf(r.value)} ${unit} (${Math.round((r.value / total) * 100)}%)`}>
          <span className="barlist__label">{r.href ? <a href={r.href}>{r.label}</a> : r.label}{r.note ? <small> · {r.note}</small> : null}</span>
          <span className="barlist__track"><i style={{ inlineSize: `${Math.max(1.5, (r.value / max) * 100)}%` }} /></span>
          <span className="barlist__val">{nf(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}
