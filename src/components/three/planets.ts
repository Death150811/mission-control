// Procedural planets. Everything is computed at runtime from 3-D noise sampled ON THE SPHERE (no seams, no pole pinching):
// no image files are shipped or downloaded. Stylised, not maps of the real bodies.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type PlanetKind = 'earth' | 'moon' | 'mars' | 'asteroid';
export interface Planet { group: THREE.Group; surface: THREE.Mesh; update: (dt: number) => void }

/* ---------- 3-D value noise ---------- */
function h3(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vn3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const a = h3(xi, yi, zi), b = h3(xi + 1, yi, zi), c = h3(xi, yi + 1, zi), d = h3(xi + 1, yi + 1, zi);
  const e = h3(xi, yi, zi + 1), f = h3(xi + 1, yi, zi + 1), g = h3(xi, yi + 1, zi + 1), h = h3(xi + 1, yi + 1, zi + 1);
  const x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (h - g) * u;
  const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
  return y1 + (y2 - y1) * w;
}
function fbm3(x: number, y: number, z: number, oct: number): number {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let o = 0; o < oct; o++) { s += a * vn3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
function ridged3(x: number, y: number, z: number, oct: number): number {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let o = 0; o < oct; o++) { const r = 1 - Math.abs(2 * vn3(x * f, y * f, z * f) - 1); s += a * r * r; n += a; a *= 0.5; f *= 2.1; }
  return s / n;
}
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
type RGB = [number, number, number];
const mix3 = (a: RGB, b: RGB, t: number): RGB => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}
function toTex(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Sphere direction for an equirectangular pixel. */
function dirAt(x: number, y: number, W: number, H: number): [number, number, number, number] {
  const lon = (x / W - 0.5) * Math.PI * 2, lat = (0.5 - y / H) * Math.PI;
  const cl = Math.cos(lat);
  return [cl * Math.cos(lon), Math.sin(lat), cl * Math.sin(lon), lat];
}

/** Impact craters drawn into an equirectangular canvas. `bump` draws the height profile, otherwise a subtle albedo overlay. */
function drawCraters(g: CanvasRenderingContext2D, W: number, H: number, count: number, seed: number, bump: boolean, big = 46) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * W, y = (0.06 + 0.88 * r()) * H;
    const lat = (0.5 - y / H) * Math.PI;
    const rad = 1.6 + Math.pow(r(), 3.2) * big;
    const stretch = 1 / Math.max(0.22, Math.cos(lat));
    for (const dx of [0, -W, W]) {
      const cx = x + dx; if (cx < -rad * stretch * 2 || cx > W + rad * stretch * 2) continue;
      g.save(); g.translate(cx, y); g.scale(stretch, 1);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rad * 1.35);
      if (bump) {
        const depth = Math.min(0.3, 0.09 + rad / 190);
        gr.addColorStop(0, `rgba(0,0,0,${depth})`); gr.addColorStop(0.55, `rgba(0,0,0,${depth * 0.55})`); gr.addColorStop(0.74, 'rgba(255,255,255,0.0)');
        gr.addColorStop(0.86, `rgba(255,255,255,${Math.min(0.32, depth * 0.9)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      } else {
        const fresh = r() > 0.82;
        gr.addColorStop(0, 'rgba(0,0,0,0.10)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.04)'); gr.addColorStop(0.86, `rgba(255,255,255,${fresh ? 0.22 : 0.07})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      }
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rad * 1.35, 0, 7); g.fill();
      g.restore();
    }
  }
}

/* ---------- Earth ---------- */
interface EarthMaps { day: THREE.CanvasTexture; spec: THREE.CanvasTexture; lights: THREE.CanvasTexture; clouds: THREE.CanvasTexture }
let earthCache: EarthMaps | null = null;
function earthMaps(): EarthMaps {
  if (earthCache) return earthCache;
  const W = 1024, H = 512;
  const [dc, dg] = canvas(W, H), [sc, sg] = canvas(W, H), [lc, lg] = canvas(W, H), [cc, cg] = canvas(W, H);
  const di = dg.createImageData(W, H), si = sg.createImageData(W, H), li = lg.createImageData(W, H), ci = cg.createImageData(W, H);
  const SEA = 0.54;
  const JUNGLE: RGB = [20, 66, 28], TEMP: RGB = [66, 98, 40], TUNDRA: RGB = [112, 116, 98], SAND: RGB = [188, 158, 104], ROCK: RGB = [112, 100, 90];
  const DEEP: RGB = [3, 14, 44], MID: RGB = [5, 38, 84], COAST: RGB = [22, 98, 118];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [px, py, pz, lat] = dirAt(x, y, W, H);
    const alat = Math.abs(lat);
    const w = fbm3(px * 1.7 + 3.1, py * 1.7 + 1.3, pz * 1.7 + 7.7, 3);
    const c = fbm3(px * 1.35 + w * 0.9, py * 1.35 + w * 0.9, pz * 1.35 - w * 0.7, 5);
    const i = (y * W + x) * 4;
    let col: RGB; let ocean = 0; let lights = 0;
    const capNoise = (fbm3(px * 4 + 20, py * 4, pz * 4, 3) - 0.5) * 0.22;
    if (c > SEA) {
      const e = (c - SEA) / (1 - SEA);
      const moist = fbm3(px * 3.2 + 9, py * 3.2, pz * 3.2 + 4, 3);
      const rid = ridged3(px * 5 + 2, py * 5, pz * 5, 3);
      let base = mix3(JUNGLE, TEMP, smooth(0.25, 0.75, alat));
      base = mix3(base, TUNDRA, smooth(0.95, 1.2, alat));
      const arid = clamp01((0.56 - moist) * 4.2) * (alat > 0.2 && alat < 0.7 ? 1 : 0.3);
      base = mix3(base, SAND, arid);
      const mtn = smooth(0.1, 0.34, e) * rid;
      base = mix3(base, ROCK, clamp01(mtn * 1.3));
      const snow = smooth(0.3, 0.46, e + (alat - 0.9) * 0.35 + (rid - 0.5) * 0.12);
      base = mix3(base, [238, 242, 246], snow);
      const shade = 0.82 + 0.36 * fbm3(px * 14, py * 14, pz * 14, 2);
      col = [base[0] * shade, base[1] * shade, base[2] * shade];
      if (alat > 1.27 + capNoise) col = [236, 241, 247];
      const dens = smooth(0.56, 0.74, fbm3(px * 7 + 11, py * 7, pz * 7, 3)) * (1 - smooth(0.7, 1.1, alat)) * (e < 0.28 ? 1 : 0.15);
      const spark = vn3(px * 110, py * 110, pz * 110) > 0.8 ? 1 : 0;
      lights = dens * (0.18 + 0.82 * spark) + dens * dens * 0.3;
    } else {
      const d = (SEA - c) / SEA;
      let o = mix3(DEEP, MID, smooth(0.55, 0.12, d));
      o = mix3(o, COAST, smooth(0.14, 0.0, d) * 0.92);
      col = o; ocean = 1;
      if (alat > 1.33 + capNoise) { col = [214, 228, 238]; ocean = 0.25; }
    }
    di.data[i] = col[0]; di.data[i + 1] = col[1]; di.data[i + 2] = col[2]; di.data[i + 3] = 255;
    const sp = ocean * 255; si.data[i] = sp; si.data[i + 1] = sp; si.data[i + 2] = sp; si.data[i + 3] = 255;
    li.data[i] = Math.min(255, lights * 330); li.data[i + 1] = Math.min(255, lights * 235); li.data[i + 2] = Math.min(255, lights * 120); li.data[i + 3] = 255;
  }
  // clouds are drawn at a coarser noise scale with their own warp; alpha carries the density
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [px, py, pz, lat] = dirAt(x, y, W, H);
    const w1 = fbm3(px * 2.1 + 40, py * 2.1, pz * 2.1, 3), w2 = fbm3(px * 2.1, py * 2.1 + 40, pz * 2.1, 3);
    const cl = fbm3(px * 2.9 + w1 * 1.3, py * 3.4 + w2 * 1.1, pz * 2.9 + w1 * 0.8, 5);
    const band = 0.5 + 0.5 * Math.cos(lat * 6.2 + 0.4);
    const a = smooth(0.5 - 0.06 * band, 0.78, cl);
    const i = (y * W + x) * 4;
    ci.data[i] = 255; ci.data[i + 1] = 255; ci.data[i + 2] = 255; ci.data[i + 3] = a * 235;
  }
  dg.putImageData(di, 0, 0); sg.putImageData(si, 0, 0); lg.putImageData(li, 0, 0); cg.putImageData(ci, 0, 0);
  earthCache = { day: toTex(dc, true), spec: toTex(sc, false), lights: toTex(lc, true), clouds: toTex(cc, true) };
  return earthCache;
}

const EARTH_VERT = `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`;
const EARTH_FRAG = `uniform sampler2D uDay; uniform sampler2D uSpec; uniform sampler2D uLights; uniform vec3 uSun;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vec3 N = normalize(vN), V = normalize(vV), L = normalize(uSun);
  float ndl = dot(N, L);
  vec3 day = texture2D(uDay, vUv).rgb;
  float oc = texture2D(uSpec, vUv).r;
  vec3 col = day * (max(ndl, 0.0) * 1.45 + 0.012);
  float tw = exp(-pow(ndl / 0.16, 2.0));
  col += day * tw * vec3(0.95, 0.38, 0.12) * 0.32;
  vec3 H = normalize(L + V);
  float nh = max(dot(N, H), 0.0);
  col += vec3(1.0, 0.94, 0.84) * oc * (pow(nh, 140.0) * 2.4 + pow(nh, 24.0) * 0.16) * smoothstep(0.0, 0.2, ndl);
  float night = 1.0 - smoothstep(-0.14, 0.05, ndl);
  col += texture2D(uLights, vUv).rgb * night * 2.8;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += vec3(0.22, 0.46, 1.0) * fres * (0.04 + 0.96 * smoothstep(-0.2, 0.5, ndl)) * 0.85;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const CLOUD_FRAG = `uniform sampler2D uClouds; uniform vec3 uSun; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vec3 N = normalize(vN), L = normalize(uSun);
  float ndl = dot(N, L);
  float a = texture2D(uClouds, vUv).a;
  float lit = smoothstep(-0.12, 0.45, ndl);
  vec3 col = vec3(1.0) * (0.012 + 1.25 * lit);
  float tw = exp(-pow(ndl / 0.16, 2.0));
  col += vec3(0.95, 0.4, 0.15) * tw * 0.28;
  gl_FragColor = vec4(col, a * 0.94);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Rayleigh-style limb glow: strongest just above the surface, fading to nothing at the outer edge, warm near the terminator. */
export function atmosphereShell(radius: number, color: THREE.ColorRepresentation, sun: THREE.Vector3, opts: { thickness?: number; intensity?: number; power?: number; warm?: boolean } = {}): THREE.Mesh {
  const ratio = 1 + (opts.thickness ?? 0.065);
  const mat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uSun: { value: sun }, uRatio: { value: ratio }, uPow: { value: opts.power ?? 2.2 }, uK: { value: opts.intensity ?? 1.5 }, uWarm: { value: opts.warm === false ? 0 : 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: `uniform vec3 uColor; uniform vec3 uSun; uniform float uRatio; uniform float uPow; uniform float uK; uniform float uWarm; varying vec3 vN; varying vec3 vV;
    void main(){
      vec3 N = normalize(vN), V = normalize(vV), L = normalize(uSun);
      float edge = sqrt(1.0 - 1.0 / (uRatio * uRatio));
      float t = clamp(-dot(N, V) / edge, 0.0, 1.0);
      float I = pow(t, uPow);
      float ndl = dot(N, L);
      float sunLit = smoothstep(-0.5, 0.4, ndl);
      vec3 c = mix(uColor, vec3(1.0, 0.5, 0.2), uWarm * exp(-pow(ndl / 0.2, 2.0)) * 0.75);
      gl_FragColor = vec4(c * I * (0.03 + 0.97 * sunLit) * uK, 1.0);
    }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * ratio, 96, 64), mat);
}

/* ---------- Moon / Mars (albedo + height maps for MeshStandardMaterial) ---------- */
const stdCache = new Map<string, { map: THREE.CanvasTexture; bump: THREE.CanvasTexture }>();
function rockyMaps(kind: 'moon' | 'mars'): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const hit = stdCache.get(kind); if (hit) return hit;
  const W = 1024, H = 512;
  const [mc, mg] = canvas(W, H), [bc, bg] = canvas(W, H);
  const mi = mg.createImageData(W, H), bi = bg.createImageData(W, H);
  const moon = kind === 'moon';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [px, py, pz, lat] = dirAt(x, y, W, H);
    const alat = Math.abs(lat);
    const i = (y * W + x) * 4;
    let r: number, g: number, b: number, hgt: number;
    if (moon) {
      const fine = fbm3(px * 9, py * 9, pz * 9, 4), coarse = fbm3(px * 2.2 + 5, py * 2.2, pz * 2.2, 4);
      const mare = smooth(0.52, 0.6, fbm3(px * 1.5 + 11, py * 1.5, pz * 1.5, 3)) * (1 - smooth(1.0, 1.35, alat));
      let s = 118 + 62 * coarse + 38 * (fine - 0.5);
      const rid = ridged3(px * 4, py * 4, pz * 4, 3);
      s *= 1 + 0.18 * (rid - 0.4) * (1 - mare);
      s = mix(s, s * 0.46, mare);
      r = s * 1.0; g = s * 0.985; b = s * (0.96 + 0.05 * mare);
      hgt = 0.5 + 0.22 * (coarse - 0.5) + 0.1 * (fine - 0.5) - 0.12 * mare;
    } else {
      const dust = fbm3(px * 3 + 3, py * 3, pz * 3, 5), fine = fbm3(px * 11, py * 11, pz * 11, 3);
      const dark = smooth(0.5, 0.6, fbm3(px * 1.6 + 9, py * 1.6, pz * 1.6, 4));
      const rid = ridged3(px * 5, py * 5, pz * 5, 3);
      let c: RGB = mix3([176, 98, 56], [206, 138, 84], smooth(0.35, 0.7, dust));
      c = mix3(c, [86, 56, 44], dark * 0.82);
      const shade = 0.86 + 0.28 * fine + 0.12 * (rid - 0.4);
      r = c[0] * shade; g = c[1] * shade; b = c[2] * shade;
      const cap = 1.31 + (fbm3(px * 5 + 30, py * 5, pz * 5, 3) - 0.5) * 0.2;
      if (alat > cap) { r = 238; g = 232; b = 226; }
      hgt = 0.5 + 0.26 * (dust - 0.5) + 0.2 * rid - 0.08 * dark;
    }
    mi.data[i] = r; mi.data[i + 1] = g; mi.data[i + 2] = b; mi.data[i + 3] = 255;
    const hv = clamp01(hgt) * 255; bi.data[i] = hv; bi.data[i + 1] = hv; bi.data[i + 2] = hv; bi.data[i + 3] = 255;
  }
  mg.putImageData(mi, 0, 0); bg.putImageData(bi, 0, 0);
  drawCraters(mg, W, H, moon ? 380 : 200, moon ? 11 : 23, false, moon ? 30 : 20);
  drawCraters(bg, W, H, moon ? 1100 : 420, moon ? 11 : 23, true, moon ? 30 : 20);
  if (moon) {
    // bright ray system around a young crater
    const r = rng(77); mg.save(); mg.translate(W * 0.31, H * 0.64); mg.strokeStyle = 'rgba(255,255,255,0.10)'; mg.lineWidth = 1.4;
    for (let i = 0; i < 46; i++) { const a = r() * 6.283, L = 30 + r() * 110; mg.beginPath(); mg.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); mg.lineTo(Math.cos(a) * L, Math.sin(a) * L * 0.8); mg.stroke(); }
    mg.restore();
  } else {
    // a long dark canyon and one large shield volcano
    mg.save(); mg.strokeStyle = 'rgba(46,24,16,0.62)'; mg.lineCap = 'round';
    for (let k = 0; k < 3; k++) { mg.lineWidth = 7 - k * 2; mg.beginPath(); mg.moveTo(W * 0.2, H * (0.545 + k * 0.006)); mg.bezierCurveTo(W * 0.24, H * (0.55 + k * 0.01), W * 0.29, H * (0.535 + k * 0.01), W * 0.34, H * (0.55 + k * 0.004)); mg.stroke(); }
    mg.restore();
    const vol = bg.createRadialGradient(W * 0.14, H * 0.42, 0, W * 0.14, H * 0.42, 40); vol.addColorStop(0, 'rgba(255,255,255,0.8)'); vol.addColorStop(0.6, 'rgba(255,255,255,0.4)'); vol.addColorStop(1, 'rgba(255,255,255,0)');
    bg.fillStyle = vol; bg.beginPath(); bg.arc(W * 0.14, H * 0.42, 40, 0, 7); bg.fill();
  }
  const out = { map: toTex(mc, true), bump: toTex(bc, false) };
  stdCache.set(kind, out);
  return out;
}

/* ---------- asteroid: displaced, indexed icosphere with vertex colours ---------- */
function asteroidGeometry(): THREE.BufferGeometry {
  const base = new THREE.IcosahedronGeometry(1, 48);
  base.deleteAttribute('uv'); base.deleteAttribute('normal');
  const geo = mergeVertices(base, 1e-4);
  const r = rng(404);
  const craters = Array.from({ length: 70 }, () => {
    const u = r() * 2 - 1, a = r() * 6.283, s = Math.sqrt(1 - u * u);
    return { c: new THREE.Vector3(s * Math.cos(a), u, s * Math.sin(a)), rho: 0.07 + Math.pow(r(), 2.2) * 0.5 };
  });
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).normalize();
    let rad = 1 + 0.34 * (fbm3(p.x * 1.2 + 4, p.y * 1.2, p.z * 1.2, 3) - 0.5) + 0.07 * (fbm3(p.x * 4.5, p.y * 4.5, p.z * 4.5, 3) - 0.5) + 0.012 * (vn3(p.x * 22, p.y * 22, p.z * 22) - 0.5);
    let shade = 0;
    for (const cr of craters) {
      const ang = Math.acos(Math.min(1, Math.max(-1, p.dot(cr.c)))); const t = ang / cr.rho;
      if (t < 1.35) {
        const depth = 0.16 * cr.rho + 0.01;
        if (t < 1) { rad -= depth * (1 - t * t); shade -= 0.1 * (1 - t); }
        rad += depth * 0.55 * Math.exp(-Math.pow((t - 1.02) / 0.14, 2));
        shade += 0.12 * Math.exp(-Math.pow((t - 1.05) / 0.2, 2));
      }
    }
    pos.setXYZ(i, p.x * rad * 1.18, p.y * rad * 0.82, p.z * rad * 0.96);
    const s = 0.2 + 0.1 * fbm3(p.x * 7, p.y * 7, p.z * 7, 3) + 0.05 * shade;
    col[i * 3] = s * 1.02; col[i * 3 + 1] = s * 0.97; col[i * 3 + 2] = s * 0.9;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Build a planet of `radius` lit by the shared world-space `sun` direction (pointing from the planet towards the Sun). */
export function createPlanet(kind: PlanetKind, radius: number, sun: THREE.Vector3): Planet {
  const group = new THREE.Group();
  let surface: THREE.Mesh;
  let clouds: THREE.Mesh | null = null;
  if (kind === 'earth') {
    const m = earthMaps();
    const mat = new THREE.ShaderMaterial({
      uniforms: { uDay: { value: m.day }, uSpec: { value: m.spec }, uLights: { value: m.lights }, uSun: { value: sun } },
      vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG,
    });
    surface = new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 96), mat);
    clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.011, 128, 96), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uClouds: { value: m.clouds }, uSun: { value: sun } }, vertexShader: EARTH_VERT, fragmentShader: CLOUD_FRAG,
    }));
    group.add(surface, clouds, atmosphereShell(radius, 0x4c8dff, sun, { thickness: 0.07, intensity: 1.7, power: 2.0 }));
    group.rotation.z = 0.41;
  } else if (kind === 'asteroid') {
    surface = new THREE.Mesh(asteroidGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.02, envMapIntensity: 0.1 }));
    surface.scale.setScalar(radius);
    group.add(surface);
  } else {
    const m = rockyMaps(kind);
    surface = new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 96), new THREE.MeshStandardMaterial({ map: m.map, bumpMap: m.bump, bumpScale: kind === 'moon' ? 1.5 : 1.3, roughness: 0.97, metalness: 0, envMapIntensity: 0.1 }));
    group.add(surface);
    if (kind === 'mars') group.add(atmosphereShell(radius, 0xd8895a, sun, { thickness: 0.035, intensity: 0.7, power: 2.6 }));
  }
  surface.castShadow = false; surface.receiveShadow = false;
  return { group, surface, update: (dt) => { if (clouds) clouds.rotation.y += dt * 0.012; } };
}

export function disposePlanetCaches() {
  if (earthCache) { Object.values(earthCache).forEach((t) => t.dispose()); earthCache = null; }
  for (const v of stdCache.values()) { v.map.dispose(); v.bump.dispose(); }
  stdCache.clear();
}
