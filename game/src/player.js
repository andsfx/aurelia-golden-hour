// Naia Cruz on foot: WASD movement, sprint, mouse aim, the pistol (hitscan + tracer + casing
// + muzzle flash), melee, car entry, health/armor with slow regen. Combat outcomes are
// reported through game callbacks so wanted levels and mission kills stay in their modules.
import { HEAT, PISTOL, PLAYER } from './config.js';

export function createPlayer(city, rng) {
  const p = {
    x: 0, y: 0, radius: PLAYER.radius,
    health: PLAYER.health, armor: PLAYER.armor,
    angle: 0, moving: false, walkPhase: 0, lastMove: { x: 1, y: 0 },
    inCar: null,
    gun: { ammo: PISTOL.mag, cooldown: 0, reload: 0 },
    lastDamage: -99, damageFlash: 0, punchT: 0,
    dead: false, blink: 0,
  };

  function reset(x, y) {
    p.x = x;
    p.y = y;
    p.health = PLAYER.health;
    p.armor = PLAYER.armor;
    p.dead = false;
    p.inCar = null;
    p.gun.ammo = PISTOL.mag;
    p.gun.reload = 0;
    p.lastDamage = -99;
    p.damageFlash = 0;
  }

  function update(dt, input, game) {
    if (p.inCar || p.dead) return;
    p.gun.cooldown -= dt;
    if (p.gun.reload > 0) {
      p.gun.reload -= dt;
      if (p.gun.reload <= 0) {
        p.gun.ammo = PISTOL.mag;
        game.audio.reload();
      }
    }
    if (p.punchT > 0) p.punchT -= dt;
    if (p.damageFlash > 0) p.damageFlash -= dt;
    // regen out of combat
    if (game.time - p.lastDamage > PLAYER.regenDelay && p.health < PLAYER.health) {
      p.health = Math.min(PLAYER.health, p.health + PLAYER.regenRate * dt);
    }
    // movement
    let mx = (input.key('KeyD') ? 1 : 0) - (input.key('KeyA') ? 1 : 0);
    let my = (input.key('KeyS') ? 1 : 0) - (input.key('KeyW') ? 1 : 0);
    if (input.key('ArrowRight')) mx = 1;
    if (input.key('ArrowLeft')) mx = -1;
    if (input.key('ArrowDown')) my = 1;
    if (input.key('ArrowUp')) my = -1;
    p.moving = mx !== 0 || my !== 0;
    if (p.moving) {
      const len = Math.hypot(mx, my);
      const spd = input.key('ShiftLeft') || input.key('ShiftRight') ? PLAYER.sprint : PLAYER.walk;
      const nx = p.x + (mx / len) * spd * dt;
      const ny = p.y + (my / len) * spd * dt;
      if (game.city.canWalk(nx, p.y, p.radius)) p.x = nx;
      if (game.city.canWalk(p.x, ny, p.radius)) p.y = ny;
      p.lastMove = { x: mx / len, y: my / len };
      p.walkPhase += dt * (spd / PLAYER.walk) * 9;
    }
    // aim: mouse when it has moved, else facing direction
    if (input.mouse.active) {
      p.angle = Math.atan2(input.mouse.wy - p.y, input.mouse.wx - p.x);
    } else if (p.moving) {
      p.angle = Math.atan2(my, mx);
    }
  }

  /** Ray vs axis-aligned rect; returns the ray distance or Infinity. */
  function rayRect(ox, oy, dx, dy, rect) {
    let tmin = 0;
    let tmax = Infinity;
    if (Math.abs(dx) < 1e-6) {
      if (ox < rect.x || ox > rect.x + rect.w) return Infinity;
    } else {
      const t1 = (rect.x - ox) / dx;
      const t2 = (rect.x + rect.w - ox) / dx;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    }
    if (Math.abs(dy) < 1e-6) {
      if (oy < rect.y || oy > rect.y + rect.h) return Infinity;
    } else {
      const t1 = (rect.y - oy) / dy;
      const t2 = (rect.y + rect.h - oy) / dy;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
    }
    return tmax >= tmin && tmin >= 0 ? tmin : Infinity;
  }

  function tryShoot(game) {
    if (p.inCar || p.dead) return;
    if (p.gun.reload > 0 || p.gun.cooldown > 0) return;
    if (p.gun.ammo <= 0) {
      p.gun.reload = PISTOL.reload;
      return;
    }
    p.gun.ammo -= 1;
    p.gun.cooldown = PISTOL.cooldown;
    if (p.gun.ammo === 0) p.gun.reload = PISTOL.reload;
    const ox = p.x + Math.cos(p.angle) * 18;
    const oy = p.y + Math.sin(p.angle) * 18;
    const dx = Math.cos(p.angle);
    const dy = Math.sin(p.angle);
    let bestT = PISTOL.range;
    let bestHit = null;
    // thugs
    for (const t of game.mission.thugs) {
      if (t.dead) continue;
      const tHit = rayCircle(ox, oy, dx, dy, t.x, t.y, 10);
      if (tHit < bestT) { bestT = tHit; bestHit = { kind: 'thug', ref: t }; }
    }
    // pedestrians
    for (const pd of game.peds) {
      if (pd.dead) continue;
      const tHit = rayCircle(ox, oy, dx, dy, pd.x, pd.y, 8);
      if (tHit < bestT) { bestT = tHit; bestHit = { kind: 'ped', ref: pd }; }
    }
    // cars
    for (const c of game.cars) {
      const tHit = rayCircle(ox, oy, dx, dy, c.x, c.y, 22);
      if (tHit < bestT) { bestT = tHit; bestHit = { kind: 'car', ref: c }; }
    }
    // buildings stop the bullet
    for (const s of game.city.solids) {
      const tHit = rayRect(ox, oy, dx, dy, s);
      if (tHit < bestT) { bestT = tHit; bestHit = null; }
    }
    const ex = ox + dx * bestT;
    const ey = oy + dy * bestT;
    game.effects.muzzle(ox, oy, p.angle);
    game.effects.tracer(ox, oy, ex, ey);
    game.effects.casing(p.x + Math.cos(p.angle + 1.6) * 8, p.y + Math.sin(p.angle + 1.6) * 8, p.angle);
    game.effects.addShake(2.4);
    game.audio.gunshot();
    // firing near a cop is its own offense
    for (const c of game.cars) {
      if (c.kind === 'cop' && Math.hypot(c.x - p.x, c.y - p.y) < 280) {
        game.police.addHeat(HEAT.shootNearCop);
        break;
      }
    }
    if (!bestHit) return;
    if (bestHit.kind === 'thug') {
      const t = bestHit.ref;
      t.hp -= PISTOL.damage;
      t.hitFlash = 0.12;
      game.effects.blood(ex, ey);
      if (t.hp <= 0 && !t.dead) game.mission.killThug(t, game);
    } else if (bestHit.kind === 'ped') {
      const pd = bestHit.ref;
      pd.hp -= PISTOL.hitPed;
      game.effects.blood(ex, ey);
      if (pd.hp <= 0 && !pd.dead) {
        pd.dead = true;
        pd.fall = 0;
        game.effects.blood(ex, ey);
        game.police.addHeat(HEAT.killPed);
      }
    } else if (bestHit.kind === 'car') {
      const c = bestHit.ref;
      c.hp -= PISTOL.hitCar;
      game.effects.impact(ex, ey, '#ffd97a', 6);
      if (c.kind === 'cop' && c.hp <= 0 && !c.wrecked) game.police.wreckCop(c, game);
    }
  }

  function rayCircle(ox, oy, dx, dy, cx, cy, r) {
    const lx = cx - ox;
    const ly = cy - oy;
    const t = Math.max(0, Math.min(1e9, lx * dx + ly * dy));
    const px = ox + dx * t - cx;
    const py = oy + dy * t - cy;
    if (px * px + py * py > r * r) return Infinity;
    return Math.max(0, t - r * 0.6);
  }

  function punch(game) {
    if (p.inCar || p.dead || p.punchT > 0) return;
    p.punchT = 0.24;
    game.audio.punch();
    const reach = 36;
    let best = null;
    let bd = reach;
    for (const pd of game.peds) {
      if (pd.dead) continue;
      const d = Math.hypot(pd.x - p.x, pd.y - p.y);
      const da = Math.abs(Math.atan2(pd.y - p.y, pd.x - p.x) - p.angle);
      if (d < bd && da < 1.3) { bd = d; best = { kind: 'ped', ref: pd }; }
    }
    for (const t of game.mission.thugs) {
      if (t.dead) continue;
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      const da = Math.abs(Math.atan2(t.y - p.y, t.x - p.x) - p.angle);
      if (d < bd && da < 1.3) { bd = d; best = { kind: 'thug', ref: t }; }
    }
    if (!best) return;
    const v = best.ref;
    v.hp -= 20;
    v.hitFlash = 0.12;
    if (best.kind === 'ped') {
      game.police.addHeat(HEAT.hitPed);
      if (v.hp <= 0 && !v.dead) {
        v.dead = true;
        v.fall = 0;
        game.police.addHeat(HEAT.killPed);
      }
    } else if (v.hp <= 0 && !v.dead) {
      game.mission.killThug(v, game);
    }
  }

  function takeDamage(v, game) {
    if (p.dead) return;
    let remaining = v;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, v * 0.6);
      p.armor -= absorbed;
      remaining -= absorbed;
    }
    p.health -= remaining;
    p.lastDamage = game.time;
    p.damageFlash = 0.35;
    game.effects.addVignette(0.75);
    game.effects.addShake(4);
    game.audio.hitThud();
    if (p.health <= 0) {
      p.dead = true;
      game.onPlayerWasted();
    }
  }

  function draw(ctx, time) {
    if (p.inCar || p.dead) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    // shadow
    ctx.fillStyle = 'rgba(20,16,10,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // legs with walk cycle
    const step = p.moving ? Math.sin(p.walkPhase) * 3.4 : 0;
    ctx.fillStyle = '#2c333d';
    ctx.fillRect(-5 + step * 0.4, 1, 4, 8);
    ctx.fillRect(1 - step * 0.4, 1, 4, 8);
    // torso: Naia's sun-bleached jacket
    ctx.fillStyle = '#c96f3a';
    roundRect2(ctx, -7, -8, 14, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#a85a2d';
    ctx.fillRect(-7, 1, 14, 3);
    // head
    ctx.fillStyle = '#d9a577';
    ctx.beginPath();
    ctx.arc(0, -13, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e1f18';
    ctx.beginPath();
    ctx.arc(-0.5, -14.4, 5, Math.PI * 0.85, Math.PI * 2.05);
    ctx.fill();
    // arms + pistol at the aim angle
    ctx.save();
    ctx.rotate(p.angle);
    const reach = p.punchT > 0 ? 16 + (0.24 - p.punchT) * 90 : 15;
    ctx.fillStyle = '#c96f3a';
    ctx.fillRect(2, -1.6, reach - 4, 3.2);
    ctx.fillStyle = '#d9a577';
    ctx.beginPath();
    ctx.arc(reach - 2, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#23272e';
    ctx.fillRect(reach - 2, -2.6, 9, 4);
    ctx.fillRect(reach + 4, -1.4, 3, 3.2);
    ctx.restore();
    // muzzle flash bloom when the last shot was a moment ago
    if (p.gun.cooldown > PISTOL.cooldown - 0.09 && p.gun.cooldown < PISTOL.cooldown) {
      ctx.save();
      ctx.rotate(p.angle);
      const g = ctx.createRadialGradient(22, 0, 0, 22, 0, 12);
      g.addColorStop(0, 'rgba(255,235,170,0.95)');
      g.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(22, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  return Object.assign(p, { reset, update, tryShoot, punch, takeDamage, draw });
}

function roundRect2(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
