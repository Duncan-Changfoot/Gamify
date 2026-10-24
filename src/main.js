import * as audio from './audio.js';
import { makeRandom, setPixelRatio, emoji, text, card, star, COLORS } from './kit.js';
import snake from './games/snake.js';
import balloons from './games/balloons.js';
import road from './games/road.js';
import blaster from './games/blaster.js';
import { numbers, letters, shapes, puzzles } from './games/think.js';
import memory from './games/memory.js';

// A game is { id, name, icon, color, init(view, rand, saved, fx) -> state, step(state, input, dt, fx, view),
// draw(g, state, view) }. It owns its state and reaches the outside world only through fx, so the playtest
// records exactly what a child would hear and see. The input a game gets each frame:
//   taps:  [{x, y}]       fingers that went down this frame, in CSS pixels
//   touch: {x, y} | null  the newest finger still on the screen
//   dir:   {x, y}         arrow keys or d-pad held, each -1, 0 or 1
//   turn:  {x, y} | null  arrow key or d-pad pressed this frame
//   jump:  boolean        space, enter or a gamepad face button pressed this frame
const GAMES = [snake, balloons, road, blaster, numbers, letters, shapes, puzzles, memory];

const canvas = document.getElementById('screen');
const g = canvas.getContext('2d');
const probe = document.getElementById('safe-area');
const view = { w: 0, h: 0, safe: { t: 0, r: 0, b: 0, l: 0 } };

function resize() {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  canvas.width = Math.round(view.w * ratio);
  canvas.height = Math.round(view.h * ratio);
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  setPixelRatio(ratio);
  const css = getComputedStyle(probe);
  view.safe = {
    t: parseFloat(css.paddingTop) || 0, r: parseFloat(css.paddingRight) || 0,
    b: parseFloat(css.paddingBottom) || 0, l: parseFloat(css.paddingLeft) || 0,
  };
}
addEventListener('resize', resize);
resize();

const store = {
  load(id) {
    try {
      return JSON.parse(localStorage.getItem('gamify.' + id));
    } catch {
      return null;
    }
  },
  save(id, value) {
    try {
      localStorage.setItem('gamify.' + id, JSON.stringify(value));
    } catch {
      // Private browsing: progress just isn't remembered.
    }
  },
};

const log = [];
const note = (entry) => {
  log.push(entry);
  if (log.length > 2000) log.splice(0, 1000);
};

let playing = null; // null on the menu, otherwise { game, state }

const fx = {
  sound(name) {
    note({ sound: name });
    audio.sound(name);
  },
  say(words) {
    note({ say: words });
    audio.say(words);
  },
  confetti(x, y, n = 30) {
    note({ confetti: n });
    burst(x, y, n);
  },
  save(value) {
    note({ save: value });
    store.save(playing.game.id, value);
  },
};

// --- Input -------------------------------------------------------------------------------------------

const fingers = new Map();
let taps = [];
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  taps.push({ x: e.clientX, y: e.clientY });
});
canvas.addEventListener('pointermove', (e) => {
  if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, (e) => fingers.delete(e.pointerId));

// Stop iOS zooming, scrolling and showing the copy menu when small hands press hard or long.
for (const type of ['gesturestart', 'dblclick', 'contextmenu']) document.addEventListener(type, (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

const keys = new Set();
let keyPresses = [];
addEventListener('keydown', (e) => {
  audio.unlock();
  if (!e.repeat) keyPresses.push(e.code);
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));

// The gamepad is read as the same key codes, so games only know about one kind of button.
let padBefore = new Set();
function padCodes() {
  const pad = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  const codes = new Set();
  if (!pad) return codes;
  const btn = (i) => pad.buttons[i] && pad.buttons[i].pressed;
  const [ax = 0, ay = 0] = pad.axes;
  if (btn(14) || ax < -0.5) codes.add('ArrowLeft');
  if (btn(15) || ax > 0.5) codes.add('ArrowRight');
  if (btn(12) || ay < -0.5) codes.add('ArrowUp');
  if (btn(13) || ay > 0.5) codes.add('ArrowDown');
  if (btn(0) || btn(1) || btn(2) || btn(3)) codes.add('Space');
  return codes;
}

const TURNS = {
  ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 }, KeyD: { x: 1, y: 0 }, KeyW: { x: 0, y: -1 }, KeyS: { x: 0, y: 1 },
};

function readInput() {
  const pad = padCodes();
  const pressed = [...keyPresses, ...[...pad].filter((c) => !padBefore.has(c))];
  padBefore = pad;
  keyPresses = [];
  const down = (...codes) => codes.some((c) => keys.has(c) || pad.has(c));
  const input = {
    taps,
    touch: [...fingers.values()].at(-1) || null,
    dir: {
      x: (down('ArrowRight', 'KeyD') ? 1 : 0) - (down('ArrowLeft', 'KeyA') ? 1 : 0),
      y: (down('ArrowDown', 'KeyS') ? 1 : 0) - (down('ArrowUp', 'KeyW') ? 1 : 0),
    },
    turn: pressed.map((c) => TURNS[c]).find(Boolean) || null,
    jump: pressed.some((c) => c === 'Space' || c === 'Enter'),
  };
  taps = [];
  return input;
}

// --- Menu --------------------------------------------------------------------------------------------

function menuTiles() {
  const pad = Math.min(view.w, view.h) * 0.04;
  const top = view.safe.t + Math.max(56, view.h * 0.14);
  const x0 = view.safe.l + pad, y0 = top;
  const w = view.w - view.safe.l - view.safe.r - pad * 2;
  const h = view.h - top - view.safe.b - pad;
  const gap = pad * 0.6;
  const tw = (w - gap * 2) / 3, th = (h - gap * 2) / 3;
  return GAMES.map((game, i) => ({
    game, x: x0 + (i % 3) * (tw + gap), y: y0 + Math.floor(i / 3) * (th + gap), w: tw, h: th,
  }));
}

function homeButton() {
  const r = Math.max(24, Math.min(view.w, view.h) * 0.045);
  return { x: view.safe.l + r * 1.4, y: view.safe.t + r * 1.3, r };
}

const near = (p, b, reach) => Math.hypot(p.x - b.x, p.y - b.y) < reach;
const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

function start(game) {
  const state = game.init(view, makeRandom(), store.load(game.id), fx);
  playing = { game, state };
}

function goHome() {
  playing = null;
  audio.hush();
}

let clock = 0;

function stepMenu(input) {
  for (const tap of input.taps) {
    const tile = menuTiles().find((t) => inside(tap, t));
    if (!tile) continue;
    fx.sound('tap');
    burst(tap.x, tap.y, 12);
    start(tile.game);
    return;
  }
}

function drawMenu() {
  const sky = g.createLinearGradient(0, 0, 0, view.h);
  sky.addColorStop(0, '#2563eb');
  sky.addColorStop(1, '#7c3aed');
  g.fillStyle = sky;
  g.fillRect(0, 0, view.w, view.h);
  const top = view.safe.t + Math.max(56, view.h * 0.14);
  text(g, 'Gamify', view.w / 2, view.safe.t + top * 0.45, top * 0.42);
  menuTiles().forEach((t, i) => {
    const bob = Math.sin(clock * 2 + i) * t.h * 0.015;
    card(g, t.x, t.y + bob, t.w, t.h, t.game.color);
    const s = Math.min(t.w, t.h);
    emoji(g, t.game.icon, t.x + t.w / 2, t.y + bob + t.h * 0.42, s * 0.48);
    text(g, t.game.name, t.x + t.w / 2, t.y + bob + t.h * 0.84, Math.min(s * 0.13, t.w / (t.game.name.length * 0.62)));
  });
}

// --- Confetti ----------------------------------------------------------------------------------------

const bits = [];
const confettiRandom = makeRandom();

function burst(x, y, n) {
  for (let i = 0; i < n && bits.length < 400; i++) {
    const a = confettiRandom() * Math.PI * 2, v = 150 + confettiRandom() * 450;
    bits.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 250, spin: confettiRandom() * 6,
      life: 1 + confettiRandom() * 0.8, color: COLORS[i % COLORS.length].fill, star: i % 4 === 0,
    });
  }
}

function stepConfetti(dt) {
  for (const b of bits) {
    b.vy += 900 * dt;
    b.vx *= 1 - dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.spin += dt * 8;
    b.life -= dt;
  }
  for (let i = bits.length - 1; i >= 0; i--) if (bits[i].life <= 0) bits.splice(i, 1);
}

function drawConfetti() {
  const size = Math.min(view.w, view.h) * 0.018;
  for (const b of bits) {
    g.globalAlpha = Math.min(1, b.life * 2);
    if (b.star) {
      star(g, b.x, b.y, size * 1.3, '#fde047', b.spin);
    } else {
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.spin);
      g.fillStyle = b.color;
      g.fillRect(-size / 2, -size / 4, size, size / 2);
      g.restore();
    }
  }
  g.globalAlpha = 1;
}

// --- Loop --------------------------------------------------------------------------------------------

function drawHome() {
  const b = homeButton();
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.beginPath();
  g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  g.fill();
  emoji(g, '🏠', b.x, b.y, b.r * 1.1);
}

function step(input, dt) {
  if (!playing) return stepMenu(input);
  const home = homeButton();
  if (input.taps.some((t) => near(t, home, home.r * 1.4))) return goHome();
  playing.game.step(playing.state, input, dt, fx, view);
}

let last = performance.now();
const idle = { taps: [], touch: null, dir: { x: 0, y: 0 }, turn: null, jump: false };

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const input = readInput();
  try {
    // The playtest speeds time up by running extra steps, so collisions stay exact.
    for (let i = 0; i < gamify.timeScale; i++) {
      step(i ? { ...idle, touch: input.touch, dir: input.dir } : input, dt);
      clock += dt;
      stepConfetti(dt);
    }
    if (playing) {
      playing.game.draw(g, playing.state, view);
      drawHome();
    } else {
      drawMenu();
    }
  } catch (err) {
    // A broken game sends the child back to the menu instead of freezing the screen.
    console.error(err);
    goHome();
  }
  drawConfetti();
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => document.hidden && audio.hush());

const gamify = {
  games: GAMES, log, timeScale: 1, view,
  scene: () => playing,
  start: (id) => start(GAMES.find((x) => x.id === id)),
  home: goHome,
};
window.gamify = gamify;

const linked = GAMES.find((x) => '#' + x.id === location.hash);
if (linked) start(linked);
requestAnimationFrame(frame);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch((err) => console.warn(err));
