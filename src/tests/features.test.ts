import { describe, expect, it } from 'vitest';
import { LAUNCH_VEHICLES, buildCustomVehicle, getVehicle, vehicleCostM } from '../data/launchVehicles';
import { TECH_NODES, canUnlock, creditsFor, STARTER_PARTS, unlockedPartSet } from '../data/techTree';
import { PARTS } from '../data/spacecraftComponents';
import { coastToApsis, elements, injectionBurn, injectionGoal, runAutoFlight, tuneKick, remainingUpperDv } from '../engine/flightSim';
import { payloadCapacityKg } from '../engine/launch';
import { defaultSelection, describeOrbit } from '../engine/orbitalMechanics';

function parkingOrbit() {
  const v = LAUNCH_VEHICLES.find((x) => x.id === 'lv-medium')!;
  const opts = { seed: 1, reliabilityScale: 0, payloadMaxG: 8, incDeg: 28.5 };
  const r = runAutoFlight(v, 800, { ...opts, kickDeg: tuneKick(v, 800, opts) });
  expect(r.orbitOk).toBe(true);
  return { v, s: r.state };
}

describe('strap-on boosters', () => {
  const base: [string, string] = ['stg-s1', 'stg-s2'];
  it('boosters raise delta-v, thrust and payload capacity, and cost money', () => {
    const plain = buildCustomVehicle(base);
    const boosted = buildCustomVehicle(base, { type: 'sb-s', count: 4 });
    const orbit = describeOrbit(defaultSelection('leo'));
    expect(payloadCapacityKg(boosted, orbit)).toBeGreaterThan(payloadCapacityKg(plain, orbit));
    expect(vehicleCostM(boosted)).toBeGreaterThan(vehicleCostM(plain));
  });
  it('getVehicle resolves the same stack deterministically', () => {
    const a = getVehicle('lv-custom', ['stg-m1', 'stg-m2'], { type: 'sb-m', count: 2 });
    const b = getVehicle('lv-custom', ['stg-m1', 'stg-m2'], { type: 'sb-m', count: 2 });
    expect(a.stageIds).toEqual(b.stageIds);
    expect(a.stageIds[0]).toContain('sb-m');
  });
});

describe('injection planner (maneuver node)', () => {
  it('a burn of the right size reaches the translunar target; a short burn does not', () => {
    const { v, s } = parkingOrbit();
    const info = describeOrbit(defaultSelection('lunar'));
    const goal = injectionGoal(info);
    const good = structuredClone(s);
    expect(coastToApsis(good, 'periapsis')).toBe(true);
    // vis-viva solution for an apoapsis at the Moon's distance
    const r = Math.hypot(good.x, good.y), v0 = Math.hypot(good.vx, good.vy);
    const dv = Math.sqrt(398600441800000 * (2 / r - 2 / (r + 3.9e8))) - v0;
    expect(injectionBurn(v, good, dv).ok).toBe(true);
    expect(goal.check(good).ok).toBe(true);
    const short = structuredClone(s);
    coastToApsis(short, 'periapsis');
    injectionBurn(v, short, dv - 400);
    expect(goal.check(short).ok).toBe(false);
  });
  it('burning consumes upper-stage propellant (rocket equation) and cannot exceed what is left', () => {
    const { v, s } = parkingOrbit();
    const before = remainingUpperDv(v, s);
    const t = structuredClone(s);
    expect(injectionBurn(v, t, 1000).ok).toBe(true);
    expect(remainingUpperDv(v, t)).toBeCloseTo(before - 1000, 0);
    expect(injectionBurn(v, t, 1e6).ok).toBe(false);
  });
  it('coasting preserves energy', () => {
    const { s } = parkingOrbit();
    const t = structuredClone(s);
    const e0 = elements(t);
    coastToApsis(t, 'apoapsis');
    const e1 = elements(t);
    expect(Math.abs(e1.a - e0.a) / e0.a).toBeLessThan(1e-3);
  });
});

describe('technology tree', () => {
  it('every unlock refers to a real part or vehicle, and prerequisites exist', () => {
    const ids = new Set(TECH_NODES.map((n) => n.id));
    for (const n of TECH_NODES) {
      for (const r of n.requires) expect(ids.has(r)).toBe(true);
      for (const u of n.unlocks) expect(PARTS[u] !== undefined || u.startsWith('lv-')).toBe(true);
    }
  });
  it('unlocking needs prerequisites and credits', () => {
    const electric = TECH_NODES.find((n) => n.id === 'electric')!;
    expect(canUnlock(electric, [], 1000).ok).toBe(false);
    expect(canUnlock(electric, ['power2', 'propulsion2'], 10).ok).toBe(false);
    expect(canUnlock(electric, ['power2', 'propulsion2'], 500).ok).toBe(true);
  });
  it('starter hardware excludes advanced parts until researched', () => {
    expect(unlockedPartSet([]).has('eng-ion')).toBe(false);
    expect(unlockedPartSet(['power2', 'propulsion2', 'electric']).has('eng-ion')).toBe(true);
    expect(STARTER_PARTS).toContain('lv-medium');
  });
  it('credits reward higher scores and first completions', () => {
    expect(creditsFor(900, 0)).toBeGreaterThan(creditsFor(500, 0));
    expect(creditsFor(700, 0)).toBeGreaterThan(creditsFor(700, 650));
  });
});
