// Signal Strike: an original side-scrolling shooter for INDIE/24, styled
// after the monochrome phone games of the early 2000s. Plain JavaScript and
// a <canvas>, no libraries. The same files run on the website and inside the
// Android app (a WebView that loads them from the APK).
(function () {
  'use strict';

  // ---------------------------------------------------------------- setup --
  const W = 128;
  const H = 72;
  const TOP = 8; // HUD height; the playfield is y = TOP..H
  const STEP = 1000 / 60;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  function fit() {
    // Largest whole-or-half multiple that fits, so pixels stay even.
    const raw = Math.min(innerWidth / W, innerHeight / H);
    const s = raw >= 2 ? Math.floor(raw * 2) / 2 : raw;
    canvas.style.width = `${Math.floor(W * s)}px`;
    canvas.style.height = `${Math.floor(H * s)}px`;
  }
  addEventListener('resize', fit);
  fit();

  const PALETTES = [
    { name: 'CLASSIC', bg: [199, 240, 216], fg: [67, 82, 61] },
    { name: 'NIGHT', bg: [24, 34, 48], fg: [140, 220, 255] },
    { name: 'AMBER', bg: [40, 24, 8], fg: [255, 176, 64] },
    { name: 'MONO', bg: [230, 230, 220], fg: [30, 30, 30] },
  ];

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('signal-strike.' + k);
        return v === null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('signal-strike.' + k, JSON.stringify(v));
      } catch {
        /* storage unavailable */
      }
    },
  };

  let paletteIndex = store.get('palette', 0) % PALETTES.length;
  let hiScore = store.get('hi', 0);
  let soundOn = store.get('sound', true);

  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const pal = () => PALETTES[paletteIndex];
  const FG = () => rgb(pal().fg);
  // Light pixels drawn on the dark colour, for "lit" details.
  const BG = () => rgb(pal().bg);

  // ----------------------------------------------------------------- font --
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '111101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101101111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110', ' ': '000000000000000', ':': '000010000010000', '.': '000000000000010', '!': '010010010000010',
    '-': '000000111000000', '?': '110001010000010', '/': '001001010100100', '+': '000010111010000', x: '000101010101000',
  };
  function text(str, x, y, color = FG(), align = 'left') {
    str = String(str);
    const w = str.length * 4 - 1;
    if (align === 'center') x -= Math.floor(w / 2);
    if (align === 'right') x -= w;
    ctx.fillStyle = color;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i] === 'x' ? 'x' : str[i].toUpperCase();
      const g = FONT[ch] || FONT['?'];
      for (let p = 0; p < 15; p++) if (g[p] === '1') ctx.fillRect(x + i * 4 + (p % 3), y + ((p / 3) | 0), 1, 1);
    }
  }

  // -------------------------------------------------------------- sprites --
  // Each sprite is a list of rows; "1" is a lit pixel.
  const S = (rows) => ({ rows, w: rows[0].length, h: rows.length });
  const SPR = {
    ship: S(['11000000.', '.1111000.', '111111110', '111111111', '.1111000.', '11000000.']),
    shipMini: S(['110..', '11111', '110..']),
    drone: S(['..111..', '.1.1.1.', '1111111', '.1.1.1.', '..111..']),
    drone2: S(['..111..', '.11.11.', '1111111', '.11.11.', '..111..']),
    dart: S(['....111', '..1111.', '1111111', '..1111.', '....111']),
    shooter: S(['..1111..', '.111111.', '11.11.11', '.111111.', '.1....1.']),
    mine: S(['1.1.1', '.111.', '11.11', '.111.', '1.1.1']),
    rock: S(['.1111.', '11.111', '111111', '1111.1', '.1111.']),
    crab: S(['1.....1', '.11111.', '11.1.11', '1111111', '.1.1.1.', '1.....1']),
    boom1: S(['.1.1.', '1...1', '.....', '1...1', '.1.1.']),
    boom2: S(['1...1', '..1..', '.1.1.', '..1..', '1...1']),
    heart: S(['11.11', '11111', '.111.', '..1..']),
    missileIcon: S(['..1..', '11111', '..1..']),
    beamIcon: S(['11111', '.....', '11111']),
    wallIcon: S(['1.1', '1.1', '1.1']),
    box: S(['1111111', '1.....1', '1.....1', '1.....1', '1.....1', '1111111']),
    boss1: S([
      '.......11111111.....',
      '.....111111111111...',
      '...1111..1111..111..',
      '..1111111111111111..',
      '.111.1.1.1.1.1.1111.',
      '11111111111111111111',
      '11111111111111111111',
      '.111.1.1.1.1.1.1111.',
      '..1111111111111111..',
      '...1111..1111..111..',
      '.....111111111111...',
      '.......11111111.....',
    ]),
    boss2: S([
      '........1111........',
      '......11111111......',
      '.....11.1111.11.....',
      '1111111111111111.111',
      '.1111111..111111111.',
      '..111111..11111111..',
      '.1111111..111111111.',
      '1111111111111111.111',
      '.....11.1111.11.....',
      '......11111111......',
      '........1111........',
    ]),
    boss3: S([
      '..........111111......',
      '.......1111111111.....',
      '.....11111....11111...',
      '....111..111111..111..',
      '1111111.11111111.1111.',
      '.11111111111..11111111',
      '..1111111111..1111111.',
      '.11111111111..11111111',
      '1111111.11111111.1111.',
      '....111..111111..111..',
      '.....11111....11111...',
      '.......1111111111.....',
      '..........111111......',
    ]),
  };
  function draw(spr, x, y, color = FG()) {
    ctx.fillStyle = color;
    x = Math.round(x);
    y = Math.round(y);
    for (let j = 0; j < spr.h; j++) {
      const row = spr.rows[j];
      for (let i = 0; i < spr.w; i++) if (row[i] === '1') ctx.fillRect(x + i, y + j, 1, 1);
    }
  }

  // ---------------------------------------------------------------- sound --
  let audio = null;
  function tone(freq, ms, type = 'square', vol = 0.05, slide = 0) {
    if (!soundOn) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t = audio.currentTime;
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + ms / 1000);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + ms / 1000 + 0.02);
    } catch {
      /* audio unavailable */
    }
  }
  const sfx = {
    shot: () => tone(1400, 40, 'square', 0.025, -600),
    hit: () => tone(300, 60, 'square', 0.04, -150),
    boom: () => tone(180, 220, 'sawtooth', 0.05, -140),
    pick: () => (tone(880, 60), setTimeout(() => tone(1320, 80), 60)),
    special: () => tone(520, 160, 'triangle', 0.06, 600),
    hurt: () => tone(120, 400, 'sawtooth', 0.07, -80),
    warn: () => tone(440, 140, 'square', 0.05),
    clear: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 110), i * 110)),
  };

  // ---------------------------------------------------------------- input --
  const input = { up: false, down: false, left: false, right: false, fire: false, special: false, stickX: 0, stickY: 0 };
  let specialPressed = false;
  let startPressed = false;
  let pausePressed = false;

  const KEYMAP = {
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowDown: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ' ': 'fire', j: 'fire', J: 'fire', z: 'fire', Z: 'fire',
    x: 'special', X: 'special', k: 'special', K: 'special', Shift: 'special',
  };
  addEventListener('keydown', (e) => {
    const k = KEYMAP[e.key];
    if (k) {
      if (k === 'special' && !input.special) specialPressed = true;
      if (k === 'fire' && !input.fire) startPressed = true;
      input[k] = true;
      e.preventDefault();
    }
    if (e.key === 'Enter') startPressed = true;
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') pausePressed = true;
    if (e.key === 'm' || e.key === 'M') toggleSound();
    if (e.key === 'c' || e.key === 'C') cyclePalette();
  });
  addEventListener('keyup', (e) => {
    const k = KEYMAP[e.key];
    if (k) input[k] = false;
  });
  addEventListener('blur', () => {
    for (const k of ['up', 'down', 'left', 'right', 'fire', 'special']) input[k] = false;
    if (state === 'play') pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'play') pause();
  });

  function toggleSound() {
    soundOn = !soundOn;
    store.set('sound', soundOn);
    toast(soundOn ? 'SOUND ON' : 'SOUND OFF');
  }
  function cyclePalette() {
    paletteIndex = (paletteIndex + 1) % PALETTES.length;
    store.set('palette', paletteIndex);
    toast(PALETTES[paletteIndex].name);
  }

  // Touch: left part of the screen is a floating stick, buttons on the right.
  const stick = document.getElementById('stick');
  const knob = document.getElementById('knob');
  let stickId = null;
  let stickOrigin = null;
  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  addEventListener(
    'touchstart',
    () => {
      document.body.classList.add('touch');
    },
    { once: true, passive: true },
  );
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') {
      if (state !== 'play') startPressed = true;
      return;
    }
    document.body.classList.add('touch');
    if (e.target.closest('button')) return;
    if (state !== 'play') {
      startPressed = true;
      return;
    }
    if (e.clientX < innerWidth * 0.5 && stickId === null) {
      stickId = e.pointerId;
      stickOrigin = { x: e.clientX, y: e.clientY };
      stick.style.left = `${e.clientX - 60}px`;
      stick.style.top = `${e.clientY - 60}px`;
      stick.style.bottom = 'auto';
    }
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return;
    const dx = e.clientX - stickOrigin.x;
    const dy = e.clientY - stickOrigin.y;
    const len = Math.hypot(dx, dy);
    const max = 40;
    const k = len > max ? max / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    input.stickX = Math.abs(dx) > 6 ? Math.max(-1, Math.min(1, dx / max)) : 0;
    input.stickY = Math.abs(dy) > 6 ? Math.max(-1, Math.min(1, dy / max)) : 0;
  });
  const endStick = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    input.stickX = input.stickY = 0;
    knob.style.transform = '';
    stick.style.left = '';
    stick.style.top = '';
    stick.style.bottom = '';
  };
  addEventListener('pointerup', endStick);
  addEventListener('pointercancel', endStick);

  function holdButton(id, onDown, onUp) {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('down');
      onDown();
    });
    const up = () => {
      el.classList.remove('down');
      onUp?.();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  holdButton(
    'btn-fire',
    () => {
      input.fire = true;
      startPressed = true;
    },
    () => (input.fire = false),
  );
  holdButton('btn-special', () => {
    specialPressed = true;
    startPressed = true;
  });
  holdButton('btn-pause', () => (pausePressed = true));

  // Gamepads (standard mapping): stick/d-pad, A = fire, B/X = special, Start = pause.
  let padPrev = {};
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find(Boolean);
    if (!p) return null;
    const b = (i) => Boolean(p.buttons[i]?.pressed);
    const ax = p.axes[0] || 0;
    const ay = p.axes[1] || 0;
    const cur = { fire: b(0), special: b(1) || b(2), start: b(9) };
    if (cur.special && !padPrev.special) specialPressed = true;
    if (cur.fire && !padPrev.fire) startPressed = true;
    if (cur.start && !padPrev.start) pausePressed = true;
    padPrev = cur;
    return {
      x: b(14) ? -1 : b(15) ? 1 : Math.abs(ax) > 0.25 ? ax : 0,
      y: b(12) ? -1 : b(13) ? 1 : Math.abs(ay) > 0.25 ? ay : 0,
      fire: cur.fire,
    };
  }

  // ---------------------------------------------------------------- world --
  const LEVELS = [
    { name: 'OUTER RIM', boss: 'boss1', types: ['drone', 'drone', 'dart', 'shooter'], length: 2400, stars: 1 },
    { name: 'ROCK BELT', boss: 'boss2', types: ['rock', 'drone', 'dart', 'shooter', 'mine'], length: 2700, stars: 2 },
    { name: 'THE CORE', boss: 'boss3', types: ['crab', 'dart', 'shooter', 'mine', 'drone'], length: 3000, stars: 3 },
  ];
  const ENEMY = {
    drone: { spr: 'drone', hp: 1, pts: 5, speed: 0.55 },
    dart: { spr: 'dart', hp: 1, pts: 10, speed: 1.1 },
    shooter: { spr: 'shooter', hp: 3, pts: 20, speed: 0.4 },
    mine: { spr: 'mine', hp: 4, pts: 15, speed: 0.3 },
    rock: { spr: 'rock', hp: 2, pts: 10, speed: 0.5 },
    crab: { spr: 'crab', hp: 2, pts: 15, speed: 0.6 },
  };
  const BOSS = {
    boss1: { hp: 45, pts: 300 },
    boss2: { hp: 70, pts: 500 },
    boss3: { hp: 100, pts: 800 },
  };
  const SPECIALS = { missile: 'missileIcon', beam: 'beamIcon', wall: 'wallIcon' };

  let state = 'title'; // title, intro, play, paused, dead, clear, over
  let prevState = 'title';
  let t = 0; // frames in current state
  let lvl = 0;
  let loop = 0;
  let score = 0;
  let lives = 3;
  let player, shots, enemyShots, enemies, pickups, booms, stars, specialFx;
  let levelTime = 0;
  let boss = null;
  let nextSpawn = 0;
  let toastText = '';
  let toastUntil = 0;
  let shake = 0;
  let rnd = Math.random;

  function toast(s) {
    toastText = s;
    toastUntil = performance.now() + 1200;
  }

  function newStars() {
    stars = Array.from({ length: 26 }, () => ({ x: rnd() * W, y: TOP + rnd() * (H - TOP), z: 1 + ((rnd() * 3) | 0) }));
  }

  function resetPlayer() {
    player = { x: 8, y: (TOP + H) / 2 - 3, cool: 0, inv: 120, special: player?.special ?? 'missile', ammo: Math.max(player?.ammo ?? 3, 3) };
  }

  function newGame() {
    score = 0;
    lives = 3;
    lvl = 0;
    loop = 0;
    player = null;
    startLevel();
  }

  function startLevel() {
    shots = [];
    enemyShots = [];
    enemies = [];
    pickups = [];
    booms = [];
    specialFx = [];
    boss = null;
    levelTime = 0;
    nextSpawn = 90;
    resetPlayer();
    newStars();
    setState('intro');
  }

  function setState(s) {
    prevState = state;
    state = s;
    t = 0;
  }
  function pause() {
    if (state !== 'play') return;
    setState('paused');
  }

  const difficulty = () => 1 + loop * 0.35 + lvl * 0.12;

  // --------------------------------------------------------------- spawns --
  function spawnWave() {
    const L = LEVELS[lvl];
    const type = L.types[(rnd() * L.types.length) | 0];
    const d = difficulty();
    const count = type === 'shooter' || type === 'mine' ? 1 + (rnd() < 0.3 * d ? 1 : 0) : 3 + ((rnd() * 3) | 0);
    const pattern = ['line', 'sine', 'v', 'random'][(rnd() * 4) | 0];
    const baseY = TOP + 4 + rnd() * (H - TOP - 14);
    for (let i = 0; i < count; i++) {
      const e = ENEMY[type];
      const spr = SPR[e.spr];
      let y = baseY;
      if (pattern === 'v') y = baseY + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 6;
      if (pattern === 'random') y = TOP + 2 + rnd() * (H - TOP - spr.h - 4);
      y = Math.max(TOP + 1, Math.min(H - spr.h - 1, y));
      enemies.push({
        type,
        spr,
        x: W + 2 + i * (spr.w + 6),
        y,
        y0: y,
        hp: Math.ceil(e.hp * (1 + loop * 0.5)),
        pts: e.pts,
        speed: e.speed * (0.9 + rnd() * 0.2) * Math.min(1.8, d),
        phase: rnd() * Math.PI * 2,
        sine: pattern === 'sine' || type === 'crab',
        age: 0,
        flash: 0,
        fireAt: 60 + ((rnd() * 60) | 0),
      });
    }
    nextSpawn = Math.max(40, (110 - lvl * 10 - loop * 12) * (0.7 + rnd() * 0.6));
  }

  function spawnBoss() {
    const key = LEVELS[lvl].boss;
    const spr = SPR[key];
    const hp = Math.round(BOSS[key].hp * (1 + loop * 0.6));
    boss = { key, spr, x: W + 4, y: (TOP + H) / 2 - spr.h / 2, hp, max: hp, pts: BOSS[key].pts * (loop + 1), age: 0, flash: 0, cool: 90 };
    sfx.warn();
    setTimeout(sfx.warn, 300);
  }

  function enemyFire(x, y, aim = true, spread = 0) {
    const dx = player.x + 4 - x;
    const dy = player.y + 3 - y;
    const len = Math.hypot(dx, dy) || 1;
    const sp = 0.9 + loop * 0.15 + lvl * 0.08;
    let vx = aim ? (dx / len) * sp : -sp;
    let vy = aim ? (dy / len) * sp : 0;
    if (spread) {
      const a = Math.atan2(vy, vx) + spread;
      vx = Math.cos(a) * sp;
      vy = Math.sin(a) * sp;
    }
    enemyShots.push({ x, y, vx, vy });
  }

  // --------------------------------------------------------------- update --
  const hitbox = (o, spr, pad = 0) => ({ x: o.x + pad, y: o.y + pad, w: spr.w - pad * 2, h: spr.h - pad * 2 });
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function kill(e, byPlayer = true) {
    booms.push({ x: e.x + e.spr.w / 2 - 2, y: e.y + e.spr.h / 2 - 2, t: 0 });
    if (!byPlayer) return;
    score += e.pts;
    sfx.boom();
    const r = rnd();
    const dropChance = e.type === 'shooter' || e.type === 'mine' ? 0.35 : 0.06;
    if (r < dropChance) {
      const kinds = ['missile', 'beam', 'wall', 'missile', 'beam', 'wall', 'life'];
      pickups.push({ x: e.x, y: e.y, kind: kinds[(rnd() * kinds.length) | 0], age: 0 });
    }
  }

  function damage(target, amount) {
    target.hp -= amount;
    target.flash = 4;
    if (target === boss) {
      score += 1;
      sfx.hit();
    }
  }

  function hurtPlayer() {
    if (player.inv > 0 || state !== 'play') return;
    booms.push({ x: player.x + 2, y: player.y, t: 0 });
    booms.push({ x: player.x + 5, y: player.y + 2, t: -4 });
    sfx.hurt();
    shake = 12;
    lives--;
    setState('dead');
  }

  function fireSpecial() {
    if (player.ammo <= 0) {
      tone(110, 80);
      return;
    }
    player.ammo--;
    sfx.special();
    const cx = player.x + 9;
    const cy = player.y + 2;
    if (player.special === 'missile') {
      specialFx.push({ kind: 'missile', x: cx, y: cy - 2, vx: 1.4, vy: 0, life: 200 });
      specialFx.push({ kind: 'missile', x: cx, y: cy + 3, vx: 1.4, vy: 0, life: 200 });
    } else if (player.special === 'beam') {
      specialFx.push({ kind: 'beam', y: cy, life: 36 });
    } else {
      specialFx.push({ kind: 'wall', x: cx + 2, life: 400, hp: 12 });
    }
  }

  function updatePlay() {
    levelTime++;
    const pad = pollPad();
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0) || input.stickX || pad?.x || 0;
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0) || input.stickY || pad?.y || 0;
    const speed = 1.15;
    player.x = Math.max(0, Math.min(W - 40, player.x + mx * speed));
    player.y = Math.max(TOP, Math.min(H - SPR.ship.h, player.y + my * speed));
    if (player.inv > 0) player.inv--;

    // Shooting
    if (player.cool > 0) player.cool--;
    if ((input.fire || pad?.fire) && player.cool === 0 && shots.length < 5) {
      shots.push({ x: player.x + 9, y: player.y + 3 });
      player.cool = 9;
      sfx.shot();
    }
    if (specialPressed) fireSpecial();
    specialPressed = false;

    for (const s of shots) s.x += 3;
    shots = shots.filter((s) => s.x < W);

    // Stars
    for (const s of stars) {
      s.x -= s.z * 0.25 * (LEVELS[lvl].stars > 1 ? 1.4 : 1);
      if (s.x < 0) {
        s.x = W;
        s.y = TOP + rnd() * (H - TOP);
      }
    }

    // Spawning and boss
    const L = LEVELS[lvl];
    if (!boss && levelTime < L.length) {
      if (--nextSpawn <= 0) spawnWave();
    } else if (!boss && enemies.length === 0) {
      spawnBoss();
    }

    // Enemies
    for (const e of enemies) {
      e.age++;
      if (e.flash) e.flash--;
      if (e.type === 'shooter') {
        e.x -= e.x > W - 30 || e.age > 260 ? e.speed : 0;
        e.y += Math.sign(player.y - e.y) * 0.25;
        if (e.age % e.fireAt === 0) enemyFire(e.x, e.y + 2);
      } else if (e.type === 'dart') {
        e.x -= e.speed;
        if (e.x < W - 20) e.y += Math.sign(player.y - e.y) * 0.35;
      } else if (e.type === 'mine') {
        e.x -= e.speed;
        e.y = e.y0 + Math.sin(e.age / 30 + e.phase) * 4;
        if (e.age % 140 === 70) for (let a = -1; a <= 1; a++) enemyFire(e.x, e.y + 2, false, a * 0.5);
      } else {
        e.x -= e.speed;
        if (e.sine) e.y = e.y0 + Math.sin(e.age / 18 + e.phase) * 7;
      }
      e.y = Math.max(TOP, Math.min(H - e.spr.h, e.y));
    }

    // Boss
    if (boss) {
      boss.age++;
      if (boss.flash) boss.flash--;
      const targetX = W - boss.spr.w - 4;
      if (boss.x > targetX) boss.x -= 0.4;
      else {
        const amp = (H - TOP - boss.spr.h) / 2 - 1;
        boss.y = TOP + 1 + amp + Math.sin(boss.age / (70 - lvl * 10)) * amp;
        if (boss.key === 'boss3') boss.x = targetX - Math.max(0, Math.sin(boss.age / 90)) * 30;
        if (--boss.cool <= 0) {
          const cy = boss.y + boss.spr.h / 2;
          const pattern = (boss.age / 200) | 0;
          if (pattern % 3 === 0) {
            enemyFire(boss.x, cy);
            boss.cool = 55 - lvl * 8;
          } else if (pattern % 3 === 1) {
            const n = lvl === 0 ? 1 : 2;
            for (let a = -n; a <= n; a++) enemyFire(boss.x, cy, false, a * 0.3);
            boss.cool = 80 - lvl * 8;
          } else {
            enemies.push({ ...ENEMY.drone, type: 'drone', spr: SPR.drone2, x: boss.x, y: cy - 2, y0: cy - 2, hp: 1, age: 0, flash: 0, sine: true, phase: 0, speed: 0.9, fireAt: 999 });
            boss.cool = 55;
          }
          boss.cool = Math.max(14, boss.cool / (1 + loop * 0.3));
        }
      }
    }

    // Enemy bullets
    for (const b of enemyShots) {
      b.x += b.vx;
      b.y += b.vy;
    }
    enemyShots = enemyShots.filter((b) => b.x > -2 && b.x < W + 2 && b.y > TOP - 2 && b.y < H + 2);

    // Specials
    for (const f of specialFx) {
      f.life--;
      if (f.kind === 'missile') {
        const target = boss ?? enemies.reduce((best, e) => (!best || Math.abs(e.y - f.y) < Math.abs(best.y - f.y) ? (e.x > f.x ? e : best) : best), null);
        if (target) f.vy += Math.sign(target.y + target.spr.h / 2 - f.y) * 0.08;
        f.vy *= 0.92;
        f.vx = Math.min(2.6, f.vx + 0.06);
        f.x += f.vx;
        f.y += f.vy;
        if (f.x > W) f.life = 0;
      } else if (f.kind === 'wall') {
        f.x += 0.35;
        if (f.x > W) f.life = 0;
      }
    }

    // Collisions: player shots and specials vs enemies/boss
    const targets = boss ? [...enemies, boss] : enemies;
    for (const s of shots) {
      for (const e of targets) {
        if (s.dead || e.hp <= 0) continue;
        if (overlap({ x: s.x, y: s.y, w: 3, h: 1 }, hitbox(e, e.spr))) {
          damage(e, 1);
          s.dead = true;
        }
      }
    }
    shots = shots.filter((s) => !s.dead);
    for (const f of specialFx) {
      for (const e of targets) {
        if (e.hp <= 0 || f.life <= 0) continue;
        const hb = hitbox(e, e.spr);
        if (f.kind === 'missile' && overlap({ x: f.x, y: f.y, w: 4, h: 2 }, hb)) {
          damage(e, 4);
          f.life = 0;
          booms.push({ x: f.x, y: f.y - 2, t: 0 });
        } else if (f.kind === 'beam' && f.life % 4 === 0 && hb.x > player.x && f.y + 1 >= hb.y && f.y - 1 <= hb.y + hb.h) {
          damage(e, 1);
        } else if (f.kind === 'wall' && overlap({ x: f.x, y: TOP, w: 2, h: H - TOP }, hb) && e !== boss) {
          damage(e, 2);
          if (--f.hp <= 0) f.life = 0;
        }
      }
      if (f.kind === 'wall' && f.life > 0)
        enemyShots = enemyShots.filter((b) => {
          if (b.x >= f.x - 1 && b.x <= f.x + 2) {
            f.hp--;
            return false;
          }
          return true;
        });
      if (f.kind === 'beam') f.y = player.y + 2;
    }
    specialFx = specialFx.filter((f) => f.life > 0);

    // Deaths and removal
    for (const e of enemies) if (e.hp <= 0) kill(e);
    enemies = enemies.filter((e) => e.hp > 0 && e.x > -e.spr.w - 2);
    if (boss && boss.hp <= 0) {
      for (let i = 0; i < 8; i++) booms.push({ x: boss.x + rnd() * boss.spr.w, y: boss.y + rnd() * boss.spr.h, t: -i * 5 });
      score += boss.pts;
      shake = 20;
      sfx.boom();
      boss = null;
      enemyShots = [];
      setState('clear');
      sfx.clear();
    }

    // Player hit
    const phb = hitbox(player, SPR.ship, 1);
    if (enemyShots.some((b) => overlap({ x: b.x - 0.5, y: b.y - 0.5, w: 1.5, h: 1.5 }, phb))) hurtPlayer();
    else if (enemies.some((e) => overlap(hitbox(e, e.spr, 1), phb))) hurtPlayer();
    else if (boss && overlap(hitbox(boss, boss.spr, 2), phb)) hurtPlayer();

    // Pickups
    for (const p of pickups) {
      p.age++;
      p.x -= 0.4;
      if (overlap({ x: p.x, y: p.y, w: 7, h: 6 }, hitbox(player, SPR.ship))) {
        p.taken = true;
        sfx.pick();
        if (p.kind === 'life') {
          lives = Math.min(9, lives + 1);
          toast('+1 LIFE');
        } else {
          if (player.special !== p.kind) player.ammo = 0;
          player.special = p.kind;
          player.ammo = Math.min(9, player.ammo + 3);
          toast(p.kind.toUpperCase());
        }
      }
    }
    pickups = pickups.filter((p) => !p.taken && p.x > -8 && p.age < 900);
  }

  function updateFx() {
    for (const b of booms) b.t++;
    booms = booms.filter((b) => b.t < 18);
    if (shake > 0) shake--;
  }

  function update() {
    t++;
    if (pausePressed) {
      pausePressed = false;
      if (state === 'play') pause();
      else if (state === 'paused') setState('play');
    }
    switch (state) {
      case 'title':
        if (stars === undefined) newStars();
        for (const s of stars) s.x = s.x - s.z * 0.2 < 0 ? W : s.x - s.z * 0.2;
        if (startPressed) newGame();
        break;
      case 'intro':
        if (t > 100 || (startPressed && t > 20)) setState('play');
        break;
      case 'play':
        updatePlay();
        break;
      case 'dead':
        for (const s of stars) s.x = s.x - s.z * 0.1 < 0 ? W : s.x - s.z * 0.1;
        if (t > 90) {
          if (lives <= 0) {
            if (score > hiScore) {
              hiScore = score;
              store.set('hi', hiScore);
            }
            setState('over');
          } else {
            enemyShots = [];
            resetPlayer();
            setState('play');
          }
        }
        break;
      case 'clear':
        if (t > 150) {
          lvl++;
          if (lvl >= LEVELS.length) {
            lvl = 0;
            loop++;
          }
          startLevel();
        }
        break;
      case 'over':
        if (startPressed && t > 60) setState('title');
        break;
    }
    if (state !== 'play') specialPressed = false;
    startPressed = false;
    updateFx();
  }

  // ----------------------------------------------------------------- draw --
  function render() {
    const p = pal();
    // A translucent clear leaves a faint trail, like a slow old LCD.
    ctx.fillStyle = rgb(p.bg, 0.6);
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shake) ctx.translate(((rnd() * 3) | 0) - 1, ((rnd() * 3) | 0) - 1);

    // Stars
    ctx.fillStyle = rgb(p.fg, 0.55);
    for (const s of stars || []) ctx.fillRect(s.x | 0, s.y | 0, s.z === 3 ? 2 : 1, 1);

    if (state === 'title') return drawTitle();

    // Pickups
    for (const pk of pickups) {
      if (pk.age > 700 && (pk.age >> 3) % 2) continue;
      draw(SPR.box, pk.x, pk.y);
      const icon = pk.kind === 'life' ? SPR.heart : SPR[SPECIALS[pk.kind]];
      draw(icon, pk.x + 1, pk.y + 1 + (pk.kind === 'life' ? 0 : 0.5));
    }

    // Enemies
    for (const e of enemies) {
      if (e.flash % 2) continue;
      const spr = e.type === 'drone' && (e.age >> 4) % 2 ? SPR.drone2 : e.spr;
      draw(spr, e.x, e.y);
    }
    if (boss && !(boss.flash % 2)) draw(boss.spr, boss.x, boss.y);

    // Player
    if (state !== 'dead' && !(player.inv > 0 && (player.inv >> 2) % 2)) {
      draw(SPR.ship, player.x, player.y);
      if ((t >> 2) % 2) ctx.fillRect(player.x - 1, player.y + 2, 1, 2); // engine flicker
    }

    // Bullets and specials
    ctx.fillStyle = FG();
    for (const s of shots) ctx.fillRect(s.x, s.y, 3, 1);
    for (const b of enemyShots) {
      ctx.fillRect(Math.round(b.x), Math.round(b.y), 2, 2);
    }
    for (const f of specialFx) {
      if (f.kind === 'missile') {
        ctx.fillRect(Math.round(f.x), Math.round(f.y), 4, 2);
        if ((t >> 1) % 2) ctx.fillRect(Math.round(f.x) - 2, Math.round(f.y), 1, 2);
      } else if (f.kind === 'beam') {
        const h = f.life > 30 ? 1 : f.life > 6 ? 3 : 1;
        ctx.fillRect(player.x + 9, Math.round(f.y) - (h >> 1), W, h);
      } else {
        for (let y = TOP; y < H; y += 3) ctx.fillRect(Math.round(f.x), y, 2, 2);
      }
    }

    // Explosions
    for (const b of booms) if (b.t >= 0) draw(b.t < 8 ? SPR.boom1 : SPR.boom2, b.x, b.y);

    ctx.restore();
    drawHud();

    if (state === 'intro') {
      panel(30, 24, 68, 24);
      text(`STAGE ${lvl + 1 + loop * LEVELS.length}`, W / 2, 29, FG(), 'center');
      text(LEVELS[lvl].name, W / 2, 38, FG(), 'center');
    } else if (state === 'paused') {
      panel(26, 20, 76, 34);
      text('PAUSED', W / 2, 25, FG(), 'center');
      text('P OR II: RESUME', W / 2, 34, FG(), 'center');
      text('M SOUND  C COLOUR', W / 2, 42, FG(), 'center');
    } else if (state === 'clear' && t > 30) {
      panel(24, 24, 80, 24);
      text('STAGE CLEAR!', W / 2, 29, FG(), 'center');
      text(`SCORE ${score}`, W / 2, 38, FG(), 'center');
    } else if (state === 'over') {
      panel(20, 17, 88, 41);
      text('GAME OVER', W / 2, 23, FG(), 'center');
      text(`SCORE ${score}`, W / 2, 32, FG(), 'center');
      text(score >= hiScore && score > 0 ? 'NEW HI-SCORE!' : `HI ${hiScore}`, W / 2, 40, FG(), 'center');
      if (t > 60 && (t >> 5) % 2) text('FIRE TO CONTINUE', W / 2, 48, FG(), 'center');
    }
    if (boss && boss.x > W - boss.spr.w - 10 && (t >> 4) % 2) text('WARNING', W / 2, 30, FG(), 'center');
    drawToast();
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = FG();
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = BG();
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = FG();
    ctx.fillRect(x + 2, y + 2, w - 4, 1);
    ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
  }

  function drawHud() {
    const p = pal();
    ctx.fillStyle = rgb(p.bg);
    ctx.fillRect(0, 0, W, TOP);
    ctx.fillStyle = FG();
    ctx.fillRect(0, TOP - 1, W, 1);
    for (let i = 0; i < Math.min(lives, 5); i++) draw(SPR.shipMini, 1 + i * 6, 2);
    if (lives > 5) text(`+${lives - 5}`, 31, 1);
    const icon = SPR[SPECIALS[player.special]];
    draw(icon, 44, 2);
    text(`x${player.ammo}`, 50, 1);
    if (boss) {
      const bw = 30;
      ctx.fillRect(64, 2, bw + 2, 3);
      ctx.fillStyle = BG();
      ctx.fillRect(65, 3, bw, 1);
      ctx.fillStyle = FG();
      ctx.fillRect(65, 3, Math.ceil((boss.hp / boss.max) * bw), 1);
    }
    text(String(score).padStart(5, '0'), W - 1, 1, FG(), 'right');
  }

  function drawTitle() {
    ctx.restore();
    const bob = Math.round(Math.sin(t / 20) * 1.5);
    // Logo
    ctx.fillStyle = FG();
    ctx.fillRect(10, 6, W - 20, 1);
    ctx.fillRect(10, 33, W - 20, 1);
    bigText('SIGNAL', W / 2, 9);
    bigText('STRIKE', W / 2, 21);
    draw(SPR.ship, 14, 40 + bob);
    ctx.fillRect(25, 42 + bob, 3, 1);
    ctx.fillRect(31, 42 + bob, 3, 1);
    draw(SPR.drone, 92, 36 - bob);
    draw(SPR.dart, 104, 46 + bob);
    draw(SPR.shooter, 84, 50);
    if ((t >> 5) % 2 === 0) text(document.body.classList.contains('touch') ? 'TAP TO START' : 'PRESS FIRE OR ENTER', W / 2, 57, FG(), 'center');
    text(`HI ${hiScore}`, W / 2, 65, rgb(pal().fg, 0.7), 'center');
    drawToast();
  }

  // Double-size text for the title.
  function bigText(str, cx, y) {
    const w = str.length * 8 - 2;
    let x = cx - (w >> 1);
    ctx.fillStyle = FG();
    for (const ch of str) {
      const g = FONT[ch];
      for (let p = 0; p < 15; p++) if (g[p] === '1') ctx.fillRect(x + (p % 3) * 2, y + ((p / 3) | 0) * 2, 2, 2);
      x += 8;
    }
  }

  function drawToast() {
    if (performance.now() > toastUntil) return;
    const w = toastText.length * 4 + 9;
    panel((W - w) >> 1, H - 14, w, 12);
    text(toastText, W / 2, H - 10, FG(), 'center');
  }

  // ----------------------------------------------------------------- loop --
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += Math.min(250, now - last);
    last = now;
    while (acc >= STEP) {
      update();
      acc -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  }
  newStars();
  shots = [];
  enemyShots = [];
  enemies = [];
  pickups = [];
  booms = [];
  specialFx = [];
  player = { x: 8, y: 30, special: 'missile', ammo: 3, inv: 0, cool: 0 };
  requestAnimationFrame(frame);
  canvas.focus();

  // Debug/test hook (harmless in production): lets automated tests read state.
  window.__signalStrike = { get state() { return state; }, get score() { return score; }, get lives() { return lives; }, get level() { return lvl; }, skipToBoss(l = lvl) { lvl = l; levelTime = 99999; enemies = []; enemyShots = []; boss = null; } };
})();
