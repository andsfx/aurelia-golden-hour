// The HUD: health and armor bars, wanted stars that flash on change, money and the clock,
// a rotating minimap cut from a pre-rendered map (roads, districts, ocean), the ammo or
// speed readout, and the current objective. All text is high-contrast and stays inside
// the 1280x720 frame.
import { BEACH_TOP, DOWNTOWN, MARINA, OCEAN_Y, OLD_HARBOR, PARK, PIERS, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config.js';

const MMAP_S = 0.05;
const MMAP_R = 82;

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
  for (const ry of city.graph.nodes.filter((n) => n.x === city.graph.nodes[0].x)) {
    void ry;
  }
  mg.beginPath();
  let firstH = true;
  for (let iy = 0; iy < city.graph.nodes.length; iy++) {
    const n = city.graph.nodes[iy];
    if (n.y === 140) { if (firstH) { mg.moveTo(n.x * MMAP_S, n.y * MMAP_S); firstH = false; } else mg.lineTo(n.x * MMAP_S, n.y * MMAP_S); }
  }
  mg.stroke();

  return {
    draw(ctx, game) {
      drawBars(ctx, game);
      drawStars(ctx, game);
      drawMoneyClock(ctx, game);
      drawReadout(ctx, game);
      drawMinimap(ctx, game, mapCanvas);
      drawObjective(ctx, game);
    },
  };
}

function drawBars(ctx, game) {
  const p = game.player;
  const x = 18;
  const y = 16;
  ctx.fillStyle = 'rgba(12,14,16,0.66)';
  ctx.fillRect(x - 8, y - 8, 236, 58);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 8, y - 8, 236, 58);
  ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
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
  ctx.font = 'bold 10px "Trebuchet MS", sans-serif';
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

function drawStars(ctx, game) {
  const x = VIEW_W - 18;
  const y = 18;
  const recent = game.lastHeatT !== null && game.time - game.lastHeatT < 1.4;
  ctx.textAlign = 'right';
  ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#e8e4d8';
  ctx.fillText('WANTED', x - 24, y + 9);
  for (let k = 0; k < 5; k++) {
    const sx = x - 24 - k * 24;
    const filled = k < game.police.wanted;
    const pulse = filled && recent ? 1 + Math.sin(game.time * 22) * 0.3 : 1;
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
  ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#6dbb4e';
  ctx.fillText(`$${game.money.toLocaleString('en-US')}`, VIEW_W - 18, 60);
  const h = Math.floor(game.clockMinutes / 60);
  const mm = Math.floor(game.clockMinutes % 60);
  ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#e8e4d8';
  ctx.fillText(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, VIEW_W - 18, 82);
}

function drawReadout(ctx, game) {
  const p = game.player;
  if (p.inCar) {
    const c = p.inCar;
    const mph = Math.abs(Math.round(c.speed * 0.28));
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(12,14,16,0.66)';
    ctx.fillRect(VIEW_W - 190, VIEW_H - 78, 172, 60);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.strokeRect(VIEW_W - 190, VIEW_H - 78, 172, 60);
    ctx.font = 'bold 34px "Trebuchet MS", sans-serif';
    ctx.fillStyle = mph > 70 ? '#e8554a' : '#e8e4d8';
    ctx.fillText(String(mph), VIEW_W - 26, VIEW_H - 46);
    ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#aab3c0';
    ctx.fillText('mph', VIEW_W - 26, VIEW_H - 28);
    ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#e8c94a';
    ctx.fillText(c.specName ?? (c.kind === 'cop' ? 'ABPD Cruiser' : nameOf(c.kind)), VIEW_W - 26, VIEW_H - 104);
  } else {
    const g = p.gun;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(12,14,16,0.66)';
    ctx.fillRect(VIEW_W - 176, VIEW_H - 74, 158, 56);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.strokeRect(VIEW_W - 176, VIEW_H - 74, 158, 56);
    ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
    ctx.fillStyle = g.reload > 0 ? '#e8554a' : '#e8e4d8';
    ctx.fillText(g.reload > 0 ? 'RELOADING' : `${g.ammo}/${8}`, VIEW_W - 28, VIEW_H - 42);
    ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#aab3c0';
    ctx.fillText('PISTOL  [LMB]', VIEW_W - 28, VIEW_H - 24);
  }
  // context hint
  ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#e8c94a';
  const hint = p.inCar ? '[E] exit   [H] horn' : game.nearCar ? '[E] enter car' : game.nearDoor ? '[E] rob store' : '';
  if (hint) {
    ctx.textAlign = 'center';
    ctx.fillText(hint, VIEW_W / 2, VIEW_H - 28);
  }
}

function nameOf(kind) {
  return kind === 'voyager' ? 'Voyager GT' : kind === 'sedan' ? 'Sundial Sedan' : 'Marina Van';
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
  ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy - MMAP_R - 6);
}

function drawObjective(ctx, game) {
  const x = 16;
  const y = VIEW_H - 16 - MMAP_R * 2 - 14;
  ctx.fillStyle = 'rgba(12,14,16,0.66)';
  ctx.fillRect(x, y - 26, 236, 48);
  ctx.strokeStyle = 'rgba(232,201,74,0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y - 26, 236, 48);
  ctx.font = 'bold 10px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8c94a';
  ctx.fillText('OBJECTIVE', x + 8, y - 10);
  ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
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
  ctx.fillText(lines[0] ?? '', x + 8, y + 6);
  if (lines[1]) ctx.fillText(lines[1], x + 8, y + 18);
}
