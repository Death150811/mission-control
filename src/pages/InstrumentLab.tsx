import { useMemo, useState } from 'react';
import { PartDetail } from '../components/partInfo';
import { Badge, Explain, Illustrative, Panel, n0, n1 } from '../components/ui';
import { partsOf, PARTS } from '../data/spacecraftComponents';
import { autoPlace, placePart } from '../engine/designFactory';
import { analyzeDesign } from '../engine/resourceManager';
import type { Domain, InstrumentPart } from '../types';
import { canEdit, partLocked, toast, updateDesign, useCurrent, go } from '../store/store';
import { nodeForPart } from '../data/techTree';
import { setEditing } from '../store/team';

const DOMAINS: (Domain | 'all')[] = ['all', 'imaging', 'multispectral', 'hyperspectral', 'spectroscopy', 'atmosphere', 'altimetry', 'fields', 'particles', 'thermal', 'navigation', 'observatory'];

export default function InstrumentLab() {
  const { app, analysis: a, scenario } = useCurrent();
  const [filter, setFilter] = useState<Domain | 'all'>('all');
  const [sel, setSel] = useState<string>('multispectral');
  const all = partsOf('instrument') as InstrumentPart[];
  const list = all.filter((i) => filter === 'all' || i.domains.includes(filter));
  const installed = useMemo(() => (a ? a.instruments : []), [a]);
  const part = PARTS[sel] as InstrumentPart;
  const preview = useMemo(() => {
    if (!app.design || !a) return null;
    const installedSlot = installed.find((i) => i.part.id === sel);
    const base = analyzeDesign(app.design, scenario, app.difficulty);
    const next = installedSlot ? analyzeDesign(placePart(app.design, installedSlot.slotId, null), scenario, app.difficulty) : analyzeDesign(autoPlace(app.design, sel), scenario, app.difficulty);
    const full = !installedSlot && next.instruments.length === base.instruments.length;
    return { base, next, installed: !!installedSlot, full, slotId: installedSlot?.slotId };
  }, [app.design, sel, scenario, app.difficulty, a, installed]);
  if (!a || !app.design) return null;
  const rel = part.relevance[scenario.target] ?? 0;
  const stat = installed.find((i) => i.part.id === sel);

  const add = () => {
    if (!canEdit(app.team, 'instrument')) { toast('Your role cannot edit instruments (Science Officer can).'); return; }
    if (partLocked(app, sel)) { toast(`Locked: research "${nodeForPart(sel)?.name}" in the Technology tree first.`); return; }
    if (preview?.full) { toast('No free instrument bay. Remove an instrument or choose a larger frame.'); return; }
    setEditing('instrument');
    updateDesign((d) => autoPlace(d, sel), `Added instrument ${part.name}`);
  };
  const remove = (slot: string, name: string) => { if (!canEdit(app.team, 'instrument')) { toast('Your role cannot edit instruments.'); return; } updateDesign((d) => placePart(d, slot, null), `Removed instrument ${name}`); };
  const delta = (x: number, y: number, unit: string, digits = 0) => { const d = y - x; return <span className={d > 0.001 ? 'or' : d < -0.001 ? 'gr' : 'muted'}>{d >= 0 ? '+' : ''}{d.toFixed(digits)} {unit}</span>; };

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 380px)' }}>
      <div className="col">
        <div className="row"><div><h1>Instrument Lab</h1><div className="muted">Target: <b>{scenario.target}</b>. Relevance shows how useful each instrument is here; mismatches waste mass and power.</div></div><span className="spacer" /><button className="btn" onClick={() => go('orbit')}>Orbit planner →</button></div>
        <div className="chips">{DOMAINS.map((d) => <button key={d} className={`chip ${filter === d ? 'on' : ''}`} onClick={() => setFilter(d)}>{d}</button>)}</div>
        <div className="grid g2">
          {list.map((i) => {
            const r = i.relevance[scenario.target] ?? 0;
            const on = installed.some((x) => x.part.id === i.id);
            return (
              <div key={i.id} className={`card ${sel === i.id ? 'sel' : ''}`} onClick={() => setSel(i.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setSel(i.id); }}>
                <div className="row"><b style={{ flex: 1 }}>{i.name}</b>{on && <Badge tone="gr">installed</Badge>}{r === 0 && <Badge tone="rd">no relevance</Badge>}{partLocked(app, i.id) && <Badge tone="or">locked</Badge>}</div>
                <div className="mono muted" style={{ fontSize: 'calc(12px * var(--ts, 1))', margin: '4px 0' }}>{i.massKg} kg · {i.powerW} W · ${i.costM}M · {n0(i.dataMBd)} MB/d</div>
                <div className="meter" style={{ margin: '4px 0' }}><div className="top"><span>Science value</span><b>{i.sci}</b></div><div className="bar"><i style={{ width: `${i.sci}%` }} /></div></div>
                <div className="meter" style={{ margin: 0 }}><div className="top"><span>Relevance at {scenario.target}</span><b>{Math.round(r * 100)}%</b></div><div className={`bar ${r === 0 ? 'bad' : r < 0.5 ? 'warn' : 'ok'}`}><i style={{ width: `${r * 100}%` }} /></div></div>
              </div>
            );
          })}
        </div>
        <Illustrative />
      </div>
      <div className="col">
        <Panel title="Selected instrument"><PartDetail part={part} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={add} disabled={!!stat && false}>{stat ? 'Add another' : 'Add to spacecraft'}</button>
            {stat && <button className="btn danger" onClick={() => remove(stat.slotId, part.name)}>Remove</button>}
          </div>
          <dl className="kv" style={{ marginTop: 10 }}><dt>Relevance at target</dt><dd>{Math.round(rel * 100)}%</dd><dt>Domains</dt><dd>{part.domains.join(', ')}</dd><dt>Pointing needed</dt><dd>{part.pointingDeg}° (yours {a.science.pointingDeg}°)</dd><dt>Thermal stability need</dt><dd>{part.thermal} (yours {a.thermal.stability})</dd>{part.ifovUrad > 0 && <><dt>Swath / GSD</dt><dd>{n1(2 * a.orbit.effectiveAltM * Math.tan((part.fovDeg / 2) * Math.PI / 180) / 1000)} km / {n1(a.orbit.effectiveAltM * part.ifovUrad * 1e-6)} m</dd></>}</dl>
        </Panel>
        {preview && !preview.full && (
          <Panel title={preview.installed ? 'If you remove it' : 'Impact of adding it'}>
            <dl className="kv"><dt>Mass</dt><dd>{delta(preview.base.mass.total, preview.next.mass.total, 'kg', 0)}</dd><dt>Avg power</dt><dd>{delta(preview.base.power.avgLoadW, preview.next.power.avgLoadW, 'W', 0)}</dd><dt>Cost</dt><dd>{delta(preview.base.cost.total, preview.next.cost.total, '$M', 1)}</dd><dt>Data per day</dt><dd>{delta(preview.base.data.compressedMBd, preview.next.data.compressedMBd, 'MB', 0)}</dd><dt>Science potential</dt><dd>{delta(preview.base.science.potentialPerDay, preview.next.science.potentialPerDay, 'pts/d', 2)}</dd><dt>Power margin</dt><dd>{delta(preview.base.power.orbitMarginPct, preview.next.power.orbitMarginPct, '%', 0)}</dd></dl>
            <div className="note" style={{ marginTop: 8 }}>Impact is computed by re-running the full engineering model with the instrument added or removed. <Explain topic="instrumentData" label="Data volume" /></div>
          </Panel>
        )}
        {preview?.full && <div className="note">All instrument bays are full. Remove an instrument or switch to a bigger frame in the Workshop.</div>}
        <Panel title={`Installed (${installed.length})`} pad={false}>
          <table><tbody>{installed.length === 0 ? <tr><td className="muted">No instruments yet.</td></tr> : installed.map((i) => <tr key={i.slotId}><td><b>{i.part.name}</b><div className="muted">quality {Math.round(i.quality * 100)}% · {n1(i.pointsPerDay)} pts/day</div></td><td><button className="btn sm" onClick={() => remove(i.slotId, i.part.name)}>Remove</button></td></tr>)}</tbody></table>
        </Panel>
      </div>
    </div>
  );
}
