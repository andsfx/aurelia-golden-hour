// Pedestrians: people walking the sidewalks between waypoints, idling at stalls, benches and
// bus stops, some on their phones. They all flee when shots ring out nearby or a car barrels
// close, and they die (with a fall and fade) under wheels or bullets.
import { PED_NAMES } from './config.js';

const SHIRTS = ['#c96f3a', '#2f7d8c', '#8e6bb8', '#d0553f', '#e8e4d8', '#4f8fb0', '#6d7f5c', '#d9a13b', '#5a6672', '#e0b0c0'];
const SKINS = ['#d9a577', '#b97a52', '#8a5a3c', '#e0b48c', '#f0d0a8'];
const HAIRS = ['#2e1f18', '#4a3526', '#14100c', '#6e5138', '#a8a098'];

export function createPedestrians(city, rng, count) {
  const peds = [];
  const idleSpots = [...city.stalls.map((s) => ({ x: s.x + s.w / 2 + rng.range(-30, 40), y: s.y + s.h + 16 })), ...city.benches.map((b) => ({ x: b.x + rng.range(-14, 20), y: b.y + 12 })), ...city.stops.map((s) => ({ x: s.x + rng.range(6, 40), y: s.y + 22 }))];
  for (let k = 0; k < count; k++) {
    const idle = k % 5 < 2 && idleSpots.length > 0;
    const spot = idle ? idleSpots[rng.int(0, idleSpots.length - 1)] : city.walkpoints[rng.int(0, city.walkpoints.length - 1)];
    peds.push({
      x: spot.x, y: spot.y,
      target: idle ? { ...spot } : city.walkpoints[rng.int(0, city.walkpoints.length - 1)],
      speed: rng.range(46, 72),
      state: idle ? 'idle' : 'walk',
      idleT: rng.range(1.5, 6),
      phone: rng.chance(0.35),
      dir: rng.range(0, Math.PI * 2),
      name: PED_NAMES[rng.int(0, PED_NAMES.length - 1)],
      shirt: SHIRTS[rng.int(0, SHIRTS.length - 1)],
      skin: SKINS[rng.int(0, SKINS.length - 1)],
      hair: HAIRS[rng.int(0, HAIRS.length - 1)],
      phase: rng.range(0, 10),
      fleeT: 0, fleeX: 0, fleeY: 0,
      hp: 100, dead: false, fall: 0, fallDir: 0,
    });
  }

  /** Anything threatening nearby: a recent gunshot or a fast car. */
  function threatNear(game, pd) {
    if (game.shotAlert && game.time - game.shotAlert.t < 2.2 && Math.hypot(game.shotAlert.x - pd.x, game.shotAlert.y - pd.y) < 340) return game.shotAlert;
    for (const c of game.cars) {
      if (Math.abs(c.speed) > 130 && Math.hypot(c.x - pd.x, c.y - pd.y) < 110) return { x: c.x, y: c.y };
    }
    return null;
  }

  function update(dt, game) {
    for (const pd of peds) {
      if (pd.dead) {
        if (pd.fall < 1) pd.fall = Math.min(1, pd.fall + dt * 3.4);
        continue;
      }
      const threat = threatNear(game, pd);
      if (threat) {
        // flee: run for the nearest sampled sidewalk point, weighted away from the danger
        pd.state = 'flee';
        pd.fleeT = 3.2;
        let best = null;
        let bd = Infinity;
        for (let k = 0; k < 200; k++) {
          const wp = game.city.walkpoints[rng.int(0, game.city.walkpoints.length - 1)];
          const d = Math.hypot(wp.x - pd.x, wp.y - pd.y) + Math.hypot(wp.x - threat.x, wp.y - threat.y) * 0.7;
          if (d < bd) { bd = d; best = wp; }
        }
        pd.fleeTarget = best ?? { x: pd.x, y: pd.y };
        const a = Math.atan2(pd.fleeTarget.y - pd.y, pd.fleeTarget.x - pd.x);
        pd.fleeX = Math.cos(a);
        pd.fleeY = Math.sin(a);
      }
      if (pd.state === 'flee') {
        pd.fleeT -= dt;
        if (pd.fleeT <= 0 || Math.hypot(pd.fleeTarget.x - pd.x, pd.fleeTarget.y - pd.y) < 8) {
          pd.state = 'walk';
          pd.target = game.city.walkpoints[rng.int(0, game.city.walkpoints.length - 1)];
        }
        const nx = pd.x + pd.fleeX * 175 * dt;
        const ny = pd.y + pd.fleeY * 175 * dt;
        if (game.city.canWalk(nx, pd.y, 6)) pd.x = nx;
        if (game.city.canWalk(pd.x, ny, 6)) pd.y = ny;
        pd.dir = Math.atan2(pd.fleeY, pd.fleeX);
      } else if (pd.state === 'idle') {
        pd.idleT -= dt;
        if (pd.idleT <= 0) {
          pd.state = 'walk';
          pd.target = game.city.walkpoints[rng.int(0, game.city.walkpoints.length - 1)];
        }
      } else {
        const dx = pd.target.x - pd.x;
        const dy = pd.target.y - pd.y;
        const d = Math.hypot(dx, dy);
        if (d < 6) {
          pd.state = 'idle';
          pd.idleT = rng.range(1.5, 6);
        } else {
          const nx = pd.x + (dx / d) * pd.speed * dt;
          const ny = pd.y + (dy / d) * pd.speed * dt;
          if (game.city.canWalk(nx, pd.y, 6)) pd.x = nx;
          if (game.city.canWalk(pd.x, ny, 6)) pd.y = ny;
          pd.dir = Math.atan2(dy, dx);
          pd.phase += dt * pd.speed * 0.35;
        }
      }
    }
  }

  function draw(ctx, time) {
    for (const pd of peds) {
      ctx.save();
      ctx.translate(pd.x, pd.y);
      ctx.globalAlpha = pd.dead ? Math.max(0, 1 - pd.fall * 0.85) : 1;
      if (pd.dead) {
        ctx.rotate(pd.fall * Math.PI / 2);
        ctx.fillStyle = 'rgba(20,16,10,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 2, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pd.shirt;
        ctx.fillRect(-8, -3, 16, 7);
        ctx.fillStyle = '#33383f';
        ctx.fillRect(-8, 4, 16, 4);
        ctx.fillStyle = pd.skin;
        ctx.beginPath();
        ctx.arc(6, -3, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(20,16,10,0.28)';
        ctx.beginPath();
        ctx.ellipse(0, 3, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        const walking = pd.state === 'walk' || pd.state === 'flee';
        const step = walking ? Math.sin(pd.phase) * 2.6 : 0;
        ctx.fillStyle = '#33383f';
        ctx.fillRect(-3 + step * 0.5, 0, 2.8, 6);
        ctx.fillRect(0.6 - step * 0.5, 0, 2.8, 6);
        ctx.fillStyle = pd.shirt;
        ctx.beginPath();
        ctx.ellipse(0, -4, 5.6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        if (pd.state === 'flee') {
          // arms up in panic
          ctx.fillStyle = pd.shirt;
          ctx.fillRect(-8, -8, 3, 6);
          ctx.fillRect(5, -8, 3, 6);
          ctx.fillStyle = pd.skin;
          ctx.beginPath();
          ctx.arc(-6.5, -8.6, 1.8, 0, Math.PI * 2);
          ctx.arc(6.5, -8.6, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (pd.phone) {
          ctx.fillStyle = pd.shirt;
          ctx.fillRect(4, -5, 4, 2.6);
          ctx.fillStyle = pd.skin;
          ctx.beginPath();
          ctx.arc(8.4, -3.6, 1.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#2f7d8c';
          ctx.fillRect(7, -7, 4, 3);
        }
        ctx.fillStyle = pd.skin;
        ctx.beginPath();
        ctx.arc(0, -10.5, 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pd.hair;
        ctx.beginPath();
        ctx.arc(0, -11.6, 4.2, Math.PI * 0.9, Math.PI * 2.1);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    void time;
  }

  return { peds, update, draw };
}
