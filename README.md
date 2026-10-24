# Gamify

Nine games for a 4-year-old on long trips. They work with no signal, need no reading (every
instruction is spoken), and can't be lost: there is no game over, only the next celebration.

| Game | What the child does | What it practises |
|---|---|---|
| 🐍 Hungry Snake | Taps where the snake should go; it eats 10 fruit while counting aloud | Counting to 10, steering |
| 🎈 Balloon Pop | Pops balloons: any, then only red ones, then only the number 3, and so on | Colours, numbers, listening |
| 🚗 Road Trip | Taps a lane to drive there, collects 10 stars to reach the beach, zoo, farm… | Counting, quick choices |
| 👾 Star Blaster | A gentle Super Contra: taps to jump, the blaster fires by itself, blobs turn into stars, then a big blob | Timing, counting |
| 🔢 Numbers | How many ducks? Find the number 7. Which side has more? | Counting, numerals, more/less |
| 🔤 Letters | Find the letter B (B is for ball). Which one starts with S? | Letter names, first sounds |
| 🔺 Colours & Shapes | Which one is red? Find the triangle. Find the blue star. | Colours, shapes |
| 🧩 Puzzles | What comes next? Which one is different? Which is biggest? | Patterns, sorting, size |
| 🃏 Memory | Turns cards to find pairs; each card says its animal | Memory, words |

The four learning games and Memory get harder after a run of right answers and easier after a struggle,
and remember the level on the device.

## Putting it on a tablet

It is a web app: one copy works on an iPad, an Android tablet, a phone, or an Android handheld.

1. Open its web address on the tablet, on Wi-Fi.
2. Add it to the home screen (iPad: Share → Add to Home Screen; Android Chrome: ⋮ → Add to home screen).
   It then opens full screen, like an app.
3. Open it once from the home screen while still on Wi-Fi. That saves every game for offline use.

Offline needs the app to be served over HTTPS (for example GitHub Pages). On the home Wi-Fi you can try it
straight away with `npm run serve` and the `http://192.168…:8080` address it prints, but that version
won't work offline.

## Before a trip

- Lock the child into the app: on an iPad, **Guided Access** (Settings → Accessibility → Guided Access,
  then triple-click the side button). On Android, **App pinning** (search Settings for "pin"; Samsung calls it "Pin app").
- Use headphones with a volume limit (85 dB kids' headphones), and turn the volume up once to check the
  voice works.
- A headrest mount at eye level helps with car sickness more than holding the screen on a lap.
- Turn on Do Not Disturb so notifications don't pop up over the games.

## Which device

A tablet beats a "gameboy" for a 4-year-old: tapping is natural at that age, buttons and d-pads are harder,
and the screen is bigger. In order of preference:

1. **A phone or tablet you already have.** Free.
2. **A cheap Android tablet with a kids' foam case.** For example a Samsung Galaxy Tab A9 (8.7", Wi-Fi).
3. **An Android handheld with a touch screen** (Retroid Pocket, some Anbernic models). The games also work
   with their buttons: d-pad to steer, A to jump. But they cost more than a tablet and the screen is smaller.

Cheap retro handhelds such as the Anbernic RG35XX run Linux emulators, not a web browser, so they can't
run these games.

## For developers

No build step and no dependencies at run time: `index.html` loads `src/main.js`.

- `npm run serve`: serve on port 8080 to this computer and the LAN.
- `npm test`: plays every game in Chromium and WebKit by tapping the screen, checks what the child would
  hear, tests offline mode, and saves screenshots to `shots/`.
- `npm run stamp`: update the offline file list and version in `sw.js` after changing any file.
  `npm test` fails until you do.
- `npm run icons`: redraw the app icons.

Each game is one file in `src/games/`. The contract is described at the top of `src/main.js`.
