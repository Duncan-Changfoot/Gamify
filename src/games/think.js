import {
  emoji, text, hud, progress, card, shape, roundRect, pick, int, clamp, sample, shuffle,
  ANIMALS, FRUITS, VEHICLES, COLORS, SHAPES, PRAISE,
} from '../kit.js';

// Four learning games share this engine; only their questions differ. A question is everything one turn
// needs: { say, show, choices, answer, praise, hint?, reward? }.
//   say:     what the child hears (they can't read yet, so the question is spoken, never written)
//   show:    a Pic above the choices, or null
//   choices: Pic[]; answer is the index of the right one
//   praise:  spoken when they get it; hint: spoken after a second wrong try; reward: a Pic to show then
// A Pic is one of:
//   { emoji, n?, grid?, scale? }  n copies of an emoji, five to a row like a ten frame; grid: true keeps
//                             the full 5 by 2 frame so two groups side by side are drawn the same size
//   { text, color? }          a numeral or letter
//   { shape, color, scale? }  a filled shape
//   { row: Pic[] }            pictures side by side; { mystery: true } is the "?" slot

const PER_ROUND = 8;
const TOP_LEVEL = 5;

function question(rand, { right, wrong, ...rest }) {
  const choices = shuffle(rand, [right, ...wrong]);
  return { show: null, ...rest, choices, answer: choices.indexOf(right) };
}

// Wrong numbers close to the right one, because far-off numbers are too easy to rule out.
function nearNumbers(rand, n, count, max) {
  const top = Math.max(max, n + count);
  return Array.from({ length: top }, (_, i) => i + 1)
    .filter((k) => k !== n)
    .sort((a, b) => Math.abs(a - n) - Math.abs(b - n) + (rand() - 0.5))
    .slice(0, count);
}

const counted = (n) => Array.from({ length: n }, (_, i) => i + 1).join(', ');

const LETTER_WORDS = {
  A: ['🍎', 'apple'], B: ['⚽', 'ball'], C: ['🐱', 'cat'], D: ['🐶', 'dog'], E: ['🥚', 'egg'], F: ['🐟', 'fish'],
  G: ['🍇', 'grapes'], H: ['🎩', 'hat'], I: ['🍦', 'ice cream'], J: ['👖', 'jeans'], K: ['🔑', 'key'], L: ['🦁', 'lion'],
  M: ['🌙', 'moon'], N: ['👃', 'nose'], O: ['🐙', 'octopus'], P: ['🐷', 'pig'], Q: ['👸', 'queen'], R: ['🌈', 'rainbow'],
  S: ['☀️', 'sun'], T: ['🌳', 'tree'], U: ['☂️', 'umbrella'], V: ['🌋', 'volcano'], W: ['🐳', 'whale'], Y: ['⛵', 'yacht'],
  Z: ['🦓', 'zebra'],
};
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const GROUPS = [
  { things: ANIMALS, label: 'animals' },
  { things: FRUITS, label: 'things to eat' },
  { things: VEHICLES, label: 'things that go' },
];

// Each kind of question: the level it starts at, and how to make one at a given level (1 to 5).
export const KINDS = {
  count: {
    from: 1,
    make(rand, level) {
      const max = [3, 5, 7, 10, 10][level - 1];
      const n = int(rand, 1, max);
      const t = pick(rand, [...ANIMALS, ...FRUITS]);
      return question(rand, {
        say: `How many ${t.many}?`,
        show: { emoji: t.e, n },
        right: { text: String(n) },
        wrong: nearNumbers(rand, n, level >= 4 ? 3 : 2, max).map((k) => ({ text: String(k) })),
        praise: `Yes! ${n} ${n === 1 ? t.name : t.many}!`,
        hint: `Let's count them together. ${counted(n)}.`,
      });
    },
  },
  findNumber: {
    from: 1,
    make(rand, level) {
      const max = [3, 5, 10, 10, 20][level - 1];
      const n = int(rand, 1, max);
      return question(rand, {
        say: `Find the number ${n}!`,
        right: { text: String(n) },
        wrong: nearNumbers(rand, n, level >= 4 ? 3 : 2, max).map((k) => ({ text: String(k) })),
        praise: `Yes! That's ${n}!`,
      });
    },
  },
  more: {
    from: 2,
    make(rand, level) {
      const t = pick(rand, [...ANIMALS, ...FRUITS]);
      const gap = [3, 3, 2, 1, 1][level - 1];
      const small = int(rand, 1, level >= 4 ? 6 : 3);
      const big = small + gap;
      return question(rand, {
        say: `Which side has more ${t.many}?`,
        right: { emoji: t.e, n: big, grid: true },
        wrong: [{ emoji: t.e, n: small, grid: true }],
        praise: `Yes! ${big} is more than ${small}!`,
        hint: `Count them. This side has ${big}.`,
      });
    },
  },
  findLetter: {
    from: 1,
    make(rand, level) {
      const small = level >= 4;
      const letter = pick(rand, ALPHABET);
      const word = LETTER_WORDS[letter];
      const show = (l) => ({ text: small ? l.toLowerCase() : l });
      return question(rand, {
        say: small ? `Find the small letter ${letter}!` : `Find the letter ${letter}!`,
        right: show(letter),
        wrong: sample(rand, ALPHABET.filter((l) => l !== letter), [2, 3, 4, 3, 4][level - 1] - 1).map(show),
        praise: word ? `Yes! ${letter} is for ${word[1]}!` : `Yes! That's ${letter}!`,
        reward: word ? { emoji: word[0] } : null,
      });
    },
  },
  firstSound: {
    from: 3,
    make(rand, level) {
      const letters = sample(rand, Object.keys(LETTER_WORDS), level >= 5 ? 4 : 3);
      const [letter] = letters;
      const pic = (l) => ({ emoji: LETTER_WORDS[l][0] });
      const word = LETTER_WORDS[letter][1];
      return question(rand, {
        say: `Which one starts with ${letter}?`,
        show: { text: letter },
        right: pic(letter),
        wrong: letters.slice(1).map(pic),
        praise: `Yes! ${word[0].toUpperCase() + word.slice(1)} starts with ${letter}!`,
      });
    },
  },
  findColor: {
    from: 1,
    make(rand, level) {
      const colors = sample(rand, level <= 1 ? COLORS.filter((c) => ['red', 'blue', 'yellow', 'green'].includes(c.name)) : COLORS, [2, 3, 4, 4, 4][level - 1]);
      const pic = (color) => ({ shape: level >= 3 ? pick(rand, SHAPES) : 'circle', color });
      return question(rand, {
        say: `Which one is ${colors[0].name}?`,
        right: pic(colors[0]),
        wrong: colors.slice(1).map(pic),
        praise: `Yes! That's ${colors[0].name}!`,
      });
    },
  },
  findShape: {
    from: 1,
    make(rand, level) {
      const shapes = sample(rand, level <= 1 ? ['circle', 'square', 'triangle'] : SHAPES, [2, 3, 3, 4, 4][level - 1]);
      const same = pick(rand, COLORS);
      const pic = (s) => ({ shape: s, color: level >= 3 ? pick(rand, COLORS) : same });
      return question(rand, {
        say: `Find the ${shapes[0]}!`,
        right: pic(shapes[0]),
        wrong: shapes.slice(1).map(pic),
        praise: `Yes! A ${shapes[0]}!`,
      });
    },
  },
  shapeAndColor: {
    from: 4,
    make(rand) {
      const [s1, s2] = sample(rand, SHAPES, 2);
      const [c1, c2] = sample(rand, COLORS, 2);
      return question(rand, {
        say: `Find the ${c1.name} ${s1}!`,
        right: { shape: s1, color: c1 },
        wrong: [{ shape: s1, color: c2 }, { shape: s2, color: c1 }, { shape: s2, color: c2 }],
        praise: `Yes! The ${c1.name} ${s1}!`,
      });
    },
  },
  pattern: {
    from: 1,
    make(rand, level) {
      const unit = level <= 2 ? 'AB' : level === 3 ? pick(rand, ['AAB', 'ABB']) : level === 4 ? 'ABC' : pick(rand, ['AABB', 'ABC']);
      const kinds = [...new Set(unit)];
      const things = sample(rand, [...ANIMALS, ...FRUITS], kinds.length + 1);
      const item = (letter) => things[kinds.indexOf(letter)];
      const shown = unit.length === 2 ? 4 : unit.length + 2;
      const seq = Array.from({ length: shown }, (_, i) => unit[i % unit.length]);
      const next = item(unit[shown % unit.length]);
      const others = [...kinds.map(item), things.at(-1)].filter((t) => t !== next);
      return question(rand, {
        say: 'What comes next?',
        show: { row: [...seq.map((l) => ({ emoji: item(l).e })), { mystery: true }] },
        right: { emoji: next.e },
        wrong: others.slice(0, [1, 2, 2, 2, 3][level - 1]).map((t) => ({ emoji: t.e })),
        praise: `Yes! The ${next.name} comes next!`,
      });
    },
  },
  oddOneOut: {
    from: 1,
    make(rand, level) {
      const [main, odd] = sample(rand, GROUPS, 2);
      const same = sample(rand, main.things, level >= 3 ? 3 : 2);
      const out = pick(rand, odd.things);
      return question(rand, {
        say: 'Which one is different?',
        right: { emoji: out.e },
        wrong: same.map((t) => ({ emoji: t.e })),
        praise: `Yes! The others are all ${main.label}!`,
      });
    },
  },
  biggest: {
    from: 2,
    make(rand, level) {
      const t = pick(rand, [...ANIMALS, ...FRUITS, ...VEHICLES]);
      const most = level >= 3 && rand() < 0.5 ? 'smallest' : 'biggest';
      const [a, b, c] = [{ emoji: t.e, scale: 1 }, { emoji: t.e, scale: 0.7 }, { emoji: t.e, scale: 0.45 }];
      return question(rand, {
        say: `Which one is the ${most}?`,
        right: most === 'biggest' ? a : c,
        wrong: most === 'biggest' ? [b, c] : [a, b],
        praise: `Yes! That's the ${most}!`,
      });
    },
  },
};

// Three right first time in a row moves up a level; two questions in a row that took three tries move
// down one. streak counts the first run up and the second run down (as a negative number).
function adjust(level, streak, misses) {
  if (misses === 0) streak = Math.max(0, streak) + 1;
  else if (misses >= 2) streak = Math.min(0, streak) - 1;
  else streak = 0;
  if (streak >= 3) return { level: Math.min(TOP_LEVEL, level + 1), streak: 0 };
  if (streak <= -2) return { level: Math.max(1, level - 1), streak: 0 };
  return { level, streak };
}

function ask(s, fx, before = '') {
  const kinds = s.kinds.filter((k) => KINDS[k].from <= s.level);
  let q;
  do q = KINDS[pick(s.rand, kinds)].make(s.rand, s.level);
  while (s.q && q.say === s.q.say && s.rand() < 0.9);
  s.q = q;
  s.phase = 'ask';
  s.wrong = [];
  s.misses = 0;
  fx.say(before + q.say);
}

export function layout(s, view) {
  const top = hud(view);
  const pad = Math.min(view.w, view.h) * 0.04;
  const body = {
    x: view.safe.l + pad, y: top.y + top.h + pad * 0.3,
    w: view.w - view.safe.l - view.safe.r - pad * 2, h: view.h - top.y - top.h - view.safe.b - pad * 1.3,
  };
  const n = s.q.choices.length;
  // Upright screens get two columns of answers so each card stays big enough for small fingers.
  const upright = body.w < body.h;
  const cols = upright ? Math.min(n, 2) : n;
  const rows = Math.ceil(n / cols);
  const tile = Math.min((body.w - pad * (cols - 1)) / cols, (body.h * (upright ? 0.55 : 0.45) - pad * (rows - 1)) / rows);
  const tw = upright ? tile : Math.min((body.w - pad * (cols - 1)) / cols, tile * 1.6);
  const choicesH = rows * tile + (rows - 1) * pad;
  const showH = Math.min(body.h - choicesH - pad, upright ? body.w * 0.75 : body.h * 0.5);
  const y0 = body.y + (body.h - showH - pad - choicesH) / 2;
  const show = { x: body.x, y: y0, w: body.w, h: showH };
  const choices = s.q.choices.map((_, i) => {
    const row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols);
    const x0 = body.x + (body.w - (tw * inRow + pad * (inRow - 1))) / 2;
    return { x: x0 + (i % cols) * (tw + pad), y: y0 + showH + pad + row * (tile + pad), w: tw, h: tile };
  });
  const speaker = { x: top.x + top.w - top.h * 0.4, y: top.y + top.h / 2, r: top.h * 0.38 };
  return { top, show, choices, speaker };
}

const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

function drawPic(g, pic, r) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  if (pic.row) {
    const cell = Math.min(r.w / pic.row.length, r.h);
    pic.row.forEach((p, i) => {
      const x = cx - (pic.row.length * cell) / 2 + i * cell;
      drawPic(g, p, { x: x + cell * 0.06, y: cy - cell * 0.44, w: cell * 0.88, h: cell * 0.88 });
    });
    return;
  }
  if (pic.mystery) {
    g.strokeStyle = '#94a3b8';
    g.lineWidth = Math.max(2, r.w * 0.04);
    g.setLineDash([r.w * 0.1, r.w * 0.07]);
    roundRect(g, r.x + r.w * 0.08, r.y + r.h * 0.08, r.w * 0.84, r.h * 0.84, r.w * 0.16);
    g.stroke();
    g.setLineDash([]);
    text(g, '?', cx, cy, r.h * 0.55, '#64748b');
    return;
  }
  if (pic.text) {
    text(g, pic.text, cx, cy + r.h * 0.03, Math.min(r.h * 0.62, (r.w * 0.9) / (pic.text.length * 0.62)), pic.color || '#1e293b');
    return;
  }
  if (pic.shape) {
    shape(g, pic.shape, cx, cy, Math.min(r.w, r.h) * 0.34 * (pic.scale || 1), pic.color.fill);
    return;
  }
  if (!pic.n) {
    emoji(g, pic.emoji, cx, cy, Math.min(r.w, r.h) * 0.78 * (pic.scale || 1));
    return;
  }
  const rows = Math.ceil(pic.n / 5);
  const step = pic.grid ? Math.min(r.w / 5, r.h / 2) : Math.min(r.w / Math.min(pic.n, 5), r.h / rows);
  for (let i = 0; i < pic.n; i++) {
    const row = Math.floor(i / 5), inRow = Math.min(5, pic.n - row * 5);
    emoji(g, pic.emoji, cx + (i % 5 - (inRow - 1) / 2) * step, cy + (row - (rows - 1) / 2) * step, step * 0.8);
  }
}

function quiz({ id, name, icon, color, kinds }) {
  return {
    id, name, icon, color,

    init(view, rand, saved, fx) {
      const level = Number.isInteger(saved && saved.level) ? clamp(saved.level, 1, TOP_LEVEL) : 1;
      const s = { rand, kinds, level, streak: 0, q: null, phase: 'ask', timer: 0, done: 0, time: 0, wrong: [], misses: 0 };
      ask(s, fx, `${name}! `);
      return s;
    },

    step(s, input, dt, fx, view) {
      s.time += dt;
      if (s.phase !== 'ask') {
        s.timer -= dt;
        if (s.timer > 0) return;
        if (s.phase === 'yay' && s.done === PER_ROUND) {
          s.phase = 'party';
          s.timer = 3.5;
          fx.sound('win');
          fx.say(`Wow! ${PER_ROUND} stars! ${pick(s.rand, PRAISE)}`);
          fx.confetti(view.w / 2, view.h / 2, 100);
          return;
        }
        if (s.phase === 'party') s.done = 0;
        ask(s, fx);
        return;
      }
      const L = layout(s, view);
      for (const tap of input.taps) {
        if (Math.hypot(tap.x - L.speaker.x, tap.y - L.speaker.y) < L.speaker.r * 1.5 || (!s.q.show && inside(tap, L.show))) {
          fx.say(s.q.say);
          continue;
        }
        const i = L.choices.findIndex((r) => inside(tap, r));
        if (i < 0 || s.wrong.includes(i)) continue;
        if (i === s.q.answer) {
          const r = L.choices[i];
          s.phase = 'yay';
          s.timer = 2.4;
          s.done++;
          fx.sound('coin');
          fx.say(s.q.praise);
          fx.confetti(r.x + r.w / 2, r.y + r.h / 2, 30);
          const next = adjust(s.level, s.streak, s.misses);
          if (next.level !== s.level) fx.save({ level: next.level });
          Object.assign(s, next);
          return;
        }
        s.wrong.push(i);
        s.misses++;
        fx.sound('wrong');
        fx.say(s.misses >= 2 && s.q.hint ? s.q.hint : 'Try again!');
      }
    },

    draw(g, s, view) {
      const L = layout(s, view);
      g.fillStyle = color;
      g.fillRect(0, 0, view.w, view.h);
      progress(g, { ...L.top, w: L.top.w - L.top.h * 1.1 }, s.done, PER_ROUND, '⭐');
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.beginPath();
      g.arc(L.speaker.x, L.speaker.y, L.speaker.r, 0, Math.PI * 2);
      g.fill();
      emoji(g, '🔊', L.speaker.x, L.speaker.y, L.speaker.r * 1.1);

      if (s.phase === 'party') {
        const m = Math.min(view.w, view.h);
        emoji(g, '⭐', view.w / 2, view.h / 2, m * 0.4 * (1 + 0.06 * Math.sin(s.time * 10)));
        text(g, String(PER_ROUND), view.w / 2, view.h / 2 + m * 0.02, m * 0.12, '#92400e');
        return;
      }

      const reward = s.phase === 'yay' && s.q.reward;
      if (s.q.show || reward) {
        card(g, L.show.x, L.show.y, L.show.w, L.show.h, 'rgba(255,255,255,0.95)');
        drawPic(g, reward || s.q.show, { x: L.show.x + L.show.h * 0.08, y: L.show.y + L.show.h * 0.08, w: L.show.w - L.show.h * 0.16, h: L.show.h * 0.84 });
      } else {
        const r = Math.min(L.show.w, L.show.h) * 0.3;
        emoji(g, '🔊', L.show.x + L.show.w / 2, L.show.y + L.show.h / 2, r * (1 + 0.04 * Math.sin(s.time * 4)));
      }

      s.q.choices.forEach((pic, i) => {
        const r = L.choices[i];
        const right = i === s.q.answer;
        let grow = 1;
        if (s.phase === 'yay') grow = right ? 1.06 + 0.04 * Math.sin(s.time * 12) : 1;
        else if (s.misses >= 2 && right) grow = 1 + 0.05 * Math.sin(s.time * 8);
        const w = r.w * grow, h = r.h * grow, x = r.x - (w - r.w) / 2, y = r.y - (h - r.h) / 2;
        g.globalAlpha = s.wrong.includes(i) || (s.phase === 'yay' && !right) ? 0.3 : 1;
        if (s.phase === 'yay' && right) {
          g.fillStyle = '#22c55e';
          roundRect(g, x - h * 0.05, y - h * 0.05, w + h * 0.1, h * 1.1, h * 0.2);
          g.fill();
        }
        card(g, x, y, w, h);
        drawPic(g, pic, { x: x + h * 0.06, y: y + h * 0.06, w: w - h * 0.12, h: h * 0.88 });
        g.globalAlpha = 1;
      });
    },
  };
}

export const numbers = quiz({ id: 'numbers', name: 'Numbers', icon: '🔢', color: '#f59e0b', kinds: ['count', 'findNumber', 'more'] });
export const letters = quiz({ id: 'letters', name: 'Letters', icon: '🔤', color: '#0d9488', kinds: ['findLetter', 'firstSound'] });
export const shapes = quiz({ id: 'shapes', name: 'Colours & Shapes', icon: '🔺', color: '#db2777', kinds: ['findColor', 'findShape', 'shapeAndColor'] });
export const puzzles = quiz({ id: 'puzzles', name: 'Puzzles', icon: '🧩', color: '#4f46e5', kinds: ['pattern', 'oddOneOut', 'biggest'] });
