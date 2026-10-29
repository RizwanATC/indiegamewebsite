# Forest Liar

INDIE/24 game #2, a comedy trap platformer. Website page: `src/content/games/forest-liar.md`.
The game itself is `public/play/forest-liar/` (plain HTML + JS, no build step, same layout as Slime Siege).

| File | What it is |
| --- | --- |
| `public/play/forest-liar/game.js` | Engine: physics, traps, menus, save, touch pad, synthesized audio |
| `public/play/forest-liar/levels.js` | The 12 levels as ASCII maps (the legend is at the top of the file) |
| `public/play/forest-liar/assets/atlas.png` + `atlas.js` | Game sprites, generated |
| `public/play/forest-liar/assets/ui/` | Touch pad and HUD buttons, generated |
| `public/play/forest-liar/assets/manifest.json` | Sprite name → atlas rect → region of the source sheet |
| `art/forest-liar/forest_liar_asset_sheet.png` | The original asset sheet (kept here, not shipped) |
| `scripts/extract-forest-liar-art.py` | Cuts the sheet into the atlas (`python3 scripts/extract-forest-liar-art.py`, needs Pillow + numpy) |

## Run it

`npm run dev` and open `/play/forest-liar/`, or serve `public/` with any static server.
`npm run build` builds the whole site, including the game page.

## Add or change a level

Edit `levels.js`. Each level is 12 rows of 24px tiles. Keep the start (`P`) and the
mailbox (`E`) on solid ground. Jumps reach about 3 tiles up and 3 tiles across.
Bouncy mushrooms reach about 6 tiles up. Characters that aren't in the global legend
are defined in that level's `legend` (signs, stage platforms, bush timings).

`window.forestLiar.test` drives the simulation frame by frame without real time:
`enable()`, `start(i)`, `run({ left, right, jump }, frames)`, `snapshot()`, `restore()`.
During development every level was checked with a search bot built on this hook,
to make sure all 12 can be finished.

## Assets that had to be drawn

The sheet has no acorn, mailbox, letter, pause, restart or fullscreen icon, so those are
small pixel drawings in the sheet's palette, marked `reconstructed` in the manifest.
Pip's second idle frame is a one-pixel squash of the idle frame.

## Android

Not packaged yet. To add it, put an entry for `forest-liar` in `GAMES` in
`android/app/build.gradle` (landscape orientation), add launcher icons under
`android/app/src/forest-liar/res`, and add `version.json` plus the update check that
Slime Siege has. Then build with `-Pgame=forest-liar`. Add the download button to the
game page only after the APK is built and uploaded.
