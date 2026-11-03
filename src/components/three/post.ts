// Post-processing chain: multisampled half-float render target -> bloom -> tone mapping and sRGB output.
// Bloom lets the Sun, city lights, thrusters and floodlights glow without faking it with sprites.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export interface BloomOptions { strength: number; radius: number; threshold: number }
export interface Post { render: () => void; setSize: (w: number, h: number) => void; dispose: () => void }

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, w: number, h: number, bloom?: BloomOptions): Post {
  if (!bloom) return { render: () => renderer.render(scene, camera), setSize: () => {}, dispose: () => {} };
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr); composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  const bp = new UnrealBloomPass(new THREE.Vector2(w, h), bloom.strength, bloom.radius, bloom.threshold);
  composer.addPass(bp);
  composer.addPass(new OutputPass());
  return {
    render: () => composer.render(),
    setSize: (nw, nh) => { composer.setSize(nw, nh); bp.resolution.set(nw, nh); },
    dispose: () => { composer.dispose(); rt.dispose(); },
  };
}
