---
title: "Devlog: how we prove every gap in Bumble Dash can be flown through"
description: "Bumble Dash generates its bramble garden at random, so how do we know it's never impossible? A look at the difficulty curve and the search program that tests it."
kind: devlog
date: "2026-11-10"
game: bumble-dash
---

[Bumble Dash](/games/bumble-dash/) builds a new garden every run. The height
of each gap, which vines sway or squeeze, and where the wasps hover are all
chosen at random as you fly. That keeps every run fresh, but it also creates a
risk every game like this has: what if the random choices line up into
something no one could fly through?

One impossible gap in a hundred runs is enough to make a player feel cheated,
and with a one-button game, a player who feels cheated just closes the tab.
So before Bumble Dash went live, we wrote a program to check.

## Step one: make the game testable

The key design decision was to keep the game's rules completely separate from
the drawing and sound. One function, which we call the simulation step, takes
the current state of the game and one yes/no input (flap or don't flap) and
moves everything forward by one sixtieth of a second. It doesn't draw
anything and doesn't play any sound. The game you see just calls that
function sixty times a second and draws the result.

Two more details make testing possible:

- **Seeded randomness.** The garden comes from a random number generator that
  starts from a seed. The same seed always builds the same garden, so a
  problem found by the test can be replayed exactly.
- **The garden doesn't react to the bee.** Vines sway on their own clock, and
  a squeezing vine closes based on how close it is to the bee's column, not on
  what the bee does. That means the obstacles are the same whatever the
  player does, which makes the search much simpler.

## Step two: search every way to fly

With those pieces in place, the question "can this garden be survived?"
becomes a search. At every frame, the bee can either flap or not. That's two
choices, sixty times a second, which is far too many combinations to try one
by one. But most of them end up in the same place.

What matters about the bee at any moment is just two numbers: **her height**
and **her vertical speed**. So the search keeps a set of all the different
(height, speed) pairs the bee could be in at this frame, steps each of them
forward with and without a flap, throws away the ones that hit something, and
merges the ones that land in the same place. This is called a beam search,
and it's fast enough to run through hundreds of vines in a few seconds.

If the set of surviving positions ever becomes empty, the garden is
impossible at that point, and the test reports the seed and the vine number.

## What the test found

The first version passed easily, and it also felt too easy to play. So we
made the game harder, re-running the test after each change. The final
numbers:

- the gaps start at 62 pixels and shrink by half a pixel per vine, down to
  46 pixels,
- the speed rises from 1.25 to 1.95 pixels per frame,
- swaying vines appear from the 4th vine, wasps from the 6th, squeezing vines
  from the 9th, and the vines that jump their gap from the 13th.

The jumping vines needed the most care. They move their gap by about 30
pixels, just before the bee arrives, so a gap near the top or bottom of the
screen could easily be pushed somewhere unreachable. The rule we settled on:
a jumping vine always moves towards the side with more space. That keeps it
passable, and it also gives players something to learn, which turns a
frustrating moment into a skilful one.

After the final changes, the test flew 20 different gardens for about 190
vines each without finding an impossible spot. At the tightest moments, about
55 different positions still survive, which means there's a real, if narrow,
path through, not a single pixel-perfect one.

## Why this matters for a small game

A test like this is a small amount of code, and it changes how you design.
Instead of asking "is this too hard?" and hoping, we could make the game as
hard as we wanted, knowing it was always possible. It also let us build in the
nastier surprises, like vines that close or jump at the last moment, without
worrying that they'd stack up into something unfair.

Think you can make it to the Royal Bee medal at 100? [Play Bumble
Dash](/games/bumble-dash/), and read the [tips guide](/blog/bumble-dash-tips/)
first.
