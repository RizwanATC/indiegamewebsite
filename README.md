# INDIE/24 — One Indie Game a Day

A static indie game discovery site. Every day one game is featured; every past pick stays in a searchable archive. Visitors can play supported games in the browser, follow official download links, and read original write-ups.

Built with [Astro](https://astro.build) 7 and Content Collections. No database, no accounts, no paid services. Hosted for free on Vercel (Cloudflare Pages also works; config for both is included).

## Contents

- [Quick start](#quick-start)
- [Project structure](#project-structure)
- [Adding a game](#adding-a-game)
- [How the Game of the Day works](#how-the-game-of-the-day-works)
- [Browser games](#browser-games)
- [Android APKs](#android-apks)
- [Deploying to Vercel](#deploying-to-vercel)
- [Deploying to Cloudflare Pages](#deploying-to-cloudflare-pages)
- [Daily rebuild](#daily-rebuild)
- [Configuration](#configuration)
- [Monetization (later)](#monetization-later)
- [Known limitations](#known-limitations)

## Quick start

Requires **Node.js 22.23.4 or newer** (Node 24 LTS recommended; see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally
```

Other scripts:

| Command         | What it does                                                         |
| --------------- | -------------------------------------------------------------------- |
| `npm run check` | Type-check `.astro` and `.ts` files and validate content.            |
| `npm run art`   | Regenerate the procedural pixel-art used by the sample entries.      |

To preview the site as it will look on another day, set `BUILD_DATE`:

```bash
BUILD_DATE=2026-12-01 npm run build && npm run preview
```

## Project structure

```
public/
  _headers              Cloudflare Pages security headers (CSP etc.; vercel.json mirrors them)
  _redirects            Cloudflare Pages redirects
  play/<slug>/          Browser games hosted on this site (with permission)
  favicon.svg, icons, og-default.png
scripts/
  generate-sample-art.mjs   Draws the sample covers/screenshots
src/
  config.ts             Site name, timezone, emails, ads switch, embed allowlist
  content.config.ts     Game schema (validation lives here)
  content/games/*.md    One Markdown file per game  ← you edit these
  assets/games/<slug>/  Cover + screenshots for each game
  lib/games.ts          Queries: visible games, daily pick, related games
  components/           UI pieces (cards, player, download panel, ad slot…)
  layouts/              Base HTML shell with SEO tags
  pages/                Routes (home, /games/, /games/<slug>/, /genres/<genre>/, …)
  styles/global.css     Design tokens and shared styles
```

Routes:

| URL                  | Page                                                      |
| -------------------- | --------------------------------------------------------- |
| `/`                  | Game of the Day, search, genre/platform nav, recent picks |
| `/games/`            | Archive: search, filter, sort, Load More                  |
| `/games/<slug>/`     | Game page                                                 |
| `/genres/<genre>/`   | All games in a genre (static, indexable)                  |
| `/about/`, `/contact/`, `/report/`, `/privacy/` | Static pages                   |
| `/sitemap-index.xml`, `/robots.txt` | Generated at build time                    |

## Adding a game

1. Copy `src/content/games/_TEMPLATE.md` to `src/content/games/<slug>.md`. The file name is the URL: `/games/<slug>/`.
2. Put a 16:9 cover (at least 1600×900) and any screenshots in `src/assets/games/<slug>/`.
3. Fill in the front matter and write the description below it in your own words.
4. Run `npm run dev`. If a field is missing or wrong, the build fails with a message naming the field.

No template changes are needed. Fields:

| Field               | Required | Notes                                                                                       |
| ------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `title`             | yes      |                                                                                             |
| `slug`              | no       | Overrides the file name in the URL.                                                         |
| `shortDescription`  | yes      | 20–180 characters. Used on cards and as the meta description.                               |
| *(Markdown body)*   | yes      | The full, original description.                                                            |
| `developer`         | yes      | Exactly as the developer credits themselves. Never guess.                                   |
| `developerUrl`      | no       | Developer's own site.                                                                       |
| `releaseYear`       | no       |                                                                                             |
| `genres`            | yes      | `lowercase-with-hyphens`. Each genre gets a `/genres/<genre>/` page automatically.          |
| `platforms`         | yes      | `web`, `android`, `ios`, `windows`, `macos`, `linux`, `switch`, `playstation`, `xbox`.      |
| `featuredDate`      | yes      | `YYYY-MM-DD` in the site timezone. The game is hidden until this date.                      |
| `coverImage`, `coverAlt` | yes | Relative path to the image, plus alt text.                                                  |
| `screenshots`       | no       | List of `{ src, alt }`.                                                                     |
| `playUrl`           | no       | `/play/<slug>/` for hosted games or the official https URL. Requires `web` in platforms.     |
| `embeddable`        | no       | Default `true`. Set `false` if the host forbids iframes.                                    |
| `playerAspect`      | no       | Default `16/9`.                                                                             |
| `downloadUrl`       | no       | Official download page, store listing or authorized APK.                                    |
| `downloadType`      | no       | `page` (default), `store` or `apk`.                                                         |
| `downloadSource`    | no       | `official` (default) or `authorized-mirror`.                                                |
| `apkVersion`, `apkSha256` | no | Only what the developer publishes.                                                          |
| `officialUrl`       | no       | Official game page.                                                                         |
| `controls`          | no       | List of `{ input, action }`.                                                                |
| `estimatedPlaytime` | no       | Free text, e.g. `"20–40 minutes"`.                                                          |
| `featured`          | no       | Default `true`. `false` keeps it in the catalog but never makes it Game of the Day.         |
| `published`         | no       | Default `true`. `false` = draft, never built.                                               |
| `sample`            | no       | Marks fictional placeholder entries. Shows a "Sample entry" label everywhere.               |
| `sponsored`         | no       | Shows a "Sponsored" label everywhere.                                                       |

Optional sections (player, download, controls, links, playtime, release year) simply don't render when their fields are missing.

### The sample entries

All entries in `src/content/games/` are **fictional placeholders** (`sample: true`) with procedurally generated art. *Lantern Drift* and *Glyph Echo* are real, tiny games written for this project and hosted under `public/play/`. *Starling Post* is a draft (tests that drafts stay hidden) and *Frostbyte Harbor* is scheduled for 2026-12-01 (tests scheduling). Delete them all once you have real games.

## How the Game of the Day works

- `featuredDate` is a plain calendar date with no time or timezone. It's interpreted in `SITE.timezone` (`src/config.ts`, default `UTC`).
- At build time, "today" is computed in that timezone.
- Games with a `featuredDate` after today are **not built at all**: no page, no card, not in the sitemap.
- The Game of the Day is the `featured: true` game whose `featuredDate` is today.
- If nothing is scheduled for today, the home page shows the most recent past pick, labelled **"Latest pick"** with a short note.
- If there are no games at all, the home page shows an empty state.
- If two games share a date, the one whose title sorts first wins. Avoid that.

Because the site is static, it only changes when it's rebuilt. Set up the [daily rebuild](#daily-rebuild).

## Browser games

**Hosted on this site** (only with the developer's permission): put the HTML5 build in `public/play/<slug>/` with an `index.html`, and set `playUrl: "/play/<slug>/"`. The CSP in `public/_headers` allows WebAssembly and blob workers but **not inline scripts**, so move any inline `<script>` into a file. Cloudflare Pages limits single files to 25 MiB.

**Hosted elsewhere**: set `playUrl` to the official URL. It is embedded only if:

1. `embeddable` isn't `false`, **and**
2. its origin is listed in `EMBED_ALLOWED_ORIGINS` in `src/config.ts`, **and**
3. you add the same origin to `frame-src` in `public/_headers`.

Otherwise the page shows a **Play Game** button that opens the game in a new tab. We never try to get around a site's framing rules.

The player is click-to-load: nothing loads until the visitor presses Play. It shows a loading state, an error state (missing hosted files, or a 20-second timeout for external games, since cross-origin failures can't be detected directly), a Fullscreen button when the browser supports it, and an "Open in new tab" link.

## Our own game: Slime Siege

INDIE/24 ships one game it made itself, played on the site at `/play/slime-siege/` (portrait). The Android project in `android/` is a tiny WebView wrapper that bundles one game's folder from `public/play/`, so there is only one copy of each game. More games can be added to the `GAMES` map in `android/app/build.gradle`.

- **Portrait games:** set `playerAspect: "9/16"` and the game page shows the player inside a phone-shaped frame, with tall screenshot thumbnails.
- **Art:** every Slime Siege sprite is original and drawn from code by `scripts/generate-slime-siege-art.mjs`. Edit that script and re-run it to change the art; don't hand-edit the PNGs.
- **Build the APKs:** `.github/workflows/android-apk.yml` runs on every push that touches a game or `android/`. It builds one APK per game and keeps them as a workflow artifact for 3 days. It does not publish them, because the APKs are sold on itch.io. Upload the new APK to the game's itch.io page, then set `downloadUrl` to the itch.io page, `price: "$1.99"`, `downloadType: "apk"` and `platforms: ["web", "android"]` in the game's Markdown file. Point `apk` in `public/play/<game>/version.json` at the itch.io page too, so the in-app update banner sends players there.
- **Signing:** without secrets, each build is signed with a throwaway debug key, so players must uninstall before installing a newer build. To fix that, create a keystore once (`keytool -genkeypair -v -keystore release.jks -alias indie24 -keyalg RSA -keysize 4096 -validity 10000`) and add these repository secrets: `SIGNING_KEYSTORE_BASE64` (`base64 -w0 release.jks`), `SIGNING_STORE_PASSWORD`, `SIGNING_KEY_ALIAS`, `SIGNING_KEY_PASSWORD`. Keep the keystore backed up: losing it means you can't ship updates under the same signature.
- **Build locally:** install Android Studio (or the SDK + JDK 17 + Gradle 8.11), then `gradle -p android assembleRelease -Pgame=slime-siege`. Each game's app id, name, orientation and icon are set in `android/app/build.gradle` and `android/app/src/<game>/res/`.
- **Icons:** `node scripts/generate-slime-siege-icons.mjs` (after the art script).

## Android APKs

- Prefer the developer's official page or store listing (`downloadType: page` or `store`).
- Only use `downloadSource: authorized-mirror` with the developer's **written permission**, and keep that permission on file.
- **Don't put APKs in `public/`.** `.apk` is in `.gitignore` and static hosts limit file sizes (Cloudflare Pages: 25 MiB). Use a release on the developer's GitHub, or object storage such as Cloudflare R2, and link to it.
- APK downloads always show a safety note that says we have **not** verified the file. Don't claim a file is safe unless you've actually verified it.
- `apkSha256` is shown only as the checksum the developer published, so players can compare.

Hero and card buttons link to the game page's download section first, so players always see the source and the warning before downloading.

## Deploying to Vercel

The repository is connected to a Vercel project, so every push to `main` deploys production and every pull request gets a preview URL.

- Settings come from `vercel.json`: Astro preset, `npm run build`, output `dist`, trailing slashes, redirects and the same security headers as `public/_headers`. **If you change the CSP, change it in both files.**
- Node version comes from `engines` in `package.json` (Node 24 is used).
- The site URL is taken from Vercel's `VERCEL_PROJECT_PRODUCTION_URL`. When you add a custom domain, set `SITE_URL` (e.g. `https://indie24.com`) under **Project → Settings → Environment Variables** and redeploy.
- Vercel shows its comment toolbar on preview deployments. The strict CSP blocks it, which is harmless; turn the toolbar off in project settings if the console warnings bother you.

## Deploying to Cloudflare Pages

1. Push this repository to GitHub.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, and pick the repository.
3. Build settings:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Environment variables (Production and Preview):
   - `NODE_VERSION` = `24` (Cloudflare also reads `.nvmrc`, but setting it explicitly is safer)
   - `SITE_URL` = your public URL, e.g. `https://indie24.pages.dev` or your custom domain. This drives canonical URLs, Open Graph tags and the sitemap.
5. Deploy. `public/_headers` and `public/_redirects` are picked up automatically, and `404.html` is served for unknown URLs.

## Daily rebuild

1. Create a deploy hook for the production branch and copy its URL:
   - Vercel: **Project → Settings → Git → Deploy Hooks**
   - Cloudflare Pages: **Project → Settings → Builds → Deploy hooks**
2. GitHub → repository **Settings → Secrets and variables → Actions** → add secret `DEPLOY_HOOK_URL` with that URL.
3. `.github/workflows/daily-rebuild.yml` calls it at 00:05 UTC every day. If you change `SITE.timezone`, adjust the cron so it runs just after midnight in that timezone.

`.github/workflows/ci.yml` runs the production build on every pull request.

## Configuration

`src/config.ts`:

- `SITE.name`, `tagline`, `description`
- `SITE.timezone`: IANA timezone for `featuredDate`
- `SITE.contactEmail`, `SITE.reportEmail`: **replace the `example.com` placeholders before launch**
- `SITE.archivePageSize`, `SITE.recentCount`
- `ADS`: monetization switches (off)
- `EMBED_ALLOWED_ORIGINS`: external game hosts that may be embedded

Also edit `src/pages/privacy.astro` (a template that matches what the site does today) and the `site` fallback in `astro.config.mjs`.

## Monetization (later)

Nothing is enabled, and there are no fake ads or affiliate links.

- **Display ads**: `<AdSlot id="…" />` is already placed between content sections (home page, game sidebar). It renders nothing until `ADS.enabled = true`. When you add a network, put its markup in `src/components/AdSlot.astro`, add its domains to the CSP in `public/_headers`, update the privacy policy, and add a consent banner if your visitors' laws require one.
- **Affiliate links**: use `src/components/AffiliateLink.astro`. It adds `rel="sponsored"` and a visible "(affiliate link)" label.
- **Sponsored games**: set `sponsored: true`. A "Sponsored" label appears on cards, the home hero and the game page. Keep paid placements out of the Game of the Day, or label them clearly if you don't.

## Known limitations

- **Static means "today" is the build date.** Without the daily rebuild, the Game of the Day and scheduled games won't change on their own.
- **Archive filtering needs JavaScript.** Without it, the archive shows every game (no paging) and the filter form does nothing; genre pages still work.
- **Search covers titles only**, as specified. It doesn't search descriptions or developers.
- **External embed failures can't be detected reliably.** Browsers don't report why a cross-origin iframe failed, so the player falls back to a timeout message with an "open in new tab" link.
- **Fullscreen** isn't available for page elements on iPhone Safari; the button is hidden where the API is missing.
- **Contact and report forms use `mailto:`.** They need an email app on the visitor's device. A free form backend (e.g. a Cloudflare Worker) could replace this later.
- **The contact emails are placeholders** (`example.com`) until you change them.
- **The sample content is fictional**, and its art is procedurally generated. Replace it with real games and the developers' press-kit images.
- **Hosted games run on the same origin as the site**, so only host builds you trust. For untrusted builds, serve them from a separate domain and embed them as external games.
- **The privacy page is a template**, not legal advice.
