// Simplified orbital mechanics. Real equations: Kepler period, vis-viva, Hohmann transfer, plane change,
// sun-synchronous inclination, hyperbolic capture. Game approximations: station-keeping budgets,
// ground-contact fractions (spherical-cap model), coverage (Poisson overlap) - see docs/ASSUMPTIONS.md.

import { arrivalFactor, c3AtDay, windowQ } from './launchWindows';
import { BODIES, EARTH_SURFACE_SPEED, LAUNCH_SITE_LAT_DEG, PARKING_ALT_M } from '../data/bodies';
import { ORBITS, type OrbitDef } from '../data/orbits';
import type { Body, OrbitSelection } from '../types';
import { AU, clamp, circularSpeed, deg2rad, rad2deg, visViva } from './physics';

/** T = 2 pi sqrt(a^3 / mu) */
export function orbitalPeriod(mu: number, a: number): number {
  return 2 * Math.PI * Math.sqrt((a * a * a) / mu);
}

export function sunSyncInclinationDeg(altKm: number): number {
  // Real: nodal precession must equal 0.9856 deg/day. For circular orbits cos(i) = -(a / 12352 km)^(7/2).
  const a = (BODIES.earth.radius / 1000) + altKm;
  const c = -Math.pow(a / 12352, 3.5);
  return rad2deg(Math.acos(clamp(c, -1, 1)));
}

export function hohmann(mu: number, r1: number, r2: number) {
  const a = (r1 + r2) / 2;
  const dv1 = Math.abs(visViva(mu, r1, a) - circularSpeed(mu, r1));
  const dv2 = Math.abs(circularSpeed(mu, r2) - visViva(mu, r2, a));
  return { dv1, dv2, total: dv1 + dv2, transferTimeS: Math.PI * Math.sqrt((a * a * a) / mu) };
}

/** dv = 2 v sin(di / 2) */
export function planeChangeDv(v: number, diDeg: number): number {
  return 2 * v * Math.sin(deg2rad(Math.abs(diDeg)) / 2);
}

/** Burn from a hyperbolic approach (v_inf) into an orbit with periapsis rp and apoapsis ra. */
export function captureDv(mu: number, vInf: number, rp: number, ra: number): number {
  const a = (rp + ra) / 2;
  const vHyp = Math.sqrt(vInf * vInf + (2 * mu) / rp);
  return Math.max(0, vHyp - visViva(mu, rp, a));
}

/** Eclipse fraction of an orbit with sun in the orbital plane (worst case beta = 0). */
export function eclipseFraction(bodyRadius: number, orbitRadius: number): number {
  return Math.asin(clamp(bodyRadius / orbitRadius, 0, 1)) / Math.PI;
}

/** Slant range from a ground station to a satellite at altitude h, minimum elevation eps. */
export function slantRange(R: number, h: number, epsDeg: number): number {
  const e = deg2rad(epsDeg);
  return Math.sqrt((R + h) ** 2 - (R * Math.cos(e)) ** 2) - R * Math.sin(e);
}

/** Earth central half-angle of the visibility cap. */
export function visibilityHalfAngle(R: number, h: number, epsDeg: number): number {
  const e = deg2rad(epsDeg);
  return Math.acos(clamp((R * Math.cos(e)) / (R + h), -1, 1)) - e;
}

export function accessibleFraction(incDeg: number, halfSwathDeg: number): number {
  const maxLat = Math.min(incDeg, 180 - incDeg) + halfSwathDeg;
  return Math.sin(deg2rad(clamp(maxLat, 0.01, 90)));
}

export function atmosphereRho(hM: number) {
  return 1.225 * Math.exp(-hM / 8500);
}

/** Eclipse fraction of a circular orbit for a given beta angle (angle between orbit plane and the Sun direction).
 *  fraction = acos( sqrt(h^2 + 2 R h) / ((R + h) cos(beta)) ) / pi, zero when |beta| exceeds asin(R / r). */
export function eclipseFractionBeta(bodyRadius: number, orbitRadius: number, betaDeg: number): number {
  const b = deg2rad(Math.abs(betaDeg));
  if (b >= Math.asin(clamp(bodyRadius / orbitRadius, 0, 1))) return 0;
  const x = Math.sqrt(orbitRadius * orbitRadius - bodyRadius * bodyRadius) / (orbitRadius * Math.cos(b));
  return Math.acos(clamp(x, -1, 1)) / Math.PI;
}

/** Upper-atmosphere density for moderate solar activity (log-interpolated table of typical values, kg/m^3). Game approximation. */
const DENSITY_TABLE: [number, number][] = [[200, 2.5e-10], [250, 6.5e-11], [300, 2.0e-11], [350, 7.5e-12], [400, 3.0e-12], [450, 1.3e-12], [500, 6.0e-13], [600, 1.5e-13], [700, 4.0e-14], [800, 1.5e-14], [900, 6.0e-15], [1000, 3.0e-15], [1200, 1.0e-15], [1500, 2.0e-16]];
export function atmDensityKm(altKm: number): number {
  if (altKm <= DENSITY_TABLE[0][0]) return DENSITY_TABLE[0][1] * Math.exp((DENSITY_TABLE[0][0] - altKm) / 25);
  if (altKm >= DENSITY_TABLE[DENSITY_TABLE.length - 1][0]) return 0;
  for (let i = 1; i < DENSITY_TABLE.length; i++) {
    const [h1, r1] = DENSITY_TABLE[i - 1], [h2, r2] = DENSITY_TABLE[i];
    if (altKm <= h2) { const f = (altKm - h1) / (h2 - h1); return Math.exp(Math.log(r1) * (1 - f) + Math.log(r2) * f); }
  }
  return 0;
}
/** Delta-v per year to cancel drag: a = 1/2 rho v^2 Cd A / m. */
export function dragDvPerYear(altKm: number, massKg: number, areaM2: number, cd = 2.2): number {
  const rho = atmDensityKm(altKm);
  const v = Math.sqrt(BODIES.earth.mu / (BODIES.earth.radius + altKm * 1000));
  return (0.5 * rho * v * v * cd * areaM2 / Math.max(massKg, 1)) * 31557600;
}
/** Years until a circular orbit decays to 180 km if never boosted: integrates dr/dt = -rho B sqrt(mu r), B = Cd A / m. */
export function orbitLifetimeYears(altKm: number, massKg: number, areaM2: number, cd = 2.2): number {
  const B = (cd * areaM2) / Math.max(massKg, 1);
  let t = 0;
  for (let h = altKm; h > 180; h -= 2) {
    const r = BODIES.earth.radius + h * 1000;
    const rate = atmDensityKm(h) * B * Math.sqrt(BODIES.earth.mu * r); // m/s
    if (rate <= 0) return 999;
    t += 2000 / rate;
    if (t > 999 * 31557600) return 999;
  }
  return t / 31557600;
}

/** Total ionising dose rate (krad per year behind 2.5 mm aluminium). Typical-value table; game approximation. */
export const DOSE_KRAD_YR: Record<string, number> = { leo: 0.5, sso: 0.8, meo: 25, geo: 6, heo: 30, lunar: 3, mars: 2, 'asteroid-orbit': 3, l2: 4 };
export function doseAttenuation(totalMmAl: number): number { return Math.exp(-(totalMmAl - 2.5) / 1.5); }

export interface OrbitInfo {
  def: OrbitDef;
  body: Body;
  sel: OrbitSelection;
  rpM: number; raM: number; aM: number; e: number; incDeg: number;
  periodS: number; vPeriMps: number; vApoMps: number;
  effectiveAltM: number; perigeeAltM: number; apogeeAltM: number;
  eclipseFrac: number; eclipseS: number; cyclesPerYear: number;
  groundSpeedMps: number;
  contactFraction: (stations: number) => number;
  losFraction: number;
  fixedCommDistanceM: number;
  insertionDvMps: number;
  launchParkingDvMps: number;
  stationKeepingDvPerYear: number;
  radiation: number;
  betaDeg: number;
  illum: number;          // sunlight quality for imaging (1 = ideal)
  doseKradYr: number;     // behind 2.5 mm Al
  departDay?: number;     // chosen launch day for interplanetary targets (days from programme start)
  c3Eff: number;          // departure C3 on the chosen day, m^2/s^2 (0 for Earth-bound targets)
  windowQ: number;        // 0 = centre of the launch window, 1 = worst date
  notes: string[];
}

export function clampSelection(sel: OrbitSelection): OrbitSelection {
  const def = ORBITS[sel.orbitId];
  if (!def) return sel;
  const peri = clamp(sel.perigeeKm, def.periRange[0], def.periRange[1]);
  let apo = def.apoRange ? clamp(sel.apogeeKm, def.apoRange[0], def.apoRange[1]) : peri;
  if (def.apoRange) apo = Math.max(apo, peri);
  let inc = clamp(sel.incDeg, def.incRange[0], def.incRange[1]);
  if (def.kind === 'sunsync') inc = sunSyncInclinationDeg(peri);
  const departDay = def.window ? Math.round(clamp(sel.departDay ?? def.window.bestDay, 0, def.window.bestDay + 3 * def.window.periodD)) : undefined;
  return { orbitId: sel.orbitId, perigeeKm: peri, apogeeKm: apo, incDeg: inc, ltanH: def.kind === 'sunsync' ? clamp(sel.ltanH ?? 10.5, 6, 18) : undefined, departDay };
}

export function defaultSelection(orbitId: string): OrbitSelection {
  const d = ORBITS[orbitId];
  return clampSelection({ orbitId, perigeeKm: d.defaultPeri, apogeeKm: d.defaultApo, incDeg: d.defaultInc });
}

/** Delta-v the LAUNCH VEHICLE must add after reaching the 200 km parking orbit. */
export function launcherDvFromParking(def: OrbitDef, body: Body, rpAlt: number, raAlt: number, c3Eff?: number): number {
  const earth = BODIES.earth;
  const r0 = earth.radius + PARKING_ALT_M;
  const vc = circularSpeed(earth.mu, r0);
  switch (def.launchClass) {
    case 'direct': {
      const rp = earth.radius + rpAlt, ra = earth.radius + raAlt;
      if (Math.abs(ra - r0) < 1 && Math.abs(rp - r0) < 1) return 0;
      const dv1 = Math.abs(visViva(earth.mu, r0, (r0 + ra) / 2) - vc);
      const aF = (rp + ra) / 2;
      const dv2 = Math.abs(visViva(earth.mu, ra, aF) - visViva(earth.mu, ra, (r0 + ra) / 2));
      return dv1 + dv2;
    }
    case 'gto': {
      const rg = earth.radius + 35786e3;
      return Math.abs(visViva(earth.mu, r0, (r0 + rg) / 2) - vc);
    }
    default: {
      const c3 = c3Eff ?? def.c3 ?? 0;
      return Math.sqrt((2 * earth.mu) / r0 + c3) - vc;
    }
  }
}

/** Delta-v the SPACECRAFT itself must supply to reach its final orbit. */
export function spacecraftInsertionDv(def: OrbitDef, body: Body, rpAlt: number, raAlt: number, arrivalGain = 1): number {
  const earth = BODIES.earth;
  switch (def.launchClass) {
    case 'direct': return 25; // trim and circularisation
    case 'gto': {
      const r0 = earth.radius + PARKING_ALT_M;
      const rg = earth.radius + 35786e3;
      const v1 = visViva(earth.mu, rg, (r0 + rg) / 2);
      const v2 = circularSpeed(earth.mu, rg);
      const di = deg2rad(LAUNCH_SITE_LAT_DEG);
      return Math.sqrt(v1 * v1 + v2 * v2 - 2 * v1 * v2 * Math.cos(di));
    }
    case 'tli':
    case 'tmi': {
      const rp = body.radius + rpAlt, ra = body.radius + raAlt;
      return captureDv(body.mu, (def.vInfMps ?? 800) * arrivalGain, rp, ra);
    }
    default: return (def.fixedInsertionDv ?? 0) * arrivalGain;
  }
}

export function stationKeepingDvPerYear(def: OrbitDef, rpKm: number, raKm: number, incDeg: number): number {
  switch (def.id) {
    case 'leo': return Math.max(0.5, 150 * Math.exp(-(rpKm - 400) / 60)) + 2;
    case 'sso': return Math.max(0.5, 150 * Math.exp(-(rpKm - 400) / 60)) + 5;
    case 'meo': return 3;
    case 'geo': return 50;
    case 'heo': return 10 + 20 * Math.abs(incDeg - 63.4);
    case 'lunar': return 60 * (100 / Math.max(rpKm, 30));
    case 'mars': return 8;
    case 'asteroid-orbit': return 25;
    case 'l2': return 4;
    default: return 5;
  }
}

export function describeOrbit(selIn: OrbitSelection): OrbitInfo {
  const sel = clampSelection(selIn);
  const def = ORBITS[sel.orbitId];
  const body = BODIES[def.bodyId];
  const notes: string[] = [];
  let rp: number, ra: number;
  if (def.kind === 'halo') {
    // Heliocentric: semi-major axis about 1 AU + 1.5e6 km. Real L2 orbits are held at 1 year by Earth's gravity;
    // the two-body period below is a Kepler approximation (~1.5% too long).
    rp = ra = AU + 1.5e9;
    notes.push('Two-body Kepler approximation: true L2 halo orbits keep a 1-year period thanks to Earth\'s gravity.');
  } else {
    rp = body.radius + sel.perigeeKm * 1000;
    ra = body.radius + sel.apogeeKm * 1000;
  }
  const a = (rp + ra) / 2;
  const e = (ra - rp) / (ra + rp);
  const periodS = orbitalPeriod(body.mu, a);
  const vPeri = visViva(body.mu, rp, a);
  const vApo = visViva(body.mu, ra, a);
  const effR = a * (1 + (e * e) / 2); // time-averaged orbital radius
  const effectiveAltM = def.kind === 'halo' ? 0 : effR - body.radius;
  const betaDeg = def.kind === 'sunsync' ? Math.min(90, Math.abs((sel.ltanH ?? 10.5) - 12) * 15) : 0;
  const eclFrac = def.kind === 'halo' ? 0 : eclipseFractionBeta(body.radius, effR, betaDeg);
  const isEarthOrbit = def.bodyId === 'earth';
  const losFraction = isEarthOrbit || def.kind === 'halo' ? 1 : 1 - eclipseFraction(body.radius, effR);
  const contactFraction = (stations: number) => {
    if (isEarthOrbit) {
      const lam = visibilityHalfAngle(body.radius, effectiveAltM, 10);
      const f1 = (1 - Math.cos(lam)) / 2;
      return 1 - Math.pow(1 - f1, stations);
    }
    const hours = stations === 1 ? 6 : stations === 2 ? 12 : 20; // DSN-like tracking hours per day
    return (hours / 24) * losFraction;
  };
  let fixedCommDistanceM = 0;
  if (isEarthOrbit) fixedCommDistanceM = slantRange(body.radius, def.kind === 'elliptical' ? sel.apogeeKm * 1000 : effectiveAltM, 10);
  else if (def.kind === 'halo') fixedCommDistanceM = 1.5e9;
  else if (def.bodyId === 'moon') fixedCommDistanceM = 3.84e8;
  else if (def.bodyId === 'mars') fixedCommDistanceM = 1.5 * AU;
  else fixedCommDistanceM = 0.9 * AU;
  const earth = BODIES.earth;
  void earth;
  const departDay = sel.departDay;
  const c3Eff = departDay !== undefined ? c3AtDay(def, departDay) : (def.c3 ?? 0);
  const q = departDay !== undefined && def.window ? windowQ(def.window, departDay) : 0;
  const insertion = spacecraftInsertionDv(def, body, sel.perigeeKm * 1000, sel.apogeeKm * 1000, departDay !== undefined ? arrivalFactor(def, departDay) : 1);
  const parking = launcherDvFromParking(def, body, sel.perigeeKm * 1000, sel.apogeeKm * 1000, c3Eff);
  return {
    def, body, sel, rpM: rp, raM: ra, aM: a, e, incDeg: sel.incDeg, periodS, vPeriMps: vPeri, vApoMps: vApo,
    effectiveAltM, perigeeAltM: sel.perigeeKm * 1000, apogeeAltM: sel.apogeeKm * 1000,
    eclipseFrac: eclFrac, eclipseS: eclFrac * periodS, cyclesPerYear: (365.25 * 86400) / periodS,
    groundSpeedMps: def.kind === 'halo' ? 0 : (body.radius * 2 * Math.PI) / periodS,
    contactFraction, losFraction, fixedCommDistanceM,
    insertionDvMps: insertion, launchParkingDvMps: parking,
    stationKeepingDvPerYear: stationKeepingDvPerYear(def, sel.perigeeKm, sel.apogeeKm, sel.incDeg),
    radiation: def.radiation, betaDeg, illum: def.kind === 'sunsync' ? Math.max(0.25, Math.cos(deg2rad(betaDeg))) : 1, doseKradYr: DOSE_KRAD_YR[def.id] ?? 3, departDay, c3Eff, windowQ: q, notes,
  };
}

/** Preview of an impulsive burn at periapsis/apoapsis of the current orbit (educational maneuver planner). */
export function previewBurn(info: OrbitInfo, where: 'periapsis' | 'apoapsis', dvProgradeMps: number) {
  const mu = info.body.mu;
  const r = where === 'periapsis' ? info.rpM : info.raM;
  const v = where === 'periapsis' ? info.vPeriMps : info.vApoMps;
  const v2 = v + dvProgradeMps;
  const a2 = 1 / (2 / r - (v2 * v2) / mu);
  if (a2 < 0 || !isFinite(a2)) return { escape: true as const, rpM: r, raM: Infinity, e: 1, periodS: Infinity };
  const rOther = 2 * a2 - r;
  const rp2 = Math.min(r, rOther), ra2 = Math.max(r, rOther);
  return { escape: false as const, rpM: rp2, raM: ra2, e: (ra2 - rp2) / (ra2 + rp2), periodS: orbitalPeriod(mu, (rp2 + ra2) / 2) };
}

/** RK4 integration of two-body motion (used for trajectory previews). */
export function propagate(mu: number, r: [number, number], v: [number, number], tEnd: number, dt: number): [number, number][] {
  const pts: [number, number][] = [[r[0], r[1]]];
  let x = r[0], y = r[1], vx = v[0], vy = v[1];
  const acc = (px: number, py: number): [number, number] => {
    const d = Math.hypot(px, py);
    const k = -mu / (d * d * d);
    return [k * px, k * py];
  };
  for (let t = 0; t < tEnd; t += dt) {
    const [a1x, a1y] = acc(x, y);
    const [a2x, a2y] = acc(x + 0.5 * dt * vx, y + 0.5 * dt * vy);
    const [a3x, a3y] = acc(x + 0.5 * dt * (vx + 0.5 * dt * a1x), y + 0.5 * dt * (vy + 0.5 * dt * a1y));
    const [a4x, a4y] = acc(x + dt * (vx + 0.5 * dt * a2x), y + dt * (vy + 0.5 * dt * a2y));
    x += dt * vx + (dt * dt / 6) * (a1x + a2x + a3x);
    y += dt * vy + (dt * dt / 6) * (a1y + a2y + a3y);
    vx += (dt / 6) * (a1x + 2 * a2x + 2 * a3x + a4x);
    vy += (dt / 6) * (a1y + 2 * a2y + 2 * a3y + a4y);
    pts.push([x, y]);
  }
  return pts;
}

/** Launch ascent delta-v shift with inclination: v_rot bonus = 465 cos(i) m/s. */
export function rotationBonus(incDeg: number): number {
  return EARTH_SURFACE_SPEED * Math.cos(deg2rad(incDeg));
}
