// Launch vehicles are FICTIONAL, built from stage modules with game-balance numbers.
// Payload capacity is NOT stored: it is computed per destination from the stage data with the rocket equation.

import type { LaunchVehicle, StageDef } from '../types';

export const STAGES: Record<string, StageDef> = {
  'stg-s1': { id: 'stg-s1', name: 'Kestrel booster', dryKg: 1400, propKg: 20600, ispSL: 285, ispVac: 313, thrustSL: 380e3, thrustVac: 418e3, diameterM: 1.3, costM: 5, restart: false },
  'stg-s2': { id: 'stg-s2', name: 'Kestrel upper stage', dryKg: 380, propKg: 3300, ispSL: 300, ispVac: 342, thrustSL: 26e3, thrustVac: 30e3, diameterM: 1.3, costM: 2.5, restart: true },
  'stg-m1': { id: 'stg-m1', name: 'Atlas-M first stage', dryKg: 22000, propKg: 395000, ispSL: 282, ispVac: 311, thrustSL: 7.6e6, thrustVac: 8.2e6, diameterM: 3.7, costM: 28, restart: false },
  'stg-m2': { id: 'stg-m2', name: 'Atlas-M upper stage', dryKg: 4000, propKg: 107000, ispSL: 320, ispVac: 348, thrustSL: 800e3, thrustVac: 934e3, diameterM: 3.7, costM: 14, restart: true },
  'stg-h1': { id: 'stg-h1', name: 'Titan-H core + boosters', dryKg: 95000, propKg: 1500000, ispSL: 290, ispVac: 320, thrustSL: 29e6, thrustVac: 31e6, diameterM: 5.0, costM: 70, restart: false },
  'stg-h2': { id: 'stg-h2', name: 'Titan-H cryogenic upper stage', dryKg: 14000, propKg: 330000, ispSL: 420, ispVac: 450, thrustSL: 3.2e6, thrustVac: 3.5e6, diameterM: 5.0, costM: 36, restart: true },
  'stg-r1': { id: 'stg-r1', name: 'Micro booster', dryKg: 800, propKg: 9200, ispSL: 280, ispVac: 308, thrustSL: 190e3, thrustVac: 210e3, diameterM: 1.0, costM: 2, restart: false },
  'stg-r2': { id: 'stg-r2', name: 'Micro kick stage', dryKg: 150, propKg: 1400, ispSL: 300, ispVac: 335, thrustSL: 13e3, thrustVac: 15e3, diameterM: 1.0, costM: 1.2, restart: true },
};

export const STAGE_OPTIONS_1 = ['stg-s1', 'stg-m1', 'stg-h1'];
export const STAGE_OPTIONS_2 = ['stg-s2', 'stg-m2', 'stg-h2'];

export const LAUNCH_VEHICLES: LaunchVehicle[] = [
  { id: 'lv-micro', name: 'MICRO-SHARE', className: 'Dedicated rideshare launch', stageIds: ['stg-r1', 'stg-r2'],
    fairingDiameterM: 1.15, fairingLengthM: 2.2, fairingMassKg: 35, adapterKg: 15, maxComHeightM: 0.7, maxQPa: 38000, maxG: 8,
    reliability: 0.95, baseCostM: 1.5, leadMonths: 4, classes: ['direct'],
    desc: 'A small launcher on a shared-manifest schedule. Cheapest ticket, tiny fairing, low-Earth destinations only, and lower reliability.' },
  { id: 'lv-small', name: 'KESTREL-S', className: 'Small launch vehicle', stageIds: ['stg-s1', 'stg-s2'],
    fairingDiameterM: 1.35, fairingLengthM: 2.8, fairingMassKg: 60, adapterKg: 25, maxComHeightM: 0.9, maxQPa: 40000, maxG: 7,
    reliability: 0.96, baseCostM: 2, leadMonths: 8, classes: ['direct'],
    desc: 'Dedicated small launcher for LEO and SSO. Affordable, frequent, but no deep-space capability.' },
  { id: 'lv-medium', name: 'ATLAS-M', className: 'Medium launch vehicle', stageIds: ['stg-m1', 'stg-m2'],
    fairingDiameterM: 4.6, fairingLengthM: 6.5, fairingMassKg: 1900, adapterKg: 120, maxComHeightM: 2.2, maxQPa: 33000, maxG: 5,
    reliability: 0.985, baseCostM: 5, leadMonths: 10, classes: ['direct', 'gto', 'tli', 'tmi', 'asteroid', 'l2'],
    desc: 'Workhorse medium-lift rocket with a restartable upper stage: LEO, GTO and the Moon, plus light interplanetary payloads.' },
  { id: 'lv-heavy', name: 'TITAN-H', className: 'Heavy launch vehicle', stageIds: ['stg-h1', 'stg-h2'],
    fairingDiameterM: 5.0, fairingLengthM: 12, fairingMassKg: 3500, adapterKg: 250, maxComHeightM: 3.6, maxQPa: 34000, maxG: 5,
    reliability: 0.98, baseCostM: 10, leadMonths: 16, classes: ['direct', 'gto', 'tli', 'tmi', 'asteroid', 'l2'],
    desc: 'Heavy lifter with a cryogenic upper stage. Enormous capacity, enormous price, long lead time.' },
];

export const BOOSTERS: Record<string, { id: string; name: string; dryKg: number; propKg: number; ispSL: number; ispVac: number; thrustSL: number; thrustVac: number; diameterM: number; costM: number }> = {
  'sb-s': { id: 'sb-s', name: 'Strap-on S', dryKg: 450, propKg: 4500, ispSL: 245, ispVac: 268, thrustSL: 260e3, thrustVac: 285e3, diameterM: 0.7, costM: 1.2 },
  'sb-m': { id: 'sb-m', name: 'Strap-on M', dryKg: 2600, propKg: 30000, ispSL: 250, ispVac: 272, thrustSL: 1.6e6, thrustVac: 1.75e6, diameterM: 1.4, costM: 3.5 },
  'sb-h': { id: 'sb-h', name: 'Strap-on H', dryKg: 9500, propKg: 115000, ispSL: 255, ispVac: 278, thrustSL: 5.6e6, thrustVac: 6.1e6, diameterM: 2.4, costM: 9 },
};

/** Strap-on boosters are modelled as part of stage 1: same burn, thrust and propellant pooled, dropped together at separation. */
function withBoosters(stageId: string, boosters?: { type: string; count: number }): string {
  const b = boosters && BOOSTERS[boosters.type];
  if (!b || !boosters || boosters.count <= 0) return stageId;
  const n = Math.min(6, Math.round(boosters.count));
  const id = `cb:${stageId}:${b.id}x${n}`;
  if (!STAGES[id]) {
    const s = STAGES[stageId];
    const G = 9.80665;
    const tSL = s.thrustSL + n * b.thrustSL, tVac = s.thrustVac + n * b.thrustVac;
    const mdSL = s.thrustSL / (s.ispSL * G) + (n * b.thrustSL) / (b.ispSL * G);
    const mdVac = s.thrustVac / (s.ispVac * G) + (n * b.thrustVac) / (b.ispVac * G);
    STAGES[id] = { ...s, id, name: `${s.name} + ${n}x ${b.name}`, dryKg: s.dryKg + n * b.dryKg, propKg: s.propKg + n * b.propKg, thrustSL: tSL, thrustVac: tVac, ispSL: tSL / (mdSL * G), ispVac: tVac / (mdVac * G), diameterM: Math.sqrt(s.diameterM ** 2 + n * b.diameterM ** 2), costM: s.costM + n * b.costM };
  }
  return id;
}

export function getVehicle(id: string, custom?: [string, string], boosters?: { type: string; count: number }): LaunchVehicle {
  if (id === 'lv-custom' && custom) return buildCustomVehicle(custom, boosters);
  return LAUNCH_VEHICLES.find((v) => v.id === id) ?? LAUNCH_VEHICLES[2];
}

export function buildCustomVehicle(base: [string, string], boosters?: { type: string; count: number }): LaunchVehicle {
  const stageIds: [string, string] = [withBoosters(base[0], boosters), base[1]];
  const s1 = STAGES[stageIds[0]], s2 = STAGES[stageIds[1]];
  const big = Math.max(s1.diameterM, s2.diameterM);
  const fairD = Math.max(1.35, big * 1.2);
  return {
    id: 'lv-custom', name: 'CUSTOM STACK', className: 'Player-assembled stack', stageIds,
    fairingDiameterM: fairD, fairingLengthM: Math.max(2.8, fairD * 1.7), fairingMassKg: Math.round(40 * fairD * fairD),
    adapterKg: Math.round(25 * fairD), maxComHeightM: 0.7 * fairD, maxQPa: 35000, maxG: 6,
    reliability: 0.94, baseCostM: 4, leadMonths: 12, classes: ['direct', 'gto', 'tli', 'tmi', 'asteroid', 'l2'],
    desc: 'A stack you assembled from catalogue stages. Untested design: lower reliability, longer lead time.', custom: true,
  };
}

export function vehicleCostM(v: LaunchVehicle): number {
  return STAGES[v.stageIds[0]].costM + STAGES[v.stageIds[1]].costM + v.baseCostM;
}
