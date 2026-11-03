import LaunchWindowPanel from '../components/LaunchWindowPanel';
import RocketStack from '../components/RocketStack';
import { RocketSceneLazy as RocketScene } from '../components/three/lazy';
import { Badge, Explain, Illustrative, Meter, Panel, n0, n1 } from '../components/ui';
import { BOOSTERS, LAUNCH_VEHICLES, STAGES, STAGE_OPTIONS_1, STAGE_OPTIONS_2, buildCustomVehicle, getVehicle, vehicleCostM } from '../data/launchVehicles';
import { ORBIT_LIST } from '../data/orbits';
import { nodeForPart } from '../data/techTree';
import { launchRequirement, payloadCapacityKg, stackDv } from '../engine/launch';
import { defaultSelection, describeOrbit } from '../engine/orbitalMechanics';
import { canEdit, go, partLocked, toast, updateDesign, useCurrent } from '../store/store';
import { propose, setEditing } from '../store/team';

const DEFAULT_STACK: [string, string] = ['stg-m1', 'stg-m2'];

export default function LaunchCenter() {
  const { app, analysis: a } = useCurrent();
  if (!a || !app.design) return null;
  const d = app.design;
  const cur = a.vehicle;
  const can = canEdit(app.team, 'vehicle');
  const choose = (id: string) => {
    if (!can) { toast('Launch vehicle selection belongs to the Flight Operations Officer.'); return; }
    if (partLocked(app, id)) { toast(`Locked: research "${nodeForPart(id)?.name}" in the Technology tree.`); return; }
    if (app.team.active && app.team.requireApproval && app.team.role !== 'director' && app.team.role !== 'all') { propose('vehicle', `Switch launch vehicle to ${getVehicle(id, d.customStages ?? DEFAULT_STACK, d.boosters).name}`); toast('Approval requested from the Mission Director.'); return; }
    setEditing('vehicle');
    updateDesign((x) => ({ ...x, vehicleId: id, customStages: id === 'lv-custom' ? x.customStages ?? DEFAULT_STACK : undefined }), `Launch vehicle: ${getVehicle(id, d.customStages ?? DEFAULT_STACK, d.boosters).name}`);
  };
  const setStage = (i: 0 | 1, id: string) => updateDesign((x) => ({ ...x, vehicleId: 'lv-custom', customStages: i === 0 ? [id, x.customStages?.[1] ?? 'stg-m2'] : [x.customStages?.[0] ?? 'stg-m1', id] }), `Custom stack stage ${i + 1}: ${STAGES[id].name}`);
  const setBoost = (type: string, count: number) => updateDesign((x) => ({ ...x, vehicleId: 'lv-custom', customStages: x.customStages ?? DEFAULT_STACK, boosters: count > 0 ? { type, count } : undefined }), `Strap-on boosters: ${count} x ${BOOSTERS[type]?.name ?? type}`);
  const veh = cur;
  const sd = stackDv(veh, a.mass.total);
  const req = launchRequirement(a.orbit);
  const s1 = STAGES[veh.stageIds[0]], s2 = STAGES[veh.stageIds[1]];
  const dests = ORBIT_LIST.map((o) => ({ o, info: describeOrbit(defaultSelection(o.id)) }));
  const maxCap = Math.max(...dests.map((x) => payloadCapacityKg(veh, x.info)), a.mass.total, 1);
  const W = 300, H = 170;
  const sc = Math.min((W - 40) / veh.fairingDiameterM, (H - 20) / veh.fairingLengthM);
  const fw = veh.fairingDiameterM * sc, fh = veh.fairingLengthM * sc;
  const sw = a.geometry.widthM * sc, sh = a.geometry.heightM * sc;
  const custom = buildCustomVehicle(d.customStages ?? DEFAULT_STACK, d.boosters);
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row"><div><h1>Launch center</h1><div className="muted">Payload capacity is computed per destination from each stage with the rocket equation. {a.orbit.def.short} is the current destination.</div></div><span className="spacer" /><button className="btn primary" onClick={() => go('validation')}>Flight readiness poll →</button></div>
      <div className="grid g4">
        {[...LAUNCH_VEHICLES, custom].map((v) => {
          const cap = payloadCapacityKg(v, a.orbit);
          const lk = partLocked(app, v.id);
          const ok = v.classes.includes(a.orbit.def.launchClass) && cap >= a.mass.total && a.geometry.widthM <= v.fairingDiameterM * 0.95 && a.geometry.heightM <= v.fairingLengthM;
          return (
            <div key={v.id} className={`card ${cur.id === v.id ? 'sel' : ''}`} style={lk ? { opacity: 0.55 } : undefined} onClick={() => choose(v.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') choose(v.id); }}>
              <div className="row"><b style={{ flex: 1 }}>{v.name}</b>{lk ? <Badge tone="or">locked</Badge> : <Badge tone={ok ? 'gr' : 'rd'}>{ok ? 'fits' : 'cannot'}</Badge>}</div>
              <div className="muted" style={{ fontSize: 'calc(13px * var(--ts, 1))' }}>{v.className}</div>
              <dl className="kv" style={{ marginTop: 6 }}><dt>To {a.orbit.def.short}</dt><dd>{cap ? `${n0(cap)} kg` : v.classes.includes(a.orbit.def.launchClass) ? 'too little' : 'incompatible'}</dd><dt>Cost</dt><dd>${n1(vehicleCostM(v))}M</dd><dt>Reliability</dt><dd>{(v.reliability * 100).toFixed(0)}%</dd><dt>Lead time</dt><dd>{v.leadMonths} mo</dd><dt>Fairing</dt><dd>{n1(v.fairingDiameterM)} × {n1(v.fairingLengthM)} m</dd></dl>
            </div>
          );
        })}
      </div>
      {cur.id === 'lv-custom' && (
        <Panel title="Vehicle assembly: stages and strap-on boosters">
          <div className="grid g2">
            <label className="col"><span>Stage 1 core (lifts off first)</span><select value={d.customStages?.[0] ?? DEFAULT_STACK[0]} onChange={(e) => setStage(0, e.target.value)}>{STAGE_OPTIONS_1.map((id) => <option key={id} value={id}>{STAGES[id].name} · {n0(STAGES[id].propKg / 1000)} t propellant</option>)}</select></label>
            <label className="col"><span>Stage 2 (upper stage)</span><select value={d.customStages?.[1] ?? DEFAULT_STACK[1]} onChange={(e) => setStage(1, e.target.value)}>{STAGE_OPTIONS_2.map((id) => <option key={id} value={id}>{STAGES[id].name} · {n0(STAGES[id].propKg / 1000)} t propellant</option>)}</select></label>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <span className="muted">Strap-on boosters:</span>
            {Object.values(BOOSTERS).map((b) => <button key={b.id} className={`chip ${d.boosters?.type === b.id ? 'on' : ''}`} onClick={() => setBoost(b.id, d.boosters?.type === b.id ? d.boosters.count : 2)}>{b.name}</button>)}
            <button className="btn sm" disabled={!d.boosters} onClick={() => d.boosters && setBoost(d.boosters.type, Math.max(0, d.boosters.count - 1))}>−</button>
            <b className="mono">{d.boosters?.count ?? 0}</b>
            <button className="btn sm" disabled={(d.boosters?.count ?? 0) >= 6} onClick={() => setBoost(d.boosters?.type ?? 'sb-m', (d.boosters?.count ?? 0) + 1)}>+</button>
            <button className="btn sm" disabled={!d.boosters} onClick={() => setBoost('sb-m', 0)}>none</button>
          </div>
          <div className="note" style={{ marginTop: 8 }}>Boosters are modelled as part of stage 1: their thrust and propellant are added to the core, burn as one stage and are dropped together at separation. More thrust raises lift-off thrust/weight and delta-v, but also cost and drag. An untested stack has 94% reliability and a 12 month lead time.</div>
        </Panel>
      )}
      {a.orbit.def.window && <LaunchWindowPanel />}
      <Panel title={`Vehicle on the pad · ${veh.name} · ${n0(sd.liftoffMassKg / 1000)} t at lift-off`}><RocketScene vehicle={veh} a={a} height={460} /></Panel>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)' }}>
        <Panel title="Stack and staging order"><RocketStack v={veh} payloadKg={a.mass.total} />
          <ol className="muted" style={{ fontSize: 'calc(13px * var(--ts, 1))', paddingLeft: 18, margin: '6px 0 0' }}><li>Lift-off: stage 1{d.boosters && cur.id === 'lv-custom' ? ' + strap-ons' : ''} ignites.</li><li>Max-Q, fairing jettison above ~110 km.</li><li>Stage 1 burnout and separation; stage 2 ignites.</li><li>Parking orbit, then injection burn(s).</li></ol>
        </Panel>
        <div className="col" style={{ minWidth: 0 }}>
          <div className="grid g2">
            <Panel title={<>Delta-v budget: {veh.name} <Explain topic="staging" /></>}>
              <code className="eq">Δv = Isp · g₀ · ln(m₀ / m_f)  per stage, summed</code>
              <Meter label={`Stage 1 · ${s1.name}`} value={`${n0(sd.stage1)} m/s`} frac={sd.stage1 / (sd.total * 1.15)} />
              <Meter label={`Stage 2 · ${s2.name}`} value={`${n0(sd.stage2)} m/s`} frac={sd.stage2 / (sd.total * 1.15)} />
              <Meter label="Vehicle total Δv" value={`${n0(sd.total)} m/s`} frac={sd.total / (Math.max(sd.total, req.total) * 1.15)} tone={sd.total < req.total ? 'bad' : 'ok'} mark={req.total / (Math.max(sd.total, req.total) * 1.15)} hint={`needs ${n0(req.total)} m/s: ascent ${n0(req.ascent)} (incl. gravity, drag, steering losses) + ${n0(req.parking)} to destination + 120 reserve`} />
              <dl className="kv"><dt>Lift-off thrust / weight</dt><dd className={sd.twr < 1.2 ? 'rd' : ''}>{sd.twr.toFixed(2)}</dd><dt>Lift-off mass</dt><dd>{n0(sd.liftoffMassKg / 1000)} t</dd><dt>Max dynamic pressure</dt><dd>{n0(veh.maxQPa / 1000)} kPa</dd><dt>Peak acceleration</dt><dd>~{veh.maxG} g</dd><dt>Max CoM height</dt><dd>{veh.maxComHeightM} m</dd></dl>
              <div className="muted" style={{ marginTop: 6 }}>{veh.desc}</div>
            </Panel>
            <Panel title="Payload fairing integration">
              <svg viewBox={`0 0 ${W} ${H + 24}`} style={{ width: '100%', maxWidth: 420 }} role="img" aria-label="Spacecraft inside the fairing">
                <rect x={(W - fw) / 2} y={10} width={fw} height={fh} fill="none" stroke="#a5aeba" strokeDasharray="5 3" />
                <path d={`M${(W - fw) / 2},${10 + fh * 0.12} Q${W / 2},${10 - fh * 0.1} ${(W + fw) / 2},${10 + fh * 0.12}`} fill="none" stroke="#a5aeba" />
                <rect x={(W - sw) / 2} y={10 + fh - sh} width={sw} height={sh} fill={a.launch.fitsWidth && a.launch.fitsHeight ? 'rgba(63,207,107,0.2)' : 'rgba(252,61,33,0.25)'} stroke={a.launch.fitsWidth && a.launch.fitsHeight ? '#3fcf6b' : '#fc3d21'} />
                <text x={W / 2} y={H + 16} textAnchor="middle" fill="#a5aeba" fontSize="10" fontFamily="monospace">fairing {n1(veh.fairingDiameterM)} × {n1(veh.fairingLengthM)} m · spacecraft {n1(a.geometry.widthM)} × {n1(a.geometry.heightM)} m</text>
              </svg>
              <dl className="kv"><dt>Width fits (95% rule)</dt><dd className={a.launch.fitsWidth ? 'gr' : 'rd'}>{a.launch.fitsWidth ? 'yes' : 'NO'}</dd><dt>Height fits</dt><dd className={a.launch.fitsHeight ? 'gr' : 'rd'}>{a.launch.fitsHeight ? 'yes' : 'NO'}</dd><dt>CoM above separation plane</dt><dd className={a.geometry.comHeightM > veh.maxComHeightM ? 'rd' : ''}>{n1(a.geometry.comHeightM)} / {veh.maxComHeightM} m</dd><dt>CoM lateral offset</dt><dd>{n1(a.geometry.comLatM * 100)} cm</dd><dt>Frame g rating vs vehicle</dt><dd className={a.frame && a.frame.maxAccelG < veh.maxG ? 'or' : ''}>{a.frame?.maxAccelG} g / {veh.maxG} g</dd></dl>
            </Panel>
          </div>
        </div>
      </div>
      <Panel title="Payload capacity by destination (same rocket, different energy)">
        <div className="col">
          {dests.map(({ o, info }) => {
            const cap = payloadCapacityKg(veh, info);
            const compat = veh.classes.includes(o.launchClass);
            const mine = o.id === a.orbit.def.id;
            return <Meter key={o.id} label={<span className={mine ? 'cy' : ''}>{o.short} {mine ? '(your destination)' : ''}</span>} value={compat ? (cap ? `${n0(cap)} kg` : 'cannot reach') : 'not certified'} frac={cap / maxCap} tone={!compat || !cap ? 'bad' : cap >= a.mass.total ? 'ok' : 'warn'} mark={Math.min(1, a.mass.total / maxCap)} />;
          })}
        </div>
        <div className="note">White mark = your spacecraft ({n0(a.mass.total)} kg). A rocket that lifts tonnes to LEO delivers far less to the Moon or Mars: the destination decides the delta-v the upper stage must supply.</div>
      </Panel>
      <Illustrative>Launch vehicles are fictional; stage data are game-balance values. Capacity is derived from them with real equations (rocket equation, vis-viva). Ascent losses are one calibrated constant measured in this game's own flight simulator.</Illustrative>
    </div>
  );
}
