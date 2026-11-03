// Objective evaluation and the transparent 0-1000 scoring model:
//   scientific 35% + reliability 20% + resource efficiency 15% + budget efficiency 10% + operations 10% + objectives 10%.
// A failed mandatory objective caps the score; launch / insertion failures cap it much lower.

import { LAUNCH_VEHICLES, vehicleCostM } from '../data/launchVehicles';
import type { Objective } from '../types';
import type { MissionState } from './missionTypes';
import { payloadCapacityKg } from './launch';
import { clamp } from './physics';
import { totalBacklogMB } from './missionSimulator';

export interface ObjectiveResult {
  objective: Objective; value: number; target: number; progress: number; met: boolean; detail: string; bonus: boolean;
}

function poissonTail(lambda: number, k: number): number {
  // P(N >= k) for Poisson(lambda)
  if (k <= 0) return 1;
  if (lambda <= 0) return 0;
  let term = Math.exp(-lambda), cdf = 0;
  for (let n = 0; n < k; n++) { cdf += term; term = (term * lambda) / (n + 1); }
  return clamp(1 - cdf, 0, 1);
}

export function evaluateObjectives(m: MissionState): ObjectiveResult[] {
  const a = m.a;
  const bodyKm2 = 4 * Math.PI * Math.pow(a.orbit.body.radius / 1000, 2);
  const out: ObjectiveResult[] = [];
  const evalOne = (o: Objective, bonus: boolean): ObjectiveResult => {
    if (o.type === 'science') {
      const pts = a.instruments.filter((i) => i.part.domains.some((d) => o.domains.includes(d))).reduce((s, i) => s + m.points[i.slotId], 0);
      return { objective: o, value: pts, target: o.points, progress: clamp(pts / o.points, 0, 1), met: pts >= o.points, detail: `${pts.toFixed(1)} / ${o.points} science points`, bonus };
    }
    if (o.type === 'coverage') {
      const acc = a.science.coverageFractionMax;
      const area = a.instruments.filter((i) => i.areaKm2Day > 0 && i.part.domains.some((d) => o.domains.includes(d))).reduce((s, i) => s + m.area[i.slotId], 0);
      const lambda = area / Math.max(bodyKm2 * acc, 1e-9);
      const f = acc * poissonTail(lambda, o.repeats);
      return { objective: o, value: f, target: o.requiredFraction, progress: clamp(f / o.requiredFraction, 0, 1), met: f >= o.requiredFraction - 1e-9,
        detail: `${(f * 100).toFixed(0)}% of the surface covered ${o.repeats}x (need ${(o.requiredFraction * 100).toFixed(0)}%; orbit can reach ${(acc * 100).toFixed(0)}%)`, bonus };
    }
    let value = 0;
    switch (o.metric) {
      case 'operatingDays': value = m.stats.operatingDays; break;
      case 'uptime': value = m.stats.operatingDays / Math.max(m.scenario.nominalDays, 1); break;
      case 'dataReturnedGB': value = m.downlinkedMB / 1000; break;
      case 'revisitDays': value = a.science.revisitDays; break;
      case 'pointingDeg': value = a.science.pointingDeg; break;
      case 'thermalMargin': value = a.thermal.metric; break;
      case 'navigation': value = a.science.navigation; break;
    }
    const ge = o.op === '>=';
    const met = ge ? value >= o.value - 1e-9 : value <= o.value + 1e-9;
    const progress = ge ? clamp(value / o.value, 0, 1) : value <= 0 ? 1 : clamp(o.value / value, 0, 1);
    const fmt = (x: number) => (isFinite(x) ? (Math.abs(x) < 0.1 && x !== 0 ? x.toFixed(4) : x.toFixed(1)) : 'n/a');
    return { objective: o, value, target: o.value, progress, met, detail: `${fmt(value)} (need ${o.op} ${fmt(o.value)})`, bonus };
  };
  for (const o of m.scenario.objectives) out.push(evalOne(o, false));
  for (const o of m.scenario.bonus) out.push(evalOne(o, true));
  return out;
}

export interface ScoreComponent { id: string; label: string; weight: number; raw: number; points: number; explanation: string }
export interface ScoreResult {
  components: ScoreComponent[]; subtotal: number; caps: string[]; total: number; rank: string; objectives: ObjectiveResult[]; mandatoryMet: boolean; sciProgress: number;
}

export function rankOf(total: number): string {
  if (total >= 900) return 'Exceptional Mission';
  if (total >= 800) return 'Excellent Mission';
  if (total >= 650) return 'Successful Mission';
  if (total >= 450) return 'Partial Success';
  if (total >= 250) return 'Major Engineering Problems';
  return 'Mission Failure';
}

export function cheapestAdequateLaunchCost(m: MissionState): number {
  const a = m.a;
  let best = vehicleCostM(a.vehicle);
  for (const v of LAUNCH_VEHICLES) {
    if (payloadCapacityKg(v, a.orbit) >= a.mass.total * 1.0 && a.geometry.widthM <= v.fairingDiameterM * 0.95 && a.geometry.heightM <= v.fairingLengthM) best = Math.min(best, vehicleCostM(v));
  }
  return best;
}

export function scoreMission(m: MissionState): ScoreResult {
  const a = m.a;
  const results = evaluateObjectives(m);
  const core = results.filter((r) => !r.bonus);
  const bonus = results.filter((r) => r.bonus);
  const sciObjs = core.filter((r) => r.objective.type === 'science' || r.objective.type === 'coverage');
  const wSci = sciObjs.reduce((s, r) => s + r.objective.weight, 0) || 1;
  const sciBase = sciObjs.reduce((s, r) => s + r.objective.weight * r.progress, 0) / wSci;
  const bonusP = bonus.length ? bonus.reduce((s, r) => s + r.progress, 0) / bonus.length : 0;
  const sci = clamp(sciBase * 0.92 + bonusP * 0.08, 0, 1);

  const nominal = Math.max(m.scenario.nominalDays, 1);
  const launched = m.launch.ok && m.insertionOk;
  const opsFrac = clamp(m.stats.operatingDays / nominal, 0, 1);
  const trouble = m.stats.safeModeDays + m.stats.brownoutDays + 0.5 * m.stats.shedDays + m.stats.skDeficitDays;
  const smooth = 1 - clamp(trouble / (nominal * 0.5), 0, 1);
  const horizon = m.extendedEnd;
  const survival = m.outcome === 'completed' ? 1 : clamp(m.day / horizon, 0, 1) * 0.6;
  const rel = launched ? 0.5 * opsFrac + 0.25 * smooth + 0.25 * survival : 0;

  const util = a.power.genEolW > 0 ? a.power.avgLoadW / a.power.genEolW : 2;
  const sP = clamp(1 - Math.abs(0.65 - util) / 0.65, 0, 1);
  const sD = launched && m.generatedMB > 0 ? clamp(m.downlinkedMB / m.generatedMB, 0, 1) : 0;
  const sM = clamp(a.mass.instruments / Math.max(a.mass.dry, 1) / 0.18, 0, 1);
  const left = a.mass.propellant > 0 ? m.propKg / a.mass.propellant : 0;
  const sPr = a.parts.engine ? clamp(1 - Math.abs(left - 0.12) / 0.88, 0, 1) : 0.8;
  const res = launched ? (sP + sD + sM + sPr) / 4 : 0;

  const used = a.cost.total + m.stats.extraCostM;
  const usedFrac = used / Math.max(a.cost.budget, 1e-9);
  const minLaunch = cheapestAdequateLaunchCost(m);
  const launchEff = clamp(minLaunch / Math.max(a.cost.launch, 1e-9), 0, 1);
  const bud = usedFrac > 1 ? 0 : Math.pow(clamp(1.25 - usedFrac, 0, 1), 0.8) * (0.4 + 0.6 * sci) * (0.6 + 0.4 * launchEff);

  const backlog = totalBacklogMB(m);
  const dEff = launched ? clamp(m.downlinkedMB / Math.max(m.downlinkedMB + m.lostMB + backlog, 1), 0, 1) : 0;
  const evQ = m.stats.qualityCount > 0 ? m.stats.qualitySum / m.stats.qualityCount : 0.85;
  const lostFrac = launched ? 1 - clamp(m.lostMB / Math.max(m.generatedMB, 1), 0, 1) : 0;
  const bl = launched ? 1 - clamp(backlog / Math.max(m.generatedMB * 0.2, 1), 0, 1) : 0;
  const ops = launched ? 0.35 * dEff + 0.3 * evQ + 0.2 * lostFrac + 0.15 * bl : 0;

  const wAll = core.reduce((s, r) => s + r.objective.weight, 0) || 1;
  const obj = core.reduce((s, r) => s + r.objective.weight * (0.75 * (r.met ? 1 : 0) + 0.25 * r.progress), 0) / wAll;

  const comps: ScoreComponent[] = [
    { id: 'science', label: 'Scientific achievement', weight: 0.35, raw: sci, points: 0, explanation: `Weighted progress of science and coverage objectives = ${(sciBase * 100).toFixed(0)}%, bonus objectives ${(bonusP * 100).toFixed(0)}%. Only data that reached Earth counts.` },
    { id: 'reliability', label: 'Mission reliability', weight: 0.2, raw: rel, points: 0, explanation: `Operating days ${m.stats.operatingDays}/${nominal} (50%), smooth operations (${trouble.toFixed(0)} troubled days) (25%), survival (25%).` },
    { id: 'resources', label: 'Resource efficiency', weight: 0.15, raw: res, points: 0, explanation: `Power use ${(util * 100).toFixed(0)}% of EOL generation (ideal ~65%): ${(sP * 100).toFixed(0)}; data used ${(sD * 100).toFixed(0)}; instrument mass share ${(sM * 100).toFixed(0)}; propellant left ${(left * 100).toFixed(0)}% (ideal ~12%): ${(sPr * 100).toFixed(0)}.` },
    { id: 'budget', label: 'Budget efficiency', weight: 0.1, raw: bud, points: 0, explanation: `Spent ${(usedFrac * 100).toFixed(0)}% of budget (less is better, but science must be delivered). Cheapest adequate launcher $${minLaunch.toFixed(0)}M vs chosen $${a.cost.launch.toFixed(0)}M.` },
    { id: 'operations', label: 'Operational performance', weight: 0.1, raw: ops, points: 0, explanation: `Downlink efficiency ${(dEff * 100).toFixed(0)}%, anomaly response quality ${(evQ * 100).toFixed(0)}%, data not lost ${(lostFrac * 100).toFixed(0)}%, backlog cleared ${(bl * 100).toFixed(0)}%.` },
    { id: 'objectives', label: 'Mission objective completion', weight: 0.1, raw: obj, points: 0, explanation: `${core.filter((r) => r.met).length} of ${core.length} objectives met (met = 75%, partial progress = 25%).` },
  ];
  let subtotal = 0;
  for (const c of comps) { c.points = 1000 * c.weight * c.raw; subtotal += c.points; }

  const caps: string[] = [];
  let total = subtotal;
  const mandatoryMet = core.filter((r) => r.objective.mandatory).every((r) => r.met);
  const cap = (limit: number, why: string) => { if (total > limit) { total = limit; } caps.push(`${why} (score capped at ${limit})`); };
  if (!m.launch.ok) cap(120, 'Launch failed');
  else if (!m.insertionOk) cap(249, 'Orbit insertion failed');
  else if (m.outcome === 'failed') cap(sci < 0.05 ? 249 : 449, 'Spacecraft was lost before the mission ended');
  else if (!mandatoryMet) cap(649, 'At least one mandatory objective failed');
  return { components: comps, subtotal, caps, total: Math.round(total), rank: rankOf(total), objectives: results, mandatoryMet, sciProgress: sci };
}
