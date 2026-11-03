// Central resource engine: turns a Design + Scenario + Difficulty into mass, power, data, comms, thermal,
// propulsion, cost, schedule and per-instrument science figures. Everything else (validation, simulation,
// scoring) consumes this one Analysis object.

import { DAYS_PER_MONTH, STANDBY_M_PER_MONTH } from './launchWindows';
import { getPart, PARTS } from '../data/spacecraftComponents';
import { getVehicle, vehicleCostM } from '../data/launchVehicles';
import type {
  AdcsPart, AntennaPart, BatteryPart, ComputerPart, Design, Difficulty, EnginePart, FramePart, InstrumentPart,
  LaunchVehicle, Part, Scenario, SolarPart, TankPart, ThermalPart, TransmitterPart,
} from '../types';
import { DIFFICULTY } from './difficulty';
import { beamwidthDeg, dailyCapacityMB, linkBudget, pointingLossDb, type LinkResult } from './communicationModel';
import { launchRequirement, payloadCapacityKg } from './launch';
import { accessibleFraction, clampSelection, describeOrbit, doseAttenuation, dragDvPerYear, orbitLifetimeYears, type OrbitInfo } from './orbitalMechanics';
import { TEST_MAP } from '../data/tests';
import { thermalBalance } from './thermalModel';
import { batteryDod, eclipseEnergyWh, powerMarginPct, solarPowerW } from './powerModel';
import { G0, DAY, clamp, tsiolkovskyDv, propellantUsed } from './physics';

export interface PlacedPart { slotId: string; part: Part; x: number; y: number }

export interface InstrumentStat {
  slotId: string;
  part: InstrumentPart;
  relevance: number;
  gsdM: number;
  pointingFactor: number;
  thermalFactor: number;
  resolutionFactor: number;
  rangeFactor: number;
  altFactor: number;
  quality: number;
  sunFrac: number;          // fraction of the time it can operate (sunlit-only instruments)
  pointsPerDay: number;     // at 100% duty, quality-weighted, scientific points
  dataMBd: number;          // raw MB/day at 100% duty (before compression, after sunlit factor)
  swathM: number;
  areaKm2Day: number;       // coverage rate at 100% duty
  mismatch: boolean;        // relevance 0
}

export interface Analysis {
  design: Design;
  scenario: Scenario;
  difficulty: Difficulty;
  frame: FramePart | null;
  placed: PlacedPart[];
  parts: {
    solar: SolarPart[]; batteries: BatteryPart[]; antenna: AntennaPart | null; transmitter: TransmitterPart | null;
    computer: ComputerPart | null; adcs: AdcsPart | null; thermal: ThermalPart | null; engine: EnginePart | null;
    tanks: TankPart[]; instruments: { slotId: string; part: InstrumentPart }[];
  };
  orbit: OrbitInfo;
  vehicle: LaunchVehicle;
  mass: {
    structure: number; power: number; batteries: number; comms: number; computer: number; adcs: number; thermal: number;
    instruments: number; propulsionDry: number; propellant: number; dry: number; total: number; supported: number; shielding: number; redundancy: number; drive: number;
  };
  radiation: { doseKrad: number; tidKrad: number; margin: number; shieldMm: number; doseYear: number };
  geometry: { widthM: number; heightM: number; comLatM: number; comHeightM: number };
  launch: { capacityKg: number; marginKg: number; classOk: boolean; reqDv: number; costM: number; twrOk: boolean; fitsWidth: boolean; fitsHeight: boolean };
  power: {
    sunDistAU: number; genBolW: number; genEolW: number; busW: number; instrumentsW: number; commsW: number; thermalW: number; heaterW: number;
    adcsW: number; computerW: number; avgLoadW: number; peakLoadW: number; eclipseLoadW: number; cruiseLoadW: number;
    batteryWh: number; dod: number; usableWh: number; batteryDischargeW: number; eclipseEnergyWh: number; eclipseCoverage: number;
    marginPct: number; orbitMarginPct: number; availableW: number; angleFactor: number;
  };
  thermal: { dissipationW: number; requiredW: number; ratio: number; stabilityNeed: number; stability: number; metric: number; hotC: number; coldC: number; radiatorM2: number; heaterNeededW: number };
  comms: {
    link: LinkResult | null; linkMean: LinkResult | null; linkWorst: LinkResult | null; contactFraction: number; contactS: number;
    capacityMeanMB: number; capacityWorstMB: number; delayS: number; beamwidthDeg: number; pointingLossDb: number; pointingDeg: number;
  };
  data: {
    rawMBd: number; compressedMBd: number; compressionFactor: number; compressionQuality: number; storageMB: number; storageDays: number;
    processingNeedMBd: number; processingCapMBd: number; needRatio: number;
  };
  propulsion: {
    isp: number; thrustN: number; electric: boolean; dvAvailable: number; dvInsertion: number; dvStationKeeping: number; dvMargin: number;
    dvRequired: number; insertionPropKg: number; burnTimeS: number; burnLimitS: number; tankCapacityKg: number; propellantKg: number;
    electricThrustFrac: number; skPerYear: number; lifetimeYears: number; dragAreaM2: number;
  };
  cost: { parts: number; launch: number; ops: number; contingency: number; total: number; budget: number; byCategory: Record<string, number>; tests: number; standby: number };
  schedule: { developmentMonths: number; launchLeadMonths: number; totalMonths: number; deadline: number; testMonths: number; readyMonths: number; departMonths: number | null; waitMonths: number };
  reliability: { critical: number; perYear: number; instruments: Record<string, number> };
  instruments: InstrumentStat[];
  science: { potentialPerDay: number; coverageFractionMax: number; revisitDays: number; navigation: number; pointingDeg: number };
  commissioningDays: number;
}

const COLD_FACTOR: Record<string, number> = { earth: 0.8, moon: 1.0, mars: 1.3, asteroid: 1.0, deepspace: 0.8 };
const HOT_FACTOR: Record<string, number> = { earth: 1.0, moon: 1.4, mars: 0.8, asteroid: 0.9, deepspace: 0.7 };
const COMPRESSION = {
  none: { size: 1.0, proc: 0.1, quality: 1.0 },
  lossless: { size: 0.6, proc: 1.0, quality: 1.0 },
  lossy: { size: 0.3, proc: 1.3, quality: 0.92 },
};
export const MARGIN_LOAD_KG = 0;

export function meanDistance(scn: Scenario, orbit: OrbitInfo): { mean: number; worst: number; best: number } {
  if (scn.distance.type === 'fixed') return { mean: orbit.fixedCommDistanceM, worst: orbit.fixedCommDistanceM, best: orbit.fixedCommDistanceM };
  const { minM, maxM } = scn.distance;
  return { mean: (minM + maxM) / 2, worst: maxM, best: minM };
}

export function distanceAtDay(scn: Scenario, orbit: OrbitInfo, day: number): number {
  if (scn.distance.type === 'fixed') return orbit.fixedCommDistanceM;
  const { minM, maxM, periodD, phase } = scn.distance;
  const mid = (minM + maxM) / 2, amp = (maxM - minM) / 2;
  return mid + amp * Math.cos((2 * Math.PI * day) / periodD + phase);
}

export function analyzeDesign(design: Design, scenario: Scenario, difficulty: Difficulty): Analysis {
  const rules = DIFFICULTY[difficulty];
  const frame = getPart<FramePart>(design.frameId);
  const orbit = describeOrbit(design.orbit);
  const vehicle = getVehicle(design.vehicleId, design.customStages, design.boosters);
  const target = scenario.target;

  // ---- placement ----
  const placed: PlacedPart[] = [];
  if (frame) {
    for (const slot of frame.slots) {
      const pid = design.placements[slot.id];
      const part = pid ? PARTS[pid] : undefined;
      if (part && slot.accepts.includes(part.category)) {
        let x = slot.x;
        if (part.category === 'solar') x = Math.sign(slot.x) * (frame.dims.w / 2 + (part as SolarPart).spanM / 2);
        placed.push({ slotId: slot.id, part, x, y: slot.y });
      }
    }
  }
  const byCat = <T extends Part>(c: Part['category']) => placed.filter((p) => p.part.category === c).map((p) => p.part as T);
  const solar = byCat<SolarPart>('solar');
  const batteries = byCat<BatteryPart>('battery');
  const antenna = byCat<AntennaPart>('antenna')[0] ?? null;
  const transmitter = byCat<TransmitterPart>('transmitter')[0] ?? null;
  const computer = byCat<ComputerPart>('computer')[0] ?? null;
  const adcs = byCat<AdcsPart>('adcs')[0] ?? null;
  const thermal = byCat<ThermalPart>('thermal')[0] ?? null;
  const engine = byCat<EnginePart>('engine')[0] ?? null;
  const tanks = byCat<TankPart>('tank');
  const instruments = placed.filter((p) => p.part.category === 'instrument').map((p) => ({ slotId: p.slotId, part: p.part as InstrumentPart }));

  // ---- mass ----
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const tankCapacity = sum(tanks.map((t) => t.capacityKg));
  const propellant = engine || tanks.length ? clamp(design.propellantKg, 0, tankCapacity) : 0;
  const red = design.redundancy ?? { computer: false, transmitter: false, battery: false };
  const drive = design.arrayDrive ?? 'tracking';
  const driveMass = drive === 'tracking' ? 4 * solar.length : 0;
  const shieldExtra = clamp(design.shieldingMm ?? 0, 0, 8);
  const bodyArea = frame ? 2 * (frame.dims.w * frame.dims.h + frame.dims.w * frame.dims.d + frame.dims.h * frame.dims.d) : 0;
  const shieldMass = bodyArea * 0.6 * (shieldExtra / 1000) * 2700;
  const redMass = (red.computer ? computer?.massKg ?? 0 : 0) + (red.transmitter ? transmitter?.massKg ?? 0 : 0) + (red.battery ? 0.1 * sum(batteries.map((b) => b.massKg)) : 0);
  const mass = {
    structure: frame?.massKg ?? 0,
    power: sum(solar.map((s) => s.massKg)) + driveMass,
    batteries: sum(batteries.map((b) => b.massKg)),
    comms: (antenna?.massKg ?? 0) + (transmitter?.massKg ?? 0),
    computer: computer?.massKg ?? 0,
    adcs: adcs?.massKg ?? 0,
    thermal: thermal?.massKg ?? 0,
    instruments: sum(instruments.map((i) => i.part.massKg)),
    propulsionDry: (engine?.massKg ?? 0) + sum(tanks.map((t) => t.massKg)),
    propellant,
    dry: 0, total: 0, supported: 0, shielding: shieldMass, redundancy: redMass, drive: driveMass,
  };
  mass.dry = mass.structure + mass.power + mass.batteries + mass.comms + mass.computer + mass.adcs + mass.thermal + mass.instruments + mass.propulsionDry + shieldMass + redMass;
  mass.total = mass.dry + propellant;
  mass.supported = mass.total - mass.structure;

  // ---- geometry: centre of mass and fairing envelope ----
  let mx = 0, my = 0;
  const tankPlaced = placed.filter((p) => p.part.category === 'tank');
  for (const p of placed) {
    let m = p.part.massKg;
    if (p.part.category === 'tank' && tankCapacity > 0) m += propellant * ((p.part as TankPart).capacityKg / tankCapacity);
    mx += m * p.x; my += m * p.y;
  }
  void tankPlaced;
  if (frame) { /* frame at origin */ }
  const comLat = mass.total > 0 ? mx / mass.total : 0;
  const comY = mass.total > 0 ? my / mass.total : 0;
  const fh = frame?.dims.h ?? 1, fw = frame?.dims.w ?? 1;
  const comHeight = comY + fh / 2 + 0.45;
  const bayProt = instruments.length ? 0.15 : 0;
  const wingThick = solar.length ? Math.max(...solar.map((s) => s.dims.w)) : 0;
  const lateral = fw + 2 * Math.max(bayProt, wingThick);
  const dish = antenna ? antenna.diameterM : 0;
  const geometry = {
    widthM: Math.max(lateral, dish),
    heightM: fh + 0.45 + (antenna ? antenna.dims.h + 0.1 : 0),
    comLatM: comLat, comHeightM: comHeight,
  };

  // ---- launch ----
  const capacityKg = payloadCapacityKg(vehicle, orbit);
  const classOk = vehicle.classes.includes(orbit.def.launchClass);
  const launch = {
    capacityKg, marginKg: capacityKg - mass.total, classOk, reqDv: launchRequirement(orbit).total, costM: vehicleCostM(vehicle),
    twrOk: capacityKg > 0,
    fitsWidth: geometry.widthM <= vehicle.fairingDiameterM * 0.95,
    fitsHeight: geometry.heightM <= vehicle.fairingLengthM,
  };

  // ---- power ----
  const sunDist = scenario.sunDistanceAU;
  const years = scenario.nominalDays / 365.25;
  const ageEffEol = years * orbit.radiation;
  const angleFactor = (drive === 'tracking' ? 0.95 : 0.68) * (adcs ? 1 : 0.87);
  const genBol = solarPowerW(solar, sunDist, 0, 0, angleFactor);
  const genEol = solarPowerW(solar, sunDist, ageEffEol, 0, angleFactor);
  const sunFrac = 1 - orbit.eclipseFrac;
  const coldFactor = COLD_FACTOR[target] ?? 1;
  const busW = (frame?.powerW ?? 0) + (drive === 'tracking' ? 4 * solar.length : 0) + (red.transmitter ? 2 : 0);
  const computerW = (computer?.powerW ?? 0) * (red.computer ? 1.15 : 1);
  const adcsW = adcs?.powerW ?? 0;
  const thermalW = thermal?.powerW ?? 0;
  const instAvg = sum(instruments.map((i) => i.part.powerW * (i.part.sunlitOnly ? sunFrac : 1)));
  const instAvgSunlit = sum(instruments.map((i) => i.part.powerW));
  const instPeak = sum(instruments.map((i) => i.part.powerW));
  const txDc = transmitter?.powerW ?? 0;
  const contactFrac = orbit.contactFraction(design.groundStations);
  const gimbal = antenna?.powerW ?? 0;
  const commsAvg = gimbal + txDc * contactFrac + 5; // 5 W receiver/command standby
  const baseNoHeat = busW + computerW + adcsW + thermalW;
  const hotDiss = baseNoHeat + instAvg + commsAvg + (engine?.electric ? engine.powerW * 0.8 : 0);
  const tb = thermal && frame ? thermalBalance({ target, sunDistAU: sunDist, orbit, frame, thermal, baseW: baseNoHeat, hotDissipationW: hotDiss }) : null;
  const heaterW = tb ? Math.min(tb.heaterNeededW, 500) : 0;
  const baseW = baseNoHeat + heaterW;
  const avgLoad = baseW + instAvg + commsAvg;
  const sunlitLoad = baseW + instAvgSunlit + commsAvg;
  const eclipseLoad = baseW + sum(instruments.filter((i) => !i.part.sunlitOnly).map((i) => i.part.powerW)) + commsAvg;
  const peakLoad = baseW + instPeak + txDc + gimbal + 5;
  const cruiseLoad = baseW + 5 + gimbal + (engine?.electric ? engine.powerW : 0);
  const batteryWh = sum(batteries.map((b) => b.capacityWh));
  const dod = batteryDod(orbit.cyclesPerYear);
  const usableWh = batteryWh * dod;
  const eclipseWh = eclipseEnergyWh(eclipseLoad, orbit.eclipseS);
  const eclipseHours = Math.max(orbit.eclipseS / 3600, 0.5);
  const battDischarge = Math.min(sum(batteries.map((b) => b.maxDischargeW)), usableWh / eclipseHours);
  const T = orbit.periodS / 3600;
  const eGen = genEol * sunFrac * T;
  const eLoad = sunlitLoad * sunFrac * T + eclipseWh * 1.1;
  const power = {
    sunDistAU: sunDist, genBolW: genBol, genEolW: genEol, busW, instrumentsW: instAvg, commsW: commsAvg, thermalW, heaterW, adcsW, computerW,
    avgLoadW: avgLoad, peakLoadW: peakLoad, eclipseLoadW: eclipseLoad, cruiseLoadW: cruiseLoad,
    batteryWh, dod, usableWh, batteryDischargeW: battDischarge, eclipseEnergyWh: eclipseWh,
    eclipseCoverage: eclipseWh > 0 ? usableWh / eclipseWh : Infinity,
    marginPct: powerMarginPct(genEol + battDischarge, peakLoad),
    orbitMarginPct: eLoad > 0 ? ((eGen - eLoad) / eLoad) * 100 : 999,
    availableW: genEol + battDischarge, angleFactor,
  };

  // ---- thermal ----
  const dissipation = avgLoad + (peakLoad - avgLoad) * 0.3 + (engine?.electric ? engine.powerW * 0.8 : 0);
  const requiredReject = dissipation * (HOT_FACTOR[target] ?? 1);
  const stabNeed = instruments.length ? Math.max(...instruments.map((i) => i.part.thermal)) : 0;
  const heatRatio = thermal ? thermal.heatRejectionW / Math.max(requiredReject, 1) : 0;
  const thermalOut = {
    dissipationW: dissipation, requiredW: requiredReject, ratio: heatRatio, stabilityNeed: stabNeed, stability: thermal?.stability ?? 0,
    metric: thermal ? Math.min(heatRatio, stabNeed > 0 ? (1.3 * thermal.stability) / stabNeed : heatRatio) : 0,
    hotC: tb ? tb.tHotK - 273.15 : 0, coldC: tb ? tb.tColdK - 273.15 : 0, radiatorM2: tb?.radiatorM2 ?? 0, heaterNeededW: tb?.heaterNeededW ?? 0,
  };

  // ---- attitude ----
  const pointingEff = adcs ? (adcs.earthOnly && !(orbit.def.bodyId === 'earth') ? 5 : adcs.pointingDeg) : 10;

  // ---- communications ----
  const dists = meanDistance(scenario, orbit);
  const mk = (d: number) => (antenna && transmitter ? linkBudget(antenna, transmitter, adcs, d, difficulty, pointingEff) : null);
  const linkMean = mk(dists.mean), linkWorst = mk(dists.worst);
  const contactS = contactFrac * DAY;
  const bw = antenna?.steerable ? beamwidthDeg(antenna.diameterM, antenna.freqGHz) : 360;
  const comms = {
    link: linkMean, linkMean, linkWorst, contactFraction: contactFrac, contactS,
    capacityMeanMB: linkMean ? dailyCapacityMB(linkMean.rateBps, contactS) : 0,
    capacityWorstMB: linkWorst ? dailyCapacityMB(linkWorst.rateBps, contactS) : 0,
    delayS: dists.mean / 299792458, beamwidthDeg: bw,
    pointingLossDb: antenna?.steerable ? pointingLossDb(pointingEff, bw) : 0, pointingDeg: pointingEff,
  };

  // ---- instruments: quality, science and coverage rates ----
  const effAltKm = orbit.effectiveAltM / 1000;
  const periKm = orbit.perigeeAltM / 1000;
  const swathHalfMax = Math.max(0, ...instruments.map((i) => i.part.fovDeg / 2));
  const instStats: InstrumentStat[] = instruments.map(({ slotId, part }) => {
    const relevance = part.relevance[target] ?? 0;
    const imager = part.domains.some((d) => d === 'imaging' || d === 'multispectral' || d === 'hyperspectral');
    const gsd = part.ifovUrad > 0 ? orbit.effectiveAltM * part.ifovUrad * 1e-6 : 0;
    const resF = scenario.requiredGsdM && gsd > 0 && imager ? clamp(Math.pow(scenario.requiredGsdM / gsd, 0.7), 0.05, 1) : 1;
    const pf = part.pointingDeg >= pointingEff ? 1 : clamp(Math.pow(part.pointingDeg / pointingEff, 0.6), 0.15, 1);
    const stab = thermal?.stability ?? 0;
    const tf = stab >= part.thermal ? 1 : clamp(0.4 + 0.6 * (stab / Math.max(part.thermal, 0.01)), 0.4, 1);
    const rf = part.rangeKm > 0 && effAltKm > part.rangeKm ? clamp(Math.pow(part.rangeKm / effAltKm, 2), 0.03, 1) : 1;
    const altF = part.altRef === 'perigee' && orbit.def.bodyId === 'mars' ? clamp(300 / Math.max(periKm, 1), 0.3, 1) : 1;
    const comp = COMPRESSION[design.compression].quality;
    const quality = pf * tf * resF * rf * altF * comp * (part.sunlitOnly ? orbit.illum : 1);
    const sf = part.sunlitOnly ? sunFrac : 1;
    const swath = part.fovDeg > 0 && effAltKm > 0 ? 2 * orbit.effectiveAltM * Math.tan((part.fovDeg / 2) * Math.PI / 180) : 0;
    return {
      slotId, part, relevance, gsdM: gsd, pointingFactor: pf, thermalFactor: tf, resolutionFactor: resF, rangeFactor: rf, altFactor: altF,
      quality, sunFrac: sf, pointsPerDay: (part.sci * relevance / 100) * quality * sf, dataMBd: part.dataMBd * sf,
      swathM: swath, areaKm2Day: (swath * orbit.groundSpeedMps * DAY) / 1e6, mismatch: relevance <= 0,
    };
  });

  // ---- data ----
  const comp = COMPRESSION[design.compression];
  const raw = sum(instStats.map((i) => i.dataMBd));
  const dataOut = {
    rawMBd: raw, compressedMBd: raw * comp.size, compressionFactor: comp.size, compressionQuality: comp.quality,
    storageMB: computer?.storageMB ?? 0, storageDays: raw * comp.size > 0 ? (computer?.storageMB ?? 0) / (raw * comp.size) : Infinity,
    processingNeedMBd: raw * comp.proc, processingCapMBd: computer?.processingMBd ?? 0,
    needRatio: comms.capacityMeanMB > 0 ? (raw * comp.size) / comms.capacityMeanMB : (raw > 0 ? Infinity : 0),
  };

  // ---- propulsion ----
  const isp = engine?.isp ?? 0;
  const m0 = mass.total, mf = mass.dry;
  const dvAvail = engine && propellant > 0 ? tsiolkovskyDv(isp, m0, mf) : 0;
  const dvIns = orbit.insertionDvMps;
  const dragArea = frame ? frame.dims.w * frame.dims.h * 0.7 + sum(solar.map((s) => s.areaM2)) * 0.3 : 1;
  const isLeo = orbit.def.id === 'leo' || orbit.def.id === 'sso';
  const skYear = isLeo ? dragDvPerYear(orbit.effectiveAltM / 1000, mass.total, dragArea) + 3 : orbit.stationKeepingDvPerYear;
  const lifetimeYears = isLeo ? orbitLifetimeYears(orbit.effectiveAltM / 1000, mass.total, dragArea) : 999;
  const dvRequiredCore = dvIns * 1.03 + 20 + skYear * years;
  const insertionProp = engine ? propellantUsed(dvIns * 1.03, isp, m0) : 0;
  const mdot = engine ? engine.thrustN / (isp * G0) : 0;
  const burnTime = mdot > 0 ? insertionProp / mdot : Infinity;
  const impulsive = orbit.def.insertionType === 'impulsive';
  const cruiseS = scenario.cruiseDays * DAY;
  const electricFrac = engine?.electric ? clamp(genBol / Math.max(cruiseLoad, 1), 0, 1) * 0.85 : 1;
  const burnLimit = impulsive ? 3600 : engine?.electric ? Math.max(cruiseS, 1) * electricFrac : Math.max(cruiseS, 3600 * 3);
  const propulsion = {
    isp, thrustN: engine?.thrustN ?? 0, electric: engine?.electric ?? false, dvAvailable: dvAvail, dvInsertion: dvIns, dvStationKeeping: skYear * years,
    dvMargin: dvRequiredCore > 0 ? dvAvail / dvRequiredCore - 1 : 0, dvRequired: dvRequiredCore, insertionPropKg: insertionProp,
    burnTimeS: burnTime, burnLimitS: burnLimit, tankCapacityKg: tankCapacity, propellantKg: propellant, electricThrustFrac: electricFrac,
    skPerYear: skYear, lifetimeYears, dragAreaM2: dragArea,
  };

  // ---- cost & schedule ----
  const byCategory: Record<string, number> = {};
  for (const p of placed) byCategory[p.part.category] = (byCategory[p.part.category] ?? 0) + p.part.costM;
  if (frame) byCategory.frame = (byCategory.frame ?? 0) + frame.costM;
  if (drive === 'tracking') byCategory.solar = (byCategory.solar ?? 0) + 0.6 * solar.length;
  if (red.computer && computer) byCategory.computer = (byCategory.computer ?? 0) + computer.costM;
  if (red.transmitter && transmitter) byCategory.transmitter = (byCategory.transmitter ?? 0) + transmitter.costM;
  if (red.battery) byCategory.battery = (byCategory.battery ?? 0) + 0.1 * (byCategory.battery ?? 0);
  if (shieldMass > 0) byCategory.shielding = shieldMass * 0.02;
  const testList = (design.tests ?? []).filter((t) => TEST_MAP[t]);
  const testCost = sum(testList.map((t) => TEST_MAP[t].costM));
  const testMonths = sum(testList.map((t) => TEST_MAP[t].months));
  const partsCost = sum(Object.values(byCategory));
  const missionDays = scenario.cruiseDays + 20 + scenario.nominalDays;
  const opsCost = missionDays * (0.02 + 0.01 * design.groundStations);
  const devSum = sum(placed.map((p) => p.part.devMonths)) + (frame?.devMonths ?? 0);
  const devMonths = 6 + 0.4 * devSum;
  const readyMonths = Math.max(devMonths, vehicle.leadMonths) + 2 + testMonths;
  // Interplanetary targets launch on a chosen calendar day; waiting past "ready" for the window costs standby money.
  const departMonths = orbit.departDay !== undefined ? orbit.departDay / DAYS_PER_MONTH : null;
  const waitMonths = departMonths !== null ? Math.max(0, departMonths - readyMonths) : 0;
  const standby = waitMonths * STANDBY_M_PER_MONTH;
  const contingency = (partsCost + launch.costM) * rules.contingency;
  const cost = {
    parts: partsCost, launch: launch.costM, ops: opsCost, contingency, total: partsCost + launch.costM + opsCost + contingency + testCost + standby,
    budget: scenario.budgetM * rules.budgetMul, byCategory, tests: testCost, standby,
  };
  const schedule = { developmentMonths: devMonths, launchLeadMonths: vehicle.leadMonths, totalMonths: Math.max(readyMonths, departMonths ?? 0), deadline: scenario.deadlineMonths, testMonths, readyMonths, departMonths, waitMonths };

  // ---- reliability (series model over nominal life, critical parts only) ----
  const critical: Part[] = [frame, ...solar, ...batteries, antenna, transmitter, computer, adcs, thermal, engine].filter(Boolean) as Part[];
  const relOf = (p: Part) => (p.category === 'computer' && red.computer) || (p.category === 'transmitter' && red.transmitter) || (p.category === 'battery' && red.battery) ? 1 - Math.pow(1 - p.reliability, 2) : p.reliability;
  const perYear = critical.reduce((r, p) => r * relOf(p), 1);
  const totalAl = 2.5 + shieldExtra;
  const doseYear = orbit.doseKradYr * doseAttenuation(totalAl);
  const doseMission = doseYear * ((scenario.nominalDays + scenario.cruiseDays * 0.5) / 365.25);
  const tidKrad = Math.min(computer?.tidKrad ?? 100, 60);
  const radiation = { doseKrad: doseMission, tidKrad, margin: doseMission > 0 ? tidKrad / (doseMission * 2) : 99, shieldMm: totalAl, doseYear };
  const instR: Record<string, number> = {};
  for (const i of instruments) instR[i.slotId] = Math.pow(i.part.reliability, years);

  // ---- science summary ----
  const imaging = instStats.filter((i) => i.areaKm2Day > 0 && i.part.domains.some((d) => d === 'imaging' || d === 'multispectral' || d === 'hyperspectral'));
  const planetArea = 4 * Math.PI * Math.pow(orbit.body.radius / 1000, 2);
  const accessible = accessibleFraction(orbit.incDeg, swathHalfMax);
  const revisit = imaging.length ? Math.min(...imaging.map((i) => (planetArea * accessible) / Math.max(i.areaKm2Day * 0.5, 1e-9))) : Infinity;
  const nav = instruments.some((i) => i.part.domains.includes('navigation')) || (adcs ? adcs.pointingDeg <= 0.03 : false) ? 1 : 0;

  return {
    design, scenario, difficulty, frame, placed,
    parts: { solar, batteries, antenna, transmitter, computer, adcs, thermal, engine, tanks, instruments },
    orbit, vehicle, mass, radiation, geometry, launch, power, thermal: thermalOut, comms, data: dataOut, propulsion, cost, schedule,
    reliability: { critical: Math.pow(perYear, years), perYear, instruments: instR },
    instruments: instStats,
    science: { potentialPerDay: sum(instStats.map((i) => i.pointsPerDay)), coverageFractionMax: accessible, revisitDays: revisit, navigation: nav, pointingDeg: pointingEff },
    commissioningDays: Math.round(10 + 2 * sum(instruments.map((i) => i.part.complexity))),
  };
}

export { clampSelection };
