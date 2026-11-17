// Progress persistence: one save in localStorage. Auto-saved on mission complete.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return { money: Number(data.money) || 0, mission: Number(data.mission) || 0, x: Number(data.x), y: Number(data.y), complete: Boolean(data.complete) };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money, mission: state.missionId, x: state.player.x, y: state.player.y, complete: state.storyComplete,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
