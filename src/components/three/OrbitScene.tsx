import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Analysis } from '../../engine/resourceManager';
import type { OrbitInfo } from '../../engine/orbitalMechanics';
import { buildSpacecraft } from './models';
import { createStage, disposeObject } from './stage';
import { WebglFallback, hasWebGL } from './webgl';
import { createPlanet, type Planet } from './planets';
import { milkyWay, starfield, sunGlow } from './textures';

export interface OrbitPreview { rpM: number; raM: number }
interface Props { info: OrbitInfo; a?: Analysis; preview?: OrbitPreview | null; height?: number; showComm?: boolean; speed?: number; label?: string; lightSeconds?: number; running?: boolean }

function solveKepler(M: number, e: number) { let E = e < 0.8 ? M : Math.PI; for (let i = 0; i < 25; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }

/** 3D orbit view around the correct body: textured planet, inclined orbit plane, the real spacecraft model, eclipse darkening and comm pulses. */
export default function OrbitScene({ info, a, preview, height = 380, showComm = true, speed = 1, label, lightSeconds, running = true }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ info, a, preview, showComm, speed, running });
  live.current = { info, a, preview, showComm, speed, running };
  const rb = useRef<(() => void) | null>(null);
  const sig = `${info.def.id}|${info.sel.perigeeKm}|${info.sel.apogeeKm}|${info.sel.incDeg}|${info.betaDeg}|${a ? a.mass.total + JSON.stringify(a.design.placements) : ''}|${preview ? preview.rpM + ',' + preview.raM : ''}`;

  useEffect(() => {
    if (!hasWebGL()) return;
    const el = host.current!;
    const st = createStage(el, height, 0x05070b, 0.95, { env: 'space', bloom: { strength: 0.6, radius: 0.7, threshold: 0.85 } });
    const { scene, camera, controls } = st;
    const sunDir = new THREE.Vector3(1, 0.12, 0.2).normalize();
    const sun = new THREE.DirectionalLight(0xfff2e0, 3.4); sun.position.copy(sunDir.clone().multiplyScalar(50)); scene.add(sun);
    scene.add(new THREE.AmbientLight(0x1a2236, 0.55));
    scene.add(milkyWay(1400)); scene.add(starfield(1800, 900));
    let planetObj: Planet | null = null;
    let world: THREE.Group | null = null;
    let sat: THREE.Group | null = null;
    let satMats: { m: THREE.MeshStandardMaterial; c: THREE.Color }[] = [];
    let curve = { a: 1, e: 0, rot: new THREE.Quaternion(), period: 1 };
    let pulses: THREE.Mesh[] = [];
    let commTarget = new THREE.Vector3(0, 0, 0);
    let commLine: THREE.Line | null = null;
    let planetR = 1;
    let isHalo = false;
    let rmax = 3;
    let anim = 0, eclipsed = false;

    const build = () => {
      const { info: I, a: A, preview: P } = live.current;
      if (world) { scene.remove(world); disposeObject(world); }
      world = new THREE.Group(); scene.add(world);
      isHalo = I.def.kind === 'halo';
      const R = I.body.radius;
      if (isHalo) {
        // schematic of the Sun-Earth L2 region (not to scale)
        planetR = 1;
        planetObj = createPlanet('earth', 1, sunDir); world.add(planetObj.group);
        const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd36a).multiplyScalar(5) })); sunMesh.position.set(60, 0, 0); world.add(sunMesh);
        const glowH = sunGlow(0xffd9a0, 46); glowH.position.copy(sunMesh.position); world.add(glowH);
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.2, 26, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })); cone.rotation.z = Math.PI / 2; cone.position.x = -13; world.add(cone);
        const l2 = new THREE.Vector3(-18, 0, 0);
        const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 120 }, (_, i) => new THREE.Vector3(l2.x, Math.cos((i / 120) * 6.2832) * 2.6, Math.sin((i / 120) * 6.2832) * 3.4))), new THREE.LineBasicMaterial({ color: 0xf2f4f7 })); world.add(ring);
        const mark = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffb000 })); mark.position.copy(l2); world.add(mark);
        curve = { a: 1, e: 0, rot: new THREE.Quaternion(), period: 1 };
        rmax = 22; commTarget = new THREE.Vector3(0, 0, 0);
        sat = A ? buildSpacecraft(A, false, null).group : new THREE.Group();
        const sz = new THREE.Box3().setFromObject(sat).getSize(new THREE.Vector3()); sat.scale.setScalar(1.2 / Math.max(sz.x, sz.y, sz.z, 0.1)); world.add(sat);
      } else {
        planetR = 1;
        const kind = I.def.bodyId === 'earth' ? 'earth' : I.def.bodyId === 'moon' ? 'moon' : I.def.bodyId === 'mars' ? 'mars' : 'asteroid';
        planetObj = createPlanet(kind, 1, sunDir); world.add(planetObj.group);
        const rp = I.rpM / R, ra = I.raM / R;
        const aa = (rp + ra) / 2, e = (ra - rp) / (ra + rp);
        // orbit plane: tilt by inclination, then rotate the node so the beta angle matches
        const inc = (I.incDeg * Math.PI) / 180;
        const beta = (I.betaDeg * Math.PI) / 180;
        const omega = Math.abs(Math.sin(inc)) > 1e-3 ? Math.asin(Math.min(1, Math.sin(beta) / Math.sin(inc))) : 0;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(inc, omega, 0, 'YXZ'));
        curve = { a: aa, e, rot: q, period: I.periodS };
        const line = (rpp: number, rap: number, color: number, dashed: boolean) => {
          const a2 = (rpp + rap) / 2, e2 = (rap - rpp) / (rap + rpp);
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= 240; i++) { const nu = (i / 240) * Math.PI * 2; const r = (a2 * (1 - e2 * e2)) / (1 + e2 * Math.cos(nu)); pts.push(new THREE.Vector3(Math.cos(nu) * r, 0, -Math.sin(nu) * r).applyQuaternion(q)); }
          const g = new THREE.BufferGeometry().setFromPoints(pts);
          const l = new THREE.Line(g, dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.08 }) : new THREE.LineBasicMaterial({ color }));
          if (dashed) l.computeLineDistances(); return l;
        };
        world.add(line(rp, ra, 0xf2f4f7, false));
        if (P && isFinite(P.raM)) world.add(line(P.rpM / R, P.raM / R, 0xffb000, true));
        rmax = Math.max(ra, P && isFinite(P.raM) ? P.raM / R : 0, 1.5);
        // sun marker and eclipse shadow cylinder
        const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(rmax * 0.12, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd36a).multiplyScalar(5) })); sunMesh.position.copy(sunDir.clone().multiplyScalar(rmax * 3.2)); world.add(sunMesh);
        const glow = sunGlow(0xffd9a0, rmax * 1.6); glow.position.copy(sunMesh.position); world.add(glow);
        const shadow = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, rmax * 3, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
        shadow.rotation.z = Math.PI / 2; shadow.position.copy(sunDir.clone().multiplyScalar(-rmax * 1.5)); shadow.lookAt(sunDir.clone().multiplyScalar(-100)); shadow.rotateX(Math.PI / 2); world.add(shadow);
        sat = new THREE.Group(); world.add(sat);
        const model = A ? buildSpacecraft(A, false, null).group : null;
        if (model) { const sz = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()); model.scale.setScalar((0.1 * rmax) / Math.max(sz.x, sz.y, sz.z, 0.1)); sat.add(model); }
        else sat.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0xffffff })));
        // communications target
        if (I.def.bodyId === 'earth') { const lat = 0.7, lon = 0.5; commTarget = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)).multiplyScalar(1.005); const gs = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), new THREE.MeshBasicMaterial({ color: 0x3fcf6b })); gs.position.copy(commTarget); world.add(gs); }
        else commTarget = new THREE.Vector3(0.8, 0.45, 0.6).normalize().multiplyScalar(rmax * 2.2);
      }
      satMats = [];
      sat?.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial) satMats.push({ m, c: m.color.clone() }); });
      // comm line + pulses
      commLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x7aa9f7, transparent: true, opacity: 0.35 }));
      world.add(commLine);
      pulses = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.012, rmax * 0.01), 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); world!.add(m); return m; });
      controls.minDistance = 1.3; controls.maxDistance = rmax * 9;
      const d = rmax * (isHalo ? 1.3 : 2.9) + 2;
      controls.target.set(isHalo ? -9 : 0, 0, 0); camera.position.set(isHalo ? -9 : 0, d * 0.35, d); camera.far = rmax * 60 + 500; camera.updateProjectionMatrix();
    };
    build(); rb.current = build;

    st.onFrame((dt) => {
      const L = live.current;
      planetObj?.update(dt);
      if (L.running) anim += dt * L.speed;
      const phase = (((anim * 2 * Math.PI) / 9) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      let pos = new THREE.Vector3();
      if (isHalo) pos.set(-18, Math.cos(phase) * 2.6, Math.sin(phase) * 3.4);
      else {
        const E = solveKepler(phase, curve.e);
        const nu = 2 * Math.atan2(Math.sqrt(1 + curve.e) * Math.sin(E / 2), Math.sqrt(1 - curve.e) * Math.cos(E / 2));
        const r = (curve.a * (1 - curve.e * curve.e)) / (1 + curve.e * Math.cos(nu));
        pos.set(Math.cos(nu) * r, 0, -Math.sin(nu) * r).applyQuaternion(curve.rot);
      }
      if (sat) {
        sat.position.copy(pos);
        // keep the nadir deck (+Z) pointing at the planet
        if (!isHalo) { sat.up.set(0, 1, 0); sat.lookAt(0, 0, 0); sat.rotateY(0); }
        else sat.lookAt(0, 0, 0);
        const inShadow = !isHalo && pos.dot(sunDir) < 0 && pos.clone().sub(sunDir.clone().multiplyScalar(pos.dot(sunDir))).length() < planetR;
        if (inShadow !== eclipsed) { eclipsed = inShadow; for (const s of satMats) { s.m.color.copy(s.c).multiplyScalar(inShadow ? 0.12 : 1); } }
      }
      if (commLine) { const g = commLine.geometry as THREE.BufferGeometry; g.setFromPoints([pos, commTarget]); commLine.visible = L.showComm; }
      pulses.forEach((p, i) => { p.visible = L.showComm; const t = ((anim * 0.5 + i / pulses.length) % 1); p.position.lerpVectors(pos, commTarget, t); });
    });
    return () => { rb.current = null; st.dispose(); };
  }, [height]);
  useEffect(() => { rb.current?.(); }, [sig]);

  if (!hasWebGL()) return <WebglFallback height={height} what="orbit view" />;
  return (
    <div ref={host} style={{ position: 'relative', height, border: '1px solid var(--line)' }}>
      <div style={{ position: 'absolute', left: 8, top: 6, fontSize: 'calc(11.5px * var(--ts, 1))', color: 'rgba(206, 214, 228, 0.8)', fontFamily: 'var(--mono)', pointerEvents: 'none' }}>{label ?? info.body.name.toUpperCase()} · T = {(info.periodS / 60).toFixed(1)} min · β {info.betaDeg.toFixed(0)}° · eclipse {(info.eclipseS / 60).toFixed(0)} min{lightSeconds ? ` · to Earth ${lightSeconds < 120 ? lightSeconds.toFixed(1) + ' s' : (lightSeconds / 60).toFixed(1) + ' min'} light time` : ''}</div>
      <div style={{ position: 'absolute', left: 8, bottom: 6, fontSize: 'calc(11.5px * var(--ts, 1))', color: 'rgba(206, 214, 228, 0.8)', fontFamily: 'var(--mono)', pointerEvents: 'none' }}>white: orbit · amber dashed: burn preview · drag to orbit the camera</div>
    </div>
  );
}
