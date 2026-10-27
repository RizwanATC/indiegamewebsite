// Draws the Slime Siege launcher icons for the Android app from the green
// slime sprite. Run after generate-slime-siege-art.mjs:
//   node scripts/generate-slime-siege-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHEET = path.join(ROOT, 'public/play/slime-siege/assets/slime.png');
const N = 26; // icon grid: the idle slime centred on a meadow-green square

const slime = await sharp(SHEET).extract({ left: 22, top: 23, width: 22, height: 21 }).png().toBuffer();
const base = await sharp({ create: { width: N, height: N, channels: 4, background: '#3f7a3a' } })
  .composite([{ input: slime, left: 2, top: 3 }])
  .png()
  .toBuffer();

const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [density, size] of Object.entries(sizes)) {
  const dir = path.join(ROOT, `android/app/src/slime-siege/res/mipmap-${density}`);
  await mkdir(dir, { recursive: true });
  await sharp(base).resize(size, size, { kernel: 'nearest' }).png().toFile(path.join(dir, 'ic_launcher.png'));
}
console.log('icons written');
