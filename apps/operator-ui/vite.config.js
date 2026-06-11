import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone operator UI. Bundles only local fixtures — no proxy, no real network.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: false },
  build: { outDir: 'dist', sourcemap: false }
});
