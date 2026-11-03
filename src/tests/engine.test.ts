import { describe, expect, it } from 'vitest';
import { BODIES } from '../data/bodies';
import { LAUNCH_VEHICLES } from '../data/launchVehicles';
import { SCENARIOS, SCENARIO_MAP } from '../data/missions';
import { PARTS } from '../data/spacecraftComponents';
import type { AdcsPart, AntennaPart, TransmitterPart } from '../types';
import { linkBudget, dishGainDbi, beamwidthDeg } from '../engine/communicationModel';
import { autoDesign, emptyDesign, placePart } from '../engine/designFactory';
import { launchBlockers, validateDesign } from '../engine/feasibilityValidator';
import { runAutoFlight, tuneKick } from '../engine/flightSim';
import { payloadCapacityKg } from '../engine/launch';
import { runMission } from '../engine/missionSimulator';
import { captureDv, defaultSelection, describeOrbit, hohmann, orbitalPeriod, planeChangeDv, sunSyncInclinationDeg } from '../engine/orbitalMechanics';
import { G0, propellantForDv, tsiolkovskyDv } from '../engine/physics';
import { batteryDod, eclipseEnergyWh, powerMarginPct, solarPowerW } from '../engine/powerModel';
import { analyzeDesign } from '../engine/resourceManager';
import { rngFor } from '../engine/rng';
import { evaluateObjectives, scoreMission, rankOf } from '../engine/scoringEngine';

describe('physics and orbital mechanics', () => {
  it('Kepler period: 400 km LEO is about 92.5 minutes', () => {
    const T = orbitalPeriod(BODIES.earth.mu, BODIES.earth.radius + 400e3);
    expect(T / 60).toBeGreaterThan(92);
    expect(T / 60).toBeLessThan(93);
  });
  it('GEO radius gives a sidereal day', () => {
    const T = orbitalPeriod(BODIES.earth.mu, BODIES.earth.radius + 35786e3);
    expect(T).toBeGreaterThan(86000);
    expect(T).toBeLessThan(86300);
  });
  it('uses the correct central body: Moon orbit at 100 km is ~118 minutes, not the Earth value', () => {
    const info = describeOrbit(defaultSelection('lunar'));
    expect(info.periodS / 60).toBeGreaterThan(117);
    expect(info.periodS / 60).toBeLessThan(119);
    expect(info.body.id).toBe('moon');
  });
  it('Mars capture orbit period is computed with the Mars gravitational parameter', () => {
    const info = describeOrbit(defaultSelection('mars'));
    const expected = orbitalPeriod(BODIES.mars.mu, info.aM);
    expect(info.periodS).toBeCloseTo(expected, 3);
    expect(info.periodS).toBeGreaterThan(3 * 3600);
  });
  it('sun-synchronous inclination at 600 km is ~97.8 deg', () => {
    expect(sunSyncInclinationDeg(600)).toBeGreaterThan(97.5);
    expect(sunSyncInclinationDeg(600)).toBeLessThan(98.1);
  });
  it('Hohmann LEO(200 km) to GEO is about 3.9 km/s', () => {
    const h = hohmann(BODIES.earth.mu, BODIES.earth.radius + 200e3, BODIES.earth.radius + 35786e3);
    expect(h.total).toBeGreaterThan(3850);
    expect(h.total).toBeLessThan(3950);
  });
  it('plane change dv = 2 v sin(di/2)', () => {
    expect(planeChangeDv(1000, 60)).toBeCloseTo(1000, 5);
  });
  it('lunar capture burn at 100 km is ~0.8 km/s', () => {
    const dv = captureDv(BODIES.moon.mu, 800, BODIES.moon.radius + 100e3, BODIES.moon.radius + 100e3);
    expect(dv).toBeGreaterThan(780);
    expect(dv).toBeLessThan(840);
  });
  it('Tsiolkovsky: Isp 300 s, mass ratio 2 gives ~2040 m/s, and inversion round-trips', () => {
    expect(tsiolkovskyDv(300, 2, 1)).toBeCloseTo(300 * G0 * Math.LN2, 6);
    const mp = propellantForDv(1000, 320, 500);
    expect(tsiolkovskyDv(320, 500 + mp, 500)).toBeCloseTo(1000, 6);
  });
});

describe('power and communications', () => {
  it('battery capacity is energy: eclipse energy = load x time', () => {
    expect(eclipseEnergyWh(200, 3600)).toBeCloseTo(200, 8);
    expect(batteryDod(10000)).toBeLessThan(batteryDod(50));
  });
  it('power margin follows the specification formula', () => {
    expect(powerMarginPct(120, 100)).toBeCloseTo(20, 8);
    expect(powerMarginPct(80, 100)).toBeCloseTo(-20, 8);
  });
  it('solar output follows the inverse-square law', () => {
    const arrays = [PARTS['sa-m'] as never];
    const at1 = solarPowerW(arrays, 1, 0);
    const at2 = solarPowerW(arrays, 2, 0);
    expect(at1 / at2).toBeCloseTo(4, 6);
  });
  it('dish gain and beamwidth scale with diameter', () => {
    expect(dishGainDbi(2, 8.4) - dishGainDbi(1, 8.4)).toBeCloseTo(6.02, 1);
    expect(beamwidthDeg(1, 8.4) / beamwidthDeg(2, 8.4)).toBeCloseTo(2, 6);
  });
  it('link budget: free-space loss grows 6 dB per doubling of distance, and rate falls', () => {
    const ant = PARTS['ant-hga'] as AntennaPart, tx = PARTS['tx-25'] as TransmitterPart, adcs = PARTS['adcs-wheels'] as AdcsPart;
    const a = linkBudget(ant, tx, adcs, 1e11, 'engineer');
    const b = linkBudget(ant, tx, adcs, 2e11, 'engineer');
    expect(b.fsplDb - a.fsplDb).toBeCloseTo(6.02, 1);
    expect(b.uncappedBps).toBeLessThan(a.uncappedBps / 3.5);
  });
  it('pointing error reduces the rate of a high-gain antenna', () => {
    const ant = PARTS['ant-hga'] as AntennaPart, tx = PARTS['tx-25'] as TransmitterPart;
    const good = linkBudget(ant, tx, null, 3e11, 'engineer', 0.05);
    const bad = linkBudget(ant, tx, null, 3e11, 'engineer', 1.0);
    expect(bad.rateBps).toBeLessThan(good.rateBps * 0.5);
  });
});

describe('launch performance is destination specific', () => {
  const medium = LAUNCH_VEHICLES.find((v) => v.id === 'lv-medium')!;
  it('same rocket carries far less to the Moon and Mars than to LEO', () => {
    const leo = payloadCapacityKg(medium, describeOrbit(defaultSelection('leo')));
    const tli = payloadCapacityKg(medium, describeOrbit(defaultSelection('lunar')));
    const mars = payloadCapacityKg(medium, describeOrbit(defaultSelection('mars')));
    expect(leo).toBeGreaterThan(tli * 2);
    expect(tli).toBeGreaterThan(mars);
    expect(mars).toBeGreaterThan(0);
  });
  it('a small rocket cannot reach the Moon', () => {
    const small = LAUNCH_VEHICLES.find((v) => v.id === 'lv-small')!;
    expect(payloadCapacityKg(small, describeOrbit(defaultSelection('lunar')))).toBe(0);
  });
});

describe('flight simulation', () => {
  it('autopilot reaches a 200 km parking orbit with the medium rocket', () => {
    const v = LAUNCH_VEHICLES.find((x) => x.id === 'lv-medium')!;
    const opts = { seed: 1, reliabilityScale: 0, payloadMaxG: 8, incDeg: 28.5 };
    const kick = tuneKick(v, 3000, opts);
    const r = runAutoFlight(v, 3000, { ...opts, kickDeg: kick });
    expect(r.orbitOk).toBe(true);
    expect(r.perigeeKm).toBeGreaterThan(150);
    expect(r.state.dvUsed).toBeGreaterThan(8500);
    expect(r.state.dvUsed).toBeLessThan(9800);
    expect(r.remainingDv).toBeGreaterThan(2000);
  });
  it('an overloaded rocket fails to reach orbit', () => {
    const v = LAUNCH_VEHICLES.find((x) => x.id === 'lv-small')!;
    const r = runAutoFlight(v, 2500, { seed: 1, reliabilityScale: 0, payloadMaxG: 8, incDeg: 28.5, kickDeg: 3 });
    expect(r.orbitOk).toBe(false);
  });
});

describe('validation', () => {
  it('an empty spacecraft has many critical issues that block launch', () => {
    const s = SCENARIOS[0];
    const a = analyzeDesign(emptyDesign(s), s, 'engineer');
    const blockers = launchBlockers(validateDesign(a));
    expect(blockers.length).toBeGreaterThanOrEqual(6);
    for (const b of blockers) { expect(b.what.length).toBeGreaterThan(5); expect(b.why.length).toBeGreaterThan(5); expect(b.solutions.length).toBeGreaterThan(0); }
  });
  it('mass above launcher capacity is flagged', () => {
    const s = SCENARIO_MAP['lunar-explorer'];
    let d = autoDesign(s, 'engineer');
    d = { ...d, vehicleId: 'lv-small' };
    const issues = validateDesign(analyzeDesign(d, s, 'engineer'));
    expect(issues.some((i) => i.id === 'launch-class' || i.id === 'launch-capacity')).toBe(true);
  });
  it('insufficient battery for eclipse is detected', () => {
    const s = SCENARIO_MAP['earth-observation'];
    let d = autoDesign(s, 'engineer');
    d = placePart(placePart(d, 'int-5', null), 'int-6', null);
    d = placePart(d, 'int-5', 'bat-s');
    d = placePart(placePart(d, 'bay-3', 'radar-alt'), 'bay-4', 'laser-alt');
    const a = analyzeDesign(d, s, 'engineer');
    expect(a.power.eclipseCoverage).toBeLessThan(1);
    expect(validateDesign(a).some((i) => i.id === 'battery-ecl')).toBe(true);
  });
  it('basic magnetorquer attitude control is rejected beyond Earth orbit', () => {
    const s = SCENARIO_MAP['lunar-explorer'];
    const d = placePart(autoDesign(s, 'engineer'), 'int-3', 'adcs-basic');
    expect(validateDesign(analyzeDesign(d, s, 'engineer')).some((i) => i.id === 'adcs-earth')).toBe(true);
  });
});

describe('every scenario has a viable reference design', () => {
  for (const s of SCENARIOS) {
    it(`${s.name}: auto-design launches, completes and scores as a success`, () => {
      const d = autoDesign(s, 'engineer');
      const a = analyzeDesign(d, s, 'engineer');
      expect(launchBlockers(validateDesign(a)).map((i) => i.id)).toEqual([]);
      const m = runMission(d, s, 'engineer', 7);
      expect(m.launch.ok).toBe(true);
      expect(m.insertionOk).toBe(true);
      const sc = scoreMission(m);
      expect(sc.total).toBeGreaterThanOrEqual(650);
      expect(sc.mandatoryMet).toBe(true);
    });
  }
});

describe('determinism and scoring', () => {
  it('same seed reproduces the identical mission', () => {
    const s = SCENARIO_MAP['mars-atmosphere'];
    const d = autoDesign(s, 'engineer');
    const a = runMission(d, s, 'engineer', 123);
    const b = runMission(d, s, 'engineer', 123);
    expect(scoreMission(a).total).toBe(scoreMission(b).total);
    expect(a.log.map((l) => l.text)).toEqual(b.log.map((l) => l.text));
    expect(a.downlinkedMB).toBe(b.downlinkedMB);
  });
  it('rng streams are reproducible and independent', () => {
    expect(rngFor(1, 'a', 2)()).toBe(rngFor(1, 'a', 2)());
    expect(rngFor(1, 'a', 2)()).not.toBe(rngFor(1, 'a', 3)());
  });
  it('score weights sum to 100% and components are normalised', () => {
    const s = SCENARIOS[0];
    const m = runMission(autoDesign(s, 'engineer'), s, 'engineer', 3);
    const sc = scoreMission(m);
    expect(sc.components.reduce((x, c) => x + c.weight, 0)).toBeCloseTo(1, 8);
    for (const c of sc.components) { expect(c.raw).toBeGreaterThanOrEqual(0); expect(c.raw).toBeLessThanOrEqual(1); }
    expect(sc.total).toBeLessThanOrEqual(1000);
  });
  it('a failed mandatory objective can never score above 649', () => {
    const s = SCENARIO_MAP['lunar-explorer'];
    let d = autoDesign(s, 'engineer');
    d = placePart(placePart(d, 'bay-3', null), 'bay-4', null); // drop the spectrometer and altimeter
    const m = runMission(d, s, 'engineer', 3);
    const sc = scoreMission(m);
    expect(evaluateObjectives(m).filter((o) => o.objective.mandatory).some((o) => !o.met)).toBe(true);
    expect(sc.total).toBeLessThanOrEqual(649);
  });
  it('ranking thresholds follow the specification', () => {
    expect(rankOf(950)).toBe('Exceptional Mission');
    expect(rankOf(850)).toBe('Excellent Mission');
    expect(rankOf(700)).toBe('Successful Mission');
    expect(rankOf(500)).toBe('Partial Success');
    expect(rankOf(300)).toBe('Major Engineering Problems');
    expect(rankOf(100)).toBe('Mission Failure');
  });
  it('overweight payload fails at launch', () => {
    const s = SCENARIO_MAP['lunar-explorer'];
    const d = { ...autoDesign(s, 'engineer'), vehicleId: 'lv-small' };
    const m = runMission(d, s, 'engineer', 3);
    expect(m.launch.ok).toBe(false);
    expect(scoreMission(m).total).toBeLessThan(250);
  });
});
