---
title: "Devlog: chiptune soundtracks with no audio files at all"
description: "Our games play full chiptune soundtracks without downloading a single sound file. Here's how songs written as text become music in your browser, note by note."
kind: devlog
date: "2026-11-10"
game: slime-siege
---

Open [Slime Siege](/games/slime-siege/), [Forest Liar](/games/forest-liar/)
or [Bumble Dash](/games/bumble-dash/) with the sound on and you'll hear a
chiptune soundtrack: a bright lead melody, a bass line, arpeggios and drums,
with a different song for each stage. But none of the games download a single
music or sound file. Every note is generated live in your browser while you
play.

This post explains how, using Slime Siege as the example.

## Why not just use MP3s?

Three reasons:

1. **Size.** A few minutes of compressed music is several megabytes. The
   whole of Slime Siege, code and art included, is a fraction of that. Small
   games load instantly, even on a slow phone connection, and the Android
   apps stay tiny.
2. **Changes are easy.** A song is a few lines of text. Changing a note or the
   tempo is a one-character edit, not a trip back into a music program.
3. **It fits the style.** Old game consoles made sound with a handful of
   simple waveforms. Building the music from the same ingredients gives the
   authentic sound for free.

## A song is just text

Each song is written as bars of sixteen steps (sixteenth notes). In the lead
melody, a note name like `E5` starts a note, a dash `-` holds the previous
note for another step, and a dot `.` is a rest. Here's the first bar of the
Green Meadow theme:

```
E5 - G5 - C6 - G5 - E5 - D5 - C5 - - -
```

Under the melody, each bar has a **chord** (C, A minor, F, G and so on). The
bass line doesn't name notes directly; it says which part of the current chord
to play: `R` for the root, `5` for the fifth, `8` for the root an octave up.
That way one short bass pattern fits every chord in the song automatically.

Drums are a pattern too: `k` for a kick, `s` for a snare and `h` for a
hi-hat. Each song also has its own tempo: the title screen is a relaxed 100
beats per minute, the Green Meadow a bouncy 132, and every boss fight gets its
own fast, driving theme.

## Turning text into sound

Browsers have a built-in sound engine called the **Web Audio API**. It can
create oscillators (simple tones), shape their volume over time, filter them,
and mix everything together. Our games use four voices:

- **Lead:** a *pulse wave* with a 25% duty cycle. That's the thin, buzzy tone
  you'll recognise from handheld consoles. The browser doesn't offer it as a
  preset, so the game builds it from 32 harmonics using a little bit of maths
  (a Fourier series).
- **Bass:** a *triangle wave*, which is soft and round, like the bass channel
  on classic consoles.
- **Arpeggio:** a quiet *square wave* that cycles quickly through the notes of
  the current chord, a trick old games used to suggest full chords with very
  few channels.
- **Drums:** the kick is a sine-like tone that drops quickly in pitch from
  150 Hz to 40 Hz, which sounds like a thump. Snares and hi-hats are short
  bursts of random noise through a filter that removes the low end; a higher
  filter gives the crisp hi-hat, a lower one the snare.

Each note gets a tiny volume envelope: a five-millisecond attack so it doesn't
click, a quick drop to a sustain level, and a fast release at the end. Those
few milliseconds are the difference between "beeping" and "music".

## Keeping time

The trickiest part isn't making sounds, it's playing them at exactly the right
moment. Browsers don't guarantee that game code runs at precise times. A
frame can be late, and background tabs are slowed down on purpose.

So the game never plays a note "now". Instead, every frame it looks a little
way into the future (about 0.15 seconds) and *schedules* every note that falls
in that window, at the exact time on the audio clock. The audio engine then
plays them perfectly on time, even if the game itself stutters. If the tab was
in the background and fell far behind, the music skips ahead instead of
playing a burst of late notes at once.

## Sound effects work the same way

Sword slashes, slime squishes, coin pickups and the cow's "moo" are made from
the same building blocks: a tone that sweeps in pitch, a burst of filtered
noise, or a quick run of notes. Bumble Dash's honey pickup, for example, is
four quick rising notes, and its medal jingle is five.

## The result

Every song in the game together takes up less space than a single small
image. The music changes instantly when a boss appears, it can be turned off
with the **M** key, and it works offline in the Android apps.

If you make small web games, we'd recommend trying this approach at least
once. Writing a song as text is a surprisingly fun constraint, and your
players will thank you for the fast loading times.
