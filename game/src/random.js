// Deterministic PRNG (mulberry32). The whole game uses one seeded stream, so the same
// ?seed=N URL always builds and plays the same world - no Math.random in world logic.
// In shot mode main.js seeds it from the URL before any module consumes it, and every
// world build, traffic car and staged scene draws from the same stream in the same order,
// which is what makes ?shot=chase&seed=7 reproduce pixel-for-pixel.
export function createRandom(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min, max) { return min + Math.floor(next() * (max - min + 1)); },
    pick(list) { return list[Math.floor(next() * list.length)]; },
    chance(p) { return next() < p; },
    range(min, max) { return min + next() * (max - min); },
  };
}
