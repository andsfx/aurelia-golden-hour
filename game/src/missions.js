// Missions: the four Santos Vale jobs, staged through trigger zones and scripted beats (the
// marked car, the store alarm, the park ambush, the 4-star getaway). Also the thugs - they
// strafe, shoot every beat and a half, and drop cash when they fall - plus the pickups and
// the yellow world marker.
import { BRIDGE_ZONE, HEAT, JEWELRY, MISSIONS, PIER_END, PIERS } from './config.js';
import { createVehicle } from './vehicle.js';

export function createMissions(city, rng) {
  const m = {
    id: 0,
    step: 0,
    thugs: [],
    pickups: [],
    markedCar: null,
    marker: null,
    grabbed: false,
    alarmT: 0,
    thugsLeft: 0,
    startedAt: 0,
  };

  const MARKER_PIER = { x: PIERS[1].x + PIERS[1].w / 2, y: PIER_END - 42 };
  const MARKER_PARK = { x: 1560, y: 1060 };
  const MARKER_BRIDGE = { x: BRIDGE_ZONE.x + BRIDGE_ZONE.w / 2, y: 80 };
  const MARKER_STORE = { x: JEWELRY.x + JEWELRY.w / 2, y: JEWELRY.y + JEWELRY.h + 30 };

  function objectiveText() {
    if (m.id === 0) return 'Talk to Santos Vale - pick up a job at the safehouse.';
    const def = MISSIONS[m.id - 1];
    if (m.id === 1) return m.step === 0 ? def.step1 : def.step2;
    if (m.id === 2) {
      if (m.step === 0) return def.step1;
      if (m.step === 1) return def.step2;
      return def.step3;
    }
    if (m.id === 3) {
      if (m.step === 0) return def.step1;
      return `${m.thugsLeft > 0 ? 'Survive the ambush' : 'Kill the remaining thugs'} (${m.thugsLeft} left)`;
    }
    return def.step1;
  }

  function start(id, game) {
    const def = MISSIONS[id - 1];
    m.id = id;
    m.step = 0;
    m.grabbed = false;
    m.alarmT = 0;
    m.startedAt = game.time;
    m.pickups = m.pickups.filter((p) => !p.fromMission || p.missionId !== id);
    game.effects.popup([`MISSION ${id}: ${def.title.toUpperCase()}`, def.start]);
    game.audio.missionSting();
    if (id === 1) {
      // the marked Voyager GT parked downtown
      m.markedCar = createVehicle('voyager', 1590, 320, 0, '#e8c94a');
      m.markedCar.marked = true;
      game.cars.push(m.markedCar);
      m.marker = { x: 1590, y: 320 };
    } else if (id === 2) {
      m.marker = MARKER_STORE;
    } else if (id === 3) {
      m.marker = MARKER_PARK;
    } else if (id === 4) {
      m.marker = MARKER_BRIDGE;
      game.police.forceHeat(4, game);
    }
  }

  function complete(game) {
    const def = MISSIONS[m.id - 1];
    game.money += def.reward;
    game.missionId = m.id;
    m.id = 0;
    m.marker = null;
    m.thugs = [];
    game.storyComplete = game.missionId >= 4;
    game.onMissionComplete(def);
  }

  function update(dt, game) {
    const p = game.player;
    const at = p.inCar ?? p;
    if (m.id === 1) {
      if (m.step === 0) {
        if (p.inCar === m.markedCar) {
          m.step = 1;
          m.marker = MARKER_PIER;
          game.effects.popupSmall(['Nice ride. Now get it to the Marina.']);
        }
      } else if (Math.hypot(at.x - MARKER_PIER.x, at.y - MARKER_PIER.y) < 90 && p.inCar === m.markedCar) {
        complete(game);
      }
    } else if (m.id === 2) {
      if (m.step === 0 && !p.inCar && p.x > m.marker.x - 60 && p.x < m.marker.x + 60 && p.y > m.marker.y - 50 && p.y < m.marker.y + 30) {
        m.step = 1;
        game.effects.popupSmall(['The store is right here.', 'Press E to rob it.']);
      } else if (m.step === 1 && game.interactPressed) {
        game.interactPressed = false;
        m.step = 2;
        m.grabbed = true;
        m.alarmT = 6;
        game.audio.alarm(true);
        game.police.addHeatEvent(HEAT.killPed, game); // a robbery is 2 stars
        game.effects.banner('STORE ALARM', 'Get out of there', '#e8554a');
        game.effects.impact(JEWELRY.x + JEWELRY.w / 2, JEWELRY.y + JEWELRY.h / 2, '#ffd97a', 20);
        game.effects.sparkle(JEWELRY.x + JEWELRY.w / 2, JEWELRY.y + JEWELRY.h / 2);
      } else if (m.step === 2) {
        m.alarmT -= dt;
        if (m.alarmT <= 0) game.audio.alarm(false);
        if (m.grabbed && game.police.wanted === 0) complete(game);
      }
    } else if (m.id === 3) {
      if (m.step === 0) {
        if (!p.inCar && Math.hypot(p.x - MARKER_PARK.x, p.y - MARKER_PARK.y) < 140) {
          m.step = 1;
          game.effects.popup(['THE DROP WAS A TRAP', 'The contact sold you out. Survive the ambush.']);
          for (let k = 0; k < 4; k++) {
            const a = (k / 4) * Math.PI * 2 + rng.range(-0.4, 0.4);
            m.thugs.push({
              x: p.x + Math.cos(a) * 230, y: p.y + Math.sin(a) * 230,
              hp: 100, dead: false, fall: 0, shootT: rng.range(0.7, 1.4),
              strafePhase: rng.range(0, 6), hitFlash: 0, angle: a + Math.PI,
              shirt: '#2c333d', skin: '#8a5a3c',
            });
          }
          m.thugsLeft = 4;
          game.effects.flash('#e8554a', 0.4);
          game.effects.addShake(6);
          game.audio.heatUp();
        }
      } else {
        updateThugs(dt, game);
        m.thugsLeft = m.thugs.filter((t) => !t.dead).length;
        if (m.thugsLeft === 0 && m.step === 1) {
          m.step = 2;
          setTimeoutObj(game, () => complete(game), 1.4);
        }
      }
    } else if (m.id === 4) {
      if (at.x > BRIDGE_ZONE.x && at.x < BRIDGE_ZONE.x + BRIDGE_ZONE.w && at.y < BRIDGE_ZONE.h) {
        complete(game);
      }
    }
    // cash pickups
    for (const pk of m.pickups) {
      if (pk.taken) continue;
      game.effects.sparkle(pk.x, pk.y);
      if (Math.hypot(p.x - pk.x, p.y - pk.y) < 18) {
        pk.taken = true;
        game.money += pk.amount;
        game.audio.cash();
        game.effects.burst(pk.x, pk.y, '#ffe98a', 12, 110, 0.5, 2, 'sparkle');
      }
    }
  }

  function setTimeoutObj(game, fn, seconds) {
    // frame-counted one-shot, deterministic in shots
    game.timers.push({ t: seconds, fn });
  }

  function updateThugs(dt, game) {
    const p = game.player;
    for (const t of m.thugs) {
      if (t.dead) {
        if (t.fall < 1) t.fall = Math.min(1, t.fall + dt * 2.6);
        continue;
      }
      if (t.hitFlash > 0) t.hitFlash -= dt;
      if (p.dead) continue;
      const dx = p.x - t.x;
      const dy = p.y - t.y;
      const d = Math.hypot(dx, dy) || 1;
      // keep a fighting distance: close in, back off, strafe sideways
      const strafe = Math.sin(game.time * 1.7 + t.strafePhase);
      let mx = (dx / d) * (d > 300 ? 1 : d < 140 ? -0.8 : 0);
      let my = (dy / d) * (d > 300 ? 1 : d < 140 ? -0.8 : 0);
      mx += (-dy / d) * strafe * 0.8;
      my += (dx / d) * strafe * 0.8;
      const len = Math.hypot(mx, my) || 1;
      const nx = t.x + (mx / len) * 118 * dt;
      const ny = t.y + (my / len) * 118 * dt;
      if (game.city.canWalk(nx, t.y, 7)) t.x = nx;
      if (game.city.canWalk(t.x, ny, 7)) t.y = ny;
      t.angle = Math.atan2(dy, dx);
      t.shootT -= dt;
      if (t.shootT <= 0 && d < 420) {
        t.shootT = 1.5;
        const a = Math.atan2(dy, dx) + rng.range(-0.14, 0.14);
        game.bullets.push({ x: t.x + Math.cos(a) * 12, y: t.y + Math.sin(a) * 12, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, ttl: 1.6, from: 'thug' });
        game.effects.muzzle(t.x + Math.cos(a) * 14, t.y + Math.sin(a) * 14, a);
        game.audio.gunshot();
      }
    }
  }

  function killThug(t, game) {
    t.dead = true;
    t.fall = 0;
    m.pickups.push({ x: t.x, y: t.y, amount: 50, taken: false, fromMission: true, missionId: m.id });
    game.audio.cash();
  }

  function draw(ctx, time) {
    // yellow objective marker: bobbing arrow + light pillar
    if (m.marker) {
      const bob = Math.sin(time * 3.2) * 6;
      const x = m.marker.x;
      const y = m.marker.y - 46 + bob;
      ctx.save();
      ctx.fillStyle = 'rgba(232,201,74,0.22)';
      ctx.beginPath();
      ctx.moveTo(x - 13, m.marker.y);
      ctx.lineTo(x, m.marker.y - 44);
      ctx.lineTo(x + 13, m.marker.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8c94a';
      ctx.strokeStyle = '#5a3f1e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - 11, y);
      ctx.lineTo(x, y - 20);
      ctx.lineTo(x + 11, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // cash pickups
    for (const pk of m.pickups) {
      if (pk.taken) continue;
      ctx.fillStyle = 'rgba(20,16,10,0.3)';
      ctx.beginPath();
      ctx.ellipse(pk.x, pk.y + 4, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f8a4c';
      ctx.fillRect(pk.x - 7, pk.y - 4, 14, 9);
      ctx.fillStyle = '#e8e4d8';
      ctx.fillRect(pk.x - 7, pk.y - 4, 14, 3);
      ctx.fillStyle = '#2f7d3c';
      ctx.font = 'bold 7px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 3);
    }
    // thugs
    for (const t of m.thugs) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.globalAlpha = t.dead ? Math.max(0, 1 - t.fall * 0.85) : 1;
      if (t.dead) {
        ctx.rotate(t.fall * Math.PI / 2);
        ctx.fillStyle = 'rgba(20,16,10,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 2, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = t.shirt;
        ctx.fillRect(-8, -3, 16, 7);
        ctx.fillStyle = '#33383f';
        ctx.fillRect(-8, 4, 16, 4);
        ctx.fillStyle = t.skin;
        ctx.beginPath();
        ctx.arc(6, -3, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }
      ctx.fillStyle = 'rgba(20,16,10,0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 3, 7, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();
      const step = Math.sin(time * 9 + t.strafePhase) * 2.6;
      ctx.fillStyle = '#33383f';
      ctx.fillRect(-4 + step * 0.5, 0, 3.2, 7);
      ctx.fillRect(1 - step * 0.5, 0, 3.2, 7);
      ctx.fillStyle = t.shirt;
      ctx.beginPath();
      ctx.ellipse(0, -4.5, 6.4, 5.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // gun arm pointing at the player
      ctx.save();
      ctx.rotate(t.angle);
      ctx.fillStyle = t.shirt;
      ctx.fillRect(4, -1.8, 11, 3.6);
      ctx.fillStyle = '#23272e';
      ctx.fillRect(12, -2.4, 8, 4);
      ctx.restore();
      ctx.fillStyle = t.skin;
      ctx.beginPath();
      ctx.arc(0, -11, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#14100c';
      ctx.beginPath();
      ctx.arc(0, -11.8, 4.4, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();
      if (t.hitFlash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(0, -3, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      // health bar
      if (t.hp < 100) {
        const w = 26;
        ctx.fillStyle = 'rgba(10,10,12,0.8)';
        ctx.fillRect(-w / 2, -20, w, 4);
        ctx.fillStyle = t.hp > 45 ? '#6dbb4e' : '#d0553f';
        ctx.fillRect(-w / 2 + 1, -19, (w - 2) * (t.hp / 100), 2);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  return Object.assign(m, { start, complete, update, draw, killThug, objectiveText });
}
