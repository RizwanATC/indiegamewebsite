// Lantern Drift: a sample arcade game for INDIE/24.
// Steer a paper lantern through a night of falling embers. Catch sparks for
// points, avoid the embers. One hit ends the run.
(function () {
  const W = 160;
  const H = 120;
  const canvas = document.getElementById('game');
  const ctx = Pixel.setup(canvas, W, H);
  const C = { sky: '#140f2e', sky2: '#24184d', hill: '#1d1640', ground: '#120d29', lantern: '#f2b84b', glow: '#ffe29a', ember: '#ff6b4a', spark: '#a78bfa', text: '#eeebf8', dim: '#8a83ad' };
  const BEST_KEY = 'indie24.lantern-drift.best';

  let state = 'title'; // title | play | pause | over
  let best = Pixel.load(BEST_KEY, 0);
  let player, embers, sparks, stars, t, score, speed, spawn, sparkSpawn, flash;
  const keys = { left: false, right: false };
  let touchDir = 0;

  stars = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.7, b: Math.random() }));

  function reset() {
    player = { x: W / 2, y: H - 22, vx: 0 };
    embers = [];
    sparks = [];
    t = 0;
    score = 0;
    speed = 1;
    spawn = 0;
    sparkSpawn = 60;
    flash = 0;
  }
  reset();

  function start() {
    reset();
    state = 'play';
  }

  function update() {
    if (state !== 'play') return;
    t++;
    speed = 1 + t / 1800;
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) || touchDir;
    player.vx += dir * 0.35;
    player.vx *= 0.82;
    player.x = Math.max(6, Math.min(W - 6, player.x + player.vx));

    if (--spawn <= 0) {
      embers.push({ x: Math.random() * W, y: -4, vy: (0.6 + Math.random() * 0.6) * speed, wob: Math.random() * 6 });
      spawn = Math.max(8, 34 - t / 90) * (0.6 + Math.random() * 0.8);
    }
    if (--sparkSpawn <= 0) {
      sparks.push({ x: 10 + Math.random() * (W - 20), y: -4, vy: 0.5 * speed });
      sparkSpawn = 90 + Math.random() * 90;
    }
    for (const e of embers) {
      e.y += e.vy;
      e.x += Math.sin((t + e.wob * 20) / 20) * 0.2;
    }
    for (const s of sparks) s.y += s.vy;

    const hit = (o, r) => Math.abs(o.x - player.x) < r && Math.abs(o.y - player.y) < r + 1;
    if (embers.some((e) => hit(e, 5))) {
      state = 'over';
      flash = 12;
      if (score > best) {
        best = score;
        Pixel.save(BEST_KEY, best);
      }
    }
    sparks = sparks.filter((s) => {
      if (hit(s, 7)) {
        score += 25;
        flash = 4;
        return false;
      }
      return s.y < H + 4;
    });
    embers = embers.filter((e) => e.y < H + 4);
    if (t % 10 === 0) score++;
  }

  function drawLantern(x, y) {
    x = Math.round(x);
    y = Math.round(y);
    ctx.fillStyle = 'rgba(255, 226, 154, 0.12)';
    ctx.fillRect(x - 8, y - 8, 17, 17);
    ctx.fillStyle = C.lantern;
    ctx.fillRect(x - 3, y - 5, 7, 9);
    ctx.fillRect(x - 4, y - 3, 9, 5);
    ctx.fillStyle = C.glow;
    ctx.fillRect(x - 1, y - 3, 3, 5);
    ctx.fillStyle = '#7a4a12';
    ctx.fillRect(x - 2, y - 6, 5, 1);
    ctx.fillRect(x - 2, y + 4, 5, 1);
  }

  function draw() {
    ctx.fillStyle = C.sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.sky2;
    ctx.fillRect(0, H * 0.45, W, H);
    for (const s of stars) {
      ctx.fillStyle = (Math.floor(t / 20 + s.b * 10) % 7 === 0) ? C.dim : '#5b5280';
      ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
    }
    ctx.fillStyle = C.hill;
    for (let x = 0; x < W; x++) ctx.fillRect(x, H - 14 - Math.round(4 + Math.sin(x / 13) * 3 + Math.sin(x / 5) * 1), 1, 20);
    ctx.fillStyle = C.ground;
    ctx.fillRect(0, H - 8, W, 8);

    for (const s of sparks) {
      const b = Math.floor(t / 6) % 2;
      ctx.fillStyle = C.spark;
      ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y), 3, 1);
      ctx.fillRect(Math.round(s.x), Math.round(s.y) - 1, 1, 3);
      if (b) ctx.fillRect(Math.round(s.x) - 2, Math.round(s.y), 5, 1);
    }
    for (const e of embers) {
      ctx.fillStyle = C.ember;
      ctx.fillRect(Math.round(e.x) - 1, Math.round(e.y) - 1, 3, 3);
      ctx.fillStyle = '#7a1f12';
      ctx.fillRect(Math.round(e.x), Math.round(e.y) - 3, 1, 2);
    }
    if (state !== 'over' || flash % 2 === 0) drawLantern(player.x, player.y);

    Pixel.text(ctx, `SCORE ${score}`, 4, 4, C.text);
    Pixel.text(ctx, `BEST ${best}`, W - 4, 4, C.dim, 1, 'right');

    if (flash > 0) flash--;

    if (state === 'title') {
      panel();
      Pixel.text(ctx, 'LANTERN DRIFT', W / 2, 34, C.glow, 2, 'center');
      Pixel.text(ctx, 'DODGE EMBERS. CATCH SPARKS.', W / 2, 56, C.text, 1, 'center');
      Pixel.text(ctx, 'ARROWS/A D OR HOLD SIDES', W / 2, 66, C.dim, 1, 'center');
      blink('PRESS SPACE OR TAP', 82);
    } else if (state === 'pause') {
      panel();
      Pixel.text(ctx, 'PAUSED', W / 2, 46, C.glow, 2, 'center');
      blink('P TO RESUME', 70);
    } else if (state === 'over') {
      panel();
      Pixel.text(ctx, 'THE NIGHT WINS', W / 2, 40, C.ember, 2, 'center');
      Pixel.text(ctx, `SCORE ${score}`, W / 2, 60, C.text, 1, 'center');
      if (score >= best && score > 0) Pixel.text(ctx, 'NEW BEST!', W / 2, 69, C.glow, 1, 'center');
      blink('SPACE OR TAP TO RETRY', 84);
    }
  }

  function panel() {
    ctx.fillStyle = 'rgba(7, 6, 15, 0.72)';
    ctx.fillRect(0, 0, W, H);
  }
  function blink(str, y) {
    if (Math.floor(performance.now() / 500) % 2 === 0) Pixel.text(ctx, str, W / 2, y, C.spark, 1, 'center');
  }

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    // Fixed 60 Hz simulation regardless of display refresh rate.
    acc += Math.min(100, now - last);
    last = now;
    while (acc >= 1000 / 60) {
      update();
      acc -= 1000 / 60;
    }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) keys.left = true;
    if (['ArrowRight', 'd', 'D'].includes(e.key)) keys.right = true;
    if (e.key === ' ' || e.key === 'Enter') {
      if (state === 'title' || state === 'over') start();
      e.preventDefault();
    }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (state === 'play') state = 'pause';
      else if (state === 'pause') state = 'play';
    }
    if (e.key.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) keys.left = false;
    if (['ArrowRight', 'd', 'D'].includes(e.key)) keys.right = false;
  });
  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus();
    if (state === 'title' || state === 'over') return start();
    if (state === 'pause') return (state = 'play');
    touchDir = Pixel.point(canvas, e).x < W / 2 ? -1 : 1;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (touchDir) touchDir = Pixel.point(canvas, e).x < W / 2 ? -1 : 1;
  });
  const release = () => (touchDir = 0);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  // Pause automatically when the tab or iframe loses focus.
  addEventListener('blur', () => {
    keys.left = keys.right = false;
    if (state === 'play') state = 'pause';
  });
  canvas.focus();
})();
