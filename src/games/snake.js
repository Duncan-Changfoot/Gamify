import { emoji, text, hud, progress, pick, clamp, FRUITS } from '../kit.js';

// The snake eats ten fruit while the child hears each number, then a new fruit starts the count again.
// It can't crash: it wraps around the edges and passes over itself.
const COUNT_TO = 10;

function area(view) {
  const top = hud(view);
  const y = top.y + top.h;
  return {
    x: view.safe.l + 8, y,
    w: view.w - view.safe.l - view.safe.r - 16, h: view.h - y - view.safe.b - 8,
  };
}

export function board(s, view) {
  const a = area(view);
  const c = Math.floor(Math.min(a.w / s.cols, a.h / s.rows));
  return { c, x: a.x + (a.w - c * s.cols) / 2, y: a.y + (a.h - c * s.rows) / 2 };
}

export const cellCenter = (b, p) => ({ x: b.x + (p.x + 0.5) * b.c, y: b.y + (p.y + 0.5) * b.c });

function freeCell(s) {
  const head = s.body[0];
  for (let tries = 0; ; tries++) {
    const p = { x: Math.floor(s.rand() * s.cols), y: Math.floor(s.rand() * s.rows) };
    const far = Math.abs(p.x - head.x) + Math.abs(p.y - head.y) >= 4;
    if ((far || tries > 50) && !s.body.some((b) => b.x === p.x && b.y === p.y)) return p;
  }
}

function newRound(s) {
  const x = Math.floor(s.cols / 2), y = Math.floor(s.rows / 2);
  s.body = [{ x, y }, { x: x - 1, y }, { x: x - 2, y }];
  s.prev = s.body;
  s.dir = { x: 1, y: 0 };
  s.wish = null;
  s.target = null;
  s.eaten = 0;
  s.clock = 0;
  s.party = 0;
  s.interval = Math.max(0.17, 0.3 - s.round * 0.02);
  s.fruit = pick(s.rand, FRUITS.filter((f) => f !== s.fruit));
  s.food = freeCell(s);
}

// Head for the cell the child pointed at, one turn at a time, never straight back into the body.
function heading(s) {
  const d = s.dir;
  const back = (o) => o.x === -d.x && o.y === -d.y;
  if (s.wish) {
    const w = s.wish;
    s.wish = null;
    return back(w) ? d : w;
  }
  if (!s.target) return d;
  const head = s.body[0];
  const dx = s.target.x - head.x, dy = s.target.y - head.y;
  if (!dx && !dy) return d;
  const options = Math.abs(dx) >= Math.abs(dy)
    ? [{ x: Math.sign(dx), y: 0 }, { x: 0, y: Math.sign(dy) || 1 }]
    : [{ x: 0, y: Math.sign(dy) }, { x: Math.sign(dx) || 1, y: 0 }];
  return options.find((o) => !back(o)) || d;
}

function move(s, fx, b) {
  s.dir = heading(s);
  const head = s.body[0];
  const next = { x: (head.x + s.dir.x + s.cols) % s.cols, y: (head.y + s.dir.y + s.rows) % s.rows };
  s.prev = s.body;
  s.body = [next, ...s.body];
  const ate = next.x === s.food.x && next.y === s.food.y;
  if (!ate) s.body.pop();
  if (s.target && s.target.x === next.x && s.target.y === next.y) s.target = null;
  if (!ate) return;

  s.eaten++;
  fx.sound('coin');
  const at = cellCenter(b, next);
  if (s.eaten < COUNT_TO) {
    fx.say(String(s.eaten));
    fx.confetti(at.x, at.y, 8);
    s.food = freeCell(s);
    return;
  }
  fx.sound('win');
  fx.say(`${COUNT_TO}! You did it! ${COUNT_TO} ${s.fruit.many}!`);
  fx.confetti(at.x, at.y, 80);
  s.party = 3.5;
}

export default {
  id: 'snake',
  name: 'Hungry Snake',
  icon: '🐍',
  color: '#16a34a',

  init(view, rand, saved, fx) {
    const a = area(view);
    const wide = a.w >= a.h;
    const long = clamp(Math.round(9 * (wide ? a.w / a.h : a.h / a.w)), 9, 18);
    const s = { rand, cols: wide ? long : 9, rows: wide ? 9 : long, round: 0, time: 0, fruit: null };
    newRound(s);
    fx.say(`Hungry snake! Tap where the snake should go. Let's eat ${s.fruit.many}!`);
    return s;
  },

  step(s, input, dt, fx, view) {
    s.time += dt;
    if (s.party > 0) {
      s.party -= dt;
      if (s.party <= 0) {
        s.round++;
        newRound(s);
        fx.say(`Let's eat ${s.fruit.many}!`);
      }
      return;
    }
    const b = board(s, view);
    const p = input.taps.at(-1) || input.touch;
    if (p) {
      s.target = {
        x: clamp(Math.floor((p.x - b.x) / b.c), 0, s.cols - 1),
        y: clamp(Math.floor((p.y - b.y) / b.c), 0, s.rows - 1),
      };
    }
    const key = input.turn || (input.dir.x ? { x: input.dir.x, y: 0 } : input.dir.y ? { x: 0, y: input.dir.y } : null);
    if (key) {
      s.wish = key;
      s.target = null;
    }
    s.clock += dt;
    if (s.clock >= s.interval) {
      s.clock -= s.interval;
      move(s, fx, b);
    }
  },

  draw(g, s, view) {
    g.fillStyle = '#166534';
    g.fillRect(0, 0, view.w, view.h);
    const b = board(s, view);
    for (let y = 0; y < s.rows; y++) {
      for (let x = 0; x < s.cols; x++) {
        g.fillStyle = (x + y) % 2 ? '#86efac' : '#bbf7d0';
        g.fillRect(b.x + x * b.c, b.y + y * b.c, b.c, b.c);
      }
    }

    if (s.target) {
      const t = cellCenter(b, s.target);
      g.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(s.time * 8)})`;
      g.lineWidth = b.c * 0.1;
      g.beginPath();
      g.arc(t.x, t.y, b.c * 0.4, 0, Math.PI * 2);
      g.stroke();
    }

    if (s.party <= 0) {
      const f = cellCenter(b, s.food);
      emoji(g, s.fruit.e, f.x, f.y, b.c * 0.85 * (1 + 0.08 * Math.sin(s.time * 6)));
    }

    const k = s.party > 0 ? 1 : s.clock / s.interval;
    const at = s.body.map((to, i) => {
      let from = s.prev[i] || to;
      if (Math.abs(from.x - to.x) > 1 || Math.abs(from.y - to.y) > 1) from = to;
      return cellCenter(b, { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
    });
    for (let i = at.length - 1; i >= 0; i--) {
      g.fillStyle = i % 2 ? '#8b5cf6' : '#7c3aed';
      g.beginPath();
      g.arc(at[i].x, at[i].y, b.c * (i ? 0.46 : 0.55), 0, Math.PI * 2);
      g.fill();
    }
    const h = at[0], d = s.dir;
    for (const side of [-1, 1]) {
      const ex = h.x + d.x * b.c * 0.18 - d.y * side * b.c * 0.24;
      const ey = h.y + d.y * b.c * 0.18 + d.x * side * b.c * 0.24;
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(ex, ey, b.c * 0.16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#111';
      g.beginPath();
      g.arc(ex + d.x * b.c * 0.06, ey + d.y * b.c * 0.06, b.c * 0.08, 0, Math.PI * 2);
      g.fill();
    }

    const top = hud(view);
    const row = { ...top, w: top.w - top.h * 1.2 };
    progress(g, row, s.eaten, COUNT_TO, s.fruit.e);
    text(g, String(s.eaten), row.x + row.w + top.h * 0.5, top.y + top.h / 2, top.h * 0.7);

    if (s.party > 0) {
      const size = Math.min(view.w, view.h) * 0.3 * (1 + 0.05 * Math.sin(s.time * 10));
      emoji(g, s.fruit.e, view.w / 2 - size * 0.6, view.h / 2, size);
      text(g, String(COUNT_TO), view.w / 2 + size * 0.6, view.h / 2, size, '#7c3aed');
    }
  },
};
