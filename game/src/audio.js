// All sound is synthesized in WebAudio - no files, no network. The context is created on
// the first user input (browsers refuse audio before a gesture). Every voice is a small
// helper: engine hum tracks speed, the siren wobbles, gunshots are noise bursts.
import { STEP } from './config.js';

export function createAudio(rng) {
  let ctx = null;
  let master = null;
  let muted = false;
  let engine = null;    // {gain, osc, filter}
  let siren = null;     // {gain, osc, lfo, lfoGain}
  let alarmNode = null; // {gain, osc}
  let oceanNode = null; // {gain}
  let sirenOn = false;
  let alarmOn = false;
  let alarmPhase = 0;
  let gullTimer = 8;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }

  function tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (rng.next() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    toggleMute() {
      ensure();
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },

    engineStart() {
      ensure();
      if (!ctx || engine) return;
      engine = { gain: ctx.createGain(), osc: ctx.createOscillator(), filter: ctx.createBiquadFilter() };
      engine.gain.gain.value = 0;
      engine.osc.type = 'sawtooth';
      engine.osc.frequency.value = 70;
      engine.filter.type = 'lowpass';
      engine.filter.frequency.value = 320;
      engine.osc.connect(engine.filter);
      engine.filter.connect(engine.gain);
      engine.gain.connect(master);
      engine.osc.start();
    },
    engineStop() {
      if (!engine) return;
      engine.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      engine.osc.stop(ctx.currentTime + 0.4);
      engine = null;
    },
    engine(speedRatio) {
      if (!engine) return;
      const t = ctx.currentTime;
      engine.osc.frequency.setTargetAtTime(55 + speedRatio * 160, t, 0.08);
      engine.filter.frequency.setTargetAtTime(260 + speedRatio * 500, t, 0.08);
      engine.gain.gain.setTargetAtTime(0.028 + speedRatio * 0.03, t, 0.1);
    },

    siren(on, urgent) {
      ensure();
      if (!ctx) return;
      if (on && !sirenOn) {
        if (!siren) {
          siren = { gain: ctx.createGain(), osc: ctx.createOscillator(), lfo: ctx.createOscillator(), lfoGain: ctx.createGain() };
          siren.gain.gain.value = 0.05;
          siren.osc.type = 'triangle';
          siren.osc.frequency.value = 760;
          siren.lfo.type = 'sine';
          siren.lfo.frequency.value = urgent ? 7 : 4.5;
          siren.lfoGain.gain.value = 180;
          siren.lfo.connect(siren.lfoGain);
          siren.lfoGain.connect(siren.osc.frequency);
          siren.osc.connect(siren.gain);
          siren.gain.connect(master);
          siren.osc.start();
          siren.lfo.start();
        }
        sirenOn = true;
      } else if (!on && sirenOn && siren) {
        sirenOn = false;
      }
      if (siren && sirenOn) {
        siren.lfo.frequency.setTargetAtTime(urgent ? 7.5 : 4.5, ctx.currentTime, 0.3);
        siren.gain.gain.setTargetAtTime(urgent ? 0.07 : 0.05, ctx.currentTime, 0.3);
      }
    },

    alarm(on) {
      ensure();
      if (!ctx) return;
      alarmOn = on;
      if (on && !alarmNode) {
        alarmNode = { gain: ctx.createGain(), osc: ctx.createOscillator() };
        alarmNode.gain.gain.value = 0.06;
        alarmNode.osc.type = 'square';
        alarmNode.osc.frequency.value = 880;
        alarmNode.osc.connect(alarmNode.gain);
        alarmNode.gain.connect(master);
        alarmNode.osc.start();
      }
    },

    update(dt) {
      if (!ctx) return;
      if (alarmOn && alarmNode) {
        alarmPhase -= dt;
        if (alarmPhase <= 0) {
          alarmPhase = 0.42;
          alarmNode.osc.frequency.setValueAtTime(alarmNode.osc.frequency.value === 880 ? 660 : 880, ctx.currentTime);
        }
      } else if (!alarmOn && alarmNode) {
        alarmNode.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        alarmNode.osc.stop(ctx.currentTime + 0.2);
        alarmNode = null;
      }
      // occasional seagulls over the water
      gullTimer -= dt;
      if (gullTimer <= 0) {
        gullTimer = 9 + rng.range(0, 8);
        tone(1900, 0.16, 'sine', 0.012, 1200);
        tone(1500, 0.14, 'sine', 0.01, 900, 0.3);
        tone(2100, 0.12, 'sine', 0.008, 1400, 0.6);
      }
    },

    ambientOcean() {
      ensure();
      if (!ctx || oceanNode) return;
      const len = ctx.sampleRate * 4;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = last * 0.985 + (rng.next() * 2 - 1) * 0.015;
        data[i] = last;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 700;
      filter.Q.value = 0.4;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const gain = ctx.createGain();
      gain.gain.value = 0.035;
      lfo.frequency.value = 0.11;
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
      lfo.start();
      oceanNode = { gain };
    },

    gunshot() { noise(0.09, 0.5, 2600); tone(160, 0.09, 'square', 0.16, 60); },
    reload() { tone(700, 0.05, 'square', 0.05); tone(500, 0.05, 'square', 0.05, undefined, 0.09); tone(650, 0.05, 'square', 0.05, undefined, 0.18); },
    punch() { tone(200, 0.08, 'square', 0.14, 80); noise(0.06, 0.1, 900); },
    hitThud() { tone(110, 0.16, 'sine', 0.3, 45); },
    cash() { tone(880, 0.09, 'sine', 0.14); tone(1318, 0.14, 'sine', 0.14, undefined, 0.08); },
    horn() { tone(330, 0.3, 'square', 0.08); tone(415, 0.3, 'square', 0.06); },
    screech() { noise(0.16, 0.06, 3400); },
    crash() { noise(0.22, 0.4, 1400); tone(70, 0.2, 'sine', 0.3, 35); },
    missionSting() {
      tone(523, 0.14, 'square', 0.08); tone(659, 0.14, 'square', 0.08, undefined, 0.13); tone(784, 0.3, 'square', 0.09, undefined, 0.26);
    },
    heatUp() { tone(240, 0.25, 'sawtooth', 0.12, 420); },
    busted() { tone(400, 0.4, 'sawtooth', 0.12, 120); tone(300, 0.5, 'sawtooth', 0.1, 90, 0.35); },
    wasted() { tone(220, 0.7, 'sawtooth', 0.12, 60); },
    stepTick(dt) { void dt; void STEP; }, // reserved: loop pacing hooks go here
  };
}
