import { useEffect, useMemo, useState } from 'react';
import { LineChart, downsample } from '../components/Charts';
import AchievementsPanel from '../components/AchievementsPanel';
import { Badge, Meter, Panel, Stat, n0, n1 } from '../components/ui';
import { counterfactuals, diagnose, recommendedBaseline, type Counterfactual } from '../engine/counterfactual';
import { totalBacklogMB } from '../engine/missionSimulator';
import { beginMission, go, newSeed, saveBlueprint, updateDesign, useApp } from '../store/store';
import { autoDesign } from '../engine/designFactory';

const LESSONS: Record<string, string> = {
  'Downlink bottleneck': 'Science is limited by the weakest link of the data chain: instrument → storage → compression → antenna → contact time. Size them together.',
  'Data was lost': 'Storage is a buffer, not a solution. If generation exceeds downlink for long, data is simply discarded.',
  'Energy deficit': 'Power, orbit and thermal are coupled: long eclipses need bigger batteries, and every watt used becomes heat.',
  'Time in safe mode': 'Radiation-heavy orbits cost operating days. Protect electronics and plan margin for anomalies.',
  'Ran out of station-keeping propellant': 'Delta-v is a finite budget for the whole mission, including the quiet years after the main burn.',
  'Oversized power system': 'Margins are good, excess is mass and money you could have spent on science.',
};

export default function Debrief() {
  const app = useApp();
  const m = app.mission, res = app.result;
  const [cf, setCf] = useState<{ baselineScore: number; items: Counterfactual[] } | null>(null);
  const [base, setBase] = useState<{ score: number; mass: number; cost: number } | null>(null);
  useEffect(() => {
    if (!m || !res) return;
    setCf(null);
    const id = setTimeout(() => { try { setCf(counterfactuals(m)); setBase(recommendedBaseline(m)); } catch (e) { console.error(e); } }, 60);
    return () => clearTimeout(id);
  }, [m?.design, m?.seed, res?.at]);
  const diag = useMemo(() => (m ? diagnose(m) : []), [m]);
  if (!m || !res) return <div className="note">No finished mission yet. Run a mission first.</div>;
  const sc = res.score;
  const a = m.a;
  const hist = downsample(m.history, 220);
  const totalPts = Object.values(m.points).reduce((x, y) => x + y, 0);
  const backlog = totalBacklogMB(m);
  const failedObj = sc.objectives.filter((o) => !o.bonus && !o.met);
  const tone = sc.total >= 800 ? 'gr' : sc.total >= 450 ? 'or' : 'rd';
  const better = cf?.items.filter((i) => i.deltaScore > 0 && !i.blockers) ?? [];

  const replay = () => beginMission(app.flight);
  const replayNew = () => { newSeed(); beginMission(null); };
  const tryBaseline = () => { updateDesign(() => autoDesign(m.scenario, m.difficulty, m.design.name + ' (baseline)'), 'Loaded reference baseline design'); go('workshop'); };

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)' }}>
        <Panel title="Mission summary">
          <div className={`score-big ${tone}`}>{sc.total}<span className="muted" style={{ fontSize: 'calc(24px * var(--ts, 1))' }}> / 1000</span></div>
          <h2 className={tone} style={{ margin: '6px 0 10px' }}>{sc.rank}</h2>
          {res.credits !== undefined && <div className="note" style={{ marginBottom: 10, borderLeftColor: 'var(--amber)' }}>Programme credits earned: <b className="or">+{res.credits}</b> (total {app.career.credits}). <button className="btn sm" onClick={() => go('tech')}>Open tech tree</button></div>}
          <dl className="kv"><dt>Mission</dt><dd>{m.design.name}</dd><dt>Scenario</dt><dd>{m.scenario.name} · {m.difficulty}</dd><dt>Duration</dt><dd>{m.day} days (launch + {m.scenario.cruiseDays} cruise + ops)</dd><dt>Result</dt><dd>{m.outcome === 'completed' ? 'completed' : 'FAILED'}</dd><dt>Seed</dt><dd>{m.seed} (reproducible)</dd><dt>Launch</dt><dd>{m.launch.ok ? `success${m.launch.delayDays ? ` after ${m.launch.delayDays} d delay` : ''}` : 'FAILED'} · {m.launch.flown === 'player' ? 'flown by you' : 'autopilot'}</dd></dl>
          {sc.caps.map((c) => <div key={c} className="note" style={{ marginTop: 8, borderColor: 'var(--orange)' }}>{c}</div>)}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={() => go('workshop')}>Modify design</button>
            <button className="btn" onClick={replay}>Replay (same seed)</button>
            <button className="btn" onClick={replayNew}>Replay (new seed)</button>
            <button className="btn" onClick={() => saveBlueprint()}>Save blueprint</button>
          </div>
        </Panel>
        <Panel title="How the score was calculated" pad={false}>
          <table><thead><tr><th>Component</th><th className="num">Weight</th><th className="num">Raw</th><th className="num">Points</th></tr></thead><tbody>
            {sc.components.map((c) => <tr key={c.id}><td><b>{c.label}</b><div className="muted" style={{ fontSize: 'calc(12px * var(--ts, 1))' }}>{c.explanation}</div></td><td className="num">{Math.round(c.weight * 100)}%</td><td className="num">{(c.raw * 100).toFixed(0)}%</td><td className="num">{c.points.toFixed(0)}</td></tr>)}
            <tr><td><b>Subtotal (1000 × Σ weight × raw)</b></td><td /><td /><td className="num"><b>{sc.subtotal.toFixed(0)}</b></td></tr>
            {sc.caps.length > 0 && <tr><td colSpan={3}>After caps</td><td className="num"><b>{sc.total}</b></td></tr>}
          </tbody></table>
        </Panel>
      </div>

      <div className="grid g2">
        <Panel title="Objectives">
          {sc.objectives.map((o) => <div key={o.objective.id} style={{ marginBottom: 8 }}><div className="row"><Badge tone={o.met ? 'gr' : o.objective.mandatory ? 'rd' : 'or'}>{o.met ? 'met' : o.objective.mandatory ? 'FAILED' : 'missed'}</Badge><b>{o.objective.title}</b>{o.bonus && <Badge tone="cy">bonus</Badge>}{o.objective.mandatory && <Badge>mandatory</Badge>}</div><Meter label={<span className="muted">{o.detail}</span>} value={`${Math.round(o.progress * 100)}%`} frac={o.progress} tone={o.met ? 'ok' : o.progress > 0.6 ? 'warn' : 'bad'} /></div>)}
        </Panel>
        <Panel title="Engineering performance" pad={false}>
          <table><tbody>
            <tr><td>Launch mass → operational mass</td><td className="num">{n0(a.mass.total)} kg → {n0(a.mass.dry + m.propKg)} kg</td></tr>
            <tr><td>Power: generation EOL / avg load</td><td className="num">{n0(a.power.genEolW)} / {n0(a.power.avgLoadW)} W (margin {n0(a.power.orbitMarginPct)}%)</td></tr>
            <tr><td>Battery: usable / eclipse need</td><td className="num">{n0(a.power.usableWh)} / {n0(a.power.eclipseEnergyWh)} Wh</td></tr>
            <tr><td>Data generated / transmitted / lost</td><td className="num">{n1(m.generatedMB / 1000)} / {n1(m.downlinkedMB / 1000)} / {n1(m.lostMB / 1000)} GB</td></tr>
            <tr><td>Onboard backlog at end</td><td className="num">{n0(backlog)} MB (peak {n0(m.stats.peakBacklogMB)})</td></tr>
            <tr><td>Communication: mean link / capacity</td><td className="num">{a.comms.linkMean ? n1(a.comms.linkMean.rateBps / 1000) : '—'} kbps / {n0(a.comms.capacityMeanMB)} MB/d</td></tr>
            <tr><td>Budget consumed</td><td className="num">${n1(a.cost.total + m.stats.extraCostM)}M of ${n0(a.cost.budget)}M ({n0(((a.cost.total + m.stats.extraCostM) / a.cost.budget) * 100)}%)</td></tr>
            <tr><td>Propellant left / Δv required</td><td className="num">{n0(m.propKg)} kg · {n0(a.propulsion.dvRequired)} m/s</td></tr>
            <tr><td>Days: operating / safe / brown-out / blackout</td><td className="num">{m.stats.operatingDays} / {m.stats.safeModeDays} / {m.stats.brownoutDays} / {m.stats.blackoutDays}</td></tr>
            <tr><td>Anomalies handled (avg quality)</td><td className="num">{m.responses.length} ({m.stats.qualityCount ? Math.round((m.stats.qualitySum / m.stats.qualityCount) * 100) : '—'}%)</td></tr>
          </tbody></table>
        </Panel>
      </div>

      <Panel title="Scientific performance" pad={false}>
        <table><thead><tr><th>Instrument</th><th>Status</th><th className="num">Quality</th><th className="num">Points</th><th className="num">Coverage km²</th></tr></thead><tbody>
          {a.instruments.map((i) => <tr key={i.slotId}><td>{i.part.name}</td><td><Badge tone={m.inst[i.slotId].status === 'ok' ? 'gr' : m.inst[i.slotId].status === 'degraded' ? 'or' : 'rd'}>{m.inst[i.slotId].status}</Badge></td><td className="num">{Math.round(i.quality * 100)}%</td><td className="num">{n1(m.points[i.slotId])}</td><td className="num">{i.areaKm2Day > 0 ? n0(m.area[i.slotId]) : '—'}</td></tr>)}
          <tr><td><b>Total returned science</b></td><td /><td /><td className="num"><b>{n1(totalPts)}</b></td><td /></tr>
        </tbody></table>
      </Panel>

      <div className="grid g2">
        <LineChart title="Power: generation vs load (W)" series={[{ name: 'generation', color: '#ffb000', data: hist.map((h) => h.genW) }, { name: 'load', color: '#7aa9f7', data: hist.map((h) => h.loadW) }]} xs={hist.map((h) => h.day)} />
        <LineChart title="Storage and daily downlink (MB)" series={[{ name: 'stored', color: '#f2f4f7', data: hist.map((h) => h.storageMB) }, { name: 'downlinked/d', color: '#3fcf6b', data: hist.map((h) => h.downlinkedMB) }]} xs={hist.map((h) => h.day)} />
      </div>

      <AchievementsPanel m={m} score={sc} />
      <Panel title={`Scientific discoveries (${m.discoveries.length})`}>
        {m.discoveries.length === 0 && <div className="muted">No findings crossed the evidence threshold. More returned data of the right kind (instruments plus downlink) is needed.</div>}
        {m.discoveries.map((d) => <div key={d.id} className="sev INFO"><b>{d.title}</b> <span className="dim mono">day {d.day}</span><div className="muted">{d.text}</div></div>)}
      </Panel>

      <Panel title="Failure analysis">
        {diag.map((d, i) => <div key={i} className={`sev ${d.kind === 'critical' ? 'CRITICAL' : d.kind === 'good' ? 'INFO' : 'WARNING'}`}><b>{d.title}</b><div className="muted">{d.detail}</div></div>)}
        {failedObj.length > 0 && <div className="note">Objectives missed: {failedObj.map((o) => `${o.objective.title} (${o.detail})`).join('; ')}</div>}
      </Panel>

      <Panel title="Counterfactual analysis: what if you had decided differently?" right={cf ? <Badge tone="cy">baseline re-simulated: {cf.baselineScore}</Badge> : <Badge>computing…</Badge>}>
        {!cf && <div className="muted anim-pulse">Re-simulating the same mission seed with modified designs…</div>}
        {cf && cf.items.length === 0 && <div className="muted">No variants available for this design.</div>}
        {cf && cf.items.map((i) => (
          <div key={i.id} style={{ borderBottom: '1px solid var(--line)', padding: '8px 0' }}>
            <div className="row"><Badge tone={i.deltaScore > 0 ? 'gr' : i.deltaScore < 0 ? 'rd' : undefined}>{i.deltaScore >= 0 ? '+' : ''}{i.deltaScore} pts</Badge><b>{i.title}</b><span className="muted">{i.change}</span>{i.blockers > 0 && <Badge tone="rd">would not launch</Badge>}</div>
            <div className="muted" style={{ marginTop: 3 }}>{i.statement}</div>
          </div>
        ))}
        <div className="note" style={{ marginTop: 8 }}>Each line is a real re-run of the mission simulator with exactly one change, same seed and default operations policy. It is a comparison tool, not a promise: events and operator decisions would change in a new run.</div>
      </Panel>

      <div className="grid g2">
        <Panel title="Lessons learned">
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {diag.map((d) => LESSONS[d.title] && <li key={d.title}>{LESSONS[d.title]}</li>)}
            {failedObj.map((o) => <li key={o.objective.id}>"{o.objective.title}" failed ({o.detail}): check that an instrument, orbit and downlink exist for it.</li>)}
            <li>A spacecraft is a system: every choice changed mass, power, heat, data and cost together. The best single component rarely yields the best mission.</li>
          </ul>
        </Panel>
        <Panel title="Recommended modifications & alternatives">
          {better.length > 0 ? <ul style={{ margin: 0, paddingLeft: 18 }}>{better.slice(0, 5).map((i) => <li key={i.id}><b>{i.change}</b>: {i.deltaScore >= 0 ? '+' : ''}{i.deltaScore} points, {i.deltaMassKg >= 0 ? '+' : ''}{n0(i.deltaMassKg)} kg, {i.deltaCostM >= 0 ? '+' : '-'}${n1(Math.abs(i.deltaCostM))}M</li>)}</ul> : <p className="muted">{cf ? 'None of the single changes tested improved the score: this design is close to a local optimum for the chosen strategy.' : 'Computing…'}</p>}
          {base && <p style={{ marginTop: 8 }}>Reference baseline for this scenario: <b>{base.score} points</b> ({n0(base.mass)} kg, ${n1(base.cost)}M). Other strategies (different orbit, cheaper launcher, fewer but better instruments) can be equally valid.</p>}
          <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={tryBaseline}>Load reference baseline</button><button className="btn" onClick={() => go('compare')}>Compare saved designs</button></div>
        </Panel>
      </div>
    </div>
  );
}
