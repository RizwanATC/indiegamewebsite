// Draws the Signal Strike launcher icons for the Android app from the
// player ship sprite. Run with: node scripts/generate-signal-strike-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHIP = ['11000000.', '.1111000.', '111111110', '111111111', '.1111000.', '11000000.'];
const BG = [199, 240, 216];
const FG = [67, 82, 61];
const N = 16; // icon grid

const px = new Uint8Array(N * N * 3);
for (let i = 0; i < N * N; i++) px.set(BG, i * 3);
const set = (x, y, c) => px.set(c, (y * N + x) * 3);
// Ship centred, plus two shots and a few stars.
SHIP.forEach((row, j) => [...row].forEach((ch, i) => ch === '1' && set(2 + i, 5 + j, FG)));
for (const [x, y] of [[12, 7], [13, 7], [14, 8], [3, 2], [11, 3], [7, 13], [13, 12]]) set(x, y, FG);

const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [density, size] of Object.entries(sizes)) {
  const dir = path.join(ROOT, `android/app/src/signal-strike/res/mipmap-${density}`);
  await mkdir(dir, { recursive: true });
  await sharp(px, { raw: { width: N, height: N, channels: 3 } })
    .resize(size, size, { kernel: 'nearest' })
    .png({ palette: true })
    .toFile(path.join(dir, 'ic_launcher.png'));
}
console.log('icons written');
