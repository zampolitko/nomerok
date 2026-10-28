// Звук через WebAudio, без файлов. Snd.* уважает настройки громкости.
const Snd = (() => {
  let ctx = null;
  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function vol() {
    const st = State.get().settings;
    return st.sound ? st.vol : 0;
  }
  function tone(freq, dur, { type = 'square', v = 0.15, when = 0, slide = 0 } = {}) {
    const master = vol();
    if (!master) return;
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(v * master, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  // гаммы фанфар по редкости: чем выше тир — тем длиннее и торжественнее
  const JINGLES = {
    common:    { notes: [440], step: 0, type: 'triangle', v: 0.10 },
    uncommon:  { notes: [523, 659], step: 0.09, type: 'triangle', v: 0.14 },
    rare:      { notes: [523, 659, 784], step: 0.09, type: 'triangle', v: 0.16 },
    epic:      { notes: [523, 659, 784, 1047], step: 0.1, type: 'sawtooth', v: 0.12 },
    legendary: { notes: [392, 523, 659, 784, 1047, 1319], step: 0.11, type: 'sawtooth', v: 0.13 },
    mythic:    { notes: [330, 392, 523, 659, 784, 1047, 1319, 1568], step: 0.12, type: 'sawtooth', v: 0.14 },
    secret:    { notes: [1568, 1319, 1047, 784, 1047, 1319, 1568, 2093], step: 0.1, type: 'square', v: 0.1 },
  };

  return {
    click() { tone(1800, 0.04, { type: 'square', v: 0.08 }); },
    tick()  { tone(2200, 0.025, { type: 'square', v: 0.05 }); },
    stop()  { tone(140, 0.18, { type: 'sine', v: 0.3, slide: -60 }); },
    buy()   { tone(880, 0.07, { v: 0.12 }); tone(1320, 0.1, { v: 0.12, when: 0.08 }); },
    deny()  { tone(180, 0.15, { type: 'sawtooth', v: 0.12 }); },
    open()  { tone(660, 0.05, { type: 'triangle', v: 0.1 }); },
    reward(){ tone(1047, 0.08, { v: 0.1 }); tone(1319, 0.08, { v: 0.1, when: 0.09 }); tone(1568, 0.14, { v: 0.1, when: 0.18 }); },
    // чёрный конверт: нарастающие ноты на каждый символ и финальный удар
    suspense(i) {
      const f = 170 * Math.pow(1.17, i);
      tone(f, 0.35, { type: 'sine', v: 0.2 });
      tone(f * 2, 0.12, { type: 'triangle', v: 0.07 });
    },
    boom() {
      tone(62, 0.7, { type: 'sine', v: 0.42, slide: -25 });
      tone(46, 0.9, { type: 'sine', v: 0.3, when: 0.06 });
      tone(2400, 0.08, { type: 'square', v: 0.06 });
    },
    jingle(rarity) {
      const j = JINGLES[rarity] || JINGLES.common;
      j.notes.forEach((f, i) => tone(f, 0.22, { type: j.type, v: j.v, when: i * j.step }));
    },
  };
})();
