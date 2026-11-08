/**
 * Leaderboard API (a Vercel Function).
 *
 *   GET  /api/scores?game=slime-siege[&player=<id>]  -> top 10 (+ your rank)
 *   POST /api/scores  { game, player, name, score }   -> saves your best score
 *   POST /api/scores  { player, name }                -> renames you everywhere
 *
 * Storage is Supabase. One-time setup:
 *   1. Run supabase/leaderboard.sql in the Supabase SQL Editor.
 *   2. In Vercel > Settings > Environment Variables add SUPABASE_URL
 *      (Project URL) and SUPABASE_SECRET_KEY (the secret / service_role key
 *      from Supabase > Project Settings > API Keys), then redeploy.
 * Without them the API answers 503 and the site shows "leaderboard coming soon".
 * The secret key stays on the server; it is never sent to browsers.
 *
 * Scores come from the browser, so they can't be fully trusted. The checks
 * here (known games, score caps, name rules, a rate limit) stop casual abuse;
 * a determined cheater could still post a fake score. Delete one in Supabase
 * > Table Editor > leaderboard_scores.
 */

/** Games with a leaderboard and the highest score a real run can reach. */
const GAMES = {
  'slime-siege': { max: 5_000_000 },
  'forest-liar': { max: 120_000 }, // 12 levels x 10,000 at most
  'bumble-dash': { max: 100_000 },
};
const TOP = 10;
const NAME_MAX = 16;
const RATE_PER_MINUTE = 30;

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const configured = () => Boolean(SUPABASE_URL && KEY);

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });

/** Call one of the leaderboard_* SQL functions from supabase/leaderboard.sql. */
async function rpc(fn, args) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  // Legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys don't.
  if (KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${KEY}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
  const text = await res.text();
  if (!res.ok) throw new Error(`supabase ${fn} ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

// A UUID, with or without dashes (what crypto.randomUUID or the fallback in the games make).
const validPlayer = (id) => typeof id === 'string' && /^([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12})$/i.test(id);

/** Tidy a display name, or return '' if it isn't usable. */
export function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  const name = raw
    .normalize('NFKC')
    .replace(/[\p{C}<>]/gu, '') // control/invisible characters and angle brackets
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
  return name.length >= 2 ? name : '';
}

function clientIp(request) {
  const fwd = request.headers.get('x-forwarded-for') || '';
  return fwd.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function GET(request) {
  if (!configured()) return json({ error: 'not_configured' }, 503);
  const params = new URL(request.url).searchParams;
  const game = params.get('game') || '';
  if (!GAMES[game]) return json({ error: 'unknown_game' }, 400);
  const player = params.get('player');

  try {
    const data = await rpc('leaderboard_top', { p_game: game, p_player: validPlayer(player) ? player : null, p_limit: TOP });
    return json({ game, total: Number(data.total), top: data.top.map((r) => ({ ...r, score: Number(r.score), rank: Number(r.rank) })), me: data.me && { rank: Number(data.me.rank), score: Number(data.me.score) } });
  } catch (err) {
    console.error(err);
    return json({ error: 'storage_error' }, 502);
  }
}

export async function POST(request) {
  if (!configured()) return json({ error: 'not_configured' }, 503);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const { game, player } = body || {};
  const name = cleanName(body?.name);
  if (!validPlayer(player)) return json({ error: 'bad_player' }, 400);
  if (!name) return json({ error: 'bad_name' }, 400);

  const hasScore = body.score !== undefined;
  const score = Number(body.score);
  if (hasScore) {
    if (!GAMES[game]) return json({ error: 'unknown_game' }, 400);
    if (!Number.isInteger(score) || score <= 0 || score > GAMES[game].max) return json({ error: 'bad_score' }, 400);
  }

  try {
    const allowed = await rpc('leaderboard_allow', { p_ip: clientIp(request), p_limit: RATE_PER_MINUTE });
    if (!allowed) return json({ error: 'slow_down' }, 429, { 'Retry-After': '60' });

    if (!hasScore) {
      await rpc('leaderboard_rename', { p_player: player, p_name: name });
      return json({ ok: true, name });
    }
    const r = await rpc('leaderboard_submit', { p_game: game, p_player: player, p_name: name, p_score: score });
    return json({ ok: true, rank: Number(r.rank), best: Number(r.best), newBest: r.newBest });
  } catch (err) {
    console.error(err);
    return json({ error: 'storage_error' }, 502);
  }
}
