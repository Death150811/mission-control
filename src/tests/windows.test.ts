import { describe, expect, it } from 'vitest';
import { ORBITS } from '../data/orbits';
import { SCENARIO_MAP } from '../data/missions';
import { getVehicle } from '../data/launchVehicles';
import { autoDesign } from '../engine/designFactory';
import { validateDesign } from '../engine/feasibilityValidator';
import { payloadCapacityKg } from '../engine/launch';
import { arrivalFactor, c3AtDay, nextOpenDay, windowHalfWidthD, windowQ, STANDBY_M_PER_MONTH } from '../engine/launchWindows';
import { clampSelection, defaultSelection, describeOrbit } from '../engine/orbitalMechanics';
import { analyzeDesign } from '../engine/resourceManager';

const mars = ORBITS.mars, aster = ORBITS['asteroid-orbit'];
const marsScn = SCENARIO_MAP['mars-atmosphere'];

describe('launch windows', () => {
  it('C3 is minimal at the window centre and maximal half a synodic period away', () => {
    const w = mars.window!;
    expect(windowQ(w, w.bestDay)).toBeCloseTo(0, 10);
    expect(windowQ(w, w.bestDay + w.periodD / 2)).toBeCloseTo(1, 10);
    expect(c3AtDay(mars, w.bestDay)).toBeCloseTo(mars.c3!, 3);
    expect(c3AtDay(mars, w.bestDay + w.periodD / 2)).toBeCloseTo(mars.c3! + w.spanC3, 3);
    expect(c3AtDay(mars, w.bestDay + w.periodD)).toBeCloseTo(mars.c3!, 3);
    expect(arrivalFactor(mars, w.bestDay + w.periodD / 2)).toBeCloseTo(1 + w.arrivalGain, 10);
  });
  it('Earth-bound and lunar targets have no window', () => {
    expect(ORBITS.lunar.window).toBeUndefined();
    expect(describeOrbit(defaultSelection('leo')).departDay).toBeUndefined();
    expect(describeOrbit(defaultSelection('l2')).departDay).toBeUndefined();
  });
  it('the default selection launches at the window centre and the day survives clamping', () => {
    const s = defaultSelection('mars');
    expect(s.departDay).toBe(mars.window!.bestDay);
    expect(clampSelection({ ...s, departDay: 9999 }).departDay).toBe(mars.window!.bestDay + 3 * mars.window!.periodD);
    expect(clampSelection({ ...s, departDay: -50 }).departDay).toBe(0);
  });
  it('off-window launches cost launcher payload and arrival delta-v', () => {
    const w = mars.window!;
    const best = describeOrbit({ ...defaultSelection('mars'), departDay: w.bestDay });
    const worst = describeOrbit({ ...defaultSelection('mars'), departDay: w.bestDay + w.periodD / 2 });
    expect(worst.launchParkingDvMps).toBeGreaterThan(best.launchParkingDvMps + 500);
    expect(worst.insertionDvMps).toBeGreaterThan(best.insertionDvMps);
    const v = getVehicle('lv-heavy');
    expect(payloadCapacityKg(v, worst)).toBeLessThan(payloadCapacityKg(v, best));
    const ab = describeOrbit({ ...defaultSelection('asteroid-orbit'), departDay: aster.window!.bestDay });
    const aw = describeOrbit({ ...defaultSelection('asteroid-orbit'), departDay: aster.window!.bestDay + aster.window!.periodD / 2 });
    expect(aw.insertionDvMps).toBeCloseTo(ab.insertionDvMps * (1 + aster.window!.arrivalGain), 6);
  });
  it('nextOpenDay never moves a date that is already inside a window and otherwise jumps to the opening', () => {
    const w = mars.window!, half = windowHalfWidthD(w);
    expect(nextOpenDay(w, w.bestDay)).toBe(w.bestDay);
    expect(nextOpenDay(w, w.bestDay + half - 1)).toBe(w.bestDay + half - 1);
    expect(nextOpenDay(w, 100)).toBeCloseTo(w.bestDay - half, 6);
    expect(nextOpenDay(w, w.bestDay + half + 5)).toBeCloseTo(w.bestDay + w.periodD - half, 6);
  });
});

describe('launch date, schedule and cost', () => {
  it('the guided Mars baseline is ready, inside the window and raises no window issues', () => {
    const d = autoDesign(marsScn, 'engineer');
    const a = analyzeDesign(d, marsScn, 'engineer');
    const w = mars.window!;
    expect(a.orbit.departDay!).toBeGreaterThanOrEqual(Math.floor(a.schedule.readyMonths * 30.44));
    expect(Math.abs(a.orbit.departDay! - w.bestDay)).toBeLessThanOrEqual(windowHalfWidthD(w));
    expect(validateDesign(a).filter((i) => i.id.startsWith('window'))).toEqual([]);
  });
  it('a launch date before the programme is ready blocks launch', () => {
    const d = autoDesign(marsScn, 'engineer');
    const early = analyzeDesign({ ...d, orbit: { ...d.orbit, departDay: 300 } }, marsScn, 'engineer');
    const issue = validateDesign(early).find((i) => i.id === 'window-early');
    expect(issue?.blocksLaunch).toBe(true);
    expect(early.schedule.totalMonths).toBeGreaterThanOrEqual(early.schedule.readyMonths);
  });
  it('waiting for the window costs standby money and a far-off date is flagged', () => {
    const d = autoDesign(marsScn, 'engineer');
    const a0 = analyzeDesign(d, marsScn, 'engineer');
    const later = analyzeDesign({ ...d, orbit: { ...d.orbit, departDay: a0.orbit.departDay! + 60 } }, marsScn, 'engineer');
    expect(later.schedule.waitMonths).toBeGreaterThan(a0.schedule.waitMonths + 1.9);
    expect(later.cost.standby - a0.cost.standby).toBeCloseTo((later.schedule.waitMonths - a0.schedule.waitMonths) * STANDBY_M_PER_MONTH, 6);
    expect(later.cost.total).toBeGreaterThan(a0.cost.total);
    const bad = analyzeDesign({ ...d, orbit: { ...d.orbit, departDay: mars.window!.bestDay + mars.window!.periodD / 2 } }, marsScn, 'engineer');
    expect(validateDesign(bad).some((i) => i.id === 'window-poor' && i.severity === 'CRITICAL')).toBe(true);
  });
});
