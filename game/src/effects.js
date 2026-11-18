// Transient world juice and screen-space atmosphere: particles, tracers, casings, cash
// sparkles, persistent skid marks, camera shake, the golden-hour glare and damage vignette,
// plus the banner and typed popup system the story and the wanted level use.
import { VIEW_H, VIEW_W } from './config.js';

const SKID_MAX = 400;

export function createEffects(rng) {
  const parts = [];      // {x, y, vx, vy, ttl, life, size, color, kind}
  const tracers = [];    // {x1, y1, x2, y2, ttl, life, color, width}
  const casings = [];    // {x, y, vx, vy, ttl, spin}
  const skids = [];      // {x1, y1, x2, y2}
  const state = {
    shake: 0,
    banners: [],         // {text, sub, ttl, life, color}
    popup: null,         // {lines, chars, total, ttl, life, kind}
    flash: 0, flashColor: '#ffffff',
    vignette: 0,
  };

  const addPart = (x, y, vx, vy, ttl, size, color, kind) => {
    if (parts.length > 500) parts.shift();
    parts.push({ x, y, vx, vy, ttl, life: ttl, size, color, kind });
  };

  return {
    state,
    burst(x, y, color, n, speed, ttl = 0.5, size = 2.5, kind = 'circle') {
      for (let k = 0; k < n; k++) {
        const a = rng.range(0, Math.PI * 2);
        const v = rng.range(speed * 0.3, speed);
        addPart(x, y, Math.cos(a) * v, Math.sin(a) * v, rng.range(ttl * 0.5, ttl), rng.range(size * 0.5, size), color, kind);
      }
    },
    exhaust(x, y, angle) {
      addPart(x + rng.range(-3, 3), y + rng.range(-3, 3), Math.cos(angle) * -30 + rng.range(-10, 10), Math.sin(angle) * -30 + rng.range(-10, 10), rng.range(0.5, 0.9), rng.range(2, 4), 'rgba(180,180,190,0.5)', 'smoke');
    },
    muzzle(x, y, angle) {
      addPart(x, y, 0, 0, 0.09, 14, '#ffd97a', 'glow');
      addPart(x, y, Math.cos(angle) * 60, Math.sin(angle) * 60, 0.16, 3, '#ffb84d', 'spark');
      addPart(x, y, Math.cos(angle + 0.6) * 50, Math.sin(angle + 0.6) * 50, 0.16, 2.5, '#ffe9a8', 'spark');
      addPart(x, y, Math.cos(angle - 0.6) * 50, Math.sin(angle - 0.6) * 50, 0.16, 2.5, '#ffe9a8', 'spark');
    },
    tracer(x1, y1, x2, y2, color = '#ffdf8a', width = 2.5) {
      tracers.push({ x1, y1, x2, y2, ttl: 0.12, life: 0.12, color, width });
    },
    casing(x, y, angle) {
      casings.push({ x, y, vx: Math.cos(angle + Math.PI / 2) * rng.range(40, 90), vy: Math.sin(angle + Math.PI / 2) * rng.range(40, 90), ttl: 2.4, spin: rng.range(4, 10) });
    },
    skid(x1, y1, x2, y2) {
      if (skids.length >= SKID_MAX) skids.shift();
      skids.push({ x1, y1, x2, y2 });
    },
    sparkle(x, y) {
      addPart(x, y, rng.range(-8, 8), rng.range(-34, -18), rng.range(0.5, 0.9), rng.range(1.6, 2.4), '#ffe98a', 'sparkle');
    },
    impact(x, y, color = '#ffd97a', n = 10) {
      this.burst(x, y, color, n, 160, 0.35, 2.4, 'spark');
    },
    blood(x, y) {
      this.burst(x, y, '#a83232', 8, 120, 0.4, 2.6, 'circle');
    },
    /** Helicopter countermeasure: small orange sparks that drift down and fade. */
    flare(x, y) {
      for (let k = 0; k < 6; k++) {
        const a = rng.range(0, Math.PI * 2);
        const v = rng.range(12, 42);
        addPart(x, y, Math.cos(a) * v, Math.sin(a) * v + rng.range(6, 22), rng.range(0.7, 1.3), rng.range(1.6, 3), '#ff9a3c', 'spark');
      }
      addPart(x, y, 0, 0, 0.5, 10, '#ffb84d', 'glow');
    },
    addShake(v) { state.shake = Math.min(14, state.shake + v); },
    flash(color, v = 1) { state.flash = v; state.flashColor = color; },
    addVignette(v) { state.vignette = Math.min(1, state.vignette + v); },
    banner(text, sub, color = '#e8c94a', ttl = 2.6) {
      state.banners.push({ text, sub, ttl, life: ttl, color });
      if (state.banners.length > 3) state.banners.shift();
    },
    /** A typed story popup: `lines` is an array of strings. Returns false while still typing. */
    popup(lines, ttl = 6) {
      state.popup = { lines, chars: 0, total: lines.join('\n').length, ttl, life: ttl, kind: 'story' };
    },
    popupSmall(lines, ttl = 4) {
      state.popup = { lines, chars: 0, total: lines.join('\n').length, ttl, life: ttl, kind: 'small' };
    },
    clearPopup() { state.popup = null; },

    update(dt, time) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.ttl -= dt;
        if (p.ttl <= 0) { parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'smoke') { p.vx *= 0.96; p.vy *= 0.96; }
        if (p.kind === 'sparkle') { p.vx += Math.sin(time * 12 + p.y) * 30 * dt; }
      }
      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].ttl -= dt;
        if (tracers[i].ttl <= 0) tracers.splice(i, 1);
      }
      for (let i = casings.length - 1; i >= 0; i--) {
        const c = casings[i];
        c.ttl -= dt;
        if (c.ttl <= 0) { casings.splice(i, 1); continue; }
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.vx *= 0.9;
        c.vy *= 0.9;
      }
      state.shake = Math.max(0, state.shake - dt * 40);
      state.flash = Math.max(0, state.flash - dt * 2.2);
      state.vignette = Math.max(0, state.vignette - dt * 0.7);
      for (let i = state.banners.length - 1; i >= 0; i--) {
        state.banners[i].ttl -= dt;
        if (state.banners[i].ttl <= 0) state.banners.splice(i, 1);
      }
      if (state.popup) {
        state.popup.chars = Math.min(state.popup.total, state.popup.chars + dt * 46);
        state.popup.ttl -= dt;
      }
    },

    /** World-space effects: skids, casings, particles, tracers. */
    drawWorld(ctx) {
      ctx.save();
      ctx.lineCap = 'round';
      for (const s of skids) {
        ctx.strokeStyle = 'rgba(20,18,16,0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      }
      for (const c of casings) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.spin * (2.4 - c.ttl));
        ctx.fillStyle = '#c9a24b';
        ctx.fillRect(-2.6, -1.2, 5.2, 2.4);
        ctx.restore();
      }
      for (const p of parts) {
        const a = Math.max(0, p.ttl / p.life);
        if (p.kind === 'glow') {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
          g.addColorStop(0, 'rgba(255,230,150,0.95)');
          g.addColorStop(0.5, 'rgba(255,180,60,0.45)');
          g.addColorStop(1, 'rgba(255,150,40,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'sparkle') {
          ctx.fillStyle = `rgba(255,235,150,${a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(255,240,180,${a * 0.7})`;
          ctx.lineWidth = 1;
          const cross = 3.2;
          ctx.beginPath();
          ctx.moveTo(p.x - cross, p.y); ctx.lineTo(p.x + cross, p.y);
          ctx.moveTo(p.x, p.y - cross); ctx.lineTo(p.x, p.y + cross);
          ctx.stroke();
        } else {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? (1 + (1 - a) * 1.6) : 1), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      for (const t of tracers) {
        const a = t.ttl / t.life;
        ctx.strokeStyle = t.color;
        ctx.globalAlpha = a;
        ctx.lineWidth = t.width;
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(t.x2, t.y2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    },

    /** Screen-space: golden hour tint, sun glare, shake vignette, damage flash, banners, popup. */
    drawOverlay(ctx, game, time) {
      ctx.save();
      // permanent golden-hour warmth
      ctx.fillStyle = 'rgba(255,146,56,0.05)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      // sun glare from the south-west
      const sx = VIEW_W * 0.86;
      const sy = VIEW_H * 0.12;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 620);
      g.addColorStop(0, 'rgba(255,224,150,0.5)');
      g.addColorStop(0.25, 'rgba(255,200,110,0.16)');
      g.addColorStop(1, 'rgba(255,190,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.strokeStyle = 'rgba(255,235,190,0.14)';
      ctx.lineWidth = 70;
      ctx.beginPath();
      ctx.moveTo(sx - 520, sy + 240);
      ctx.lineTo(sx + 180, sy - 90);
      ctx.stroke();
      // soft vignette
      const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(30,16,8,0.34)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      // damage vignette
      if (state.vignette > 0) {
        const d = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.8);
        d.addColorStop(0, 'rgba(180,20,20,0)');
        d.addColorStop(1, `rgba(180,20,20,${0.5 * state.vignette})`);
        ctx.fillStyle = d;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      if (state.flash > 0) {
        ctx.fillStyle = state.flashColor;
        ctx.globalAlpha = Math.min(0.5, state.flash);
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.globalAlpha = 1;
      }
      // banners (wanted level up, etc.)
      let by = 150;
      for (const b of state.banners) {
        const a = Math.min(1, b.ttl / 0.4);
        ctx.globalAlpha = a;
        ctx.font = 'bold 30px "Trebuchet MS", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(20,12,6,0.85)';
        ctx.strokeText(b.text, VIEW_W / 2, by);
        ctx.fillStyle = b.color;
        ctx.fillText(b.text, VIEW_W / 2, by);
        if (b.sub) {
          ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
          ctx.strokeStyle = 'rgba(20,12,6,0.85)';
          ctx.lineWidth = 4;
          ctx.strokeText(b.sub, VIEW_W / 2, by + 24);
          ctx.fillStyle = '#f7f2e6';
          ctx.fillText(b.sub, VIEW_W / 2, by + 24);
        }
        by += 54;
        ctx.globalAlpha = 1;
      }
      // typed story popup
      if (state.popup) {
        const p = state.popup;
        const text = p.lines.join('\n').slice(0, Math.floor(p.chars));
        const small = p.kind === 'small';
        const pw = small ? 560 : 760;
        const ph = small ? 74 : 168;
        const px = (VIEW_W - pw) / 2;
        const py = small ? VIEW_H - 132 : VIEW_H - 250;
        ctx.globalAlpha = Math.min(1, p.ttl / 0.6);
        ctx.fillStyle = 'rgba(16,14,10,0.78)';
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = 'rgba(232,201,74,0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, pw, ph);
        ctx.fillStyle = '#f7f2e6';
        ctx.font = (small ? '15px' : '18px') + ' "Trebuchet MS", sans-serif';
        ctx.textAlign = 'center';
        const lines = text.split('\n');
        const lh = small ? 22 : 30;
        for (let k = 0; k < lines.length; k++) {
          ctx.fillText(lines[k], VIEW_W / 2, py + 30 + k * lh);
        }
        if (p.chars < p.total) {
          ctx.fillStyle = '#e8c94a';
          ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
          ctx.fillText('press any key to skip', VIEW_W / 2, py + ph - 14);
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    },
  };
}
