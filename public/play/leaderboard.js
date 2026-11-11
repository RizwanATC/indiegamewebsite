/*
 * INDIE/24 leaderboard helper for the games in /play/.
 *
 *   <script src="../leaderboard.js"></script>
 *   window.Indie24Scores?.submit('slime-siege', score);
 *   window.Indie24Scores?.draw('slime-siege', { text, rect, x, y, w });
 *
 * draw() paints a small "HIGH SCORES" table on the game's canvas with the
 * game's own pixel text(str, x, y, opts) and rect(x, y, w, h, color)
 * helpers, so it looks native. Games call it every frame on their title and
 * game over screens; scores are fetched in the background and cached.
 *
 * The player's id and name live in localStorage under "indie24.player",
 * shared with the website (same origin), which asks for the name on the
 * first visit. Inside the Android app (file://) there is no server, so
 * submit() quietly does nothing there. Keep this file free of dependencies.
 */
(() => {
  'use strict';
  const KEY = 'indie24.player';
  const online = location.protocol === 'http:' || location.protocol === 'https:';

  function newId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }

  // Also kept in a one-year cookie (shared with the website), because some
  // browsers drop localStorage; whichever copy has a name wins.
  const COOKIE = 'indie24_player';
  const valid = (p) => Boolean(p) && typeof p.id === 'string' && typeof p.name === 'string';

  function readCookie() {
    try {
      const m = document.cookie.match(/(?:^|;\s*)indie24_player=([^;]*)/);
      return m ? JSON.parse(decodeURIComponent(m[1])) : null;
    } catch {
      return null;
    }
  }

  function player() {
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {}
    const found = [stored, online ? readCookie() : null].filter(valid);
    const p = found.find((c) => c.name) || found[0] || { id: newId(), name: '' };
    if (!valid(stored) || stored.id !== p.id || stored.name !== p.name) {
      try {
        localStorage.setItem(KEY, JSON.stringify(p));
      } catch {}
    }
    if (online) {
      try {
        const secure = location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify({ id: p.id, name: p.name }))}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
      } catch {}
    }
    return p;
  }

  async function submit(game, score) {
    score = Math.floor(Number(score));
    if (!online || !(score > 0)) return null;
    const p = player();
    // No name yet (game opened directly): post as a guest. Picking a name on
    // the website later renames this entry.
    const name = p.name || `Player ${p.id.replace(/[^0-9]/g, '').slice(0, 4) || '0000'}`;
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game, player: p.id, name, score }),
        keepalive: true,
      });
      const data = res.ok ? await res.json() : null;
      load(game); // the board now includes this run
      // Let the game page around the player refresh its leaderboard.
      if (window.parent !== window) window.parent.postMessage({ type: 'indie24:score', game }, location.origin);
      return data;
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------ the board --
  const boards = {};
  const STALE_MS = 20000;

  async function load(game) {
    const b = (boards[game] ||= { status: 'loading', data: null, at: 0, busy: false });
    if (b.busy) return;
    b.busy = true;
    b.at = Date.now();
    try {
      const res = await fetch(`/api/scores?game=${encodeURIComponent(game)}&player=${encodeURIComponent(player().id)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      b.data = await res.json();
      b.status = 'ok';
    } catch {
      if (!b.data) b.status = 'error';
    } finally {
      b.busy = false;
      b.at = Date.now();
    }
  }

  /** Cached { status: 'off' | 'loading' | 'error' | 'ok', data } for a game, refreshed in the background. */
  function board(game) {
    if (!online) return { status: 'off', data: null };
    const b = boards[game];
    if (!b || (!b.busy && Date.now() - b.at > STALE_MS)) load(game);
    return boards[game];
  }

  /** A name the games' 3x5 pixel fonts can draw (A-Z, 0-9 and a little punctuation). */
  function label(name) {
    const s = String(name || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/_/g, '-')
      .replace(/[^A-Z0-9 .!?/+-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return s || 'PLAYER';
  }

  const LH = 9; // row height in canvas pixels

  /**
   * Draw the top `rows` scores in a panel at (x, y), `w` wide, with the game's
   * own pixel text() and rect() helpers. Returns the panel height, or 0 when
   * there is no online board (inside the Android app).
   */
  function draw(game, o) {
    const b = board(game);
    if (b.status === 'off') return 0;
    const { text, rect, x, y, w, rows = 5 } = o;
    const c = {
      panel: 'rgba(20, 14, 30, 0.82)',
      edge: '#f7c948',
      title: '#f7c948',
      text: '#ffffff',
      dim: '#c8c0dc',
      you: '#7ee0ff',
      youBar: 'rgba(126, 224, 255, 0.22)',
      medals: ['#f7c948', '#e4e1f2', '#f0a868'],
      ...o.colors,
    };
    const t = (str, tx, ty, color, align) => text(str, tx, ty, c.outline === undefined ? { color, align } : { color, align, outline: c.outline });

    const top = b.data ? b.data.top.slice(0, rows) : [];
    const me = b.data && b.data.me;
    const meOutside = Boolean(me && !top.some((r) => r.you));
    const lines = Math.max(1, top.length) + (meOutside ? 1 : 0);
    const h = 19 + lines * LH + 2;

    rect(x, y, w, h, c.panel);
    rect(x, y, w, 2, c.edge);
    rect(x, y + h - 2, w, 2, c.edge);
    const blink = Math.floor(performance.now() / 500) % 2;
    t('HIGH SCORES', x + w / 2, y + 6, blink ? c.title : c.text, 'center');
    t('+', x + 6, y + 6, c.medals[0]);
    t('+', x + w - 9, y + 6, c.medals[0]);

    let ry = y + 18;
    if (!top.length) {
      const msg = b.status === 'loading' ? 'LOADING...' : b.status === 'error' ? 'SCORES OFFLINE' : 'NO SCORES YET - BE THE FIRST!';
      t(msg, x + w / 2, ry, c.dim, 'center');
      ry += LH;
    }
    for (const r of top) {
      const color = r.you ? c.you : r.rank <= 3 ? c.medals[r.rank - 1] : c.text;
      if (r.you) rect(x + 2, ry - 2, w - 4, LH, c.youBar);
      t(`${r.rank}.`, x + 15, ry, color, 'right');
      const score = String(r.score);
      const room = Math.max(3, Math.floor((w - 19 - score.length * 4 - 8) / 4));
      t(label(r.name).slice(0, room), x + 19, ry, r.you ? c.you : c.text);
      t(score, x + w - 5, ry, color, 'right');
      ry += LH;
    }
    if (meOutside) t(`YOU: ${me.rank}. OF ${b.data.total}   ${me.score}`, x + w / 2, ry, c.you, 'center');
    return h;
  }

  window.Indie24Scores = { player, submit, board, draw, label };
})();
