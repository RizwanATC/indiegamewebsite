---
title: "Devlog: making a troll platformer that still feels fair"
description: "How Forest Liar gets away with traps that give no warning: forgiving jump controls, instant respawns, traps that never change, and a bot that proves every level can be beaten."
kind: devlog
date: "2026-11-10"
game: forest-liar
---

[Forest Liar](/games/forest-liar/) is a "troll platformer". Signs fall on
you, bridges fold up, the ground isn't always ground, and the mailbox at the
end sometimes hops away. Games like this live on a thin line. When they work,
every death makes you laugh. When they don't, players feel cheated and quit.

During development we tried warnings: a shadow before a rock falls, a short
wobble before a trap springs. They made the game easier, but they also made it
less funny, because the joke is the surprise. So we removed them. To keep the
game fair without warnings, we leaned on four rules instead.

## Rule 1: the controls must never be the problem

If a player dies to a trap, they should laugh. If they die because a jump
didn't come out, they get angry. So Pip's controls are deliberately generous:

- **Coyote time.** You can still jump for 0.1 seconds after running off a
  ledge, like a cartoon character who hasn't looked down yet. Without this,
  players often feel they pressed jump "on the edge" and the game ignored it.
- **Jump buffering.** If you press jump up to 0.12 seconds before landing, the
  jump happens the moment you touch the ground. This makes quick hops feel
  responsive instead of eaten.
- **Variable jump height.** Hold jump to go higher, tap for a short hop. Small
  hops matter in a game with invisible blocks above your head.

These numbers are tiny, and players never notice them. That's the point: they
only notice when a game *doesn't* have them.

## Rule 2: dying must cost almost nothing

You're back on your feet less than a second after a death, at the last
checkpoint star, with a one-line joke on screen ("Gravity still works.",
"Log 1, Pip 0."). There's no lives counter and no game over. A troll game asks
the player to die many times, so each death has to be cheap.

Deaths do count towards your score (each one costs 300 points, the same as
7.5 seconds of time) so there's still a reason to learn a level properly
once you've seen its jokes.

## Rule 3: a trap must do the same thing every time

This is the most important rule. No trap in Forest Liar is random. A sky rock
always triggers at the same distance and lands on the spot where you're
standing. The sneezing bushes in The Quiet Clearing sneeze in a fixed rhythm:
short, short, long. The stage platforms in Pip vs. The Stagehand move on the
beat of a drum.

That means the first time through a level is a surprise, and the second time
is a puzzle you already know the answer to. The player is learning, not
gambling. When we were tempted to add randomness to keep things fresh, we
added a new kind of trap instead.

## Rule 4: every level must be beatable, even on a phone

Without warnings, it's easy to build a trap that's actually impossible:
a rock that lands faster than anyone could move, or a jump that's a pixel too
long. You can't tell that by playing a level ten times yourself, because you
always play it the same way.

So the game includes a small test hook that lets a program drive Pip with the
same inputs a player has: left, right, jump and how long jump is held. A
search program then explores the level, trying sequences of inputs and
keeping the most promising positions, until it reaches the mailbox. Every one
of the twelve levels has been finished this way, and each time we added a
new kind of trap, the bot had to finish the changed levels again before they
went live.

The on-screen touch pad gives exactly the same three inputs (left, right and a
jump you can hold), so a level the bot can finish is a level you can finish
on a phone.

## Levels as text

Each level is stored as twelve lines of text, one character per tile. `#` is
dirt, `^` is a row of spikes, `B` is a bouncy mushroom, `V` is fake ground,
`K` is a rock waiting in the sky, and so on. Signs and moving platforms get a
small extra description underneath, like what the sign says or which way a
platform moves.

Text levels are easy to read and easy to change. Moving a trap one tile to the
left is a one-character edit, and the difference shows up clearly when we
compare two versions of a level.

## What we'd do differently

The hardest part was the difficulty curve. The early chapters were first built
too gently, and the game felt like a walk; later we added a sky rock right
near the start of every level so the game's tone is clear in the first
second. The lesson: in a comedy game, the first joke needs to land
immediately.

If you'd like to put these rules to the test, [play Forest
Liar](/games/forest-liar/), and if a level gets the better of you, the
[walkthrough](/blog/forest-liar-walkthrough/) has every trap.
