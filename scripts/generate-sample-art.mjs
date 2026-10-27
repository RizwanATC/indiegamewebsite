// Generates the original pixel-art placeholder images used by the sample
// game entries (covers, screenshots) plus the default social image and the
// favicon PNGs. Run with: npm run art
//
// Everything is drawn procedurally from a seed, so there is no third-party
// artwork in the repository. Real games should use the developer's own
// press-kit images instead.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px.set(c, (y * this.w + x) * 3);
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  disc(cx, cy, r, c) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) this.set(cx + x, cy + y, c);
  }
  sprite(rows, x, y, colors) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => colors[ch] && this.set(x + i, y + j, colors[ch])));
  }
}

// 4x4 Bayer matrix for retro ordered dithering.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

function smoothNoise(rand, n, octaves = 3) {
  const out = new Float32Array(n).fill(0);
  let amp = 1;
  let step = Math.max(4, Math.floor(n / 6));
  for (let o = 0; o < octaves; o++) {
    const pts = Array.from({ length: Math.ceil(n / step) + 2 }, () => rand());
    for (let i = 0; i < n; i++) {
      const k = Math.floor(i / step);
      const t = (i % step) / step;
      const s = t * t * (3 - 2 * t);
      out[i] += (pts[k] * (1 - s) + pts[k + 1] * s) * amp;
    }
    amp /= 2;
    step = Math.max(2, Math.floor(step / 2));
  }
  const max = 2 - 2 ** (1 - octaves);
  return out.map((v) => v / max);
}

const HERO = ['..aa..', '.abba.', 'abbbba', '.bccb.', '.c..c.'];
const SPRITES = {
  lantern: ['..dd..', '.dddd.', 'deeeed', 'deffed', 'deeeed', '.dddd.', '..dd..'],
  knight: ['.aaa..', 'abbba.', 'abcbab', '.bbb.b', '.b.b..', 'aa.aa.'],
  boat: ['...d....', '...dd...', '...ddd..', '...d....', 'eeeeeeee', '.eeeeee.'],
  bike: ['..aa....', '.abb..e.', '.bbbbbe.', 'e..b.e..', 'eee.eee.'],
  probe: ['..f..', '.ddd.', 'ddedd', '.ddd.', 'd...d'],
  bird: ['.aa...', 'abba..', '.bbbbc', '..bb..'],
  glyph: ['ffffff', 'f....f', 'f.ff.f', 'f.ff.f', 'f....f', 'ffffff'],
};

function scene({ w, h, seed, palette, sprite, hud = false, glyphs = false }) {
  const rand = rng(seed);
  const c = new Canvas(w, h);
  const [skyTop, skyBottom, far, mid, near, accent, glow] = palette.map(hex);
  const horizon = Math.floor(h * (0.55 + rand() * 0.1));

  for (let y = 0; y < h; y++) {
    const t = Math.min(1, y / horizon);
    for (let x = 0; x < w; x++) {
      const band = Math.floor(t * 6) / 6;
      const d = BAYER[(y % 4) * 4 + (x % 4)];
      const tt = t * 6 - Math.floor(t * 6) > d ? Math.min(1, band + 1 / 6) : band;
      c.set(x, y, mix(skyTop, skyBottom, tt));
    }
  }
  for (let i = 0; i < w * h * 0.004; i++) {
    const x = rand() * w;
    const y = rand() * horizon * 0.8;
    c.set(x, y, rand() > 0.7 ? glow : mix(skyTop, [255, 255, 255], 0.55));
  }
  const moonX = Math.floor(w * (0.15 + rand() * 0.7));
  const moonY = Math.floor(h * (0.15 + rand() * 0.15));
  const moonR = Math.floor(h * 0.07);
  c.disc(moonX, moonY, moonR + 2, mix(skyTop, glow, 0.35));
  c.disc(moonX, moonY, moonR, glow);

  const layers = [
    [far, 0.42, 0.22],
    [mid, 0.5, 0.16],
    [near, 0.62, 0.1],
  ];
  layers.forEach(([color, base, amp], li) => {
    const n = smoothNoise(rand, w, 3 + li);
    for (let x = 0; x < w; x++) {
      const top = Math.floor(h * (base + li * 0.08) - n[x] * h * amp);
      for (let y = top; y < h; y++) c.set(x, y, color);
      if (li === 2 && rand() > 0.93) c.rect(x, top - 3, 1, 3, mix(color, accent, 0.5));
    }
  });
  for (let i = 0; i < w * 0.06; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(h * 0.78 + rand() * h * 0.2);
    c.rect(x, y, 2, 1, mix(near, glow, 0.25 + rand() * 0.25));
  }

  if (glyphs) {
    const size = 6;
    const cols = 4;
    const startX = Math.floor(w / 2 - (cols * (size + 4)) / 2);
    for (let i = 0; i < cols; i++) {
      const lit = i === Math.floor(rand() * cols);
      c.sprite(SPRITES.glyph, startX + i * (size + 4), Math.floor(h * 0.42), { f: lit ? glow : mix(near, accent, 0.6) });
    }
  }

  const spr = SPRITES[sprite] ?? HERO;
  const sx = Math.floor(w * (0.3 + rand() * 0.4));
  const sy = Math.floor(h * 0.7) - spr.length;
  const scale = 1;
  for (let k = 0; k < scale; k++)
    c.sprite(spr, sx, sy, { a: accent, b: mix(accent, [255, 255, 255], 0.5), c: glow, d: accent, e: glow, f: [255, 255, 255] });
  c.disc(sx + 3, sy + 3, 1, glow);

  if (hud) {
    c.rect(0, 0, w, 7, mix(skyTop, [0, 0, 0], 0.5));
    for (let i = 0; i < 3; i++) c.sprite(['a.a', 'aaa', '.a.'], 3 + i * 5, 2, { a: accent });
    const bar = Math.floor(w * 0.25);
    c.rect(w - bar - 4, 2, bar, 3, mix(near, [0, 0, 0], 0.3));
    c.rect(w - bar - 4, 2, Math.floor(bar * (0.3 + rand() * 0.6)), 3, glow);
  }
  return c;
}

async function save(canvas, scale, file) {
  await mkdir(path.dirname(file), { recursive: true });
  await sharp(canvas.px, { raw: { width: canvas.w, height: canvas.h, channels: 3 } })
    .resize(canvas.w * scale, canvas.h * scale, { kernel: 'nearest' })
    .png({ compressionLevel: 9, palette: true })
    .toFile(file);
}

const GAMES = [
  ['lantern-drift', 'lantern', ['#140f2e', '#4b2a7b', '#2a1d52', '#1d1640', '#120d29', '#f2b84b', '#ffe29a']],
  ['glyph-echo', 'probe', ['#0e1426', '#2b3f6e', '#1f2c52', '#16203d', '#0c1224', '#a78bfa', '#c7f9ff'], { glyphs: true }],
  ['moss-and-rust', 'knight', ['#0f1a17', '#2f5246', '#24403a', '#1a2f2a', '#0e1b18', '#d9773a', '#c4e38a']],
  ['tidepool-tactics', 'boat', ['#0b1b2b', '#1f6f8b', '#16506a', '#113a4e', '#0a2433', '#ff8fa3', '#bff3ff']],
  ['night-market-courier', 'bike', ['#1a0f24', '#6b2f5f', '#4a2145', '#331734', '#1d0d1f', '#ff5d8f', '#ffd166']],
  ['comet-cartographer', 'probe', ['#07091a', '#23215c', '#1a1846', '#121035', '#0a0920', '#7cf2c8', '#e0e7ff']],
  ['ember-choir', 'bird', ['#1b0b0b', '#6e2618', '#521c13', '#3a140e', '#200a08', '#ff9f43', '#ffe0a3']],
  ['starling-post', 'bird', ['#101828', '#3b4a7a', '#2c3860', '#202948', '#121a2e', '#f4a261', '#fefae0']],
  ['frostbyte-harbor', 'boat', ['#0b1624', '#3d6c94', '#2d5274', '#203b55', '#122435', '#9be7ff', '#f1fbff']],
];

let seed = 2410;
for (const [slug, sprite, palette, extra = {}] of GAMES) {
  const dir = path.join(ROOT, 'src/assets/games', slug);
  await save(scene({ w: 160, h: 90, seed: seed++, palette, sprite, ...extra }), 10, path.join(dir, 'cover.png'));
  for (let i = 1; i <= 3; i++)
    await save(scene({ w: 128, h: 72, seed: seed++ * 7, palette, sprite, hud: true, ...extra }), 10, path.join(dir, `screenshot-${i}.png`));
  console.log('art:', slug);
}

// 5x7 pixel font, just the letters the logo and tagline need.
const FONT = {
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};
function text(c, str, x, y, color, shadow) {
  [...str].forEach((ch, i) => {
    const g = FONT[ch];
    if (shadow) c.sprite(g, x + i * 6 + 1, y + 1, { '#': shadow });
    c.sprite(g, x + i * 6, y, { '#': color });
  });
}

// Default Open Graph image: 240x126 pixels scaled 5x to 1200x630.
const og = scene({ w: 240, h: 126, seed: 99, palette: ['#0d0b1a', '#3b2470', '#2a1a52', '#1d1340', '#110c26', '#a78bfa', '#e9d5ff'], sprite: 'lantern' });
const logo = new Canvas(48, 7);
text(logo, 'INDIE/24', 0, 0, [255, 255, 255]);
// Draw the logo at 3x inside the 1x canvas by hand.
const lx = Math.floor((240 - 48 * 3) / 2);
for (let y = 0; y < 7; y++)
  for (let x = 0; x < 48; x++)
    if (logo.px[(y * 48 + x) * 3]) {
      og.rect(lx + x * 3 + 2, 30 + y * 3 + 2, 3, 3, [20, 12, 40]);
      og.rect(lx + x * 3, 30 + y * 3, 3, 3, x >= 30 && x < 36 ? hex('#a78bfa') : [255, 255, 255]);
    }
const tag = 'ONE INDIE GAME A DAY';
text(og, tag, Math.floor((240 - tag.length * 6) / 2), 62, hex('#e9d5ff'), [20, 12, 40]);
await save(og, 5, path.join(ROOT, 'public/og-default.png'));
console.log('art: og-default.png');

// Favicons: the slash mark on a dark tile.
for (const size of [32, 180, 512]) {
  const f = new Canvas(16, 16);
  f.rect(0, 0, 16, 16, hex('#0f0c1d'));
  const slash = ['.......##', '......##.', '.....##..', '....##...', '...##....', '..##.....', '.##......', '##.......'];
  f.sprite(slash, 3, 4, { '#': hex('#a78bfa') });
  await save(f, size / 16, path.join(ROOT, `public/${size === 180 ? 'apple-touch-icon' : `icon-${size}`}.png`));
}
console.log('art: icons');
