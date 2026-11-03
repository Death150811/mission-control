export interface Series { name: string; color: string; data: number[]; dash?: boolean }

export function LineChart({ series, height = 140, xs, unit = '', yMax, title, xLabel = 'day' }: { series: Series[]; height?: number; xs?: number[]; unit?: string; yMax?: number; title?: string; xLabel?: string }) {
  const W = 480, H = height, L = 38, R = 8, T = 8, B = 20;
  const n = Math.max(...series.map((s) => s.data.length), 2);
  const all = series.flatMap((s) => s.data).filter((v) => isFinite(v));
  const max = yMax ?? Math.max(1e-9, ...all) * 1.08;
  const min = Math.min(0, ...all);
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / (max - min || 1)) * (H - T - B);
  const ticks = [0, 0.5, 1].map((f) => min + f * (max - min));
  const fmt = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.abs(v) < 10 ? v.toFixed(1) : Math.round(v).toString());
  return (
    <div>
      {title && <div className="row" style={{ marginBottom: 4 }}><span className="muted" style={{ fontSize: 'calc(12px * var(--ts, 1))', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</span><span className="spacer" />{series.map((s) => <span key={s.name} style={{ fontSize: 'calc(12px * var(--ts, 1))', color: s.color }}>■ {s.name}</span>)}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', background: 'var(--bg2)', border: '1px solid var(--line)' }} role="img" aria-label={title}>
        {ticks.map((t, i) => (<g key={i}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#333a45" strokeWidth="1" /><text x={L - 4} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#6d7785" fontFamily="monospace">{fmt(t)}{unit}</text></g>))}
        {series.map((s) => {
          if (s.data.length < 2) return null;
          const d = s.data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(isFinite(v) ? v : 0).toFixed(1)}`).join(' ');
          return <path key={s.name} d={d} fill="none" stroke={s.color} strokeWidth="1.5" strokeDasharray={s.dash ? '4 3' : undefined} />;
        })}
        {xs && xs.length > 1 && <><text x={L} y={H - 5} fontSize="9" fill="#6d7785" fontFamily="monospace">{xLabel} {xs[0]}</text><text x={W - R} y={H - 5} textAnchor="end" fontSize="9" fill="#6d7785" fontFamily="monospace">{xs[xs.length - 1]}</text></>}
      </svg>
    </div>
  );
}

/** Downsample a long series so SVG paths stay light. */
export function downsample<T>(arr: T[], max = 240): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  out.push(arr[arr.length - 1]);
  return out;
}
