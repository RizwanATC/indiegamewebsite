/**
 * Site-wide settings. Edit this file to rebrand or reconfigure INDIE/24.
 * Nothing here is secret: everything ends up in the public static build.
 */
export const SITE = {
  name: 'INDIE/24',
  tagline: 'One Indie Game a Day',
  description:
    'INDIE/24 features one hand-picked indie game every day. Play in your browser, find official downloads, and browse every game we have featured.',
  /**
   * Timezone used to decide which calendar day it is when picking the
   * Game of the Day. `featuredDate` values in content files are calendar
   * dates (YYYY-MM-DD) in this timezone. Use an IANA name such as "UTC",
   * "Asia/Kuala_Lumpur" or "America/New_York".
   */
  timezone: 'UTC',
  /** Public contact address. Replace before launch. */
  contactEmail: 'hello@example.com',
  /** Address for broken-link, copyright and safety reports. Replace before launch. */
  reportEmail: 'reports@example.com',
  /** Games per "page" in the archive before the Load More button. */
  archivePageSize: 6,
  /** Number of recently featured games shown on the home page. */
  recentCount: 6,
  /** Default social preview image (in /public). */
  defaultOgImage: '/og-default.png',
  locale: 'en',
} as const;

/**
 * Monetization switches. Everything is OFF by default. While `enabled` is
 * false, <AdSlot> renders nothing at all, so the site carries no ad markup,
 * no third-party scripts and no empty boxes.
 */
export const ADS = {
  enabled: false,
  /** Show a dashed placeholder box in `astro dev` only, to help plan layouts. */
  showDevPlaceholders: false,
} as const;

/**
 * Origins that external playUrls may be embedded from. Keep this in sync with
 * the `frame-src` directive in public/_headers. A playUrl on any other origin
 * is shown as an external "Play" link instead of an embedded player.
 */
export const EMBED_ALLOWED_ORIGINS: string[] = [
  // e.g. 'https://html-classic.itch.zone',
];

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
