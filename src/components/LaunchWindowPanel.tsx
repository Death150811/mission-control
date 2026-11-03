import { useRef } from 'react';
import { DAYS_PER_MONTH, STANDBY_M_PER_MONTH, c3AtDay, nextOpenDay, windowCentres, windowCurve, windowHalfWidthD, windowQ } from '../engine/launchWindows';
import { payloadCapacityKg } from '../engine/launch';
import { clampSelection } from '../engine/orbitalMechanics';
import { canEdit, toast, updateDesign, useCurrent } from '../store/store';
import { Badge, Panel, n0, n1 } from './ui';

const VW = 780, VH = 230, ML = 46, MR = 14, MT = 16, MB = 34;

/** Launch-window planner for interplanetary targets: C3 versus departure date, with the programme's own ready date and deadline. */
export default function LaunchWindowPanel() {
  const { app, analysis: a } = useCurrent();
  const svg = useRef<SVGSVGElement>(null);
  if (!a || !app.design) return null;
  const def = a.orbit.def, w = def.window;
  if (!w || a.orbit.departDay === undefined) return null;
  const can = canEdit(app.team, 'orbit');
  const day = a.orbit.departDay;
  const readyDay = Math.ceil(a.schedule.readyMonths * DAYS_PER_MONTH);
  const deadlineDay = Math.round(a.schedule.deadline * DAYS_PER_MONTH);
  const xMax = Math.max(Math.ceil((w.bestDay + w.periodD * 1.15) / 60) * 60, deadlineDay + 60);
  const half = windowHalfWidthD(w);
  const c3Max = ((def.c3 ?? 0) + w.spanC3) / 1e6;
  const yMax = Math.ceil(c3Max / 10) * 10;
  const X = (d: number) => ML + (d / xMax) * (VW - ML - MR);
  const Y = (c3km: number) => MT + (1 - c3km / yMax) * (VH - MT - MB);
  const curve = windowCurve(def, 0, xMax, 5);
  const path = curve.map((p, i) => `${i ? 'L' : 'M'}${X(p.day).toFixed(1)} ${Y(p.c3 / 1e6).toFixed(1)}`).join(' ');
  const centres = windowCentres(w, xMax + w.periodD);
  const setDay = (v: number, note?: string) => {
    if (!can) { toast('The launch date belongs to the Flight Operations Officer.'); return; }
    updateDesign((x) => ({ ...x, orbit: clampSelection({ ...x.orbit, departDay: Math.round(v) }) }), note ?? `Launch day ${Math.round(v)}`);
  };
  const onChart = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * VW;
    setDay(Math.max(0, Math.min(xMax, ((px - ML) / (VW - ML - MR)) * xMax)));
  };
  const q = windowQ(w, day);
  const inWindow = Math.abs(((day - w.bestDay + w.periodD / 2) % w.periodD + w.periodD) % w.periodD - w.periodD / 2) <= half;
  const notReady = day < readyDay;
  const late = day > deadlineDay;
  const cap = payloadCapacityKg(a.vehicle, a.orbit);
  const tone = notReady || late || q > 0.7 ? 'rd' : q > 0.35 || !inWindow ? 'or' : 'gr';
  const monthTicks: number[] = []; for (let m = 0; m * DAYS_PER_MONTH <= xMax; m += 6) monthTicks.push(m);
  return (
    <Panel title={`Launch window · ${def.short} · synodic period ${n0(w.periodD)} days`} right={<Badge tone={tone}>{notReady ? 'NOT READY' : late ? 'AFTER DEADLINE' : inWindow ? 'INSIDE WINDOW' : q > 0.7 ? 'WORST DATES' : 'OFF-WINDOW'}</Badge>}>
      <div className="muted" style={{ marginBottom: 6 }}>
        Earth and {def.short} line up for a cheap transfer only once per synodic period. Click the chart or use the buttons: the departure energy (C3) sets how much the launcher can lift and how hard the capture burn will be.
      </div>
      <svg ref={svg} viewBox={`0 0 ${VW} ${VH}`} style={{ width: '100%', height: 'auto', cursor: can ? 'crosshair' : 'default', display: 'block' }} onClick={onChart} role="img" aria-label="Departure energy versus launch day">
        <rect x={ML} y={MT} width={VW - ML - MR} height={VH - MT - MB} fill="rgba(255,255,255,0.02)" stroke="var(--line)" />
        {centres.map((c) => <rect key={c} x={X(Math.max(0, c - half))} y={MT} width={Math.max(0, X(Math.min(xMax, c + half)) - X(Math.max(0, c - half)))} height={VH - MT - MB} fill="rgba(63,207,107,0.16)" />)}
        {[0, 10, 20, 30, 40, 50].filter((t) => t <= yMax).map((t) => <g key={t}><line x1={ML} x2={VW - MR} y1={Y(t)} y2={Y(t)} stroke="var(--line)" strokeDasharray="2 4" /><text x={ML - 6} y={Y(t) + 3} textAnchor="end" fontSize="10" fill="var(--dim)" fontFamily="var(--mono)">{t}</text></g>)}
        {monthTicks.map((m) => <g key={m}><line x1={X(m * DAYS_PER_MONTH)} x2={X(m * DAYS_PER_MONTH)} y1={VH - MB} y2={VH - MB + 4} stroke="var(--line2)" /><text x={X(m * DAYS_PER_MONTH)} y={VH - MB + 15} textAnchor="middle" fontSize="10" fill="var(--dim)" fontFamily="var(--mono)">{m}</text></g>)}
        <text x={(ML + VW - MR) / 2} y={VH - 4} textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--mono)">months from programme start</text>
        <text x={12} y={(MT + VH - MB) / 2} fontSize="10" fill="var(--muted)" fontFamily="var(--mono)" transform={`rotate(-90 12 ${(MT + VH - MB) / 2})`} textAnchor="middle">C3 km²/s²</text>
        <path d={path} fill="none" stroke="var(--blue-lt)" strokeWidth="2" />
        <line x1={X(readyDay)} x2={X(readyDay)} y1={MT} y2={VH - MB} stroke="var(--amber)" strokeWidth="1.5" />
        <text x={X(readyDay) - 4} y={MT + 11} textAnchor="end" fontSize="10" fill="var(--amber)" fontFamily="var(--mono)">ready</text>
        <line x1={X(deadlineDay)} x2={X(deadlineDay)} y1={MT} y2={VH - MB} stroke="var(--red)" strokeWidth="1.5" strokeDasharray="5 3" />
        <text x={X(deadlineDay) + 4} y={MT + 11} fontSize="10" fill="var(--red)" fontFamily="var(--mono)">deadline</text>
        <line x1={X(day)} x2={X(day)} y1={MT} y2={VH - MB} stroke="#fff" strokeWidth="2" />
        <circle cx={X(day)} cy={Y(c3AtDay(def, day) / 1e6)} r="5" fill="#fff" stroke="var(--red)" strokeWidth="2" />
      </svg>
      <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <button className="btn sm primary" disabled={!can} onClick={() => setDay(nextOpenDay(w, readyDay), 'Launch at the earliest open date')}>Earliest ready date in a window</button>
        <button className="btn sm" disabled={!can} onClick={() => setDay(w.bestDay + Math.max(0, Math.round((readyDay - w.bestDay) / w.periodD)) * w.periodD, 'Launch at the window centre')}>Nearest window centre</button>
        <button className="btn sm" disabled={!can} onClick={() => setDay(nextOpenDay(w, day + half * 2 + 1), 'Launch in the next window')}>Next window</button>
        <input type="range" min={0} max={xMax} step={1} value={day} disabled={!can} onChange={(e) => setDay(Number(e.target.value))} style={{ flex: 1, minWidth: 160 }} aria-label="Launch day" />
      </div>
      <dl className="kv" style={{ marginTop: 8 }}>
        <dt>Launch date</dt><dd>day {n0(day)} · month {n1(day / DAYS_PER_MONTH)}</dd>
        <dt>Programme ready</dt><dd className={notReady ? 'rd' : ''}>day {n0(readyDay)} · month {n1(a.schedule.readyMonths)}{notReady ? ' (too late for this date)' : ''}</dd>
        <dt>Deadline</dt><dd className={late ? 'rd' : ''}>day {n0(deadlineDay)} · month {a.schedule.deadline}</dd>
        <dt>Departure C3</dt><dd>{n1(a.orbit.c3Eff / 1e6)} km²/s² <span className="dim">(best {n1((def.c3 ?? 0) / 1e6)})</span></dd>
        <dt>Launcher: parking → departure</dt><dd>{n0(a.orbit.launchParkingDvMps)} m/s</dd>
        <dt>Capacity of {a.vehicle.name}</dt><dd className={cap < a.mass.total ? 'rd' : ''}>{n0(cap)} kg <span className="dim">(spacecraft {n0(a.mass.total)} kg)</span></dd>
        <dt>Spacecraft: arrival burn</dt><dd>{n0(a.orbit.insertionDvMps)} m/s</dd>
        <dt>Standby while waiting</dt><dd>{n1(a.schedule.waitMonths)} mo · ${n1(a.cost.standby)}M <span className="dim">(${STANDBY_M_PER_MONTH}M/mo)</span></dd>
      </dl>
    </Panel>
  );
}
