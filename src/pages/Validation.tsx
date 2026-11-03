import { useState } from 'react';
import { Badge, Panel, Stat } from '../components/ui';
import { launchBlockers, severityCount } from '../engine/feasibilityValidator';
import type { Issue } from '../types';
import { DIFFICULTY } from '../engine/difficulty';
import { applyRecommended, go, toast, useCurrent } from '../store/store';
import { propose } from '../store/team';

/** Flight-controller stations that report GO / CAUTION / NO-GO. Each maps validator "system" labels to a station. */
const STATIONS: { id: string; label: string; systems: string[] }[] = [
  { id: 'FLIGHT', label: 'FLIGHT', systems: ['Spacecraft architecture'] },
  { id: 'STRUCT', label: 'STRUCTURES', systems: ['Structure', 'Mass budget', 'Launch vehicle', 'Launch integration'] },
  { id: 'POWER', label: 'POWER', systems: ['Power subsystem'] },
  { id: 'THERMAL', label: 'THERMAL', systems: ['Thermal control'] },
  { id: 'COMM', label: 'COMM / DATA', systems: ['Communications', 'Onboard computer'] },
  { id: 'GNC', label: 'GNC', systems: ['Attitude control', 'Navigation'] },
  { id: 'PROP', label: 'PROPULSION', systems: ['Propulsion'] },
  { id: 'TRAJ', label: 'TRAJECTORY', systems: ['Orbit', 'Orbit and instruments'] },
  { id: 'SCI', label: 'SCIENCE', systems: ['Science payload'] },
  { id: 'PROG', label: 'PROGRAMME', systems: ['Programme'] },
];

function poll(issues: Issue[]) {
  return STATIONS.map((st) => {
    const mine = issues.filter((i) => st.systems.includes(i.system));
    const crit = mine.filter((i) => i.severity === 'CRITICAL');
    const warn = mine.filter((i) => i.severity === 'WARNING');
    if (crit.length) return { ...st, state: 'nogo' as const, text: 'NO-GO', why: crit[0].title + (crit.length > 1 ? ` (+${crit.length - 1})` : '') };
    if (warn.length) return { ...st, state: 'hold' as const, text: 'CAUTION', why: warn[0].title + (warn.length > 1 ? ` (+${warn.length - 1})` : '') };
    return { ...st, state: 'go' as const, text: 'GO', why: 'Nominal' };
  });
}

function IssueCard({ i, open: o }: { i: Issue; open: boolean }) {
  const [open, setOpen] = useState(o);
  return (
    <div className={`sev ${i.severity}`}>
      <div className="t" onClick={() => setOpen(!open)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(!open); }} aria-expanded={open}>
        <Badge tone={i.severity === 'CRITICAL' ? 'rd' : i.severity === 'WARNING' ? 'or' : 'cy'}>{i.severity}</Badge>
        <b style={{ flex: 1 }}>{i.title}</b>
        {i.blocksLaunch && <Badge tone="rd">blocks launch</Badge>}
        <span className="muted">{i.system}</span><span className="mono">{open ? '−' : '+'}</span>
      </div>
      {open && (
        <dl className="fadein">
          <dt>What</dt><dd>{i.what}</dd><dt>Why it matters</dt><dd>{i.why}</dd><dt>System</dt><dd>{i.system}</dd><dt>What could happen</dt><dd>{i.consequence}</dd>
          <dt>Solutions</dt><dd><ul style={{ margin: 0, paddingLeft: 16 }}>{i.solutions.map((s) => <li key={s}>{s}</li>)}</ul></dd>
        </dl>
      )}
    </div>
  );
}

export default function Validation() {
  const { app, issues, analysis: a } = useCurrent();
  if (!a) return null;
  const sc = severityCount(issues);
  const blockers = launchBlockers(issues);
  const rules = DIFFICULTY[app.difficulty];
  const t = app.team;
  const needApproval = t.active && t.requireApproval && t.role !== 'director' && t.role !== 'all';
  const launchProposal = t.proposals.find((p) => p.kind === 'launch');
  const approved = !needApproval || launchProposal?.status === 'approved';
  const sorted = [...issues].sort((x, y) => ({ CRITICAL: 0, WARNING: 1, INFO: 2 }[x.severity] - { CRITICAL: 0, WARNING: 1, INFO: 2 }[y.severity]));
  const stations = poll(issues);
  const nogo = stations.filter((s) => s.state === 'nogo').length;
  const hold = stations.filter((s) => s.state === 'hold').length;
  return (
    <div className="col" style={{ gap: 14 }}>
      <div><h1>Flight readiness review</h1><div className="muted">Every console reports to the flight director. The rules read live simulation parameters and explain what, why, which system, consequences and fixes.</div></div>
      <div className="panel">
        <div className="ph"><h3>Flight director's GO / NO-GO poll</h3><Badge tone={nogo ? 'rd' : hold ? 'or' : 'gr'}>{nogo ? `${nogo} station(s) NO-GO` : hold ? 'GO WITH CAUTION' : 'ALL STATIONS GO'}</Badge></div>
        <div className="pb">
          <div className="gonogo">{stations.map((s) => <div key={s.id} className={s.state}><div className="st">{s.label}</div><div className="res">{s.text}</div><div className="why">{s.why}</div></div>)}</div>
        </div>
      </div>
      <div className="grid g4">
        <Stat label="Critical" value={sc.critical} tone={sc.critical ? 'rd' : 'gr'} sub={`${blockers.length} block launch`} />
        <Stat label="Warnings" value={sc.warning} tone={sc.warning ? 'or' : 'gr'} sub="performance degradation" />
        <Stat label="Optimisations" value={sc.info} tone="cy" sub="improvement ideas" />
        <Stat label="Launch readiness" value={blockers.length === 0 ? 'GO' : 'NO-GO'} tone={blockers.length === 0 ? 'gr' : 'rd'} sub={blockers.length === 0 ? 'cleared for flight' : `${blockers.length} blocker(s)`} />
      </div>
      <div className="row">
        {rules.guidance && !app.career.enabled && <button className="btn" onClick={applyRecommended}>Apply guided baseline</button>}
        {blockers.length === 0 && !approved && (
          launchProposal ? <Badge tone="or">Launch approval {launchProposal.status} - waiting for the Mission Director</Badge> :
            <button className="btn warn" onClick={() => { propose('launch', `Launch ${app.design?.name} on ${a.vehicle.name}`); toast('Launch approval requested from the Mission Director'); }}>Request launch approval</button>
        )}
        <button className="btn primary lg" disabled={blockers.length > 0 || !approved} onClick={() => go('flight')}>Proceed to launch →</button>
        {blockers.length > 0 && <span className="rd">Resolve the {blockers.length} critical blocker(s) first.</span>}
      </div>
      {sorted.length === 0 && <div className="note">No issues found.</div>}
      {['CRITICAL', 'WARNING', 'INFO'].map((sev) => {
        const list = sorted.filter((i) => i.severity === sev);
        if (!list.length) return null;
        return <Panel key={sev} title={`${sev} (${list.length})`}>{list.map((i) => <IssueCard key={i.id} i={i} open={sev === 'CRITICAL'} />)}</Panel>;
      })}
      <div className="note">Severity: CRITICAL = the mission cannot launch or cannot satisfy a mandatory requirement. WARNING = operation with significant performance degradation. INFO = an optimisation opportunity.</div>
    </div>
  );
}
