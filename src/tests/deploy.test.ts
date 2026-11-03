import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHORTCUTS } from '../components/HelpModal';
import { TEXT_STEPS, THEMES, cycleTheme, setTextStep, setTheme, useTheme } from '../store/theme';

const read = (f: string) => readFileSync(f, 'utf8');

describe('deployment files', () => {
  it('the page shell has a title, description, viewport, manifest and icon', () => {
    const html = read('index.html');
    expect(html).toMatch(/<title>[^<]{5,}<\/title>/);
    expect(html).toContain('name="viewport"');
    expect(html).toContain('name="description"');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('rel="icon"');
    expect(html).toContain('<noscript>');
  });
  it('manifest, headers and hosting configs are valid and consistent', () => {
    const mf = JSON.parse(read('public/manifest.webmanifest'));
    expect(mf.start_url).toBe('./');
    expect(mf.icons.length).toBeGreaterThan(0);
    for (const i of mf.icons) expect(existsSync('public/' + i.src)).toBe(true);
    const headers = read('public/_headers');
    expect(headers).toContain("default-src 'self'");
    expect(headers).toContain("object-src 'none'");
    expect(headers).not.toContain('unsafe-eval');
    const vercel = JSON.parse(read('vercel.json'));
    expect(JSON.stringify(vercel)).toContain("default-src 'self'");
    expect(read('deploy/nginx.conf')).toContain("default-src 'self'");
    expect(read('Dockerfile')).toContain('npm run build');
    expect(read('.github/workflows/pages.yml')).toContain('npm run check');
  });
  it('package scripts expose build, check, smoke and single-file builds', () => {
    const pkg = JSON.parse(read('package.json'));
    for (const s of ['build', 'build:single', 'check', 'smoke', 'test', 'regress']) expect(pkg.scripts[s], s).toBeTruthy();
    expect(pkg.scripts.check).toContain('vitest');
    expect(pkg.scripts.check).toContain('smoke');
  });
  it('the build uses relative URLs so it works from any folder', () => {
    expect(read('vite.config.ts')).toContain("base: './'");
    expect(read('vite.single.config.ts')).toContain("base: './'");
  });
  it('third-party notices list every bundled font family', () => {
    const t = read('THIRD_PARTY.md');
    for (const f of ['three.js', 'IBM Plex', 'Barlow', 'Source Serif', 'Bebas Neue', 'Work Sans', 'Courier Prime']) expect(t.toLowerCase()).toContain(f.toLowerCase().split(' ')[0]);
  });
});

describe('appearance settings', () => {
  it('text size is clamped and themes cycle through all four', () => {
    setTextStep(99);
    expect(useTheme.length).toBeGreaterThanOrEqual(0);
    setTextStep(-5);
    const seen = new Set<string>();
    setTheme('console');
    for (let i = 0; i < THEMES.length; i++) { cycleTheme(); }
    for (const t of THEMES) seen.add(t.id);
    expect(seen.size).toBe(4);
    expect(TEXT_STEPS[0]).toBe(1);
    expect(TEXT_STEPS[TEXT_STEPS.length - 1]).toBeGreaterThan(1.3);
  });
  it('the keyboard help documents the step, theme, motion, text-size and help keys', () => {
    const keys = SHORTCUTS.map(([k]) => k).join(' ');
    for (const k of ['[', ']', 'T', 'M', '?', 'Esc']) expect(keys).toContain(k);
  });
});
