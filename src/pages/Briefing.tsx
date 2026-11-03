import { Badge, Panel, Stat, n0 } from '../components/ui';
import { DIFFICULTY } from '../engine/difficulty';
import { go, applyRecommended, useCurrent } from '../store/store';
import { Pips } from './MissionSelect';
import { MissionPatch } from '../components/Emblem';

export default function Briefing() {
  const { app, scenario: s } = useCurrent();
  const rules = DIFFICULTY[app.difficulty];
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row"><Badge tone="cy">Scenario {s.code}</Badge><Badge>{rules.label}</Badge><Pips n={s.difficultyRating} /></div>
      <div className="row" style={{ gap: 16, flexWrap: "nowrap" }}><MissionPatch id={s.id} size={96} label={s.name} /><div><h1>{s.name}</h1><div className="cy" style={{ letterSpacing: '0.06em' }}>{s.tagline}</div></div></div>
      <div className="grid g4">
        <Stat label="Budget" value={`$${n0(s.budgetM * rules.budgetMul)}M`} sub={`${rules.label} ×${rules.budgetMul}`} />
        <Stat label="Max spacecraft mass" value={`${n0(s.maxMassKg)} kg`} sub="wet mass incl. propellant" />
        <Stat label="Launch deadline" value={`${s.deadlineMonths} mo`} sub="development + integration" />
        <Stat label="Mission length" value={`${s.cruiseDays ? s.cruiseDays + ' d cruise + ' : ''}${s.nominalDays} d`} sub={`+ up to ${s.extendedDays} d extended`} />
      </div>
      <div className="grid g2">
        <Panel title="Mission briefing"><p>{s.briefing}</p><h3 style={{ margin: '12px 0 4px' }}>Scientific background</h3><p className="muted">{s.science}</p></Panel>
        <Panel title="Success conditions">
          <ul style={{ margin: 0, paddingLeft: 18 }}>{s.successConditions.map((c) => <li key={c}>{c}</li>)}</ul>
          <h3 style={{ margin: '12px 0 4px' }}>Mandatory engineering requirements</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{s.requirements.map((c) => <li key={c}>{c}</li>)}</ul>
        </Panel>
      </div>
      <Panel title="Scientific objectives" pad={false}>
        <table><thead><tr><th>Objective</th><th>Type</th><th>Weight</th><th>Requirement</th></tr></thead><tbody>
          {[...s.objectives, ...s.bonus].map((o) => <tr key={o.id}><td><b>{o.title}</b><div className="muted">{o.description}</div></td><td>{s.bonus.includes(o) ? <Badge tone="cy">bonus</Badge> : o.mandatory ? <Badge tone="or">mandatory</Badge> : <Badge>optional</Badge>}</td><td className="num">{o.weight}</td><td className="mono muted">{o.type === 'science' ? `${o.points} pts · ${o.domains.slice(0, 3).join(', ')}` : o.type === 'coverage' ? `${Math.round(o.requiredFraction * 100)}% × ${o.repeats}` : `${o.metric} ${o.op} ${o.value}`}</td></tr>)}
        </tbody></table>
      </Panel>
      <div className="note">Scoring: scientific achievement 35% · reliability 20% · resource efficiency 15% · budget efficiency 10% · operations 10% · objective completion 10%. Failing a mandatory objective caps your score at 649 (Partial Success).</div>
      <div className="row">
        <button className="btn primary lg" onClick={() => go('workshop')}>Begin spacecraft design →</button>
        {rules.guidance && <button className="btn lg" onClick={() => { applyRecommended(); go('workshop'); }}>Start from the guided baseline</button>}
        <button className="btn lg" onClick={() => go('select')}>← Other missions</button>
      </div>
    </div>
  );
}
