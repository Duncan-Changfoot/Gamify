import { hud, progress, pick, star, roundRect } from '../kit.js';

// A gentle run-and-gun. The hero runs and fires on their own; tapping anywhere jumps. Blobs turn into
// stars when hit. Ten stars bring out a big blob, and beating it changes the world's colours.
// Rocks and the big blob's bubbles only make the hero blink: nothing ends the game.
const GROUND = 0.82; // all sizes are fractions of the screen height
const SCROLL = 0.3;
const STARS_TO_BOSS = 10;
const BOSS_HP = 10;
const BLOB_COLORS = ['#a855f7', '#ec4899', '#14b8a6', '#f97316'];
const THEMES = [
  { sky: ['#38bdf8', '#e0f2fe'], far: '#bbf7d0', near: '#86efac', ground: '#65a30d', grass: '#84cc16' },
  { sky: ['#fb923c', '#fde68a'], far: '#fbcfe8', near: '#f9a8d4', ground: '#a16207', grass: '#ca8a04' },
  { sky: ['#1e1b4b', '#4338ca'], far: '#4c1d95', near: '#6d28d9', ground: '#334155', grass: '#64748b' },
];

// Each kind of thing that comes from the right: its size, speed and whether shots can hit it.
const KINDS = {
  walker: { r: 0.065, speed: SCROLL + 0.12, shootable: true, trips: false },
  flyer: { r: 0.06, speed: SCROLL + 0.08, shootable: true, trips: false },
  rock: { r: 0.05, speed: SCROLL, shootable: false, trips: true },
  bubble: { r: 0.04, speed: SCROLL + 0.25, shootable: false, trips: true },
  boss: { r: 0.14, speed: 0, shootable: true, trips: false },
};

export const heroX = (view) => Math.min(0.3, (view.w / view.h) * 0.22);

function spawn(s, kind, x, y) {
  const k = KINDS[kind];
  s.foes.push({ kind, x, y, baseY: y, r: k.r, hp: kind === 'boss' ? BOSS_HP : 1, color: pick(s.rand, BLOB_COLORS), flash: 0, born: s.time });
}

function spawnWave(s, width) {
  const roll = s.rand();
  if (roll < 0.4) spawn(s, 'walker', width + 0.1, GROUND - KINDS.walker.r);
  else if (roll < 0.75) spawn(s, 'flyer', width + 0.1, 0.42 + s.rand() * 0.14);
  else if (s.foes.at(-1)?.kind !== 'rock') spawn(s, 'rock', width + 0.1, GROUND - KINDS.rock.r * 0.7);
  else spawn(s, 'walker', width + 0.1, GROUND - KINDS.walker.r);
}

function pop(s, foe, fx, view) {
  foe.hp = 0;
  fx.sound('pop');
  fx.confetti(foe.x * view.h, foe.y * view.h, foe.kind === 'boss' ? 120 : 10);
  if (foe.kind === 'boss') {
    fx.sound('win');
    fx.say('You did it! You beat the big blob!');
    s.phase = 'party';
    s.party = 4;
    return;
  }
  if (s.phase !== 'run') return;
  s.stars++;
  if (s.stars < STARS_TO_BOSS) return fx.say(String(s.stars));
  fx.say(`${STARS_TO_BOSS}! Here comes the big blob! Jump and zap it!`);
  s.phase = 'boss';
  spawn(s, 'boss', view.w / view.h + 0.3, 0.5);
}

export default {
  id: 'blaster',
  name: 'Star Blaster',
  icon: '👾',
  color: '#7c3aed',

  init(view, rand, saved, fx) {
    fx.say('Star blaster! Tap to jump. Zap the blobs and jump over the rocks!');
    return {
      rand, time: 0, level: 0, phase: 'run', party: 0, stars: 0, scroll: 0,
      hero: { y: GROUND, vy: 0, hurt: 0 }, jumpBuffer: 0, fireIn: 0, spawnIn: 1, shots: [], foes: [], oopsAt: -10,
    };
  },

  step(s, input, dt, fx, view) {
    s.time += dt;
    const width = view.w / view.h;
    const x0 = heroX(view);
    const h = s.hero;

    if (s.phase === 'party') {
      s.party -= dt;
      if (s.party <= 0) {
        s.level++;
        s.stars = 0;
        s.phase = 'run';
        s.foes = [];
        fx.say('Off we go again!');
      }
      return;
    }

    if (input.jump || input.taps.length || (input.turn && input.turn.y < 0)) s.jumpBuffer = 0.2;
    s.jumpBuffer -= dt;
    if (s.jumpBuffer > 0 && h.y >= GROUND) {
      h.vy = -1.75;
      s.jumpBuffer = 0;
      fx.sound('jump');
    }
    h.vy += 3.4 * dt;
    h.y = Math.min(GROUND, h.y + h.vy * dt);
    if (h.y >= GROUND) h.vy = 0;
    h.hurt = Math.max(0, h.hurt - dt);
    s.scroll += SCROLL * dt;

    s.fireIn -= dt;
    if (s.fireIn <= 0) {
      s.shots.push({ x: x0 + 0.07, y: h.y - 0.1 });
      s.fireIn = 0.3;
    }
    for (const shot of s.shots) shot.x += 1.4 * dt;

    s.spawnIn -= dt;
    if (s.spawnIn <= 0 && s.phase === 'run') {
      spawnWave(s, width);
      s.spawnIn = Math.max(0.9, 1.5 - s.level * 0.15) + s.rand() * 0.4;
    }

    for (const foe of s.foes) {
      foe.flash = Math.max(0, foe.flash - dt);
      if (foe.kind === 'boss') {
        foe.x = Math.max(width - 0.25, foe.x - 0.3 * dt);
        // Always above the standing hero's blaster, so it takes jumps to beat.
        foe.y = 0.42 + 0.12 * Math.sin((s.time - foe.born) * 1.3);
        if (s.spawnIn <= 0) {
          spawn(s, 'bubble', foe.x - foe.r, GROUND - KINDS.bubble.r);
          s.spawnIn = 2.5;
        }
        continue;
      }
      foe.x -= KINDS[foe.kind].speed * dt;
      if (foe.kind === 'flyer') foe.y = foe.baseY + 0.03 * Math.sin(s.time * 3 + foe.born);
    }

    for (const shot of s.shots) {
      const foe = s.foes.find((f) => f.hp > 0 && KINDS[f.kind].shootable && Math.hypot(f.x - shot.x, f.y - shot.y) < f.r + 0.025);
      if (!foe) continue;
      shot.x = Infinity;
      foe.hp--;
      foe.flash = 0.15;
      if (foe.hp <= 0) pop(s, foe, fx, view);
    }

    for (const foe of s.foes) {
      if (!KINDS[foe.kind].trips || foe.tripped) continue;
      const overlapX = Math.abs(foe.x - x0) < foe.r + 0.035;
      const overlapY = foe.y + foe.r > h.y - 0.16 && foe.y - foe.r < h.y;
      if (!overlapX || !overlapY) continue;
      foe.tripped = true;
      if (h.hurt > 0) continue;
      h.hurt = 1.2;
      fx.sound('bump');
      if (s.time - s.oopsAt > 4) {
        fx.say(foe.kind === 'rock' ? 'Oops! Jump over the rocks!' : 'Oops! Jump over the bubbles!');
        s.oopsAt = s.time;
      }
    }

    s.shots = s.shots.filter((shot) => shot.x < width + 0.1);
    s.foes = s.foes.filter((f) => f.hp > 0 && f.x > -0.2);
  },

  draw(g, s, view) {
    const k = view.h;
    const theme = THEMES[s.level % THEMES.length];
    const sky = g.createLinearGradient(0, 0, 0, view.h);
    sky.addColorStop(0, theme.sky[0]);
    sky.addColorStop(1, theme.sky[1]);
    g.fillStyle = sky;
    g.fillRect(0, 0, view.w, view.h);

    for (const [color, depth, base, amp] of [[theme.far, 0.2, 0.6, 0.08], [theme.near, 0.5, 0.7, 0.06]]) {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, view.h);
      for (let x = 0; x <= view.w + 20; x += 20) {
        const u = x / k + s.scroll * depth;
        g.lineTo(x, (base + amp * Math.sin(u * 4) + amp * 0.5 * Math.sin(u * 9)) * k);
      }
      g.lineTo(view.w, view.h);
      g.fill();
    }
    g.fillStyle = theme.ground;
    g.fillRect(0, GROUND * k, view.w, view.h);
    g.fillStyle = theme.grass;
    g.fillRect(0, GROUND * k, view.w, 0.025 * k);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    const stripe = 0.2 * k;
    for (let x = -((s.scroll * k) % (stripe * 2)); x < view.w; x += stripe * 2) g.fillRect(x, GROUND * k + 0.025 * k, stripe, view.h);

    for (const shot of s.shots) star(g, shot.x * k, shot.y * k, 0.022 * k, '#fde047', s.time * 10);

    for (const f of s.foes) {
      const x = f.x * k, y = f.y * k, r = f.r * k;
      if (f.kind === 'rock') {
        g.fillStyle = '#78716c';
        g.beginPath();
        g.ellipse(x, y + r * 0.2, r * 1.2, r, 0, Math.PI, 0);
        g.fill();
        g.fillStyle = '#a8a29e';
        g.beginPath();
        g.ellipse(x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.2, -0.3, 0, Math.PI * 2);
        g.fill();
        continue;
      }
      if (f.kind === 'bubble') {
        g.fillStyle = 'rgba(125,211,252,0.85)';
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.beginPath();
        g.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, Math.PI * 2);
        g.fill();
        continue;
      }
      if (f.kind === 'flyer') {
        g.fillStyle = 'rgba(255,255,255,0.85)';
        const flap = Math.sin(s.time * 18) * 0.4;
        for (const side of [-1, 1]) {
          g.beginPath();
          g.ellipse(x + side * r * 0.7, y - r * 0.7, r * 0.55, r * 0.3, side * (0.6 + flap), 0, Math.PI * 2);
          g.fill();
        }
      }
      const squash = 1 + 0.06 * Math.sin(s.time * 8 + f.born);
      g.fillStyle = f.flash > 0 ? '#fff' : f.color;
      g.beginPath();
      g.ellipse(x, y + r * (squash - 1), r * squash, r / squash, 0, 0, Math.PI * 2);
      g.fill();
      for (const side of [-1, 1]) {
        const ex = x - r * 0.25 + side * r * 0.32, ey = y - r * 0.15;
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(ex, ey, r * 0.24, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#111';
        g.beginPath();
        g.arc(ex - r * 0.08, ey, r * 0.12, 0, Math.PI * 2);
        g.fill();
      }
      if (f.kind === 'boss') {
        g.fillStyle = '#facc15';
        g.beginPath();
        g.moveTo(x - r * 0.5, y - r * 0.85);
        for (let i = 0; i <= 4; i++) g.lineTo(x - r * 0.5 + i * r * 0.25, y - r * (i % 2 ? 1.05 : 1.35));
        g.lineTo(x + r * 0.5, y - r * 0.85);
        g.fill();
      }
    }

    const hx = heroX(view) * k, hy = s.hero.y * k, u = k * 0.01;
    if (s.hero.hurt <= 0 || Math.floor(s.time * 12) % 2) {
      const running = s.hero.y >= GROUND;
      g.fillStyle = '#1d4ed8';
      for (const side of [-1, 1]) {
        const step = running ? Math.sin(s.time * 14 + (side > 0 ? Math.PI : 0)) * 2 * u : 0;
        roundRect(g, hx + side * 2 * u - 1.5 * u + step, hy - 5 * u, 3 * u, 5 * u, u);
        g.fill();
      }
      g.fillStyle = '#3b82f6';
      roundRect(g, hx - 4 * u, hy - 12 * u, 8 * u, 8 * u, 2.5 * u);
      g.fill();
      g.fillStyle = '#f59e0b';
      roundRect(g, hx, hy - 11 * u, 7 * u, 2.6 * u, u);
      g.fill();
      g.fillStyle = '#f8fafc';
      g.beginPath();
      g.arc(hx, hy - 15 * u, 4.5 * u, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0f172a';
      roundRect(g, hx - 0.5 * u, hy - 17 * u, 4.5 * u, 3.5 * u, 1.5 * u);
      g.fill();
      g.fillStyle = '#7dd3fc';
      g.fillRect(hx + 1.8 * u, hy - 16.3 * u, 1.2 * u, 1 * u);
    }

    const top = hud(view);
    const boss = s.foes.find((f) => f.kind === 'boss');
    if (boss) {
      const w = top.w * 0.6, x = top.x + (top.w - w) / 2, y = top.y + top.h * 0.35, h = top.h * 0.3;
      g.fillStyle = 'rgba(15,23,42,0.35)';
      roundRect(g, x, y, w, h, h / 2);
      g.fill();
      g.fillStyle = boss.color;
      roundRect(g, x, y, (w * boss.hp) / BOSS_HP, h, h / 2);
      g.fill();
    } else {
      progress(g, top, s.stars, STARS_TO_BOSS, '⭐');
    }
  },
};
