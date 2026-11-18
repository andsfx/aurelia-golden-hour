// Traffic: ~16 cars that drive the road graph, keep to the right lane, brake behind obstacles
// (the player's car, other cars, a pedestrian in the road) and honk when blocked. They pick a
// new direction at each intersection and never leave the road network.
import { CAR_COLORS, LANE_OFF } from './config.js';
import { createVehicle, stepVehiclePhysics } from './vehicle.js';

export function createTraffic(city, rng, count) {
  const cars = [];
  const kinds = ['sedan', 'sedan', 'sedan', 'sedan', 'van', 'van', 'voyager', 'sedan', 'van', 'sedan'];
  for (let k = 0; k < count; k++) {
    const edge = city.graph.edges[rng.int(0, city.graph.edges.length - 1)];
    const dir = rng.chance(0.5) ? 0 : 1;
    const car = createVehicle(kinds[k % kinds.length], 0, 0, 0, CAR_COLORS[rng.int(0, CAR_COLORS.length - 1)]);
    car.route = { edge, t: rng.range(0.05, 0.95), dir, speed: 0, target: 105 + rng.range(0, 40), honkCd: 0 };
    car.kinematic = true;
    cars.push(car);
  }

  function routePosition(car) {
    const e = car.route.edge;
    const along = e.len * car.route.t;
    const sx = e.x1 + e.ux * along;
    const sy = e.y1 + e.uy * along;
    // right-hand traffic: every car hugs the lane on its right of travel (LANE_OFF px off
    // the center line), flipped per direction, so opposing traffic never head-ons.
    const side = car.route.dir === 0 ? 1 : -1;
    const px = -e.uy * LANE_OFF * side;
    const py = e.ux * LANE_OFF * side;
    return { x: sx + px, y: sy + py };
  }

  function update(dt, game) {
    for (const car of cars) {
      const route = car.route;
      // obstacle look-ahead: brake behind anything in the lane ahead
      const pos = routePosition(car);
      const e = route.edge;
      const dirSign = route.dir === 0 ? 1 : -1;
      const ux = e.ux * dirSign;
      const uy = e.uy * dirSign;
      const speed = Math.hypot(car.vx, car.vy);
      const brakeDist = 46 + speed * 0.5;
      let blocked = false;
      for (const o of game.cars) {
        if (o === car) continue;
        const rx = o.x - pos.x;
        const ry = o.y - pos.y;
        const along = rx * ux + ry * uy;
        const perp = Math.abs(rx * -uy + ry * ux);
        if (along > 0 && along < brakeDist && perp < 26) {
          blocked = true;
          if (route.honkCd <= 0 && along < 60 && (o.driver === game.player || o.kind === 'cop')) {
            route.honkCd = 1.6;
            car.honkT = 0.4;
            game.audio.horn();
          }
        }
      }
      // a pedestrian standing in the road also stops a driver
      for (const pd of game.peds) {
        if (pd.dead) continue;
        const rx = pd.x - pos.x;
        const ry = pd.y - pos.y;
        const along = rx * ux + ry * uy;
        const perp = Math.abs(rx * -uy + ry * ux);
        if (along > 0 && along < brakeDist && perp < 18) {
          blocked = true;
          if (route.honkCd <= 0 && along < 70) {
            route.honkCd = 2;
            car.honkT = 0.5;
            game.audio.horn();
          }
        }
      }
      route.honkCd -= dt;
      const want = blocked ? 0 : route.target;
      route.speed += Math.max(-260 * dt, Math.min(260 * dt, want - route.speed));
      route.t += (route.speed * dt) / e.len;
      // at an intersection, choose the next road (never a U-turn when there is a choice)
      if (route.t >= 1) {
        const node = route.dir === 0 ? e.b : e.a;
        const nodeObj = game.city.graph.nodes[node];
        const options = nodeObj.edges.filter((id) => id !== route.edge);
        const nextId = options.length > 0 ? rng.pick(options) : route.edge;
        const next = game.city.graph.edges[nextId];
        route.edge = next;
        route.t = 0.02;
        route.dir = next.a === node ? 0 : 1;
      }
      const np = routePosition(car);
      car.speed = route.speed;
      car.vx = (np.x - car.x) / Math.max(dt, 1e-4);
      car.vy = (np.y - car.y) / Math.max(dt, 1e-4);
      car.angle = Math.atan2(route.dir === 0 ? e.uy : -e.uy, route.dir === 0 ? e.ux : -e.ux);
      car.x = np.x;
      car.y = np.y;
      car.throttle = 0;
      car.steer = 0;
      stepVehiclePhysics(car, dt, game);
      // a traffic car shoved off its line rejoins the road next step (route wins)
      const fix = routePosition(car);
      car.x = fix.x;
      car.y = fix.y;
    }
  }

  return { cars, update };
}
