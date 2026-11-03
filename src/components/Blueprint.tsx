import { PARTS } from '../data/spacecraftComponents';
import type { Design, FramePart, PartCategory, SlotDef } from '../types';

interface Rect { x: number; y: number; w: number; h: number }

export function blueprintLayout(frame: FramePart) {
  const BW = 330;
  const bays = frame.slots.filter((s) => s.kind === 'bay');
  const internals = frame.slots.filter((s) => s.kind === 'internal');
  const aft = frame.slots.filter((s) => s.kind === 'aft');
  const bayRows = Math.ceil(bays.length / 2), intRows = Math.ceil(internals.length / 2);
  const BH = 54 + bayRows * 46 + 20 + intRows * 38 + 14;
  const mastH = 70;
  const cx = 380;
  const busX = cx - BW / 2, busY = mastH + 12;
  const rects: Record<string, Rect> = {};
  const wingY = busY + BH / 2 - 40;
  for (const s of frame.slots) {
    if (s.kind === 'mast') rects[s.id] = { x: cx - 70, y: busY - 68, w: 140, h: 52 };
    if (s.id === 'wing-l') rects[s.id] = { x: busX - 190, y: wingY, w: 180, h: 80 };
    if (s.id === 'wing-r') rects[s.id] = { x: busX + BW + 10, y: wingY, w: 180, h: 80 };
  }
  bays.forEach((s, i) => { const col = i % 2, row = Math.floor(i / 2); rects[s.id] = { x: busX + 12 + col * 158, y: busY + 40 + row * 46, w: 148, h: 38 }; });
  const intY = busY + 40 + bayRows * 46 + 22;
  internals.forEach((s, i) => { const col = i % 2, row = Math.floor(i / 2); rects[s.id] = { x: busX + 12 + col * 158, y: intY + row * 38, w: 148, h: 31 }; });
  const aftY = busY + BH + 14;
  aft.forEach((s, i) => {
    if (i === 0) rects[s.id] = { x: cx - 80, y: aftY, w: 160, h: 50 };
    else { const k = i - 1; const side = k % 2 === 0 ? -1 : 1; const row = Math.floor(k / 2); rects[s.id] = { x: side < 0 ? cx - 80 - 168 - row * 0 : cx + 80 + 8, y: aftY + row * 54, w: 160, h: 50 }; }
  });
  const aftRows = Math.max(1, Math.ceil(Math.max(0, aft.length - 1) / 2));
  return { rects, bus: { x: busX, y: busY, w: BW, h: BH }, height: aftY + aftRows * 54 + 40, bayLabelY: busY + 24, intLabelY: intY - 6 };
}

const SHORT: Record<string, string> = {};
function shortName(id: string) {
  if (SHORT[id]) return SHORT[id];
  const n = PARTS[id]?.name ?? id;
  return (SHORT[id] = n.length > 24 ? n.slice(0, 23) + '…' : n);
}

interface Props {
  frame: FramePart; design: Design; selectedCat: PartCategory | null; draggingCat: PartCategory | null; selectedSlot: string | null;
  onSlot: (slot: SlotDef) => void; onDropPart: (slot: SlotDef, partId: string) => void; allowed: (c: PartCategory) => boolean;
}

export default function Blueprint({ frame, design, selectedCat, draggingCat, selectedSlot, onSlot, onDropPart, allowed }: Props) {
  const L = blueprintLayout(frame);
  const cat = draggingCat ?? selectedCat;
  return (
    <div className="bp-wrap">
      <svg viewBox={`0 0 760 ${L.height}`} role="group" aria-label="Spacecraft assembly blueprint">
        <defs><pattern id="g" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#232a35" strokeWidth="0.6" /></pattern></defs>
        <rect width="760" height={L.height} fill="url(#g)" />
        <rect x={L.bus.x} y={L.bus.y} width={L.bus.w} height={L.bus.h} fill="rgba(122,169,247,0.04)" stroke="#7aa9f7" strokeWidth="1.5" />
        <text x={L.bus.x + 10} y={L.bus.y + 16} fill="#7aa9f7" fontSize="11" fontFamily="monospace">{frame.name.toUpperCase()}  {frame.dims.w} × {frame.dims.h} m</text>
        <text x={L.bus.x + 10} y={L.bayLabelY + 14} fill="#8f99a8" fontSize="9" fontFamily="monospace">INSTRUMENT BAYS</text>
        <text x={L.bus.x + 10} y={L.intLabelY + 8} fill="#8f99a8" fontSize="9" fontFamily="monospace">INTERNAL: batteries · computer · ADCS · thermal · transmitter</text>
        <line x1="380" y1={L.bus.y - 16} x2="380" y2={L.bus.y} stroke="#7aa9f7" strokeDasharray="3 3" />
        {frame.slots.map((s) => {
          const r = L.rects[s.id]; if (!r) return null;
          const pid = design.placements[s.id];
          const part = pid ? PARTS[pid] : null;
          const accepts = cat ? s.accepts.includes(cat) : false;
          const cls = `slot ${part ? 'filled' : ''} ${accepts && allowed(cat!) ? 'hl' : ''} ${selectedSlot === s.id ? 'sel' : ''}`;
          const wingFill = part && part.category === 'solar';
          return (
            <g key={s.id} className={cls} tabIndex={0} role="button" aria-label={`${s.label}: ${part ? part.name : 'empty'}`}
              onClick={() => onSlot(s)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSlot(s); } }}
              onDragOver={(e) => { if (draggingCat && s.accepts.includes(draggingCat)) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/part'); if (id) onDropPart(s, id); }}>
              <rect className="s" x={r.x} y={r.y} width={r.w} height={r.h} rx="2" />
              {wingFill && <g stroke="#ffb000" strokeWidth="0.6" opacity="0.7">{Array.from({ length: 8 }).map((_, i) => <line key={i} x1={r.x + (r.w / 8) * (i + 0.5)} x2={r.x + (r.w / 8) * (i + 0.5)} y1={r.y + 3} y2={r.y + r.h - 3} />)}</g>}
              <text x={r.x + 6} y={r.y + 13}>{s.label}</text>
              {part && <text x={r.x + 6} y={r.y + r.h - 8} fontSize="10" fill="#f2f4f7">{shortName(part.id)}</text>}
              {part && <text x={r.x + r.w - 5} y={r.y + 13} textAnchor="end" fill="#a5aeba">{part.massKg}kg</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
