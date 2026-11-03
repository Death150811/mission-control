import { BOOSTERS, STAGES } from '../data/launchVehicles';
import type { FlightState } from '../engine/flightSim';
import { stackDv } from '../engine/launch';
import type { LaunchVehicle } from '../types';

export function boosterInfo(v: LaunchVehicle): { type: string; count: number } | null {
  const m = /^cb:.*:(sb-[smh])x(\d+)$/.exec(v.stageIds[0]);
  return m ? { type: m[1], count: Number(m[2]) } : null;
}

/** Vehicle-assembly style stack diagram with staging list. Pass `flight` for a live staging HUD. */
export default function RocketStack({ v, payloadKg, flight }: { v: LaunchVehicle; payloadKg: number; flight?: FlightState | null }) {
  const s1 = STAGES[v.stageIds[0]], s2 = STAGES[v.stageIds[1]];
  const dv = stackDv(v, payloadKg);
  const bo = boosterInfo(v);
  const h1 = 70 + 90 * Math.sqrt(s1.propKg / 1.6e6) * 2.2, h2 = 44 + 70 * Math.sqrt(s2.propKg / 3.3e5) * 1.6;
  const H1 = Math.min(150, h1), H2 = Math.min(100, h2);
  const W = 220, cx = 74;
  const w1 = 44, w2 = 40;
  const top = 18, fairH = 56;
  const y2 = top + fairH, y1 = y2 + H2 + 8;
  const total = y1 + H1 + 30;
  const frac = (i: 0 | 1) => (flight ? flight.prop[i] / STAGES[v.stageIds[i]].propKg : 1);
  const detached = flight ? !flight.attached[0] : false;
  const fairingOn = flight ? flight.fairing : true;
  const active = flight ? flight.stage : -1;
  const body = (x: number, y: number, w: number, h: number, f: number, activeNow: boolean, gone: boolean) => (
    <g opacity={gone ? 0.15 : 1}>
      <rect x={x} y={y} width={w} height={h} fill="#e9edf2" stroke={activeNow ? '#fc3d21' : '#6d7785'} strokeWidth={activeNow ? 2.5 : 1} />
      <rect x={x + 2} y={y + h - (h - 4) * f - 2} width={w - 4} height={(h - 4) * f} fill="#0b3d91" opacity="0.9" />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${W} ${total}`} style={{ width: '100%', maxWidth: 260, height: 'auto' }} role="img" aria-label="Launch vehicle stack and staging list">
      {fairingOn && <g><path d={`M${cx - w2 / 2} ${y2} L${cx - w2 / 2} ${top + 20} Q${cx} ${top - 8} ${cx + w2 / 2} ${top + 20} L${cx + w2 / 2} ${y2} Z`} fill="#f2f4f7" stroke="#6d7785" /><path d={`M${cx - w2 / 2} ${top + 20} Q${cx} ${top - 8} ${cx + w2 / 2} ${top + 20} Z`} fill="#fc3d21" /><rect x={cx - 8} y={top + 28} width={16} height={22} fill="#0b3d91" opacity="0.5" /></g>}
      {!fairingOn && <rect x={cx - 8} y={y2 - 24} width={16} height={22} fill="#0b3d91" stroke="#fff" />}
      {body(cx - w2 / 2, y2, w2, H2, frac(1), active === 1, false)}
      <rect x={cx - w2 / 2 - 1} y={y2 + H2} width={w2 + 2} height={8} fill="#a5aeba" />
      {body(cx - w1 / 2, y1, w1, H1, frac(0), active === 0, detached)}
      {bo && [-1, 1].map((sd) => (
        <g key={sd} opacity={detached ? 0.15 : 1}>
          <rect x={cx + sd * (w1 / 2 + 8) - 8} y={y1 + 14} width={16} height={H1 - 14} fill="#fc3d21" stroke="#7a1a0d" />
          <path d={`M${cx + sd * (w1 / 2 + 8) - 8} ${y1 + 14} Q${cx + sd * (w1 / 2 + 8)} ${y1} ${cx + sd * (w1 / 2 + 8) + 8} ${y1 + 14}`} fill="#fc3d21" />
        </g>
      ))}
      {bo && bo.count > 2 && <text x={cx} y={y1 + H1 + 14} textAnchor="middle" fill="#ffb000" fontSize="9" fontFamily="monospace">{bo.count} strap-ons</text>}
      {[0, 1, 2].map((i) => <rect key={i} x={cx - 14 + i * 10} y={y1 + H1} width={8} height={10} fill="#6d7785" opacity={detached ? 0.15 : 1} />)}
      <g fontFamily="Consolas, monospace" fontSize="9.5" fill="#a5aeba">
        <text x={W - 118} y={top + 14} fill="#ffb000">PAYLOAD</text><text x={W - 118} y={top + 26}>{Math.round(payloadKg).toLocaleString('en-US')} kg</text>
        <text x={W - 118} y={y2 + 14} fill="#fff">STAGE 2{active === 1 ? '  ◂ ACTIVE' : ''}</text><text x={W - 118} y={y2 + 26}>dv {Math.round(dv.stage2)} m/s</text><text x={W - 118} y={y2 + 38}>{s2.restart ? 'restartable' : 'single burn'}</text>
        <text x={W - 118} y={y1 + 14} fill="#fff">STAGE 1{active === 0 ? '  ◂ ACTIVE' : ''}</text><text x={W - 118} y={y1 + 26}>dv {Math.round(dv.stage1)} m/s</text><text x={W - 118} y={y1 + 38}>TWR {dv.twr.toFixed(2)}</text><text x={W - 118} y={y1 + 50}>{Math.round(s1.thrustSL / 1000).toLocaleString('en-US')} kN</text>
        <text x={W - 118} y={total - 4} fill="#fff">Σ dv {Math.round(dv.total)} m/s</text>
      </g>
    </svg>
  );
}

export { BOOSTERS };
