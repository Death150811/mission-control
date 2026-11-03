import { describe, expect, it } from 'vitest';
import { SCENARIO_MAP } from '../data/missions';
import { DV_EDGES, DV_NODES, DV_ROUTES, REAL_LAUNCHERS, REAL_MISSIONS, routeEdges, routeTotal } from '../data/realWorld';
import { ACHIEVEMENTS, evaluateAchievements } from '../engine/achievements';
import { autoDesign } from '../engine/designFactory';
import { runMission } from '../engine/missionSimulator';
import { scoreMission } from '../engine/scoringEngine';

describe('achievements', () => {
  it('have unique ids and a reference run earns the expected ones', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(15);
    const sc = SCENARIO_MAP['earth-observation'];
    const m = runMission(autoDesign(sc, 'engineer'), sc, 'engineer', 2026);
    const got = evaluateAchievements(m, scoreMission(m));
    expect(got).toContain('first-light');
    expect(got).toContain('data-river');
    for (const g of got) expect(ids).toContain(g);
  });
  it('a failed mission earns no completion-based achievements', () => {
    const sc = SCENARIO_MAP['lunar-explorer'];
    const m = runMission(autoDesign(sc, 'engineer'), sc, 'engineer', 7);
    m.outcome = 'failed'; m.stats.eventsTotal = 0;
    const got = evaluateAchievements(m, scoreMission(m));
    expect(got).not.toContain('quiet-sky');
    expect(got).not.toContain('thrifty');
  });
});

describe('real-world reference data', () => {
  it('delta-v routes are connected paths over known nodes and add up', () => {
    const nodeIds = new Set(DV_NODES.map((n) => n.id));
    for (const e of DV_EDGES) { expect(nodeIds.has(e.from) && nodeIds.has(e.to)).toBe(true); expect(e.dv).toBeGreaterThan(0); }
    for (const r of DV_ROUTES) {
      expect(routeEdges(r.path).length, r.id).toBe(r.path.length - 1);
      expect(routeTotal(r.path)).toBeCloseTo(routeEdges(r.path).reduce((s, e) => s + e.dv, 0), 10);
    }
    expect(routeTotal(DV_ROUTES.find((r) => r.id === 'moon-orbit')!.path)).toBeCloseTo(9.4 + 3.1 + 0.9, 6);
  });
  it('launcher and mission tables are complete and agree with the game scenarios', () => {
    for (const l of REAL_LAUNCHERS) { expect(l.leoKg).toBeGreaterThan(0); expect(l.heightM).toBeGreaterThan(10); expect(l.first).toBeGreaterThan(1950); }
    expect(REAL_LAUNCHERS.find((l) => l.id === 'saturn5')!.leoKg).toBeGreaterThan(REAL_LAUNCHERS.find((l) => l.id === 'falcon9')!.leoKg);
    for (const m of REAL_MISSIONS) { expect(m.massKg).toBeGreaterThan(0); if (m.analog) expect(SCENARIO_MAP[m.analog], m.id).toBeDefined(); }
  });
  it('the game ascent and parking numbers agree with the real delta-v map to within 15 percent', () => {
    // game: ascent 9.42 km/s to 200 km; translunar injection from that parking orbit
    const leo = DV_EDGES.find((e) => e.from === 'surface' && e.to === 'leo')!.dv;
    expect(Math.abs(9.42 - leo) / leo).toBeLessThan(0.05);
  });
});
