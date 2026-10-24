# Decisions

A log of choices made while building, newest last. Each says what was chosen, why, and what would
change the choice.

## 2026-10-23: first build

**A web app (PWA), not a native app.** One copy runs on an iPad, an Android tablet, a phone and an
Android handheld, installs from the browser, and updates itself. It works offline once it has been
opened on Wi-Fi. A native app would need a store listing or sideloading for each device. *Revisit if*
iPad Safari starts clearing the saved files (it hasn't for home-screen apps so far), or if the games
need anything a browser can't do.

**No game over anywhere.** Rocks, cones and wrong answers make a sound, a wobble or a gentle spoken
hint, and the game carries on. At 4, losing ends the fun faster than winning gets boring. Wrong answers
fade out, and after two misses the right answer pulses, so every question ends in success.

**Everything is spoken.** Questions, counts and praise use the device's own text-to-speech, which works
offline on iOS and Android. The app never picks a voice by name, because iOS lists joke voices ("Bad
News", "Bubbles") among the English ones. *Unverified:* that speech starts on a real iPad after the first
tap. It works in the test browsers, but they don't enforce the same rules as a real iPad.

**Super Contra became Star Blaster.** It's run-and-gun, but you can't die, the blaster fires by itself,
and blobs turn into stars instead of dying. One button (tap anywhere) jumps. The big blob always floats
above the standing hero's blaster, so beating it takes jumps. The first version could be beaten without
a single jump; the playtest now checks for that.

**Snake steers toward the finger.** Tap or hold where the snake should go; it turns one step at a time and
never reverses into itself. It can't crash: it wraps round the edges. I didn't build rival control schemes
(swipe, arrow buttons) because a bot can't stand in for a 4-year-old. *Revisit if* the child struggles:
big arrow buttons would be the next thing to try.

**One quiz engine, four decks.** Numbers, Letters, Colours & Shapes and Puzzles are lookup tables of
question makers on one engine (`src/games/think.js`). A question is plain data (what to say, what to show,
the choices, which is right), so a new kind of question is one entry. Level goes up after 3 right first
time in a row and down after 2 questions in a row that took 3 tries.

**"Which side has more?" draws both groups at the same size.** The first version drew 2 apples bigger than
5, which teaches the wrong idea (bigger looks like more). Groups being compared now share a fixed
5-by-2 grid.

**Emoji for pictures, with care.** System emoji give hundreds of recognisable pictures with no image files.
Only emoji from 2018 or earlier are used, so older tablets don't show empty boxes. Each emoji is centred by
its drawn outline, because symbols like ☀️ and ☂️ have odd widths and were drawn cut off.

**Offline files are versioned as one set.** `tools/stamp.js` writes the file list and a content hash into
`sw.js`. A new version downloads the whole set before switching, so old and new files never mix.

**Measured speed: game code takes under 1.5 ms per frame on this Mac.** That's step plus draw, timed over
600 frames: 0.02–0.06 ms in WebKit, up to 1.4 ms in Chromium (Balloon Pop, Star Blaster). A screen at
60 Hz allows 16.7 ms. Two earlier ways of measuring were thrown out:
- Headless frame rates were the same with the CPU slowed 4x, so they measured the browser's frame
  scheduling, not the games.
- Per-frame timing was below the clock's 0.1 ms resolution.

*Not measured:* the graphics chip of a cheap tablet. Try it on the real device.

**Device advice: a tablet over a "gameboy".** Tapping is natural at 4; d-pads are harder. Cheap Linux
handhelds (Anbernic RG35XX) have no browser, so they can't run this. Android handhelds with touch screens
(Retroid Pocket) can, but they cost more than a tablet in South Africa. Prices at the time: Galaxy Tab A9
Wi-Fi from R2,999 on PriceCheck; a Retroid Pocket 6 around $244 before import costs, with no local
distributor.

## 2026-10-24: hosting

**Hosted on GitHub Pages from a public repo.** It's free, serves HTTPS (which offline mode needs), and
deploys on every push to `main`. A free GitHub account can only publish Pages from a public repo, so the
code is public too. Nothing in it is private. `.nojekyll` makes Pages serve the files as they are.
*Revisit if* the repo needs to be private (GitHub Pro, or another host such as Cloudflare Pages).

**The offline download skips the browser's HTTP cache.** GitHub Pages sends `Cache-Control: max-age=600`.
Reproduced locally with that header: after an update, the new offline copy held the old `src/kit.js`,
because the browser served it from its 10-minute cache. `sw.js` now fetches with `cache: 'reload'`, and the
same test then got the new file.
