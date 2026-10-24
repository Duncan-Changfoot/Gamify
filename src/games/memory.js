import { emoji, hud, progress, card, star, sample, shuffle, clamp, ANIMALS } from '../kit.js';

// Turn over two cards to find a pair. Each card says its animal's name as it turns, so the game also
// teaches words. The board grows after a tidy game and shrinks after a hard one.
const PAIRS = [2, 3, 4, 6, 8]; // by level

function deal(s) {
  const things = sample(s.rand, ANIMALS, PAIRS[s.level - 1]);
  s.cards = shuffle(s.rand, [...things, ...things]).map((thing) => ({ thing, up: false, done: false, turn: 0 }));
  s.open = [];
  s.wait = 0;
  s.moves = 0;
}

export function layout(s, view) {
  const top = hud(view);
  const pad = Math.min(view.w, view.h) * 0.03;
  const area = {
    x: view.safe.l + pad, y: top.y + top.h,
    w: view.w - view.safe.l - view.safe.r - pad * 2, h: view.h - top.y - top.h - view.safe.b - pad,
  };
  const n = s.cards.length;
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const size = Math.min((area.w - pad * (cols - 1)) / cols, (area.h - pad * (rows - 1)) / rows);
    if (!best || size > best.size) best = { cols, rows, size };
  }
  const { cols, rows, size } = best;
  const x0 = area.x + (area.w - (cols * size + (cols - 1) * pad)) / 2;
  const y0 = area.y + (area.h - (rows * size + (rows - 1) * pad)) / 2;
  return s.cards.map((_, i) => ({ x: x0 + (i % cols) * (size + pad), y: y0 + Math.floor(i / cols) * (size + pad), w: size, h: size }));
}

function closeOpen(s) {
  for (const i of s.open) s.cards[i].up = false;
  s.open = [];
  s.wait = 0;
}

function finish(s, fx, view) {
  const pairs = s.cards.length / 2;
  const level = clamp(s.moves <= pairs * 2 ? s.level + 1 : s.moves > pairs * 3 ? s.level - 1 : s.level, 1, PAIRS.length);
  if (level !== s.level) fx.save({ level });
  s.level = level;
  s.party = 3.5;
  fx.sound('win');
  fx.say('You found them all!');
  fx.confetti(view.w / 2, view.h / 2, 100);
}

export default {
  id: 'memory',
  name: 'Memory',
  icon: '🃏',
  color: '#ea580c',

  init(view, rand, saved, fx) {
    const level = Number.isInteger(saved && saved.level) ? clamp(saved.level, 1, PAIRS.length) : 2;
    const s = { rand, level, time: 0, party: 0 };
    deal(s);
    fx.say('Memory! Tap two cards to find a pair!');
    return s;
  },

  step(s, input, dt, fx, view) {
    s.time += dt;
    for (const c of s.cards) c.turn = clamp(c.turn + (c.up || c.done ? dt : -dt) * 5, 0, 1);
    if (s.party > 0) {
      s.party -= dt;
      if (s.party <= 0) {
        deal(s);
        fx.say('New cards! Find the pairs!');
      }
      return;
    }
    if (s.wait > 0) {
      s.wait -= dt;
      if (s.wait <= 0) closeOpen(s);
    }
    const rects = layout(s, view);
    for (const tap of input.taps) {
      const i = rects.findIndex((r) => tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h);
      const c = s.cards[i];
      if (!c || c.up || c.done) continue;
      // A child who taps again doesn't have to wait for the wrong pair to turn back.
      if (s.wait > 0) closeOpen(s);
      c.up = true;
      s.open.push(i);
      fx.sound('flip');
      fx.say(c.thing.name[0].toUpperCase() + c.thing.name.slice(1) + '!');
      if (s.open.length < 2) continue;
      s.moves++;
      const [a, b] = s.open.map((k) => s.cards[k]);
      if (a.thing !== b.thing) {
        s.wait = 1.4;
        continue;
      }
      a.done = b.done = true;
      s.open = [];
      fx.sound('coin');
      fx.say(`Two ${a.thing.many}!`);
      fx.confetti(rects[i].x + rects[i].w / 2, rects[i].y + rects[i].h / 2, 16);
      if (s.cards.every((card) => card.done)) return finish(s, fx, view);
    }
  },

  draw(g, s, view) {
    g.fillStyle = '#ea580c';
    g.fillRect(0, 0, view.w, view.h);
    const rects = layout(s, view);
    s.cards.forEach((c, i) => {
      const r = rects[i];
      const squeeze = Math.abs(Math.cos(c.turn * Math.PI));
      const w = r.w * Math.max(0.04, squeeze);
      const x = r.x + (r.w - w) / 2;
      if (c.turn < 0.5) {
        card(g, x, r.y, w, r.h, '#fde68a');
        star(g, r.x + r.w / 2, r.y + r.h / 2, Math.min(w, r.h) * 0.3, '#f59e0b');
        return;
      }
      g.globalAlpha = c.done && s.party <= 0 ? 0.55 : 1;
      card(g, x, r.y, w, r.h);
      g.save();
      g.translate(r.x + r.w / 2, 0);
      g.scale(Math.max(0.04, squeeze), 1);
      emoji(g, c.thing.e, 0, r.y + r.h / 2, r.h * 0.62);
      g.restore();
      g.globalAlpha = 1;
    });
    const pairs = s.cards.length / 2;
    progress(g, hud(view), s.cards.filter((c) => c.done).length / 2, pairs, '⭐');
    if (s.party > 0) emoji(g, '🎉', view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.35 * (1 + 0.06 * Math.sin(s.time * 10)));
  },
};
