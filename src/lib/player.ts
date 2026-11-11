/**
 * The visitor's leaderboard identity, kept in localStorage under
 * "indie24.player" as { id, name }. public/play/leaderboard.js reads the same
 * key from inside the games, so keep the two in sync.
 */
export interface Player {
  id: string;
  name: string;
}

const KEY = 'indie24.player';
export const NAME_MAX = 16;
export const PLAYER_EVENT = 'indie24:player';

function newId(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
}

// The player is also kept in a one-year cookie. Some browsers (in-app
// browsers, Safari after a while) drop localStorage; the cookie brings the
// name back so visitors aren't asked again. The server refreshes it too.
const COOKIE = 'indie24_player';

const valid = (p: unknown): p is Player => Boolean(p) && typeof (p as Player).id === 'string' && typeof (p as Player).name === 'string';

function readCookie(): Player | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)indie24_player=([^;]*)/);
    return m ? JSON.parse(decodeURIComponent(m[1])) : null;
  } catch {
    return null;
  }
}

export function getPlayer(): Player {
  let stored: Player | null = null;
  try {
    stored = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {}
  const found = [stored, readCookie()].filter(valid);
  const p = found.find((c) => c.name) || found[0] || { id: newId(), name: '' };
  if (!valid(stored) || stored.id !== p.id || stored.name !== p.name) save(p);
  else writeCookie(p);
  return p;
}

function writeCookie(p: Player) {
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify({ id: p.id, name: p.name }))}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  } catch {}
}

function save(p: Player) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
  writeCookie(p);
}

/** Same rules as the server (api/scores.js). Returns '' when not usable. */
export function cleanName(raw: string): string {
  const name = raw
    .normalize('NFKC')
    .replace(/[\p{C}<>]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
  return name.length >= 2 ? name : '';
}

export function setName(name: string): Player {
  const p = { ...getPlayer(), name };
  save(p);
  // Rename any scores already on the boards. Fine to fail quietly.
  fetch('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player: p.id, name }),
  }).catch(() => {});
  window.dispatchEvent(new CustomEvent(PLAYER_EVENT, { detail: p }));
  return p;
}
