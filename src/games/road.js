import { emoji, hud, progress, pick, clamp, roundRect } from '../kit.js';

// Drive down a three-lane road, collect stars and steer round cones. Ten stars and you arrive somewhere.
// A cone only makes the car wobble and slow down: there is no crash and no game over.
const LANES = 3;
const STARS_TO_ARRIVE = 10;
const PLACES = [
  { e: '🏖️', name: 'the beach' }, { e: '🦁', name: 'the zoo' }, { e: '🐮', name: 'the farm' },
  { e: '🎡', name: 'the fair' }, { e: '🏔️', name: 'the mountains' }, { e: '🏰', name: 'the castle' },
];
const SCENERY = ['🌳', '🌲', '🌷', '🌻', '🏡', '🌳'];

export function road(view) {
  const w = Math.min(view.w * 0.8, view.h * 0.95);
  const lane = w / LANES;
  return { x: (view.w - w) / 2, w, lane, carY: view.h - view.safe.b - view.h * 0.17, carW: lane * 0.5 };
}

export const laneX = (r, lane) => r.x + (lane + 0.5) * r.lane;

function newTrip(s) {
  s.stars = 0;
  s.things = [];
  s.place = PLACES[s.trip % PLACES.length];
  s.speed = Math.min(0.5, 0.3 + s.trip * 0.02);
}

function spawn(s) {
  const lane = Math.floor(s.rand() * LANES);
  s.things.push({ lane, y: -0.1, kind: s.rand() < 0.6 ? 'star' : 'cone', hit: null, fly: s.rand() < 0.5 ? -1 : 1 });
  if (s.stars > 3 && s.rand() < 0.3) {
    s.things.push({ lane: (lane + 1 + Math.floor(s.rand() * 2)) % LANES, y: -0.1, kind: 'star', hit: null, fly: 1 });
  }
}

function collect(s, t, fx, view, r) {
  t.hit = 0;
  const x = laneX(r, t.lane), y = t.y * view.h;
  if (t.kind === 'cone') {
    s.bump = 0.8;
    fx.sound('bump');
    if (s.time - s.oopsAt > 3) {
      fx.say(s.oopsAt < 0 ? 'Oops! Drive around the cones!' : 'Oops!');
      s.oopsAt = s.time;
    }
    return;
  }
  s.stars++;
  fx.sound('coin');
  fx.confetti(x, y, 8);
  if (s.stars < STARS_TO_ARRIVE) return fx.say(String(s.stars));
  fx.sound('win');
  fx.say(`Hooray! We're at ${s.place.name}!`);
  fx.confetti(view.w / 2, view.h / 2, 90);
  s.party = 4;
}

function car(g, x, y, w, tilt) {
  const h = w * 1.7;
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  g.fillStyle = '#1e293b';
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    roundRect(g, dx * w * 0.5 - w * 0.1, dy * h * 0.28 - h * 0.1, w * 0.2, h * 0.2, w * 0.06);
    g.fill();
  }
  g.fillStyle = '#ef4444';
  roundRect(g, -w / 2, -h / 2, w, h, w * 0.3);
  g.fill();
  g.fillStyle = '#bae6fd';
  roundRect(g, -w * 0.36, -h * 0.26, w * 0.72, h * 0.18, w * 0.1);
  g.fill();
  roundRect(g, -w * 0.32, h * 0.2, w * 0.64, h * 0.12, w * 0.08);
  g.fill();
  g.fillStyle = '#dc2626';
  roundRect(g, -w * 0.34, -h * 0.06, w * 0.68, h * 0.24, w * 0.12);
  g.fill();
  g.fillStyle = '#fde047';
  for (const dx of [-1, 1]) {
    g.beginPath();
    g.arc(dx * w * 0.3, -h * 0.45, w * 0.09, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function cone(g, x, y, size) {
  g.fillStyle = '#334155';
  roundRect(g, x - size * 0.55, y + size * 0.4, size * 1.1, size * 0.2, size * 0.05);
  g.fill();
  g.fillStyle = '#f97316';
  g.beginPath();
  g.moveTo(x, y - size * 0.6);
  g.lineTo(x + size * 0.42, y + size * 0.42);
  g.lineTo(x - size * 0.42, y + size * 0.42);
  g.closePath();
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(x - size * 0.2, y - size * 0.05);
  g.lineTo(x + size * 0.2, y - size * 0.05);
  g.lineTo(x + size * 0.27, y + size * 0.13);
  g.lineTo(x - size * 0.27, y + size * 0.13);
  g.closePath();
  g.fill();
}

export default {
  id: 'road',
  name: 'Road Trip',
  icon: '🚗',
  color: '#0284c7',

  init(view, rand, saved, fx) {
    const s = { rand, time: 0, trip: 0, lane: 1, x: 1, scroll: 0, spawnIn: 0.5, bump: 0, party: 0, oopsAt: -10, scenery: [], sceneryIn: 0 };
    newTrip(s);
    fx.say(`Road trip! Tap a lane to drive there. Collect the stars to get to ${s.place.name}!`);
    return s;
  },

  step(s, input, dt, fx, view) {
    s.time += dt;
    const r = road(view);
    if (s.party > 0) {
      s.party -= dt;
      if (s.party <= 0) {
        s.trip++;
        newTrip(s);
        fx.say(`Now let's drive to ${s.place.name}!`);
      }
      return;
    }

    const p = input.taps.at(-1) || input.touch;
    if (p) s.lane = clamp(Math.floor((p.x - r.x) / r.lane), 0, LANES - 1);
    if (input.turn && input.turn.x) s.lane = clamp(s.lane + input.turn.x, 0, LANES - 1);
    s.x += (s.lane - s.x) * Math.min(1, dt * 10);

    s.bump = Math.max(0, s.bump - dt);
    const speed = s.speed * (s.bump > 0 ? 0.5 : 1);
    s.scroll += speed * dt;
    s.spawnIn -= dt;
    if (s.spawnIn <= 0) {
      spawn(s);
      s.spawnIn = 0.34 / s.speed;
    }
    s.sceneryIn -= dt;
    if (s.sceneryIn <= 0) {
      s.scenery.push({ side: s.rand() < 0.5 ? -1 : 1, across: 0.2 + s.rand() * 0.6, y: -0.1, e: pick(s.rand, SCENERY) });
      s.sceneryIn = 0.15 / s.speed;
    }
    for (const d of s.scenery) d.y += speed * dt;
    s.scenery = s.scenery.filter((d) => d.y < 1.2);

    const carH = r.carW * 1.7;
    for (const t of s.things) {
      if (t.hit !== null) {
        t.hit += dt;
        continue;
      }
      t.y += speed * dt;
      if (Math.abs(t.y * view.h - r.carY) < carH * 0.55 && Math.abs(t.lane - s.x) < 0.45) collect(s, t, fx, view, r);
    }
    s.things = s.things.filter((t) => t.y < 1.2 && (t.hit === null || t.hit < 0.6));
  },

  draw(g, s, view) {
    const r = road(view);
    g.fillStyle = '#4ade80';
    g.fillRect(0, 0, view.w, view.h);
    for (const d of s.scenery) {
      const grass = d.side < 0 ? r.x : view.w - r.x - r.w;
      if (grass < r.lane * 0.4) continue;
      const x = d.side < 0 ? grass * d.across : r.x + r.w + grass * d.across;
      emoji(g, d.e, x, d.y * view.h, Math.min(grass * 0.5, r.lane * 0.5));
    }

    g.fillStyle = '#475569';
    g.fillRect(r.x, 0, r.w, view.h);
    g.fillStyle = '#f8fafc';
    g.fillRect(r.x, 0, r.lane * 0.05, view.h);
    g.fillRect(r.x + r.w - r.lane * 0.05, 0, r.lane * 0.05, view.h);
    const dash = view.h * 0.12;
    const offset = ((s.scroll * view.h) % (dash * 2)) - dash * 2;
    for (let lane = 1; lane < LANES; lane++) {
      const x = r.x + lane * r.lane - r.lane * 0.025;
      for (let y = offset; y < view.h; y += dash * 2) g.fillRect(x, y, r.lane * 0.05, dash);
    }

    for (const t of s.things) {
      let x = laneX(r, t.lane), y = t.y * view.h;
      const size = r.lane * 0.42;
      if (t.kind === 'star') {
        if (t.hit !== null) continue;
        emoji(g, '⭐', x, y, size * (1 + 0.1 * Math.sin(s.time * 8 + t.y * 10)));
      } else {
        if (t.hit !== null) {
          x += t.fly * t.hit * r.lane * 3;
          y -= t.hit * r.lane;
          g.globalAlpha = Math.max(0, 1 - t.hit / 0.6);
        }
        cone(g, x, y, size);
        g.globalAlpha = 1;
      }
    }

    const wobble = s.bump > 0 ? Math.sin(s.bump * 40) * 0.15 : 0;
    car(g, laneX(r, s.x), r.carY, r.carW, (s.lane - s.x) * 0.35 + wobble);

    const top = hud(view);
    const row = { ...top, w: top.w - top.h * 1.2 };
    progress(g, row, s.stars, STARS_TO_ARRIVE, '⭐');
    emoji(g, s.place.e, row.x + row.w + top.h * 0.5, top.y + top.h / 2, top.h * 0.7);

    if (s.party > 0) {
      const m = Math.min(view.w, view.h);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.beginPath();
      g.arc(view.w / 2, view.h * 0.45, m * 0.3, 0, Math.PI * 2);
      g.fill();
      emoji(g, s.place.e, view.w / 2, view.h * 0.45, m * 0.38 * (1 + 0.05 * Math.sin(s.time * 8)));
    }
  },
};
