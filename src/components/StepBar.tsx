import type { ReactNode } from 'react';

export interface StepRef { id: string; label: string }

/** Sticky footer for the design steps: where you are, what to do here, and one-click Back / Next. */
export default function StepBar({ index, total, prev, next, nextBlockedReason, tip, blockers, warnings, onGo }: {
  index: number; total: number; prev: StepRef | null; next: StepRef | null; nextBlockedReason: string | null; tip: ReactNode;
  blockers: number; warnings: number; onGo: (id: string) => void;
}) {
  return (
    <div className="stepbar" role="navigation" aria-label="Previous and next step">
      <button className="btn" disabled={!prev} onClick={() => prev && onGo(prev.id)} title={prev ? `Back to ${prev.label}  ( [ )` : undefined}>← {prev?.label ?? 'Back'}</button>
      <div className="stepbar-mid">
        <div className="mono dim" style={{ fontSize: 'calc(11.5px * var(--ts, 1))' }}>STEP {index + 1} OF {total}</div>
        <div>{tip}</div>
        {(blockers > 0 || warnings > 0) && <div style={{ fontSize: 'calc(12.5px * var(--ts, 1))' }}>
          {blockers > 0 && <span className="rd"><b>{blockers}</b> blocker{blockers > 1 ? 's' : ''} stop launch</span>}
          {blockers > 0 && warnings > 0 && <span className="dim"> · </span>}
          {warnings > 0 && <span className="or">{warnings} warning{warnings > 1 ? 's' : ''}</span>}
        </div>}
      </div>
      <button className="btn primary" disabled={!next || !!nextBlockedReason} onClick={() => next && onGo(next.id)} title={nextBlockedReason ?? (next ? `Next: ${next.label}  ( ] )` : undefined)}>{next ? `${next.label} →` : 'Next'}</button>
    </div>
  );
}
