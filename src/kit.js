// Shared by every game: random numbers, drawing helpers, and the things the games show and name.

export function makeRandom(seed = Date.now()) {
  let s = seed >>> 0;
  return () => {
    // mulberry32: small, fast and repeatable, so a test can replay a game from its seed.
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const int = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
export const pick = (rand, list) => list[Math.floor(rand() * list.length)];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function shuffle(rand, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const sample = (rand, list, n) => shuffle(rand, list).slice(0, n);

const thing = (e, name, many = name + 's') => ({ e, name, many });

// Only emoji from 2018 or earlier, so older tablets draw them instead of empty boxes.
export const ANIMALS = [
  thing('🐶', 'dog'), thing('🐱', 'cat'), thing('🐮', 'cow'), thing('🐷', 'pig'),
  thing('🐸', 'frog'), thing('🦁', 'lion'), thing('🐵', 'monkey'), thing('🐔', 'chicken'),
  thing('🦆', 'duck'), thing('🐘', 'elephant'), thing('🦒', 'giraffe'), thing('🐢', 'turtle'),
  thing('🐟', 'fish', 'fish'), thing('🐰', 'bunny', 'bunnies'), thing('🐻', 'bear'), thing('🦓', 'zebra'),
];

export const FRUITS = [
  thing('🍎', 'apple'), thing('🍌', 'banana'), thing('🍓', 'strawberry', 'strawberries'),
  thing('🍇', 'bunch of grapes', 'grapes'), thing('🍊', 'orange'), thing('🍉', 'watermelon'),
  thing('🍐', 'pear'), thing('🍒', 'cherry', 'cherries'), thing('🍍', 'pineapple'), thing('🥕', 'carrot'),
];

export const VEHICLES = [
  thing('🚗', 'car'), thing('🚌', 'bus', 'buses'), thing('🚂', 'train'), thing('✈️', 'plane'),
  thing('🚁', 'helicopter'), thing('🚲', 'bike'), thing('🚜', 'tractor'), thing('🚀', 'rocket'),
  thing('⛵', 'boat'), thing('🚒', 'fire engine'),
];

export const COLORS = [
  { name: 'red', fill: '#ef4444' }, { name: 'orange', fill: '#f97316' },
  { name: 'yellow', fill: '#facc15' }, { name: 'green', fill: '#22c55e' },
  { name: 'blue', fill: '#3b82f6' }, { name: 'purple', fill: '#a855f7' },
  { name: 'pink', fill: '#f472b6' },
];

export const PRAISE = ['Yay!', 'Well done!', 'Great job!', 'Brilliant!', 'Super!', 'Wow!', 'Awesome!'];

let pixelRatio = 1;
const emojiCache = new Map();

export function setPixelRatio(r) {
  pixelRatio = r;
  emojiCache.clear();
}

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const TEXT_FONT = 'ui-rounded,"Arial Rounded MT Bold","Nunito",system-ui,sans-serif';

// Emoji text is slow to draw on cheap tablets, so each emoji is drawn once per size bucket and reused.
export function emoji(g, e, x, y, size) {
  const px = Math.max(8, Math.round(size / 8) * 8);
  const key = e + px;
  let tile = emojiCache.get(key);
  if (!tile) {
    if (emojiCache.size > 400) emojiCache.clear();
    tile = document.createElement('canvas');
    tile.width = tile.height = Math.ceil(px * 1.3 * pixelRatio);
    const tg = tile.getContext('2d');
    tg.scale(pixelRatio, pixelRatio);
    tg.font = `${px}px ${EMOJI_FONT}`;
    // Centre the drawn outline, not the text box: symbols like ☀️ and ☂️ have odd widths and baselines.
    const m = tg.measureText(e);
    const half = px * 0.65;
    tg.fillText(
      e,
      half - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2,
      half - (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2,
    );
    emojiCache.set(key, tile);
  }
  const d = size * 1.3;
  g.drawImage(tile, x - d / 2, y - d / 2, d, d);
}

export function text(g, s, x, y, size, color = '#fff', align = 'center') {
  g.font = `800 ${size}px ${TEXT_FONT}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(s, x, y);
}

export function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function card(g, x, y, w, h, fill = '#fff') {
  g.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(g, x, y + h * 0.04, w, h, h * 0.16);
  g.fill();
  g.fillStyle = fill;
  roundRect(g, x, y, w, h, h * 0.16);
  g.fill();
}

export function star(g, x, y, r, fill, spin = 0) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = spin - Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

export const SHAPES = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond'];

export function shape(g, kind, x, y, r, fill) {
  g.fillStyle = fill;
  g.beginPath();
  switch (kind) {
    case 'circle':
      g.arc(x, y, r, 0, Math.PI * 2);
      break;
    case 'square':
      g.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
      break;
    case 'triangle':
      g.moveTo(x, y - r);
      g.lineTo(x + r, y + r * 0.8);
      g.lineTo(x - r, y + r * 0.8);
      break;
    case 'star':
      return star(g, x, y + r * 0.08, r * 1.08, fill);
    case 'heart':
      g.moveTo(x, y + r * 0.9);
      g.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.6, y - r * 1.25, x, y - r * 0.45);
      g.bezierCurveTo(x + r * 0.6, y - r * 1.25, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
      break;
    case 'diamond':
      g.moveTo(x, y - r);
      g.lineTo(x + r * 0.75, y);
      g.lineTo(x, y + r);
      g.lineTo(x - r * 0.75, y);
      break;
  }
  g.closePath();
  g.fill();
}

// The strip across the top of every game, kept clear of the home button on the left.
export function hud(view) {
  const h = Math.max(56, Math.min(view.w, view.h) * 0.12);
  return { x: view.safe.l + h * 1.3, y: view.safe.t, w: view.w - view.safe.l - view.safe.r - h * 1.6, h };
}

// A row of slots that fill up as the child gets closer to a celebration.
export function progress(g, area, done, total, filled) {
  const size = Math.min(area.h * 0.6, (area.w * 0.8) / total);
  const x0 = area.x + area.w / 2 - (size * (total - 1)) / 2;
  g.fillStyle = 'rgba(15,23,42,0.22)';
  roundRect(g, x0 - size * 0.7, area.y + area.h / 2 - size * 0.6, size * (total + 0.4), size * 1.2, size * 0.6);
  g.fill();
  for (let i = 0; i < total; i++) {
    const x = x0 + i * size, y = area.y + area.h / 2;
    if (i < done) {
      emoji(g, filled, x, y, size * 0.85);
    } else {
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.beginPath();
      g.arc(x, y, size * 0.22, 0, Math.PI * 2);
      g.fill();
    }
  }
}
