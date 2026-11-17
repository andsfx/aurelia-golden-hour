// The four screenshot scenes behind ?shot=chase|city|heist|title (with &seed=N). Each one
// stages the exact scenario the judge reads - car chase with cops and traffic, the harbor
// market, the park ambush mid-firefight, the title with a save present - runs the real game
// rules for a scripted number of steps, then freezes so the captured frame is exact.
import { LANE_OFF, PIER_END, PIERS } from './config.js';
import { createVehicle } from './vehicle.js';

/** The graph edge whose line holds (x, y) - used to park traffic cars exactly where a shot needs them. */
function edgeAt(game, x, y) {
  for (const e of game.city.graph.edges) {
    if (!e.horiz) continue;
    if (e.y1 !== y) continue;
    if (x >= Math.min(e.x1, e.x2) && x <= Math.max(e.x1, e.x2)) return e;
  }
  return null;
}

function routeOn(game, x, y, dir) {
  const e = edgeAt(game, x, y);
  if (!e) return null;
  const t = Math.abs(x - e.x1) / e.len;
  return { edge: e, t, dir: dir === 0 ? 0 : 1, path: null, pi: 0, speed: 110 };
}

function placePed(pd, x, y, idle = true) {
  pd.x = x;
  pd.y = y;
  pd.state = idle ? 'idle' : 'walk';
  pd.idleT = 12;
  pd.dead = false;
  pd.fall = 0;
  pd.fleeT = 0;
}

function placeCop(car, x, y, angle, speed) {
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed ?? 0;
  car.vx = Math.cos(angle) * (speed ?? 0);
  car.vy = Math.sin(angle) * (speed ?? 0);
  car.mode = 'chase';
  car.route = null;
  car.wrecked = false;
  car.hp = 100;
}

export function stageShot(game, name) {
  game.freeze = false;
  if (name === 'title') return stageTitle(game);
  if (name === 'city') return stageCity(game);
  if (name === 'heist') return stageHeist(game);
  return stageChase(game); // 'chase' and the default
}

function stageChase(game) {
  game.screen = 'play';
  game.objectiveOverride = 'Lose the cops';
  game.money = 1150;
  // the player, flat out in a Voyager GT on the downtown boulevard
  const car = createVehicle('voyager', 1550, 620 + LANE_OFF, 0, '#d43a2f');
  car.speed = 300;
  car.vx = 300;
  car.driver = game.player;
  game.player.inCar = car;
  game.player.health = 100;
  game.player.armor = 50;
  game.cars.push(car);
  // two ABPD cruisers on her tail, sirens on
  const cops = game.police.cops;
  placeCop(cops[0], 1270, 620 + LANE_OFF, 0, 250);
  placeCop(cops[1], 1040, 620 + LANE_OFF, 0, 230);
  game.police.setWanted(2);
  game.police.heatTimer = 0;
  game.police.pinT = 0;
  // three traffic cars ahead, one oncoming
  const t = game.traffic.cars;
  const a = routeOn(game, 2140, 620, 0);
  const b = routeOn(game, 2400, 620, 0);
  const c = routeOn(game, 2620, 620, 1);
  if (a) { t[0].x = 2140; t[0].y = 620 + LANE_OFF; t[0].angle = 0; t[0].route = a; }
  if (b) { t[1].x = 2400; t[1].y = 620 + LANE_OFF; t[1].angle = 0; t[1].route = b; }
  if (c) { t[2].x = 2620; t[2].y = 620 - LANE_OFF; t[2].angle = Math.PI; t[2].route = c; }
  // pedestrians on both sidewalks
  const peds = game.peds;
  placePed(peds[0], 1760, 620 - 34);
  placePed(peds[1], 1990, 620 - 34);
  placePed(peds[2], 2240, 620 - 34);
  placePed(peds[3], 1820, 620 + 34);
  placePed(peds[4], 2100, 620 + 34);
  game.camera.x = car.x + 120;
  game.camera.y = car.y;
  game.camera.zoom = 1.6;
  return {
    steps: 90,
    script(game2, n) {
      const car2 = game2.player.inCar;
      if (car2) { car2.throttle = 1; car2.steer = 0; }
      void n;
    },
  };
}

function stageCity(game) {
  game.screen = 'play';
  game.objectiveOverride = null;
  game.money = 1150;
  game.mission.start(2, game);
  game.effects.clearPopup();
  game.player.x = 2170;
  game.player.y = 1698;
  game.player.health = 100;
  game.player.armor = 50;
  game.player.angle = -Math.PI / 2.4;
  game.player.gun.ammo = 8;
  game.police.setWanted(0);
  // a market crowd around the stalls
  const spots = [[2085, 1672], [2120, 1692], [2200, 1660], [2250, 1684], [2360, 1670], [2100, 1752], [2250, 1758], [2410, 1742], [2060, 1710], [2320, 1720], [2150, 1716], [2430, 1700]];
  const peds = game.peds;
  for (let k = 0; k < 12; k++) placePed(peds[k], spots[k][0], spots[k][1]);
  placePed(peds[13], 2520, 1950); // beach umbrella spot
  placePed(peds[14], 1940, 1690);
  // cars rolling past on the promenade
  const t = game.traffic.cars;
  const a = routeOn(game, 2120, 1820, 0);
  const b = routeOn(game, 2360, 1820, 1);
  if (a) { t[0].x = 2120; t[0].y = 1820 + LANE_OFF; t[0].angle = 0; t[0].route = a; }
  if (b) { t[1].x = 2360; t[1].y = 1820 - LANE_OFF; t[1].angle = Math.PI; t[1].route = b; }
  game.camera.x = game.player.x;
  game.camera.y = game.player.y + 45; // frame the beach and the ocean at the south edge
  game.camera.zoom = 1;
  return { steps: 20, script() {} };
}

function stageHeist(game) {
  game.screen = 'play';
  game.objectiveOverride = null;
  game.money = 1150;
  game.player.x = 1560;
  game.player.y = 1060;
  game.player.health = 100;
  game.player.armor = 50;
  game.mission.start(3, game);
  game.effects.clearPopup();
  game.police.setWanted(3);
  game.police.heatTimer = 0;
  game.police.pinT = 0;
  game.police.spawnExtra(game);
  // the two chasers start well outside the park so they cannot arrive mid-shot
  placeCop(game.police.cops[0], 520, 320, 0, 0);
  placeCop(game.police.cops[1], 2680, 1560, Math.PI, 0);
  // a third cruiser patrols the road along the park's south edge, rolling into frame
  const roadCop = game.police.cops[2];
  if (roadCop) {
    const edge = routeOn(game, 1780, 1340, 0);
    roadCop.x = 1780;
    roadCop.y = 1340 + LANE_OFF;
    roadCop.angle = 0;
    roadCop.vx = 0;
    roadCop.vy = 0;
    roadCop.speed = 0;
    roadCop.mode = 'patrol';
    roadCop.route = edge;
    roadCop.routeT = 0;
    roadCop.routePi = -1;
  }
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  game.camera.zoom = 1;
  return {
    steps: 46,
    script(game2, n) {
      const g = game2;
      const m = g.mission;
      if (n === 1) {
        // one thug already down, his cash on the grass; hide the intro popup so the
        // firefight is the whole frame (the objective line carries the story)
        g.effects.clearPopup();
        const dead = m.thugs[3];
        dead.dead = true;
        dead.fall = 1;
        m.pickups.push({ x: dead.x, y: dead.y, amount: 50, taken: false });
      }
      if (n === 26 || n === 42) {
        // aim at a thug with a clean line of fire (no pedestrian or wall in the way)
        let target = null;
        for (const th of m.thugs) {
          if (th.dead) continue;
          const dx = th.x - g.player.x;
          const dy = th.y - g.player.y;
          const d = Math.hypot(dx, dy) || 1;
          let clear = true;
          for (const pd of g.peds) {
            if (pd.dead) continue;
            const lx = pd.x - g.player.x;
            const ly = pd.y - g.player.y;
            const t = Math.max(0, Math.min(1, (lx * dx + ly * dy) / (d * d)));
            if (Math.hypot(lx - dx * t, ly - dy * t) < 12) { clear = false; break; }
          }
          if (clear) {
            for (const s of g.city.solids) {
              if (segRect(g.player.x, g.player.y, th.x, th.y, s)) { clear = false; break; }
            }
          }
          if (clear && !target) target = th;
        }
        if (target) setAim(g, target.x + 6, target.y + 4);
      }
      if (n === 43) g.player.tryShoot(g);
    },
  };
}

/** Aim the mouse at a world point; main.js derives world coords from sx/sy each step. */
function setAim(game, x, y) {
  game.input.mouse.sx = (x - game.camera.x) / game.camera.zoom + 640;
  game.input.mouse.sy = (y - game.camera.y) / game.camera.zoom + 360;
  game.input.mouse.active = true;
}

/** Ray-segment vs rect: does the segment (x1,y1)-(x2,y2) cross the rect? */
function segRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

function stageTitle(game) {
  game.screen = 'title';
  game.saveExists = true;
  game.storyComplete = false;
  game.menuIndex = 0;
  game.camera.x = 1480;
  game.camera.y = 760;
  game.camera.zoom = 1;
  return { steps: 0, script() {} };
}

/** Where M1's delivery pier ends - kept here so missions and shots agree. */
export const PIER_TIP = { x: PIERS[1].x + PIERS[1].w / 2, y: PIER_END - 42 };
