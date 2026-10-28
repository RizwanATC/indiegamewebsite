---
name: INDIE/24
description: One Indie Game a Day, dispensed by a capsule-toy machine.
colors:
  machine-red: "#dd2c25"
  machine-red-deep: "#a81d18"
  machine-red-dark: "#7e1310"
  capsule-white: "#edf2f8"
  paper: "#ffffff"
  dome-glass: "#d9eef9"
  surface-hover: "#f5f8fc"
  hairline: "#cdd6e3"
  capsule-sun: "#ffc22e"
  capsule-sky: "#2fb0e4"
  capsule-mint: "#2fbf82"
  capsule-gum: "#ff6fa6"
  capsule-grape: "#8a6cf0"
  capsule-coral: "#ff8a5c"
  navy-ink: "#1a1f3d"
  ink-soft: "#464e72"
  ink-faint: "#5f6789"
  warn: "#8a4b00"
  warn-soft: "#fff1c9"
  ok: "#1d7a52"
  danger: "#b4231d"
typography:
  display:
    fontFamily: "Dela Gothic One, Zen Kaku Gothic New, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.4rem)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Dela Gothic One, Zen Kaku Gothic New, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.1rem)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Dela Gothic One, Zen Kaku Gothic New, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Zen Kaku Gothic New, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Zen Kaku Gothic New, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 700
    lineHeight: 1.5
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.88em"
    fontWeight: 400
rounded:
  sm: "12px"
  lg: "22px"
  pill: "999px"
spacing:
  gutter: "clamp(16px, 4vw, 32px)"
  section: "clamp(48px, 8vw, 88px)"
  max: "1200px"
components:
  button-primary:
    backgroundColor: "{colors.machine-red}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "#e8372f"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "50px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
  button-small:
    rounded: "{rounded.pill}"
    padding: "8px 18px"
    height: "42px"
  chip-capsule:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px 8px 8px"
    height: "44px"
  chip-capsule-active:
    backgroundColor: "{colors.capsule-sun}"
  badge:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 11px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
    height: "50px"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "22px"
  notice:
    backgroundColor: "{colors.dome-glass}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.sm}"
    padding: "14px 18px"
  nav-link:
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "44px"
  nav-link-active:
    backgroundColor: "{colors.capsule-sun}"
---

# Design System: INDIE/24

## Overview

**Creative North Star: "The Capsule Machine"**

INDIE/24 is a capsule-toy machine that dispenses one game a day. Machine-red bodywork owns whole bands; a cool capsule-white ground sits behind it; clear dome windows with a pale glass sheen hold the game art; capsule colours mark genres; deep navy ink draws every outline and line of text. Everything a visitor touches is moulded plastic: pills, domes, knobs and stickers with a lit top edge and a soft drop beneath.

The system is bright, toy-like and tactile, but it is still a reading and playing surface: the type workhorse is a plain Japanese gothic, the ground is calm, and colour is spent on objects (capsules, chips, the machine) rather than on page backgrounds. It refuses the category default of a near-black page with a neon accent and a split hero over a row of equal cards.

**Key Characteristics:**
- Red machine bodywork as a full-width band, not as a thin accent.
- Two-tone capsules: a coloured half and a white half, used for chips, cards and the dispensed capsule.
- 2px navy ink outlines on every interactive object.
- Moulded-plastic depth: inset highlight on top, soft navy-tinted drop below.
- Arched dome silhouettes frame game art.
- Heavy toy-packaging display type over a quiet gothic body.

## Colors

A toy-shop palette: one saturated machine red, five capsule colours, all held together by navy ink on a cool white ground.

### Primary
- **Machine Red** (machine-red): the bodywork. Fills the featured cabinet, the game player housing, the logo pill and the primary button. White text sits on it.
- **Deep Machine Red** (machine-red-deep): link text and the strong accent role on light grounds.
- **Shadowed Red** (machine-red-dark): the dispensing tray, the primary button's outline, link hover, and the player's inner recesses.

### Secondary
- **Capsule Colours**: Sunflower (capsule-sun), Sky (capsule-sky), Mint (capsule-mint), Bubblegum (capsule-gum), Grape (capsule-grape). Each genre or platform gets one, assigned by a stable hash of its key (sun, sky, mint, gum, grape, red), so a genre keeps its colour across builds. They fill the coloured half of chips, the dome band of game cards and the dispensed capsule.
- **Capsule Coral** (capsule-coral): stands in for the red capsule on card domes and the tray capsule, where true machine red would merge with the bodywork.
- Sunflower doubles as the "selected" and "today" colour: the active nav pill, the active chip, the date sticker, the knob face, text selection, and the yellow slash in the wordmark.
- Sky doubles as the focus colour (3px outline, 3px offset).

### Neutral
- **Capsule White** (capsule-white): page ground.
- **Paper** (paper): raised surfaces: header, cards, panels, the label panel on the machine, inputs.
- **Dome Glass** (dome-glass): pale blue glass; behind cover art, info notices, code and blockquotes.
- **Navy Ink** (navy-ink): all body text, all 2px outlines, the footer band.
- **Soft Ink** (ink-soft) and **Faint Ink** (ink-faint): secondary text, dates, counts, placeholders.
- **Hairline** (hairline): the only light border, used on quiet utility boxes.
- **Status**: warn on warn-soft for "Sample entry" badges and unverified-download notices; ok and danger for state text.

### Named Rules
**The Bodywork Rule.** Machine red appears as a whole object (cabinet, player housing, logo, primary button), never as a thin stripe or text highlight on the page ground.

**The Hashed Capsule Rule.** Capsule colour comes from the genre or platform key through the stable hash, never picked by hand per page.

**The Sunflower Means Now Rule.** Sunflower marks the current or selected thing: today's sticker, the active nav item, the active chip, the knob.

## Typography

**Display Font:** Dela Gothic One (with Zen Kaku Gothic New, sans-serif)
**Body Font:** Zen Kaku Gothic New (with ui-sans-serif, system-ui)
**Label/Mono Font:** system monospace stack, only for code and file details

**Character:** chunky toy-packaging headlines over a plain, legible Japanese gothic. The display face does the shouting so nothing else has to.

### Hierarchy
- **Display** (400, clamp(2rem, 5vw, 3.4rem), 1.15): page h1. The wordmark on the machine sign runs larger (up to 4.2rem, 1.0) and the featured title runs clamp(2rem, 4.6vw, 3.2rem) at 1.05.
- **Headline** (400, clamp(1.5rem, 3vw, 2.1rem), 1.15): section heads such as Recent picks.
- **Title** (400, 1.15rem to 1.2rem): card titles and h3.
- **Body** (400, 1.0625rem, 1.65): running text; prose capped at 68ch, ledes at 46ch.
- **Label** (700, 0.85rem): field labels, filter group labels; badges at 0.78rem 700; dates at 0.8rem 700 with tabular numerals.

### Named Rules
**The Weight-Lives-In-The-Face Rule.** Display type is always weight 400; Dela Gothic One is already heavy. h4 and labels switch to the body face at 700.

**The Headings Speak Alone Rule.** Headings carry their own weight; no small label line sits above them.

## Layout

A single centred column (max 1200px) with a fluid gutter (clamp(16px, 4vw, 32px)) and section rhythm of clamp(48px, 8vw, 88px). The home page leads with the machine cabinet: on desktop (900px and up) a two-column grid with the dome window and tray on the left (1.25fr) and the paper label panel on the right (1fr); below 900px the dome stacks above the tray, then the label, so Play Now stays reachable. Game grids auto-fill columns of at least 300px with gaps of clamp(20px, 3vw, 32px) by clamp(16px, 2.4vw, 28px). The header is sticky (68px min) with a navy bottom rule; the header search appears from 860px. Below 480px hero action buttons go full width.

## Elevation & Depth

Depth is moulded plastic: every raised object pairs a faint white inset highlight on its top edge with a soft, navy-tinted drop shadow offset downward and pulled in by a negative spread. Shadows are never hard-edged and never black offsets. Pressing lifts objects 2px to 5px on hover and pushes them 1px down on active.

### Shadow Vocabulary
- **Moulded** (`0 1px 2px -1px rgb(255 255 255 / 0.7) inset, 0 10px 24px -12px rgb(26 31 61 / 0.35)`): cards, panels, screenshots at rest.
- **Moulded Lift** (`0 1px 2px -1px rgb(255 255 255 / 0.7) inset, 0 18px 32px -14px rgb(26 31 61 / 0.42)`): the same objects on hover or focus-within.
- **Button Pill** (top highlight, bottom inner shade, `0 6px 14px -8px` navy drop): all filled buttons.
- **Cabinet** (inset highlight and inset bottom shade, deep red-tinted drop `0 30px 50px -30px rgb(126 19 16 / 0.7)`): the red machine body.
- **Recess** (`0 10px 16px -6px rgb(0 0 0 / 0.55) inset`): the dispensing tray.

### Named Rules
**The Lit Top Edge Rule.** A raised object gets a white inset highlight above and a soft tinted drop below; never a flat offset block.

## Shapes

Everything is a capsule, a dome or a soft rounded box. Controls are full pills (999px). Panels round to 22px, notices and small boxes to 12px. Game cards and dome windows use an arched top: elliptical upper corners over gently rounded lower corners (cards: 140px 140px 26px 26px / 96px 96px 26px 26px). The cabinet rounds fluidly to clamp(28px, 4vw, 44px). Interactive objects carry a 2px navy outline; quiet badges use a 1.5px translucent ink outline, and platform badges switch to a dashed one.

## Components

### Buttons
Moulded capsule pills you want to press.
- **Shape:** full pill, 50px min height (42px small), 2px outline.
- **Primary:** machine red fill, white text, shadowed-red outline, body face 700 at 1rem.
- **Secondary:** paper fill, navy text and outline.
- **Ghost:** transparent with a translucent navy outline and no shadow; gains paper fill and a navy outline on hover.
- **Hover / Active:** lift 2px with a deeper drop; press 1px down with the shadow collapsing inward. 0.2s on the shared ease-out curve.
- **Knob (hero Play Now):** the primary pill at 60px with a sunflower ridged grip disc at its left; the grip turns in on load and rotates 90deg on hover or focus while the play mark stays upright.

### Chips
- **Style:** a capsule lying on its side: a 36px capsule-coloured left half with a small white gloss dot, a paper right half, 2px navy outline, 44px tall, body 700 at 0.95rem with a faint tabular count.
- **State:** hover lifts 2px; the current filter turns the right half sunflower.

### Badges
Little 0.78rem pills on paper with a translucent outline; the accent variant has a navy outline and links turn sunflower on hover. "Sample entry" uses warn on warn-soft.

### Cards / Containers
- **Game card:** a capsule standing up: arched dome top in the genre's capsule colour holding the cover art (itself arched), a 2px navy rule, then the paper base with date, title, three-line description and badges. Whole card clicks through the title link; focus draws the sky outline around the card. Hover lifts 5px and tilts -0.6deg.
- **Panel:** paper, 2px navy outline, 22px radius, 22px padding, moulded shadow.
- **Notice:** dome-glass fill, 12px radius, no outline; warning notices use warn-soft.

### Inputs / Fields
- **Style:** pill, 50px, 2px navy outline, paper fill, a faint top inner shade. Textareas round to 22px.
- **Focus:** outline removed in favour of a 4px translucent sky ring.

### Navigation
Header: paper bar with a 2px navy bottom rule, red logo pill at left, nav links as 44px pill targets in body 700; hover fills capsule-white, current page fills sunflower. Footer: a navy ink band topped by a coin-slot detail, with the logo pill and plain link list.

### The Machine (signature)
The featured game lives in a red cabinet: a sign with the wordmark (yellow slash) and tagline; a white-rimmed dome window with a diagonal glass sheen over the cover; a round sunflower date sticker tilted 8deg over the dome's corner; a paper label panel with title, actions and description; and a dark red tray where today's two-tone capsule drops in and settles on first load. The game player reuses the same red housing around its screen.

## Do's and Don'ts

### Do:
- **Do** give every interactive object a 2px navy ink outline and a pill or dome shape.
- **Do** colour genres and platforms through the stable capsule hash.
- **Do** use the moulded shadow pair (white inset highlight plus soft navy drop) for anything raised.
- **Do** reserve sunflower for the current, selected or today state.
- **Do** keep display type at weight 400 and body copy in Zen Kaku Gothic New.
- **Do** show focus with the sky outline (3px, 3px offset) or the 4px sky ring on fields.

### Don't:
- **Don't** set the page on a dark or near-black ground with a neon accent.
- **Don't** use hard, unblurred offset shadows.
- **Don't** put small label lines (eyebrows) above headings.
- **Don't** use the pixel face (Press Start 2P) for site UI; it belongs to the games' own art.
- **Don't** use machine red as a thin decorative stripe on the page ground.
