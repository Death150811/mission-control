// Planar (2D) powered-ascent simulation with real Newtonian dynamics.
//   F = m a,  g = mu / r^2,  dv = Isp g0 ln(m0/mf),  exponential atmosphere, quadratic drag, altitude-dependent thrust/Isp.
// Simplifications: flat 2D plane, no Earth oblateness, no winds, constant drag coefficient curve, symplectic Euler at dt = 0.1 s.
// The autopilot (gravity turn, then altitude-hold guidance) is deterministic; a seeded roll decides launch anomalies.

import { BODIES, EARTH_ROTATION_RATE, PARKING_ALT_M } from '../data/bodies';
import { STAGES } from '../data/launchVehicles';
import type { LaunchVehicle } from '../types';
import { G0, clamp, deg2rad, rad2deg } from './physics';
import { rngFor } from './rng';

const EARTH = BODIES.earth;
const MU = EARTH.mu;
const R = EARTH.radius;
export const FLIGHT_DT = 0.1;

export type FlightMode = 'auto' | 'assist' | 'manual';
export interface FlightControls { throttle: number; pitchDeg: number; engineOn: boolean; separate: boolean }

export interface FlightState {
  t: number; x: number; y: number; vx: number; vy: number;
  stage: 0 | 1;
  prop: [number, number];
  attached: [boolean, boolean];
  fairing: boolean;
  payloadKg: number;
  throttle: number; engineOn: boolean; pitchDeg: number;
  status: 'prelaunch' | 'ascent' | 'orbit' | 'failed';
  failure: string | null;
  dvUsed: number;
  qNow: number; gNow: number; maxQ: number; maxG: number; overG: number;
  anomaly: { t: number; kind: 'engine' | 'separation' } | null;
  separationBroken: boolean;
  kicked: boolean; kickPitch: number; lastSepT: number;
  events: { t: number; msg: string }[];
  rotation: number;       // surface velocity bonus factor cos(i)
  kickDeg: number;
  targetAltM: number;
  payloadMaxG: number;
}

export interface FlightOptions { seed: number; reliabilityScale: number; payloadMaxG: number; incDeg: number; kickDeg?: number }

export function createFlight(v: LaunchVehicle, payloadKg: number, opts: FlightOptions): FlightState {
  const s1 = STAGES[v.stageIds[0]], s2 = STAGES[v.stageIds[1]];
  const rot = Math.cos(deg2rad(Math.max(28.5, opts.incDeg)));
  const rng = rngFor(opts.seed, 'launch', v.id);
  const fails = rng() > 1 - (1 - v.reliability) * opts.reliabilityScale;
  const anomalyT = 25 + rng() * 380;
  const kind: 'engine' | 'separation' = rng() < 0.5 ? 'engine' : 'separation';
  return {
    t: 0, x: 0, y: R, vx: rot * EARTH_ROTATION_RATE * R, vy: 0, stage: 0, prop: [s1.propKg, s2.propKg], attached: [true, true],
    fairing: true, payloadKg: payloadKg + v.adapterKg, throttle: 0, engineOn: false, pitchDeg: 90, status: 'prelaunch', failure: null,
    dvUsed: 0, qNow: 0, gNow: 0, maxQ: 0, maxG: 0, overG: 0, anomaly: fails ? { t: anomalyT, kind } : null, separationBroken: false,
    kicked: false, kickPitch: 90, lastSepT: -100, events: [], rotation: rot, kickDeg: opts.kickDeg ?? 2.5, targetAltM: PARKING_ALT_M, payloadMaxG: opts.payloadMaxG,
  };
}

export function vehicleMass(v: LaunchVehicle, s: FlightState): number {
  const s1 = STAGES[v.stageIds[0]], s2 = STAGES[v.stageIds[1]];
  let m = s.payloadKg + (s.fairing ? v.fairingMassKg : 0);
  if (s.attached[1]) m += s2.dryKg + s.prop[1];
  if (s.attached[0]) m += s1.dryKg + s.prop[0];
  return m;
}

export interface Elements { a: number; e: number; rp: number; ra: number; periodS: number; hyper: boolean }
export function elements(s: { x: number; y: number; vx: number; vy: number }): Elements {
  const r = Math.hypot(s.x, s.y);
  const v2 = s.vx * s.vx + s.vy * s.vy;
  const eps = v2 / 2 - MU / r;
  const hh = s.x * s.vy - s.y * s.vx;
  if (eps >= 0) return { a: Infinity, e: 1, rp: (hh * hh) / (2 * MU), ra: Infinity, periodS: Infinity, hyper: true };
  const a = -MU / (2 * eps);
  const e = Math.sqrt(Math.max(0, 1 + (2 * eps * hh * hh) / (MU * MU)));
  return { a, e, rp: a * (1 - e), ra: a * (1 + e), periodS: 2 * Math.PI * Math.sqrt((a * a * a) / MU), hyper: false };
}

function log(s: FlightState, msg: string) { s.events.push({ t: Math.round(s.t * 10) / 10, msg }); }

function separate(v: LaunchVehicle, s: FlightState) {
  if (!s.attached[0]) return;
  if (s.separationBroken) { log(s, 'STAGE SEPARATION FAILED: clamp band did not release'); return; }
  if (s.anomaly?.kind === 'separation' && s.t >= s.anomaly.t - 400) {
    s.separationBroken = true; s.failure = 'Failed stage separation: the spent booster stayed attached'; s.status = 'failed';
    log(s, 'ANOMALY: stage separation failure'); return;
  }
  s.attached[0] = false; s.stage = 1; s.lastSepT = s.t;
  log(s, `Stage separation (booster residual ${Math.round(s.prop[0])} kg)`);
}

export interface Env { h: number; rho: number; p: number }
function atmosphere(h: number): Env {
  const hh = Math.max(h, 0);
  return { h, rho: hh > 150e3 ? 0 : 1.225 * Math.exp(-hh / 8500), p: Math.exp(-hh / 7200) };
}

export function stepFlight(v: LaunchVehicle, s: FlightState, c: FlightControls, dt = FLIGHT_DT) {
  if (s.status === 'failed' || s.status === 'orbit') return;
  const st = STAGES[v.stageIds[s.stage]];
  if (s.status === 'prelaunch') log(s, 'LIFT-OFF');
  s.status = 'ascent';
  // controls
  s.throttle = clamp(c.throttle, 0, 1);
  s.engineOn = c.engineOn;
  const slew = 5 * dt;
  s.pitchDeg += clamp(c.pitchDeg - s.pitchDeg, -slew, slew);
  if (c.separate) separate(v, s);
  if ((s.status as string) === 'failed') return;

  const r = Math.hypot(s.x, s.y);
  const ux = s.x / r, uy = s.y / r;       // up
  const ex = uy, ey = -ux;               // east (direction of travel)
  const h = r - R;
  const env = atmosphere(h);
  const m = vehicleMass(v, s);
  // thrust
  let thrust = 0, isp = st.ispVac;
  const stageLive = s.attached[s.stage];
  if (s.anomaly?.kind === 'engine' && s.t >= s.anomaly.t && s.engineOn && !s.failure) {
    s.prop[s.stage] = 0; s.failure = 'Engine anomaly: premature engine shutdown'; log(s, 'ANOMALY: engine shutdown');
  }
  if (s.engineOn && stageLive && s.prop[s.stage] > 0 && s.throttle > 0) {
    thrust = s.throttle * (st.thrustVac + (st.thrustSL - st.thrustVac) * env.p);
    isp = st.ispVac + (st.ispSL - st.ispVac) * env.p;
    const mdot = thrust / (isp * G0);
    const dm = mdot * dt;
    if (dm >= s.prop[s.stage]) { thrust *= s.prop[s.stage] / dm; s.prop[s.stage] = 0; log(s, `Stage ${s.stage + 1} propellant exhausted`); }
    else s.prop[s.stage] -= dm;
  }
  // relative velocity to atmosphere
  const vrelx = s.vx - s.rotation * EARTH_ROTATION_RATE * r * ex, vrely = s.vy - s.rotation * EARTH_ROTATION_RATE * r * ey;
  const vrel = Math.hypot(vrelx, vrely);
  const mach = vrel / 300;
  const cd = 0.28 + 0.32 * Math.exp(-Math.pow((mach - 1.05) / 0.45, 2));
  const area = Math.PI * Math.pow((s.attached[0] ? STAGES[v.stageIds[0]].diameterM : STAGES[v.stageIds[1]].diameterM) / 2, 2);
  const q = 0.5 * env.rho * vrel * vrel;
  const dragMag = q * cd * area;
  const pr = (s.pitchDeg * Math.PI) / 180;
  const tdx = Math.cos(pr) * ex + Math.sin(pr) * ux, tdy = Math.cos(pr) * ey + Math.sin(pr) * uy;
  let fx = thrust * tdx, fy = thrust * tdy;
  if (vrel > 1e-6) { fx -= dragMag * (vrelx / vrel); fy -= dragMag * (vrely / vrel); }
  const g = MU / (r * r);
  const ax = fx / m - g * ux, ay = fy / m - g * uy;
  s.vx += ax * dt; s.vy += ay * dt;
  s.x += s.vx * dt; s.y += s.vy * dt;
  s.t += dt;
  s.dvUsed += (thrust / m) * dt;
  s.qNow = q; s.maxQ = Math.max(s.maxQ, q);
  s.gNow = Math.hypot(fx, fy) / m / G0; s.maxG = Math.max(s.maxG, s.gNow);

  // jettison fairing
  if (s.fairing && h > 110e3 && q < 20) { s.fairing = false; log(s, 'Fairing jettisoned'); }
  // structural checks
  if (q > v.maxQPa * 1.3) { s.status = 'failed'; s.failure = `Structural overload: dynamic pressure ${Math.round(q / 1000)} kPa exceeded the vehicle limit`; log(s, s.failure); }
  if (s.gNow > s.payloadMaxG) s.overG += dt; else s.overG = Math.max(0, s.overG - dt);
  if (s.overG > 2.5) { s.status = 'failed'; s.failure = 'Payload structural overload: sustained acceleration above the spacecraft frame rating'; log(s, s.failure); }
  const r2 = Math.hypot(s.x, s.y);
  if (r2 < R && s.t > 2) { s.status = 'failed'; s.failure = s.failure ?? 'Ground impact: the vehicle did not reach orbit'; log(s, s.failure); return; }
  // orbit detection (engine cut with periapsis above the atmosphere)
  const el = elements(s);
  if (!el.hyper && el.rp - R > 150e3 && (!s.engineOn || s.throttle === 0 || thrust === 0) && h > 100e3) {
    s.status = 'orbit'; log(s, `ORBIT ACHIEVED ${Math.round((el.rp - R) / 1000)} x ${Math.round((el.ra - R) / 1000)} km`);
    return;
  }
  // out of propellant without orbit
  const noThrustLeft = (!s.attached[0] || s.prop[0] <= 0) && (s.prop[1] <= 0 || !s.attached[1]);
  if (noThrustLeft && s.t > 10 && (s.status as string) === 'ascent') {
    if (el.hyper || el.rp - R < 100e3) {
      s.status = 'failed'; s.failure = s.failure ?? 'Insufficient orbital velocity: propellant exhausted before reaching orbit'; log(s, s.failure);
    }
  }
  if (s.t > 2400) { s.status = 'failed'; s.failure = 'Flight timed out'; }
}

// ---- autopilot ----
export interface Guidance extends FlightControls { reason: string }

export function autopilot(v: LaunchVehicle, s: FlightState): Guidance {
  const r = Math.hypot(s.x, s.y);
  const ux = s.x / r, uy = s.y / r, ex = uy, ey = -ux;
  const vr = s.vx * ux + s.vy * uy;
  const vh = s.vx * ex + s.vy * ey;
  const h = r - R;
  const env = atmosphere(h);
  const st = STAGES[v.stageIds[s.stage]];
  const m = vehicleMass(v, s);
  let throttle = 1, pitch = 90, separateNow = false, reason = 'ascent';
  const vhRel = vh - s.rotation * EARTH_ROTATION_RATE * r;
  const gamma = rad2deg(Math.atan2(vr, vhRel));

  // stage logic
  if (s.stage === 0 && s.attached[0] && s.prop[0] <= 0.5) { separateNow = true; reason = 'stage separation'; }
  const stageLive = s.attached[s.stage];
  let engineOn = stageLive && s.t - s.lastSepT > 1.0;

  if (s.stage === 0) {
    // vertical rise, pitch kick, then gravity turn (pitch follows the velocity vector)
    const vrel = Math.hypot(vr, vhRel);
    if (!s.kicked && vrel < 55) { pitch = 90; reason = 'vertical rise'; }
    else {
      if (!s.kicked) { s.kicked = true; s.kickPitch = 90 - s.kickDeg; }
      s.kickPitch = Math.min(s.kickPitch, gamma);
      pitch = Math.max(Math.min(s.kickPitch, 90 - s.kickDeg), 0);
      reason = 'gravity turn';
    }
  } else {
    // upper stage: hold target altitude with vertical-acceleration guidance
    const gEff = MU / (r * r) - (vh * vh) / r;
    const vrDes = clamp(0.02 * (s.targetAltM - h), -40, 250);
    const aVert = (vrDes - vr) / 10 + gEff;
    const aT = (st.thrustVac / m);
    pitch = rad2deg(Math.asin(clamp(aVert / Math.max(aT, 0.1), -0.25, 1)));
    reason = 'altitude-hold guidance';
  }
  // max-Q and g limits
  const thrustNow = st.thrustVac + (st.thrustSL - st.thrustVac) * env.p;
  const qLim = v.maxQPa;
  if (s.qNow > 0.7 * qLim) throttle = clamp(1 - (s.qNow - 0.7 * qLim) / (0.3 * qLim), 0.6, 1);
  const gLim = Math.min(v.maxG, 5.5) * 0.98;
  const aMax = (gLim * G0 * m) / thrustNow;
  throttle = Math.min(throttle, aMax);
  throttle = clamp(throttle, 0.6, 1);
  // orbit cutoff
  const el = elements(s);
  if (s.stage === 1 && !el.hyper && el.rp - R >= s.targetAltM - 2e3 && h > 100e3) { throttle = 0; engineOn = false; reason = 'engine cutoff'; }
  return { throttle: engineOn ? throttle : 0, pitchDeg: pitch, engineOn, separate: separateNow, reason };
}

export interface FlightSummary {
  state: FlightState; orbitOk: boolean; perigeeKm: number; apogeeKm: number; upperPropKg: number; remainingDv: number; trail: [number, number][];
}

export function remainingUpperDv(v: LaunchVehicle, s: FlightState): number {
  const st = STAGES[v.stageIds[1]];
  if (!s.attached[1] || s.prop[1] <= 0) return 0;
  const m0 = s.payloadKg + st.dryKg + s.prop[1];
  const mf = s.payloadKg + st.dryKg;
  return st.ispVac * G0 * Math.log(m0 / mf);
}

/** Fly the whole ascent with the autopilot (headless). */
export function runAutoFlight(v: LaunchVehicle, payloadKg: number, opts: FlightOptions, maxT = 1200): FlightSummary {
  const s = createFlight(v, payloadKg, opts);
  const trail: [number, number][] = [];
  s.engineOn = true; s.throttle = 1; s.status = 'ascent';
  let n = 0;
  while (s.status === 'ascent' && s.t < maxT) {
    const g = autopilot(v, s);
    stepFlight(v, s, g);
    if (n++ % 20 === 0) trail.push([s.x, s.y]);
  }
  const el = elements(s);
  return {
    state: s, orbitOk: (s.status as string) === 'orbit', perigeeKm: (el.rp - R) / 1000, apogeeKm: (el.ra - R) / 1000,
    upperPropKg: s.prop[1], remainingDv: (s.status as string) === 'orbit' ? remainingUpperDv(v, s) : 0, trail,
  };
}

/** Search the pitch kick that leaves the most propellant in orbit (what a flight dynamics team would do pre-launch). */
export function tuneKick(v: LaunchVehicle, payloadKg: number, opts: FlightOptions): number {
  let best = 2.5, bestDv = -1;
  for (const k of [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 17, 20]) {
    const sum = runAutoFlight(v, payloadKg, { ...opts, kickDeg: k, reliabilityScale: 0 });
    if (sum.orbitOk && sum.remainingDv > bestDv) { bestDv = sum.remainingDv; best = k; }
  }
  return best;
}

// ---- injection planner (maneuver nodes) ----
export interface InjectionGoal { label: string; describe: string; check: (s: { x: number; y: number; vx: number; vy: number }) => { ok: boolean; note: string } }

/** What the burn(s) after the parking orbit must achieve, per launch class. */
export function injectionGoal(info: import('./orbitalMechanics').OrbitInfo): InjectionGoal {
  const km = (x: number) => Math.round(x / 1000).toLocaleString('en-US');
  const cls = info.def.launchClass;
  switch (cls) {
    case 'direct': {
      const rpT = info.rpM, raT = info.raM;
      return {
        label: `${km(info.perigeeAltM)} x ${km(info.apogeeAltM)} km orbit`,
        describe: info.perigeeAltM === info.apogeeAltM ? 'Burn 1 at periapsis raises the apoapsis to the target altitude; coast to apoapsis; burn 2 raises the periapsis (circularises).' : 'Burn 1 at periapsis raises the apoapsis; at apoapsis, burn 2 sets the periapsis.',
        check: (s) => {
          const el = elements(s);
          if (el.hyper) return { ok: false, note: 'escape trajectory' };
          const tol = (alt: number) => Math.max(60e3, 0.03 * alt);
          const ok = Math.abs(el.rp - rpT) <= tol(rpT - R) && Math.abs(el.ra - raT) <= tol(raT - R);
          return { ok, note: `now ${km(el.rp - R)} x ${km(el.ra - R)} km` };
        },
      };
    }
    case 'gto':
      return {
        label: 'Geostationary transfer orbit (apoapsis ~35,786 km)', describe: 'One prograde burn at periapsis raises the apoapsis to geostationary altitude. The spacecraft circularises later with its own engine.',
        check: (s) => { const el = elements(s); if (el.hyper) return { ok: false, note: 'escape trajectory' }; return { ok: el.ra - R > 34000e3 && el.ra - R < 37600e3 && el.rp - R > 150e3, note: `apoapsis ${km(el.ra - R)} km` }; },
      };
    case 'tli':
      return {
        label: 'Translunar trajectory (apoapsis at the Moon\'s distance ~384,000 km)', describe: 'One prograde burn at periapsis stretches the orbit until its far point reaches the Moon\'s orbit.',
        check: (s) => { const el = elements(s); if (el.hyper) return { ok: false, note: 'overshoot: escaped Earth' }; return { ok: el.ra > 3.7e8 && el.ra < 4.7e8, note: `apoapsis ${km(el.ra)} km (Moon at 384,400 km)` }; },
      };
    case 'l2':
      return {
        label: 'Sun-Earth L2 transfer (apoapsis ~1.5 million km)', describe: 'One prograde burn at periapsis sends the spacecraft out to about four times the Moon\'s distance.',
        check: (s) => { const el = elements(s); if (el.hyper) return { ok: false, note: 'overshoot: escaped Earth' }; return { ok: el.ra > 1.2e9 && el.ra < 1.9e9, note: `apoapsis ${km(el.ra)} km` }; },
      };
    default: {
      const c3 = info.c3Eff;
      return {
        label: `Interplanetary departure (C3 ≈ ${(c3 / 1e6).toFixed(1)} km²/s²)`, describe: 'A single prograde burn at periapsis gives the hyperbolic excess energy C3 = v² − 2μ/r needed for the transfer.',
        check: (s) => { const r = Math.hypot(s.x, s.y); const e = s.vx * s.vx + s.vy * s.vy - (2 * MU) / r; return { ok: e >= c3 * 0.88 && e <= c3 * 1.18, note: `C3 now ${(e / 1e6).toFixed(2)} km²/s² (target ${(c3 / 1e6).toFixed(1)})` }; },
      };
    }
  }
}

/** Impulsive prograde burn consuming upper-stage propellant (Tsiolkovsky). */
export function injectionBurn(v: LaunchVehicle, s: FlightState, dv: number): { ok: boolean; msg: string } {
  if (s.status !== 'orbit') return { ok: false, msg: 'Not in a stable orbit.' };
  if (dv <= 0) return { ok: false, msg: 'Choose a positive delta-v.' };
  const avail = remainingUpperDv(v, s);
  if (dv > avail + 1e-6) return { ok: false, msg: `Only ${Math.round(avail)} m/s of upper-stage delta-v remain.` };
  const isp = STAGES[v.stageIds[1]].ispVac;
  const m = vehicleMass(v, s);
  s.prop[1] = Math.max(0, s.prop[1] - m * (1 - Math.exp(-dv / (isp * G0))));
  const sp = Math.hypot(s.vx, s.vy);
  s.vx += (s.vx / sp) * dv; s.vy += (s.vy / sp) * dv; s.dvUsed += dv;
  log(s, `Burn executed: ${Math.round(dv)} m/s prograde (${Math.round(remainingUpperDv(v, s))} m/s left)`);
  return { ok: true, msg: 'Burn executed.' };
}

/** Advance the (unpowered) vehicle with RK4 until the next periapsis or apoapsis. */
export function coastToApsis(s: FlightState, which: 'periapsis' | 'apoapsis'): boolean {
  const el = elements(s);
  if (el.hyper) return false;
  const dt = Math.max(1, Math.min(120, el.periodS / 2000));
  const acc = (px: number, py: number): [number, number] => { const d = Math.hypot(px, py); const k = -MU / (d * d * d); return [k * px, k * py]; };
  let prev = s.x * s.vx + s.y * s.vy;
  let t = 0;
  for (let i = 0; i < 60000; i++) {
    const [a1x, a1y] = acc(s.x, s.y);
    const [a2x, a2y] = acc(s.x + 0.5 * dt * s.vx, s.y + 0.5 * dt * s.vy);
    const [a3x, a3y] = acc(s.x + 0.5 * dt * (s.vx + 0.5 * dt * a1x), s.y + 0.5 * dt * (s.vy + 0.5 * dt * a1y));
    const [a4x, a4y] = acc(s.x + dt * (s.vx + 0.5 * dt * a2x), s.y + dt * (s.vy + 0.5 * dt * a2y));
    s.x += dt * s.vx + ((dt * dt) / 6) * (a1x + a2x + a3x);
    s.y += dt * s.vy + ((dt * dt) / 6) * (a1y + a2y + a3y);
    s.vx += (dt / 6) * (a1x + 2 * a2x + 2 * a3x + a4x);
    s.vy += (dt / 6) * (a1y + 2 * a2y + 2 * a3y + a4y);
    t += dt;
    const vr = s.x * s.vx + s.y * s.vy;
    if ((which === 'apoapsis' && prev > 0 && vr <= 0) || (which === 'periapsis' && prev < 0 && vr >= 0)) { s.t += t; log(s, `Coasted ${(t / 60).toFixed(0)} min to ${which}`); return true; }
    prev = vr;
  }
  return false;
}
