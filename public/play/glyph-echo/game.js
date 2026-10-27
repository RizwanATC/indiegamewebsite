// Glyph Echo: a sample memory puzzle for INDIE/24.
// Four glyphs light up in a sequence. Repeat it. Each round adds one more.
(function () {
  const W = 160;
  const H = 120;
  const canvas = document.getElementById('game');
  const ctx = Pixel.setup(canvas, W, H);
  const BEST_KEY = 'indie24.glyph-echo.best';
  const TILES = [
    { x: 38, y: 30, color: '#a78bfa', dark: '#3b2a6b', key: '1', note: 330 },
    { x: 84, y: 30, color: '#7cf2c8', dark: '#1f5246', key: '2', note: 392 },
    { x: 38, y: 70, color: '#f2b84b', dark: '#5c4214', key: '3', note: 440 },
    { x: 84, y: 70, color: '#ff8fa3', dark: '#5e2531', key: '4', note: 523 },
  ];
  const SIZE = 38;
  const GLYPHS = [
    ['0110', '1001', '1001', '0110'],
    ['1001', '0110', '0110', '1001'],
    ['0100', '1110', '0100', '0100'],
    ['1111', '0001', '0001', '0001'],
  ];

  let state = 'title'; // title | show | input | over
  let seq = [];
  let pos = 0;
  let lit = -1;
  let litUntil = 0;
  let timer = 0;
  let best = Pixel.load(BEST_KEY, 0);
  let sound = Pixel.load('indie24.glyph-echo.sound', true);
  let audio;

  function beep(freq, ms) {
    if (!sound) return;
    try {
      audio ??= new AudioContext();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.06, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + ms / 1000);
    } catch {
      /* audio unavailable */
    }
  }

  function light(i, ms) {
    lit = i;
    litUntil = performance.now() + ms;
    beep(TILES[i].note, ms);
  }

  function nextRound() {
    seq.push(Math.floor(Math.random() * 4));
    pos = 0;
    state = 'show';
    // Faster playback as the sequence grows.
    const step = Math.max(260, 620 - seq.length * 30);
    seq.forEach((tile, i) => setTimeout(() => light(tile, step * 0.7), 600 + i * step));
    clearTimeout(timer);
    timer = setTimeout(() => (state = 'input'), 600 + seq.length * step);
  }

  function start() {
    seq = [];
    nextRound();
  }

  function press(i) {
    if (state === 'title' || state === 'over') return start();
    if (state !== 'input') return;
    light(i, 180);
    if (seq[pos] !== i) {
      state = 'over';
      beep(110, 400);
      const reached = seq.length - 1;
      if (reached > best) {
        best = reached;
        Pixel.save(BEST_KEY, best);
      }
      return;
    }
    pos++;
    if (pos === seq.length) {
      state = 'show';
      setTimeout(nextRound, 500);
    }
  }

  function draw(now) {
    ctx.fillStyle = '#0e1426';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 4) {
      ctx.fillStyle = y % 8 ? '#111a30' : '#0e1426';
      ctx.fillRect(0, y, W, 1);
    }
    if (now > litUntil) lit = -1;

    TILES.forEach((t, i) => {
      const on = lit === i;
      ctx.fillStyle = on ? t.color : t.dark;
      ctx.fillRect(t.x, t.y, SIZE, SIZE);
      ctx.fillStyle = on ? '#ffffff' : t.color;
      GLYPHS[i].forEach((row, gy) => [...row].forEach((c, gx) => c === '1' && ctx.fillRect(t.x + 11 + gx * 4, t.y + 11 + gy * 4, 4, 4)));
      Pixel.text(ctx, t.key, t.x + 2, t.y + 2, on ? '#0e1426' : t.color);
    });

    Pixel.text(ctx, `ROUND ${Math.max(seq.length, 0)}`, 4, 4, '#eeebf8');
    Pixel.text(ctx, `BEST ${best}`, W - 4, 4, '#8a83ad', 1, 'right');
    Pixel.text(ctx, sound ? 'M: SOUND ON' : 'M: SOUND OFF', W - 4, H - 8, '#5b5280', 1, 'right');

    const msg = state === 'show' ? 'WATCH...' : state === 'input' ? `YOUR TURN ${pos}/${seq.length}` : '';
    if (msg) Pixel.text(ctx, msg, W / 2, H - 14, '#c7f9ff', 1, 'center');

    if (state === 'title' || state === 'over') {
      ctx.fillStyle = 'rgba(7, 6, 15, 0.78)';
      ctx.fillRect(0, 0, W, H);
      if (state === 'title') {
        Pixel.text(ctx, 'GLYPH ECHO', W / 2, 32, '#a78bfa', 2, 'center');
        Pixel.text(ctx, 'WATCH THE GLYPHS LIGHT UP', W / 2, 54, '#eeebf8', 1, 'center');
        Pixel.text(ctx, 'THEN REPEAT: KEYS 1-4 OR TAP', W / 2, 63, '#8a83ad', 1, 'center');
      } else {
        Pixel.text(ctx, 'ECHO LOST', W / 2, 36, '#ff8fa3', 2, 'center');
        Pixel.text(ctx, `YOU REACHED ROUND ${seq.length}`, W / 2, 58, '#eeebf8', 1, 'center');
      }
      if (Math.floor(now / 500) % 2 === 0) Pixel.text(ctx, 'PRESS SPACE OR TAP', W / 2, 82, '#7cf2c8', 1, 'center');
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  addEventListener('keydown', (e) => {
    const i = ['1', '2', '3', '4'].indexOf(e.key);
    if (i >= 0) press(i);
    if ((e.key === ' ' || e.key === 'Enter') && (state === 'title' || state === 'over')) {
      e.preventDefault();
      start();
    }
    if (e.key === 'm' || e.key === 'M') {
      sound = !sound;
      Pixel.save('indie24.glyph-echo.sound', sound);
    }
  });
  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus();
    const p = Pixel.point(canvas, e);
    const i = TILES.findIndex((t) => p.x >= t.x && p.x < t.x + SIZE && p.y >= t.y && p.y < t.y + SIZE);
    if (i >= 0) press(i);
    else if (state === 'title' || state === 'over') start();
  });
  canvas.focus();
})();
