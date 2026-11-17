// Screens drawn over the live world: title with the logo and menu, the intro story, pause,
// mission complete with stats, and the BUSTED / WASTED endings. Each one is a pure overlay;
// the game state under it keeps rendering (the city pans behind the title, cops idle after
// a bust).
import { VIEW_H, VIEW_W } from './config.js';

export const MENU_NEW = 0;
export const MENU_CONTINUE = 1;
export const MENU_CONTROLS = 2;

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(12,14,16,0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(232,201,74,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function title(ctx, text, x, y, size, color, stroke = true) {
  ctx.font = `bold ${size}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  if (stroke) {
    ctx.lineWidth = size / 9;
    ctx.strokeStyle = 'rgba(20,14,6,0.9)';
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function menuItem(ctx, label, x, y, selected, size = 24) {
  ctx.font = `bold ${size}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  if (selected) {
    ctx.fillStyle = '#e8c94a';
    ctx.fillText(`\u25B8  ${label}  \u25C2`, x, y);
  } else {
    ctx.fillStyle = '#c9cdd4';
    ctx.fillText(label, x, y);
  }
}

export function drawScreens(ctx, game, time) {
  const s = game.screen;
  if (s === 'title') drawTitle(ctx, game, time);
  else if (s === 'intro') drawIntro(ctx, game);
  else if (s === 'controls') drawControls(ctx, game);
  else if (s === 'paused') drawPause(ctx, game);
  else if (s === 'complete') drawComplete(ctx, game);
  else if (s === 'busted') drawEnding(ctx, game, 'BUSTED', '#4d78ff', 'The ABPD pinned you. -10% cash, heat cleared.');
  else if (s === 'wasted') drawEnding(ctx, game, 'WASTED', '#e8554a', 'You died. -10% cash, back at the safehouse.');
}

function drawTitle(ctx, game, time) {
  // dusk gradient over the live city
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, 'rgba(20,14,10,0.5)');
  g.addColorStop(0.5, 'rgba(20,14,10,0.18)');
  g.addColorStop(1, 'rgba(20,10,8,0.62)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // logo
  const bob = Math.sin(time * 0.8) * 3;
  title(ctx, 'AURELIA BAY', VIEW_W / 2, 148 + bob, 76, '#e8c94a');
  ctx.font = 'italic bold 30px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f7c8a0';
  ctx.fillText('Golden Hour', VIEW_W / 2, 190 + bob);
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#c9cdd4';
  ctx.fillText('an open-world crime story by the bay', VIEW_W / 2, 218 + bob);
  if (game.storyComplete) {
    ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#6dbb4e';
    ctx.fillText('STORY COMPLETE - free roam unlocked', VIEW_W / 2, 244 + bob);
  }
  // menu
  const menu = [game.saveExists ? 'NEW GAME' : 'NEW GAME', game.saveExists ? 'CONTINUE' : 'NO SAVE YET', 'CONTROLS'];
  const my = 316 + bob;
  panel(ctx, VIEW_W / 2 - 190, my - 26, 380, 128);
  menuItem(ctx, menu[0], VIEW_W / 2, my + 10, game.menuIndex === 0);
  if (game.saveExists) menuItem(ctx, menu[1], VIEW_W / 2, my + 46, game.menuIndex === 1);
  else {
    ctx.font = 'bold 18px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(201,205,212,0.4)';
    ctx.fillText('NO SAVE YET', VIEW_W / 2, my + 46);
  }
  menuItem(ctx, menu[2], VIEW_W / 2, my + 82, game.menuIndex === 2);
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8b93a3';
  ctx.fillText('Arrow keys choose   Enter select   M mute', VIEW_W / 2, my + 128);
}

function drawIntro(ctx, game) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, 'rgba(16,12,8,0.94)');
  g.addColorStop(1, 'rgba(16,12,8,0.88)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  title(ctx, 'AURELIA BAY', VIEW_W / 2, 120, 54, '#e8c94a', false);
  ctx.font = 'italic bold 22px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f7c8a0';
  ctx.fillText('5:45 PM. The sun will not set on this town.', VIEW_W / 2, 152);
  const lines = [
    'Naia Cruz runs packages for Santos Vale, the fixer who owns the',
    'west docks. Four jobs stand between her and a clean way out:',
    'a marked car, a jewelry store, a park full of broken promises,',
    'and one last run across the bridge before the sirens close in.',
    '',
    'Drive fast. Stay alive. Golden hour waits for no one.',
  ];
  ctx.font = '17px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#d9dde3';
  for (let k = 0; k < lines.length; k++) ctx.fillText(lines[k], VIEW_W / 2, 216 + k * 30);
  const blink = Math.sin(game.time * 5) > -0.3;
  if (blink) {
    ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#e8c94a';
    ctx.fillText('Press Enter to take the first job', VIEW_W / 2, 470);
  }
}

function drawControls(ctx, game) {
  ctx.fillStyle = 'rgba(12,14,16,0.9)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  title(ctx, 'CONTROLS', VIEW_W / 2, 70, 42, '#e8c94a');
  const rows = [
    ['W A S D / Arrows', 'move'],
    ['Mouse', 'aim'],
    ['Left click', 'shoot pistol'],
    ['R', 'reload'],
    ['F', 'punch'],
    ['Shift', 'sprint'],
    ['E', 'enter / exit car, rob store'],
    ['H', 'horn'],
    ['Esc', 'pause'],
    ['M', 'mute audio'],
  ];
  const x0 = VIEW_W / 2 - 240;
  ctx.textAlign = 'left';
  for (let k = 0; k < rows.length; k++) {
    const y = 130 + k * 38;
    if (k % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(x0 - 20, y - 26, 520, 34);
    }
    ctx.font = 'bold 17px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#e8c94a';
    ctx.fillText(rows[k][0], x0, y);
    ctx.font = '15px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#c9cdd4';
    ctx.fillText(rows[k][1], x0 + 250, y);
  }
  const blink = Math.sin(game.time * 5) > -0.3;
  if (blink) {
    ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8c94a';
    ctx.fillText('Press Esc to go back', VIEW_W / 2, 610);
  }
}

function drawPause(ctx, game) {
  ctx.fillStyle = 'rgba(10,12,14,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  title(ctx, 'PAUSED', VIEW_W / 2, 150, 58, '#e8e4d8');
  const menu = ['RESUME', game.audio.isMuted() ? 'AUDIO: OFF' : 'AUDIO: ON', 'CONTROLS', 'QUIT TO TITLE'];
  for (let k = 0; k < menu.length; k++) {
    menuItem(ctx, menu[k], VIEW_W / 2, 260 + k * 46, game.menuIndex === k);
  }
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8b93a3';
  ctx.fillText('Esc resume   M mute anywhere', VIEW_W / 2, 470);
}

function drawComplete(ctx, game) {
  const c = game.completeInfo;
  ctx.fillStyle = 'rgba(10,12,14,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, VIEW_W / 2 - 250, 150, 500, 330);
  title(ctx, 'MISSION PASSED', VIEW_W / 2, 216, 40, '#6dbb4e');
  ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8c94a';
  ctx.fillText(c.title, VIEW_W / 2, 260);
  ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#6dbb4e';
  ctx.fillText(`Reward  +$${c.reward}`, VIEW_W / 2, 306);
  ctx.font = '16px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#c9cdd4';
  ctx.fillText(`Time  ${c.timeText}      Balance  $${game.money.toLocaleString('en-US')}`, VIEW_W / 2, 348);
  if (c.last) {
    ctx.fillStyle = '#e8c94a';
    ctx.font = 'bold 18px "Trebuchet MS", sans-serif';
    ctx.fillText('The story is over. The city is yours.', VIEW_W / 2, 392);
  }
  const blink = Math.sin(game.time * 5) > -0.3;
  if (blink) {
    ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#e8c94a';
    ctx.fillText('Press Enter to keep playing', VIEW_W / 2, 452);
  }
}

function drawEnding(ctx, game, word, color, sub) {
  const flash = 0.55 + Math.sin(game.time * 7) * 0.2;
  ctx.fillStyle = `rgba(${word === 'BUSTED' ? '20,40,90' : '120,20,20'},${flash * 0.55})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  title(ctx, word, VIEW_W / 2, 300, 88, color);
  ctx.font = 'bold 17px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8e4d8';
  ctx.fillText(sub, VIEW_W / 2, 352);
  ctx.fillText(`Cash  $${game.money.toLocaleString('en-US')}`, VIEW_W / 2, 384);
  const blink = Math.sin(game.time * 5) > -0.3;
  if (blink) {
    ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#e8c94a';
    ctx.fillText('Press Enter to respawn at the safehouse', VIEW_W / 2, 440);
  }
}
