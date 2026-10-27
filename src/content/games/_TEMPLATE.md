---
# Copy this file to <your-game-slug>.md (files starting with "_" are ignored).
# The file name becomes the URL: /games/<your-game-slug>/
# Put images in src/assets/games/<your-game-slug>/ and reference them relatively.
# Only fill in what you KNOW. Leave optional fields out rather than guessing.

title: "Game Title"
shortDescription: "One or two sentences (20–180 characters) shown on cards and in search results."
developer: "Developer or studio name, exactly as they credit themselves"
# developerUrl: "https://developer.example"        # optional
# releaseYear: 2026                                # optional
genres: ["puzzle"]                                 # lowercase-with-hyphens
platforms: ["web", "android"]                      # web, android, ios, windows, macos, linux, switch, playstation, xbox
featuredDate: "2026-11-01"                         # YYYY-MM-DD in SITE.timezone; hidden until this date
coverImage: "../../assets/games/your-game-slug/cover.png"   # 16:9, at least 1600x900
coverAlt: "Describe what the artwork shows"
screenshots:                                       # optional
  - src: "../../assets/games/your-game-slug/screenshot-1.png"
    alt: "Describe the screenshot"

# playUrl: "/play/your-game-slug/"                 # hosted here (public/play/your-game-slug/index.html), with permission
# playUrl: "https://example.itch.io/game"          # or the official browser version
# embeddable: false                                # set false when the host forbids iframes
# playerAspect: "16/9"

# downloadUrl: "https://play.google.com/store/apps/details?id=..."  # official page, store or authorized APK
# downloadType: "store"                            # apk | store | page
# downloadSource: "official"                       # official | authorized-mirror
# apkVersion: "1.0.2"
# apkSha256: "..."                                 # only if the developer publishes one

# officialUrl: "https://..."                       # official game page
controls:                                          # optional
  - input: "Arrow keys"
    action: "Move"
# estimatedPlaytime: "20–40 minutes"               # optional

featured: true      # can be Game of the Day
published: true     # false = draft, never built
sample: false
sponsored: false    # true shows a "Sponsored" label everywhere
---

Your original description of the game goes here, in Markdown. Write it in
your own words: don't copy the store page.
