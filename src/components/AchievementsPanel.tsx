import { useEffect, useMemo, useState } from 'react';
import { ACHIEVEMENTS, evaluateAchievements } from '../engine/achievements';
import type { MissionState } from '../engine/missionTypes';
import type { ScoreResult } from '../engine/scoringEngine';
import { recordAchievements, useEarned } from '../store/achievements';
import { Badge, Panel } from './ui';

const TIER_COLOR = { bronze: '#c8814a', silver: '#aab4c3', gold: '#f2c14e' } as const;

/** Achievements judged from this mission, plus the gallery of everything earned so far in this browser. */
export default function AchievementsPanel({ m, score }: { m: MissionState; score: ScoreResult }) {
  const earned = useEarned();
  const now = useMemo(() => new Set(evaluateAchievements(m, score)), [m, score]);
  const [fresh, setFresh] = useState<string[]>([]);
  useEffect(() => {
    const added = recordAchievements([...now], m.design.name);
    if (added.length) setFresh((p) => (p.length ? p : added));
  }, [now, m.design.name]);
  const total = Object.keys(earned).length;
  return (
    <Panel title={`Achievements (${total} / ${ACHIEVEMENTS.length} earned)`} right={fresh.length ? <Badge tone="gr">{fresh.length} new</Badge> : undefined}>
      <div className="grid g3" style={{ gap: 8 }}>
        {ACHIEVEMENTS.map((a) => {
          const has = !!earned[a.id], thisRun = now.has(a.id), isNew = fresh.includes(a.id);
          return (
            <div key={a.id} className="card" style={{ cursor: 'default', opacity: has ? 1 : 0.5, borderColor: isNew ? 'var(--green)' : thisRun ? 'var(--line2)' : undefined, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" style={{ flex: '0 0 auto' }}>
                <circle cx="14" cy="14" r="12" fill="none" stroke={TIER_COLOR[a.tier]} strokeWidth="2" strokeDasharray={has ? undefined : '3 3'} />
                {has && <path d="M8 14.5 L12.2 18.5 L20 9.5" fill="none" stroke={TIER_COLOR[a.tier]} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
              </svg>
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 6 }}><b>{a.name}</b>{isNew && <Badge tone="gr">new</Badge>}{!isNew && thisRun && <Badge tone="cy">this run</Badge>}</div>
                <div className="muted" style={{ fontSize: 'calc(13px * var(--ts, 1))' }}>{a.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
