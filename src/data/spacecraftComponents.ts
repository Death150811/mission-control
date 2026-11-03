// Spacecraft component catalogue. ALL specifications are illustrative game-balance values, not real products.

import { dishGainDbi } from '../engine/communicationModel';
import type {
  AdcsPart, AntennaPart, BatteryPart, ComputerPart, EnginePart, FramePart, Part, PartCategory,
  SlotDef, SolarPart, TankPart, ThermalPart, TransmitterPart,
} from '../types';
import { INSTRUMENTS } from './instruments';

const d = (w: number, h: number, dd = w) => ({ w, h, d: dd });

function frameSlots(w: number, h: number, bays: number, aft: number, internal: number): SlotDef[] {
  const s: SlotDef[] = [];
  s.push({ id: 'wing-l', kind: 'wing', label: 'Solar wing (port)', x: -(w / 2 + 0.5), y: 0, accepts: ['solar'] });
  s.push({ id: 'wing-r', kind: 'wing', label: 'Solar wing (starboard)', x: w / 2 + 0.5, y: 0, accepts: ['solar'] });
  s.push({ id: 'mast', kind: 'mast', label: 'Antenna mast', x: 0, y: h / 2 + 0.3, accepts: ['antenna'] });
  for (let i = 0; i < bays; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const row = Math.floor(i / 2);
    const y = h * 0.28 - row * h * 0.28;
    s.push({ id: `bay-${i + 1}`, kind: 'bay', label: `Instrument bay ${i + 1}`, x: side * (w / 2) * 0.55, y, accepts: ['instrument'] });
  }
  s.push({ id: 'aft-1', kind: 'aft', label: 'Main engine mount', x: 0, y: -h / 2 - 0.2, accepts: ['engine'] });
  for (let i = 1; i < aft; i++) {
    const side = i % 2 === 1 ? -1 : 1;
    s.push({ id: `aft-${i + 1}`, kind: 'aft', label: `Propellant tank ${i}`, x: side * w * 0.12, y: -h * 0.25 - Math.floor((i - 1) / 2) * 0.2, accepts: ['tank'] });
  }
  for (let i = 0; i < internal; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    s.push({ id: `int-${i + 1}`, kind: 'internal', label: `Internal bay ${i + 1}`, x: side * w * 0.15, y: h * 0.3 - Math.floor(i / 2) * (h * 0.22), accepts: ['battery', 'computer', 'adcs', 'thermal', 'transmitter'] });
  }
  return s;
}

const frames: FramePart[] = [
  { id: 'frame-s', category: 'frame', name: 'Bus-S Light Frame', massKg: 70, costM: 3.0, powerW: 12, reliability: 0.996, devMonths: 4,
    dims: d(0.8, 1.0), slots: frameSlots(0.8, 1.0, 2, 2, 5), maxSupportedKg: 260, maxAccelG: 8,
    desc: 'Compact bus for small launchers and rideshare. Two instrument bays and exactly enough internal space for the mandatory subsystems.',
    tradeoffs: ['Cheap and light', 'Only 260 kg of supported equipment', 'No spare internal bays for extra batteries'] },
  { id: 'frame-m', category: 'frame', name: 'Bus-M Standard Frame', massKg: 160, costM: 7.5, powerW: 20, reliability: 0.996, devMonths: 6,
    dims: d(1.1, 1.5), slots: frameSlots(1.1, 1.5, 4, 3, 7), maxSupportedKg: 1000, maxAccelG: 6.5,
    desc: 'The workhorse. Four instrument bays, two tank positions and two spare internal bays.',
    tradeoffs: ['Balanced capability', 'Needs a medium launcher for deep-space missions'] },
  { id: 'frame-l', category: 'frame', name: 'Bus-L Heavy Frame', massKg: 380, costM: 16, powerW: 30, reliability: 0.995, devMonths: 9,
    dims: d(1.6, 2.0), slots: frameSlots(1.6, 2.0, 6, 4, 9), maxSupportedKg: 2400, maxAccelG: 5.5,
    desc: 'Large bus for big propellant loads and observatories: six bays, three tanks and nine internal bays.',
    tradeoffs: ['Massive capacity', 'Heavy and expensive', 'Lower g-load tolerance because of its size'] },
];

const solar: SolarPart[] = [
  { id: 'sa-s', category: 'solar', name: 'SA-1 Rigid Wing (1.2 m²)', areaM2: 1.2, wattsPerM2: 300, degradationPerYear: 0.025, spanM: 1.3,
    massKg: 9, costM: 1.2, powerW: 0, reliability: 0.998, devMonths: 1, dims: d(0.12, 1.2, 1.0),
    desc: 'Small rigid panel: ~360 W at 1 AU (beginning of life).', tradeoffs: ['Light and cheap', 'Weak beyond 1.3 AU'] },
  { id: 'sa-m', category: 'solar', name: 'SA-3 Folding Wing (3.0 m²)', areaM2: 3.0, wattsPerM2: 310, degradationPerYear: 0.02, spanM: 2.6,
    massKg: 20, costM: 3.0, powerW: 0, reliability: 0.997, devMonths: 2, dims: d(0.14, 1.4, 1.1),
    desc: 'Folding wing: ~930 W at 1 AU.', tradeoffs: ['Good all-rounder', 'Needs deployment'] },
  { id: 'sa-l', category: 'solar', name: 'SA-7 Large Deployable Wing (7.0 m²)', areaM2: 7.0, wattsPerM2: 320, degradationPerYear: 0.018, spanM: 5.2,
    massKg: 46, costM: 7.0, powerW: 0, reliability: 0.995, devMonths: 3, dims: d(0.18, 1.8, 1.4),
    desc: 'Large deployable wing: ~2,240 W at 1 AU, still ~960 W at Mars distance.', tradeoffs: ['Powers ion propulsion and observatories', 'Heavy, costly, complex deployment'] },
];

const batteries: BatteryPart[] = [
  { id: 'bat-s', category: 'battery', name: 'Li-ion 300 Wh', capacityWh: 300, maxDischargeW: 300, massKg: 3, costM: 0.8, powerW: 0, reliability: 0.997, devMonths: 1,
    dims: d(0.3, 0.2, 0.25), desc: 'Small energy store.', tradeoffs: ['Light', 'Shallow eclipse reserve'] },
  { id: 'bat-m', category: 'battery', name: 'Li-ion 900 Wh', capacityWh: 900, maxDischargeW: 900, massKg: 8.5, costM: 1.9, powerW: 0, reliability: 0.997, devMonths: 1,
    dims: d(0.4, 0.25, 0.3), desc: 'Medium energy store.', tradeoffs: ['Covers most LEO eclipses for moderate loads'] },
  { id: 'bat-l', category: 'battery', name: 'Li-ion 2400 Wh', capacityWh: 2400, maxDischargeW: 2400, massKg: 22, costM: 4.2, powerW: 0, reliability: 0.996, devMonths: 2,
    dims: d(0.5, 0.3, 0.4), desc: 'Large energy store.', tradeoffs: ['Big reserve', '22 kg and $4.2M'] },
];

const ant = (a: Omit<AntennaPart, 'category' | 'gainDbi'> & { gainDbi?: number }): AntennaPart => ({
  ...a, category: 'antenna', gainDbi: a.gainDbi ?? dishGainDbi(a.diameterM, a.freqGHz),
});
const antennas: AntennaPart[] = [
  ant({ id: 'ant-lga', name: 'Low-Gain Antenna (S-band patch)', band: 'S', freqGHz: 2.2, diameterM: 0.1, gainDbi: 3, maxRateMbps: 0.256, steerable: false,
    massKg: 0.6, costM: 0.3, powerW: 0, reliability: 0.999, devMonths: 0.5, dims: d(0.1, 0.05),
    desc: 'Omnidirectional: needs no pointing, but gain is tiny. Good for commands and emergency contact.', tradeoffs: ['No pointing needed', 'Very low data rate'] }),
  ant({ id: 'ant-mga', name: 'Medium-Gain Antenna (0.5 m X-band)', band: 'X', freqGHz: 8.4, diameterM: 0.5, maxRateMbps: 30, steerable: true,
    massKg: 4.5, costM: 1.6, powerW: 8, reliability: 0.997, devMonths: 1.5, dims: d(0.5, 0.25),
    desc: 'Small steerable dish with a ~7° beam. Fine for near-Earth and cislunar links.', tradeoffs: ['Moderate data rate', 'Modest pointing requirement'] }),
  ant({ id: 'ant-hga', name: 'High-Gain Antenna (1.8 m X-band)', band: 'X', freqGHz: 8.4, diameterM: 1.8, maxRateMbps: 150, steerable: true,
    massKg: 17, costM: 5.2, powerW: 14, reliability: 0.995, devMonths: 3, dims: d(1.8, 0.55),
    desc: 'Large steerable dish with a ~1.4° beam. The only way to move real data from Mars distance.', tradeoffs: ['Highest data rate', 'Needs fine pointing', 'Does not fit small fairings'] }),
];

const transmitters: TransmitterPart[] = [
  { id: 'tx-5', category: 'transmitter', name: 'Transmitter 5 W (solid-state)', rfPowerW: 5, efficiency: 0.3, massKg: 1.2, costM: 0.8, powerW: 5 / 0.3, reliability: 0.997, devMonths: 1,
    dims: d(0.2, 0.1), desc: '5 W RF output, ~17 W DC.', tradeoffs: ['Low power draw', 'Limited range'] },
  { id: 'tx-25', category: 'transmitter', name: 'Transmitter 25 W (solid-state)', rfPowerW: 25, efficiency: 0.35, massKg: 3.8, costM: 2.4, powerW: 25 / 0.35, reliability: 0.996, devMonths: 1.5,
    dims: d(0.25, 0.12), desc: '25 W RF output, ~71 W DC.', tradeoffs: ['Good range per watt'] },
  { id: 'tx-80', category: 'transmitter', name: 'Transmitter 80 W (TWTA)', rfPowerW: 80, efficiency: 0.45, massKg: 9.5, costM: 6.2, powerW: 80 / 0.45, reliability: 0.994, devMonths: 2.5,
    dims: d(0.3, 0.2), desc: '80 W RF travelling-wave tube amplifier, ~178 W DC.', tradeoffs: ['Deep-space capability', 'Hungry for power, heavy, expensive'] },
];

const computers: ComputerPart[] = [
  { id: 'obc-1', category: 'computer', name: 'OBC-1 Basic Flight Computer', processingMBd: 1500, storageMB: 16000, tidKrad: 15, massKg: 2.2, costM: 1.0, powerW: 8, reliability: 0.994, devMonths: 1,
    dims: d(0.25, 0.1), desc: '1.5 GB/day processing, 16 GB storage, 15 krad tolerance (commercial parts).', tradeoffs: ['Cheap, frugal', 'Cannot handle imaging data volumes'] },
  { id: 'obc-2', category: 'computer', name: 'OBC-2 Advanced Onboard Computer', processingMBd: 25000, storageMB: 256000, tidKrad: 100, massKg: 4.5, costM: 3.2, powerW: 18, reliability: 0.995, devMonths: 2,
    dims: d(0.3, 0.12), desc: '25 GB/day processing, 256 GB storage, 100 krad tolerance.', tradeoffs: ['Handles most missions'] },
  { id: 'obc-3', category: 'computer', name: 'OBC-3 High-Performance Processing Unit', processingMBd: 250000, storageMB: 2048000, tidKrad: 300, massKg: 8, costM: 8.5, powerW: 45, reliability: 0.993, devMonths: 3,
    dims: d(0.35, 0.15), desc: '250 GB/day processing, 2 TB storage, 300 krad (radiation-hardened).', tradeoffs: ['Enables hyperspectral volumes', 'Heavy power draw, complex'] },
];

const adcs: AdcsPart[] = [
  { id: 'adcs-basic', category: 'adcs', name: 'Basic Stabilization (magnetorquers)', pointingDeg: 2.0, earthOnly: true, massKg: 1.5, costM: 0.6, powerW: 4, reliability: 0.997, devMonths: 0.5,
    dims: d(0.2, 0.1), desc: '~2° pointing using Earth\'s magnetic field. Useless beyond Earth orbit.', tradeoffs: ['Cheapest', 'Works only near Earth'] },
  { id: 'adcs-sun', category: 'adcs', name: 'Sun Sensors + Momentum Wheel', pointingDeg: 0.3, earthOnly: false, massKg: 3.8, costM: 1.3, powerW: 8, reliability: 0.996, devMonths: 1,
    dims: d(0.25, 0.12), desc: '~0.3° pointing, good enough for coarse imaging.', tradeoffs: ['Works anywhere in the Solar System'] },
  { id: 'adcs-wheels', category: 'adcs', name: 'Reaction Wheel Assembly', pointingDeg: 0.1, earthOnly: false, massKg: 7, costM: 2.4, powerW: 18, reliability: 0.995, devMonths: 1.5,
    dims: d(0.3, 0.15), desc: '~0.1° pointing with three-axis control.', tradeoffs: ['Solid for high-gain antennas'] },
  { id: 'adcs-star', category: 'adcs', name: 'Star Tracker + Reaction Wheels', pointingDeg: 0.02, earthOnly: false, massKg: 10, costM: 5.0, powerW: 30, reliability: 0.994, devMonths: 2.5,
    dims: d(0.35, 0.2), desc: '~0.02° (72 arcsec) pointing.', tradeoffs: ['Fine pointing for hyperspectral and altimetry'] },
  { id: 'adcs-adv', category: 'adcs', name: 'Advanced Fine-Pointing System', pointingDeg: 0.003, earthOnly: false, massKg: 24, costM: 13, powerW: 70, reliability: 0.992, devMonths: 4,
    dims: d(0.45, 0.3), desc: '~0.003° (11 arcsec): star trackers, gyros and a fast steering mirror.', tradeoffs: ['Telescope-class stability', '24 kg, 70 W, $13M'] },
];

const thermal: ThermalPart[] = [
  { id: 'th-passive', category: 'thermal', name: 'Passive Thermal Control', heatRejectionW: 350, insulation: 0.3, stability: 0.3, massKg: 3.5, costM: 0.5, powerW: 0, reliability: 0.999, devMonths: 0.5,
    dims: d(0.3, 0.05), desc: 'Multi-layer insulation and small radiators.', tradeoffs: ['Free of power', 'Only ~350 W heat rejection'] },
  { id: 'th-ins', category: 'thermal', name: 'Enhanced Insulation + Louvers', heatRejectionW: 700, insulation: 0.6, stability: 0.6, massKg: 8, costM: 1.6, powerW: 4, reliability: 0.998, devMonths: 1,
    dims: d(0.3, 0.06), desc: 'Better blankets and adaptive louvers.', tradeoffs: ['Handles mid-power spacecraft'] },
  { id: 'th-active', category: 'thermal', name: 'Active Thermal Management', heatRejectionW: 2500, insulation: 0.8, stability: 0.95, massKg: 22, costM: 5.2, powerW: 38, reliability: 0.995, devMonths: 3,
    dims: d(0.4, 0.12), desc: 'Pumped fluid loops and controlled heaters.', tradeoffs: ['Precision temperature stability', 'Heavy and power hungry'] },
];

const engines: EnginePart[] = [
  { id: 'eng-mono', category: 'engine', name: 'Hydrazine Cluster 4×22 N', thrustN: 88, isp: 225, electric: false, massKg: 4, costM: 1.0, powerW: 12, reliability: 0.998, devMonths: 1,
    dims: d(0.3, 0.3), desc: 'Simple monopropellant thrusters. Isp 225 s.', tradeoffs: ['Reliable and cheap', 'Poor efficiency, low thrust for big captures'] },
  { id: 'eng-bi', category: 'engine', name: 'Bipropellant Engine 445 N', thrustN: 445, isp: 318, electric: false, massKg: 9, costM: 3.0, powerW: 20, reliability: 0.996, devMonths: 2,
    dims: d(0.35, 0.6), desc: 'Orbit-insertion class engine. Isp 318 s.', tradeoffs: ['Efficient impulsive burns'] },
  { id: 'eng-bi-h', category: 'engine', name: 'Bipropellant Main Engine 1100 N', thrustN: 1100, isp: 325, electric: false, massKg: 21, costM: 6.0, powerW: 30, reliability: 0.994, devMonths: 3,
    dims: d(0.5, 0.9), desc: 'Strong main engine for heavy spacecraft. Isp 325 s.', tradeoffs: ['Short captures for large masses', 'Heavy and costly'] },
  { id: 'eng-ion', category: 'engine', name: 'Xenon Ion Thruster (1.1 kW)', thrustN: 0.08, isp: 2800, electric: true, massKg: 30, costM: 7.0, powerW: 1100, reliability: 0.993, devMonths: 4,
    dims: d(0.4, 0.5), desc: '80 mN, Isp 2,800 s. Needs 1.1 kW and months of continuous thrust.', tradeoffs: ['Ultra-efficient: tiny propellant mass', 'Cannot do impulsive captures', 'Needs big solar arrays'] },
];

const tanks: TankPart[] = [
  { id: 'tank-s', category: 'tank', name: 'Tank S (60 kg)', capacityKg: 60, massKg: 5, costM: 0.4, powerW: 0, reliability: 0.999, devMonths: 0.5, dims: d(0.4, 0.5), desc: 'Holds 60 kg of propellant.', tradeoffs: ['Light'] },
  { id: 'tank-m', category: 'tank', name: 'Tank M (220 kg)', capacityKg: 220, massKg: 15, costM: 1.0, powerW: 0, reliability: 0.999, devMonths: 1, dims: d(0.7, 0.8), desc: 'Holds 220 kg of propellant.', tradeoffs: ['Balanced'] },
  { id: 'tank-l', category: 'tank', name: 'Tank L (700 kg)', capacityKg: 700, massKg: 45, costM: 2.4, powerW: 0, reliability: 0.998, devMonths: 1.5, dims: d(1.0, 1.2), desc: 'Holds 700 kg of propellant.', tradeoffs: ['Large Δv for heavy spacecraft'] },
];


// ---- second catalogue wave: micro and super-heavy buses, more power, links, avionics, thermal and propulsion options ----
frames.push(
  { id: 'frame-xs', category: 'frame', name: 'Bus-XS Micro Frame (12U class)', massKg: 14, costM: 1.2, powerW: 4, reliability: 0.995, devMonths: 3,
    dims: d(0.4, 0.6), slots: frameSlots(0.4, 0.6, 1, 2, 5), maxSupportedKg: 70, maxAccelG: 9,
    desc: 'A cubesat-class bus for rideshare launchers: one instrument bay, one small tank, five internal bays.',
    tradeoffs: ['Very cheap and light', 'Only 70 kg of equipment', 'One instrument, little power'] },
  { id: 'frame-xl', category: 'frame', name: 'Bus-XL Super-Heavy Frame', massKg: 760, costM: 28, powerW: 44, reliability: 0.994, devMonths: 12,
    dims: d(2.2, 2.8), slots: frameSlots(2.2, 2.8, 8, 5, 11), maxSupportedKg: 4200, maxAccelG: 4.5,
    desc: 'Observatory-class bus: eight instrument bays, four tank positions and eleven internal bays.',
    tradeoffs: ['Carries almost anything', 'Needs a heavy launcher and a long build', 'Low g-load tolerance'] },
);
solar.push(
  { id: 'sa-xs', category: 'solar', name: 'SA-0 Body-Mounted Cells (0.6 m²)', areaM2: 0.6, wattsPerM2: 270, degradationPerYear: 0.03, spanM: 0.6,
    massKg: 4, costM: 0.5, powerW: 0, reliability: 0.999, devMonths: 0.5, dims: d(0.08, 0.6, 0.5),
    desc: 'Cells glued to the bus: ~160 W at 1 AU and nothing to deploy.', tradeoffs: ['No deployment risk', 'Tiny output', 'Poor Sun angles'] },
  { id: 'sa-xl', category: 'solar', name: 'SA-12 Ultra-Flex Wing (12 m²)', areaM2: 12, wattsPerM2: 330, degradationPerYear: 0.016, spanM: 7.5,
    massKg: 58, costM: 12, powerW: 0, reliability: 0.993, devMonths: 4, dims: d(0.2, 2.2, 1.6),
    desc: 'A fan-fold circular wing: ~3,900 W at 1 AU, ~1,700 W at Mars distance.', tradeoffs: ['Highest power per kilogram', 'Expensive and a big deployment risk'] },
);
batteries.push(
  { id: 'bat-xs', category: 'battery', name: 'Li-ion 80 Wh', capacityWh: 80, maxDischargeW: 120, massKg: 0.9, costM: 0.3, powerW: 0, reliability: 0.997, devMonths: 0.5,
    dims: d(0.12, 0.1, 0.1), desc: 'Cubesat-class pack.', tradeoffs: ['Almost weightless', 'Barely covers one eclipse'] },
  { id: 'bat-xl', category: 'battery', name: 'Li-ion 6000 Wh', capacityWh: 6000, maxDischargeW: 6000, massKg: 52, costM: 9.5, powerW: 0, reliability: 0.995, devMonths: 3,
    dims: d(0.6, 0.35, 0.5), desc: 'Observatory-class energy store.', tradeoffs: ['Rides out week-long eclipse seasons', '52 kg and $9.5M'] },
);
antennas.push(
  ant({ id: 'ant-horn', name: 'Low-Gain Horn (X-band)', band: 'X', freqGHz: 8.4, diameterM: 0.12, gainDbi: 12, maxRateMbps: 4, steerable: false,
    massKg: 1.1, costM: 0.5, powerW: 0, reliability: 0.999, devMonths: 0.8, dims: d(0.12, 0.2),
    desc: 'A fixed 12 dBi horn: ten times the gain of a patch with a ~40° beam, still no steering.', tradeoffs: ['Cheap and robust', 'Needs the nadir deck pointed at the ground'] }),
  ant({ id: 'ant-ka', name: 'High-Gain Antenna (1.2 m Ka-band)', band: 'Ka', freqGHz: 32, diameterM: 1.2, maxRateMbps: 400, steerable: true,
    massKg: 14, costM: 6.8, powerW: 12, reliability: 0.994, devMonths: 3.5, dims: d(1.2, 0.4),
    desc: 'Four times the carrier frequency gives a 0.3° beam and big data rates, if you can point it.', tradeoffs: ['Highest rate per kilogram', 'Needs very fine pointing', 'Rain fades on the ground link'] }),
);
transmitters.push(
  { id: 'tx-2', category: 'transmitter', name: 'Transmitter 2 W (cubesat)', rfPowerW: 2, efficiency: 0.25, massKg: 0.5, costM: 0.4, powerW: 2 / 0.25, reliability: 0.997, devMonths: 0.8,
    dims: d(0.1, 0.05), desc: '2 W RF output, 8 W DC.', tradeoffs: ['Fits a micro bus', 'Short range'] },
  { id: 'tx-150', category: 'transmitter', name: 'Transmitter 150 W (Ka TWTA)', rfPowerW: 150, efficiency: 0.5, massKg: 14, costM: 9.5, powerW: 150 / 0.5, reliability: 0.993, devMonths: 3,
    dims: d(0.35, 0.25), desc: '150 W RF travelling-wave tube, 300 W DC.', tradeoffs: ['Deep-space data rates', 'Heavy, hungry and costly'] },
);
computers.push(
  { id: 'obc-0', category: 'computer', name: 'OBC-0 Cubesat Flight Computer', processingMBd: 400, storageMB: 4000, tidKrad: 10, massKg: 0.5, costM: 0.4, powerW: 2.5, reliability: 0.993, devMonths: 0.8,
    dims: d(0.1, 0.05), desc: '0.4 GB/day, 4 GB storage, 10 krad (commercial).', tradeoffs: ['Tiny and cheap', 'Single-event upsets are common'] },
  { id: 'obc-rh', category: 'computer', name: 'OBC-R Radiation-Hardened Computer', processingMBd: 6000, storageMB: 64000, tidKrad: 1000, massKg: 3.5, costM: 6.0, powerW: 12, reliability: 0.998, devMonths: 3,
    dims: d(0.28, 0.12), desc: '6 GB/day, 64 GB, 1,000 krad: slow, expensive and nearly immune to upsets.', tradeoffs: ['Survives belts and Jupiter-class radiation', 'Low throughput for its cost'] },
);
adcs.push(
  { id: 'adcs-lite', category: 'adcs', name: 'Nano Star Tracker + Wheels', pointingDeg: 0.05, earthOnly: false, massKg: 4, costM: 2.8, powerW: 12, reliability: 0.996, devMonths: 1.5,
    dims: d(0.2, 0.1), desc: '~0.05° pointing in a cubesat-sized package.', tradeoffs: ['Good value fine pointing', 'Less agile than full wheels'] },
  { id: 'adcs-cmg', category: 'adcs', name: 'Control Moment Gyros', pointingDeg: 0.006, earthOnly: false, massKg: 36, costM: 10, powerW: 85, reliability: 0.993, devMonths: 3.5,
    dims: d(0.4, 0.3), desc: '~0.006° pointing with fast slews: big torque from spinning rotors.', tradeoffs: ['Agile and precise', 'Heavy and power hungry'] },
);
thermal.push(
  { id: 'th-heatpipe', category: 'thermal', name: 'Heat Pipes + Radiator Panels', heatRejectionW: 1300, insulation: 0.55, stability: 0.72, massKg: 13, costM: 2.6, powerW: 3, reliability: 0.998, devMonths: 1.5,
    dims: d(0.35, 0.08), desc: 'Passive two-phase heat pipes spreading heat to larger radiators.', tradeoffs: ['No pumps to fail', 'Moderate stability'] },
  { id: 'th-cryo', category: 'thermal', name: 'Cryocooler + Cold Shield', heatRejectionW: 900, insulation: 0.9, stability: 0.99, massKg: 19, costM: 7.4, powerW: 62, reliability: 0.993, devMonths: 4,
    dims: d(0.35, 0.15), desc: 'Mechanical cooler holding detectors in the tens of kelvin.', tradeoffs: ['Infrared telescope temperatures', 'Mechanical wear and vibration'] },
);
engines.push(
  { id: 'eng-cold', category: 'engine', name: 'Cold-Gas Thrusters 4×3 N', thrustN: 12, isp: 65, electric: false, massKg: 1.4, costM: 0.35, powerW: 4, reliability: 0.999, devMonths: 0.5,
    dims: d(0.15, 0.15), desc: 'Pressurised gas: Isp 65 s, almost nothing can go wrong.', tradeoffs: ['Cheapest and safest', 'Very little delta-v per kilogram'] },
  { id: 'eng-green', category: 'engine', name: 'Green Monopropellant Cluster 4×22 N', thrustN: 88, isp: 250, electric: false, massKg: 4.6, costM: 1.6, powerW: 14, reliability: 0.997, devMonths: 1.5,
    dims: d(0.3, 0.3), desc: 'Low-toxicity hydroxyl-ammonium blend: Isp 250 s, easier to handle than hydrazine.', tradeoffs: ['Better than hydrazine', 'Needs heated catalyst beds'] },
  { id: 'eng-hall', category: 'engine', name: 'Hall-Effect Thruster (1.5 kW)', thrustN: 0.09, isp: 1650, electric: true, massKg: 14, costM: 4.5, powerW: 1500, reliability: 0.995, devMonths: 3,
    dims: d(0.3, 0.3), desc: '90 mN, Isp 1,650 s: more thrust than an ion engine and a cheaper electrical bill per newton.', tradeoffs: ['Good for Earth-orbit raising', 'Lower efficiency than an ion thruster'] },
  { id: 'eng-ion-hp', category: 'engine', name: 'Xenon Ion Thruster Cluster (3.5 kW)', thrustN: 0.2, isp: 3300, electric: true, massKg: 55, costM: 13, powerW: 3500, reliability: 0.991, devMonths: 5,
    dims: d(0.6, 0.6), desc: '200 mN, Isp 3,300 s: reaches far targets with a fraction of the propellant.', tradeoffs: ['Needs a very large solar array', 'Months of thrusting'] },
);
tanks.push(
  { id: 'tank-xs', category: 'tank', name: 'Tank XS (15 kg)', capacityKg: 15, massKg: 1.5, costM: 0.2, powerW: 0, reliability: 0.999, devMonths: 0.3, dims: d(0.25, 0.3), desc: 'Holds 15 kg of propellant.', tradeoffs: ['Micro-bus size'] },
  { id: 'tank-xl', category: 'tank', name: 'Tank XL (1600 kg)', capacityKg: 1600, massKg: 95, costM: 4.8, powerW: 0, reliability: 0.998, devMonths: 2.5, dims: d(1.4, 1.8), desc: 'Holds 1.6 tonnes of propellant.', tradeoffs: ['Enough for a big orbit-insertion burn', 'Needs the XL bus'] },
);

export const PART_LIST: Part[] = [
  ...frames, ...solar, ...batteries, ...antennas, ...transmitters, ...computers, ...adcs, ...thermal, ...engines, ...tanks, ...INSTRUMENTS,
];
export const PARTS: Record<string, Part> = Object.fromEntries(PART_LIST.map((p) => [p.id, p]));
export const FRAMES = frames;

export function partsOf(cat: PartCategory): Part[] {
  return PART_LIST.filter((p) => p.category === cat);
}
export function getPart<T extends Part = Part>(id: string | null | undefined): T | null {
  return id ? ((PARTS[id] as T) ?? null) : null;
}
export const CATEGORY_LABEL: Record<PartCategory, string> = {
  frame: 'Structure', solar: 'Solar arrays', battery: 'Batteries', antenna: 'Antennas', transmitter: 'Transmitters', computer: 'Onboard computer',
  adcs: 'Attitude control', thermal: 'Thermal control', engine: 'Propulsion', tank: 'Propellant tanks', instrument: 'Instruments',
};
