// Shared three.js stage: renderer, camera, orbit controls, PBR environment, resize handling and clean disposal.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { makeEnvironment, type EnvKind } from './env';
import { createPost, type BloomOptions } from './post';

export interface Stage {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls;
  onFrame: (fn: (dt: number, t: number) => void) => void; dispose: () => void;
}

export function disposeObject(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
  });
}

export interface StageOptions { env?: EnvKind; bloom?: BloomOptions }

export function createStage(el: HTMLElement, height: number, background = 0x05070b, exposure = 0.9, opts: StageOptions = {}): Stage {
  const W = el.clientWidth || 800;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W, height);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block'; renderer.domElement.style.touchAction = 'none';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  const env = makeEnvironment(renderer, opts.env ?? 'room');
  scene.environment = env.texture;
  const camera = new THREE.PerspectiveCamera(36, W / height, 0.01, 5000);
  const post = createPost(renderer, scene, camera, W, height, opts.bloom);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  let frame: (dt: number, t: number) => void = () => {};
  let raf = 0, alive = true, last = performance.now();
  const loop = (now: number) => {
    if (!alive) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    frame(dt, now / 1000);
    controls.update();
    post.render();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  const ro = new ResizeObserver(() => { const w = el.clientWidth; if (w > 0) { renderer.setSize(w, height); post.setSize(w, height); camera.aspect = w / height; camera.updateProjectionMatrix(); } });
  ro.observe(el);
  return {
    renderer, scene, camera, controls, onFrame: (fn) => { frame = fn; },
    dispose: () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); disposeObject(scene); post.dispose(); env.dispose(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
