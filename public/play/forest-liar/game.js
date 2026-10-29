// Forest Liar: a comedy trap platformer for INDIE/24. Pip the courier has to
// deliver a letter through a forest that lies. Sprites come from the supplied
// Forest Liar asset sheet (cut by scripts/extract-forest-liar-art.py); levels
// live in levels.js. The same files run on the website and in the Android app.
(function () {
  'use strict';

  // ---------------------------------------------------------------- setup --
  const W = 480;
  const H = 270;
  const T = 24; // tile size
  const DT = 1 / 60;
  const LEVELS = window.FOREST_LIAR_LEVELS;
  const ATLAS = window.FOREST_LIAR_ATLAS;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  const $ = (id) => document.getElementById(id);
  const hudEl = $('hud');
  const padEl = $('pad');
  const moveEl = $('t-move');
  const jumpEl = $('t-jump');
  const rotateEl = $('rotate');

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('forest-liar.' + k);
        return v === null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('forest-liar.' + k, JSON.stringify(v));
      } catch {
        /* storage unavailable */
      }
    },
  };
  const settings = Object.assign({ sound: true, music: true, shake: true, touch: 'auto' }, store.get('settings', {}));
  const progress = Object.assign({ unlocked: 1, best: {}, totalDeaths: 0 }, store.get('progress', {}));
  const saveSettings = () => store.set('settings', settings);
  const saveProgress = () => store.set('progress', progress);

  const VERSION = '1.0.0';

  // ------------------------------------------------------------ leaderboard --
  // MVP scores stay on this device. A real server board would implement the
  // same two calls; the server must re-validate runs (client scores are not
  // trusted) and must never need a secret key shipped in this file.
  const score = (seconds, deaths) => Math.max(100, 10000 - Math.floor(seconds * 40) - deaths * 300);
  const LeaderboardService = {
    submit(run) {
      // run: { gameId, levelId, durationMs, deathCount, score, buildVersion, playerId? }
      const all = store.get('runs', []);
      all.push(run);
      store.set('runs', all.slice(-200));
      return Promise.resolve({ ok: true, local: true });
    },
    top(levelId, n = 5) {
      const runs = store.get('runs', []).filter((r) => r.levelId === levelId);
      return Promise.resolve(runs.sort((a, b) => b.score - a.score).slice(0, n));
    },
  };

  // --------------------------------------------------------------- canvas --
  function fit() {
    const portrait = innerHeight > innerWidth;
    // In portrait the game sits at the top and the controls get the space below.
    const availH = portrait ? Math.min(innerHeight * 0.62, innerHeight - 200) : innerHeight;
    const raw = Math.min(innerWidth / W, Math.max(availH, 120) / H);
    const s = raw >= 3 ? Math.floor(raw) : raw;
    const cw = Math.floor(W * s);
    const ch = Math.floor(H * s);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    const r = canvas.getBoundingClientRect();
    Object.assign(hudEl.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px' });
    // Controls scale with the screen but never drop below comfortable thumb size.
    const short = Math.min(innerWidth, innerHeight);
    document.documentElement.style.setProperty('--dpad', Math.round(Math.max(120, Math.min(170, short * 0.36))) + 'px');
    document.documentElement.style.setProperty('--jump', Math.round(Math.max(88, Math.min(120, short * 0.26))) + 'px');
    document.documentElement.style.setProperty('--below', Math.round(r.bottom + 8) + 'px');
    updateChrome();
  }
  addEventListener('resize', fit);
  addEventListener('orientationchange', () => setTimeout(fit, 200));
  document.addEventListener('fullscreenchange', () => setTimeout(fit, 50));
  if (window.visualViewport) visualViewport.addEventListener('resize', fit);

  // --------------------------------------------------------------- assets --
  const sheet = new Image();
  const loaded = new Promise((resolve, reject) => {
    sheet.onload = resolve;
    sheet.onerror = () => reject(new Error('Could not load the sprite atlas'));
  });
  sheet.src = 'assets/atlas.png';

  // World drawing sets this to the camera; screens and the HUD leave it at 0.
  const off = { x: 0, y: 0 };
  function screenSpace(fn) {
    const { x, y } = off;
    off.x = off.y = 0;
    fn();
    off.x = x;
    off.y = y;
  }

  /** Draw an atlas sprite with its top-left at x,y. */
  function spr(name, x, y, { flip = false, alpha = 1, sx = 1, sy = 1, rot = 0, ox = 0.5, oy = 1 } = {}) {
    const r = ATLAS[name];
    if (!r) return;
    x -= off.x;
    y -= off.y;
    const [ax, ay, w, h] = r;
    if (!flip && alpha === 1 && sx === 1 && sy === 1 && !rot) {
      ctx.drawImage(sheet, ax, ay, w, h, Math.round(x), Math.round(y), w, h);
      return;
    }
    // Transformed draws pivot on (ox, oy) of the sprite: bottom-centre by default.
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(Math.round(x + w * ox), Math.round(y + h * oy));
    if (rot) ctx.rotate(rot);
    ctx.scale(flip ? -sx : sx, sy);
    ctx.drawImage(sheet, ax, ay, w, h, -w * ox, -h * oy, w, h);
    ctx.restore();
  }
  const sw = (name) => ATLAS[name][2];
  const sh = (name) => ATLAS[name][3];
  /** Draw a sprite standing on the point (cx, bottom). */
  const stand = (name, cx, bottom, opt) => spr(name, cx - sw(name) / 2, bottom - sh(name), opt);

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
    '-': '000000111000000', '?': '110001010000010', '/': '001001010100100', '+': '000010111010000', ',': '000000000010100',
    "'": '010010000000000', '(': '010100100100010', ')': '010001001001010', '<': '001010100010001', '>': '100010001010100',
    '^': '010101000000000', '&': '010101010101011', '"': '101101000000000', '*': '000101010101000', '#': '101111101111101',
    '=': '000111000111000', ';': '000010000010100', '%': '101001010100101', _: '000000000000111',
  };
  function textWidth(str, scale = 1) {
    return (String(str).length * 4 - 1) * scale;
  }
  /** Outlined pixel text, readable on any background. */
  function text(str, x, y, { color = '#f4ecd2', scale = 1, align = 'left', outline = '#13202a' } = {}) {
    str = String(str).toUpperCase();
    x -= off.x;
    y -= off.y;
    const w = textWidth(str, scale);
    if (align === 'center') x -= Math.floor(w / 2);
    if (align === 'right') x -= w;
    x = Math.round(x);
    y = Math.round(y);
    const glyphs = (dx, dy, c) => {
      ctx.fillStyle = c;
      for (let i = 0; i < str.length; i++) {
        const g = FONT[str[i]] || FONT['?'];
        for (let p = 0; p < 15; p++) if (g[p] === '1') ctx.fillRect(x + dx + (i * 4 + (p % 3)) * scale, y + dy + ((p / 3) | 0) * scale, scale, scale);
      }
    };
    if (outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) glyphs(dx * Math.max(1, scale >> 1), dy * Math.max(1, scale >> 1), outline);
    glyphs(0, 0, color);
  }
  /** Split text into lines no wider than maxChars. */
  function wrap(str, maxChars) {
    const out = [];
    let line = '';
    for (const word of String(str).split(' ')) {
      if (line && (line + ' ' + word).length > maxChars) {
        out.push(line);
        line = word;
      } else line = line ? line + ' ' + word : word;
    }
    if (line) out.push(line);
    return out;
  }
  function bubble(str, cx, bottom) {
    screenSpace(() => bubbleAt(str, cx, bottom));
  }
  function bubbleAt(str, cx, bottom) {
    const lines = wrap(str, 24);
    const w = Math.max(...lines.map((l) => textWidth(l))) + 10;
    const h = lines.length * 7 + 7;
    let x = Math.round(cx - w / 2);
    x = Math.max(cam.x + 2, Math.min(cam.x + W - w - 2, x)) - Math.round(cam.x);
    const y = Math.round(bottom - h - 4 - cam.y);
    ctx.fillStyle = '#13202a';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#f4ecd2';
    ctx.fillRect(x, y, w, h);
    const tx = Math.round(cx - cam.x);
    ctx.fillRect(tx - 2, y + h, 5, 2);
    ctx.fillRect(tx - 1, y + h + 2, 3, 2);
    lines.forEach((l, i) => text(l, x + w / 2, y + 4 + i * 7, { align: 'center', color: '#13202a', outline: null }));
  }

  // ---------------------------------------------------------------- sound --
  let audio = null;
  function tone(freq, ms, type = 'square', vol = 0.04, slide = 0, delay = 0) {
    if (!settings.sound) return;
    try {
      if (!audio || audio.state !== 'running') return;
      const t = audio.currentTime + delay;
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
  let noiseBuf = null;
  function hiss(ms, vol = 0.08, from = 800, to = 3000, delay = 0) {
    if (!settings.sound || !audio || audio.state !== 'running') return;
    try {
      if (!noiseBuf) {
        noiseBuf = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t = audio.currentTime + delay;
      const src = audio.createBufferSource();
      const f = audio.createBiquadFilter();
      const g = audio.createGain();
      src.buffer = noiseBuf;
      f.type = 'bandpass';
      f.frequency.setValueAtTime(from, t);
      f.frequency.exponentialRampToValueAtTime(to, t + ms / 1000);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + (ms / 1000) * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      src.connect(f).connect(g).connect(audio.destination);
      src.start(t);
      src.stop(t + ms / 1000 + 0.02);
    } catch {
      /* audio unavailable */
    }
  }
  // iOS Safari only lets audio start inside a tap or key press.
  function unlockAudio() {
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state !== 'running') audio.resume().catch(() => {});
    } catch {
      /* audio unavailable */
    }
  }
  // Sound effects are synthesized (no audio files), soft and short on purpose.
  const sfx = {
    jump: () => tone(380, 110, 'square', 0.035, 380),
    land: () => tone(120, 50, 'triangle', 0.05, -40),
    bounce: () => (tone(200, 260, 'sine', 0.09, 700), tone(300, 200, 'triangle', 0.03, 600)),
    creak: () => (tone(110, 280, 'sawtooth', 0.025, 40), tone(95, 240, 'sawtooth', 0.02, -20, 0.12)),
    fold: () => tone(180, 180, 'triangle', 0.05, -140),
    inhale: () => hiss(750, 0.05, 400, 1800),
    sneeze: () => (hiss(380, 0.14, 2500, 500), tone(520, 120, 'square', 0.03, -300)),
    rattle: () => [0, 0.08, 0.16].forEach((d) => tone(700, 40, 'square', 0.02, -200, d)),
    roll: () => tone(150, 80, 'triangle', 0.03, -30),
    flip: () => tone(660, 90, 'square', 0.03, 300),
    wobble: () => [0, 0.1, 0.2].forEach((d, i) => tone(300 - i * 30, 80, 'triangle', 0.04, 0, d)),
    thud: () => (tone(90, 160, 'sine', 0.12, -50), hiss(160, 0.06, 300, 120)),
    drum: () => (tone(160, 90, 'sine', 0.1, -100), tone(160, 90, 'sine', 0.08, -100, 0.14)),
    slide: () => hiss(300, 0.04, 600, 300),
    shy: () => tone(900, 140, 'sine', 0.04, -600),
    check: () => [660, 880, 1320].forEach((f, i) => tone(f, 120, 'triangle', 0.05, 0, i * 0.08)),
    fail: () => (tone(440, 120, 'square', 0.04, -200), tone(300, 260, 'square', 0.04, -180, 0.12)),
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 130, 'triangle', 0.06, 0, i * 0.1)),
    trombone: () => [392, 370, 349, 330].forEach((f, i) => tone(f, i === 3 ? 600 : 260, 'sawtooth', 0.04, i === 3 ? -40 : 0, i * 0.28)),
    click: () => tone(700, 40, 'square', 0.03),
    whistle: () => tone(1400, 550, 'sine', 0.04, -900),
    rumble: () => (hiss(450, 0.08, 150, 90), tone(60, 450, 'sawtooth', 0.04, 20)),
    grow: () => tone(200, 350, 'square', 0.04, 600),
    move: () => tone(500, 30, 'square', 0.02),
    pop: () => tone(900, 60, 'square', 0.04, -500),
    bonk: () => (tone(240, 90, 'square', 0.05, -120), tone(180, 120, 'triangle', 0.04, -60, 0.05)),
    nope: () => [0, 0.07].forEach((d) => tone(1000, 60, 'square', 0.03, 400, d)),
  };

  // ---------------------------------------------------------------- music --
  // Chiptune songs as note data on the same audio context (same format as
  // Slime Siege): bars of 16 steps, '-' holds a note, '.' rests.
  const SONGS = {
    title: {
      bpm: 96,
      chords: ['C', 'Am', 'F', 'G'],
      lead: [
        'E5 - - - G5 - E5 - D5 - C5 - D5 - - -',
        'C5 - - - E5 - A4 - - - C5 - E5 - - -',
        'F5 - E5 - D5 - C5 - A4 - C5 - F5 - - -',
        'D5 - - - B4 - - - G4 - - - . . . .',
      ],
      bass: 'R - - - 5 - - - R - - - 5 - - -',
      drums: 'k . . . h . . . k . . . h . h .',
      arp: true,
      leadVol: 0.8,
    },
    // Friendly Forest: a sunny stroll.
    ch0: {
      bpm: 120,
      chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb C', 'F'],
      lead: [
        'A4 - C5 - F5 - - - E5 - C5 - A4 - - -',
        'G4 - C5 - E5 - - - D5 - C5 - G4 - - -',
        'A4 - D5 - F5 - A5 - G5 - F5 - D5 - - -',
        'Bb4 - D5 - F5 - - - G5 - F5 - D5 - - -',
        'C6 - A5 - F5 - A5 - C6 - - - A5 - - -',
        'G5 - E5 - C5 - E5 - G5 - - - E5 - - -',
        'F5 - D5 - Bb4 - D5 - E5 - G5 - C6 - - -',
        'A5 - - - F5 - - - F5 - - - . . . .',
      ],
      bass: 'R . . . 5 . . . R . . . 5 . 8 .',
      drums: 'k . h . s . h . k . h . s . h h',
    },
    // Trickster Grove: a sneaky shuffle.
    ch1: {
      bpm: 132,
      chords: ['Dm', 'Dm', 'Gm', 'A', 'Dm', 'Bb', 'Gm A', 'Dm'],
      lead: [
        'D5 . F5 . A5 - G5 . F5 . E5 . D5 - - -',
        'A4 . D5 . F5 - E5 . D5 . C#5 . D5 - - -',
        'G4 . Bb4 . D5 - C5 . Bb4 . A4 . G4 - - -',
        'E5 . C#5 . A4 - C#5 . E5 . G5 . A5 - - -',
        'F5 . E5 . D5 - A4 . D5 . F5 . A5 - - -',
        'Bb5 . A5 . F5 - D5 . F5 . Bb5 . D6 - - -',
        'Bb5 - A5 - G5 - F5 - E5 - C#5 - A4 - - -',
        'D5 - - - A4 - - - D5 - - - . . . .',
      ],
      bass: 'R . 5 . R . 5 . R . 5 . R . 8 .',
      drums: 'k . h s . h k . k . h s . h h .',
      leadVol: 0.85,
    },
    // The Forest's Last Joke: faster and a bit dramatic.
    ch2: {
      bpm: 144,
      chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'],
      lead: [
        'A4 - C5 - E5 - A5 - G5 - E5 - C5 - E5 -',
        'F5 - - - A5 - - - C6 - B5 - A5 - - -',
        'G5 - E5 - C5 - E5 - G5 - - - C6 - - -',
        'B5 - G5 - D5 - G5 - B5 - - - . . . .',
        'A5 - - - E5 - - - A5 - B5 - C6 - - -',
        'C6 - A5 - F5 - A5 - C6 - D6 - C6 - - -',
        'D6 - C6 - A5 - F5 - D5 - F5 - A5 - - -',
        'G#5 - - - E5 - - - B4 - - - E5 - - -',
      ],
      bass: 'R . R . 5 . R . R . R . 5 . 8 .',
      drums: 'k . h . s . h . k . k . s . h h',
      arp: true,
    },
    clear: {
      bpm: 150,
      once: true,
      chords: ['C', 'G C'],
      lead: ['C5 - E5 - G5 - C6 - - - G5 - C6 - - -', '- - - - . . . . . . . . . . . .'],
      bass: 'R - - - - - - - R - - - . . . .',
    },
    ending: {
      bpm: 100,
      chords: ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'C'],
      lead: [
        'A5 - - - G5 - F5 - G5 - - - - - . .',
        'B5 - - - A5 - G5 - A5 - - - - - . .',
        'G5 - - - E5 - B4 - E5 - - - G5 - - -',
        'C6 - - - B5 - A5 - E5 - - - - - . .',
        'F5 - A5 - D6 - - - C6 - A5 - F5 - - -',
        'G5 - B5 - D6 - - - F6 - E6 - D6 - - -',
        'E6 - - - - - - - G5 - - - C6 - - -',
        '- - - - - - - - . . . . . . . .',
      ],
      bass: 'R - - - 5 - - - R - - - 5 - - -',
      drums: 'k . . . h . . . k . . . h . . .',
      arp: true,
      leadVol: 0.8,
    },
  };
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freqOf(name) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(name);
    const semi = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
    return 440 * 2 ** ((semi - 69) / 12);
  }
  function chordOf(name) {
    const m = /^([A-G][#b]?)(m?)$/.exec(name);
    const root = freqOf(m[1] + '2');
    return { root, third: root * 2 ** ((m[2] ? 3 : 4) / 12), fifth: root * 2 ** (7 / 12) };
  }
  function parseSteps(str, offset = 0) {
    const out = [];
    str.split(/\s+/).forEach((tok, i) => {
      if (tok === '-') {
        if (out.length && out[out.length - 1].end === i + offset) out[out.length - 1].len++, out[out.length - 1].end++;
      } else if (tok !== '.') out.push({ step: i + offset, len: 1, end: i + offset + 1, value: tok });
    });
    return out;
  }
  for (const song of Object.values(SONGS)) {
    song.steps = song.lead.length * 16;
    song.leadNotes = parseSteps(song.lead.join(' ')).map((n) => ({ ...n, freq: freqOf(n.value) }));
    song.chordAt = song.chords.flatMap((c) => {
      const parts = c.split(' ').map(chordOf);
      return Array.from({ length: 16 }, (_, i) => parts[Math.floor((i * parts.length) / 16)]);
    });
    song.bassNotes = [];
    song.drumHits = [];
    for (let bar = 0; bar < song.lead.length; bar++) {
      song.bassNotes.push(...parseSteps(song.bass, bar * 16));
      if (song.drums) song.drumHits.push(...parseSteps(song.drums, bar * 16));
    }
  }
  const music = (() => {
    let out = null;
    let pulse = null;
    let noise = null;
    let song = null;
    let current;
    let step = 0;
    let nextAt = 0;
    let level = -1;
    function setup() {
      out = audio.createGain();
      out.gain.value = 0;
      out.connect(audio.destination);
      const n = 32;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let i = 1; i < n; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * 0.25);
      pulse = audio.createPeriodicWave(real, imag);
      noise = audio.createBuffer(1, audio.sampleRate / 2, audio.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    function voice(freq, at, dur, wave, vol) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      if (wave === 'pulse') o.setPeriodicWave(pulse);
      else o.type = wave;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(vol, at + 0.005);
      g.gain.setTargetAtTime(vol * 0.6, at + 0.02, 0.08);
      g.gain.setTargetAtTime(0, at + dur * 0.85, 0.02);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + dur + 0.1);
    }
    function drum(kind, at) {
      const g = audio.createGain();
      g.connect(out);
      if (kind === 'k') {
        const o = audio.createOscillator();
        o.frequency.setValueAtTime(150, at);
        o.frequency.exponentialRampToValueAtTime(40, at + 0.12);
        g.gain.setValueAtTime(0.4, at);
        g.gain.exponentialRampToValueAtTime(0.001, at + 0.15);
        o.connect(g);
        o.start(at);
        o.stop(at + 0.16);
        return;
      }
      const src = audio.createBufferSource();
      const f = audio.createBiquadFilter();
      src.buffer = noise;
      f.type = 'highpass';
      f.frequency.value = kind === 's' ? 1500 : 7000;
      const len = kind === 's' ? 0.12 : 0.04;
      g.gain.setValueAtTime(kind === 's' ? 0.2 : 0.08, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + len);
      src.connect(f).connect(g);
      src.start(at, Math.random() * 0.3);
      src.stop(at + len + 0.01);
    }
    function playStep(s, at, sixteenth) {
      for (const n of song.leadNotes) if (n.step === s) voice(n.freq, at, n.len * sixteenth, 'pulse', 0.08 * (song.leadVol ?? 1));
      const ch = song.chordAt[s];
      for (const n of song.bassNotes) {
        if (n.step !== s) continue;
        const f = { R: ch.root, 3: ch.third, 5: ch.fifth, 8: ch.root * 2 }[n.value];
        voice(f, at, n.len * sixteenth, 'triangle', 0.2);
      }
      if (song.arp) {
        const tones = [ch.root, ch.third, ch.fifth, ch.root * 2];
        voice(tones[s % 4] * 4, at, sixteenth * 0.9, 'square', 0.02);
      }
      for (const d of song.drumHits) if (d.step === s) drum(d.value, at);
    }
    function schedule() {
      if (!song) return;
      const sixteenth = 15 / song.bpm;
      if (nextAt < audio.currentTime) nextAt = audio.currentTime + 0.05;
      while (nextAt < audio.currentTime + 0.15) {
        if (step >= song.steps) {
          if (song.once) {
            song = null;
            return;
          }
          step = 0;
        }
        playStep(step, nextAt, sixteenth);
        step++;
        nextAt += sixteenth;
      }
    }
    return {
      update(name, vol) {
        try {
          if (!audio || audio.state !== 'running') return;
          if (!out) setup();
          if (vol !== level) {
            level = vol;
            out.gain.setTargetAtTime(vol * 0.45, audio.currentTime, 0.05);
          }
          if (name !== current) {
            current = name;
            song = SONGS[name] ?? null;
            step = 0;
            nextAt = audio.currentTime + 0.05;
          }
          if (vol > 0) schedule();
        } catch {
          /* audio unavailable */
        }
      },
    };
  })();

  // ---------------------------------------------------------------- input --
  // Every source (keyboard, touch, gamepad) writes into the same action state.
  const keys = new Set();
  const touch = { left: false, right: false, jump: false };
  const pad = { left: false, right: false, jump: false, up: false, down: false };
  const input = { left: false, right: false, jump: false };
  let jumpWas = false;
  const pressed = { jump: false };

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Space: 'jump', KeyW: 'jump', ArrowUp: 'jump', KeyZ: 'jump', KeyK: 'jump',
  };
  addEventListener('keydown', (e) => {
    unlockAudio();
    if (e.repeat && !(e.code in KEYMAP)) return;
    if (e.code in KEYMAP || /^(Escape|KeyP|KeyR|KeyM|Enter|ArrowDown|KeyS|Tab)$/.test(e.code)) {
      if (e.code !== 'Tab') e.preventDefault();
    }
    if (!e.repeat) onKey(e.code);
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));

  /** Drop every held input: on blur, pause, death and level changes. */
  function clearInput() {
    keys.clear();
    touch.left = touch.right = touch.jump = false;
    pointers.clear();
    updateTouchClasses();
  }
  addEventListener('blur', () => {
    clearInput();
    if (state === 'play') pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInput();
      if (state === 'play') pause();
      if (audio && audio.state === 'running') audio.suspend().catch(() => {});
    } else if (audio && settings.sound) audio.resume().catch(() => {});
  });

  // Touch controls: each finger is tracked by pointerId, so holding a
  // direction while pressing jump works, and sliding a thumb across the d-pad
  // switches direction.
  const pointers = new Map();
  let usedTouch = false;
  function moveZone(e) {
    const r = moveEl.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    // A finger dragged well off the pad lets go.
    if (Math.abs(x) > 0.85 || Math.abs(y) > 0.85) return null;
    if (y < -0.2 && Math.abs(x) < 0.2) return 'jump';
    if (x < -0.06) return 'left';
    if (x > 0.06) return 'right';
    return null;
  }
  function recomputeTouch() {
    touch.left = touch.right = touch.jump = false;
    for (const p of pointers.values()) if (p) touch[p] = true;
    updateTouchClasses();
  }
  function updateTouchClasses() {
    moveEl.classList.toggle('left', touch.left);
    moveEl.classList.toggle('right', touch.right);
    jumpEl.classList.toggle('down', touch.jump && [...pointers.keys()].some((k) => pointers.get(k) === 'jump'));
  }
  function bindPad(el, zoneOf) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      unlockAudio();
      markTouch(e);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* not capturable */
      }
      pointers.set(e.pointerId, zoneOf(e));
      recomputeTouch();
    });
    el.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, zoneOf(e));
      recomputeTouch();
    });
    const up = (e) => {
      if (!pointers.delete(e.pointerId)) return;
      recomputeTouch();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  bindPad(moveEl, moveZone);
  bindPad(jumpEl, (e) => {
    const r = jumpEl.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    return Math.hypot(dx, dy) < r.width * 0.9 ? 'jump' : null;
  });
  // Stop iOS from scrolling the page around the iframe or zooming on double tap.
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault());
  function markTouch(e) {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      if (!usedTouch) {
        usedTouch = true;
        updateChrome();
      }
    }
  }
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  const touchVisible = () => settings.touch === 'on' || (settings.touch === 'auto' && (coarse || usedTouch));

  function pollPad() {
    pad.left = pad.right = pad.jump = pad.up = pad.down = false;
    let gps = [];
    try {
      gps = navigator.getGamepads ? navigator.getGamepads() : [];
    } catch {
      /* not allowed */
    }
    for (const gp of gps) {
      if (!gp) continue;
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const ax = gp.axes[0] || 0;
      const ay = gp.axes[1] || 0;
      pad.left ||= ax < -0.4 || b(14);
      pad.right ||= ax > 0.4 || b(15);
      pad.up ||= ay < -0.5 || b(12);
      pad.down ||= ay > 0.5 || b(13);
      pad.jump ||= b(0) || b(1);
      if (b(9) && !pad.startWas) onKey('Escape');
      if (b(8) && !pad.selectWas) onKey('KeyR');
      pad.startNow = b(9);
      pad.selectNow = b(8);
    }
    pad.startWas = pad.startNow;
    pad.selectWas = pad.selectNow;
  }
  let padNavWas = '';
  function readInput() {
    pollPad();
    const k = (name) => [...keys].some((c) => KEYMAP[c] === name);
    input.left = k('left') || touch.left || pad.left;
    input.right = k('right') || touch.right || pad.right;
    input.jump = k('jump') || touch.jump || pad.jump;
    pressed.jump = input.jump && !jumpWas;
    jumpWas = input.jump;
    // Gamepad drives menus too.
    const nav = pad.up ? 'ArrowUp' : pad.down ? 'ArrowDown' : pad.left ? 'ArrowLeft' : pad.right ? 'ArrowRight' : pad.jump ? 'Enter' : '';
    if (nav !== padNavWas && nav && state !== 'play') onKey(nav);
    padNavWas = nav;
  }

  // ---------------------------------------------------------------- level --
  const SOLID = '#S';
  let world = null; // everything a run needs, plain data (the test hook clones it)
  let bake = null; // pre-rendered terrain for the current level
  const cam = { x: 0, y: 0, look: 0 };

  // Map characters that become things. Levels can add their own (digits etc.).
  const LEGEND = {
    P: { type: 'spawn' },
    E: { type: 'exit' },
    C: { type: 'checkpoint' },
    X: { type: 'fakeexit' },
    G: { type: 'gate' },
    D: { type: 'tipsign' },
    B: { type: 'bounce' },
    m: { type: 'crumble' },
    Y: { type: 'shy' },
    F: { type: 'bridge', delay: 0.22 },
    f: { type: 'bridge', delay: 0.85 },
    b: { type: 'bush', dir: 1 },
    d: { type: 'bush', dir: -1 },
    A: { type: 'hollow', dir: -1 },
    a: { type: 'hollow', dir: 1 },
    W: { type: 'mat', dir: 1 },
    w: { type: 'mat', dir: -1 },
    T: { type: 'stagetree' },
    K: { type: 'skydrop' },
    Z: { type: 'slider' },
    z: { type: 'slider', chase: true },
    J: { type: 'growtree' },
    V: { type: 'fakeground' },
    H: { type: 'popspike' },
    I: { type: 'hidden' },
    L: { type: 'roller' },
  };

  function tileAt(tx, ty) {
    if (tx < 0 || tx >= world.cols) return '#';
    if (ty < 0 || ty >= world.rows) return '.';
    return world.map[ty][tx];
  }
  const solidTile = (tx, ty) => SOLID.includes(tileAt(tx, ty));

  function loadLevel(index) {
    const L = LEVELS[index];
    const rows = L.map.length;
    const cols = Math.max(...L.map.map((r) => r.length));
    const map = L.map.map((r) => r.padEnd(cols, '.').split(''));
    world = {
      index,
      cols,
      rows,
      map,
      ents: [],
      nextId: 1,
      time: 0,
      deaths: 0,
      spawn: { x: 2 * T, y: 0 },
      checkpoint: null,
      cpDone: [],
      fx: [],
      shake: 0,
      quip: null,
      banner: 3,
      done: false,
      fake: null,
      clock: 0,
    };
    // Things in the map become entities; their cells turn into empty air.
    world.things = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const c = map[y][x];
        const def = (L.legend && L.legend[c]) || LEGEND[c];
        if (!def) continue;
        map[y][x] = '.';
        if (def.type === 'spawn') world.spawn = { x: x * T + 6, y: (y + 1) * T - 22 };
        else world.things.push({ ...def, tx: x, ty: y });
      }
    world.player = newPlayer(world.spawn);
    spawnThings();
    bakeTerrain(L);
    snapCamera();
    return world;
  }

  function newPlayer(at) {
    return { x: at.x, y: at.y, w: 12, h: 22, vx: 0, vy: 0, face: 1, ground: null, coyote: 0, buffer: 0, cut: false, anim: 0, dead: 0, won: 0, wind: 0, land: 0 };
  }

  /** (Re)create every trap from the map, so a respawn resets the forest. */
  function spawnThings() {
    world.ents = [];
    for (const t of world.things) {
      const e = { id: world.nextId++, ...t, x: t.tx * T, y: t.ty * T, t: 0, s: 'idle', dx: 0, dy: 0, py: t.ty * T };
      KINDS[e.type].init?.(e);
      world.ents.push(e);
    }
  }

  // --------------------------------------------------------------- physics --
  const GRAV = 1150;
  const RUN = 112;
  const ACC_GROUND = 1000;
  const ACC_AIR = 760;
  const FRICTION = 1200;
  const JUMP_V = 405;
  const BOUNCE_V = 570;
  const MAX_FALL = 430;
  const COYOTE = 0.1;
  const BUFFER = 0.12;

  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function solids() {
    const out = [];
    for (const e of world.ents) {
      const r = KINDS[e.type].solid?.(e);
      if (r) out.push(Object.assign(r, { e }));
    }
    return out;
  }

  function moveX(p, dx, list) {
    p.x += dx;
    const y0 = Math.floor(p.y / T);
    const y1 = Math.floor((p.y + p.h - 0.01) / T);
    if (dx > 0) {
      const tx = Math.floor((p.x + p.w - 0.01) / T);
      for (let ty = y0; ty <= y1; ty++)
        if (solidTile(tx, ty)) {
          p.x = tx * T - p.w;
          p.vx = Math.min(0, p.vx);
          break;
        }
    } else if (dx < 0) {
      const tx = Math.floor(p.x / T);
      for (let ty = y0; ty <= y1; ty++)
        if (solidTile(tx, ty)) {
          p.x = (tx + 1) * T;
          p.vx = Math.max(0, p.vx);
          break;
        }
    }
    for (const s of list) {
      if (s.oneWay || !overlap(p, s)) continue;
      if (p.x + p.w / 2 < s.x + s.w / 2) p.x = s.x - p.w;
      else p.x = s.x + s.w;
      p.vx = 0;
    }
  }

  function moveY(p, dy, list) {
    const prevBottom = p.y + p.h;
    p.y += dy;
    p.ground = null;
    const x0 = Math.floor(p.x / T);
    const x1 = Math.floor((p.x + p.w - 0.01) / T);
    if (dy >= 0) {
      const ty = Math.floor((p.y + p.h - 0.01) / T);
      for (let tx = x0; tx <= x1; tx++) {
        const c = tileAt(tx, ty);
        if (SOLID.includes(c) || (c === '=' && prevBottom <= ty * T + 0.5)) {
          p.y = ty * T - p.h;
          p.vy = 0;
          p.ground = 'tile';
          break;
        }
      }
      for (const s of list) {
        if (p.x + p.w <= s.x || p.x >= s.x + s.w) continue;
        const top = s.y;
        if (prevBottom <= Math.max(top, s.e.py ?? top) + 1 && p.y + p.h >= top) {
          p.y = top - p.h;
          p.vy = 0;
          p.ground = s.e.id;
        }
      }
    } else {
      const ty = Math.floor(p.y / T);
      for (let tx = x0; tx <= x1; tx++)
        if (solidTile(tx, ty)) {
          p.y = (ty + 1) * T;
          p.vy = 0;
          break;
        }
      for (const s of list) if (!s.oneWay && overlap(p, s)) (p.y = s.y + s.h), (p.vy = 0);
    }
  }

  function hazardTiles(p) {
    const x0 = Math.floor(p.x / T);
    const x1 = Math.floor((p.x + p.w - 0.01) / T);
    const y0 = Math.floor(p.y / T);
    const y1 = Math.floor((p.y + p.h - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        const c = tileAt(tx, ty);
        const x = tx * T;
        const y = ty * T;
        let r = null;
        if (c === '^') r = { x: x + 3, y: y + 11, w: 18, h: 13 };
        else if (c === 'v') r = { x: x + 3, y, w: 18, h: 13 };
        else if (c === '<') r = { x: x + 11, y: y + 3, w: 13, h: 18 };
        else if (c === '>') r = { x, y: y + 3, w: 13, h: 18 };
        else if (c === '~') r = { x, y: y + 9, w: T, h: 15 };
        if (r && overlap(p, r)) return c === '~' ? 'water' : 'spikes';
      }
    return null;
  }

  function stepPlayer() {
    const p = world.player;
    if (p.dead) {
      p.dead += DT;
      p.vy = Math.min(MAX_FALL, p.vy + GRAV * DT);
      p.y += p.vy * DT;
      if (p.dead > 0.85) respawn();
      return;
    }
    if (p.won) {
      p.won += DT;
      p.vx = 0;
      if (p.won > 1.1 && state === 'play') completeLevel();
      return;
    }
    const list = solids();
    // Ride whatever we stand on.
    if (typeof p.ground === 'number') {
      const s = list.find((s) => s.e.id === p.ground);
      if (s) {
        if (s.e.dx) moveX(p, s.e.dx, list.filter((o) => o !== s));
        if (s.e.dy) p.y += s.e.dy;
      }
    }
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const onGround = p.ground !== null;
    const acc = onGround ? ACC_GROUND : ACC_AIR;
    if (dir) {
      p.vx += dir * acc * DT;
      if (Math.abs(p.vx) > RUN && Math.sign(p.vx) === dir && !p.wind) p.vx = Math.max(-RUN, Math.min(RUN, p.vx)) * 0.9 + p.vx * 0.1;
      p.face = dir;
    } else if (!p.wind) {
      const f = (onGround ? FRICTION : FRICTION * 0.35) * DT;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }
    if (!p.wind) p.vx = Math.max(-RUN * 1.6, Math.min(RUN * 1.6, p.vx));
    // Bush sneezes push (set by bushes during their update).
    if (p.wind) {
      p.vx += p.wind * DT;
      p.vx = Math.max(-250, Math.min(250, p.vx));
      p.wind = 0;
    }

    p.coyote = onGround ? COYOTE : Math.max(0, p.coyote - DT);
    p.buffer = pressed.jump ? BUFFER : Math.max(0, p.buffer - DT);
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -JUMP_V;
      p.buffer = 0;
      p.coyote = 0;
      p.cut = false;
      p.ground = null;
      sfx.jump();
      dust(p.x + p.w / 2, p.y + p.h, 3);
    }
    // Let go early for a short hop.
    if (!input.jump && p.vy < -120 && !p.cut && !p.bounced) {
      p.vy *= 0.45;
      p.cut = true;
    }
    p.vy = Math.min(MAX_FALL, p.vy + GRAV * DT);
    if (p.vy >= 0) p.bounced = false;

    const wasAir = p.ground === null;
    const fallSpeed = p.vy;
    moveX(p, p.vx * DT, list);
    moveY(p, p.vy * DT, list);
    if (wasAir && p.ground !== null && fallSpeed > 160) {
      p.land = 0.1;
      sfx.land();
      dust(p.x + p.w / 2, p.y + p.h, 2);
    }
    p.land = Math.max(0, p.land - DT);
    p.anim += DT;

    // Things react to where Pip is (and may kill, bounce or carry him).
    const cause = hazardTiles(p);
    if (cause) return die(cause);
    if (p.y > world.rows * T + 30) return die('fall');
  }

  function die(cause) {
    const p = world.player;
    if (p.dead || p.won) return;
    p.dead = 0.0001;
    p.vy = -280;
    p.vx = 0;
    world.deaths++;
    progress.totalDeaths++;
    saveProgress();
    world.quip = { text: pickQuip(cause), t: 1.6 };
    if (settings.shake) world.shake = 0.25;
    sfx.fail();
    clearInput();
  }

  const QUIPS = {
    spikes: ['OUCH. POINTY.', 'THOSE WERE NOT GRASS.', 'THE FOREST GIGGLES.', 'NATURE 1, PIP 0.'],
    water: ['PIP CANNOT SWIM. NOTED.', 'SPLASH!', 'THE LETTER IS WATERPROOF. PIP IS NOT.'],
    fall: ['BYE!', 'GRAVITY STILL WORKS.', 'THAT WAS A LONG WAY DOWN.'],
    sign: ['THE SIGN WAS HEAVIER THAN IT LOOKED.', 'BONK!', 'SIGNS: NOT TO BE TRUSTED.'],
    acorn: ['ACORN DELIVERED. TO YOUR HEAD.', 'BONK! SQUIRREL MAIL.', 'THE TREE THREW FIRST.'],
    crush: ['SQUISHED.', 'STAGE CREW ACCIDENT.', 'THE SKY WAS NOT EMPTY.', 'LOOK UP NEXT TIME.'],
    tree: ['TIMBER!', 'THAT TREE HAD A GROWTH SPURT.', 'FLATTENED BY FOLIAGE.'],
    pop: ['SURPRISE SPIKES!', 'THE GRASS HAD TEETH.', 'THAT WAS NOT THERE BEFORE.'],
    roll: ['ROLLED OVER.', 'LOG 1, PIP 0.', 'SHOULD HAVE JUMPED.'],
    trapdoor: ['THE GROUND WAS FAKE.', 'FLOOR? WHAT FLOOR?', 'BYE, GROUND!'],
  };
  function pickQuip(cause) {
    const list = QUIPS[cause] || QUIPS.spikes;
    return list[(world.deaths + world.index) % list.length];
  }

  function respawn() {
    const at = world.checkpoint || world.spawn;
    world.player = newPlayer(at);
    world.fx = world.fx.filter((f) => f.keep);
    world.fake = null;
    spawnThings();
    clearInput();
    snapCamera();
  }

  function restartLevel() {
    const i = world.index;
    const deaths = world.deaths;
    loadLevel(i);
    world.deaths = deaths;
    world.banner = 0;
    clearInput();
  }

  // ------------------------------------------------------------ the traps --
  const P = () => world.player;
  const standingOn = (e) => P().ground === e.id;
  const hurtIf = (r, cause) => {
    const p = P();
    if (!p.dead && !p.won && overlap(p, r)) die(cause);
  };

  const KINDS = {
    exit: {
      update(e) {
        const p = P();
        // Some mailboxes hop away the first time you get close.
        if (e.run && !e.ran && Math.abs(p.x + p.w / 2 - (e.x + T / 2)) < 2.2 * T) {
          e.ran = true;
          e.hop = 0;
          e.from = e.x;
          sfx.nope();
          world.quip = { text: 'NOPE!', t: 0.9 };
        }
        if (e.hop !== undefined && e.hop < 1) {
          e.hop = Math.min(1, e.hop + DT / 0.3);
          e.x = e.from + e.run * T * e.hop;
          e.lift = Math.sin(e.hop * Math.PI) * 26;
          return;
        }
        e.lift = 0;
        if (!p.won && !p.dead && overlap(p, { x: e.x - 2, y: e.y - 20, w: T + 4, h: 44 })) {
          p.won = 0.0001;
          e.s = 'got';
          e.t = 0;
          sfx.win();
          burst(e.x + 12, e.y - 6, 14);
          clearInput();
        }
      },
      draw(e) {
        const bottom = e.y + T - (e.lift || 0);
        const cx = e.x + T / 2;
        stand('mailbox', cx, bottom);
        // Flag goes up when the letter is in.
        const up = e.s === 'got' ? Math.min(1, e.t * 4) : 0;
        spr('mailbox_flag', cx + 6, bottom - 26 - up * 4, { rot: (1 - up) * 1.4, ox: 0, oy: 1 });
        if (e.s === 'got' && e.t < 0.6) spr('letter', cx - 12 + e.t * 18, bottom - 30 + e.t * 10);
        if (e.s !== 'got' && Math.sin(world.clock * 4) > 0.3) spr('fx_spark', cx + 4, bottom - 44, { sx: 0.5, sy: 0.5 });
      },
    },
    checkpoint: {
      init(e) {
        e.on = world.cpDone.includes(e.tx + ',' + e.ty);
      },
      update(e) {
        if (e.on) return;
        const p = P();
        if (!p.dead && overlap(p, { x: e.x, y: e.y - 24, w: T, h: 48 })) {
          e.on = true;
          world.cpDone.push(e.tx + ',' + e.ty);
          world.checkpoint = { x: e.x + 6, y: e.y + T - 22 };
          sfx.check();
          burst(e.x + 12, e.y - 12, 8);
        }
      },
      draw(e) {
        const cx = e.x + T / 2;
        ctx.fillStyle = '#5b3a1e';
        ctx.fillRect(Math.round(cx - 1 - cam.x), Math.round(e.y + 4 - cam.y), 3, 20);
        const bob = e.on ? Math.sin(world.clock * 3) * 1.5 : 0;
        spr(e.on ? 'star' : 'star_off', cx - 8, e.y - 12 + bob);
      },
    },
    // A friendly sign that tips over onto whoever walks up to it.
    tipsign: {
      init(e) {
        e.ang = 0;
        e.fall = 0;
      },
      update(e) {
        const p = P();
        const base = e.x + T / 2;
        const cx = p.x + p.w / 2;
        if (e.s === 'idle' && Math.abs(cx - base) < 52 && Math.abs(p.y + p.h - (e.y + T)) < 40) {
          e.s = 'wobble';
          e.t = 0;
          e.fall = cx < base ? -1 : 1;
          sfx.wobble();
        } else if (e.s === 'wobble' && e.t > 0.5) {
          e.s = 'falling';
          e.t = 0;
        } else if (e.s === 'falling') {
          e.ang = Math.min(Math.PI / 2, (e.t / 0.28) ** 2 * (Math.PI / 2));
          if (e.t > 0.18) hurtIf(this.zone(e), 'sign');
          if (e.ang >= Math.PI / 2) {
            e.s = 'down';
            sfx.thud();
            if (settings.shake) world.shake = 0.15;
            dust(base + e.fall * 26, e.y + T, 6);
          }
        }
        e.t += DT;
      },
      zone(e) {
        const base = e.x + T / 2;
        return { x: e.fall < 0 ? base - 50 : base, y: e.y + T - 20, w: 50, h: 20 };
      },
      solid(e) {
        if (e.s !== 'down') return null;
        const base = e.x + T / 2;
        return { x: e.fall < 0 ? base - 46 : base, y: e.y + T - 12, w: 46, h: 12 };
      },
      draw(e) {
        const base = e.x + T / 2;
        const bottom = e.y + T;
        const wob = e.s === 'wobble' ? Math.sin(e.t * 40) * 0.08 : 0;
        const ang = (e.ang + Math.abs(wob)) * (e.fall || 1) + (e.s === 'wobble' ? wob : 0);
        ctx.save();
        ctx.translate(Math.round(base - cam.x), Math.round(bottom - cam.y));
        ctx.rotate(ang);
        ctx.fillStyle = '#13202a';
        ctx.fillRect(-3, -40, 6, 40);
        ctx.fillStyle = '#7a4a24';
        ctx.fillRect(-2, -40, 4, 40);
        const [ax, ay, w, h] = ATLAS.sign;
        ctx.drawImage(sheet, ax, ay, w, h, -Math.round(w / 2), -40 - h + 6, w, h);
        screenSpace(() => text(e.text || 'HI!', 0, -40 - h + 11, { align: 'center', color: '#fff6c2', outline: '#3b2412' }));
        ctx.restore();
      },
    },
    // Signs that just talk.
    note: {
      draw(e) {
        const cx = e.x + T / 2;
        stand('sign', cx, e.y + T, { flip: e.flip });
        const p = P();
        if (Math.abs(p.x + 6 - cx) < 70 && Math.abs(p.y - e.y) < 80) bubble(touchVisible() && e.touch ? e.touch : e.text, cx, e.y + T - 30);
      },
    },
    // Signs that change their story when you get close.
    liar: {
      update(e) {
        const p = P();
        const d = Math.abs(p.x + 6 - (e.x + T / 2));
        if (e.s === 'idle' && d < (e.reveal ?? 40) && Math.abs(p.y - e.y) < 60) {
          e.s = 'flip';
          e.t = 0;
          sfx.flip();
        }
        e.t += DT;
      },
      draw(e) {
        const cx = e.x + T / 2;
        const flipped = e.s === 'flip' && e.t > 0.15;
        const squash = e.s === 'flip' && e.t < 0.3 ? Math.abs(Math.cos(e.t * 10.5)) : 1;
        const flipDir = flipped ? !!e.nearFlip : !!e.flip;
        post(cx, e.y + T);
        stand('sign', cx, e.y + T - 12, { flip: flipDir, sx: Math.max(0.1, squash), oy: 1 });
        const p = P();
        if (Math.abs(p.x + 6 - cx) < 130 && Math.abs(p.y - e.y) < 90) bubble(flipped ? e.near : e.text, cx, e.y + T - 30);
      },
    },
    bounce: {
      update(e) {
        const p = P();
        if (standingOn(e)) {
          p.vy = -BOUNCE_V;
          p.ground = null;
          p.bounced = true;
          p.coyote = 0;
          e.t = 0;
          e.s = 'squash';
          sfx.bounce();
        }
        e.t += DT;
        if (e.s === 'squash' && e.t > 0.3) e.s = 'idle';
      },
      solid(e) {
        return { x: e.x + 2, y: e.y + 9, w: 20, h: 8, oneWay: true };
      },
      draw(e) {
        const k = e.s === 'squash' ? 1 - Math.sin(Math.min(1, e.t / 0.3) * Math.PI) * 0.35 : 1 + Math.sin(world.clock * 3) * 0.03;
        stand('shroom_bonus', e.x + T / 2, e.y + T, { sy: k, sx: 2 - k });
      },
    },
    // A nervous mushroom: shakes when stood on, then sinks away for a moment.
    crumble: {
      update(e) {
        if (e.s === 'idle' && standingOn(e)) {
          e.s = 'shake';
          e.t = 0;
          sfx.wobble();
        } else if (e.s === 'shake' && e.t > (e.hold ?? 0.55)) {
          e.s = 'gone';
          e.t = 0;
          sfx.fold();
        } else if (e.s === 'gone' && e.t > 2.4 && !overlap(P(), { x: e.x, y: e.y - 8, w: T, h: T + 8 })) {
          e.s = 'idle';
          e.t = 0;
        }
        e.t += DT;
      },
      solid(e) {
        return e.s === 'gone' ? null : { x: e.x + 2, y: e.y + 4, w: 20, h: 8, oneWay: true };
      },
      draw(e) {
        const cx = e.x + T / 2;
        if (e.s === 'gone') {
          const k = Math.min(1, e.t / 0.35);
          if (k < 1) stand('shroom_face', cx, e.y + 23 + k * 30, { alpha: 1 - k });
          else if (e.t > 1.9) stand('shroom_face', cx, e.y + 23, { alpha: (e.t - 1.9) / 0.5 });
          return;
        }
        const jig = e.s === 'shake' ? Math.round(Math.sin(e.t * 50) * 1.5) : 0;
        stand('shroom_face', cx + jig, e.y + 23);
        if (e.s === 'shake') {
          // A drop of nervous sweat.
          ctx.fillStyle = '#9fd8ff';
          ctx.fillRect(Math.round(cx + 8 - cam.x), Math.round(e.y + 2 + (e.t * 20) % 6 - cam.y), 2, 3);
        }
      },
    },
    // A tall mushroom that ducks when you come close, then stands back up,
    // lifting whoever is on its cap.
    shy: {
      init(e) {
        e.h = 0; // 0 = standing tall, 1 = hidden
        e.top = this.capTop(e);
        e.py = e.top;
      },
      capTop(e) {
        const tall = e.y + T - (e.tall ?? 3) * T;
        const low = e.y + T - 12;
        return tall + (low - tall) * e.h;
      },
      update(e) {
        const p = P();
        const cx = p.x + p.w / 2;
        const close = Math.abs(cx - (e.x + T / 2)) < 40 && p.y + p.h > e.y + T - (e.tall ?? 3) * T - 30;
        if (e.s === 'idle' && close && !standingOn(e)) {
          e.s = 'hide';
          e.t = 0;
          sfx.shy();
        } else if (e.s === 'hide') {
          e.h = Math.min(1, e.t / 0.18);
          if (e.t > (e.wait ?? 1.4)) (e.s = 'rise'), (e.t = 0);
        } else if (e.s === 'rise') {
          e.h = Math.max(0, 1 - e.t / 0.6);
          if (e.h === 0) (e.s = 'cool'), (e.t = 0);
        } else if (e.s === 'cool' && e.t > 0.8 && !standingOn(e)) e.s = 'idle';
        e.t += DT;
        e.py = e.top;
        e.top = this.capTop(e);
        e.dy = e.top - e.py;
      },
      solid(e) {
        return { x: e.x + 2, y: e.top + 3, w: 20, h: 8, oneWay: true };
      },
      draw(e) {
        const cx = e.x + T / 2;
        const bottom = e.y + T;
        // Stem down to the ground, then the cap.
        const stemTop = e.top + 18;
        if (bottom - stemTop > 0) {
          ctx.fillStyle = '#13202a';
          ctx.fillRect(Math.round(cx - 5 - cam.x), Math.round(stemTop - cam.y), 10, Math.round(bottom - stemTop));
          ctx.fillStyle = '#f4ecd2';
          ctx.fillRect(Math.round(cx - 4 - cam.x), Math.round(stemTop - cam.y), 8, Math.round(bottom - stemTop));
          ctx.fillStyle = '#d8caa6';
          ctx.fillRect(Math.round(cx + 2 - cam.x), Math.round(stemTop - cam.y), 2, Math.round(bottom - stemTop));
        }
        spr('shroom_face', cx - sw('shroom_face') / 2, e.top);
        if (e.s === 'hide' && e.t < 0.6) text('EEP!', cx, e.top - 10, { align: 'center', color: '#fff6c2' });
      },
    },
    // Bridge planks that fold away when you get close.
    bridge: {
      update(e) {
        const p = P();
        if (e.s === 'idle') {
          const cx = p.x + p.w / 2;
          const bottom = p.y + p.h;
          if (Math.abs(cx - (e.x + T / 2)) < 28 && bottom > e.y - 30 && bottom <= e.y + 4) {
            e.s = 'shake';
            e.t = 0;
            if (!world.creakAt || world.clock - world.creakAt > 0.3) sfx.creak(), (world.creakAt = world.clock);
          }
        } else if (e.s === 'shake' && e.t > e.delay) {
          e.s = 'fall';
          e.t = 0;
          sfx.fold();
        } else if (e.s === 'fall' && e.t > 3.2) {
          e.s = 'back';
          e.t = 0;
        } else if (e.s === 'back' && e.t > 0.4) {
          e.s = 'idle';
        }
        e.t += DT;
      },
      solid(e) {
        return e.s === 'idle' || e.s === 'shake' ? { x: e.x, y: e.y, w: T, h: 10, oneWay: true } : null;
      },
      draw(e) {
        const x = e.x + 12;
        if (e.s === 'fall') {
          if (e.t > 1) return;
          spr('log_plank', x - 12, e.y - 2 + e.t * e.t * 300, { rot: e.t * 3 * (e.tx % 2 ? 1 : -1), oy: 0.5, alpha: 1 - e.t });
          return;
        }
        const jig = e.s === 'shake' ? Math.round(Math.sin(e.t * 60)) : 0;
        spr('log_plank', x - 12, e.y - 2 + jig, { alpha: e.s === 'back' ? e.t / 0.4 : 1 });
        // Slow planks get a little crack, the honest warning that they hold for a bit.
        if (e.delay > 0.5) {
          ctx.fillStyle = '#3b2412';
          ctx.fillRect(Math.round(x - 2 - cam.x), Math.round(e.y + 2 - cam.y), 1, 4);
        }
      },
    },
    // Bushes with allergies: leaf-shake and inhale, then a sneeze that pushes.
    bush: {
      init(e) {
        e.pattern = e.pattern || [e.wait ?? 1.4];
        e.pi = 0;
        e.t = -(e.offset ?? 0);
        e.s = e.trigger != null ? 'sleep' : 'wait';
      },
      update(e) {
        const p = P();
        if (e.s === 'sleep') {
          if (p.x > e.trigger * T) (e.s = 'wait'), (e.t = -(e.offset ?? 0));
          return;
        }
        e.t += DT;
        if (e.s === 'wait' && e.t > e.pattern[e.pi % e.pattern.length]) {
          e.s = 'inhale';
          e.t = 0;
          if (onScreen(e)) sfx.inhale();
        } else if (e.s === 'inhale' && e.t > 0.8) {
          e.s = 'sneeze';
          e.t = 0;
          if (onScreen(e)) sfx.sneeze();
        } else if (e.s === 'sneeze') {
          const z = this.zone(e);
          if (!p.dead && overlap(p, z)) p.wind = e.dir * 1700;
          if (Math.random() < 0.5) world.fx.push({ k: 'puff', x: e.dir > 0 ? z.x : z.x + z.w, y: z.y + 8 + Math.random() * (z.h - 16), vx: e.dir * (220 + Math.random() * 80), vy: (Math.random() - 0.5) * 20, t: 0, life: 0.5 });
          if (e.t > 0.6) {
            e.s = 'wait';
            e.t = 0;
            e.pi++;
          }
        }
      },
      zone(e) {
        const len = (e.range ?? 6) * T;
        const x = e.dir > 0 ? e.x + T : e.x - len;
        return { x, y: e.y + T - 54, w: len, h: 54 };
      },
      draw(e) {
        const cx = e.x + T / 2;
        let sx = 1;
        let sy = 1;
        let jig = 0;
        if (e.s === 'inhale') {
          const k = e.t / 0.8;
          sx = 1 + k * 0.15;
          sy = 1 + k * 0.25;
          jig = Math.round(Math.sin(e.t * 45) * k * 1.5);
          if (Math.random() < 0.15) world.fx.push({ k: 'leaf', x: cx + (Math.random() - 0.5) * 30, y: e.y + 4, vx: (Math.random() - 0.5) * 30, vy: -20, t: 0, life: 0.8 });
        } else if (e.s === 'sneeze') {
          sx = 1.1 - Math.min(1, e.t / 0.2) * 0.2;
          sy = 0.85;
        }
        stand('bush', cx + jig, e.y + T, { sx, sy, flip: e.dir < 0 });
        // Little eyes, closed until the sneeze.
        const ex = Math.round(cx + e.dir * 6 - cam.x);
        const ey = Math.round(e.y + T - 13 * sy - cam.y);
        ctx.fillStyle = '#13202a';
        if (e.s === 'sneeze') ctx.fillRect(ex - 4, ey, 3, 1), ctx.fillRect(ex + 2, ey, 3, 1);
        else ctx.fillRect(ex - 4, ey, 2, 2), ctx.fillRect(ex + 2, ey, 2, 2);
        if (e.s === 'inhale' && e.t > 0.3) text('AH..', cx, e.y - 4, { align: 'center', color: '#fff6c2' });
        if (e.s === 'sneeze' && e.t < 0.35) text('CHOO!', cx + e.dir * 14, e.y - 6, { align: 'center', color: '#fff6c2' });
      },
    },
    // Tree stumps that lob acorns along the ground.
    hollow: {
      init(e) {
        e.t = -(e.offset ?? 0.5);
      },
      update(e) {
        e.t += DT;
        const period = e.period ?? 2.4;
        if (e.s === 'idle' && e.t > period - 0.6) {
          e.s = 'rattle';
          if (onScreen(e)) sfx.rattle();
        } else if (e.s === 'rattle' && e.t > period) {
          e.s = 'idle';
          e.t = 0;
          world.ents.push({ id: world.nextId++, type: 'acorn', x: e.x + 12 + e.dir * 8 - 4, y: e.y + T - 14, vx: e.dir * (e.speed ?? 95), vy: 0, t: 0, s: 'roll', dx: 0, dy: 0 });
          if (onScreen(e)) sfx.roll();
        }
      },
      draw(e) {
        const cx = e.x + T / 2;
        const jig = e.s === 'rattle' ? Math.round(Math.sin(e.t * 50)) : 0;
        stand('stump', cx + jig, e.y + T, { flip: e.dir > 0 });
        // The hollow, with eyes when it's about to throw.
        const hx = Math.round(cx + e.dir * 6 - 5 - cam.x + jig);
        const hy = Math.round(e.y + T - 17 - cam.y);
        ctx.fillStyle = '#13202a';
        ctx.fillRect(hx, hy, 10, 9);
        ctx.fillRect(hx + 1, hy - 1, 8, 11);
        if (e.s === 'rattle') {
          ctx.fillStyle = '#f7c948';
          ctx.fillRect(hx + 2, hy + 3, 2, 2);
          ctx.fillRect(hx + 6, hy + 3, 2, 2);
        }
      },
    },
    acorn: {
      update(e) {
        e.t += DT;
        e.vy = Math.min(MAX_FALL, e.vy + GRAV * DT);
        const r = { x: e.x, y: e.y, w: 8, h: 8, vx: e.vx, vy: e.vy };
        moveX(r, e.vx * DT, []);
        moveY(r, e.vy * DT, []);
        if (r.vx === 0) e.gone = true; // hit a wall
        e.x = r.x;
        e.y = r.y;
        e.vy = r.vy;
        if (e.y > world.rows * T + 20 || e.t > 14) e.gone = true;
        if (!e.gone) hurtIf({ x: e.x + 1, y: e.y + 1, w: 6, h: 7 }, 'acorn');
        if (e.gone) dust(e.x + 4, e.y + 8, 2);
      },
      draw(e) {
        spr('acorn', e.x, e.y, { rot: e.x * 0.12 * Math.sign(e.vx), oy: 0.5 });
      },
    },
    // A welcome mat that slides off once you step on it.
    mat: {
      init(e) {
        e.w = (e.width ?? 2) * T;
        e.home = e.x;
        e.py = e.y;
      },
      update(e) {
        const on = standingOn(e);
        const dist = (e.dist ?? 12) * T;
        let vx = 0;
        if (e.s === 'idle' && on) (e.s = 'wiggle'), (e.t = 0), sfx.wobble();
        else if (e.s === 'wiggle' && e.t > 0.3) (e.s = 'go'), (e.t = 0), sfx.slide();
        else if (e.s === 'go') {
          vx = e.dir * (e.speed ?? 85);
          if (Math.abs(e.x + vx * DT - e.home) >= dist) {
            vx = (e.home + e.dir * dist - e.x) / DT;
            e.s = 'stop';
            e.t = 0;
            sfx.thud();
          }
        } else if (e.s === 'stop' && !on && e.t > 1.5) e.s = 'return';
        else if (e.s === 'return') {
          vx = -e.dir * 60;
          if (Math.sign(e.home - (e.x + vx * DT)) !== -e.dir && e.home !== e.x + vx * DT) {
            vx = (e.home - e.x) / DT;
            e.s = 'idle';
          }
        }
        e.t += DT;
        e.dx = vx * DT;
        e.x += e.dx;
      },
      solid(e) {
        return { x: e.x, y: e.y, w: e.w, h: 10, oneWay: true };
      },
      draw(e) {
        const jig = e.s === 'wiggle' ? Math.round(Math.sin(e.t * 50)) : 0;
        for (let i = 0; i < e.w / T; i++) spr('log_plank', e.x + i * T + jig, e.y - 2);
        const x = Math.round(e.x + 3 + jig - cam.x);
        const y = Math.round(e.y - 3 - cam.y);
        ctx.fillStyle = '#13202a';
        ctx.fillRect(x - 1, y - 1, e.w - 4, 6);
        ctx.fillStyle = '#c43d36';
        ctx.fillRect(x, y, e.w - 6, 4);
        ctx.fillStyle = '#f7c948';
        ctx.fillRect(x, y + 4, e.w - 6, 1);
        if (e.w >= 48) text('WELCOME', e.x + e.w / 2 + jig, e.y - 9, { align: 'center', color: '#fff6c2', outline: '#7a1f1a' });
      },
    },
    // The stage tree: drums, then rearranges its numbered platforms.
    stagetree: {
      update(e) {
        const beat = world.beat ?? 1.8;
        const phase = world.clock % beat;
        e.tell = phase > beat - 0.45;
        if (e.tell && !e.told) {
          e.told = true;
          if (onScreen(e, 200)) sfx.drum();
        }
        if (!e.tell) e.told = false;
      },
      draw(e) {
        const lift = e.tell ? -3 : 0;
        stand(e.big ? 'boss_tree' : 'tree_face', e.x + T / 2, e.y + T + lift, { flip: e.flip, sx: e.tell ? 1.06 : 1, sy: e.tell ? 1.06 : 1 });
        if (e.tell) text(e.shout || 'AND... SCENE!', e.x + T / 2, e.y + T - sh(e.big ? 'boss_tree' : 'tree_face') - 12, { align: 'center', color: '#fff6c2' });
      },
    },
    // Scenery platforms the stage tree moves on its beat.
    stage: {
      init(e) {
        e.w = (e.width ?? 2) * T;
        e.hx = e.x;
        e.hy = e.y;
        e.path = e.path || [[0, 0]];
        this.place(e);
        e.dx = 0;
        e.dy = 0;
        e.py = e.y;
      },
      place(e) {
        const beat = world.beat ?? 1.8;
        const n = e.path.length;
        const k = Math.floor(world.clock / beat) + (e.shift ?? 0);
        const into = (world.clock % beat) / beat;
        const a = e.path[((k % n) + n) % n];
        const b = e.path[(((k + 1) % n) + n) % n];
        // Hold most of the beat, then glide to the next mark.
        const m = Math.max(0, (into - 0.75) / 0.25);
        const ease = m * m * (3 - 2 * m);
        e.x = e.hx + (a[0] + (b[0] - a[0]) * ease) * T;
        e.y = e.hy + (a[1] + (b[1] - a[1]) * ease) * T;
      },
      update(e) {
        const ox = e.x;
        e.py = e.y;
        this.place(e);
        e.dx = e.x - ox;
        e.dy = e.y - e.py;
      },
      solid(e) {
        return { x: e.x, y: e.y, w: e.w, h: 10, oneWay: true };
      },
      draw(e) {
        const moving = e.dx || e.dy;
        for (let i = 0; i < e.w / T; i++) spr('log_plank', e.x + i * T, e.y - 2);
        // Stage ropes up to the sky.
        ctx.fillStyle = moving ? '#f4ecd2' : '#b6a98a';
        ctx.fillRect(Math.round(e.x + 3 - cam.x), 0, 1, Math.max(0, Math.round(e.y - cam.y)));
        ctx.fillRect(Math.round(e.x + e.w - 4 - cam.x), 0, 1, Math.max(0, Math.round(e.y - cam.y)));
      },
    },
    // Looks exactly like the exit. Is not the exit.
    fakeexit: {
      update(e) {
        const p = P();
        if (e.s === 'idle' && !p.dead && overlap(p, { x: e.x - 2, y: e.y - 20, w: T + 4, h: 44 })) {
          e.s = 'party';
          e.t = 0;
          world.fake = { t: 0 };
          sfx.win();
          burst(e.x + 12, e.y - 6, 20);
        } else if (e.s === 'party' && e.t > 1.6) {
          e.s = 'run';
          e.t = 0;
          sfx.trombone();
          for (const g of world.ents) if (g.type === 'gate') (g.s = 'open'), (g.t = 0);
        } else if (e.s === 'run') {
          e.x += 150 * DT;
          e.y -= Math.abs(Math.sin(e.t * 12)) * 2;
          if (e.t > 3) e.gone = true;
        }
        e.t += DT;
      },
      draw(e) {
        KINDS.exit.draw({ ...e, s: 'idle' });
        if (e.s === 'run' && e.t < 1.2) text('BYE!', e.x + 12, e.y - 34, { align: 'center', color: '#fff6c2' });
      },
    },
    gate: {
      solid(e) {
        return e.s === 'open' ? null : { x: e.x, y: e.y, w: T, h: T };
      },
      update(e) {
        e.t += DT;
        if (e.s === 'open' && e.t < DT * 1.5) dust(e.x + 12, e.y + 12, 3);
      },
      draw(e) {
        if (e.s === 'open') {
          if (e.t < 0.5) spr('tile_stone', e.x, e.y + e.t * e.t * 200, { alpha: 1 - e.t * 2, ox: 0, oy: 0 });
          return;
        }
        spr('tile_stone', e.x, e.y);
      },
    },
    // A stone block that drops out of the sky. Its shadow on the ground is the warning.
    skydrop: {
      init(e) {
        e.ground = e.y + T; // lands on the ground under its map cell
        e.by = -40;
        e.vy = 0;
      },
      update(e) {
        const p = P();
        const cx = p.x + p.w / 2;
        const mid = e.x + T / 2;
        const range = (e.range ?? 2.2) * T;
        if (e.s === 'idle' && Math.abs(cx - mid) < range && p.y + p.h > e.ground - 80 && p.y < e.ground) {
          e.s = 'warn';
          e.t = 0;
          // It aims at the spot you're standing on (if there's ground there to land on).
          const tx = Math.floor(cx / T);
          if (Math.abs(tx - e.tx) <= 2 && (solidTile(tx, e.ty + 1) || tileAt(tx, e.ty + 1) === '=') && !solidTile(tx, e.ty)) e.x = tx * T;
        } else if (e.s === 'warn' && e.t >= (e.warn ?? 0)) {
          e.s = 'fall';
          e.t = 0;
          e.by = Math.min(e.by, cam.y - 40, e.ground - 260); // same fall time wherever it lands
          e.vy = 420;
        } else if (e.s === 'fall') {
          e.vy += 1600 * DT;
          e.by += e.vy * DT;
          if (e.by + 22 >= e.ground) {
            e.by = e.ground - 22;
            e.s = 'down';
            sfx.thud();
            dust(mid, e.ground, 8);
            if (settings.shake) world.shake = 0.2;
          }
          hurtIf({ x: e.x + 2, y: e.by, w: 20, h: 22 }, 'crush');
        }
        e.t += DT;
      },
      solid(e) {
        return e.s === 'down' && e.stay !== false ? { x: e.x + 1, y: e.by, w: 22, h: 22 } : null;
      },
      draw(e) {
        const mid = e.x + T / 2;
        if (e.warn && (e.s === 'warn' || e.s === 'fall')) {
          // Shadow grows as the block gets closer (only on rocks that get a warning).
          const k = e.s === 'warn' ? Math.min(1, e.t / e.warn) * 0.6 : 0.6 + Math.min(0.4, (e.by - (e.ground - 200)) / 500);
          const w = Math.round(8 + 16 * k);
          ctx.fillStyle = `rgba(19, 32, 42, ${0.25 + 0.35 * k})`;
          ctx.fillRect(Math.round(mid - w / 2 - cam.x), Math.round(e.ground - 3 - cam.y), w, 3);
          if (e.s === 'warn') text('!', mid, e.ground - 40 - Math.round(Math.sin(e.t * 20) * 2), { align: 'center', color: '#d8433a', scale: 2 });
        }
        if (e.s === 'fall' || e.s === 'down') {
          if (e.stay === false && e.s === 'down') return;
          spr('crush_block', mid - 12, e.by - 2, { sx: 24 / 25, sy: 24 / 26, ox: 0, oy: 0 });
        }
      },
    },
    // Spikes on a little cart. They patrol, or (chase) wait until you pass and then follow.
    slider: {
      init(e) {
        e.hx = e.x;
        e.dir = e.dir ?? 1;
        e.py = e.y;
      },
      update(e) {
        const p = P();
        const dist = (e.dist ?? 4) * T;
        const speed = e.speed ?? (e.chase ? 120 : 95);
        let vx = 0;
        if (e.chase) {
          const cx = p.x + p.w / 2;
          if (e.s === 'idle' && Math.abs(cx - (e.x + T / 2)) < 3 * T && Math.abs(cx - (e.x + T / 2)) > T && Math.abs(p.y + p.h - (e.y + T)) < 30) {
            // Only starts once you're past it.
            if ((cx - (e.x + T / 2)) * e.dir > 0) (e.s = 'rev'), (e.t = 0), sfx.rattle();
          } else if (e.s === 'rev' && e.t > 0.2) e.s = 'go';
          else if (e.s === 'go') {
            vx = e.dir * speed;
            if (Math.abs(e.x + vx * DT - e.hx) >= dist) (vx = 0), (e.s = 'stop');
          }
        } else {
          // Ping-pong with a short stop at each end.
          if (e.s === 'idle') e.s = 'go';
          if (e.s === 'go') {
            vx = e.dir * speed;
            const nx = e.x + vx * DT;
            if (nx > e.hx + dist || nx < e.hx) (e.s = 'wait'), (e.t = 0), (vx = 0), (e.dir *= -1);
          } else if (e.s === 'wait' && e.t > 0.2) e.s = 'go';
        }
        e.dx = vx * DT;
        e.x += e.dx;
        e.t += DT;
        hurtIf({ x: e.x + 3, y: e.y + 9, w: 18, h: 15 }, 'spikes');
      },
      draw(e) {
        const jig = e.s === 'rev' ? Math.round(Math.sin(e.t * 50)) : 0;
        spr('spikes', e.x - 1 + jig, e.y + 4, { sx: 24 / 26, ox: 0, oy: 0 });
        // Wheels.
        ctx.fillStyle = '#13202a';
        ctx.fillRect(Math.round(e.x + 3 + jig - cam.x), Math.round(e.y + 20 - cam.y), 6, 4);
        ctx.fillRect(Math.round(e.x + 15 + jig - cam.x), Math.round(e.y + 20 - cam.y), 6, 4);
        ctx.fillStyle = '#6b7c88';
        ctx.fillRect(Math.round(e.x + 4 + jig - cam.x), Math.round(e.y + 21 - cam.y), 4, 2);
        ctx.fillRect(Math.round(e.x + 16 + jig - cam.x), Math.round(e.y + 21 - cam.y), 4, 2);
      },
    },
    // An ordinary tree. Walk up to it and it shoots up tall, then falls on you.
    growtree: {
      init(e) {
        e.ang = 0;
        e.grow = 1;
        e.fall = 1;
      },
      height(e) {
        return sh('tree_tall') * e.grow;
      },
      update(e) {
        const p = P();
        const base = e.x + T / 2;
        const cx = p.x + p.w / 2;
        if (e.s === 'idle' && Math.abs(cx - base) < (e.range ?? 3) * T && Math.abs(p.y + p.h - (e.y + T)) < 50) {
          e.s = 'rumble';
          e.t = 0;
          e.fall = cx < base ? -1 : 1;
        } else if (e.s === 'rumble' && e.t >= (e.rumble ?? 0)) {
          e.s = 'grow';
          e.t = 0;
          sfx.grow();
        } else if (e.s === 'grow') {
          e.grow = 1 + Math.min(1, e.t / 0.2) * ((e.tall ?? 1.9) - 1);
          if (e.t > 0.22) (e.s = 'falling'), (e.t = 0);
        } else if (e.s === 'falling') {
          e.ang = Math.min(Math.PI / 2, (e.t / 0.35) ** 2 * (Math.PI / 2));
          if (e.t > 0.18) hurtIf(this.zone(e), 'tree');
          if (e.ang >= Math.PI / 2) {
            e.s = 'down';
            sfx.thud();
            if (settings.shake) world.shake = 0.3;
            for (let i = 1; i < 6; i++) dust(base + e.fall * i * 22, e.y + T, 2);
          }
        }
        e.t += DT;
      },
      zone(e) {
        const base = e.x + T / 2;
        const len = this.height(e) - 6;
        return { x: e.fall < 0 ? base - len : base, y: e.y + T - 22, w: len, h: 22 };
      },
      solid(e) {
        if (e.s !== 'down') return null;
        const base = e.x + T / 2;
        const len = this.height(e) - 10;
        return { x: e.fall < 0 ? base - len : base + 4, y: e.y + T - 10, w: len - 4, h: 10 };
      },
      draw(e) {
        const base = e.x + T / 2;
        const bottom = e.y + T;
        const jig = e.s === 'rumble' ? Math.round(Math.sin(e.t * 60) * 1.5) : 0;
        if (e.s === 'rumble' && Math.random() < 0.3) world.fx.push({ k: 'leaf', x: base + (Math.random() - 0.5) * 40, y: bottom - 60, vx: (Math.random() - 0.5) * 30, vy: 10, t: 0, life: 0.9 });
        const [ax, ay, w, h] = ATLAS.tree_tall;
        ctx.save();
        ctx.translate(Math.round(base + jig - cam.x), Math.round(bottom - cam.y));
        ctx.rotate(e.ang * e.fall);
        ctx.scale(1, e.grow);
        ctx.drawImage(sheet, ax, ay, w, h, -Math.round(w / 2), -h, w, h);
        ctx.restore();
        if (e.rumble && (e.s === 'rumble' || e.s === 'grow')) text(e.s === 'grow' ? 'TIMBER!' : '?!', base, Math.max(cam.y + 14, bottom - this.height(e) - 10), { align: 'center', color: '#fff6c2', scale: e.s === 'grow' ? 2 : 1 });
      },
    },
    // Ground that looks real until you stand on it. No warning.
    fakeground: {
      update(e) {
        if (e.s === 'idle') {
          const g = world.ents.find((o) => o.id === P().ground);
          if (g && g.type === 'fakeground' && Math.abs(g.tx - e.tx) <= 2) {
            e.s = 'fall';
            e.t = 0;
            e.vy = 40 + (e.tx % 2) * 30;
            if (g === e) sfx.fold();
          }
        } else if (e.s === 'fall') {
          e.vy += GRAV * DT;
          e.y += e.vy * DT;
          if (e.y > world.rows * T + 40) e.gone = true;
        }
        e.t += DT;
      },
      solid(e) {
        return e.s === 'idle' ? { x: e.x, y: e.y, w: T, h: T } : null;
      },
      draw(e) {
        const top = !world.ents.some((o) => o.type === 'fakeground' && o.tx === e.tx && o.ty === e.ty - 1) && !solidTile(e.tx, e.ty - 1);
        const name = top ? 'tile_grass' : (e.tx + e.ty) % 2 ? 'tile_dirt' : 'tile_dirt2';
        spr(name, e.x, e.y, e.s === 'fall' ? { rot: e.t * (e.tx % 2 ? 2 : -2), ox: 0.5, oy: 0.5 } : undefined);
      },
    },
    // Spikes hiding in the grass. They jump out when you walk over them.
    popspike: {
      update(e) {
        const p = P();
        const feet = p.y + p.h;
        if (e.s === 'idle' && p.x + p.w > e.x + 2 && p.x < e.x + T - 2 && Math.abs(feet - (e.y + T)) < 3) {
          e.s = 'up';
          e.t = 0;
          sfx.pop();
        }
        if (e.s === 'up') hurtIf({ x: e.x + 3, y: e.y + 11, w: 18, h: 13 }, 'pop');
        e.t += DT;
      },
      draw(e) {
        if (e.s !== 'up') return;
        const k = Math.min(1, e.t / 0.06);
        spr('spikes', e.x - 1, e.y + 7 + (1 - k) * 17, { sx: 24 / 26, ox: 0, oy: 0 });
      },
    },
    // An invisible block. You only find it with your head.
    hidden: {
      update(e) {
        const p = P();
        if (e.s === 'idle' && p.vy < 0 && p.x + p.w > e.x && p.x < e.x + T && p.y >= e.y + T - 2 && p.y + p.vy * DT * 2 < e.y + T) {
          e.s = 'shown';
          e.t = 0;
          sfx.bonk();
          dust(e.x + T / 2, e.y + T, 3);
        }
        e.t += DT;
      },
      solid(e) {
        return e.s === 'shown' ? { x: e.x, y: e.y, w: T, h: T } : null;
      },
      draw(e) {
        if (e.s !== 'shown') return;
        const k = Math.max(0, 1 - e.t / 0.12);
        spr('tile_stone_top', e.x, e.y - Math.round(k * 4), { ox: 0, oy: 0, sx: 1.0001 });
        if (e.t < 0.6) text('?', e.x + T / 2, e.y + 6, { align: 'center', color: '#13202a' });
      },
    },
    // A log that comes rolling at you from up ahead.
    roller: {
      init(e) {
        e.vx = 0;
        e.vy = 0;
      },
      update(e) {
        const p = P();
        if (e.s === 'idle') {
          if (p.x + p.w / 2 > e.x - (e.range ?? 10) * T) {
            e.s = 'roll';
            e.t = 0;
            e.vx = -(e.speed ?? 170);
            e.y = e.y + T - 20;
            sfx.roll();
          }
          return;
        }
        e.t += DT;
        e.vy = Math.min(MAX_FALL, e.vy + GRAV * DT);
        const r = { x: e.x, y: e.y, w: 20, h: 20, vx: e.vx, vy: e.vy };
        moveX(r, e.vx * DT, []);
        moveY(r, e.vy * DT, []);
        if (r.vx === 0) e.gone = true;
        e.x = r.x;
        e.y = r.y;
        e.vy = r.vy;
        if (e.y > world.rows * T + 20 || e.x < cam.x - 60) e.gone = true;
        if (Math.floor(e.t * 6) !== Math.floor((e.t - DT) * 6) && onScreen(e)) sfx.roll();
        if (!e.gone) hurtIf({ x: e.x + 2, y: e.y + 3, w: 16, h: 17 }, 'roll');
        if (e.gone) dust(e.x + 10, e.y + 20, 4);
      },
      draw(e) {
        if (e.s === 'idle') return;
        const cx = Math.round(e.x + 10 - cam.x);
        const cy = Math.round(e.y + 10 - cam.y);
        const a = (e.x / 10) % (Math.PI * 2);
        ctx.fillStyle = '#13202a';
        ctx.beginPath();
        ctx.arc(cx, cy, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a8692f';
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0b070';
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
        // Tree rings spin as it rolls.
        ctx.strokeStyle = '#7a4a24';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, a, a + 4);
        ctx.stroke();
        ctx.fillRect(cx + Math.round(Math.cos(a) * 7) - 1, cy + Math.round(Math.sin(a) * 7) - 1, 2, 2);
      },
    },
    // Background scenery that some levels want in a specific spot.
    decor: {
      draw(e) {
        stand(e.sprite, e.x + T / 2 + (e.ox ?? 0), e.y + T, { flip: e.flip });
      },
    },
  };
  for (const k of ['spawn']) KINDS[k] = {};

  /** Wooden post under a sign. */
  function post(cx, bottom) {
    const x = Math.round(cx - 2 - cam.x);
    const y = Math.round(bottom - 16 - cam.y);
    ctx.fillStyle = '#13202a';
    ctx.fillRect(x - 1, y, 6, 16);
    ctx.fillStyle = '#7a4a24';
    ctx.fillRect(x, y, 4, 16);
    ctx.fillStyle = '#a8692f';
    ctx.fillRect(x, y, 1, 16);
  }

  function onScreen(e, margin = 60) {
    return e.x > cam.x - margin && e.x < cam.x + W + margin && e.y > cam.y - margin && e.y < cam.y + H + margin;
  }

  // -------------------------------------------------------------- effects --
  function dust(x, y, n) {
    for (let i = 0; i < n; i++) world.fx.push({ k: 'dust', x: x + (Math.random() - 0.5) * 10, y: y - 2, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 25, t: 0, life: 0.35 });
  }
  function burst(x, y, n) {
    const colors = ['#f7c948', '#d8433a', '#8cc63e', '#9fd8ff', '#f4ecd2'];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      world.fx.push({ k: 'confetti', x, y, vx: Math.cos(a) * (60 + Math.random() * 60), vy: Math.sin(a) * 80 - 60, t: 0, life: 1, c: colors[i % colors.length] });
    }
  }
  function stepFx() {
    for (const f of world.fx) {
      f.t += DT;
      f.x += f.vx * DT;
      f.y += f.vy * DT;
      if (f.k === 'confetti') f.vy += 200 * DT;
      if (f.k === 'leaf') f.vy += 40 * DT;
    }
    world.fx = world.fx.filter((f) => f.t < f.life);
  }
  function drawFx() {
    for (const f of world.fx) {
      const x = Math.round(f.x - cam.x);
      const y = Math.round(f.y - cam.y);
      const k = f.t / f.life;
      if (f.k === 'dust') {
        ctx.fillStyle = `rgba(230, 220, 200, ${1 - k})`;
        ctx.fillRect(x, y, 2, 2);
      } else if (f.k === 'confetti') {
        ctx.fillStyle = f.c;
        ctx.fillRect(x, y, 2, 2);
      } else if (f.k === 'puff') {
        spr('fx_dust', f.x - 12, f.y - 8, { sx: 0.45 + k * 0.3, sy: 0.45 + k * 0.3, alpha: 0.8 * (1 - k), oy: 0.5 });
      } else if (f.k === 'leaf') {
        ctx.fillStyle = '#8cc63e';
        ctx.fillRect(x, y, 2, 1);
        ctx.fillStyle = '#5a8f2b';
        ctx.fillRect(x + 1, y + 1, 1, 1);
      }
    }
  }

  // -------------------------------------------------------------- terrain --
  // Seeded random so scenery is the same every visit.
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  const CHAPTER = [
    { sky: ['#4aa3d8', '#67c1e2'], skip: 2, tint: null, song: 'ch0', far: '#2f6b5b' },
    { sky: ['#f6a35b', '#fde3b0'], skip: 62, tint: 'rgba(255, 170, 80, 0.16)', song: 'ch1', far: '#5b5a3a' },
    { sky: ['#3b2f68', '#e88a74'], skip: 62, tint: 'rgba(60, 40, 110, 0.28)', song: 'ch2', far: '#2b2d4a' },
  ];

  function bakeTerrain(L) {
    const c = document.createElement('canvas');
    c.width = world.cols * T;
    c.height = world.rows * T;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const rand = rng(world.index * 977 + 13);
    const put = (name, x, y, w, h) => {
      const r = ATLAS[name];
      g.drawImage(sheet, r[0], r[1], r[2], r[3], x, y, w ?? r[2], h ?? r[3]);
    };
    const putRot = (name, x, y, rot) => {
      const r = ATLAS[name];
      g.save();
      g.translate(x + T / 2, y + T / 2);
      g.rotate(rot);
      g.drawImage(sheet, r[0], r[1], r[2], r[3], -T / 2, -T / 2 + (T - 17), T, 17);
      g.restore();
    };
    const decoTop = [];
    for (let y = 0; y < world.rows; y++)
      for (let x = 0; x < world.cols; x++) {
        const ch = world.map[y][x];
        const px = x * T;
        const py = y * T;
        const above = tileAt(x, y - 1);
        const open = !SOLID.includes(above);
        if (ch === '#') {
          if (open) {
            put('tile_grass', px, py);
            decoTop.push([px, py]);
          } else put(rand() < 0.5 ? 'tile_dirt' : 'tile_dirt2', px, py);
        } else if (ch === 'S') {
          put(open ? 'tile_stone_top' : 'tile_stone', px, py);
          if (open) decoTop.push([px, py]);
        } else if (ch === '=') {
          put('log_plank', px, py - 2);
        } else if (ch === '^') putRot('spikes', px, py, 0);
        else if (ch === 'v') putRot('spikes', px, py, Math.PI);
        else if (ch === '<') putRot('spikes', px, py, -Math.PI / 2);
        else if (ch === '>') putRot('spikes', px, py, Math.PI / 2);
      }
    // Grass tufts, flowers and little mushrooms on open ground.
    const bits = ['grass1', 'grass2', 'grass3', 'tuft', 'flower', 'shroom_tiny', 'plant'];
    for (const [px, py] of decoTop) {
      if (rand() < 0.42) {
        const name = bits[Math.floor(rand() * (rand() < 0.7 ? 4 : bits.length))];
        const r = ATLAS[name];
        put(name, px + Math.floor(rand() * (T - r[2] / 2)) - r[2] / 4, py - r[3] + 3);
      }
    }
    // Midground trees behind the terrain, drawn into their own layer.
    const mid = document.createElement('canvas');
    mid.width = Math.ceil((world.cols * T) / 2 + W);
    mid.height = H;
    const m = mid.getContext('2d');
    m.imageSmoothingEnabled = false;
    const trees = ['tree_round', 'tree_pine', 'tree_tall', 'pine_small', 'tree_round'];
    for (let x = -20; x < mid.width; x += 40 + Math.floor(rand() * 60)) {
      const name = trees[Math.floor(rand() * trees.length)];
      const r = ATLAS[name];
      m.drawImage(sheet, r[0], r[1], r[2], r[3], x, H - 34 - r[3] + Math.floor(rand() * 10), r[2], r[3]);
    }
    // Shade the midground so it reads as further away.
    m.globalCompositeOperation = 'source-atop';
    m.fillStyle = 'rgba(30, 60, 70, 0.45)';
    m.fillRect(0, 0, mid.width, mid.height);
    bake = { terrain: c, mid, chapter: CHAPTER[L.chapter] };
  }

  function drawBackground(chapter) {
    const ch = chapter || CHAPTER[0];
    const r = ATLAS.bg_forest;
    const bw = r[2];
    const by = H - r[3] - 12;
    // The day sky comes with the picture; sunset and dusk swap in their own sky above the hills.
    const skip = ch.skip;
    const g = ctx.createLinearGradient(0, 0, 0, by + skip + 4);
    g.addColorStop(0, ch.sky[0]);
    g.addColorStop(1, ch.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Far forest: the sheet's wide background, mirrored every other copy so it tiles.
    const scroll = -((cam.x * 0.2) % (bw * 2));
    for (let i = -1; i < W / bw + 2; i++) {
      const x = Math.round(scroll + i * bw);
      const flip = ((i % 2) + 2) % 2 === 1;
      ctx.save();
      ctx.translate(flip ? x + bw : x, by);
      ctx.scale(flip ? -1 : 1, 1);
      ctx.drawImage(sheet, r[0], r[1] + skip, bw, r[3] - skip, 0, skip, bw, r[3] - skip);
      ctx.restore();
    }
    ctx.fillStyle = ch.far;
    ctx.fillRect(0, by + r[3] - 1, W, H);
    if (ch.tint) {
      ctx.fillStyle = ch.tint;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function snapCamera() {
    const p = world.player;
    cam.look = 0;
    cam.x = clampCamX(p.x + p.w / 2 - W / 2);
    cam.y = clampCamY(p.y - H * 0.55);
  }
  const clampCamX = (x) => Math.max(0, Math.min(world.cols * T - W, x));
  // Levels are 12 rows, a little taller than the screen: keep the bottom (where the
  // spikes are) in view and let the sky lose its top 18px.
  const clampCamY = () => world.rows * T - H;
  function stepCamera() {
    const p = world.player;
    if (p.dead) return;
    cam.look += ((p.face * 34) - cam.look) * 0.04;
    const tx = clampCamX(p.x + p.w / 2 - W / 2 + cam.look);
    const ty = clampCamY(p.y - H * 0.55);
    cam.x += (tx - cam.x) * 0.15;
    cam.y += (ty - cam.y) * 0.1;
  }

  // ----------------------------------------------------------------- draw --
  function drawPlayer() {
    const p = world.player;
    let name = 'pip_idle';
    if (p.dead) name = 'pip_hurt';
    else if (p.won) name = Math.floor(p.won * 6) % 2 ? 'pip_jump' : 'pip_idle';
    else if (p.ground === null) name = p.vy < 0 ? 'pip_jump' : 'pip_fall';
    else if (Math.abs(p.vx) > 15) name = ['pip_walk', 'pip_run', 'pip_run2', 'pip_stride'][Math.floor(p.anim * 10) % 4];
    else name = Math.floor(p.anim * 1.6) % 2 ? 'pip_idle2' : 'pip_idle';
    const cx = p.x + p.w / 2;
    const bottom = p.y + p.h + 1;
    const squash = p.land > 0 ? 0.88 : 1;
    // The sheet's Pip faces right; flip for left.
    spr(name, cx - sw(name) / 2, bottom - sh(name), { flip: p.face < 0, sy: squash, sx: 2 - squash, rot: p.dead ? p.dead * 6 : 0, oy: p.dead ? 0.5 : 1 });
  }

  function drawWorld() {
    const shake = world.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
    const sx = cam.x;
    cam.x += shake;
    drawBackground(bake.chapter);
    ctx.drawImage(bake.mid, Math.round(-cam.x * 0.5), Math.round(H - bake.mid.height - cam.y * 0.2 + (world.rows * T - H) * 0.2));
    // Water and anything animated sits behind the terrain bake.
    const x0 = Math.max(0, Math.floor(cam.x / T));
    const x1 = Math.min(world.cols - 1, Math.floor((cam.x + W) / T));
    const wr = ATLAS.tile_water;
    for (let y = 0; y < world.rows; y++)
      for (let x = x0; x <= x1; x++) {
        if (world.map[y][x] !== '~') continue;
        const top = tileAt(x, y - 1) !== '~';
        const px = Math.round(x * T - cam.x);
        const py = Math.round(y * T - cam.y);
        const wave = top ? Math.round(Math.sin(world.clock * 3 + x) * 1.5) + 6 : 0;
        ctx.drawImage(sheet, wr[0], wr[1], T, T - wave, px, py + wave, T, T - wave);
      }
    ctx.drawImage(bake.terrain, Math.round(-cam.x), Math.round(-cam.y));
    off.x = cam.x;
    off.y = cam.y;
    for (const e of world.ents) if (e.type !== 'acorn' && onScreen(e, 160)) KINDS[e.type].draw?.(e);
    drawPlayer();
    for (const e of world.ents) if (e.type === 'acorn') KINDS.acorn.draw(e);
    drawFx();
    off.x = off.y = 0;
    cam.x = sx;
  }

  function fmtTime(s) {
    const m = Math.floor(s / 60);
    const r = s - m * 60;
    return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
  }

  function drawHud() {
    const L = LEVELS[world.index];
    ctx.fillStyle = 'rgba(19, 32, 42, 0.55)';
    ctx.fillRect(0, 0, 214, 22);
    text(`${L.id} ${L.name}`, 5, 4, { color: '#fff6c2' });
    text(`DEATHS ${world.deaths}  TOTAL ${progress.totalDeaths}  TIME ${fmtTime(world.time)}`, 5, 13, { color: '#cfe8d0' });
    if (world.banner > 0 && world.banner < 3) {
      const a = Math.min(1, world.banner, 3 - world.banner);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(19, 32, 42, 0.7)';
      ctx.fillRect(0, 70, W, 40);
      text(L.name, W / 2, 76, { align: 'center', scale: 2, color: '#fff6c2' });
      text(L.tagline || '', W / 2, 96, { align: 'center', color: '#cfe8d0' });
      ctx.globalAlpha = 1;
    }
    if (world.quip && world.quip.t > 0) {
      const p = world.player;
      text(world.quip.text, Math.max(60, Math.min(W - 60, p.x + 6 - cam.x)), Math.max(28, p.y - 40 - cam.y), { align: 'center', color: '#fff6c2' });
    }
    if (world.fake) {
      const t = world.fake.t;
      ctx.fillStyle = 'rgba(19, 32, 42, 0.72)';
      ctx.fillRect(W / 2 - 110, 60, 220, 60);
      if (t < 1.6) {
        text('LEVEL COMPLETE!', W / 2, 70, { align: 'center', scale: 2, color: '#f7c948' });
        text('YOU ARE AMAZING. NO NOTES.', W / 2, 95, { align: 'center' });
      } else {
        text('...JUST KIDDING', W / 2, 70, { align: 'center', scale: 2, color: '#d8433a' });
        text('THE REAL MAILBOX IS FURTHER ON', W / 2, 95, { align: 'center' });
      }
    }
  }

  // ---------------------------------------------------------------- menus --
  let state = 'loading';
  let menu = []; // [{label, x, y, w, h, act, small}]
  let focus = 0;
  let pausedFrom = null;
  let result = null; // last completed level stats
  let endT = 0;
  let creditsFrom = 'title';
  let errorText = '';

  function woodButton(x, y, w, h, label, active, { disabled = false, small = false } = {}) {
    const r = ATLAS.wood_button;
    const cap = 12;
    const dy = active ? -1 : 0;
    ctx.globalAlpha = disabled ? 0.5 : 1;
    // Three-slice: caps stay, the middle stretches.
    ctx.drawImage(sheet, r[0], r[1], cap, r[3], x, y + dy, cap, h);
    ctx.drawImage(sheet, r[0] + cap, r[1], r[2] - cap * 2, r[3], x + cap, y + dy, w - cap * 2, h);
    ctx.drawImage(sheet, r[0] + r[2] - cap, r[1], cap, r[3], x + w - cap, y + dy, cap, h);
    if (active) {
      ctx.strokeStyle = '#f7c948';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 1, y - 1 + dy, w + 2, h + 2);
    }
    text(label, x + w / 2, y + Math.round(h / 2) - (small ? 2 : 5) + dy, { align: 'center', scale: small ? 1 : 2, color: '#fff6c2', outline: '#3b2412' });
    ctx.globalAlpha = 1;
  }

  function column(items, top, w = 170, h = 24, gap = 6) {
    return items.map((it, i) => ({ ...it, x: Math.round(W / 2 - w / 2), y: top + i * (h + gap), w, h }));
  }

  function buildMenu() {
    const onOff = (v) => (v ? 'ON' : 'OFF');
    if (state === 'title') {
      menu = column(
        [
          { label: progress.unlocked > 1 ? 'CONTINUE' : 'PLAY', act: () => startLevel(Math.min(progress.unlocked, LEVELS.length) - 1) },
          { label: 'LEVELS', act: () => setState('levels') },
          { label: 'SETTINGS', act: () => setState('settings') },
          { label: 'CREDITS', act: () => ((creditsFrom = 'title'), setState('credits')) },
        ],
        122,
      );
    } else if (state === 'levels') {
      const cw = 104;
      const chh = 44;
      menu = LEVELS.map((L, i) => ({
        level: i,
        label: L.id,
        x: 24 + (i % 4) * (cw + 8),
        y: 44 + Math.floor(i / 4) * (chh + 8),
        w: cw,
        h: chh,
        disabled: i >= progress.unlocked,
        act: () => i < progress.unlocked && startLevel(i),
      }));
      menu.push({ label: 'BACK', x: W / 2 - 60, y: 206 + 30, w: 120, h: 22, act: () => setState('title'), back: true });
    } else if (state === 'settings') {
      const back = pausedFrom ? () => setState('paused') : () => setState('title');
      menu = column(
        [
          { label: 'SOUND: ' + onOff(settings.sound), act: () => toggleSound() },
          { label: 'MUSIC: ' + onOff(settings.music), act: () => ((settings.music = !settings.music), saveSettings()) },
          { label: 'SCREEN SHAKE: ' + onOff(settings.shake), act: () => ((settings.shake = !settings.shake), saveSettings()) },
          {
            label: 'TOUCH PAD: ' + settings.touch.toUpperCase(),
            act: () => {
              settings.touch = { auto: 'on', on: 'off', off: 'auto' }[settings.touch];
              saveSettings();
              updateChrome();
            },
          },
          { label: 'BACK', act: back, back: true },
        ],
        70,
        230,
        24,
        8,
      );
    } else if (state === 'credits') {
      menu = [{ label: 'BACK', x: W / 2 - 60, y: H - 34, w: 120, h: 22, act: () => setState(creditsFrom), back: true }];
    } else if (state === 'paused') {
      menu = column(
        [
          { label: 'RESUME', act: () => resume() },
          { label: 'RESTART LEVEL', act: () => (resume(), restartLevel()) },
          { label: 'SOUND: ' + onOff(settings.sound), act: () => toggleSound() },
          { label: 'SETTINGS', act: () => setState('settings') },
          { label: 'BACK TO LEVELS', act: () => ((pausedFrom = null), setState('levels')), back: true },
        ],
        68,
        210,
        24,
        7,
      );
    } else if (state === 'complete') {
      const last = world.index >= LEVELS.length - 1;
      menu = [
        { label: 'RETRY', x: 70, y: 196, w: 100, h: 26, act: () => startLevel(world.index) },
        { label: last ? 'THE END' : 'NEXT LEVEL', x: 180, y: 196, w: 120, h: 26, act: () => (last ? ((endT = 0), setState('ending')) : startLevel(world.index + 1)), primary: true },
        { label: 'LEVELS', x: 310, y: 196, w: 100, h: 26, act: () => setState('levels'), back: true },
      ];
    } else if (state === 'ending') {
      menu =
        endT > 9
          ? [
              { label: 'TITLE', x: W / 2 - 130, y: H - 34, w: 120, h: 22, act: () => setState('title'), back: true },
              { label: 'LEVELS', x: W / 2 + 10, y: H - 34, w: 120, h: 22, act: () => setState('levels') },
            ]
          : [];
    } else menu = [];
    focus = Math.max(0, Math.min(focus, menu.length - 1));
  }

  function setState(s) {
    if (s === 'levels') {
      focus = 0;
      state = s;
      buildMenu();
      focus = Math.max(0, Math.min(progress.unlocked - 1, LEVELS.length - 1, world ? world.index : 0));
    } else {
      state = s;
      focus = 0;
      buildMenu();
      const primary = menu.findIndex((m) => m.primary);
      if (primary >= 0) focus = primary;
    }
    clearInput();
    updateChrome();
  }

  function startLevel(i) {
    loadLevel(i);
    pausedFrom = null;
    state = 'play';
    menu = [];
    clearInput();
    updateChrome();
    canvas.focus({ preventScroll: true });
  }

  function pause() {
    if (state !== 'play') return;
    pausedFrom = 'play';
    setState('paused');
  }
  function resume() {
    pausedFrom = null;
    state = 'play';
    menu = [];
    clearInput();
    updateChrome();
  }
  function toggleSound() {
    settings.sound = !settings.sound;
    saveSettings();
    if (settings.sound) unlockAudio();
    updateChrome();
  }

  function completeLevel() {
    const L = LEVELS[world.index];
    const secs = world.time;
    const sc = score(secs, world.deaths);
    const prev = progress.best[L.id];
    const best = {
      time: prev ? Math.min(prev.time, secs) : secs,
      deaths: prev ? Math.min(prev.deaths, world.deaths) : world.deaths,
      score: prev ? Math.max(prev.score, sc) : sc,
    };
    result = { secs, deaths: world.deaths, score: sc, newBest: !prev || sc > prev.score, best };
    progress.best[L.id] = best;
    progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, world.index + 2));
    saveProgress();
    LeaderboardService.submit({ gameId: 'forest-liar', levelId: L.id, durationMs: Math.round(secs * 1000), deathCount: world.deaths, score: sc, buildVersion: VERSION }).catch(() => {});
    setState('complete');
  }

  function onKey(code) {
    if (state === 'play') {
      if (code === 'Escape' || code === 'KeyP') pause();
      else if (code === 'KeyR') restartLevel();
      else if (code === 'KeyM') toggleSound();
      return;
    }
    if (code === 'KeyM') return toggleSound();
    if (state === 'loading' || !menu.length) {
      if (state === 'ending' && (code === 'Enter' || code === 'Space' || code === 'Escape')) endT = Math.max(endT, 9);
      return;
    }
    if (code === 'ArrowDown' || code === 'KeyS' || code === 'ArrowRight' || code === 'KeyD' || code === 'ArrowUp' || code === 'KeyW' || code === 'ArrowLeft' || code === 'KeyA') {
      const dir = { ArrowDown: [0, 1], KeyS: [0, 1], ArrowUp: [0, -1], KeyW: [0, -1], ArrowRight: [1, 0], KeyD: [1, 0], ArrowLeft: [-1, 0], KeyA: [-1, 0] }[code];
      focus = nextFocus(focus, dir);
      sfx.move();
    } else if (code === 'Enter' || code === 'Space' || code === 'KeyZ') {
      activate(menu[focus]);
    } else if (code === 'Escape' || code === 'Backspace') {
      if (state === 'paused' && code === 'Escape') return resume();
      const back = menu.find((m) => m.back);
      if (back) activate(back);
    } else if (code === 'KeyP' && state === 'paused') resume();
    else if (code === 'KeyR' && state === 'paused') (resume(), restartLevel());
  }

  // Move focus to the nearest item in a direction (works for lists and the level grid).
  function nextFocus(i, [dx, dy]) {
    const a = menu[i];
    const ax = a.x + a.w / 2;
    const ay = a.y + a.h / 2;
    let best = -1;
    let bestD = Infinity;
    menu.forEach((m, j) => {
      if (j === i) return;
      const mx = m.x + m.w / 2 - ax;
      const my = m.y + m.h / 2 - ay;
      const along = mx * dx + my * dy;
      if (along <= 2) return;
      const d = along + Math.abs(mx * dy + my * dx) * 2.5;
      if (d < bestD) (bestD = d), (best = j);
    });
    if (best >= 0) return best;
    // Lists wrap around.
    if (dy) return (i + dy + menu.length) % menu.length;
    return i;
  }

  function activate(item) {
    if (!item || item.disabled) return;
    unlockAudio();
    sfx.click();
    item.act();
    if (state !== 'play') buildMenu();
  }

  canvas.addEventListener('pointerdown', (e) => {
    unlockAudio();
    markTouch(e);
    canvas.focus({ preventScroll: true });
    if (state === 'play' || !menu.length) {
      if (state === 'ending') endT = Math.max(endT, 9);
      return;
    }
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const i = menu.findIndex((m) => x >= m.x - 3 && x <= m.x + m.w + 3 && y >= m.y - 3 && y <= m.y + m.h + 3);
    if (i >= 0) {
      focus = i;
      activate(menu[i]);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || state === 'play') return;
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const i = menu.findIndex((m) => x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h);
    if (i >= 0) focus = i;
  });

  // HUD buttons (DOM, so they're easy to hit on phones).
  function hudButton(id, fn) {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      unlockAudio();
      markTouch(e);
      el.classList.add('down');
    });
    const off = () => el.classList.remove('down');
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('click', (e) => {
      e.preventDefault();
      fn();
      canvas.focus({ preventScroll: true });
    });
  }
  hudButton('b-pause', () => (state === 'play' ? pause() : state === 'paused' ? resume() : null));
  hudButton('b-restart', () => {
    if (state === 'paused') resume();
    if (state === 'play') restartLevel();
  });
  hudButton('b-sound', toggleSound);
  const canFull = !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  hudButton('b-full', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  });
  $('b-full').hidden = !canFull;
  let rotateDismissed = false;
  rotateEl.querySelector('button').addEventListener('click', () => {
    rotateDismissed = true;
    updateChrome();
  });

  /** Show or hide the DOM controls for the current state and screen. */
  function updateChrome() {
    const playing = state === 'play' || state === 'paused';
    hudEl.hidden = !playing && state !== 'complete';
    $('b-restart').hidden = !playing;
    $('b-pause').hidden = !playing;
    $('b-pause').querySelector('img').src = state === 'paused' ? 'assets/ui/icon_play.png' : 'assets/ui/icon_pause.png';
    $('b-pause').setAttribute('aria-label', state === 'paused' ? 'Resume' : 'Pause');
    $('b-sound').querySelector('img').src = settings.sound ? 'assets/ui/icon_music.png' : 'assets/ui/icon_mute.png';
    padEl.hidden = !(state === 'play' && touchVisible());
    const portrait = innerHeight > innerWidth;
    rotateEl.hidden = !(portrait && (coarse || usedTouch) && !rotateDismissed && (state === 'play' || state === 'title'));
  }

  // ------------------------------------------------------------- screens --
  function drawTitle() {
    cam.x = (performance.now() / 40) % 4000;
    cam.y = 0;
    drawBackground(CHAPTER[0]);
    // Ground strip with Pip, a bush and a suspicious sign.
    const gr = ATLAS.tile_grass;
    for (let x = 0; x < W; x += T) ctx.drawImage(sheet, gr[0], gr[1], T, T, x, H - T, T, T);
    const t = performance.now() / 1000;
    stand(Math.floor(t * 1.6) % 2 ? 'pip_idle2' : 'pip_idle', 90, H - T + 1);
    stand('bush', 380, H - T, { sx: 1 + Math.max(0, Math.sin(t * 1.3)) * 0.12, sy: 1 + Math.max(0, Math.sin(t * 1.3)) * 0.2 });
    stand('sign', 160, H - T);
    stand('shroom_bonus', 320, H - T);
    // Logo, straight from the asset sheet.
    const wob = Math.round(Math.sin(t * 2) * 2);
    spr('logo', W / 2 - sw('logo') / 2, 10 + wob);
    text('NOTHING HERE IS SAFE.', W / 2, 74, { align: 'center', scale: 2, color: '#fff6c2' });
    text('AN INDIE/24 GAME', W / 2, 94, { align: 'center', color: '#13202a', outline: '#d7f1f9' });
    text(`V${VERSION}`, W - 4, H - 10, { align: 'right', color: '#fff6c2' });
    if (progress.totalDeaths) text(`TOTAL DEATHS ${progress.totalDeaths}`, 4, H - 10, { color: '#fff6c2' });
  }

  function drawPanel(x, y, w, h) {
    ctx.fillStyle = 'rgba(19, 32, 42, 0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#4c6170';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  function drawMenuItems() {
    menu.forEach((m, i) => {
      if (m.level != null) return drawLevelCard(m, i === focus);
      woodButton(m.x, m.y, m.w, m.h, m.label, i === focus, { disabled: m.disabled, small: m.h < 24 });
    });
  }

  function drawLevelCard(m, active) {
    const L = LEVELS[m.level];
    const best = progress.best[L.id];
    drawPanel(m.x, m.y, m.w, m.h);
    if (active) {
      ctx.strokeStyle = '#f7c948';
      ctx.lineWidth = 2;
      ctx.strokeRect(m.x - 1, m.y - 1, m.w + 2, m.h + 2);
    }
    ctx.globalAlpha = m.disabled ? 0.45 : 1;
    text(L.id, m.x + 6, m.y + 6, { color: CHAPTER_COLORS[L.chapter], scale: 2 });
    const lines = wrap(L.name, 24);
    lines.slice(0, 2).forEach((l, j) => text(l, m.x + 6, m.y + 21 + j * 7, { color: '#f4ecd2' }));
    if (m.disabled) spr('key', m.x + m.w - 22, m.y + 4);
    else if (best) {
      text(fmtTime(best.time), m.x + m.w - 5, m.y + 6, { align: 'right', color: '#cfe8d0' });
      text(`${best.deaths} DEATHS`, m.x + m.w - 5, m.y + 13, { align: 'right', color: '#cfe8d0' });
      spr('star', m.x + m.w - 18, m.y + m.h - 18);
    }
    ctx.globalAlpha = 1;
  }
  const CHAPTER_COLORS = ['#8cc63e', '#f39a3d', '#c99cf2'];

  function drawLevels() {
    drawBackground(CHAPTER[0]);
    ctx.fillStyle = 'rgba(19, 32, 42, 0.35)';
    ctx.fillRect(0, 0, W, H);
    text('CHOOSE A LEVEL', W / 2, 12, { align: 'center', scale: 2, color: '#fff6c2' });
    text('1 FRIENDLY FOREST   2 TRICKSTER GROVE   3 THE LAST JOKE', W / 2, 30, { align: 'center', color: '#cfe8d0' });
    drawMenuItems();
  }

  function drawSettings() {
    if (pausedFrom) drawWorld();
    else drawBackground(CHAPTER[0]);
    drawPanel(110, 30, 260, 210);
    text('SETTINGS', W / 2, 44, { align: 'center', scale: 2, color: '#fff6c2' });
    drawMenuItems();
    text('TOUCH PAD AUTO SHOWS IT ON TOUCH SCREENS', W / 2, 228, { align: 'center', color: '#cfe8d0' });
  }

  function drawCredits() {
    drawBackground(CHAPTER[2]);
    drawPanel(60, 16, 360, 210);
    const lines = [
      ['FOREST LIAR', '#f7c948', 2],
      ['NOTHING HERE IS SAFE.', '#fff6c2', 1],
      ['', '', 1],
      ['GAME DESIGN AND CODE: INDIE/24', '#f4ecd2', 1],
      ['PIXEL ART: THE FOREST LIAR ASSET PACK', '#f4ecd2', 1],
      ['(CUT AND ANIMATED FOR THE GAME)', '#cfe8d0', 1],
      ['MUSIC AND SOUND: CHIPTUNE MADE LIVE', '#f4ecd2', 1],
      ['IN YOUR BROWSER, NO AUDIO FILES', '#cfe8d0', 1],
      ['', '', 1],
      ['NO TREES WERE HARMED. SOME WERE', '#f4ecd2', 1],
      ['EMBARRASSED.', '#f4ecd2', 1],
      ['', '', 1],
      [`TOTAL DEATHS SO FAR: ${progress.totalDeaths}`, '#f39a3d', 1],
    ];
    let y = 28;
    for (const [s, c, k] of lines) {
      if (s) text(s, W / 2, y, { align: 'center', color: c, scale: k });
      y += k === 2 ? 18 : 11;
    }
    drawMenuItems();
  }

  function drawComplete() {
    drawWorld();
    drawPanel(60, 34, 360, 200);
    const L = LEVELS[world.index];
    text('DELIVERED!', W / 2, 46, { align: 'center', scale: 3, color: '#f7c948' });
    text(L.name, W / 2, 74, { align: 'center', color: '#fff6c2' });
    const row = (label, value, y) => {
      text(label, 150, y, { color: '#cfe8d0', scale: 2 });
      text(value, 330, y, { align: 'right', color: '#fff6c2', scale: 2 });
    };
    row('TIME', fmtTime(result.secs), 92);
    row('DEATHS', String(result.deaths), 112);
    row('SCORE', String(result.score), 132);
    text(result.newBest ? 'NEW BEST!' : `BEST ${result.best.score}  ${fmtTime(result.best.time)}  ${result.best.deaths} DEATHS`, W / 2, 158, { align: 'center', color: result.newBest ? '#f7c948' : '#cfe8d0' });
    text(L.outro || '', W / 2, 174, { align: 'center', color: '#f4ecd2' });
    drawMenuItems();
  }

  function drawEnding() {
    endT += 1 / 60;
    drawBackground(CHAPTER[2]);
    const gr = ATLAS.tile_grass;
    for (let x = 0; x < W; x += T) ctx.drawImage(sheet, gr[0], gr[1], T, T, x, H - T, T, T);
    stand('boss_tree', 340, H - T);
    const px = Math.min(260, 40 + endT * 60);
    stand(endT < 3.6 ? ['pip_walk', 'pip_run', 'pip_run2', 'pip_stride'][Math.floor(endT * 10) % 4] : 'pip_idle', px, H - T + 1);
    if (endT > 3.6 && endT < 5) spr('letter', 270 + (endT - 3.6) * 30, H - T - 30 - Math.sin((endT - 3.6) * 2.2) * 20);
    const say = [
      [4.5, 'THE OLD OAK OPENS THE LETTER...'],
      [6, '"DEAR FOREST, PLEASE STOP LYING. LOVE, PIP"'],
      [7.5, 'THE OAK LAUGHS SO HARD IT DROPS ALL ITS ACORNS.'],
    ];
    let y = 26;
    for (const [at, s] of say) {
      if (endT > at) text(s, W / 2, y, { align: 'center', color: '#fff6c2' });
      y += 12;
    }
    if (endT > 9) {
      drawPanel(110, 70, 260, 110);
      text('THE END', W / 2, 80, { align: 'center', scale: 3, color: '#f7c948' });
      text('THANKS FOR PLAYING FOREST LIAR', W / 2, 108, { align: 'center' });
      text(`TOTAL DEATHS: ${progress.totalDeaths}`, W / 2, 122, { align: 'center', color: '#f39a3d' });
      text('A GAME BY INDIE/24', W / 2, 136, { align: 'center', color: '#cfe8d0' });
      text('MADE WITH THE FOREST LIAR PIXEL ART PACK', W / 2, 150, { align: 'center', color: '#cfe8d0' });
      if (!menu.length) buildMenu();
    }
    drawMenuItems();
  }

  function drawPaused() {
    drawWorld();
    drawHud();
    drawPanel(120, 34, 240, 200);
    text('PAUSED', W / 2, 46, { align: 'center', scale: 2, color: '#fff6c2' });
    drawMenuItems();
  }

  // ----------------------------------------------------------------- loop --
  function step() {
    readInput();
    if (state !== 'play') return;
    world.clock += DT;
    if (!world.player.won) world.time += DT;
    world.banner = Math.max(0, world.banner - DT);
    world.shake = Math.max(0, world.shake - DT);
    if (world.quip) world.quip.t -= DT;
    if (world.fake) world.fake.t += DT;
    for (const e of world.ents) {
      e.py = e.y;
      KINDS[e.type].update?.(e, DT);
    }
    world.ents = world.ents.filter((e) => !e.gone);
    stepPlayer();
    stepFx();
    stepCamera();
  }

  function wantedSong() {
    if (state === 'play' || state === 'paused') return bake.chapter.song;
    if (state === 'complete') return 'clear';
    if (state === 'ending') return 'ending';
    return 'title';
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (state === 'loading') {
      ctx.fillStyle = '#13202a';
      ctx.fillRect(0, 0, W, H);
      text(errorText || 'LOADING THE FOREST...', W / 2, H / 2 - 3, { align: 'center', color: '#fff6c2' });
      return;
    }
    if (state === 'title') {
      drawTitle();
      drawMenuItems();
      if (!audio || audio.state !== 'running') text('TAP OR PRESS ANY KEY FOR SOUND', W / 2, 104, { align: 'center', color: '#13202a', outline: '#d7f1f9' });
    } else if (state === 'levels') drawLevels();
    else if (state === 'settings') drawSettings();
    else if (state === 'credits') drawCredits();
    else if (state === 'play') {
      drawWorld();
      drawHud();
    } else if (state === 'paused') drawPaused();
    else if (state === 'complete') drawComplete();
    else if (state === 'ending') drawEnding();
  }

  let last = performance.now();
  let acc = 0;
  let testMode = false;
  function frame(now) {
    requestAnimationFrame(frame);
    if (testMode) return render();
    acc += Math.min(100, now - last);
    last = now;
    // Fixed 60 Hz steps: same physics at 30 or 144 fps; never more than 5 per frame.
    let n = 0;
    while (acc >= 1000 / 60 && n < 5) {
      step();
      acc -= 1000 / 60;
      n++;
    }
    if (n === 5) acc = 0;
    music.update(wantedSong(), settings.music && settings.sound ? (state === 'paused' ? 0.4 : 1) : 0);
    render();
  }

  fit();
  loaded
    .then(() => {
      setState('title');
      requestAnimationFrame(frame);
    })
    .catch((err) => {
      errorText = 'COULD NOT LOAD THE GAME. PLEASE RELOAD.';
      render();
      console.error(err);
    });
  render();

  // Hook for automated tests: drive the simulation without real time or input.
  window.forestLiar = {
    get version() {
      return VERSION;
    },
    get state() {
      return state;
    },
    levels: LEVELS.length,
    test: {
      enable() {
        testMode = true;
      },
      start(i) {
        startLevel(i);
        world.banner = 0;
      },
      /** Run n frames holding the given inputs: { left, right, jump }. */
      run(hold, n = 1) {
        for (let i = 0; i < n; i++) {
          keys.clear();
          if (hold.left) keys.add('ArrowLeft');
          if (hold.right) keys.add('ArrowRight');
          if (hold.jump) keys.add('Space');
          step();
          if (state !== 'play') break;
        }
        keys.clear();
        return this.info();
      },
      info() {
        const p = world.player;
        return { state, x: p.x, y: p.y, vx: p.vx, vy: p.vy, ground: p.ground, dead: p.dead > 0, won: p.won > 0, deaths: world.deaths, time: world.time, cols: world.cols, rows: world.rows, checkpoint: world.checkpoint };
      },
      snapshot: () => structuredClone({ world, cam, jumpWas, state }),
      restore(s) {
        const c = structuredClone(s);
        world = c.world;
        Object.assign(cam, c.cam);
        jumpWas = c.jumpWas;
        state = c.state;
      },
      setProgress(n) {
        progress.unlocked = n;
        saveProgress();
      },
    },
  };
})();
