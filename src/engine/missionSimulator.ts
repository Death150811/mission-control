// Day-by-day mission operations simulation. Deterministic for a given (design, scenario, difficulty, seed, actions).
// All resources interact: power -> instrument duty -> data -> storage -> downlink (link budget) -> science credit.

import { DIFFICULTY } from './difficulty';
import { applyResponse, bestResponse, rollEvent, worstResponse } from './eventEngine';
import { dailyCapacityMB, linkBudget } from './communicationModel';
import { elements, runAutoFlight, remainingUpperDv, tuneKick } from './flightSim';
import type { FlightState } from './flightSim';
import type { InstState, LaunchOutcome, MissionState, OpsPlan, Phase } from './missionTypes';
import { analyzeDesign, distanceAtDay, type Analysis } from './resourceManager';
import { DAY, G0, clamp, propellantUsed } from './physics';
import { solarPowerW } from './powerModel';
import { rngFor } from './rng';
import { discoveriesFor } from '../data/discoveries';
import { clampSelection, hohmann, planeChangeDv } from './orbitalMechanics';
import type { Design, Difficulty, Scenario } from '../types';

export interface FlightInput {
  orbitOk: boolean; remainingDv: number; failure: string | null; timeS: number; perigeeKm: number; apogeeKm: number; maxQkPa: number; maxG: number;
  log: { t: number; msg: string }[]; flown: 'player' | 'autopilot';
  injectionVerified?: boolean; injectionNote?: string;
}

export function flightInputFromState(v: import('../types').LaunchVehicle, s: FlightState): FlightInput {
  const el = elements(s);
  return {
    orbitOk: s.status === 'orbit', remainingDv: s.status === 'orbit' ? remainingUpperDv(v, s) : 0, failure: s.failure, timeS: s.t,
    perigeeKm: (el.rp - 6.371e6) / 1000, apogeeKm: (el.ra - 6.371e6) / 1000, maxQkPa: s.maxQ / 1000, maxG: s.maxG, log: s.events, flown: 'player',
  };
}

export function flightOptions(a: Analysis, seed: number) {
  return {
    seed, reliabilityScale: DIFFICULTY[a.difficulty].anomalyMul, payloadMaxG: a.frame?.maxAccelG ?? 6,
    incDeg: a.orbit.def.bodyId === 'earth' ? a.orbit.incDeg : 28.5,
  };
}

export function headlessFlight(a: Analysis, seed: number): FlightInput {
  if (!a.launch.classOk || a.launch.capacityKg < a.mass.total) {
    return { orbitOk: false, remainingDv: 0, failure: 'Payload exceeds the launch vehicle capacity for this destination', timeS: 0, perigeeKm: 0, apogeeKm: 0, maxQkPa: 0, maxG: 0, log: [], flown: 'autopilot' };
  }
  const opts = flightOptions(a, seed);
  const kick = tuneKick(a.vehicle, a.mass.total, opts);
  const r = runAutoFlight(a.vehicle, a.mass.total, { ...opts, kickDeg: kick });
  return {
    orbitOk: r.orbitOk, remainingDv: r.remainingDv, failure: r.state.failure, timeS: r.state.t, perigeeKm: r.perigeeKm, apogeeKm: r.apogeeKm,
    maxQkPa: r.state.maxQ / 1000, maxG: r.state.maxG, log: r.state.events, flown: 'autopilot',
  };
}

export function defaultOps(a: Analysis): OpsPlan {
  const duty: Record<string, number> = {};
  for (const i of a.instruments) duty[i.slotId] = 1;
  return { duty, priority: 'balanced', downlink: 'value', priorityInstrument: null, autoRespond: false };
}

function logm(m: MissionState, kind: MissionState['log'][number]['kind'], text: string) {
  m.log.push({ day: m.day, phase: m.phase, kind, text });
}

export function createMission(design: Design, scenario: Scenario, difficulty: Difficulty, seed: number, flight?: FlightInput): MissionState {
  const a = analyzeDesign(design, scenario, difficulty);
  const fl = flight ?? headlessFlight(a, seed);
  const rules = DIFFICULTY[difficulty];
  const rng = rngFor(seed, 'launch-delay');
  const delayDays = rng() < 0.1 * rules.anomalyMul ? 3 + Math.floor(rng() * 25) : 0;
  const reqDv = a.orbit.launchParkingDvMps;
  const injectionOk = fl.orbitOk && (fl.injectionVerified ?? fl.remainingDv >= reqDv);
  let reason = fl.failure ?? '';
  if (fl.orbitOk && !injectionOk) reason = fl.injectionNote ?? `Parking orbit reached, but the upper stage retained only ${Math.round(fl.remainingDv)} m/s of the ${Math.round(reqDv)} m/s injection burn required`;
  if (!fl.orbitOk && !reason) reason = 'Vehicle did not reach orbit';
  const launch: LaunchOutcome = {
    ok: injectionOk, flown: fl.flown, reason: injectionOk ? 'Nominal ascent and injection' : reason, remainingDv: fl.remainingDv, requiredDv: reqDv, flightTimeS: fl.timeS,
    delayDays, perigeeKm: fl.perigeeKm, apogeeKm: fl.apogeeKm, maxQkPa: fl.maxQkPa, maxG: fl.maxG, log: fl.log,
  };
  const insertionDay = Math.max(1, scenario.cruiseDays);
  const commDays = a.commissioningDays;
  const scienceStart = insertionDay + commDays;
  const m: MissionState = {
    seed, design, scenario, difficulty, a, day: 0, phase: 'launch', ended: false, outcome: 'running', endReason: '', launch,
    insertionDay, scienceStart, scienceEnd: scienceStart + scenario.nominalDays, extendedEnd: scienceStart + scenario.nominalDays + scenario.extendedDays,
    propKg: a.mass.propellant, socWh: a.power.batteryWh * 0.9, thrustS: 0, buffers: {}, generatedMB: 0, downlinkedMB: 0, lostMB: 0, inst: {}, points: {}, area: {},
    mods: { solarLoss: 0, extraLoadW: 0, extraLoadUntil: 0, blackoutUntil: 0, thermalExtra: 0, thermalUntil: 0, safeUntil: 0, shedUntil: 0, shedFrac: 0, battHealth: 1, navPenaltyUntil: 0, spike: {}, bonusCapacityToday: 0, dodCapUntil: 0, procPenalty: 1, txPenalty: 1, backupUsed: { computer: false, transmitter: false } },
    stats: { operatingDays: 0, safeModeDays: 0, brownoutDays: 0, blackoutDays: 0, shedDays: 0, eventsTotal: 0, qualitySum: 0, qualityCount: 0, skDeficitDays: 0, powerDeathDays: 0, peakBacklogMB: 0, extraCostM: 0, scienceDays: 0, lastAutoResponses: 0 },
    log: [], history: [], pending: null, ops: defaultOps(a), responses: [], insertionOk: false, discoveries: [],
  };
  for (const i of a.instruments) {
    m.buffers[i.slotId] = 0; m.points[i.slotId] = 0; m.area[i.slotId] = 0;
    m.inst[i.slotId] = { slotId: i.slotId, partId: i.part.id, name: i.part.name, status: 'ok', health: 1 } as InstState;
  }
  logm(m, 'info', `Countdown: ${a.vehicle.name} with ${Math.round(a.mass.total)} kg spacecraft. ${fl.flown === 'player' ? 'Flown by the player.' : 'Flown by the ascent autopilot.'}`);
  if (delayDays > 0) { m.stats.extraCostM += delayDays * 0.1; logm(m, 'warn', `Launch delayed ${delayDays} days (weather / range). Holding costs $${(delayDays * 0.1).toFixed(1)}M.`); }
  if (injectionOk) logm(m, 'success', `Lift-off, ascent and injection nominal. Parking orbit ${Math.round(fl.perigeeKm)} x ${Math.round(fl.apogeeKm)} km, ${Math.round(fl.remainingDv)} m/s left for injection.`);
  else { m.ended = true; m.outcome = 'failed'; m.endReason = `LAUNCH FAILURE: ${launch.reason}`; logm(m, 'critical', m.endReason); m.phase = 'done'; }
  return m;
}

function phaseFor(m: MissionState): Phase {
  if (m.day < m.insertionDay) return 'cruise';
  if (m.day === m.insertionDay) return 'insertion';
  if (m.day < m.scienceStart) return 'commissioning';
  if (m.day <= m.scienceEnd) return 'science';
  if (m.day <= m.extendedEnd) return 'extended';
  return 'done';
}

function endMission(m: MissionState, outcome: 'completed' | 'failed', reason: string) {
  m.ended = true; m.outcome = outcome; m.endReason = reason;
  logm(m, outcome === 'completed' ? 'success' : 'critical', reason);
}

const COMPRESSION_SIZE = { none: 1.0, lossless: 0.6, lossy: 0.3 } as const;

function doInsertion(m: MissionState) {
  const a = m.a;
  const def = a.orbit.def;
  const dv = a.orbit.insertionDvMps * 1.03;
  const eng = a.parts.engine;
  if (def.insertionType === 'none') {
    if (eng) m.propKg = Math.max(0, m.propKg - propellantUsed(25, eng.isp, a.mass.dry + m.propKg));
    m.insertionOk = true; logm(m, 'success', `Orbit trim complete: ${Math.round(a.orbit.perigeeAltM / 1000)} km orbit, period ${(a.orbit.periodS / 60).toFixed(1)} min.`); return;
  }
  if (!eng) return endMission(m, 'failed', 'ORBIT INSERTION FAILED: the spacecraft has no propulsion system');
  const used = propellantUsed(dv, eng.isp, a.mass.dry + m.propKg);
  if (used > m.propKg) return endMission(m, 'failed', `ORBIT INSERTION FAILED: needs ${used.toFixed(0)} kg propellant, only ${m.propKg.toFixed(0)} kg on board (delta-v ${Math.round(dv)} m/s). The spacecraft flew past its target.`);
  if (def.insertionType === 'impulsive' && a.propulsion.burnTimeS > a.propulsion.burnLimitS) return endMission(m, 'failed', `ORBIT INSERTION FAILED: the ${eng.name} would need a ${(a.propulsion.burnTimeS / 3600).toFixed(1)} h burn (limit 1 h); capture is impossible with so little thrust.`);
  if (eng.electric && a.propulsion.burnTimeS > 0 && m.thrustS < a.propulsion.burnTimeS * 0.95) {
    return endMission(m, 'failed', `RENDEZVOUS FAILED: the ion thruster only accumulated ${(m.thrustS / 86400).toFixed(0)} of ${(a.propulsion.burnTimeS / 86400).toFixed(0)} thrust-days. Not enough power or cruise time.`);
  }
  const rng = rngFor(m.seed, 'insertion');
  const needsNav = def.bodyId === 'asteroid';
  const pFail = ((1 - eng.reliability) * 2 + (needsNav && !a.science.navigation ? 0.45 : 0.01)) * (m.design.tests?.includes('fire') ? 0.5 : 1);
  if (rng() < pFail) return endMission(m, 'failed', needsNav && !a.science.navigation ? 'RENDEZVOUS FAILED: without optical navigation the spacecraft missed the asteroid.' : 'ORBIT INSERTION FAILED: engine anomaly during the burn.');
  m.propKg -= used; m.insertionOk = true;
  logm(m, 'success', `Orbit insertion complete: ${Math.round(dv)} m/s, ${used.toFixed(0)} kg of propellant. ${m.propKg.toFixed(0)} kg left for operations.`);
}

function sunlitFrac(a: Analysis) { return 1 - a.orbit.eclipseFrac; }

/** Advance one day. Does nothing while a decision is pending (unless auto-respond is on). */
export function stepDay(m: MissionState): void {
  if (m.ended) return;
  if (m.pending) {
    if (m.ops.autoRespond) { const r = applyResponse(m, m.pending, bestResponse(m.pending), true); logm(m, 'event', `Auto flight director: ${r}`); }
    else return;
  }
  const a = m.a;
  m.day += 1;
  const prev = m.phase;
  m.phase = phaseFor(m);
  if (m.phase !== prev) logm(m, 'info', `Phase: ${m.phase.toUpperCase()}`);
  // expire modifiers
  const mods = m.mods;
  if (m.day > mods.extraLoadUntil) mods.extraLoadW = 0;
  if (m.day > mods.thermalUntil) mods.thermalExtra = 0;
  if (m.day > mods.shedUntil) mods.shedFrac = 0;
  for (const k of Object.keys(mods.spike)) {
    if (mods.spike[k].until < m.day) { delete mods.spike[k]; if (m.ops.priorityInstrument === k) { m.ops.priorityInstrument = null; if (m.ops.downlink === 'priority') m.ops.downlink = 'value'; } }
  }
  if (m.phase === 'done') return endMission(m, 'completed', 'MISSION COMPLETE: end of the extended operations window.');
  if (m.phase === 'insertion') { doInsertion(m); if (m.ended) return; }

  const rules = DIFFICULTY[m.difficulty];
  const isOps = m.phase === 'commissioning' || m.phase === 'science' || m.phase === 'extended';
  const isCruise = m.phase === 'cruise';
  const isSafe = m.day <= mods.safeUntil;
  const sunF = sunlitFrac(a);
  const ageYears = (m.day / 365.25) * a.orbit.radiation;
  const genSun = solarPowerW(a.parts.solar, a.power.sunDistAU, ageYears, clamp(mods.solarLoss, 0, 0.95), a.power.angleFactor);
  const dist = distanceAtDay(m.scenario, a.orbit, m.day);
  const blackout = m.day <= mods.blackoutUntil;
  if (blackout) m.stats.blackoutDays += 1;
  if (isSafe) m.stats.safeModeDays += 1;

  // ---- loads ----
  const thermalExtra = m.day <= mods.thermalUntil ? mods.thermalExtra : 0;
  const heater = a.power.heaterW * (1 + thermalExtra) + thermalExtra * 20;
  const gimbal = a.parts.antenna?.powerW ?? 0;
  const baseW = a.power.busW + a.power.computerW + a.power.adcsW + a.power.thermalW + heater + gimbal + 5 + (m.day <= mods.extraLoadUntil ? mods.extraLoadW : 0);
  const shedPlan = m.day <= mods.shedUntil ? 1 - mods.shedFrac : 1;
  const commF = m.phase === 'commissioning' ? 0.5 : 1;
  const dutyOf = (slot: string): number => {
    const st = m.inst[slot];
    if (!st || st.status === 'failed' || !isOps || isSafe) return 0;
    const sp = mods.spike[slot];
    if (sp && sp.mult === 0) return 0;
    return clamp(m.ops.duty[slot] ?? 1, 0, 1) * commF * shedPlan;
  };
  const instStats = a.instruments;
  const instW = instStats.reduce((s, i) => s + i.part.powerW * dutyOf(i.slotId) * (i.part.sunlitOnly ? sunF : 1), 0);
  const instNonSunW = instStats.reduce((s, i) => s + (i.part.sunlitOnly ? 0 : i.part.powerW * dutyOf(i.slotId)), 0);
  const contactFrac = blackout ? 0 : a.orbit.contactFraction(m.design.groundStations) * (isSafe ? 0.5 : 1);
  const hasBacklog = Object.values(m.buffers).reduce((s, v) => s + v, 0) > 1;
  const txDc = a.parts.transmitter?.powerW ?? 0;
  const txW = isCruise ? txDc * contactFrac * 0.1 : hasBacklog || isOps ? txDc * contactFrac : 0;

  // electric propulsion thrusting in cruise
  let cruiseExtra = 0, thrustFrac = 0;
  if (isCruise && a.parts.engine?.electric) {
    const avail = genSun * sunF - (baseW + txW);
    thrustFrac = clamp(avail / a.parts.engine.powerW, 0, 1);
    cruiseExtra = thrustFrac * a.parts.engine.powerW;
    m.thrustS += thrustFrac * DAY * 0.85;
  }

  // ---- power balance (daily energy, Wh) ----
  const capWh = a.power.batteryWh * mods.battHealth;
  const usable = capWh * a.power.dod;
  const eclNeed = ((baseW + instNonSunW + txW) * a.orbit.eclipseS) / 3600;
  const eclShort = eclNeed > usable && eclNeed > 0 ? 1 - usable / eclNeed : 0;
  const brown = 1 - eclShort * a.orbit.eclipseFrac * 0.9;
  const Egen = genSun * sunF * 24;
  const Ebase = (baseW + cruiseExtra) * 24, Etx = txW * 24, Einst = instW * 24 * brown;
  const reserve = capWh * (m.ops.priority === 'science' ? 0.05 : m.ops.priority === 'survival' ? 0.35 : 0.15);
  const availInst = Egen + Math.max(0, m.socWh - reserve) - Ebase - Etx;
  let s = Einst > 0 ? clamp(availInst / Einst, 0, 1) : 1;
  const Eused = Ebase + Etx + Einst * s;
  const net = Egen - Eused;
  m.socWh = clamp(m.socWh + (net > 0 ? net * 0.92 : net), 0, capWh);
  if (Egen < Ebase + Etx && m.socWh <= capWh * 0.01) {
    m.stats.powerDeathDays += 1; s = 0;
    if (m.stats.powerDeathDays >= 4) return endMission(m, 'failed', 'SPACECRAFT LOST: the battery was exhausted with insufficient solar power to recover. The bus browned out.');
  } else m.stats.powerDeathDays = 0;
  if (s < 0.999 || eclShort > 0.05) m.stats.brownoutDays += 1;
  if (s < 0.5) m.stats.shedDays += 1;
  // battery wear
  const cyclesPerDay = DAY / a.orbit.periodS;
  const dodUsed = capWh > 0 ? Math.min(a.power.dod, eclNeed / capWh) : 1;
  mods.battHealth = Math.max(0.2, mods.battHealth - (cyclesPerDay * 0.2) / (30000 * Math.pow(0.3 / Math.max(dodUsed, 0.05), 1.2)));

  // ---- propellant: station keeping ----
  if (isOps && a.parts.engine) {
    const dv = a.propulsion.skPerYear / 365.25;
    const need = propellantUsed(dv, a.parts.engine.isp, a.mass.dry + m.propKg);
    if (need > m.propKg) { m.propKg = 0; m.stats.skDeficitDays += 1; } else m.propKg -= need;
  } else if (isOps && a.propulsion.skPerYear > 1) m.stats.skDeficitDays += 1;
  if (m.stats.skDeficitDays > 40 && a.propulsion.skPerYear > 15) return endMission(m, 'failed', 'ORBIT LOST: station-keeping propellant exhausted; the orbit decayed / drifted away.');
  const skFactor = m.stats.skDeficitDays > 0 ? clamp(1 - m.stats.skDeficitDays / 150, 0.5, 1) : 1;

  // ---- data, downlink, science ----
  let gen = 0, lost = 0, down = 0, rateBps = 0, capacityMB = 0, pointsToday = 0;
  if (isOps) {
    const comp = COMPRESSION_SIZE[m.design.compression];
    const procFactor = m.design.compression === 'none' ? 0.1 : m.design.compression === 'lossless' ? 1.0 : 1.3;
    const raw: Record<string, number> = {};
    let procNeed = 0;
    for (const i of instStats) {
      const d = dutyOf(i.slotId) * s * brown;
      const sp = mods.spike[i.slotId];
      const mult = sp ? sp.mult : 1;
      raw[i.slotId] = i.dataMBd * d * mult;
      procNeed += raw[i.slotId] * procFactor;
    }
    const procCap = a.data.processingCapMBd * mods.procPenalty;
    const ps = procNeed > procCap && procNeed > 0 ? procCap / procNeed : 1;
    for (const i of instStats) {
      const stored = raw[i.slotId] * ps * comp;
      gen += raw[i.slotId] * comp;
      lost += raw[i.slotId] * (1 - ps) * comp;
      m.buffers[i.slotId] += stored;
    }
    const total = Object.values(m.buffers).reduce((x, y) => x + y, 0);
    if (total > a.data.storageMB) {
      const over = total - a.data.storageMB;
      for (const k of Object.keys(m.buffers)) m.buffers[k] -= over * (m.buffers[k] / total);
      lost += over;
    }
    // downlink
    const link = a.parts.antenna && a.parts.transmitter && txW > 0 || (a.parts.antenna && a.parts.transmitter && contactFrac > 0)
      ? linkBudget(a.parts.antenna!, a.parts.transmitter!, a.parts.adcs, dist, m.difficulty, a.comms.pointingDeg * (1 + thermalExtra * 0.5)) : null;
    rateBps = link ? link.rateBps : 0;
    capacityMB = link ? dailyCapacityMB(rateBps, contactFrac * DAY) * (1 + mods.bonusCapacityToday) * (s < 0.2 ? 0.5 : 1) * mods.txPenalty : 0;
    mods.bonusCapacityToday = 0;
    let remaining = capacityMB;
    const sizeOf = (i: typeof instStats[number]) => Math.max(i.dataMBd * comp, 1e-9);
    const order = [...instStats].sort((x, y) => y.pointsPerDay / sizeOf(y) - x.pointsPerDay / sizeOf(x));
    if (m.ops.downlink === 'priority' && m.ops.priorityInstrument) {
      const idx = order.findIndex((i) => i.slotId === m.ops.priorityInstrument);
      if (idx > 0) order.unshift(order.splice(idx, 1)[0]);
    }
    const sent: Record<string, number> = {};
    if (m.ops.downlink === 'proportional') {
      const tot = Object.values(m.buffers).reduce((x, y) => x + y, 0);
      for (const i of instStats) sent[i.slotId] = tot > 0 ? Math.min(m.buffers[i.slotId], (m.buffers[i.slotId] / tot) * remaining) : 0;
    } else {
      for (const i of order) { const x = Math.min(m.buffers[i.slotId], remaining); sent[i.slotId] = x; remaining -= x; }
    }
    const navPen = m.day <= mods.navPenaltyUntil ? 0.85 : 1;
    for (const i of instStats) {
      const x = sent[i.slotId] ?? 0;
      if (x <= 0) continue;
      m.buffers[i.slotId] -= x; down += x;
      const st = m.inst[i.slotId];
      const f = x / sizeOf(i);
      const thermalQ = 1 - Math.min(0.6, thermalExtra * i.part.thermal);
      const q = st.health * thermalQ * skFactor * navPen * (m.phase === 'commissioning' ? 0.5 : 1);
      const pts = f * i.pointsPerDay * q;
      m.points[i.slotId] += pts; pointsToday += pts;
      m.area[i.slotId] += f * i.areaKm2Day * i.sunFrac * q;
    }
    m.generatedMB += gen; m.lostMB += lost; m.downlinkedMB += down;
    checkDiscoveries(m);
    const backlog = Object.values(m.buffers).reduce((x, y) => x + y, 0);
    m.stats.peakBacklogMB = Math.max(m.stats.peakBacklogMB, backlog);
    if (m.phase !== 'commissioning') {
      m.stats.scienceDays += 1;
      const planned = instStats.reduce((x, i) => x + (m.ops.duty[i.slotId] ?? 1), 0);
      const eff = instStats.reduce((x, i) => x + dutyOf(i.slotId) * s * (m.inst[i.slotId].status === 'degraded' ? 0.7 : 1), 0);
      if (!isSafe && planned > 0 && eff / planned >= 0.25) m.stats.operatingDays += 1;
    }
  }

  // commissioning outcome
  if (m.phase === 'commissioning' && m.day === m.scienceStart - 1) {
    for (const i of instStats) {
      const r = rngFor(m.seed, 'commission', i.slotId)();
      if (r > Math.pow(i.part.reliability, 0.3) * (0.6 + 0.4 * i.pointingFactor) + 0.05 + (m.design.tests?.includes('deploy') ? 0.04 : 0)) { m.inst[i.slotId].status = 'degraded'; m.inst[i.slotId].health = 0.6; logm(m, 'warn', `Commissioning: ${i.part.name} calibrated with reduced performance (60%).`); }
    }
    logm(m, 'success', 'Commissioning complete. Science operations begin.');
  }

  m.history.push({
    day: m.day, phase: m.phase, genW: genSun * sunF, loadW: (Ebase + Etx + Einst * s) / 24, socPct: capWh > 0 ? (m.socWh / capWh) * 100 : 0,
    powerMarginPct: Eused > 0 ? ((Egen - Eused) / Eused) * 100 : 0, storageMB: Object.values(m.buffers).reduce((x, y) => x + y, 0), generatedMB: gen,
    downlinkedMB: down, lostMB: lost, capacityMB, propKg: m.propKg, points: pointsToday, shed: 1 - s, rateKbps: rateBps / 1000, distanceAU: dist / 1.495978707e11,
    thermal: thermalExtra,
  });

  // events
  if (!m.ended && m.phase !== 'insertion') {
    const ev = rollEvent(m);
    if (ev) {
      m.pending = ev;
      logm(m, 'event', `${ev.title.toUpperCase()}: ${ev.description}`);
      if (m.ops.autoRespond) { const t = applyResponse(m, ev, bestResponse(ev), true); logm(m, 'event', `Auto flight director: ${t}`); }
    }
  }
  void rules; void G0;
}

export function respondToEvent(m: MissionState, responseId: string): string {
  if (!m.pending) return '';
  const t = applyResponse(m, m.pending, responseId, false);
  logm(m, 'event', `Response: ${t}`);
  return t;
}

export type OpsPolicy = 'director' | 'passive';

/** Headless run to the end (used for counterfactuals, tests, leaderboard comparison). */
export function runMission(design: Design, scenario: Scenario, difficulty: Difficulty, seed: number, policy: OpsPolicy = 'director', flight?: FlightInput): MissionState {
  const m = createMission(design, scenario, difficulty, seed, flight);
  m.ops.autoRespond = policy === 'director';
  let guard = 0;
  while (!m.ended && guard++ < 5000) {
    if (m.pending && policy === 'passive') { applyResponse(m, m.pending, worstResponse(m.pending), true); }
    stepDay(m);
  }
  return m;
}

export function totalBacklogMB(m: MissionState) { return Object.values(m.buffers).reduce((x, y) => x + y, 0); }

/** A scientific finding is "made" once enough returned data of the right domain has accumulated. */
function checkDiscoveries(m: MissionState) {
  for (const d of discoveriesFor(m.scenario.target)) {
    if (m.discoveries.some((x) => x.id === d.id)) continue;
    const pts = m.a.instruments.filter((i) => i.part.domains.some((x) => d.domains.includes(x))).reduce((s, i) => s + m.points[i.slotId], 0);
    if (pts >= d.points) {
      m.discoveries.push({ id: d.id, title: d.title, text: d.text, day: m.day });
      logm(m, 'success', 'DISCOVERY: ' + d.title);
    }
  }
}

export interface OrbitChangePlan { ok: boolean; why: string; dvMps: number; propKg: number; newPeriodMin: number; newAltKm: number; newIncDeg: number }

/** Plan an altitude (Hohmann) and inclination (plane change) manoeuvre for a circular orbit using the on-board chemical engine. */
export function planOrbitChange(m: MissionState, altKm: number, incDeg?: number): OrbitChangePlan {
  const a = m.a, def = a.orbit.def;
  const fail = (why: string): OrbitChangePlan => ({ ok: false, why, dvMps: 0, propKg: 0, newPeriodMin: 0, newAltKm: altKm, newIncDeg: incDeg ?? m.design.orbit.incDeg });
  if (!['circular', 'sunsync', 'asteroid'].includes(def.kind)) return fail('Only circular orbits can be re-planned in operations.');
  if (!(m.phase === 'commissioning' || m.phase === 'science' || m.phase === 'extended')) return fail('Orbit changes are possible once in orbit.');
  const eng = a.parts.engine;
  if (!eng) return fail('No engine on board.');
  if (eng.electric) return fail('Electric thrusters are too weak for an orbit change in operations.');
  const sel = clampSelection({ ...m.design.orbit, perigeeKm: altKm, apogeeKm: altKm, incDeg: incDeg ?? m.design.orbit.incDeg });
  const mu = a.orbit.body.mu, R = a.orbit.body.radius;
  const r1 = R + m.design.orbit.perigeeKm * 1000, r2 = R + sel.perigeeKm * 1000;
  let dv = Math.abs(r1 - r2) < 1 ? 0 : hohmann(mu, r1, r2).total;
  const di = def.kind === 'sunsync' ? 0 : Math.abs(sel.incDeg - m.design.orbit.incDeg);
  if (di > 0.01) dv += planeChangeDv(Math.sqrt(mu / r2), di);
  const used = propellantUsed(dv, eng.isp, a.mass.dry + m.propKg);
  const period = 2 * Math.PI * Math.sqrt(Math.pow(r2, 3) / mu) / 60;
  if (dv < 0.01) return { ...fail('No change.'), ok: false };
  if (used > m.propKg) return { ok: false, why: 'Needs ' + used.toFixed(1) + ' kg of propellant, ' + m.propKg.toFixed(1) + ' kg left.', dvMps: dv, propKg: used, newPeriodMin: period, newAltKm: sel.perigeeKm, newIncDeg: sel.incDeg };
  return { ok: true, why: '', dvMps: dv, propKg: used, newPeriodMin: period, newAltKm: sel.perigeeKm, newIncDeg: sel.incDeg };
}

export function executeOrbitChange(m: MissionState, altKm: number, incDeg?: number): string {
  const p = planOrbitChange(m, altKm, incDeg);
  if (!p.ok) return p.why;
  m.propKg -= p.propKg;
  m.design = { ...m.design, orbit: clampSelection({ ...m.design.orbit, perigeeKm: p.newAltKm, apogeeKm: p.newAltKm, incDeg: p.newIncDeg }) };
  m.a = analyzeDesign(m.design, m.scenario, m.difficulty);
  logm(m, 'success', 'ORBIT MANOEUVRE: now ' + p.newAltKm.toFixed(0) + ' km, inclination ' + p.newIncDeg.toFixed(1) + ' deg, period ' + p.newPeriodMin.toFixed(1) + ' min (' + p.dvMps.toFixed(0) + ' m/s, ' + p.propKg.toFixed(1) + ' kg).');
  return 'Manoeuvre executed.';
}
