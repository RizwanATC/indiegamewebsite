// Slime Siege: a portrait, vertically scrolling action shooter for INDIE/24.
// All sprites are original and drawn by scripts/generate-slime-siege-art.mjs.
// The same files run on the website and inside the Android app.
(function () {
  'use strict';

  // ---------------------------------------------------------------- setup --
  const W = 176;
  const H = 320;
  const STEP = 1000 / 60;
  const TILE = 16;
  const PATH_L = 3; // path occupies tile columns PATH_L..PATH_R
  const PATH_R = 7;

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
        const v = localStorage.getItem('slime-siege.' + k);
        return v === null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('slime-siege.' + k, JSON.stringify(v));
      } catch {
        /* storage unavailable */
      }
    },
  };
  let hiScore = store.get('hi', 0);
  let soundOn = store.get('sound', true);

  // --------------------------------------------------------------- assets --
  const IMG = {};
  const FILES = ['player', 'slime', 'skeleton', 'chicken', 'cow', 'pig', 'sheep', 'decor', 'oak', 'oak-small', 'chest', 'fences', 'grass', 'path', 'house'];
  const loaded = Promise.all(
    FILES.map(
      (name) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve((IMG[name] = img));
          img.onerror = () => reject(new Error('Could not load ' + name));
          img.src = `assets/${name}.png`;
        }),
    ),
  );

  /** Draw cell (col,row) of a sprite sheet with the given cell size. */
  function cell(img, size, col, row, x, y, { flip = false, scale = 1, sw = size, sh = size } = {}) {
    const dw = sw * scale;
    const dh = sh * scale;
    x = Math.round(x);
    y = Math.round(y);
    if (flip) {
      ctx.save();
      ctx.translate(x + dw, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, col * size, row * size, sw, sh, 0, 0, dw, dh);
      ctx.restore();
    } else ctx.drawImage(img, col * size, row * size, sw, sh, x, y, dw, dh);
  }
  const decor = (col, row, x, y, w = 1, h = 1) => ctx.drawImage(IMG.decor, col * 16, row * 16, w * 16, h * 16, Math.round(x), Math.round(y), w * 16, h * 16);

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
  /** Outlined pixel text, readable on any background. */
  function text(str, x, y, { color = '#fff', scale = 1, align = 'left', outline = '#2b1d14' } = {}) {
    str = String(str);
    const w = (str.length * 4 - 1) * scale;
    if (align === 'center') x -= Math.floor(w / 2);
    if (align === 'right') x -= w;
    const glyphs = (dx, dy, c) => {
      ctx.fillStyle = c;
      for (let i = 0; i < str.length; i++) {
        const ch = str[i] === 'x' ? 'x' : str[i].toUpperCase();
        const g = FONT[ch] || FONT['?'];
        for (let p = 0; p < 15; p++) if (g[p] === '1') ctx.fillRect(x + dx + (i * 4 + (p % 3)) * scale, y + dy + ((p / 3) | 0) * scale, scale, scale);
      }
    };
    if (outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) glyphs(dx, dy, outline);
    glyphs(0, 0, color);
  }

  // Small sprites the pack doesn't include, drawn in its palette.
  const PIX = {
    heart: ['.11.11.', '1221111', '1211111', '.11111.', '..111..', '...1...'],
    heartEmpty: ['.11.11.', '1.....1', '1.....1', '.1...1.', '..1.1..', '...1...'],
    slash: ['...1111...', '.11222211.', '1223333221', '12......21', '1........1'],
    bone: ['1..1', '.11.', '.11.', '1..1'],
  };
  const PIX_COL = { 1: '#2b1d14', 2: '#ffffff', 3: '#fff6c2' };
  function pix(name, x, y, colors = {}) {
    const rows = PIX[name];
    x = Math.round(x);
    y = Math.round(y);
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < rows[j].length; i++) {
        const c = rows[j][i];
        if (c === '.') continue;
        ctx.fillStyle = colors[c] ?? PIX_COL[c];
        ctx.fillRect(x + i, y + j, 1, 1);
      }
  }

  // ---------------------------------------------------------------- sound --
  let audio = null;
  function tone(freq, ms, type = 'square', vol = 0.04, slide = 0) {
    if (!soundOn) return;
    try {
      if (!audio || audio.state !== 'running') return;
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
    slash: () => tone(900, 50, 'triangle', 0.03, -500),
    squish: () => tone(220, 90, 'sine', 0.07, -120),
    bone: () => tone(520, 70, 'square', 0.03, -200),
    hit: () => tone(300, 50, 'square', 0.03, -100),
    pick: () => (tone(880, 60, 'triangle', 0.05), setTimeout(() => tone(1320, 90, 'triangle', 0.05), 60)),
    hurt: () => tone(140, 300, 'sawtooth', 0.06, -60),
    moo: () => tone(160, 220, 'sawtooth', 0.04, 40),
    warn: () => tone(330, 160, 'square', 0.05),
    clear: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 120, 'triangle', 0.06), i * 120)),
  };

  // -------------------------------------------------------------- version --
  // Bump VERSION together with version.json (and upload the new APK) for each
  // Android release. The app runs from file:// and asks the website for the
  // latest version.json, so it can offer the newer APK on the title screen.
  const VERSION = '1.1.0';
  const VERSION_URL = 'https://indiegamewebsite.vercel.app/play/slime-siege/version.json';
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
  // Chiptune songs written as note data and played on the same audio context
  // as the sound effects, so there are no audio files to download. Each song
  // is bars of 16 sixteenth-note steps: a note name starts a note, '-' holds
  // it, '.' is a rest. Bass and arpeggio follow the chord of each bar (two
  // chords in one string split the bar in half).
  const SONGS = {
    title: {
      bpm: 100,
      chords: ['F', 'Dm', 'Bb', 'C'],
      lead: [
        'C5 - - - A4 - F4 - A4 - C5 - F5 - - -',
        'E5 - D5 - - - A4 - - - D5 - F5 - - -',
        'D5 - - - Bb4 - D5 - F5 - - - D5 - - -',
        'E5 - - - C5 - - - G4 - - - . . . .',
      ],
      bass: 'R - - - 5 - - - R - - - 5 - - -',
      drums: 'k . . . h . . . k . . . h . . .',
      arp: true,
    },
    // Green Meadow: bright and bouncy.
    stage0: {
      bpm: 132,
      chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F G', 'C'],
      lead: [
        'E5 - G5 - C6 - G5 - E5 - D5 - C5 - - -',
        'A4 - C5 - E5 - D5 C5 - - A4 - C5 - - -',
        'F5 - A5 - G5 - F5 - E5 - F5 - A5 - - -',
        'G5 - - - F5 E5 D5 - B4 - D5 - G5 - - -',
        'E5 - G5 - C6 - D6 - E6 - D6 - C6 - - -',
        'A5 - G5 - E5 - C5 - D5 - E5 - C5 - - -',
        'F5 - E5 - D5 - C5 - D5 - - - B4 - - -',
        'C5 - - - G4 - - - C5 - - - . . . .',
      ],
      bass: 'R . R . 5 . R . R . R . 5 . 8 .',
      drums: 'k . h . s . h . k . h k s . h .',
    },
    // Old Farm: a little hoedown.
    stage1: {
      bpm: 150,
      chords: ['G', 'G', 'C', 'G', 'G', 'D', 'G D', 'G'],
      lead: [
        'G4 - B4 - D5 - B4 - G4 - B4 - D5 - G5 -',
        'E5 - D5 - B4 - G4 - A4 - B4 - A4 - - -',
        'C5 - E5 - G5 - E5 - C5 - E5 - G5 - E5 -',
        'D5 - B4 - G4 - B4 - D5 - - - . . . .',
        'G5 - G5 - E5 - D5 - B4 - D5 - E5 - D5 -',
        'F#5 - E5 - D5 - A4 - D5 - E5 - F#5 - A5 -',
        'G5 - F#5 - E5 - D5 - C5 - B4 - A4 - F#4 -',
        'G4 - - - B4 - - - G4 - - - . . . .',
      ],
      bass: 'R . . . 5 . . . R . . . 5 . . .',
      drums: 'k . h . s . h . k . h . s . h h',
    },
    // Haunted Wood: slow and spooky, in a minor key.
    stage2: {
      bpm: 112,
      chords: ['Am', 'F', 'Dm', 'E', 'Am', 'F', 'Dm', 'E'],
      lead: [
        'A4 - - - C5 - - - E5 - - - D#5 - E5 -',
        'F5 - - - E5 - - - C5 - - - A4 - - -',
        'D5 - - - F5 - - - A5 - - - G#5 - A5 -',
        'B5 - - - G#5 - - - E5 - - - . . . .',
        'A5 - G5 - E5 - - - C5 - D5 - E5 - - -',
        'F5 - E5 - C5 - - - A4 - B4 - C5 - - -',
        'D5 - C5 - A4 - - - F4 - G4 - A4 - - -',
        'G#4 - - - B4 - - - E5 - - - - - - -',
      ],
      bass: 'R - - - R - - - R - - - 5 - R -',
      drums: 'k . . . . . h . s . . . . . h .',
      arp: true,
      leadVol: 0.75,
    },
    // Every boss: fast and driving.
    boss: {
      bpm: 168,
      chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B'],
      lead: [
        'E5 - E5 - G5 - E5 - A5 - G5 - E5 - D5 -',
        'E5 - - - B4 - - - D5 - E5 - - - . .',
        'C5 - E5 - G5 - C6 - B5 - G5 - E5 - C5 -',
        'D5 - F#5 - A5 - D6 - C6 - A5 - F#5 - D5 -',
        'B5 - B5 - A5 - G5 - A5 - G5 - F#5 - E5 -',
        'G5 - - - F#5 - - - E5 - - - B4 - - -',
        'C6 - B5 - A5 - G5 - E5 - G5 - A5 - C6 -',
        'B5 - - - D#5 - - - F#5 - - - B4 - - -',
      ],
      bass: 'R . R . 8 . R . R . R . 8 . R .',
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
    over: {
      bpm: 84,
      once: true,
      chords: ['Am', 'E Am'],
      lead: ['E5 - - - D5 - - - C5 - - - B4 - - -', 'A4 - - - - - - - - - - - . . . .'],
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
        voice(tones[s % 4] * 4, at, sixteenth * 0.9, 'square', 0.025);
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
            out.gain.setTargetAtTime(vol * 0.5, audio.currentTime, 0.05);
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

  function wantedSong() {
    switch (state) {
      case 'title':
        return 'title';
      case 'intro':
      case 'play':
      case 'paused':
        if (boss) return boss.dying ? null : 'boss';
        return 'stage' + stage;
      case 'clear':
        return 'clear';
      case 'over':
        return 'over';
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------- input --
  const input = { up: false, down: false, left: false, right: false, fire: false };
  let autoFire = store.get('auto', true);
  let specialPressed = false;
  let startPressed = false;
  let pausePressed = false;
  const drag = { id: null, lastX: 0, lastY: 0, dx: 0, dy: 0 };

  const KEYMAP = {
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowDown: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ' ': 'fire', j: 'fire', J: 'fire', z: 'fire', Z: 'fire',
  };
  addEventListener('keydown', (e) => {
    unlockAudio();
    const k = KEYMAP[e.key];
    if (k) {
      if (k === 'fire' && !input.fire) startPressed = true;
      input[k] = true;
      e.preventDefault();
    }
    if (e.key === 'Enter') startPressed = true;
    if (['x', 'X', 'k', 'K', 'Shift'].includes(e.key)) specialPressed = true;
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') pausePressed = true;
    if (e.key === 'm' || e.key === 'M') toggleSound();
    if (e.key === 'f' || e.key === 'F') toggleAuto();
  });
  addEventListener('keyup', (e) => {
    const k = KEYMAP[e.key];
    if (k) input[k] = false;
  });
  addEventListener('blur', () => {
    for (const k of Object.keys(input)) input[k] = false;
    if (state === 'play') state = 'paused';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'play') state = 'paused';
  });

  function toggleSound() {
    soundOn = !soundOn;
    store.set('sound', soundOn);
    toast(soundOn ? 'SOUND ON' : 'SOUND OFF');
  }
  function toggleAuto() {
    autoFire = !autoFire;
    store.set('auto', autoFire);
    toast(autoFire ? 'AUTO ATTACK ON' : 'AUTO ATTACK OFF');
  }

  // Touch: drag anywhere to move (relative, like most phone shooters).
  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  addEventListener('pointerdown', (e) => {
    unlockAudio();
    if (e.pointerType !== 'mouse') document.body.classList.add('touch');
    if (e.target instanceof Element && e.target.closest('button')) return;
    if (state === 'paused') {
      pausePressed = true;
      return;
    }
    if (state === 'title' && newVersion) {
      const r = canvas.getBoundingClientRect();
      if (((e.clientY - r.top) / r.height) * H < 36) {
        openUpdate();
        return;
      }
    }
    if (state !== 'play') {
      startPressed = true;
      return;
    }
    if (drag.id === null) {
      drag.id = e.pointerId;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
    }
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerId !== drag.id) return;
    const scale = canvas.getBoundingClientRect().width / W;
    drag.dx += (e.clientX - drag.lastX) / scale;
    drag.dy += (e.clientY - drag.lastY) / scale;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
  });
  const endDrag = (e) => {
    if (e.pointerId === drag.id) drag.id = null;
  };
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);
  // Backup for Safari on iPhone: a tap always starts the game, even if pointer
  // events don't arrive (older iOS, or inside the site's embedded player).
  // Blocking the default also stops the page behind from scrolling or zooming.
  addEventListener(
    'touchstart',
    (e) => {
      unlockAudio();
      document.body.classList.add('touch');
      if (e.target instanceof Element && e.target.closest('button')) return;
      if (state !== 'play' && state !== 'paused') startPressed = true;
      e.preventDefault();
    },
    { passive: false },
  );
  addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  for (const [id, fn] of [
    ['btn-special', () => (specialPressed = true)],
    ['btn-pause', () => (pausePressed = true)],
  ]) {
    const el = document.getElementById(id);
    el?.addEventListener('pointerdown', (e) => {
      unlockAudio();
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
  }

  let padPrev = {};
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find(Boolean);
    if (!p) return null;
    const b = (i) => Boolean(p.buttons[i]?.pressed);
    const cur = { fire: b(0), special: b(1) || b(2), start: b(9) };
    if (cur.special && !padPrev.special) specialPressed = true;
    if (cur.fire && !padPrev.fire) startPressed = true;
    if (cur.start && !padPrev.start) pausePressed = true;
    padPrev = cur;
    const ax = p.axes[0] || 0;
    const ay = p.axes[1] || 0;
    return { x: b(14) ? -1 : b(15) ? 1 : Math.abs(ax) > 0.25 ? ax : 0, y: b(12) ? -1 : b(13) ? 1 : Math.abs(ay) > 0.25 ? ay : 0, fire: cur.fire };
  }

  // ---------------------------------------------------------------- world --
  const STAGES = [
    { name: 'GREEN MEADOW', length: 2400, enemies: ['slime', 'slime', 'slime', 'skeleton'], boss: 'kingSlime' },
    { name: 'OLD FARM', length: 2700, enemies: ['slime', 'skeleton', 'skeleton', 'slime'], boss: 'boneLord' },
    { name: 'HAUNTED WOOD', length: 3000, enemies: ['skeleton', 'slime', 'skeleton', 'bigSlime'], boss: 'kingSlime' },
  ];
  const ANIMALS = ['chicken', 'pig', 'sheep', 'cow'];

  let state = 'loading'; // loading, error, title, intro, play, paused, dead, clear, over
  let t = 0;
  let stage = 0;
  let loop = 0;
  let score = 0;
  let lives = 3;
  let hero, slashes, foes, foeShots, items, animals, puffs, scenery, scroll, stageTime, nextWave, nextAnimal, boss, power;
  let toastText = '';
  let toastUntil = 0;
  let shake = 0;
  const rnd = Math.random;

  function toast(s) {
    toastText = s;
    toastUntil = performance.now() + 1300;
  }
  function setState(s) {
    state = s;
    t = 0;
  }

  // Scenery: tiles scroll down; decorations live in world rows.
  function newScenery() {
    scenery = [];
    for (let y = -H; y < H; y += 16) addSceneryRow(y);
  }
  function addSceneryRow(y) {
    const r = rnd();
    const side = rnd() < 0.5 ? 'L' : 'R';
    const x = side === 'L' ? rnd() * (PATH_L * TILE - 30) - 4 : (PATH_R + 1) * TILE + rnd() * (W - (PATH_R + 1) * TILE - 24);
    if (r < 0.12) scenery.push({ kind: 'oak', x: x - 10, y });
    else if (r < 0.3) scenery.push({ kind: 'small', v: 1 + ((rnd() * 2) | 0), x, y });
    else if (r < 0.55) scenery.push({ kind: 'deco', c: [[0, 1], [1, 1], [2, 1], [0, 0], [1, 0], [2, 0], [1, 2], [2, 2], [3, 0], [1, 8], [2, 7]][(rnd() * 11) | 0], x: x + 6, y });
    else if (r < 0.6) scenery.push({ kind: 'lamp', x: side === 'L' ? PATH_L * TILE - 14 : (PATH_R + 1) * TILE + 2, y });
    else if (r < 0.62 && stage === 1) scenery.push({ kind: 'house', x: side === 'L' ? -20 : W - 76, y: y - 100 });
    else if (r < 0.66) scenery.push({ kind: 'fence', x: side === 'L' ? 0 : W - 32, y });
    // Path pebbles
    if (rnd() < 0.25) scenery.push({ kind: 'pebble', v: (rnd() * 3) | 0, x: (PATH_L + 1 + ((rnd() * 3) | 0)) * TILE, y, under: true });
  }

  function resetHero() {
    hero = { x: W / 2 - 8, y: H - 70, cool: 0, inv: 120, frame: 0, moving: false, attack: 0, dead: 0, blooms: 1 };
    power = { kind: null, time: 0 };
  }

  function newGame() {
    score = 0;
    lives = 3;
    stage = 0;
    loop = 0;
    startStage();
  }

  function startStage() {
    slashes = [];
    foes = [];
    foeShots = [];
    items = [];
    animals = [];
    puffs = [];
    boss = null;
    scroll = 0;
    stageTime = 0;
    nextWave = 60;
    nextAnimal = 400;
    resetHero();
    newScenery();
    setState('intro');
  }

  const diff = () => 1 + loop * 0.4 + stage * 0.15;

  // ---------------------------------------------------------------- foes --
  // Hitboxes are relative to the sprite's top-left corner.
  const FOE = {
    slime: { hp: 2, pts: 10, w: 48, box: [17, 17, 15, 15], speed: 0.45 },
    bigSlime: { hp: 8, pts: 40, w: 64, box: [23, 21, 19, 21], speed: 0.35 },
    skeleton: { hp: 4, pts: 25, w: 32, box: [10, 8, 12, 18], speed: 0.4 },
  };

  function spawnWave() {
    const S = STAGES[stage];
    const type = S.enemies[(rnd() * S.enemies.length) | 0];
    const d = diff();
    const n = type === 'bigSlime' ? 1 : type === 'skeleton' ? 1 + (rnd() < 0.4 * d ? 1 : 0) : 2 + ((rnd() * 3) | 0);
    const formation = rnd() < 0.5 ? 'row' : 'column';
    const baseX = 20 + rnd() * (W - 72);
    for (let i = 0; i < n; i++) {
      const f = FOE[type];
      const x = formation === 'row' ? 8 + ((i + 0.5) * (W - 48)) / n + (rnd() * 10 - 5) : baseX + (i % 2) * 12;
      const y = formation === 'row' ? -32 - rnd() * 10 : -32 - i * 34;
      foes.push({ type, x, y, hp: Math.ceil(f.hp * (1 + loop * 0.5)), max: f.hp, flash: 0, age: (rnd() * 60) | 0, dying: 0, vx: 0, fireAt: 90 + ((rnd() * 80) | 0) });
    }
    nextWave = Math.max(45, (120 - stage * 12 - loop * 15) * (0.7 + rnd() * 0.6));
  }

  function spawnBoss() {
    const key = STAGES[stage].boss;
    const hp = Math.round((key === 'kingSlime' ? 70 : 90) * (1 + stage * 0.3 + loop * 0.6));
    boss = { key, x: W / 2 - 48, y: -100, hp, max: hp, flash: 0, age: 0, cool: 120, pts: (key === 'kingSlime' ? 400 : 600) * (loop + 1), dying: 0 };
    sfx.warn();
    setTimeout(sfx.warn, 260);
  }

  function shoot(x, y, speed, angle) {
    foeShots.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, spin: 0 });
  }
  function aimAt(x, y) {
    return Math.atan2(hero.y + 18 - y, hero.x + 16 - x);
  }

  // --------------------------------------------------------------- update --
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const foeBox = (f) => {
    const [bx, by, bw, bh] = FOE[f.type].box;
    return { x: f.x + bx, y: f.y + by, w: bw, h: bh };
  };
  const bossBox = () => (boss.key === 'kingSlime' ? { x: boss.x + 28, y: boss.y + 40, w: 40, h: 32 } : { x: boss.x + 30, y: boss.y + 18, w: 36, h: 56 });
  const heroBox = () => ({ x: hero.x + 11, y: hero.y + 12, w: 10, h: 14 });

  function updatePlay() {
    stageTime++;
    scroll += 0.5;
    const pad = pollPad();

    // Movement
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0) || pad?.x || 0;
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0) || pad?.y || 0;
    const speed = 1.6;
    let nx = hero.x + mx * speed + drag.dx * 1.2;
    let ny = hero.y + my * speed + drag.dy * 1.2;
    hero.moving = mx || my || Math.abs(drag.dx) + Math.abs(drag.dy) > 0.2;
    drag.dx = drag.dy = 0;
    hero.x = Math.max(-8, Math.min(W - 24, nx));
    hero.y = Math.max(H * 0.3, Math.min(H - 34, ny));
    if (hero.inv > 0) hero.inv--;
    hero.frame += hero.moving ? 0.2 : 0.1;

    // Attack
    if (hero.cool > 0) hero.cool--;
    if (hero.attack > 0) hero.attack--;
    const firing = autoFire || input.fire || pad?.fire;
    const rate = power.kind === 'swift' ? 9 : 15;
    if (firing && hero.cool === 0) {
      const cx = hero.x + 12;
      slashes.push({ x: cx, y: hero.y + 2, vx: 0 });
      if (power.kind === 'triple') {
        slashes.push({ x: cx - 4, y: hero.y + 4, vx: -0.8 });
        slashes.push({ x: cx + 4, y: hero.y + 4, vx: 0.8 });
      }
      hero.cool = rate;
      hero.attack = 12;
      sfx.slash();
    }
    if (power.time > 0 && --power.time === 0) power.kind = null;

    // Special: a "bloom" that clears enemy shots and damages everything on screen.
    if (specialPressed && hero.blooms > 0) {
      hero.blooms--;
      foeShots = [];
      for (const f of foes) if (!f.dying) hurtFoe(f, 3);
      if (boss) hurtBoss(10);
      puffs.push({ kind: 'bloom', x: hero.x + 16, y: hero.y + 16, t: 0 });
      shake = 10;
      tone(200, 400, 'sine', 0.08, 600);
    }
    specialPressed = false;

    for (const s of slashes) {
      s.y -= 4;
      s.x += s.vx;
    }
    slashes = slashes.filter((s) => s.y > -10 && !s.hit);

    // Scenery
    for (const s of scenery) s.y += 0.5;
    scenery = scenery.filter((s) => s.y < H + 120);
    while (scenery.length === 0 || Math.min(...scenery.map((s) => s.y)) > -H + 16) addSceneryRow(Math.min(...scenery.map((s) => s.y), H) - 16);

    // Waves, animals, boss
    const S = STAGES[stage];
    if (!boss && stageTime < S.length) {
      if (--nextWave <= 0) spawnWave();
      if (--nextAnimal <= 0) {
        const kind = ANIMALS[(rnd() * ANIMALS.length) | 0];
        const fromLeft = rnd() < 0.5;
        animals.push({ kind, x: fromLeft ? -32 : W, y: 40 + rnd() * 120, vx: (fromLeft ? 1 : -1) * (0.35 + rnd() * 0.3), frame: 0, scared: 0 });
        nextAnimal = 500 + rnd() * 500;
      }
      if (stageTime % 700 === 350) items.push({ kind: 'chest', x: (PATH_L + 1 + rnd() * 2) * TILE, y: -16, hp: 3 });
    } else if (!boss && foes.length === 0) spawnBoss();

    // Foes
    for (const f of foes) {
      f.age++;
      if (f.flash) f.flash--;
      if (f.dying) {
        f.dying++;
        continue;
      }
      const def = FOE[f.type];
      if (f.type === 'skeleton') {
        f.y += def.speed * Math.min(1.8, diff());
        f.x += Math.sign(hero.x - f.x) * 0.15;
        if (f.age % f.fireAt === 0 && f.y > 0) {
          shoot(f.x + 16, f.y + 16, 1.1 + stage * 0.1 + loop * 0.15, aimAt(f.x + 16, f.y + 16));
          sfx.bone();
        }
      } else {
        // Slimes hop: move only during the airborne part of the jump cycle.
        const phase = f.age % 64;
        const airborne = phase >= 24 && phase < 48;
        f.y += airborne ? def.speed * 2.6 * Math.min(1.8, diff()) : 0;
        if (airborne) f.x += Math.sin(f.age / 40 + f.fireAt) * 0.4;
      }
      f.x = Math.max(-8, Math.min(W - def.w + 8, f.x));
    }
    foes = foes.filter((f) => f.y < H + 10 && f.dying < 40);

    // Boss behaviour
    if (boss) updateBoss();

    // Foe shots
    for (const b of foeShots) {
      b.x += b.vx;
      b.y += b.vy;
      b.spin++;
    }
    foeShots = foeShots.filter((b) => b.x > -8 && b.x < W + 8 && b.y > -8 && b.y < H + 8);

    // Animals wander across; hitting them is bad, touching them is good.
    for (const a of animals) {
      a.x += a.vx * (a.scared ? 3 : 1);
      a.y += 0.5;
      a.frame += 0.08;
      if (a.scared) a.scared--;
    }
    animals = animals.filter((a) => !a.saved && a.x > -40 && a.x < W + 40 && a.y < H + 10);

    // Items
    for (const it of items) {
      it.y += 0.5;
      it.age = (it.age ?? 0) + 1;
    }

    // Collisions: slashes
    for (const s of slashes) {
      const sb = { x: s.x - 4, y: s.y, w: 8, h: 4 };
      for (const f of foes) {
        if (s.hit || f.dying) continue;
        if (overlap(sb, foeBox(f))) {
          s.hit = true;
          hurtFoe(f, 1);
        }
      }
      if (!s.hit && boss && !boss.dying && boss.y > -40 && overlap(sb, bossBox())) {
        s.hit = true;
        hurtBoss(1);
      }
      for (const a of animals) {
        if (!s.hit && overlap(sb, { x: a.x + 8, y: a.y + 10, w: 16, h: 14 })) {
          s.hit = true;
          a.scared = 40;
          a.vx = Math.sign(a.vx || 1) * 0.6;
          score = Math.max(0, score - 20);
          toast('DONT HIT THE ANIMALS! -20');
          sfx.moo();
        }
      }
      for (const it of items) {
        if (!s.hit && it.kind === 'chest' && overlap(sb, { x: it.x, y: it.y, w: 16, h: 16 })) {
          s.hit = true;
          if (--it.hp <= 0) openChest(it);
          else sfx.hit();
        }
      }
    }
    items = items.filter((it) => !it.gone && it.y < H + 10);

    // Collisions: hero
    const hb = heroBox();
    if (hero.inv === 0) {
      if (foeShots.some((b) => overlap({ x: b.x - 2, y: b.y - 2, w: 4, h: 4 }, hb))) hurtHero();
      else if (foes.some((f) => !f.dying && overlap(foeBox(f), hb))) hurtHero();
      else if (boss && !boss.dying && overlap(bossBox(), hb)) hurtHero();
    }
    for (const a of animals) {
      if (!a.scared && overlap({ x: a.x + 8, y: a.y + 10, w: 16, h: 14 }, hb)) {
        a.saved = true;
        score += 50;
        puffs.push({ kind: 'heart', x: a.x + 12, y: a.y, t: 0 });
        toast(`${a.kind.toUpperCase()} SAVED! +50`);
        sfx.pick();
      }
    }
    for (const it of items) {
      if (it.kind !== 'chest' && overlap({ x: it.x, y: it.y, w: 16, h: 16 }, hb)) {
        it.gone = true;
        collect(it);
      }
    }
  }

  function hurtFoe(f, dmg) {
    f.hp -= dmg;
    f.flash = 6;
    if (f.hp <= 0) {
      f.dying = 1;
      score += FOE[f.type].pts;
      sfx.squish();
      if (rnd() < (f.type === 'skeleton' ? 0.12 : f.type === 'bigSlime' ? 0.5 : 0.04)) dropItem(f.x + FOE[f.type].box[0], f.y + FOE[f.type].box[1]);
    } else sfx.hit();
  }
  function hurtBoss(dmg) {
    boss.hp -= dmg;
    boss.flash = 4;
    score += 1;
    if (boss.hp <= 0 && !boss.dying) {
      boss.dying = 1;
      score += boss.pts;
      foeShots = [];
      shake = 24;
      sfx.squish();
      sfx.clear();
    }
  }

  function dropItem(x, y) {
    const r = rnd();
    const kind = r < 0.3 ? 'carrot' : r < 0.55 ? 'gold' : r < 0.75 ? 'crystal' : r < 0.9 ? 'swift' : 'bloom';
    items.push({ kind, x, y });
  }
  function openChest(it) {
    it.gone = true;
    puffs.push({ kind: 'spark', x: it.x + 8, y: it.y + 8, t: 0 });
    sfx.pick();
    dropItem(it.x - 6, it.y);
    dropItem(it.x + 8, it.y - 4);
  }
  function collect(it) {
    sfx.pick();
    if (it.kind === 'carrot') {
      if (lives < 5) {
        lives++;
        toast('+1 HEART');
      } else {
        score += 100;
        toast('+100');
      }
    } else if (it.kind === 'gold') {
      score += 100;
      toast('GOLD +100');
    } else if (it.kind === 'crystal') {
      power = { kind: 'triple', time: 600 };
      toast('TRIPLE SLASH!');
    } else if (it.kind === 'swift') {
      power = { kind: 'swift', time: 600 };
      toast('SWIFT SLASH!');
    } else if (it.kind === 'bloom') {
      hero.blooms = Math.min(3, (hero.blooms ?? 0) + 1);
      toast('+1 BLOOM BOMB');
    }
  }

  function hurtHero() {
    lives--;
    sfx.hurt();
    shake = 12;
    if (lives <= 0) {
      hero.dead = 1;
      setState('dead');
    } else {
      hero.inv = 120;
      foeShots = foeShots.filter((b) => Math.hypot(b.x - hero.x - 16, b.y - hero.y - 16) > 40);
    }
  }

  function updateBoss() {
    boss.age++;
    if (boss.flash) boss.flash--;
    if (boss.dying) {
      boss.dying++;
      if (boss.dying > 90) {
        boss = null;
        setState('clear');
      }
      return;
    }
    if (boss.y < 20) {
      boss.y += 0.6;
      return;
    }
    boss.x = W / 2 - 48 + Math.sin(boss.age / 80) * 44;
    if (--boss.cool > 0) return;
    const cx = boss.x + 48;
    const cy = boss.y + 60;
    const pattern = ((boss.age / 240) | 0) % 3;
    const sp = 1.1 + stage * 0.1 + loop * 0.15;
    if (boss.key === 'kingSlime') {
      if (pattern === 0) {
        for (let i = -2; i <= 2; i++) shoot(cx, cy, sp, Math.PI / 2 + i * 0.3);
        boss.cool = 70;
      } else if (pattern === 1) {
        foes.push({ type: 'slime', x: cx - 24, y: cy - 24, hp: 2, flash: 0, age: 0, dying: 0, fireAt: 99 });
        boss.cool = 60;
      } else {
        shoot(cx, cy, sp * 1.3, aimAt(cx, cy));
        boss.cool = 30;
      }
    } else {
      if (pattern === 0) {
        const a0 = aimAt(cx, cy);
        for (let i = -1; i <= 1; i++) shoot(cx, cy, sp * 1.2, a0 + i * 0.2);
        boss.cool = 45;
      } else if (pattern === 1) {
        const spin = boss.age / 10;
        for (let i = 0; i < 8; i++) shoot(cx, cy, sp * 0.9, spin + (i * Math.PI) / 4);
        boss.cool = 80;
      } else {
        foes.push({ type: 'skeleton', x: rnd() < 0.5 ? 0 : W - 32, y: -30, hp: 3, flash: 0, age: 0, dying: 0, fireAt: 100 });
        boss.cool = 90;
      }
    }
    boss.cool = Math.max(18, boss.cool / (1 + loop * 0.3));
  }

  function update() {
    t++;
    if (pausePressed) {
      pausePressed = false;
      if (state === 'play') state = 'paused';
      else if (state === 'paused') state = 'play';
    }
    switch (state) {
      case 'title':
        scroll += 0.3;
        if (startPressed) newGame();
        break;
      case 'intro':
        if (t > 110 || (startPressed && t > 20)) setState('play');
        break;
      case 'play':
        updatePlay();
        break;
      case 'dead':
        if (t > 120) {
          if (score > hiScore) {
            hiScore = score;
            store.set('hi', hiScore);
          }
          setState('over');
        }
        break;
      case 'clear':
        if (t > 170) {
          stage++;
          if (stage >= STAGES.length) {
            stage = 0;
            loop++;
          }
          const keep = { blooms: hero.blooms };
          startStage();
          hero.blooms = Math.max(1, keep.blooms ?? 0);
        }
        break;
      case 'over':
        if (startPressed && t > 60) setState('title');
        break;
    }
    startPressed = false;
    for (const p of puffs ?? []) p.t++;
    puffs = (puffs ?? []).filter((p) => p.t < 40);
    if (shake > 0) shake--;
  }

  // ----------------------------------------------------------------- draw --
  function drawGround() {
    const off = Math.floor(scroll % TILE);
    for (let ty = -1; ty < H / TILE + 1; ty++) {
      const y = ty * TILE + off;
      for (let tx = 0; tx < W / TILE; tx++) {
        const x = tx * TILE;
        if (tx < PATH_L || tx > PATH_R) ctx.drawImage(IMG.grass, x, y);
        else {
          const col = tx === PATH_L ? 0 : tx === PATH_R ? 2 : 1;
          ctx.drawImage(IMG.path, col * 16, 16, 16, 16, x, y, 16, 16);
        }
      }
    }
  }

  function drawScenery(under) {
    for (const s of scenery) {
      if (Boolean(s.under) !== under) continue;
      if (s.kind === 'pebble') ctx.drawImage(IMG.path, s.v * 16, 80, 16, 16, s.x, Math.round(s.y), 16, 16);
      else if (s.kind === 'oak') ctx.drawImage(IMG.oak, Math.round(s.x), Math.round(s.y) - 60);
      else if (s.kind === 'small') ctx.drawImage(IMG['oak-small'], s.v * 32, 0, 32, 48, Math.round(s.x), Math.round(s.y) - 32, 32, 48);
      else if (s.kind === 'deco') decor(s.c[0], s.c[1], s.x, s.y, s.c[1] === 7 && s.c[0] < 2 ? 2 : 1);
      else if (s.kind === 'lamp') decor(4, 4, s.x, s.y - 32, 1, 3);
      else if (s.kind === 'house') ctx.drawImage(IMG.house, Math.round(s.x), Math.round(s.y));
      else if (s.kind === 'fence') ctx.drawImage(IMG.fences, 16, 0, 32, 16, Math.round(s.x), Math.round(s.y), 32, 16);
    }
  }

  function drawHero() {
    if (hero.dead) {
      const f = Math.min(3, (t / 12) | 0);
      cell(IMG.player, 32, f, 9, hero.x, hero.y);
      return;
    }
    if (hero.inv > 0 && (hero.inv >> 2) % 2) return;
    if (hero.attack > 0) cell(IMG.player, 32, 3 - ((hero.attack / 3) | 0), 8, hero.x, hero.y);
    else cell(IMG.player, 32, (hero.frame | 0) % 6, hero.moving ? 5 : 2, hero.x, hero.y);
  }

  function drawFoe(f) {
    if (f.type === 'skeleton') {
      if (f.dying) cell(IMG.skeleton, 32, Math.min(3, (f.dying / 8) | 0), 6, f.x, f.y);
      else if (f.flash) cell(IMG.skeleton, 32, 0, 7, f.x, f.y);
      else cell(IMG.skeleton, 32, ((f.age / 8) | 0) % 6, 3, f.x, f.y);
      return;
    }
    const scale = f.type === 'bigSlime' ? 1 : 0.75; // the slime sheet uses 64px cells
    if (f.dying) cell(IMG.slime, 64, Math.min(7, (f.dying / 5) | 0), 2, f.x, f.y, { scale });
    else {
      const phase = f.age % 64;
      const frame = phase < 24 ? ((f.age / 8) | 0) % 4 : 0 + Math.min(7, ((phase - 24) / 3) | 0);
      cell(IMG.slime, 64, frame, phase < 24 ? 0 : 1, f.x, f.y, { scale });
      if (f.flash % 2) {
        ctx.globalCompositeOperation = 'lighter';
        cell(IMG.slime, 64, frame, phase < 24 ? 0 : 1, f.x, f.y, { scale });
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  function drawBoss() {
    const b = boss;
    if (b.flash % 2) ctx.globalAlpha = 0.6;
    if (b.key === 'kingSlime') {
      const dying = b.dying;
      const frame = dying ? Math.min(7, (dying / 10) | 0) : ((b.age / 9) | 0) % 8;
      cell(IMG.slime, 64, frame, dying ? 2 : 1, b.x, b.y, { scale: 1.5 });
      // A little crown so it reads as a boss.
      if (!dying) {
        ctx.fillStyle = '#f7c548';
        const cx = Math.round(b.x + 40);
        const cy = Math.round(b.y + 30 + (frame >= 3 && frame <= 5 ? -14 : 0));
        ctx.fillRect(cx, cy + 4, 16, 4);
        for (let i = 0; i < 3; i++) ctx.fillRect(cx + i * 6, cy, 4, 4);
        ctx.fillStyle = '#d64545';
        ctx.fillRect(cx + 7, cy + 5, 2, 2);
      }
    } else {
      if (b.dying) cell(IMG.skeleton, 32, Math.min(3, (b.dying / 15) | 0), 6, b.x, b.y, { scale: 3 });
      else cell(IMG.skeleton, 32, ((b.age / 10) | 0) % 6, b.flash ? 7 : 0, b.x, b.y, { scale: 3 });
    }
    ctx.globalAlpha = 1;
  }

  function drawAnimal(a) {
    const flip = a.vx > 0;
    cell(IMG[a.kind], 32, (a.frame | 0) % 2, a.scared ? 1 : 0, a.x, a.y, { flip });
  }

  function drawItem(it) {
    const bob = Math.round(Math.sin((it.age ?? 0) / 10) * 1.5);
    if (it.kind === 'chest') ctx.drawImage(IMG.chest, Math.round(it.x), Math.round(it.y));
    else if (it.kind === 'carrot') decor(4, 3, it.x, it.y + bob);
    else if (it.kind === 'gold') decor(2, 6, it.x, it.y + bob);
    else if (it.kind === 'crystal') decor(3, 3, it.x, it.y + bob);
    else if (it.kind === 'swift') decor(6, 3, it.x, it.y + bob);
    else if (it.kind === 'bloom') decor(0, 8, it.x, it.y + bob);
  }

  function drawPuff(p) {
    if (p.kind === 'heart') pix('heart', p.x, p.y - p.t * 0.6, { 1: '#2b1d14', 2: '#ff6b81' });
    else if (p.kind === 'spark') {
      ctx.fillStyle = '#fff6c2';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.fillRect(Math.round(p.x + Math.cos(a) * p.t * 0.8), Math.round(p.y + Math.sin(a) * p.t * 0.8), 2, 2);
      }
    } else if (p.kind === 'bloom') {
      ctx.strokeStyle = `rgba(255, 240, 180, ${1 - p.t / 40})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.t * 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHud() {
    ctx.fillStyle = 'rgba(43, 29, 20, 0.55)';
    ctx.fillRect(0, 0, W, 14);
    for (let i = 0; i < Math.max(3, lives); i++) pix(i < lives ? 'heart' : 'heartEmpty', 3 + i * 9, 4, { 1: '#2b1d14', 2: '#ff6b81' });
    text(String(score).padStart(6, '0'), W - 3, 5, { align: 'right' });
    if (hero.blooms) {
      decor(0, 8, 62, -1);
      text(`x${hero.blooms}`, 77, 5);
    }
    if (power.kind) {
      ctx.fillStyle = '#2b1d14';
      ctx.fillRect(96, 6, 32, 4);
      ctx.fillStyle = power.kind === 'triple' ? '#9be7ff' : '#f7c548';
      ctx.fillRect(97, 7, Math.ceil((power.time / 600) * 30), 2);
    }
    if (boss && !boss.dying) {
      ctx.fillStyle = '#2b1d14';
      ctx.fillRect(20, 18, W - 40, 6);
      ctx.fillStyle = '#d64545';
      ctx.fillRect(21, 19, Math.ceil((boss.hp / boss.max) * (W - 42)), 4);
      text(boss.key === 'kingSlime' ? 'KING SLIME' : 'BONE LORD', W / 2, 27, { align: 'center' });
    }
  }

  function banner(lines, y = 120) {
    const h = lines.length * 14 + 14;
    ctx.fillStyle = 'rgba(43, 29, 20, 0.82)';
    ctx.fillRect(10, y, W - 20, h);
    ctx.fillStyle = '#e8c07a';
    ctx.fillRect(10, y, W - 20, 2);
    ctx.fillRect(10, y + h - 2, W - 20, 2);
    lines.forEach((l, i) => text(l.text ?? l, W / 2, y + 9 + i * 14, { align: 'center', scale: l.scale ?? 2, color: l.color ?? '#fff' }));
  }

  function render() {
    if (state === 'loading' || state === 'error') {
      ctx.fillStyle = '#3f7a3a';
      ctx.fillRect(0, 0, W, H);
      text(state === 'error' ? 'COULD NOT LOAD THE GAME' : 'LOADING...', W / 2, H / 2, { align: 'center' });
      return;
    }
    ctx.save();
    if (shake) ctx.translate(((rnd() * 5) | 0) - 2, ((rnd() * 5) | 0) - 2);
    drawGround();
    drawScenery(true);

    if (state === 'title') {
      drawScenery(false);
      ctx.restore();
      return drawTitle();
    }

    for (const it of items) drawItem(it);
    for (const a of animals) drawAnimal(a);
    for (const f of foes) drawFoe(f);
    if (boss) drawBoss();
    drawHero();
    for (const s of slashes) pix('slash', s.x - 5, s.y);
    for (const b of foeShots) {
      if (boss?.key === 'kingSlime' || !b.bone) {
        ctx.fillStyle = '#2b1d14';
        ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 5, 5);
        ctx.fillStyle = boss?.key === 'kingSlime' ? '#8fdc5a' : '#f2efe6';
        ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3);
      }
    }
    drawScenery(false);
    for (const p of puffs) drawPuff(p);
    ctx.restore();
    drawHud();

    if (state === 'intro') banner([{ text: `STAGE ${stage + 1 + loop * STAGES.length}`, scale: 2 }, { text: STAGES[stage].name, scale: 1, color: '#e8c07a' }]);
    else if (state === 'paused')
      banner([{ text: 'PAUSED', scale: 2 }, { text: 'TAP OR PRESS P TO RESUME', scale: 1 }, { text: 'M SOUND   F AUTO ATTACK', scale: 1, color: '#e8c07a' }]);
    else if (state === 'clear' && t > 40) banner([{ text: 'STAGE CLEAR!', scale: 2 }, { text: `SCORE ${score}`, scale: 1, color: '#e8c07a' }]);
    else if (state === 'over') {
      banner([
        { text: 'GAME OVER', scale: 2 },
        { text: `SCORE ${score}`, scale: 1 },
        { text: score >= hiScore && score > 0 ? 'NEW BEST!' : `BEST ${hiScore}`, scale: 1, color: '#e8c07a' },
        { text: t > 60 && (t >> 5) % 2 ? 'TAP TO CONTINUE' : '', scale: 1 },
      ]);
    }
    if (boss && boss.y < 20 && (t >> 4) % 2) text('WARNING!', W / 2, 150, { align: 'center', scale: 2, color: '#ff6b81' });
    drawToast();
  }

  function drawTitle() {
    ctx.fillStyle = 'rgba(43, 29, 20, 0.35)';
    ctx.fillRect(0, 0, W, H);
    const bob = Math.round(Math.sin(t / 25) * 2);
    text('SLIME', W / 2, 46 + bob, { align: 'center', scale: 4, color: '#8fdc5a' });
    text('SIEGE', W / 2, 72 + bob, { align: 'center', scale: 4, color: '#e8c07a' });
    cell(IMG.slime, 64, ((t / 8) | 0) % 4, 0, 30, 110, { scale: 0.75 });
    cell(IMG.slime, 64, ((t / 9) | 0) % 4, 0, 98, 104, { scale: 0.75 });
    cell(IMG.skeleton, 32, ((t / 8) | 0) % 6, 0, 72, 118);
    cell(IMG.player, 32, ((t / 6) | 0) % 6, 2, W / 2 - 16, 190);
    cell(IMG.chicken, 32, ((t / 12) | 0) % 2, 0, 30, 205);
    text('SLASH THE SLIMES', W / 2, 238, { align: 'center' });
    text('SAVE THE ANIMALS', W / 2, 248, { align: 'center', color: '#e8c07a' });
    if ((t >> 5) % 2 === 0) text(document.body.classList.contains('touch') ? 'TAP TO START' : 'PRESS ENTER OR SPACE', W / 2, 272, { align: 'center', scale: 1, color: '#fff6c2' });
    text(`BEST ${hiScore}`, W / 2, 292, { align: 'center', color: '#c8b49a' });
    text('A GAME BY INDIE/24', W / 2, 310, { align: 'center', color: '#c8b49a' });
    text(`V${VERSION}`, W - 3, 3, { align: 'right', color: '#c8b49a' });
    if (newVersion) {
      ctx.fillStyle = '#b8323c';
      ctx.fillRect(8, 12, W - 16, 22);
      text(`NEW VERSION ${newVersion.version}`, W / 2, 15, { align: 'center' });
      if ((t >> 5) % 2 === 0) text('TAP HERE TO DOWNLOAD', W / 2, 25, { align: 'center', color: '#fff6c2' });
    }
    drawToast();
  }

  function drawToast() {
    if (performance.now() > toastUntil) return;
    const w = toastText.length * 4 + 10;
    ctx.fillStyle = 'rgba(43, 29, 20, 0.85)';
    ctx.fillRect((W - w) >> 1, H - 52, w, 13);
    text(toastText, W / 2, H - 48, { align: 'center', color: '#fff6c2' });
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
    music.update(wantedSong(), !soundOn || document.hidden ? 0 : state === 'paused' ? 0.35 : 1);
    requestAnimationFrame(frame);
  }
  scroll = 0;
  scenery = [];
  puffs = [];
  loaded
    .then(() => {
      newScenery();
      resetHero();
      setState('title');
    })
    .catch(() => setState('error'));
  requestAnimationFrame(frame);
  canvas.focus();

  // Read-only hook for automated tests.
  window.__slimeSiege = {
    get state() { return state; },
    get score() { return score; },
    get lives() { return lives; },
    get stage() { return stage; },
    get boss() { return boss && { key: boss.key, hp: boss.hp }; },
    get song() { return wantedSong(); },
    get version() { return VERSION; },
    get newVersion() { return newVersion; },
    get foes() { return foes?.length ?? 0; },
    skipToBoss(s = stage) { stage = s; stageTime = 1e9; foes = []; foeShots = []; boss = null; },
  };
})();
