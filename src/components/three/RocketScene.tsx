import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Analysis } from '../../engine/resourceManager';
import type { LaunchVehicle } from '../../types';
import { boosterInfo } from '../RocketStack';
import { skyDome } from './env';
import { buildRocket, buildSpacecraft } from './models';
import { createStage, disposeObject } from './stage';
import { WebglFallback, hasWebGL } from './webgl';
import { concrete, milkyWay, softPuff, starfield } from './textures';

/** 3D launch vehicle on its pad at dusk: stages, strap-on boosters, translucent fairing with the real spacecraft inside, tower, floodlights, vented vapour. */
export default function RocketScene({ vehicle, a, height = 460 }: { vehicle: LaunchVehicle; a: Analysis; height?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ vehicle, a });
  live.current = { vehicle, a };
  const rb = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!hasWebGL()) return;
    const el = host.current!;
    const st = createStage(el, height, 0x0a0f1c, 0.95, { env: 'dusk', bloom: { strength: 0.4, radius: 0.6, threshold: 1.1 } });
    const { scene, camera, controls } = st;
    scene.background = null;
    const fogColor = new THREE.Color().setRGB(0.16, 0.085, 0.055);
    scene.fog = new THREE.Fog(fogColor, 160, 900);
    const dome = skyDome('dusk'); dome.scale.setScalar(5); scene.add(dome);
    const stars = starfield(500, 900); (stars.material as THREE.PointsMaterial).opacity = 0.5; scene.add(milkyWay(1200), stars);
    const sun = new THREE.DirectionalLight(0xffb98a, 0.55); sun.position.set(40, 14, 60); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x5f78b8, 0x1a1512, 0.45));
    const concreteTex = concrete();
    const ground = new THREE.Mesh(new THREE.CircleGeometry(2400, 64), new THREE.MeshStandardMaterial({ map: concreteTex, color: 0x8a8f99, roughness: 0.92, envMapIntensity: 0.4 }));
    concreteTex.repeat.set(220, 220);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.41; ground.receiveShadow = true; scene.add(ground);
    let built: THREE.Group | null = null;
    let extras: THREE.Group | null = null;
    let vapor: THREE.Sprite[] = [];
    let sig = '';
    const rebuild = () => {
      const { vehicle: v, a: an } = live.current;
      const bi = boosterInfo(v);
      const key = [v.id, v.stageIds.join(), bi?.type, bi?.count, an.design.placements ? JSON.stringify(an.design.placements) : '', an.mass.total].join('|');
      if (key === sig) return; sig = key;
      if (built) { scene.remove(built); disposeObject(built); }
      if (extras) { scene.remove(extras); disposeObject(extras); }
      const craft = buildSpacecraft(an, false, null).group;
      const bb = new THREE.Box3().setFromObject(craft); const sz = bb.getSize(new THREE.Vector3());
      const sc = Math.min(1, (v.fairingDiameterM * 0.82) / Math.max(sz.x, sz.z), (v.fairingLengthM * 0.9) / sz.y);
      craft.scale.setScalar(sc);
      const out = buildRocket(v, bi, craft, sz.clone().multiplyScalar(sc));
      built = out.group; scene.add(built);
      const H = out.height;
      sun.shadow.camera.left = -H * 0.7; sun.shadow.camera.right = H * 0.7; sun.shadow.camera.top = H * 0.9; sun.shadow.camera.bottom = -H * 0.3; sun.shadow.camera.near = 1; sun.shadow.camera.far = H * 4; sun.shadow.camera.updateProjectionMatrix();
      sun.position.set(H * 0.6, H * 0.25, H * 0.9);
      // floodlight towers: emissive heads (bloom turns them into glows) and spot lights aimed at the vehicle
      extras = new THREE.Group();
      const Rf = Math.max(28, H * 0.95), Hf = Math.max(12, H * 0.32);
      const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.93, 0.8).multiplyScalar(14) });
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.7, roughness: 0.5 });
      for (const deg of [55, 150, 245]) {
        const ang = (deg * Math.PI) / 180; const px = Math.cos(ang) * Rf, pz = Math.sin(ang) * Rf;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, Hf, 8), poleMat); pole.position.set(px, Hf / 2, pz); extras.add(pole);
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.6), lampMat); head.position.set(px, Hf + 0.4, pz); head.lookAt(0, H * 0.4, 0); extras.add(head);
        const spot = new THREE.SpotLight(0xffe2bd, 1.5 * Rf * Rf, 0, 0.42, 0.75, 2); spot.position.set(px, Hf, pz); spot.target.position.set(0, H * 0.42, 0); extras.add(spot, spot.target);
      }
      // lox vapour drifting along the lower stage
      const puff = softPuff();
      vapor = Array.from({ length: 14 }, (_, i) => {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0.5, fog: true }));
        sp.userData = { phase: i / 14, ox: (Math.random() - 0.5) * 2.4, oz: (Math.random() - 0.5) * 2.4 };
        extras!.add(sp); return sp;
      });
      scene.add(extras);
      controls.maxDistance = H * 5; controls.minDistance = Math.max(3, H * 0.2);
      controls.target.set(0, H * 0.46, 0);
      camera.position.set(H * 1.05, H * 0.55, H * 1.45); camera.far = H * 40; camera.updateProjectionMatrix();
      (dome.scale as THREE.Vector3).setScalar(Math.max(5, H / 12));
    };
    rebuild();
    rb.current = rebuild;
    st.onFrame((dt, t) => {
      for (const sp of vapor) {
        const u = (t * 0.07 + sp.userData.phase) % 1;
        const rr = 0.6 + u * 3.2;
        sp.position.set(sp.userData.ox * (0.4 + u), 0.6 + u * 5, sp.userData.oz * (0.4 + u));
        sp.scale.setScalar(rr * 2.2);
        (sp.material as THREE.SpriteMaterial).opacity = 0.5 * Math.sin(u * Math.PI);
      }
      void dt;
    });
    return () => { rb.current = null; st.dispose(); };
  }, [height]);
  useEffect(() => { rb.current?.(); }, [vehicle, a]);
  if (!hasWebGL()) return <WebglFallback height={height} what="launch vehicle view" />;
  return (
    <div ref={host} style={{ position: 'relative', height, border: '1px solid var(--line)' }}>
      <div style={{ position: 'absolute', left: 8, bottom: 6, fontSize: 'calc(11.5px * var(--ts, 1))', color: 'rgba(206, 214, 228, 0.8)', fontFamily: 'var(--mono)', pointerEvents: 'none' }}>drag: orbit · wheel: zoom · spacecraft shown scaled to fit the fairing</div>
    </div>
  );
}

