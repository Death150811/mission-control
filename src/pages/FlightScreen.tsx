import { useCallback, useEffect, useRef, useState } from 'react';
import RocketStack from '../components/RocketStack';
import { Badge, Explain, Illustrative, Meter, Panel, n0, n1 } from '../components/ui';
import { BODIES } from '../data/bodies';
import { STAGES } from '../data/launchVehicles';
import {
  FLIGHT_DT, autopilot, coastToApsis, createFlight, elements, injectionBurn, injectionGoal, remainingUpperDv, stepFlight, tuneKick, vehicleMass,
  type FlightControls, type FlightMode, type FlightState,
} from '../engine/flightSim';
import { flightInputFromState, flightOptions, headlessFlight } from '../engine/missionSimulator';
import type { OrbitInfo } from '../engine/orbitalMechanics';
import { propagate } from '../engine/orbitalMechanics';
import { G0, visViva } from '../engine/physics';
import type { LaunchVehicle } from '../types';
import { sound } from '../store/audio';
import { beginMission, go, useCurrent } from '../store/store';

const R = BODIES.earth.radius;
const MU = BODIES.earth.mu;

interface Puff { x: number; y: number; life: number; max: number; size: number; kind: 'smoke' | 'spark' | 'debris'; vx: number; vy: number; rot: number }
interface Fx { puffs: Puff[]; flash: number; exploded: boolean; lastAttached: boolean; lastStatus: string }

const mmss = (t: number) => `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export default function FlightScreen() {
  const { app, analysis: a } = useCurrent();
  const [mode, setMode] = useState<FlightMode>(app.difficulty === 'expert' ? 'assist' : 'auto');
  const [warp, setWarp] = useState(10);
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [, force] = useState(0);
  const [throttleUI, setThrottleUI] = useState(1);
  const [pitchUI, setPitchUI] = useState(90);
  const [engineUI, setEngineUI] = useState(true);
  const [snd, setSnd] = useState(sound.enabled);
  const S = useRef<FlightState | null>(null);
  const kick = useRef(3);
  const trail = useRef<[number, number][]>([]);
  const pred = useRef<{ pts: [number, number][]; t: number }>({ pts: [], t: -9 });
  const fx = useRef<Fx>({ puffs: [], flash: 0, exploded: false, lastAttached: true, lastStatus: 'prelaunch' });
  const ctl = useRef({ throttle: 1, pitch: 90, engine: true, separate: false, mode: mode as FlightMode, running: false, warp: 10 });
  const cvRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLCanvasElement>(null);
  const acc = useRef(0);
  const vehicle = a?.vehicle;

  const reset = useCallback(() => {
    if (!a || !vehicle) return;
    const opts = flightOptions(a, app.seed);
    kick.current = tuneKick(vehicle, a.mass.total, opts);
    S.current = createFlight(vehicle, a.mass.total, { ...opts, kickDeg: kick.current });
    trail.current = []; pred.current = { pts: [], t: -9 }; acc.current = 0;
    fx.current = { puffs: [], flash: 0, exploded: false, lastAttached: true, lastStatus: 'prelaunch' };
    setRunning(false); setCount(null); setThrottleUI(1); setPitchUI(90); setEngineUI(true);
    ctl.current = { ...ctl.current, throttle: 1, pitch: 90, engine: true, separate: false, running: false };
    sound.stop();
    force((x) => x + 1);
  }, [a, vehicle, app.seed]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reset(); return () => sound.stop(); }, []);
  useEffect(() => { ctl.current.mode = mode; ctl.current.warp = warp; ctl.current.running = running; }, [mode, warp, running]);

  useEffect(() => {
    if (count === null) return;
    if (count <= 0) { sound.beep(1320, 0.4, 0.14); setRunning(true); setCount(null); return; }
    sound.beep(880, 0.1);
    const t = setTimeout(() => setCount(count - 1), 700);
    return () => clearTimeout(t);
  }, [count]);

  useEffect(() => {
    let raf = 0, last = performance.now(), frames = 0;
    const loop = (now: number) => {
      const dtReal = Math.min(0.1, (now - last) / 1000); last = now;
      const s = S.current;
      if (s && vehicle) {
        const c = ctl.current;
        const f = fx.current;
        if (c.running && (s.status === 'ascent' || s.status === 'prelaunch')) {
          acc.current += (dtReal * c.warp) / FLIGHT_DT;
          let n = Math.floor(acc.current); acc.current -= n; n = Math.min(n, 400);
          for (let i = 0; i < n && (s.status === 'ascent' || s.status === 'prelaunch'); i++) {
            let ctrls: FlightControls;
            if (c.mode === 'manual') { ctrls = { throttle: c.throttle, pitchDeg: c.pitch, engineOn: c.engine, separate: c.separate }; c.separate = false; }
            else {
              const g = autopilot(vehicle, s);
              ctrls = c.mode === 'auto' ? g : { ...g, throttle: g.engineOn ? Math.min(c.throttle, 1) : 0, separate: g.separate || c.separate };
              if (c.mode === 'assist') { c.separate = false; if (!c.engine) ctrls.engineOn = false; }
            }
            stepFlight(vehicle, s, ctrls);
            if (Math.round(s.t * 10) % 20 === 0) trail.current.push([s.x, s.y]);
          }
        }
        const burning = s.status === 'ascent' && s.engineOn && s.throttle > 0 && s.prop[s.stage] > 0 && s.attached[s.stage] && c.running;
        sound.engine(s.throttle, burning);
        if (!s.attached[0] && f.lastAttached) { f.lastAttached = false; f.puffs.push({ x: 0, y: 0, life: 0, max: 7, size: 1, kind: 'debris', vx: -6, vy: 22, rot: 0 }); sound.beep(300, 0.15, 0.12); }
        if (s.status === 'failed' && !f.exploded) {
          f.exploded = true; f.flash = 1; sound.boom(); sound.alarm();
          for (let i = 0; i < 160; i++) { const ang = Math.random() * 6.283, sp = 30 + Math.random() * 200; f.puffs.push({ x: 0, y: 0, life: 0, max: 0.8 + Math.random() * 1.6, size: 1 + Math.random() * 3, kind: 'spark', vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, rot: 0 }); }
        }
        if (s.status === 'orbit' && f.lastStatus !== 'orbit') sound.chime();
        f.lastStatus = s.status;
        frames++;
        if (frames % 3 === 0) force((x) => x + 1);
        draw(cvRef.current, s, trail.current, pred.current, f, dtReal * (c.running ? c.warp : 1), burning);
        drawHud(hudRef.current, s);
        if (s.status !== 'prelaunch' && s.t - pred.current.t > 4 && s.status !== 'failed' && s.status !== 'orbit') {
          const el = elements(s);
          const T = el.hyper ? 2400 : Math.min(el.periodS, 6000);
          pred.current = { pts: propagate(MU, [s.x, s.y], [s.vx, s.vy], T, Math.max(10, T / 300)), t: s.t };
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [vehicle]);

  if (!a || !vehicle || !S.current) return <div className="note">Preparing flight…</div>;
  const s = S.current;
  const r = Math.hypot(s.x, s.y), h = r - R;
  const ux = s.x / r, uy = s.y / r;
  const vr = s.vx * ux + s.vy * uy, vh = s.vx * uy - s.vy * ux;
  const el = elements(s);
  const m = vehicleMass(vehicle, s);
  const st = STAGES[vehicle.stageIds[s.stage]];
  const stageDv = s.attached[s.stage] && s.prop[s.stage] > 0 ? st.ispVac * G0 * Math.log(m / (m - s.prop[s.stage])) : 0;
  const orbiting = s.status === 'orbit', failed = s.status === 'failed';

  const liftoff = () => { ctl.current.engine = true; ctl.current.throttle = 1; setCount(3); };
  const sep = () => { ctl.current.separate = true; };
  const autoRun = () => { sound.stop(); beginMission(headlessFlight(a, app.seed)); };
  const toggleSound = () => { sound.set(!snd); setSnd(!snd); };

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(290px, 370px)' }}>
      <div className="col" style={{ minWidth: 0 }}>
        <div className="row">
          <div><h1>Flight · {vehicle.name}</h1><div className="muted">Real Newtonian ascent: thrust − drag − gravity (g = μ/r²) on a rocket that gets lighter as it burns. Destination: <b>{a.orbit.def.name}</b>.</div></div>
          <span className="spacer" /><div className="clock"><small>T+</small>{mmss(s.t)}</div>
        </div>
        {!orbiting ? (
          <div style={{ position: 'relative' }}>
            <canvas ref={cvRef} style={{ width: '100%', height: 420, border: '1px solid var(--line)', background: '#07090c' }} role="img" aria-label="Ascent view" />
            {count !== null && <div className="mono" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'calc(84px * var(--ts, 1))', color: '#fff', textShadow: '0 0 20px #fc3d21' }}>{count > 0 ? `T-${count}` : 'LIFT-OFF'}</div>}
            {s.status === 'prelaunch' && count === null && <div style={{ position: 'absolute', left: 14, top: 14 }}><Badge tone="or">ON THE PAD · all stations go</Badge></div>}
            {failed && <div style={{ position: 'absolute', left: 14, top: 14, right: 14 }}><Badge tone="rd">FLIGHT FAILURE · {s.failure}</Badge></div>}
            <canvas ref={hudRef} width={150} height={150} style={{ position: 'absolute', right: 10, bottom: 10, width: 130, height: 130 }} aria-label="Attitude indicator" />
          </div>
        ) : (
          <InjectionPlanner key={a.design.id + app.seed} vehicle={vehicle} s={s} need={a.orbit.launchParkingDvMps} info={a.orbit} difficulty={app.difficulty} reflow={() => force((x) => x + 1)} />
        )}
        <div className="grid g4">
          <Meter label="Altitude" value={`${n1(h / 1000)} km`} frac={h / 250e3} />
          <Meter label="Speed (inertial)" value={`${n0(Math.hypot(s.vx, s.vy))} m/s`} frac={Math.hypot(s.vx, s.vy) / 8000} />
          <Meter label={<>Dynamic pressure <Explain topic="staging" /></>} value={`${n1(s.qNow / 1000)} kPa`} frac={s.qNow / vehicle.maxQPa} tone={s.qNow > vehicle.maxQPa * 0.9 ? 'bad' : s.qNow > vehicle.maxQPa * 0.7 ? 'warn' : ''} />
          <Meter label="Acceleration" value={`${s.gNow.toFixed(2)} g`} frac={s.gNow / vehicle.maxG} tone={s.gNow > (a.frame?.maxAccelG ?? 6) ? 'bad' : s.gNow > vehicle.maxG * 0.8 ? 'warn' : ''} mark={(a.frame?.maxAccelG ?? 6) / vehicle.maxG} />
        </div>
        <Panel title="Flight log" pad={false}><div className="log" style={{ padding: 8 }}>{s.events.length === 0 && <div className="dim">Awaiting lift-off…</div>}{[...s.events].reverse().map((e, i) => <div key={i}><span className="d">T+{e.t.toFixed(0)}s</span>{e.msg}</div>)}</div></Panel>
        {failed && (
          <Panel title="Launch failure analysis">
            <p>{s.failure}</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}><li>Peak dynamic pressure {n1(s.maxQ / 1000)} kPa (limit {n0(vehicle.maxQPa / 1000)}), peak {s.maxG.toFixed(1)} g, final altitude {n1(h / 1000)} km.</li><li>Stage 1 propellant left {n0(s.prop[0])} kg · stage 2 {n0(s.prop[1])} kg.</li><li>Δv spent {n0(s.dvUsed)} m/s of about {n0(a.launch.reqDv)} m/s needed.</li></ul>
            <div className="row" style={{ marginTop: 8 }}><button className="btn primary" onClick={reset}>Retry flight</button><button className="btn" onClick={() => go('launch')}>Back to launch center</button><button className="btn warn" onClick={() => { sound.stop(); beginMission(flightInputFromState(vehicle, s)); }}>Accept failure and view debrief</button></div>
          </Panel>
        )}
      </div>
      <div className="col">
        {!orbiting && (
          <Panel title="Flight controls">
            <div className="chips" style={{ marginBottom: 8 }}>{(['auto', 'assist', 'manual'] as FlightMode[]).map((md) => <button key={md} className={`chip ${mode === md ? 'on' : ''}`} onClick={() => setMode(md)}>{md}</button>)}</div>
            <div className="muted" style={{ fontSize: 'calc(13px * var(--ts, 1))', marginBottom: 8 }}>{mode === 'auto' ? 'Autopilot flies the gravity turn, stages and cuts off at orbit.' : mode === 'assist' ? 'Autopilot steers and stages; you control throttle and engine.' : 'You fly everything: throttle, pitch, staging, cutoff.'}</div>
            <label className="col"><span>Throttle {Math.round(throttleUI * 100)}%</span><input type="range" min={0} max={1} step={0.01} value={throttleUI} disabled={mode === 'auto'} onChange={(e) => { setThrottleUI(Number(e.target.value)); ctl.current.throttle = Number(e.target.value); }} /></label>
            <label className="col"><span>Pitch {pitchUI}° <span className="dim">(90 = vertical, 0 = horizontal)</span></span><input type="range" min={-10} max={90} step={1} value={pitchUI} disabled={mode !== 'manual'} onChange={(e) => { setPitchUI(Number(e.target.value)); ctl.current.pitch = Number(e.target.value); }} /></label>
            <div className="row" style={{ margin: '6px 0' }}>
              <button className={`btn ${engineUI ? '' : 'warn'}`} disabled={mode === 'auto'} onClick={() => { setEngineUI(!engineUI); ctl.current.engine = !engineUI; }}>Engine {engineUI ? 'ON' : 'OFF'}</button>
              <button className="btn" disabled={mode === 'auto' || !s.attached[0]} onClick={sep}>Stage separation</button>
            </div>
            <div className="row">
              {s.status === 'prelaunch' && count === null && <button className="btn primary lg" onClick={liftoff}>Start countdown</button>}
              {s.status === 'ascent' && <button className="btn" onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Resume'}</button>}
              <select value={warp} onChange={(e) => setWarp(Number(e.target.value))} aria-label="Time warp">{[1, 2, 5, 10, 25].map((w) => <option key={w} value={w}>{w}× speed</option>)}</select>
              <button className="btn sm" onClick={toggleSound} aria-pressed={snd}>Sound {snd ? 'on' : 'off'}</button>
            </div>
            <div className="row" style={{ marginTop: 8 }}><button className="btn sm" onClick={reset}>Reset to pad</button><button className="btn sm warn" onClick={autoRun} title="Skip the interactive flight; use the autopilot result">Skip: autopilot flight</button></div>
          </Panel>
        )}
        <Panel title="Staging"><RocketStack v={vehicle} payloadKg={a.mass.total} flight={s} /></Panel>
        <Panel title="Telemetry">
          <dl className="kv"><dt>Stage</dt><dd>{s.stage + 1} · {st.name}</dd><dt>Vertical / horizontal</dt><dd>{n0(vr)} / {n0(vh)} m/s</dd><dt>Flight mass</dt><dd>{n0(m)} kg</dd><dt>Periapsis × apoapsis</dt><dd>{el.hyper ? 'escape' : el.rp < R ? `suborbital · apo ${n0((el.ra - R) / 1000)} km` : `${n0((el.rp - R) / 1000)} × ${n0((el.ra - R) / 1000)} km`}</dd><dt>Δv spent</dt><dd>{n0(s.dvUsed)} m/s</dd><dt>Active-stage Δv left</dt><dd>{n0(orbiting ? remainingUpperDv(vehicle, s) : stageDv)} m/s</dd></dl>
          <div className="note" style={{ marginTop: 8 }}>Orbit needs ~7.8 km/s sideways at 200 km. The rocket first climbs, a <b>gravity turn</b> then bends the path horizontal, and the upper stage builds speed along the horizon. <Explain topic="deltaV" /></div>
        </Panel>
        <Illustrative>Simplified planar physics (no wind, oblateness or detailed aerodynamics). Launch anomalies are seeded by vehicle reliability ({(vehicle.reliability * 100).toFixed(0)}%).</Illustrative>
        <Badge>Seed {app.seed}</Badge>
      </div>
    </div>
  );
}

/* ---------- injection planner: maneuver-node style ---------- */
function InjectionPlanner({ vehicle, s, need, info, difficulty, reflow }: { vehicle: LaunchVehicle; s: FlightState; need: number; info: OrbitInfo; difficulty: string; reflow: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const goal = injectionGoal(info);
  const avail = remainingUpperDv(vehicle, s);
  const [dv, setDv] = useState(0);
  const [msg, setMsg] = useState('');
  const chk = goal.check(s);
  const r = Math.hypot(s.x, s.y);
  const el = elements(s);
  const vrad = s.x * s.vx + s.y * s.vy;
  const nearApsis = Math.abs(vrad) / (r * Math.hypot(s.vx, s.vy)) < 0.02;
  const atPeri = !el.hyper && nearApsis && Math.abs(r - el.rp) < Math.abs(r - el.ra);
  const suggest = () => {
    const v0 = Math.hypot(s.vx, s.vy);
    const cls = info.def.launchClass;
    if (cls === 'tmi' || cls === 'asteroid') return Math.sqrt((2 * MU) / r + info.c3Eff) - v0;
    const target = cls === 'direct' ? (atPeri ? info.raM : info.rpM) : cls === 'gto' ? R + 35786e3 : cls === 'l2' ? 1.5e9 : 3.9e8;
    return visViva(MU, r, (r + target) / 2) - v0;
  };
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth, H = 420;
    c.width = W * dpr; c.height = H * dpr;
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#07090c'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 80; i++) { g.fillStyle = 'rgba(220,228,240,0.4)'; g.fillRect((Math.sin(i * 91.7) * 0.5 + 0.5) * W, (Math.sin(i * 53.3 + 1) * 0.5 + 0.5) * H, 1, 1); }
    const sp = Math.hypot(s.vx, s.vy);
    const vx2 = s.vx + (s.vx / sp) * dv, vy2 = s.vy + (s.vy / sp) * dv;
    const e2 = elements({ x: s.x, y: s.y, vx: vx2, vy: vy2 });
    const T = e2.hyper ? 1.2e6 : Math.min(e2.periodS * 0.55, 1.2e7);
    const pts = propagate(MU, [s.x, s.y], [vx2, vy2], T, Math.max(20, T / 500));
    const curT = el.hyper ? 4000 : Math.min(el.periodS, 8000);
    const cur = propagate(MU, [s.x, s.y], [s.vx, s.vy], curT, Math.max(10, curT / 300));
    let rmax = R * 1.4; for (const [x, y] of pts) rmax = Math.max(rmax, Math.hypot(x, y)); rmax = Math.min(rmax, 2e9);
    const cx = W / 2, cy = H / 2, sc = (Math.min(W, H) * 0.44) / rmax;
    const P = (x: number, y: number): [number, number] => [cx + x * sc, cy - y * sc];
    g.fillStyle = '#0b3d91'; g.beginPath(); g.arc(cx, cy, Math.max(4, R * sc), 0, 7); g.fill();
    g.strokeStyle = '#7aa9f7'; g.lineWidth = 1; g.stroke();
    g.setLineDash([3, 5]); g.strokeStyle = 'rgba(165,174,186,0.6)'; g.fillStyle = '#a5aeba'; g.font = '10px Consolas, monospace';
    const ring = (rad: number, label: string) => { g.beginPath(); g.arc(cx, cy, rad * sc, 0, 7); g.stroke(); g.fillText(label, cx + rad * sc * 0.72 + 4, cy - rad * sc * 0.72); };
    if (info.def.launchClass === 'tli') { ring(3.844e8, 'Moon orbit'); g.fillStyle = '#d8dce2'; g.beginPath(); g.arc(cx + 3.844e8 * sc, cy, 3, 0, 7); g.fill(); }
    if (info.def.launchClass === 'gto') ring(R + 35786e3, 'GEO');
    if (info.def.launchClass === 'l2') ring(1.5e9, 'L2 distance');
    if (info.def.launchClass === 'direct') ring(info.raM, 'target apoapsis');
    g.setLineDash([]);
    g.strokeStyle = '#f2f4f7'; g.lineWidth = 1.6; g.beginPath(); cur.forEach(([x, y], i) => { const [a, b] = P(x, y); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.stroke();
    if (dv > 0) { g.strokeStyle = '#ffb000'; g.setLineDash([6, 4]); g.lineWidth = 2; g.beginPath(); pts.forEach(([x, y], i) => { const [a, b] = P(x, y); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.stroke(); g.setLineDash([]); }
    const [px, py] = P(s.x, s.y);
    g.fillStyle = '#fc3d21'; g.beginPath(); g.moveTo(px, py - 7); g.lineTo(px + 6, py + 5); g.lineTo(px - 6, py + 5); g.fill();
    g.fillStyle = '#a5aeba'; g.fillText(`white: current orbit · amber: after a ${Math.round(dv)} m/s prograde burn`, 12, H - 12);
  });
  const doBurn = () => { const rsl = injectionBurn(vehicle, s, dv); setMsg(rsl.msg); if (rsl.ok) { setDv(0); sound.beep(440, 0.4, 0.14); } reflow(); };
  const coast = (w: 'periapsis' | 'apoapsis') => { const ok = coastToApsis(s, w); setMsg(ok ? `Coasted to ${w}.` : 'Cannot coast on an escape trajectory.'); reflow(); };
  const deploy = (verified: boolean) => { sound.stop(); const f = flightInputFromState(vehicle, s); beginMission({ ...f, injectionVerified: verified, injectionNote: verified ? undefined : `Injection not achieved: ${chk.note}. Target was: ${goal.label}.` }); };
  const maxDv = Math.max(100, Math.min(Math.round(avail), Math.round(need * 1.6 + 300)));
  return (
    <div className="col">
      <div className="note" style={{ borderLeftColor: 'var(--green)' }}><b className="gr">Parking orbit reached: {n0((el.rp - R) / 1000)} × {n0((el.ra - R) / 1000)} km.</b> Plan the injection burn like a flight dynamics officer: pick the prograde delta-v, check the predicted orbit, coast to the right point, then execute. Target: <b>{goal.label}</b>.</div>
      <canvas ref={cv} style={{ width: '100%', height: 420, border: '1px solid var(--line)' }} role="img" aria-label="Maneuver planner" />
      <Panel title="Maneuver node: injection burn" right={<Badge tone={chk.ok ? 'gr' : 'or'}>{chk.ok ? 'TARGET ACHIEVED' : 'not yet'}</Badge>}>
        <p className="muted" style={{ marginTop: 0 }}>{goal.describe}</p>
        <label className="col"><span>Prograde Δv: <b className="mono cy">{dv} m/s</b> <span className="dim">· upper stage has {n0(avail)} m/s · budget needed about {n0(need)} m/s</span></span>
          <input type="range" min={0} max={maxDv} step={1} value={Math.min(dv, maxDv)} onChange={(e) => setDv(Number(e.target.value))} aria-label="Burn delta-v" /></label>
        <div className="row" style={{ margin: '6px 0' }}>
          {[-50, -10, -1, 1, 10, 50].map((d) => <button key={d} className="btn sm" onClick={() => setDv(Math.max(0, Math.min(Math.round(avail), dv + d)))}>{d > 0 ? '+' : ''}{d}</button>)}
          {difficulty !== 'expert' && <button className="btn sm warn" onClick={() => setDv(Math.max(0, Math.min(Math.round(avail), Math.round(suggest()))))} title="Vis-viva solution for this point of the orbit">Compute suggested Δv</button>}
        </div>
        <div className="row">
          <button className="btn" onClick={() => coast('periapsis')}>Coast to periapsis</button>
          <button className="btn" onClick={() => coast('apoapsis')}>Coast to apoapsis</button>
          <button className="btn primary" disabled={dv <= 0} onClick={doBurn}>Execute burn</button>
          <span className="spacer" />
          {chk.ok && <button className="btn primary lg" onClick={() => deploy(true)}>Deploy spacecraft →</button>}
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: 'calc(13px * var(--ts, 1))' }}>{chk.note}{msg ? ` · ${msg}` : ''}. {atPeri ? 'You are at periapsis: the best place to raise the opposite side of the orbit.' : nearApsis ? 'You are at apoapsis: the best place to raise the periapsis.' : 'Burns are most efficient at an apsis; use the coast buttons.'}</div>
        <div className="row" style={{ marginTop: 8 }}><button className="btn sm danger" onClick={() => deploy(false)}>Give up and release payload here</button></div>
      </Panel>
    </div>
  );
}

/* ---------- drawing ---------- */
function drawHud(cv: HTMLCanvasElement | null, s: FlightState) {
  if (!cv) return;
  const g = cv.getContext('2d')!; const W = cv.width, c = W / 2, rad = W / 2 - 6;
  g.clearRect(0, 0, W, W);
  g.save(); g.beginPath(); g.arc(c, c, rad, 0, 7); g.clip();
  const k = rad / 45;
  const hy = c + s.pitchDeg * k;
  g.fillStyle = '#0b3d91'; g.fillRect(0, 0, W, W);
  g.fillStyle = '#4a3a2c'; g.fillRect(0, hy, W, W);
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, hy); g.lineTo(W, hy); g.stroke();
  g.lineWidth = 1; g.fillStyle = '#fff'; g.font = '9px Consolas, monospace';
  for (let p = -20; p <= 90; p += 10) { const y = hy - p * k; if (y < 0 || y > W) continue; g.beginPath(); g.moveTo(c - (p % 30 === 0 ? 16 : 9), y); g.lineTo(c + (p % 30 === 0 ? 16 : 9), y); g.stroke(); if (p % 30 === 0) g.fillText(String(p), c + 20, y + 3); }
  g.restore();
  g.strokeStyle = '#f2f4f7'; g.lineWidth = 3; g.beginPath(); g.arc(c, c, rad, 0, 7); g.stroke();
  g.strokeStyle = '#ffb000'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(c - 18, c); g.lineTo(c - 6, c); g.moveTo(c + 6, c); g.lineTo(c + 18, c); g.moveTo(c, c - 6); g.lineTo(c, c - 12); g.stroke(); g.beginPath(); g.arc(c, c, 3, 0, 7); g.stroke();
  const r = Math.hypot(s.x, s.y); const ux = s.x / r, uy = s.y / r;
  const vr = s.vx * ux + s.vy * uy, vh = s.vx * uy - s.vy * ux;
  const gamma = (Math.atan2(vr, vh) * 180) / Math.PI;
  const my = hy - gamma * k;
  if (my > 10 && my < W - 10) { g.strokeStyle = '#3fcf6b'; g.lineWidth = 2; g.beginPath(); g.arc(c, my, 6, 0, 7); g.moveTo(c - 12, my); g.lineTo(c - 6, my); g.moveTo(c + 6, my); g.lineTo(c + 12, my); g.moveTo(c, my - 6); g.lineTo(c, my - 11); g.stroke(); }
  g.fillStyle = '#fff'; g.font = 'bold 10px Consolas, monospace'; g.fillText(`PITCH ${Math.round(s.pitchDeg)}°`, c - 28, W - 12);
}

function draw(cv: HTMLCanvasElement | null, s: FlightState, trail: [number, number][], pred: { pts: [number, number][] }, f: Fx, dtSim: number, burning: boolean) {
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth, H = 420;
  if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const c = cv.getContext('2d')!; c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const r = Math.hypot(s.x, s.y), h = r - R;
  const phi = Math.atan2(s.x, s.y);
  const cos = Math.cos(phi), sin = Math.sin(phi);
  const rot = (px: number, py: number): [number, number] => { const dx = px - s.x, dy = py - s.y; return [dx * cos - dy * sin, dx * sin + dy * cos]; };
  const span = Math.max(h * 1.3, 12e3);
  const sc = (H * 0.55) / span;
  const ox = W / 2, oy = H * 0.7;
  const P = (px: number, py: number): [number, number] => { const [x, y] = rot(px, py); return [ox + x * sc, oy - y * sc]; };
  const k = Math.min(1, h / 90e3);
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, `rgb(${Math.round(10 * (1 - k) + 4 * k)},${Math.round(22 * (1 - k) + 6 * k)},${Math.round(60 * (1 - k) + 12 * k)})`);
  sky.addColorStop(1, `rgb(${Math.round(60 * (1 - k) + 6 * k)},${Math.round(110 * (1 - k) + 10 * k)},${Math.round(190 * (1 - k) + 22 * k)})`);
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  if (k > 0.2) { c.fillStyle = `rgba(255,255,255,${k * 0.7})`; for (let i = 0; i < 90; i++) c.fillRect((Math.sin(i * 12.9898) * 0.5 + 0.5) * W, (Math.sin(i * 78.233) * 0.5 + 0.5) * H * 0.8, i % 8 === 0 ? 1.8 : 1, i % 8 === 0 ? 1.8 : 1); }
  const [pcx, pcy] = P(0, 0);
  c.fillStyle = '#0f2f66'; c.beginPath(); c.arc(pcx, pcy, R * sc, 0, 7); c.fill();
  c.strokeStyle = 'rgba(122,169,247,0.5)'; c.lineWidth = 2; c.beginPath(); c.arc(pcx, pcy, (R + 100e3) * sc, 0, 7); c.stroke();
  c.strokeStyle = '#3fcf6b'; c.lineWidth = 2; c.beginPath(); c.arc(pcx, pcy, R * sc, 0, 7); c.stroke();
  c.strokeStyle = 'rgba(255,176,0,0.55)'; c.setLineDash([4, 4]); c.lineWidth = 1; c.beginPath(); c.arc(pcx, pcy, (R + s.targetAltM) * sc, 0, 7); c.stroke(); c.setLineDash([]);
  if (pred.pts.length > 1 && s.status !== 'prelaunch') { c.strokeStyle = 'rgba(242,244,247,0.8)'; c.setLineDash([5, 4]); c.beginPath(); pred.pts.forEach(([x, y], i) => { const [a, b] = P(x, y); if (i) c.lineTo(a, b); else c.moveTo(a, b); }); c.stroke(); c.setLineDash([]); }
  if (trail.length > 1) { c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.5; c.beginPath(); trail.forEach(([x, y], i) => { const [a, b] = P(x, y); if (i) c.lineTo(a, b); else c.moveTo(a, b); }); c.lineTo(ox, oy); c.stroke(); }
  // effects: puffs drift with the world frame
  const vxr = s.vx * cos - s.vy * sin, vyr = s.vx * sin + s.vy * cos;
  const dx = -vxr * sc * dtSim, dy = vyr * sc * dtSim;
  if (burning && s.status === 'ascent') { for (let i = 0; i < 2; i++) f.puffs.push({ x: ox + (Math.random() - 0.5) * 6, y: oy + 24, life: 0, max: 3 + Math.random() * 2, size: 3 + s.throttle * 4, kind: 'smoke', vx: (Math.random() - 0.5) * 6, vy: 6, rot: 0 }); }
  const dtR = Math.min(0.1, Math.max(dtSim, 0.016));
  for (let i = f.puffs.length - 1; i >= 0; i--) {
    const p = f.puffs[i];
    p.life += p.kind === 'smoke' ? Math.max(dtSim, 0.016) : dtR;
    if (p.life > p.max) { f.puffs.splice(i, 1); continue; }
    const a = 1 - p.life / p.max;
    if (p.kind === 'smoke') {
      p.x += p.vx * dtR + dx; p.y += p.vy * dtR + dy;
      c.fillStyle = `rgba(235,238,242,${0.35 * a})`; c.beginPath(); c.arc(p.x, p.y, p.size * (1 + p.life * 0.5), 0, 7); c.fill();
    } else if (p.kind === 'spark') {
      p.x += p.vx * dtR; p.y += p.vy * dtR; p.vy += 90 * dtR;
      c.fillStyle = p.life < p.max * 0.5 ? `rgba(255,${Math.round(176 * (1 - p.life / p.max) + 60)},0,${a})` : `rgba(160,160,160,${a})`; c.fillRect(ox + p.x, oy + p.y, p.size, p.size);
    } else {
      p.x += p.vx * dtR + dx * 0.4; p.y += p.vy * dtR; p.rot += dtR * 1.5;
      c.save(); c.translate(ox + p.x, oy + p.y + 30); c.rotate(p.rot); c.fillStyle = `rgba(235,238,242,${a})`; c.fillRect(-4, -16, 8, 32); c.fillStyle = `rgba(252,61,33,${a})`; c.fillRect(-4, -16, 8, 6); c.restore();
    }
  }
  if (s.status !== 'failed') {
    const pr = (s.pitchDeg * Math.PI) / 180;
    c.save(); c.translate(ox, oy); c.rotate(Math.atan2(Math.cos(pr), Math.sin(pr)));
    if (burning && s.status === 'ascent') {
      const fl = 14 + 22 * s.throttle + Math.random() * 6;
      c.fillStyle = '#ffb000'; c.beginPath(); c.moveTo(-4.5, 22); c.lineTo(0, 22 + fl); c.lineTo(4.5, 22); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-2.2, 22); c.lineTo(0, 22 + fl * 0.55); c.lineTo(2.2, 22); c.fill();
    }
    const detached = !s.attached[0];
    c.fillStyle = '#f2f4f7'; c.fillRect(-5, -18, 10, detached ? 22 : 40);
    c.fillStyle = '#0b3d91'; c.fillRect(-5, -8, 10, 4);
    c.fillStyle = '#fc3d21'; c.beginPath(); c.moveTo(-5, -18); c.lineTo(0, -28); c.lineTo(5, -18); c.fill();
    if (!detached) { c.fillStyle = '#fc3d21'; c.beginPath(); c.moveTo(-5, 18); c.lineTo(-10, 24); c.lineTo(-5, 22); c.fill(); c.beginPath(); c.moveTo(5, 18); c.lineTo(10, 24); c.lineTo(5, 22); c.fill(); }
    c.restore();
  }
  if (f.flash > 0) { c.fillStyle = `rgba(255,220,160,${f.flash})`; c.fillRect(0, 0, W, H); f.flash = Math.max(0, f.flash - dtR * 1.8); }
  c.fillStyle = '#a5aeba'; c.font = '11px Consolas, monospace'; c.fillText(`ALT ${(h / 1000).toFixed(1)} km`, 12, H - 12);
  c.fillText('white dashed: predicted orbit · amber dashed: 200 km target', W - 370, H - 12);
}
