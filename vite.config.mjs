import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// After every build: (1) list all built files in dist/precache.json so the app can be opened offline,
// (2) stamp dist/sw.js with a build id so each new deployment refreshes the installed apps by itself.
const pwaFiles = () => ({
  name: 'grt-pwa-files',
  apply: 'build',
  closeBundle() {
    const dist = path.resolve('dist');
    const walk = (dir, base = '') => fs.readdirSync(path.join(dir, base), { withFileTypes: true })
      .flatMap((d) => (d.isDirectory() ? walk(dir, path.join(base, d.name)) : [path.join(base, d.name)]));
    const assets = fs.existsSync(path.join(dist, 'assets')) ? walk(path.join(dist, 'assets')).map((f) => '/assets/' + f.split(path.sep).join('/')) : [];
    const brand = fs.existsSync(path.join(dist, 'brand')) ? walk(path.join(dist, 'brand')).map((f) => '/brand/' + f.split(path.sep).join('/')) : [];
    const id = Date.now().toString(36);
    fs.writeFileSync(path.join(dist, 'precache.json'), JSON.stringify({ build: id, files: [...assets, ...brand] }));
    const sw = path.join(dist, 'sw.js');
    if (fs.existsSync(sw)) fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replaceAll('__BUILD_ID__', id));
  },
});

export default defineConfig({
  plugins: [react(), pwaFiles()],
  // in development the /api calls go to the local test server (scripts/dev-api.mjs); on Vercel they go to api/app.js
  server: { host: true, port: 5173, strictPort: false, proxy: { '/api': 'http://localhost:3001' } },
  preview: { proxy: { '/api': 'http://localhost:3001' } },   // also reachable from a phone on the same Wi-Fi
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1600 },
});
