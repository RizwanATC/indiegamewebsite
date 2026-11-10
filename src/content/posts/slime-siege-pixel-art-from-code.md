---
title: "Devlog: drawing all of Slime Siege's pixel art with code"
description: "Why every sprite in Slime Siege is drawn by a script instead of in a paint program, and how ellipses, outlines and squash-and-stretch turn into a hopping slime."
kind: devlog
date: "2026-11-10"
game: slime-siege
---

Every sprite in [Slime Siege](/games/slime-siege/), from the hero and the
slimes to the chickens, chests, trees and the dirt path, is drawn by a single
script of about 700 lines. Nobody painted these pixels by hand. Here's why we
did it that way, and how it works.

## Why draw art with code?

The first prototype of Slime Siege used a popular pixel-art asset pack. It
looked lovely, but its licence didn't allow the files to be shared, and we
wanted the game's source to be public. So we had two choices: paint a whole
new set of sprites, or write a program that draws them.

We chose the program, for three reasons:

1. **Everything is original and ours.** The art is part of the source code,
   under the same licence, so nobody else's rights are involved.
2. **Changes are cheap.** Want the slimes a bit rounder? Change one number and
   every frame of every animation updates together.
3. **Animation comes for free.** A hop is the same drawing function called
   with different values, so the frames always match each other.

## The tiny drawing toolkit

The script starts with a very small canvas class: an array of pixels with a
handful of drawing helpers:

- `rect` and `line` for straight things like fences, sword blades and planks,
- `ellipse` for anything round: slime bodies, tree canopies, animal heads,
- `art`, which draws a small picture written as text, one character per
  pixel, where each letter stands for a colour,
- `outline`, which adds a dark border around every solid pixel,
- `shadow`, which adds a soft oval shadow only where nothing is drawn yet.

The `outline` step does a lot of work. Pixel art usually has a dark line
around each character so it stands out from the background. Drawing that by
hand is tedious. Here the script draws the shapes first, then walks over every
empty pixel and colours it dark if it touches a solid one. Every sprite gets a
clean, one-pixel outline automatically.

## How a slime is drawn

A slime is mostly two ellipses. A green one for the body, and a darker one,
clipped to the lower half, for the belly. A flat line closes off the base.
Then come the details that make it look alive:

- a small light ellipse near the top left for the **shine**,
- two short dark rectangles for **eyes**, each with one white pixel as a
  highlight,
- a two-pixel **mouth**,
- the automatic outline, and a shadow underneath.

The drawing function takes a few numbers: `squash` (wider and shorter),
`lift` (how high off the ground) and `flat` (how much it has melted). Calling
it with different values gives every animation frame:

- **Idle:** squash goes 0, 0.6, 1, 0.6, so the slime gently breathes.
- **Hop:** lift rises to 10 pixels and falls again, while squash goes
  negative in the air (taller and thinner) and strongly positive on landing.
  That's classic squash and stretch, the oldest trick in animation for making
  things feel bouncy.
- **Defeat:** the slime flattens and fades while five droplets fly outwards
  and fall, which reads as a satisfying splat.

The same approach is used for the skeletons (whose bones are lines and small
rectangles), the farm animals, and the hero.

## Mirroring the hero

The hero is seen from behind, walking up the path, so he's symmetrical.
The script stores only the **left half** of his back view as text art and
mirrors it to make the full sprite. Fixing a pixel on one side fixes the
other side too. Walking frames move each leg separately on top of that.

## Same art every time

Some textures, like the grass and pebbles on the path, use randomness. A
normal random number generator would give different grass every time the
script runs, which would make every small change show up as a different image.
So the script uses its own tiny **seeded** random generator: it always
produces the same sequence of numbers, and the art comes out identical on
every run.

## Sheets that match the game

Finally, the script lays the frames out in sprite sheets: grids of equal-size
cells, for example the slime sheet is 8 columns by 3 rows of 64×64 pixel
cells. The game reads each frame from a fixed row and column. The cell sizes
and layout are written in comments right next to each drawing function, so the
art script and the game stay in step.

## What we learned

Drawing with code isn't faster than drawing by hand for a single sprite. It's
slower. But it pays off as soon as you need animations, variations and quick
changes. The biggest surprise was how much of "pixel art style" comes down to
a few rules: a consistent dark outline, a light source from the top left, a
limited palette, and shapes that squash before they stretch.

If you want to see the result in motion, [play Slime Siege](/games/slime-siege/),
or read the [strategy guide](/blog/slime-siege-strategy-guide/).
