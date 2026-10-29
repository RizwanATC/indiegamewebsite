#!/usr/bin/env python3
"""Cut Forest Liar's game sprites out of the supplied asset sheet.

Input:  art/forest-liar/forest_liar_asset_sheet.png (the original contact
        sheet, kept untouched)
Output: public/play/forest-liar/assets/atlas.png   packed game sprites
        public/play/forest-liar/assets/atlas.js    sprite rectangles for game.js
        public/play/forest-liar/assets/ui/*.png    touch controls and icons
        public/play/forest-liar/assets/manifest.json  name -> file, size and
                                                  the region of the source sheet

The sheet is painted at roughly 2.3 screen pixels per art pixel on a dark
navy panel. Every sprite is cut from its own rectangle, the panel colour is
flood-filled away from the rectangle's border (so dark outlines inside the
sprite survive), and the result is shrunk to about one art pixel per game
pixel with a premultiplied box filter and a hard alpha threshold, which keeps
edges crisp. A few things the sheet doesn't have (acorn, mailbox, letter,
pause and restart glyphs) are drawn below in the sheet's palette; the
manifest marks them "reconstructed".

Run: python3 scripts/extract-forest-liar-art.py   (needs Pillow and numpy)
"""
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / 'art/forest-liar/forest_liar_asset_sheet.png'
OUT = ROOT / 'public/play/forest-liar/assets'
SCALE = 0.44  # sheet pixels -> game pixels (one art pixel is ~2.3 sheet pixels)
BG = np.array([13, 21, 26])  # panel colour

src = np.asarray(Image.open(SHEET).convert('RGB')).astype(np.int32)


def cutout(box, tol=46, keep='largest'):
    """RGBA crop of box=(x, y, w, h) with the panel background removed."""
    x, y, w, h = box
    rgb = src[y:y + h, x:x + w]
    near_bg = np.abs(rgb - BG).sum(2) <= tol
    outside = np.zeros((h, w), bool)
    q = deque()
    for i in range(w):
        q.extend(((0, i), (h - 1, i)))
    for j in range(h):
        q.extend(((j, 0), (j, w - 1)))
    while q:
        j, i = q.popleft()
        if 0 <= j < h and 0 <= i < w and near_bg[j, i] and not outside[j, i]:
            outside[j, i] = True
            q.extend(((j + 1, i), (j - 1, i), (j, i + 1), (j, i - 1)))
    alpha = ~outside
    if keep == 'largest':
        alpha = largest_parts(alpha)
    rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return trim(rgba)


def largest_parts(mask, frac=0.12):
    """Keep the biggest blob plus any blob at least frac of its size (drops neighbours' edges and stray labels)."""
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    sizes = [0]
    for j0, i0 in zip(*np.nonzero(mask)):
        if lab[j0, i0]:
            continue
        n = len(sizes)
        lab[j0, i0] = n
        q = deque([(j0, i0)])
        c = 0
        while q:
            j, i = q.popleft()
            c += 1
            for dj in (-1, 0, 1):
                for di in (-1, 0, 1):
                    y, x = j + dj, i + di
                    if 0 <= y < h and 0 <= x < w and mask[y, x] and not lab[y, x]:
                        lab[y, x] = n
                        q.append((y, x))
        sizes.append(c)
    if len(sizes) == 1:
        return mask
    big = max(sizes)
    keep = [k for k, s in enumerate(sizes) if k and s >= big * frac]
    return np.isin(lab, keep)


def trim(rgba):
    ys, xs = np.nonzero(rgba[:, :, 3])
    if not len(xs):
        return rgba
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def shrink(rgba, size=None, scale=SCALE):
    """Premultiplied box downscale with a hard alpha edge."""
    h, w = rgba.shape[:2]
    if size is None:
        size = (max(1, round(w * scale)), max(1, round(h * scale)))
    a = rgba[:, :, 3:4].astype(np.float32) / 255
    pre = np.dstack([rgba[:, :, :3] * a, a * 255]).astype(np.float32)
    im = Image.fromarray(pre.clip(0, 255).astype(np.uint8), 'RGBA')
    # Pillow's BOX filter on RGBA treats channels independently, which is
    # exactly premultiplied averaging here.
    small = np.asarray(im.resize(size, Image.BOX)).astype(np.float32)
    al = small[:, :, 3:4] / 255
    rgb = np.where(al > 0, small[:, :, :3] / np.maximum(al, 1e-6), 0)
    out = np.dstack([rgb, np.where(al >= 0.5, 255, 0)]).clip(0, 255).astype(np.uint8)
    return out


def raw(box):
    """Opaque crop, for terrain tiles cut from inside a block."""
    x, y, w, h = box
    rgb = src[y:y + h, x:x + w]
    return np.dstack([rgb, np.full((h, w), 255)]).astype(np.uint8)


def pixels(rows, palette):
    """Small sprite from strings, one char per pixel, '.' transparent."""
    h, w = len(rows), max(len(r) for r in rows)
    out = np.zeros((h, w, 4), np.uint8)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.':
                out[j, i] = (*palette[ch], 255)
    return out


def hexrgb(s):
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))


# ---------------------------------------------------------------- sprites --
# name: (box on the sheet, options). size forces exact game pixels.
CUT = {
    # Pip (the sheet's red-scarf hero). Run uses walk/run/run2/stride.
    'pip_idle': ((483, 71, 49, 67), {}),
    'pip_walk': ((553, 71, 50, 67), {}),
    'pip_run': ((616, 74, 50, 64), {}),
    'pip_run2': ((676, 76, 49, 62), {}),
    'pip_jump': ((736, 75, 51, 61), {}),
    'pip_fall': ((800, 57, 48, 64), {}),
    'pip_stride': ((861, 70, 48, 63), {}),
    'pip_hurt': ((1068, 79, 36, 59), {}),
    'pip_die': ((1113, 106, 63, 31), {}),
    # Collectibles / items
    'star': ((1470, 60, 39, 41), {}),
    'shroom_bonus': ((1241, 144, 48, 50), {}),
    'heart': ((1349, 62, 42, 39), {}),
    'key': ((1414, 61, 34, 40), {}),
    'gem': ((1282, 61, 40, 40), {}),
    # Enemies and props used as forest actors
    'shroom_face': ((834, 254, 48, 58), {}),
    'slime': ((610, 276, 52, 36), {}),
    'snail': ((899, 266, 56, 45), {}),
    'bee': ((1132, 257, 41, 43), {}),
    'tree_face': ((600, 390, 104, 98), {}),
    'walking_log': ((705, 436, 65, 51), {}),
    'ghost_leaf': ((973, 401, 42, 65), {}),
    'boss_tree': ((1033, 363, 150, 136), {}),
    # Traps / hazards
    'spikes': ((1218, 320, 63, 43), {}),
    'log_plank': ((1294, 314, 59, 37), {}),
    'crush_block': ((1368, 296, 61, 63), {}),
    'arrow': ((1221, 439, 69, 34), {}),
    'fire': ((1397, 436, 39, 63), {}),
    'poison': ((1458, 452, 52, 47), {}),
    # Decorations
    'tree_round': ((778, 597, 151, 176), {}),
    'tree_pine': ((940, 580, 110, 153), {'keep': 'largest'}),
    'tree_tall': ((1057, 590, 115, 182), {}),
    'stump': ((1172, 615, 101, 84), {}),
    'sign': ((1291, 607, 74, 45), {}),
    'fence': ((1393, 608, 104, 75), {'keep': 'all'}),
    'bush': ((886, 714, 87, 57), {}),
    'shroom_small': ((1016, 724, 36, 47), {}),
    'shroom_tiny': ((1362, 712, 35, 38), {}),
    'rock': ((1160, 711, 106, 60), {}),
    'flower': ((1415, 720, 52, 51), {}),
    'grass1': ((1280, 681, 39, 24), {}),
    'grass2': ((1325, 683, 38, 22), {}),
    'grass3': ((1468, 743, 42, 28), {}),
    'plant': ((1278, 722, 34, 49), {}),
    'vine': ((350, 410, 70, 120), {}),
    'pine_small': ((431, 387, 53, 143), {}),
    'tuft': ((498, 503, 53, 27), {}),
    # Title logo, at a larger scale than the game sprites
    'logo': ((22, 16, 434, 94), {'keep': 'all', 'scale': 0.7}),
    # Effects
    'fx_dust': ((1303, 833, 110, 67), {}),
    'fx_spark': ((1228, 844, 41, 53), {}),
    'fx_leaf': ((1346, 934, 52, 43), {}),
    'fx_burst': ((1430, 917, 74, 73), {}),
    'fx_slash': ((1099, 845, 97, 56), {}),
}

# Terrain tiles: opaque crops from inside the blocks, forced to the 24px grid.
TILE = 24
TILES = {
    'tile_grass': (30, 241, 49, 49),
    'tile_dirt': (162, 324, 36, 36),
    'tile_dirt2': (31, 266, 46, 26),
    'tile_stone_top': (362, 289, 46, 46),
    'tile_stone': (362, 334, 44, 40),
    'tile_water': (40, 470, 48, 48),
}

PAL = {k: hexrgb(v) for k, v in {
    'o': '#1b1210', 'b': '#7a4a24', 'B': '#a8692f', 'l': '#cf8f45', 'g': '#5a8f2b', 'G': '#8cc63e',
    'c': '#f4ecd2', 'C': '#d8caa6', 'r': '#d8433a', 'R': '#9b2a2a', 'y': '#f7c948', 's': '#6b7c88',
    'S': '#9aa9b3', 'w': '#ffffff', 'n': '#13202a',
}.items()}

DRAWN = {
    # Acorns roll out of tree hollows in Acorn Delivery.
    'acorn': [
        '...oo...',
        '.oobboo.',
        'obBBBBbo',
        'oooooooo',
        '.olllBo.',
        '.olllBo.',
        '..olBo..',
        '...oo...',
    ],
    # Pip delivers the letter to a mailbox at the end of every level.
    'mailbox': [
        '..oooooooooooo....',
        '.orrrrrrrrrrrroo..',
        'orrrrrrrrrrrrroRo.',
        'orrrrrrrrrrrrrorRo',
        'orrrrrrrrrrrrrorRo',
        'orrrrrrrrrrrrrorRo',
        'oRRRRRRRRRRRRRoRRo',
        'oooooooooooooooooo',
        '.......obbo.......',
        '.......oBbo.......',
        '.......oBbo.......',
        '.......oBbo.......',
        '.......oBbo.......',
        '.......oBbo.......',
        '.......oBbo.......',
        '.......oBbo.......',
        '......oBBbbo......',
        '.....oooooooo.....',
    ],
    'mailbox_flag': [
        'ooooo',
        'oyyyo',
        'oyyyo',
        'ooooo',
        'o....',
        'o....',
        'o....',
    ],
    'letter': [
        'ooooooooo',
        'occccccco',
        'oCcccccCo',
        'ocCcrcCco',
        'occcrrcco',
        'ooooooooo',
    ],
}

UI = {
    # Touch controls and menu icons keep the sheet's resolution (shown in CSS px).
    'dpad': ((606, 834, 165, 166), {}),
    'jump': ((818, 871, 105, 107), {}),
    'icon_settings': ((31, 953, 53, 49), {}),
    'icon_music': ((117, 953, 52, 49), {}),
    'icon_mute': ((218, 953, 52, 49), {}),
    'icon_home': ((321, 952, 52, 50), {}),
    'icon_play': ((429, 953, 52, 49), {}),
    'btn_pause': ((31, 900, 139, 44), {}),
}


def main():
    sprites = {}
    manifest = {'source': 'art/forest-liar/forest_liar_asset_sheet.png', 'scale': SCALE, 'sprites': {}, 'ui': {}}
    for name, (box, opt) in CUT.items():
        cut_opt = {k: v for k, v in opt.items() if k in ('tol', 'keep')}
        sprites[name] = shrink(cutout(box, **cut_opt), opt.get('size'), opt.get('scale', SCALE))
        manifest['sprites'][name] = {'region': box}
    for name, box in TILES.items():
        sprites[name] = shrink(raw(box), (TILE, TILE))
        manifest['sprites'][name] = {'region': box}
    for name, rows in DRAWN.items():
        sprites[name] = pixels(rows, PAL)
        manifest['sprites'][name] = {'reconstructed': True}
    # Wooden menu button with the word removed: caps plus a stretchable middle.
    btn = cutout(UI['btn_pause'][0], keep='all')
    h = btn.shape[0]
    cap = 24
    mid = btn[:, cap + 2:cap + 6]
    blank = np.concatenate([btn[:, :cap], np.repeat(mid, 4, axis=1), btn[:, -cap:]], axis=1)
    sprites['wood_button'] = shrink(blank, scale=0.5)
    manifest['sprites']['wood_button'] = {'region': UI['btn_pause'][0], 'note': 'label removed, middle stretched'}
    # Background: the wide forest panel without the stray frame lines on its left.
    bg = raw((341, 586, 397, 186))
    sprites['bg_forest'] = shrink(bg, scale=0.95)
    manifest['sprites']['bg_forest'] = {'region': (341, 586, 397, 186), 'note': 'cropped right of a frame artifact'}

    # Pip's idle breath: second frame squashed by one pixel.
    idle = sprites['pip_idle']
    breath = np.zeros_like(idle)
    breath[1:] = np.asarray(Image.fromarray(idle).resize((idle.shape[1], idle.shape[0] - 1), Image.NEAREST))
    sprites['pip_idle2'] = breath
    manifest['sprites']['pip_idle2'] = {'derived': 'pip_idle', 'note': 'one-pixel squash for breathing'}
    # Retracted shy mushroom: just the cap peeking out of the ground.
    face = sprites['shroom_face']
    sprites['shroom_peek'] = face[: max(4, face.shape[0] * 2 // 5)].copy()
    manifest['sprites']['shroom_peek'] = {'derived': 'shroom_face'}
    # Unlit checkpoint star.
    star = sprites['star'].copy()
    grey = star[:, :, :3].mean(2, keepdims=True) * 0.7
    star[:, :, :3] = np.repeat(grey, 3, axis=2).astype(np.uint8)
    sprites['star_off'] = star
    manifest['sprites']['star_off'] = {'derived': 'star'}

    # Shelf-pack into one atlas (1px gap so nearest sampling never bleeds).
    order = sorted(sprites, key=lambda n: -sprites[n].shape[0])
    AW = 512
    x = y = shelf = 0
    rects = {}
    for n in order:
        h, w = sprites[n].shape[:2]
        if x + w > AW:
            x, y, shelf = 0, y + shelf + 1, 0
        rects[n] = (x, y, w, h)
        x += w + 1
        shelf = max(shelf, h)
    AH = y + shelf
    atlas = np.zeros((AH, AW, 4), np.uint8)
    for n, (x, y, w, h) in rects.items():
        atlas[y:y + h, x:x + w] = sprites[n]
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(atlas, 'RGBA').save(OUT / 'atlas.png', optimize=True)
    for n, r in rects.items():
        manifest['sprites'][n].update({'file': 'atlas.png', 'rect': r})
    js = ('// Generated by scripts/extract-forest-liar-art.py. Do not edit.\n'
          'window.FOREST_LIAR_ATLAS = ' + json.dumps({n: list(r) for n, r in sorted(rects.items())}, separators=(',', ':')) + ';\n')
    (OUT / 'atlas.js').write_text(js)

    (OUT / 'ui').mkdir(exist_ok=True)
    for name, (box, opt) in UI.items():
        if name == 'btn_pause':
            continue
        im = cutout(box, keep='all')
        Image.fromarray(im, 'RGBA').save(OUT / 'ui' / f'{name}.png', optimize=True)
        manifest['ui'][name] = {'file': f'ui/{name}.png', 'region': box, 'size': [im.shape[1], im.shape[0]]}
    # Pause and restart glyphs on the sheet's square icon frame.
    frame = cutout(UI['icon_play'][0], keep='all')
    fh, fw = frame.shape[:2]
    inner = frame[fh // 2, 8].copy()  # frame fill colour
    light = np.array([220, 224, 222, 255], np.uint8)
    for name in ('icon_pause', 'icon_restart', 'icon_full'):
        im = frame.copy()
        im[10:fh - 10, 10:fw - 10] = inner
        cy, cx = fh // 2, fw // 2
        if name == 'icon_pause':
            im[cy - 11:cy + 11, cx - 10:cx - 4] = light
            im[cy - 11:cy + 11, cx + 4:cx + 10] = light
        elif name == 'icon_full':
            for sx in (-1, 1):
                for sy in (-1, 1):
                    x0, y0 = cx + sx * 12, cy + sy * 12
                    xs = sorted((x0, x0 - sx * 9))
                    ys = sorted((y0, y0 - sy * 9))
                    im[min(y0, y0 - sy * 4):max(y0, y0 - sy * 4) + 1, xs[0]:xs[1] + 1] = light
                    im[ys[0]:ys[1] + 1, min(x0, x0 - sx * 4):max(x0, x0 - sx * 4) + 1] = light
        else:
            yy, xx = np.mgrid[:fh, :fw]
            r = np.hypot(yy - cy, xx - cx)
            ang = np.degrees(np.arctan2(yy - cy, xx - cx))
            ring = (r >= 8) & (r <= 13) & ~((ang > -80) & (ang < -20))
            im[ring] = light
            # arrow head at the gap
            for k in range(7):
                im[cy - 16 + k, cx + 2 + k - 3: cx + 2 + 10 - k] = light
        Image.fromarray(im, 'RGBA').save(OUT / 'ui' / f'{name}.png', optimize=True)
        manifest['ui'][name] = {'file': f'ui/{name}.png', 'reconstructed': True, 'note': 'glyph drawn on the icon frame'}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
    print(f'atlas {AW}x{AH}, {len(rects)} sprites')


if __name__ == '__main__':
    main()
