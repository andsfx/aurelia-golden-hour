// Shared constants: world layout, palettes, vehicle and weapon tuning. Every module reads
// its numbers from here so the city stays coherent across files. All positions are world px.

export const STEP = 1 / 60;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const WORLD_W = 3400;
export const WORLD_H = 2400;

// The road grid: horizontal and vertical road center lines. Blocks are the cells between
// roads; each road has two lanes (right-hand traffic) and sidewalks on both sides.
export const ROAD_W = 52;
export const SIDEWALK_W = 16;
export const ROAD_EDGE = ROAD_W / 2 + SIDEWALK_W; // 42: block edge to road center
export const LANE_OFF = 13;
export const H_ROADS = [140, 380, 620, 860, 1100, 1340, 1580, 1820];
export const V_ROADS = [160, 420, 680, 940, 1200, 1460, 1720, 1980, 2240, 2500, 2760, 3020, 3280];

// The south edge: sand, then animated ocean. Piers from Marina Rosa run into the water.
export const OCEAN_Y = 2060;
export const BEACH_TOP = 1862;
export const PIER_END = 2140;

// Districts (world px). Palmer Beach is the sand strip along the south edge.
export const DOWNTOWN = { x: 0, y: 0, w: 1700, h: 1100 };
export const MARINA = { x: 0, y: 1100, w: 1700, h: 750 };
export const OLD_HARBOR = { x: 1700, y: 1100, w: 1700, h: 750 };
export const PARK = { x: 1242, y: 902, w: 696, h: 396 };
export const MARKET = { x: 1980, y: 1580, w: 520, h: 240 };

// Landmark spots: safehouse (respawn), the jewelry store (M2), the north bridge (M4).
export const SAFEHOUSE = { x: 760, y: 216, w: 96, h: 92 };
export const SPAWN_POINT = { x: 1004, y: 300 };
export const PIERS = [
  { x: 470, y: BEACH_TOP, w: 108, h: PIER_END - BEACH_TOP },
  { x: 670, y: BEACH_TOP, w: 108, h: PIER_END - BEACH_TOP },
  { x: 870, y: BEACH_TOP, w: 108, h: PIER_END - BEACH_TOP },
];
export const BRIDGE_ZONE = { x: 850, y: 0, w: 180, h: 140 };
export const JEWELRY = { x: 2032, y: 1632, w: 96, h: 70 };

// Camera: on foot the view is 1280x720 world px; driving zooms out 1.6x.
export const FOOT_ZOOM = 1;
export const CAR_ZOOM = 1.6;

// Player tuning.
export const PLAYER = { walk: 150, sprint: 245, radius: 8, health: 100, armor: 50, regenDelay: 5, regenRate: 4 };
export const PISTOL = { mag: 8, cooldown: 0.24, reload: 1.2, damage: 34, range: 540, hitPed: 100, hitCar: 7 };

// Vehicle types: arcade top-down handling numbers.
export const CAR_TYPES = {
  voyager: { name: 'Voyager GT', maxSpeed: 335, accel: 230, turn: 2.9, w: 48, h: 23 },
  sedan: { name: 'Sundial Sedan', maxSpeed: 260, accel: 175, turn: 2.5, w: 46, h: 22 },
  van: { name: 'Marina Van', maxSpeed: 205, accel: 140, turn: 2.1, w: 50, h: 24 },
  cop: { name: 'ABPD Cruiser', maxSpeed: 375, accel: 285, turn: 3.15, w: 48, h: 23 },
};
export const CAR_COLORS = ['#d9a13b', '#b98a2e', '#8e6bb8', '#4f8fb0', '#d8d2c0', '#7d8fa3', '#a8b6c4', '#c23326', '#e0552c', '#6d7f5c'];

// Wanted level rules.
export const HEAT = { steal: 1, hitPed: 1, hitCar: 1, shootNearCop: 2, killPed: 2, killCop: 3, decayDelay: 20, decayEvery: 8 };

// Mission definitions.
export const MISSIONS = [
  { id: 1, title: 'The Pickup', reward: 500, start: 'Steal the marked Voyager GT and deliver it to the Marina.', step1: 'Steal the marked car.', step2: 'Deliver the car to the Marina.' },
  { id: 2, title: 'The Heist', reward: 1200, start: 'Rob the jewelry store in Old Harbor Town.', step1: 'Go to the jewelry store.', step2: 'Press E at the store to rob it.', step3: 'Lose the cops.' },
  { id: 3, title: 'The Drop', reward: 800, start: 'Deliver the package to the contact in the park.', step1: 'Go to the park.', step2: 'Survive the ambush.', step3: 'Kill the remaining thugs.' },
  { id: 4, title: 'The Getaway', reward: 2000, start: 'Get out of town. Reach the north bridge.', step1: 'Reach the north bridge.' },
];

// District palettes.
export const PALETTES = {
  downtown: { ground: '#33383f', block: '#40464f', glass: ['#4f8fb0', '#3f7d9e', '#5aa3c4', '#356d8a', '#467fa0'], roof: '#2c3138', trim: '#cfd6de' },
  harbor: { ground: '#c9b28f', block: '#c9b28f', wall: ['#e8d3b0', '#e3b7a0', '#efd9b8', '#dcae8f', '#ecd9b0'], roof: ['#b0552f', '#a34a28', '#c16a3f'], trim: '#7c5a44' },
  marina: { ground: '#7d8894', block: '#87929e', wall: ['#a9b4c0', '#9aa6b4', '#b0bcc8'], roof: '#6d7a88', trim: '#5a6672' },
  park: { ground: '#4f7d46', grass: ['#4f7d46', '#57864c', '#46733f'], path: '#c9b28f' },
  beach: { sand: '#e7d3a4', wet: '#d9c08c' },
  ocean: { deep: '#0e5d7f', mid: '#15749c', near: '#1d86ae' },
};

export const PED_NAMES = ['Rosa', 'Marlon', 'Tessa', 'Vic', 'Paloma', 'Dex', 'Ines', 'Bruno', 'Luz', 'Oscar', 'Nia', 'Rico', 'Sana', 'Jules', 'Mira', 'Kofi'];

export const SAVE_KEY = 'aurelia-bay-save';
