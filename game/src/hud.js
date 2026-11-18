// The HUD: health and armor bars, the mission progress bar, wanted stars that flash hard on
// change, money and the clock, the weapon box (mag pips + reserve/total) and the speed
// readout, the live ABPD UNITS breakdown, a rotating minimap cut from a pre-rendered map
// (roads, districts, ocean), the current objective, and the portrait + typed dialogue box
// for the story. All text is high-contrast and stays inside the 1280x720 frame so every
// panel still reads at thumbnail size.
import { BEACH_TOP, DOWNTOWN, MARINA, MISSIONS, OCEAN_Y, OLD_HARBOR, PARK, PIERS, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config.js';

const MMAP_S = 0.05;
const MMAP_R = 82;
const PANEL = 'rgba(12,14,16,0.72)';
const PANEL_EDGE = 'rgba(255,255,255,0.24)';
const FONT = '"Trebuchet MS", sans-serif';

export function createHud(city) {
  // pre-render the static map once
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = Math.ceil(WORLD_W * MMAP_S);
  mapCanvas.height = Math.ceil(WORLD_H * MMAP_S);
  const mg = mapCanvas.getContext('2d');
  mg.fillStyle = '#1b2026';
  mg.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
  mg.fillStyle = '#243037';
  mg.fillRect(DOWNTOWN.x * MMAP_S, DOWNTOWN.y * MMAP_S, DOWNTOWN.w * MMAP_S, DOWNTOWN.h * MMAP_S);
  mg.fillStyle = '#2b2f2a';
  mg.fillRect(MARINA.x * MMAP_S, MARINA.y * MMAP_S, MARINA.w * MMAP_S, (OCEAN_Y - MARINA.y) * MMAP_S);
  mg.fillStyle = '#2e3327';
  mg.fillRect(OLD_HARBOR.x * MMAP_S, OLD_HARBOR.y * MMAP_S, OLD_HARBOR.w * MMAP_S, (OCEAN_Y - OLD_HARBOR.y) * MMAP_S);
  mg.fillStyle = '#234021';
  mg.fillRect(PARK.x * MMAP_S, PARK.y * MMAP_S, PARK.w * MMAP_S, PARK.h * MMAP_S);
  mg.fillStyle = '#4a4030';
  mg.fillRect(0, BEACH_TOP * MMAP_S, mapCanvas.width, (OCEAN_Y - BEACH_TOP) * MMAP_S);
  mg.fillStyle = '#0e3d54';
  mg.fillRect(0, OCEAN_Y * MMAP_S, mapCanvas.width, mapCanvas.height - OCEAN_Y * MMAP_S);
  mg.fillStyle = '#7a6a4c';
  for (const p of PIERS) mg.fillRect(p.x * MMAP_S, p.y * MMAP_S, p.w * MMAP_S, p.h * MMAP_S);
  mg.strokeStyle = '#5a6470';
  mg.lineWidth = 2.6;
  mg.beginPath();
  let firstH = true;
  for (let iy = 0; iy < city.graph.nodes.length; iy++) {
    const n = city.graph.nodes[iy];
    if (n.y === 140) { if (firstH) { mg.moveTo(n.x * MMAP_S, n.y * MMAP_S); firstH = false; } else mg.lineTo(n.x * MMAP_S, n.y * MMAP_S); }
  }
  mg.stroke();

  // pre-render Naia's 32x32 pixel-art portrait once (sun visor, dark hair)
  const portrait = preRenderPortrait();

  return {
    draw(ctx, game) {
      drawBars(ctx, game);
      drawMissionBar(ctx, game);
      drawStars(ctx, game);
      drawMoneyClock(ctx, game);
      drawWeaponBox(ctx, game);
      drawSpeed(ctx, game);
      drawWantedBreakdown(ctx, game);
      drawMinimap(ctx, game, mapCanvas);
      drawObjective(ctx, game);
      drawDialogue(ctx, game, portrait);
    },
  };
}

/** Naia's face as crisp pixel art: dark hair, skin, gold sun visor, a hint of her jacket. */
function preRenderPortrait() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  px(0, 0, 32, 32, 'rgba(20,24,30,0)');
  // shoulders / jacket
  px(4, 26, 24, 6, '#c96f3a');
  px(3, 25, 26, 2, '#a85a2d');
  // neck
  px(13, 22, 6, 4, '#d9a577');
  // face
  px(7, 8, 18, 16, '#d9a577');
  px(8, 22, 16, 2, '#c08a5c');
  // dark hair around and over the top
  px(5, 4, 22, 6, '#2e1f18');
  px(5, 8, 4, 14, '#2e1f18');
  px(23, 8, 4, 14, '#2e1f18');
  // gold sun visor band across the forehead
  px(7, 10, 18, 3, '#e8c94a');
  px(7, 10, 18, 1, '#f7e6a0');
  // eyes
  px(10, 14, 3, 2, '#2e1f18');
  px(19, 14, 3, 2, '#2e1f18');
  // mouth
  px(13, 19, 6, 1, '#b97a52');
  return c;
}

function panelBox(ctx, x, y, w, h) {
  ctx.fillStyle = PANEL;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PANEL_EDGE;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
}

function drawBars(ctx, game) {
  const p = game.player;
  const x = 18;
  const y = 16;
  panelBox(ctx, x - 8, y - 8, 236, 58);
  ctx.font = `bold 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8e4d8';
  ctx.fillText('HEALTH', x, y + 10);
  const hw = 200;
  ctx.fillStyle = '#22262c';
  ctx.fillRect(x + 52, y + 2, hw, 13);
  const hr = Math.max(0, p.health / 100);
  const hg = ctx.createLinearGradient(x + 52, 0, x + 52 + hw, 0);
  hg.addColorStop(0, '#d0553f');
  hg.addColorStop(1, '#6dbb4e');
  ctx.fillStyle = hg;
  ctx.fillRect(x + 52, y + 2, hw * hr, 13);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 52, y + 2, hw, 13);
  ctx.fillStyle = '#e8e4d8';
  ctx.font = `bold 10px ${FONT}`;
  ctx.fillText(Math.max(0, Math.round(p.health)), x + 52 + hw + 8, y + 13);
  ctx.fillStyle = '#7f92b8';
  ctx.fillText('ARMOR', x, y + 34);
  ctx.fillStyle = '#22262c';
  ctx.fillRect(x + 52, y + 26, hw, 9);
  if (p.armor > 0) {
    ctx.fillStyle = '#4d78ff';
    ctx.fillRect(x + 52, y + 26, hw * Math.min(1, p.armor / 100), 9);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.strokeRect(x + 52, y + 26, hw, 9);
  ctx.fillStyle = '#e8e4d8';
  ctx.fillText(Math.max(0, Math.round(p.armor)), x + 52 + hw + 8, y + 35);
}

function drawMissionBar(ctx, game) {
  // The mission label comes from game.missionBar (shots stage it) or falls back to the
  // live mission definition; the bar reads objective progress 0..1.
  const mb = game.missionBar;
  const label = mb && mb.label
    ? mb.label
    : game.mission.id > 0
      ? `MISSION ${game.mission.id}/4 · ${MISSIONS[game.mission.id - 1].title.toUpperCase()}`
      : null;
  if (!label) return;
  const progress = Math.max(0, Math.min(1, mb?.progress ?? 0));
  const x = 18;
  const y = 82;
  panelBox(ctx, x - 8, y - 8, 236, 34);
  ctx.font = `bold 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8c94a';
  ctx.fillText(label, x, y + 8);
  ctx.fillStyle = '#22262c';
  ctx.fillRect(x, y + 14, 212, 5);
  ctx.fillStyle = '#e8c94a';
  ctx.fillRect(x, y + 14, 212 * progress, 5);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y + 14, 212, 5);
}

function drawStars(ctx, game) {
  const x = VIEW_W - 18;
  const y = 18;
  const recent = game.lastHeatT !== null && game.time - game.lastHeatT < 1.4;
  ctx.textAlign = 'right';
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillStyle = '#e8e4d8';
  ctx.fillText('WANTED', x - 24, y + 9);
  for (let k = 0; k < 5; k++) {
    const sx = x - 24 - k * 24;
    const filled = k < game.police.wanted;
    // flash hard on change: wider swing and faster wobble than before
    const pulse = filled && recent ? 1 + Math.sin(game.time * 26) * 0.45 : 1;
    drawStar(ctx, sx, y + 8, filled, pulse);
  }
}

function drawStar(ctx, x, y, filled, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5;
    const r = k % 2 === 0 ? 10 : 4.4;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#e8c94a' : 'rgba(255,255,255,0.16)';
  ctx.fill();
  ctx.strokeStyle = filled ? '#7a5a1e' : 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

function drawMoneyClock(ctx, game) {
  ctx.textAlign = 'right';
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillStyle = '#6dbb4e';
  ctx.fillText(`$${game.money.toLocaleString('en-US')}`, VIEW_W - 18, 60);
  const h = Math.floor(game.clockMinutes / 60);
  const mm = Math.floor(game.clockMinutes % 60);
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillStyle = '#e8e4d8';
  ctx.fillText(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, VIEW_W - 18, 82);
}

function drawWeaponBox(ctx, game) {
  const p = game.player;
  const g = p.gun;
  const holstered = Boolean(p.inCar); // driving = weapon away: grey the whole box
  const x = VIEW_W - 190;
  const y = VIEW_H - 214;
  const w = 172;
  const h = 112;
  panelBox(ctx, x, y, w, h);
  ctx.textAlign = 'left';
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillStyle = holstered ? '#7d858f' : '#e8e4d8';
  ctx.fillText('PISTOL', x + 10, y + 16);
  ctx.font = `bold 9px ${FONT}`;
  ctx.fillStyle = holstered ? '#5c636c' : '#aab3c0';
  ctx.fillText('9MM HANDGUN', x + 10, y + 28);
  if (g.reload > 0) {
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = '#e8554a';
    ctx.fillText('RELOADING...', x + 10, y + 54);
  } else {
    // mag pips: 8 slots, filled = rounds in the mag
    for (let k = 0; k < 8; k++) {
      const px = x + 10 + k * 14;
      const py = y + 40;
      const filled = k < g.ammo;
      ctx.fillStyle = filled ? (holstered ? '#8a939c' : '#e8c94a') : 'rgba(255,255,255,0.14)';
      ctx.fillRect(px, py, 10, 9);
      ctx.strokeStyle = filled ? 'rgba(90,63,30,0.8)' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, 10, 9);
    }
  }
  // reserve / total, bold
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillStyle = holstered ? '#7d858f' : '#f7f2e6';
  ctx.fillText(`${g.reserve} / ${g.total}`, x + 10, y + 82);
  ctx.font = `bold 9px ${FONT}`;
  ctx.fillStyle = holstered ? '#5c636c' : '#aab3c0';
  ctx.fillText('RESERVE / TOTAL', x + 10, y + 94);
  if (!holstered) {
    ctx.font = `bold 9px ${FONT}`;
    ctx.fillStyle = '#e8c94a';
    ctx.fillText('[LMB] FIRE  [R] RELOAD', x + 10, y + 106);
  }
}

function drawSpeed(ctx, game) {
  const p = game.player;
  if (!p.inCar) {
    // context hint while on foot
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillStyle = '#e8c94a';
    const hint = game.nearCar ? '[E] enter car' : game.nearDoor ? '[E] rob store' : '';
    if (hint) {
      ctx.textAlign = 'center';
      ctx.fillText(hint, VIEW_W / 2, VIEW_H - 28);
    }
    return;
  }
  const c = p.inCar;
  const mph = Math.abs(Math.round(c.speed * 0.28));
  const x = VIEW_W - 190;
  const y = VIEW_H - 92;
  const w = 172;
  const h = 76;
  panelBox(ctx, x, y, w, h);
  ctx.font = `bold 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8c94a';
  ctx.fillText(c.specName ?? (c.kind === 'cop' ? 'ABPD Cruiser' : nameOf(c.kind)), x + 10, y + 16);
  ctx.textAlign = 'right';
  ctx.font = `bold 32px ${FONT}`;
  ctx.fillStyle = mph > 70 ? '#e8554a' : '#e8e4d8';
  ctx.fillText(String(mph), x + w - 10, y + 52);
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillStyle = '#aab3c0';
  ctx.fillText('mph', x + w - 10, y + 68);
}

function nameOf(kind) {
  return kind === 'voyager' ? 'Voyager GT' : kind === 'sedan' ? 'Sundial Sedan' : 'Marina Van';
}

/** Behavior word for the ABPD UNITS box, derived from real distance + mode each frame. */
function behaviorFor(cop, d) {
  if (cop.mode === 'block') return 'BLOCKADING';
  if (d < 52) return 'RAMMING';
  if (d < 210) return 'INTERCEPTING';
  return 'PURSUING';
}

function drawWantedBreakdown(ctx, game) {
  const police = game.police;
  if (police.wanted <= 0) return;
  const p = game.player.inCar ?? game.player;
  const units = police.cops
    .filter((c) => !c.wrecked && c.mode !== 'block')
    .map((c) => ({ c, d: Math.hypot(c.x - p.x, c.y - p.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  const heliLine = police.heli.active ? 1 : 0;
  const lines = units.length + heliLine;
  if (lines === 0) return;
  const w = 250;
  const h = 24 + 14 + lines * 15 + 6;
  const x = 16;
  const y = VIEW_H - 16 - MMAP_R * 2 - 14 - h;
  panelBox(ctx, x, y, w, h);
  ctx.font = `bold 10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#4d78ff';
  ctx.fillText('ABPD UNITS', x + 8, y + 14);
  let ly = y + 30;
  ctx.font = `bold 10px ${FONT}`;
  for (const u of units) {
    const dist = Math.max(10, Math.round(u.d / 10) * 10); // rounded to 10s of meters
    ctx.fillStyle = '#f7f2e6';
    ctx.fillText(`CRUISER-${u.c.id + 1}`, x + 8, ly);
    ctx.fillStyle = '#aab3c0';
    ctx.fillText(`${dist}m`, x + 92, ly);
    ctx.fillStyle = u.d < 210 ? '#e8554a' : '#e8c94a';
    ctx.fillText(behaviorFor(u.c, u.d), x + 132, ly);
    ly += 15;
  }
  if (police.heli.active) {
    ctx.fillStyle = '#f7f2e6';
    ctx.fillText('HELI-1', x + 8, ly);
    ctx.fillStyle = '#aab3c0';
    ctx.fillText('ABOVE', x + 92, ly);
    ctx.fillStyle = '#4d78ff';
    ctx.fillText('SEARCHLIGHT', x + 132, ly);
  }
}

function drawMinimap(ctx, game, mapCanvas) {
  const p = game.player;
  const cx = 16 + MMAP_R;
  const cy = VIEW_H - 16 - MMAP_R;
  // circular clip
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, MMAP_R + 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,12,14,0.8)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, MMAP_R, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-p.angle - Math.PI / 2);
  const s = MMAP_S;
  ctx.drawImage(mapCanvas, -p.x * s, -p.y * s);
  // mission blip (yellow pulse)
  const mk = game.mission.marker;
  if (mk) {
    const bx = (mk.x - p.x) * s;
    const by = (mk.y - p.y) * s;
    if (bx * bx + by * by < MMAP_R * MMAP_R) {
      ctx.fillStyle = '#e8c94a';
      const pulse = 3 + Math.sin(game.time * 6) * 1.5;
      ctx.beginPath();
      ctx.arc(bx, by, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5a3f1e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  // cops (red) and thugs (orange)
  for (const c of game.police.cops) {
    if (c.wrecked) continue;
    const bx = (c.x - p.x) * s;
    const by = (c.y - p.y) * s;
    if (bx * bx + by * by > MMAP_R * MMAP_R) continue;
    ctx.fillStyle = '#e8554a';
    ctx.beginPath();
    ctx.arc(bx, by, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // the helicopter as a blinking blue diamond
  if (game.police.heli.active) {
    const bx = (game.police.heli.x - p.x) * s;
    const by = (game.police.heli.y - p.y) * s;
    if (bx * bx + by * by < MMAP_R * MMAP_R) {
      ctx.fillStyle = Math.sin(game.time * 6) > 0 ? '#6da8ff' : '#4d78ff';
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    }
  }
  for (const t of game.mission.thugs) {
    if (t.dead) continue;
    const bx = (t.x - p.x) * s;
    const by = (t.y - p.y) * s;
    if (bx * bx + by * by > MMAP_R * MMAP_R) continue;
    ctx.fillStyle = '#e0a03c';
    ctx.beginPath();
    ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // safehouse (green)
  {
    const bx = (760 + 48 - p.x) * s;
    const by = (216 + 46 - p.y) * s;
    if (bx * bx + by * by < MMAP_R * MMAP_R) {
      ctx.fillStyle = '#6dbb4e';
      ctx.fillRect(bx - 2, by - 2, 4, 4);
    }
  }
  ctx.restore();
  // player arrow + ring + north marker
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-p.angle - Math.PI / 2);
  ctx.fillStyle = '#f7f2e6';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(4.6, 5);
  ctx.lineTo(0, 2.4);
  ctx.lineTo(-4.6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(232,201,74,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, MMAP_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#e8c94a';
  ctx.font = `bold 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy - MMAP_R - 6);
}

function drawObjective(ctx, game) {
  const x = 16;
  const y = 126;
  panelBox(ctx, x - 8, y - 8, 236, 44);
  ctx.font = `bold 10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8c94a';
  ctx.fillText('OBJECTIVE', x, y + 4);
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillStyle = '#f7f2e6';
  const text = game.objectiveText;
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 26) {
      lines.push(line.trim());
      line = w;
    } else line = (line + ' ' + w).trim();
  }
  if (line) lines.push(line);
  ctx.fillText(lines[0] ?? '', x, y + 18);
  if (lines[1]) ctx.fillText(lines[1], x, y + 32);
}

function drawDialogue(ctx, game, portrait) {
  const d = game.dialogue;
  if (!d || d.ttl <= 0) return;
  // typed-text effect: reveal chars over time
  const chars = Math.min(d.text.length, Math.floor(d.t * 40));
  const visible = d.text.slice(0, chars);
  const pw = 640;
  const ph = 58;
  const px = (VIEW_W - pw) / 2;
  const py = VIEW_H - 92;
  const fade = Math.min(1, d.ttl / 0.6);
  ctx.save();
  ctx.globalAlpha = fade;
  // portrait panel (rounded)
  const pr = px + 6;
  const pry = py + (ph - 44) / 2;
  ctx.fillStyle = PANEL;
  ctx.beginPath();
  roundedRect(ctx, pr - 4, pry - 4, 52, 52, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,201,74,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(portrait, pr, pry, 44, 44);
  // dialogue box
  ctx.fillStyle = 'rgba(16,14,10,0.82)';
  ctx.beginPath();
  roundedRect(ctx, px, py, pw, ph, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,201,74,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillStyle = '#e8c94a';
  ctx.fillText((d.speaker ?? 'Santos').toUpperCase(), px + 66, py + 20);
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillStyle = '#f7f2e6';
  ctx.fillText(visible, px + 66, py + 42);
  if (chars < d.text.length) {
    ctx.fillStyle = '#e8c94a';
    ctx.fillText('|', px + 66 + ctx.measureText(visible).width + 2, py + 42);
  }
  ctx.restore();
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
