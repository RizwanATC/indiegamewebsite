// Bumble Dash: a portrait, one-tap flying game for INDIE/24.
// Tap to flap and steer a bumblebee through gaps in thorny bramble vines.
// All art is drawn in code below and all sound is made live with WebAudio,
// so there are no asset files. The same files run on the website and inside
// the Android app.
(function () {
  'use strict';

  // ---------------------------------------------------------------- setup --
  const W = 144;
  const H = 256;
  const STEP = 1000 / 60;
  const GY = 230; // top of the ground
  const SW = 18; // bramble stem width
  const CAP = 8; // height of the flowery cap at each gap edge
  const SPACING = 86; // distance between bramble columns
  const BX = 40; // the bee's x position
  const BR = 4.5; // the bee's hit radius (a little smaller than it looks)
  const GRAVITY = 0.25;
  const FLAP = -3.75;
  const MAX_FALL = 5.6;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  function fit() {
    const raw = Math.min(innerWidth / W, innerHeight / H);
    // Whole-number scales only once they stay sharp without wasting much screen.
    const s = raw >= 4 ? Math.floor(raw) : raw;
    canvas.style.width = `${Math.floor(W * s)}px`;
    canvas.style.height = `${Math.floor(H * s)}px`;
  }
  addEventListener('resize', fit);
  fit();

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('bumble-dash.' + k);
        return v === null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('bumble-dash.' + k, JSON.stringify(v));
      } catch {
        /* storage unavailable: scores just won't be kept */
      }
    },
  };
  let best = store.get('best', 0);
  let soundOn = store.get('sound', true);
  let flights = store.get('flights', 0);

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
    ',': '000000000010100',
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
  function text(str, x, y, { scale = 1, color = '#fff8e0', align = 'left', outline = '#2b1d14' } = {}) {
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

  // -------------------------------------------------------------- sprites --
  // Pixel art as strings: each letter is a colour from the palette, '.' is clear.
  const PAL = {
    k: '#2b1d14', y: '#ffcc33', o: '#e8961e', b: '#3a2a20', e: '#ffffff', p: '#1a120c', r: '#ff8fa3',
    s: '#7a4a22', w: '#f4fbff', W: '#b9dcff', q: '#e8452c', h: '#ffb627', H: '#d9801a', l: '#fff3b0',
    g: '#ffdd3a', R: '#c43a3a',
  };
  function sprite(rows) {
    const c = document.createElement('canvas');
    c.width = rows[0].length;
    c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle = PAL[ch];
      g.fillRect(x, y, 1, 1);
    }));
    return c;
  }
  const SPR = {
    bee: sprite([
      '..........k.k...',
      '....kkkkkkk.k...',
      '..kkybbyybbkk...',
      '.kyyybbyybbyykk.',
      '.kyyybbyybbyyeek',
      'kyyyybbyybbyyepk',
      'kyyyybbyybbyyyyk',
      'kyyyybbyybbyyrrk',
      'skoyybbyybbyyyk.',
      '.koooobbooobbok.',
      '..kkoobbooobkk..',
      '....kkkkkkkk....',
    ]),
    wings: [
      sprite(['..ww..', '.wwww.', 'wwWWww', 'wWWWw.', '.kkk..']),
      sprite(['......', '......', 'wwwww.', 'wWWWww', '.kkkk.']),
      sprite(['......', '......', '.kkk..', 'wWWWw.', 'wwWWww', '.wwww.']),
    ],
    wasp: sprite([
      '..kkkk............',
      '.kRRRRk....kkkkk..',
      'kRkeeRk...kgbgbgk.',
      'kRRekRk.kkgbgbgbgk',
      '.kRRRRkkbkgbgbgbks',
      '..kkkk...kgbgbgk..',
      '..k..k....kkkkk...',
    ]),
    waspWings: [
      sprite(['.wwww..', 'wWWWWw.', '.wwwwk.', '..kk...']),
      sprite(['.......', '..kk...', 'wWWWWw.', '.wwww..']),
    ],
    honey: sprite(['...k...', '..khk..', '.khlhk.', '.klhhk.', 'khhhhHk', 'khhhhHk', '.khHHk.', '..kkk..']),
  };

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
    flap: () => (tone(330, 60, 'triangle', 0.05, 260), tone(180, 40, 'sawtooth', 0.012, 60)),
    point: () => (tone(988, 60, 'square', 0.025), tone(1319, 110, 'square', 0.025, 0, 60)),
    honey: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 90, 'triangle', 0.05, 0, i * 55)),
    hit: () => (tone(150, 260, 'sawtooth', 0.07, -90), tone(90, 200, 'square', 0.05, -40)),
    fall: () => tone(620, 520, 'square', 0.025, -480),
    medal: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 140, 'triangle', 0.05, 0, i * 90)),
    buzz: () => tone(220, 160, 'sawtooth', 0.02, 40),
    click: () => tone(660, 40, 'square', 0.025),
  };

  // -------------------------------------------------------------- version --
  // Bump VERSION together with version.json (and the APK in public/downloads)
  // for each Android release. The app runs from file:// and asks the website
  // for the latest version.json, so it can offer the newer APK on the title.
  const VERSION = '1.0.0';
  const VERSION_URL = 'https://indiegamewebsite.vercel.app/play/bumble-dash/version.json';
  let newVersion = null; // { version, apk } once a newer APK is known
  function isNewer(a, b) {
    const x = a.split('.').map(Number);
    const y = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
    return false;
  }
  if (location.protocol === 'file:') {
    fetch(VERSION_URL, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        if (v && typeof v.version === 'string' && /^https:\/\//.test(v.apk ?? '') && isNewer(v.version, VERSION)) newVersion = v;
      })
      .catch(() => {
        /* offline: just play */
      });
  }
  // The app opens https links in the phone's browser, which downloads the APK.
  const openUpdate = () => (location.href = newVersion.apk);

  // ---------------------------------------------------------------- music --
  // Chiptune songs written as note data. Each song is bars of 16 sixteenth
  // steps: a note name starts a note, '-' holds it, '.' is a rest. Bass and
  // arpeggio follow the chord of each bar (two chords split the bar in half).
  const SONGS = {
    title: {
      bpm: 96,
      chords: ['C', 'Am', 'F', 'G'],
      lead: [
        'E5 - - - G5 - E5 - D5 - C5 - D5 - - -',
        'C5 - - - E5 - A5 - G5 - E5 - - - . .',
        'F5 - - - A5 - F5 - E5 - D5 - C5 - - -',
        'D5 - - - B4 - G4 - B4 - D5 - - - . .',
      ],
      bass: 'R - - - 5 - - - R - - - 5 - - -',
      drums: 'k . . . h . . . k . . . h . . .',
      arp: true,
      leadVol: 0.8,
    },
    // Meadow and sunset: bright and bouncy.
    day: {
      bpm: 140,
      chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'],
      lead: [
        'C5 - E5 - G5 - E5 - C6 - - - G5 - - -',
        'B4 - D5 - G5 - D5 - B4 - - - G4 - - -',
        'A4 - C5 - E5 - A5 - G5 - E5 - C5 - - -',
        'F5 - E5 - D5 - C5 - A4 - - - . . . .',
        'C5 - E5 - G5 - E5 - C6 - - - E6 - - -',
        'D6 - B5 - G5 - B5 - D6 - - - . . . .',
        'C6 - A5 - F5 - A5 - C6 - A5 - F5 - - -',
        'G5 - - - D5 - - - B4 - - - D5 - - -',
      ],
      bass: 'R . R . 5 . R . R . R . 5 . 8 .',
      drums: 'k . h . s . h . k . k . s . h .',
      arp: true,
      leadVol: 0.75,
    },
    // Night garden: softer, a bit mysterious.
    night: {
      bpm: 116,
      chords: ['Am', 'F', 'C', 'G'],
      lead: [
        'A4 - - - C5 - E5 - - - D5 - C5 - - -',
        'F4 - - - A4 - C5 - - - B4 - A4 - - -',
        'G4 - - - C5 - E5 - - - G5 - E5 - - -',
        'D5 - - - B4 - - - G4 - - - . . . .',
      ],
      bass: 'R - - - - - 5 - R - - - 5 - - -',
      drums: 'k . . . h . . . k . . h h . . .',
      arp: true,
      leadVol: 0.8,
    },
    // Storm: fast and tense.
    storm: {
      bpm: 160,
      chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E'],
      lead: [
        'A4 - C5 - E5 - A5 - G5 - E5 - C5 - E5 -',
        'A5 - - - G5 - E5 - D5 - C5 - - - . .',
        'F5 - A5 - C6 - A5 - F5 - - - A5 - - -',
        'G5 - B5 - D6 - B5 - G5 - - - . . . .',
        'E5 - E5 - A5 - - - C6 - B5 - A5 - - -',
        'G5 - E5 - C5 - E5 - G5 - - - . . . .',
        'F5 - - - E5 - - - D5 - - - C5 - - -',
        'B4 - - - G#4 - - - E4 - - - . . . .',
      ],
      bass: 'R . R . R . 8 . R . R . 5 . 8 .',
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

  // ---------------------------------------------------------------- world --
  // The four places the garden turns into as the score climbs.
  const BIOMES = [
    { at: 0, name: 'MEADOW', skyTop: '#7fcbff', skyBot: '#d6f2ff', far: '#9fd68a', near: '#6fbf5a', grass: '#5cc23c', blade: '#3f9a2c', soil: '#b07a42', pebble: '#8a5a2e', cloud: '#ffffff', shade: null },
    { at: 10, name: 'SUNSET', skyTop: '#ff8f6b', skyBot: '#ffd99a', far: '#d39a72', near: '#a8735e', grass: '#7fb83a', blade: '#5a8a2a', soil: '#9c6238', pebble: '#734424', cloud: '#ffe2c8', shade: 'rgba(255,110,60,0.10)' },
    { at: 25, name: 'NIGHT', skyTop: '#141b45', skyBot: '#3a3f7e', far: '#2b3c64', near: '#1f2e4a', grass: '#2f6a4a', blade: '#1f4a36', soil: '#4a3a3a', pebble: '#2e2424', cloud: '#5a6094', shade: 'rgba(16,18,60,0.38)' },
    { at: 50, name: 'STORM', skyTop: '#353d4c', skyBot: '#6b7484', far: '#47544e', near: '#323e38', grass: '#3f7a46', blade: '#2a5532', soil: '#5a4636', pebble: '#3a2c22', cloud: '#8c95a3', shade: 'rgba(28,36,48,0.30)' },
  ];
  const biomeOf = (score) => BIOMES.reduce((b, x, i) => (score >= x.at ? i : b), 0);
  const MEDALS = [
    { at: 100, name: 'ROYAL', fill: '#b77cff', rim: '#6a3aa8' },
    { at: 50, name: 'GOLD', fill: '#ffd23f', rim: '#b8860b' },
    { at: 25, name: 'SILVER', fill: '#dfe6ee', rim: '#8a96a3' },
    { at: 10, name: 'BRONZE', fill: '#e0965a', rim: '#8f5426' },
  ];
  const medalFor = (score) => MEDALS.find((m) => score >= m.at) ?? null;

  // A small seeded random number generator, so a run can be replayed in tests.
  function rand(S) {
    S.seed = (S.seed + 0x6d2b79f5) | 0;
    let t = S.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Everything the simulation needs lives in S, so tests can copy it.
  function newRun(seed) {
    return {
      seed: seed | 0,
      t: 0,
      by: 112,
      vy: 0,
      score: 0,
      honey: 0,
      dead: false,
      speed: 1.25,
      cols: [],
      wasps: [],
      drops: [],
      made: 0, // columns made so far
      nextX: W + 30,
      lastC: 112,
      events: [], // sounds and effects for the renderer to pick up
    };
  }

  function makeColumn(S) {
    const n = S.made++;
    const gap = Math.max(46, 62 - n * 0.5);
    const lo = 30 + gap / 2;
    const hi = GY - 26 - gap / 2;
    let c = S.lastC + (rand(S) * 2 - 1) * Math.min(90, 40 + n * 3);
    c = Math.max(lo, Math.min(hi, c));
    const col = { x: S.nextX, c, gap, kind: 'plain', amp: 0, shift: 0, ph: rand(S) * 6.28, scored: false, knot: (rand(S) * 12) | 0 };
    // The garden cheats early and often, with no warning: some vines sway,
    // some squeeze shut as you get near, some jump the gap up or down.
    const r = rand(S);
    if (n >= 12 && r < 0.22) {
      col.kind = 'shift';
      const room = [hi - c, c - lo];
      const dir = room[0] > room[1] ? 1 : -1;
      col.shift = dir * Math.min(Math.max(room[0], room[1]), 26 + rand(S) * 10);
    } else if (n >= 8 && r < 0.45) col.kind = 'close';
    else if (n >= 3 && r < 0.8) {
      col.kind = 'sway';
      col.amp = Math.min(26, 12 + (n - 3) * 0.6);
      col.c = Math.max(lo + col.amp, Math.min(hi - col.amp, col.c));
    }
    if (col.kind === 'close') col.gap = Math.max(46, gap - 2);
    S.cols.push(col);
    // Between this column and the next: a honey drop, or a wasp.
    const midX = col.x + SW + (SPACING - SW) / 2;
    const r2 = rand(S);
    if (n >= 5 && r2 < 0.42) {
      S.wasps.push({ x: midX, y0: col.c, amp: 20 + rand(S) * 12, ph: rand(S) * 6.28, sp: 0.05 + rand(S) * 0.035, buzzed: false });
    } else if (r2 < 0.75) {
      S.drops.push({ x: midX, y: Math.max(40, Math.min(GY - 20, col.c + (rand(S) * 2 - 1) * 40)), got: false });
    }
    S.lastC = col.c + col.shift;
    S.nextX += SPACING;
  }

  // Where the gap of a column is right now.
  function gapOf(col) {
    let c = col.c;
    let gap = col.gap;
    if (col.kind === 'sway') c += Math.sin(col.ph + col.x * 0.05) * col.amp;
    if (col.kind === 'close') {
      // Starts wide and squeezes shut as the column reaches the bee.
      const k = Math.max(0, Math.min(1, (W - col.x) / (W - BX - 10)));
      gap = col.gap + 26 * (1 - k);
    }
    if (col.kind === 'shift') {
      // Sits still, then jumps up or down just before you get there.
      const k = Math.max(0, Math.min(1, (BX + 62 - col.x) / 16));
      c += col.shift * k * k * (3 - 2 * k);
    }
    return { top: c - gap / 2, bot: c + gap / 2 };
  }

  function waspPos(w, t) {
    return { x: w.x + Math.sin(t * 0.07 + w.ph) * 6, y: w.y0 + Math.sin(t * w.sp + w.ph) * w.amp };
  }

  function circleRect(cx, cy, r, x, y, w, h) {
    const nx = Math.max(x, Math.min(cx, x + w));
    const ny = Math.max(y, Math.min(cy, y + h));
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  }

  function hits(S) {
    const { by } = S;
    if (by + BR >= GY) return 'ground';
    for (const col of S.cols) {
      if (col.x > BX + 14 || col.x + SW < BX - 14) continue;
      const g = gapOf(col);
      if (
        circleRect(BX, by, BR, col.x, -50, SW, g.top + 50) ||
        circleRect(BX, by, BR, col.x - 3, g.top - CAP, SW + 6, CAP) ||
        circleRect(BX, by, BR, col.x, g.bot, SW, GY - g.bot) ||
        circleRect(BX, by, BR, col.x - 3, g.bot, SW + 6, CAP)
      )
        return 'bramble';
    }
    for (const w of S.wasps) {
      if (Math.abs(w.x - BX) > 20) continue;
      const p = waspPos(w, S.t);
      if ((p.x - BX) ** 2 + (p.y - by) ** 2 < (BR + 5) ** 2) return 'wasp';
    }
    return null;
  }

  // One 1/60 s step of the game. Pure apart from S, so tests can run it.
  function sim(S, flap) {
    if (S.dead) return;
    S.t++;
    if (flap) {
      S.vy = FLAP;
      S.events.push('flap');
    }
    S.vy = Math.min(MAX_FALL, S.vy + GRAVITY);
    S.by += S.vy;
    if (S.by < 4) {
      S.by = 4;
      S.vy = Math.max(0, S.vy);
    }
    S.speed = Math.min(1.95, 1.25 + S.made * 0.01);
    for (const col of S.cols) col.x -= S.speed;
    for (const w of S.wasps) w.x -= S.speed;
    for (const d of S.drops) d.x -= S.speed;
    S.nextX -= S.speed;
    while (S.nextX < W + 40) makeColumn(S);
    S.cols = S.cols.filter((c) => c.x > -30);
    S.wasps = S.wasps.filter((w) => w.x > -30);
    S.drops = S.drops.filter((d) => d.x > -20 && !d.got);
    for (const col of S.cols) {
      if (!col.scored && col.x + SW < BX - BR) {
        col.scored = true;
        S.score++;
        S.events.push('point');
      }
    }
    for (const d of S.drops) {
      if (!d.got && Math.abs(d.x - BX) < 7 && Math.abs(d.y - S.by) < 8) {
        d.got = true;
        S.score++;
        S.honey++;
        S.events.push(['honey', d.x, d.y]);
      }
    }
    for (const w of S.wasps) {
      if (!w.buzzed && w.x < W - 10) {
        w.buzzed = true;
        S.events.push('buzz');
      }
    }
    const hit = hits(S);
    if (hit) {
      S.dead = hit;
      S.events.push(['hit', hit]);
    }
  }

  // ------------------------------------------------------------ game state --
  let state = 'title'; // title | ready | play | dying | over | paused
  let S = newRun(1);
  let t = 0; // frames since the page opened, for idle animation
  let stateT = 0; // frames in the current state
  let scroll = 0; // ground and background scroll
  let wingT = 0;
  let tilt = 0;
  let shake = 0;
  let flash = 0;
  let bolt = 0; // lightning in the storm
  let newBest = false;
  let medalShown = null;
  let toastText = '';
  let toastUntil = 0;
  const puffs = []; // little particles
  const pops = []; // "+1" popups
  let view = { from: 0, to: 0, k: 1 }; // biome blend for the background
  let clouds = [];
  const stars = Array.from({ length: 34 }, (_, i) => ({ x: (i * 53) % W, y: (i * 29) % 120 + 4, p: i * 0.7 }));
  const flies = Array.from({ length: 9 }, (_, i) => ({ x: (i * 37) % W, y: 70 + ((i * 47) % 140), p: i }));
  for (let i = 0; i < 5; i++) clouds.push({ x: i * 40 + 6, y: 16 + ((i * 23) % 60), w: 16 + ((i * 7) % 14) });

  function setState(s) {
    state = s;
    stateT = 0;
  }
  function toast(msg) {
    toastText = msg;
    toastUntil = performance.now() + 1400;
  }

  function getReady() {
    S = newRun((Math.random() * 2 ** 31) | 0);
    tilt = 0;
    newBest = false;
    medalShown = null;
    puffs.length = 0;
    pops.length = 0;
    view = { from: view.to, to: 0, k: view.to === 0 ? 1 : 0 };
    setState('ready');
  }

  function action() {
    unlockAudio();
    if (state === 'title') {
      sfx.click();
      getReady();
    } else if (state === 'ready') {
      setState('play');
      flapNow();
    } else if (state === 'play') {
      flapNow();
    } else if (state === 'over' && stateT > 36) {
      sfx.click();
      getReady();
    } else if (state === 'paused') {
      setState('play');
    }
  }
  let flapQueued = false;
  function flapNow() {
    flapQueued = true;
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

  // ---------------------------------------------------------------- input --
  addEventListener('keydown', (e) => {
    unlockAudio();
    if (e.repeat) return;
    if ([' ', 'ArrowUp', 'w', 'W', 'Enter', 'z', 'Z', 'x', 'X'].includes(e.key)) {
      action();
      e.preventDefault();
    }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') pause();
    if (e.key === 'm' || e.key === 'M') toggleSound();
  });
  addEventListener('blur', () => {
    if (state === 'play') setState('paused');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'play') setState('paused');
  });

  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }
  // Taps are handled once, from pointer or touch events, whichever comes first.
  let lastTap = -1e9;
  function tap(x, y) {
    const now = performance.now();
    if (now - lastTap < 60) return;
    lastTap = now;
    unlockAudio();
    if (state === 'title') {
      if (newVersion && y < 36) return openUpdate();
      if (x < 22 && y > H - 22) return toggleSound();
    }
    if (state === 'play' && x > W - 24 && y < 22) return pause();
    if (state === 'over' && stateT > 36 && x < 22 && y > H - 22) return toggleSound();
    action();
  }
  addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    tap(p.x, p.y);
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

  let padPrev = {};
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find(Boolean);
    if (!p) return;
    const b = (i) => Boolean(p.buttons[i]?.pressed);
    const cur = { flap: b(0) || b(1) || b(12), start: b(9) };
    if (cur.flap && !padPrev.flap) action();
    if (cur.start && !padPrev.start) state === 'play' || state === 'paused' ? pause() : action();
    padPrev = cur;
  }

  // --------------------------------------------------------------- update --
  function spawnPuff(x, y, color, n, spread = 1) {
    for (let i = 0; i < n; i++) {
      puffs.push({ x, y, vx: (Math.random() * 2 - 1) * spread - 0.4, vy: (Math.random() * 2 - 1) * spread, life: 18 + Math.random() * 14, color });
    }
  }

  function handleEvents() {
    for (const ev of S.events) {
      const [kind, a, b] = Array.isArray(ev) ? ev : [ev];
      if (kind === 'flap') {
        sfx.flap();
        wingT = 0;
        spawnPuff(BX - 6, S.by + 2, 'rgba(255,255,255,0.8)', 2, 0.5);
      } else if (kind === 'point') {
        sfx.point();
        pops.push({ x: BX + 4, y: S.by - 12, life: 30, txt: '+1' });
      } else if (kind === 'honey') {
        sfx.honey();
        spawnPuff(a, b, '#ffdd3a', 10, 1.4);
        pops.push({ x: a, y: b - 10, life: 40, txt: 'HONEY +1' });
      } else if (kind === 'buzz') {
        sfx.buzz();
      } else if (kind === 'hit') {
        sfx.hit();
        shake = 10;
        flash = 4;
        spawnPuff(BX, S.by, a === 'bramble' ? '#ff7aa8' : '#ffdd3a', 12, 1.6);
        S.vy = a === 'ground' ? 0 : -2.2;
        setTimeout(() => state === 'dying' && sfx.fall(), 160);
        setState('dying');
      }
    }
    S.events.length = 0;
  }

  function finishRun() {
    flights++;
    store.set('flights', flights);
    if (S.score > best) {
      best = S.score;
      newBest = S.score > 0;
      store.set('best', best);
    }
    medalShown = medalFor(S.score);
    if (medalShown) setTimeout(() => state === 'over' && sfx.medal(), 500);
    setState('over');
  }

  function update() {
    t++;
    stateT++;
    pollPad();
    if (state === 'paused') return;
    const speed = state === 'play' ? S.speed : state === 'dying' || state === 'over' ? 0 : 1.1;
    scroll += speed;
    wingT++;
    for (const c of clouds) {
      c.x -= speed * 0.18;
      if (c.x < -c.w - 10) c.x += W + c.w + 30;
    }
    if (state === 'title' || state === 'ready') {
      S.by = (state === 'title' ? 150 : 112) + Math.sin(t / 14) * 4;
      tilt = 0;
    } else if (state === 'play') {
      const flap = flapQueued;
      flapQueued = false;
      sim(S, flap);
      handleEvents();
      const target = Math.max(-0.45, Math.min(1.25, (S.vy - 1.2) * 0.22));
      tilt += (target - tilt) * 0.3;
      const b = biomeOf(S.score);
      if (b !== view.to) {
        view = { from: view.to, to: b, k: 0 };
        toast(BIOMES[b].name);
      }
    } else if (state === 'dying') {
      S.vy = Math.min(MAX_FALL, S.vy + GRAVITY);
      S.by = Math.min(GY - 5, S.by + S.vy);
      tilt = Math.min(1.57, tilt + 0.12);
      if (S.by >= GY - 5 && stateT > 24) finishRun();
    }
    if (state !== 'play') flapQueued = false;
    if (view.k < 1) view.k = Math.min(1, view.k + 1 / 90);
    if (shake > 0) shake--;
    if (flash > 0) flash--;
    if (bolt > 0) bolt--;
    else if (view.to === 3 && state === 'play' && Math.random() < 0.004) bolt = 14;
    for (const p of puffs) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;
      p.life--;
    }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].life <= 0) puffs.splice(i, 1);
    for (const p of pops) {
      p.y -= 0.4;
      p.life--;
    }
    for (let i = pops.length - 1; i >= 0; i--) if (pops[i].life <= 0) pops.splice(i, 1);
  }

  // --------------------------------------------------------------- render --
  function mix(a, b, k) {
    if (k >= 1) return b;
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }
  function palette() {
    const a = BIOMES[view.from];
    const b = BIOMES[view.to];
    const out = {};
    for (const key of ['skyTop', 'skyBot', 'far', 'near', 'grass', 'blade', 'soil', 'pebble', 'cloud']) out[key] = mix(a[key], b[key], view.k);
    out.shadeA = view.k < 0.5 ? a.shade : b.shade;
    out.shadeK = view.k < 0.5 ? 1 - view.k * 2 : view.k * 2 - 1;
    out.night = (view.from === 2 ? 1 - view.k : 0) + (view.to === 2 ? view.k : 0);
    out.storm = (view.from === 3 ? 1 - view.k : 0) + (view.to === 3 ? view.k : 0);
    return out;
  }

  function drawSky(P) {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, P.skyTop);
    g.addColorStop(1, P.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY);
    if (P.night > 0) {
      ctx.globalAlpha = P.night;
      for (const s of stars) {
        ctx.fillStyle = Math.sin(t / 20 + s.p) > 0.6 ? '#ffffff' : '#9aa6e8';
        ctx.fillRect(s.x, s.y, 1, 1);
      }
      ctx.fillStyle = '#fff6d0';
      ctx.beginPath();
      ctx.arc(112, 34, 10, 0, 6.29);
      ctx.fill();
      ctx.fillStyle = P.skyTop;
      ctx.beginPath();
      ctx.arc(117, 30, 9, 0, 6.29);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (P.storm < 0.5) {
      // A low sun in the day and at sunset.
      ctx.fillStyle = view.to === 1 ? '#ffe08a' : '#fff6c4';
      ctx.beginPath();
      ctx.arc(110, view.to === 1 ? 120 : 36, 11, 0, 6.29);
      ctx.fill();
    }
    ctx.fillStyle = P.cloud;
    for (const c of clouds) {
      const x = Math.round(c.x);
      ctx.fillRect(x, c.y + 4, c.w, 5);
      ctx.fillRect(x + 3, c.y + 1, c.w - 8, 4);
      ctx.fillRect(x + c.w / 2 - 2, c.y - 2, 8, 4);
    }
  }

  function drawHills(P) {
    const far = scroll * 0.25;
    const near = scroll * 0.5;
    ctx.fillStyle = P.far;
    for (let x = 0; x < W; x++) {
      const h = 46 + Math.sin((x + far) * 0.035) * 9 + Math.sin((x + far) * 0.083) * 4;
      ctx.fillRect(x, GY - h, 1, h);
    }
    ctx.fillStyle = P.near;
    for (let x = 0; x < W; x++) {
      const h = 24 + Math.sin((x + near) * 0.05 + 2) * 7 + Math.sin((x + near) * 0.12) * 3;
      ctx.fillRect(x, GY - h, 1, h);
    }
  }

  // A bramble: two thorny canes twisted round each other, with a clump of
  // leaves, blossoms and berries where they end at the gap.
  const CANE = { dark: '#3d1a2c', mid: '#8a3f5e', light: '#c06a8a', thorn: '#f3e6c0' };
  function drawStem(x, y0, y1, knot) {
    x = Math.round(x);
    y0 = Math.max(-2, Math.round(y0));
    y1 = Math.round(y1);
    if (y1 <= y0) return;
    for (let y = y0; y < y1; y++) {
      const s = Math.sin((y + knot * 7) * 0.11);
      const a = Math.round(5 + 5 * s);
      const b = Math.round(5 - 5 * s);
      // The cane behind is drawn first and darker.
      const [back, front] = s > 0 ? [b, a] : [a, b];
      ctx.fillStyle = CANE.dark;
      ctx.fillRect(x + back, y, 8, 1);
      ctx.fillStyle = '#6a2f48';
      ctx.fillRect(x + back + 1, y, 6, 1);
      ctx.fillStyle = CANE.dark;
      ctx.fillRect(x + front, y, 8, 1);
      ctx.fillStyle = CANE.mid;
      ctx.fillRect(x + front + 1, y, 6, 1);
      ctx.fillStyle = CANE.light;
      ctx.fillRect(x + front + 2, y, 2, 1);
      // Thorns stick out of the outer edges every few pixels.
      const k = (y + knot * 3) % 9;
      if (k === 0 || k === 1) {
        ctx.fillStyle = CANE.thorn;
        const left = Math.min(a, b);
        const right = Math.max(a, b) + 8;
        if ((y + knot) % 18 < 9) ctx.fillRect(x + left - 1 - k, y, 1 + k, 1);
        else ctx.fillRect(x + right, y, 1 + k, 1);
      }
      // Now and then a leaf.
      if ((y + knot * 5) % 37 === 0) {
        const side = (y + knot) % 74 < 37;
        const lx = side ? x + Math.max(a, b) + 7 : x + Math.min(a, b) - 6;
        ctx.fillStyle = '#2f5d2a';
        ctx.fillRect(lx, y, 7, 3);
        ctx.fillStyle = '#6fbf4a';
        ctx.fillRect(lx + 1, y + 1, 5, 1);
      }
    }
  }
  function blob(x, y, r, color) {
    ctx.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.round(Math.sqrt(r * r - dy * dy));
      ctx.fillRect(x - w, y + dy, w * 2 + 1, 1);
    }
  }
  function drawCap(x, y, down) {
    x = Math.round(x);
    y = Math.round(y);
    const cy = y + 4;
    // A leafy clump: dark outline first, then the leaves.
    for (const [dx, dy, r] of [[3, 0, 4], [9, -1, 5], [16, 0, 4], [20, 1, 3], [-2, 1, 3]]) blob(x + dx, cy + dy, r + 1, '#1f3d1c');
    for (const [dx, dy, r] of [[3, 0, 4], [9, -1, 5], [16, 0, 4], [20, 1, 3], [-2, 1, 3]]) blob(x + dx, cy + dy, r, '#3f8a34');
    ctx.fillStyle = '#6fbf4a';
    for (const [dx, dy] of [[1, -2], [8, -4], [15, -2], [19, 0]]) ctx.fillRect(x + dx, cy + dy, 3, 1);
    // Blossoms and berries.
    for (const [dx, dy] of [[4, 1], [13, 0], [-1, 2]]) {
      ctx.fillStyle = '#ffd9e6';
      ctx.fillRect(x + dx - 1, cy + dy, 3, 1);
      ctx.fillRect(x + dx, cy + dy - 1, 1, 3);
      ctx.fillStyle = '#ffcf3a';
      ctx.fillRect(x + dx, cy + dy, 1, 1);
    }
    for (const [dx, dy] of [[9, 2], [18, 2]]) {
      ctx.fillStyle = '#2a1030';
      ctx.fillRect(x + dx, cy + dy, 3, 3);
      ctx.fillStyle = '#7a3a8a';
      ctx.fillRect(x + dx, cy + dy, 1, 1);
    }
    // Thorns pointing into the gap.
    ctx.fillStyle = CANE.thorn;
    for (const dx of [0, 6, 12, 18]) {
      const ty = down ? y + CAP + 1 : y - 2;
      ctx.fillRect(x + dx, ty, 1, 2);
    }
  }

  function drawColumns() {
    for (const col of S.cols) {
      if (col.x > W + 10 || col.x < -30) continue;
      const g = gapOf(col);
      drawStem(col.x, -2, g.top - CAP, col.knot);
      drawCap(col.x, g.top - CAP, true);
      drawStem(col.x, g.bot + CAP, GY, col.knot + 5);
      drawCap(col.x, g.bot, false);
    }
  }

  function drawPickups() {
    for (const d of S.drops) {
      if (d.got) continue;
      const bob = Math.round(Math.sin((t + d.x) / 10) * 1.5);
      if ((t >> 3) % 6 === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(d.x) + 3, Math.round(d.y) - 6 + bob, 1, 1);
      }
      ctx.drawImage(SPR.honey, Math.round(d.x) - 3, Math.round(d.y) - 4 + bob);
    }
    for (const w of S.wasps) {
      const p = waspPos(w, S.t);
      const x = Math.round(p.x) - 9;
      const y = Math.round(p.y) - 3;
      ctx.drawImage(SPR.wasp, x, y);
      ctx.drawImage(SPR.waspWings[(t >> 1) % 2], x + 9, y - 3);
    }
  }

  function drawBee(x, y, angle, scale = 1) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (angle) ctx.rotate(angle);
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.drawImage(SPR.bee, -8, -6);
    const frame = state === 'dying' || state === 'over' ? 1 : Math.floor(wingT / 3) % 4;
    const wf = [0, 1, 2, 1][frame];
    ctx.globalAlpha = 0.9;
    ctx.drawImage(SPR.wings[wf], -3, wf === 0 ? -10 : wf === 1 ? -8 : -7);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawGround(P) {
    ctx.fillStyle = P.soil;
    ctx.fillRect(0, GY, W, H - GY);
    ctx.fillStyle = P.pebble;
    const off = Math.floor(scroll) % 24;
    for (let x = -off; x < W + 24; x += 24) {
      ctx.fillRect(x + 3, GY + 10, 3, 2);
      ctx.fillRect(x + 15, GY + 17, 2, 2);
      ctx.fillRect(x + 9, GY + 22, 4, 1);
    }
    ctx.fillStyle = '#2b1d14';
    ctx.fillRect(0, GY, W, 1);
    ctx.fillStyle = P.grass;
    ctx.fillRect(0, GY + 1, W, 5);
    ctx.fillStyle = P.blade;
    const o2 = Math.floor(scroll) % 6;
    for (let x = -o2; x < W; x += 6) {
      ctx.fillRect(x, GY - 1, 1, 2);
      ctx.fillRect(x + 3, GY + 5, 2, 1);
    }
    // Little flowers along the grass.
    const o3 = Math.floor(scroll) % 37;
    for (let x = -o3; x < W + 37; x += 37) {
      ctx.fillStyle = '#3f9a2c';
      ctx.fillRect(x + 10, GY - 3, 1, 3);
      ctx.fillStyle = (x + Math.floor(scroll)) % 74 < 37 ? '#ff7aa8' : '#ffffff';
      ctx.fillRect(x + 9, GY - 4, 3, 1);
      ctx.fillRect(x + 10, GY - 5, 1, 3);
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(x + 10, GY - 4, 1, 1);
    }
  }

  function drawWeather(P) {
    if (P.shadeA) {
      ctx.globalAlpha = P.shadeK;
      ctx.fillStyle = P.shadeA;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (P.night > 0.05) {
      for (const f of flies) {
        const x = (f.x - scroll * 0.3 + Math.sin(t / 40 + f.p) * 8) % W;
        const y = f.y + Math.sin(t / 30 + f.p * 2) * 6;
        const on = Math.sin(t / 15 + f.p) > 0;
        if (!on) continue;
        ctx.globalAlpha = P.night * 0.35;
        ctx.fillStyle = '#d9ff7a';
        ctx.fillRect(Math.round((x + W) % W) - 1, Math.round(y) - 1, 3, 3);
        ctx.globalAlpha = P.night;
        ctx.fillRect(Math.round((x + W) % W), Math.round(y), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (P.storm > 0.05) {
      ctx.globalAlpha = 0.5 * P.storm;
      ctx.fillStyle = '#c9d6ea';
      for (let i = 0; i < 40; i++) {
        const x = (i * 37 + t * 2 - scroll) % (W + 20);
        const y = (i * 61 + t * 5) % (H + 20);
        ctx.fillRect(Math.round((x + W + 20) % (W + 20)) - 10, y - 10, 1, 4);
      }
      ctx.globalAlpha = 1;
      if (bolt > 0) {
        ctx.fillStyle = `rgba(230,240,255,${(bolt / 14) * 0.25})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  function drawFx() {
    for (const p of puffs) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 16));
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    ctx.globalAlpha = 1;
    for (const p of pops) {
      ctx.globalAlpha = Math.min(1, p.life / 12);
      text(p.txt, p.x, p.y, { align: 'center', color: '#ffe066' });
    }
    ctx.globalAlpha = 1;
  }

  function drawSpeaker(x, y) {
    ctx.fillStyle = '#2b1d14';
    ctx.fillRect(x - 1, y - 1, 15, 13);
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

  function drawMedal(m, x, y) {
    ctx.fillStyle = '#2b1d14';
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, 6.29);
    ctx.fill();
    ctx.fillStyle = m ? m.rim : '#a89a86';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, 6.29);
    ctx.fill();
    ctx.fillStyle = m ? m.fill : '#cfc3ae';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 6.29);
    ctx.fill();
    if (m) {
      drawBee(x, y + 1, 0);
      if ((t >> 3) % 8 === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 6, y - 7, 2, 2);
      }
    } else {
      text('?', x + 1, y - 2, { align: 'center', color: '#a89a86', outline: null });
    }
  }

  function drawTitle() {
    const bob = Math.round(Math.sin(t / 25) * 2);
    text('BUMBLE', W / 2, 40 + bob, { align: 'center', scale: 4, color: '#ffcc33', outline: '#2b1d14' });
    text('DASH', W / 2, 66 + bob, { align: 'center', scale: 4, color: '#ff7aa8', outline: '#2b1d14' });
    text('FLAP THROUGH THE BRAMBLES', W / 2, 96, { align: 'center', color: '#2b1d14', outline: null });
    // A honey trail behind the bee.
    for (let i = 0; i < 3; i++) ctx.drawImage(SPR.honey, 74 + i * 18, 145 + Math.round(Math.sin(t / 10 + i) * 2));
    drawBee(BX + 10, S.by, Math.sin(t / 30) * 0.1, 1);
    const touch = matchMedia('(pointer: coarse)').matches;
    if ((t >> 5) % 2 === 0) text(touch ? 'TAP TO START' : 'CLICK OR SPACE TO START', W / 2, 182, { align: 'center', color: '#fff8e0' });
    text(`BEST ${best}`, W / 2, 196, { align: 'center', color: '#ffe066' });
    text('A GAME BY INDIE/24', W / 2, 214, { align: 'center', color: '#fff8e0' });
    text(`V${VERSION}`, W - 3, H - 9, { align: 'right', color: '#fff8e0' });
    drawSpeaker(5, H - 16);
    if (newVersion) {
      ctx.fillStyle = '#b8323c';
      ctx.fillRect(6, 6, W - 12, 24);
      text(`NEW VERSION ${newVersion.version}`, W / 2, 10, { align: 'center' });
      if ((t >> 5) % 2 === 0) text('TAP HERE TO DOWNLOAD', W / 2, 20, { align: 'center', color: '#fff6c2' });
    }
  }

  function drawReady() {
    text('GET READY', W / 2, 52, { align: 'center', scale: 2, color: '#ffe066' });
    const touch = matchMedia('(pointer: coarse)').matches;
    text(touch ? 'TAP TO FLAP' : 'SPACE OR CLICK TO FLAP', W / 2, 150, { align: 'center' });
    text('DODGE THE THORNS', W / 2, 160, { align: 'center' });
    // A little pointing finger, tapping.
    const y = 128 + ((t >> 4) % 2 ? 0 : 2);
    ctx.fillStyle = '#2b1d14';
    ctx.fillRect(BX + 22, y, 7, 9);
    ctx.fillRect(BX + 24, y - 6, 3, 7);
    ctx.fillStyle = '#ffe2c8';
    ctx.fillRect(BX + 23, y + 1, 5, 7);
    ctx.fillRect(BX + 25, y - 5, 1, 7);
  }

  function drawHud() {
    text(S.score, W / 2, 14, { align: 'center', scale: 3, color: '#fff8e0' });
    if (state === 'play') {
      // Pause button.
      ctx.fillStyle = 'rgba(43,29,20,0.55)';
      ctx.fillRect(W - 15, 4, 11, 11);
      ctx.fillStyle = '#fff8e0';
      ctx.fillRect(W - 12, 7, 2, 5);
      ctx.fillRect(W - 8, 7, 2, 5);
    }
  }

  function drawOver() {
    const k = Math.min(1, stateT / 14);
    const y0 = Math.round(62 + (1 - k) * 40);
    ctx.globalAlpha = k;
    text('OUCH!', W / 2, y0 - 22, { align: 'center', scale: 3, color: '#ff7aa8' });
    ctx.fillStyle = '#2b1d14';
    ctx.fillRect(18, y0, W - 36, 84);
    ctx.fillStyle = '#fff1c4';
    ctx.fillRect(19, y0 + 1, W - 38, 82);
    ctx.fillStyle = '#ffdc7a';
    ctx.fillRect(19, y0 + 1, W - 38, 3);
    text('MEDAL', 46, y0 + 9, { align: 'center', color: '#9a6a3a', outline: null });
    drawMedal(medalShown, 46, y0 + 36);
    text(medalShown ? medalShown.name : 'NONE YET', 46, y0 + 56, { align: 'center', color: '#6a4a2a', outline: null });
    text('SCORE', W - 30, y0 + 9, { align: 'right', color: '#9a6a3a', outline: null });
    text(S.score, W - 30, y0 + 17, { align: 'right', scale: 2, color: '#2b1d14', outline: null });
    text('BEST', W - 30, y0 + 33, { align: 'right', color: '#9a6a3a', outline: null });
    text(best, W - 30, y0 + 41, { align: 'right', scale: 2, color: '#2b1d14', outline: null });
    if (newBest && (t >> 4) % 2 === 0) text('NEW BEST!', W - 30, y0 + 56, { align: 'right', color: '#e8452c', outline: null });
    const next = [...MEDALS].reverse().find((m) => S.score < m.at);
    text(next ? `${next.at - S.score} MORE FOR ${next.name}` : 'ROYAL BEE!', W / 2, y0 + 70, { align: 'center', color: '#6a4a2a', outline: null });
    ctx.globalAlpha = 1;
    if (stateT > 36 && (t >> 5) % 2 === 0) {
      const touch = matchMedia('(pointer: coarse)').matches;
      text(touch ? 'TAP TO FLY AGAIN' : 'SPACE TO FLY AGAIN', W / 2, y0 + 96, { align: 'center', color: '#fff8e0' });
    }
    if (S.honey) text(`HONEY DROPS ${S.honey}`, W / 2, y0 + 110, { align: 'center', color: '#ffe066' });
    if (stateT > 36) drawSpeaker(5, H - 16);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(43,29,20,0.55)';
    ctx.fillRect(0, 0, W, H);
    text('PAUSED', W / 2, 100, { align: 'center', scale: 3, color: '#ffe066' });
    text('TAP OR PRESS P', W / 2, 130, { align: 'center' });
    text('TO KEEP FLYING', W / 2, 140, { align: 'center' });
    text('M: SOUND ' + (soundOn ? 'ON' : 'OFF'), W / 2, 160, { align: 'center', color: '#fff1c4' });
  }

  function drawToast() {
    if (performance.now() > toastUntil) return;
    const w = toastText.length * 4 + 10;
    ctx.fillStyle = 'rgba(43,29,20,0.85)';
    ctx.fillRect((W - w) >> 1, 40, w, 13);
    text(toastText, W / 2, 44, { align: 'center', color: '#ffe066', outline: null });
  }

  function render() {
    const P = palette();
    ctx.save();
    if (shake > 0) ctx.translate(Math.round((Math.random() * 2 - 1) * shake * 0.4), Math.round((Math.random() * 2 - 1) * shake * 0.4));
    drawSky(P);
    drawHills(P);
    if (state !== 'title') {
      drawColumns();
      drawPickups();
    }
    drawGround(P);
    drawWeather(P);
    if (state !== 'title') drawBee(BX, S.by, tilt);
    drawFx();
    ctx.restore();
    if (flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(0, 0, W, H);
    }
    if (state === 'title') drawTitle();
    else if (state === 'ready') drawReady();
    if (state === 'play' || state === 'paused' || state === 'ready' || state === 'dying') drawHud();
    if (state === 'over') drawOver();
    if (state === 'paused') drawPaused();
    drawToast();
  }

  function wantedSong() {
    if (state === 'title') return 'title';
    if (state === 'over' || state === 'dying') return 'over';
    if (view.to === 3) return 'storm';
    if (view.to === 2) return 'night';
    return 'day';
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

  // Hooks for automated tests: read the game, and run the simulation headless.
  window.__bumbleDash = {
    get state() { return state; },
    get score() { return S.score; },
    get best() { return best; },
    get biome() { return BIOMES[view.to].name; },
    get version() { return VERSION; },
    get newVersion() { return newVersion; },
    sim: {
      newRun,
      step: sim,
      gapOf,
      waspPos,
      clone: (s) => JSON.parse(JSON.stringify(s)),
      consts: { W, H, GY, SW, BX, BR, GRAVITY, FLAP },
    },
    // Put the live game into a given run (for screenshots).
    load(run, st = 'play') {
      S = run;
      S.events.length = 0;
      view = { from: biomeOf(S.score), to: biomeOf(S.score), k: 1 };
      setState(st);
    },
    finish() { finishRun(); },
  };
})();
