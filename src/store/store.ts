// Application state: a tiny external store (no framework dependency), persisted to localStorage where safe.

import { useMemo, useSyncExternalStore } from 'react';
import { makeSandboxScenario, SCENARIO_MAP, type SandboxSettings } from '../data/missions';
import { autoDesign, emptyDesign, newId } from '../engine/designFactory';
import { validateDesign } from '../engine/feasibilityValidator';
import { createMission, type FlightInput } from '../engine/missionSimulator';
import type { MissionState } from '../engine/missionTypes';
import { analyzeDesign } from '../engine/resourceManager';
import { unlockedPartSet, creditsFor, TECH_MAP, canUnlock } from '../data/techTree';
import { PARTS } from '../data/spacecraftComponents';
import { scoreMission, type ScoreResult } from '../engine/scoringEngine';
import type { Design, Difficulty, Scenario } from '../types';

export type Screen =
  | 'landing' | 'select' | 'briefing' | 'workshop' | 'instruments' | 'orbit' | 'launch' | 'validation' | 'flight' | 'control' | 'debrief'
  | 'sandbox' | 'team' | 'compare' | 'library' | 'learn' | 'tech' | 'tests' | 'real';
export type Mode = 'campaign' | 'sandbox';
export type RoleId = 'director' | 'engineer' | 'science' | 'flightops';

export interface SavedDesign { id: string; name: string; scenarioId: string; difficulty: Difficulty; design: Design; savedAt: number; lastScore?: number; sandbox?: SandboxSettings }
export interface ExperimentRecord { id: string; at: number; name: string; scenarioId: string; seed: number; score: number; rank: string; massKg: number; costM: number; sciPoints: number; outcome: string }
export interface LeaderboardEntry { id: string; at: number; player: string; scenarioId: string; scenarioName: string; difficulty: Difficulty; score: number; rank: string; designName: string }
export interface Decision { id: string; at: number; role: RoleId | 'system'; author: string; text: string; kind: 'design' | 'approval' | 'chat' }
export interface Proposal { id: string; text: string; by: string; status: 'pending' | 'approved' | 'rejected'; kind: 'launch' | 'vehicle' | 'orbit' }
export interface TeamMember { id: string; name: string; role: RoleId | 'all'; lastSeen: number; editing?: string }
export interface TeamState {
  active: boolean; code: string | null; memberId: string; name: string; role: RoleId | 'all'; members: Record<string, TeamMember>;
  decisions: Decision[]; requireApproval: boolean; proposals: Proposal[]; sync: 'none' | 'broadcast';
}
export interface FinalResult { score: ScoreResult; seed: number; at: number; credits?: number }
export interface CareerState { enabled: boolean; credits: number; nodes: string[]; best: Record<string, number> }

export interface AppState {
  screen: Screen; mode: Mode; difficulty: Difficulty; scenarioId: string; sandbox: SandboxSettings;
  design: Design | null; seed: number; playerName: string;
  flight: FlightInput | null; mission: MissionState | null; missionVersion: number; result: FinalResult | null;
  saved: SavedDesign[]; experiments: ExperimentRecord[]; leaderboard: LeaderboardEntry[]; team: TeamState;
  learnTopic: string | null; compareIds: string[]; toast: string | null; career: CareerState;
}

const KEY = 'mission-control.v1';
const memberId = newId();

function defaults(): AppState {
  return {
    screen: 'landing', mode: 'campaign', difficulty: 'engineer', scenarioId: 'lunar-explorer',
    sandbox: { target: 'moon', budgetM: 250, maxMassKg: 3000, nominalDays: 180 },
    design: null, seed: 2026, playerName: 'Director', flight: null, mission: null, missionVersion: 0, result: null,
    saved: [], experiments: [], leaderboard: [], learnTopic: null, compareIds: [], toast: null,
    career: { enabled: false, credits: 150, nodes: [], best: {} },
    team: { active: false, code: null, memberId, name: 'Director', role: 'all', members: {}, decisions: [], requireApproval: false, proposals: [], sync: 'none' },
  };
}

function load(): AppState {
  const s = defaults();
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) {
      const p = JSON.parse(raw);
      s.saved = p.saved ?? []; s.experiments = p.experiments ?? []; s.leaderboard = p.leaderboard ?? [];
      s.playerName = p.playerName ?? s.playerName; s.difficulty = p.difficulty ?? s.difficulty;
      s.scenarioId = p.scenarioId ?? s.scenarioId; s.sandbox = p.sandbox ?? s.sandbox; s.mode = p.mode ?? s.mode;
      s.design = p.design ?? null; s.seed = p.seed ?? s.seed; s.career = p.career ?? s.career;
      if (s.design && p.hasDraft) s.screen = 'landing';
    }
  } catch { /* storage unavailable or corrupted: start fresh */ }
  return s;
}

let state: AppState = load();
const listeners = new Set<() => void>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function persist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      localStorage.setItem(KEY, JSON.stringify({
        saved: state.saved, experiments: state.experiments.slice(0, 80), leaderboard: state.leaderboard.slice(0, 100), playerName: state.playerName,
        difficulty: state.difficulty, scenarioId: state.scenarioId, sandbox: state.sandbox, mode: state.mode, design: state.design, seed: state.seed, career: state.career, hasDraft: !!state.design,
      }));
    } catch { /* ignore quota / private mode */ }
  }, 150);
}

export function getState() { return state; }
export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  persist();
  listeners.forEach((l) => l());
}
export function useApp(): AppState {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, getState, getState);
}

export function scenarioOf(s: AppState): Scenario {
  return s.mode === 'sandbox' ? makeSandboxScenario(s.sandbox) : SCENARIO_MAP[s.scenarioId] ?? SCENARIO_MAP['lunar-explorer'];
}

export function useCurrent() {
  const app = useApp();
  const scenario = useMemo(() => scenarioOf(app), [app.mode, app.scenarioId, app.sandbox]);
  const analysis = useMemo(() => (app.design ? analyzeDesign(app.design, scenario, app.difficulty) : null), [app.design, scenario, app.difficulty]);
  const issues = useMemo(() => {
    if (!analysis) return [];
    const base = validateDesign(analysis);
    if (app.career.enabled && app.mode === 'campaign') {
      const owned = unlockedPartSet(app.career.nodes);
      const ids = [...analysis.placed.map((p) => p.part.id), analysis.design.vehicleId, analysis.design.frameId];
      const locked = [...new Set(ids)].filter((id) => !owned.has(id));
      if (locked.length) base.unshift({ id: 'locked-parts', severity: 'CRITICAL', title: 'Parts not yet unlocked', system: 'Programme', what: `These items are still locked in Programme mode: ${locked.map((id) => PARTS[id]?.name ?? id).join(', ')}.`, why: 'In Programme mode the agency only certifies hardware you have researched with Programme Credits.', consequence: 'The design cannot be approved for launch.', solutions: ['Unlock the technology in the Technology tree.', 'Replace the locked parts with certified ones.'], blocksLaunch: true });
    }
    return base;
  }, [analysis, app.career, app.mode]);
  return { app, scenario, analysis, issues };
}

export function go(screen: Screen) {
  setState({ screen });
  if (typeof document !== 'undefined') setTimeout(() => { document.querySelector('.content')?.scrollTo?.(0, 0); window.scrollTo?.(0, 0); }, 0);
}
export function toast(msg: string) { setState({ toast: msg }); setTimeout(() => { if (getState().toast === msg) setState({ toast: null }); }, 2600); }

export function logDecision(text: string, kind: Decision['kind'] = 'design') {
  const t = getState().team;
  if (!t.active) return;
  const d: Decision = { id: newId(), at: Date.now(), role: t.role === 'all' ? 'system' : t.role, author: t.name, text, kind };
  setState({ team: { ...t, decisions: [d, ...t.decisions].slice(0, 200) } });
  teamHooks.onDecision?.(d);
}
/** Hooks set by the team module (kept out of the store to avoid a cycle). */
export const teamHooks: { onDesign?: (d: Design) => void; onDecision?: (d: Decision) => void } = {};

export function updateDesign(fn: (d: Design) => Design, label?: string) {
  const cur = getState().design;
  if (!cur) return;
  const next = fn(cur);
  if (next === cur) return;
  setState({ design: next });
  if (label) logDecision(label);
  teamHooks.onDesign?.(next);
}

export function startCampaign(scenarioId: string, difficulty: Difficulty) {
  const sc = SCENARIO_MAP[scenarioId];
  setState({ mode: 'campaign', scenarioId, difficulty, design: emptyDesign(sc, `${sc.name} Mk I`), flight: null, mission: null, result: null, screen: 'briefing' });
  logDecision(`Started mission ${sc.name} (${difficulty})`);
}
export function startSandbox(settings: SandboxSettings, difficulty: Difficulty) {
  const sc = makeSandboxScenario(settings);
  setState({ mode: 'sandbox', sandbox: settings, difficulty, scenarioId: sc.id, design: emptyDesign(sc, `Sandbox ${settings.target} Mk I`), flight: null, mission: null, result: null, screen: 'workshop' });
}
export function applyRecommended() {
  const s = getState();
  if (!s.design) return;
  const sc = scenarioOf(s);
  const d = autoDesign(sc, s.difficulty, s.design.name);
  updateDesign(() => ({ ...d, id: s.design!.id }), 'Applied the guided baseline design');
  toast('Guided baseline applied. Edit anything you like.');
}

export function saveBlueprint(name?: string) {
  const s = getState();
  if (!s.design) return;
  const entry: SavedDesign = { id: newId(), name: name ?? s.design.name, scenarioId: s.mode === 'sandbox' ? s.scenarioId : s.design.scenarioId, difficulty: s.difficulty, design: { ...s.design, id: newId(), name: name ?? s.design.name }, savedAt: Date.now(), sandbox: s.mode === 'sandbox' ? s.sandbox : undefined };
  setState({ saved: [entry, ...s.saved] });
  toast(`Blueprint "${entry.name}" saved`);
}
export function loadBlueprint(id: string) {
  const s = getState();
  const e = s.saved.find((x) => x.id === id);
  if (!e) return;
  const isSandbox = !!e.sandbox;
  setState({ design: { ...e.design, id: newId() }, difficulty: e.difficulty, mode: isSandbox ? 'sandbox' : 'campaign', scenarioId: e.scenarioId, sandbox: e.sandbox ?? s.sandbox, flight: null, mission: null, result: null, screen: 'workshop' });
  toast(`Loaded "${e.name}"`);
}
export function deleteBlueprint(id: string) { setState((s) => ({ saved: s.saved.filter((x) => x.id !== id), compareIds: s.compareIds.filter((c) => c !== id) })); }
export function duplicateBlueprint(id: string) {
  const s = getState(); const e = s.saved.find((x) => x.id === id);
  if (!e) return;
  setState({ saved: [{ ...e, id: newId(), name: `${e.name} copy`, design: { ...e.design, id: newId(), name: `${e.name} copy` }, savedAt: Date.now() }, ...s.saved] });
}

export function beginMission(flight: FlightInput | null) {
  const s = getState();
  if (!s.design) return;
  const sc = scenarioOf(s);
  const m = createMission(s.design, sc, s.difficulty, s.seed, flight ?? undefined);
  setState({ mission: m, missionVersion: 0, result: null, flight, screen: 'control' });
  if (m.ended) finishMission();
}

export function finishMission() {
  const s = getState();
  const m = s.mission;
  if (!m) return;
  if (!m.ended) { m.ended = true; m.outcome = 'completed'; m.endReason = 'MISSION CONCLUDED by the director (ended early).'; m.phase = 'done'; m.log.push({ day: m.day, phase: 'done', kind: 'info', text: m.endReason }); }
  const score = scoreMission(m);
  const sc = scenarioOf(s);
  const rec: ExperimentRecord = { id: newId(), at: Date.now(), name: m.design.name, scenarioId: sc.id, seed: m.seed, score: score.total, rank: score.rank, massKg: m.a.mass.total, costM: m.a.cost.total, sciPoints: Object.values(m.points).reduce((x, y) => x + y, 0), outcome: m.outcome };
  const entry: LeaderboardEntry = { id: newId(), at: Date.now(), player: s.playerName, scenarioId: sc.id, scenarioName: sc.name, difficulty: s.difficulty, score: score.total, rank: score.rank, designName: m.design.name };
  const prevBest = s.career.best[sc.id] ?? 0;
  const credits = s.mode === 'campaign' ? creditsFor(score.total, prevBest) : 0;
  const career = s.mode === 'campaign' ? { ...s.career, credits: s.career.credits + (s.career.enabled ? credits : 0), best: { ...s.career.best, [sc.id]: Math.max(prevBest, score.total) } } : s.career;
  setState({
    career,
    result: { score, seed: m.seed, at: Date.now(), credits: s.career.enabled ? credits : undefined }, experiments: [rec, ...s.experiments].slice(0, 80),
    leaderboard: s.mode === 'campaign' ? [entry, ...s.leaderboard].sort((a, b) => b.score - a.score).slice(0, 100) : s.leaderboard,
    missionVersion: s.missionVersion + 1, screen: 'debrief',
    saved: s.saved.map((x) => (x.design.name === m.design.name && x.scenarioId === sc.id ? { ...x, lastScore: score.total } : x)),
  });
}

export function bumpMission() { setState((s) => ({ missionVersion: s.missionVersion + 1 })); }
export function newSeed() { setState((s) => ({ seed: (s.seed * 1103515245 + 12345) % 2147483647 })); }

export const ROLE_INFO: Record<RoleId, { label: string; blurb: string; edits: string[] }> = {
  director: { label: 'MISSION DIRECTOR', blurb: 'Objectives, budget, final decisions, launch approval.', edits: ['compression', 'launch'] },
  engineer: { label: 'SPACECRAFT ENGINEER', blurb: 'Structure, power, thermal, attitude control, propulsion.', edits: ['frame', 'solar', 'battery', 'thermal', 'adcs', 'computer', 'engine', 'tank'] },
  science: { label: 'SCIENCE OFFICER', blurb: 'Instruments, observation scheduling, science performance.', edits: ['instrument'] },
  flightops: { label: 'FLIGHT OPERATIONS OFFICER', blurb: 'Communications, orbit, launch vehicle, mission operations.', edits: ['antenna', 'transmitter', 'orbit', 'vehicle', 'stations'] },
};
export function canEdit(team: TeamState, what: string): boolean {
  if (!team.active || team.role === 'all') return true;
  return ROLE_INFO[team.role].edits.includes(what);
}

export function setCareerEnabled(on: boolean) { setState({ career: { ...getState().career, enabled: on } }); }
export function unlockNode(id: string) {
  const c = getState().career; const node = TECH_MAP[id];
  const chk = canUnlock(node, c.nodes, c.credits);
  if (!chk.ok) { toast(chk.why); return; }
  setState({ career: { ...c, credits: c.credits - node.cost, nodes: [...c.nodes, id] } });
  toast(`Unlocked: ${node.name}`);
}
export function resetCareer() { setState({ career: { enabled: getState().career.enabled, credits: 150, nodes: [], best: {} } }); }
/** True when Programme mode is on and the part has not been researched. */
export function partLocked(s: AppState, partId: string): boolean {
  return s.career.enabled && s.mode === 'campaign' && !unlockedPartSet(s.career.nodes).has(partId);
}
