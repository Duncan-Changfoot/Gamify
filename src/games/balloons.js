import { emoji, text, hud, progress, pick, int, COLORS } from '../kit.js';

// Tap balloons as they float up. Each round asks for a different kind of balloon, and the list repeats.
const POPS_PER_ROUND = 8;
const ROUNDS = [{ kind: 'any' }, { kind: 'color' }, { kind: 'number', max: 5 }, { kind: 'color' }, { kind: 'number', max: 9 }];

function newGoal(s) {
  const round = ROUNDS[s.round % ROUNDS.length];
  if (round.kind === 'any') return { kind: 'any', say: 'Pop the balloons!' };
  if (round.kind === 'color') {
    const color = pick(s.rand, COLORS);
    return { kind: 'color', color, say: `Pop the ${color.name} balloons!` };
  }
  const n = int(s.rand, 1, round.max);
  return { kind: 'number', n, max: round.max, say: `Pop the balloons with the number ${n}!` };
}

export const wanted = (goal, b) =>
  goal.kind === 'any' || (goal.kind === 'color' ? b.color === goal.color : b.n === goal.n);

function spawn(s) {
  const { goal, rand } = s;
  const target = !s.balloons.some((b) => b.popped === null && wanted(goal, b)) || rand() < 0.45;
  let color = pick(rand, COLORS);
  let n = null;
  if (goal.kind === 'color') color = target ? goal.color : pick(rand, COLORS.filter((c) => c !== goal.color));
  if (goal.kind === 'number') {
    const others = Array.from({ length: goal.max }, (_, i) => i + 1).filter((k) => k !== goal.n);
    n = target ? goal.n : pick(rand, others);
  }
  const lastX = s.balloons.length ? s.balloons.at(-1).x : -1;
  let x;
  do x = 0.1 + rand() * 0.8;
  while (Math.abs(x - lastX) < 0.18);
  s.balloons.push({ x, y: 1.2, r: 0.075 + rand() * 0.02, speed: 0.11 + rand() * 0.05, phase: rand() * 6, color, n, wobble: 0, popped: null });
}

export function place(s, b, view) {
  return { x: (b.x + Math.sin(s.time * 1.2 + b.phase) * 0.015) * view.w, y: b.y * view.h, r: b.r * Math.min(view.w, view.h) };
}

function startRound(s, fx) {
  s.goal = newGoal(s);
  s.pops = 0;
  fx.say(s.goal.say);
}

function goalBadge(view) {
  const top = hud(view);
  return { x: top.x + top.h * 0.6, y: top.y + top.h / 2, r: top.h * 0.4 };
}

function tapBalloon(s, tap, fx, view) {
  const badge = goalBadge(view);
  if (Math.hypot(tap.x - badge.x, tap.y - badge.y) < badge.r * 1.5) return fx.say(s.goal.say);
  const hit = [...s.balloons].reverse().find((b) => {
    const p = place(s, b, view);
    return b.popped === null && Math.hypot(tap.x - p.x, tap.y - p.y) < p.r * 1.35;
  });
  if (!hit) return;
  const p = place(s, hit, view);
  if (!wanted(s.goal, hit)) {
    hit.wobble = 0.5;
    fx.sound('wrong');
    if (s.time - s.nagAt > 2.5) {
      s.nagAt = s.time;
      fx.say(s.goal.kind === 'color'
        ? `That one is ${hit.color.name}. Pop the ${s.goal.color.name} ones!`
        : `That's ${hit.n}. Find ${s.goal.n}!`);
    }
    return;
  }
  hit.popped = 0;
  s.pops++;
  fx.sound('pop');
  fx.confetti(p.x, p.y, 10);
  if (s.pops < POPS_PER_ROUND) return fx.say(String(s.pops));
  fx.sound('win');
  fx.say('Yay! You popped them all!');
  fx.confetti(view.w / 2, view.h / 2, 80);
  s.party = 3;
}

function balloon(g, x, y, r, color, n, tilt) {
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = Math.max(1.5, r * 0.04);
  g.beginPath();
  g.moveTo(0, r * 1.2);
  g.bezierCurveTo(r * 0.3, r * 1.7, -r * 0.3, r * 2.1, 0, r * 2.6);
  g.stroke();
  g.fillStyle = color.fill;
  g.beginPath();
  g.moveTo(-r * 0.15, r * 1.3);
  g.lineTo(r * 0.15, r * 1.3);
  g.lineTo(0, r * 1.1);
  g.fill();
  g.beginPath();
  g.ellipse(0, 0, r, r * 1.2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(-r * 0.4, -r * 0.45, r * 0.22, r * 0.35, -0.5, 0, Math.PI * 2);
  g.fill();
  if (n !== null) text(g, String(n), 0, r * 0.05, r * 1.2, color.name === 'yellow' ? '#1e293b' : '#fff');
  g.restore();
}

export default {
  id: 'balloons',
  name: 'Balloon Pop',
  icon: '🎈',
  color: '#e11d48',

  init(view, rand, saved, fx) {
    const s = { rand, time: 0, round: 0, balloons: [], spawnIn: 0, party: 0, nagAt: -10 };
    fx.say('Balloon pop!');
    startRound(s, fx);
    return s;
  },

  step(s, input, dt, fx, view) {
    s.time += dt;
    for (const b of s.balloons) {
      if (b.popped === null) b.y -= b.speed * dt;
      else b.popped += dt;
      b.wobble = Math.max(0, b.wobble - dt);
    }
    s.balloons = s.balloons.filter((b) => b.y > -0.3 && (b.popped === null || b.popped < 0.3));
    if (s.party > 0) {
      s.party -= dt;
      if (s.party <= 0) {
        s.round++;
        startRound(s, fx);
      }
      return;
    }
    s.spawnIn -= dt;
    if (s.spawnIn <= 0 && s.balloons.length < 7) {
      spawn(s);
      s.spawnIn = 0.7 + s.rand() * 0.5;
    }
    for (const tap of input.taps) tapBalloon(s, tap, fx, view);
  },

  draw(g, s, view) {
    const sky = g.createLinearGradient(0, 0, 0, view.h);
    sky.addColorStop(0, '#38bdf8');
    sky.addColorStop(1, '#e0f2fe');
    g.fillStyle = sky;
    g.fillRect(0, 0, view.w, view.h);
    const m = Math.min(view.w, view.h);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 0.31 + s.time * 0.01 * (i + 1)) % 1.3 - 0.15) * view.w;
      const y = (0.2 + i * 0.17) * view.h;
      for (const [dx, dy, r] of [[0, 0, 0.06], [0.06, -0.02, 0.05], [-0.06, 0.01, 0.045]]) {
        g.beginPath();
        g.arc(x + dx * m, y + dy * m, r * m, 0, Math.PI * 2);
        g.fill();
      }
    }

    for (const b of s.balloons) {
      const p = place(s, b, view);
      if (b.popped === null) {
        balloon(g, p.x, p.y, p.r, b.color, b.n, Math.sin(b.wobble * 30) * b.wobble * 0.5);
        continue;
      }
      const k = b.popped / 0.3;
      g.globalAlpha = 1 - k;
      g.fillStyle = b.color.fill;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.beginPath();
        g.arc(p.x + Math.cos(a) * p.r * (0.6 + k * 1.4), p.y + Math.sin(a) * p.r * (0.6 + k * 1.4), p.r * 0.18, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }

    const top = hud(view);
    const badge = goalBadge(view);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.arc(badge.x, badge.y, badge.r * 1.15, 0, Math.PI * 2);
    g.fill();
    if (s.goal.kind === 'any') {
      emoji(g, '🎈', badge.x, badge.y, badge.r * 1.5);
    } else {
      const color = s.goal.kind === 'color' ? s.goal.color : COLORS[4];
      balloon(g, badge.x, badge.y - badge.r * 0.15, badge.r * 0.6, color, s.goal.kind === 'number' ? s.goal.n : null, 0);
    }
    progress(g, { x: top.x + top.h * 1.3, y: top.y, w: top.w - top.h * 1.3, h: top.h }, s.pops, POPS_PER_ROUND, '🎈');

    if (s.party > 0) emoji(g, '🎉', view.w / 2, view.h / 2, m * 0.35 * (1 + 0.06 * Math.sin(s.time * 10)));
  },
};
