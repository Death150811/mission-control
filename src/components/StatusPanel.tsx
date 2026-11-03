import { Explain, Meter, n0, n1 } from './ui';
import { launchBlockers, severityCount } from '../engine/feasibilityValidator';
import { go, useCurrent } from '../store/store';

/** Persistent mission status panel: every number comes from the shared Analysis object. */
export default function StatusPanel() {
  const { analysis: a, issues, scenario, app } = useCurrent();
  if (!a) return null;
  const sc = severityCount(issues);
  const blockers = launchBlockers(issues).length;
  const massLimit = Math.min(scenario.maxMassKg, a.launch.capacityKg || scenario.maxMassKg);
  const massFrac = a.mass.total / massLimit;
  const budgetFrac = a.cost.total / a.cost.budget;
  const powTone = a.power.orbitMarginPct < 0 ? 'bad' : a.power.orbitMarginPct < 10 ? 'warn' : 'ok';
  const dataFrac = a.comms.capacityMeanMB > 0 ? a.data.compressedMBd / a.comms.capacityMeanMB : a.data.compressedMBd > 0 ? 2 : 0;
  const dvFrac = a.propulsion.dvRequired > 0 ? a.propulsion.dvAvailable / a.propulsion.dvRequired : 1;
  return (
    <aside className="side" aria-label="Mission status">
      <div className="row" style={{ marginBottom: 8 }}>
        <h3 style={{ flex: 1 }}>Mission status</h3>
        <button className="btn sm" onClick={() => go('validation')} title="Open engineering validation">
          {blockers > 0 ? <span className="rd">{blockers} blocker{blockers > 1 ? 's' : ''}</span> : sc.warning > 0 ? <span className="or">{sc.warning} warn</span> : <span className="gr">ready</span>}
        </button>
      </div>
      <Meter label={<>Mass <Explain topic="massMatters" /></>} value={`${n0(a.mass.total)} / ${n0(massLimit)} kg`} frac={massFrac} tone={massFrac > 1 ? 'bad' : massFrac > 0.9 ? 'warn' : 'ok'} hint={`dry ${n0(a.mass.dry)} kg + propellant ${n0(a.mass.propellant)} kg · ${a.vehicle.name} to ${a.orbit.def.short}: ${n0(a.launch.capacityKg)} kg`} />
      <Meter label={<>Power margin <Explain topic="powerMargin" /></>} value={`${n0(a.power.orbitMarginPct)}%`} frac={Math.max(0, Math.min(1, (a.power.orbitMarginPct + 20) / 120))} tone={powTone} hint={`gen EOL ${n0(a.power.genEolW)} W · load ${n0(a.power.avgLoadW)} W avg / ${n0(a.power.peakLoadW)} W peak · battery ${n0(a.power.usableWh)} Wh usable`} />
      <Meter label="Budget" value={`${n1(a.cost.total)} / ${n0(a.cost.budget)} $M`} frac={budgetFrac} tone={budgetFrac > 1 ? 'bad' : budgetFrac > 0.95 ? 'warn' : 'ok'} hint={`parts ${n1(a.cost.parts)} · launch ${n1(a.cost.launch)} · ops ${n1(a.cost.ops)} · reserve ${n1(a.cost.contingency)}`} />
      <Meter label="Data vs downlink" value={`${n0(a.data.compressedMBd)} / ${n0(a.comms.capacityMeanMB)} MB/d`} frac={dataFrac} tone={dataFrac > 1 ? 'bad' : dataFrac > 0.7 ? 'warn' : 'ok'} hint={`storage ${n1(a.data.storageDays)} days · contact ${n1(a.comms.contactFraction * 100)}% of day`} />
      <Meter label={<>Delta-v <Explain topic="deltaV" /></>} value={`${n0(a.propulsion.dvAvailable)} / ${n0(a.propulsion.dvRequired)} m/s`} frac={dvFrac / 1.5} tone={dvFrac < 1 ? 'bad' : dvFrac < 1 + (app.difficulty === 'beginner' ? 0.05 : 0.1) ? 'warn' : 'ok'} mark={1 / 1.5} />
      <Meter label="Schedule" value={`${n1(a.schedule.totalMonths)} / ${a.schedule.deadline} mo`} frac={a.schedule.totalMonths / a.schedule.deadline} tone={a.schedule.totalMonths > a.schedule.deadline ? 'bad' : a.schedule.totalMonths > a.schedule.deadline * 0.9 ? 'warn' : 'ok'} />
      <dl className="kv" style={{ marginTop: 6 }}>
        <dt>Orbit</dt><dd>{a.orbit.def.short} · T {n1(a.orbit.periodS / 60)} min</dd>
        <dt>Link</dt><dd>{a.comms.linkMean ? `${n1(a.comms.linkMean.rateBps / 1000)} kbps` : '—'}</dd>
        <dt>Science</dt><dd>{n1(a.science.potentialPerDay)} pts/day</dd>
        <dt>Thermal</dt><dd>×{a.thermal.ratio.toFixed(2)}</dd>
        <dt>Reliability</dt><dd>{n0(a.reliability.critical * 100)}%</dd>
      </dl>
      <div className="note" style={{ marginTop: 10 }}>Updates instantly with every change. Mission: <b>{scenario.name}</b> · {app.difficulty.toUpperCase()}</div>
    </aside>
  );
}
