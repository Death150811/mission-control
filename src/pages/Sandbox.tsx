import { useState } from 'react';
import { Badge, Panel, n0, n1 } from '../components/ui';
import { DIFFICULTY } from '../engine/difficulty';
import { newId } from '../engine/designFactory';
import { runMission } from '../engine/missionSimulator';
import { scoreMission } from '../engine/scoringEngine';
import type { Difficulty, TargetId } from '../types';
import { getState, go, scenarioOf, setState, startSandbox, toast, useApp, type ExperimentRecord } from '../store/store';

const TARGETS: { id: TargetId; label: string }[] = [{ id: 'earth', label: 'Earth orbit' }, { id: 'moon', label: 'Moon' }, { id: 'mars', label: 'Mars' }, { id: 'asteroid', label: 'Asteroid' }, { id: 'deepspace', label: 'Deep space (L2)' }];

export default function Sandbox() {
  const app = useApp();
  const [s, setS] = useState(app.sandbox);
  const [diff, setDiff] = useState<Difficulty>(app.difficulty);
  const [stats, setStats] = useState<{ min: number; mean: number; max: number; n: number } | null>(null);
  const inSandbox = app.mode === 'sandbox' && !!app.design;
  const history = app.experiments.filter((e) => e.scenarioId.startsWith('sandbox'));

  const runOnce = (seed: number): ExperimentRecord | null => {
    const st = getState();
    if (!st.design) return null;
    const sc = scenarioOf(st);
    const m = runMission(st.design, sc, st.difficulty, seed, 'director');
    const score = scoreMission(m);
    return { id: newId(), at: Date.now(), name: st.design.name, scenarioId: sc.id, seed, score: score.total, rank: score.rank, massKg: m.a.mass.total, costM: m.a.cost.total, sciPoints: Object.values(m.points).reduce((x, y) => x + y, 0), outcome: m.outcome };
  };
  const quick = () => { const r = runOnce(getState().seed); if (r) { setState({ experiments: [r, ...getState().experiments].slice(0, 80) }); toast(`Experiment: ${r.score} points (${r.rank})`); } };
  const multi = () => {
    const rs: ExperimentRecord[] = [];
    for (let i = 0; i < 5; i++) { const r = runOnce(100 + i * 7919); if (r) rs.push(r); }
    if (!rs.length) return;
    setState({ experiments: [...rs, ...getState().experiments].slice(0, 80) });
    const sc = rs.map((r) => r.score);
    setStats({ min: Math.min(...sc), max: Math.max(...sc), mean: sc.reduce((a, b) => a + b, 0) / sc.length, n: sc.length });
  };
  return (
    <div className="col" style={{ gap: 14 }}>
      <div><h1>Sandbox</h1><div className="muted">Free experimentation. Set your own budget and limits, use any component, run repeated simulations. Losing is just data.</div></div>
      <div className="grid g2">
        <Panel title="Sandbox settings">
          <label className="col"><span>Target</span><select value={s.target} onChange={(e) => setS({ ...s, target: e.target.value as TargetId })}>{TARGETS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <label className="col" style={{ marginTop: 8 }}><span>Budget: <b className="mono">${n0(s.budgetM)}M</b></span><input type="range" min={30} max={1500} step={10} value={s.budgetM} onChange={(e) => setS({ ...s, budgetM: Number(e.target.value) })} /></label>
          <label className="col"><span>Maximum spacecraft mass: <b className="mono">{n0(s.maxMassKg)} kg</b></span><input type="range" min={100} max={20000} step={100} value={s.maxMassKg} onChange={(e) => setS({ ...s, maxMassKg: Number(e.target.value) })} /></label>
          <label className="col"><span>Mission duration: <b className="mono">{s.nominalDays} days</b></span><input type="range" min={30} max={900} step={10} value={s.nominalDays} onChange={(e) => setS({ ...s, nominalDays: Number(e.target.value) })} /></label>
          <label className="col"><span>Difficulty rules</span><select value={diff} onChange={(e) => setDiff(e.target.value as Difficulty)}>{(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY[d].label}</option>)}</select></label>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={() => startSandbox(s, diff)}>{inSandbox ? 'Start a new sandbox' : 'Open sandbox workshop'}</button>
            {inSandbox && <button className="btn" onClick={() => go('workshop')}>Continue current sandbox</button>}
          </div>
        </Panel>
        <Panel title="Experiment tools">
          {!inSandbox ? <p className="muted">Open a sandbox first. Then build anything and use these tools without leaving the workshop flow.</p> : (
            <div className="col">
              <div className="muted">Current design: <b>{app.design?.name}</b></div>
              <div className="row"><button className="btn primary" onClick={quick}>Run simulation now (seed {app.seed})</button><button className="btn" onClick={multi}>Run 5 different seeds</button></div>
              {stats && <div className="note">Over {stats.n} seeds: score min <b>{stats.min}</b> · mean <b>{n0(stats.mean)}</b> · max <b>{stats.max}</b>. A wide spread means your design depends on luck (anomalies); a narrow one means it has margin.</div>}
              <div className="muted">The runs are headless (autopilot ascent, flight-director responses) and are recorded in the experiment history below.</div>
            </div>
          )}
        </Panel>
      </div>
      <Panel title={`Experiment history (${history.length})`} pad={false}>
        <table><thead><tr><th>When</th><th>Design</th><th>Target</th><th className="num">Score</th><th>Outcome</th><th className="num">Mass kg</th><th className="num">Cost $M</th><th className="num">Science</th></tr></thead><tbody>
          {history.length === 0 && <tr><td colSpan={8} className="muted">No experiments yet.</td></tr>}
          {history.map((e) => <tr key={e.id}><td className="mono">{new Date(e.at).toLocaleTimeString()}</td><td>{e.name}</td><td>{e.scenarioId.replace('sandbox-', '')}</td><td className="num"><b>{e.score}</b> <span className="muted">{e.rank}</span></td><td><Badge tone={e.outcome === 'completed' ? 'gr' : 'rd'}>{e.outcome}</Badge></td><td className="num">{n0(e.massKg)}</td><td className="num">{n1(e.costM)}</td><td className="num">{n1(e.sciPoints)}</td></tr>)}
        </tbody></table>
      </Panel>
    </div>
  );
}
