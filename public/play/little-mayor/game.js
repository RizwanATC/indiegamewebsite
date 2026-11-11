// Little Mayor: a portrait city-building puzzle for INDIE/24.
// Build one building a day for 40 days and grow the biggest town you can.
// The rules live in core.js (window.LittleMayor). Everything here is drawing,
// input and sound: all art is drawn in code and all sound is made live with
// WebAudio, so there are no asset files. The same files run on the website
// and inside the Android app.
(function () {
  'use strict';

  const L = window.LittleMayor;
  const { N, HALL, DAYS, TILES } = L;

  // ---------------------------------------------------------------- setup --
  const W = 160;
  const H = 288;
  const STEP = 1000 / 60;
  const CELL = 20;
  const GX = 10; // grid position
  const GY = 36;
  const HAND_Y = 196;
  const CARDS = [
    { x: 4, w: 48 }, // hand[0]
    { x: 56, w: 48 }, // hand[1]
    { x: 108, w: 48 }, // road, always there
  ];
  const CARD_H = 46;

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
        const v = localStorage.getItem('little-mayor.' + k);
        return v === null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('little-mayor.' + k, JSON.stringify(v));
      } catch {
        /* storage unavailable: scores just won't be kept */
      }
    },
  };
  let best = store.get('best', 0);
  let soundOn = store.get('sound', true);
  let towns = store.get('towns', 0);
  let seenHelp = store.get('help', false);

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
    ',': '000000000010100', '=': '000111000111000', '(': '010100100100010', ')': '010001001001010', '%': '101001010100101',
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
  function text(str, x, y, { scale = 1, color = '#fffaf0', align = 'left', outline = '#22303c' } = {}) {
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
    return width;
  }
  const textWidth = (str, scale = 1) => String(str).length * 4 * scale - scale;
  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

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
    click: () => tone(660, 40, 'square', 0.025),
    pick: () => (tone(523, 50, 'square', 0.03), tone(784, 70, 'square', 0.03, 0, 45)),
    aim: () => tone(880, 35, 'triangle', 0.04),
    build: () => (tone(120, 90, 'square', 0.06, -40), [523, 659, 784].forEach((f, i) => tone(f, 90, 'triangle', 0.05, 0, 70 + i * 60))),
    road: () => (tone(200, 50, 'square', 0.04, -60), tone(150, 50, 'square', 0.04, -40, 60)),
    no: () => (tone(160, 120, 'sawtooth', 0.05, -30), tone(120, 160, 'sawtooth', 0.04, -20, 110)),
    toss: () => tone(700, 220, 'triangle', 0.04, -560),
    coins: () => [1319, 1568, 2093].forEach((f, i) => tone(f, 70, 'square', 0.02, 0, i * 50)),
    medal: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 140, 'triangle', 0.05, 0, i * 90)),
    grow: () => (tone(988, 60, 'square', 0.02), tone(1175, 80, 'square', 0.02, 0, 50)),
  };

  // -------------------------------------------------------------- version --
  // Bump VERSION together with version.json (and the APK in public/downloads)
  // for each Android release. The app runs from file:// and asks the website
  // for the latest version.json, so it can offer the newer APK on the title.
  const VERSION = '1.0.0';
  const VERSION_URL = 'https://indiegamewebsite.vercel.app/play/little-mayor/version.json';
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
  const openUpdate = () => (location.href = newVersion.apk);

  // ---------------------------------------------------------------- music --
  // Chiptune songs written as note data. Each song is bars of 16 sixteenth
  // steps: a note name starts a note, '-' holds it, '.' is a rest. Bass and
  // arpeggio follow the chord of each bar (two chords split the bar in half).
  const SONGS = {
    // Title: a sleepy little town waking up.
    title: {
      bpm: 92,
      chords: ['F', 'C', 'Dm', 'Bb'],
      lead: [
        'A5 - - - C6 - A5 - G5 - F5 - G5 - - -',
        'E5 - - - G5 - C6 - A5 - G5 - - - . .',
        'F5 - - - A5 - D6 - C6 - A5 - F5 - - -',
        'D5 - F5 - Bb5 - A5 - G5 - - - . . . .',
      ],
      bass: 'R - - - 5 - - - R - - - 5 - - -',
      drums: 'k . . . h . . . k . . . h . . .',
      arp: true,
      leadVol: 0.75,
    },
    // Building: a bright, busy loop that's easy to think over.
    build: {
      bpm: 118,
      chords: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F G', 'C'],
      lead: [
        'E5 - G5 - C6 - . . G5 - E5 - G5 - . .',
        'A5 - G5 - E5 - C5 - E5 - - - . . . .',
        'F5 - A5 - C6 - A5 - G5 - F5 - E5 - - -',
        'D5 - - - G5 - - - B5 - A5 - G5 - - -',
        'C6 - B5 - C6 - G5 - E5 - G5 - C6 - - -',
        'B5 - G5 - E5 - G5 - B5 - - - . . . .',
        'A5 - G5 - F5 - A5 - G5 - F5 - D5 - - -',
        'C5 - - - E5 - - - C5 - - - . . . .',
      ],
      bass: 'R . . 5 R . . 5 R . . 5 R . 8 .',
      drums: 'k . h . s . h . k . h k s . h .',
      arp: false,
      leadVol: 0.55,
    },
    // The end of the term: a short fanfare, then a calm loop.
    over: {
      bpm: 100,
      chords: ['C', 'F', 'G', 'C'],
      lead: [
        'C5 - E5 - G5 - C6 - - - G5 - C6 - - -',
        'A5 - - - F5 - A5 - C6 - - - . . . .',
        'B5 - - - G5 - D5 - G5 - B5 - D6 - - -',
        'C6 - - - - - - - . . . . . . . .',
      ],
      bass: 'R - - - 5 - - - R - - - 5 - - -',
      drums: 'k . . . s . . . k . . . s . . .',
      arp: true,
      leadVol: 0.7,
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

  // ---------------------------------------------------------------- medals --
  const MEDALS = [
    { at: 150, name: 'CITY KEY', fill: '#b77cff', rim: '#6a3aa8' },
    { at: 125, name: 'GOLD', fill: '#ffd23f', rim: '#b8860b' },
    { at: 90, name: 'SILVER', fill: '#dfe6ee', rim: '#8a96a3' },
    { at: 50, name: 'BRONZE', fill: '#e0965a', rim: '#8f5426' },
  ];
  const medalFor = (score) => MEDALS.find((m) => score >= m.at) ?? null;

  // ------------------------------------------------------------ game state --
  let state = 'title'; // title | help | play | over
  let helpPage = 0;
  let helpReturn = 'title';
  let G = null; // the run (core.js)
  let E = null; // L.evaluate(G.grid), kept up to date
  let sel = 0; // selected card: 0, 1 = hand, 2 = road
  let aim = -1; // cell the player is looking at (preview)
  let aimArmed = false; // a touch already aimed here: the next tap on it builds
  let cursor = HALL; // keyboard cursor
  let tossArmed = false;
  let mouse = false; // last input was a mouse (hover previews, one click builds)
  let t = 0;
  let stateT = 0;
  let endAt = -1; // frame when the last day's results show
  let newBest = false;
  let medalShown = null;
  let toastText = '';
  let toastUntil = 0;
  let coinPop = null; // { txt, life }
  let cardIn = -1; // index of the card sliding in, and its timer below
  let cardInT = 0;
  const puffs = [];
  const pops = [];
  const todayKey = L.today();

  function setState(s) {
    state = s;
    stateT = 0;
  }
  function toast(msg, ms = 1500) {
    toastText = msg;
    toastUntil = performance.now() + ms;
  }
  function refresh() {
    E = L.evaluate(G.grid);
  }

  // A saved town in progress (today's only), so a reload doesn't lose it.
  function savedRun() {
    const r = store.get('run', null);
    return r && r.key === todayKey && !r.over && Array.isArray(r.grid) && r.grid.length === N * N ? r : null;
  }
  function save() {
    store.set('run', G.over ? null : G);
  }

  function startRun(resume) {
    G = (resume && savedRun()) || L.newGame(todayKey);
    refresh();
    sel = 0;
    aim = -1;
    aimArmed = false;
    tossArmed = false;
    endAt = -1;
    newBest = false;
    medalShown = null;
    puffs.length = 0;
    pops.length = 0;
    save();
    setState('play');
    if (!seenHelp) openHelp('play');
  }

  function openHelp(back) {
    helpReturn = back;
    helpPage = 0;
    setState('help');
  }

  // The demo town on the title screen.
  const DEMO = (() => {
    const rows = ['Th.hTh.', 'h#####h', 'hSh#h$h', 'T##H##T', 'h$h#hCh', 'h#####h', '.hTh.h.'];
    const map = { h: 'house', $: 'shop', T: 'park', S: 'school', C: 'clinic', '#': 'road', H: 'hall', '.': null };
    return rows.join('').split('').map((c) => map[c]);
  })();
  const DEMO_E = L.evaluate(DEMO);

  // ------------------------------------------------------------ the rules --
  const kindOf = (c) => (c === 2 ? 'road' : G.hand[c]);
  const priceOf = (c) => L.priceOf(G, kindOf(c));

  function selectCard(c) {
    if (endAt >= 0) return;
    if (sel !== c) sfx.pick();
    sel = c;
    tossArmed = false;
    aimArmed = false;
  }

  function placeAt(i) {
    if (endAt >= 0) return;
    const kind = kindOf(sel);
    const p = L.preview(G, kind, i);
    if (!p) {
      sfx.no();
      toast(G.grid[i] === 'hall' ? 'THAT IS THE TOWN HALL' : `ALREADY A ${TILES[kind].name}`);
      return;
    }
    if (p.cost > G.coins) {
      sfx.no();
      toast(`NEED ${p.cost} COINS`);
      return;
    }
    const before = E;
    const [cx, cy] = cellXY(i);
    if (kind === 'road') {
      L.buildRoad(G, i);
      sfx.road();
      spawnPuff(cx + 10, cy + 12, '#c9c3b4', 6);
      refresh();
      growPops(before);
      save();
      aimArmed = mouse;
      return;
    }
    const e = L.build(G, sel, i);
    if (!e) return sfx.no();
    sfx.build();
    spawnPuff(cx + 10, cy + 14, '#f4e8c8', 10, 1.2);
    refresh();
    growPops(before);
    afterDay(e, sel);
  }

  function discard() {
    if (endAt >= 0) return;
    if (sel === 2) {
      sfx.no();
      toast('PICK A CARD TO DISCARD');
      return;
    }
    if (!tossArmed) {
      tossArmed = true;
      sfx.aim();
      toast(`TAP AGAIN TO DISCARD ${TILES[G.hand[sel]].name}`, 2000);
      return;
    }
    const e = L.skip(G, sel);
    sfx.toss();
    afterDay(e, sel);
  }

  function afterDay(e, used) {
    tossArmed = false;
    aimArmed = false;
    aim = mouse ? aim : -1;
    coinPop = { txt: `+${e.income}`, life: 70 };
    setTimeout(() => state === 'play' && sfx.coins(), 260);
    // The card that was used slides away; a new one comes in on the right.
    cardIn = 1;
    cardInT = 18;
    sel = 0;
    save();
    if (G.over) endAt = t + 70;
    else if (G.day === DAYS) toast('LAST DAY!', 1800);
    else if (G.day % 10 === 1) toast(`DAY ${G.day}`);
  }

  function growPops(before) {
    let grew = false;
    E.pop.forEach((p, i) => {
      const d = p - before.pop[i];
      if (!d) return;
      const [x, y] = cellXY(i);
      pops.push({ x: x + 10, y: y + 2, life: 50, txt: (d > 0 ? '+' : '') + d, color: d > 0 ? '#b6ff7a' : '#ff8a7a' });
      if (d > 0) grew = true;
    });
    if (grew) setTimeout(() => sfx.grow(), 200);
  }

  function finishRun() {
    endAt = -1;
    const score = E.population;
    towns++;
    store.set('towns', towns);
    if (score > best) {
      best = score;
      newBest = score > 0;
      store.set('best', best);
    }
    const day = store.get('today', null);
    if (!day || day.key !== todayKey || score > day.best) store.set('today', { key: todayKey, best: score });
    window.Indie24Scores?.submit('little-mayor', score);
    medalShown = medalFor(score);
    if (medalShown) setTimeout(() => state === 'over' && sfx.medal(), 600);
    setState('over');
  }
  const bestToday = () => {
    const d = store.get('today', null);
    return d && d.key === todayKey ? d.best : 0;
  };

  // ---------------------------------------------------------------- input --
  const cellXY = (i) => [GX + (i % N) * CELL, GY + Math.floor(i / N) * CELL];
  function cellAt(x, y) {
    const cx = Math.floor((x - GX) / CELL);
    const cy = Math.floor((y - GY) / CELL);
    return cx < 0 || cy < 0 || cx >= N || cy >= N ? -1 : cy * N + cx;
  }
  const inBox = (x, y, bx, by, bw, bh) => x >= bx && x < bx + bw && y >= by && y < by + bh;
  const BTN = {
    toss: { x: 4, y: 248, w: 62, h: 15 },
    help: { x: 124, y: 248, w: 15, h: 15 },
    sound: { x: 141, y: 248, w: 15, h: 15 },
    titleHelp: { x: 42, y: 230, w: 76, h: 15 },
    titleNew: { x: 52, y: 214, w: 56, h: 11 },
  };
  const hit = (b, x, y) => inBox(x, y, b.x, b.y, b.w, b.h);

  function toggleSound() {
    soundOn = !soundOn;
    store.set('sound', soundOn);
    toast(soundOn ? 'SOUND ON' : 'SOUND OFF');
  }

  function helpNext() {
    sfx.click();
    helpPage++;
    if (helpPage >= HELP.length) {
      seenHelp = true;
      store.set('help', true);
      setState(helpReturn);
    }
  }

  function tap(x, y) {
    unlockAudio();
    if (state === 'help') return helpNext();
    if (state === 'title') {
      if (newVersion && y < 36) return openUpdate();
      if (x < 22 && y > H - 22) return toggleSound();
      if (hit(BTN.titleHelp, x, y)) return (sfx.click(), openHelp('title'));
      if (savedRun() && hit(BTN.titleNew, x, y)) return (sfx.click(), startRun(false));
      sfx.click();
      return startRun(true);
    }
    if (state === 'over') {
      if (stateT < 40) return;
      if (x < 22 && y > H - 22) return toggleSound();
      sfx.click();
      return startRun(false);
    }
    if (state !== 'play' || endAt >= 0) return;
    if (hit(BTN.sound, x, y)) return toggleSound();
    if (hit(BTN.help, x, y)) return (sfx.click(), openHelp('play'));
    if (hit(BTN.toss, x, y)) return discard();
    tossArmed = false;
    for (let c = 0; c < 3; c++) if (inBox(x, y, CARDS[c].x, HAND_Y - 4, CARDS[c].w, CARD_H + 4)) return selectCard(c);
    const i = cellAt(x, y);
    if (i < 0) return;
    cursor = i;
    if (aim === i && (aimArmed || mouse)) return placeAt(i);
    aim = i;
    aimArmed = true;
    sfx.aim();
  }

  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }
  // Taps are handled once, from pointer or touch events, whichever comes first.
  let lastTap = -1e9;
  function tapOnce(x, y) {
    const now = performance.now();
    if (now - lastTap < 60) return;
    lastTap = now;
    tap(x, y);
  }
  addEventListener('pointerdown', (e) => {
    mouse = e.pointerType === 'mouse';
    const p = toCanvas(e);
    tapOnce(p.x, p.y);
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouse = true;
    if (state !== 'play' || endAt >= 0) return;
    const p = toCanvas(e);
    const i = cellAt(p.x, p.y);
    if (i !== aim) {
      aim = i;
      aimArmed = i >= 0;
    }
  });
  // Safari on older iPhones sometimes drops pointer events inside iframes.
  addEventListener(
    'touchstart',
    (e) => {
      const touch = e.changedTouches[0];
      if (touch) {
        mouse = false;
        const p = toCanvas(touch);
        tapOnce(p.x, p.y);
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
    if (state === 'help') {
      if ([' ', 'Enter', 'ArrowRight', 'Escape'].includes(k)) (helpNext(), e.preventDefault());
      return;
    }
    if (state === 'title' || state === 'over') {
      if (k === 'h' || k === 'H' || k === '?') return openHelp(state);
      if ([' ', 'Enter'].includes(k) && (state === 'title' || stateT > 40)) {
        e.preventDefault();
        sfx.click();
        startRun(state === 'title');
      }
      return;
    }
    if (state !== 'play' || endAt >= 0) return;
    mouse = false;
    const move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (move) {
      e.preventDefault();
      const [x, y] = L.xy(aim >= 0 ? aim : cursor);
      cursor = L.at(Math.max(0, Math.min(N - 1, x + move[0])), Math.max(0, Math.min(N - 1, y + move[1])));
      aim = cursor;
      aimArmed = true;
      return;
    }
    if (k === '1' || k === '2' || k === '3') return selectCard(+k - 1);
    if (k === 'r' || k === 'R') return selectCard(2);
    if (k === 'Tab') {
      e.preventDefault();
      return selectCard((sel + 1) % 3);
    }
    if (k === 'x' || k === 'X' || k === 'Delete' || k === 'Backspace') return discard();
    if (k === 'h' || k === 'H' || k === '?') return openHelp('play');
    if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      if (aim < 0) {
        aim = cursor;
        aimArmed = true;
      } else placeAt(aim);
    }
  });

  // --------------------------------------------------------------- update --
  function spawnPuff(x, y, color, n, spread = 1) {
    for (let i = 0; i < n; i++) puffs.push({ x, y, vx: (Math.random() * 2 - 1) * spread, vy: -Math.random() * spread, life: 16 + Math.random() * 14, color });
  }

  function update() {
    t++;
    stateT++;
    if (state === 'play' && endAt >= 0 && t >= endAt) finishRun();
    for (const p of puffs) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.04;
      p.life--;
    }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].life <= 0) puffs.splice(i, 1);
    for (const p of pops) {
      p.y -= 0.3;
      p.life--;
    }
    for (let i = pops.length - 1; i >= 0; i--) if (pops[i].life <= 0) pops.splice(i, 1);
    if (coinPop && --coinPop.life <= 0) coinPop = null;
    if (cardInT > 0) cardInT--;
  }

  // --------------------------------------------------------------- tiles --
  // Each tile is 20x20, drawn top-down with a little height (3/4 view).
  const C = {
    grass: '#86c95f', grass2: '#7dbf57', tuft: '#5fa64a', ink: '#22303c', shadow: 'rgba(20,40,30,0.28)',
    asphalt: '#596273', asphaltOff: '#8d93a0', line: '#f2d36b', curb: '#cfc8b6',
    wall: '#f4e3c3', wallDark: '#d9c39c', door: '#7a4a2a', window: '#9fd8ff', lit: '#ffe58a',
    red: '#d9534f', redDark: '#a83a37', blue: '#4f7fd9', blueDark: '#3a5fae', orange: '#e9893a', orangeDark: '#b9662a',
    leaf: '#2f8f3a', leafLight: '#4fb04a', trunk: '#7a5230', water: '#5ab4e8', park: '#69b84e',
    yellow: '#f2c14e', yellowDark: '#c99a2e', brown: '#9a5b34', teal: '#3fb6a8', tealDark: '#2d8a80', white: '#f5f7fa', pink: '#ff6f91',
    coin: '#ffd23f', coinDark: '#c99a1e',
  };

  function grass(x, y, i) {
    rect(x, y, CELL, CELL, (i + Math.floor(i / N)) % 2 ? C.grass : C.grass2);
    const h = (i * 7919) % 97;
    ctx.fillStyle = C.tuft;
    ctx.fillRect(x + 3 + (h % 12), y + 4 + (h % 9), 1, 2);
    ctx.fillRect(x + 4 + (h % 12), y + 5 + (h % 9), 1, 1);
    ctx.fillRect(x + 14 - (h % 7), y + 13 - (h % 5), 1, 2);
  }

  function roadDirs(grid, i) {
    const [x, y] = L.xy(i);
    return [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => {
      const j = L.at(x + dx, y + dy);
      return j >= 0 && (grid[j] === 'road' || grid[j] === 'hall');
    });
  }

  function road(x, y, grid, i, linked) {
    const [up, right, down, left] = roadDirs(grid, i);
    const a = linked ? C.asphalt : C.asphaltOff;
    rect(x + 4, y + 4, 12, 12, C.curb);
    if (up) rect(x + 4, y, 12, 5, C.curb);
    if (down) rect(x + 4, y + 15, 12, 5, C.curb);
    if (left) rect(x, y + 4, 5, 12, C.curb);
    if (right) rect(x + 15, y + 4, 5, 12, C.curb);
    rect(x + 5, y + 5, 10, 10, a);
    if (up) rect(x + 5, y, 10, 6, a);
    if (down) rect(x + 5, y + 14, 10, 6, a);
    if (left) rect(x, y + 5, 6, 10, a);
    if (right) rect(x + 14, y + 5, 6, 10, a);
    ctx.fillStyle = C.line;
    if (up) ctx.fillRect(x + 10, y + 1, 1, 3);
    if (down) ctx.fillRect(x + 10, y + 16, 1, 3);
    if (left) ctx.fillRect(x + 1, y + 10, 3, 1);
    if (right) ctx.fillRect(x + 16, y + 10, 3, 1);
    if (!up && !down && !left && !right) rect(x + 9, y + 9, 2, 2, C.line);
  }

  function shadow(x, y, w, h) {
    rect(x + 2, y + 2, w, h, C.shadow);
  }

  // A pitched roof seen from the front: a band that narrows at the top.
  function roof(x, y, w, color, dark) {
    rect(x, y + 3, w, 3, color);
    rect(x + 1, y + 1, w - 2, 2, color);
    rect(x + 2, y, w - 4, 1, color);
    rect(x, y + 5, w, 1, dark);
  }

  function house(x, y, p, linked) {
    if (!linked) {
      shadow(x + 5, y + 8, 10, 9);
      roof(x + 4, y + 5, 12, '#9aa1ab', '#727a86');
      rect(x + 5, y + 11, 10, 6, '#c7c2b8');
      rect(x + 9, y + 13, 2, 4, '#7f7a72');
      if ((t >> 4) % 2 === 0) {
        rect(x + 13, y, 6, 8, C.ink);
        rect(x + 14, y + 1, 4, 6, '#ff5a4f');
        rect(x + 15, y + 2, 2, 2, '#fff');
        rect(x + 15, y + 5, 2, 1, '#fff');
      }
      return;
    }
    if (p >= 8) {
      // Apartment block.
      shadow(x + 3, y + 2, 14, 16);
      rect(x + 3, y + 5, 14, 13, C.wall);
      rect(x + 3, y + 2, 14, 3, C.orange);
      rect(x + 3, y + 5, 14, 1, C.orangeDark);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) rect(x + 5 + c * 4, y + 7 + r * 3, 2, 2, (r + c + (t >> 6)) % 4 ? C.window : C.lit);
      rect(x + 9, y + 15, 2, 3, C.door);
      return;
    }
    if (p >= 4) {
      shadow(x + 3, y + 6, 14, 11);
      rect(x + 13, y + 3, 2, 4, C.redDark); // chimney
      roof(x + 2, y + 5, 16, C.blue, C.blueDark);
      rect(x + 3, y + 11, 14, 7, C.wall);
      rect(x + 5, y + 13, 3, 2, C.window);
      rect(x + 12, y + 13, 3, 2, C.window);
      rect(x + 9, y + 13, 2, 5, C.door);
      return;
    }
    shadow(x + 5, y + 8, 10, 9);
    roof(x + 4, y + 6, 12, C.red, C.redDark);
    rect(x + 5, y + 12, 10, 6, C.wall);
    rect(x + 6, y + 14, 2, 2, C.window);
    rect(x + 10, y + 14, 2, 4, C.door);
  }

  function shop(x, y) {
    shadow(x + 2, y + 6, 16, 12);
    rect(x + 2, y + 6, 16, 12, C.wall);
    rect(x + 2, y + 4, 16, 3, C.wallDark);
    for (let s = 0; s < 8; s++) rect(x + 2 + s * 2, y + 8, 2, 3, s % 2 ? '#ffffff' : C.red);
    rect(x + 2, y + 11, 16, 1, C.redDark);
    rect(x + 4, y + 13, 5, 4, C.window);
    rect(x + 12, y + 13, 3, 5, C.door);
    // A coin sign on the roof.
    rect(x + 8, y + 1, 4, 4, C.coinDark);
    rect(x + 9, y + 2, 2, 2, C.coin);
  }

  function park(x, y) {
    rect(x + 1, y + 1, 18, 18, C.park);
    rect(x + 1, y + 1, 18, 1, C.leafLight);
    rect(x + 11, y + 12, 6, 4, C.water);
    rect(x + 12, y + 12, 3, 1, '#a8dcff');
    rect(x + 3, y + 15, 1, 1, '#ffef5a');
    rect(x + 6, y + 17, 1, 1, '#ff8fb1');
    rect(x + 15, y + 4, 1, 1, '#ffef5a');
    // A round tree.
    rect(x + 6, y + 10, 2, 4, C.trunk);
    rect(x + 3, y + 4, 8, 6, C.leaf);
    rect(x + 4, y + 3, 6, 8, C.leaf);
    rect(x + 4, y + 4, 3, 2, C.leafLight);
    rect(x + 13, y + 6, 4, 4, C.leaf);
    rect(x + 14, y + 6, 1, 1, C.leafLight);
  }

  function school(x, y) {
    shadow(x + 2, y + 7, 16, 11);
    rect(x + 8, y + 2, 4, 6, C.yellow); // bell tower
    rect(x + 9, y + 3, 2, 2, C.ink);
    rect(x + 8, y + 1, 4, 1, C.brown);
    rect(x + 12, y, 1, 4, C.ink); // flag pole and flag
    rect(x + 13, y, 3, 2, '#4fb0ff');
    roof(x + 1, y + 6, 18, C.brown, '#6e3f22');
    rect(x + 2, y + 12, 16, 6, C.yellow);
    rect(x + 2, y + 17, 16, 1, C.yellowDark);
    rect(x + 4, y + 13, 2, 2, C.window);
    rect(x + 14, y + 13, 2, 2, C.window);
    rect(x + 9, y + 13, 2, 5, C.door);
  }

  function clinic(x, y) {
    shadow(x + 2, y + 6, 16, 12);
    rect(x + 2, y + 4, 16, 3, C.teal);
    rect(x + 2, y + 7, 16, 11, C.white);
    rect(x + 2, y + 7, 16, 1, C.tealDark);
    // A heart sign.
    rect(x + 7, y + 9, 2, 1, C.pink);
    rect(x + 11, y + 9, 2, 1, C.pink);
    rect(x + 6, y + 10, 8, 2, C.pink);
    rect(x + 7, y + 12, 6, 1, C.pink);
    rect(x + 8, y + 13, 4, 1, C.pink);
    rect(x + 4, y + 15, 3, 2, C.window);
    rect(x + 13, y + 15, 3, 2, C.window);
    rect(x + 9, y + 15, 2, 3, C.door);
  }

  function hall(x, y) {
    shadow(x + 1, y + 4, 18, 14);
    rect(x + 1, y + 8, 18, 10, C.wall);
    rect(x + 1, y + 7, 18, 2, C.wallDark);
    for (let c = 0; c < 4; c++) rect(x + 3 + c * 4, y + 10, 2, 7, '#ffffff');
    rect(x + 1, y + 17, 18, 1, C.wallDark);
    rect(x + 6, y + 3, 8, 4, C.blue); // dome
    rect(x + 7, y + 2, 6, 1, C.blue);
    rect(x + 7, y + 3, 2, 1, '#7aa2f0');
    rect(x + 6, y + 6, 8, 1, C.blueDark);
    rect(x + 10, y - 3, 1, 5, C.ink); // flag
    rect(x + 11, y - 3 + ((t >> 4) % 2), 4, 2, C.red);
  }

  function drawTile(kind, x, y, grid, i, ev) {
    if (kind === 'road') return road(x, y, grid, i, ev ? ev.roads.has(i) : true);
    if (kind === 'house') return house(x, y, ev ? ev.pop[i] : 2, ev ? ev.linked[i] : true);
    if (kind === 'shop') return shop(x, y);
    if (kind === 'park') return park(x, y);
    if (kind === 'school') return school(x, y);
    if (kind === 'clinic') return clinic(x, y);
    if (kind === 'hall') return hall(x, y);
  }
  // A tile on its own (cards, help), with a road drawn as a crossing.
  function drawIcon(kind, x, y) {
    if (kind === 'road') {
      rect(x, y, CELL, CELL, C.grass);
      road(x, y, ['road', 'road', 'road', 'road', 'road', 'road', 'road', 'road', 'road'], 4, true);
      return;
    }
    rect(x, y, CELL, CELL, C.grass);
    drawTile(kind, x, y, null, 0, null);
  }

  // Little cars driving round the linked roads.
  function cars(grid, ev) {
    const colors = ['#ff6b6b', '#ffe066', '#ffffff', '#6bc5ff'];
    for (const i of ev.roads) {
      if (grid[i] !== 'road' || (i * 31) % 3) continue;
      const [up, right, down, left] = roadDirs(grid, i);
      const [x, y] = cellXY(i);
      const k = ((t + i * 37) % 120) / 120;
      ctx.fillStyle = colors[i % colors.length];
      if ((left || right) && !((up || down) && i % 2)) ctx.fillRect(x + Math.floor(k * 18) - 1, y + 6, 3, 2);
      else if (up || down) ctx.fillRect(x + 6, y + Math.floor(k * 18) - 1, 2, 3);
    }
  }

  function drawTown(grid, ev, dim) {
    rect(GX - 3, GY - 3, N * CELL + 6, N * CELL + 6, '#5a3d2b');
    rect(GX - 2, GY - 2, N * CELL + 4, N * CELL + 4, '#8a6242');
    for (let i = 0; i < N * N; i++) {
      const [x, y] = cellXY(i);
      grass(x, y, i);
    }
    for (let i = 0; i < N * N; i++) if (grid[i] === 'road') road(...cellXY(i), grid, i, ev.roads.has(i));
    cars(grid, ev);
    for (let i = 0; i < N * N; i++) {
      const k = grid[i];
      if (k && k !== 'road') drawTile(k, ...cellXY(i), grid, i, ev);
    }
    if (dim) rect(GX - 3, GY - 3, N * CELL + 6, N * CELL + 6, dim);
  }

  // --------------------------------------------------------------- render --
  function coinIcon(x, y) {
    rect(x + 1, y, 4, 6, C.coinDark);
    rect(x, y + 1, 6, 4, C.coinDark);
    rect(x + 1, y + 1, 4, 4, C.coin);
    rect(x + 2, y + 2, 1, 2, '#fff6c2');
  }
  function personIcon(x, y, color = '#ffd8b0') {
    rect(x + 1, y, 3, 3, color);
    rect(x, y + 3, 5, 4, '#7ad0ff');
  }

  function drawHud() {
    rect(0, 0, W, 31, C.ink);
    rect(0, 31, W, 1, '#3c5163');
    coinIcon(5, 6);
    text(G.coins, 14, 4, { scale: 2, color: C.coin });
    if (coinPop) {
      const y = 4 - Math.min(6, (70 - coinPop.life) / 4);
      ctx.globalAlpha = Math.min(1, coinPop.life / 20);
      text(coinPop.txt, 16 + textWidth(G.coins, 2) + 2, y, { color: '#b6ff7a' });
      ctx.globalAlpha = 1;
    }
    const popW = textWidth(E.population, 2);
    personIcon(W - 12 - popW, 5);
    text(E.population, W - 5, 4, { scale: 2, color: '#ffffff', align: 'right' });
    text(`DAY ${G.day}/${DAYS}`, 5, 20, { color: '#c9d6e2', outline: null });
    text(`+${E.income} A DAY`, W - 5, 20, { color: '#ffe58a', outline: null, align: 'right' });
    const lvl = L.priceLevel(G);
    if (lvl > 1) text(`LAND X${lvl}`, W / 2 + 6, 20, { color: '#ff9f7a', outline: null, align: 'center' });
  }

  // What the chosen building would do on the aimed cell.
  function aimInfo() {
    if (aim < 0) return null;
    const kind = kindOf(sel);
    return { kind, p: L.preview(G, kind, aim) };
  }

  function drawAim() {
    const kind = kindOf(sel);
    // Show where buildings would be linked to a road.
    if ((t >> 5) % 2 === 0 || aim < 0) {
      for (let i = 0; i < N * N; i++) {
        if (G.grid[i] !== null) continue;
        const ok = kind === 'road' ? L.ortho(i).some((j) => E.roads.has(j)) : L.ortho(i).some((j) => E.roads.has(j));
        if (!ok) continue;
        const [x, y] = cellXY(i);
        rect(x + 9, y + 9, 2, 2, 'rgba(255,255,255,0.55)');
      }
    }
    if (aim < 0) return;
    const info = aimInfo();
    const [x, y] = cellXY(aim);
    if (info.p) {
      ctx.globalAlpha = 0.75;
      rect(x, y, CELL, CELL, 'rgba(255,255,255,0.35)');
      const g = G.grid.slice();
      g[aim] = kind;
      drawTile(kind, x, y, g, aim, info.p.after);
      ctx.globalAlpha = 1;
      // Who gains and who loses.
      info.p.after.pop.forEach((p, i) => {
        const d = p - E.pop[i];
        if (!d && !(i === aim && kind === 'house')) return;
        const [hx, hy] = cellXY(i);
        const s = i === aim ? `${p}` : (d > 0 ? '+' : '') + d;
        text(s, hx + 10, hy + 1, { align: 'center', color: i === aim ? (p ? '#ffffff' : '#ff8a7a') : d > 0 ? '#b6ff7a' : '#ff8a7a' });
      });
    }
    const ok = info.p && info.p.cost <= G.coins;
    const col = ok ? (aimArmed || mouse ? '#ffe066' : '#ffffff') : '#ff5a4f';
    const blink = (t >> 3) % 2 && !mouse;
    ctx.fillStyle = col;
    ctx.fillRect(x - 1, y - 1, CELL + 2, 1);
    ctx.fillRect(x - 1, y + CELL, CELL + 2, 1);
    ctx.fillRect(x - 1, y - 1, 1, CELL + 2);
    ctx.fillRect(x + CELL, y - 1, 1, CELL + 2);
    if (blink) {
      ctx.fillRect(x - 2, y - 2, 3, 1);
      ctx.fillRect(x + CELL - 1, y + CELL + 1, 3, 1);
    }
  }

  function infoLine() {
    if (tossArmed) return [`TAP DISCARD AGAIN TO THROW AWAY`, `THE ${TILES[G.hand[sel]].name}. THE DAY STILL ENDS.`, '#ffb38a'];
    const info = aimInfo();
    const kind = kindOf(sel);
    if (!info) {
      if (kind === 'road') return ['ROADS COST COINS BUT NOT A DAY.', 'TAP A SQUARE NEXT TO A ROAD.', '#c9d6e2'];
      return [HINTS[kind], 'TAP A SQUARE TO SEE WHAT IT DOES', '#c9d6e2'];
    }
    if (!info.p) return [G.grid[aim] === 'hall' ? 'THE TOWN HALL STAYS PUT.' : `THERE IS A ${TILES[kind].name} HERE.`, '', '#ff9f7a'];
    const p = info.p;
    const parts = [];
    if (p.pop) parts.push(`${p.pop > 0 ? '+' : ''}${p.pop} PEOPLE`);
    if (p.income) parts.push(`${p.income > 0 ? '+' : ''}${p.income} COINS A DAY`);
    let top = parts.join('  ') || (kind === 'road' ? (p.after.roads.has(aim) ? 'JOINS THE ROAD' : 'NOT JOINED TO THE HALL!') : p.after.linked[aim] ? 'NO CHANGE YET' : 'NO ROAD HERE!');
    let color = p.pop > 0 || p.income > 0 ? '#b6ff7a' : p.pop < 0 ? '#ff9f7a' : '#ffe58a';
    const knock = G.grid[aim] ? `KNOCK DOWN ${TILES[G.grid[aim]].name}. ` : '';
    let bottom = `${knock}COST ${p.cost}`;
    if (p.cost > G.coins) {
      bottom = `${knock}NEED ${p.cost} COINS`;
      color = '#ff9f7a';
    } else bottom += mouse ? '  CLICK TO BUILD' : '  TAP AGAIN TO BUILD';
    if (kind !== 'road' && kind !== 'house' && !p.after.linked[aim]) top = 'NO ROAD HERE! IT WON\'T WORK.';
    return [top, bottom, color];
  }
  const HINTS = {
    house: 'HOUSES BRING PEOPLE AND TAXES.',
    shop: 'SHOPS: +1 PERSON AND +1 COIN.',
    park: 'PARKS: +2 PEOPLE NEXT DOOR.',
    school: 'SCHOOLS: +3 PEOPLE 2 SQUARES OUT',
    clinic: 'CLINICS: +3 PEOPLE 2 SQUARES OUT',
  };

  function drawCard(c, kind, price, x, y, w, selected, label) {
    const lift = selected ? 4 : 0;
    y -= lift;
    rect(x, y + 1, w, CARD_H, 'rgba(0,0,0,0.3)');
    rect(x, y, w, CARD_H, selected ? '#ffe066' : C.ink);
    rect(x + 1, y + 1, w - 2, CARD_H - 2, '#fff4dc');
    rect(x + 1, y + 1, w - 2, 3, selected ? '#ffd23f' : '#e8d9b8');
    drawIcon(kind, x + ((w - CELL) >> 1), y + 6);
    text(label, x + w / 2, y + 29, { align: 'center', color: C.ink, outline: null });
    const ok = price <= G.coins;
    const pw = textWidth(price) + 8;
    coinIcon(x + ((w - pw) >> 1), y + 37);
    text(price, x + ((w - pw) >> 1) + 8, y + 38, { color: ok ? '#6a4a1a' : '#d0342c', outline: null });
    text(c === 2 ? 'R' : String(c + 1), x + 3, y + 5, { color: '#b8a888', outline: null });
  }

  function drawHand() {
    const slide = cardInT > 0 ? Math.round((cardInT / 18) ** 2 * 60) : 0;
    for (let c = 0; c < 3; c++) {
      const { x, w } = CARDS[c];
      const kind = kindOf(c);
      const dx = c === 1 ? slide : 0;
      drawCard(c, kind, priceOf(c), x + dx, HAND_Y, w, sel === c, TILES[kind].name);
    }
    text('ANY TIME', CARDS[2].x + CARDS[2].w / 2, HAND_Y + CARD_H + 2, { align: 'center', color: '#9fb3c4', outline: null });
  }

  function button(b, label, color = '#3c5163', textColor = '#ffffff') {
    rect(b.x, b.y + 1, b.w, b.h, 'rgba(0,0,0,0.35)');
    rect(b.x, b.y, b.w, b.h, color);
    rect(b.x, b.y, b.w, 1, 'rgba(255,255,255,0.25)');
    if (label) text(label, b.x + b.w / 2, b.y + Math.floor((b.h - 5) / 2), { align: 'center', color: textColor, outline: null });
  }

  function drawSpeaker(x, y, bg = true) {
    if (bg) rect(x - 1, y - 1, 15, 13, '#22303c');
    ctx.fillStyle = '#fffaf0';
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

  function drawBottom() {
    button(BTN.toss, tossArmed ? 'SURE?' : 'DISCARD', tossArmed ? '#b8323c' : '#3c5163');
    // The next card in the deck.
    const next = G.deck[G.next];
    if (next) {
      text('NEXT', 72, 253, { color: '#9fb3c4', outline: null });
      ctx.save();
      ctx.translate(91, 246);
      drawIcon(next, 0, 0);
      ctx.restore();
    }
    button(BTN.help, '?');
    button(BTN.sound, '');
    drawSpeaker(BTN.sound.x + 1, BTN.sound.y + 2, false);
    text(`TOWN OF ${dateLabel(G.key)}`, W / 2, 274, { align: 'center', color: '#7f97ab', outline: null });
  }
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dateLabel = (key) => `${+key.slice(8, 10)} ${MONTHS[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;

  function drawFx() {
    for (const p of puffs) {
      ctx.globalAlpha = Math.min(1, p.life / 12);
      rect(Math.round(p.x), Math.round(p.y), 2, 2, p.color);
    }
    ctx.globalAlpha = 1;
    for (const p of pops) {
      ctx.globalAlpha = Math.min(1, p.life / 15);
      text(p.txt, p.x, p.y, { align: 'center', color: p.color });
    }
    ctx.globalAlpha = 1;
  }

  function drawPlay() {
    drawHud();
    drawTown(G.grid, E, null);
    if (endAt < 0) drawAim();
    drawFx();
    const [a, b, color] = endAt >= 0 ? ['THE TERM IS OVER!', 'COUNTING YOUR PEOPLE...', '#ffe066'] : infoLine();
    text(a, W / 2, 178, { align: 'center', color, outline: null });
    if (b) text(b, W / 2, 186, { align: 'center', color: '#c9d6e2', outline: null });
    drawHand();
    drawBottom();
  }

  function drawMedal(m, x, y) {
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, 6.29);
    ctx.fill();
    ctx.fillStyle = m ? m.rim : '#7f8a96';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, 6.29);
    ctx.fill();
    ctx.fillStyle = m ? m.fill : '#aab4be';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 6.29);
    ctx.fill();
    if (m) {
      // A little town hall on the medal.
      ctx.save();
      ctx.translate(x - 10, y - 9);
      hall(0, 0);
      ctx.restore();
      if ((t >> 3) % 8 === 0) rect(x - 6, y - 7, 2, 2, '#ffffff');
    } else text('?', x + 1, y - 2, { align: 'center', color: '#7f8a96', outline: null });
  }

  function drawOver() {
    drawHud();
    drawTown(G.grid, E, null);
    drawFx();
    const k = Math.min(1, stateT / 14);
    const y0 = Math.round(178 + (1 - k) * 30);
    ctx.globalAlpha = k;
    rect(0, y0 - 2, W, H - y0 + 2, C.ink);
    rect(0, y0 - 2, W, 1, '#ffe066');
    text('TERM OVER!', W / 2, y0 + 2, { align: 'center', scale: 2, color: '#ffe066' });
    drawMedal(medalShown, 20, y0 + 30);
    text(medalShown ? medalShown.name : 'NO MEDAL', 20, y0 + 46, { align: 'center', color: '#c9d6e2', outline: null });
    text('PEOPLE', 70, y0 + 17, { align: 'center', color: '#9fb3c4', outline: null });
    text(E.population, 70, y0 + 25, { align: 'center', scale: 2, color: '#ffffff' });
    text('TODAY', 106, y0 + 17, { align: 'center', color: '#9fb3c4', outline: null });
    text(bestToday(), 106, y0 + 25, { align: 'center', color: '#ffffff' });
    text('BEST', 138, y0 + 17, { align: 'center', color: '#9fb3c4', outline: null });
    text(best, 138, y0 + 25, { align: 'center', color: '#ffffff' });
    const nxt = [...MEDALS].reverse().find((m) => E.population < m.at);
    if (newBest && (t >> 4) % 2 === 0) text('NEW BEST!', 104, y0 + 38, { align: 'center', color: '#ff8a7a', outline: null });
    else text(nxt ? `${nxt.at - E.population} MORE FOR ${nxt.name}` : 'THE KEY TO THE CITY!', 104, y0 + 38, { align: 'center', color: '#ffe58a', outline: null });
    ctx.globalAlpha = 1;
    const bh = stateT > 24 ? drawBoard(y0 + 54, 3) : 0;
    if (!bh) {
      text('SAME BUILDINGS ALL DAY.', W / 2, y0 + 62, { align: 'center', color: '#c9d6e2', outline: null });
      text('CAN YOU BUILD A BIGGER TOWN?', W / 2, y0 + 72, { align: 'center', color: '#c9d6e2', outline: null });
    }
    if (stateT > 40 && (t >> 5) % 2 === 0) text(matchMedia('(pointer: coarse)').matches ? 'TAP TO PLAY AGAIN' : 'CLICK OR SPACE TO PLAY AGAIN', W / 2, H - 9, { align: 'center', color: '#ffffff' });
    if (stateT > 40) drawSpeaker(4, H - 14);
  }

  /** The site's high score table (leaderboard.js); returns 0 when offline. */
  function drawBoard(y, rows) {
    return (
      window.Indie24Scores?.draw('little-mayor', {
        text,
        rect,
        x: 6,
        y,
        w: W - 12,
        rows,
        colors: { panel: 'rgba(34, 48, 60, 0.9)', edge: '#ffd23f', title: '#ffd23f', text: '#fffaf0', dim: '#c9d6e2', you: '#8fe3ff', youBar: 'rgba(143, 227, 255, 0.22)', medals: ['#ffd23f', '#eef3f8', '#f0a868'] },
      }) || 0
    );
  }

  function drawTitle() {
    rect(0, 0, W, H, '#2e4a3f');
    drawTown(DEMO, DEMO_E, 'rgba(34, 48, 60, 0.55)');
    const bob = Math.round(Math.sin(t / 25) * 2);
    rect(0, 0, W, 50, 'rgba(34, 48, 60, 0.85)');
    text('LITTLE', W / 2, 5 + bob, { align: 'center', scale: 2, color: '#ffd23f' });
    text('MAYOR', W / 2, 19 + bob, { align: 'center', scale: 4, color: '#ffffff' });
    const bh = drawBoard(56, 5);
    if (!bh) {
      rect(8, 70, W - 16, 40, 'rgba(34, 48, 60, 0.85)');
      text('BUILD ONE BUILDING A DAY', W / 2, 76, { align: 'center' });
      text('FOR 40 DAYS.', W / 2, 86, { align: 'center' });
      text('GROW THE BIGGEST TOWN!', W / 2, 100, { align: 'center', color: '#ffe066' });
    }
    text(`TODAY'S TOWN: ${dateLabel(todayKey)}`, W / 2, 182, { align: 'center', color: '#ffe58a' });
    text('SAME BUILDINGS FOR EVERYONE', W / 2, 191, { align: 'center', color: '#c9d6e2', outline: null });
    const run = savedRun();
    const touch = matchMedia('(pointer: coarse)').matches;
    if ((t >> 5) % 2 === 0) text(run ? `${touch ? 'TAP' : 'CLICK'} TO GO ON: DAY ${run.day}` : touch ? 'TAP TO START' : 'CLICK OR SPACE TO START', W / 2, 202, { align: 'center', color: '#ffffff' });
    if (run) button(BTN.titleNew, 'NEW TOWN');
    button(BTN.titleHelp, 'HOW TO PLAY', '#ffd23f', C.ink);
    text(`BEST ${best}   TODAY ${bestToday()}`, W / 2, 252, { align: 'center', color: '#ffe066', outline: null });
    text('A GAME BY INDIE/24', W / 2, 264, { align: 'center', color: '#c9d6e2', outline: null });
    text(`V${VERSION}`, W - 3, H - 9, { align: 'right', color: '#7f97ab', outline: null });
    drawSpeaker(5, H - 16);
    if (newVersion) {
      rect(6, 6, W - 12, 24, '#b8323c');
      text(`NEW VERSION ${newVersion.version}`, W / 2, 10, { align: 'center' });
      if ((t >> 5) % 2 === 0) text('TAP HERE TO DOWNLOAD', W / 2, 20, { align: 'center', color: '#fff6c2' });
    }
  }

  // How to play: a few short pages with pictures.
  const HELP = [
    {
      title: 'YOU ARE THE MAYOR!',
      icons: ['house', 'hall', 'house'],
      lines: ['BUILD ONE BUILDING A DAY', 'FOR 40 DAYS.', '', 'WHEN THE TERM ENDS, THE', 'PEOPLE IN YOUR TOWN ARE', 'YOUR SCORE.', '', 'EVERYONE GETS THE SAME', 'BUILDINGS TODAY. TOMORROW', 'BRINGS A NEW TOWN.'],
    },
    {
      title: 'HOW TO BUILD',
      icons: ['shop', 'park'],
      lines: ['PICK ONE OF YOUR TWO CARDS,', 'THEN TAP A SQUARE. YOU SEE', 'WHAT IT WOULD DO THERE.', '', 'TAP THE SAME SQUARE AGAIN', 'TO BUILD. THAT ENDS THE DAY', 'AND YOUR TOWN PAYS TAXES.', '', 'DON\'T LIKE A CARD? DISCARD', 'IT. THE DAY ENDS ANYWAY.'],
    },
    {
      title: 'ROADS',
      icons: ['road', 'road'],
      lines: ['A BUILDING ONLY WORKS WHEN', 'IT TOUCHES A ROAD THAT', 'LEADS TO THE TOWN HALL.', '(CORNERS DON\'T COUNT.)', '', 'ROADS COST COINS, BUT YOU', 'CAN BUILD AS MANY AS YOU', 'LIKE WITHOUT USING A DAY.', '', 'BUILD ON A USED SQUARE TO', 'KNOCK IT DOWN (+2 COINS).'],
    },
    {
      title: 'HOUSES GROW',
      icons: ['house', 'school', 'clinic'],
      lines: ['A HOUSE HAS 2 PEOPLE, AND:', '+2 WITH A PARK NEXT DOOR', '+3 WITH A SCHOOL WITHIN 2', '+3 WITH A CLINIC WITHIN 2', '+1 FOR EACH SHOP NEXT DOOR', '   (UP TO 2)', '', 'SHOPS EARN 1 COIN A DAY FOR', 'EACH HOUSE NEXT TO THEM.', 'LAND GETS DEARER AS YOUR', 'TOWN GROWS. GOOD LUCK!'],
    },
  ];

  function drawHelp() {
    rect(0, 0, W, H, '#2e4a3f');
    rect(6, 10, W - 12, H - 20, C.ink);
    rect(6, 10, W - 12, 2, '#ffd23f');
    const page = HELP[helpPage];
    text(page.title, W / 2, 20, { align: 'center', scale: 1, color: '#ffd23f', outline: null });
    const n = page.icons.length;
    page.icons.forEach((k, i) => drawIcon(k, W / 2 - (n * 24) / 2 + i * 24 + 2, 34));
    page.lines.forEach((line, i) => text(line, 14, 66 + i * 10, { color: '#fffaf0', outline: null }));
    for (let i = 0; i < HELP.length; i++) rect(W / 2 - HELP.length * 4 + i * 8, 252, 5, 5, i === helpPage ? '#ffd23f' : '#3c5163');
    if ((t >> 5) % 2 === 0) text(helpPage < HELP.length - 1 ? 'TAP FOR MORE' : "TAP TO PLAY", W / 2, 264, { align: 'center', color: '#ffffff', outline: null });
  }

  function drawToast() {
    if (performance.now() > toastUntil) return;
    const w = textWidth(toastText) + 10;
    rect((W - w) >> 1, 160, w, 13, 'rgba(34,48,60,0.92)');
    text(toastText, W / 2, 164, { align: 'center', color: '#ffe066', outline: null });
  }

  function render() {
    rect(0, 0, W, H, '#2e4a3f');
    if (state === 'title') drawTitle();
    else if (state === 'help') drawHelp();
    else if (state === 'play') drawPlay();
    else if (state === 'over') drawOver();
    drawToast();
  }

  function wantedSong() {
    if (state === 'title' || state === 'help') return 'title';
    if (state === 'over') return 'over';
    return 'build';
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
    music.update(wantedSong(), !soundOn || document.hidden ? 0 : 1);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  canvas.focus();

  // Hooks for automated tests and screenshots.
  window.__littleMayor = {
    get state() { return state; },
    get run() { return G; },
    get eval() { return E; },
    get version() { return VERSION; },
    get sel() { return sel; },
    get aim() { return aim; },
    start: (resume = false) => startRun(resume),
    load(run, st = 'play') {
      G = run;
      refresh();
      endAt = -1;
      setState(st);
      if (st === 'over') {
        medalShown = medalFor(E.population);
        stateT = 60;
      }
    },
    select: selectCard,
    aimAt(i) {
      aim = i;
      aimArmed = true;
    },
    finish: () => finishRun(),
    help: (p = 0) => {
      openHelp('title');
      helpPage = p;
    },
  };
})();
