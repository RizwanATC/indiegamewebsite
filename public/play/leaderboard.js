/*
 * INDIE/24 leaderboard helper for the games in /play/.
 *
 *   <script src="../leaderboard.js"></script>
 *   window.Indie24Scores?.submit('slime-siege', score);
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

  function player() {
    let p = null;
    try {
      p = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {}
    if (!p || typeof p.id !== 'string') {
      p = { id: newId(), name: '' };
      try {
        localStorage.setItem(KEY, JSON.stringify(p));
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
      // Let the game page around the player refresh its leaderboard.
      if (window.parent !== window) window.parent.postMessage({ type: 'indie24:score', game }, location.origin);
      return data;
    } catch {
      return null;
    }
  }

  window.Indie24Scores = { player, submit };
})();
