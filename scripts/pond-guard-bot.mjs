// Balance check for Pond Guard: a few simple bots play the real rules
// (public/play/pond-guard/core.js) and report how many waves they clear.
//   node scripts/pond-guard-bot.mjs
import { readFileSync } from 'node:fs';
new Function(readFileSync(new URL('../public/play/pond-guard/core.js', import.meta.url), 'utf8'))();
const P = globalThis.PondGuard;

// How much of the trail a tower at (c, r) would reach.
function coverage(c, r, range) {
  let n = 0;
  for (let d = 0; d < P.PATH_LEN; d += 4) {
    const p = P.pointAt(d);
    if ((p.x - P.px(c)) ** 2 + (p.y - P.py(r)) ** 2 <= range * range) n++;
  }
  return n;
}
const TILES = [];
for (let r = 0; r < P.ROWS; r++) for (let c = 0; c < P.COLS; c++) if (P.buildable(c, r)) TILES.push([c, r]);
const COV = {};
for (const t of P.TOWER_ORDER) COV[t] = TILES.map(([c, r]) => ({ c, r, cov: coverage(c, r, P.TOWERS[t].range[0]) })).sort((a, b) => b.cov - a.cov);

function play(plan, { upgradeFirst = false, maxWaves = 80 } = {}) {
  const G = P.newGame();
  const leaks = {};
  let i = 0;
  const think = () => {
    for (;;) {
      const want = plan[i % plan.length];
      if (want === 'up' || (upgradeFirst && G.towers.length >= 6)) {
        const tw = G.towers.filter((t) => P.upgradeCost(t) !== null).sort((a, b) => P.upgradeCost(a) - P.upgradeCost(b))[0];
        if (!tw) { i++; continue; }
        if (G.coins < P.upgradeCost(tw)) return;
        P.upgrade(G, tw);
        i++;
        continue;
      }
      const spot = COV[want].find((s) => !P.towerAt(G, s.c, s.r));
      if (!spot) { i++; if (i > 2000) return; continue; }
      if (G.coins < P.TOWERS[want].cost[0]) return;
      P.build(G, spot.c, spot.r, want);
      i++;
    }
  };
  think();
  P.callWave(G);
  while (!G.over && G.wave < maxWaves) {
    if (G.frame % 30 === 0) think();
    if (!G.inWave && G.breakT > 60) { think(); P.callWave(G); }
    P.step(G);
    for (const e of G.events) if (e[0] === 'leak') (leaks[G.wave] = (leaks[G.wave] || 0) + e[4]);
    G.events.length = 0;
  }
  return { cleared: G.cleared, score: G.score, towers: G.towers.length, kills: G.kills, eggs: G.eggs, leaks: Object.entries(leaks).map(([w, n]) => w + ':' + n).join(' ') };
}

const plans = {
  frogs: ['frog'],
  'frog+up': ['frog', 'frog', 'up'],
  mixed: ['frog', 'frog', 'toad', 'lily', 'frog', 'heron', 'up', 'up'],
  'mixed+up': ['frog', 'toad', 'up', 'lily', 'heron', 'up', 'up', 'toad', 'heron', 'up'],
  herons: ['frog', 'heron', 'up', 'heron', 'up'],
  toads: ['frog', 'toad', 'toad', 'up'],
  smart: ['frog', 'frog', 'toad', 'lily', 'up', 'heron', 'up', 'toad', 'up', 'heron', 'up', 'lily', 'heron', 'up', 'up'],
};
for (const [name, plan] of Object.entries(plans)) console.log(name.padEnd(10), JSON.stringify(play(plan)));
