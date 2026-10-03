/**
 * Vite config — the dev proxy is the star here.
 *
 * WHY proxy /api to the backend instead of calling http://localhost:4000
 * directly from fetch()?
 * - The React code ALWAYS uses relative URLs like `/api/posts`.
 * - In DEV, Vite forwards /api → Express (port 4000).
 * - In PROD, Nginx on EC2 forwards /api → Express (port 4000).
 * Same relative URL, two proxies, zero code change between environments.
 * This also sidesteps CORS entirely in the browser.
 * (Yes, the backend has cors() middleware — that's for your convenience
 * while learning with tools like curl/Postman hitting port 4000 directly.)
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Output goes to frontend/dist — GitHub Actions builds this and
    // rsyncs ONLY the dist folder to EC2's Nginx root. The t2.micro
    // never runs a build (it would OOM with 1GB RAM) — that's the
    // CI/CD lesson: heavy work belongs in the pipeline, not the server.
    outDir: 'dist',
    sourcemap: false,
  },
});
