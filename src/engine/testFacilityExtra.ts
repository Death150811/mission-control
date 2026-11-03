// Second wave of verification tests. Same idea as testFacility.ts: read the real analysis, run a small model, report PASS / MARGINAL / FAIL.
// All thresholds are game-balance values chosen so that the reference designs pass and obvious mistakes fail.

import type { Analysis } from './resourceManager';
import type { TestResult, Verdict } from './testFacility';

const f0 = (x: number) => Math.round(x).toLocaleString('en-US');
const f1 = (x: number) => x.toFixed(1);
const f2 = (x: number) => x.toFixed(2);
const verdictOf = (fail: boolean, marginal: boolean): Verdict => (fail ? 'FAIL' : marginal ? 'MARGINAL' : 'PASS');

/** Electromagnetic compatibility: strong transmitters and electric thrusters contaminate sensitive field instruments. */
export function emcTest(a: Analysis): TestResult {
  const rf = a.parts.transmitter?.rfPowerW ?? 0;
  const eng = a.parts.engine;
  const elec = eng?.electric ? eng.powerW : 0;
  const sensitive = a.parts.instruments.filter((i) => ['magnetometer', 'plasma', 'radio-sci'].includes(i.part.id));
  const noise = 10 * Math.log10(1 + rf / 8 + elec / 300);
  const limit = sensitive.length ? 6 : 12;
  const margin = limit - noise;
  const fail = margin < 0, marginal = margin < 3;
  const findings: string[] = [];
  if (sensitive.length && fail) findings.push(`${sensitive.map((i) => i.part.name).join(', ')} would see interference from the ${f0(rf)} W transmitter${elec ? ' and the electric thruster' : ''}: readings would be unusable while transmitting.`);
  else if (fail) findings.push('Radiated noise exceeds the receiver limits of the on-board electronics.');
  else if (marginal) findings.push('Noise is close to the limit: a boom for the sensitive sensors or a lower-power transmitter would give margin.');
  if (!findings.length) findings.push(sensitive.length ? 'Field instruments are quiet enough while the transmitter and thrusters run.' : 'No sensitive field instruments on board; emissions are within limits.');
  return {
    id: 'emc', verdict: verdictOf(fail, marginal), findings,
    metrics: [
      { label: 'Radiated noise index', value: `${f1(noise)} dB` },
      { label: 'Limit (sensitive payload: ' + sensitive.length + ')', value: `${f1(limit)} dB`, ok: !fail },
      { label: 'Margin', value: `${f1(margin)} dB`, ok: margin >= 3 },
      { label: 'Noise sources', value: `${f0(rf)} W RF${elec ? ` · ${f0(elec)} W thruster` : ''}` },
    ],
  };
}

/** Acoustic test: big panels and dishes on a light spacecraft flap in the launcher's noise. */
export function acousticTest(a: Analysis): TestResult {
  const area = a.parts.solar.reduce((s, p) => s + p.areaM2, 0);
  const dish = a.parts.antenna && a.parts.antenna.diameterM > 1 ? a.parts.antenna.diameterM : 0;
  const ratio = (area + dish * dish * 0.8) / Math.max(a.mass.total, 1);
  const spl = 134 + 12 * Math.log10(Math.max(ratio, 1e-4) / 0.008 + 1);
  const fail = ratio > 0.04, marginal = ratio > 0.02;
  const findings: string[] = [];
  if (fail) findings.push(`${f2(ratio)} m² of appendage per kilogram: the panels would see ${f0(spl)} dB at lift-off and the hinges and cell strings are likely to crack.`);
  else if (marginal) findings.push('Appendage area per kilogram is high: add hold-down points or a stiffer wing.');
  else findings.push('Panels and dishes are stiff enough for the launch acoustic environment.');
  return {
    id: 'acoustic', verdict: verdictOf(fail, marginal), findings,
    metrics: [
      { label: 'Appendage area per kg', value: `${f2(ratio)} m²/kg`, ok: !marginal, note: 'solar area + dish area, divided by launch mass' },
      { label: 'Acoustic load at lift-off', value: `${f0(spl)} dB` },
      { label: 'Solar area / dish', value: `${f1(area)} m² / ${dish ? f1(dish) + ' m' : 'none'}` },
    ],
  };
}

/** Total-dose and single-event radiation test. */
export function radTest(a: Analysis): TestResult {
  const r = a.radiation;
  const tid = a.parts.computer?.tidKrad ?? 20;
  const seuPerMonth = 30 * 0.9 * a.orbit.radiation * (tid >= 300 ? 0.1 : tid >= 100 ? 0.35 : 1);
  const fail = r.margin < 1, marginal = r.margin < 2;
  const findings: string[] = [];
  if (fail) findings.push(`Mission dose ${f1(r.doseKrad)} krad against ${f0(r.tidKrad)} krad of tolerance: electronics would fail before the end of the mission. Add aluminium shielding or fly a harder computer.`);
  else if (marginal) findings.push('Total dose is within tolerance but with less than the usual factor-of-two margin.');
  else findings.push('Total-dose margin is comfortable.');
  if (seuPerMonth > 20) findings.push(`About ${f0(seuPerMonth)} single-event upsets a month are expected: a radiation-hardened computer cuts that by an order of magnitude.`);
  return {
    id: 'radtest', verdict: verdictOf(fail, marginal), findings,
    metrics: [
      { label: 'Mission dose behind shielding', value: `${f1(r.doseKrad)} krad`, note: `${f1(r.shieldMm)} mm Al equivalent` },
      { label: 'Weakest electronics tolerate', value: `${f0(r.tidKrad)} krad` },
      { label: 'Margin (design rule: ≥ 2)', value: `×${f1(r.margin)}`, ok: r.margin >= 2 },
      { label: 'Expected single-event upsets', value: `${f0(seuPerMonth)} per month`, ok: seuPerMonth <= 20 },
    ],
  };
}

/** Optical alignment and calibration of every imager and spectrometer. */
export function opticalTest(a: Analysis): TestResult {
  const sensors = a.instruments.filter((i) => i.part.ifovUrad > 0 || i.part.domains.some((d) => d === 'imaging' || d === 'multispectral' || d === 'hyperspectral' || d === 'spectroscopy' || d === 'observatory'));
  if (!sensors.length) return { id: 'optical', verdict: 'PASS', findings: ['No optical instruments on board: nothing to align.'], metrics: [{ label: 'Optical instruments', value: '0' }] };
  const worstP = sensors.reduce((m, i) => (i.pointingFactor < m.pointingFactor ? i : m), sensors[0]);
  const worstT = sensors.reduce((m, i) => (i.thermalFactor < m.thermalFactor ? i : m), sensors[0]);
  const fail = worstP.pointingFactor < 0.5 || worstT.thermalFactor < 0.5;
  const marginal = worstP.pointingFactor < 0.85 || worstT.thermalFactor < 0.85;
  const findings: string[] = [];
  if (worstP.pointingFactor < 0.85) findings.push(`${worstP.part.name}: pointing keeps only ${f0(worstP.pointingFactor * 100)}% of its image quality. Needs ${worstP.part.pointingDeg}° but the attitude system gives ${f2(a.science.pointingDeg)}°.`);
  if (worstT.thermalFactor < 0.85) findings.push(`${worstT.part.name}: temperature stability costs ${f0((1 - worstT.thermalFactor) * 100)}% of its quality. Use a more stable thermal system.`);
  if (!findings.length) findings.push('All optical instruments align and stay in focus over the thermal cycle.');
  return {
    id: 'optical', verdict: verdictOf(fail, marginal), findings,
    metrics: [
      { label: 'Optical instruments', value: String(sensors.length) },
      { label: 'Worst pointing factor', value: `${f0(worstP.pointingFactor * 100)}% (${worstP.part.name})`, ok: worstP.pointingFactor >= 0.85 },
      { label: 'Worst thermal-focus factor', value: `${f0(worstT.thermalFactor * 100)}% (${worstT.part.name})`, ok: worstT.thermalFactor >= 0.85 },
    ],
  };
}

/** Flight-software and data-handling test: throughput, storage and autonomy. */
export function swTest(a: Analysis): TestResult {
  const need = a.data.processingNeedMBd, cap = Math.max(a.data.processingCapMBd, 1);
  const load = need / cap;
  const days = a.data.storageDays;
  const complexity = a.parts.instruments.reduce((s, i) => s + i.part.complexity, 0);
  const fail = load > 1 || days < 0.5;
  const marginal = load > 0.75 || days < 2 || (complexity > 14 && cap < 20000);
  const findings: string[] = [];
  if (load > 1) findings.push(`The computer must process ${f0(need)} MB/day but can do ${f0(cap)} MB/day: the data pipeline backs up and science is thrown away.`);
  else if (load > 0.75) findings.push('Processing load above 75%: little room for onboard compression or autonomous responses.');
  if (days < 2) findings.push(`Storage holds only ${f1(days)} days of data: a ground-station outage will overflow it.`);
  if (complexity > 14 && cap < 20000) findings.push('Many complex instruments on a small computer: fault-protection code has no headroom.');
  if (!findings.length) findings.push('Flight software has throughput, storage and fault-protection headroom.');
  return {
    id: 'sw', verdict: verdictOf(fail, marginal), findings,
    metrics: [
      { label: 'Processing load', value: `${f0(load * 100)}% (${f0(need)} of ${f0(cap)} MB/day)`, ok: load <= 0.75 },
      { label: 'Storage buffer', value: Number.isFinite(days) ? `${f1(days)} days of data` : 'unlimited', ok: days >= 2 },
      { label: 'Instrument complexity', value: String(complexity) },
    ],
  };
}

/** Life test: battery cycling and wear over the whole mission. */
export function eolTest(a: Analysis): TestResult {
  const years = (a.scenario.nominalDays + a.scenario.extendedDays * 0.5) / 365.25;
  const wh = Math.max(a.power.batteryWh, 1);
  const depth = a.orbit.eclipseS > 0 ? Math.min(1, (a.power.eclipseLoadW * a.orbit.eclipseS) / 3600 / wh) : 0.02;
  const cycles = a.orbit.cyclesPerYear * years;
  const rated = 30000 * Math.pow(0.3 / Math.max(depth, 0.05), 1.2);
  const health = Math.max(0.2, 1 - (cycles * 0.2) / rated);
  const fail = health < 0.6, marginal = health < 0.8;
  const findings: string[] = [];
  if (fail) findings.push(`After ${f0(cycles)} cycles at ${f0(depth * 100)}% depth the battery keeps only ${f0(health * 100)}% of its capacity: eclipses will cause brown-outs late in the mission.`);
  else if (marginal) findings.push('Battery wear is noticeable by the end of the mission. A bigger pack cycles shallower and lasts longer.');
  else findings.push('Battery cycle life covers the mission with room to spare.');
  return {
    id: 'eol', verdict: verdictOf(fail, marginal), findings,
    metrics: [
      { label: 'Cycles over the mission', value: `${f0(cycles)} (${f1(years)} years)` },
      { label: 'Typical depth of discharge', value: `${f0(depth * 100)}%` },
      { label: 'Capacity at end of life', value: `${f0(health * 100)}%`, ok: health >= 0.8 },
    ],
  };
}
