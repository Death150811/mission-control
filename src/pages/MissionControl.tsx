import { useEffect, useRef, useState } from 'react';
import { LineChart, downsample } from '../components/Charts';
import { OrbitSceneLazy as OrbitScene } from '../components/three/lazy';
import { Badge, Explain, Meter, Modal, Panel, Stat, n0, n1 } from '../components/ui';
import { PHASE_LABEL, PHASE_ORDER } from '../engine/missionTypes';
import { bestResponse } from '../engine/eventEngine';
import { executeOrbitChange, planOrbitChange, respondToEvent, stepDay, totalBacklogMB } from '../engine/missionSimulator';
import type { MissionState } from '../engine/missionTypes';
import { bumpMission, finishMission, go, useApp } from '../store/store';

const SPEEDS = [1, 5, 20, 60, 200];

export default function MissionControl() {
  const app = useApp();
  const m = app.mission;
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [selLog, setSelLog] = useState(false);
  const acc = useRef(0);
  useEffect(() => {
    if (!m || !running) return;
    const id = setInterval(() => {
      if (m.ended || (m.pending && !m.ops.autoRespond)) { if (m.ended) setRunning(false); return; }
      acc.current += speed * 0.1;
      let n = Math.floor(acc.current); acc.current -= n;
      while (n-- > 0 && !m.ended && (!m.pending || m.ops.autoRespond)) stepDay(m);
      bumpMission();
    }, 100);
    return () => clearInterval(id);
  }, [m, running, speed]);
  useEffect(() => { if (m?.ended) setRunning(false); }, [m?.ended]);
  if (!m) return <div className="note">No mission is running. Launch from the Validation screen.</div>;

  const a = m.a;
  const last = m.history[m.history.length - 1];
  const hist = downsample(m.history, 220);
  const distAU = last?.distanceAU ?? a.orbit.fixedCommDistanceM / 1.495978707e11;
  const delay = (distAU * 1.495978707e11) / 299792458;
  const backlog = totalBacklogMB(m);
  const totalPoints = Object.values(m.points).reduce((x, y) => x + y, 0);
  const cumPts = (() => { let s = 0; return hist.map((h) => (s += h.points)); })();
  // exact cumulative on full history, then downsample
  const fullCum = (() => { let s = 0; return m.history.map((h) => (s += h.points)); })();
  void cumPts;
  const cumSeries = downsample(fullCum, 220);
  const phaseIdx = PHASE_ORDER.indexOf(m.phase);
  const capWh = a.power.batteryWh * m.mods.battHealth;
  const dayTotal = m.extendedEnd;
  const pending = m.pending;

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row">
        <div><h1>Mission control · {m.design.name}</h1><div className="muted">{m.scenario.name} · day <b className="cy mono">{m.day}</b> / {dayTotal} · seed {m.seed}</div></div>
        <span className="spacer" />
        <button className="btn primary" disabled={m.ended || !!pending} onClick={() => setRunning(!running)}>{running ? 'Pause' : m.day === 0 ? 'Begin operations' : 'Resume'}</button>
        <button className="btn" disabled={m.ended || !!pending} onClick={() => { stepDay(m); bumpMission(); }}>+1 day</button>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Simulation speed">{SPEEDS.map((s) => <option key={s} value={s}>{s} days/s</option>)}</select>
        <div className="clock"><small>MET</small>D+{String(m.day).padStart(3, "0")}</div><label className="row" style={{ gap: 4 }}><input type="checkbox" checked={m.ops.autoRespond} onChange={(e) => { m.ops.autoRespond = e.target.checked; if (e.target.checked && m.pending) respondToEvent(m, bestResponse(m.pending)); bumpMission(); }} />auto flight director</label>
        <button className={`btn ${m.ended ? 'primary' : 'warn'}`} onClick={() => { finishMission(); }}>{m.ended ? 'Engineering debrief →' : 'End mission & debrief'}</button>
      </div>
      <div className="phase-line">{PHASE_ORDER.map((p, i) => <div key={p} className={i === phaseIdx ? 'on' : i < phaseIdx ? 'past' : ''}>{PHASE_LABEL[p]}</div>)}</div>
      {m.ended && <div className={`note ${m.outcome === 'failed' ? 'rd' : 'gr'}`} style={{ borderColor: m.outcome === 'failed' ? 'var(--red)' : 'var(--green)' }}><b>{m.outcome === 'failed' ? 'MISSION FAILED' : 'MISSION CONCLUDED'}</b> · {m.endReason}</div>}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 1fr)' }}>
        <div className="col" style={{ minWidth: 0 }}>
          <OrbitScene info={a.orbit} a={a} lightSeconds={delay} height={330} running={running} speed={Math.min(3, 0.6 + speed / 40)} label={`${a.orbit.def.name.toUpperCase()} · ${m.phase.toUpperCase()}`} />
          <div className="grid g4">
            <Stat label="Battery" value={`${n0(last?.socPct ?? 90)}%`} sub={`${n0(m.socWh)} / ${n0(capWh)} Wh`} tone={(last?.socPct ?? 90) < 25 ? 'rd' : (last?.socPct ?? 90) < 50 ? 'or' : 'gr'} />
            <Stat label={<>Power <Explain topic="powerMargin" /></>} value={`${n0(last?.genW ?? 0)} W`} sub={`load ${n0(last?.loadW ?? 0)} W · shed ${n0((last?.shed ?? 0) * 100)}%`} />
            <Stat label="Onboard data" value={`${n0(backlog)} MB`} sub={`of ${n0(a.data.storageMB / 1000)} GB · lost ${n0(m.lostMB)} MB`} tone={backlog > a.data.storageMB * 0.7 ? 'or' : undefined} />
            <Stat label={<>Downlink <Explain topic="linkBudget" /></>} value={`${n1(last?.rateKbps ?? 0)} kbps`} sub={`${n0(last?.capacityMB ?? 0)} MB/d cap · ${n1(distAU)} AU · ${delay < 120 ? n1(delay) + ' s' : n1(delay / 60) + ' min'}`} />
            <Stat label="Propellant" value={`${n0(m.propKg)} kg`} sub={`of ${n0(a.mass.propellant)} kg`} tone={m.propKg < 3 && a.mass.propellant > 0 ? 'or' : undefined} />
            <Stat label="Science points" value={n1(totalPoints)} sub="only downlinked data counts" tone="cy" />
            <Stat label="Data returned" value={`${n1(m.downlinkedMB / 1000)} GB`} sub={`generated ${n1(m.generatedMB / 1000)} GB`} />
            <Stat label="Operating days" value={m.stats.operatingDays} sub={`safe ${m.stats.safeModeDays} · brown-out ${m.stats.brownoutDays}`} />
          </div>
          <div className="grid g2">
            <LineChart title="Power generation vs load (W)" series={[{ name: 'generation', color: '#ffb000', data: hist.map((h) => h.genW) }, { name: 'load', color: '#7aa9f7', data: hist.map((h) => h.loadW) }]} xs={hist.map((h) => h.day)} />
            <LineChart title="Battery charge (%)" series={[{ name: 'state of charge', color: '#3fcf6b', data: hist.map((h) => h.socPct) }]} yMax={100} xs={hist.map((h) => h.day)} />
            <LineChart title="Onboard storage (MB)" series={[{ name: 'stored', color: '#f2f4f7', data: hist.map((h) => h.storageMB) }]} xs={hist.map((h) => h.day)} />
            <LineChart title="Daily data (MB)" series={[{ name: 'generated', color: '#ffb000', data: hist.map((h) => h.generatedMB) }, { name: 'downlinked', color: '#7aa9f7', data: hist.map((h) => h.downlinkedMB) }]} xs={hist.map((h) => h.day)} />
            <LineChart title="Cumulative science points" series={[{ name: 'points', color: '#7aa9f7', data: cumSeries }]} xs={hist.map((h) => h.day)} />
            <LineChart title="Propellant (kg) / link rate (kbps)" series={[{ name: 'propellant', color: '#ffd166', data: hist.map((h) => h.propKg) }]} xs={hist.map((h) => h.day)} />
          </div>
        </div>
        <div className="col">
          <Panel title="Instruments & operations">
            {a.instruments.map((i) => {
              const st = m.inst[i.slotId];
              const duty = m.ops.duty[i.slotId] ?? 1;
              const sp = m.mods.spike[i.slotId];
              return (
                <div key={i.slotId} style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
                  <div className="row"><b style={{ flex: 1, fontSize: 'calc(13px * var(--ts, 1))' }}>{i.part.name}</b>{sp && sp.mult > 1 && <Badge tone="cy">data surge</Badge>}<Badge tone={st.status === 'ok' ? 'gr' : st.status === 'degraded' ? 'or' : 'rd'}>{st.status}</Badge></div>
                  <div className="row"><input type="range" min={0} max={1} step={0.05} value={duty} disabled={st.status === 'failed' || m.ended} onChange={(e) => { m.ops.duty[i.slotId] = Number(e.target.value); bumpMission(); }} aria-label={`${i.part.name} duty cycle`} style={{ flex: 1 }} /><span className="mono" style={{ width: 40, textAlign: 'right' }}>{Math.round(duty * 100)}%</span></div>
                  <div className="dim mono" style={{ fontSize: 'calc(11.5px * var(--ts, 1))' }}>{n1(m.points[i.slotId])} pts · buffer {n0(m.buffers[i.slotId])} MB · {i.part.powerW} W · {n0(i.dataMBd)} MB/d</div>
                </div>
              );
            })}
            <div className="grid g2" style={{ marginTop: 10 }}>
              <label className="col"><span className="muted">Power priority</span><select value={m.ops.priority} onChange={(e) => { m.ops.priority = e.target.value as never; bumpMission(); }}><option value="science">science first</option><option value="balanced">balanced</option><option value="survival">survival (keep battery)</option></select></label>
              <label className="col"><span className="muted">Downlink order</span><select value={m.ops.downlink} onChange={(e) => { m.ops.downlink = e.target.value as never; bumpMission(); }}><option value="value">highest value per MB</option><option value="proportional">proportional</option><option value="priority">priority instrument</option></select></label>
            </div>
            {m.ops.downlink === 'priority' && <label className="col" style={{ marginTop: 6 }}><span className="muted">Priority instrument</span><select value={m.ops.priorityInstrument ?? ''} onChange={(e) => { m.ops.priorityInstrument = e.target.value || null; bumpMission(); }}><option value="">(none)</option>{a.instruments.map((i) => <option key={i.slotId} value={i.slotId}>{i.part.name}</option>)}</select></label>}
            <div className="note" style={{ marginTop: 8 }}>Instruments only produce science when powered, in view, within pointing/thermal limits, with storage free and a downlink to send the data home.</div>
          </Panel>
          <Panel title="Mission log" pad={false}>
            <div className="log" style={{ padding: 8, maxHeight: selLog ? 520 : 280 }}>
              {[...m.log].reverse().slice(0, 120).map((l, i) => <div key={i} className={l.kind}><span className="d">D{l.day}</span>{l.text}</div>)}
            </div>
            <div className="row" style={{ padding: 6 }}><button className="btn sm" onClick={() => setSelLog(!selLog)}>{selLog ? 'Shrink' : 'Expand'}</button><span className="dim">{m.responses.length} anomalies handled</span></div>
          </Panel>
          {!m.ended && ['circular', 'sunsync', 'asteroid'].includes(a.orbit.def.kind) && <OrbitManeuver m={m} />}
          <Meter label="Mission progress" value={`${Math.round((m.day / dayTotal) * 100)}%`} frac={m.day / dayTotal} />
        </div>
      </div>
      {pending && (
        <Modal title={<><Badge tone={pending.severity === 'major' ? 'rd' : 'or'}>{pending.severity}</Badge> {pending.title}</>}>
          <p>{pending.description}</p>
          <div className="note" style={{ marginBottom: 10 }}>{pending.educational}</div>
          <div className="col">
            {pending.responses.map((r) => (
              <button key={r.id} className="card" style={{ textAlign: 'left' }} onClick={() => { respondToEvent(m, r.id); bumpMission(); }}>
                <b>{r.label}</b>
                <div className="muted" style={{ fontSize: 'calc(13px * var(--ts, 1))' }}>{r.desc}{app.difficulty === 'beginner' && r.quality >= 0.95 ? ' · recommended' : ''}</div>
              </button>
            ))}
          </div>
          <div className="dim" style={{ marginTop: 8, fontSize: 'calc(12px * var(--ts, 1))' }}>Operations paused until you respond. Response quality counts toward your operational score.</div>
        </Modal>
      )}
      <div className="row"><button className="btn" onClick={() => go('workshop')}>Back to design</button></div>
    </div>
  );
}

/** KSP-style "change your orbit" panel: altitude (Hohmann) and inclination (plane change) burns paid for with real propellant. */
function OrbitManeuver({ m }: { m: MissionState }) {
  const def = m.a.orbit.def;
  const cur = m.design.orbit;
  const [alt, setAlt] = useState(cur.perigeeKm);
  const [inc, setInc] = useState(cur.incDeg);
  const [msg, setMsg] = useState('');
  const plan = planOrbitChange(m, alt, def.kind === 'sunsync' ? undefined : inc);
  const lo = def.periRange[0], hi = def.periRange[1];
  const step = def.bodyId === 'asteroid' ? 0.1 : hi > 5000 ? 100 : 10;
  return (
    <Panel title="Orbit manoeuvre">
      <div className="muted" style={{ fontSize: 'calc(13px * var(--ts, 1))', marginBottom: 6 }}>Current orbit: {cur.perigeeKm.toFixed(def.bodyId === 'asteroid' ? 1 : 0)} km · inclination {cur.incDeg.toFixed(1)}° · period {(m.a.orbit.periodS / 60).toFixed(1)} min. A new altitude changes coverage, resolution, eclipse and contact.</div>
      <label className="col"><span>Altitude: <b className="mono">{alt.toFixed(def.bodyId === 'asteroid' ? 1 : 0)} km</b></span><input type="range" min={lo} max={hi} step={step} value={alt} onChange={(e) => { setAlt(Number(e.target.value)); setMsg(''); }} /></label>
      {def.kind !== 'sunsync' && def.incRange[0] !== def.incRange[1] && <label className="col"><span>Inclination: <b className="mono">{inc.toFixed(1)}°</b></span><input type="range" min={def.incRange[0]} max={def.incRange[1]} step={0.5} value={inc} onChange={(e) => { setInc(Number(e.target.value)); setMsg(''); }} /></label>}
      <dl className="kv" style={{ marginTop: 6 }}><dt>Δv (Hohmann + plane change)</dt><dd>{plan.dvMps.toFixed(1)} m/s</dd><dt>Propellant</dt><dd className={plan.ok || plan.dvMps === 0 ? '' : 'rd'}>{plan.propKg.toFixed(1)} of {m.propKg.toFixed(1)} kg</dd><dt>New period</dt><dd>{plan.newPeriodMin ? plan.newPeriodMin.toFixed(1) + ' min' : '—'}</dd></dl>
      <div className="row" style={{ marginTop: 8 }}><button className="btn primary" disabled={!plan.ok} onClick={() => { setMsg(executeOrbitChange(m, alt, def.kind === 'sunsync' ? undefined : inc)); bumpMission(); }}>Execute burn</button><span className="dim" style={{ fontSize: 'calc(12px * var(--ts, 1))' }}>{msg || (plan.ok ? '' : plan.why)}</span></div>
    </Panel>
  );
}
