// v33.50: Regenerate all favicon / apple-touch / PWA icons from
// RoweOS/dist/images/brilliance/app-icon.png. Per CLAUDE.md PWA rule:
// must be RGB no-alpha (sharp .flatten + .removeAlpha) so macOS dock
// doesn't add a white border.
//
// v33.69: source has ~200px of solid-bg padding around the actual logo art
// (trim() reports the content is 808×832 in a 1254×1254 source). Without
// trimming, every icon ends up looking 35% smaller than the canvas. Now:
//   1. Trim the bg padding to find content bounds.
//   2. Extend the trimmed buffer to a perfect square (so 'cover' resize doesn't
//      crop logo content — only fills bg).
//   3. Resize to each target.
// Result: the B-with-sparkles logo fills the icon edge-to-edge.
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = path.resolve('RoweOS/dist');
// v34.65: switched back to app-icon-black.png. b-mark-transparent.png was
// rendering as a gold B on a checkerboard in Safari "Add to Dock" preview
// (Safari shows transparency as a checkered pattern), and producing a flat-
// looking icon next to other Mac dock apps that use solid tiles. The black
// app-icon tile matches what Jordan ships in his dock screenshot — solid
// near-black background with the gold B + sparkle ring centered.
const source = path.join(root, 'images/brilliance/app-icon-black.png');

const targets = [
  { out: 'icons/favicon-16.png', size: 16 },
  { out: 'icons/favicon-32.png', size: 32 },
  { out: 'icons/favicon-48.png', size: 48 },
  { out: 'favicon.png', size: 64 },
  { out: 'icons/apple-touch-icon.png', size: 180 },
  { out: 'icons/icon-192.png', size: 192 },
  { out: 'icons/apple-touch-icon-512.png', size: 512 },
  { out: 'icons/icon-512.png', size: 512 },
  { out: 'icons/apple-touch-icon-1024.png', size: 1024 },
  { out: 'icons/icon-1024.png', size: 1024 },
  // Top-level apple-touch-icon used by old links
  { out: 'apple-touch-icon.png', size: 180 },
];

async function ensureDir(p) {
  await fs.mkdir(path.dirname(p), { recursive: true });
}

console.log('[regen-icons] Source:', source);
const meta = await sharp(source).metadata();
console.log('[regen-icons] Source meta:', meta.width, 'x', meta.height, meta.format);

// Step 1: trim the surrounding solid-color padding to expose actual logo bounds.
const trimmed = await sharp(source).trim({ threshold: 25 }).toBuffer({ resolveWithObject: true });
console.log('[regen-icons] Trimmed:', trimmed.info.width, 'x', trimmed.info.height,
  '(top offset', trimmed.info.trimOffsetTop, ', left offset', trimmed.info.trimOffsetLeft, ')');

// Step 2: extend to a perfect square using the same dock bg color so the resize
// doesn't crop away the logo. We use the larger dimension as the side length.
const side = Math.max(trimmed.info.width, trimmed.info.height);
const padX = Math.floor((side - trimmed.info.width) / 2);
const padY = Math.floor((side - trimmed.info.height) / 2);
const squareBuffer = await sharp(trimmed.data)
  .extend({
    top: padY,
    bottom: side - trimmed.info.height - padY,
    left: padX,
    right: side - trimmed.info.width - padX,
    background: { r: 10, g: 10, b: 10, alpha: 1 },
  })
  .png()
  .toBuffer();
console.log('[regen-icons] Squared:', side, 'x', side);

for (const t of targets) {
  const outPath = path.join(root, t.out);
  await ensureDir(outPath);
  await sharp(squareBuffer)
    .resize(t.size, t.size, { fit: 'cover' })
    .flatten({ background: { r: 10, g: 10, b: 10 } })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log('[regen-icons] →', t.out, '(' + t.size + 'x' + t.size + ')');
}

console.log('[regen-icons] Done.');
