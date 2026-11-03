import { describe, expect, it } from 'vitest';
import { BODIES } from '../data/bodies';
import { SCENARIO_MAP } from '../data/missions';
import { autoDesign, placePart } from '../engine/designFactory';
import { validateDesign } from '../engine/feasibilityValidator';
import { executeOrbitChange, planOrbitChange, runMission, createMission } from '../engine/missionSimulator';
import { defaultSelection, describeOrbit, doseAttenuation, dragDvPerYear, eclipseFractionBeta, hohmann, orbitLifetimeYears } from '../engine/orbitalMechanics';
import { analyzeDesign } from '../engine/resourceManager';
import { thermalBalance } from '../engine/thermalModel';
import { runTest } from '../engine/testFacility';
import { PARTS } from '../data/spacecraftComponents';
import type { ThermalPart } from '../types';

const lunar = SCENARIO_MAP['lunar-explorer'];
const eo = SCENARIO_MAP['earth-observation'];

describe('orbit environment realism', () => {
  it('eclipse fraction follows the beta-angle formula and vanishes for dawn-dusk orbits', () => {
    const R = BODIES.earth.radius, r = R + 600e3;
    expect(eclipseFractionBeta(R, r, 0)).toBeCloseTo(Math.asin(R / r) / Math.PI, 8);
    expect(eclipseFractionBeta(R, r, 30)).toBeLessThan(eclipseFractionBeta(R, r, 0));
    expect(eclipseFractionBeta(R, r, 80)).toBe(0);
  });
  it('sun-synchronous local time sets the beta angle and illumination', () => {
    const noon = describeOrbit({ ...defaultSelection('sso'), ltanH: 12 });
    const dawn = describeOrbit({ ...defaultSelection('sso'), ltanH: 6 });
    expect(noon.eclipseS).toBeGreaterThan(30 * 60);
    expect(dawn.eclipseS).toBe(0);
    expect(dawn.illum).toBeLessThan(noon.illum);
  });
  it('atmospheric drag: station-keeping delta-v and decay time depend on altitude and mass', () => {
    expect(dragDvPerYear(350, 500, 3)).toBeGreaterThan(dragDvPerYear(550, 500, 3) * 10);
    expect(dragDvPerYear(500, 250, 3)).toBeGreaterThan(dragDvPerYear(500, 1000, 3));
    expect(orbitLifetimeYears(400, 500, 3)).toBeLessThan(orbitLifetimeYears(700, 500, 3));
    expect(orbitLifetimeYears(1000, 500, 3)).toBeGreaterThan(100);
  });
  it('shielding attenuates the dose roughly tenfold per 3.5 mm of aluminium', () => {
    expect(doseAttenuation(2.5)).toBeCloseTo(1, 10);
    expect(doseAttenuation(6)).toBeLessThan(0.12);
  });
});

describe('new design parameters', () => {
  it('shielding adds mass and cuts the mission dose; redundancy adds mass and raises reliability', () => {
    const d = autoDesign(lunar, 'engineer');
    const base = analyzeDesign(d, lunar, 'engineer');
    const shielded = analyzeDesign({ ...d, shieldingMm: 4 }, lunar, 'engineer');
    expect(shielded.mass.total).toBeGreaterThan(base.mass.total);
    expect(shielded.radiation.doseKrad).toBeLessThan(base.radiation.doseKrad * 0.2);
    const red = analyzeDesign({ ...d, redundancy: { computer: true, transmitter: true, battery: true } }, lunar, 'engineer');
    expect(red.mass.total).toBeGreaterThan(base.mass.total);
    expect(red.reliability.critical).toBeGreaterThan(base.reliability.critical);
  });
  it('fixed arrays lose power compared with sun-tracking drives', () => {
    const d = autoDesign(lunar, 'engineer');
    const t = analyzeDesign({ ...d, arrayDrive: 'tracking' }, lunar, 'engineer');
    const f = analyzeDesign({ ...d, arrayDrive: 'fixed' }, lunar, 'engineer');
    expect(f.power.genEolW).toBeLessThan(t.power.genEolW * 0.8);
    expect(f.mass.power).toBeLessThan(t.mass.power);
  });
  it('a commercial computer in a harsh radiation orbit is flagged', () => {
    const s = SCENARIO_MAP['earth-observation'];
    let d = autoDesign(s, 'engineer');
    d = { ...d, orbit: defaultSelection('heo'), vehicleId: 'lv-medium' };
    d = placePart(d, 'int-2', 'obc-1');
    const issues = validateDesign(analyzeDesign(d, s, 'engineer'));
    expect(issues.some((i) => i.id === 'tid-crit' || i.id === 'tid-warn')).toBe(true);
  });
});

describe('thermal energy balance', () => {
  it('a passive design swings more than an actively controlled one', () => {
    const d = autoDesign(lunar, 'engineer');
    const a = analyzeDesign(d, lunar, 'engineer');
    const frame = a.frame!;
    const mk = (id: string) => thermalBalance({ target: 'moon', sunDistAU: 1, orbit: a.orbit, frame, thermal: PARTS[id] as ThermalPart, baseW: 70, hotDissipationW: 250 });
    const passive = mk('th-passive'), active = mk('th-active');
    expect(passive.tHotK - passive.tColdK).toBeGreaterThan(active.tHotK - active.tColdK);
    expect(passive.heaterNeededW).toBeGreaterThan(active.heaterNeededW);
  });
});

describe('test facility', () => {
  it('power test fails for an undersized battery and passes for the reference design', () => {
    const d = autoDesign(eo, 'engineer');
    expect(runTest('power', analyzeDesign(d, eo, 'engineer')).verdict).toBe('PASS');
    let weak = placePart(placePart(d, 'int-5', null), 'int-6', null);
    weak = placePart(placePart(placePart(weak, 'int-5', 'bat-s'), 'bay-3', 'radar-alt'), 'bay-4', 'laser-alt');
    expect(runTest('power', analyzeDesign(weak, eo, 'engineer')).verdict).not.toBe('PASS');
  });
  it('vibration test reports lower frequency for a heavier spacecraft', () => {
    const light = analyzeDesign(autoDesign(eo, 'engineer'), eo, 'engineer');
    const heavy = analyzeDesign({ ...autoDesign(eo, 'engineer'), shieldingMm: 8 }, eo, 'engineer');
    const f = (r: ReturnType<typeof runTest>) => parseFloat(r.metrics[0].value);
    expect(f(runTest('vibe', heavy))).toBeLessThan(f(runTest('vibe', light)));
  });
  it('booking tests costs money and schedule', () => {
    const d = autoDesign(eo, 'engineer');
    const none = analyzeDesign(d, eo, 'engineer');
    const some = analyzeDesign({ ...d, tests: ['tvac', 'rf'] }, eo, 'engineer');
    expect(some.cost.total).toBeGreaterThan(none.cost.total + 2);
    expect(some.schedule.totalMonths).toBeGreaterThan(none.schedule.totalMonths + 2);
  });
  it('every test returns metrics, findings and a verdict', () => {
    const a = analyzeDesign(autoDesign(lunar, 'engineer'), lunar, 'engineer');
    for (const id of ['power', 'tvac', 'vibe', 'rf', 'deploy', 'fire']) {
      const r = runTest(id, a);
      expect(['PASS', 'MARGINAL', 'FAIL']).toContain(r.verdict);
      expect(r.metrics.length).toBeGreaterThan(0);
      expect(r.findings.length).toBeGreaterThan(0);
    }
  });
});

describe('operations realism', () => {
  it('a complete mission produces scientific discoveries', () => {
    const m = runMission(autoDesign(lunar, 'engineer'), lunar, 'engineer', 11);
    expect(m.discoveries.length).toBeGreaterThanOrEqual(3);
  });
  it('orbit changes cost the Hohmann delta-v and propellant, and need enough propellant', () => {
    const d = autoDesign(lunar, 'engineer');
    const m = createMission(d, lunar, 'engineer', 5);
    m.phase = 'science';
    const plan = planOrbitChange(m, 200);
    const info = describeOrbit(d.orbit);
    const h = hohmann(info.body.mu, info.rpM, info.body.radius + 200e3);
    expect(plan.dvMps).toBeCloseTo(h.total, 3);
    expect(plan.ok).toBe(true);
    const before = m.propKg;
    expect(executeOrbitChange(m, 200)).toBe('Manoeuvre executed.');
    expect(m.propKg).toBeLessThan(before);
    expect(m.design.orbit.perigeeKm).toBe(200);
    expect(m.a.orbit.periodS).toBeGreaterThan(info.periodS);
    m.propKg = 0.1;
    expect(planOrbitChange(m, 400).ok).toBe(false);
  });
});
