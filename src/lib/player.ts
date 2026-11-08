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

export function getPlayer(): Player {
  let p: Player | null = null;
  try {
    p = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {}
  if (!p || typeof p.id !== 'string') {
    p = { id: newId(), name: '' };
    save(p);
  }
  return p;
}

function save(p: Player) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
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
