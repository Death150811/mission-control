// Lumped thermal balance. Real: Stefan-Boltzmann radiation (Q = ε σ A T⁴), albedo and planetary-infrared inputs.
// Game approximations: one isothermal node, radiator area sized so that `heatRejectionW` is rejected at 300 K,
// louvers / pumped loops modulate the effective radiator area down to `sMin`, thermostatic heaters hold the battery limit (0 °C).

import type { FramePart, TargetId, ThermalPart } from '../types';
import type { OrbitInfo } from './orbitalMechanics';

export const SIGMA = 5.670374e-8;
const ENV: Record<TargetId, { alb: number; hot: number; cold: number }> = {
  earth: { alb: 0.3, hot: 237, cold: 237 }, moon: { alb: 0.12, hot: 550, cold: 5 }, mars: { alb: 0.25, hot: 300, cold: 80 },
  asteroid: { alb: 0.05, hot: 60, cold: 0 }, deepspace: { alb: 0, hot: 0, cold: 0 },
};

export interface ThermalInputs {
  target: TargetId; sunDistAU: number; orbit: OrbitInfo; frame: FramePart; thermal: ThermalPart;
  baseW: number;        // bus + computer + attitude + thermal electronics (heaters excluded)
  hotDissipationW: number; // everything dissipating in the hot case (heaters off)
}
export interface ThermalBalance {
  radiatorM2: number; sMin: number; qHotW: number; qColdW: number; tHotK: number; tColdK: number; heaterNeededW: number; holdK: number;
}

export function thermalBalance(i: ThermalInputs): ThermalBalance {
  const env = ENV[i.target];
  const body = i.orbit.body;
  const F = i.orbit.def.kind === 'halo' ? 0 : Math.pow(body.radius / (body.radius + i.orbit.effectiveAltM), 2);
  const S = 1361 / Math.pow(i.sunDistAU, 2);
  const rej = i.thermal.heatRejectionW;
  const aRad = rej / 390;
  const envHot = aRad * 0.85 * 0.5 * (env.hot * F + 0.3 * env.alb * S * F);
  const qHot = i.hotDissipationW + envHot;
  const qCold0 = i.baseW * 0.7 + aRad * 0.85 * 0.5 * env.cold * F;
  const sMin = i.thermal.id === 'th-passive' ? 1 : i.thermal.id === 'th-ins' ? 0.25 : 0.08;
  const holdK = i.thermal.id === 'th-active' ? 291 : i.thermal.id === 'th-ins' ? 293 : 0;
  const temp = (q: number, s: number) => 300 * Math.pow(Math.max(q, 1e-3) / (rej * s), 0.25);
  let tHot = temp(qHot, 1);
  let tCold = temp(qCold0, sMin);
  if (holdK > 0) {
    const f = Math.pow(holdK / 300, 4);
    if ((qHot / rej) / f <= 1) tHot = Math.max(tHot, holdK);
    if ((qCold0 / rej) / f >= sMin) tCold = Math.max(tCold, holdK);
  }
  let heaterNeeded = 0;
  if (tCold < 273) { heaterNeeded = Math.max(0, rej * sMin * Math.pow(273 / 300, 4) - qCold0); tCold = 273; }
  return { radiatorM2: aRad, sMin, qHotW: qHot, qColdW: qCold0 + heaterNeeded, tHotK: tHot, tColdK: tCold, heaterNeededW: heaterNeeded, holdK };
}
