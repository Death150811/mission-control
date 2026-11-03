import { useState } from 'react';
import { Badge, Panel, n0 } from '../components/ui';
import { SCENARIOS } from '../data/missions';
import { DIFFICULTY } from '../engine/difficulty';
import { go, setCareerEnabled, startCampaign, useApp } from '../store/store';
import { MissionPatch } from '../components/Emblem';
import type { Difficulty } from '../types';

export function Pips({ n }: { n: number }) {
  return <span aria-label={`Difficulty ${n} of 5`} className="mono" style={{ letterSpacing: 2 }}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ color: i <= n ? 'var(--orange)' : 'var(--line2)' }}>■</span>)}</span>;
}

export default function MissionSelect() {
  const app = useApp();
  const [sel, setSel] = useState(app.scenarioId);
  const [diff, setDiff] = useState<Difficulty>(app.difficulty);
  const sc = SCENARIOS.find((s) => s.id === sel)!;
  return (
    <div className="col" style={{ gap: 16 }}>
      <div><h1>Mission selector</h1><div className="muted">Five scenarios with different science, orbits and engineering constraints.</div></div>
      <div className="grid g3">
        {SCENARIOS.map((s) => (
          <div key={s.id} className={`card ${sel === s.id ? 'sel' : ''}`} onClick={() => setSel(s.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setSel(s.id); }}>
            <div className="row" style={{ flexWrap: "nowrap" }}><MissionPatch id={s.id} size={58} label={s.name} /><div style={{ flex: 1 }}><Badge tone="cy">{s.code}</Badge><h2>{s.name}</h2></div></div>
            <div className="muted" style={{ margin: '4px 0 8px' }}>{s.tagline}</div>
            <div className="row"><Pips n={s.difficultyRating} /><span className="spacer" /><span className="mono muted">${s.budgetM}M · {n0(s.maxMassKg)} kg</span></div>
            <div className="dim" style={{ marginTop: 6, fontSize: 'calc(13px * var(--ts, 1))' }}>{s.objectives.filter((o) => o.mandatory).length} mandatory objectives · {s.allowedOrbitIds.length} orbit option{s.allowedOrbitIds.length > 1 ? 's' : ''}</div>
          </div>
        ))}
      </div>
      <div className="grid g2">
        <Panel title={`Scenario ${sc.code} · ${sc.name}`}>
          <p>{sc.briefing}</p>
          <h3 style={{ margin: '10px 0 4px' }}>Objectives</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{sc.objectives.map((o) => <li key={o.id}>{o.title} {o.mandatory ? <Badge tone="or">mandatory</Badge> : <Badge>optional</Badge>}</li>)}</ul>
          <h3 style={{ margin: '10px 0 4px' }}>Engineering requirements</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{sc.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
        </Panel>
        <Panel title="Difficulty">
          <div className="col">
            {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
              <label key={d} className={`card ${diff === d ? 'sel' : ''}`} style={{ display: 'block' }}>
                <input type="radio" name="diff" checked={diff === d} onChange={() => setDiff(d)} style={{ marginRight: 8 }} />
                <b>{DIFFICULTY[d].label}</b> <span className="muted">· budget ×{DIFFICULTY[d].budgetMul} · margins {Math.round(DIFFICULTY[d].designMargin * 100)}% · anomalies ×{DIFFICULTY[d].anomalyMul}</span>
                <div className="muted" style={{ fontSize: 'calc(13px * var(--ts, 1))', marginTop: 2 }}>{DIFFICULTY[d].summary}</div>
              </label>
            ))}
          </div>
          <label className="row" style={{ marginTop: 12 }}><input type="checkbox" checked={app.career.enabled} onChange={(e) => setCareerEnabled(e.target.checked)} />Space-programme mode: hardware must be unlocked with credits ({app.career.credits} cr) <button className="btn sm" onClick={() => go("tech")}>Tech tree</button></label>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn primary lg" onClick={() => startCampaign(sel, diff)}>Brief me on this mission →</button>
            <button className="btn lg" onClick={() => go('team')}>Team room (up to 4)</button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
