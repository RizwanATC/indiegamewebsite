// Tiny helpers shared by the sample games: a low-resolution canvas that
// scales up crisply, a 3x5 pixel font, and safe localStorage access.
(function () {
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110', ' ': '000000000000000', ':': '000010000010000', '.': '000000000000010', '!': '010010010000010',
    '/': '001001010100100', '-': '000000111000000', '?': '110001010000010',
  };

  window.Pixel = {
    setup(canvas, w, h) {
      const ctx = canvas.getContext('2d');
      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = false;
      const fit = () => {
        // Letterbox to keep pixels square.
        const s = Math.min(innerWidth / w, innerHeight / h);
        canvas.style.width = `${Math.floor(w * s)}px`;
        canvas.style.height = `${Math.floor(h * s)}px`;
        canvas.style.margin = `${Math.floor((innerHeight - h * s) / 2)}px auto 0`;
      };
      addEventListener('resize', fit);
      fit();
      return ctx;
    },
    text(ctx, str, x, y, color, scale = 1, align = 'left') {
      str = String(str).toUpperCase();
      const width = str.length * 4 * scale - scale;
      if (align === 'center') x -= Math.floor(width / 2);
      if (align === 'right') x -= width;
      ctx.fillStyle = color;
      [...str].forEach((ch, i) => {
        const g = FONT[ch] || FONT['?'];
        for (let p = 0; p < 15; p++) if (g[p] === '1') ctx.fillRect(x + (i * 4 + (p % 3)) * scale, y + Math.floor(p / 3) * scale, scale, scale);
      });
    },
    load(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    save(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage blocked: scores just won't persist */
      }
    },
    // Convert a pointer event to canvas pixel coordinates.
    point(canvas, e) {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
    },
  };
})();
