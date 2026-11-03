// Visual theme, background-motion and text-size preferences. Stored per browser; the app renders fine when storage is unavailable.
import { useSyncExternalStore } from 'react';

export type ThemeId = 'console' | 'houston' | 'blueprint' | 'apollo';
export const THEMES: { id: ThemeId; name: string; hint: string }[] = [
  { id: 'console', name: 'Flight console', hint: 'Dark navy, DIN-style type' },
  { id: 'houston', name: 'Houston graphite', hint: 'Neutral dark, IBM Plex' },
  { id: 'blueprint', name: 'Blueprint paper', hint: 'Light, serif headings' },
  { id: 'apollo', name: 'Apollo era', hint: 'Warm olive and orange' },
];
/** Text-size steps: multiplier applied to every font size through the --ts CSS variable. */
export const TEXT_STEPS = [1, 1.12, 1.25, 1.4] as const;

interface ThemeState { theme: ThemeId; motion: boolean; textStep: number }
const KEY = 'mc-theme-v1';
let state: ThemeState = { theme: 'console', motion: true, textStep: 0 };
const listeners = new Set<() => void>();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<ThemeState>;
      if (p.theme && THEMES.some((t) => t.id === p.theme)) state.theme = p.theme;
      if (typeof p.motion === 'boolean') state.motion = p.motion;
      if (typeof p.textStep === 'number' && p.textStep >= 0 && p.textStep < TEXT_STEPS.length) state.textStep = Math.round(p.textStep);
    }
  } catch { /* storage unavailable */ }
  apply();
}
function apply() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.style.setProperty('--ts', String(TEXT_STEPS[state.textStep]));
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }
function emit() { listeners.forEach((l) => l()); }

export function setTheme(theme: ThemeId) { state = { ...state, theme }; apply(); save(); emit(); }
export function setMotion(motion: boolean) { state = { ...state, motion }; save(); emit(); }
export function setTextStep(step: number) { state = { ...state, textStep: Math.max(0, Math.min(TEXT_STEPS.length - 1, step)) }; apply(); save(); emit(); }
export function cycleTheme() { const i = THEMES.findIndex((t) => t.id === state.theme); setTheme(THEMES[(i + 1) % THEMES.length].id); }
export function useTheme(): ThemeState {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => state);
}
load();
