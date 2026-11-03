// Procedural textures drawn on canvases at runtime: no image files are shipped or downloaded.
import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}
function tex(key: string, c: HTMLCanvasElement, repeat?: [number, number], srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  cache.set(key, t);
  return t;
}

// ---- deterministic value noise, periodic in x so planet maps have no seam ----
function hash(ix: number, iy: number): number { let h = (ix * 374761393 + iy * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x: number, y: number, period: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const px = (i: number) => ((i % period) + period) % period;
  const a = hash(px(x0), y0), b = hash(px(x0 + 1), y0), c = hash(px(x0), y0 + 1), d = hash(px(x0 + 1), y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(u: number, v: number, base: number, oct = 5): number {
  let amp = 0.5, f = base, sum = 0, norm = 0;
  for (let o = 0; o < oct; o++) { sum += amp * vnoise(u * f, v * f * 0.5, f); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}

export function goldFoil(): THREE.CanvasTexture {
  const hit = cache.get('gold'); if (hit) return hit;
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#c59a2c'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { const x = Math.random() * 512, y = Math.random() * 512, r = 6 + Math.random() * 38; const light = Math.random() > 0.5; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, light ? 'rgba(255,222,120,0.28)' : 'rgba(90,55,5,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.lineWidth = 1;
  for (let i = 0; i < 380; i++) { g.strokeStyle = Math.random() > 0.5 ? 'rgba(255,235,160,0.35)' : 'rgba(70,40,0,0.35)'; g.beginPath(); const x = Math.random() * 512, y = Math.random() * 512; g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 70, y + (Math.random() - 0.5) * 70); g.stroke(); }
  return tex('gold', c, [2, 2]);
}
export function solarCells(): THREE.CanvasTexture {
  const hit = cache.get('cells'); if (hit) return hit;
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#b9bec6'; g.fillRect(0, 0, 512, 512);
  const cols = 8, rows = 12, cw = 512 / cols, ch = 512 / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = i * cw + 3, y = j * ch + 3, w = cw - 6, h = ch - 6;
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#0e2a66'); gr.addColorStop(0.55, '#1b3f8f'); gr.addColorStop(1, '#0a1f4d');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(190,200,215,0.55)'; g.lineWidth = 1.2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + (w * k) / 4, y); g.lineTo(x + (w * k) / 4, y + h); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, y, w, h * 0.35);
  }
  return tex('cells', c);
}
export function whitePaint(): THREE.CanvasTexture {
  const hit = cache.get('white'); if (hit) return hit;
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#e8ebef'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(70,80,95,0.3)'; g.lineWidth = 1; g.strokeRect(2, 2, 252, 252);
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 42 * i + 6); g.lineTo(256, 42 * i + 6); g.stroke(); }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(120,130,145,${Math.random() * 0.06})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  return tex('white', c, [1, 1]);
}
export function radiatorTex(): THREE.CanvasTexture {
  const hit = cache.get('rad'); if (hit) return hit;
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(80,90,105,0.5)'; g.lineWidth = 2;
  for (let i = 0; i < 16; i++) { g.beginPath(); g.moveTo(0, i * 16 + 4); g.lineTo(256, i * 16 + 4); g.stroke(); }
  return tex('rad', c, [1, 1]);
}

export function starfield(count = 1600, radius = 400): THREE.Points {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = hash(i, 1) * Math.PI * 2, b = Math.acos(2 * hash(i, 2) - 1);
    pos[i * 3] = radius * Math.sin(b) * Math.cos(a); pos[i * 3 + 1] = radius * Math.cos(b); pos[i * 3 + 2] = radius * Math.sin(b) * Math.sin(a);
    const t = 0.55 + 0.45 * hash(i, 3), w = hash(i, 4);
    col[i * 3] = t * (w > 0.8 ? 1 : 0.85); col[i * 3 + 1] = t * 0.92; col[i * 3 + 2] = t * (w < 0.2 ? 0.8 : 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
}

export function disposeTextures() { for (const t of cache.values()) t.dispose(); cache.clear(); }

/** Additive sun glow sprite (the bloom pass adds the HDR halo on top). */
export function sunGlow(color = 0xffd9a0, size = 8): THREE.Sprite {
  const [c, g] = canvas(256, 256);
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.08, 'rgba(255,240,210,0.85)'); gr.addColorStop(0.25, 'rgba(255,200,130,0.28)'); gr.addColorStop(0.6, 'rgba(255,160,80,0.06)'); gr.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.scale.setScalar(size);
  return s;
}

/** Faint Milky Way band on a far sphere; the band is the plane of the galaxy, tilted against the ecliptic. */
export function milkyWay(radius = 1200): THREE.Mesh {
  const hit = cache.get('galaxy');
  const W = 1024, H = 512;
  let t = hit;
  if (!t) {
    const [c, g] = canvas(W, H);
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = (y / H - 0.5) * 2;
      const band = Math.exp(-Math.pow(v / 0.16, 2));
      const n = fbm(x / W, y / H, 7, 5), m = fbm(x / W + 0.3, y / H + 0.6, 14, 4);
      const dust = Math.max(0, 1 - Math.pow(Math.max(0, m - 0.5) * 3.2, 1.3));
      const k = band * (0.2 + 0.8 * n) * dust;
      const i = (y * W + x) * 4;
      img.data[i] = 120 * k + 8 * band; img.data[i + 1] = 128 * k + 9 * band; img.data[i + 2] = 156 * k + 14 * band; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    t = tex('galaxy', c);
  }
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false }));
  m.rotation.set(0.9, 0.5, 0.35); m.renderOrder = -20;
  return m;
}

/** Weathered concrete launch pad with expansion joints and scorch near the centre. */
export function concrete(): THREE.CanvasTexture {
  const hit = cache.get('concrete'); if (hit) return hit;
  const [c, g] = canvas(512, 512);
  const img = g.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const n = fbm(x / 512, y / 512, 8, 5), f = hash(x, y) * 0.08;
    const s = 92 + 60 * n + 255 * f * 0.2;
    const i = (y * 512 + x) * 4; img.data[i] = s; img.data[i + 1] = s * 0.99; img.data[i + 2] = s * 0.96; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(20,22,26,0.55)'; g.lineWidth = 2;
  for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * 128, 0); g.lineTo(k * 128, 512); g.stroke(); g.beginPath(); g.moveTo(0, k * 128); g.lineTo(512, k * 128); g.stroke(); }
  const sc = g.createRadialGradient(256, 256, 0, 256, 256, 230); sc.addColorStop(0, 'rgba(10,8,6,0.55)'); sc.addColorStop(1, 'rgba(10,8,6,0)');
  g.fillStyle = sc; g.fillRect(0, 0, 512, 512);
  return tex('concrete', c, [6, 6]);
}

/** Soft white puff for venting vapour. */
export function softPuff(): THREE.CanvasTexture {
  const hit = cache.get('puff'); if (hit) return hit;
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(235,240,255,0.2)'); gr.addColorStop(1, 'rgba(235,240,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return tex('puff', c);
}
