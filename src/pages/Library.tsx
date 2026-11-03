import { useState } from 'react';
import { Badge, Panel, Tabs, n1 } from '../components/ui';
import { SCENARIO_MAP, SCENARIOS } from '../data/missions';
import { deleteBlueprint, duplicateBlueprint, go, loadBlueprint, setState, startCampaign, useApp } from '../store/store';

export default function Library() {
  const app = useApp();
  const [tab, setTab] = useState<'bp' | 'lb' | 'hist'>('bp');
  const [filter, setFilter] = useState('all');
  const lb = app.leaderboard.filter((e) => filter === 'all' || e.scenarioId === filter);
  return (
    <div className="col" style={{ gap: 14 }}>
      <div><h1>Mission library</h1><div className="muted">Your saved blueprints, scenario catalogue, and local leaderboard.</div></div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'bp', label: `Blueprints (${app.saved.length})` }, { id: 'lb', label: 'Leaderboard' }, { id: 'hist', label: 'Scenarios' }]} />
      {tab === 'bp' && (
        <Panel title="Saved spacecraft blueprints" pad={false}>
          <table><thead><tr><th>Name</th><th>Scenario</th><th>Saved</th><th className="num">Last score</th><th /></tr></thead><tbody>
            {app.saved.length === 0 && <tr><td colSpan={5} className="muted">Nothing saved yet. Use "Save blueprint" in the Workshop.</td></tr>}
            {app.saved.map((s) => <tr key={s.id}><td><b>{s.name}</b></td><td>{s.sandbox ? `Sandbox · ${s.sandbox.target}` : SCENARIO_MAP[s.scenarioId]?.name} <Badge>{s.difficulty}</Badge></td><td className="mono">{new Date(s.savedAt).toLocaleDateString()}</td><td className="num">{s.lastScore ?? '—'}</td>
              <td className="row" style={{ justifyContent: 'flex-end' }}><button className="btn sm primary" onClick={() => loadBlueprint(s.id)}>Load</button><button className="btn sm" onClick={() => duplicateBlueprint(s.id)}>Duplicate</button><button className="btn sm" onClick={() => { setState((x) => ({ compareIds: x.compareIds.includes(s.id) ? x.compareIds : [...x.compareIds, s.id].slice(-4) })); go('compare'); }}>Compare</button><button className="btn sm danger" onClick={() => deleteBlueprint(s.id)}>Delete</button></td></tr>)}
          </tbody></table>
        </Panel>
      )}
      {tab === 'lb' && (
        <Panel title="Leaderboard (stored in this browser only)" right={<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All missions</option>{SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>} pad={false}>
          <table><thead><tr><th>#</th><th>Player</th><th>Mission</th><th>Design</th><th>Difficulty</th><th className="num">Score</th><th>Rank</th></tr></thead><tbody>
            {lb.length === 0 && <tr><td colSpan={7} className="muted">No completed campaign missions yet.</td></tr>}
            {lb.slice(0, 30).map((e, i) => <tr key={e.id}><td className="mono">{i + 1}</td><td>{e.player}</td><td>{e.scenarioName}</td><td>{e.designName}</td><td>{e.difficulty}</td><td className="num"><b>{e.score}</b></td><td>{e.rank}</td></tr>)}
          </tbody></table>
          <div className="note" style={{ margin: 10 }}>This is a local leaderboard: scores are not shared online. Name: <input type="text" value={app.playerName} onChange={(e) => setState({ playerName: e.target.value })} style={{ width: 160 }} /></div>
        </Panel>
      )}
      {tab === 'hist' && (
        <div className="grid g3">{SCENARIOS.map((s) => { const best = app.leaderboard.filter((e) => e.scenarioId === s.id)[0]; return <div key={s.id} className="card" onClick={() => startCampaign(s.id, app.difficulty)}><b>{s.code} · {s.name}</b><div className="muted">{s.tagline}</div><div className="mono" style={{ marginTop: 6 }}>${s.budgetM}M · best {best ? best.score : '—'}{best ? ` · ${n1(0) && ''}${best.rank}` : ''}</div></div>; })}</div>
      )}
    </div>
  );
}
