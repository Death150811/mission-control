// Interplanetary launch windows.
// Real: the planets return to the same relative geometry once per SYNODIC PERIOD (Earth-Mars ~780 d), and the
//   departure energy C3 = v_inf^2 is lowest when Earth leads the target by the Hohmann phase angle; any other date
//   needs a faster transfer, i.e. more energy (and usually a faster, costlier arrival).
// Game approximation: C3 follows a raised-cosine around each window centre, C3(day) = C3_min + span * (1 - cos(2 pi dt / T)) / 2,
//   and the arrival hyperbolic speed grows with the same "badness" q. Real porkchop plots are asymmetric and 2-D (arrival date too).
import type { OrbitDef } from '../data/orbits';

export interface LaunchWindowDef {
  periodD: number;      // synodic period, days
  bestDay: number;      // centre of the first window, days from programme start
  spanC3: number;       // m^2/s^2 added at the worst date (half a period away from a window)
  arrivalGain: number;  // fractional growth of arrival delta-v at the worst date
}

export const STANDBY_M_PER_MONTH = 0.7; // $M: launch team, storage and range-hold per month spent waiting for the window
export const DAYS_PER_MONTH = 30.44;
/** A date counts as "inside the window" while q stays below this (C3 within ~8 % of the span from the minimum). */
export const WINDOW_Q_OPEN = 0.08;

/** 0 at the window centre, 1 half a synodic period away. */
export function windowQ(w: LaunchWindowDef, day: number): number {
  return (1 - Math.cos((2 * Math.PI * (day - w.bestDay)) / w.periodD)) / 2;
}
export function c3AtDay(def: OrbitDef, day: number): number {
  const w = def.window;
  return (def.c3 ?? 0) + (w ? w.spanC3 * windowQ(w, day) : 0);
}
export function arrivalFactor(def: OrbitDef, day: number): number {
  const w = def.window;
  return w ? 1 + w.arrivalGain * windowQ(w, day) : 1;
}
/** Half-width in days of the "open" part of a window. */
export function windowHalfWidthD(w: LaunchWindowDef): number {
  return (w.periodD / (2 * Math.PI)) * Math.acos(1 - 2 * WINDOW_Q_OPEN);
}
/** Window centres inside [0, toDay]. */
export function windowCentres(w: LaunchWindowDef, toDay: number): number[] {
  const out: number[] = [];
  for (let d = w.bestDay; d <= toDay; d += w.periodD) out.push(d);
  return out;
}
/** First window centre on or after `day`; if `day` is already inside a window it is returned unchanged (never slips). */
export function nextOpenDay(w: LaunchWindowDef, day: number): number {
  const half = windowHalfWidthD(w);
  const k = Math.ceil((day - w.bestDay - half) / w.periodD);
  const centre = w.bestDay + Math.max(0, k) * w.periodD;
  return Math.max(day, centre - half);
}
export function windowCurve(def: OrbitDef, fromDay: number, toDay: number, step = 10): { day: number; c3: number; q: number }[] {
  const w = def.window;
  if (!w) return [];
  const out: { day: number; c3: number; q: number }[] = [];
  for (let d = fromDay; d <= toDay + 1e-9; d += step) out.push({ day: d, c3: c3AtDay(def, d), q: windowQ(w, d) });
  return out;
}
