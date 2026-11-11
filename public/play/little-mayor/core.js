// Little Mayor: the rules, with no drawing or sound, so they can be tested
// headless. game.js draws them; tests load this file on its own.
//
// A 7x7 town with the Town Hall in the middle and a short road out of each
// side. Each day you get a hand of two buildings from the day's deck (the same
// deck for everyone on the same UTC date) and build one of them, or throw one
// away. Roads cost coins but no day, so you can lay as many as you can afford.
// Building on a used cell knocks down what was there, for a small extra fee.
// At the end of each day the town pays its taxes. After day 40 the town's
// population is your score.
(function (root) {
  'use strict';

  const N = 7; // grid size
  const HALL = 24; // index of the centre cell (3, 3)
  const DAYS = 40;
  const START_COINS = 10;
  const LAND = 20; // prices go up by half for every LAND people (see priceLevel)
  const CLEAR = 2; // extra cost to knock down what's already on a cell

  const TILES = {
    // Roads aren't in the deck: lay one any time you have the coins.
    road: { name: 'ROAD', cost: 2, weight: 0 },
    house: { name: 'HOUSE', cost: 3, weight: 40 },
    shop: { name: 'SHOP', cost: 5, weight: 13 },
    park: { name: 'PARK', cost: 4, weight: 13 },
    school: { name: 'SCHOOL', cost: 8, weight: 10 },
    clinic: { name: 'CLINIC', cost: 8, weight: 10 },
  };
  const KINDS = Object.keys(TILES).filter((k) => TILES[k].weight > 0);

  const xy = (i) => [i % N, Math.floor(i / N)];
  const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? -1 : y * N + x);
  const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /** Cells around i within Chebyshev distance r (not i itself). */
  function around(i, r) {
    const [x, y] = xy(i);
    const out = [];
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (!dx && !dy) continue;
        const j = at(x + dx, y + dy);
        if (j >= 0) out.push(j);
      }
    return out;
  }
  function ortho(i) {
    const [x, y] = xy(i);
    return ORTHO.map(([dx, dy]) => at(x + dx, y + dy)).filter((j) => j >= 0);
  }

  // mulberry32
  function rng(seed) {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** A number from a string such as "2026-11-11". */
  function hash(str) {
    let h = 2166136261;
    for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return h >>> 0;
  }
  /** Today's date in UTC (the site's timezone), "YYYY-MM-DD". */
  function today(d = new Date()) {
    return d.toISOString().slice(0, 10);
  }

  /** The day's deck: the same list of buildings for everyone with the same key. */
  function makeDeck(key) {
    const r = rng(hash('little-mayor:' + key));
    const total = KINDS.reduce((s, k) => s + TILES[k].weight, 0);
    const pick = () => {
      let x = r() * total;
      for (const k of KINDS) if ((x -= TILES[k].weight) < 0) return k;
      return 'house';
    };
    // A fair start: the first hand is always a house and a shop or a park.
    const deck = ['house', r() < 0.5 ? 'shop' : 'park'];
    while (deck.length < DAYS + 4) {
      const k = pick();
      // Never three big buildings in a row.
      const prev = deck.slice(-2);
      if ((k === 'school' || k === 'clinic') && prev.every((p) => p === 'school' || p === 'clinic')) continue;
      deck.push(k);
    }
    return deck;
  }

  function newGame(key = today()) {
    const grid = Array(N * N).fill(null);
    grid[HALL] = 'hall';
    for (const j of ortho(HALL)) grid[j] = 'road';
    const deck = makeDeck(key);
    return { key, grid, deck, next: 2, hand: [deck[0], deck[1]], day: 1, coins: START_COINS, over: false, log: [] };
  }

  /** Which cells are joined to the Town Hall by roads (the hall included). */
  function connectedRoads(grid) {
    const seen = new Set([HALL]);
    const todo = [HALL];
    while (todo.length) {
      const i = todo.pop();
      for (const j of ortho(i)) if (!seen.has(j) && grid[j] === 'road') seen.add(j), todo.push(j);
    }
    return seen;
  }

  /**
   * Everything the town is worth right now. A building is linked when it
   * touches (side by side) a road that leads to the Town Hall. Only linked
   * buildings count. A linked house has 2 people, plus:
   *   +2 with a park next to it (corners count),
   *   +3 with a school within 2 cells, +3 with a clinic within 2 cells,
   *   +1 for each shop next to it (up to 2).
   * Taxes: 2 coins from the Town Hall, (people + 2) / 4 from each house
   * (rounded down), and 1 from each shop for each linked house next to it.
   */
  function evaluate(grid) {
    const roads = connectedRoads(grid);
    const onRoad = (i) => ortho(i).some((j) => roads.has(j));
    const linked = grid.map((k, i) => k !== null && (k === 'hall' || (k === 'road' ? roads.has(i) : onRoad(i))));
    const pop = Array(N * N).fill(0);
    const bonus = Array(N * N).fill(null);
    let population = 0;
    let income = 2;
    grid.forEach((k, i) => {
      if (k !== 'house' || !linked[i]) return;
      const near1 = around(i, 1);
      const near2 = around(i, 2);
      const has = (list, kind) => list.some((j) => grid[j] === kind && linked[j]);
      const b = { park: has(near1, 'park'), school: has(near2, 'school'), clinic: has(near2, 'clinic'), shops: Math.min(2, near1.filter((j) => grid[j] === 'shop' && linked[j]).length) };
      const p = 2 + (b.park ? 2 : 0) + (b.school ? 3 : 0) + (b.clinic ? 3 : 0) + b.shops;
      pop[i] = p;
      bonus[i] = b;
      population += p;
      income += Math.floor((p + 2) / 4);
    });
    const shopIncome = Array(N * N).fill(0);
    grid.forEach((k, i) => {
      if (k === 'shop' && linked[i]) income += shopIncome[i] = around(i, 1).filter((j) => grid[j] === 'house' && linked[j]).length;
    });
    return { population, income, pop, bonus, linked, roads, shopIncome };
  }

  /** Land gets dearer as the town grows: prices go up by half every LAND people. */
  function priceLevel(G) {
    return 1 + Math.floor(evaluate(G.grid).population / LAND) / 2;
  }
  function priceOf(G, kind) {
    return Math.ceil(TILES[kind].cost * priceLevel(G));
  }
  /** Cost of building `kind` on cell i (knocking down what's there), or -1 if not allowed. */
  function costAt(G, kind, i) {
    const here = G.grid[i];
    if (i < 0 || i >= N * N || here === 'hall' || here === kind) return -1;
    return priceOf(G, kind) + (here ? CLEAR : 0);
  }

  /** What building `kind` on cell i would change, without changing anything. */
  function preview(G, kind, i) {
    const cost = costAt(G, kind, i);
    if (cost < 0) return null;
    const before = evaluate(G.grid);
    const grid = G.grid.slice();
    grid[i] = kind;
    const after = evaluate(grid);
    return { pop: after.population - before.population, income: after.income - before.income, cost, after };
  }

  /** End the day: taxes in, a new building in the hand. */
  function endDay(G, used) {
    G.hand.splice(used, 1);
    G.hand.push(G.deck[G.next++] || 'house');
    const e = evaluate(G.grid);
    G.coins += e.income;
    G.log.push({ day: G.day, income: e.income, coins: G.coins, population: e.population });
    if (G.day >= DAYS) G.over = true;
    else G.day++;
    return e;
  }

  /** Build hand[h] on cell i and end the day. Returns false if that isn't allowed. */
  function build(G, h, i) {
    const kind = G.hand[h];
    const cost = kind ? costAt(G, kind, i) : -1;
    if (G.over || cost < 0 || cost > G.coins) return false;
    G.coins -= cost;
    G.grid[i] = kind;
    return endDay(G, h);
  }

  /** Lay a road on cell i. Roads don't use up the day. */
  function buildRoad(G, i) {
    const cost = costAt(G, 'road', i);
    if (G.over || cost < 0 || cost > G.coins) return false;
    G.coins -= cost;
    G.grid[i] = 'road';
    return true;
  }

  /** Throw hand[h] away and let the day pass. */
  function skip(G, h) {
    if (G.over || !G.hand[h]) return false;
    return endDay(G, h);
  }

  function score(G) {
    return evaluate(G.grid).population;
  }

  const api = { N, HALL, DAYS, START_COINS, LAND, CLEAR, TILES, KINDS, xy, at, around, ortho, hash, today, makeDeck, newGame, evaluate, priceLevel, priceOf, costAt, preview, build, buildRoad, skip, score };
  root.LittleMayor = api;
})(typeof window !== 'undefined' ? window : globalThis);
