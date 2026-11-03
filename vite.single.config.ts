import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained index.html (scripts, styles and fonts inlined): for hosts that take a single page, e-mail attachments or file://.
const inlineIcons = (): Plugin => ({
  name: 'inline-icons',
  transformIndexHtml(html) {
    const svg = readFileSync('public/favicon.svg', 'utf8').trim();
    return html
      .replace('./favicon.svg', 'data:image/svg+xml,' + encodeURIComponent(svg))
      .replace(/\s*<link rel="manifest"[^>]*>/, '');
  },
});

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react(), viteSingleFile(), inlineIcons()],
  build: { outDir: 'dist-single', target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 8000, assetsInlineLimit: 100000000, cssCodeSplit: false },
} as any);
