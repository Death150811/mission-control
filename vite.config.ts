import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes the build work from any folder or sub-path (GitHub Pages, a CDN folder, a plain file server).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, host: '127.0.0.1' },
  preview: { port: 4173, host: '127.0.0.1' },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: { output: { manualChunks: { three: ['three'], react: ['react', 'react-dom'] } } },
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
} as any);
