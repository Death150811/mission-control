// Achievements: milestones judged from a finished mission. Pure functions; storage lives in store/achievements.ts.
import type { MissionState } from './missionTypes';
import type { ScoreResult } from './scoringEngine';

export type Tier = 'bronze' | 'silver' | 'gold';
export interface Achievement { id: string; name: string; desc: string; tier: Tier; test: (m: MissionState, s: ScoreResult) => boolean }

const done = (m: MissionState) => m.outcome === 'completed';
const avgQuality = (m: MissionState) => (m.stats.qualityCount ? m.stats.qualitySum / m.stats.qualityCount : 0);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-light', name: 'First light', desc: 'Return the first science data to Earth.', tier: 'bronze', test: (m) => Object.values(m.points).reduce((s, v) => s + v, 0) > 0 },
  { id: 'clean-launch', name: 'Clean launch', desc: 'Lift off on the planned day with a successful ascent.', tier: 'bronze', test: (m) => m.launch.ok && m.launch.delayDays === 0 },
  { id: 'hands-on', name: 'Hands on the stick', desc: 'Fly the ascent yourself and reach the target orbit.', tier: 'silver', test: (m) => m.launch.ok && m.launch.flown === 'player' },
  { id: 'quiet-sky', name: 'Quiet sky', desc: 'Complete a mission without a single anomaly.', tier: 'silver', test: (m) => done(m) && m.stats.eventsTotal === 0 },
  { id: 'cool-head', name: 'Cool head', desc: 'Handle at least three anomalies with an average response quality of 95% or better.', tier: 'silver', test: (m) => m.stats.eventsTotal >= 3 && avgQuality(m) >= 0.95 },
  { id: 'phoenix', name: 'Phoenix', desc: 'Complete the mission after three or more anomalies and a spell in safe mode.', tier: 'silver', test: (m) => done(m) && m.stats.eventsTotal >= 3 && m.stats.safeModeDays >= 1 },
  { id: 'data-river', name: 'Data river', desc: 'Downlink more than 100 GB.', tier: 'silver', test: (m) => m.downlinkedMB >= 100_000 },
  { id: 'no-waste', name: 'Nothing lost', desc: 'Return data and lose none of it.', tier: 'silver', test: (m) => m.downlinkedMB > 0 && m.lostMB === 0 },
  { id: 'thrifty', name: 'Thrifty director', desc: 'Score at least 750 while spending no more than 70% of the budget.', tier: 'silver', test: (m, s) => done(m) && s.total >= 750 && (m.a.cost.total + m.stats.extraCostM) <= 0.7 * m.a.cost.budget },
  { id: 'light-ship', name: 'Light ship', desc: 'Score at least 700 with a spacecraft under 60% of the allowed mass.', tier: 'silver', test: (m, s) => done(m) && s.total >= 700 && m.a.mass.total <= 0.6 * m.scenario.maxMassKg },
  { id: 'test-pilot', name: 'Test pilot', desc: 'Book four or more verification tests before launch.', tier: 'bronze', test: (m) => (m.design.tests?.length ?? 0) >= 4 },
  { id: 'belt-braces', name: 'Belt and braces', desc: 'Fly redundant computer, transmitter and battery, and complete the mission.', tier: 'silver', test: (m) => done(m) && !!m.design.redundancy?.computer && !!m.design.redundancy?.transmitter && !!m.design.redundancy?.battery },
  { id: 'discoverer', name: 'Discoverer', desc: 'Make three scientific discoveries in one mission.', tier: 'silver', test: (m) => m.discoveries.length >= 3 },
  { id: 'long-haul', name: 'Long haul', desc: 'Operate for 700 days or more.', tier: 'silver', test: (m) => m.stats.operatingDays >= 700 },
  { id: 'window-master', name: 'Window master', desc: 'Launch inside a planetary window and complete the mission.', tier: 'gold', test: (m) => done(m) && !!m.a.orbit.def.window && m.a.orbit.windowQ <= 0.08 },
  { id: 'exceptional', name: 'Exceptional mission', desc: 'Score 900 or more.', tier: 'gold', test: (_m, s) => s.total >= 900 },
  { id: 'expert-ace', name: 'Expert ace', desc: 'Score 800 or more on Expert difficulty.', tier: 'gold', test: (m, s) => m.difficulty === 'expert' && s.total >= 800 },
];
export const ACHIEVEMENT_MAP: Record<string, Achievement> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Ids of every achievement this mission earned. */
export function evaluateAchievements(m: MissionState, s: ScoreResult): string[] {
  return ACHIEVEMENTS.filter((a) => { try { return a.test(m, s); } catch { return false; } }).map((a) => a.id);
}
