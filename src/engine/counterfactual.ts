// Post-mission analysis: failure diagnosis from real simulation data and "what if you had chosen differently?"
// counterfactuals produced by RE-SIMULATING modified designs with the same seed (default operations policy).

import { PARTS } from '../data/spacecraftComponents';
import { LAUNCH_VEHICLES, vehicleCostM } from '../data/launchVehicles';
import type { Design, Part } from '../types';
import { validateDesign, launchBlockers } from './feasibilityValidator';
import { autoDesign } from './designFactory';
import { analyzeDesign } from './resourceManager';
import { runMission, totalBacklogMB } from './missionSimulator';
import type { MissionState } from './missionTypes';
import { scoreMission } from './scoringEngine';

export interface Diagnosis { kind: 'critical' | 'bottleneck' | 'weakness' | 'operational' | 'good'; title: string; detail: string }

export function diagnose(m: MissionState): Diagnosis[] {
  const a = m.a, out: Diagnosis[] = [];
  const f0 = (x: number) => Math.round(x).toLocaleString('en-US');
  if (!m.launch.ok) out.push({ kind: 'critical', title: 'Launch failure', detail: m.launch.reason });
  else if (!m.insertionOk) out.push({ kind: 'critical', title: 'Orbit insertion failure', detail: m.endReason });
  else if (m.outcome === 'failed') out.push({ kind: 'critical', title: 'Spacecraft lost', detail: m.endReason });
  const gen = Math.max(m.generatedMB, 1);
  if (m.lostMB / gen > 0.03) out.push({ kind: 'bottleneck', title: 'Data was lost', detail: `${f0(m.lostMB)} MB (${f0((m.lostMB / gen) * 100)}%) of generated data was discarded because storage or processing was exceeded.` });
  const backlog = totalBacklogMB(m);
  if (backlog > m.generatedMB * 0.1 && m.generatedMB > 0) out.push({ kind: 'bottleneck', title: 'Downlink bottleneck', detail: `${f0(backlog)} MB was still on board at the end. Mean downlink ${f0(a.comms.capacityMeanMB)} MB/day vs ${f0(a.data.compressedMBd)} MB/day generated.` });
  if (m.stats.brownoutDays > 5) out.push({ kind: 'bottleneck', title: 'Energy deficit', detail: `${m.stats.brownoutDays} days with load shedding or eclipse brown-outs. Battery usable ${f0(a.power.usableWh)} Wh vs ${f0(a.power.eclipseEnergyWh)} Wh needed per eclipse; power margin ${f0(a.power.orbitMarginPct)}%.` });
  if (m.stats.safeModeDays > 6) out.push({ kind: 'operational', title: 'Time in safe mode', detail: `${m.stats.safeModeDays} days in safe mode after radiation events: no science was collected on those days.` });
  if (m.stats.skDeficitDays > 20) out.push({ kind: 'weakness', title: 'Ran out of station-keeping propellant', detail: `${m.stats.skDeficitDays} days without propellant: the orbit quality degraded. Station-keeping needs ${f0(a.propulsion.skPerYear)} m/s per year.` });
  const bad = a.instruments.filter((i) => i.quality < 0.7 && !i.mismatch);
  for (const i of bad) out.push({ kind: 'weakness', title: `${i.part.name} underperformed`, detail: `Quality ${f0(i.quality * 100)}% (pointing ${f0(i.pointingFactor * 100)}%, thermal ${f0(i.thermalFactor * 100)}%, range ${f0(i.rangeFactor * 100)}%, resolution ${f0(i.resolutionFactor * 100)}%).` });
  for (const i of a.instruments.filter((x) => x.mismatch)) out.push({ kind: 'weakness', title: `${i.part.name} had no scientific relevance`, detail: `It carried ${i.part.massKg} kg and ${i.part.powerW} W to a target where it cannot measure anything.` });
  const failedInst = Object.values(m.inst).filter((i) => i.status === 'failed');
  if (failedInst.length) out.push({ kind: 'operational', title: 'Instruments lost', detail: failedInst.map((i) => i.name).join(', ') });
  const poor = m.responses.filter((r) => r.quality < 0.5);
  if (poor.length) out.push({ kind: 'operational', title: 'Weak anomaly responses', detail: `${poor.length} anomalies handled with low-quality responses: ${poor.map((p) => p.title).join(', ')}.` });
  for (const r of m.scenario.objectives) void r;
  if (a.power.orbitMarginPct > 250) out.push({ kind: 'weakness', title: 'Oversized power system', detail: `Power margin ${f0(a.power.orbitMarginPct)}%: ${f0(a.mass.power)} kg of arrays carried more energy than needed.` });
  if (out.every((o) => o.kind === 'good') || out.length === 0) out.push({ kind: 'good', title: 'No major problems', detail: 'The design performed close to its potential.' });
  return out;
}

export interface Counterfactual {
  id: string; title: string; change: string; deltaMassKg: number; deltaCostM: number; deltaScore: number; deltaDownlinkPct: number;
  score: number; statement: string; blockers: number;
}

const ORDER: Record<string, string[]> = {
  antenna: ['ant-lga', 'ant-mga', 'ant-hga'], transmitter: ['tx-5', 'tx-25', 'tx-80'], computer: ['obc-1', 'obc-2', 'obc-3'],
  adcs: ['adcs-basic', 'adcs-sun', 'adcs-wheels', 'adcs-star', 'adcs-adv'], thermal: ['th-passive', 'th-ins', 'th-active'],
  solar: ['sa-s', 'sa-m', 'sa-l'], battery: ['bat-s', 'bat-m', 'bat-l'], tank: ['tank-s', 'tank-m', 'tank-l'],
};

function neighbor(partId: string, cat: string, dir: 1 | -1): string | null {
  const list = ORDER[cat]; const i = list.indexOf(partId);
  const j = i + dir;
  return j >= 0 && j < list.length ? list[j] : null;
}

export function counterfactuals(m: MissionState, maxItems = 9): { baselineScore: number; items: Counterfactual[] } {
  const scn = m.scenario, diff = m.difficulty, seed = m.seed;
  const base = runMission(m.design, scn, diff, seed, 'director');
  const baseScore = scoreMission(base);
  const baseA = base.a;
  const variants: { id: string; title: string; change: string; design: Design }[] = [];
  const d = m.design;
  const withPlace = (slot: string, part: string | null): Design => ({ ...d, placements: { ...d.placements, [slot]: part }, id: d.id + '-cf' });
  const nm = (id: string | null) => (id ? PARTS[id].name : 'nothing');

  for (const [slot, pid] of Object.entries(d.placements)) {
    if (!pid) continue;
    const part: Part = PARTS[pid];
    const cat = part.category;
    if (!ORDER[cat]) continue;
    for (const dir of [1, -1] as const) {
      if ((cat === 'solar' || cat === 'tank') && dir === -1 && slot !== 'wing-l' && slot !== 'aft-2') continue;
      const next = neighbor(pid, cat, dir);
      if (!next) continue;
      variants.push({ id: `${slot}-${dir}`, title: `${dir === 1 ? 'Upgrade' : 'Downgrade'} ${cat}`, change: `${nm(pid)} → ${nm(next)}`, design: cat === 'solar' ? { ...d, placements: { ...d.placements, 'wing-l': neighbor(d.placements['wing-l'] ?? pid, 'solar', dir) ?? pid, 'wing-r': neighbor(d.placements['wing-r'] ?? pid, 'solar', dir) ?? pid }, id: d.id + '-cf' } : withPlace(slot, next) });
    }
  }
  // dedupe solar duplicates
  const seen = new Set<string>();
  const uniq = variants.filter((v) => { const k = v.title + v.change; if (seen.has(k)) return false; seen.add(k); return true; });
  // extra battery
  const frameSlots = baseA.frame?.slots ?? [];
  const freeInt = frameSlots.find((s) => s.kind === 'internal' && !d.placements[s.id]);
  if (freeInt) uniq.push({ id: 'bat-add', title: 'Add a battery', change: 'Add Li-ion 900 Wh in a spare internal bay', design: { ...d, placements: { ...d.placements, [freeInt.id]: 'bat-m' }, id: d.id + '-cf' } });
  // compression
  const comps: Design['compression'][] = ['none', 'lossless', 'lossy'];
  for (const c of comps) if (c !== d.compression) uniq.push({ id: `comp-${c}`, title: 'Change compression', change: `${d.compression} → ${c}`, design: { ...d, compression: c, id: d.id + '-cf' } });
  if (d.groundStations < 3) uniq.push({ id: 'gs', title: 'More ground stations', change: `${d.groundStations} → ${d.groundStations + 1} stations`, design: { ...d, groundStations: (d.groundStations + 1) as 2 | 3, id: d.id + '-cf' } });
  // propellant
  if (baseA.propulsion.tankCapacityKg > baseA.mass.propellant + 10) uniq.push({ id: 'prop-up', title: 'Load more propellant', change: `${Math.round(d.propellantKg)} → ${Math.round(Math.min(baseA.propulsion.tankCapacityKg, d.propellantKg * 1.3 + 15))} kg`, design: { ...d, propellantKg: Math.min(baseA.propulsion.tankCapacityKg, d.propellantKg * 1.3 + 15), id: d.id + '-cf' } });
  // remove an instrument: lowest science per kg
  if (baseA.instruments.length > 1) {
    const worst = [...baseA.instruments].sort((x, y) => x.pointsPerDay / x.part.massKg - y.pointsPerDay / y.part.massKg)[0];
    uniq.push({ id: 'drop-inst', title: 'Remove the weakest instrument', change: `Remove ${worst.part.name}`, design: { ...d, placements: { ...d.placements, [worst.slotId]: null }, id: d.id + '-cf' } });
  }
  // cheaper launcher
  for (const v of LAUNCH_VEHICLES) {
    if (v.id !== d.vehicleId && vehicleCostM(v) < vehicleCostM(baseA.vehicle) && v.classes.includes(baseA.orbit.def.launchClass))
      uniq.push({ id: `lv-${v.id}`, title: 'Different launch vehicle', change: `${baseA.vehicle.name} → ${v.name}`, design: { ...d, vehicleId: v.id, customStages: undefined, id: d.id + '-cf' } });
  }
  void validateDesign; void launchBlockers;

  const items: Counterfactual[] = [];
  for (const v of uniq) {
    const a = analyzeDesign(v.design, scn, diff);
    const blockers = launchBlockers(validateDesign(a)).length;
    const mm = runMission(v.design, scn, diff, seed, 'director');
    const s = scoreMission(mm);
    const dMass = a.mass.total - baseA.mass.total;
    const dCost = a.cost.total - baseA.cost.total;
    const dDown = baseA.comms.capacityMeanMB > 0 ? ((a.comms.capacityMeanMB - baseA.comms.capacityMeanMB) / baseA.comms.capacityMeanMB) * 100 : 0;
    const dScore = s.total - baseScore.total;
    const parts: string[] = [];
    if (Math.abs(dDown) >= 1) parts.push(`average downlink capacity would have ${dDown > 0 ? 'increased' : 'decreased'} by ${Math.abs(dDown).toFixed(0)}%`);
    parts.push(`spacecraft mass would change by ${dMass >= 0 ? '+' : ''}${dMass.toFixed(0)} kg`);
    parts.push(`cost by ${dCost >= 0 ? '+' : '-'}$${Math.abs(dCost).toFixed(1)}M`);
    const statement = `If you had chosen: ${v.change}, ${parts.join(', ')}; the simulated score would be ${s.total} (${dScore >= 0 ? '+' : ''}${dScore})${blockers ? ` - but this design would have ${blockers} launch-blocking issue(s)` : ''}.`;
    items.push({ id: v.id, title: v.title, change: v.change, deltaMassKg: dMass, deltaCostM: dCost, deltaScore: dScore, deltaDownlinkPct: dDown, score: s.total, statement, blockers });
  }
  items.sort((x, y) => Math.abs(y.deltaScore) + (y.blockers ? -1000 : 0) - (Math.abs(x.deltaScore) + (x.blockers ? -1000 : 0)));
  const better = items.filter((i) => i.deltaScore > 0 && !i.blockers).slice(0, Math.ceil(maxItems / 2));
  const rest = items.filter((i) => !better.includes(i)).slice(0, maxItems - better.length);
  return { baselineScore: baseScore.total, items: [...better, ...rest] };
}

export function recommendedBaseline(m: MissionState) {
  const d = autoDesign(m.scenario, m.difficulty, 'Reference baseline');
  const run = runMission(d, m.scenario, m.difficulty, m.seed, 'director');
  const a = analyzeDesign(d, m.scenario, m.difficulty);
  return { design: d, score: scoreMission(run).total, mass: a.mass.total, cost: a.cost.total };
}
