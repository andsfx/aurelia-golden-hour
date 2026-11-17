// The city of Aurelia Bay: a seeded grid of roads and blocks, four districts with their own
// palettes, cached per-block building facades, the park, the market square, the beach and the
// animated ocean, plus the road graph that traffic, police and the minimap all ride on.
import { BEACH_TOP, BRIDGE_ZONE, DOWNTOWN, H_ROADS, JEWELRY, LANE_OFF, MARKET, MARINA, OCEAN_Y, OLD_HARBOR, PALETTES, PARK, PIER_END, PIERS, ROAD_EDGE, ROAD_W, SAFEHOUSE, SIDEWALK_W, V_ROADS, WORLD_H, WORLD_W } from './config.js';

const ROAD_ASPHALT = '#2d3137';
const ROAD_EDGE_LINE = '#c8c2b4';
const ROAD_DASH = '#e8c94a';
const SIDEWALK_COLOR = '#c4bda9';
const ZEBRA = '#ded8c8';

function districtOf(cx, cy) {
  if (cx >= PARK.x && cx < PARK.x + PARK.w && cy >= PARK.y && cy < PARK.y + PARK.h) return 'park';
  if (cx >= MARKET.x && cx < MARKET.x + MARKET.w && cy >= MARKET.y && cy < MARKET.y + MARKET.h) return 'market';
  if (cx < DOWNTOWN.w && cy < DOWNTOWN.h) return 'downtown';
  if (cx >= OLD_HARBOR.x && cy >= OLD_HARBOR.y) return 'harbor';
  if (cx >= MARINA.x && cy >= MARINA.y) return 'marina';
  return 'downtown';
}

/** A rounded rect path; r = corner radius. */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createCity(rng) {
  // ---- blocks: every cell between roads, with its district and (later) a cached facade ----
  const blocks = [];
  for (let iy = 0; iy < H_ROADS.length - 1; iy++) {
    const y0 = H_ROADS[iy] + ROAD_EDGE;
    const y1 = H_ROADS[iy + 1] - ROAD_EDGE;
    for (let ix = 0; ix < V_ROADS.length - 2; ix++) {
      const x0 = V_ROADS[ix] + ROAD_EDGE;
      const x1 = V_ROADS[ix + 1] - ROAD_EDGE;
      if (x1 - x0 < 60) continue;
      const block = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, district: districtOf(x0 + (x1 - x0) / 2, y0 + (y1 - y0) / 2), buildings: [], canvas: null };
      blocks.push(block);
    }
  }

  const solids = [];
  const pushSolid = (x, y, w, h) => { solids.push({ x, y, w, h }); };

  // ---- building generation per district ----
  for (const block of blocks) {
    if (block.district === 'park' || block.district === 'market') continue;
    const d = block.district;
    if (d === 'downtown') {
      const cols = block.w > 260 ? 2 : 1;
      const rows = block.h > 200 ? 2 : 1;
      const cw = block.w / cols;
      const ch = block.h / rows;
      for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
        const inset = rng.int(8, 13);
        const b = { x: block.x + cx * cw + inset, y: block.y + cy * ch + inset, w: cw - inset * 2, h: ch - inset * 2, color: rng.pick(PALETTES.downtown.glass), big: true };
        block.buildings.push(b);
        pushSolid(b.x, b.y, b.w, b.h);
      }
    } else if (d === 'harbor') {
      const cols = rng.int(2, 3);
      const rows = rng.int(2, 3);
      const cw = block.w / cols;
      const ch = block.h / rows;
      for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
        if (rng.chance(0.18)) continue; // a courtyard: the market feel of the old town
        const b = { x: block.x + cx * cw + 5, y: block.y + cy * ch + 5, w: cw - 10, h: ch - 10, color: rng.pick(PALETTES.harbor.wall), roof: rng.pick(PALETTES.harbor.roof) };
        block.buildings.push(b);
        pushSolid(b.x, b.y, b.w, b.h);
      }
    } else {
      const split = rng.chance(0.45) && block.w > 220;
      const n = split ? 2 : 1;
      const cw = block.w / n;
      for (let k = 0; k < n; k++) {
        const b = { x: block.x + k * cw + 6, y: block.y + 6, w: cw - 12, h: block.h - 12, color: rng.pick(PALETTES.marina.wall) };
        block.buildings.push(b);
        pushSolid(b.x, b.y, b.w, b.h);
      }
    }
  }
  pushSolid(SAFEHOUSE.x, SAFEHOUSE.y, SAFEHOUSE.w, SAFEHOUSE.h);
  pushSolid(JEWELRY.x, JEWELRY.y, JEWELRY.w, JEWELRY.h);

  // ---- per-block cached facades (drawn once, blitted forever) ----
  for (const block of blocks) {
    if (block.district === 'park' || block.district === 'market') continue;
    const c = document.createElement('canvas');
    c.width = Math.ceil(block.w);
    c.height = Math.ceil(block.h);
    const g = c.getContext('2d');
    g.translate(-block.x, -block.y);
    const pal = PALETTES[block.district];
    g.fillStyle = pal.block;
    g.fillRect(block.x, block.y, block.w, block.h);
    for (const b of block.buildings) {
      // Golden-hour shadow to the southeast, then the building on top.
      g.fillStyle = 'rgba(40,30,20,0.28)';
      g.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      if (b.big) {
        g.fillStyle = b.color;
        g.fillRect(b.x, b.y, b.w, b.h);
        // glass window grid, some lit
        const cols = Math.floor((b.w - 12) / 11);
        const rows = Math.floor((b.h - 12) / 11);
        for (let ry = 0; ry < rows; ry++) for (let rx = 0; rx < cols; rx++) {
          const lit = rng.chance(0.32);
          g.fillStyle = lit ? '#f2d377' : 'rgba(20,34,44,0.75)';
          g.fillRect(b.x + 8 + rx * 11, b.y + 8 + ry * 11, 6, 5);
        }
        g.strokeStyle = 'rgba(255,255,255,0.25)';
        g.lineWidth = 2;
        g.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
        // rooftop clutter: AC units and a vent
        g.fillStyle = 'rgba(30,36,42,0.9)';
        g.fillRect(b.x + b.w * 0.22, b.y + b.h * 0.2, 14, 10);
        g.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.55, 16, 11);
        g.fillRect(b.x + b.w * 0.4, b.y + b.h * 0.75, 10, 10);
      } else if (b.roof !== undefined) {
        g.fillStyle = b.color;
        g.fillRect(b.x, b.y, b.w, b.h);
        g.fillStyle = b.roof;
        g.fillRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
        g.strokeStyle = 'rgba(90,40,20,0.35)';
        g.lineWidth = 1;
        for (let ry = b.y + 14; ry < b.y + b.h - 8; ry += 9) {
          g.beginPath();
          g.moveTo(b.x + 8, ry);
          g.lineTo(b.x + b.w - 8, ry);
          g.stroke();
        }
        g.fillStyle = 'rgba(120,70,40,0.8)';
        g.fillRect(b.x + b.w * 0.7, b.y + 3, 8, 8);
      } else {
        g.fillStyle = b.color;
        g.fillRect(b.x, b.y, b.w, b.h);
        g.fillStyle = PALETTES.marina.roof;
        g.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
        g.strokeStyle = 'rgba(255,255,255,0.18)';
        g.lineWidth = 2;
        for (let ry = b.y + 20; ry < b.y + b.h - 12; ry += 22) {
          g.beginPath();
          g.moveTo(b.x + 10, ry);
          g.lineTo(b.x + b.w - 10, ry);
          g.stroke();
        }
      }
    }
    block.canvas = c;
  }

  // ---- furniture: lamps, palms, hydrants, bus stops, benches, market stalls ----
  const lamps = [];
  const palms = [];
  const hydrants = [];
  const stops = [];
  const stalls = [];
  const benches = [];
  const umbrellas = [];

  const sidewalkY = ROAD_W / 2 + SIDEWALK_W / 2; // 34: sidewalk center line
  for (const ry of H_ROADS) {
    for (let x = 60; x < WORLD_W - 40; x += 260) {
      lamps.push({ x: x + rng.int(-24, 24), y: ry + (Math.floor(x / 260) % 2 === 0 ? -sidewalkY : sidewalkY) });
    }
  }
  for (const rx of V_ROADS) {
    for (let y = 60; y < BEACH_TOP - 30; y += 260) {
      lamps.push({ x: rx + (Math.floor(y / 260) % 2 === 0 ? sidewalkY : -sidewalkY), y: y + rng.int(-24, 24) });
    }
  }
  // Palm-lined promenade (Palmer Beach) plus scattered palms around town.
  for (let x = 80; x < WORLD_W - 40; x += 150) {
    palms.push({ x: x + rng.int(-14, 14), y: 1820 - sidewalkY + 2, s: rng.range(0.8, 1.15) });
    if (x % 300 < 150) palms.push({ x: x + rng.int(-20, 20), y: 1820 + sidewalkY - 2, s: rng.range(0.8, 1.15) });
  }
  for (let k = 0; k < 14; k++) {
    const x = rng.range(300, WORLD_W - 300);
    const y = rng.range(200, 1560);
    if (districtOf(x, y) !== 'downtown' && districtOf(x, y) !== 'harbor') continue;
    palms.push({ x, y, s: rng.range(0.8, 1.2) });
  }
  for (let k = 0; k < 16; k++) {
    const ix = rng.int(0, V_ROADS.length - 1);
    const iy = rng.int(0, H_ROADS.length - 1);
    hydrants.push({ x: V_ROADS[ix] + (rng.chance(0.5) ? ROAD_W / 2 + 10 : -ROAD_W / 2 - 10), y: H_ROADS[iy] + (rng.chance(0.5) ? ROAD_W / 2 + 10 : -ROAD_W / 2 - 10) });
  }
  const stopSpots = [[760, 220], [1300, 580], [2320, 700], [2700, 1220], [1150, 1500], [540, 1000]];
  for (const [sx, sy] of stopSpots) stops.push({ x: sx, y: sy });

  // Market stalls in the square, two rows with a walking lane; the store sits at its corner.
  const stallRow = (xs, y) => {
    for (const x of xs) {
      stalls.push({ x, y, w: 84, h: 46, stripe: rng.pick(['#d0553f', '#2f7d8c', '#d9a13b']) });
    }
  };
  stallRow([2160, 2300], 1658);
  stallRow([2040, 2170, 2300], 1730);

  for (let k = 0; k < 6; k++) benches.push({ x: rng.range(PARK.x + 60, PARK.x + PARK.w - 60), y: rng.range(PARK.y + 40, PARK.y + PARK.h - 40) });
  for (let k = 0; k < 9; k++) umbrellas.push({ x: rng.range(120, WORLD_W - 120), y: rng.range(1888, 2000), c: rng.pick(['#d0553f', '#2f7d8c', '#e8c94a', '#e8e4d8']) });

  // ---- park features (drawn live) ----
  const pond = { x: 1560, y: 1050, rx: 130, ry: 66 };
  const trees = [];
  for (let k = 0; k < 30; k++) {
    let x = 0, y = 0;
    do { x = rng.range(PARK.x + 30, PARK.x + PARK.w - 30); y = rng.range(PARK.y + 24, PARK.y + PARK.h - 24); } while ((x - pond.x) ** 2 / pond.rx ** 2 + (y - pond.y) ** 2 / pond.ry ** 2 < 1.3);
    trees.push({ x, y, r: rng.range(9, 15) });
  }

  // ---- parked cars ----
  const parked = [];
  for (const block of blocks) {
    if (block.district === 'downtown' || block.district === 'marina') {
      if (rng.chance(0.5)) {
        parked.push({ x: block.x + rng.range(20, block.w - 20), y: block.y + block.h - 8, angle: Math.PI / 2, color: rng.pick(['#d9a13b', '#4f8fb0', '#c23326', '#8e6bb8', '#d8d2c0', '#7d8fa3']) });
      }
    }
    if (block.district === 'harbor' && rng.chance(0.4)) {
      parked.push({ x: block.x + block.w - 8, y: block.y + rng.range(20, block.h - 20), angle: 0, color: rng.pick(['#b98a2e', '#6d7f5c', '#a8b6c4', '#e0552c']) });
    }
  }

  // ---- road graph: intersections and the segments between them ----
  const nodes = [];
  const edges = [];
  const nodeIndex = (ix, iy) => iy * V_ROADS.length + ix;
  for (let iy = 0; iy < H_ROADS.length; iy++) {
    for (let ix = 0; ix < V_ROADS.length; ix++) {
      nodes.push({ x: V_ROADS[ix], y: H_ROADS[iy], edges: [] });
    }
  }
  const addEdge = (a, b) => {
    const A = nodes[a];
    const B = nodes[b];
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy);
    const edge = { a, b, x1: A.x, y1: A.y, x2: B.x, y2: B.y, len, horiz: dy === 0, ux: dx / len, uy: dy / len };
    const id = edges.length;
    edges.push(edge);
    A.edges.push(id);
    B.edges.push(id);
  };
  for (let iy = 0; iy < H_ROADS.length; iy++) {
    for (let ix = 0; ix < V_ROADS.length - 1; ix++) addEdge(nodeIndex(ix, iy), nodeIndex(ix + 1, iy));
  }
  for (let ix = 0; ix < V_ROADS.length; ix++) {
    for (let iy = 0; iy < H_ROADS.length - 1; iy++) addEdge(nodeIndex(ix, iy), nodeIndex(ix, iy + 1));
  }

  const nearestNode = (x, y) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const d = (nodes[i].x - x) ** 2 + (nodes[i].y - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  /** BFS over the graph: edge ids to follow from node `from` to node `to` (null when unreachable). */
  const findPath = (from, to) => {
    const prev = new Array(nodes.length).fill(-1);
    const seen = new Array(nodes.length).fill(false);
    const queue = [from];
    seen[from] = true;
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur === to) break;
      for (const eid of nodes[cur].edges) {
        const e = edges[eid];
        const other = e.a === cur ? e.b : e.a;
        if (seen[other]) continue;
        seen[other] = true;
        prev[other] = cur;
        queue.push(other);
      }
    }
    if (!seen[to]) return null;
    const path = [];
    let cur = to;
    while (cur !== from) {
      const p = prev[cur];
      path.unshift(edges.find((e) => (e.a === p && e.b === cur) || (e.a === cur && e.b === p)));
      cur = p;
    }
    return path;
  };

  // ---- sidewalk waypoints for pedestrians ----
  const walkpoints = [];
  for (const ry of H_ROADS) for (let x = 70; x < WORLD_W - 50; x += 110) {
    walkpoints.push({ x, y: ry - sidewalkY });
    walkpoints.push({ x, y: ry + sidewalkY });
  }
  for (const rx of V_ROADS) for (let y = 70; y < BEACH_TOP - 20; y += 110) {
    walkpoints.push({ x: rx - sidewalkY, y });
    walkpoints.push({ x: rx + sidewalkY, y });
  }

  // ---- movement rules ----
  const onPier = (x) => PIERS.some((p) => x >= p.x && x <= p.x + p.w);
  const insideSolid = (x, y, r) => {
    for (const s of solids) {
      if (x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h) return true;
    }
    return false;
  };
  const canWalk = (x, y, r) => {
    if (x < r || x > WORLD_W - r || y < r) return false;
    if (y > OCEAN_Y && !(onPier(x) && y < PIER_END)) return false;
    if (y > PIER_END) return false;
    return !insideSolid(x, y, r);
  };
  const canDrive = (x, y, r) => {
    if (x < r + 4 || x > WORLD_W - r - 4 || y < r + 4) return false;
    if (y > OCEAN_Y && !(onPier(x) && y < PIER_END)) return false;
    if (y > PIER_END) return false;
    return !insideSolid(x, y, r);
  };

  return {
    blocks, solids, lamps, palms, hydrants, stops, stalls, benches, umbrellas, parked, pond, trees,
    graph: { nodes, edges, nearestNode, findPath },
    walkpoints,
    jewelryDoor: { x: JEWELRY.x + 10, y: JEWELRY.y + JEWELRY.h - 2, w: JEWELRY.w - 20, h: 28 },
    canWalk, canDrive,
    isPark: (x, y) => x >= PARK.x && x < PARK.x + PARK.w && y >= PARK.y && y < PARK.y + PARK.h,
  };
}

// ---------------------------------------------------------------- drawing helpers

/** One vehicle body, code-drawn: wheels, shell, glass, lights. Shared by every car module. */
export function drawCarBody(ctx, kind, color, angle) {
  const W = kind === 'van' ? 50 : kind === 'voyager' ? 48 : 46;
  const H = kind === 'van' ? 24 : 22;
  ctx.save();
  ctx.translate(0, 0);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(20,16,12,0.35)';
  ctx.fillRect(-W / 2 + 3, -H / 2 + 4, W, H);
  // wheels
  ctx.fillStyle = '#1c1e22';
  ctx.fillRect(-W / 2 + 4, -H / 2 - 3, 10, 5);
  ctx.fillRect(W / 2 - 14, -H / 2 - 3, 10, 5);
  ctx.fillRect(-W / 2 + 4, H / 2 - 2, 10, 5);
  ctx.fillRect(W / 2 - 14, H / 2 - 2, 10, 5);
  // body
  roundRect(ctx, -W / 2, -H / 2, W, H, 6);
  ctx.fillStyle = kind === 'cop' ? '#e8e9ee' : color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,22,26,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (kind === 'cop') {
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-W / 2, -H / 2, W, 5);
    ctx.fillRect(-W / 2, H / 2 - 5, W, 5);
    ctx.fillStyle = '#2b5fd0';
    ctx.fillRect(-W / 2 + 2, -H / 2 + 7, W - 4, 3);
  } else if (kind === 'van') {
    ctx.fillStyle = 'rgba(30,34,40,0.35)';
    ctx.fillRect(-W / 2 + 8, -H / 2 + 5, W - 16, H - 10);
  } else {
    // windshield and rear glass
    ctx.fillStyle = 'rgba(24,32,40,0.85)';
    roundRect(ctx, W / 2 - 16, -H / 2 + 4, 11, H - 8, 3);
    ctx.fill();
    roundRect(ctx, -W / 2 + 4, -H / 2 + 4, 9, H - 8, 3);
    ctx.fill();
  }
  // lights
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(W / 2 - 3, -H / 2 + 2, 3, 4);
  ctx.fillRect(W / 2 - 3, H / 2 - 6, 3, 4);
  ctx.fillStyle = '#d04535';
  ctx.fillRect(-W / 2, -H / 2 + 2, 3, 4);
  ctx.fillRect(-W / 2, H / 2 - 6, 3, 4);
  ctx.restore();
}

/** A swaying palm: trunk static, fronds riding a slow sine. */
function drawPalm(ctx, x, y, s, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(30,20,12,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 14 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a6a45';
  ctx.fillRect(-2.4 * s, -10 * s, 4.8 * s, 12 * s);
  const sway = Math.sin(time * 1.3 + x * 0.02) * 0.06;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + sway;
    ctx.save();
    ctx.rotate(a);
    ctx.fillStyle = k % 2 === 0 ? '#3f8a4c' : '#468f54';
    ctx.beginPath();
    ctx.ellipse(13 * s, 0, 13 * s, 3.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#7a5a34';
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.arc(rngish(x + k * 3.7, y + k) * 10 - 5, -4 * s, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// A tiny deterministic hash for palm coconuts so no rng object is needed here.
function rngish(a, b) {
  const t = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return t - Math.floor(t);
}

/** Everything below the entities: ground, roads, facades, park, beach, ocean, piers, furniture. */
export function drawCity(ctx, city, cam, time) {
  const { x0, y0, x1, y1 } = cam;
  // base ground per district
  ctx.fillStyle = PALETTES.downtown.ground;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = PALETTES.marina.ground;
  ctx.fillRect(Math.max(x0, MARINA.x), Math.max(y0, MARINA.y), Math.min(x1, MARINA.x + MARINA.w) - Math.max(x0, MARINA.x), Math.min(y1, OCEAN_Y) - Math.max(y0, MARINA.y));
  ctx.fillStyle = PALETTES.harbor.ground;
  ctx.fillRect(Math.max(x0, OLD_HARBOR.x), Math.max(y0, OLD_HARBOR.y), Math.min(x1, OLD_HARBOR.x + OLD_HARBOR.w) - Math.max(x0, OLD_HARBOR.x), Math.min(y1, OCEAN_Y) - Math.max(y0, OLD_HARBOR.y));

  // beach sand + wet band + ocean
  if (y1 > BEACH_TOP) {
    ctx.fillStyle = PALETTES.beach.sand;
    ctx.fillRect(Math.max(x0, 0), Math.max(y0, BEACH_TOP), Math.min(x1, WORLD_W) - Math.max(x0, 0), Math.min(y1, OCEAN_Y) - Math.max(y0, BEACH_TOP));
    ctx.fillStyle = PALETTES.beach.wet;
    ctx.fillRect(Math.max(x0, 0), Math.max(y0, OCEAN_Y - 34), Math.min(x1, WORLD_W) - Math.max(x0, 0), Math.min(y1, OCEAN_Y) - Math.max(y0, OCEAN_Y - 34));
  }
  if (y1 > OCEAN_Y) {
    const grad = ctx.createLinearGradient(0, OCEAN_Y, 0, WORLD_H);
    grad.addColorStop(0, PALETTES.ocean.near);
    grad.addColorStop(0.35, PALETTES.ocean.mid);
    grad.addColorStop(1, PALETTES.ocean.deep);
    ctx.fillStyle = grad;
    ctx.fillRect(Math.max(x0, 0), Math.max(y0, OCEAN_Y), Math.min(x1, WORLD_W) - Math.max(x0, 0), Math.min(y1, WORLD_H) - Math.max(y0, OCEAN_Y));
    // animated wave lines + glints
    for (let k = 0; k < 5; k++) {
      const wy = OCEAN_Y + 30 + k * 34 + Math.sin(time * 0.9 + k * 1.7) * 5;
      if (wy < y0 || wy > y1) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const xs = Math.max(x0, 0);
      const xe = Math.min(x1, WORLD_W);
      for (let x = xs; x <= xe; x += 26) {
        const yy = wy + Math.sin(x * 0.02 + time * 1.4 + k) * 3;
        if (x === xs) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // shoreline foam
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const fxs = Math.max(x0, 0);
    const fxe = Math.min(x1, WORLD_W);
    for (let x = fxs; x <= fxe; x += 18) {
      const yy = OCEAN_Y + 3 + Math.sin(x * 0.03 + time * 1.9) * 2.5;
      if (x === fxs) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // roads: asphalt, sidewalks, edge lines, dashed center line, crosswalks
  for (const ry of H_ROADS) {
    if (ry + ROAD_W / 2 + SIDEWALK_W < y0 || ry - ROAD_W / 2 - SIDEWALK_W > y1) continue;
    ctx.fillStyle = SIDEWALK_COLOR;
    ctx.fillRect(x0, ry - ROAD_W / 2 - SIDEWALK_W, x1 - x0, ROAD_W + SIDEWALK_W * 2);
    ctx.fillStyle = ROAD_ASPHALT;
    ctx.fillRect(x0, ry - ROAD_W / 2, x1 - x0, ROAD_W);
    ctx.strokeStyle = ROAD_EDGE_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, ry - ROAD_W / 2 + 1);
    ctx.lineTo(x1, ry - ROAD_W / 2 + 1);
    ctx.moveTo(x0, ry + ROAD_W / 2 - 1);
    ctx.lineTo(x1, ry + ROAD_W / 2 - 1);
    ctx.stroke();
    // dashed center line, broken around intersections
    ctx.strokeStyle = ROAD_DASH;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 16]);
    ctx.beginPath();
    let startX = Math.max(x0, 40);
    for (const vx of V_ROADS) {
      const cutA = Math.max(startX, vx - 42);
      const cutB = Math.min(x1, vx + 42);
      if (cutA < cutB) { ctx.moveTo(startX, ry); ctx.lineTo(cutA, ry); startX = cutB; }
      if (startX >= x1) break;
    }
    if (startX < x1) { ctx.moveTo(startX, ry); ctx.lineTo(Math.min(x1, WORLD_W - 40), ry); }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const rx of V_ROADS) {
    if (rx + ROAD_W / 2 + SIDEWALK_W < x0 || rx - ROAD_W / 2 - SIDEWALK_W > x1) continue;
    ctx.fillStyle = SIDEWALK_COLOR;
    ctx.fillRect(rx - ROAD_W / 2 - SIDEWALK_W, y0, ROAD_W + SIDEWALK_W * 2, y1 - y0);
    ctx.fillStyle = ROAD_ASPHALT;
    ctx.fillRect(rx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
    ctx.strokeStyle = ROAD_EDGE_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx - ROAD_W / 2 + 1, y0);
    ctx.lineTo(rx - ROAD_W / 2 + 1, y1);
    ctx.moveTo(rx + ROAD_W / 2 - 1, y0);
    ctx.lineTo(rx + ROAD_W / 2 - 1, y1);
    ctx.stroke();
    ctx.strokeStyle = ROAD_DASH;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 16]);
    ctx.beginPath();
    let startY = Math.max(y0, 40);
    for (const hy of H_ROADS) {
      const cutA = Math.max(startY, hy - 42);
      const cutB = Math.min(y1, hy + 42);
      if (cutA < cutB) { ctx.moveTo(rx, startY); ctx.lineTo(rx, cutA); startY = cutB; }
      if (startY >= y1) break;
    }
    if (startY < y1) { ctx.moveTo(rx, startY); ctx.lineTo(rx, Math.min(y1, BEACH_TOP - 40)); }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // crosswalks at visible intersections
  ctx.fillStyle = ZEBRA;
  for (const ry of H_ROADS) {
    for (const rx of V_ROADS) {
      if (rx < x0 - 50 || rx > x1 + 50 || ry < y0 - 50 || ry > y1 + 30) continue;
      for (let s = -1; s <= 1; s += 2) {
        for (let k = 0; k < 5; k++) {
          ctx.fillRect(rx + s * 46 + k * 5, ry - ROAD_W / 2 + 3, 4.5, ROAD_W - 6);
        }
      }
    }
  }
  for (const rx of V_ROADS) {
    for (const ry of H_ROADS) {
      if (rx < x0 - 50 || rx > x1 + 50 || ry < y0 - 50 || ry > y1 + 30) continue;
      for (let s = -1; s <= 1; s += 2) {
        for (let k = 0; k < 5; k++) {
          ctx.fillRect(rx - ROAD_W / 2 + 3, ry + s * 46 + k * 5, ROAD_W - 6, 4.5);
        }
      }
    }
  }

  // cached block facades
  for (const block of city.blocks) {
    if (!block.canvas) continue;
    if (block.x + block.w < x0 || block.x > x1 || block.y + block.h < y0 || block.y > y1) continue;
    ctx.drawImage(block.canvas, block.x, block.y);
  }

  // the park: grass cells get live features
  for (const block of city.blocks) {
    if (block.district !== 'park') continue;
    ctx.fillStyle = PALETTES.park.ground;
    ctx.fillRect(block.x, block.y, block.w, block.h);
  }
  ctx.fillStyle = PALETTES.park.grass[1];
  ctx.fillRect(Math.max(x0, PARK.x), Math.max(y0, PARK.y), Math.min(x1, PARK.x + PARK.w) - Math.max(x0, PARK.x), Math.min(y1, PARK.y + PARK.h) - Math.max(y0, PARK.y));
  // park paths: two diagonals and a ring around the pond
  ctx.strokeStyle = PALETTES.park.path;
  ctx.lineWidth = 26;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(PARK.x + 20, PARK.y + 20);
  ctx.lineTo(PARK.x + PARK.w - 20, PARK.y + PARK.h - 20);
  ctx.moveTo(PARK.x + PARK.w - 20, PARK.y + 20);
  ctx.lineTo(PARK.x + 20, PARK.y + PARK.h - 20);
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.ellipse(city.pond.x, city.pond.y, city.pond.rx + 16, city.pond.ry + 16, 0, 0, Math.PI * 2);
  ctx.stroke();
  // pond with fountain
  ctx.fillStyle = '#3a7ea8';
  ctx.beginPath();
  ctx.ellipse(city.pond.x, city.pond.y, city.pond.rx, city.pond.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + time * 0.5;
    const rr = city.pond.ry * 0.55 * (0.6 + 0.4 * Math.abs(Math.sin(time * 2 + k)));
    ctx.beginPath();
    ctx.moveTo(city.pond.x + Math.cos(a) * rr, city.pond.y + Math.sin(a) * rr);
    ctx.lineTo(city.pond.x + Math.cos(a) * (rr + 10), city.pond.y + Math.sin(a) * (rr + 10));
    ctx.stroke();
  }
  ctx.fillStyle = '#5b83a6';
  ctx.beginPath();
  ctx.arc(city.pond.x, city.pond.y, 9, 0, Math.PI * 2);
  ctx.fill();
  // park trees
  for (const t of city.trees) {
    ctx.fillStyle = 'rgba(30,26,18,0.25)';
    ctx.beginPath();
    ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.r > 12 ? '#3c7a44' : '#46874e';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const b of city.benches) {
    ctx.fillStyle = '#7c5a34';
    ctx.fillRect(b.x - 16, b.y - 4, 32, 8);
    ctx.fillStyle = '#5a3f24';
    ctx.fillRect(b.x - 14, b.y - 8, 4, 16);
    ctx.fillRect(b.x + 10, b.y - 8, 4, 16);
  }

  // market square: paving, the jewelry store, stalls
  if (x1 > MARKET.x && x0 < MARKET.x + MARKET.w && y1 > MARKET.y && y0 < MARKET.y + MARKET.h) {
    ctx.fillStyle = '#cbb48d';
    ctx.fillRect(Math.max(x0, MARKET.x), Math.max(y0, MARKET.y), Math.min(x1, MARKET.x + MARKET.w) - Math.max(x0, MARKET.x), Math.min(y1, MARKET.y + MARKET.h) - Math.max(y0, MARKET.y));
    // cobble hint
    ctx.strokeStyle = 'rgba(120,95,60,0.25)';
    ctx.lineWidth = 1;
    for (let gx = Math.ceil(x0 / 40) * 40; gx < x1; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, Math.max(y0, MARKET.y)); ctx.lineTo(gx, Math.min(y1, MARKET.y + MARKET.h)); ctx.stroke();
    }
    for (let gy = Math.ceil(y0 / 40) * 40; gy < y1; gy += 40) {
      ctx.beginPath(); ctx.moveTo(Math.max(x0, MARKET.x), gy); ctx.lineTo(Math.min(x1, MARKET.x + MARKET.w), gy); ctx.stroke();
    }
  }
  // jewelry store
  if (x1 > JEWELRY.x - 20 && x0 < JEWELRY.x + JEWELRY.w + 20 && y1 > JEWELRY.y - 20 && y0 < JEWELRY.y + JEWELRY.h + 20) {
    ctx.fillStyle = 'rgba(40,30,20,0.28)';
    ctx.fillRect(JEWELRY.x + 5, JEWELRY.y + 6, JEWELRY.w, JEWELRY.h);
    ctx.fillStyle = '#e8d9b8';
    ctx.fillRect(JEWELRY.x, JEWELRY.y, JEWELRY.w, JEWELRY.h);
    ctx.strokeStyle = '#8a6a45';
    ctx.lineWidth = 3;
    ctx.strokeRect(JEWELRY.x, JEWELRY.y, JEWELRY.w, JEWELRY.h);
    ctx.fillStyle = '#a34a28';
    ctx.fillRect(JEWELRY.x + 4, JEWELRY.y + 4, JEWELRY.w - 8, JEWELRY.h - 8);
    // awning: red-white stripes over the south face
    for (let k = 0; k < 10; k++) {
      ctx.fillStyle = k % 2 === 0 ? '#d0553f' : '#efe6d2';
      ctx.fillRect(JEWELRY.x + 6 + k * 8.4, JEWELRY.y + JEWELRY.h - 14, 8.4, 12);
    }
    ctx.fillStyle = '#f7e9c4';
    ctx.font = 'bold 9px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GOLDEN HOUR JEWELS', JEWELRY.x + JEWELRY.w / 2, JEWELRY.y + 16);
    ctx.fillStyle = '#2f7d8c';
    ctx.fillRect(JEWELRY.x + JEWELRY.w / 2 - 14, JEWELRY.y + 24, 28, 12);
  }
  // market stalls
  for (const s of city.stalls) {
    if (s.x + s.w < x0 || s.x > x1 || s.y < y0 || s.y + s.h > y1) continue;
    ctx.fillStyle = 'rgba(40,30,20,0.2)';
    ctx.fillRect(s.x + 3, s.y + 4, s.w, s.h);
    ctx.fillStyle = '#e8dfc8';
    ctx.fillRect(s.x, s.y + 18, s.w, s.h - 18);
    ctx.fillStyle = '#c9b28f';
    ctx.fillRect(s.x + 6, s.y + 12, s.w - 12, 12);
    for (let k = 0; k < 7; k++) {
      ctx.fillStyle = k % 2 === 0 ? s.stripe : '#efe6d2';
      ctx.fillRect(s.x + 2 + k * 12, s.y - 8, 12, 12);
    }
    ctx.fillStyle = '#8a6a45';
    ctx.fillRect(s.x + 2, s.y - 10, s.w - 4, 4);
    ctx.fillRect(s.x + 8, s.y - 16, 3, 8);
    ctx.fillRect(s.x + s.w - 11, s.y - 16, 3, 8);
    // produce crates
    ctx.fillStyle = '#d9a13b';
    ctx.fillRect(s.x + 8, s.y + 22, 12, 10);
    ctx.fillStyle = '#c23326';
    ctx.fillRect(s.x + 26, s.y + 24, 12, 10);
    ctx.fillStyle = '#6d9e4c';
    ctx.fillRect(s.x + 44, s.y + 22, 12, 10);
  }

  // piers over the ocean
  for (const p of PIERS) {
    if (p.x + p.w < x0 || p.x > x1 || p.y + p.h < y0 || p.y > y1) continue;
    ctx.fillStyle = 'rgba(30,24,16,0.3)';
    ctx.fillRect(p.x + 6, p.y + 8, p.w, p.h);
    ctx.fillStyle = '#b0884f';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#7c5a2c';
    ctx.lineWidth = 2;
    for (let k = 0; k < p.h; k += 22) {
      ctx.beginPath();
      ctx.moveTo(p.x + 2, p.y + k);
      ctx.lineTo(p.x + p.w - 2, p.y + k);
      ctx.stroke();
    }
    ctx.strokeStyle = '#5a3f1e';
    ctx.lineWidth = 4;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
    // moored boats
    const boats = p.x === 670 ? [{ dx: 118, side: 1 }, { dx: 136, side: -1 }] : [{ dx: 124, side: -1 }];
    for (const b of boats) {
      const bx = p.x + b.dx;
      const by = p.y + 60 + (p.x % 200);
      ctx.fillStyle = 'rgba(20,18,14,0.3)';
      ctx.beginPath();
      ctx.ellipse(bx + 3, by + 4, 26, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2efe6';
      ctx.beginPath();
      ctx.ellipse(bx, by, 26, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6a6255';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#d9c08c';
      ctx.fillRect(bx - 8, by - 9, 12, 7);
      ctx.fillStyle = '#2f7d8c';
      ctx.fillRect(bx - 16, by - 4, 8, 8);
    }
  }

  // the north bridge
  if (y0 < 150) {
    const bx = BRIDGE_ZONE.x;
    ctx.fillStyle = '#5a6672';
    ctx.fillRect(bx - 26, Math.max(y0, 0), 232, 150 - Math.max(y0, 0));
    ctx.fillStyle = '#2d3137';
    ctx.fillRect(bx, Math.max(y0, 0), 180, 150 - Math.max(y0, 0));
    ctx.strokeStyle = '#8a95a1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx - 26, 150);
    ctx.lineTo(bx - 26, Math.max(y0, 0));
    ctx.moveTo(bx + 206, 150);
    ctx.lineTo(bx + 206, Math.max(y0, 0));
    ctx.stroke();
    ctx.strokeStyle = ROAD_DASH;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 16]);
    ctx.beginPath();
    ctx.moveTo(bx + 90, 150);
    ctx.lineTo(bx + 90, Math.max(y0, 0));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#e8e4d8';
    ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    if (y0 < 120) ctx.fillText('BAY BRIDGE - NORTH', bx + 90, 112);
  }

  // street furniture
  for (const l of city.lamps) {
    if (l.x < x0 - 10 || l.x > x1 + 10 || l.y < y0 - 10 || l.y > y1 + 10) continue;
    ctx.fillStyle = '#3a3f47';
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    ctx.fillStyle = '#e8c94a';
    ctx.beginPath();
    ctx.arc(l.x, l.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,220,120,0.18)';
    ctx.beginPath();
    ctx.arc(l.x, l.y, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const h of city.hydrants) {
    if (h.x < x0 - 10 || h.x > x1 + 10 || h.y < y0 - 10 || h.y > y1 + 10) continue;
    ctx.fillStyle = '#c23326';
    ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
    ctx.fillStyle = '#8e1f16';
    ctx.fillRect(h.x - 1, h.y - 1, 2, 2);
  }
  for (const st of city.stops) {
    if (st.x < x0 - 40 || st.x > x1 + 40 || st.y < y0 - 30 || st.y > y1 + 30) continue;
    ctx.fillStyle = 'rgba(40,36,30,0.2)';
    ctx.fillRect(st.x + 3, st.y + 3, 40, 20);
    ctx.fillStyle = '#d8d2c0';
    ctx.fillRect(st.x, st.y, 40, 20);
    ctx.strokeStyle = '#5a6672';
    ctx.lineWidth = 2;
    ctx.strokeRect(st.x, st.y, 40, 20);
    ctx.fillStyle = '#2f7d8c';
    ctx.fillRect(st.x + 4, st.y - 18, 4, 22);
    ctx.fillRect(st.x + 8, st.y - 16, 14, 8);
    ctx.fillStyle = '#f7f2e6';
    ctx.font = 'bold 7px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUS', st.x + 15, st.y - 10);
  }
  // beach umbrellas
  for (const u of city.umbrellas) {
    if (u.x < x0 - 20 || u.x > x1 + 20 || u.y < y0 - 20 || u.y > y1 + 20) continue;
    ctx.fillStyle = u.c;
    ctx.beginPath();
    ctx.arc(u.x, u.y, 13, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#8a6a45';
    ctx.fillRect(u.x - 1, u.y - 2, 2, 14);
    ctx.fillStyle = '#d8d2c0';
    ctx.fillRect(u.x - 16, u.y + 16, 22, 10);
  }
  // palms sway last, above everything static
  for (const p of city.palms) {
    if (p.x < x0 - 40 || p.x > x1 + 40 || p.y < y0 - 40 || p.y > y1 + 40) continue;
    drawPalm(ctx, p.x, p.y, p.s, time);
  }
  // parked cars
  for (const c of city.parked) {
    if (c.x < x0 - 40 || c.x > x1 + 40 || c.y < y0 - 40 || c.y > y1 + 40) continue;
    ctx.save();
    ctx.translate(c.x, c.y);
    drawCarBody(ctx, c.color === '#7d8fa3' || c.color === '#a8b6c4' ? 'van' : 'sedan', c.color, c.angle);
    ctx.restore();
  }

  // district signs on the sidewalks
  const signs = [
    { x: 1000, y: 380, t: 'DOWNTOWN' },
    { x: 2240, y: 1142, t: 'OLD HARBOR TOWN' },
    { x: 940, y: 902, t: 'MARINA ROSA' },
    { x: 1460, y: 1820 + 40, t: 'PALMER BEACH' },
  ];
  for (const s of signs) {
    if (s.x < x0 - 90 || s.x > x1 + 90 || s.y < y0 - 30 || s.y > y1 + 30) continue;
    ctx.fillStyle = '#5a3f1e';
    ctx.fillRect(s.x - 2, s.y - 18, 4, 18);
    ctx.fillStyle = '#8a6a45';
    ctx.fillRect(s.x - 34, s.y - 32, 68, 16);
    ctx.fillStyle = '#f7f2e6';
    ctx.font = 'bold 9px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.t, s.x, s.y - 21);
  }
}
