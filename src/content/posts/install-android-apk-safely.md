---
title: "How to install our Android games (and check the file is genuine)"
description: "A step-by-step guide to installing an APK on Android outside the Play Store, checking its SHA-256 fingerprint, getting updates, and where your progress is saved."
kind: help
date: "2026-11-10"
---

All three of our games ([Slime Siege](/games/slime-siege/), [Forest
Liar](/games/forest-liar/) and [Bumble Dash](/games/bumble-dash/)) have a free
Android app. They aren't on the Google Play Store, so you install them
directly from this website as an **APK** file. This page explains how to do
that safely, step by step.

## What is an APK?

An APK is the file format Android uses for apps. When you install something
from the Play Store, your phone downloads an APK behind the scenes. You can
also download one yourself from a website and install it. This is often
called "sideloading".

Sideloading is a normal Android feature, but it puts you in charge of
checking where an app comes from. **Only install APKs from the developer's
own website or a source you trust.** For our games, that's the Download
button on each game's page on this site, and nowhere else.

## Installing, step by step

The exact wording varies a little between phone brands and Android versions,
but the steps are the same:

1. **Open the game's page on your phone** and tap **Download APK**.
2. Your browser may warn that "this type of file can harm your device". This
   warning appears for every APK, not just ours. Tap **Download anyway** if
   you're happy that the file comes from this site.
3. When the download finishes, tap the notification or open the file from
   your **Downloads** folder.
4. The first time, Android will say your browser isn't allowed to install
   unknown apps. Tap **Settings**, turn on **Allow from this source**, then go
   back.
5. Tap **Install**. Google Play Protect may scan the app first, which is
   normal.
6. Tap **Open** and play.

Once the game is installed, you can turn the "Allow from this source" setting
off again if you like. It's only needed while installing.

## Checking the file is genuine (optional)

Each game page lists a **SHA-256** value next to the download. It's a
fingerprint of the exact file we published: a 64-character code that changes
completely if even one byte of the file is different. If the fingerprint of
the file you downloaded matches the one on the page, you have the genuine,
untouched file.

To check it:

- **On a computer:** download the APK, then run `certutil -hashfile
  bumble-dash.apk SHA256` on Windows, or `shasum -a 256 bumble-dash.apk` on
  macOS and Linux. Compare the result with the code on the game's page.
- **On Android:** a free file-hash app from the Play Store can show the
  SHA-256 of a file in your Downloads folder.

You don't need to compare all 64 characters; checking the first eight and the
last eight is plenty to spot a different file.

## Getting updates

Because the apps don't come from the Play Store, they can't update
themselves automatically. Instead, when you open one of our games while
you're online, it quietly checks this website for a newer version. If there
is one, you'll see a **NEW VERSION** banner. Tap it to download the new APK,
then install it over the old one the same way as above. Your progress is
kept.

## Where your progress is saved

Your best scores, unlocked levels and settings are saved **on your device**,
not on our servers. That means:

- the Android app and the browser version keep **separate** saves,
- clearing your browser's site data, or uninstalling the app, deletes that
  save,
- your progress doesn't move between devices.

The one exception is the [leaderboard](/leaderboard/): if you choose a player
name, your best score is sent to our leaderboard together with that name.
Our [privacy policy](/privacy/) explains exactly what's stored.

## Do the apps have ads?

No. The Android apps have no ads and no in-app purchases, and they work
offline once installed. The website shows a small number of ads around the
pages (never inside the games) to pay for hosting.

## Something went wrong?

- **"App not installed":** you probably have an older copy installed that was
  signed differently. Uninstall the old version first, then install again.
  This will reset your progress in the app.
- **"There was a problem parsing the package":** the download didn't finish.
  Delete the file and download it again.
- **Nothing happens when I tap the file:** open it from the **Files** or
  **Downloads** app instead of the browser.

Still stuck? Let us know through the [contact page](/contact/) and include your
phone model and Android version.
