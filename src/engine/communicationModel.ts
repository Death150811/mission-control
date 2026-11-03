// Simplified RF link budget. Real equations: free-space path loss, dish gain, beamwidth, Eb/N0 relation.
// NOT a professional RF analysis: no atmospheric/rain detail, fixed coding gain, single modulation.

import { C_LIGHT, K_B, clamp, dbToLin, linToDb } from './physics';
import type { AdcsPart, AntennaPart, Difficulty, TransmitterPart } from '../types';

/** G = eta (pi D / lambda)^2 */
export function dishGainDbi(diameterM: number, freqGHz: number, efficiency = 0.55): number {
  const lambda = C_LIGHT / (freqGHz * 1e9);
  return linToDb(efficiency * Math.pow((Math.PI * diameterM) / lambda, 2));
}
/** Half-power beamwidth ~ 70 lambda / D (degrees) */
export function beamwidthDeg(diameterM: number, freqGHz: number): number {
  const lambda = C_LIGHT / (freqGHz * 1e9);
  return (70 * lambda) / diameterM;
}
/** Pointing loss L = 12 (e / theta_3dB)^2 dB */
export function pointingLossDb(errDeg: number, bwDeg: number): number {
  return Math.min(40, 12 * Math.pow(errDeg / bwDeg, 2));
}
/** FSPL = 20 log10(4 pi d f / c) */
export function fsplDb(distM: number, freqHz: number): number {
  return 20 * Math.log10((4 * Math.PI * distM * freqHz) / C_LIGHT);
}

export interface GroundStation { name: string; gainDbi: number; tsysK: number }
export function groundStationFor(distM: number, freqGHz: number): GroundStation {
  if (distM > 1e8) return { name: 'Deep-space network (34 m class)', gainDbi: dishGainDbi(34, freqGHz, 0.65), tsysK: freqGHz > 5 ? 40 : 30 };
  return { name: 'Near-Earth station (11 m class)', gainDbi: dishGainDbi(11, freqGHz, 0.6), tsysK: freqGHz > 5 ? 120 : 150 };
}

export interface LinkResult {
  distM: number;
  eirpDbw: number;
  fsplDb: number;
  pointingLossDb: number;
  rxPowerDbw: number;
  cn0DbHz: number;
  uncappedBps: number;
  rateBps: number;       // after hardware cap
  limitedBy: 'link budget' | 'antenna hardware';
  station: GroundStation;
  delayS: number;
  txGainDbi: number;
}

const REQUIRED_EBN0_DB = 2.5 + 2.0; // BPSK with strong coding + implementation loss
const MISC_LOSS_DB = 2.0;           // polarisation, cable, atmosphere
const MARGIN_DB: Record<Difficulty, number> = { beginner: 3, engineer: 3, expert: 6 };

export function linkBudget(
  antenna: AntennaPart, tx: TransmitterPart, adcs: AdcsPart | null, distM: number,
  difficulty: Difficulty, pointingErrOverrideDeg?: number, extraLossDb = 0,
): LinkResult {
  const station = groundStationFor(distM, antenna.freqGHz);
  const err = pointingErrOverrideDeg ?? adcs?.pointingDeg ?? 5;
  const bw = antenna.steerable ? beamwidthDeg(antenna.diameterM, antenna.freqGHz) : 360;
  const pl = antenna.steerable ? pointingLossDb(err, bw) : 0;
  const eirp = linToDb(tx.rfPowerW) + antenna.gainDbi - 1.0; // 1 dB feed loss
  const fs = fsplDb(distM, antenna.freqGHz * 1e9);
  const pr = eirp - fs - pl - MISC_LOSS_DB - extraLossDb + station.gainDbi;
  const n0 = linToDb(K_B * station.tsysK);
  const cn0 = pr - n0;
  const rate = dbToLin(cn0 - REQUIRED_EBN0_DB - MARGIN_DB[difficulty]);
  const cap = antenna.maxRateMbps * 1e6;
  return {
    distM, eirpDbw: eirp, fsplDb: fs, pointingLossDb: pl, rxPowerDbw: pr, cn0DbHz: cn0,
    uncappedBps: rate, rateBps: Math.min(rate, cap), limitedBy: rate > cap ? 'antenna hardware' : 'link budget',
    station, delayS: distM / C_LIGHT, txGainDbi: antenna.gainDbi,
  };
}

export const protocolEfficiency = 0.85;
export function dailyCapacityMB(rateBps: number, contactSeconds: number): number {
  return (rateBps * contactSeconds * protocolEfficiency) / 8 / 1e6;
}
export { clamp };
