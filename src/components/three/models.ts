// 3D model builders: every mesh is generated from the part's real parameters (diameter, span, area, thrust, capacity...).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { STAGES } from '../../data/launchVehicles';
import type { Analysis } from '../../engine/resourceManager';
import type {
  AdcsPart, AntennaPart, BatteryPart, EnginePart, FramePart, InstrumentPart, LaunchVehicle, Part, SlotDef, SolarPart, TankPart, ThermalPart,
} from '../../types';
import { goldFoil, radiatorTex, solarCells, whitePaint } from './textures';

/* ---------- shared materials ---------- */
const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
export const MAT = {
  get gold() { return std({ map: goldFoil(), bumpMap: goldFoil(), bumpScale: 1.6, color: 0xffffff, metalness: 0.88, roughness: 0.38, envMapIntensity: 1.25 }); },
  get white() { return std({ map: whitePaint(), bumpMap: whitePaint(), bumpScale: 0.6, metalness: 0.08, roughness: 0.5 }); },
  get whitePlain() { return std({ color: 0xe6e9ed, metalness: 0.1, roughness: 0.5 }); },
  get steel() { return std({ color: 0xaab2bb, metalness: 0.92, roughness: 0.3 }); },
  get dark() { return std({ color: 0x2a2f37, metalness: 0.75, roughness: 0.38 }); },
  get black() { return std({ color: 0x0d0f13, metalness: 0.2, roughness: 0.85 }); },
  get copper() { return std({ color: 0xb4733d, metalness: 1, roughness: 0.34 }); },
  get lens() { return std({ color: 0x0b1e46, metalness: 0.3, roughness: 0.04, emissive: 0x0a2a66, emissiveIntensity: 0.35 }); },
  get red() { return std({ color: 0xfc3d21, metalness: 0.2, roughness: 0.5 }); },
  get blue() { return std({ color: 0x0b3d91, metalness: 0.3, roughness: 0.45 }); },
  get pcb() { return std({ color: 0x1f6b3a, metalness: 0.3, roughness: 0.5 }); },
  get amberGlow() { return std({ color: 0xffb000, emissive: 0xffb000, emissiveIntensity: 0.9, roughness: 0.4 }); },
  get radiator() { return std({ map: radiatorTex(), metalness: 0.05, roughness: 0.45 }); },
};

const box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 28) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);

function edges(mesh: THREE.Mesh, color = 0x14171c, op = 0.9): THREE.LineSegments {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 20), new THREE.LineBasicMaterial({ color, transparent: true, opacity: op }));
  return l;
}

/* ---------- slot layout in the 3D bus frame: +Y = nose, +Z = nadir deck ---------- */
export interface SlotBox { pos: THREE.Vector3; size: THREE.Vector3 }

export function slotBox(frame: FramePart, slot: SlotDef, part?: Part | null): SlotBox {
  const { w, h, d } = frame.dims;
  const n = Number(slot.id.split('-')[1]) - 1;
  switch (slot.kind) {
    case 'wing': {
      const span = part && part.category === 'solar' ? (part as SolarPart).spanM : 1.6;
      const depth = part && part.category === 'solar' ? Math.max(0.5, (part as SolarPart).areaM2 / (part as SolarPart).spanM) : 1;
      const sgn = slot.id === 'wing-l' ? -1 : 1;
      return { pos: new THREE.Vector3(sgn * (w / 2 + span / 2 + 0.22), 0, 0), size: new THREE.Vector3(span, 0.05, depth) };
    }
    case 'mast': return { pos: new THREE.Vector3(0, h / 2 + 0.2, 0), size: new THREE.Vector3(0.4, 0.4, 0.4) };
    case 'bay': { const col = n % 2, row = Math.floor(n / 2); return { pos: new THREE.Vector3((col ? 1 : -1) * w * 0.24, h * 0.33 - row * h * 0.27, d / 2 + 0.17), size: new THREE.Vector3(0.44, 0.34, 0.34) }; }
    case 'aft': {
      if (slot.id === 'aft-1') return { pos: new THREE.Vector3(0, -h / 2 - 0.3, 0), size: new THREE.Vector3(0.45, 0.55, 0.45) };
      const offs: [number, number][] = [[-0.28, 0.12], [0.28, 0.12], [0, -0.22], [-0.28, -0.25]];
      const o = offs[(n - 1) % offs.length];
      const th = part && part.category === 'tank' ? Math.min(h * 0.55, (part as TankPart).dims.h) : 0.6;
      return { pos: new THREE.Vector3(o[0] * w, -h * 0.2, o[1] * d), size: new THREE.Vector3(0.38, th, 0.38) };
    }
    default: { const col = n % 2, row = Math.floor(n / 2); return { pos: new THREE.Vector3((col ? 1 : -1) * w * 0.2, h * 0.38 - row * h * 0.15, -d * 0.22), size: new THREE.Vector3(0.3, 0.13, 0.22) }; }
  }
}

/* ---------- bus ---------- */
export function buildBus(frame: FramePart, xray: boolean): THREE.Group {
  const { w, h, d } = frame.dims;
  const g = new THREE.Group();
  const gold = MAT.gold, white = MAT.white;
  const mats = [gold, gold, white, gold, white, gold];
  if (xray) for (const m of mats) { m.transparent = true; m.opacity = 0.16; m.depthWrite = false; }
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(w, h, d) * 0.035), mats);
  body.castShadow = !xray; body.receiveShadow = true; body.userData.kind = 'bus';
  g.add(body);
  g.add(edges(new THREE.Mesh(new THREE.BoxGeometry(w, h, d)), xray ? 0xffb000 : 0x2b2418, xray ? 0.75 : 0.7));
  // corner struts
  const sm = MAT.dark;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const s = cyl(0.025, 0.025, h + 0.04, sm, 8); s.position.set(sx * (w / 2), 0, sz * (d / 2)); g.add(s); }
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const s = cyl(0.02, 0.02, w, sm, 8); s.rotation.z = Math.PI / 2; s.position.set(0, sy * (h / 2), sz * (d / 2)); g.add(s); }
  // launcher adapter ring at the aft end
  const ring = cyl(Math.min(w, d) * 0.42, Math.min(w, d) * 0.46, 0.1, MAT.dark, 36); ring.position.set(0, -h / 2 - 0.02, 0); g.add(ring);
  // NASA-blue stripe on the nadir deck as a livery detail
  const stripe = box(w * 0.98, 0.05, 0.005, MAT.blue); stripe.position.set(0, h / 2 - 0.08, d / 2 + 0.003); g.add(stripe);
  const stripe2 = box(w * 0.98, 0.02, 0.005, MAT.red); stripe2.position.set(0, h / 2 - 0.14, d / 2 + 0.003); g.add(stripe2);
  return g;
}

/* ---------- parts ---------- */
function solarWing(part: SolarPart, sgn: number, tracking: boolean, frame: FramePart): THREE.Group {
  const g = new THREE.Group();
  const span = part.spanM, depth = Math.max(0.5, part.areaM2 / span);
  const cells = solarCells();
  const tx = cells.clone(); tx.needsUpdate = true; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(Math.max(1, Math.round(span / 0.8)), Math.max(1, Math.round(depth / 0.6)));
  const top = new THREE.MeshPhysicalMaterial({ map: tx, bumpMap: tx, bumpScale: 0.8, metalness: 0.72, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.4 });
  const back = std({ color: 0x8e949c, metalness: 0.6, roughness: 0.5 });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(span, 0.035, depth), [back, back, top, back, back, back]);
  panel.position.x = sgn * (span / 2 + 0.22); panel.castShadow = true; panel.receiveShadow = true;
  g.add(panel); g.add((() => { const e = edges(panel, 0x6b727c, 1); e.position.copy(panel.position); return e; })());
  const yoke = cyl(0.03, 0.03, 0.24 + 0.02, MAT.steel, 12); yoke.rotation.z = Math.PI / 2; yoke.position.x = sgn * 0.12; g.add(yoke);
  if (tracking) { const drum = cyl(0.09, 0.09, 0.14, MAT.dark, 24); drum.rotation.z = Math.PI / 2; drum.position.x = sgn * 0.02; g.add(drum); }
  for (let k = 1; k < 3; k++) { const rib = box(0.02, 0.05, depth, MAT.dark); rib.position.set(sgn * (0.22 + (span * k) / 3), 0, 0); g.add(rib); }
  g.position.x = sgn * frame.dims.w / 2;
  return g;
}

function antenna(part: AntennaPart): THREE.Group {
  const g = new THREE.Group();
  if (!part.steerable) { const base = cyl(0.04, 0.05, 0.1, MAT.steel, 16); base.position.y = 0.05; g.add(base); const patch = cyl(0.09, 0.09, 0.03, MAT.whitePlain, 24); patch.position.y = 0.12; g.add(patch); return g; }
  const D = part.diameterM, R = D / 2, f = 0.35 * D;
  const mount = cyl(0.06, 0.07, 0.16, MAT.dark, 16); mount.position.y = 0.08; g.add(mount);
  const yoke = box(0.14, 0.06, 0.1, MAT.steel); yoke.position.y = 0.19; g.add(yoke);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 28; i++) { const r = (R * i) / 28; pts.push(new THREE.Vector2(r, (r * r) / (4 * f))); }
  const dish = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), std({ color: 0xe9ecef, metalness: 0.35, roughness: 0.35, side: THREE.DoubleSide }));
  const holder = new THREE.Group();
  holder.add(dish);
  const feed = cyl(0.012, 0.012, f, MAT.dark, 8); feed.position.y = f / 2; holder.add(feed);
  const horn = cyl(0.035, 0.018, 0.07, MAT.copper, 14); horn.position.y = f + 0.02; holder.add(horn);
  for (let k = 0; k < 3; k++) { const a = (k * 2 * Math.PI) / 3; const len = Math.hypot(R, (R * R) / (4 * f) - f); const s = cyl(0.007, 0.007, len, MAT.dark, 6); const mid = new THREE.Vector3(Math.cos(a) * R * 0.5, ((R * R) / (4 * f) + f) / 2, Math.sin(a) * R * 0.5); s.position.copy(mid); s.lookAt(new THREE.Vector3(Math.cos(a) * R, (R * R) / (4 * f), Math.sin(a) * R)); s.rotateX(Math.PI / 2); holder.add(s); }
  holder.rotation.x = Math.PI / 2 - 0.12; // dish axis toward +Z (nadir / Earth)
  holder.position.set(0, 0.2 + R * 0.35, 0.02 + D * 0.12);
  holder.children.forEach((c) => { (c as THREE.Mesh).castShadow = true; });
  g.add(holder);
  return g;
}

function engine(part: EnginePart): THREE.Group {
  const g = new THREE.Group();
  if (part.electric) {
    const pp = box(0.34, 0.16, 0.3, MAT.dark); pp.position.y = -0.04; g.add(pp);
    const grid = cyl(0.17, 0.17, 0.03, MAT.dark, 36); grid.position.y = -0.2; g.add(grid);
    const glow = cyl(0.14, 0.14, 0.012, std({ color: 0x4d86ff, emissive: 0x4d86ff, emissiveIntensity: 1.4 }), 36); glow.position.y = -0.22; g.add(glow);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 36), MAT.steel); ring.rotation.x = Math.PI / 2; ring.position.y = -0.2; g.add(ring);
    return g;
  }
  const mk = (thrust: number, x = 0, z = 0) => {
    const Re = 0.05 + 0.0021 * Math.sqrt(thrust), L = Re * 2.1;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 18; i++) { const t = i / 18; pts.push(new THREE.Vector2(0.025 + (Re - 0.025) * Math.pow(t, 0.55), -L * t)); }
    const bell = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), std({ color: 0xb4733d, metalness: 1, roughness: 0.34, side: THREE.DoubleSide }));
    bell.position.set(x, 0, z); bell.castShadow = true;
    const dome = cyl(0.045, 0.05, 0.06, MAT.steel, 14); dome.position.set(x, 0.03, z);
    const grp = new THREE.Group(); grp.add(bell, dome); return grp;
  };
  if (part.thrustN < 150) { for (const [x, z] of [[-0.09, -0.09], [0.09, -0.09], [-0.09, 0.09], [0.09, 0.09]]) g.add(mk(25, x, z)); }
  else g.add(mk(part.thrustN));
  return g;
}

function tank(part: TankPart, fill: number): THREE.Group {
  const g = new THREE.Group();
  const r = Math.max(0.1, part.dims.w / 2 * 0.62), hc = Math.max(0.01, Math.min(1, part.dims.h) * 0.6 - r);
  const shell = new THREE.Mesh(new THREE.CapsuleGeometry(r, hc, 10, 28), std({ color: 0xaab2bb, metalness: 0.92, roughness: 0.28, transparent: true, opacity: 0.55 }));
  shell.castShadow = true; g.add(shell);
  const liq = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.9, Math.max(0.001, hc * Math.max(0.05, fill)), 8, 20), std({ color: 0x4d86ff, emissive: 0x2a58c8, emissiveIntensity: 0.55, transparent: true, opacity: 0.85 }));
  liq.position.y = -(hc * (1 - Math.max(0.05, fill))) / 2 - (hc > 0 ? 0 : 0); g.add(liq);
  for (const y of [-hc * 0.35, hc * 0.35]) { const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, 0.012, 6, 28), MAT.dark); band.rotation.x = Math.PI / 2; band.position.y = y; g.add(band); }
  return g;
}

function battery(part: BatteryPart): THREE.Group {
  const g = new THREE.Group();
  const s = 0.7 + Math.min(0.6, part.capacityWh / 4000);
  const casing = box(0.26 * s, 0.11, 0.2 * s, MAT.dark); g.add(casing);
  const nx = Math.max(3, Math.round(4 * s)), nz = 2;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const c = cyl(0.018, 0.018, 0.1, MAT.pcb, 10); c.position.set(-0.11 * s + (i * 0.22 * s) / (nx - 1), 0.002, -0.055 * s + j * 0.11 * s); g.add(c); }
  const lab = box(0.1, 0.002, 0.05, MAT.whitePlain); lab.position.set(0, 0.056, 0); g.add(lab);
  return g;
}

function internal(part: Part): THREE.Group {
  const g = new THREE.Group();
  switch (part.category) {
    case 'battery': return battery(part as BatteryPart);
    case 'computer': {
      const board = box(0.28, 0.025, 0.2, MAT.pcb); g.add(board);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const chip = box(0.04, 0.012, 0.04, MAT.black); chip.position.set(-0.1 + i * 0.065, 0.02, -0.06 + j * 0.06); g.add(chip); }
      const sink = box(0.12, 0.05, 0.1, MAT.steel); sink.position.set(0.06, 0.04, 0); g.add(sink);
      return g;
    }
    case 'transmitter': {
      const b = box(0.26, 0.1, 0.18, MAT.copper); g.add(b);
      const wg = cyl(0.02, 0.02, 0.18, MAT.steel, 10); wg.rotation.z = Math.PI / 2; wg.position.set(0.1, 0.07, 0); g.add(wg);
      return g;
    }
    case 'adcs': {
      const a = part as AdcsPart;
      const n = a.id === 'adcs-basic' ? 0 : a.id === 'adcs-sun' ? 1 : 3;
      for (let i = 0; i < n; i++) { const wheel = cyl(0.05, 0.05, 0.03, MAT.steel, 22); wheel.position.set(-0.08 + i * 0.08, 0, 0); wheel.rotation.set(i === 1 ? Math.PI / 2 : 0, 0, i === 2 ? Math.PI / 2 : 0); g.add(wheel); }
      if (a.id === 'adcs-basic') for (let k = 0; k < 3; k++) { const rod = cyl(0.008, 0.008, 0.24, MAT.copper, 8); rod.rotation.set(k === 0 ? Math.PI / 2 : 0, 0, k === 1 ? Math.PI / 2 : 0); rod.position.set(0, 0, 0); g.add(rod); }
      return g;
    }
    case 'thermal': {
      const t = part as ThermalPart;
      const pump = box(0.16, 0.08, 0.12, MAT.dark); g.add(pump);
      if (t.id === 'th-active') { const loop = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.01, 8, 28), std({ color: 0x4d86ff, emissive: 0x2a58c8, emissiveIntensity: 0.6 })); loop.rotation.x = Math.PI / 2; loop.position.y = 0.06; g.add(loop); }
      else { const blanket = box(0.2, 0.03, 0.16, MAT.gold); blanket.position.y = 0.05; g.add(blanket); }
      return g;
    }
    default: return g.add(box(0.2, 0.1, 0.15, MAT.dark));
  }
}

function instrument(part: InstrumentPart): THREE.Group {
  const g = new THREE.Group();
  const base = box(0.38, 0.28, 0.06, MAT.dark); g.add(base);
  const front = 0.05;
  const mount = (m: THREE.Object3D, z = 0.03) => { m.position.z += z; g.add(m); };
  const barrel = (r: number, len: number, glass = true, z = 0) => {
    const b = new THREE.Group();
    const tube = cyl(r, r, len, MAT.whitePlain, 28); tube.rotation.x = Math.PI / 2; tube.position.z = len / 2; tube.castShadow = true; b.add(tube);
    const baffle = cyl(r * 1.08, r * 1.08, len * 0.18, MAT.black, 28); baffle.rotation.x = Math.PI / 2; baffle.position.z = len * 0.95; b.add(baffle);
    if (glass) { const lens = cyl(r * 0.88, r * 0.88, 0.01, MAT.lens, 28); lens.rotation.x = Math.PI / 2; lens.position.z = len * 1.0 + 0.002; b.add(lens); }
    b.position.z = z; return b;
  };
  switch (part.id) {
    case 'optical-cam': mount(barrel(0.12, 0.34), front); break;
    case 'multispectral': { const b = box(0.36, 0.24, 0.26, MAT.whitePlain); b.position.z = 0.13; b.castShadow = true; g.add(b); for (let i = 0; i < 3; i++) { const a = cyl(0.04, 0.04, 0.02, MAT.lens, 18); a.rotation.x = Math.PI / 2; a.position.set(-0.1 + i * 0.1, 0, 0.27); g.add(a); } break; }
    case 'hyperspectral': { const b = box(0.38, 0.26, 0.3, MAT.whitePlain); b.position.z = 0.15; b.castShadow = true; g.add(b); const slit = box(0.24, 0.025, 0.01, MAT.lens); slit.position.z = 0.305; g.add(slit); for (let i = 0; i < 5; i++) { const f = box(0.34, 0.012, 0.1, MAT.radiator); f.position.set(0, 0.135 + i * 0.016, 0.1); g.add(f); } break; }
    case 'ir-spec': { mount(barrel(0.09, 0.26), front); const cold = box(0.2, 0.012, 0.16, MAT.radiator); cold.position.set(0.12, 0.16, 0.12); cold.rotation.z = -0.5; g.add(cold); break; }
    case 'uv-spec': { const b = box(0.28, 0.22, 0.24, MAT.whitePlain); b.position.z = 0.12; g.add(b); const sh = cyl(0.1, 0.12, 0.12, MAT.black, 24); sh.rotation.x = Math.PI / 2; sh.position.z = 0.28; g.add(sh); break; }
    case 'magnetometer': { const boom = cyl(0.008, 0.008, 0.75, MAT.dark, 8); boom.rotation.z = Math.PI / 2; boom.position.set(0.4, 0, 0.1); g.add(boom); const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), MAT.amberGlow); s.position.set(0.78, 0, 0.1); g.add(s); const b = box(0.12, 0.1, 0.1, MAT.whitePlain); b.position.z = 0.08; g.add(b); break; }
    case 'rad-detector': { const b = box(0.14, 0.12, 0.12, MAT.whitePlain); b.position.z = 0.09; g.add(b); const r = cyl(0.045, 0.045, 0.02, MAT.black, 18); r.rotation.x = Math.PI / 2; r.position.z = 0.16; g.add(r); break; }
    case 'atmo-sensor': { const b = box(0.34, 0.24, 0.28, MAT.whitePlain); b.position.z = 0.14; g.add(b); for (let i = 0; i < 6; i++) { const s = box(0.3, 0.012, 0.06, MAT.dark); s.position.set(0, -0.08 + i * 0.03, 0.29); s.rotation.x = 0.35; g.add(s); } const mir = box(0.18, 0.18, 0.012, MAT.steel); mir.position.set(0, 0, 0.34); mir.rotation.x = 0.5; g.add(mir); break; }
    case 'radar-alt': { const p = box(0.9, 0.5, 0.04, MAT.whitePlain); p.position.z = 0.04; p.castShadow = true; g.add(p); for (let i = 0; i < 6; i++) { const s = box(0.012, 0.46, 0.006, MAT.dark); s.position.set(-0.36 + i * 0.145, 0, 0.065); g.add(s); } break; }
    case 'laser-alt': { mount(barrel(0.07, 0.24), 0.04); const b2 = barrel(0.045, 0.2); b2.position.set(0.14, 0.07, 0.05); g.add(b2); break; }
    case 'thermal-sensor': { const b = box(0.2, 0.18, 0.16, MAT.whitePlain); b.position.z = 0.08; g.add(b); const c = cyl(0.04, 0.09, 0.12, MAT.black, 20); c.rotation.x = Math.PI / 2; c.position.z = 0.22; g.add(c); break; }
    case 'particle-analyzer': { const c = cyl(0.11, 0.11, 0.2, MAT.dark, 24); c.rotation.x = Math.PI / 2; c.position.z = 0.12; g.add(c); const grid = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.006, 6, 22), MAT.steel); grid.position.z = 0.23; g.add(grid); break; }
    case 'ir-telescope': case 'telescope': { const t = barrel(0.26, 0.85, false, 0.05); g.add(t); for (let i = 0; i < 7; i++) { const a = i === 0 ? 0 : (i * Math.PI) / 3; const rr = i === 0 ? 0 : 0.14; const hx = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 6), MAT.gold); hx.rotation.x = Math.PI / 2; hx.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0.9); g.add(hx); } const shade = box(0.62, 0.02, 0.5, MAT.whitePlain); shade.position.set(0, -0.3, 0.35); g.add(shade); break; }
    case 'sar': { const p = box(1.5, 0.34, 0.04, MAT.whitePlain); p.position.z = 0.05; p.castShadow = true; g.add(p); for (let i = 0; i < 8; i++) { const s = box(0.012, 0.3, 0.006, MAT.dark); s.position.set(-0.65 + i * 0.185, 0, 0.075); g.add(s); } const e = box(0.4, 0.2, 0.2, MAT.dark); e.position.z = 0.14; g.add(e); break; }
    case 'gamma-spec': { const boom = cyl(0.012, 0.012, 0.6, MAT.dark, 8); boom.rotation.x = Math.PI / 2; boom.position.z = 0.34; g.add(boom); const det = cyl(0.07, 0.07, 0.14, MAT.steel, 22); det.rotation.x = Math.PI / 2; det.position.z = 0.7; g.add(det); const b = box(0.22, 0.2, 0.14, MAT.whitePlain); b.position.z = 0.09; g.add(b); break; }
    case 'dust-analyzer': { const c = cyl(0.04, 0.14, 0.2, MAT.dark, 24); c.rotation.x = Math.PI / 2; c.position.z = 0.13; g.add(c); break; }
    case 'mw-radiometer': { const dish = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, 1.0), std({ color: 0xe9ecef, metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide })); dish.rotation.x = -Math.PI / 2; dish.position.z = 0.22; g.add(dish); const b = box(0.3, 0.22, 0.18, MAT.whitePlain); b.position.z = 0.09; g.add(b); break; }
    case 'lidar-atm': { mount(barrel(0.14, 0.4), front); const b2 = barrel(0.05, 0.3); b2.position.set(0.17, 0.08, 0.05); g.add(b2); break; }
    case 'xray-spec': { const b = box(0.2, 0.2, 0.14, MAT.whitePlain); b.position.z = 0.1; g.add(b); for (let i = 0; i < 4; i++) { const t = cyl(0.025, 0.025, 0.07, MAT.steel, 12); t.rotation.x = Math.PI / 2; t.position.set(-0.06 + (i % 2) * 0.12, -0.05 + Math.floor(i / 2) * 0.1, 0.2); g.add(t); } break; }
    case 'plasma': { const s = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), MAT.steel); s.rotation.x = Math.PI / 2; s.position.z = 0.14; g.add(s); const b = box(0.2, 0.18, 0.12, MAT.whitePlain); b.position.z = 0.08; g.add(b); break; }
    case 'micro-cam': mount(barrel(0.04, 0.12), 0.04); break;
    case 'radio-sci': { const b = box(0.2, 0.12, 0.1, MAT.whitePlain); b.position.z = 0.06; g.add(b); const a = cyl(0.01, 0.01, 0.2, MAT.steel, 8); a.rotation.x = Math.PI / 2; a.position.set(0.06, 0.04, 0.2); g.add(a); break; }
    case 'navcam': mount(barrel(0.05, 0.16), 0.04); break;
    default: mount(barrel(0.08, 0.2), front);
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  return g;
}

function externalDetails(a: Analysis): THREE.Group {
  const f = a.frame!; const { w, h, d } = f.dims;
  const g = new THREE.Group();
  const adcs = a.parts.adcs;
  if (adcs && (adcs.id === 'adcs-star' || adcs.id === 'adcs-adv')) {
    for (const sx of adcs.id === 'adcs-adv' ? [-1, 1] : [1]) {
      const st = new THREE.Group(); const b = box(0.1, 0.1, 0.14, MAT.dark); st.add(b); const bf = cyl(0.04, 0.07, 0.14, MAT.black, 16); bf.position.y = 0.12; st.add(bf);
      st.position.set(sx * w * 0.3, h / 2 + 0.05, -d * 0.35); st.rotation.x = -0.4; g.add(st);
    }
  }
  if (adcs && adcs.id === 'adcs-sun') for (const sx of [-1, 1]) { const s = cyl(0.03, 0.03, 0.015, MAT.lens, 14); s.position.set(sx * w * 0.3, h / 2 + 0.01, d * 0.2); g.add(s); }
  if (a.parts.thermal) {
    const rad = a.thermal.radiatorM2;
    const faceW = w * 0.94, faceH = h * 0.9;
    const frac = Math.min(1, rad / (faceW * faceH));
    const panel = box(faceW * Math.sqrt(frac), faceH * Math.sqrt(frac), 0.02, MAT.radiator);
    panel.position.set(0, 0, -d / 2 - 0.015); g.add(panel);
    if (rad > faceW * faceH) { const extra = box(faceW, Math.min(2.5, (rad - faceW * faceH) / faceW), 0.02, MAT.radiator); extra.rotation.x = Math.PI / 2; extra.position.set(0, -h * 0.1, -d / 2 - 0.35); g.add(extra); }
  }
  return g;
}

export interface BuiltCraft { group: THREE.Group; pickables: THREE.Object3D[]; ghosts: Map<string, THREE.Mesh>; slotBoxes: Map<string, SlotBox> }

/** Whole spacecraft from the real analysis. xray shows the interior (tanks with propellant level, batteries, computer, wheels). */
export function buildSpacecraft(a: Analysis, xray: boolean, highlightCat: string | null): BuiltCraft {
  const group = new THREE.Group();
  const pickables: THREE.Object3D[] = [];
  const ghosts = new Map<string, THREE.Mesh>();
  const slotBoxes = new Map<string, SlotBox>();
  const frame = a.frame;
  if (!frame) return { group, pickables, ghosts, slotBoxes };
  const bus = buildBus(frame, xray);
  group.add(bus);
  group.add(externalDetails(a));
  const fill = a.propulsion.tankCapacityKg > 0 ? a.mass.propellant / a.propulsion.tankCapacityKg : 0;
  const tracking = (a.design.arrayDrive ?? 'tracking') === 'tracking';
  for (const slot of frame.slots) {
    const pid = a.design.placements[slot.id];
    const placed = a.placed.find((p) => p.slotId === slot.id);
    const part = placed?.part ?? null;
    const sb = slotBox(frame, slot, part);
    slotBoxes.set(slot.id, sb);
    if (part && pid) {
      let obj: THREE.Object3D;
      switch (part.category) {
        case 'solar': obj = solarWing(part as SolarPart, slot.id === 'wing-l' ? -1 : 1, tracking, frame); obj.position.x += 0; break;
        case 'antenna': obj = antenna(part as AntennaPart); break;
        case 'instrument': obj = instrument(part as InstrumentPart); break;
        case 'engine': obj = engine(part as EnginePart); break;
        case 'tank': obj = tank(part as TankPart, fill); break;
        default: obj = internal(part);
      }
      if (part.category !== 'solar') obj.position.copy(slot.kind === 'mast' ? new THREE.Vector3(0, frame.dims.h / 2, 0) : slot.kind === 'aft' && part.category === 'engine' ? new THREE.Vector3(0, -frame.dims.h / 2 - 0.06, 0) : sb.pos);
      obj.userData = { slotId: slot.id, partId: pid };
      obj.traverse((o) => { o.userData.slotId = slot.id; o.userData.partId = pid; });
      // internal modules only drawn in X-ray; hidden inside an opaque bus otherwise
      if (!xray && (slot.kind === 'internal' || part.category === 'tank')) obj.visible = false;
      group.add(obj);
      pickables.push(obj);
    }
    // ghost placeholder: shown for empty slots and, in X-ray mode, as faint cages
    if (!part) {
      const gm = new THREE.Mesh(new THREE.BoxGeometry(sb.size.x, sb.size.y, sb.size.z), new THREE.MeshBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.0, depthWrite: false }));
      gm.position.copy(sb.pos);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(gm.geometry), new THREE.LineBasicMaterial({ color: slot.accepts.includes((highlightCat ?? '') as never) ? 0xffb000 : 0x4b5462, transparent: true, opacity: slot.accepts.includes((highlightCat ?? '') as never) ? 1 : 0.55 }));
      gm.add(edge);
      gm.userData = { slotId: slot.id, ghost: true, accepts: slot.accepts };
      const visibleKind = slot.kind !== 'internal' || xray;
      gm.visible = visibleKind;
      if (slot.accepts.includes((highlightCat ?? '') as never)) (gm.material as THREE.MeshBasicMaterial).opacity = 0.14;
      group.add(gm); ghosts.set(slot.id, gm); pickables.push(gm);
    }
  }
  return { group, pickables, ghosts, slotBoxes };
}

/* ---------- launch vehicle ---------- */
export function buildRocket(v: LaunchVehicle, boosterInfo: { type: string; count: number } | null, payload: THREE.Object3D | null, payloadSize: THREE.Vector3): { group: THREE.Group; height: number } {
  const g = new THREE.Group();
  const s1 = STAGES[v.stageIds[0]], s2 = STAGES[v.stageIds[1]];
  const baseS1 = boosterInfo ? STAGES[v.stageIds[0]] : s1;
  const coreD = boosterInfo ? Math.sqrt(Math.max(0.5, baseS1.diameterM * baseS1.diameterM - boosterInfo.count * ({ 'sb-s': 0.49, 'sb-m': 1.96, 'sb-h': 5.76 } as Record<string, number>)[boosterInfo.type])) : s1.diameterM;
  const d1 = Math.max(0.8, coreD), d2 = Math.max(0.8, s2.diameterM);
  const rho = (s: { ispVac: number }) => (s.ispVac > 400 ? 360 : 950);
  const coreProp = boosterInfo ? s1.propKg - boosterInfo.count * ({ 'sb-s': 4500, 'sb-m': 30000, 'sb-h': 115000 } as Record<string, number>)[boosterInfo.type] : s1.propKg;
  const L1 = Math.max(6, coreProp / (rho(s1) * Math.PI * (d1 / 2) ** 2) + 1.8);
  const L2 = Math.max(3, s2.propKg / (rho(s2) * Math.PI * (d2 / 2) ** 2) + 1.4);
  const white = MAT.white, steel = MAT.dark;
  let y = 0;
  const addCyl = (r: number, len: number, mat: THREE.Material, yy: number) => { const c = cyl(r, r, len, mat, 40); c.position.y = yy + len / 2; c.castShadow = true; c.receiveShadow = true; g.add(c); return c; };
  // engines under stage 1
  const nEng = Math.max(1, Math.min(9, Math.round(s1.thrustSL / 900e3)));
  const bellR = 0.05 + 0.00035 * Math.sqrt(s1.thrustSL / nEng);
  const ringR = nEng > 1 ? d1 * 0.28 : 0;
  for (let i = 0; i < nEng; i++) {
    const a = (i * 2 * Math.PI) / Math.max(1, nEng - 1); const cx = i === 0 || nEng === 1 ? 0 : Math.cos(a) * ringR, cz = i === 0 || nEng === 1 ? 0 : Math.sin(a) * ringR;
    const pts: THREE.Vector2[] = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector2(0.03 + (bellR - 0.03) * Math.pow(t, 0.55), -bellR * 2.2 * t)); }
    const bell = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), std({ color: 0x3a3d44, metalness: 0.85, roughness: 0.4, side: THREE.DoubleSide }));
    bell.position.set(cx, bellR * 2.2, cz); g.add(bell);
  }
  y = bellR * 2.2;
  addCyl(d1 / 2, L1, white, y); const band1 = addCyl(d1 / 2 * 1.002, 0.9, MAT.black, y + L1 * 0.12); void band1;
  const stripe = addCyl(d1 / 2 * 1.003, 0.5, MAT.red, y + L1 * 0.55); void stripe;
  for (let k = 1; k < L1 / 3.2; k++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(d1 / 2 * 1.004, 0.035, 6, 48), MAT.dark); ring.rotation.x = Math.PI / 2; ring.position.y = y + k * 3.2; g.add(ring); }
  y += L1;
  const inter = new THREE.Mesh(new THREE.CylinderGeometry(d2 / 2, d1 / 2, 0.9, 40), steel); inter.position.y = y + 0.45; g.add(inter); y += 0.9;
  addCyl(d2 / 2, L2, white, y); addCyl(d2 / 2 * 1.003, 0.35, MAT.blue, y + L2 * 0.5); y += L2;
  const topY = y;
  // boosters
  if (boosterInfo) {
    const B = ({ 'sb-s': { d: 0.7, p: 4500 }, 'sb-m': { d: 1.4, p: 30000 }, 'sb-h': { d: 2.4, p: 115000 } } as Record<string, { d: number; p: number }>)[boosterInfo.type];
    const Lb = Math.max(3, B.p / (1750 * Math.PI * (B.d / 2) ** 2) + B.d);
    for (let i = 0; i < boosterInfo.count; i++) {
      const a = (i * 2 * Math.PI) / boosterInfo.count + Math.PI / 6; const rr = d1 / 2 + B.d / 2 + 0.03;
      const bg = new THREE.Group();
      const body = cyl(B.d / 2, B.d / 2, Lb, MAT.whitePlain, 28); body.position.y = Lb / 2; body.castShadow = true; bg.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(B.d / 2, B.d * 1.5, 28), MAT.red); nose.position.y = Lb + B.d * 0.75; bg.add(nose);
      const nz = cyl(B.d * 0.2, B.d * 0.32, B.d * 0.45, MAT.dark, 20); nz.position.y = -B.d * 0.2; bg.add(nz);
      bg.position.set(Math.cos(a) * rr, y - topY + bellR * 2.2 + 0.0, Math.sin(a) * rr); bg.position.y = bellR * 2.2 + 0.4; g.add(bg);
    }
  }
  // fairing (translucent) with the payload inside
  const fd = v.fairingDiameterM, fl = Math.max(v.fairingLengthM, payloadSize.y + 0.5);
  const pts: THREE.Vector2[] = [new THREE.Vector2(fd / 2, 0), new THREE.Vector2(fd / 2, fl)];
  for (let i = 1; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2((fd / 2) * Math.sqrt(1 - t * t * 0.995) , fl + fd * 1.3 * t)); }
  const fairing = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), std({ color: 0xf2f4f7, metalness: 0.1, roughness: 0.4, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  fairing.position.y = topY; g.add(fairing);
  const adapter = cyl(Math.min(fd / 2, d2 / 2) * 0.9, d2 / 2, 0.3, MAT.dark, 32); adapter.position.y = topY + 0.15; g.add(adapter);
  if (payload) { payload.position.set(0, topY + 0.3 + payloadSize.y / 2, 0); g.add(payload); }
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), MAT.red); tip.position.y = topY + fl + fd * 1.3; g.add(tip);
  const height = topY + fl + fd * 1.3;
  // launch tower
  const tower = new THREE.Group();
  const towerH = Math.min(height * 0.82, 120), tx = d1 / 2 + (boosterInfo ? 2.6 : 1.4) + 2.5, tw = 2.2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = box(0.18, towerH, 0.18, MAT.red); p.position.set(sx * tw / 2, towerH / 2, sz * tw / 2); tower.add(p); }
  for (let i = 1; i < towerH / 4; i++) { const r = box(tw, 0.1, 0.1, MAT.whitePlain); r.position.set(0, i * 4, tw / 2); tower.add(r); const r2 = r.clone(); r2.position.z = -tw / 2; tower.add(r2); }
  tower.position.set(tx, 0, 0); g.add(tower);
  const arm = box(tx - d1 / 2 - 0.3, 0.2, 0.5, MAT.whitePlain); arm.position.set((tx + d1 / 2) / 2, Math.min(height * 0.7, towerH * 0.85), 0); g.add(arm);
  // pad
  const pad = cyl(Math.max(8, d1 * 3), Math.max(8, d1 * 3), 0.4, std({ color: 0x3a3f47, roughness: 0.9, metalness: 0.1 }), 48); pad.position.y = -0.2; pad.receiveShadow = true; g.add(pad);
  return { group: g, height };
}
