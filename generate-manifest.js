// generate-manifest.js
// Scans public/creatures/ and writes manifest.json listing every image file.
// Run manually:  node generate-manifest.js
// Runs automatically on:  npm run dev  and  npm run build

import { readdirSync, writeFileSync } from 'fs';
import { extname } from 'path';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const SRC_DIR    = './public/creatures';
const MANIFEST   = './public/creatures/manifest.json';

let files;
try {
  files = readdirSync(SRC_DIR, { withFileTypes: true })
    .filter(d => d.isFile() && IMAGE_EXTS.has(extname(d.name).toLowerCase()))
    .map(d => `/creatures/${d.name}`)
    .sort();
} catch (err) {
  console.error(`generate-manifest: could not read ${SRC_DIR} —`, err.message);
  process.exit(1);
}

writeFileSync(MANIFEST, JSON.stringify(files, null, 2) + '\n');
console.log(`generate-manifest: wrote ${files.length} images to manifest.json`);
