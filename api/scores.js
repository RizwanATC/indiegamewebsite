/**
 * Leaderboard API (a Vercel Function).
 *
 *   GET  /api/scores?game=slime-siege[&player=<id>]  -> top 10 (+ your rank)
 *   POST /api/scores  { game, player, name, score }   -> saves your best score
 *   POST /api/scores  { player, name }                -> renames you everywhere
 *
 * Storage is Upstash Redis (free plan), added from the Vercel dashboard:
 * Storage > Upstash for Redis > connect to this project. That sets the
 * KV_REST_API_URL / KV_REST_API_TOKEN env vars read below. Without them the
 * API answers 503 and the site shows "leaderboard coming soon".
 *
 * Scores come from the browser, so they can't be fully trusted. The checks
 * here (known games, score caps, name rules, a rate limit) stop casual abuse;
 * a determined cheater could still post a fake score. Remove one with
 * ZREM lb:<game> <playerId> in the Upstash console.
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

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });

/** Run several Redis commands in one round trip. */
async function redis(commands) {
  const res = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

const validPlayer = (id) => typeof id === 'string' && /^[a-z0-9-]{16,40}$/i.test(id);

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
  if (!URL_ || !TOKEN) return json({ error: 'not_configured' }, 503);
  const params = new URL(request.url).searchParams;
  const game = params.get('game') || '';
  if (!GAMES[game]) return json({ error: 'unknown_game' }, 400);
  const player = params.get('player');
  const key = `lb:${game}`;

  try {
    const cmds = [['ZREVRANGE', key, 0, TOP - 1, 'WITHSCORES'], ['ZCARD', key]];
    if (validPlayer(player)) cmds.push(['ZREVRANK', key, player], ['ZSCORE', key, player]);
    const [flat, total, rank, myScore] = await redis(cmds);

    const ids = [];
    for (let i = 0; i < flat.length; i += 2) ids.push({ id: flat[i], score: Number(flat[i + 1]) });
    const names = ids.length ? await redis([['HMGET', 'lb:names', ...ids.map((r) => r.id)]]).then((r) => r[0]) : [];

    const top = ids.map((r, i) => ({ rank: i + 1, name: names[i] || 'Player', score: r.score, you: r.id === player }));
    const me = rank === null || rank === undefined ? null : { rank: Number(rank) + 1, score: Number(myScore) };
    return json({ game, total: Number(total), top, me });
  } catch (err) {
    console.error(err);
    return json({ error: 'storage_error' }, 502);
  }
}

export async function POST(request) {
  if (!URL_ || !TOKEN) return json({ error: 'not_configured' }, 503);
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
    const rl = `rl:${clientIp(request)}`;
    const [count] = await redis([['INCR', rl], ['EXPIRE', rl, 60, 'NX']]);
    if (count > RATE_PER_MINUTE) return json({ error: 'slow_down' }, 429, { 'Retry-After': '60' });

    if (!hasScore) {
      // Rename only players who already have a score, so the table stays small.
      const [known] = await redis([['HEXISTS', 'lb:names', player]]);
      if (known) await redis([['HSET', 'lb:names', player, name]]);
      return json({ ok: true, name });
    }

    const key = `lb:${game}`;
    // GT: only replace the stored score when the new one is higher.
    const [, , rank, best] = await redis([
      ['HSET', 'lb:names', player, name],
      ['ZADD', key, 'GT', score, player],
      ['ZREVRANK', key, player],
      ['ZSCORE', key, player],
    ]);
    return json({ ok: true, rank: Number(rank) + 1, best: Number(best), newBest: Number(best) === score });
  } catch (err) {
    console.error(err);
    return json({ error: 'storage_error' }, 502);
  }
}
