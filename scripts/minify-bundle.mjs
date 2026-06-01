#!/usr/bin/env node
//
// scripts/minify-bundle.mjs
//
// v35.0: post-build minifier. Reads RoweOS/dist/index.html, minifies every
// inline <script> and <style> block via esbuild, writes the result back, and
// keeps an unminified copy at RoweOS/dist/index.unminified.html for incident
// debugging.
//
// Run with --no-minify to skip (just copies the unminified file to the
// .unminified.html companion). Useful when bisecting a minify regression.
//

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';

const SKIP = process.argv.includes('--no-minify');

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const file = path.join(projectRoot, 'RoweOS', 'dist', 'index.html');
const unminified = path.join(projectRoot, 'RoweOS', 'dist', 'index.unminified.html');

const raw = readFileSync(file, 'utf8');
const startBytes = raw.length;

// Always write the unminified companion so we have a debug copy.
writeFileSync(unminified, raw);

if (SKIP) {
  console.log(`[minify] --no-minify set; left ${(startBytes / 1024).toFixed(0)}KB untouched`);
  process.exit(0);
}

let out = raw;
let scriptOk = 0;
let scriptErr = 0;
let styleOk = 0;
let styleErr = 0;

// Minify inline <script> blocks. Script tags with src= are not matched (body
// would be empty). The non-greedy `[\s\S]*?` and the requirement that the tag
// has no attributes catches the build.sh-emitted blocks while leaving CDN refs
// alone.
const scriptRe = /<script>([\s\S]*?)<\/script>/g;
out = await replaceAsync(out, scriptRe, async (match, body) => {
  if (!body || !body.trim()) return match;
  try {
    const res = await esbuild.transform(body, {
      loader: 'js',
      minify: true,
      target: 'es2015',
      legalComments: 'none',
    });
    scriptOk++;
    return '<script>' + res.code + '</script>';
  } catch (e) {
    scriptErr++;
    console.warn('[minify] script block minify failed:', e.message);
    return match;
  }
});

// Minify inline <style> blocks.
const styleRe = /<style>([\s\S]*?)<\/style>/g;
out = await replaceAsync(out, styleRe, async (match, body) => {
  if (!body || !body.trim()) return match;
  try {
    const res = await esbuild.transform(body, {
      loader: 'css',
      minify: true,
      legalComments: 'none',
    });
    styleOk++;
    return '<style>' + res.code + '</style>';
  } catch (e) {
    styleErr++;
    console.warn('[minify] style block minify failed:', e.message);
    return match;
  }
});

writeFileSync(file, out);
const endBytes = out.length;
const pct = ((1 - endBytes / startBytes) * 100).toFixed(1);

console.log(
  '[minify] ' +
    (startBytes / 1024).toFixed(0) + 'KB -> ' + (endBytes / 1024).toFixed(0) + 'KB (-' + pct + '%) | ' +
    'scripts ok=' + scriptOk + ' err=' + scriptErr + ' | ' +
    'styles ok=' + styleOk + ' err=' + styleErr
);

if (scriptErr > 0 || styleErr > 0) {
  console.error('[minify] one or more blocks failed to minify; original retained for those blocks');
  process.exit(1);
}

async function replaceAsync(str, re, fn) {
  const promises = [];
  str.replace(re, (...args) => {
    promises.push(fn(...args));
    return '';
  });
  const results = await Promise.all(promises);
  return str.replace(re, () => results.shift());
}
