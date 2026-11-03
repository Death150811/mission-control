// Verification tests ("test, learn, rebuild"): each reads the real analysis, runs a small physical model and reports pass / marginal / fail
// with findings. Buying a test costs money and months but lowers the odds of the anomalies it would have caught (see eventEngine).
//   thermal: Stefan-Boltzmann radiator balance; structure: f = (1/2π)√(k/m); power: orbit-by-orbit energy integration;
//   RF: link budget sweep; deployment: mechanism reliability product; engine: rocket-equation burn check.

import { linkBudget } from './communicationModel';
import type { Analysis } from './resourceManager';
import { G0, DAY, clamp } from './physics';
import { BODIES } from '../data/bodies';
import { thermalBalance } from './thermalModel';
import { acousticTest, emcTest, eolTest, opticalTest, radTest, swTest } from './testFacilityExtra';

export type Verdict = 'PASS' | 'MARGINAL' | 'FAIL';
export interface TestMetric { label: string; value: string; ok?: boolean; note?: string }
export interface TestChart { title: string; unit: string; xLabel: string; xs: number[]; series: { name: string; color: string; data: number[] }[]; yMax?: number }
export interface TestResult { id: string; verdict: Verdict; metrics: TestMetric[]; findings: string[]; chart?: TestChart }

const SIGMA = 5.670374e-8;
const f0 = (x: number) => Math.round(x).toLocaleString('en-US');
const f1 = (x: number) => x.toFixed(1);
const C = (k: number) => k - 273.15;
const verdictOf = (fail: boolean, marginal: boolean): Verdict => (fail ? 'FAIL' : marginal ? 'MARGINAL' : 'PASS');

function powerTest(a: Analysis): TestResult {
  const T = Math.min(a.orbit.periodS, DAY), orbits = 5, steps = 300;
  const dt = (T * orbits) / steps;
  const eclFrac = a.orbit.eclipseFrac;
  const cap = Math.max(a.power.batteryWh, 1);
  let soc = cap;
  const socs: number[] = [], gens: number[] = [], loads: number[] = [], xs: number[] = [];
  let minSoc = cap;
  for (let k = 0; k < steps; k++) {
    const t = k * dt, phase = (t % T) / T;
    const inEcl = eclFrac > 0 && phase > 1 - eclFrac;
    const gen = inEcl ? 0 : a.power.genEolW;
    const load = inEcl ? a.power.eclipseLoadW : a.power.avgLoadW + (a.power.peakLoadW - a.power.avgLoadW) * 0;
    const net = gen - load;
    soc = clamp(soc + (net * dt) / 3600 * (net > 0 ? 0.92 : 1), 0, cap);
    minSoc = Math.min(minSoc, soc);
    socs.push((soc / cap) * 100); gens.push(gen); loads.push(load); xs.push(Math.round((t / 3600) * 10) / 10);
  }
  const depth = 1 - minSoc / cap;
  const fail = minSoc <= 0.001 * cap || a.power.orbitMarginPct < 0;
  const marginal = depth > a.power.dod || a.power.orbitMarginPct < 10;
  const findings: string[] = [];
  if (fail) findings.push('The battery empties or the orbit-average balance is negative: load shedding and brown-out are certain in flight.');
  if (depth > a.power.dod) findings.push(`Peak depth of discharge ${f0(depth * 100)}% exceeds the ${f0(a.power.dod * 100)}% allowed for ${f0(a.orbit.cyclesPerYear)} cycles/year: the battery will wear out early.`);
  if (a.orbit.eclipseS === 0) findings.push('No eclipse in this orbit: the battery only covers peak loads.');
  if (!findings.length) findings.push('Power profile is healthy over five consecutive orbits.');
  return {
    id: 'power', verdict: verdictOf(fail, marginal), findings,
    metrics: [
      { label: 'Minimum state of charge', value: `${f0((minSoc / cap) * 100)}%`, ok: minSoc > 0.2 * cap },
      { label: 'Depth of discharge', value: `${f0(depth * 100)}% (limit ${f0(a.power.dod * 100)}%)`, ok: depth <= a.power.dod },
      { label: 'Orbit-average energy margin', value: `${f0(a.power.orbitMarginPct)}%`, ok: a.power.orbitMarginPct >= 10 },
      { label: 'Eclipse', value: `${f1(a.orbit.eclipseS / 60)} min per orbit (β ${f0(a.orbit.betaDeg)}°)` },
    ],
    chart: { title: 'Battery state of charge over five orbits (%)', unit: '%', xLabel: 'hours', xs, yMax: 100, series: [{ name: 'state of charge', color: '#3fcf6b', data: socs }, { name: 'generation / 100 W', color: '#ffb000', data: gens.map((g) => g / 100) }, { name: 'load / 100 W', color: '#7aa9f7', data: loads.map((l) => l / 100) }] },
  };
}

function tvacTest(a: Analysis): TestResult {
  const th = a.parts.thermal, frame = a.frame;
  if (!th || !frame) return { id: 'tvac', verdict: 'FAIL', metrics: [], findings: ['No thermal control or frame to test.'] };
  const baseNoHeat = a.power.busW + a.power.computerW + a.power.adcsW + a.power.thermalW;
  const hotDiss = baseNoHeat + a.power.instrumentsW + a.power.commsW + (a.parts.engine?.electric ? a.parts.engine.powerW * 0.8 : 0);
  const tb = thermalBalance({ target: a.scenario.target, sunDistAU: a.scenario.sunDistanceAU, orbit: a.orbit, frame, thermal: th, baseW: baseNoHeat, hotDissipationW: hotDiss });
  const tHot = tb.tHotK, tCold = tb.tColdK;
  const limHot = 323, limCold = 253; // electronics -20 .. +50 C
  const batHot = 313, batCold = 273; // batteries 0 .. +40 C
  const fail = tHot > limHot || tCold < limCold || tHot > batHot + 10;
  const marginal = tHot > limHot - 8 || tCold < limCold + 8 || tHot > batHot;
  const findings: string[] = [];
  if (tHot > limHot) findings.push(`Hot case ${f0(C(tHot))} °C exceeds the +50 °C electronics limit: more radiator capacity (enhanced or active thermal control) or less dissipation is needed.`);
  if (tCold < limCold) findings.push(`Cold case ${f0(C(tCold))} °C is below the −20 °C limit: better insulation, louvers or heater power needed.`);
  if (tb.heaterNeededW > 0) findings.push(`Keeping the battery above 0 °C in the cold case needs ${f0(tb.heaterNeededW)} W of heaters. That power is already included in the design's average load: an oversized radiator makes the cold case expensive.`);
  if (th.id === 'th-passive' && tHot - tCold > 60) findings.push(`A passive design swings ${f0(tHot - tCold)} K between hot and cold cases. Instruments that need stable temperatures will suffer.`);
  if (!findings.length) findings.push('Temperatures stay inside the allowed bands in both cases without heater penalty.');
  return {
    id: 'tvac', verdict: verdictOf(fail, marginal), findings,
    metrics: [
      { label: 'Hot case (max dissipation, albedo + planet IR)', value: `${f0(C(tHot))} °C`, ok: tHot <= limHot - 8, note: `limit +50 °C · ${f0(tb.qHotW)} W to reject` },
      { label: 'Cold case (eclipse, minimum dissipation)', value: `${f0(C(tCold))} °C`, ok: tCold >= limCold + 8, note: `limit −20 °C · ${f0(tb.qColdW)} W incl. heaters` },
      { label: 'Heater power to hold the battery at 0 °C', value: `${f0(tb.heaterNeededW)} W`, note: 'included in the power budget' },
      { label: 'Radiator area', value: `${f1(tb.radiatorM2)} m² @ 300 K`, note: `${th.name}; louver turn-down to ${f0(tb.sMin * 100)}%` },
      { label: 'Heat-rejection ratio', value: `×${a.thermal.ratio.toFixed(2)}` },
    ],
  };
}

function vibeTest(a: Analysis): TestResult {
  const f = a.frame;
  if (!f) return { id: 'vibe', verdict: 'FAIL', metrics: [], findings: ['No frame.'] };
  const kAx = ({ 'frame-s': 4e7, 'frame-m': 9e7, 'frame-l': 1.6e8 } as Record<string, number>)[f.id] ?? 9e7;
  const mEff = 0.7 * a.mass.total;
  const fAx = Math.sqrt(kAx / mEff) / (2 * Math.PI);
  const lever = a.geometry.comHeightM + 0.5;
  const kLat = kAx * 0.06 * Math.pow(f.dims.w / lever, 2);
  const fLat = Math.sqrt(kLat / mEff) / (2 * Math.PI);
  const reqAx = a.vehicle.id === 'lv-micro' ? 35 : a.vehicle.id === 'lv-small' ? 30 : a.vehicle.id === 'lv-heavy' ? 20 : 25;
  const reqLat = a.vehicle.id === 'lv-micro' ? 15 : a.vehicle.id === 'lv-small' ? 12 : a.vehicle.id === 'lv-heavy' ? 8 : 10;
  const qs = a.vehicle.maxG * 1.25;
  const loadMargin = (f.maxAccelG * 1.4) / qs - 1;
  const fail = fAx < reqAx || fLat < reqLat || loadMargin < -0.05;
  const marginal = fAx < reqAx * 1.15 || fLat < reqLat * 1.15 || loadMargin < 0.1;
  const findings: string[] = [];
  if (fLat < reqLat) findings.push(`Lateral mode ${f1(fLat)} Hz is below the ${reqLat} Hz launcher requirement: a heavy, tall payload on a slender frame is too soft. Reduce mass, lower the centre of mass or use a stiffer frame.`);
  if (fAx < reqAx) findings.push(`Axial mode ${f1(fAx)} Hz is below ${reqAx} Hz: it could couple with engine thrust oscillations (pogo).`);
  if (loadMargin < 0) findings.push(`Qualification load ${f1(qs)} g (peak ${a.vehicle.maxG} g × 1.25) exceeds the frame ultimate capability of ${f1(f.maxAccelG * 1.4)} g (rating ${f.maxAccelG} g × 1.4).`);
  if (!findings.length) findings.push('Both fundamental frequencies clear the launcher requirement and the frame carries the launch loads.');
  return {
    id: 'vibe', verdict: verdictOf(fail, marginal), findings,
    metrics: [
      { label: 'Axial fundamental frequency', value: `${f1(fAx)} Hz`, ok: fAx >= reqAx, note: `requirement ≥ ${reqAx} Hz · f = (1/2π)√(k/m)` },
      { label: 'Lateral fundamental frequency', value: `${f1(fLat)} Hz`, ok: fLat >= reqLat, note: `requirement ≥ ${reqLat} Hz` },
      { label: 'Qualification load vs frame ultimate', value: `${f1(qs)} g vs ${f1(f.maxAccelG * 1.4)} g`, ok: loadMargin >= 0 },
      { label: 'Effective mass', value: `${f0(mEff)} kg` },
    ],
  };
}

function rfTest(a: Analysis): TestResult {
  const ant = a.parts.antenna, tx = a.parts.transmitter;
  if (!ant || !tx) return { id: 'rf', verdict: 'FAIL', metrics: [], findings: ['No antenna or transmitter installed.'] };
  const mean = a.comms.linkMean?.distM ?? a.orbit.fixedCommDistanceM;
  const xs: number[] = [], rates: number[] = [];
  for (let i = 0; i <= 24; i++) { const d = mean * Math.pow(10, -1 + (i / 24) * 1.8); xs.push(Math.round((d / 1.495978707e11) * 1000) / 1000); rates.push(10 * Math.log10(Math.max(linkBudget(ant, tx, a.parts.adcs, d, a.difficulty, a.comms.pointingDeg).rateBps, 1))); }
  const l0 = a.comms.linkMean!, lw = a.comms.linkWorst!;
  const need = (a.data.compressedMBd * 1e6 * 8) / Math.max(a.comms.contactS * 0.85, 1);
  const marginDb = 10 * Math.log10(Math.max(l0.rateBps, 1) / Math.max(need, 1));
  const marginWorst = 10 * Math.log10(Math.max(lw.rateBps, 1) / Math.max(need, 1));
  const doubled = linkBudget(ant, tx, a.parts.adcs, mean, a.difficulty, a.comms.pointingDeg * 2);
  const fail = marginDb < 0, marginal = marginDb < 3 || marginWorst < 0;
  const findings: string[] = [];
  if (fail) findings.push('The link cannot carry the data the instruments generate even at mean range.');
  else if (marginal) findings.push(`Link margin is thin (${f1(marginDb)} dB at mean range, ${f1(marginWorst)} dB at the greatest range). A larger dish, more transmitter power or compression adds margin.`);
  if (l0.limitedBy === 'antenna hardware') findings.push('The link budget could support more than the antenna hardware allows: a bigger modem or antenna class would raise capacity.');
  if (doubled.rateBps < l0.rateBps * 0.7) findings.push(`Doubling the pointing error would cost ${f0((1 - doubled.rateBps / l0.rateBps) * 100)}% of the data rate: attitude control quality matters for this dish.`);
  if (!findings.length) findings.push('Comfortable link margin at all expected ranges.');
  return {
    id: 'rf', verdict: verdictOf(fail, marginal), findings,
    metrics: [
      { label: 'Data rate at mean range', value: `${f1(l0.rateBps / 1000)} kbps`, note: `limited by ${l0.limitedBy}` },
      { label: 'Link margin at mean / greatest range', value: `${f1(marginDb)} / ${f1(marginWorst)} dB`, ok: marginDb >= 3 && marginWorst >= 0 },
      { label: 'Free-space loss at mean range', value: `${f1(l0.fsplDb)} dB` },
      { label: 'Pointing loss', value: `${f1(l0.pointingLossDb)} dB`, ok: l0.pointingLossDb < 3 },
    ],
    chart: { title: 'Maximum data rate versus distance (dB-bps)', unit: ' dB', xLabel: 'AU', xs, series: [{ name: 'data rate', color: '#7aa9f7', data: rates }] },
  };
}

function deployTest(a: Analysis): TestResult {
  const items: { name: string; p: number }[] = [];
  for (const s of a.parts.solar) items.push({ name: s.name, p: s.areaM2 > 5 ? 0.98 : 0.99 });
  if (a.design.arrayDrive !== 'fixed' && a.parts.solar.length) items.push({ name: 'Sun-tracking array drives', p: 0.995 });
  if (a.parts.antenna?.steerable) items.push({ name: a.parts.antenna.name + ' gimbal', p: a.parts.antenna.diameterM > 1 ? 0.98 : 0.99 });
  for (const i of a.parts.instruments) if (i.part.domains.includes('fields')) items.push({ name: i.part.name + ' boom', p: 0.99 });
  const pAll = items.reduce((p, i) => p * i.p, 1);
  const fail = pAll < 0.9, marginal = pAll < 0.95;
  return {
    id: 'deploy', verdict: verdictOf(fail, marginal),
    findings: [fail ? 'Too many deployments in series: a single stuck mechanism ends a major capability.' : marginal ? 'Acceptable, but each deployable adds risk. Consider fixed panels or a smaller dish if the mission allows.' : 'Deployments are low-risk.'],
    metrics: [{ label: 'Probability all deployments succeed', value: `${f1(pAll * 100)}%`, ok: pAll >= 0.95 }, ...items.map((i) => ({ label: i.name, value: `${f1(i.p * 100)}%` }))],
  };
}

function fireTest(a: Analysis): TestResult {
  const e = a.parts.engine;
  if (!e) return { id: 'fire', verdict: a.orbit.insertionDvMps > 30 ? 'FAIL' : 'PASS', metrics: [], findings: [a.orbit.insertionDvMps > 30 ? 'No engine installed but the destination requires an insertion burn.' : 'No engine: nothing to fire.'] };
  const gBody = (a.orbit.body.mu / Math.pow(a.orbit.body.radius, 2)) || 9.8;
  const twr = e.thrustN / (a.mass.total * Math.max(gBody, 0.5));
  const burn = a.propulsion.burnTimeS, lim = a.propulsion.burnLimitS;
  const dvMargin = a.propulsion.dvMargin;
  const fail = burn > lim || a.propulsion.dvAvailable < a.propulsion.dvRequired;
  const marginal = dvMargin < 0.1 || burn > 0.8 * lim;
  const findings: string[] = [];
  if (burn > lim) findings.push(`The insertion burn needs ${f1(burn / 3600)} h but the limit is ${f1(lim / 3600)} h: the engine cannot deliver the impulse in time.`);
  if (a.propulsion.dvAvailable < a.propulsion.dvRequired) findings.push(`Delta-v ${f0(a.propulsion.dvAvailable)} m/s is below the ${f0(a.propulsion.dvRequired)} m/s required.`);
  if (e.electric) findings.push('Electric propulsion: confirm array power during the whole cruise. Thrust fraction ' + f0(a.propulsion.electricThrustFrac * 100) + '%.');
  if (!findings.length) findings.push('The engine meets thrust, burn-time and delta-v requirements.');
  return {
    id: 'fire', verdict: verdictOf(fail, marginal), findings,
    metrics: [
      { label: 'Thrust / specific impulse', value: `${f1(e.thrustN)} N / ${e.isp} s` },
      { label: 'Insertion burn time', value: burn < 1e7 ? `${f1(burn / 60)} min (limit ${f1(lim / 60)} min)` : 'n/a', ok: burn <= lim },
      { label: 'Delta-v available / required', value: `${f0(a.propulsion.dvAvailable)} / ${f0(a.propulsion.dvRequired)} m/s`, ok: !fail },
      { label: 'Thrust-to-weight at target gravity', value: twr.toFixed(2), note: `g = ${gBody.toFixed(2)} m/s² · Isp g₀ = ${f0(e.isp * G0)} m/s` },
      { label: 'Propellant on board', value: `${f0(a.mass.propellant)} kg of ${f0(a.propulsion.tankCapacityKg)} kg` },
    ],
  };
}

/** All-up test: the worst verdict of the core subsystem tests, plus daily data balance. */
function eteTest(a: Analysis): TestResult {
  const parts = [powerTest(a), tvacTest(a), rfTest(a), swTest(a)];
  const order: Verdict[] = ['PASS', 'MARGINAL', 'FAIL'];
  const worst = parts.reduce((w, r) => (order.indexOf(r.verdict) > order.indexOf(w) ? r.verdict : w), 'PASS' as Verdict);
  const dailyGen = a.data.compressedMBd, dailyDown = a.comms.capacityMeanMB;
  const dataOk = dailyGen <= dailyDown * 1.05;
  const verdict: Verdict = worst === 'FAIL' || !dataOk && dailyGen > dailyDown * 1.6 ? 'FAIL' : worst === 'MARGINAL' || !dataOk ? 'MARGINAL' : 'PASS';
  const findings = [`Operating day: ${f0(dailyGen)} MB generated against ${f0(dailyDown)} MB of downlink capacity.`, ...parts.filter((r) => r.verdict !== 'PASS').map((r) => `${r.id} test: ${r.findings[0]}`)];
  if (verdict === 'PASS') findings.push('Power, thermal, link and data all hold together over one simulated day.');
  return {
    id: 'ete', verdict, findings,
    metrics: [
      { label: 'Power profile', value: parts[0].verdict, ok: parts[0].verdict === 'PASS' },
      { label: 'Thermal limits', value: parts[1].verdict, ok: parts[1].verdict === 'PASS' },
      { label: 'Link margin', value: parts[2].verdict, ok: parts[2].verdict === 'PASS' },
      { label: 'Flight software', value: parts[3].verdict, ok: parts[3].verdict === 'PASS' },
      { label: 'Data generated / downlinked per day', value: `${f0(dailyGen)} / ${f0(dailyDown)} MB`, ok: dataOk },
    ],
  };
}

export function runTest(id: string, a: Analysis): TestResult {
  switch (id) {
    case 'emc': return emcTest(a);
    case 'acoustic': return acousticTest(a);
    case 'radtest': return radTest(a);
    case 'optical': return opticalTest(a);
    case 'sw': return swTest(a);
    case 'eol': return eolTest(a);
    case 'ete': return eteTest(a);
    case 'power': return powerTest(a);
    case 'tvac': return tvacTest(a);
    case 'vibe': return vibeTest(a);
    case 'rf': return rfTest(a);
    case 'deploy': return deployTest(a);
    case 'fire': return fireTest(a);
    default: return { id, verdict: 'FAIL', metrics: [], findings: ['Unknown test.'] };
  }
}
void BODIES;
