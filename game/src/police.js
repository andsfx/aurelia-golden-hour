// The Aurelia Bay Police Department: a wanted level from 0 to 5 stars, patrol cruisers that
// cruise the grid when all is calm, chase units that route through the road graph and ram,
// roadblocks on the district bridges at 4 stars, gunfire at 5, the BUSTED pin rule, and -
// from 4 stars up - the ABPD helicopter: it circles the player, keeps its searchlight pool
// on them, narrows and flares at 5, and thrumms through the audio synth.
import { HEAT, LANE_OFF } from './config.js';
import { createVehicle, stepVehiclePhysics } from './vehicle.js';

const ROADBLOCK_SPOTS = [
  { x: 1460, y: 1100, horiz: true },
  { x: 1980, y: 1100, horiz: true },
  { x: 1200, y: 620, horiz: false },
  { x: 940, y: 1340, horiz: false },
  { x: 2500, y: 1340, horiz: false },
];

export function createPolice(city, rng) {
  const cops = [];
  let wanted = 0;
  let heatTimer = -999;
  let decayT = 0;
  let pinT = 0;
  let blocked = [];
  let nextCopId = 0;
  // the helicopter: kinematic, never collides, purely an air-support presence
  const heli = { active: false, x: 0, y: 0, angle: 0, radius: 210 };
  let heliFlareT = 0;

  function spawnCop(x, y, angle) {
    const car = createVehicle('cop', x, y, angle);
    car.route = null;
    car.mode = 'patrol';
    car.shootT = rng.range(0.6, 1.6);
    car.side = rng.chance(0.5) ? 1 : -1;
    car.id = nextCopId++;
    cops.push(car);
    return car;
  }

  // Two cruisers start on patrol routes near the center of town.
  spawnCop(1200, 620 + LANE_OFF, 0);
  spawnCop(1460, 1100 - LANE_OFF, Math.PI);

  /** Position a cop on its current route edge (kinematic, lane-offset). */
  function routePosition(car) {
    const e = car.route.edge;
    const along = e.len * car.route.t;
    const sx = e.x1 + e.ux * along;
    const sy = e.y1 + e.uy * along;
    const side = car.route.dir === 0 ? 1 : -1;
    return { x: sx - e.uy * LANE_OFF * side, y: sy + e.ux * LANE_OFF * side };
  }

  /** A fresh graph route for a cop heading to the node nearest (x, y). */
  function routeTo(car, x, y, game) {
    const start = car.route ? (car.route.dir === 0 ? car.route.edge.b : car.route.edge.a) : game.city.graph.nearestNode(car.x, car.y);
    const goal = game.city.graph.nearestNode(x, y);
    if (start === goal) return null;
    const path = game.city.graph.findPath(start, goal);
    if (!path || path.length === 0) return null;
    car.route = { edge: path[0], t: 0.02, dir: path[0].a === start ? 0 : 1, path, pi: 1 };
    return car.route;
  }

  function addHeat(v) {
    const before = wanted;
    wanted = Math.min(5, wanted + v);
    heatTimer = 0; // reset decay when a fresh offense lands (game.time passed via update)
    if (wanted > before) return wanted;
    return wanted;
  }

  return {
    cops,
    get wanted() { return wanted; },
    get heli() { return heli; },
    setWanted(v) { wanted = Math.max(0, Math.min(5, v)); },
    get heatTimer() { return heatTimer; },
    set heatTimer(v) { heatTimer = v; },
    get pinT() { return pinT; },
    set pinT(v) { pinT = v; },
    addHeat,
    forceHeat(v, game) {
      wanted = Math.max(0, Math.min(5, v));
      heatTimer = 0;
      if (wanted >= 3) this.spawnExtra(game);
      if (wanted >= 4) this.spawnRoadblocks(game);
      game.effects.banner(`WANTED ${wanted} STARS`, wanted >= 3 ? 'ABPD is on you' : '', '#e8554a');
      game.effects.flash('#e8554a', 0.5);
      game.audio.heatUp();
    },
    /** Heat from an offense: cap, flash the stars, escalate response. */
    addHeatEvent(v, game) {
      const before = wanted;
      wanted = Math.min(5, wanted + v);
      heatTimer = 0;
      if (wanted > before) {
        game.effects.banner('WANTED LEVEL UP', `${wanted} star${wanted > 1 ? 's' : ''}`, '#e8554a');
        game.effects.flash('#e8554a', 0.45);
        game.audio.heatUp();
        if (wanted >= 3) this.spawnExtra(game);
        if (wanted >= 4) this.spawnRoadblocks(game);
      }
    },

    spawnExtra(game) {
      if (cops.length >= 4) return;
      const p = game.player.inCar ?? game.player;
      let best = null;
      let bd = Infinity;
      for (const n of game.city.graph.nodes) {
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d > 450 && d < 950 && d < bd) { bd = d; best = n; }
      }
      if (!best) return;
      spawnCop(best.x, best.y + LANE_OFF, 0);
    },

    spawnRoadblocks(game) {
      for (const b of blocked) game.cars.splice(game.cars.indexOf(b), 1);
      blocked = [];
      const p = game.player.inCar ?? game.player;
      const spots = ROADBLOCK_SPOTS.slice().sort((a, b2) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b2.x - p.x, b2.y - p.y)).slice(0, 3);
      for (const s of spots) {
        const c1 = createVehicle('cop', s.horiz ? s.x : s.x - LANE_OFF, s.horiz ? s.y - LANE_OFF : s.y, s.horiz ? Math.PI / 2 : 0);
        const c2 = createVehicle('cop', s.horiz ? s.x : s.x + LANE_OFF, s.horiz ? s.y + LANE_OFF : s.y, s.horiz ? Math.PI / 2 : 0);
        c1.mode = 'block';
        c2.mode = 'block';
        c1.route = null;
        c2.route = null;
        blocked.push(c1, c2);
        game.cars.push(c1, c2);
      }
    },

    clearRoadblocks(game) {
      for (const b of blocked) {
        const i = game.cars.indexOf(b);
        if (i >= 0) game.cars.splice(i, 1);
      }
      blocked = [];
    },

    wreckCop(car, game) {
      car.wrecked = true;
      this.addHeatEvent(HEAT.killCop, game);
      game.effects.impact(car.x, car.y, '#ffb84d', 16);
      game.effects.addShake(5);
    },

    update(dt, game) {
      const player = game.player;
      const pcar = player.inCar;
      const px = pcar ? pcar.x : player.x;
      const py = pcar ? pcar.y : player.y;
      // decay after a quiet spell
      heatTimer += dt;
      if (wanted > 0 && heatTimer > HEAT.decayDelay) {
        decayT += dt;
        if (decayT >= HEAT.decayEvery) {
          decayT = 0;
          wanted -= 1;
          if (wanted === 0) {
            this.clearRoadblocks(game);
            game.effects.popupSmall(['You lost the cops.']);
          }
        }
      } else decayT = 0;

      const chasers = wanted >= 1 ? Math.min(cops.length, wanted >= 5 ? 4 : wanted >= 3 ? 2 : 1) : 0;
      let chasingAny = false;
      let pin = false;

      for (let i = 0; i < cops.length; i++) {
        const car = cops[i];
        if (car.wrecked) continue;
        const isChaser = i < chasers || car.mode === 'chase';
        const dPlayer = Math.hypot(px - car.x, py - car.y);

        if (car.mode === 'block') {
          // roadblocks hold the road; a ram shoves them, physics settles it
          car.throttle = 0;
          car.steer = 0;
          car.speed = 0;
          stepVehiclePhysics(car, dt, game);
          continue;
        }

        if (isChaser && wanted > 0) {
          car.mode = 'chase';
          chasingAny = true;
          const speed = Math.hypot(car.vx, car.vy);
          const target = game.city.graph.nearestNode(px, py);
          // refresh the route every so often as the player moves
          if (!car.route || car.routeT === undefined || car.routeT <= 0 || (car.routePi !== target)) {
            routeTo(car, px, py, game);
            car.routeT = 1.4;
            car.routePi = target;
          }
          car.routeT -= dt;
          if (car.route && dPlayer > 230) {
            // follow the graph, fast
            const e = car.route.edge;
            const chaseSpeed = Math.min(370, speed + 320 * dt);
            car.speed = chaseSpeed;
            car.route.t += (chaseSpeed * dt) / e.len;
            if (car.route.t >= 1) {
              const path = car.route.path;
              if (path && car.route.pi < path.length) {
                const next = path[car.route.pi++];
                const node = car.route.dir === 0 ? e.b : e.a;
                car.route.edge = next;
                car.route.t = 0.02;
                car.route.dir = next.a === node ? 0 : 1;
              } else {
                car.route = null;
              }
            }
            const np = routePosition(car);
            car.vx = (np.x - car.x) / Math.max(dt, 1e-4);
            car.vy = (np.y - car.y) / Math.max(dt, 1e-4);
            car.angle = Math.atan2(car.route.dir === 0 ? e.uy : -e.uy, car.route.dir === 0 ? e.ux : -e.ux);
            car.x = np.x;
            car.y = np.y;
          } else {
            // close enough: drive straight at the player
            car.route = null;
            const want = Math.atan2(py - car.y, px - car.x);
            let diff = want - car.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            car.steer = Math.max(-1, Math.min(1, diff * 2.2));
            car.throttle = 1;
            stepVehiclePhysics(car, dt, game);
          }
          // the pin: contact at low speed for three seconds at 2+ stars
          const contact = pcar && Math.hypot(pcar.x - car.x, pcar.y - car.y) < 52 && Math.abs(pcar.speed) < 60;
          const footPin = !pcar && dPlayer < 46;
          if ((contact || footPin) && wanted >= 2) pin = true;
          // at 5 stars the units open fire
          if (wanted >= 5) {
            car.shootT -= dt;
            if (car.shootT <= 0) {
              car.shootT = 1.35;
              const a = Math.atan2(py - car.y, px - car.x) + rng.range(-0.16, 0.16);
              game.bullets.push({ x: car.x + Math.cos(a) * 20, y: car.y + Math.sin(a) * 20, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, ttl: 1.4, from: 'cop' });
              game.effects.muzzle(car.x + Math.cos(a) * 22, car.y + Math.sin(a) * 22, a);
              game.audio.gunshot();
            }
          }
        } else {
          // patrol: cruise the grid at a calm clip
          car.mode = 'patrol';
          const speed = Math.hypot(car.vx, car.vy);
          if (!car.route) {
            const start = game.city.graph.nearestNode(car.x, car.y);
            const choices = game.city.graph.nodes[start].edges;
            const pick = rng.pick(choices);
            const e = game.city.graph.edges[pick];
            car.route = { edge: e, t: 0.02, dir: e.a === start ? 0 : 1, path: null, pi: 0 };
          }
          const e = car.route.edge;
          const patrolSpeed = Math.min(95, speed + 120 * dt);
          car.speed = patrolSpeed;
          car.route.t += (patrolSpeed * dt) / e.len;
          if (car.route.t >= 1) {
            const node = car.route.dir === 0 ? e.b : e.a;
            const options = game.city.graph.nodes[node].edges.filter((id) => id !== car.route.edge);
            const nextId = options.length > 0 ? rng.pick(options) : car.route.edge;
            const next = game.city.graph.edges[nextId];
            car.route.edge = next;
            car.route.t = 0.02;
            car.route.dir = next.a === node ? 0 : 1;
          }
          const np = routePosition(car);
          car.vx = (np.x - car.x) / Math.max(dt, 1e-4);
          car.vy = (np.y - car.y) / Math.max(dt, 1e-4);
          car.angle = Math.atan2(car.route.dir === 0 ? e.uy : -e.uy, car.route.dir === 0 ? e.ux : -e.ux);
          car.x = np.x;
          car.y = np.y;
        }
      }

      game.audio.siren(chasingAny, wanted >= 3);
      game.audio.heliThrum(heli.active);
      this.updateHeli(dt, game);
      pinT = pin ? pinT + dt : 0;
      if (pinT > 3) {
        pinT = 0;
        game.onPlayerBusted();
      }
    },

    /** The air unit: spawns at 4 stars, circles the player, tightens and flares at 5. */
    updateHeli(dt, game) {
      const p = game.player.inCar ?? game.player;
      if (wanted >= 4) {
        if (!heli.active) {
          heli.active = true;
          heli.angle = 0;
          heli.radius = wanted >= 5 ? 170 : 210;
          heli.x = p.x + heli.radius;
          heli.y = p.y;
          heliFlareT = wanted >= 5 ? 0.6 : 999; // at 5 stars the first flare comes quickly
        }
        // at 5 stars the orbit is faster and tighter, the searchlight narrows
        const spin = wanted >= 5 ? 0.9 : 0.55;
        heli.radius = wanted >= 5 ? 170 : 210;
        heli.angle += spin * dt;
        heli.x = p.x + Math.cos(heli.angle) * heli.radius;
        heli.y = p.y + Math.sin(heli.angle) * heli.radius;
        if (wanted >= 5) {
          heliFlareT -= dt;
          if (heliFlareT <= 0) {
            heliFlareT = 2.4;
            game.effects.flare(heli.x + rng.range(-14, 14), heli.y + rng.range(6, 16));
          }
        }
      } else if (heli.active) {
        heli.active = false;
        heliFlareT = 0;
      }
    },

    /** World-space searchlight pool, drawn under the entities (the light hits the street). */
    drawSearchlight(ctx, game) {
      if (!heli.active) return;
      const p = game.player.inCar ?? game.player;
      const narrow = wanted >= 5;
      const rx = narrow ? 85 : 150;
      const ry = narrow ? 150 : 245;
      ctx.save();
      ctx.translate(p.x, p.y);
      const a = Math.atan2(heli.y - p.y, heli.x - p.x);
      ctx.rotate(a + Math.PI / 2);
      const g = ctx.createRadialGradient(0, 0, 6, 0, 0, ry);
      g.addColorStop(0, 'rgba(255,246,190,0.36)');
      g.addColorStop(0.6, 'rgba(255,236,160,0.15)');
      g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,244,200,0.28)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    },

    /** The helicopter itself: rotor blur, fuselage, tail boom, blinking nav lights. */
    drawHeli(ctx, time) {
      if (!heli.active) return;
      ctx.save();
      ctx.translate(heli.x, heli.y);
      // spinning rotor: two crossing blur lines
      const spin = time * 26;
      ctx.strokeStyle = 'rgba(205,214,224,0.55)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let k = 0; k < 2; k++) {
        const a = spin + (k * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * 36, -Math.sin(a) * 36);
        ctx.lineTo(Math.cos(a) * 36, Math.sin(a) * 36);
        ctx.stroke();
      }
      // shadow on the ground below
      ctx.fillStyle = 'rgba(20,16,10,0.22)';
      ctx.beginPath();
      ctx.ellipse(4, 30, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // fuselage
      ctx.fillStyle = '#39424e';
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(12,14,16,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // cockpit glass
      ctx.fillStyle = '#9fd4e8';
      ctx.beginPath();
      ctx.ellipse(5, -1, 5, 3.4, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // tail boom + tail rotor
      ctx.fillStyle = '#39424e';
      ctx.fillRect(13, -1.5, 12, 3);
      ctx.strokeStyle = 'rgba(205,214,224,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(26, 1.5);
      ctx.lineTo(26, -5);
      ctx.stroke();
      // blinking nav lights: red port, green starboard
      const blink = Math.sin(time * 6) > 0;
      ctx.fillStyle = blink ? '#ff3b30' : 'rgba(255,59,48,0.25)';
      ctx.beginPath();
      ctx.arc(-8, 0, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = blink ? 'rgba(50,220,90,0.25)' : '#32dc5a';
      ctx.beginPath();
      ctx.arc(24, -1, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    /** Cops chasing right now, for the minimap and shots. */
    chasers(game) {
      return cops.filter((c) => c.mode === 'chase' && !c.wrecked);
    },
  };
}
