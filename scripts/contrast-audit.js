// Text-contrast audit for the running app. Paste into the browser console (or a browser tool) on any screen:
//   const issues = (await import('/scripts/contrast-audit.js')).default ... or simply paste the function and call audit().
// Returns the elements whose text/background contrast is below WCAG AA (4.5:1, or 3:1 for large text), grouped by class and colour pair.
// Known false positives: SVG text drawn on coloured shapes (emblem patches, rocket stack labels, delta-v pills) is judged against the
// SVG's container background, and CSS fade-in animations that have not played yet look transparent (the audit skips opacity < 0.3).
// To check every theme: change it with the selector in the top bar (or localStorage 'mc-theme-v1') and run again on each screen.
export default function audit() {
  const parse = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const bodyBg = parse(getComputedStyle(document.body).backgroundColor) || { r: 0, g: 0, b: 0, a: 1 };
  const bgOf = (el) => { const stack = []; let e = el; let opaque = null; while (e && e.nodeType === 1) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { if (c.a >= 1) { opaque = c; break; } stack.push(c); } e = e.parentElement; } let out = opaque || { ...bodyBg, a: 1 }; while (stack.length) out = over(stack.pop(), out); return out; };
  const opac = (el) => { let o = 1, e = el; while (e && e.nodeType === 1) { o *= parseFloat(getComputedStyle(e).opacity); e = e.parentElement; } return o; };
  const out = new Map();
  for (const el of document.body.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'canvas', 'path', 'g', 'rect', 'circle', 'line', 'defs', 'svg', 'ellipse', 'polygon'].includes(tag)) continue;
    let has = false; for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim().length > 1) { has = true; break; }
    if (!has) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('button:disabled')) continue;
    const isSvg = el instanceof SVGElement;
    const fg0 = parse(isSvg ? cs.fill : cs.color); if (!fg0) continue;
    const bg = bgOf(isSvg ? el.closest('svg') : el);
    const o = opac(el); if (o < 0.3) continue;
    const fg = over({ ...fg0, a: fg0.a * o }, bg);
    const k = ratio(fg, bg);
    const size = parseFloat(cs.fontSize) * (isSvg ? (el.getScreenCTM()?.a || 1) : 1);
    const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    if (k < need) {
      const key = String(el.className?.baseVal ?? el.className).split(' ')[0] + tag + '|' + [fg, bg].map((c) => [c.r, c.g, c.b].map(Math.round).join(',')).join('/');
      const cur = out.get(key) || { n: 0, ratio: +k.toFixed(2), need, sample: el.textContent.trim().slice(0, 40), tag, size: Math.round(size) };
      cur.n++; out.set(key, cur);
    }
  }
  return [...out.values()].sort((a, b) => a.ratio - b.ratio);
}
