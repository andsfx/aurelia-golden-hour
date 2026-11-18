// Progress persistence: one save in localStorage. Auto-saved on mission complete.
// The save is a single JSON blob under the key 'aurelia-bay-save' with the shape
// { money, mission, x, y, complete } - mission is the last PASSED job id (0..4), x/y is the
// respawn point, complete is the story flag. Any parse failure reads as "no save yet".
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
