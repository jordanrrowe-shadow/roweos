// Sprint 0 esbuild scaffold (NOT YET ACTIVE).
//
// The current production path is `bash src/build.sh` (concatenation).
// This file lays groundwork for the v33.5 esbuild migration per
// docs/brilliance/15-architecture-playbook.md §3.1.
//
// Run with: `npx tsx build.config.ts`
// Until v33.5, prefer `npm run build` -> bash src/build.sh.

import esbuild from 'esbuild';
import process from 'node:process';

const isProd = process.env.NODE_ENV === 'production';

await esbuild.build({
  // Once services/* exists in v33.5, swap to `services/main.ts` (or similar).
  entryPoints: ['src/__tests__/setup.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  outfile: 'RoweOS/dist/_scaffold-bundle.js',
  loader: { '.html': 'text', '.css': 'text' },
  minify: isProd,
  sourcemap: true,
  define: {
    'process.env.BRILLIANCE_VERSION': JSON.stringify(process.env.BRILLIANCE_VERSION ?? 'dev'),
  },
});

console.log('[esbuild scaffold] built _scaffold-bundle.js — replace with real entry in v33.5');
