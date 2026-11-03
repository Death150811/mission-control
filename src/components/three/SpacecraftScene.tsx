import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { makeEnvironment } from './env';
import { createPost, type Post } from './post';
import { WebglFallback, hasWebGL } from './webgl';
import type { Analysis } from '../../engine/resourceManager';
import { PARTS } from '../../data/spacecraftComponents';
import { createPlanet } from './planets';
import { milkyWay, starfield, sunGlow } from './textures';
import { buildSpacecraft, type BuiltCraft } from './models';

interface Props {
  a: Analysis;
  highlightCat: string | null;
  selectedSlot: string | null;
  onSlot: (slotId: string) => void;
  onDropPart: (slotId: string, partId: string) => void;
  height?: number;
  interactive?: boolean;
  defaultXray?: boolean;
}

function disposeObject(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
  });
}

/** Real 3D spacecraft: PBR materials, shadows, orbit camera, X-ray interior, hover/click/drag-and-drop on 3D slots. */
export default function SpacecraftScene({ a, highlightCat, selectedSlot, onSlot, onDropPart, height = 520, interactive = true, defaultXray = true }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [xray, setXray] = useState(defaultXray);
  const [rotate, setRotate] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const ref = useRef<{
    post: Post; renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; craft: BuiltCraft | null;
    hover: THREE.Box3Helper; sel: THREE.Box3Helper; raycaster: THREE.Raycaster; fitted: boolean; frameId: string;
  } | null>(null);
  const live = useRef({ a, highlightCat, selectedSlot, onSlot, onDropPart, rotate, interactive });
  live.current = { a, highlightCat, selectedSlot, onSlot, onDropPart, rotate, interactive };

  // ---- one-time scene setup ----
  useEffect(() => {
    if (!hasWebGL()) return;
    const el = host.current!;
    const W = el.clientWidth || 800;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W, height);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block'; renderer.domElement.style.touchAction = 'none';
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070b);
    const env = makeEnvironment(renderer, 'space');
    scene.environment = env.texture;
    renderer.toneMappingExposure = 0.95;
    const camera = new THREE.PerspectiveCamera(36, W / height, 0.05, 2000);
    const post = createPost(renderer, scene, camera, W, height, { strength: 0.28, radius: 0.5, threshold: 1.8 });
    camera.position.set(4.2, 2.4, 6.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 1.2; controls.maxDistance = 30; controls.autoRotateSpeed = 1.1;
    const sun = new THREE.DirectionalLight(0xfff2e0, 3.0); sun.position.set(6, 5, 7); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -7; sun.shadow.camera.right = 7; sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -7; sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 40; sun.shadow.bias = -0.0004;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x6f8fd6, 0x161922, 0.45));
    const rim = new THREE.DirectionalLight(0x7aa9f7, 0.9); rim.position.set(-6, 2, -6); scene.add(rim);
    scene.add(milkyWay(1400)); scene.add(starfield());
    // backdrop: the body this mission goes to (Earth for Earth-orbit and deep-space missions)
    const tgt = live.current.a.scenario.target;
    const backdrop = createPlanet(tgt === 'moon' ? 'moon' : tgt === 'mars' ? 'mars' : tgt === 'asteroid' ? 'asteroid' : 'earth', tgt === 'asteroid' ? 9 : 30, new THREE.Vector3(0.9, 0.3, 0.32).normalize());
    const earth = backdrop.group; earth.position.set(-45, -62, -150); scene.add(earth);
    const sunDisc = sunGlow(0xffe2b0, 60); sunDisc.position.set(260, 150, 190); scene.add(sunDisc);
    const hover = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(0xffb000)); hover.visible = false; scene.add(hover);
    const sel = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(0xfc3d21)); sel.visible = false; scene.add(sel);
    const state = { post, renderer, scene, camera, controls, craft: null as BuiltCraft | null, hover, sel, raycaster: new THREE.Raycaster(), fitted: false, frameId: '' };
    ref.current = state;
    let raf = 0, alive = true;
    const loop = () => {
      if (!alive) return;
      controls.autoRotate = live.current.rotate;
      controls.update();
      backdrop.update(0.016); backdrop.surface.rotation.y += 0.0004;
      post.render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(() => { const w = el.clientWidth; if (w > 0) { renderer.setSize(w, height); post.setSize(w, height); camera.aspect = w / height; camera.updateProjectionMatrix(); } });
    ro.observe(el);
    return () => {
      alive = false; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      if (state.craft) disposeObject(state.craft.group);
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      post.dispose(); env.dispose(); renderer.dispose(); renderer.domElement.remove(); ref.current = null;
    };
  }, [height]);

  // ---- rebuild the craft whenever the real design changes ----
  useEffect(() => {
    const s = ref.current; if (!s) return;
    if (s.craft) { s.scene.remove(s.craft.group); disposeObject(s.craft.group); }
    const craft = buildSpacecraft(a, xray, highlightCat);
    s.scene.add(craft.group); s.craft = craft;
    if (!s.fitted || s.frameId !== a.frame?.id) {
      const bb = new THREE.Box3().setFromObject(craft.group);
      const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
      const dist = Math.max(sz.x * 0.9, sz.y * 1.4, sz.z) * 1.15 + 1.8;
      s.controls.target.copy(c); s.camera.position.set(c.x + dist * 0.62, c.y + dist * 0.34, c.z + dist * 0.78);
      s.fitted = true; s.frameId = a.frame?.id ?? '';
    }
    const place = (h: THREE.Box3Helper, slot: string | null) => {
      if (!slot) { h.visible = false; return; }
      const obj = craft.pickables.find((p) => p.userData.slotId === slot);
      if (!obj) { h.visible = false; return; }
      h.box.setFromObject(obj); h.visible = true;
    };
    place(s.sel, selectedSlot);
  }, [a, xray, highlightCat, selectedSlot]);

  const pick = (clientX: number, clientY: number): string | null => {
    const s = ref.current; if (!s || !s.craft) return null;
    const r = s.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    s.raycaster.setFromCamera(ndc, s.camera);
    const hits = s.raycaster.intersectObjects(s.craft.pickables.filter((p) => p.visible), true);
    for (const h of hits) { let o: THREE.Object3D | null = h.object; while (o) { if (o.userData.slotId) return o.userData.slotId as string; o = o.parent; } }
    return null;
  };
  const label = (slotId: string) => {
    const slot = a.frame?.slots.find((x) => x.id === slotId); const pid = a.design.placements[slotId];
    return `${slot?.label ?? slotId}: ${pid ? PARTS[pid]?.name : 'empty'}`;
  };
  const onMove = (e: React.PointerEvent) => {
    const s = ref.current; if (!s || !live.current.interactive) return;
    const id = pick(e.clientX, e.clientY);
    if (id && s.craft) { const obj = s.craft.pickables.find((p) => p.userData.slotId === id); if (obj) { s.hover.box.setFromObject(obj); s.hover.visible = true; } } else s.hover.visible = false;
    const r = host.current!.getBoundingClientRect();
    setTip(id ? { x: e.clientX - r.left + 14, y: e.clientY - r.top + 10, text: label(id) } : null);
  };
  const down = useRef<{ x: number; y: number } | null>(null);
  const view = (v: 'iso' | 'front' | 'side' | 'top') => {
    const s = ref.current; if (!s || !s.craft) return;
    const bb = new THREE.Box3().setFromObject(s.craft.group); const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    const dist = Math.max(sz.x * 0.9, sz.y * 1.4, sz.z) * 1.15 + 1.8;
    const dirs = { iso: [0.7, 0.38, 0.85], front: [0, 0.05, 1], side: [1, 0.05, 0], top: [0, 1, 0.001] } as const;
    const d = dirs[v]; s.controls.target.copy(c); s.camera.position.set(c.x + d[0] * dist, c.y + d[1] * dist, c.z + d[2] * dist);
  };

  if (!hasWebGL()) return <WebglFallback height={height} what="spacecraft assembly view" />;
  return (
    <div ref={host} style={{ position: 'relative', height, border: '1px solid var(--line)', background: '#05070b' }}
      onPointerMove={onMove} onPointerLeave={() => { setTip(null); if (ref.current) ref.current.hover.visible = false; }}
      onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={(e) => { const d = down.current; down.current = null; if (!d || !live.current.interactive) return; if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return; const id = pick(e.clientX, e.clientY); if (id) live.current.onSlot(id); }}
      onDragOver={(e) => { e.preventDefault(); const id = pick(e.clientX, e.clientY); const s = ref.current; if (s && s.craft) { const obj = id ? s.craft.pickables.find((p) => p.userData.slotId === id) : null; if (obj) { s.hover.box.setFromObject(obj); s.hover.visible = true; } else s.hover.visible = false; } }}
      onDrop={(e) => { e.preventDefault(); const pid = e.dataTransfer.getData('text/part'); const id = pick(e.clientX, e.clientY); if (pid && id) live.current.onDropPart(id, pid); else if (pid) { const part = PARTS[pid]; const slot = a.frame?.slots.find((sl) => sl.accepts.includes(part.category) && !a.design.placements[sl.id]); if (slot) live.current.onDropPart(slot.id, pid); } }}>
      <div style={{ position: 'absolute', left: 8, top: 8, display: 'flex', gap: 4, flexWrap: 'wrap', zIndex: 2 }}>
        <button className={`chip ${xray ? 'on' : ''}`} onClick={() => setXray(!xray)} aria-pressed={xray}>X-ray interior</button>
        <button className={`chip ${rotate ? 'on' : ''}`} onClick={() => setRotate(!rotate)} aria-pressed={rotate}>Auto-rotate</button>
        {(['iso', 'front', 'side', 'top'] as const).map((v) => <button key={v} className="chip" onClick={() => view(v)}>{v}</button>)}
      </div>
      <div style={{ position: 'absolute', left: 8, bottom: 6, fontSize: 'calc(11.5px * var(--ts, 1))', color: 'rgba(206, 214, 228, 0.8)', fontFamily: 'var(--mono)', pointerEvents: 'none' }}>drag: orbit · wheel: zoom · right-drag: pan · click or drop a part on an amber slot</div>
      {tip && <div style={{ position: 'absolute', left: tip.x, top: tip.y, background: '#000c', border: '1px solid var(--line2)', padding: '2px 8px', fontSize: 'calc(12px * var(--ts, 1))', pointerEvents: 'none', zIndex: 3, whiteSpace: 'nowrap' }}>{tip.text}</div>}
    </div>
  );
}
