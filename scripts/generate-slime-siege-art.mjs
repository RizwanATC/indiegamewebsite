// Draws every sprite sheet for Slime Siege from code, so the game's art is
// original and lives in this repository under the same licence as the rest.
// Run with: node scripts/generate-slime-siege-art.mjs
// Output: public/play/slime-siege/assets/*.png (the sheet layouts match what
// game.js expects: cell sizes, rows and columns are noted on each sheet).
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public/play/slime-siege/assets');

// ------------------------------------------------------------- helpers --
const hex = (h, a = 255) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];

// Small seeded RNG so every run draws the same textures.
let seed = 24;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

class Px {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8Array(w * h * 4);
  }
  i(x, y) {
    return (y * this.w + x) * 4;
  }
  in(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  set(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.in(x, y) || !c) return;
    const i = this.i(x, y);
    if (c[3] === 255 || this.d[i + 3] === 0) this.d.set(c, i);
    else {
      // simple alpha blend over an opaque pixel
      const a = c[3] / 255;
      for (let k = 0; k < 3; k++) this.d[i + k] = Math.round(c[k] * a + this.d[i + k] * (1 - a));
    }
  }
  alpha(x, y) {
    return this.in(x, y) ? this.d[this.i(x, y) + 3] : 0;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  ellipse(cx, cy, rx, ry, c, clip = () => true) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && clip(x, y)) this.set(x, y, c);
      }
  }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) this.set(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), c);
  }
  /** Draw string art: each char maps to a colour in `pal`, '.' is empty. */
  art(x, y, rows, pal, { mirror = false } = {}) {
    rows.forEach((row, j) => {
      const full = mirror ? row + [...row].reverse().join('') : row;
      [...full].forEach((ch, i) => ch !== '.' && this.set(x + i, y + j, pal[ch]));
    });
  }
  /** Dark outline around every opaque pixel (4-neighbour). */
  outline(c) {
    const solid = (x, y) => this.alpha(x, y) === 255;
    const add = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (this.alpha(x, y) === 0 && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) add.push([x, y]);
    for (const [x, y] of add) this.set(x, y, c);
    return this;
  }
  /** Soft ground shadow, only where nothing is drawn yet. */
  shadow(cx, cy, rx, ry, a = 70) {
    const c = [20, 40, 18, a];
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && this.alpha(x, y) === 0) this.set(x, y, c);
      }
    return this;
  }
  /** Multiply every pixel's alpha (for fades). */
  fade(f) {
    for (let k = 3; k < this.d.length; k += 4) this.d[k] = Math.round(this.d[k] * f);
    return this;
  }
  tint(c, amt) {
    for (let k = 0; k < this.d.length; k += 4)
      if (this.d[k + 3]) for (let j = 0; j < 3; j++) this.d[k + j] = Math.round(this.d[k + j] * (1 - amt) + c[j] * amt);
    return this;
  }
  blit(src, x, y) {
    for (let j = 0; j < src.h; j++)
      for (let i = 0; i < src.w; i++) {
        const k = src.i(i, j);
        if (src.d[k + 3]) this.set(x + i, y + j, [src.d[k], src.d[k + 1], src.d[k + 2], src.d[k + 3]]);
      }
  }
  save(name) {
    return sharp(Buffer.from(this.d), { raw: { width: this.w, height: this.h, channels: 4 } }).png().toFile(path.join(OUT, name + '.png'));
  }
}

const sheet = (cols, rows, cw, ch, draw) => {
  const s = new Px(cols * cw, rows * ch);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const p = new Px(cw, ch);
      if (draw(p, c, r) !== false) s.blit(p, c * cw, r * ch);
    }
  return s;
};

const INK = hex('#2b1d14');

// ---------------------------------------------------------------- hero --
// player.png: 32px cells, 6 columns. Rows used: 2 idle (walking up, seen from
// behind), 5 walk, 8 attack (4 frames), 9 defeat (4 frames).
const HERO = {
  o: INK,
  h: hex('#7a4526'),
  H: hex('#a0623a'),
  s: hex('#f2c29b'),
  t: hex('#2f8f7a'),
  T: hex('#48b39a'),
  b: hex('#6b3f22'),
  g: hex('#e8b33a'),
  c: hex('#c9433b'),
};
// Left half of the back view; mirrored to 16px wide.
const HERO_TOP = [
  '....oooo', //  0 hair
  '...ohhhh',
  '..ohhHHh',
  '..ohhhhH',
  '..ohhhhh',
  '..oshhhh', //  5 ears
  '...ohhhh',
  '..occccc', //  7 red cape collar
  '.ostcccc', //  8 shoulders
  '.ostTccc',
  '.osttccc',
  '..otttcc',
  '..obbbgb', // 12 belt
  '..ottttt',
];

function drawHero(p, { bob = 0, legL = 0, legR = 0, alpha = 1, kneel = 0 } = {}) {
  const x = 8;
  const y = 9 + bob + kneel;
  p.art(x, y, HERO_TOP, HERO, { mirror: true });
  if (!kneel) {
    // legs: two short columns, lifted alternately while walking
    for (const [lx, up] of [[4, legL], [9, legR]]) {
      p.rect(x + lx, y + 14, 3, 3 - up, hex('#4b3b5c'));
      p.rect(x + lx, y + 17 - up, 3, 1, hex('#3a2618'));
    }
  }
  p.outline(INK);
  p.shadow(16, 28, 7, 2.2);
  if (alpha < 1) p.fade(alpha);
}

function drawSword(p, x0, y0, x1, y1) {
  p.line(x0, y0, x1, y1, hex('#e6eef5'));
  p.line(x0 + 1, y0, x1 + 1, y1, hex('#aebdcb'));
}

const player = sheet(6, 10, 32, 32, (p, c, r) => {
  if (r === 2 || r === 5) {
    const walking = r === 5;
    const bob = walking ? (c % 3 === 1 ? -1 : 0) : c < 3 ? 0 : 1;
    const step = walking ? [0, 1, 1, 0, 0, 0][c] : 0;
    const step2 = walking ? [0, 0, 0, 0, 1, 1][c] : 0;
    // sword carried on the right, pointing up
    drawSword(p, 24, 17 + bob, 24, 11 + bob);
    p.rect(23, 18 + bob, 4, 1, HERO.g);
    drawHero(p, { bob, legL: step, legR: step2 });
  } else if (r === 8 && c < 4) {
    // attack: wind up on the right, swing over the head, follow through left
    const swings = [
      [24, 18, 28, 10],
      [20, 9, 22, 1],
      [12, 9, 10, 1],
      [9, 16, 3, 10],
    ];
    const [x0, y0, x1, y1] = swings[c];
    drawSword(p, x0, y0, x1, y1);
    drawHero(p, { bob: c === 1 || c === 2 ? -1 : 0 });
    if (c >= 1) {
      // white swoosh
      const arc = [
        [22, 3],
        [18, 1],
        [14, 1],
        [10, 3],
        [7, 6],
      ];
      for (const [ax, ay] of arc.slice(0, c + 2)) p.set(ax, ay, hex('#ffffff', 220));
    }
  } else if (r === 9 && c < 4) {
    if (c < 3) drawHero(p, { kneel: c * 3, alpha: 1 - c * 0.25 });
    else {
      // a little wisp rising
      p.ellipse(16, 18, 4, 5, hex('#ffffff', 150));
      p.ellipse(16, 15, 2.5, 2.5, hex('#ffffff', 200));
    }
  } else return false;
});

// --------------------------------------------------------------- slime --
// slime.png: 64px cells, 8 columns. Row 0 idle (4 frames), row 1 hop
// (8 frames, highest on frames 3 to 5), row 2 defeat (8 frames).
// The body sits around x 23..42, y 24..42 of each cell.
const SLIME = { o: hex('#1f4a26'), b: hex('#5fbf4a'), d: hex('#3f9440'), l: hex('#a8e877'), e: hex('#1b2a1c'), w: hex('#ffffff') };

function drawSlime(p, { squash = 0, lift = 0, alpha = 1, flat = 0 } = {}) {
  const bottom = 42 - lift;
  const rx = 9.5 + squash + flat * 2.5;
  const ry = 8.5 - squash - flat * 2;
  if (ry < 1) return;
  const cy = bottom - ry;
  const cx = 32.5;
  p.ellipse(cx, cy, rx, ry, SLIME.b, (x, y) => y <= bottom);
  // darker belly and a flat base
  p.ellipse(cx, cy + ry * 0.55, rx * 0.9, ry * 0.5, SLIME.d, (x, y) => y <= bottom && y > cy + 1);
  p.rect(Math.round(cx - rx + 2), bottom, Math.round(rx * 2 - 4), 1, SLIME.d);
  // shine
  if (ry > 4) {
    p.ellipse(cx - rx * 0.45, cy - ry * 0.45, 2.2, 1.6, SLIME.l);
    p.set(cx - rx * 0.1, cy - ry * 0.7, SLIME.l);
  }
  // face
  if (ry > 3) {
    const ey = Math.round(cy - 1 + flat);
    for (const ex of [cx - 4, cx + 3]) {
      p.rect(Math.round(ex), ey, 2, flat ? 1 : 3, SLIME.e);
      if (!flat) p.set(Math.round(ex), ey, SLIME.w);
    }
    if (!flat) p.rect(Math.round(cx - 1), ey + 3, 2, 1, SLIME.e);
  }
  p.outline(SLIME.o);
  p.shadow(cx, 43, 9 + flat * 2 - lift * 0.3, 2);
  if (alpha < 1) p.fade(alpha);
}

const slime = sheet(8, 3, 64, 64, (p, c, r) => {
  if (r === 0) {
    if (c > 3) return false;
    drawSlime(p, { squash: [0, 0.6, 1, 0.6][c] });
  } else if (r === 1) {
    const lift = [0, 1, 4, 8, 10, 8, 3, 0][c];
    const squash = [1.5, -1.2, -1, -0.5, 0, -0.5, -1, 1.8][c];
    drawSlime(p, { lift, squash });
  } else {
    if (c < 5) drawSlime(p, { flat: c * 0.55, alpha: 1 - c * 0.12 });
    // splash droplets
    const drops = [
      [22, 38],
      [44, 37],
      [27, 31],
      [39, 30],
      [33, 27],
    ];
    if (c >= 2)
      for (const [dx, dy] of drops) {
        const k = c - 2;
        p.rect(Math.round(32 + (dx - 32) * (1 + k * 0.35)), Math.round(dy - k + k * k * 0.3), 2, 2, hex('#7fd65f', Math.max(0, 255 - k * 45)));
      }
  }
});

// ------------------------------------------------------------ skeleton --
// skeleton.png: 32px cells, 6 columns. Row 0 idle and row 3 walk (facing
// down), row 6 defeat (4 frames), row 7 hurt (1 frame).
const BONE = { o: INK, w: hex('#efeadb'), W: hex('#c9c1ab'), k: hex('#3a2b2b'), r: hex('#c94a4a') };
const SKULL = [
  '....oooo', // 0
  '...owwww',
  '..owwwww',
  '..owwwww',
  '..owkkww', // 4 eye sockets
  '..owkkrw',
  '..oWwwwk', // 6 nose
  '...oWwww',
  '...owkwk', // 8 teeth
  '....oooo',
];
function drawSkeleton(p, { bob = 0, legL = 0, legR = 0, armUp = 0 } = {}) {
  const x = 8;
  const y = 6 + bob;
  p.art(x, y, SKULL, BONE, { mirror: true });
  // spine, ribs and pelvis
  p.rect(x + 7, y + 10, 2, 7, BONE.w);
  for (let i = 0; i < 3; i++) p.rect(x + 4, y + 11 + i * 2, 8, 1, i === 2 ? BONE.W : BONE.w);
  p.rect(x + 5, y + 17, 6, 2, BONE.w);
  // arms
  p.rect(x + 2, y + 11 - armUp, 1, 6, BONE.w);
  p.rect(x + 13, y + 11 + armUp, 1, 6, BONE.w);
  // legs
  p.rect(x + 5, y + 19, 1, 4 - legL, BONE.w);
  p.rect(x + 10, y + 19, 1, 4 - legR, BONE.w);
  p.rect(x + 4, y + 23 - legL, 2, 1, BONE.W);
  p.rect(x + 10, y + 23 - legR, 2, 1, BONE.W);
  p.outline(INK);
  p.shadow(16, 30, 6, 1.8);
}
const skeleton = sheet(6, 8, 32, 32, (p, c, r) => {
  if (r === 0) drawSkeleton(p, { bob: c < 3 ? 0 : 1, armUp: c % 3 === 1 ? 1 : 0 });
  else if (r === 3) drawSkeleton(p, { bob: c % 3 === 1 ? -1 : 0, legL: [0, 1, 1, 0, 0, 0][c], legR: [0, 0, 0, 0, 1, 1][c] });
  else if (r === 6 && c < 4) {
    // collapses into a pile of bones
    if (c === 0) drawSkeleton(p, { bob: 2 });
    else {
      const drop = c * 4;
      p.art(8, 6 + drop + c * 2, SKULL.slice(0, 10 - c * 2), BONE, { mirror: true });
      for (let i = 0; i < 2 + c; i++) p.rect(8 + ((i * 5) % 12), 27 - (i % 2), 5, 1, BONE.w);
      p.outline(INK);
      p.shadow(16, 30, 7, 1.8);
      if (c === 3) p.fade(0.7);
    }
  } else if (r === 7 && c === 0) {
    drawSkeleton(p);
    p.tint(hex('#ff6b6b'), 0.45);
  } else return false;
});

// ------------------------------------------------------------- animals --
// chicken/pig/sheep/cow.png: 32px cells, 2 columns. Row 0 walking (facing
// left), row 1 startled. Body sits around x 8..24, y 10..24.
function legs(p, xs, y, h, c, frame) {
  xs.forEach((lx, i) => p.rect(lx, y, 1 + (h > 2 ? 1 : 0), h - ((i + frame) % 2), c));
}
const ANIMALS = {
  chicken(p, f, lift) {
    const y = -lift;
    legs(p, [14, 18], 22 + y, 3, hex('#e39a2d'), f);
    p.ellipse(17, 18 + y, 6.5, 5, hex('#fbf7ee'));
    p.ellipse(18, 20 + y, 5, 2.5, hex('#e5dccb'));
    p.ellipse(11, 13 + y, 3.6, 3.6, hex('#fbf7ee'));
    p.rect(9, 9 + y, 3, 2, hex('#d8423a'));
    p.rect(6, 13 + y, 2, 2, hex('#f0a32d'));
    p.set(10, 12 + y, INK);
    p.rect(22, 14 + y, 2, 3, hex('#e5dccb'));
    p.rect(17, 17 + y, 3, 1, hex('#e5dccb'));
  },
  pig(p, f, lift) {
    const y = -lift;
    legs(p, [11, 14, 19, 22], 22 + y, 3, hex('#d97e95'), f);
    p.ellipse(17, 18 + y, 8.5, 5.5, hex('#f5a9bb'));
    p.ellipse(18, 21 + y, 7, 2, hex('#e48ea4'));
    p.ellipse(10, 16 + y, 4.5, 4.2, hex('#f5a9bb'));
    p.rect(5, 16 + y, 3, 3, hex('#e48ea4'));
    p.set(5, 17 + y, hex('#8a4a5a'));
    p.set(7, 17 + y, hex('#8a4a5a'));
    p.set(9, 14 + y, INK);
    p.rect(11, 11 + y, 2, 2, hex('#e48ea4'));
    p.set(26, 15 + y, hex('#e48ea4'));
    p.set(27, 14 + y, hex('#e48ea4'));
  },
  sheep(p, f, lift) {
    const y = -lift;
    legs(p, [12, 15, 19, 22], 22 + y, 3, hex('#4a4450'), f);
    for (const [cx, cy, r] of [[14, 16, 4], [19, 15, 4.5], [23, 18, 4], [17, 20, 4.5], [12, 20, 3.5], [21, 21, 3.5]]) p.ellipse(cx, cy + y, r, r, hex('#f3efe4'));
    for (const [cx, cy] of [[18, 13], [22, 15], [14, 14]]) p.set(cx, cy + y, hex('#ffffff'));
    p.ellipse(9, 16 + y, 3.2, 3.8, hex('#4a4450'));
    p.set(8, 15 + y, hex('#ffffff'));
    p.rect(10, 12 + y, 3, 2, hex('#f3efe4'));
  },
  cow(p, f, lift) {
    const y = -lift;
    legs(p, [10, 13, 21, 24], 22 + y, 4, hex('#d9d3c6'), f);
    p.ellipse(18, 17 + y, 9.5, 6, hex('#fbf8f1'));
    for (const [cx, cy, r] of [[15, 15, 2.5], [22, 18, 3], [19, 13, 1.6]]) p.ellipse(cx, cy + y, r, r, hex('#3b3434'));
    p.ellipse(18, 21 + y, 5, 1.5, hex('#e9e1d2'));
    p.ellipse(9, 15 + y, 4.2, 4.5, hex('#fbf8f1'));
    p.ellipse(7, 18 + y, 3, 2, hex('#f2b2bd'));
    p.set(6, 18 + y, hex('#8a4a5a'));
    p.set(8, 14 + y, INK);
    p.rect(8, 9 + y, 1, 2, hex('#efe2bd'));
    p.rect(11, 9 + y, 1, 2, hex('#efe2bd'));
    p.rect(27, 15 + y, 1, 4, hex('#3b3434'));
  },
};
const animalSheets = Object.fromEntries(
  Object.entries(ANIMALS).map(([name, draw]) => [
    name,
    sheet(2, 2, 32, 32, (p, c, r) => {
      draw(p, c, r === 1 ? 2 + c : 0);
      p.outline(INK);
      p.shadow(17, 26, 8, 1.8);
      if (r === 1) {
        // startled: a red "!" above
        p.rect(17, 1, 2, 4, hex('#e2433b'));
        p.rect(17, 6, 2, 1, hex('#e2433b'));
      }
    }),
  ]),
);

// --------------------------------------------------------------- decor --
// decor.png: 16px grid, 8 columns x 9 rows. game.js reads:
// scenery (0..2,0) (0..2,1) (1..2,2) (1,8) (2,7) (3,0); items carrot (4,3),
// gold (2,6), crystal (3,3), swift boots (6,3), bloom flower (0,8);
// lamp post (4,4) 1x3 tiles.
const decor = new Px(128, 144);
const tile = (c, r, draw, { outline = true, shadow = null } = {}) => {
  const p = new Px(16, 16);
  draw(p);
  if (outline) p.outline(INK);
  if (shadow) p.shadow(...shadow);
  decor.blit(p, c * 16, r * 16);
};
const G = { d: hex('#2f6b34'), m: hex('#4f9a44'), l: hex('#7cc45a') };
// bushes
tile(0, 0, (p) => {
  p.ellipse(8, 10, 6, 4.5, G.m);
  p.ellipse(6, 8, 2, 1.5, G.l);
  p.ellipse(9, 12, 4, 1.5, G.d);
}, { shadow: [8, 14.5, 6, 1.5] });
tile(1, 0, (p) => {
  p.ellipse(6, 10, 4, 3.5, G.m);
  p.ellipse(11, 11, 3.5, 3, G.m);
  p.set(5, 9, G.l);
  p.set(10, 10, G.l);
  p.set(6, 9, hex('#e2433b'));
  p.set(11, 11, hex('#e2433b'));
}, { shadow: [8, 14.5, 6, 1.5] });
tile(2, 0, (p) => {
  p.ellipse(8, 11, 5, 3.5, G.m);
  for (const [x, y] of [[5, 10], [8, 9], [11, 11]]) p.set(x, y, hex('#f4e27a'));
}, { shadow: [8, 14.5, 5, 1.5] });
tile(3, 0, (p) => {
  p.ellipse(8, 11, 4.5, 3, G.d);
  p.ellipse(7, 10, 2, 1.2, G.m);
}, { shadow: [8, 14, 5, 1.2] });
// rocks and tufts
tile(0, 1, (p) => {
  p.ellipse(8, 11, 5, 3.5, hex('#9a9ca6'));
  p.ellipse(7, 10, 2.5, 1.5, hex('#c3c5cc'));
}, { shadow: [8, 14, 5, 1.2] });
tile(1, 1, (p) => {
  p.ellipse(8, 12, 3, 2.2, hex('#9a9ca6'));
  p.set(7, 11, hex('#c3c5cc'));
}, { shadow: [8, 14, 3, 1] });
tile(2, 1, (p) => {
  for (const [x, h] of [[5, 4], [7, 6], [9, 5], [11, 3]]) p.rect(x, 14 - h, 1, h, G.d);
  p.set(7, 8, G.l);
}, { outline: false });
// mushrooms and flowers
tile(1, 2, (p) => {
  p.rect(7, 10, 2, 4, hex('#f3e7cf'));
  p.ellipse(8, 9, 4.5, 2.8, hex('#d8423a'), (x, y) => y < 10);
  p.set(6, 8, hex('#ffffff'));
  p.set(9, 7, hex('#ffffff'));
}, { shadow: [8, 14.5, 4, 1] });
tile(2, 2, (p) => {
  for (const [x, y, c] of [[5, 9, '#f4e27a'], [10, 11, '#ffffff'], [7, 12, '#f4e27a']]) {
    p.rect(x, y + 1, 1, 14 - y - 1, G.d);
    p.set(x, y, hex(c));
    p.set(x - 1, y, hex(c, 200));
    p.set(x + 1, y, hex(c, 200));
  }
}, { outline: false });
tile(1, 8, (p) => {
  for (const [x, y] of [[4, 10], [8, 8], [11, 11]]) {
    p.rect(x, y + 1, 1, 3, G.d);
    p.set(x, y, hex('#9fd0ff'));
    p.set(x, y - 1, hex('#c8e5ff'));
  }
}, { outline: false });
tile(2, 7, (p) => {
  p.ellipse(8, 11, 5, 3.5, hex('#8a5a33'));
  p.ellipse(8, 9.5, 4, 2, hex('#c99a63'));
  p.ellipse(8, 9.5, 2, 1, hex('#a87a48'));
}, { shadow: [8, 14.5, 6, 1.2] });
// items
tile(4, 3, (p) => {
  // carrot
  for (let i = 0; i < 8; i++) p.rect(4 + i, 11 - i, Math.max(1, 3 - (i >> 2)), 2, hex('#f08a2c'));
  p.rect(10, 2, 1, 3, G.m);
  p.rect(12, 3, 1, 3, G.l);
  p.rect(11, 1, 1, 3, G.m);
});
tile(2, 6, (p) => {
  // gold coins
  for (const [x, y] of [[5, 10], [10, 10], [7, 6]]) {
    p.ellipse(x + 1, y + 1, 3, 3, hex('#e8b33a'));
    p.set(x, y, hex('#fff1a8'));
  }
});
tile(3, 3, (p) => {
  // crystal
  p.art(4, 2, ['...oo...', '..obbo..', '.obbLbo.', 'obbbLLbo', 'obbbbLbo', '.obbbbo.', '..obbo..', '...oo...'].map((r) => r.replace(/o/g, '.')), { b: hex('#4ba3e3'), L: hex('#bfe6ff') });
  p.rect(7, 4, 1, 6, hex('#8fd0ff'));
});
tile(6, 3, (p) => {
  // swift boots: a boot with a little wing
  p.rect(5, 5, 4, 7, hex('#8a5a33'));
  p.rect(5, 11, 7, 2, hex('#8a5a33'));
  p.rect(5, 5, 4, 1, hex('#c99a63'));
  p.rect(2, 6, 3, 1, hex('#ffffff'));
  p.rect(1, 7, 4, 1, hex('#ffffff'));
  p.rect(2, 8, 3, 1, hex('#dfe7ef'));
});
tile(0, 8, (p) => {
  // bloom flower (bomb pickup and HUD icon)
  p.rect(7, 9, 2, 6, G.d);
  p.rect(9, 11, 2, 1, G.m);
  for (const [x, y] of [[8, 3], [4, 6], [12, 6], [5, 10], [11, 10]].map(([x, y]) => [x, y - 1])) p.ellipse(x, y, 2.4, 2.4, hex('#f06a9b'));
  p.ellipse(8, 6, 2.2, 2.2, hex('#ffd34d'));
  p.set(7, 5, hex('#fff3b0'));
});
// lamp post: 1x3 tiles at (4,4)
{
  const p = new Px(16, 48);
  p.rect(7, 12, 2, 34, hex('#3e3a46'));
  p.rect(5, 44, 6, 2, hex('#3e3a46'));
  p.rect(4, 4, 8, 9, hex('#3e3a46'));
  p.rect(5, 5, 6, 7, hex('#ffd36b'));
  p.rect(6, 6, 2, 3, hex('#fff3c2'));
  p.rect(3, 3, 10, 1, hex('#3e3a46'));
  p.outline(INK);
  p.shadow(8, 46.5, 5, 1.2);
  decor.blit(p, 64, 64);
}

// ---------------------------------------------------------------- trees --
function canopy(p, cx, cy, r, { pine = false } = {}) {
  if (pine) {
    for (let i = 0; i < 4; i++) p.ellipse(cx, cy - 4 + i * 6, r * (0.45 + i * 0.18), 4, i % 2 ? G.m : hex('#3f8a42'));
  } else {
    p.ellipse(cx, cy, r, r * 0.9, G.m);
    for (const [dx, dy, rr] of [[-r * 0.55, r * 0.15, 0.5], [r * 0.55, r * 0.2, 0.5], [0, -r * 0.45, 0.55]]) p.ellipse(cx + dx, cy + dy, r * rr, r * rr * 0.9, G.m);
    p.ellipse(cx + r * 0.1, cy + r * 0.55, r * 0.8, r * 0.3, G.d, (x, y) => y > cy + r * 0.3);
  }
  // dappled highlights
  for (let k = 0; k < r * 3; k++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * r * 0.75;
    const x = cx - r * 0.2 + Math.cos(a) * d * 0.8;
    const y = cy - r * 0.25 + Math.sin(a) * d * 0.6;
    if (p.alpha(Math.floor(x), Math.floor(y))) p.set(x, y, G.l);
  }
}
const oak = new Px(64, 80);
oak.rect(27, 46, 10, 26, hex('#7a4f2e'));
oak.rect(29, 48, 3, 22, hex('#9a6a40'));
oak.rect(24, 69, 4, 3, hex('#7a4f2e'));
oak.rect(36, 69, 4, 3, hex('#7a4f2e'));
canopy(oak, 32, 30, 22);
oak.outline(INK);
oak.shadow(32, 73, 20, 4, 80);

const oakSmall = new Px(96, 48);
{
  const a = new Px(32, 48);
  a.rect(14, 30, 4, 12, hex('#7a4f2e'));
  canopy(a, 16, 20, 11);
  a.outline(INK);
  a.shadow(16, 43, 10, 2.5, 80);
  oakSmall.blit(a, 32, 0);
  const b = new Px(32, 48);
  b.rect(14, 33, 4, 9, hex('#7a4f2e'));
  canopy(b, 16, 20, 12, { pine: true });
  b.outline(INK);
  b.shadow(16, 43, 9, 2.5, 80);
  oakSmall.blit(b, 64, 0);
}

// ------------------------------------------------------ props & ground --
const chest = new Px(16, 16);
chest.rect(1, 4, 14, 11, hex('#9a5f2f'));
chest.rect(1, 4, 14, 4, hex('#b8783f'));
chest.rect(1, 8, 14, 1, hex('#5e3a1d'));
chest.rect(1, 4, 1, 11, hex('#e8b33a'));
chest.rect(14, 4, 1, 11, hex('#e8b33a'));
chest.rect(7, 7, 2, 3, hex('#e8b33a'));
chest.rect(2, 5, 6, 1, hex('#d29a5b'));
chest.outline(INK);

const fences = new Px(64, 16);
for (const x of [17, 31, 45]) fences.rect(x, 3, 3, 11, hex('#a8733f'));
fences.rect(16, 5, 32, 2, hex('#c08a4f'));
fences.rect(16, 10, 32, 2, hex('#c08a4f'));
fences.outline(INK);

const GRASS = hex('#4f9a44');
const grass = new Px(16, 16);
grass.rect(0, 0, 16, 16, GRASS);
for (const [x, y] of [[2, 3], [9, 1], [13, 9], [5, 11], [10, 14], [1, 8]]) {
  grass.set(x, y, hex('#5fae50'));
  grass.set(x + 1, y - 1, hex('#5fae50'));
}
for (const [x, y] of [[6, 5], [12, 4], [3, 14]]) grass.set(x, y, hex('#3f8a3c'));

// path.png: 48x96. Row 1 = left edge, middle and right edge tiles that
// repeat vertically; row 5 = three pebble overlays.
const DIRT = hex('#d9a066');
const pathTiles = new Px(48, 96);
for (let col = 0; col < 3; col++) {
  const ox = col * 16;
  pathTiles.rect(ox, 16, 16, 16, DIRT);
  for (const [x, y] of [[3, 2], [11, 6], [6, 12], [13, 13]]) pathTiles.set(ox + x, 16 + y, hex('#c98d55'));
  if (col !== 1) {
    // grass fringe along the edge
    const edge = col === 0 ? 0 : 15;
    const dir = col === 0 ? 1 : -1;
    for (let y = 0; y < 16; y++) {
      const w = 2 + ((y * 7) % 5 === 0 ? 1 : 0) + (y % 4 === 1 ? 1 : 0);
      for (let i = 0; i < w; i++) pathTiles.set(ox + edge + i * dir, 16 + y, i === w - 1 ? hex('#2f6b34') : GRASS);
    }
  }
}
for (let v = 0; v < 3; v++) {
  const p = new Px(16, 16);
  const spots = [
    [[4, 6], [9, 9]],
    [[6, 5], [8, 10], [11, 7]],
    [[5, 8]],
  ][v];
  for (const [x, y] of spots) {
    p.rect(x, y, 2, 1, hex('#b07a46'));
    p.set(x, y - 1, hex('#e9bd8a'));
  }
  pathTiles.blit(p, v * 16, 80);
}

// house.png: 96x128 cottage (only drawn on the farm stage)
const house = new Px(96, 128);
house.rect(18, 58, 60, 54, hex('#efe0c0'));
for (let y = 62; y < 112; y += 6) house.rect(18, y, 60, 1, hex('#d9c6a0'));
house.rect(41, 84, 14, 28, hex('#7a4f2e'));
house.rect(43, 86, 10, 26, hex('#9a6a40'));
house.set(51, 98, hex('#e8b33a'));
for (const x of [24, 60]) {
  house.rect(x, 72, 12, 12, hex('#6fb6d8'));
  house.rect(x + 5, 72, 2, 12, hex('#7a4f2e'));
  house.rect(x, 77, 12, 2, hex('#7a4f2e'));
  house.rect(x + 1, 73, 3, 3, hex('#c8ecff'));
}
for (let i = 0; i < 26; i++) {
  const w = 14 + i * 3;
  house.rect(48 - w / 2, 8 + i * 2, w, 2, i % 3 === 0 ? hex('#a8443a') : hex('#c9543f'));
}
house.rect(64, 10, 8, 24, hex('#8a8a96'));
house.rect(63, 8, 10, 3, hex('#6c6c78'));
house.outline(INK);
house.shadow(48, 114, 36, 4, 80);

// -------------------------------------------------------------- write --
await mkdir(OUT, { recursive: true });
await Promise.all([
  player.save('player'),
  slime.save('slime'),
  skeleton.save('skeleton'),
  ...Object.entries(animalSheets).map(([n, s]) => s.save(n)),
  decor.save('decor'),
  oak.save('oak'),
  oakSmall.save('oak-small'),
  chest.save('chest'),
  fences.save('fences'),
  grass.save('grass'),
  pathTiles.save('path'),
  house.save('house'),
]);
console.log('Slime Siege art written to', path.relative(ROOT, OUT));
