// Design construction helpers: empty designs, immutable placement, auto-design recipes (used for Beginner guidance,
// tests and counterfactual analysis) and propellant fitting from the Tsiolkovsky equation.

import { getPart, PARTS } from '../data/spacecraftComponents';
import type { Compression, Design, Difficulty, FramePart, OrbitSelection, Scenario } from '../types';
import { DIFFICULTY } from './difficulty';
import { defaultSelection } from './orbitalMechanics';
import { analyzeDesign } from './resourceManager';
import { DAYS_PER_MONTH, nextOpenDay } from './launchWindows';
import { ORBITS } from '../data/orbits';
import { G0 } from './physics';

let counter = 0;
export const newId = () => `d${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function emptyDesign(scenario: Scenario, name = 'New spacecraft'): Design {
  return {
    id: newId(), name, scenarioId: scenario.id, frameId: 'frame-m', placements: {}, propellantKg: 0, compression: 'lossless',
    groundStations: 2, orbit: defaultSelection(scenario.allowedOrbitIds[0]), vehicleId: 'lv-medium', arrayDrive: 'tracking', shieldingMm: 0, redundancy: { computer: false, transmitter: false, battery: false }, tests: [],
  };
}

export function setFrame(design: Design, frameId: string): Design {
  // Keep placements that still fit the new frame's slots.
  const frame = getPart<FramePart>(frameId)!;
  const placements: Record<string, string | null> = {};
  for (const [slot, pid] of Object.entries(design.placements)) {
    const def = frame.slots.find((s) => s.id === slot);
    const part = pid ? PARTS[pid] : null;
    if (def && part && def.accepts.includes(part.category)) placements[slot] = pid;
  }
  return { ...design, frameId, placements };
}

export function placePart(design: Design, slotId: string, partId: string | null): Design {
  return { ...design, placements: { ...design.placements, [slotId]: partId } };
}

/** Put a part into the first free compatible slot. Returns the same design if there is none. */
export function autoPlace(design: Design, partId: string): Design {
  const frame = getPart<FramePart>(design.frameId);
  const part = PARTS[partId];
  if (!frame || !part) return design;
  if (part.category === 'frame') return setFrame(design, partId);
  const wantSlot = (s: { id: string; accepts: string[] }) => s.accepts.includes(part.category) && !design.placements[s.id];
  // engines only into aft-1, tanks into aft-2.. (accepts lists enforce this)
  const slot = frame.slots.find(wantSlot);
  return slot ? placePart(design, slot.id, partId) : design;
}

export function removeInstance(design: Design, slotId: string): Design {
  return placePart(design, slotId, null);
}

export function countPlaced(design: Design, partId: string): number {
  return Object.values(design.placements).filter((p) => p === partId).length;
}

export interface Recipe {
  frame: string; wings: [string | null, string | null]; mast: string | null; bays: string[]; engine: string | null; tanks: string[];
  internals: string[]; orbit: Partial<OrbitSelection> & { orbitId: string }; vehicle: string; compression: Compression; stations: 1 | 2 | 3;
}

export const RECIPES: Record<string, Recipe> = {
  'lunar-explorer': {
    frame: 'frame-m', wings: ['sa-m', 'sa-m'], mast: 'ant-mga', bays: ['optical-cam', 'multispectral', 'ir-spec', 'laser-alt'],
    engine: 'eng-bi', tanks: ['tank-m', 'tank-m'], internals: ['tx-25', 'obc-2', 'adcs-wheels', 'th-ins', 'bat-m', 'bat-m'],
    orbit: { orbitId: 'lunar', perigeeKm: 100, apogeeKm: 100, incDeg: 90 }, vehicle: 'lv-medium', compression: 'lossless', stations: 2,
  },
  'mars-atmosphere': {
    frame: 'frame-l', wings: ['sa-l', 'sa-l'], mast: 'ant-hga', bays: ['atmo-sensor', 'uv-spec', 'particle-analyzer', 'magnetometer'],
    engine: 'eng-bi-h', tanks: ['tank-l', 'tank-l'], internals: ['tx-80', 'obc-2', 'adcs-wheels', 'th-ins', 'bat-m', 'bat-m'],
    orbit: { orbitId: 'mars', perigeeKm: 200, apogeeKm: 6200, incDeg: 75 }, vehicle: 'lv-medium', compression: 'lossless', stations: 3,
  },
  'earth-observation': {
    frame: 'frame-m', wings: ['sa-m', 'sa-m'], mast: 'ant-mga', bays: ['multispectral', 'thermal-sensor', 'optical-cam', 'atmo-sensor'],
    engine: 'eng-mono', tanks: ['tank-s'], internals: ['tx-25', 'obc-2', 'adcs-wheels', 'th-ins', 'bat-m', 'bat-m'],
    orbit: { orbitId: 'sso', perigeeKm: 650, apogeeKm: 650 }, vehicle: 'lv-medium', compression: 'lossless', stations: 3,
  },
  'asteroid-rendezvous': {
    frame: 'frame-m', wings: ['sa-m', 'sa-m'], mast: 'ant-hga', bays: ['navcam', 'optical-cam', 'ir-spec', 'laser-alt'],
    engine: 'eng-bi', tanks: ['tank-m', 'tank-m'], internals: ['tx-80', 'obc-2', 'adcs-star', 'th-ins', 'bat-m', 'bat-m', 'bat-s'],
    orbit: { orbitId: 'asteroid-orbit', perigeeKm: 2, apogeeKm: 2, incDeg: 90 }, vehicle: 'lv-medium', compression: 'lossless', stations: 2,
  },
  'deep-space-observatory': {
    frame: 'frame-l', wings: ['sa-m', 'sa-m'], mast: 'ant-hga', bays: ['telescope', 'uv-spec', 'ir-spec', 'rad-detector'],
    engine: 'eng-bi', tanks: ['tank-s'], internals: ['tx-25', 'obc-2', 'adcs-adv', 'th-active', 'bat-m', 'bat-s'],
    orbit: { orbitId: 'l2' }, vehicle: 'lv-medium', compression: 'lossless', stations: 3,
  },
};

export function buildFromRecipe(r: Recipe, scenario: Scenario, name: string): Design {
  let d: Design = { ...emptyDesign(scenario, name), frameId: r.frame, vehicleId: r.vehicle, compression: r.compression, groundStations: r.stations };
  d.orbit = { ...defaultSelection(r.orbit.orbitId), ...r.orbit } as OrbitSelection;
  d = placePart(d, 'wing-l', r.wings[0]);
  d = placePart(d, 'wing-r', r.wings[1]);
  if (r.mast) d = placePart(d, 'mast', r.mast);
  r.bays.forEach((b, i) => { d = placePart(d, `bay-${i + 1}`, b); });
  if (r.engine) d = placePart(d, 'aft-1', r.engine);
  r.tanks.forEach((t, i) => { d = placePart(d, `aft-${i + 2}`, t); });
  r.internals.forEach((p, i) => { d = placePart(d, `int-${i + 1}`, p); });
  return d;
}

/** Fill the tanks with the propellant required by the delta-v budget (Tsiolkovsky) plus margin. */
export function fitPropellant(d: Design, scenario: Scenario, difficulty: Difficulty, extraMargin = 0.12): Design {
  const a = analyzeDesign({ ...d, propellantKg: 0 }, scenario, difficulty);
  const eng = a.parts.engine;
  if (!eng || a.propulsion.tankCapacityKg <= 0) return { ...d, propellantKg: 0 };
  const dv = a.propulsion.dvRequired * (1 + DIFFICULTY[difficulty].designMargin + extraMargin);
  const need = a.mass.dry * (Math.exp(dv / (eng.isp * G0)) - 1);
  return { ...d, propellantKg: Math.round(Math.min(need, a.propulsion.tankCapacityKg)) };
}

/** Earliest launch day that is both ready and inside a window (interplanetary targets only; other designs are returned unchanged). */
export function fitDepartureDay(d: Design, scenario: Scenario, difficulty: Difficulty): Design {
  const w = ORBITS[d.orbit.orbitId]?.window;
  if (!w) return d;
  const a = analyzeDesign(d, scenario, difficulty);
  const readyDay = Math.ceil(a.schedule.readyMonths * DAYS_PER_MONTH);
  return { ...d, orbit: { ...d.orbit, departDay: Math.ceil(nextOpenDay(w, readyDay)) } };
}

export function autoDesign(scenario: Scenario, difficulty: Difficulty, name?: string): Design {
  const recipe = RECIPES[scenario.id] ?? RECIPES['lunar-explorer'];
  const base = buildFromRecipe(recipe, scenario, name ?? `${scenario.name} baseline`);
  return fitPropellant(fitDepartureDay(base, scenario, difficulty), scenario, difficulty);
}
