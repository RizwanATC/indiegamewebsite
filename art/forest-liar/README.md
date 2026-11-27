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
| `art/forest-liar/hd/*.jpg` | Source art (cartoon style, made with Gemini on a magenta #FF00FF background). Kept here, not shipped |
| `scripts/build-forest-liar-hd.py` | Keys out the magenta, cuts every sheet into sprites and builds the atlas + UI (`python3 scripts/build-forest-liar-hd.py`, needs Pillow + numpy) |

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

## Art and resolution

Pip is a raccoon courier (grey, eye mask, red bandana, satchel). The game world is still
480x270 game pixels, but the atlas is drawn at 3x (`window.FOREST_LIAR_SCALE` in
`atlas.js`), the canvas backing store is 3x, and `blit()` in `game.js` maps atlas rects
(in game pixels) to the 3x sheet. 3x keeps the baked terrain of the widest level
(110 columns) under the 8192px canvas limit, so don't raise it without checking that.

Dirt and stone repeat every 2 tiles: tiles are named `tile_dirt_XY` where X and Y are the
column and row modulo 2. Grass tops are a separate overlay composited onto those.
Pip's second idle frame is a one-pixel squash of the idle frame.

## Android

Not packaged yet. To add it, put an entry for `forest-liar` in `GAMES` in
`android/app/build.gradle` (landscape orientation), add launcher icons under
`android/app/src/forest-liar/res`, and add `version.json` plus the update check that
Slime Siege has. Then build with `-Pgame=forest-liar`. Add the download button to the
game page only after the APK is built and uploaded.
