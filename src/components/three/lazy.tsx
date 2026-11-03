// The three.js scenes (and three.js itself, ~500 kB) load only when a screen that needs them opens.
import { Suspense, lazy, type ComponentProps } from 'react';

const Spacecraft = lazy(() => import('./SpacecraftScene'));
const Orbit = lazy(() => import('./OrbitScene'));
const Rocket = lazy(() => import('./RocketScene'));

function Loading({ height }: { height: number }) {
  return <div className="note" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="mono dim">Loading 3D view…</span></div>;
}

export function SpacecraftSceneLazy(p: ComponentProps<typeof Spacecraft>) { return <Suspense fallback={<Loading height={p.height ?? 520} />}><Spacecraft {...p} /></Suspense>; }
export function OrbitSceneLazy(p: ComponentProps<typeof Orbit>) { return <Suspense fallback={<Loading height={p.height ?? 380} />}><Orbit {...p} /></Suspense>; }
export function RocketSceneLazy(p: ComponentProps<typeof Rocket>) { return <Suspense fallback={<Loading height={p.height ?? 460} />}><Rocket {...p} /></Suspense>; }
