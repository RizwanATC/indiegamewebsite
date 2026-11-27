#!/usr/bin/env python3
"""Build Forest Liar's HD (cartoon) sprite atlas from the Gemini art in art/forest-liar/hd/.

Each source is a sheet of objects on flat magenta (#FF00FF) or a seamless square
texture. Objects are found by cutting the sheet along its empty rows and
columns, keyed (magenta -> alpha, with de-spill on the soft edge) and resized to
their size in game pixels times SCALE. The atlas is packed in game pixels, so
atlas.js keeps game-pixel rectangles and game.js multiplies by SCALE when it
reads atlas.png.

Output: public/play/forest-liar/assets/atlas.png, atlas.js, ui/*.png
Run: python3 scripts/build-forest-liar-hd.py   (needs Pillow and numpy)
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'art/forest-liar/hd'
OUT = ROOT / 'public/play/forest-liar/assets'
SCALE = 3  # atlas pixels per game pixel


def load(name):
    return np.asarray(Image.open(SRC / f'{name}.jpg').convert('RGB')).astype(np.float32)


def key(rgb):
    """Magenta background -> alpha, pulling the magenta tint out of soft edges."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    d = np.abs(r - 255) + g + np.abs(b - 255)
    a = np.clip((d - 150) / 90, 0, 1)
    spill = np.clip(np.minimum(r, b) - g, 0, None) * (1 - a)
    out = rgb.copy()
    out[..., 0] -= spill
    out[..., 2] -= spill
    return np.dstack([np.clip(out, 0, 255), a * 255]).astype(np.uint8)


def runs(mask1d, gap):
    """[start, end) runs of True, merging runs closer than gap."""
    idx = np.nonzero(mask1d)[0]
    if not len(idx):
        return []
    out = [[idx[0], idx[0] + 1]]
    for i in idx[1:]:
        if i - out[-1][1] < gap:
            out[-1][1] = i + 1
        else:
            out.append([i, i + 1])
    return out


def objects(rgba, step=4, small=0.06):
    """Boxes (x0, y0, x1, y1) of the objects on a sheet, top row first, left to right.

    Connected parts are found on a 1/step grid; parts smaller than `small` of the
    biggest (sparkles, a flying satchel) join the nearest big part.
    """
    solid = rgba[::step, ::step, 3] > 128
    h, w = solid.shape
    lab = np.zeros((h, w), np.int32)
    parts = []
    for j0, i0 in zip(*np.nonzero(solid)):
        if lab[j0, i0]:
            continue
        n = len(parts) + 1
        lab[j0, i0] = n
        stack = [(j0, i0)]
        ys, xs = [], []
        while stack:
            j, i = stack.pop()
            ys.append(j)
            xs.append(i)
            for dj in (-1, 0, 1):
                for di in (-1, 0, 1):
                    y, x = j + dj, i + di
                    if 0 <= y < h and 0 <= x < w and solid[y, x] and not lab[y, x]:
                        lab[y, x] = n
                        stack.append((y, x))
        parts.append([min(xs), min(ys), max(xs) + 1, max(ys) + 1, len(xs), {n}])
    big = max(p[4] for p in parts)
    main = [p for p in parts if p[4] >= big * small]
    for p in parts:
        if p[4] >= big * small:
            continue
        cx, cy = (p[0] + p[2]) / 2, (p[1] + p[3]) / 2
        dist = lambda m: max(m[0] - cx, 0, cx - m[2]) + max(m[1] - cy, 0, cy - m[3])
        m = min(main, key=dist)
        if dist(m) < 40:
            m[0], m[1], m[2], m[3] = min(m[0], p[0]), min(m[1], p[1]), max(m[2], p[2]), max(m[3], p[3])
            m[5] |= p[5]
    # Reading order: rows (by vertical overlap), then left to right.
    main.sort(key=lambda m: (m[1] + m[3]) / 2)
    rows = []
    for m in main:
        if rows and m[1] < rows[-1][-1][3] and (m[1] + m[3]) / 2 > rows[-1][0][1]:
            rows[-1].append(m)
        else:
            rows.append([m])
    out = []
    for r in rows:
        for m in sorted(r, key=lambda m: m[0]):
            out.append(Obj(rgba, lab, step, m))
    return out


class Obj:
    """One object on a sheet: its box and only its own pixels (neighbours masked out)."""

    def __init__(self, rgba, lab, step, m):
        self.rgba, self.lab, self.step, self.ids = rgba, lab, step, set(m[5])
        self.box = (m[0] * step, m[1] * step, m[2] * step, m[3] * step)

    def merge(self, other):
        self.ids |= other.ids
        a, b = self.box, other.box
        self.box = (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))
        return self

    def cut(self, pad=1):
        s = self.step
        x0, y0, x1, y1 = self.box
        x0, y0 = max(0, x0 - s * pad), max(0, y0 - s * pad)
        x1, y1 = min(self.rgba.shape[1], x1 + s * pad), min(self.rgba.shape[0], y1 + s * pad)
        own = Image.fromarray((np.isin(self.lab, list(self.ids)) * 255).astype(np.uint8))
        own = own.filter(ImageFilter.MaxFilter(3)).resize((self.lab.shape[1] * s, self.lab.shape[0] * s), Image.NEAREST)
        own = np.asarray(own)[: self.rgba.shape[0], : self.rgba.shape[1]][y0:y1, x0:x1] > 0
        out = self.rgba[y0:y1, x0:x1].copy()
        out[..., 3] = out[..., 3] * own
        return trim(out)


def trim(rgba):
    ys, xs = np.nonzero(rgba[..., 3] > 8)
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def fit(img, w=None, h=None):
    """Resize an RGBA array to game size (w x h, one may be None) times SCALE."""
    ih, iw = img.shape[:2]
    if w is None:
        w = round(iw * h / ih)
    if h is None:
        h = round(ih * w / iw)
    im = Image.fromarray(img, 'RGBA')
    # Premultiply so the transparent edge doesn't darken or tint.
    a = img[..., 3:4].astype(np.float32) / 255
    pre = Image.fromarray(np.dstack([img[..., :3] * a, img[..., 3:]]).astype(np.uint8), 'RGBA')
    small = np.asarray(pre.resize((w * SCALE, h * SCALE), Image.LANCZOS)).astype(np.float32)
    al = small[..., 3:4] / 255
    rgb = np.where(al > 0.004, small[..., :3] / np.maximum(al, 1e-3), 0)
    return np.dstack([np.clip(rgb, 0, 255), small[..., 3]]).astype(np.uint8), (w, h)


def texture(name, period):
    """A seamless square texture at `period` game pixels per repeat (RGBA, opaque)."""
    rgb = load(name)
    a = np.full(rgb.shape[:2] + (1,), 255, np.float32)
    im = Image.fromarray(np.dstack([rgb, a]).astype(np.uint8), 'RGBA')
    return np.asarray(im.resize((period * SCALE, period * SCALE), Image.LANCZOS))


def grass_overlay():
    """The grass band of the grass tile (blades and all), keyed off its dark backdrop and the dirt."""
    rgb = load('tile-grass')
    top = rgb[:520]
    h, w = top.shape[:2]
    backdrop = np.abs(top - np.array([68, 129, 31])).sum(2) < 45
    # Backdrop = the dark band reachable from the top edge.
    out = np.zeros((h, w), bool)
    stack = [(0, i) for i in range(w)]
    while stack:
        j, i = stack.pop()
        if 0 <= j < h and 0 <= i < w and backdrop[j, i] and not out[j, i]:
            out[j, i] = True
            stack.extend(((j + 1, i), (j - 1, i), (j, i + 1), (j, i - 1)))
    r, g = top[..., 0], top[..., 1]
    grass = Image.fromarray(((g > r + 5) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
    mask = (np.asarray(grass) > 0) & ~out
    ys = np.nonzero(mask.any(1))[0]
    rgba = np.dstack([top, mask * 255.0]).astype(np.uint8)[ys[0]:ys[-1] + 1]
    # One repeat of the source = one tile wide.
    im = Image.fromarray(rgba, 'RGBA')
    hh = round(rgba.shape[0] * 24 * SCALE / w)
    return np.asarray(im.resize((24 * SCALE, hh), Image.LANCZOS))


def over(base, top):
    out = Image.fromarray(base.copy(), 'RGBA')
    out.alpha_composite(Image.fromarray(top, 'RGBA'))
    return np.asarray(out)


def sign_board(img):
    """The arrow board plus a stub of its post (the game draws its own poles)."""
    widths = (img[..., 3] > 128).sum(1)
    rows = np.nonzero(widths > widths.max() * 0.6)[0]
    bottom = rows[-1] + int((rows[-1] - rows[0]) * 0.3)
    return trim(img[:bottom])


def main():
    sprites = {}  # name -> (rgba at SCALE, (w, h) in game px)

    def add(name, img, w=None, h=None):
        sprites[name] = fit(img, w, h)

    # Pip the raccoon: a 4 x 2 grid of equal cells. Every frame gets the same box
    # (cell width, tallest pose), feet on the bottom edge, so nothing jitters.
    pip = key(load('pip'))
    ch, cw = pip.shape[0] // 2, pip.shape[1] // 4
    cells = [pip[(k // 4) * ch:(k // 4 + 1) * ch, (k % 4) * cw:(k % 4 + 1) * cw] for k in range(8)]
    bottoms, tops = [], []
    for c in cells:
        ys = np.nonzero((c[..., 3] > 128).any(1))[0]
        tops.append(ys[0])
        bottoms.append(ys[-1] + 1)
    tall = max(b - t for b, t in zip(bottoms, tops))
    k = 28 / (bottoms[0] - tops[0])  # idle pose is 28 game px tall, like the old Pip
    fw, fh = round(cw * k), round(tall * k)
    names = ['pip_idle', 'pip_walk', 'pip_run', 'pip_run2', 'pip_stride', 'pip_jump', 'pip_fall', 'pip_hurt']
    for name, c, b in zip(names, cells, bottoms):
        add(name, c[max(0, b - tall):b], fw, fh)
    idle = pip[0:ch, 0:cw][max(0, bottoms[0] - tall):bottoms[0]]
    # Breathing frame: one game pixel shorter, feet in place.
    sq, _ = fit(idle, fw, fh - 1)
    pad = np.zeros((fh * SCALE, fw * SCALE, 4), np.uint8)
    pad[SCALE:] = sq
    sprites['pip_idle2'] = (pad, (fw, fh))

    def sheet(name, specs, merge=()):
        obs = objects(key(load(name)))
        for a, b in merge:
            obs[a].merge(obs[b])
        obs = [o for i, o in enumerate(obs) if i not in {b for _, b in merge}]
        assert len(obs) == len(specs), f'{name}: found {len(obs)} objects, expected {len(specs)}'
        for o, (n, w, h) in zip(obs, specs):
            img = o.cut()
            if n == 'sign':
                img = sign_board(img)
            add(n, img, w, h)

    sheet('traps', [('spikes', 26, 17), ('log_plank', 24, None), ('crush_block', 25, 26), ('log_end', 22, 22), ('spike_cart', None, 24)])
    sheet('items', [('star', None, 16), ('key', None, 16), ('shroom_bonus', None, 20), ('acorn', 9, None),
                    ('letter', 11, None), ('mailbox', None, 24), ('mailbox_flag', None, 8)])
    sheet('actors', [('shroom_face', None, 23), ('bush', 36, None), ('stump', None, 35), ('sign', 32, None)])
    sheet('big-trees', [('tree_face', None, 44), ('boss_tree', None, 62), ('tree_tall', None, 77)])
    sheet('bg-trees', [('tree_round', None, 76), ('tree_pine', None, 65), ('pine_small', None, 61)])
    sheet('decor', [('grass1', None, 9), ('grass2', None, 7), ('grass3', None, 13), ('tuft', None, 9),
                    ('flower', None, 16), ('plant', None, 15), ('shroom_tiny', None, 12)])
    sheet('logo', [('logo', None, 60)])
    sheet('fx', [('fx_dust', 46, None), ('fx_spark', None, 22)], merge=[(0, 1)])

    # Unlit checkpoint star.
    star, size = sprites['star']
    grey = star.copy()
    grey[..., :3] = (star[..., :3].mean(2, keepdims=True) * 0.7).astype(np.uint8)
    sprites['star_off'] = (grey, size)

    # Terrain. Dirt and stone repeat every 2 tiles (bigger detail); each tile is
    # one quadrant, chosen in game.js by (x % 2, y % 2). Grass and mossy stone
    # are the same quadrants with the grass band on top.
    blades = grass_overlay()
    t = 24 * SCALE
    for kind, src in (('dirt', 'tile-dirt'), ('stone', 'tile-stone')):
        tex = texture(src, 48)
        for i in (0, 1):
            for j in (0, 1):
                q = tex[j * t:(j + 1) * t, i * t:(i + 1) * t]
                sprites[f'tile_{kind}_{i}{j}'] = (q, (24, 24))
                top = 'grass' if kind == 'dirt' else 'stone_top'
                band = np.zeros_like(q)
                band[:blades.shape[0]] = blades
                sprites[f'tile_{top}_{i}{j}'] = (over(q, band), (24, 24))
    sprites['tile_water'] = (texture('tile-water', 24), (24, 24))

    # Far background, its sky colours are read back for game.js.
    bg = load('background')
    a = np.full(bg.shape[:2] + (1,), 255, np.float32)
    add('bg_forest', np.dstack([bg, a]).astype(np.uint8), None, 180)
    sky_top = '#%02x%02x%02x' % tuple(int(v) for v in bg[2, bg.shape[1] // 2])
    sky_low = '#%02x%02x%02x' % tuple(int(v) for v in bg[int(bg.shape[0] * 0.38), bg.shape[1] // 2])
    ground = '#%02x%02x%02x' % tuple(int(v) for v in bg[-2, bg.shape[1] // 2])

    # UI: touch pad and HUD icons are DOM images; the wooden menu plank goes in the atlas.
    ui = objects(key(load('ui')))
    assert len(ui) == 9, len(ui)
    (OUT / 'ui').mkdir(parents=True, exist_ok=True)
    for o, (n, w) in zip(ui[:8], [('dpad', 320), ('jump', 200), ('icon_music', 96), ('icon_mute', 96), ('icon_play', 96),
                                  ('icon_pause', 96), ('icon_restart', 96), ('icon_full', 96)]):
        img = o.cut()
        h = round(img.shape[0] * w / img.shape[1])
        Image.fromarray(img, 'RGBA').resize((w, h), Image.LANCZOS).save(OUT / 'ui' / f'{n}.png', optimize=True)
    add('wood_button', ui[8].cut(), 48, 16)

    # Shelf-pack in game pixels (1px gap), atlas = game rects x SCALE.
    order = sorted(sprites, key=lambda n: (-sprites[n][1][1], n))
    AW = 512
    x = y = shelf = 0
    rects = {}
    for n in order:
        w, h = sprites[n][1]
        if x + w > AW:
            x, y, shelf = 0, y + shelf + 1, 0
        rects[n] = (x, y, w, h)
        x += w + 1
        shelf = max(shelf, h)
    AH = y + shelf
    atlas = np.zeros((AH * SCALE, AW * SCALE, 4), np.uint8)
    for n, (x, y, w, h) in rects.items():
        img = sprites[n][0]
        atlas[y * SCALE:y * SCALE + img.shape[0], x * SCALE:x * SCALE + img.shape[1]] = img
    Image.fromarray(atlas, 'RGBA').save(OUT / 'atlas.png', optimize=True)
    js = ('// Generated by scripts/build-forest-liar-hd.py. Do not edit.\n'
          '// Rects are in game pixels; atlas.png is drawn at FOREST_LIAR_SCALE pixels per game pixel.\n'
          f'window.FOREST_LIAR_SCALE = {SCALE};\n'
          f'window.FOREST_LIAR_SKY = {json.dumps({"top": sky_top, "low": sky_low, "ground": ground})};\n'
          'window.FOREST_LIAR_ATLAS = ' + json.dumps({n: list(r) for n, r in sorted(rects.items())}, separators=(',', ':')) + ';\n')
    (OUT / 'atlas.js').write_text(js)
    manifest = {'source': 'art/forest-liar/hd', 'scale': SCALE, 'sprites': {n: {'rect': list(r)} for n, r in sorted(rects.items())}}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
    print(f'atlas {AW}x{AH} game px ({AW * SCALE}x{AH * SCALE}), {len(rects)} sprites')


if __name__ == '__main__':
    main()
