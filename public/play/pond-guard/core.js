// Pond Guard: the rules, with no drawing or sound, so the whole game can be
// simulated and balance-tested headless (node or browser).
// Bugs march down a winding trail towards the frog eggs in the pond. The
// player builds frogs, toads, lilies and herons beside the trail.
(function (root) {
  'use strict';

  const T = 16; // tile size in pixels
  const COLS = 10;
  const ROWS = 14;
  const TOP = 16; // the map starts below the 16px status bar
  const START_COINS = 70;
  const START_EGGS = 20;

  // The trail, as tile waypoints. It enters at the top and snakes down to
  // the pond at the bottom.
  const WAYPOINTS = [
    [1, -1.2], [1, 2], [8, 2], [8, 5], [1, 5], [1, 8], [8, 8], [8, 11], [4, 11], [4, 12.4],
  ];
  const POND = { c0: 2, c1: 7, r0: 12, r1: 13 }; // tiles covered by water

  const px = (c) => c * T + T / 2;
  const py = (r) => TOP + r * T + T / 2;
  const PATH = WAYPOINTS.map(([c, r]) => [px(c), py(r)]);
  const SEG = [];
  let total = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const [x0, y0] = PATH[i];
    const [x1, y1] = PATH[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    SEG.push({ x0, y0, x1, y1, len, at: total });
    total += len;
  }
  const PATH_LEN = total;

  /** Point on the trail at distance d from the start. */
  function pointAt(d) {
    d = Math.max(0, Math.min(PATH_LEN, d));
    for (const s of SEG) {
      if (d <= s.at + s.len) {
        const k = (d - s.at) / s.len;
        return { x: s.x0 + (s.x1 - s.x0) * k, y: s.y0 + (s.y1 - s.y0) * k, dx: Math.sign(s.x1 - s.x0), dy: Math.sign(s.y1 - s.y0) };
      }
    }
    const s = SEG[SEG.length - 1];
    return { x: s.x1, y: s.y1, dx: 0, dy: 1 };
  }

  // Which tiles the trail covers, and which can be built on.
  const TRAIL = new Set();
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const [c0, r0] = WAYPOINTS[i];
    const [c1, r1] = WAYPOINTS[i + 1];
    const steps = Math.ceil(Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) * 4);
    for (let k = 0; k <= steps; k++) {
      const c = Math.round(c0 + ((c1 - c0) * k) / steps);
      const r = Math.round(r0 + ((r1 - r0) * k) / steps);
      if (r >= 0 && r < ROWS) TRAIL.add(r * COLS + c);
    }
  }
  const inPond = (c, r) => c >= POND.c0 && c <= POND.c1 && r >= POND.r0 && r <= POND.r1;
  const isTrail = (c, r) => TRAIL.has(r * COLS + c);
  function buildable(c, r) {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS && !isTrail(c, r) && !inPond(c, r);
  }

  // ---------------------------------------------------------------- towers --
  // Each tower has 3 levels. cost[0] builds it, cost[1..2] upgrade it.
  const TOWERS = {
    frog: {
      name: 'FROG', blurb: 'QUICK TONGUE', cost: [15, 20, 40],
      dmg: [2, 3.5, 6], range: [30, 34, 39], rate: [30, 24, 18], air: true,
    },
    toad: {
      name: 'TOAD', blurb: 'MUD SPLASH', cost: [30, 35, 60],
      dmg: [4, 7, 12], splash: [15, 17, 21], range: [36, 39, 43], rate: [72, 62, 52], air: false,
    },
    lily: {
      name: 'LILY', blurb: 'SLOWS BUGS', cost: [25, 25, 45],
      slow: [0.6, 0.5, 0.4], dps: [0, 0.03, 0.07], range: [24, 28, 33], air: true,
    },
    heron: {
      name: 'HERON', blurb: 'LONG PECK', cost: [50, 60, 100],
      dmg: [12, 22, 40], range: [56, 62, 70], rate: [96, 86, 76], air: true,
    },
  };
  const TOWER_ORDER = ['frog', 'toad', 'lily', 'heron'];

  function spent(tw) {
    let s = 0;
    for (let i = 0; i <= tw.level; i++) s += TOWERS[tw.type].cost[i];
    return s;
  }
  const sellValue = (tw) => Math.floor(spent(tw) * 0.7);
  const upgradeCost = (tw) => (tw.level >= 2 ? null : TOWERS[tw.type].cost[tw.level + 1]);
  function stat(tw, key) {
    const v = TOWERS[tw.type][key];
    return Array.isArray(v) ? v[tw.level] : v;
  }

  // ------------------------------------------------------------------ bugs --
  const BUGS = {
    ant: { hp: 5, speed: 0.42, coins: 1, score: 10, eggs: 1, armor: 0 },
    fly: { hp: 3, speed: 0.72, coins: 1, score: 10, eggs: 1, armor: 0, air: true },
    ladybug: { hp: 12, speed: 0.3, coins: 3, score: 30, eggs: 2, armor: 2 },
    worm: { hp: 15, speed: 0.33, coins: 2, score: 25, eggs: 2, armor: 0, split: 2 },
    stag: { hp: 110, speed: 0.22, coins: 25, score: 400, eggs: 5, armor: 3, boss: true },
  };

  const hpScale = (wave) => Math.pow(1.13, wave - 1) * (1 + Math.max(0, wave - 15) * 0.04);
  const coinScale = (wave) => 1 + Math.floor((wave - 1) / 5) * 0.25;

  /** The list of bugs in a wave: [{ type, at }] with `at` in frames. */
  function waveList(n) {
    const out = [];
    let at = 0;
    const add = (type, count, gap) => {
      for (let i = 0; i < count; i++) {
        out.push({ type, at });
        at += gap;
      }
      at += 50;
    };
    if (n % 10 === 0) {
      add('ant', 4 + n / 5, 22);
      add('stag', n / 10, 120);
      add('fly', 2 + n / 5, 20);
      return out;
    }
    add('ant', 5 + Math.floor(n * 0.8), Math.max(16, 34 - n));
    if (n >= 3) add('fly', 2 + Math.floor(n / 2), Math.max(12, 24 - n / 2));
    if (n >= 5) add('ladybug', 1 + Math.floor((n - 3) / 2), 44);
    if (n >= 7) add('worm', 1 + Math.floor((n - 5) / 3), 50);
    if (n >= 12) add('ant', Math.floor(n / 2), 14);
    if (n >= 15 && n % 5 === 0) add('ladybug', Math.floor(n / 4), 26);
    return out;
  }

  // ------------------------------------------------------------------ game --
  function newGame() {
    return {
      frame: 0,
      coins: START_COINS,
      eggs: START_EGGS,
      score: 0,
      wave: 0, // waves started
      cleared: 0, // waves cleared
      inWave: false,
      breakT: -1, // frames until the next wave starts by itself; -1 waits for the player
      queue: [],
      waveT: 0,
      towers: [],
      bugs: [],
      shots: [],
      nextId: 1,
      kills: 0,
      over: false,
      events: [],
    };
  }

  function towerAt(G, c, r) {
    return G.towers.find((tw) => tw.c === c && tw.r === r) || null;
  }

  function build(G, c, r, type) {
    const def = TOWERS[type];
    if (!def || G.over || !buildable(c, r) || towerAt(G, c, r) || G.coins < def.cost[0]) return null;
    G.coins -= def.cost[0];
    const tw = { id: G.nextId++, type, c, r, x: px(c), y: py(r), level: 0, cool: 10, aim: 0, kills: 0 };
    G.towers.push(tw);
    G.events.push(['build', tw.x, tw.y, type]);
    return tw;
  }

  function upgrade(G, tw) {
    const cost = upgradeCost(tw);
    if (cost === null || G.coins < cost || G.over) return false;
    G.coins -= cost;
    tw.level++;
    G.events.push(['upgrade', tw.x, tw.y, tw.level]);
    return true;
  }

  function sell(G, tw) {
    const i = G.towers.indexOf(tw);
    if (i < 0 || G.over) return 0;
    const v = sellValue(tw);
    G.coins += v;
    G.towers.splice(i, 1);
    G.events.push(['sell', tw.x, tw.y, v]);
    return v;
  }

  /** Start the next wave now. Calling it early pays a small bonus. */
  function callWave(G) {
    if (G.inWave || G.over) return false;
    const early = G.breakT > 0 ? Math.ceil(G.breakT / 60) : 0;
    if (early) G.coins += early;
    G.wave++;
    G.inWave = true;
    G.queue = waveList(G.wave);
    G.waveT = 0;
    G.breakT = -1;
    G.events.push(['wave', G.wave, early, G.wave % 10 === 0]);
    return true;
  }

  function spawn(G, type, d = 0, hpMul = 1) {
    const def = BUGS[type];
    const hp = def.hp * hpScale(G.wave) * hpMul;
    const b = { id: G.nextId++, type, d, hp, max: hp, slow: 1, air: Boolean(def.air), armor: def.armor, x: 0, y: 0, dx: 0, dy: 1, hitT: 0 };
    const p = pointAt(d);
    b.x = p.x;
    b.y = p.y;
    G.bugs.push(b);
    return b;
  }

  function hurt(G, b, dmg, pierce = 0) {
    if (b.hp <= 0) return;
    const real = Math.max(dmg * 0.2, dmg - Math.max(0, b.armor - pierce));
    b.hp -= real;
    b.hitT = 6;
    if (b.hp <= 0) kill(G, b);
  }

  function kill(G, b) {
    const def = BUGS[b.type];
    const pts = Math.round(def.score * (1 + G.wave / 10));
    const coins = Math.round(def.coins * coinScale(G.wave));
    G.score += pts;
    G.coins += coins;
    G.kills++;
    G.events.push(['kill', b.x, b.y, b.type, pts, coins]);
    if (def.split) {
      for (let i = 0; i < def.split; i++) {
        const a = spawn(G, 'ant', Math.max(0, b.d - 4 - i * 7), 0.8);
        a.x = b.x;
        a.y = b.y;
      }
    }
  }

  function inRange(tw, b, r) {
    return (b.x - tw.x) ** 2 + (b.y - tw.y) ** 2 <= r * r;
  }

  function step(G) {
    if (G.over) return;
    G.frame++;

    // Waves: spawn the queue, then count down the break.
    if (G.inWave) {
      G.waveT++;
      while (G.queue.length && G.queue[0].at <= G.waveT) spawn(G, G.queue.shift().type);
      if (!G.queue.length && !G.bugs.length) {
        G.inWave = false;
        G.cleared = G.wave;
        const bonus = 25 * G.wave;
        const coins = 5 + Math.floor(G.wave / 2);
        G.score += bonus;
        G.coins += coins;
        G.breakT = 60 * 9;
        G.events.push(['clear', G.wave, bonus, coins]);
      }
    } else if (G.breakT > 0 && --G.breakT === 0) {
      callWave(G);
    }

    // Lilies slow (and later sting) everything in their pollen.
    for (const b of G.bugs) b.slow = 1;
    for (const tw of G.towers) {
      if (tw.type !== 'lily') continue;
      const r = stat(tw, 'range');
      const s = stat(tw, 'slow');
      const dps = stat(tw, 'dps');
      tw.busy = false;
      for (const b of G.bugs) {
        if (!inRange(tw, b, r)) continue;
        tw.busy = true;
        if (s < b.slow) b.slow = s;
        if (dps) hurt(G, b, dps * (b.max > 60 ? 2 : 1) + (b.armor ? dps * b.armor : 0), 9);
      }
    }

    // Bugs walk the trail.
    for (const b of G.bugs) {
      if (b.hp <= 0) continue;
      b.d += BUGS[b.type].speed * b.slow;
      const p = pointAt(b.d);
      b.x = p.x;
      b.y = p.y;
      b.dx = p.dx;
      b.dy = p.dy;
      if (b.hitT) b.hitT--;
      if (b.d >= PATH_LEN) {
        b.hp = 0;
        b.leaked = true;
        const lost = BUGS[b.type].eggs;
        G.eggs = Math.max(0, G.eggs - lost);
        G.events.push(['leak', b.x, b.y, b.type, lost]);
      }
    }

    // Towers attack.
    for (const tw of G.towers) {
      if (tw.type === 'lily') continue;
      if (tw.cool > 0) tw.cool--;
      if (tw.cool > 0) continue;
      const r = stat(tw, 'range');
      const def = TOWERS[tw.type];
      let best = null;
      for (const b of G.bugs) {
        if (b.hp <= 0 || (b.air && !def.air) || !inRange(tw, b, r)) continue;
        if (tw.type === 'heron') {
          // Herons go for the toughest bug in reach.
          if (!best || b.hp > best.hp) best = b;
        } else if (!best || b.d > best.d) best = b; // others: the one nearest the pond
      }
      if (!best) continue;
      tw.cool = stat(tw, 'rate');
      tw.aim = Math.atan2(best.y - tw.y, best.x - tw.x);
      tw.fireT = 10;
      const dmg = stat(tw, 'dmg');
      if (tw.type === 'frog') {
        G.events.push(['tongue', tw.x, tw.y, best.x, best.y, tw.level]);
        hurt(G, best, dmg);
      } else if (tw.type === 'heron') {
        G.events.push(['peck', tw.x, tw.y, best.x, best.y, tw.level]);
        hurt(G, best, dmg, 2);
      } else if (tw.type === 'toad') {
        G.shots.push({ x: tw.x, y: tw.y - 4, sx: tw.x, sy: tw.y - 4, tx: best.x, ty: best.y, target: best.id, t: 0, dur: 22, dmg, r: stat(tw, 'splash') });
        G.events.push(['spit', tw.x, tw.y]);
      }
    }

    // Toad mud globs fly in an arc and splash where they land.
    for (const s of G.shots) {
      const tgt = G.bugs.find((b) => b.id === s.target && b.hp > 0);
      if (tgt) {
        s.tx = tgt.x;
        s.ty = tgt.y;
      }
      s.t++;
      const k = s.t / s.dur;
      s.x = s.sx + (s.tx - s.sx) * k;
      s.y = s.sy + (s.ty - s.sy) * k - Math.sin(k * Math.PI) * 14;
      if (s.t >= s.dur) {
        s.done = true;
        G.events.push(['splat', s.tx, s.ty, s.r]);
        for (const b of G.bugs) {
          if (b.hp <= 0 || b.air) continue;
          if ((b.x - s.tx) ** 2 + (b.y - s.ty) ** 2 <= s.r * s.r) hurt(G, b, s.dmg);
        }
      }
    }
    G.shots = G.shots.filter((s) => !s.done);
    for (const tw of G.towers) if (tw.fireT) tw.fireT--;

    G.bugs = G.bugs.filter((b) => b.hp > 0);
    if (G.eggs <= 0) {
      G.over = true;
      G.events.push(['over']);
    }
  }

  // Medals go by the number of waves cleared.
  const MEDALS = [
    { at: 40, name: 'POND KING', fill: '#b77cff', rim: '#6a3aa8' },
    { at: 25, name: 'GOLD', fill: '#ffd23f', rim: '#b8860b' },
    { at: 15, name: 'SILVER', fill: '#dfe6ee', rim: '#8a96a3' },
    { at: 8, name: 'BRONZE', fill: '#e0965a', rim: '#8f5426' },
  ];
  const medalFor = (waves) => MEDALS.find((m) => waves >= m.at) || null;

  root.PondGuard = {
    T, COLS, ROWS, TOP, START_COINS, START_EGGS, WAYPOINTS, POND, PATH, PATH_LEN, TOWERS, TOWER_ORDER, BUGS, MEDALS,
    px, py, pointAt, isTrail, inPond, buildable, newGame, build, upgrade, sell, callWave, step, towerAt,
    sellValue, upgradeCost, stat, waveList, hpScale, medalFor,
  };
})(typeof window !== 'undefined' ? window : globalThis);
