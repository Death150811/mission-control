import { useState } from 'react';
import Blueprint from '../components/Blueprint';
import { PartDetail, specLine } from '../components/partInfo';
import { SpacecraftSceneLazy as SpacecraftScene } from '../components/three/lazy';
import { Badge, Explain, Illustrative, Panel, Tabs, n0, n1 } from '../components/ui';
import { CATEGORY_LABEL, FRAMES, PARTS, partsOf } from '../data/spacecraftComponents';
import { fitPropellant, placePart, setFrame } from '../engine/designFactory';
import type { FramePart, PartCategory, SlotDef } from '../types';
import { applyRecommended, canEdit, partLocked, saveBlueprint, toast, updateDesign, useCurrent, go } from '../store/store';
import { nodeForPart } from '../data/techTree';
import { setEditing } from '../store/team';
import { DIFFICULTY } from '../engine/difficulty';

const CATS: PartCategory[] = ['frame', 'solar', 'battery', 'antenna', 'transmitter', 'computer', 'adcs', 'thermal', 'engine', 'tank', 'instrument'];
const EDIT_KEY: Record<PartCategory, string> = { frame: 'frame', solar: 'solar', battery: 'battery', antenna: 'antenna', transmitter: 'transmitter', computer: 'computer', adcs: 'adcs', thermal: 'thermal', engine: 'engine', tank: 'tank', instrument: 'instrument' };

export default function Workshop() {
  const { app, analysis: a, scenario } = useCurrent();
  const [cat, setCat] = useState<PartCategory>('solar');
  const [selPart, setSelPart] = useState<string | null>(null);
  const [selSlot, setSelSlot] = useState<string | null>(null);
  const [dragCat, setDragCat] = useState<PartCategory | null>(null);
  const [tab, setTab] = useState<'blueprint' | '3d' | 'systems'>('3d');
  if (!a || !app.design || !a.frame) return null;
  const frame = a.frame as FramePart;
  const allowed = (c: PartCategory) => canEdit(app.team, EDIT_KEY[c]);
  const rules = DIFFICULTY[app.difficulty];

  const place = (slot: SlotDef, partId: string) => {
    const part = PARTS[partId];
    if (!part || !slot.accepts.includes(part.category)) { toast(`${part?.name ?? 'Part'} does not fit the ${slot.label}`); return; }
    if (!allowed(part.category)) { toast(`Your role (${app.team.role}) cannot edit ${CATEGORY_LABEL[part.category]}`); return; }
    if (partLocked(app, partId)) { toast(`${part.name} is locked: research "${nodeForPart(partId)?.name}" in the Technology tree.`); return; }
    setEditing(part.category);
    updateDesign((d) => placePart(d, slot.id, partId), `Placed ${part.name} in ${slot.label}`);
    setDragCat(null);
  };
  const onSlot = (slot: SlotDef) => {
    if (selPart && PARTS[selPart].category !== 'frame') {
      if (slot.accepts.includes(PARTS[selPart].category)) { place(slot, selPart); return; }
    }
    setSelSlot(app.design!.placements[slot.id] ? slot.id : null);
  };
  const autoPlaceFirst = (partId: string) => {
    const p = PARTS[partId];
    if (partLocked(app, partId)) { toast(`${p.name} is locked: research "${nodeForPart(partId)?.name}" in the Technology tree.`); return; }
    if (p.category === 'frame') { if (!allowed('frame')) { toast('Role cannot edit the frame'); return; } updateDesign((d) => setFrame(d, partId), `Changed frame to ${p.name}`); return; }
    const slot = frame.slots.find((s) => s.accepts.includes(p.category) && !app.design!.placements[s.id]);
    if (!slot) { toast(`No free slot for ${p.name}. Remove something first or choose a larger frame.`); return; }
    place(slot, partId);
  };
  const removeSlot = (id: string) => { const p = PARTS[app.design!.placements[id] ?? '']; if (!p) return; if (!allowed(p.category)) { toast('Your role cannot edit this subsystem'); return; } updateDesign((d) => placePart(d, id, null), `Removed ${p.name}`); setSelSlot(null); };
  const selSlotPart = selSlot ? PARTS[app.design.placements[selSlot] ?? ''] : null;
  const showPart = selPart ? PARTS[selPart] : selSlotPart;

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)' }}>
      <div className="col">
        <Panel title="Parts catalogue">
          <div className="chips" style={{ marginBottom: 10 }}>{CATS.map((c) => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => { setCat(c); setSelPart(null); }}>{CATEGORY_LABEL[c]}</button>)}</div>
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {(cat === 'frame' ? FRAMES : partsOf(cat)).map((p) => {
              const active = cat === 'frame' ? p.id === app.design!.frameId : selPart === p.id;
              const lk = partLocked(app, p.id);
              return (
                <div key={p.id} className={`part ${active ? 'sel' : ''} ${lk ? 'locked' : ''}`} draggable={cat !== 'frame' && !lk}
                  onDragStart={(e) => { e.dataTransfer.setData('text/part', p.id); e.dataTransfer.effectAllowed = 'copy'; setDragCat(p.category); }} onDragEnd={() => setDragCat(null)}
                  onClick={() => { if (lk) { toast(`${p.name} is locked: research "${nodeForPart(p.id)?.name}" in the Technology tree.`); return; } if (cat === 'frame') autoPlaceFirst(p.id); else setSelPart(selPart === p.id ? null : p.id); }} onDoubleClick={() => autoPlaceFirst(p.id)}
                  role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') autoPlaceFirst(p.id); }}>
                  <span className="nm">{p.name}</span>
                  <span className="mono muted" style={{ fontSize: 'calc(12px * var(--ts, 1))' }}>{lk ? 'LOCKED' : active && cat === 'frame' ? 'ACTIVE' : ''}</span>
                  <span className="sp">{specLine(p)}</span>
                </div>
              );
            })}
          </div>
          <div className="note" style={{ marginTop: 8 }}>Drag a part onto a glowing slot, or select it and click a slot. Double-click places it in the first free slot.</div>
        </Panel>
        {showPart && <Panel title="Part details"><PartDetail part={showPart} />{selSlot && selSlotPart && !selPart && <div className="row" style={{ marginTop: 10 }}><button className="btn danger" onClick={() => removeSlot(selSlot)}>Remove from {selSlot}</button></div>}</Panel>}
      </div>

      <div className="col" style={{ minWidth: 0 }}>
        <div className="row">
          <div><h1>Spacecraft Workshop</h1><div className="muted">Build the vehicle slot by slot. Every change updates mass, power, thermal, data and cost instantly.</div></div>
          <span className="spacer" />
          {rules.guidance && !app.career.enabled && <button className="btn primary" onClick={applyRecommended}>Apply guided baseline</button>}
          <button className="btn" onClick={() => saveBlueprint()}>Save blueprint</button>
          <button className="btn" onClick={() => go('instruments')}>Instrument lab →</button>
        </div>
        <Tabs value={tab} onChange={setTab} items={[{ id: '3d', label: '3D assembly' }, { id: 'blueprint', label: 'Schematic' }, { id: 'systems', label: 'Propulsion · power · ops' }]} />
        {tab === 'blueprint' && (
          <>
            <Blueprint frame={frame} design={app.design} selectedCat={selPart ? PARTS[selPart].category : null} draggingCat={dragCat} selectedSlot={selSlot} onSlot={onSlot} onDropPart={place} allowed={allowed} />
            <SubsystemTable />
          </>
        )}
        {tab === '3d' && (
          <>
            <SpacecraftScene a={a} height={520} highlightCat={dragCat ?? (selPart ? PARTS[selPart].category : null)} selectedSlot={selSlot}
              onSlot={(id) => { const sl = frame.slots.find((x) => x.id === id); if (sl) onSlot(sl); }}
              onDropPart={(id, pid) => { const sl = frame.slots.find((x) => x.id === id); if (sl) place(sl, pid); }} />
            <SubsystemTable />
          </>
        )}
        {tab === 'systems' && <SystemsTab />}
        <Illustrative />
        <div className="row"><span className="muted">Scenario limit: {n0(scenario.maxMassKg)} kg · {frame.name} carries {n0(frame.maxSupportedKg)} kg · CoM offset {n1(a.geometry.comLatM * 100)} cm</span></div>
      </div>
    </div>
  );
}

function SubsystemTable() {
  const { analysis: a } = useCurrent();
  if (!a) return null;
  const rows: [string, number, number, number][] = [
    ['Structure', a.mass.structure, a.power.busW, a.cost.byCategory.frame ?? 0],
    ['Solar arrays', a.mass.power, 0, a.cost.byCategory.solar ?? 0],
    ['Batteries', a.mass.batteries, 0, a.cost.byCategory.battery ?? 0],
    ['Communications', a.mass.comms, a.power.commsW, (a.cost.byCategory.antenna ?? 0) + (a.cost.byCategory.transmitter ?? 0)],
    ['Computer', a.mass.computer, a.power.computerW, a.cost.byCategory.computer ?? 0],
    ['Attitude control', a.mass.adcs, a.power.adcsW, a.cost.byCategory.adcs ?? 0],
    ['Thermal', a.mass.thermal, a.power.thermalW + a.power.heaterW, a.cost.byCategory.thermal ?? 0],
    ['Instruments', a.mass.instruments, a.power.instrumentsW, a.cost.byCategory.instrument ?? 0],
    ['Propulsion (dry)', a.mass.propulsionDry, 0, (a.cost.byCategory.engine ?? 0) + (a.cost.byCategory.tank ?? 0)],
    ['Propellant', a.mass.propellant, 0, 0],
  ];
  return (
    <Panel title="Subsystem budget" pad={false}>
      <table><thead><tr><th>Subsystem</th><th className="num">Mass kg</th><th className="num">Avg power W</th><th className="num">Cost $M</th></tr></thead>
        <tbody>{rows.map(([n, m, p, c]) => <tr key={n}><td>{n}</td><td className="num">{n1(m)}</td><td className="num">{p ? n1(p) : '—'}</td><td className="num">{c ? n1(c) : '—'}</td></tr>)}
          <tr><td><b>Total</b></td><td className="num"><b>{n1(a.mass.total)}</b></td><td className="num"><b>{n1(a.power.avgLoadW)}</b></td><td className="num"><b>{n1(a.cost.parts)}</b></td></tr></tbody></table>
    </Panel>
  );
}

function SystemsTab() {
  const { app, analysis: a, scenario } = useCurrent();
  if (!a || !app.design) return null;
  const d = app.design;
  const eng = a.parts.engine;
  return (
    <div className="grid g2">
      <Panel title={<>Propellant load <Explain topic="deltaV" /></>}>
        {!eng || a.propulsion.tankCapacityKg === 0 ? <p className="muted">Install an engine (aft-1) and at least one tank to carry propellant.</p> : (
          <>
            <input type="range" min={0} max={a.propulsion.tankCapacityKg} step={1} value={a.mass.propellant} disabled={!canEdit(app.team, 'tank')} onChange={(e) => updateDesign((x) => ({ ...x, propellantKg: Number(e.target.value) }))} aria-label="Propellant mass" />
            <dl className="kv"><dt>Loaded</dt><dd>{n0(a.mass.propellant)} / {n0(a.propulsion.tankCapacityKg)} kg</dd>
              <dt>Δv available</dt><dd>{n0(a.propulsion.dvAvailable)} m/s</dd><dt>Δv required</dt><dd>{n0(a.propulsion.dvRequired)} m/s</dd>
              <dt>Insertion burn</dt><dd>{n0(a.propulsion.dvInsertion)} m/s · {a.propulsion.burnTimeS < 1e7 ? `${n1(a.propulsion.burnTimeS / 60)} min` : '—'}</dd>
              <dt>Station keeping</dt><dd>{n1(a.propulsion.skPerYear)} m/s per year</dd></dl>
            <div className="row" style={{ marginTop: 8 }}><button className="btn" onClick={() => updateDesign((x) => fitPropellant(x, scenario, app.difficulty), 'Fitted propellant load to the delta-v budget')}>Fit to delta-v budget</button></div>
            <div className="note" style={{ marginTop: 8 }}>Δv = Isp · g₀ · ln(m₀/m_f). The slider changes m₀; more propellant gives more Δv but with diminishing returns because it must also be accelerated.</div>
          </>
        )}
      </Panel>
      <Panel title={<>Data handling <Explain topic="compression" /></>}>
        <div className="chips">{(['none', 'lossless', 'lossy'] as const).map((c) => <button key={c} className={`chip ${d.compression === c ? 'on' : ''}`} disabled={!canEdit(app.team, 'compression')} onClick={() => updateDesign((x) => ({ ...x, compression: c }), `Compression set to ${c}`)}>{c}</button>)}</div>
        <dl className="kv" style={{ marginTop: 8 }}><dt>Raw data</dt><dd>{n0(a.data.rawMBd)} MB/day</dd><dt>After compression</dt><dd>{n0(a.data.compressedMBd)} MB/day</dd><dt>Processing need / cap</dt><dd>{n0(a.data.processingNeedMBd)} / {n0(a.data.processingCapMBd)} MB/d</dd><dt>Storage</dt><dd>{n0(a.data.storageMB / 1000)} GB · {n1(a.data.storageDays)} days</dd><dt>Quality factor</dt><dd>{n0(a.data.compressionQuality * 100)}%</dd></dl>
      </Panel>
      <Panel title={<>Ground network <Explain topic="contactWindows" /></>}>
        <div className="chips">{[1, 2, 3].map((n) => <button key={n} className={`chip ${d.groundStations === n ? 'on' : ''}`} disabled={!canEdit(app.team, 'stations')} onClick={() => updateDesign((x) => ({ ...x, groundStations: n as 1 | 2 | 3 }), `Ground stations set to ${n}`)}>{n} station{n > 1 ? 's' : ''}</button>)}</div>
        <dl className="kv" style={{ marginTop: 8 }}><dt>Contact per day</dt><dd>{n0(a.comms.contactS / 60)} min ({n1(a.comms.contactFraction * 100)}%)</dd><dt>Operations cost</dt><dd>${n1(a.cost.ops)}M</dd><dt>Link rate (mean)</dt><dd>{a.comms.linkMean ? `${n1(a.comms.linkMean.rateBps / 1000)} kbps` : '—'}</dd><dt>Downlink capacity</dt><dd>{n0(a.comms.capacityMeanMB)} MB/day</dd><dt>One-way light time</dt><dd>{a.comms.delayS < 120 ? `${n1(a.comms.delayS)} s` : `${n1(a.comms.delayS / 60)} min`}</dd></dl>
      </Panel>
      <Panel title={<>Power architecture and radiation <Explain topic="eclipse" /></>}>
        <div className="chips">{(['tracking', 'fixed'] as const).map((k) => <button key={k} className={`chip ${(d.arrayDrive ?? 'tracking') === k ? 'on' : ''}`} disabled={!canEdit(app.team, 'solar')} onClick={() => updateDesign((x) => ({ ...x, arrayDrive: k }), `Solar array drive: ${k}`)}>{k === 'tracking' ? 'sun-tracking drives' : 'body-fixed arrays'}</button>)}</div>
        <div className="muted" style={{ fontSize: 'calc(13px * var(--ts, 1))', margin: '6px 0 10px' }}>Tracking drives keep the cells facing the Sun (angle factor {a.power.angleFactor.toFixed(2)}); fixed arrays save {n0(a.mass.drive || 4 * a.parts.solar.length)} kg and 4 W per wing but only see the Sun at an angle.</div>
        <label className="col"><span>Extra aluminium shielding: <b className="mono">{(d.shieldingMm ?? 0).toFixed(1)} mm</b> <span className="dim">(baseline structure ≈ 2.5 mm)</span></span><input type="range" min={0} max={8} step={0.5} value={d.shieldingMm ?? 0} disabled={!canEdit(app.team, 'frame')} onChange={(e) => updateDesign((x) => ({ ...x, shieldingMm: Number(e.target.value) }))} aria-label="Shielding thickness" /></label>
        <dl className="kv" style={{ marginTop: 6 }}><dt>Mission dose behind {n1(a.radiation.shieldMm)} mm Al</dt><dd>{n1(a.radiation.doseKrad)} krad</dd><dt>Weakest electronics</dt><dd>{n0(a.radiation.tidKrad)} krad</dd><dt>Margin (factor-2 rule)</dt><dd className={a.radiation.margin < 1 ? 'rd' : a.radiation.margin < 2 ? 'or' : 'gr'}>×{a.radiation.margin.toFixed(1)}</dd><dt>Shield mass</dt><dd>{n1(a.mass.shielding)} kg</dd></dl>
        <h3 style={{ margin: '12px 0 6px' }}>Redundancy (cross-strapped cold spares)</h3>
        {(['computer', 'transmitter', 'battery'] as const).map((k) => <label key={k} className="row" style={{ marginBottom: 4 }}><input type="checkbox" checked={!!d.redundancy?.[k]} disabled={!canEdit(app.team, k === 'transmitter' ? 'transmitter' : k)} onChange={(e) => updateDesign((x) => ({ ...x, redundancy: { computer: false, transmitter: false, battery: false, ...x.redundancy, [k]: e.target.checked } }), `Redundant ${k}: ${e.target.checked ? 'on' : 'off'}`)} />Redundant {k}</label>)}
        <dl className="kv" style={{ marginTop: 6 }}><dt>Mass added</dt><dd>{n1(a.mass.redundancy)} kg</dd><dt>Bus reliability (nominal mission)</dt><dd>{n0(a.reliability.critical * 100)}%</dd></dl>
        <div className="note" style={{ marginTop: 6 }}>With a spare, a computer or transmitter fault becomes a recoverable anomaly in flight; without it you may lose capacity for good.</div>
      </Panel>
      <Panel title="Design identity">
        <label className="col"><span className="muted">Spacecraft name</span><input type="text" value={d.name} onChange={(e) => updateDesign((x) => ({ ...x, name: e.target.value }))} /></label>
        <div className="row" style={{ marginTop: 8 }}><Badge tone="cy">{scenario.name}</Badge><Badge>{app.difficulty}</Badge><Badge>{a.frame?.name}</Badge></div>
      </Panel>
    </div>
  );
}
