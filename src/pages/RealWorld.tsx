import { useState } from 'react';
import { Badge, Panel, Tabs, n0, n1 } from '../components/ui';
import { LAUNCH_VEHICLES } from '../data/launchVehicles';
import { SCENARIO_MAP } from '../data/missions';
import { DV_EDGES, DV_NODES, DV_ROUTES, REAL_LAUNCHERS, REAL_MISSIONS, routeEdges, routeTotal } from '../data/realWorld';
import { ascentDv, payloadCapacityKg } from '../engine/launch';
import { defaultSelection, describeOrbit } from '../engine/orbitalMechanics';
import { useCurrent } from '../store/store';

type Tab = 'dv' | 'launchers' | 'missions';

function DvMap({ routeId, onRoute }: { routeId: string; onRoute: (id: string) => void }) {
  const route = DV_ROUTES.find((r) => r.id === routeId) ?? DV_ROUTES[0];
  const onPath = new Set(route.path);
  const edgeOn = (f: string, t: string) => route.path.some((p, i) => p === f && route.path[i + 1] === t);
  const node = (id: string) => DV_NODES.find((n) => n.id === id)!;
  return (
    <svg viewBox="0 0 860 540" style={{ width: '100%', height: 'auto', display: 'block', background: 'var(--deep)', border: '1px solid var(--line)' }} role="img" aria-label="Delta-v map between Earth, Moon, Mars, asteroids and L2">
      {DV_EDGES.map((e) => {
        const a = node(e.from), b = node(e.to), on = edgeOn(e.from, e.to);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        return (
          <g key={e.from + e.to}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? 'var(--red)' : 'var(--line2)'} strokeWidth={on ? 6 : 4} strokeLinecap="round" opacity={on ? 1 : 0.55} />
            <rect x={mx - 27} y={my - 13} width={54} height={26} rx={13} fill={on ? 'var(--red)' : 'var(--panel2)'} stroke={on ? 'var(--red)' : 'var(--line2)'} />
            <text x={mx} y={my + 5} textAnchor="middle" fontSize="15" fontFamily="var(--mono)" fontWeight="700" fill={on ? '#fff' : 'var(--text)'}>{e.dv}</text>
          </g>
        );
      })}
      {DV_NODES.map((n) => (
        <g key={n.id} style={{ cursor: 'default' }}>
          <circle cx={n.x} cy={n.y} r={on(n.id) ? 12 : 9} fill={on(n.id) ? 'var(--hi)' : 'var(--panel3)'} stroke={on(n.id) ? 'var(--red)' : 'var(--line2)'} strokeWidth="3" />
          <text x={n.x} y={n.y - 20} textAnchor="middle" fontSize="15.5" fontWeight="700" fill={on(n.id) ? 'var(--text)' : 'var(--muted)'}>{n.label}</text>
        </g>
      ))}
      <text x={20} y={28} fontSize="14" fill="var(--muted)" fontFamily="var(--mono)">Δv in km/s · rounded values · click a route below</text>
    </svg>
  );
  function on(id: string) { return onPath.has(id); }
  void onRoute;
}

export default function RealWorld() {
  const { analysis: a } = useCurrent();
  const [tab, setTab] = useState<Tab>('dv');
  const [routeId, setRouteId] = useState('moon-orbit');
  const route = DV_ROUTES.find((r) => r.id === routeId) ?? DV_ROUTES[0];
  const edges = routeEdges(route.path);
  const total = routeTotal(route.path);

  // game numbers for the same destination, when the current design aims there
  const game = a && route.scenario && a.scenario.id === route.scenario
    ? { ascent: ascentDv(a.orbit.incDeg) / 1000, parking: a.orbit.launchParkingDvMps / 1000, insertion: a.orbit.insertionDvMps / 1000 } : null;

  const leo = describeOrbit(defaultSelection('leo'));
  const maxLeo = Math.max(...REAL_LAUNCHERS.map((l) => l.leoKg));
  const bar = (kg: number) => `${Math.max(1.5, (Math.log10(kg) - Math.log10(50)) / (Math.log10(maxLeo) - Math.log10(50)) * 100)}%`;

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row">
        <div><h1>Real data</h1><div className="muted">Rounded figures from public mission and launch-provider documentation, for comparing with the game's illustrative numbers.</div></div>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'dv', label: 'Delta-v map' }, { id: 'launchers', label: 'Real launchers' }, { id: 'missions', label: 'Real missions' }]} />

      {tab === 'dv' && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 340px)', gap: 12, alignItems: 'start' }}>
          <div className="col" style={{ gap: 8 }}>
            <DvMap routeId={routeId} onRoute={setRouteId} />
            <div className="chips">{DV_ROUTES.map((r) => <button key={r.id} className={`chip ${r.id === routeId ? 'on' : ''}`} onClick={() => setRouteId(r.id)}>{r.label}</button>)}</div>
          </div>
          <div className="col" style={{ gap: 10 }}>
            <Panel title={`${route.label}: ${n1(total)} km/s from the ground`}>
              <table className="tbl"><tbody>
                {edges.map((e) => <tr key={e.from + e.to}><td>{DV_NODES.find((n) => n.id === e.from)!.label} → {DV_NODES.find((n) => n.id === e.to)!.label}{e.note && <div className="dim" style={{ fontSize: 'calc(12px * var(--ts, 1))' }}>{e.note}</div>}</td><td className="num"><b>{e.dv}</b> km/s</td></tr>)}
                <tr><td><b>Total</b></td><td className="num"><b>{n1(total)}</b> km/s</td></tr>
              </tbody></table>
            </Panel>
            {game ? (
              <Panel title="Your design against this route">
                <table className="tbl"><tbody>
                  <tr><td>Ascent to 200 km</td><td className="num">{n1(game.ascent)} km/s <span className="dim">(real 9.4)</span></td></tr>
                  <tr><td>Launcher: parking → destination</td><td className="num">{n1(game.parking)} km/s</td></tr>
                  <tr><td>Spacecraft: orbit insertion</td><td className="num">{n1(game.insertion)} km/s</td></tr>
                  <tr><td><b>Game total</b></td><td className="num"><b>{n1(game.ascent + game.parking + game.insertion)}</b> km/s</td></tr>
                  <tr><td><b>Real map total</b></td><td className="num"><b>{n1(total)}</b> km/s</td></tr>
                </tbody></table>
                <div className="dim" style={{ fontSize: 'calc(12px * var(--ts, 1))', marginTop: 6 }}>The game's numbers track the real map to within a few percent; differences come from the exact orbit you chose.</div>
              </Panel>
            ) : <div className="note" style={{ fontSize: 'calc(13px * var(--ts, 1))' }}>Start the scenario that matches a route (for example Lunar Explorer for “Lunar orbit”) to compare your design's numbers with this map.</div>}
            <div className="note" style={{ fontSize: 'calc(13px * var(--ts, 1))' }}>Why a map of Δv and not distance? Rocket fuel pays for velocity change, not for kilometres: the mass you must carry grows exponentially with every km/s (Tsiolkovsky). Real mission designers plan with exactly this kind of chart.</div>
          </div>
        </div>
      )}

      {tab === 'launchers' && (
        <div className="col" style={{ gap: 12 }}>
          <Panel title="Payload to low Earth orbit (log scale)">
            <div className="col" style={{ gap: 6 }}>
              {LAUNCH_VEHICLES.filter((v) => v.classes.includes('direct')).map((v) => {
                const kg = payloadCapacityKg(v, leo);
                return kg > 0 ? <div key={v.id} className="row" style={{ gap: 10 }}><div style={{ width: 150, fontSize: 'calc(13px * var(--ts, 1))' }}><b>{v.name}</b> <span className="dim">game</span></div><div style={{ flex: 1, background: 'var(--deep)', height: 14 }}><div style={{ width: bar(kg), height: '100%', background: 'var(--amber)' }} /></div><div className="mono" style={{ width: 84, textAlign: 'right', fontSize: 'calc(13px * var(--ts, 1))' }}>{n0(kg)} kg</div></div> : null;
              })}
              {[...REAL_LAUNCHERS].sort((x, y) => x.leoKg - y.leoKg).map((l) => (
                <div key={l.id} className="row" style={{ gap: 10 }}><div style={{ width: 150, fontSize: 'calc(13px * var(--ts, 1))' }}><b>{l.name}</b> <span className="dim">{l.first}</span></div><div style={{ flex: 1, background: 'var(--deep)', height: 14 }}><div style={{ width: bar(l.leoKg), height: '100%', background: 'var(--blue2)' }} /></div><div className="mono" style={{ width: 84, textAlign: 'right', fontSize: 'calc(13px * var(--ts, 1))' }}>{n0(l.leoKg)} kg</div></div>
              ))}
            </div>
            <div className="dim" style={{ fontSize: 'calc(12px * var(--ts, 1))', marginTop: 8 }}>Amber bars: the game's launchers to a 550 km LEO. Blue bars: real rockets (maximum published figures, often for expendable flights).</div>
          </Panel>
          <Panel title="Details">
            <table className="tbl"><thead><tr><th>Launcher</th><th>Maker</th><th className="num">First flight</th><th className="num">Height</th><th className="num">Lift-off mass</th><th className="num">LEO</th><th className="num">Higher energy</th></tr></thead><tbody>
              {REAL_LAUNCHERS.map((l) => <tr key={l.id}><td><b>{l.name}</b><div className="dim" style={{ fontSize: 'calc(12px * var(--ts, 1))' }}>{l.note}</div></td><td>{l.maker}</td><td className="num">{l.first}</td><td className="num">{l.heightM} m</td><td className="num">{n0(l.liftoffT)} t</td><td className="num">{n0(l.leoKg)} kg</td><td className="num">{l.hiKg ? `${n0(l.hiKg)} kg ${l.hiLabel}` : '—'}</td></tr>)}
            </tbody></table>
          </Panel>
        </div>
      )}

      {tab === 'missions' && (
        <div className="grid g2" style={{ gap: 10 }}>
          {REAL_MISSIONS.map((m) => {
            const sc = m.analog ? SCENARIO_MAP[m.analog] : null;
            return (
              <div key={m.id} className="panel" style={{ padding: 12 }}>
                <div className="row"><h2 style={{ flex: 1 }}>{m.name}</h2><Badge>{m.year}</Badge></div>
                <div className="dim" style={{ fontSize: 'calc(13px * var(--ts, 1))', marginBottom: 6 }}>{m.agency} · {m.target}</div>
                <dl className="kv">
                  <dt>Launch mass</dt><dd>{n0(m.massKg)} kg</dd>
                  <dt>Orbit</dt><dd>{m.orbit}</dd>
                  <dt>Payload</dt><dd>{m.payload}</dd>
                  {m.cost && <><dt>Cost</dt><dd>{m.cost}</dd></>}
                </dl>
                <div className="note" style={{ fontSize: 'calc(13px * var(--ts, 1))', marginTop: 8 }}><b>Lesson.</b> {m.lesson}</div>
                {sc && <div className="dim" style={{ fontSize: 'calc(12px * var(--ts, 1))', marginTop: 6 }}>Game analogue: <b>{sc.name}</b> (limit {n0(sc.maxMassKg)} kg, budget ${n0(sc.budgetM)}M)</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
