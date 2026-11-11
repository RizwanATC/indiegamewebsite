/**
 * Site-wide settings. Edit this file to rebrand or reconfigure INDIE/24.
 * Nothing here is secret: everything ends up in the public static build.
 */
export const SITE = {
  name: 'INDIE/24',
  tagline: 'One Indie Game a Day',
  description:
    'INDIE/24 is a tiny independent studio making small original games you can play free in your browser, with strategy guides and devlogs for every game.',
  /**
   * Timezone used to decide which calendar day it is when picking the
   * Game of the Day. `featuredDate` values in content files are calendar
   * dates (YYYY-MM-DD) in this timezone. Use an IANA name such as "UTC",
   * "Asia/Kuala_Lumpur" or "America/New_York".
   */
  timezone: 'UTC',
  /** Public contact address (shown on the Contact page). */
  contactEmail: 'rizwanmatnawi00@gmail.com',
  /** Address for broken-link, copyright and safety reports. */
  reportEmail: 'rizwanmatnawi00@gmail.com',
  /** Games per "page" in the archive before the Load More button. */
  archivePageSize: 6,
  /** Number of recently featured games shown on the home page. */
  recentCount: 6,
  /** Default social preview image (in /public). */
  defaultOgImage: '/og-default.png',
  locale: 'en',
} as const;

/**
 * Google AdSense. Everything is OFF until you fill it in:
 *
 *  1. `publisherId`: your AdSense ID, e.g. 'ca-pub-1234567890123456'. Setting
 *     it loads the AdSense script on every page (so Google can verify the
 *     site) and publishes /ads.txt. No ads appear yet.
 *  2. `slots`: the "data-ad-slot" number of each ad unit you create in
 *     AdSense (Ads > By ad unit > Display ads). A slot left empty stays hidden.
 *  3. `enabled`: set to true once AdSense has approved the site.
 *
 * Keep Auto ads OFF in AdSense so ads never land on top of a game player.
 * Turn on Google's consent message (Privacy & messaging > European
 * regulations) so visitors from the EEA/UK get a certified consent banner.
 */
export const ADS: {
  enabled: boolean;
  publisherId: string;
  slots: Record<string, string>;
  showDevPlaceholders: boolean;
} = {
  enabled: true,
  publisherId: 'ca-pub-5978067529669035',
  slots: {
    /** Home page, between Game of the Day and "Previously featured". */
    'home-mid': '9325901573',
    /** Game page sidebar, under the download links. */
    'game-sidebar': '1447411551',
  },
  /** Show a dashed placeholder box in `astro dev` only, to help plan layouts. */
  showDevPlaceholders: false,
};

/** True when the AdSense script should load (publisher ID filled in). */
export const ADSENSE_CONNECTED = /^ca-pub-\d{10,20}$/.test(ADS.publisherId);

/**
 * Origins that external playUrls may be embedded from. Keep this in sync with
 * the `frame-src` directive in public/_headers. A playUrl on any other origin
 * is shown as an external "Play" link instead of an embedded player.
 */
export const EMBED_ALLOWED_ORIGINS: string[] = [
  // e.g. 'https://html-classic.itch.zone',
];

/**
 * Games with an online leaderboard (slug -> what the score means). The list
 * of games and their score limits on the server is in api/scores.js; add a
 * game in both places.
 */
export const LEADERBOARDS: Record<string, { scoreLabel: string; note?: string }> = {
  'slime-siege': { scoreLabel: 'Score', note: 'Best score in one run.' },
  'forest-liar': { scoreLabel: 'Total', note: 'Your best score on each level, added up. Faster runs with fewer deaths score more.' },
  'bumble-dash': { scoreLabel: 'Score', note: 'Best score in one flight.' },
  'little-mayor': { scoreLabel: 'People', note: 'Biggest town after 40 days. The buildings change every day.' },
};

export const PLATFORM_LABELS = {
  web: 'Browser',
  android: 'Android',
  ios: 'iOS',
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  switch: 'Switch',
  playstation: 'PlayStation',
  xbox: 'Xbox',
} as const;

export type Platform = keyof typeof PLATFORM_LABELS;
export const PLATFORMS = Object.keys(PLATFORM_LABELS) as [Platform, ...Platform[]];
