import { useMemo } from 'react';
import { Badge, Panel, n0, n1 } from '../components/ui';
import { makeSandboxScenario, SCENARIO_MAP } from '../data/missions';
import { runMission } from '../engine/missionSimulator';
import { analyzeDesign } from '../engine/resourceManager';
import { scoreMission } from '../engine/scoringEngine';
import { go, setState, useApp, type SavedDesign } from '../store/store';

interface Row { id: string; name: string; scenario: string; mass: number; cost: number; avgPower: number; powerMargin: number; sciPerDay: number; dataGen: number; commCap: number; rel: number; score: number; dv: number; ok: boolean }

function evaluate(e: SavedDesign): Row {
  const sc = e.sandbox ? makeSandboxScenario(e.sandbox) : SCENARIO_MAP[e.scenarioId];
  const a = analyzeDesign(e.design, sc, e.difficulty);
  const m = runMission(e.design, sc, e.difficulty, 2026, 'director');
  const s = scoreMission(m);
  return { id: e.id, name: e.name, scenario: sc.name, mass: a.mass.total, cost: a.cost.total, avgPower: a.power.avgLoadW, powerMargin: a.power.orbitMarginPct, sciPerDay: a.science.potentialPerDay, dataGen: a.data.compressedMBd, commCap: a.comms.capacityMeanMB, rel: a.reliability.critical * 100, score: s.total, dv: a.propulsion.dvAvailable, ok: m.launch.ok && m.insertionOk };
}

export default function Compare() {
  const app = useApp();
  const chosen = app.saved.filter((s) => app.compareIds.includes(s.id));
  const rows = useMemo(() => chosen.map(evaluate), [app.compareIds, app.saved]);
  const toggle = (id: string) => setState((s) => ({ compareIds: s.compareIds.includes(id) ? s.compareIds.filter((x) => x !== id) : [...s.compareIds, id].slice(-4) }));
  const best = (key: keyof Row, low = false) => { if (rows.length < 2) return ''; const vals = rows.map((r) => r[key] as number); const target = low ? Math.min(...vals) : Math.max(...vals); return rows.find((r) => (r[key] as number) === target)?.id ?? ''; };
  const defs: { key: keyof Row; label: string; low?: boolean; fmt: (v: number) => string }[] = [
    { key: 'mass', label: 'Launch mass (kg)', low: true, fmt: n0 }, { key: 'cost', label: 'Total cost ($M)', low: true, fmt: n1 }, { key: 'avgPower', label: 'Average power (W)', low: true, fmt: n0 },
    { key: 'powerMargin', label: 'Power margin (%)', fmt: n0 }, { key: 'sciPerDay', label: 'Science potential (pts/day)', fmt: (v) => v.toFixed(2) }, { key: 'dataGen', label: 'Data generation (MB/day)', low: true, fmt: n0 },
    { key: 'commCap', label: 'Downlink capacity (MB/day)', fmt: n0 }, { key: 'dv', label: 'Delta-v available (m/s)', fmt: n0 }, { key: 'rel', label: 'Bus reliability (%)', fmt: n0 }, { key: 'score', label: 'Simulated mission score', fmt: n0 },
  ];
  const notes: string[] = [];
  if (rows.length >= 2) {
    const nm = (id: string) => rows.find((r) => r.id === id)?.name ?? '';
    notes.push(`Lowest cost: ${nm(best('cost', true))}. Most science per day: ${nm(best('sciPerDay'))}. Largest downlink: ${nm(best('commCap'))}. Lightest: ${nm(best('mass', true))}. Most reliable: ${nm(best('rel'))}. Highest simulated score (seed 2026): ${nm(best('score'))}.`);
  }
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row"><div><h1>Mission comparison</h1><div className="muted">Select two to four saved blueprints. Each is re-analysed and simulated. There is no single winner: the best design depends on the objective.</div></div></div>
      <Panel title={`Saved blueprints (${app.saved.length})`} pad={false}>
        <table><tbody>{app.saved.length === 0 && <tr><td className="muted">Save blueprints from the Workshop to compare them.</td></tr>}
          {app.saved.map((s) => <tr key={s.id}><td style={{ width: 30 }}><input type="checkbox" checked={app.compareIds.includes(s.id)} onChange={() => toggle(s.id)} aria-label={`Compare ${s.name}`} /></td><td><b>{s.name}</b><div className="muted">{(s.sandbox ? 'Sandbox ' + s.sandbox.target : SCENARIO_MAP[s.scenarioId]?.name)} · {s.difficulty}</div></td><td className="num">{s.lastScore ? `${s.lastScore} pts` : ''}</td></tr>)}
        </tbody></table>
      </Panel>
      {rows.length >= 2 && (
        <Panel title="Side by side" pad={false}>
          <table><thead><tr><th>Metric</th>{rows.map((r) => <th key={r.id} className="num">{r.name}<div className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>{r.scenario}</div></th>)}</tr></thead><tbody>
            {defs.map((d) => <tr key={d.key}><td>{d.label}</td>{rows.map((r) => <td key={r.id} className={`num ${best(d.key, d.low) === r.id ? 'cy' : ''}`}>{d.fmt(r[d.key] as number)}{best(d.key, d.low) === r.id && ' ◂'}</td>)}</tr>)}
            <tr><td>Launch & insertion</td>{rows.map((r) => <td key={r.id} className="num">{r.ok ? <Badge tone="gr">success</Badge> : <Badge tone="rd">failed</Badge>}</td>)}</tr>
          </tbody></table>
        </Panel>
      )}
      {notes.map((n) => <div className="note" key={n}>{n} Cheaper is not better and richer is not better: choose by mission objective.</div>)}
      {rows.length < 2 && <div className="note">Pick at least two blueprints above.</div>}
      <div className="row"><button className="btn" onClick={() => go('library')}>Open library</button></div>
    </div>
  );
}
