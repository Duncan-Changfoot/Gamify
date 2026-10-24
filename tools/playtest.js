// Plays every game in real Chromium and WebKit the way a child would: by tapping the screen.
// It checks what a child hears (the speech and sound log) and sees (screenshots in shots/).
//   node tools/playtest.js [--only=snake,menu] [--browser=webkit]
import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
import { serve } from './serve.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const only = args.only ? args.only.split(',') : null;
const browsers = { chromium, webkit };
const chosen = args.browser ? [args.browser] : Object.keys(browsers);

const server = await serve(0);
const base = `http://localhost:${server.address().port}/`;
fs.mkdirSync('shots', { recursive: true });

class Failure extends Error {}
const expect = (ok, message) => {
  if (!ok) throw new Failure(message);
};

const said = (page) => page.evaluate(() => gamify.log.filter((e) => e.say).map((e) => e.say));
const sounds = (page) => page.evaluate(() => gamify.log.filter((e) => e.sound).map((e) => e.sound));
const clearLog = (page) => page.evaluate(() => gamify.log.splice(0));

const twoFrames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// The game reads taps on its next frame, so wait for two frames before looking at the result.
async function tap(page, p) {
  await page.touchscreen.tap(Math.round(p.x), Math.round(p.y));
  await twoFrames(page);
}

// Runs `turn` until `done` holds, tapping wherever turn says. turn and done run inside the page.
async function play(page, { turn, done, seconds = 60, every = 120, arg }) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    if (await page.evaluate(done, arg)) return;
    const p = await page.evaluate(turn, arg);
    for (const point of [].concat(p || [])) await tap(page, point);
    await page.waitForTimeout(every);
  }
  throw new Failure(`gave up after ${seconds}s`);
}

async function open(page, id) {
  await page.evaluate((id) => {
    gamify.start(id);
    gamify.log.splice(0);
  }, id);
}

const CHECKS = {
  async menu(page, shot) {
    await shot('menu');
    const names = await page.evaluate(() => gamify.games.map((x) => x.id));
    for (const [i, id] of names.entries()) {
      // Tiles sit in a 3 by 3 grid below the title.
      const p = await page.evaluate((i) => {
        const v = gamify.view, top = v.safe.t + Math.max(56, v.h * 0.14);
        const row = Math.floor(i / 3), col = i % 3;
        return { x: v.w * (col * 2 + 1) / 6, y: top + ((v.h - top) * (row * 2 + 1)) / 6 };
      }, i);
      await tap(page, p);
      const scene = await page.evaluate(() => gamify.scene() && gamify.scene().game.id);
      expect(scene === id, `tile ${i} opened ${scene}, expected ${id}`);
      const first = (await said(page)).at(-1);
      expect(first, `${id} said nothing when it opened`);
      await tap(page, await page.evaluate(() => ({ x: gamify.view.safe.l + 40, y: gamify.view.safe.t + 40 })));
      expect(!(await page.evaluate(() => gamify.scene())), `home button didn't leave ${id}`);
    }
  },

  async snake(page, shot) {
    await open(page, 'snake');
    await page.waitForTimeout(600);
    await shot('snake');
    await play(page, {
      async turn() {
        const { board, cellCenter } = await import('./src/games/snake.js');
        const s = gamify.scene().state;
        return s.party > 0 ? null : cellCenter(board(s, gamify.view), s.food);
      },
      done: () => gamify.log.some((e) => e.say && e.say.startsWith('10!')),
    });
    await shot('snake-party');
    const words = await said(page);
    for (let n = 1; n <= 9; n++) expect(words.includes(String(n)), `snake never counted ${n}`);
    await page.waitForFunction(() => gamify.log.some((e) => e.say && e.say.startsWith("Let's eat")), null, { timeout: 8000 });
    expect(await page.evaluate(() => gamify.scene().state.body.length === 3), 'the next round should start with a short snake');
  },

  async balloons(page, shot) {
    await open(page, 'balloons');
    const popRound = (round) => play(page, {
      async turn() {
        const { place, wanted } = await import('./src/games/balloons.js');
        const s = gamify.scene().state;
        if (s.party > 0) return null;
        const b = s.balloons.find((b) => b.popped === null && wanted(s.goal, b) && b.y > 0.25 && b.y < 0.9);
        return b && place(s, b, gamify.view);
      },
      done: (round) => {
        const s = gamify.scene().state;
        return s.round > round || s.party > 0;
      },
      arg: round,
    });
    await popRound(0);
    await page.waitForFunction(() => gamify.scene().state.round === 1, null, { timeout: 8000 });
    await clearLog(page);
    await play(page, {
      async turn() {
        const { place, wanted } = await import('./src/games/balloons.js');
        const s = gamify.scene().state;
        const b = s.balloons.find((b) => b.popped === null && !wanted(s.goal, b) && b.y > 0.25 && b.y < 0.9);
        return b && place(s, b, gamify.view);
      },
      done: () => gamify.log.some((e) => e.sound === 'wrong'),
    });
    const hint = (await said(page)).at(-1);
    expect(/^That one is \w+\. Pop the \w+ ones!$/.test(hint), `wrong colour hint was "${hint}"`);
    await page.waitForTimeout(800);
    await shot('balloons-colour');
    await popRound(1);
    expect((await said(page)).includes('Yay! You popped them all!'), 'no cheer after the colour round');
    await page.waitForFunction(() => gamify.scene().state.round === 2, null, { timeout: 8000 });
    await page.waitForTimeout(3000);
    await shot('balloons-number');
    const goal = (await said(page)).at(-1);
    expect(/^Pop the balloons with the number [1-5]!$/.test(goal), `third round asked "${goal}"`);
  },

  async road(page, shot) {
    await open(page, 'road');
    const steer = (kind) => play(page, {
      async turn(kind) {
        const { road, laneX } = await import('./src/games/road.js');
        const s = gamify.scene().state, v = gamify.view, r = road(v);
        if (s.party > 0) return null;
        const ahead = s.things.filter((t) => t.hit === null && t.y * v.h < r.carY);
        const cones = new Set(ahead.filter((t) => t.kind === 'cone' && t.y * v.h > r.carY - v.h * 0.35).map((t) => t.lane));
        const next = ahead.filter((t) => t.kind === kind && (kind === 'cone' || !cones.has(t.lane))).sort((a, b) => b.y - a.y)[0];
        if (next) return { x: laneX(r, next.lane), y: v.h * 0.6 };
        const free = [0, 1, 2].find((l) => !cones.has(l));
        return kind === 'star' && cones.has(s.lane) && free !== undefined ? { x: laneX(r, free), y: v.h * 0.6 } : null;
      },
      done: (kind) => kind === 'cone' ? gamify.log.some((e) => e.sound === 'bump') : gamify.scene().state.party > 0,
      arg: kind,
      every: 60,
    });
    await steer('cone');
    expect((await said(page)).includes('Oops! Drive around the cones!'), 'hitting a cone said nothing');
    await page.waitForTimeout(400);
    await shot('road');
    await steer('star');
    await shot('road-arrived');
    const words = await said(page);
    for (let n = 1; n <= 9; n++) expect(words.includes(String(n)), `road trip never counted star ${n}`);
    expect(words.includes("Hooray! We're at the beach!"), 'no arrival at the beach');
    await page.waitForFunction(() => gamify.log.some((e) => e.say === "Now let's drive to the zoo!"), null, { timeout: 8000 });
  },

  async blaster(page, shot) {
    await open(page, 'blaster');
    await page.waitForFunction(() => gamify.log.some((e) => e.sound === 'bump'), null, { timeout: 60000 });
    expect((await said(page)).includes('Oops! Jump over the rocks!'), 'running into a rock said nothing');
    await shot('blaster');
    await play(page, {
      async turn() {
        const { heroX } = await import('./src/games/blaster.js');
        const s = gamify.scene().state, v = gamify.view, x0 = heroX(v);
        if (s.phase === 'party' || s.hero.y < 0.82) return null;
        const jump = s.foes.some((f) => {
          const ahead = f.x - x0;
          if (f.kind === 'rock' || f.kind === 'bubble') return ahead > 0.05 && ahead < 0.22;
          if (f.kind === 'flyer') return ahead > 0.3 && ahead < 0.6;
          return f.kind === 'boss' && f.y < 0.55;
        });
        return jump ? { x: v.w / 2, y: v.h / 2 } : null;
      },
      done: () => gamify.scene().state.phase === 'boss',
      every: 40,
      seconds: 90,
    });
    await page.waitForFunction(() => gamify.scene().state.foes.some((f) => f.kind === 'boss' && f.x < gamify.view.w / gamify.view.h - 0.2), null, { timeout: 10000 });
    await page.waitForTimeout(3000);
    expect(await page.evaluate(() => gamify.scene().state.phase === 'boss'), 'the big blob was beaten without a single jump');
    await shot('blaster-boss');
    await play(page, {
      async turn() {
        const s = gamify.scene().state, v = gamify.view;
        const bubble = s.foes.some((f) => f.kind === 'bubble' && f.x - 0.3 < 0.25 && f.x > 0.3);
        const boss = s.foes.find((f) => f.kind === 'boss');
        return s.hero.y >= 0.82 && (bubble || boss) ? { x: v.w / 2, y: v.h / 2 } : null;
      },
      done: () => gamify.scene().state.phase === 'party',
      every: 40,
      seconds: 90,
    });
    const words = await said(page);
    for (let n = 1; n <= 9; n++) expect(words.includes(String(n)), `blaster never counted ${n}`);
    expect(words.includes('You did it! You beat the big blob!'), 'no cheer for beating the big blob');
    await page.waitForFunction(() => gamify.log.some((e) => e.say === 'Off we go again!'), null, { timeout: 8000 });
    await page.waitForTimeout(1500);
    await shot('blaster-level2');
  },

  async memory(page, shot) {
    await page.evaluate(() => localStorage.clear());
    await open(page, 'memory');
    const cardAt = (i) => page.evaluate(async (i) => {
      const { layout } = await import('./src/games/memory.js');
      const r = layout(gamify.scene().state, gamify.view)[i];
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }, i);
    const cards = await page.evaluate(() => gamify.scene().state.cards.map((c) => c.thing.name));
    expect(cards.length === 6, `a new player should start with 3 pairs, got ${cards.length} cards`);
    const other = cards.findIndex((name) => name !== cards[0]);
    await tap(page, await cardAt(0));
    await tap(page, await cardAt(other));
    const names = (await said(page)).slice(-2).map((w) => w.toLowerCase());
    expect(names[0] === cards[0] + '!' && names[1] === cards[other] + '!', `turning cards said ${names}`);
    await page.waitForTimeout(600);
    await shot('memory');
    await page.waitForFunction(() => gamify.scene().state.cards.every((c) => !c.up), null, { timeout: 4000 });
    for (const name of [...new Set(cards)]) {
      const [a, b] = cards.flatMap((n, i) => (n === name ? [i] : []));
      await tap(page, await cardAt(a));
      await tap(page, await cardAt(b));
    }
    const words = await said(page);
    expect(words.filter((w) => w.startsWith('Two ')).length === 3, 'matching pairs should each be cheered');
    expect(words.includes('You found them all!'), 'no cheer for finishing');
    await shot('memory-done');
    const saved = await page.evaluate(() => gamify.log.filter((e) => e.save).map((e) => e.save.level));
    expect(saved.at(-1) === 3, `a tidy game should move up to 4 pairs, saved ${saved}`);
    await page.waitForFunction(() => gamify.scene().state.cards.length === 8, null, { timeout: 8000 });
  },

  // Phones held either way up, so a person can check nothing is cut off or overlapping.
  async layouts(page, shot) {
    const ids = await page.evaluate(() => gamify.games.map((x) => x.id));
    for (const [label, size] of [['phone', { width: 390, height: 844 }], ['phone-wide', { width: 844, height: 390 }]]) {
      await page.setViewportSize(size);
      await page.evaluate(() => gamify.home());
      await page.waitForTimeout(200);
      await shot(`${label}-menu`);
      for (const id of ids) {
        await open(page, id);
        await page.waitForTimeout(1200);
        await shot(`${label}-${id}`);
      }
    }
    await page.setViewportSize({ width: 1180, height: 820 });
  },

  // Milliseconds of game code per frame (step + draw), timed over 600 frames back to back because the
  // browser's clock only counts in 0.1 ms steps. A 60 Hz screen allows 16.7 ms per frame. This covers the
  // JavaScript and the drawing commands, not the GPU work that paints them, so it can't stand in for a
  // cheap tablet's graphics chip. Chromium's CPU slow-down is no use here: it pauses between tasks, not
  // inside them.
  async speed(page) {
    for (const id of ['snake', 'balloons', 'road', 'blaster', 'numbers', 'memory']) {
      await open(page, id);
      await page.waitForTimeout(500);
      const ms = await page.evaluate(() => {
        const { game, state } = gamify.scene();
        const g = document.getElementById('screen').getContext('2d');
        const quiet = { sound() {}, say() {}, confetti() {}, save() {} };
        const idle = { taps: [], touch: null, dir: { x: 0, y: 0 }, turn: null, jump: false };
        const t0 = performance.now();
        for (let i = 0; i < 600; i++) {
          game.step(state, idle, 1 / 60, quiet, gamify.view);
          game.draw(g, state, gamify.view);
        }
        return (performance.now() - t0) / 600;
      });
      console.log(`     ${id}: ${ms.toFixed(3)} ms of game code per frame`);
    }
  },
};

async function answer(page, right) {
  const p = await page.evaluate(async (right) => {
    const { layout } = await import('./src/games/think.js');
    const s = gamify.scene().state;
    if (s.phase !== 'ask') return null;
    const i = right ? s.q.answer : s.q.choices.findIndex((_, i) => i !== s.q.answer && !s.wrong.includes(i));
    if (i < 0) return null;
    const r = layout(s, gamify.view).choices[i];
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }, right);
  if (p) await tap(page, p);
  return !!p;
}

for (const deck of ['numbers', 'letters', 'shapes', 'puzzles']) {
  CHECKS[deck] = async (page, shot) => {
    await page.evaluate(() => localStorage.clear());
    await open(page, deck);
    await shot(deck);
    await answer(page, false);
    expect((await sounds(page)).includes('wrong'), 'a wrong answer made no sound');
    expect((await said(page)).at(-1) === 'Try again!', `a wrong answer said "${(await said(page)).at(-1)}"`);
    if (await answer(page, false)) {
      const hint = await page.evaluate(() => gamify.scene().state.q.hint);
      expect((await said(page)).at(-1) === (hint || 'Try again!'), 'second wrong answer gave no hint');
    }
    const praise = await page.evaluate(() => gamify.scene().state.q.praise);
    await answer(page, true);
    expect((await said(page)).at(-1) === praise, `right answer said "${(await said(page)).at(-1)}"`);
    await play(page, {
      async turn() {
        const { layout } = await import('./src/games/think.js');
        const s = gamify.scene().state;
        if (s.phase !== 'ask') return null;
        const r = layout(s, gamify.view).choices[s.q.answer];
        return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      },
      done: () => gamify.scene().state.phase === 'party',
    });
    expect((await said(page)).some((w) => w.startsWith('Wow! 8 stars!')), 'no cheer after 8 stars');
    const saves = await page.evaluate(() => gamify.log.filter((e) => e.save).map((e) => e.save.level));
    expect(saves.length && saves.at(-1) >= 2, `seven right answers in a row didn't move up a level (saves: ${saves})`);

    // Every kind of question this deck can ask, at its easiest and hardest, drawn for a person to check.
    const kinds = await page.evaluate(() => gamify.scene().state.kinds);
    for (const kind of kinds) {
      for (const level of [1, 5]) {
        await page.evaluate(async ({ kind, level }) => {
          const { KINDS } = await import('./src/games/think.js');
          const s = gamify.scene().state;
          s.phase = 'ask';
          s.wrong = [];
          s.misses = 0;
          s.q = KINDS[kind].make(s.rand, Math.max(level, KINDS[kind].from));
        }, { kind, level });
        await page.waitForTimeout(100);
        await shot(`${deck}-${kind}-${level}`);
      }
    }
  };
}

let failed = 0;
for (const name of chosen) {
  const browser = await browsers[name].launch();
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: name === 'chromium' ? true : undefined });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(() => window.gamify);
  await page.evaluate(() => (gamify.timeScale = 4));

  for (const [check, run] of Object.entries(CHECKS)) {
    if (only && !only.includes(check)) continue;
    const started = Date.now();
    try {
      await page.evaluate(() => gamify.home());
      // Resizing clears the canvas until the next frame, so let two frames draw before each screenshot.
      await run(page, async (label) => {
        await twoFrames(page);
        await page.screenshot({ path: `shots/${name}-${label}.png` });
      });
      expect(errors.length === 0, `console errors: ${errors.join(' | ')}`);
      console.log(`ok   ${name} ${check} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    } catch (err) {
      failed++;
      console.log(`FAIL ${name} ${check}: ${err instanceof Failure ? err.message : err.stack}`);
      await page.screenshot({ path: `shots/${name}-${check}-fail.png` });
      errors.length = 0;
    }
  }

  // Load once, then switch the server off: what a child on the road with no signal gets.
  if (!only || only.includes('offline')) {
    const started = Date.now();
    const own = await serve(0);
    const fresh = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
    const page = await fresh.newPage();
    try {
      await page.goto(`http://localhost:${own.address().port}/`);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await page.waitForFunction(() => navigator.serviceWorker.controller);
      own.close();
      own.closeAllConnections();
      await page.reload();
      await page.waitForFunction(() => window.gamify);
      for (const id of await page.evaluate(() => gamify.games.map((x) => x.id))) {
        await page.evaluate((id) => gamify.start(id), id);
        await page.waitForTimeout(150);
        expect(await page.evaluate((id) => gamify.scene().game.id === id, id), `${id} didn't start offline`);
      }
      await page.evaluate(() => gamify.home());
      await page.screenshot({ path: `shots/${name}-offline.png` });
      console.log(`ok   ${name} offline (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    } catch (err) {
      failed++;
      console.log(`FAIL ${name} offline: ${err.message}`);
    }
    await fresh.close();
    own.close();
  }
  await browser.close();
}
server.close();
process.exit(failed ? 1 : 0);
