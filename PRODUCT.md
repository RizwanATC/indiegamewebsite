# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Mostly people on their phones who want a quick game to play right now, without installing anything or signing up. Desktop visitors are secondary but supported (keyboard and gamepad controls).

## Product Purpose
INDIE/24 ("One Indie Game a Day") features one indie game every day. Each past pick stays in a searchable archive. Visitors can play supported games straight in the browser, follow official download links (including Android APKs), and read short original write-ups. The site also hosts INDIE/24's own games, starting with Slime Siege. Success is a visitor going from landing to playing today's game in a tap or two, and coming back the next day.

## Positioning
A single daily pick rather than an endless catalogue, and many picks are playable on the page itself, including games INDIE/24 made.

## Operating Context
- Static Astro 7 site with content collections; one Markdown file per game in `src/content/games/`.
- Hosted on Vercel; every push to `main` deploys.
- The Game of the Day is the game whose `featuredDate` matches the build date in `SITE.timezone`.
- Browser games live under `public/play/<slug>/` and load in an on-page player after a tap. Portrait games use a phone-shaped frame on desktop and open full page on phones.

## Capabilities and Constraints
- No paid APIs or services. No accounts, no database.
- Strict CSP: `script-src 'self'`, no inline scripts; `vercel.json` and `public/_headers` must stay in sync.
- No tracking, analytics, cookies or ads unless actually implemented. `ADS.enabled` is false and must render nothing.
- Never fabricate developer names, ratings, reviews, download URLs or affiliate links.
- APK binaries are never committed to the site; downloads link to GitHub Releases.
- Pages: home (today's pick + recent picks), all games (archive with search, genre filter, load more), game detail (player, write-up, screenshots, controls, download panel), genre pages, about, contact, privacy, report, 404.

## Brand Commitments
- Name: INDIE/24. Line: "One Indie Game a Day".
- The 7 fictional sample games stay and remain clearly labelled as "Sample entry".
- Slime Siege's pixel art is original; never reintroduce third-party art packs with restrictive licences.
- Content, copy and features stay as they are. The redesign of 2026-10-28 changes only the visual design.

## Evidence on Hand
- One real game: Slime Siege (INDIE/24), playable and downloadable as an APK from the `android-latest` GitHub release.
- 7 fictional sample entries with procedurally generated pixel-art covers (`npm run art`).
- No testimonials, press, user counts or ratings exist; do not invent any.
- Contact and report emails are still `example.com` placeholders.

## Product Principles
1. Today's game first: the path from landing to playing is as short as possible.
2. Honest by default: label samples, show unverified-download warnings, never fake social proof.
3. Phone first: every page works one-handed on a small screen.
4. Light and free: static, fast, no third-party scripts.

## Accessibility & Inclusion
Keyboard-operable everywhere, visible focus, respects reduced motion, readable contrast on the light theme. Images carry real alt text.
