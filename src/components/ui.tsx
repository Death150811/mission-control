import { useEffect, useState, type ReactNode } from 'react';
import { TOPIC_MAP } from '../education/topics';
import { useCurrent } from '../store/store';

export const n0 = (x: number) => (isFinite(x) ? Math.round(x).toLocaleString('en-US') : '∞');
export const n1 = (x: number) => (isFinite(x) ? x.toFixed(1) : '∞');
export const n2 = (x: number) => (isFinite(x) ? x.toFixed(2) : '∞');
export const money = (x: number) => `$${x.toFixed(1)}M`;

export function Panel({ title, right, children, className = '', pad = true }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`panel ${className}`}>
      {title && <div className="ph"><h3>{title}</h3>{right}</div>}
      <div className={pad ? 'pb' : ''}>{children}</div>
    </section>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'cy' | 'or' | 'rd' | 'gr' }) {
  return <span className={`badge ${tone ?? ''}`}>{children}</span>;
}

export function Meter({ label, value, frac, tone, mark, hint }: { label: ReactNode; value: ReactNode; frac: number; tone?: 'ok' | 'warn' | 'bad' | ''; mark?: number; hint?: ReactNode }) {
  const f = Math.max(0, Math.min(1, isFinite(frac) ? frac : 0));
  return (
    <div className="meter" title={typeof hint === 'string' ? hint : undefined}>
      <div className="top"><span>{label}</span><b>{value}</b></div>
      <div className={`bar ${tone ?? ''}`}><i style={{ width: `${f * 100}%` }} />{mark !== undefined && <span className="mark" style={{ left: `${Math.min(1, Math.max(0, mark)) * 100}%` }} />}</div>
      {hint && typeof hint !== 'string' && <div className="dim" style={{ fontSize: 'calc(12px * var(--ts, 1))', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'cy' | 'or' | 'rd' | 'gr' }) {
  return <div className="stat"><div className="l">{label}</div><div className={`v ${tone ?? ''}`}>{value}</div>{sub && <div className="s">{sub}</div>}</div>;
}

export function Modal({ title, children, onClose, footer, wide }: { title: ReactNode; children: ReactNode; onClose?: () => void; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }} role="dialog" aria-modal="true">
      <div className="modal fadein" style={wide ? { maxWidth: 920 } : undefined}>
        <div className="mh"><h2 style={{ flex: 1 }}>{title}</h2>{onClose && <button className="btn sm" onClick={onClose} aria-label="Close">Close</button>}</div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
}

/** Contextual "?" button that opens the 4-part explanation tied to the player's live design. */
export function Explain({ topic, label }: { topic: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="help" onClick={(e) => { e.stopPropagation(); setOpen(true); }} title={label ?? 'Explain'} aria-label={`Explain: ${label ?? topic}`}>?</button>
      {open && <ExplainModal topic={topic} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ExplainModal({ topic, onClose }: { topic: string; onClose: () => void }) {
  const { analysis } = useCurrent();
  const t = TOPIC_MAP[topic];
  if (!t) return null;
  return (
    <Modal title={t.title} onClose={onClose}>
      {t.equation && <code className="eq">{t.equation}</code>}
      <h3 className="cy" style={{ margin: '12px 0 4px' }}>1 · Simple definition</h3><p>{t.definition}</p>
      <h3 className="cy" style={{ margin: '12px 0 4px' }}>2 · Why engineers care</h3><p>{t.significance}</p>
      <h3 className="cy" style={{ margin: '12px 0 4px' }}>3 · Practical example</h3><p>{t.example}</p>
      <h3 className="or" style={{ margin: '12px 0 4px' }}>4 · In your design</h3><p>{t.connect(analysis)}</p>
    </Modal>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[] }) {
  return <div className="tabs" role="tablist">{items.map((i) => <button key={i.id} className={value === i.id ? 'on' : ''} onClick={() => onChange(i.id)} role="tab" aria-selected={value === i.id}>{i.label}</button>)}</div>;
}

export function Illustrative({ children }: { children?: ReactNode }) {
  return <div className="note">{children ?? 'All component and instrument specifications are ILLUSTRATIVE game-balance values, not claims about real hardware. Physical equations (Kepler, vis-viva, rocket equation, free-space loss) are real; operational models are simplified approximations.'}</div>;
}
