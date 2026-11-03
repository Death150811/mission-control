// Core domain types for MISSION CONTROL. All physical quantities are SI unless a name says otherwise
// (…Km, …M for $ millions, …Deg). Part/instrument numbers are ILLUSTRATIVE game-balance values.

export type BodyId = 'earth' | 'moon' | 'mars' | 'asteroid' | 'sun';
export type TargetId = 'earth' | 'moon' | 'mars' | 'asteroid' | 'deepspace';
export type Difficulty = 'beginner' | 'engineer' | 'expert';
export type Severity = 'CRITICAL' | 'WARNING' | 'INFO';

export type PartCategory =
  | 'frame' | 'solar' | 'battery' | 'antenna' | 'transmitter' | 'computer'
  | 'adcs' | 'thermal' | 'engine' | 'tank' | 'instrument';
export type SlotKind = 'wing' | 'mast' | 'bay' | 'aft' | 'internal';

export interface Body {
  id: BodyId;
  name: string;
  mu: number;          // m^3/s^2 standard gravitational parameter
  radius: number;      // m
  sunDistanceAU: number;
  color: string;
  atmosphereKm: number;
}

export interface Dims { w: number; h: number; d: number }

export interface SlotDef {
  id: string;
  kind: SlotKind;
  label: string;
  x: number; // lateral offset from bus axis (m)
  y: number; // axial offset from bus centre, + toward nose (m)
  accepts: PartCategory[];
}

export interface PartBase {
  id: string;
  category: PartCategory;
  name: string;
  massKg: number;
  costM: number;          // $ millions
  powerW: number;         // average DC draw while active
  reliability: number;    // survival probability per year (0..1)
  devMonths: number;      // contribution to development schedule
  dims: Dims;
  desc: string;
  tradeoffs: string[];
}
export interface FramePart extends PartBase {
  category: 'frame';
  slots: SlotDef[];
  maxSupportedKg: number; // max mass of everything the frame carries (incl. propellant)
  maxAccelG: number;
}
export interface SolarPart extends PartBase {
  category: 'solar';
  areaM2: number;
  wattsPerM2: number;      // BOL, 1 AU, normal incidence
  degradationPerYear: number;
  spanM: number;
}
export interface BatteryPart extends PartBase {
  category: 'battery';
  capacityWh: number;
  maxDischargeW: number;
}
export interface AntennaPart extends PartBase {
  category: 'antenna';
  band: string;
  freqGHz: number;
  diameterM: number;
  gainDbi: number;        // computed from diameter or fixed for omni
  maxRateMbps: number;
  steerable: boolean;
}
export interface TransmitterPart extends PartBase {
  category: 'transmitter';
  rfPowerW: number;
  efficiency: number;
}
export interface ComputerPart extends PartBase {
  category: 'computer';
  processingMBd: number;
  storageMB: number;
  tidKrad: number;       // total ionising dose tolerance
}
export interface AdcsPart extends PartBase {
  category: 'adcs';
  pointingDeg: number;
  earthOnly: boolean;
}
export interface ThermalPart extends PartBase {
  category: 'thermal';
  heatRejectionW: number;
  insulation: number;   // 0..1
  stability: number;    // 0..1 temperature stability for sensitive instruments
}
export interface EnginePart extends PartBase {
  category: 'engine';
  thrustN: number;
  isp: number;
  electric: boolean;
}
export interface TankPart extends PartBase {
  category: 'tank';
  capacityKg: number;
}
export type Domain =
  | 'imaging' | 'multispectral' | 'hyperspectral' | 'spectroscopy' | 'atmosphere' | 'fields'
  | 'particles' | 'altimetry' | 'thermal' | 'navigation' | 'observatory' | 'radiation';
export interface InstrumentPart extends PartBase {
  category: 'instrument';
  domains: Domain[];
  dataMBd: number;       // at 100% duty, uncompressed
  sci: number;           // 0..100 scientific value
  complexity: number;    // 1..5
  pointingDeg: number;   // required pointing knowledge/control
  ifovUrad: number;      // 0 if not an imager
  fovDeg: number;        // swath full angle (0 if none)
  rangeKm: number;       // max useful range (0 = unlimited)
  altRef: 'effective' | 'perigee';
  sunlitOnly: boolean;
  thermal: number;       // 0..1 sensitivity to temperature stability
  relevance: Partial<Record<TargetId, number>>;
  capabilities: string[];
}
export type Part =
  | FramePart | SolarPart | BatteryPart | AntennaPart | TransmitterPart | ComputerPart
  | AdcsPart | ThermalPart | EnginePart | TankPart | InstrumentPart;

// ---- launch ----
export interface StageDef {
  id: string;
  name: string;
  dryKg: number;
  propKg: number;
  ispSL: number;
  ispVac: number;
  thrustSL: number;
  thrustVac: number;
  diameterM: number;
  costM: number;
  restart: boolean;
}
export interface LaunchVehicle {
  id: string;
  name: string;
  className: string;
  stageIds: [string, string];
  fairingDiameterM: number;
  fairingLengthM: number;
  fairingMassKg: number;
  adapterKg: number;
  maxComHeightM: number;
  maxQPa: number;
  maxG: number;
  reliability: number;
  baseCostM: number;
  leadMonths: number;
  classes: string[];       // launch classes it can serve
  desc: string;
  custom?: boolean;
}

// ---- orbits ----
export type LaunchClass = 'direct' | 'gto' | 'tli' | 'tmi' | 'asteroid' | 'l2';
export interface OrbitSelection { orbitId: string; perigeeKm: number; apogeeKm: number; incDeg: number; ltanH?: number; departDay?: number }

// ---- design ----
export type Compression = 'none' | 'lossless' | 'lossy';
export interface Design {
  id: string;
  name: string;
  scenarioId: string;
  frameId: string;
  placements: Record<string, string | null>;
  propellantKg: number;
  compression: Compression;
  groundStations: 1 | 2 | 3;
  orbit: OrbitSelection;
  vehicleId: string;
  customStages?: [string, string];
  boosters?: { type: string; count: number };
  arrayDrive?: 'fixed' | 'tracking';
  shieldingMm?: number;
  redundancy?: { computer: boolean; transmitter: boolean; battery: boolean };
  tests?: string[];
}

// ---- scenarios ----
export type DistanceModel =
  | { type: 'fixed' }
  | { type: 'synodic'; minM: number; maxM: number; periodD: number; phase: number };

export type ObjectiveSpec =
  | { type: 'coverage'; domains: Domain[]; requiredFraction: number; repeats: number }
  | { type: 'science'; domains: Domain[]; points: number }
  | { type: 'metric'; metric: 'operatingDays' | 'uptime' | 'dataReturnedGB' | 'revisitDays' | 'pointingDeg' | 'thermalMargin' | 'navigation'; op: '>=' | '<='; value: number };
export type Objective = ObjectiveSpec & { id: string; title: string; description: string; mandatory: boolean; weight: number };

export interface Scenario {
  id: string;
  code: string;
  name: string;
  tagline: string;
  target: TargetId;
  bodyId: BodyId;
  difficultyRating: number; // 1..5
  briefing: string;
  science: string;
  requirements: string[];
  objectives: Objective[];
  bonus: Objective[];
  budgetM: number;
  maxMassKg: number;
  deadlineMonths: number;
  cruiseDays: number;
  nominalDays: number;
  extendedDays: number;
  allowedOrbitIds: string[];
  requiredGsdM?: number;
  distance: DistanceModel;
  sunDistanceAU: number;
  successConditions: string[];
  sandbox?: boolean;
}

export type Issue = {
  id: string;
  severity: Severity;
  title: string;
  system: string;
  what: string;
  why: string;
  consequence: string;
  solutions: string[];
  blocksLaunch?: boolean;
};
