// Arcade top-down car physics shared by every vehicle: the player's car, traffic, patrol
// cruisers and roadblocks. Throttle/steer inputs come from the driver (human or AI); the
// physics builds velocity from heading, bleeds lateral drift for slides, and bounces off
// buildings with sparks. Also the smooth follow camera with its in-car zoom-out.
import { CAR_TYPES, CAR_ZOOM, FOOT_ZOOM, VIEW_H, VIEW_W } from './config.js';
import { drawCarBody } from './city.js';

export function createVehicle(kind, x, y, angle, color) {
  const spec = CAR_TYPES[kind];
  return {
    kind, color: color ?? '#c23326', x, y, vx: 0, vy: 0, angle, speed: 0,
    steer: 0, throttle: 0, driver: null, hp: 100, honkT: 0, skidT: 0, exhaustT: 0,
    wrecked: false, scratchT: -9, pushT: 0,
    spec: { w: spec.w, h: spec.h, maxSpeed: spec.maxSpeed, accel: spec.accel, turn: spec.turn },
  };
}

/** One physics step for any car; throttle in -1..1, steer in -1..1. */
export function stepVehiclePhysics(car, dt, game) {
  if (car.wrecked) {
    car.vx *= 0.92;
    car.vy *= 0.92;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    return;
  }
  const spec = car.spec;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  if (car.throttle > 0) car.speed += spec.accel * car.throttle * dt;
  else if (car.throttle < 0) {
    if (car.speed > 5) car.speed -= spec.accel * 1.7 * dt;
    else car.speed = Math.max(-spec.maxSpeed * 0.42, car.speed - spec.accel * 0.6 * dt);
  } else car.speed *= Math.max(0, 1 - 1.15 * dt);
  car.speed = Math.max(-spec.maxSpeed * 0.42, Math.min(spec.maxSpeed, car.speed));
  const speedFactor = Math.min(1, Math.abs(car.speed) / (spec.maxSpeed * 0.5));
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle -= car.steer * spec.turn * speedFactor * dir * dt;
  // grip: hard steering at speed slides (drift)
  const grip = Math.abs(car.steer) > 0.55 && speedFactor > 0.7 ? 0.865 : 0.975;
  const fvx = fx * car.speed;
  const fvy = fy * car.speed;
  car.vx = fvx + (car.vx - fvx) * Math.pow(grip, dt * 60);
  car.vy = fvy + (car.vy - fvy) * Math.pow(grip, dt * 60);
  const lat = Math.abs(-fy * (car.vx - fvx) + fx * (car.vy - fvy));
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  // bounce off buildings with sparks
  if (!game.city.canDrive(car.x, car.y, 16)) {
    if (game.city.canDrive(car.x - car.vx * dt, car.y, 16)) { car.x -= car.vx * dt; car.vx *= -0.26; }
    else if (game.city.canDrive(car.x, car.y - car.vy * dt, 16)) { car.y -= car.vy * dt; car.vy *= -0.26; }
    else { car.x -= car.vx * dt; car.y -= car.vy * dt; car.vx *= -0.26; car.vy *= -0.26; }
    car.speed *= 0.4;
    game.effects.impact(car.x + fx * 22, car.y + fy * 22, '#ffd97a', 12);
    game.effects.addShake(3.2);
    if (game.time - car.scratchT > 0.45) {
      car.scratchT = game.time;
      game.audio.crash();
    }
  }
  // drift marks + tire squeal
  if (lat > 58) {
    const px = -fy * 9;
    const py = fx * 9;
    game.effects.skid(car.x + px, car.y + py, car.x - px, car.y - py);
    car.skidT -= dt;
    if (car.skidT <= 0) {
      car.skidT = 0.28;
      game.audio.screech();
    }
  }
  // exhaust puffs under throttle
  car.exhaustT -= dt;
  if (car.throttle > 0 && car.exhaustT <= 0) {
    car.exhaustT = 0.08;
    game.effects.exhaust(car.x - fx * 24, car.y - fy * 24, car.angle);
  }
  if (car.honkT > 0) car.honkT -= dt;
  if (car.pushT > 0) car.pushT -= dt;
}

/** Cop light-bar glow: red/blue that rotates with time, brighter when sirens are on. */
export function drawVehicle(ctx, car, time, siren) {
  ctx.save();
  ctx.translate(car.x, car.y);
  // shadow
  ctx.fillStyle = 'rgba(20,16,10,0.32)';
  ctx.beginPath();
  ctx.ellipse(3, 5, car.spec.w * 0.55, car.spec.h * 0.6, car.angle, 0, Math.PI * 2);
  ctx.fill();
  if (car.kind === 'cop') {
    const phase = Math.sin(time * (siren ? 9 : 3.5));
    const glowAt = (dx, col) => {
      const g = ctx.createRadialGradient(dx, 0, 0, dx, 0, 30);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(dx, 0, 30, 0, Math.PI * 2);
      ctx.fill();
    };
    // twin light bar: red one side, blue the other, brightness alternating
    glowAt(-9, phase > 0 ? 'rgba(255,60,50,0.6)' : 'rgba(255,60,50,0.22)');
    glowAt(9, phase > 0 ? 'rgba(70,120,255,0.22)' : 'rgba(70,120,255,0.6)');
  }
  drawCarBody(ctx, car.kind, car.color, car.angle);
  if (car.kind === 'cop') {
    ctx.save();
    ctx.rotate(car.angle);
    const half = car.spec.w * 0.16;
    const on = Math.sin(time * (siren ? 9 : 3.5)) > 0;
    ctx.fillStyle = '#ff4d3c';
    ctx.fillRect(-half, -car.spec.h / 2 - 4, half, 4);
    ctx.fillStyle = '#4d78ff';
    ctx.fillRect(0, -car.spec.h / 2 - 4, half, 4);
    void on;
    ctx.restore();
  }
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(30,30,30,0.45)';
    roundRect3(ctx, -car.spec.w / 2, -car.spec.h / 2, car.spec.w, car.spec.h, 6);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect3(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Smooth follow camera: looks ahead of a moving car, zooms out 1.6x while driving. */
export function updateCamera(game, dt) {
  const cam = game.camera;
  const p = game.player;
  let tx, ty, tz;
  if (p.inCar) {
    const c = p.inCar;
    const ahead = Math.min(1, Math.abs(c.speed) / c.spec.maxSpeed);
    tx = c.x + Math.cos(c.angle) * ahead * 130;
    ty = c.y + Math.sin(c.angle) * ahead * 130;
    tz = CAR_ZOOM;
  } else {
    tx = p.x + (game.input.mouse.active ? (game.input.mouse.wx - p.x) * 0.14 : 0);
    ty = p.y + (game.input.mouse.active ? (game.input.mouse.wy - p.y) * 0.14 : 0);
    tz = FOOT_ZOOM;
  }
  const k = Math.min(1, dt * 5.2);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.zoom += (tz - cam.zoom) * Math.min(1, dt * 3.6);
  cam.x = Math.max(VIEW_W * cam.zoom / 2, Math.min(3400 - VIEW_W * cam.zoom / 2, cam.x));
  cam.y = Math.max(VIEW_H * cam.zoom / 2 - 40, Math.min(2200 - VIEW_H * cam.zoom / 2, cam.y));
  // shake rides on top as a deterministic wobble
  const s = game.effects.state.shake;
  cam.shakeX = Math.sin(game.time * 71) * s * 0.9;
  cam.shakeY = Math.cos(game.time * 63) * s * 0.9;
}
