// Image-based lighting built from simple emissive geometry, so metal and foil reflect something that looks like orbit
// (a hard white Sun, blue Earth-shine from below, black elsewhere) or a dusk launch site, instead of an indoor room.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type EnvKind = 'room' | 'space' | 'dusk';

function hdr(r: number, g: number, b: number, k: number) { return new THREE.Color(r * k, g * k, b * k); }

function spaceScene(): THREE.Scene {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), new THREE.MeshBasicMaterial({ color: 0x010206, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: hdr(1, 0.94, 0.82, 55) })); sun.position.set(34, 18, 26); s.add(sun);
  const earthShine = new THREE.Mesh(new THREE.SphereGeometry(34, 32, 16, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), new THREE.MeshBasicMaterial({ color: hdr(0.28, 0.5, 0.95, 2.2), side: THREE.BackSide }));
  earthShine.position.y = -2; s.add(earthShine);
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), new THREE.MeshBasicMaterial({ color: hdr(0.45, 0.55, 0.8, 0.9), side: THREE.DoubleSide })); fill.position.set(-30, 8, -25); fill.lookAt(0, 0, 0); s.add(fill);
  return s;
}

function duskScene(): THREE.Scene {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(80, 32, 24);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const top = hdr(0.03, 0.07, 0.2, 1.1), hor = hdr(0.8, 0.4, 0.22, 0.42), low = hdr(0.02, 0.018, 0.02, 1);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 80;
    const c = y >= 0 ? hor.clone().lerp(top, Math.pow(y, 0.3)) : hor.clone().multiplyScalar(0.25).lerp(low, Math.min(1, -y * 3));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 12), new THREE.MeshBasicMaterial({ color: hdr(1, 0.95, 0.85, 16) })); lamp.position.set(30, 26, 40); s.add(lamp);
  return s;
}

/** Prefiltered environment map for `scene.environment`; dispose the returned texture's generator with the renderer. */
export function makeEnvironment(renderer: THREE.WebGLRenderer, kind: EnvKind): { texture: THREE.Texture; dispose: () => void } {
  const pm = new THREE.PMREMGenerator(renderer);
  const src = kind === 'space' ? spaceScene() : kind === 'dusk' ? duskScene() : new RoomEnvironment();
  const rt = pm.fromScene(src, kind === 'room' ? 0.04 : 0.02);
  src.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose?.(); });
  return { texture: rt.texture, dispose: () => { rt.dispose(); pm.dispose(); } };
}

/** The dusk gradient also serves as a visible sky dome (same colours as the reflections). */
export function skyDome(kind: 'dusk'): THREE.Mesh {
  void kind;
  const s = duskScene();
  const m = s.children[0] as THREE.Mesh;
  m.scale.setScalar(6); m.renderOrder = -10; (m.material as THREE.MeshBasicMaterial).depthWrite = false; (m.material as THREE.MeshBasicMaterial).fog = false; (m.material as THREE.MeshBasicMaterial).toneMapped = true;
  m.geometry = m.geometry.clone();
  const c = m.geometry.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i), c.getY(i), c.getZ(i));
  return m;
}
