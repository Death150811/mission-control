// Earned achievements are remembered in this browser only.
import { useSyncExternalStore } from 'react';

export type Earned = Record<string, { at: number; mission: string }>;
const KEY = 'mc-achievements-v1';
let earned: Earned = {};
const listeners = new Set<() => void>();
try { const raw = localStorage.getItem(KEY); if (raw) earned = JSON.parse(raw) as Earned; } catch { /* storage unavailable */ }

/** Remember the ids; returns those that were not earned before. */
export function recordAchievements(ids: string[], mission: string): string[] {
  const fresh = ids.filter((id) => !earned[id]);
  if (!fresh.length) return [];
  earned = { ...earned, ...Object.fromEntries(fresh.map((id) => [id, { at: Date.now(), mission }])) };
  try { localStorage.setItem(KEY, JSON.stringify(earned)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
  return fresh;
}
export function useEarned(): Earned {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => earned);
}
