---
title: "Devlog: balancing Pond Guard by letting bots play it"
description: "How we tuned Pond Guard's waves, prices and bugs: a rules file with no graphics, seven simple bots that play it, and what their results taught us about the game."
kind: devlog
date: "2026-11-24"
game: pond-guard
---

A tower defence game lives or dies by its numbers. If a frog costs 5 coins
too little, the game is solved by spamming frogs. If bugs get tougher a bit
too quickly, every run ends at wave 12 no matter what you do. And these
problems are hard to spot by playing, because one person tends to play the
same way every time.

For [Pond Guard](/games/pond-guard/), our fourth game, we tried something
different: before we tuned anything by hand, we let a group of very simple
bots play it. This post explains how that works and what they found.

## Step one: rules with no pictures

Pond Guard is split into two files. `core.js` holds the rules: the trail,
the four defenders, the five kinds of bug, how damage works and what each wave
contains. It draws nothing and plays no sound. `game.js` does the drawing,
the music and the controls, and asks `core.js` what happened every frame.

Because the rules don't need a screen, a small script can load them and play
a whole game in a fraction of a second, thousands of frames at a time, with no
browser at all.

## Step two: seven bots, seven play styles

The bots are deliberately simple. Each one follows a fixed shopping list,
such as "frog, frog, toad, upgrade, repeat", and always builds on the free
grass tile that covers the most trail. That last rule matters: a tile between
two rows of the trail covers twice as much path as one at the edge of the
map, and the bots find those spots automatically.

The seven play styles are:

- **frogs**: only frogs, never upgrades,
- **frog+up**: two frogs, then an upgrade, over and over,
- **toads** and **herons**: one frog to start, then mostly that defender,
  with upgrades,
- **mixed**: all four defenders, with an upgrade now and then,
- **mixed+up**: all four defenders, with an upgrade after almost every
  purchase,
- **smart**: a longer, planned shopping list: cheap frogs first, then toads,
  lilies and herons, with more and more of the budget going into upgrades.

Each bot plays until the frog eggs are gone, and the script prints how many
waves it cleared and where bugs got through.

## What the bots found

Here's the current version of the game:

| Bot | Waves cleared | Score |
| --- | --- | --- |
| frogs | 11 | 6,394 |
| frog+up | 21 | 31,915 |
| toads | 23 | 38,005 |
| mixed | 24 | 46,531 |
| herons | 28 | 69,961 |
| mixed+up | 32 | 90,040 |
| smart | 39 | 152,180 |

That spread is exactly what we wanted:

- **No single defender wins.** Every bot that leans on one kind of
  defender stalls somewhere between wave 11 and wave 28.
- **Upgrades matter.** Upgrading roughly doubles how far the frog bot gets.
  Upgrades cost more than a new defender, but they don't need a new tile, and
  the good tiles run out.
- **Mixing beats spamming, and upgrades are what turn a mix into a
  defence.** The same four defenders clear 24 waves with few upgrades, 32
  with many, and 39 when the upgrades follow a plan.
- **The best run is well beyond what a simple strategy reaches.** A good
  human player, who can adapt to each wave, should beat the smart bot. That
  leaves room to improve and a reason to come back.

The bots also show *where* each strategy breaks, by recording which waves
let bugs reach the pond. For most bots the leaks bunch up at waves 10, 20 and
30. Those are the stag beetle waves: every tenth wave is led by a big armoured
beetle with 110 base health. That told us the boss waves were doing their
job, as a test of whether your defence has real damage or just lots of small
hits.

## The numbers behind the curve

A few of the rules the bots helped settle:

- **Bug health grows by 13% every wave,** and from wave 15 an extra 4% per
  wave on top. Early waves are relaxed; the late game gets tough fast.
- **Coins per bug grow by 25% every five waves,** so your income keeps up,
  but only just.
- **Armour.** Ladybugs and stag beetles subtract a fixed amount from every hit,
  but a hit always does at least 20% of its damage. This is why lots of
  small frog licks struggle against beetles while a heron's big peck works
  well.
- **Flying bugs.** Mosquitoes fly over everything. Toads can't hit them,
  but frogs, lilies and herons can, so a toad-only defence leaks mosquitoes.
- **Caterpillars split** into two smaller ants when they're squashed, so a
  defence near the pond needs to finish the job.
- **Calling a wave early** pays one coin for every second left on the timer,
  a small reward for confident players.

## Why do it this way?

The bots don't replace playtesting. They can't tell us whether the game is
fun, whether the frogs look cute, or whether the music gets annoying by wave
30. But they answer the questions people are bad at: "Is one strategy
broken?" and "Did that small price change make the game easier or harder?"
Running the script after every change takes seconds, so we could try far more
ideas than we could have tested by hand.

It's the same approach we used for [Bumble
Dash](/blog/bumble-dash-every-gap-passable/) and [Forest
Liar](/blog/forest-liar-fair-traps/): keep the rules separate from the
graphics, and let a program check what a person can't.

Want to beat the smart bot's 39 waves? [Play Pond Guard](/games/pond-guard/),
and read the [Pond Guard tips](/blog/pond-guard-tips/) first.
