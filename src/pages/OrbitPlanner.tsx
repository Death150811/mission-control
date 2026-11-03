import { useMemo, useState } from 'react';
import { OrbitSceneLazy as OrbitScene } from '../components/three/lazy';
import { Badge, Explain, Meter, Panel, n0, n1 } from '../components/ui';
import { ORBITS, ORBIT_LIST } from '../data/orbits';
import { clampSelection, defaultSelection, describeOrbit, hohmann, planeChangeDv, previewBurn } from '../engine/orbitalMechanics';
import { canEdit, go, toast, updateDesign, useCurrent } from '../store/store';
import { setEditing } from '../store/team';
import { G0 } from '../engine/physics';

export default function OrbitPlanner() {
  const { app, analysis: a, scenario } = useCurrent();
  const [burnAt, setBurnAt] = useState<'periapsis' | 'apoapsis'>('periapsis');
  const [burn, setBurn] = useState(0);
  const [dI, setDI] = useState(10);
  const [hAlt, setHAlt] = useState(800);
  const info = a?.orbit;
  const prev = useMemo(() => (info && burn !== 0 && info.def.kind !== 'halo' ? previewBurn(info, burnAt, burn) : null), [info, burn, burnAt]);
  if (!a || !app.design || !info) return null;
  const sel = app.design.orbit;
  const def = info.def;
  const options = ORBIT_LIST.filter((o) => (app.mode === 'sandbox' ? o.targets.includes(scenario.target) : scenario.allowedOrbitIds.includes(o.id)));
  const can = canEdit(app.team, 'orbit');
  const set = (patch: Partial<typeof sel>) => { if (!can) { toast('Orbit selection belongs to the Flight Operations Officer.'); return; } setEditing('orbit'); updateDesign((d) => ({ ...d, orbit: clampSelection({ ...d.orbit, ...patch }) }), `Orbit: ${patch.orbitId ?? def.short} ${patch.perigeeKm ? n0(patch.perigeeKm) + ' km' : ''}`); };
  const chooseOrbit = (id: string) => { if (!can) { toast('Orbit selection belongs to the Flight Operations Officer.'); return; } updateDesign((d) => ({ ...d, orbit: defaultSelection(id) }), `Selected orbit ${ORBITS[id].name}`); };
  const circular = def.kind === 'circular' || def.kind === 'sunsync' || def.kind === 'asteroid';
  const T = info.periodS;
  const body = info.body;
  const R = body.radius / 1000;
  const hohm = def.kind !== 'halo' ? hohmann(body.mu, info.rpM, info.rpM * (1 + hAlt / Math.max(info.perigeeAltM / 1000 + R, 1) * 0.0)) : null;
  void hohm;
  const rA = info.rpM, rB = (R + hAlt) * 1000;
  const h = def.kind !== 'halo' && def.bodyId !== 'asteroid' ? hohmann(body.mu, rA, rB) : null;
  const dvAvail = a.propulsion.dvAvailable, dvReq = a.propulsion.dvRequired;
  const previewDvCost = Math.abs(burn);
  const extra = previewDvCost / Math.max(dvAvail - dvReq, 1);
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 400px)' }}>
      <div className="col" style={{ minWidth: 0 }}>
        <div className="row"><div><h1>Orbit Planner</h1><div className="muted">Central body: <b>{body.name}</b> (μ = {body.mu.toExponential(4)} m³/s²). Changes update every calculation.</div></div><span className="spacer" /><button className="btn" onClick={() => go('launch')}>Launch center →</button></div>
        <OrbitScene info={info} a={a} preview={prev && !prev.escape ? { rpM: prev.rpM, raM: prev.raM } : null} lightSeconds={a.comms.delayS} height={430} />
        <div className="grid g2">
          <Panel title="Orbit type">
            <div className="col">
              {options.map((o) => (
                <div key={o.id} className={`card ${o.id === def.id ? 'sel' : ''}`} onClick={() => chooseOrbit(o.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') chooseOrbit(o.id); }}>
                  <div className="row"><b style={{ flex: 1 }}>{o.name}</b><Badge>{o.kind}</Badge></div>
                  <div className="muted" style={{ fontSize: 'calc(13px * var(--ts, 1))' }}>{o.summary}</div>
                </div>
              ))}
              {options.length === 0 && <div className="note">No orbit options for this target.</div>}
            </div>
          </Panel>
          <Panel title="Orbit parameters">
            {def.periRange[0] !== def.periRange[1] ? (
              <>
                <label className="col"><span>{def.apoRange ? 'Periapsis altitude' : 'Altitude'}: <b className="mono">{def.bodyId === 'asteroid' ? n1(sel.perigeeKm) : n0(sel.perigeeKm)} km</b></span>
                  <input type="range" min={def.periRange[0]} max={def.periRange[1]} step={def.bodyId === 'asteroid' ? 0.1 : def.periRange[1] > 5000 ? 100 : 10} value={sel.perigeeKm} onChange={(e) => set({ perigeeKm: Number(e.target.value), apogeeKm: circular ? Number(e.target.value) : sel.apogeeKm })} /></label>
                {def.apoRange && <label className="col"><span>Apoapsis altitude: <b className="mono">{n0(sel.apogeeKm)} km</b></span>
                  <input type="range" min={def.apoRange[0]} max={def.apoRange[1]} step={50} value={sel.apogeeKm} onChange={(e) => set({ apogeeKm: Number(e.target.value) })} /></label>}
              </>
            ) : <div className="muted">Altitude is fixed for this orbit type ({n0(def.periRange[0])} km).</div>}
            {def.incRange[0] !== def.incRange[1] && def.kind !== 'sunsync' ? (
              <label className="col"><span>Inclination: <b className="mono">{n1(sel.incDeg)}°</b> {def.bodyId === 'earth' && <span className="dim">(min {def.incRange[0]}° from the launch site)</span>}</span>
                <input type="range" min={def.incRange[0]} max={def.incRange[1]} step={0.5} value={sel.incDeg} onChange={(e) => set({ incDeg: Number(e.target.value) })} /></label>
            ) : <div className="muted">Inclination {n1(info.incDeg)}° {def.kind === 'sunsync' ? '(set by altitude: sun-synchronous)' : '(fixed)'}</div>}
            {def.kind === 'sunsync' && (
              <label className="col" style={{ marginTop: 8 }}><span>Local time of the ascending node: <b className="mono">{(sel.ltanH ?? 10.5).toFixed(1)} h</b> <span className="dim">· beta angle {n0(info.betaDeg)}° · eclipse {n1(info.eclipseS / 60)} min</span></span>
                <input type="range" min={6} max={18} step={0.25} value={sel.ltanH ?? 10.5} onChange={(e) => set({ ltanH: Number(e.target.value) })} aria-label="Local time of ascending node" />
                <span className="dim" style={{ fontSize: 'calc(12px * var(--ts, 1))' }}>6:00 (dawn-dusk) removes eclipses but leaves long shadows; 12:00 gives the longest eclipses; 10:30 is the classic imaging compromise. Illumination quality: {n0(info.illum * 100)}%.</span></label>
            )}
            <h3 style={{ margin: '12px 0 4px' }}>Why this orbit?</h3>
            <div className="chips">{def.advantages.map((x) => <Badge key={x} tone="gr">+ {x}</Badge>)}</div>
            <div className="chips" style={{ marginTop: 4 }}>{def.limitations.map((x) => <Badge key={x} tone="or">− {x}</Badge>)}</div>
            {info.notes.map((n) => <div className="note" key={n} style={{ marginTop: 6 }}>{n}</div>)}
          </Panel>
        </div>
        <Panel title={<>Maneuver planner · delta-v budget <Explain topic="deltaV" /></>}>
          {def.kind === 'halo' ? <p className="muted">Halo trajectories use small station-keeping burns (about {n0(info.stationKeepingDvPerYear)} m/s per year) rather than classical Hohmann transfers.</p> : (
            <div className="grid g3">
              <div className="col">
                <b>Impulsive burn preview</b>
                <div className="chips">{(['periapsis', 'apoapsis'] as const).map((w) => <button key={w} className={`chip ${burnAt === w ? 'on' : ''}`} onClick={() => setBurnAt(w)}>at {w}</button>)}</div>
                <label className="col"><span>Prograde Δv: <b className="mono">{burn} m/s</b></span><input type="range" min={-Math.round(Math.min(1500, info.vPeriMps * 0.5))} max={Math.round(Math.min(1500, info.vPeriMps * 0.5))} step={5} value={burn} onChange={(e) => setBurn(Number(e.target.value))} /></label>
                {prev ? (prev.escape ? <div className="rd">This burn exceeds escape velocity.</div> : <dl className="kv"><dt>New periapsis</dt><dd>{n0((prev.rpM - body.radius) / 1000)} km</dd><dt>New apoapsis</dt><dd>{n0((prev.raM - body.radius) / 1000)} km</dd><dt>New period</dt><dd>{n1(prev.periodS / 60)} min</dd><dt>Eccentricity</dt><dd>{prev.e.toFixed(3)}</dd><dt>Propellant</dt><dd>{a.parts.engine ? n1(a.mass.total * (1 - Math.exp(-Math.abs(burn) / (a.parts.engine.isp * G0)))) + ' kg' : '—'}</dd></dl>) : <div className="muted">Move the slider: the orange dashed orbit shows the result. (Prediction uses two-body vis-viva, an approximation.)</div>}
                {burn !== 0 && <Meter label="Share of spare Δv" value={`${n0(extra * 100)}%`} frac={extra} tone={extra > 1 ? 'bad' : extra > 0.6 ? 'warn' : 'ok'} />}
              </div>
              <div className="col">
                <b>Hohmann transfer to another altitude</b>
                <label className="col"><span>Target altitude: <b className="mono">{n0(hAlt)} km</b></span><input type="range" min={def.periRange[0] > 1 ? Math.max(100, def.periRange[0]) : 100} max={Math.max(def.periRange[1] * 4, 2000)} step={50} value={hAlt} onChange={(e) => setHAlt(Number(e.target.value))} /></label>
                {h ? <dl className="kv"><dt>Burn 1</dt><dd>{n0(h.dv1)} m/s</dd><dt>Burn 2</dt><dd>{n0(h.dv2)} m/s</dd><dt>Total Δv</dt><dd><b>{n0(h.total)} m/s</b></dd><dt>Transfer time</dt><dd>{n1(h.transferTimeS / 60)} min</dd></dl> : <div className="muted">Not available for this orbit.</div>}
                <div className="note">Real equations: Hohmann transfer, vis-viva. Circular start orbit assumed.</div>
              </div>
              <div className="col">
                <b>Plane change</b>
                <label className="col"><span>Inclination change: <b className="mono">{dI}°</b></span><input type="range" min={1} max={90} value={dI} onChange={(e) => setDI(Number(e.target.value))} /></label>
                <dl className="kv"><dt>Δv = 2 v sin(Δi/2)</dt><dd>{n0(planeChangeDv(info.vPeriMps, dI))} m/s</dd></dl>
                <div className="note">Changing inclination is expensive: a 60° change costs as much as the orbital speed itself. This is why you choose the right inclination before launch.</div>
                <Meter label="Spare Δv in your design" value={`${n0(Math.max(0, dvAvail - dvReq))} m/s`} frac={Math.max(0, dvAvail - dvReq) / Math.max(dvAvail, 1)} tone={dvAvail < dvReq ? 'bad' : 'ok'} />
              </div>
            </div>
          )}
        </Panel>
      </div>
      <div className="col">
        <Panel title={<>Computed orbit <Explain topic="orbitalPeriod" /></>}>
          <code className="eq">T = 2π √(a³ / μ)</code>
          <div className="muted" style={{ fontSize: 'calc(13px * var(--ts, 1))' }}>The period grows with the orbit radius a (planet radius + altitude) and shrinks with a stronger gravity μ. With a = {n0(info.aM / 1000)} km and μ({body.name}) → <b className="cy mono">T = {n1(T / 60)} min</b> ({(T / 3600).toFixed(2)} h).</div>
          <dl className="kv" style={{ marginTop: 8 }}>
            <dt>Semi-major axis</dt><dd>{n0(info.aM / 1000)} km</dd><dt>Eccentricity</dt><dd>{info.e.toFixed(3)}</dd>
            <dt>Speed (periapsis / apoapsis)</dt><dd>{n0(info.vPeriMps)} / {n0(info.vApoMps)} m/s</dd><dt>Inclination</dt><dd>{n1(info.incDeg)}°</dd>
            <dt>Eclipse per orbit</dt><dd>{n1(info.eclipseS / 60)} min ({n0(info.eclipseFrac * 100)}%)</dd><dt>Charge cycles per year</dt><dd>{n0(info.cyclesPerYear)}</dd>
            <dt>Contact per day</dt><dd>{n0(a.comms.contactS / 60)} min</dd><dt>One-way light time</dt><dd>{a.comms.delayS < 120 ? `${n1(a.comms.delayS)} s` : `${n1(a.comms.delayS / 60)} min`}</dd>
            <dt>Latitude reach</dt><dd>{n0(a.science.coverageFractionMax * 100)}% of surface</dd><dt>Revisit time</dt><dd>{isFinite(a.science.revisitDays) ? `${n1(a.science.revisitDays)} d` : '—'}</dd>
            <dt>Radiation dose (2.5 mm Al)</dt><dd>{n1(info.doseKradYr)} krad/yr</dd><dt>Beta angle</dt><dd>{n0(info.betaDeg)}°</dd>{info.departDay !== undefined && <><dt>Departure C3 (launch day {n0(info.departDay)})</dt><dd>{n1(info.c3Eff / 1e6)} km²/s²</dd></>}{a.propulsion.lifetimeYears < 500 && <><dt>Decay lifetime, no reboost</dt><dd>{n1(a.propulsion.lifetimeYears)} years</dd></>}
          </dl>
        </Panel>
        <Panel title="Delta-v at this destination">
          <dl className="kv"><dt>Launcher: ascent to 200 km</dt><dd>{n0(a.launch.reqDv - info.launchParkingDvMps - 120)} m/s</dd><dt>Launcher: parking → destination</dt><dd>{n0(info.launchParkingDvMps)} m/s</dd><dt>Spacecraft: orbit insertion</dt><dd>{n0(info.insertionDvMps)} m/s</dd><dt>Spacecraft: station-keeping / yr</dt><dd>{n1(a.propulsion.skPerYear)} m/s</dd></dl>
          <Meter label="Your delta-v" value={`${n0(a.propulsion.dvAvailable)} / ${n0(a.propulsion.dvRequired)} m/s`} frac={a.propulsion.dvAvailable / Math.max(a.propulsion.dvRequired * 1.5, 1)} tone={a.propulsion.dvAvailable < a.propulsion.dvRequired ? 'bad' : 'ok'} mark={1 / 1.5} />
          <div className="note">Higher orbits cost the launcher more energy; elliptical Mars capture saves spacecraft propellant but changes the observing geometry.</div>
        </Panel>
      </div>
    </div>
  );
}
