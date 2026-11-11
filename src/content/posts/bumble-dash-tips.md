---
title: "Bumble Dash tips: how to get the gold medal (and the Royal Bee)"
description: "Practical tips for Bumble Dash from the person who made it: flap rhythm, reading swaying, squeezing and jumping vines, wasps, honey, and the numbers behind the difficulty."
kind: guide
date: "2026-11-10"
game: bumble-dash
---

Bumble Dash is a one-button game, but it isn't a luck game. Every gap in the
brambles can be flown through. We check that with a test program (more on that
in the [devlog](/blog/bumble-dash-every-gap-passable/)). So if you keep
crashing at the same score, there's a habit to fix. Here are the ones that
matter most.

## How the bee moves

Knowing the physics makes everything else easier:

- **A flap doesn't add speed, it sets it.** Every tap gives the bee the same
  upward push no matter how fast she was falling. Tapping twice quickly doesn't
  make her go twice as high; the second tap just restarts the climb.
- **One flap lifts her about 28 pixels** (roughly a quarter of a second of
  climbing) before she starts to fall again. The gaps in the brambles start
  at 62 pixels tall and shrink to 46, so a gap is only about two flaps high.
- **She falls faster and faster** until she reaches top speed, so the longer
  you wait between taps, the bigger your next correction has to be.
- **Her hitbox is smaller than she looks.** The game counts a hit only when the
  middle of her round body touches a thorn, so her wings and stripes can brush
  past a vine. That gives you a little more room than you'd think.
- **The sky is safe; the ground isn't.** If you flap too much she just bumps
  against the top of the screen, but touching the ground ends the run.

## The single most useful habit: flap low

New players tend to flap whenever the bee drops a little, which keeps her
bobbing around the middle of the screen with big, hard-to-control swings.

Instead, **let her fall until she's near the bottom of the next gap, then
flap once.** One flap from the bottom of a gap carries her through its middle.
Your taps become slower and more regular, and you'll start to feel a rhythm:
tap, wait, tap, wait. That rhythm is what gets you from bronze to gold.

## The garden fights back

The brambles don't stay simple for long. Each new kind of vine shows up at a
fixed point in a run:

| From vine | What appears | How to handle it |
| --- | --- | --- |
| 1 | Plain bramble pairs | Flap low and stay calm. |
| 4 | **Swaying vines** that bob up and down | Watch the gap, not the vine. Aim for where the gap will be when you arrive, not where it is now. |
| 6 | **Wasps** hovering between vines | They move up and down in a smooth wave. Pass when the wasp is at the far end of its swing. |
| 9 | **Squeezing vines** that start wide and close up | Ignore how wide it looks. Aim for the dead centre of the gap; that part never closes. |
| 13 | **Jumping vines** that hop their gap up or down at the last moment | See below. |

The game also speeds up a little with every vine, from a gentle glide at the
start to about 55% faster by around vine 70. After that, the speed stays the
same.

### Beating the jumping vines

These are the ones that end most good runs, because they sit perfectly still
and then move their gap by around 30 pixels just before you get there.

There's a pattern, though: **a jumping vine always moves its gap towards the
side with more room.** If a still gap is sitting high on the screen, expect it
to drop. If it's low, expect it to rise. Line the bee up slightly towards the
side it's going to jump to and you'll be in the right place when it moves.

## Honey: worth it?

Honey drops float between some of the vines. Each one is worth an extra
point, the same as passing a vine. That's a big bonus early on, but a honey
drop is never placed with your safety in mind. It can sit right at the edge of
where you can still reach the next gap.

A simple rule: **take honey only when it's on the line you were going to fly
anyway.** Early in a run, when the gaps are wide, grab everything. After the
jumping vines arrive, let it go.

## Times of day and medals

Your score changes the garden: sunset at 10, a firefly-lit night at 25 and a
thunderstorm at 50, each with its own music. The darker scenes are a little
harder to read, so the first time you reach night, take a breath and keep
your rhythm.

Medals are awarded at the end of each run:

- **Bronze** at 10
- **Silver** at 25
- **Gold** at 50
- **Royal Bee** at 100

Your best score is saved on your device. If you've set a player name, your
best runs go on the [leaderboard](/leaderboard/) too.

## Practice routine

If you're stuck below gold, try this for ten minutes:

1. Play only for rhythm: don't chase honey at all, just count "tap, wait".
2. When you die, notice which kind of vine got you. Most players find it's
   almost always the same one.
3. Re-read that vine's tip above, and go again straight away. Runs restart
   instantly, which is what makes this kind of practice work.

On a computer, **Space**, **Up**, **W** or a mouse click all flap, and **P**
pauses. On a gamepad, **A** flaps. Some players find a key easier to keep in
rhythm than a mouse button.
