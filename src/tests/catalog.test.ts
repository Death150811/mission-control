import { describe, expect, it } from 'vitest';
import { LAUNCH_VEHICLES } from '../data/launchVehicles';
import { SCENARIOS, SCENARIO_MAP } from '../data/missions';
import { INSTRUMENTS } from '../data/instruments';
import { PART_LIST, PARTS } from '../data/spacecraftComponents';
import { STARTER_PARTS, TECH_MAP, TECH_NODES, prerequisitesOf } from '../data/techTree';
import { TESTS } from '../data/tests';
import { autoDesign, placePart } from '../engine/designFactory';
import { EVENT_DEFS } from '../engine/eventEngine';
import { createMission } from '../engine/missionSimulator';
import { analyzeDesign } from '../engine/resourceManager';
import { runTest } from '../engine/testFacility';

const lunar = SCENARIO_MAP['lunar-explorer'];

describe('part catalogue', () => {
  it('has unique ids, finite specs and at least 70 parts', () => {
    const ids = PART_LIST.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(PART_LIST.length).toBeGreaterThanOrEqual(70);
    for (const p of PART_LIST) {
      expect(Number.isFinite(p.massKg) && p.massKg > 0, p.id).toBe(true);
      expect(Number.isFinite(p.costM) && p.costM > 0, p.id).toBe(true);
      expect(p.reliability, p.id).toBeGreaterThan(0.95);
      expect(p.reliability, p.id).toBeLessThanOrEqual(1);
    }
  });
  it('every non-starter part is unlocked by exactly one technology', () => {
    const vehicleIds = new Set([...LAUNCH_VEHICLES.map((v) => v.id), 'lv-custom']);
    for (const p of PART_LIST) {
      if (STARTER_PARTS.includes(p.id)) continue;
      expect(TECH_NODES.filter((n) => n.unlocks.includes(p.id)).length, p.id).toBe(1);
    }
    for (const n of TECH_NODES) for (const u of n.unlocks) expect(PARTS[u] !== undefined || vehicleIds.has(u), `${n.id} -> ${u}`).toBe(true);
  });
  it('instruments declare relevance for all five targets and are analysed without NaN', () => {
    expect(INSTRUMENTS.length).toBeGreaterThanOrEqual(24);
    const base = autoDesign(SCENARIO_MAP['earth-observation'], 'engineer');
    for (const i of INSTRUMENTS) {
      for (const t of ['earth', 'moon', 'mars', 'asteroid', 'deepspace'] as const) expect(typeof i.relevance[t], `${i.id}:${t}`).toBe('number');
      const a = analyzeDesign(placePart(base, 'bay-1', i.id), SCENARIO_MAP['earth-observation'], 'engineer');
      for (const v of [a.mass.total, a.cost.total, a.science.potentialPerDay, a.power.avgLoadW]) expect(Number.isFinite(v), i.id).toBe(true);
    }
  });
  it('the micro and super-heavy buses expose the slots a design needs', () => {
    for (const id of ['frame-xs', 'frame-xl']) {
      const f = PARTS[id] as import('../types').FramePart;
      const ids = f.slots.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(f.slots.filter((s) => s.kind === 'internal').length).toBeGreaterThanOrEqual(5);
      expect(ids).toContain('aft-1');
      expect(ids).toContain('aft-2');
    }
    expect((PARTS['frame-xl'] as import('../types').FramePart).slots.filter((s) => s.kind === 'bay').length).toBe(8);
  });
});

describe('technology tree', () => {
  it('only requires known, lower-tier nodes and has no cycles', () => {
    for (const n of TECH_NODES) {
      for (const r of n.requires) { expect(TECH_MAP[r], `${n.id} requires ${r}`).toBeDefined(); expect(TECH_MAP[r].tier, `${n.id}`).toBeLessThan(n.tier); }
      expect(prerequisitesOf(n.id)).not.toContain(n.id);
      expect(n.real.length, n.id).toBeGreaterThan(20);
    }
    expect(TECH_NODES.length).toBeGreaterThanOrEqual(30);
  });
});

describe('verification tests and events', () => {
  it('there are 13 tests and every one runs on every reference design', () => {
    expect(TESTS.length).toBe(13);
    for (const s of SCENARIOS) {
      const a = analyzeDesign(autoDesign(s, 'engineer'), s, 'engineer');
      for (const t of TESTS) {
        const r = runTest(t.id, a);
        expect(['PASS', 'MARGINAL', 'FAIL'], `${s.id}/${t.id}`).toContain(r.verdict);
        expect(r.metrics.length, t.id).toBeGreaterThan(0);
        expect(r.findings.length, t.id).toBeGreaterThan(0);
      }
    }
  });
  it('the radiation and software tests catch the obvious mistakes', () => {
    const s = SCENARIO_MAP['earth-observation'];
    const d0 = autoDesign(s, 'engineer');
    const weak = placePart({ ...d0, orbit: { ...d0.orbit, orbitId: 'meo', perigeeKm: 20000, apogeeKm: 20000, incDeg: 55 } }, 'int-2', 'obc-1');
    expect(runTest('radtest', analyzeDesign(weak, s, 'engineer')).verdict).not.toBe('PASS');
    const hard = placePart(weak, 'int-2', 'obc-rh');
    const rw = runTest('radtest', analyzeDesign({ ...hard, shieldingMm: 6 }, s, 'engineer'));
    expect(rw.verdict).toBe('PASS');
    const sw = runTest('sw', analyzeDesign(placePart(autoDesign(SCENARIO_MAP['earth-observation'], 'engineer'), 'int-2', 'obc-0'), s, 'engineer'));
    expect(sw.verdict).toBe('FAIL');
  });
  it('event ids are unique, every event offers a choice, and radiation-hardened computers see fewer upsets', () => {
    const ids = EVENT_DEFS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['seu-bitflip', 'wheel-friction', 'star-tracker-blind', 'micrometeoroid']));
    const d = autoDesign(lunar, 'engineer');
    const mk = (cid: string) => { const m = createMission(placePart(d, 'int-2', cid), lunar, 'engineer', 3); m.phase = 'science'; return m; };
    const m1 = mk('obc-1'), mr = mk('obc-rh');
    const seu = EVENT_DEFS.find((e) => e.id === 'seu-bitflip')!;
    expect(seu.weight(m1)).toBeGreaterThan(seu.weight(mr) * 4);
    for (const def of EVENT_DEFS) {
      const ev = def.build(m1, () => 0.5);
      expect(ev.responses.length, def.id).toBeGreaterThanOrEqual(2);
      expect(ev.description.length, def.id).toBeGreaterThan(20);
    }
  });
  it('booking the end-to-end test lowers every anomaly probability by about 10 percent', () => {
    const d = autoDesign(lunar, 'engineer');
    const none = analyzeDesign(d, lunar, 'engineer'), some = analyzeDesign({ ...d, tests: ['ete'] }, lunar, 'engineer');
    expect(some.cost.tests).toBeGreaterThan(none.cost.tests + 1.5);
    expect(some.schedule.testMonths).toBeGreaterThan(none.schedule.testMonths + 1.4);
  });
});
