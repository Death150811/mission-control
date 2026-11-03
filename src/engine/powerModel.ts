// Power model: solar generation (inverse-square with Sun distance), battery energy (Wh, not W), eclipse energy.

import type { SolarPart } from '../types';

/** Solar array output in W. P = A * W/m2(1 AU) / d^2 * (1 - deg)^years * pointing factor. */
export function solarPowerW(arrays: SolarPart[], sunDistAU: number, ageYears: number, extraLoss = 0, angleFactor = 0.92): number {
  let p = 0;
  for (const s of arrays) {
    p += s.areaM2 * s.wattsPerM2 * Math.pow(1 - s.degradationPerYear, ageYears);
  }
  return (p / (sunDistAU * sunDistAU)) * angleFactor * (1 - extraLoss);
}

/** Allowed depth of discharge vs. number of charge cycles per year (game approximation of Li-ion cycle life). */
export function batteryDod(cyclesPerYear: number): number {
  if (cyclesPerYear <= 100) return 0.8;
  if (cyclesPerYear <= 1000) return 0.6;
  if (cyclesPerYear <= 5000) return 0.4;
  return 0.3;
}

export function powerMarginPct(availableW: number, requiredW: number): number {
  if (requiredW <= 0) return 999;
  return ((availableW - requiredW) / requiredW) * 100;
}

/** Energy that must be delivered by the battery in one eclipse (Wh). */
export function eclipseEnergyWh(loadW: number, eclipseS: number): number {
  return (loadW * eclipseS) / 3600;
}
