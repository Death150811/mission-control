import { useEffect, useRef } from 'react';
import { useTheme } from '../store/theme';

type Kind = 'heavy' | 'boosted' | 'capsule';

/** Blueprint-style rocket outline, base centre at (0,0), height h, drawn upward. Purely decorative. */
function rocketOutline(g: CanvasRenderingContext2D, h: number, kind: Kind, label: string) {
  const w = h * (kind === 'capsule' ? 0.26 : 0.1);
  const r = (x: number, y: number, ww: number, hh: number) => { g.strokeRect(x, y, ww, hh); };
  g.beginPath();
  if (kind === 'heavy') {
    r(-w / 2, -h * 0.5, w, h * 0.5);
    r(-w * 0.43, -h * 0.58, w * 0.86, h * 0.08);
    r(-w * 0.43, -h * 0.86, w * 0.86, h * 0.28);
    g.moveTo(-w * 0.43, -h * 0.86); g.quadraticCurveTo(-w * 0.43, -h * 0.97, 0, -h); g.quadraticCurveTo(w * 0.43, -h * 0.97, w * 0.43, -h * 0.86);
    for (const s of [-1, 1]) { g.moveTo(s * w / 2, -h * 0.02); g.lineTo(s * w * 1.05, h * 0.015); g.lineTo(s * w / 2, -h * 0.14); }
    for (let i = -2; i <= 2; i++) { g.moveTo(i * w * 0.17 - w * 0.05, 0); g.lineTo(i * w * 0.17 - w * 0.08, h * 0.03); g.lineTo(i * w * 0.17 + w * 0.08, h * 0.03); g.lineTo(i * w * 0.17 + w * 0.05, 0); }
  } else if (kind === 'boosted') {
    r(-w * 0.35, -h * 0.72, w * 0.7, h * 0.72);
    g.moveTo(-w * 0.35, -h * 0.72); g.quadraticCurveTo(-w * 0.35, -h * 0.94, 0, -h); g.quadraticCurveTo(w * 0.35, -h * 0.94, w * 0.35, -h * 0.72);
    for (const s of [-1, 1]) {
      const bx = s * w * 0.72;
      r(bx - w * 0.2, -h * 0.5, w * 0.4, h * 0.5);
      g.moveTo(bx - w * 0.2, -h * 0.5); g.quadraticCurveTo(bx - w * 0.2, -h * 0.6, bx, -h * 0.64); g.quadraticCurveTo(bx + w * 0.2, -h * 0.6, bx + w * 0.2, -h * 0.5);
      g.moveTo(bx - w * 0.2, -h * 0.04); g.lineTo(bx - w * 0.2 * (1 + s * 0.3) - s * w * 0.1, h * 0.012);
    }
    r(-w * 0.35, -h * 0.4, w * 0.7, h * 0.03);
  } else {
    // abort tower, capsule, service module, two solar wings
    g.moveTo(0, -h); g.lineTo(0, -h * 0.84);
    g.moveTo(-w * 0.16, -h * 0.84); g.lineTo(-w * 0.08, -h * 0.78); g.lineTo(w * 0.08, -h * 0.78); g.lineTo(w * 0.16, -h * 0.84); g.closePath();
    g.moveTo(-w * 0.16, -h * 0.84); g.lineTo(-w * 0.36, -h * 0.52); g.lineTo(w * 0.36, -h * 0.52); g.lineTo(w * 0.16, -h * 0.84);
    r(-w * 0.36, -h * 0.52, w * 0.72, h * 0.34);
    g.moveTo(-w * 0.3, -h * 0.18); g.lineTo(-w * 0.4, 0); g.lineTo(w * 0.4, 0); g.lineTo(w * 0.3, -h * 0.18);
    for (const s of [-1, 1]) { r(s > 0 ? w * 0.4 : -w * 1.5, -h * 0.42, w * 1.1, h * 0.12); for (let k = 1; k < 4; k++) { g.moveTo((s > 0 ? w * 0.4 : -w * 1.5) + (w * 1.1 * k) / 4, -h * 0.42); g.lineTo((s > 0 ? w * 0.4 : -w * 1.5) + (w * 1.1 * k) / 4, -h * 0.3); } }
  }
  g.stroke();
  // dimension line with end ticks
  const dx = w * (kind === 'capsule' ? 1.8 : 1.5);
  g.beginPath(); g.moveTo(dx, 0); g.lineTo(dx, -h); g.moveTo(dx - 5, 0); g.lineTo(dx + 5, 0); g.moveTo(dx - 5, -h); g.lineTo(dx + 5, -h); g.stroke();
  g.save(); g.translate(dx + 12, -h / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText(label, 0, 0); g.restore();
}

interface Streak { x: number; t: number; dur: number; trail: { x: number; y: number; a: number }[]; dir: number }

/** Quiet animated backdrop: parallax stars, a blueprint grid, rocket line drawings, orbits and an occasional launch. Pauses when disabled. */
export default function Backdrop() {
  const { theme, motion } = useTheme();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const g = cv.getContext('2d'); if (!g) return;
    const css = getComputedStyle(document.documentElement);
    const col = (n: string, fb: string) => css.getPropertyValue(n).trim() || fb;
    const light = theme === 'blueprint';
    const ink = light ? col('--blue', '#123c7c') : col('--blue-lt', '#8db6f2');
    const accent = col('--red', '#e8472b');
    const starCol = light ? col('--blue', '#123c7c') : '#e6edff';
    let W = 0, H = 0, raf = 0, last = 0, alive = true;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const stars = Array.from({ length: 150 }, (_, i) => ({ x: Math.random(), y: Math.random(), z: Math.random(), p: i * 1.7 }));
    const sats = [{ rx: 0.34, ry: 0.11, tilt: -0.5, cx: 0.86, cy: 0.9, ph: 0, sp: 0.00006 }, { rx: 0.22, ry: 0.075, tilt: 0.35, cx: 0.12, cy: 0.18, ph: 2, sp: -0.00009 }];
    let streak: Streak | null = null; let nextLaunch = 4000 + Math.random() * 6000;
    const resize = () => { W = window.innerWidth; H = window.innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; g.setTransform(dpr, 0, 0, dpr, 0, 0); draw(last); };

    const draw = (t: number) => {
      g.clearRect(0, 0, W, H);
      g.font = '10px ui-monospace, Consolas, monospace'; g.lineWidth = 1;
      // grid
      g.strokeStyle = ink; g.globalAlpha = light ? 0.07 : 0.045;
      g.beginPath(); for (let x = 0; x < W; x += 48) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); } for (let y = 0; y < H; y += 48) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); } g.stroke();
      g.globalAlpha = light ? 0.13 : 0.09;
      g.beginPath(); for (let x = 0; x < W; x += 240) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); } for (let y = 0; y < H; y += 240) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); } g.stroke();
      g.fillStyle = ink; g.globalAlpha = light ? 0.4 : 0.28;
      for (let x = 0, k = 0; x < W; x += 240, k++) g.fillText(`T-${String(60 - k * 5).padStart(2, '0')}:00`, x + 4, 12);
      // stars with parallax drift
      g.fillStyle = starCol;
      for (const s of stars) {
        const speed = 0.0000028 * (0.3 + s.z) * (motion ? 1 : 0);
        s.x = ((s.x - speed * 16) % 1 + 1) % 1;
        const tw = 0.55 + 0.45 * Math.sin(t * 0.001 * (0.4 + s.z) + s.p);
        g.globalAlpha = (light ? 0.22 : 0.55) * tw * (0.35 + 0.65 * s.z);
        const r = 0.5 + s.z * 1.1; g.fillRect(s.x * W, s.y * H, r, r);
      }
      // orbits with a satellite each
      g.strokeStyle = ink; g.fillStyle = accent;
      for (const o of sats) {
        g.save(); g.translate(o.cx * W, o.cy * H); g.rotate(o.tilt);
        g.globalAlpha = light ? 0.18 : 0.13; g.beginPath(); g.ellipse(0, 0, o.rx * W, o.ry * W, 0, 0, Math.PI * 2); g.stroke();
        const a = o.ph + t * o.sp * 40; g.globalAlpha = 0.9; g.beginPath(); g.arc(Math.cos(a) * o.rx * W, Math.sin(a) * o.ry * W, 2.6, 0, 7); g.fill();
        g.restore();
      }
      // rocket line drawings along the margins, bobbing very slowly
      g.strokeStyle = ink; g.fillStyle = ink; g.globalAlpha = light ? 0.32 : 0.24;
      const bob = motion ? Math.sin(t * 0.0003) * 3 : 0;
      const big = Math.min(H * 0.62, 520);
      g.save(); g.translate(W * 0.045, H - 20 + bob); rocketOutline(g, big, 'heavy', 'HEAVY LIFT'); g.restore();
      g.save(); g.translate(W * 0.955, H - 20 - bob); rocketOutline(g, big * 0.78, 'boosted', 'MEDIUM LIFT + 2 BOOSTERS'); g.restore();
      if (W > 1500) { g.save(); g.translate(W * 0.5, H - 20); g.globalAlpha *= 0.55; rocketOutline(g, big * 0.42, 'capsule', 'CREWED CAPSULE'); g.restore(); }
      // launch streak
      if (streak) {
        const s = streak, u = Math.min(1, s.t / s.dur);
        const px = s.x + s.dir * Math.pow(u, 2.3) * W * 0.28, py = H - u * H * 1.05;
        s.trail.push({ x: px, y: py, a: 1 });
        g.globalAlpha = 1;
        for (const p of s.trail) { p.a *= 0.965; g.globalAlpha = p.a * (light ? 0.25 : 0.28); g.fillStyle = light ? '#6b7280' : '#cfd6e6'; g.beginPath(); g.arc(p.x, p.y, 2 + (1 - p.a) * 7, 0, 7); g.fill(); }
        s.trail = s.trail.filter((p) => p.a > 0.05);
        const ang = Math.atan2(-(H * 1.05) + 0, s.dir * 2.3 * Math.pow(Math.max(u, 0.02), 1.3) * W * 0.28) ;
        g.save(); g.translate(px, py); g.rotate(Math.PI / 2 + Math.atan2(s.dir * 2.3 * Math.pow(Math.max(u, 0.02), 1.3) * W * 0.28, H * 1.05) * 0.9); void ang;
        const fl = g.createLinearGradient(0, 4, 0, 30); fl.addColorStop(0, '#fff3c4'); fl.addColorStop(0.4, accent); fl.addColorStop(1, 'rgba(255,120,40,0)');
        g.globalAlpha = 0.9; g.fillStyle = fl; g.beginPath(); g.moveTo(-3, 5); g.lineTo(0, 26 + Math.random() * 6); g.lineTo(3, 5); g.fill();
        g.fillStyle = light ? '#17233b' : '#f4f6fa'; g.globalAlpha = 0.95; g.fillRect(-3, -12, 6, 17); g.beginPath(); g.moveTo(-3, -12); g.quadraticCurveTo(0, -22, 3, -12); g.fill();
        g.fillStyle = accent; g.fillRect(-3, 1, 6, 2);
        g.restore();
      }
      g.globalAlpha = 1;
    };

    const loop = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return;
      const dt = now - last; last = now;
      if (streak) { streak.t += dt / 1000; if (streak.t > streak.dur + 3) streak = null; }
      else { nextLaunch -= dt; if (nextLaunch <= 0) { streak = { x: W * (0.2 + Math.random() * 0.6), t: 0, dur: 9, trail: [], dir: Math.random() > 0.5 ? 1 : -1 }; nextLaunch = 18000 + Math.random() * 14000; } }
      draw(now);
    };
    window.addEventListener('resize', resize);
    resize();
    if (motion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [theme, motion]);

  return <canvas ref={ref} className="backdrop" aria-hidden="true" />;
}
