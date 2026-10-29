import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { PLATFORMS } from './config';

/** Calendar date, no time and no timezone: "2026-10-27". */
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD calendar date, e.g. "2026-10-27"')
  .refine((value) => {
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
  }, 'Not a real calendar date');

/** Absolute https URL, or a site-relative path starting with "/". */
const link = z.union([z.url({ protocol: /^https$/ }), z.string().regex(/^\/(?!\/)/, 'Relative links must start with "/"')]);

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

const games = defineCollection({
  // The file name (without .md) becomes the URL: /games/<file-name>/
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/games' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1).max(80),
        /** Optional override. Defaults to the file name. */
        slug: slug.optional(),
        /** One or two sentences. Used on cards and as the meta description. */
        shortDescription: z.string().min(20).max(180),
        developer: z.string().min(1),
        developerUrl: link.optional(),
        releaseYear: z.number().int().min(1970).max(2100).optional(),
        genres: z.array(slug).min(1),
        platforms: z.array(z.enum(PLATFORMS)).min(1),
        /** Day this game is (or was) the Game of the Day, in SITE.timezone. */
        featuredDate: calendarDate,
        coverImage: image(),
        coverAlt: z.string().min(1),
        screenshots: z.array(z.object({ src: image(), alt: z.string().min(1) })).default([]),

        /** Where the browser version lives. "/play/<slug>/" for games hosted here. */
        playUrl: link.optional(),
        /** Set false if the game's host forbids iframes. A Play button opens it in a new tab instead. */
        embeddable: z.boolean().default(true),
        /** Aspect ratio of the embedded player, e.g. "16/9" or "4/3". */
        playerAspect: z.string().regex(/^\d+\/\d+$/).default('16/9'),

        /** Official download page, store page, or an authorized APK file. */
        downloadUrl: link.optional(),
        /** What downloadUrl points at. */
        downloadType: z.enum(['apk', 'store', 'page']).default('page'),
        /**
         * "official": the developer's own page or store listing.
         * "authorized-mirror": a copy hosted by INDIE/24 with the developer's written permission.
         */
        downloadSource: z.enum(['official', 'authorized-mirror']).default('official'),
        /**
         * Price for a paid download, e.g. "$1.99". Set it when downloadUrl is a
         * page that sells the game (such as itch.io); the button then says "Buy".
         */
        price: z.string().optional(),
        apkVersion: z.string().optional(),
        /** SHA-256 published by the developer, shown so players can compare it. */
        apkSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),

        officialUrl: link.optional(),
        controls: z.array(z.object({ input: z.string().min(1), action: z.string().min(1) })).default([]),
        /** Free text, e.g. "10–20 minutes" or "3–5 hours". */
        estimatedPlaytime: z.string().optional(),

        /** Eligible for Game of the Day. False keeps it in the catalog only. */
        featured: z.boolean().default(true),
        /** Drafts (false) are never built. */
        published: z.boolean().default(true),
        /** Fictional placeholder entry. Shows a "Sample" label everywhere. */
        sample: z.boolean().default(false),
        /** Paid placement. Shows a "Sponsored" label everywhere. */
        sponsored: z.boolean().default(false),
      })
      .refine((g) => !(g.downloadType === 'apk' && !g.downloadUrl), {
        message: 'downloadType "apk" needs a downloadUrl',
        path: ['downloadUrl'],
      })
      .refine((g) => !(g.downloadSource === 'authorized-mirror' && !g.downloadUrl), {
        message: 'downloadSource "authorized-mirror" needs a downloadUrl',
        path: ['downloadSource'],
      })
      .refine((g) => !g.playUrl || g.platforms.includes('web'), {
        message: 'A game with playUrl should list "web" in platforms',
        path: ['platforms'],
      }),
});

export const collections = { games };
