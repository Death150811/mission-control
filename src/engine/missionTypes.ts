import type { Design, Difficulty, Scenario } from '../types';
import type { Analysis } from './resourceManager';

export type Phase = 'launch' | 'cruise' | 'insertion' | 'commissioning' | 'science' | 'extended' | 'done';
export const PHASE_ORDER: Phase[] = ['launch', 'cruise', 'insertion', 'commissioning', 'science', 'extended', 'done'];
export const PHASE_LABEL: Record<Phase, string> = {
  launch: 'LAUNCH', cruise: 'TRAJECTORY', insertion: 'ORBIT INSERTION', commissioning: 'COMMISSIONING',
  science: 'SCIENCE OPS', extended: 'EXTENDED OPS', done: 'CONCLUSION',
};

export type DownlinkPolicy = 'value' | 'proportional' | 'priority';
export interface OpsPlan {
  duty: Record<string, number>;
  priority: 'science' | 'balanced' | 'survival';
  downlink: DownlinkPolicy;
  priorityInstrument: string | null;
  autoRespond: boolean;
}

export interface InstState { slotId: string; partId: string; name: string; status: 'ok' | 'degraded' | 'failed'; health: number }
export interface LogEntry { day: number; phase: Phase; kind: 'info' | 'event' | 'success' | 'warn' | 'critical'; text: string }

export interface EventResponse { id: string; label: string; desc: string; quality: number }
export interface ActiveEvent {
  key: string; typeId: string; day: number; title: string; description: string; severity: 'minor' | 'moderate' | 'major';
  educational: string; responses: EventResponse[]; deadlineDay: number; target?: string; magnitude: number;
}

export interface DayRecord {
  day: number; phase: Phase; genW: number; loadW: number; socPct: number; powerMarginPct: number; storageMB: number; generatedMB: number;
  downlinkedMB: number; lostMB: number; capacityMB: number; propKg: number; points: number; shed: number; rateKbps: number; distanceAU: number; thermal: number;
}

export interface Mods {
  solarLoss: number; extraLoadW: number; extraLoadUntil: number; blackoutUntil: number; thermalExtra: number; thermalUntil: number;
  safeUntil: number; shedUntil: number; shedFrac: number; battHealth: number; navPenaltyUntil: number; spike: Record<string, { until: number; mult: number }>;
  bonusCapacityToday: number; dodCapUntil: number; procPenalty: number; txPenalty: number; backupUsed: { computer: boolean; transmitter: boolean };
}

export interface MissionStats {
  operatingDays: number; safeModeDays: number; brownoutDays: number; blackoutDays: number; shedDays: number; eventsTotal: number;
  qualitySum: number; qualityCount: number; skDeficitDays: number; powerDeathDays: number; peakBacklogMB: number; extraCostM: number;
  scienceDays: number; lastAutoResponses: number;
}

export interface LaunchOutcome {
  ok: boolean; flown: 'player' | 'autopilot'; reason: string; remainingDv: number; requiredDv: number; flightTimeS: number; delayDays: number;
  perigeeKm: number; apogeeKm: number; maxQkPa: number; maxG: number; log: { t: number; msg: string }[];
}

export interface MissionState {
  seed: number;
  design: Design; scenario: Scenario; difficulty: Difficulty; a: Analysis;
  day: number; phase: Phase; ended: boolean; outcome: 'running' | 'completed' | 'failed'; endReason: string;
  launch: LaunchOutcome;
  insertionDay: number; scienceStart: number; scienceEnd: number; extendedEnd: number;
  propKg: number; socWh: number; thrustS: number;
  buffers: Record<string, number>;
  generatedMB: number; downlinkedMB: number; lostMB: number;
  inst: Record<string, InstState>;
  points: Record<string, number>;
  area: Record<string, number>;
  mods: Mods;
  stats: MissionStats;
  log: LogEntry[]; history: DayRecord[];
  pending: ActiveEvent | null;
  ops: OpsPlan;
  responses: { day: number; typeId: string; title: string; response: string; quality: number; auto: boolean }[];
  insertionOk: boolean;
  discoveries: { id: string; title: string; text: string; day: number }[];
}
