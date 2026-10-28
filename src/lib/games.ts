import { getCollection, type CollectionEntry } from 'astro:content';
import { SITE, EMBED_ALLOWED_ORIGINS, PLATFORM_LABELS, type Platform } from '../config';

export type Game = CollectionEntry<'games'>;

/**
 * Today's calendar date (YYYY-MM-DD) in SITE.timezone.
 *
 * This is a static site, so "today" means "the day the site was built".
 * Rebuild once a day (see README, "Daily rebuild") so the Game of the Day
 * and newly scheduled games go live on time. BUILD_DATE=YYYY-MM-DD in the
 * environment overrides the clock for previews and tests.
 */
export function todayInSiteTz(now: Date = new Date()): string {
  const override = process.env.BUILD_DATE;
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SITE.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function gameSlug(game: Game): string {
  return game.data.slug ?? game.id;
}

export function gameUrl(game: Game): string {
  return `/games/${gameSlug(game)}/`;
}

/** Calendar dates compare correctly as strings. */
const byDateDesc = (a: Game, b: Game) =>
  b.data.featuredDate.localeCompare(a.data.featuredDate) || a.data.title.localeCompare(b.data.title);

/**
 * Every game that is visible on the site: published and with a
 * featuredDate on or before today. Future-dated games stay hidden (no page,
 * no card, not in the sitemap) until the first build on or after their date.
 * Sorted newest first.
 */
export async function getVisibleGames(today = todayInSiteTz()): Promise<Game[]> {
  const all = await getCollection('games', (g) => g.data.published && g.data.featuredDate <= today);
  assertUniqueSlugs(all);
  return all.sort(byDateDesc);
}

function assertUniqueSlugs(games: Game[]) {
  const seen = new Map<string, string>();
  for (const g of games) {
    const s = gameSlug(g);
    if (seen.has(s)) throw new Error(`Duplicate game slug "${s}" in ${seen.get(s)} and ${g.id}`);
    seen.set(s, g.id);
  }
}

export type DailyPick = {
  game: Game;
  /** true when the game is scheduled for exactly today. */
  isToday: boolean;
};

/**
 * The Game of the Day. If nothing is scheduled for today, falls back to the
 * most recent featured game, flagged with isToday = false so the UI can say
 * "Latest pick" instead of "Today's game". Returns undefined only when there
 * are no eligible games at all.
 */
export function pickDailyGame(games: Game[], today = todayInSiteTz()): DailyPick | undefined {
  const eligible = games.filter((g) => g.data.featured && g.data.featuredDate <= today).sort(byDateDesc);
  const game = eligible[0];
  if (!game) return undefined;
  return { game, isToday: game.data.featuredDate === today };
}

/** Games sharing the most genres, then the closest featured dates. */
export function relatedGames(game: Game, games: Game[], limit = 3): Game[] {
  const genres = new Set(game.data.genres);
  const day = (g: Game) => Date.parse(`${g.data.featuredDate}T00:00:00Z`);
  return games
    .filter((g) => g.id !== game.id)
    .map((g) => ({
      g,
      shared: g.data.genres.filter((x) => genres.has(x)).length,
      distance: Math.abs(day(g) - day(game)),
    }))
    .sort((a, b) => b.shared - a.shared || a.distance - b.distance)
    .slice(0, limit)
    .map((x) => x.g);
}

export function allGenres(games: Game[]): { genre: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const g of games) for (const genre of g.data.genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  return [...counts].map(([genre, count]) => ({ genre, count })).sort((a, b) => a.genre.localeCompare(b.genre));
}

export function allPlatforms(games: Game[]): Platform[] {
  const used = new Set(games.flatMap((g) => g.data.platforms));
  return (Object.keys(PLATFORM_LABELS) as Platform[]).filter((p) => used.has(p));
}

const CAPSULES = ['sun', 'sky', 'mint', 'gum', 'grape', 'red'] as const;
export type Capsule = (typeof CAPSULES)[number];

/** Capsule colour for a genre (or any key), stable across builds. */
export function capColor(key: string): Capsule {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CAPSULES[h % CAPSULES.length];
}

export function genreLabel(genre: string): string {
  return genre
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function platformLabel(p: Platform): string {
  return PLATFORM_LABELS[p];
}

/** "2026-10-27" → "27 Oct 2026". Formatted in UTC so the calendar date never shifts. */
export function formatDate(date: string, style: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat(SITE.locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`));
}

export function isExternal(url: string): boolean {
  return /^https?:\/\//.test(url);
}

export type PlayMode =
  | { kind: 'none' }
  | { kind: 'embed'; url: string; hosted: boolean }
  | { kind: 'external'; url: string };

/**
 * How the Play button behaves. Games hosted on this site are embedded.
 * External games are embedded only when the author marked them embeddable
 * AND their origin is on EMBED_ALLOWED_ORIGINS (which must match the CSP
 * frame-src). Everything else opens in a new tab: we never try to get around
 * another site's framing rules.
 */
export function playMode(game: Game): PlayMode {
  const { playUrl, embeddable } = game.data;
  if (!playUrl) return { kind: 'none' };
  if (!isExternal(playUrl)) return embeddable ? { kind: 'embed', url: playUrl, hosted: true } : { kind: 'external', url: playUrl };
  const origin = new URL(playUrl).origin;
  if (embeddable && EMBED_ALLOWED_ORIGINS.includes(origin)) return { kind: 'embed', url: playUrl, hosted: false };
  return { kind: 'external', url: playUrl };
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
