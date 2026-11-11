// Pond Guard: a portrait tower defence game for INDIE/24.
// Bugs march down a winding trail towards the frog eggs in the pond. Build
// frogs, toads, lilies and herons on the grass to stop them. The rules live
// in core.js; this file draws everything, plays the sound and reads input.
// All art is drawn in code below and all sound is made live with WebAudio,
// so there are no asset files.
(function () {
  'use strict';

  const PG = window.PondGuard;
  const { T, COLS, ROWS, TOP, TOWERS, TOWER_ORDER } = PG;
  const W = 160;
  const H = 288;
  const STEP = 1000 / 60;
  const PANEL = TOP + ROWS * T; // y where the bottom panel starts (240)

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  function fit() {
    const raw = Math.min(innerWidth / W, innerHeight / H);
    const s = raw >= 4 ? Math.floor(raw) : raw;
    canvas.style.width = `${Math.floor(W * s)}px`;
    canvas.style.height = `${Math.floor(H * s)}px`;
  }
  addEventListener('resize', fit);
  fit();

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('pond-guard.' + k);
        return v === null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('pond-guard.' + k, JSON.stringify(v));
      } catch {
        /* storage unavailable: scores just won't be kept */
      }
    },
  };
  let best = store.get('best', 0);
  let bestWave = store.get('bestWave', 0);
  let soundOn = store.get('sound', true);
  let games = store.get('games', 0);

  // ----------------------------------------------------------------- font --
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110', ' ': '000000000000000', ':': '000010000010000', '.': '000000000000010', '!': '010010010000010',
    '/': '001001010100100', '-': '000000111000000', '?': '110001010000010', '+': '000010111010000', "'": '010010000000000',
    ',': '000000000010100', '>': '100010001010100', '<': '001010100010001',
  };
  function glyphs(str, x, y, color, s) {
    ctx.fillStyle = color;
    let cx = x;
    for (const ch of str) {
      const g = FONT[ch] || FONT['?'];
      for (let p = 0; p < 15; p++) if (g[p] === '1') ctx.fillRect(cx + (p % 3) * s, y + Math.floor(p / 3) * s, s, s);
      cx += 4 * s;
    }
  }
  function text(str, x, y, { scale = 1, color = '#fff8e0', align = 'left', outline = '#173018' } = {}) {
    str = String(str).toUpperCase();
    const width = str.length * 4 * scale - scale;
    if (align === 'center') x -= Math.floor(width / 2);
    if (align === 'right') x -= width;
    x = Math.round(x);
    y = Math.round(y);
    if (outline) {
      const o = Math.max(1, Math.floor(scale / 2));
      for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [o, o]]) glyphs(str, x + dx, y + dy, outline, scale);
    }
    glyphs(str, x, y, color, scale);
  }
  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // -------------------------------------------------------------- sprites --
  // Pixel art as strings: each letter is a colour from the palette, '.' is clear.
  const PAL = {
    k: '#173018', // outline
    g: '#5cc23c', G: '#3a8a2a', l: '#b6ee74', w: '#ffffff', p: '#173018', r: '#ff7a9a',
    y: '#ffd23f', b: '#b07a3e', B: '#7a4f22', d: '#6b4420', t: '#ecc88e',
    R: '#ff9ec4', P: '#e05a8e', s: '#a9b8c8', S: '#7d8ea3', o: '#ff9a3c', O: '#d06a1a',
    a: '#4a2a22', A: '#8a3a2a', c: '#e23a3a', C: '#9c1f24', m: '#3a3f5a', n: '#7f86a8',
    e: '#7bd34a', E: '#3f8f2a', h: '#ffb627', H: '#d9801a', v: '#2a2440', V: '#5a4a8a', u: '#9a86d8',
  };
  function sprite(rows, pal = PAL) {
    const w = Math.max(...rows.map((r) => r.length));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.' || !pal[ch]) return;
      g.fillStyle = pal[ch];
      g.fillRect(x, y, 1, 1);
    }));
    return c;
  }
  function tint(src, color) {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function flipX(src) {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d');
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return c;
  }

  const SPR = {
    frog: sprite([
      '..kkk....kkk..',
      '.kwwwk..kwwwk.',
      '.kwppkkkkppwk.',
      '.kgwwgggggwwgk',
      'kggggggggggggk',
      'kglgggggggglgk',
      'kgkrrrrrrrrkgk',
      '.kgkkkkkkkkgk.',
      'kGgllllllllgGk',
      'kGGgllllllgGGk',
      'kgGkgkkkkgkGgk',
      '.kk.kk..kk.kk.',
    ]),
    toad: sprite([
      '...kkk...kkk...',
      '..kyyyk.kyyyk..',
      '..kypyk.kypyk..',
      '.kbkkkbbbkkkbk.',
      'kbbdbbbbbbbdbbk',
      'kbdbbbbdbbbbdbk',
      'kbbbkkkkkkkbbbk',
      'kbbbbbbbbbbbbbk',
      'kBbbtttttttbbBk',
      'kBBbtttttttbBBk',
      'kbBkBkkkkkBkBbk',
      '.kk.kk...kk.kk.',
    ]),
    lily: sprite([
      '......kk......',
      '.....kRRk.....',
      '..kk.kRPk.kk..',
      '.kRRkkRPkkRRk.',
      '.kRPPkRPkPPRk.',
      '..kRPPwwPPRk..',
      '.kkkPwyywPkkk.',
      'kRRRPwyywPRRRk',
      '.kkRPPwwPPRkk.',
      '.kGkkkkkkkkGk.',
      'kGggggggggggGk',
      '.kkkkkkkkkkkk.',
    ]),
    heron: sprite([
      '...kkk......',
      '..kwwwk.....',
      '.kwwpwkkkk..',
      '.kwwwwkooook',
      '..kwwwkkkk..',
      '...kwwk.....',
      '...kwwk.....',
      '..kwwwwkk...',
      '.kwwwwwwwk..',
      '.kwssswwwwk.',
      '.kwsSSswwwk.',
      '..kwsSswwk..',
      '...kwwwwk...',
      '....kkkk....',
      '....ko......',
      '....ko......',
      '...kkok.....',
      '....ooo.....',
    ]),
    hatLeaf: sprite(['.kkk.', 'kRyRk', '.kkk.']),
    crown: sprite(['k.k.k', 'kykyk', 'kyyyk', 'kkkkk']),
    // Bugs face up; they are turned to face the way they walk.
    ant: [
      sprite(['.k...k.', '..kkk..', '..kak..', 'k.kAk.k', '.kkakk.', 'k.kak.k', '..kak..', '.kaaak.', '.kaAak.', '..kkk..']),
      sprite(['.k...k.', '..kkk..', '..kak..', '.kkAkk.', 'k.kak.k', '.kkakk.', '..kak..', '.kaaak.', '.kaAak.', '..kkk..']),
    ],
    ladybug: [
      sprite(['...kkk...', '..kmwmk..', '.kkkkkkk.', 'kckckcck.', 'kcckcmckk', 'kmckcckmk', 'kcckckcck', '.kcckcck.', '..kkkkk..']),
      sprite(['...kkk...', '..kmwmk..', 'kkkkkkkk.', '.kckcmck.', 'kcckcmckk', 'kmckcckmk', 'kcckckcck', 'kkcckcckk', '..kkkkk..']),
    ],
    stag: [
      sprite([
        '..k........k..', '.kOk......kOk.', '..kOk....kOk..', '...kOkkkkOk...', '....kHHHHk....', '...kHHHHHHk...',
        '..kkVVkkVVkk..', '.kVVuVkkVuVVk.', '.kVuVVkkVVuVk.', 'kkVVVVkkVVVVkk', '.kVVVVkkVVVVk.', '.kVVVVkkVVVVk.', '..kVVVkkVVVk..', '...kkk..kkk...',
      ]),
      sprite([
        '..k........k..', '.kOk......kOk.', '..kOk....kOk..', '...kOkkkkOk...', '....kHHHHk....', 'k..kHHHHHHk..k',
        '.kkkVVkkVVkkk.', '.kVVuVkkVuVVk.', 'kkVuVVkkVVuVkk', '.kVVVVkkVVVVk.', 'kkVVVVkkVVVVkk', '.kVVVVkkVVVVk.', '..kVVVkkVVVk..', '...kkk..kkk...',
      ]),
    ],
    egg: sprite(['.kkk.', 'kwwwk', 'kwpwk', 'kwwwk', '.kkk.']),
    coin: sprite(['.kkk.', 'kyyHk', 'kyHHk', 'kyyHk', '.kkk.']),
  };
  SPR.frogL = flipX(SPR.frog);
  SPR.toadL = flipX(SPR.toad);
  SPR.heronL = flipX(SPR.heron);
  const WHITE = {};
  for (const k of ['ant', 'ladybug', 'stag']) WHITE[k] = SPR[k].map((s) => tint(s, '#ffffff'));
  const ICON = { frog: SPR.frog, toad: SPR.toad, lily: SPR.lily, heron: SPR.heron };

  // ---------------------------------------------------------------- sound --
  let audio = null;
  function tone(freq, ms, type = 'square', vol = 0.04, slide = 0, delay = 0) {
    if (!soundOn) return;
    try {
      if (!audio || audio.state !== 'running') return;
      const t = audio.currentTime + delay / 1000;
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
  // iOS Safari only lets audio start inside a tap or key press, so the
  // context is created and resumed from the input handlers below.
  function unlockAudio() {
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state !== 'running') audio.resume().catch(() => {});
    } catch {
      /* audio unavailable */
    }
  }
  const sfx = {
    tongue: () => tone(520, 50, 'triangle', 0.03, 380),
    spit: () => tone(220, 70, 'square', 0.025, -80),
    splat: () => (tone(120, 110, 'sawtooth', 0.03, -60), tone(300, 40, 'square', 0.015, -150)),
    peck: () => (tone(1400, 40, 'square', 0.02, -600), tone(180, 60, 'triangle', 0.04, -40)),
    pop: () => tone(880, 45, 'square', 0.02, 300),
    boom: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 120, 'square', 0.04, 0, i * 70)),
    build: () => (tone(392, 60, 'triangle', 0.05), tone(587, 90, 'triangle', 0.05, 0, 60)),
    upgrade: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 80, 'triangle', 0.045, 0, i * 50)),
    sell: () => (tone(988, 60, 'square', 0.02), tone(740, 80, 'square', 0.02, 0, 60)),
    wave: () => [330, 440, 554, 659].forEach((f, i) => tone(f, 110, 'square', 0.03, 0, i * 80)),
    boss: () => [196, 185, 175, 165].forEach((f, i) => tone(f, 220, 'sawtooth', 0.04, 0, i * 180)),
    clear: () => [659, 784, 988, 1319].forEach((f, i) => tone(f, 100, 'triangle', 0.05, 0, i * 70)),
    leak: () => (tone(300, 220, 'sawtooth', 0.05, -200), tone(90, 160, 'square', 0.04, -30)),
    no: () => tone(140, 120, 'square', 0.04, -20),
    click: () => tone(660, 40, 'square', 0.025),
    medal: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 140, 'triangle', 0.05, 0, i * 90)),
  };

  // ---------------------------------------------------------------- music --
  // Chiptune songs written as note data. Each song is bars of 16 sixteenth
  // steps: a note name starts a note, '-' holds it, '.' is a rest. Bass and
  // arpeggio follow the chord of each bar (two chords split the bar in half).
  const SONGS = {
    title: {
      bpm: 100,
      chords: ['F', 'Dm', 'Bb', 'C'],
      lead: [
        'F5 - - - A5 - C6 - A5 - F5 - G5 - - -',
        'D5 - - - F5 - A5 - G5 - F5 - D5 - - -',
        'Bb4 - - - D5 - F5 - Bb5 - A5 - G5 - - -',
        'C5 - E5 - G5 - - - E5 - - - C5 - . .',
      ],
      bass: 'R - - - 5 - - - R - - - 5 - - -',
      drums: 'k . . . h . . . k . . . h . h .',
      arp: true,
      leadVol: 0.8,
    },
    // The pond on a sunny day: bouncy, a bit froggy.
    pond: {
      bpm: 128,
      chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D G'],
      lead: [
        'G5 - B5 - D6 - B5 - G5 - - - D5 - - -',
        'E5 - G5 - B5 - G5 - E5 - - - . . . .',
        'C5 - E5 - G5 - E5 - C6 - B5 - A5 - - -',
        'D5 - F#5 - A5 - F#5 - D5 - - - . . . .',
        'B4 - D5 - G5 - - - B5 - A5 - G5 - - -',
        'G5 - E5 - B4 - E5 - G5 - - - . . . .',
        'E5 - - - C5 - E5 - G5 - - - E5 - - -',
        'D5 - - - F#5 - - - G5 - - - . . . .',
      ],
      bass: 'R . 5 . R . 5 . R . 5 . 8 . 5 .',
      drums: 'k . h . s . h . k . k . s . h .',
      arp: true,
      leadVol: 0.7,
    },
    // Calm between waves.
    rest: {
      bpm: 104,
      chords: ['C', 'Am', 'F', 'G'],
      lead: [
        'E5 - - - G5 - - - C6 - - - G5 - - -',
        'A5 - - - E5 - - - C5 - - - . . . .',
        'F5 - - - A5 - - - C6 - - - A5 - - -',
        'G5 - - - D5 - - - B4 - - - . . . .',
      ],
      bass: 'R - - - - - - - 5 - - - - - - -',
      drums: 'k . . . . . . . h . . . . . . .',
      arp: true,
      leadVol: 0.6,
    },
    // A stag beetle is coming.
    boss: {
      bpm: 150,
      chords: ['Am', 'Am', 'F', 'E'],
      lead: [
        'A4 - A4 - C5 - A4 - E5 - D5 - C5 - B4 -',
        'A4 - - - E5 - - - A5 - G5 - E5 - - -',
        'F5 - E5 - D5 - C5 - A4 - C5 - F5 - - -',
        'E5 - D5 - B4 - G#4 - E4 - - - . . . .',
      ],
      bass: 'R . R . 8 . R . R . R . 5 . 8 .',
      drums: 'k . h . s . h h k . k . s . h .',
      arp: true,
      leadVol: 0.7,
    },
    over: {
      bpm: 92,
      once: true,
      chords: ['F', 'G C'],
      lead: ['A4 - - - G4 - - - F4 - - - E4 - - -', 'D4 - - - - - - - . . . . . . . .'],
      bass: 'R - - - - - - - R - - - - - - -',
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
  // Turn a step string into [{ step, len, value }] so holds become lengths.
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
      // A 25% pulse wave gives the lead its classic handheld-console sound.
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
        g.gain.setValueAtTime(0.5, at);
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
      g.gain.setValueAtTime(kind === 's' ? 0.25 : 0.1, at);
      g.gain.exponentialRampToValueAtTime(0.001, at + len);
      src.connect(f).connect(g);
      src.start(at, Math.random() * 0.3);
      src.stop(at + len + 0.01);
    }

    function playStep(s, at, sixteenth) {
      for (const n of song.leadNotes) if (n.step === s) voice(n.freq, at, n.len * sixteenth, 'pulse', 0.09 * (song.leadVol ?? 1));
      const ch = song.chordAt[s];
      for (const n of song.bassNotes) {
        if (n.step !== s) continue;
        const f = { R: ch.root, 3: ch.third, 5: ch.fifth, 8: ch.root * 2 }[n.value];
        voice(f, at, n.len * sixteenth, 'triangle', 0.22);
      }
      if (song.arp) {
        const tones = [ch.root, ch.third, ch.fifth, ch.root * 2];
        voice(tones[s % 4] * 4, at, sixteenth * 0.9, 'square', 0.022);
      }
      for (const d of song.drumHits) if (d.step === s) drum(d.value, at);
    }

    function schedule() {
      if (!song) return;
      const sixteenth = 15 / song.bpm;
      // Background tabs throttle timers; skip ahead instead of bunching notes.
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
      // Called every frame with the song the game wants and the volume.
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


  // ------------------------------------------------------------ the map --
  // The grass, trail and pond never change, so they are painted once.
  function seeded(n) {
    n = (n * 2654435761) >>> 0;
    n ^= n >>> 15;
    return (n % 1000) / 1000;
  }
  const bg = document.createElement('canvas');
  bg.width = W;
  bg.height = H;
  (function paintMap() {
    const g = bg.getContext('2d');
    const r = (x, y, w, h, c) => {
      g.fillStyle = c;
      g.fillRect(x, y, w, h);
    };
    // Grass, with a soft checker so the build grid is easy to read.
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = col * T;
        const y = TOP + row * T;
        r(x, y, T, T, (row + col) % 2 ? '#6cc04a' : '#64b744');
        const s = seeded(row * 31 + col * 7 + 3);
        // Tufts and flowers.
        for (let i = 0; i < 3; i++) {
          const tx = x + 2 + Math.floor(seeded(row * 97 + col * 13 + i * 5) * 11);
          const ty = y + 3 + Math.floor(seeded(row * 53 + col * 29 + i * 11) * 10);
          r(tx, ty, 1, 2, '#4e9a35');
          r(tx + 2, ty + 1, 1, 1, '#4e9a35');
        }
        if (s > 0.8) {
          const fx = x + 4 + Math.floor(seeded(row + col * 41) * 8);
          const fy = y + 4 + Math.floor(seeded(row * 17 + col) * 8);
          const fc = ['#fff4c2', '#ffd23f', '#ff9ec4'][Math.floor(s * 30) % 3];
          r(fx - 1, fy, 3, 1, fc);
          r(fx, fy - 1, 1, 3, fc);
          r(fx, fy, 1, 1, '#e8961e');
        }
      }
    }
    // The trail: a dark edge, then the sandy path, then pebbles.
    const segs = PG.PATH.slice(1).map((p, i) => [PG.PATH[i], p]);
    for (const [pad, color] of [[7, '#8a6a3a'], [6, '#c49a5e'], [5, '#dcbc84']]) {
      for (const [[x0, y0], [x1, y1]] of segs) {
        const ax = Math.min(x0, x1) - pad;
        const ay = Math.min(y0, y1) - pad;
        r(ax, Math.max(TOP, ay), Math.abs(x1 - x0) + pad * 2, Math.abs(y1 - y0) + pad * 2 - Math.max(0, TOP - ay), color);
      }
    }
    for (let d = 6; d < PG.PATH_LEN; d += 9) {
      const p = PG.pointAt(d);
      const s = seeded(d * 3);
      if (p.y < TOP + 2) continue;
      const ox = Math.round((s - 0.5) * 9);
      const oy = Math.round((seeded(d * 7) - 0.5) * 9);
      r(p.x + (p.dy ? ox : 0), p.y + (p.dx ? oy : 0), 2, 1, s > 0.5 ? '#b08a52' : '#efd6a2');
    }
    // The pond, with reeds, lily pads and stones around it.
    const px0 = PG.POND.c0 * T;
    const py0 = TOP + PG.POND.r0 * T;
    const pw = (PG.POND.c1 - PG.POND.c0 + 1) * T;
    const ph = (PG.POND.r1 - PG.POND.r0 + 1) * T;
    r(px0 + 2, py0, pw - 4, ph, '#8a6a3a');
    r(px0, py0 + 3, pw, ph - 3, '#8a6a3a');
    r(px0 + 3, py0 + 1, pw - 6, ph - 1, '#2f78c4');
    r(px0 + 1, py0 + 4, pw - 2, ph - 4, '#2f78c4');
    r(px0 + 4, py0 + 3, pw - 8, ph - 3, '#3d9be0');
    r(px0 + 3, py0 + 6, pw - 6, ph - 6, '#3d9be0');
    // Lily pads.
    for (const [lx, ly] of [[px0 + 9, py0 + 10], [px0 + pw - 14, py0 + 9], [px0 + 22, py0 + 24], [px0 + pw - 24, py0 + 25]]) {
      r(lx - 3, ly - 2, 7, 5, '#3a8a2a');
      r(lx - 2, ly - 3, 5, 7, '#3a8a2a');
      r(lx - 2, ly - 2, 5, 4, '#5cc23c');
      r(lx, ly - 3, 1, 3, '#2f78c4');
    }
    // Reeds at the corners.
    for (const [rx, ry] of [[px0 + 2, py0 + 2], [px0 + pw - 5, py0 + 3]]) {
      r(rx, ry - 6, 1, 8, '#3a8a2a');
      r(rx + 2, ry - 8, 1, 10, '#3a8a2a');
      r(rx + 2, ry - 10, 1, 3, '#7a4f22');
      r(rx, ry - 8, 1, 3, '#7a4f22');
    }
  })();

  // Where the frog eggs sit in the pond. One egg disappears per egg lost.
  const EGG_SPOTS = [];
  for (let i = 0; i < PG.START_EGGS; i++) {
    const row = Math.floor(i / 5);
    EGG_SPOTS.push({ x: 82 + (i % 5) * 6 + (row % 2) * 3, y: 216 + row * 5 });
  }

  // ---------------------------------------------------------- game state --
  let state = 'title'; // title | play | paused | dying | over
  let G = PG.newGame();
  let t = 0;
  let stateT = 0;
  let speed = 1;
  let sel = null; // { c, r } the selected tile
  let hover = null;
  let shake = 0;
  let newBest = false;
  let medalShown = null;
  let banner = null; // { title, sub, color, life }
  let toastText = '';
  let toastUntil = 0;
  const fx = []; // tongues, pecks, particles, popups
  let demo = null;

  function setState(s) {
    state = s;
    stateT = 0;
  }
  function toast(msg) {
    toastText = msg;
    toastUntil = performance.now() + 1400;
  }

  function newDemo() {
    const D = PG.newGame();
    D.coins = 9999;
    for (const [c, r, type, lv] of [[2, 3, 'frog', 1], [6, 3, 'toad', 0], [4, 6, 'heron', 1], [7, 6, 'lily', 0], [3, 9, 'frog', 0], [6, 10, 'frog', 2], [3, 0, 'frog', 0]]) {
      const tw = PG.build(D, c, r, type);
      for (let i = 0; i < lv; i++) PG.upgrade(D, tw);
    }
    PG.callWave(D);
    D.events.length = 0;
    return D;
  }
  demo = newDemo();

  function startGame() {
    G = PG.newGame();
    sel = null;
    speed = 1;
    fx.length = 0;
    newBest = false;
    medalShown = null;
    banner = { title: 'GET READY', sub: 'BUILD, THEN TAP START', color: '#b6ee74', life: 120 };
    setState('play');
  }

  // ---------------------------------------------------------------- input --
  function selectedTower() {
    return sel ? PG.towerAt(G, sel.c, sel.r) : null;
  }

  function tryBuild(type) {
    if (!sel || selectedTower() || !PG.buildable(sel.c, sel.r)) return;
    if (G.coins < TOWERS[type].cost[0]) {
      sfx.no();
      toast('NOT ENOUGH COINS');
      return;
    }
    PG.build(G, sel.c, sel.r, type);
  }
  function tryUpgrade() {
    const tw = selectedTower();
    if (!tw) return;
    const cost = PG.upgradeCost(tw);
    if (cost === null) return toast('ALREADY MAX LEVEL');
    if (G.coins < cost) {
      sfx.no();
      return toast('NOT ENOUGH COINS');
    }
    PG.upgrade(G, tw);
  }
  function trySell() {
    const tw = selectedTower();
    if (!tw) return;
    PG.sell(G, tw);
    sel = null;
  }
  function tryWave() {
    if (G.inWave) return;
    PG.callWave(G);
  }
  function cycleSpeed() {
    speed = speed === 3 ? 1 : speed + 1;
    sfx.click();
  }
  function pause() {
    if (state === 'play') {
      setState('paused');
      sfx.click();
    } else if (state === 'paused') setState('play');
  }
  function toggleSound() {
    soundOn = !soundOn;
    store.set('sound', soundOn);
    toast(soundOn ? 'SOUND ON' : 'SOUND OFF');
  }

  const inBox = (x, y, b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  const CARD = (i) => ({ x: 3 + i * 39, y: PANEL + 3, w: 37, h: 42 });
  const BTN = {
    upgrade: { x: 82, y: PANEL + 3, w: 46, h: 42 },
    sell: { x: 130, y: PANEL + 3, w: 27, h: 42 },
    speed: { x: 64, y: PANEL + 3, w: 26, h: 42 },
    wave: { x: 93, y: PANEL + 3, w: 64, h: 42 },
    pause: { x: W - 16, y: 0, w: 16, h: 16 },
  };

  function tapPlay(x, y) {
    if (inBox(x, y, BTN.pause)) return pause();
    if (y >= TOP && y < PANEL) {
      const c = Math.floor(x / T);
      const r = Math.floor((y - TOP) / T);
      if (sel && sel.c === c && sel.r === r) sel = null;
      else if (PG.towerAt(G, c, r) || PG.buildable(c, r)) {
        sel = { c, r };
        sfx.click();
      } else sel = null;
      return;
    }
    if (y < PANEL) return;
    const tw = selectedTower();
    if (tw) {
      if (inBox(x, y, BTN.upgrade)) tryUpgrade();
      else if (inBox(x, y, BTN.sell)) trySell();
      else sel = null;
    } else if (sel) {
      TOWER_ORDER.forEach((type, i) => inBox(x, y, CARD(i)) && tryBuild(type));
    } else if (inBox(x, y, BTN.speed)) cycleSpeed();
    else if (inBox(x, y, BTN.wave)) tryWave();
  }

  let lastTap = -1e9;
  function tap(x, y) {
    const now = performance.now();
    if (now - lastTap < 60) return;
    lastTap = now;
    unlockAudio();
    if (state === 'title') {
      if (x < 22 && y > H - 22) return toggleSound();
      sfx.click();
      return startGame();
    }
    if (state === 'paused') {
      if (x < 22 && y > H - 22) return toggleSound();
      return pause();
    }
    if (state === 'over') {
      if (stateT > 50) {
        sfx.click();
        startGame();
      }
      return;
    }
    if (state === 'play') tapPlay(x, y);
  }

  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }
  addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    tap(p.x, p.y);
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const p = toCanvas(e);
    hover = p.y >= TOP && p.y < PANEL && p.x >= 0 && p.x < W ? { c: Math.floor(p.x / T), r: Math.floor((p.y - TOP) / T) } : null;
  });
  // Safari on older iPhones sometimes drops pointer events inside iframes.
  addEventListener(
    'touchstart',
    (e) => {
      const touch = e.changedTouches[0];
      if (touch) {
        const p = toCanvas(touch);
        tap(p.x, p.y);
      }
      e.preventDefault();
    },
    { passive: false },
  );
  addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  addEventListener('contextmenu', (e) => e.preventDefault());

  addEventListener('keydown', (e) => {
    unlockAudio();
    const k = e.key;
    if (k === 'm' || k === 'M') return toggleSound();
    if (state === 'title' || (state === 'over' && stateT > 50)) {
      if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        sfx.click();
        startGame();
      }
      return;
    }
    if (k === 'p' || k === 'P' || (k === 'Escape' && !sel)) return pause();
    if (state === 'paused' && (k === ' ' || k === 'Enter')) return pause();
    if (state !== 'play') return;
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[k]) {
      e.preventDefault();
      const from = sel || hover || { c: 4, r: 6 };
      sel = { c: Math.max(0, Math.min(COLS - 1, from.c + moves[k][0])), r: Math.max(0, Math.min(ROWS - 1, from.r + moves[k][1])) };
      return;
    }
    if (k === 'Escape') sel = null;
    if (k >= '1' && k <= '4') {
      if (!sel && hover) sel = { ...hover };
      tryBuild(TOWER_ORDER[+k - 1]);
    }
    if (k === 'u' || k === 'U') tryUpgrade();
    if (k === 's' || k === 'S' || k === 'Delete' || k === 'Backspace') trySell();
    if (k === 'n' || k === 'N' || k === ' ' || k === 'Enter') {
      e.preventDefault();
      tryWave();
    }
    if (k === 'f' || k === 'F') cycleSpeed();
  });
  addEventListener('blur', () => {
    if (state === 'play') setState('paused');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'play') setState('paused');
  });

  // --------------------------------------------------------------- events --
  const BUG_COLOR = { ant: '#4a2a22', fly: '#7f86a8', ladybug: '#e23a3a', worm: '#7bd34a', stag: '#9a86d8' };
  const heard = {};
  function once(name) {
    // Fast-forward fires lots of the same sound at once; play each kind once a frame.
    if (heard[name] === t) return;
    heard[name] = t;
    sfx[name]();
  }
  function burst(x, y, color, n, spread = 1, life = 18) {
    for (let i = 0; i < n; i++) {
      fx.push({ kind: 'dot', x, y, vx: (Math.random() * 2 - 1) * spread, vy: (Math.random() * 2 - 1) * spread - 0.3, life: life + Math.random() * 10, color });
    }
  }
  function popup(x, y, txt, color = '#fff8e0') {
    fx.push({ kind: 'pop', x, y, txt, color, life: 34 });
  }

  function handleEvents(D, live) {
    for (const ev of D.events) {
      const [kind, a, b, c, d, e2] = ev;
      if (kind === 'tongue') fx.push({ kind: 'tongue', x0: a, y0: b - 1, x1: c, y1: d, life: 8 });
      else if (kind === 'peck') fx.push({ kind: 'peck', x0: a + (c < a ? -3 : 3), y0: b - 8, x1: c, y1: d, life: 7 });
      else if (kind === 'splat') {
        fx.push({ kind: 'ring', x: a, y: b, r: c, life: 10 });
        burst(a, b, '#7a4f22', 6, 1.2, 12);
      } else if (kind === 'kill') {
        burst(a, b, BUG_COLOR[c], c === 'stag' ? 24 : 6, c === 'stag' ? 2 : 1);
        if (live) popup(a, b - 6, `+${d}`, c === 'stag' ? '#ffd23f' : '#fff8e0');
      }
      if (!live) continue;
      if (kind === 'tongue') once('tongue');
      else if (kind === 'peck') once('peck');
      else if (kind === 'spit') once('spit');
      else if (kind === 'splat') once('splat');
      else if (kind === 'kill') c === 'stag' ? sfx.boom() : once('pop');
      else if (kind === 'build') {
        sfx.build();
        burst(a, b, '#fff4c2', 8, 1);
      } else if (kind === 'upgrade') {
        sfx.upgrade();
        burst(a, b - 6, '#ffd23f', 12, 1.3);
        popup(a, b - 12, c === 2 ? 'MAX!' : 'LEVEL UP', '#ffd23f');
      } else if (kind === 'sell') {
        sfx.sell();
        burst(a, b, '#ffd23f', 8, 1);
        popup(a, b - 8, `+${c}`, '#ffd23f');
      } else if (kind === 'wave') {
        if (d) {
          sfx.boss();
          banner = { title: `WAVE ${a}`, sub: 'BOSS: STAG BEETLE!', color: '#ff9a3c', life: 110 };
        } else {
          sfx.wave();
          banner = { title: `WAVE ${a}`, sub: b ? `CALLED EARLY +${b} COINS` : 'HERE THEY COME!', color: '#fff8e0', life: 80 };
        }
      } else if (kind === 'clear') {
        sfx.clear();
        banner = { title: 'WAVE CLEARED', sub: `+${b} POINTS  +${c} COINS`, color: '#b6ee74', life: 90 };
      } else if (kind === 'leak') {
        sfx.leak();
        shake = 8;
        burst(a, b, '#9fd8ff', 10, 1.4);
        popup(a, b - 8, `-${d} EGG${d > 1 ? 'S' : ''}`, '#ff7a9a');
      }
    }
    D.events.length = 0;
  }

  function finishRun() {
    games++;
    store.set('games', games);
    if (G.score > best) {
      best = G.score;
      newBest = G.score > 0;
      store.set('best', best);
    }
    if (G.cleared > bestWave) {
      bestWave = G.cleared;
      store.set('bestWave', bestWave);
    }
    window.Indie24Scores?.submit('pond-guard', G.score);
    medalShown = PG.medalFor(G.cleared);
    if (medalShown) setTimeout(() => state === 'over' && sfx.medal(), 500);
    setState('over');
  }

  // --------------------------------------------------------------- update --
  function update() {
    t++;
    stateT++;
    if (state === 'paused') return;
    if (state === 'title' || state === 'over') {
      PG.step(demo);
      if (!demo.inWave) PG.callWave(demo);
      handleEvents(demo, false);
      if (demo.over || demo.wave > 6) demo = newDemo();
    } else if (state === 'play') {
      for (let i = 0; i < speed && !G.over; i++) {
        PG.step(G);
        handleEvents(G, true);
      }
      if (G.over) {
        sel = null;
        shake = 14;
        setState('dying');
      }
    } else if (state === 'dying' && stateT > 80) finishRun();

    for (const f of fx) {
      f.life--;
      if (f.kind === 'dot') {
        f.x += f.vx;
        f.y += f.vy;
        f.vy += 0.05;
      } else if (f.kind === 'pop') f.y -= 0.4;
    }
    for (let i = fx.length - 1; i >= 0; i--) if (fx[i].life <= 0) fx.splice(i, 1);
    if (fx.length > 400) fx.splice(0, fx.length - 400);
    if (shake > 0) shake--;
    if (banner && --banner.life <= 0) banner = null;
  }

  // ----------------------------------------------------------------- draw --
  function drawWater(D) {
    const px0 = PG.POND.c0 * T;
    const py0 = TOP + PG.POND.r0 * T;
    ctx.fillStyle = '#9fd8ff';
    for (let i = 0; i < 6; i++) {
      const x = px0 + 8 + ((i * 29 + Math.floor(t / 3)) % 80);
      const y = py0 + 6 + ((i * 11) % 22);
      if ((t + i * 20) % 90 < 60) ctx.fillRect(x, y, 3, 1);
    }
    // The frog eggs.
    for (let i = 0; i < D.eggs; i++) {
      const s = EGG_SPOTS[i];
      const wob = Math.round(Math.sin(t / 30 + i) * 0.6);
      ctx.drawImage(SPR.egg, s.x - 2, s.y - 2 + wob);
    }
  }

  function drawRange(x, y, r, color = 'rgba(255,255,255,0.16)') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const n = Math.round(r * 0.9);
    for (let i = 0; i < n; i++) {
      if ((i + (t >> 3)) % 2) continue;
      const a = (i / n) * Math.PI * 2;
      ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
    }
  }

  function drawTower(tw) {
    const left = Math.cos(tw.aim) < -0.2;
    const x = tw.x;
    const base = TOP + tw.r * T + T - 1; // bottom of the tile
    ctx.fillStyle = 'rgba(23,48,24,0.3)';
    ctx.fillRect(x - 6, base - 3, 12, 3);
    ctx.fillRect(x - 5, base - 4, 10, 5);
    let img = SPR[tw.type];
    if (left && SPR[tw.type + 'L']) img = SPR[tw.type + 'L'];
    let dy = 0;
    if (tw.type === 'frog' && tw.fireT > 5) dy = 1;
    if (tw.type === 'toad' && tw.fireT > 4) dy = -1;
    if (tw.type === 'lily') dy = Math.round(Math.sin(t / 20 + tw.c) * 0.6);
    const top = base - img.height - 1 + dy;
    if (tw.type === 'heron') {
      // Herons are tall: they stand out of their tile a little.
      ctx.drawImage(img, x - 6, base - img.height + (tw.fireT > 4 ? 1 : 0));
    } else ctx.drawImage(img, x - (img.width >> 1), top);
    const heronTop = base - img.height + (tw.fireT > 4 ? 1 : 0);
    const hatY = tw.type === 'heron' ? heronTop - 2 : top - 2;
    const hatX = tw.type === 'heron' ? (left ? x - 1 : x - 5) : x - 2;
    if (tw.level === 1) ctx.drawImage(SPR.hatLeaf, hatX, hatY);
    if (tw.level === 2) ctx.drawImage(SPR.crown, hatX, hatY);
  }

  function drawWorm(b) {
    // A caterpillar: four segments that ripple as it crawls.
    const back = { x: -b.dx, y: -b.dy };
    for (let i = 3; i >= 0; i--) {
      const wob = Math.sin(t / 5 + i) * 1;
      const sx = Math.round(b.x + back.x * i * 3 + (b.dy ? wob : 0));
      const sy = Math.round(b.y + back.y * i * 3 + (b.dx ? wob : 0));
      ctx.fillStyle = '#173018';
      ctx.fillRect(sx - 3, sy - 2, 6, 4);
      ctx.fillRect(sx - 2, sy - 3, 4, 6);
      ctx.fillStyle = b.hitT ? '#ffffff' : i === 0 ? '#ffb627' : i % 2 ? '#7bd34a' : '#5cc23c';
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
      if (i === 0 && !b.hitT) {
        ctx.fillStyle = '#173018';
        ctx.fillRect(sx - 1 + b.dx, sy - 1 + b.dy, 1, 1);
        ctx.fillRect(sx + (b.dy ? 1 : b.dx), sy + (b.dx ? 1 : b.dy), 1, 1);
      }
    }
  }

  function drawFly(b) {
    // A mosquito flies over everything with a shadow below.
    const hover = Math.round(Math.sin(t / 6 + b.id) * 1.5) - 6;
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    ctx.fillStyle = 'rgba(23,48,24,0.3)';
    ctx.fillRect(x - 2, y + 1, 5, 2);
    const fy = y + hover;
    const up = (t >> 1) % 2;
    // Wings.
    ctx.fillStyle = '#173018';
    ctx.fillRect(x - 6, fy - 3 - up, 5, 3);
    ctx.fillRect(x + 2, fy - 3 - up, 5, 3);
    ctx.fillStyle = 'rgba(220,240,255,0.95)';
    ctx.fillRect(x - 5, fy - 2 - up, 3, 1);
    ctx.fillRect(x + 3, fy - 2 - up, 3, 1);
    // Legs.
    ctx.fillStyle = '#173018';
    ctx.fillRect(x - 3, fy + 2, 1, 3);
    ctx.fillRect(x + 3, fy + 2, 1, 3);
    ctx.fillRect(x - 2, fy + 4, 1, 2);
    ctx.fillRect(x + 2, fy + 4, 1, 2);
    // Body: head with a long nose, then a striped tail.
    ctx.fillRect(x - 1, fy - 3, 3, 8);
    ctx.fillStyle = b.hitT ? '#ffffff' : '#7f86a8';
    ctx.fillRect(x, fy - 2, 1, 6);
    ctx.fillStyle = b.hitT ? '#ffffff' : '#c43a3a';
    ctx.fillRect(x, fy - 2, 1, 1);
    ctx.fillStyle = '#173018';
    const nose = b.dx ? [b.dx * 2, -1] : [0, b.dy > 0 ? 6 : -5];
    ctx.fillRect(x + nose[0], fy + nose[1], 1, 2);
  }

  function drawBug(b) {
    if (b.type === 'worm') return drawWorm(b);
    if (b.type === 'fly') return drawFly(b);
    const frames = b.hitT ? WHITE[b.type] : SPR[b.type];
    const img = frames[(t >> 3) % 2];
    const angle = b.dx > 0 ? Math.PI / 2 : b.dx < 0 ? -Math.PI / 2 : b.dy > 0 ? Math.PI : 0;
    ctx.save();
    ctx.translate(Math.round(b.x), Math.round(b.y));
    ctx.rotate(angle);
    ctx.drawImage(img, -(img.width >> 1), -(img.height >> 1));
    ctx.restore();
  }

  function drawHp(b) {
    if (b.hp >= b.max) return;
    const big = b.type === 'stag';
    const w = big ? 14 : 8;
    const x = Math.round(b.x - w / 2);
    const y = Math.round(b.y - (b.air ? 14 : big ? 11 : 8));
    ctx.fillStyle = '#173018';
    ctx.fillRect(x - 1, y - 1, w + 2, 3);
    ctx.fillStyle = '#c43a3a';
    ctx.fillRect(x, y, w, 1);
    ctx.fillStyle = '#7bff5a';
    ctx.fillRect(x, y, Math.max(1, Math.round((w * b.hp) / b.max)), 1);
  }

  function drawLine(x0, y0, x1, y1, color, w = 1) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    ctx.fillStyle = color;
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), w, w);
  }

  function drawFx() {
    for (const f of fx) {
      if (f.kind === 'tongue') {
        const k = f.life > 4 ? (8 - f.life) / 4 : f.life / 4;
        const ex = f.x0 + (f.x1 - f.x0) * Math.min(1, k * 1.3);
        const ey = f.y0 + (f.y1 - f.y0) * Math.min(1, k * 1.3);
        drawLine(f.x0, f.y0, ex, ey, '#ff7a9a', 1);
        ctx.fillStyle = '#e05a8e';
        ctx.fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 3);
      } else if (f.kind === 'peck') {
        drawLine(f.x0, f.y0, f.x1, f.y1, f.life > 3 ? '#fff8e0' : '#ffd23f', 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(f.x1) - 2, Math.round(f.y1), 5, 1);
        ctx.fillRect(Math.round(f.x1), Math.round(f.y1) - 2, 1, 5);
      } else if (f.kind === 'ring') {
        ctx.strokeStyle = `rgba(122,79,34,${f.life / 10})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (1 - f.life / 14), 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.kind === 'dot') {
        ctx.fillStyle = f.color;
        ctx.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
      }
    }
  }

  function drawPopups() {
    for (const f of fx) if (f.kind === 'pop') text(f.txt, f.x, f.y, { align: 'center', color: f.color });
  }

  function drawShots(D) {
    for (const s of D.shots) {
      ctx.fillStyle = '#173018';
      ctx.fillRect(Math.round(s.x) - 2, Math.round(s.y) - 1, 4, 3);
      ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 2, 2, 5);
      ctx.fillStyle = '#7a4f22';
      ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 2, 2);
    }
  }

  function drawPollen(D) {
    for (const tw of D.towers) {
      if (tw.type !== 'lily') continue;
      const r = PG.stat(tw, 'range');
      ctx.fillStyle = tw.busy ? 'rgba(255,230,120,0.9)' : 'rgba(255,240,180,0.5)';
      for (let i = 0; i < (tw.busy ? 8 : 4); i++) {
        const a = t / 50 + i * 0.785 + tw.c;
        const d = r * (0.35 + 0.6 * (((t / 2 + i * 13) % 40) / 40));
        ctx.fillRect(Math.round(tw.x + Math.cos(a) * d), Math.round(tw.y + Math.sin(a) * d), 1, 1);
      }
    }
  }

  function drawWorld(D, showSel) {
    ctx.drawImage(bg, 0, 0);
    drawWater(D);
    const tw = showSel ? selectedTower() : null;
    if (showSel && hover && !(sel && hover.c === sel.c && hover.r === sel.r)) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(hover.c * T, TOP + hover.r * T, T, T);
    }
    if (showSel && sel) {
      const x = sel.c * T;
      const y = TOP + sel.r * T;
      ctx.fillStyle = (t >> 4) % 2 ? '#fff8e0' : '#ffd23f';
      for (const [cx, cy] of [[0, 0], [T - 3, 0], [0, T - 3], [T - 3, T - 3]]) {
        ctx.fillRect(x + cx, y + cy + (cy ? 2 : 0), 3, 1);
        ctx.fillRect(x + cx + (cx ? 2 : 0), y + cy, 1, 3);
      }
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, TOP, W, PANEL - TOP);
    ctx.clip();
    drawPollen(D);
    // Ground bugs and towers, back to front.
    const things = [...D.towers.map((x) => ({ y: TOP + x.r * T + T, tw: x })), ...D.bugs.filter((b) => !b.air).map((b) => ({ y: b.y + 4, b }))];
    things.sort((a, b) => a.y - b.y);
    for (const th of things) (th.tw ? drawTower(th.tw) : drawBug(th.b));
    for (const b of D.bugs) if (b.air) drawBug(b);
    drawShots(D);
    drawFx();
    for (const b of D.bugs) drawHp(b);
    if (tw) drawRange(tw.x, tw.y, PG.stat(tw, 'range'));
    ctx.restore();
  }

  function drawHud(D) {
    rect(0, 0, W, TOP, '#173018');
    rect(0, TOP - 1, W, 1, '#3a8a2a');
    ctx.drawImage(SPR.egg, 3, 5);
    text(D.eggs, 10, 6, { color: D.eggs <= 5 && (t >> 4) % 2 ? '#ff7a9a' : '#fff8e0', outline: null });
    ctx.drawImage(SPR.coin, 30, 5);
    text(D.coins, 37, 6, { color: '#ffd23f', outline: null });
    text(`WAVE ${Math.max(1, D.wave)}`, 108, 6, { align: 'center', color: '#b6ee74', outline: null });
    // Pause button.
    rect(W - 13, 4, 2, 8, '#fff8e0');
    rect(W - 9, 4, 2, 8, '#fff8e0');
  }

  function button(b, { color = '#f3e3c0', on = true } = {}) {
    rect(b.x, b.y, b.w, b.h, '#173018');
    rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, on ? color : '#a89a86');
    rect(b.x + 1, b.y + b.h - 3, b.w - 2, 2, on ? 'rgba(122,79,34,0.35)' : 'rgba(0,0,0,0.15)');
  }

  function drawPanel() {
    drawPlanks();
    const tw = selectedTower();
    const dark = { color: '#173018', outline: null };
    if (tw) {
      const def = TOWERS[tw.type];
      const img = ICON[tw.type];
      rect(3, PANEL + 3, 76, 42, 'rgba(23,48,24,0.35)');
      ctx.drawImage(img, 5 + ((14 - img.width) >> 1), PANEL + 6 + Math.max(0, 14 - img.height));
      text(def.name, 22, PANEL + 6, { color: '#fff8e0' });
      for (let i = 0; i < 3; i++) rect(22 + i * 5, PANEL + 13, 4, 3, i <= tw.level ? '#ffd23f' : '#4a2e14');
      const lines = [];
      if (tw.type === 'lily') {
        lines.push(`SLOW -${Math.round((1 - PG.stat(tw, 'slow')) * 100)}`);
        if (PG.stat(tw, 'dps')) lines.push('STINGS TOO');
      } else {
        lines.push(`HIT ${PG.stat(tw, 'dmg')}`);
        if (tw.type === 'toad') lines.push('NOT FLIES');
      }
      lines.push(`RANGE ${PG.stat(tw, 'range')}`);
      lines.slice(0, 3).forEach((l, i) => text(l, 6, PANEL + 22 + i * 8, { color: '#ffe2b0', outline: null }));
      const cost = PG.upgradeCost(tw);
      button(BTN.upgrade, { color: '#b6ee74', on: cost !== null && G.coins >= cost });
      text('UPGRADE', BTN.upgrade.x + 23, PANEL + 10, { align: 'center', ...dark });
      if (cost === null) text('MAX', BTN.upgrade.x + 23, PANEL + 25, { align: 'center', ...dark });
      else {
        ctx.drawImage(SPR.coin, BTN.upgrade.x + 10, PANEL + 24);
        text(cost, BTN.upgrade.x + 17, PANEL + 25, dark);
      }
      button(BTN.sell, { color: '#ffb37a' });
      text('SELL', BTN.sell.x + 14, PANEL + 10, { align: 'center', ...dark });
      text(`+${PG.sellValue(tw)}`, BTN.sell.x + 14, PANEL + 25, { align: 'center', ...dark });
      return;
    }
    if (sel) {
      TOWER_ORDER.forEach((type, i) => {
        const b = CARD(i);
        const def = TOWERS[type];
        const ok = G.coins >= def.cost[0];
        button(b, { on: ok });
        const img = ICON[type];
        ctx.globalAlpha = ok ? 1 : 0.55;
        ctx.drawImage(img, b.x + ((b.w - img.width) >> 1), b.y + 20 - img.height);
        ctx.globalAlpha = 1;
        text(def.name, b.x + (b.w >> 1), b.y + 23, { align: 'center', ...dark });
        ctx.drawImage(SPR.coin, b.x + 7, b.y + 31);
        text(def.cost[0], b.x + 14, b.y + 32, { color: ok ? '#173018' : '#7a2020', outline: null });
      });
      return;
    }
    text('SCORE', 5, PANEL + 6, { color: '#ffe2b0', outline: null });
    text(G.score, 5, PANEL + 14, { scale: 2, color: '#fff8e0' });
    text(`BEST ${Math.max(best, G.score)}`, 5, PANEL + 34, { color: '#ffe2b0', outline: null });
    button(BTN.speed, { color: speed > 1 ? '#ffd23f' : '#f3e3c0' });
    text('>'.repeat(speed), BTN.speed.x + 13, PANEL + 12, { align: 'center', scale: 2 - (speed === 3 ? 1 : 0), ...dark });
    text(`${speed}X`, BTN.speed.x + 13, PANEL + 30, { align: 'center', ...dark });
    const b = BTN.wave;
    if (G.inWave) {
      button(b, { on: false });
      const left = G.queue.length + G.bugs.length;
      text(`WAVE ${G.wave}`, b.x + 32, PANEL + 10, { align: 'center', ...dark });
      text(`${left} BUG${left === 1 ? '' : 'S'} LEFT`, b.x + 32, PANEL + 24, { align: 'center', color: '#4a2e14', outline: null });
    } else {
      const next = G.wave + 1;
      const boss = next % 10 === 0;
      const pulse = G.wave === 0 && G.towers.length > 0 && (t >> 4) % 2;
      button(b, { color: boss ? '#ffb37a' : pulse ? '#fff8e0' : '#b6ee74' });
      text(G.wave === 0 ? 'START!' : 'NEXT WAVE', b.x + 32, PANEL + 8, { align: 'center', ...dark });
      text(boss ? `BOSS WAVE ${next}` : `WAVE ${next}`, b.x + 32, PANEL + 18, { align: 'center', color: boss ? '#9c1f24' : '#3a5a20', outline: null });
      if (G.breakT > 0) text(`IN ${Math.ceil(G.breakT / 60)}`, b.x + 32, PANEL + 30, { align: 'center', color: '#4a2e14', outline: null });
      else if (G.wave === 0) text('WHEN READY', b.x + 32, PANEL + 30, { align: 'center', color: '#4a2e14', outline: null });
    }
  }

  function drawHint() {
    if (state !== 'play' || G.wave > 0) return;
    let msg = null;
    if (!G.towers.length) msg = sel ? ['PICK A TOWER BELOW', 'FROGS ARE CHEAP'] : ['TAP THE GRASS', 'NEXT TO THE TRAIL'];
    else if (G.towers.length < 3 && G.coins >= 15) msg = ['YOU CAN AFFORD MORE', 'OR TAP START!'];
    if (!msg || banner) return;
    const y = 100;
    rect(14, y - 4, W - 28, 24, 'rgba(23,48,24,0.8)');
    text(msg[0], W / 2, y, { align: 'center', color: '#ffd23f' });
    text(msg[1], W / 2, y + 10, { align: 'center' });
  }

  function drawBanner() {
    if (!banner) return;
    const k = Math.min(1, banner.life / 15, (130 - banner.life) / 10 + 0.3);
    ctx.globalAlpha = Math.max(0, Math.min(1, k));
    rect(0, 92, W, 32, 'rgba(23,48,24,0.75)');
    text(banner.title, W / 2, 97, { align: 'center', scale: 2, color: banner.color });
    text(banner.sub, W / 2, 112, { align: 'center' });
    ctx.globalAlpha = 1;
  }

  function drawSpeaker(x, y) {
    rect(x - 1, y - 1, 15, 13, '#173018');
    ctx.fillStyle = '#fff8e0';
    ctx.fillRect(x + 1, y + 3, 3, 5);
    ctx.fillRect(x + 4, y + 2, 1, 7);
    ctx.fillRect(x + 5, y + 1, 1, 9);
    if (soundOn) {
      ctx.fillRect(x + 8, y + 3, 1, 5);
      ctx.fillRect(x + 10, y + 1, 1, 9);
    } else {
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(x + 7 + i, y + 3 + i, 1, 1);
        ctx.fillRect(x + 11 - i, y + 3 + i, 1, 1);
      }
    }
  }

  function big(img, x, y, s) {
    ctx.drawImage(img, Math.round(x - (img.width * s) / 2), Math.round(y - img.height * s), img.width * s, img.height * s);
  }

  function drawMedal(m, x, y) {
    for (const [r, c] of [[13, '#173018'], [12, m ? m.rim : '#a89a86'], [10, m ? m.fill : '#cfc3ae']]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (m) ctx.drawImage(SPR.frog, x - 7, y - 6);
    else text('?', x + 1, y - 2, { align: 'center', color: '#a89a86', outline: null });
  }

  /** The site's high score table (leaderboard.js); returns 0 when offline. */
  function drawBoard(y, rows) {
    return (
      window.Indie24Scores?.draw('pond-guard', {
        text,
        rect,
        x: 8,
        y,
        w: W - 16,
        rows,
        colors: { panel: 'rgba(23, 48, 24, 0.85)', edge: '#b6ee74', title: '#b6ee74', text: '#fff8e0', dim: '#cfe8b0', you: '#ffd23f', youBar: 'rgba(255, 210, 63, 0.22)', medals: ['#ffd23f', '#f4fbff', '#ffb37a'] },
      }) || 0
    );
  }

  function drawPlanks() {
    rect(0, PANEL, W, H - PANEL, '#6b4420');
    rect(0, PANEL, W, 2, '#a8743a');
    for (let y = PANEL + 12; y < H; y += 12) rect(0, y, W, 1, '#5a3818');
  }

  function drawTitle() {
    drawPlanks();
    rect(0, 0, W, H, 'rgba(23,48,24,0.45)');
    rect(0, 0, W, TOP, '#173018');
    const bob = Math.round(Math.sin(t / 25) * 2);
    text('POND', W / 2, 20 + bob, { align: 'center', scale: 4, color: '#b6ee74', outline: '#173018' });
    text('GUARD', W / 2, 44 + bob, { align: 'center', scale: 4, color: '#ffd23f', outline: '#173018' });
    text('SAVE THE FROG EGGS!', W / 2, 70, { align: 'center', color: '#fff8e0' });
    big(SPR.frog, 36, 108, 2);
    big(SPR.lily, W / 2, 108, 2);
    big(SPR.heron, W - 34, 110, 2);
    if ((t >> 5) % 2 === 0) {
      const touch = matchMedia('(pointer: coarse)').matches;
      text(touch ? 'TAP TO START' : 'CLICK OR SPACE TO START', W / 2, 117, { align: 'center', color: '#ffd23f' });
    }
    if (best) text(`BEST ${best}  WAVES ${bestWave}`, W / 2, 128, { align: 'center', color: '#cfe8b0' });
    const h = drawBoard(142, 5);
    if (!h) {
      rect(10, 144, W - 20, 56, 'rgba(23,48,24,0.85)');
      ['TAP GRASS TO BUILD', 'TAP A TOWER TO UPGRADE', 'STOP THE BUGS BEFORE', 'THEY REACH THE POND!'].forEach((l, i) => text(l, W / 2, 152 + i * 11, { align: 'center' }));
    }
    drawSpeaker(5, H - 16);
  }

  function drawOver() {
    drawPlanks();
    rect(0, 0, W, H, 'rgba(23,48,24,0.6)');
    const y0 = 20;
    const k = Math.min(1, stateT / 20);
    ctx.globalAlpha = k;
    text('THE EGGS', W / 2, y0, { align: 'center', scale: 2, color: '#ff9ec4' });
    text('ARE GONE!', W / 2, y0 + 14, { align: 'center', scale: 2, color: '#ff9ec4' });
    const cy = y0 + 34;
    rect(10, cy, W - 20, 92, '#173018');
    rect(11, cy + 1, W - 22, 90, '#f3e3c0');
    text('MEDAL', 40, cy + 6, { align: 'center', color: '#7a4f22', outline: null });
    drawMedal(medalShown, 40, cy + 30);
    text(medalShown ? medalShown.name : 'NONE YET', 40, cy + 48, { align: 'center', color: '#4a2e14', outline: null });
    text('WAVES', W - 18, cy + 6, { align: 'right', color: '#7a4f22', outline: null });
    text(G.cleared, W - 18, cy + 14, { align: 'right', scale: 2, color: '#173018', outline: null });
    text('SCORE', W - 18, cy + 28, { align: 'right', color: '#7a4f22', outline: null });
    text(G.score, W - 18, cy + 36, { align: 'right', scale: 2, color: '#173018', outline: null });
    text(`BEST ${best}`, W - 18, cy + 50, { align: 'right', color: '#7a4f22', outline: null });
    if (newBest && (t >> 4) % 2 === 0) text('NEW BEST!', W - 18, cy + 60, { align: 'right', color: '#c43a3a', outline: null });
    const next = [...PG.MEDALS].reverse().find((m) => G.cleared < m.at);
    const left = next ? next.at - G.cleared : 0;
    text(next ? `${left} MORE WAVE${left === 1 ? '' : 'S'} FOR ${next.name}` : 'ALL HAIL THE POND KING!', W / 2, cy + 76, { align: 'center', color: '#4a2e14', outline: null });
    ctx.globalAlpha = 1;
    if (stateT > 24) drawBoard(cy + 98, 4);
    if (stateT > 50 && (t >> 5) % 2 === 0) {
      const touch = matchMedia('(pointer: coarse)').matches;
      text(touch ? 'TAP TO PLAY AGAIN' : 'SPACE TO PLAY AGAIN', W / 2, H - 14, { align: 'center', color: '#ffd23f' });
    }
  }

  function drawPaused() {
    rect(0, 0, W, H, 'rgba(23,48,24,0.65)');
    text('PAUSED', W / 2, 100, { align: 'center', scale: 3, color: '#ffd23f' });
    text('TAP OR PRESS P', W / 2, 130, { align: 'center' });
    text('TO KEEP PLAYING', W / 2, 140, { align: 'center' });
    const keys = ['1-4 BUILD  U UPGRADE', 'S SELL  N NEXT WAVE', 'F SPEED  M SOUND', 'ARROWS MOVE THE CURSOR'];
    if (!matchMedia('(pointer: coarse)').matches) keys.forEach((l, i) => text(l, W / 2, 166 + i * 10, { align: 'center', color: '#cfe8b0' }));
    drawSpeaker(5, H - 16);
  }

  function drawToast() {
    if (performance.now() > toastUntil) return;
    const w = toastText.length * 4 + 10;
    rect((W - w) >> 1, 20, w, 13, 'rgba(23,48,24,0.9)');
    text(toastText, W / 2, 24, { align: 'center', color: '#ffd23f', outline: null });
  }

  function render() {
    ctx.save();
    if (shake > 0) ctx.translate(Math.round((Math.random() * 2 - 1) * shake * 0.3), Math.round((Math.random() * 2 - 1) * shake * 0.3));
    const D = state === 'title' || state === 'over' ? demo : G;
    drawWorld(D, state === 'play');
    drawPopups();
    ctx.restore();
    if (state === 'title') return drawTitle(), drawToast();
    if (state === 'over') return drawOver(), drawToast();
    drawHud(G);
    drawPanel();
    drawHint();
    drawBanner();
    if (state === 'dying') {
      rect(0, 0, W, H, `rgba(196,58,58,${Math.min(0.35, stateT / 120)})`);
    }
    if (state === 'paused') drawPaused();
    drawToast();
  }

  function wantedSong() {
    if (state === 'title') return 'title';
    if (state === 'over' || state === 'dying') return 'over';
    if (G.bugs.some((b) => b.type === 'stag')) return 'boss';
    return G.inWave ? 'pond' : 'rest';
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
    music.update(wantedSong(), !soundOn || document.hidden ? 0 : state === 'paused' ? 0.3 : 1);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  canvas.focus();

  // Hooks for automated tests and screenshots.
  window.__pondGuard = {
    get state() { return state; },
    get game() { return G; },
    get best() { return best; },
    start: startGame,
    select(c, r) { sel = c === null ? null : { c, r }; },
    setSpeed(s) { speed = s; },
    tap,
    finish() { finishRun(); },
  };
})();
