import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Panel, Stat, n0, n1 } from '../components/ui';
import { LAUNCH_VEHICLES } from '../data/launchVehicles';
import { PARTS } from '../data/spacecraftComponents';
import { BRANCHES, TECH_MAP, TECH_NODES, canUnlock, dependentsOf, prerequisitesOf, type Branch, type TechNode } from '../data/techTree';
import { go, resetCareer, setCareerEnabled, unlockNode, useApp } from '../store/store';

const NW = 236, NH = 70, GAP = 14, LANE_PAD = 16;
const colX = (t: number) => 190 + (t - 1) * 330;
const LANES: Branch[] = ['sensing', 'power', 'comms', 'avionics', 'thermal', 'propulsion', 'structures', 'launch'];

const nameOf = (id: string) => PARTS[id]?.name ?? LAUNCH_VEHICLES.find((v) => v.id === id)?.name ?? (id === 'lv-custom' ? 'Custom stack builder + boosters' : id);
const statOf = (id: string) => { const p = PARTS[id]; return p ? `${n1(p.massKg)} kg · $${n1(p.costM)}M${p.powerW ? ` · ${n0(p.powerW)} W` : ''}` : ''; };

function layoutTree() {
  const pos: Record<string, { x: number; y: number }> = {};
  const rects: { b: Branch; y: number; h: number }[] = [];
  let y = 36;
  for (const b of LANES) {
    const byTier: Record<number, TechNode[]> = {};
    TECH_NODES.filter((n) => n.branch === b).forEach((n) => (byTier[n.tier] ||= []).push(n));
    const rows = Math.max(1, ...Object.values(byTier).map((a) => a.length));
    const h = rows * (NH + GAP) - GAP + LANE_PAD * 2;
    rects.push({ b, y, h });
    for (const t of Object.keys(byTier)) byTier[+t].forEach((n, i) => { pos[n.id] = { x: colX(+t), y: y + LANE_PAD + i * (NH + GAP) }; });
    y += h + 8;
  }
  return { pos, rects, width: colX(4) + NW + 60, height: y + 8 };
}

function dependentsDeep(id: string, seen = new Set<string>()): string[] {
  const out: string[] = [];
  for (const d of dependentsOf(id)) if (!seen.has(d)) { seen.add(d); out.push(d, ...dependentsDeep(d, seen)); }
  return out;
}

export default function TechTree() {
  const app = useApp();
  const c = app.career;
  const L = useMemo(layoutTree, []);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [off, setOff] = useState<Set<Branch>>(new Set());
  const [view, setView] = useState<'graph' | 'list'>('graph');
  const [cam, setCam] = useState({ x: 0, y: 0, k: 0.8 });
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);

  const fit = () => {
    const el = box.current; if (!el) return;
    const k = Math.min(1.1, Math.max(0.45, el.clientWidth / L.width));
    setCam({ k, x: Math.max(0, (el.clientWidth - L.width * k) / 2), y: 6 });
  };
  useEffect(() => { fit(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [view]);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
        setCam((cm) => { const k = Math.min(2, Math.max(0.35, cm.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); const s = k / cm.k; return { k, x: mx - (mx - cm.x) * s, y: my - (my - cm.y) * s }; });
      } else setCam((cm) => ({ ...cm, x: cm.x - e.deltaX - (e.shiftKey ? e.deltaY : 0), y: cm.y - (e.shiftKey ? 0 : e.deltaY) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [view]);

  const owned = new Set(c.nodes);
  const status = (n: TechNode): 'owned' | 'ready' | 'saving' | 'locked' => {
    if (owned.has(n.id)) return 'owned';
    if (!n.requires.every((r) => owned.has(r))) return 'locked';
    return c.credits >= n.cost ? 'ready' : 'saving';
  };
  const chain = useMemo(() => {
    if (!sel) return null;
    return new Set([sel, ...prerequisitesOf(sel), ...dependentsDeep(sel)]);
  }, [sel]);
  const match = (n: TechNode) => {
    const t = q.trim().toLowerCase();
    if (off.has(n.branch)) return false;
    if (!t) return true;
    return n.name.toLowerCase().includes(t) || n.blurb.toLowerCase().includes(t) || n.unlocks.some((u) => nameOf(u).toLowerCase().includes(t));
  };
  const selected = sel ? TECH_MAP[sel] : null;
  const toggleBranch = (b: Branch) => setOff((s) => { const nx = new Set(s); if (nx.has(b)) nx.delete(b); else nx.add(b); return nx; });
  const colorOf = (n: TechNode) => BRANCHES[n.branch].color;
  const readyCount = TECH_NODES.filter((n) => status(n) === 'ready').length;

  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { const d = drag.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true; if (d.moved) setCam((cm) => ({ ...cm, x: d.cx + dx, y: d.cy + dy })); };
  const onUp = () => { const d = drag.current; drag.current = null; if (d && !d.moved) setSel(null); };
  const focusNode = (id: string) => {
    setSel(id); const el = box.current; const p = L.pos[id]; if (!el || !p) return;
    setCam((cm) => ({ ...cm, x: el.clientWidth / 2 - (p.x + NW / 2) * cm.k, y: el.clientHeight / 2 - (p.y + NH / 2) * cm.k }));
  };

  const chk = selected ? canUnlock(selected, c.nodes, c.credits) : null;
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row">
        <div><h1>Technology tree</h1><div className="muted">Research with Programme Credits. Drag or scroll to pan, Ctrl+wheel to zoom, click a node for its real-world analogue and what it unlocks.</div></div>
        <span className="spacer" />
        <button className="btn" onClick={() => go('select')}>Missions →</button>
      </div>
      <div className="grid g4">
        <Stat label="Programme credits" value={n0(c.credits)} tone="or" sub="earned = score / 8 + bonuses" />
        <Stat label="Researched" value={`${c.nodes.length} / ${TECH_NODES.length}`} sub={`${readyCount} ready to research now`} />
        <Stat label="Programme mode" value={c.enabled ? 'ON' : 'OFF'} tone={c.enabled ? 'gr' : undefined} sub={c.enabled ? 'locked parts are blocked' : 'everything available'} />
        <Stat label="Best scores" value={Object.keys(c.best).length} sub="missions flown in campaign" />
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input type="text" placeholder="Search technologies or parts…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} aria-label="Search technologies" />
        <div className="chips">
          {LANES.map((b) => <button key={b} className={`chip ${off.has(b) ? '' : 'on'}`} style={{ borderColor: BRANCHES[b].color }} onClick={() => toggleBranch(b)} aria-pressed={!off.has(b)}><span style={{ display: 'inline-block', width: 8, height: 8, background: BRANCHES[b].color, marginRight: 5 }} />{BRANCHES[b].label}</button>)}
        </div>
        <span className="spacer" />
        <div className="chips"><button className={`chip ${view === 'graph' ? 'on' : ''}`} onClick={() => setView('graph')}>Graph</button><button className={`chip ${view === 'list' ? 'on' : ''}`} onClick={() => setView('list')}>List</button></div>
        <label className="row"><input type="checkbox" checked={c.enabled} onChange={(e) => setCareerEnabled(e.target.checked)} /> Programme mode</label>
        <button className="btn sm danger" onClick={resetCareer}>Reset</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)', alignItems: 'start', gap: 12 }}>
        {view === 'graph' ? (
          <div className="panel" style={{ position: 'relative', height: 660, overflow: 'hidden' }}>
            <div className="row" style={{ position: 'absolute', right: 8, top: 8, zIndex: 3, gap: 4 }}>
              <button className="btn sm" onClick={() => setCam((cm) => ({ ...cm, k: Math.min(2, cm.k * 1.2) }))} aria-label="Zoom in">＋</button>
              <button className="btn sm" onClick={() => setCam((cm) => ({ ...cm, k: Math.max(0.35, cm.k / 1.2) }))} aria-label="Zoom out">－</button>
              <button className="btn sm" onClick={fit}>Fit</button>
            </div>
            <div className="dim mono" style={{ position: 'absolute', left: 10, bottom: 6, fontSize: 'calc(11.5px * var(--ts, 1))', zIndex: 3, pointerEvents: 'none' }}>drag or wheel: pan · ctrl+wheel or ＋/－: zoom · click: select · double-click: research</div>
            <div ref={box} style={{ position: 'absolute', inset: 0, cursor: drag.current ? 'grabbing' : 'grab', touchAction: 'none', background: 'var(--deep)' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { drag.current = null; }}>
              <svg width="100%" height="100%" style={{ display: 'block' }}>
                <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.k})`}>
                  {L.rects.map((r, i) => (
                    <g key={r.b} opacity={off.has(r.b) ? 0.3 : 1}>
                      <rect x={0} y={r.y} width={L.width} height={r.h} fill={i % 2 ? 'rgba(128,140,160,0.05)' : 'rgba(128,140,160,0.09)'} />
                      <rect x={0} y={r.y} width={5} height={r.h} fill={BRANCHES[r.b].color} />
                      <text x={16} y={r.y + 22} fontSize="13" fontWeight="700" fill={BRANCHES[r.b].color} style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>{BRANCHES[r.b].label}</text>
                    </g>
                  ))}
                  {[1, 2, 3, 4].map((t) => <text key={t} x={colX(t) + NW / 2} y={20} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--muted)" style={{ letterSpacing: '0.16em' }}>TIER {t}</text>)}
                  {TECH_NODES.flatMap((n) => n.requires.map((r) => {
                    const a = L.pos[r], b = L.pos[n.id];
                    const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2;
                    const on = !chain || (chain.has(r) && chain.has(n.id));
                    const done = owned.has(r);
                    return <path key={r + n.id} d={`M${x1} ${y1} C${x1 + 70} ${y1}, ${x2 - 70} ${y2}, ${x2} ${y2}`} fill="none" stroke={done ? colorOf(TECH_MAP[r]) : 'var(--line2)'} strokeWidth={chain && on ? 3 : 1.6} strokeDasharray={done ? undefined : '5 4'} opacity={on ? (chain ? 1 : 0.7) : 0.12} />;
                  }))}
                  {TECH_NODES.map((n) => {
                    const p = L.pos[n.id]; const st = status(n); const hot = match(n) && (!chain || chain.has(n.id));
                    const border = st === 'owned' ? 'var(--green)' : st === 'ready' ? 'var(--hi)' : st === 'saving' ? 'var(--amber)' : 'var(--line2)';
                    return (
                      <g key={n.id} transform={`translate(${p.x} ${p.y})`} opacity={hot ? 1 : 0.16} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSel(n.id); }} onDoubleClick={() => { if (canUnlock(n, c.nodes, c.credits).ok) unlockNode(n.id); }} onPointerDown={(e) => e.stopPropagation()}>
                        <rect width={NW} height={NH} fill={st === 'owned' ? 'var(--green-bg)' : 'var(--panel2)'} stroke={sel === n.id ? 'var(--red)' : border} strokeWidth={sel === n.id ? 3 : st === 'ready' ? 2 : 1.4} />
                        <rect width={6} height={NH} fill={colorOf(n)} />
                        <text x={16} y={22} fontSize="13" fontWeight="700" fill="var(--text)">{n.name.length > 27 ? n.name.slice(0, 26) + '…' : n.name}</text>
                        <text x={16} y={40} fontSize="10.5" fill="var(--muted)">{n.unlocks.slice(0, 2).map((u) => nameOf(u).split(' (')[0].replace(/^[A-Z]{2,4}-\d+ /, '')).join(' · ').slice(0, 38)}{n.unlocks.length > 2 ? ` +${n.unlocks.length - 2}` : ''}</text>
                        <text x={16} y={59} fontSize="11" fontFamily="var(--mono)" fill={st === 'owned' ? 'var(--green)' : st === 'locked' ? 'var(--dim)' : 'var(--amber)'}>{st === 'owned' ? '✓ researched' : st === 'locked' ? '🔒 needs prerequisites' : `${n.cost} credits${st === 'saving' ? ' (saving)' : ' · ready'}`}</text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          </div>
        ) : (
          <div className="col" style={{ gap: 10 }}>
            {LANES.filter((b) => !off.has(b)).map((b) => (
              <Panel key={b} title={BRANCHES[b].label}>
                <div className="col" style={{ gap: 6 }}>
                  {TECH_NODES.filter((n) => n.branch === b && match(n)).map((n) => {
                    const st = status(n);
                    return (
                      <button key={n.id} className={`tree-node ${st === 'owned' ? 'owned' : st === 'ready' ? 'avail' : 'locked'}`} style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }} onClick={() => setSel(n.id)}>
                        <div className="row"><b style={{ flex: 1 }}>T{n.tier} · {n.name}</b>{st === 'owned' ? <Badge tone="gr">researched</Badge> : <Badge tone="or">{n.cost} cr</Badge>}</div>
                        <div className="muted" style={{ fontSize: 'calc(13px * var(--ts, 1))' }}>{n.blurb}</div>
                      </button>
                    );
                  })}
                </div>
              </Panel>
            ))}
          </div>
        )}

        <div className="col" style={{ gap: 10, position: 'sticky', top: 0 }}>
          {selected && chk ? (
            <Panel title={selected.name} right={<Badge tone={owned.has(selected.id) ? 'gr' : 'or'}>{owned.has(selected.id) ? 'researched' : `${selected.cost} cr`}</Badge>}>
              <div style={{ borderLeft: `4px solid ${colorOf(selected)}`, paddingLeft: 8, marginBottom: 8 }}><span className="dim" style={{ fontSize: 'calc(12px * var(--ts, 1))', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{BRANCHES[selected.branch].label} · tier {selected.tier}</span></div>
              <p>{selected.blurb}</p>
              <div className="note" style={{ fontSize: 'calc(13px * var(--ts, 1))' }}><b>Real-world analogue.</b> {selected.real}</div>
              <h3 style={{ marginTop: 10 }}>Unlocks</h3>
              <div className="col" style={{ gap: 4, marginTop: 4 }}>
                {selected.unlocks.map((u) => <div key={u} className="row" style={{ fontSize: 'calc(13px * var(--ts, 1))' }}><b style={{ flex: 1 }}>{nameOf(u)}</b><span className="dim mono" style={{ fontSize: 'calc(12px * var(--ts, 1))' }}>{statOf(u)}</span></div>)}
              </div>
              {selected.requires.length > 0 && <><h3 style={{ marginTop: 10 }}>Requires</h3><div className="chips" style={{ marginTop: 4 }}>{selected.requires.map((r) => <button key={r} className="chip" onClick={() => focusNode(r)}>{owned.has(r) ? '✓ ' : ''}{TECH_MAP[r].name}</button>)}</div></>}
              {dependentsOf(selected.id).length > 0 && <><h3 style={{ marginTop: 10 }}>Leads to</h3><div className="chips" style={{ marginTop: 4 }}>{dependentsOf(selected.id).map((r) => <button key={r} className="chip" onClick={() => focusNode(r)}>{TECH_MAP[r].name}</button>)}</div></>}
              {!owned.has(selected.id) && <button className="btn primary" style={{ marginTop: 12, width: '100%' }} disabled={!chk.ok} onClick={() => unlockNode(selected.id)}>{chk.ok ? `Research · ${selected.cost} credits` : chk.why}</button>}
            </Panel>
          ) : (
            <Panel title="How to read the tree">
              <div className="col" style={{ gap: 6, fontSize: 'calc(13px * var(--ts, 1))' }}>
                <div><span style={{ color: 'var(--green)' }}>■</span> green border: researched</div>
                <div><span style={{ color: 'var(--hi)' }}>■</span> bright border: ready, you can afford it</div>
                <div><span style={{ color: 'var(--amber)' }}>■</span> amber border: prerequisites done, saving credits</div>
                <div><span style={{ color: 'var(--line2)' }}>■</span> grey dashed: locked behind other technologies</div>
                <div className="dim">Rows are branches (science, power, comms…), columns are tiers. Select a node to light up everything it needs and everything it leads to.</div>
              </div>
            </Panel>
          )}
          <div className="note" style={{ fontSize: 'calc(13px * var(--ts, 1))' }}>Starting tip: 150 credits already buys Spectroscopy (60) and Multispectral Imaging (50), enough for the Lunar Explorer or Earth Observation. First completions and higher scores earn more.</div>
        </div>
      </div>
    </div>
  );
}
