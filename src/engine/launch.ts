// Launch performance: payload capacity is DESTINATION-SPECIFIC and derived from the rocket equation.
//   dv_stage = Isp * g0 * ln(m0 / mf), summed over stages, compared with the delta-v the destination needs.
// Simplification: stage-1 Isp is a blend of sea-level and vacuum values, ascent losses are one calibrated constant.

import { STAGES } from '../data/launchVehicles';
import type { LaunchVehicle } from '../types';
import type { OrbitInfo } from './orbitalMechanics';
import { rotationBonus } from './orbitalMechanics';
import { G0, tsiolkovskyDv } from './physics';

/** Ideal delta-v (incl. gravity, drag, steering losses) to reach the 200 km parking orbit from a 28.5 deg site
 *  at inclination 28.5 deg. Calibrated against the flight simulator (see tests/flight.test.ts). */
export const ASCENT_BASE_DV = 9420;
export const PERFORMANCE_RESERVE_DV = 120; // m/s kept in hand for dispersions

export function ascentDv(incDeg: number): number {
  return ASCENT_BASE_DV + (rotationBonus(28.5) - rotationBonus(Math.max(28.5, incDeg)));
}

export interface StackDv { stage1: number; stage2: number; total: number; liftoffMassKg: number; twr: number }

export function stackDv(v: LaunchVehicle, payloadKg: number): StackDv {
  const s1 = STAGES[v.stageIds[0]], s2 = STAGES[v.stageIds[1]];
  const pl = payloadKg + v.adapterKg;
  const m2 = s2.dryKg + s2.propKg;
  const m0 = s1.dryKg + s1.propKg + m2 + v.fairingMassKg + pl;
  const isp1 = s1.ispSL + 0.45 * (s1.ispVac - s1.ispSL);
  const dv1 = tsiolkovskyDv(isp1, m0, m0 - s1.propKg);
  const dv2 = tsiolkovskyDv(s2.ispVac, m2 + pl, s2.dryKg + pl);
  return { stage1: dv1, stage2: dv2, total: dv1 + dv2, liftoffMassKg: m0, twr: s1.thrustSL / (m0 * G0) };
}

export interface LaunchRequirement { ascent: number; parking: number; total: number }
export function launchRequirement(orbit: OrbitInfo): LaunchRequirement {
  const inc = orbit.def.bodyId === 'earth' ? orbit.incDeg : 28.5;
  const ascent = ascentDv(inc);
  return { ascent, parking: orbit.launchParkingDvMps, total: ascent + orbit.launchParkingDvMps + PERFORMANCE_RESERVE_DV };
}

/** Largest spacecraft wet mass (kg) this vehicle can deliver to the given destination. */
export function payloadCapacityKg(v: LaunchVehicle, orbit: OrbitInfo): number {
  if (!v.classes.includes(orbit.def.launchClass)) return 0;
  const need = launchRequirement(orbit).total;
  let lo = 0, hi = 300000;
  if (stackDv(v, 0).total < need) return 0;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const s = stackDv(v, mid);
    if (s.total >= need && s.twr >= 1.15) lo = mid; else hi = mid;
  }
  return Math.floor(lo);
}

/** Capacity for every launch class at a reference orbit, for the Launch Center comparison chart. */
export function capacityTable(v: LaunchVehicle, infos: { label: string; info: OrbitInfo }[]) {
  return infos.map(({ label, info }) => ({ label, capacityKg: payloadCapacityKg(v, info), classOk: v.classes.includes(info.def.launchClass) }));
}
