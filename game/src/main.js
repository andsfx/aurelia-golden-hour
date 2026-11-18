// Boot and the one loop. Reads ?shot=&seed= from the URL (the screenshot scenes), builds the
// city and every subsystem from one seeded PRNG, and runs a fixed-step simulation painted at
// the display's rate. Screens: title, intro, controls, play, pause, mission complete, busted
// and wasted. All game state lives on `game`, so every module stays independent.
import { BRIDGE_ZONE, CAR_ZOOM, FOOT_ZOOM, PISTOL, SAVE_KEY, SPAWN_POINT, STEP, VIEW_H, VIEW_W } from './config.js';
import { createRandom } from './random.js';
import { createCity, drawCity } from './city.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createPlayer } from './player.js';
import { createVehicle, drawVehicle, stepVehiclePhysics, updateCamera } from './vehicle.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { drawScreens } from './screens.js';
import { stageShot } from './shots.js';
import { clearSave, loadSave, writeSave } from './save.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

const rng = createRandom(seed);
const city = createCity(rng);
const effects = createEffects(rng);
const audio = createAudio(rng);
const player = createPlayer(city, rng);
const traffic = createTraffic(city, rng, 16);
const police = createPolice(city, rng);
const mission = createMissions(city, rng);
const peds = createPedestrians(city, rng, 50);
const hud = createHud(city);

// ---------------------------------------------------------------- input

const input = {
  held: new Set(),
  pressed: new Set(),
  mouse: { sx: VIEW_W / 2, sy: VIEW_H / 2, wx: 0, wy: 0, down: false, active: false },
  key(code) { return this.held.has(code); },
  takePressed() {
    const p = this.pressed;
    this.pressed = new Set();
    return p;
  },
};

const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space']);

window.addEventListener('keydown', (event) => {
  audio.unlock();
  if (GAME_KEYS.has(event.code)) event.preventDefault();
  if (!event.repeat) input.pressed.add(event.code);
  input.held.add(event.code);
});
window.addEventListener('keyup', (event) => {
  input.held.delete(event.code);
});
window.addEventListener('blur', () => {
  input.held.clear();
  input.mouse.down = false;
});
canvas.addEventListener('mousemove', (event) => {
  audio.unlock();
  const rect = canvas.getBoundingClientRect();
  input.mouse.sx = ((event.clientX - rect.left) / rect.width) * VIEW_W;
  input.mouse.sy = ((event.clientY - rect.top) / rect.height) * VIEW_H;
  input.mouse.active = true;
});
canvas.addEventListener('mousedown', (event) => {
  audio.unlock();
  if (event.button === 0) input.mouse.down = true;
});
window.addEventListener('mouseup', () => {
  input.mouse.down = false;
});

// ---------------------------------------------------------------- game state

const game = {
  screen: 'title',
  menuIndex: 0,
  returnTo: 'title',
  money: 250,
  missionId: 0,
  storyComplete: false,
  clockMinutes: 17 * 60 + 45,
  time: 0,
  stepCount: 0,
  cars: [...traffic.cars, ...police.cops],
  peds: peds.peds,
  bullets: [],
  timers: [],
  camera: { x: 1480, y: 760, zoom: 1, shakeX: 0, shakeY: 0 },
  city, effects, audio, player, traffic, police, mission, hud, input, rng,
  saveExists: loadSave() !== null,
  lastHeatT: null,
  lastWanted: 0,
  objectiveOverride: null,
  objectiveText: '',
  missionBar: null,   // {label, progress} - the top-left mission progress readout
  dialogue: null,     // {text, speaker, t, ttl} - portrait dialogue box
  nearCar: false,
  nearDoor: false,
  enterTarget: null,
  parkedTarget: null,
  interactPressed: false,
  shotAlert: null,
  completeInfo: null,
  freeze: false,
  script: null,
  hitHeatCd: 0,
  shotMode: shotName !== null,
};

function announce(message) {
  status.textContent = message;
}

/** Show a line in the portrait dialogue box (typed effect in the HUD). */
game.say = (text, speaker = 'Santos', ttl = 4.5) => {
  game.dialogue = { text, speaker, t: 0, ttl };
};

// ---------------------------------------------------------------- lifecycle

function resetWorldState() {
  police.setWanted(0);
  police.heatTimer = -999;
  police.pinT = 0;
  police.clearRoadblocks(game);
  mission.id = 0;
  mission.step = 0;
  mission.thugs = [];
  mission.pickups = [];
  mission.marker = null;
  if (mission.markedCar) {
    const i = game.cars.indexOf(mission.markedCar);
    if (i >= 0) game.cars.splice(i, 1);
    mission.markedCar = null;
  }
  game.bullets.length = 0;
  game.timers.length = 0;
  game.objectiveOverride = null;
  game.hitHeatCd = 0;
  game.lastWanted = 0;
  game.lastHeatT = null;
}

function startNewGame() {
  clearSave();
  resetWorldState();
  game.money = 250;
  game.missionId = 0;
  game.storyComplete = false;
  game.clockMinutes = 17 * 60 + 45;
  game.saveExists = false;
  if (player.inCar) {
    player.inCar.driver = null;
    player.inCar = null;
  }
  player.reset(SPAWN_POINT.x, SPAWN_POINT.y);
  game.camera.x = player.x;
  game.camera.y = player.y;
  game.camera.zoom = FOOT_ZOOM;
  game.screen = 'intro';
  announce('New game. AURELIA BAY: Golden Hour.');
}

function continueGame() {
  const s = loadSave();
  if (!s) return;
  resetWorldState();
  game.money = s.money;
  game.missionId = s.mission;
  game.storyComplete = s.complete;
  if (player.inCar) {
    player.inCar.driver = null;
    player.inCar = null;
  }
  player.reset(Number.isFinite(s.x) ? s.x : SPAWN_POINT.x, Number.isFinite(s.y) ? s.y : SPAWN_POINT.y);
  game.camera.x = player.x;
  game.camera.y = player.y;
  game.camera.zoom = FOOT_ZOOM;
  game.screen = 'play';
  if (game.missionId < 4) mission.start(game.missionId + 1, game);
  announce('Game loaded.');
}

function quitToTitle() {
  if (player.inCar) {
    player.inCar.driver = null;
    player.inCar = null;
  }
  if (game.missionId > 0 || game.storyComplete || game.money !== 250) writeSave(game);
  game.saveExists = loadSave() !== null;
  game.screen = 'title';
  game.menuIndex = 0;
  game.returnTo = 'title';
  police.setWanted(0);
  police.clearRoadblocks(game);
  game.camera.x = 1480;
  game.camera.y = 760;
  game.camera.zoom = 1;
}

function respawn() {
  game.money = Math.max(0, Math.round(game.money * 0.9));
  if (player.inCar) {
    player.inCar.driver = null;
    player.inCar = null;
  }
  player.reset(SPAWN_POINT.x, SPAWN_POINT.y);
  police.setWanted(0);
  police.clearRoadblocks(game);
  game.camera.x = player.x;
  game.camera.y = player.y;
  game.camera.zoom = FOOT_ZOOM;
  game.screen = 'play';
  effects.popupSmall(['Back at the safehouse.', '-10% cash']);
  announce('Respawned at the safehouse.');
}

game.onPlayerWasted = () => {
  game.screen = 'wasted';
  audio.wasted();
  effects.flash('#a01818', 0.8);
  announce('Wasted.');
};

game.onPlayerBusted = () => {
  game.screen = 'busted';
  audio.busted();
  effects.flash('#1830a0', 0.8);
  police.setWanted(0);
  police.clearRoadblocks(game);
  announce('Busted.');
};

game.onMissionComplete = (def) => {
  game.completeInfo = {
    id: def.id,
    title: def.title,
    reward: def.reward,
    timeText: fmtTime(game.time - mission.startedAt),
    last: def.id === 4,
  };
  game.screen = 'complete';
  writeSave(game);
  audio.missionSting();
  announce(`Mission ${def.id} passed.`);
};

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- step

function enterCar(car) {
  car.driver = player;
  player.inCar = car;
  audio.engineStart();
  if (car.kind === 'cop') {
    police.addHeatEvent(2, game);
  } else if (!car.marked) {
    let witnesses = 0;
    for (const pd of game.peds) {
      if (!pd.dead && Math.hypot(pd.x - car.x, pd.y - car.y) < 190) witnesses++;
    }
    if (witnesses > 0) police.addHeatEvent(1, game);
  }
}

function exitCar() {
  const car = player.inCar;
  if (!car) return;
  const px = car.x - Math.sin(car.angle) * 22;
  const py = car.y + Math.cos(car.angle) * 22;
  if (city.canWalk(px, py, player.radius)) {
    player.x = px;
    player.y = py;
  }
  car.driver = null;
  player.inCar = null;
  car.speed *= 0.4;
  audio.engineStop();
}

function handlePlayEdges(pressed) {
  if (pressed.has('Escape')) {
    game.screen = 'paused';
    game.menuIndex = 0;
    announce('Paused.');
    return;
  }
  if (pressed.has('KeyM')) audio.toggleMute();
  if (pressed.has('KeyH') && player.inCar) {
    player.inCar.honkT = 0.4;
    audio.horn();
  }
  if (pressed.has('KeyR') && !player.inCar) {
    if (player.gun.ammo < PISTOL.mag && player.gun.reload <= 0) player.gun.reload = PISTOL.reload;
  }
  if (pressed.has('KeyF') && !player.inCar) player.punch(game);
  if (pressed.has('KeyE')) {
    if (player.inCar) {
      exitCar();
    } else if (game.enterTarget) {
      enterCar(game.enterTarget);
      game.enterTarget = null;
    } else if (game.parkedTarget) {
      const pk = game.parkedTarget;
      const car = createVehicle(pk.color === '#7d8fa3' || pk.color === '#a8b6c4' ? 'van' : 'sedan', pk.x, pk.y, pk.angle, pk.color);
      const i = city.parked.indexOf(pk);
      if (i >= 0) city.parked.splice(i, 1);
      game.cars.push(car);
      enterCar(car);
      game.parkedTarget = null;
    } else if (game.nearDoor) {
      game.interactPressed = true;
    }
  }
}

function handleMenuEdges(pressed) {
  if (pressed.has('KeyM')) audio.toggleMute();
  if (game.screen === 'title') {
    if (pressed.has('ArrowDown')) {
      game.menuIndex = Math.min(2, game.menuIndex + 1);
      if (game.menuIndex === 1 && !game.saveExists) game.menuIndex = 2;
    } else if (pressed.has('ArrowUp')) {
      game.menuIndex = Math.max(0, game.menuIndex - 1);
      if (game.menuIndex === 1 && !game.saveExists) game.menuIndex = 0;
    } else if (pressed.has('Enter')) {
      if (game.menuIndex === 0) startNewGame();
      else if (game.menuIndex === 1) continueGame();
      else {
        game.screen = 'controls';
        game.returnTo = 'title';
      }
    }
  } else if (game.screen === 'intro') {
    if (pressed.has('Enter')) {
      game.screen = 'play';
      mission.start(1, game);
      announce('Mission 1 started.');
    }
  } else if (game.screen === 'controls') {
    if (pressed.has('Escape')) {
      game.screen = game.returnTo === 'paused' ? 'paused' : 'title';
    }
  } else if (game.screen === 'paused') {
    if (pressed.has('Escape')) {
      game.screen = 'play';
      announce('Playing.');
    } else if (pressed.has('ArrowDown')) game.menuIndex = Math.min(3, game.menuIndex + 1);
    else if (pressed.has('ArrowUp')) game.menuIndex = Math.max(0, game.menuIndex - 1);
    else if (pressed.has('Enter')) {
      if (game.menuIndex === 0) game.screen = 'play';
      else if (game.menuIndex === 1) audio.toggleMute();
      else if (game.menuIndex === 2) {
        game.screen = 'controls';
        game.returnTo = 'paused';
      } else quitToTitle();
    }
  } else if (game.screen === 'complete') {
    if (pressed.has('Enter')) {
      game.screen = 'play';
      if (!game.completeInfo.last) effects.popupSmall(['New job at the safehouse', 'whenever you are ready.']);
    }
  } else if (game.screen === 'busted' || game.screen === 'wasted') {
    if (pressed.has('Enter')) respawn();
  }
  // any key skips the typed popup
  if (effects.state.popup && pressed.size > 0) effects.state.popup.chars = effects.state.popup.total;
}

function stepPlay(dt) {
  game.time += dt;
  game.stepCount += 1;
  game.clockMinutes = (game.clockMinutes + dt * 30) % 1440;
  if (police.wanted > game.lastWanted) game.lastHeatT = game.time;
  game.lastWanted = police.wanted;
  // portrait dialogue: type over time, auto-dismiss after its ttl
  if (game.dialogue) {
    game.dialogue.t += dt;
    game.dialogue.ttl -= dt;
    if (game.dialogue.ttl <= 0) game.dialogue = null;
  }

  // convert the mouse to world space under the current camera
  const cam = game.camera;
  input.mouse.wx = cam.x - (VIEW_W * cam.zoom) / 2 + input.mouse.sx * cam.zoom;
  input.mouse.wy = cam.y - (VIEW_H * cam.zoom) / 2 + input.mouse.sy * cam.zoom;

  player.update(dt, input, game);
  if (player.inCar) {
    const car = player.inCar;
    car.throttle = (input.key('KeyW') ? 1 : 0) - (input.key('KeyS') ? 1 : 0);
    car.steer = (input.key('KeyD') ? 1 : 0) - (input.key('KeyA') ? 1 : 0);
    stepVehiclePhysics(car, dt, game);
    audio.engine(Math.abs(car.speed) / car.spec.maxSpeed);
  }
  if (input.mouse.down && !player.inCar) {
    const before = player.gun.ammo;
    player.tryShoot(game);
    if (player.gun.ammo !== before || player.gun.reload > 0) {
      game.shotAlert = { x: player.x, y: player.y, t: game.time };
    }
  }

  traffic.update(dt, game);
  police.update(dt, game);
  mission.update(dt, game);
  peds.update(dt, game);

  // car-car collisions: shove apart, spark on impact, heat when the player rams a civilian
  game.hitHeatCd -= dt;
  for (let i = 0; i < game.cars.length; i++) {
    for (let j = i + 1; j < game.cars.length; j++) {
      const a = game.cars[i];
      const b = game.cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (!Number.isFinite(d) || d > 46 || d < 0.001) continue;
      const nx = dx / d;
      const ny = dy / d;
      const push = (46 - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const rv = Math.abs((b.vx - a.vx) * nx + (b.vy - a.vy) * ny);
      if (rv > 85) {
        effects.impact((a.x + b.x) / 2, (a.y + b.y) / 2, '#ffd97a', 8);
        effects.addShake(2);
        if (a.scratchT === undefined || game.time - a.scratchT > 0.4) {
          a.scratchT = game.time;
          audio.crash();
        }
        // hard rams chip health; deliberate damage is rate-limited so wrecks take real effort
        if (rv > 150 && (a.scratchT === game.time || b.scratchT === game.time)) {
          a.hp -= 6;
          b.hp -= 6;
        }
        const pCar = player.inCar;
        const isPlayerHit = (pCar === a && b.kind !== 'cop' && !b.wrecked) || (pCar === b && a.kind !== 'cop' && !a.wrecked);
        if (isPlayerHit && game.hitHeatCd <= 0 && rv > 120) {
          game.hitHeatCd = 2;
          police.addHeatEvent(1, game);
        }
      }
    }
  }

  // cars hitting pedestrians: only the lane itself counts, and a pedestrian who already
  // panicked and ran into the road costs no stars (they still take the hit)
  for (const car of game.cars) {
    if (!Number.isFinite(car.speed) || Math.abs(car.speed) < 70) continue;
    const front = Math.abs(car.speed) * 0.45;
    const cxx = Math.cos(car.angle);
    const cyy = Math.sin(car.angle);
    for (const pd of game.peds) {
      if (pd.dead) continue;
      const dx = pd.x - car.x;
      const dy = pd.y - car.y;
      const ahead = dx * cxx + dy * cyy;
      const perp = Math.abs(dx * -cyy + dy * cxx);
      if (ahead < 6 || ahead > front || perp > 17) continue;
      pd.fleeT = 3;
      pd.hitCd = (pd.hitCd ?? 0) - dt;
      if (pd.hitCd > 0) continue;
      pd.hitCd = 1;
      pd.hp -= 30 + Math.abs(car.speed) * 0.35;
      effects.blood(pd.x, pd.y);
      audio.hitThud();
      if (pd.hp <= 0) {
        pd.dead = true;
        pd.fall = 0;
        if (car.driver === player) police.addHeatEvent(2, game);
      } else if (car.driver === player && pd.state !== 'flee') {
        police.addHeatEvent(1, game);
      }
    }
  }

  // bullets in flight
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    b.ttl -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.ttl <= 0 || !city.canWalk(b.x, b.y, 2)) {
      if (b.ttl > 0) effects.impact(b.x, b.y, '#c9cdd4', 3);
      game.bullets.splice(i, 1);
      continue;
    }
    if (!player.dead && !player.inCar && Math.hypot(b.x - player.x, b.y - player.y) < 9) {
      player.takeDamage(8, game);
      game.bullets.splice(i, 1);
    }
  }

  // frame-counted one-shot timers (mission beats)
  for (let i = game.timers.length - 1; i >= 0; i--) {
    const t = game.timers[i];
    t.t -= dt;
    if (t.t <= 0) {
      game.timers.splice(i, 1);
      t.fn(game);
    }
  }

  effects.update(dt, game.time);
  audio.update(dt);
  updateCamera(game, dt);

  // contextual hints
  game.nearCar = false;
  game.enterTarget = null;
  game.parkedTarget = null;
  if (!player.inCar) {
    for (const c of game.cars) {
      if (Math.hypot(c.x - player.x, c.y - player.y) < 48) {
        game.nearCar = true;
        game.enterTarget = c;
        break;
      }
    }
    if (!game.enterTarget) {
      for (const pk of city.parked) {
        if (Math.hypot(pk.x - player.x, pk.y - player.y) < 42) {
          game.nearCar = true;
          game.parkedTarget = pk;
          break;
        }
      }
    }
  }
  game.nearDoor = mission.id === 2 && mission.step === 1 && !player.inCar
    && Math.abs(player.x - (city.jewelryDoor.x + city.jewelryDoor.w / 2)) < 70
    && Math.abs(player.y - (city.jewelryDoor.y + city.jewelryDoor.h / 2)) < 60;
  game.objectiveText = game.objectiveOverride ?? mission.objectiveText();

  // free-roam job pickup: walking to the safehouse starts the next mission
  if (mission.id === 0 && game.missionId < 4 && Math.hypot(player.x - 808, player.y - 262) < 95) {
    mission.start(game.missionId + 1, game);
  }
}

function stepFrame(dt) {
  game.time += dt;
  const pressed = input.takePressed();
  if (pressed.size > 0 && game.dialogue) game.dialogue = null; // any key dismisses the dialogue
  if (game.screen === 'play') handlePlayEdges(pressed);
  handleMenuEdges(pressed);
  if (game.screen === 'play') stepPlay(dt);
  else if (game.screen === 'title') {
    // slow pan over the city behind the logo
    game.camera.x = 1480 + Math.sin(game.time * 0.09) * 760;
    game.camera.y = 780 + Math.cos(game.time * 0.055) * 420;
    game.camera.zoom = 1;
    effects.update(dt, game.time);
    audio.update(dt);
  } else if (game.screen === 'paused' || game.screen === 'complete' || game.screen === 'busted' || game.screen === 'wasted') {
    effects.update(dt, game.time);
  }
  // a wobbly idle camera on the intro and controls screens
  if (game.screen === 'intro' || game.screen === 'controls') {
    game.camera.x = 1480 + Math.sin(game.time * 0.07) * 500;
    game.camera.y = 900 + Math.cos(game.time * 0.05) * 300;
  }
}

// ---------------------------------------------------------------- draw

const HUD_SCREENS = new Set(['play', 'paused', 'complete', 'busted', 'wasted']);

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0c0d10';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const cam = game.camera;
  const zoom = cam.zoom;
  const x0 = cam.x - (VIEW_W * zoom) / 2;
  const y0 = cam.y - (VIEW_H * zoom) / 2;
  ctx.save();
  ctx.translate(VIEW_W / 2 + cam.shakeX, VIEW_H / 2 + cam.shakeY);
  ctx.scale(1 / zoom, 1 / zoom);
  ctx.translate(-cam.x, -cam.y);
  const camRect = { x0, y0, x1: x0 + VIEW_W * zoom, y1: y0 + VIEW_H * zoom };
  drawCity(ctx, city, camRect, game.time);
  police.drawSearchlight(ctx, game); // the heli's light pool, under the cars and people
  effects.drawWorld(ctx);
  mission.draw(ctx, game.time);
  peds.draw(ctx, game.time);
  const siren = police.wanted > 0;
  for (const c of game.cars) drawVehicle(ctx, c, game.time, siren);
  for (const b of game.bullets) {
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  player.draw(ctx, game.time);
  police.drawHeli(ctx, game.time); // the helicopter rides on top of everything
  ctx.restore();
  effects.drawOverlay(ctx, game, game.time);
  if (HUD_SCREENS.has(game.screen)) hud.draw(ctx, game);
  drawScreens(ctx, game, game.time);
}

// ---------------------------------------------------------------- loop

const MAX_FRAME = 0.25;

function runShot() {
  window.__game = game; // shot mode exposes state for deterministic verification
  const staged = stageShot(game, shotName);
  game.script = staged.script;
  for (let i = 0; i < staged.steps; i++) {
    if (game.script) game.script(game, i);
    stepPlay(STEP);
  }
  game.freeze = true;
  let painted = 0;
  const paint = () => {
    draw();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (!game.freeze) {
      while (accumulator >= STEP) {
        accumulator -= STEP;
        stepFrame(STEP);
      }
    }
    draw();
  };
  announce('AURELIA BAY: Golden Hour. Press Enter to begin.');
  requestAnimationFrame(frame);
}

if (shotName) runShot();
else runGame();
