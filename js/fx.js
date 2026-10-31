// Частицы и вспышки на канвасе поверх интерфейса.
// Виды частиц: конфетти (burst/rain), угольки (embers — поднимаются, светятся), монеты (coins — падают
// и переворачиваются), волны (ring — расходящееся кольцо). Плюс вспышка экрана и тряска.
const FX = (() => {
  let cv, cx, parts = [], rings = [], raf = 0;

  function init() {
    cv = document.getElementById('fx');
    cx = cv.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    cv.width = window.innerWidth;
    cv.height = window.innerHeight;
  }
  function lowfx() { return State.get().settings.lowfx; }
  const pickC = colors => colors[Math.floor(Math.random() * colors.length)];
  function start() { if (!raf) raf = requestAnimationFrame(loop); }

  function burst(x, y, colors, n, power = 1) {
    if (lowfx()) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (2 + Math.random() * 6) * power;
      parts.push({ k: 'bit', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, g: 0.12,
        life: 1, decay: 0.012 + Math.random() * 0.02, c: pickC(colors), r: 2 + Math.random() * 4, spin: Math.random() * 6 });
    }
    start();
  }

  function rain(colors, n) { // конфетти сверху на весь экран
    if (lowfx()) return;
    for (let i = 0; i < n; i++) {
      parts.push({ k: 'bit', x: Math.random() * cv.width, y: -10 - Math.random() * cv.height * 0.3,
        vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 4, g: 0.12,
        life: 1, decay: 0.004 + Math.random() * 0.006, c: pickC(colors), r: 3 + Math.random() * 4, spin: Math.random() * 6 });
    }
    start();
  }

  // угольки: поднимаются снизу, покачиваются, светятся (мифик)
  function embers(colors, n) {
    if (lowfx()) return;
    for (let i = 0; i < n; i++) {
      parts.push({ k: 'ember', x: Math.random() * cv.width, y: cv.height + Math.random() * 80,
        vx: (Math.random() - 0.5) * 0.6, vy: -(1 + Math.random() * 2.4), g: -0.004, wob: Math.random() * 6,
        life: 1, decay: 0.004 + Math.random() * 0.006, c: pickC(colors), r: 1.5 + Math.random() * 3 });
    }
    start();
  }

  // золотые монеты дождём: падают и переворачиваются (божественный, крупные продажи)
  function coins(n, x, y) {
    if (lowfx()) return;
    for (let i = 0; i < n; i++) {
      const fromPoint = x !== undefined;
      parts.push({ k: 'coin', x: fromPoint ? x : Math.random() * cv.width, y: fromPoint ? y : -20 - Math.random() * cv.height * 0.4,
        vx: fromPoint ? (Math.random() - 0.5) * 9 : (Math.random() - 0.5) * 1.5, vy: fromPoint ? -4 - Math.random() * 6 : 2 + Math.random() * 3,
        g: 0.18, life: 1, decay: 0.006 + Math.random() * 0.006, r: 6 + Math.random() * 5, spin: Math.random() * 6 });
    }
    start();
  }

  // монеты летят из точки в кошелёк в шапке (продажа)
  function coinsTo(x, y, tx, ty, n = 10) {
    if (lowfx()) return;
    for (let i = 0; i < n; i++) {
      parts.push({ k: 'fly', x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 20, tx, ty,
        t: -i * 0.05, life: 1, decay: 0, r: 5 + Math.random() * 2, spin: Math.random() * 6 });
    }
    start();
  }

  // взрыв: огненный шар разлетается и гаснет, следом дым и ударные волны (мифик)
  function explode(x, y) {
    if (lowfx()) return;
    const fire = ['#fffbe0', '#ffe08a', '#ffb347', '#ff7a2f', '#ff3b30', '#b3261e'];
    for (let i = 0; i < 460; i++) {
      const a = Math.random() * Math.PI * 2, sp = Math.pow(Math.random(), 0.55) * 34;
      parts.push({ k: 'fire', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.05, drag: 0.92,
        life: 1, decay: 0.006 + Math.random() * 0.012, c: pickC(fire), r: 4 + Math.random() * 11 });
    }
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, sp = Math.random() * 6;
      parts.push({ k: 'smoke', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, g: -0.02, drag: 0.95,
        life: 1, decay: 0.006 + Math.random() * 0.006, c: '#3a3436', r: 18 + Math.random() * 30 });
    }
    ring(x, y, '#fffbe0', 380); setTimeout(() => ring(x, y, '#ff7a2f', 640), 90); setTimeout(() => ring(x, y, '#ff3b30', 900), 200);
    setTimeout(() => { for (let i = 0; i < 140; i++) { const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 10;
      parts.push({ k: 'fire', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.12, drag: 0.97, life: 1, decay: 0.01 + Math.random() * 0.01, c: pickC(fire), r: 2 + Math.random() * 3 }); } start(); }, 160); // догорающие искры
    flash('#ffd7a8');
    shake(4);
    start();
  }

  // расходящееся кольцо-волна
  function ring(x, y, color, maxR = 420) {
    if (lowfx()) return;
    rings.push({ x, y, c: color, r: 10, maxR, life: 1 });
    start();
  }

  function loop() {
    cx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      if (p.k === 'fly') { // полёт по дуге в кошелёк
        p.t += 0.035;
        if (p.t < 0) continue;
        const t = Math.min(1, p.t), e = t * t * (3 - 2 * t);
        const sx = p.sx ?? (p.sx = p.x), sy = p.sy ?? (p.sy = p.y);
        p.x = sx + (p.tx - sx) * e;
        p.y = sy + (p.ty - sy) * e - Math.sin(t * Math.PI) * 120;
        if (t >= 1) p.life = 0;
      } else {
        p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life -= p.decay;
        if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
        if (p.k === 'ember') p.x += Math.sin((p.wob += 0.08)) * 0.6;
      }
      p.spin = (p.spin || 0) + 0.12;
      cx.globalAlpha = Math.max(0, Math.min(1, p.life));
      if (p.k === 'fire') { // огонь: светящийся круг, с угасанием краснеет и уменьшается
        cx.shadowColor = p.c; cx.shadowBlur = 18; cx.fillStyle = p.c;
        cx.beginPath(); cx.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, Math.PI * 2); cx.fill();
        cx.shadowBlur = 0;
      } else if (p.k === 'smoke') {
        cx.globalAlpha = Math.max(0, p.life) * 0.18; cx.fillStyle = p.c;
        cx.beginPath(); cx.arc(p.x, p.y, p.r * (2 - p.life), 0, Math.PI * 2); cx.fill();
      } else if (p.k === 'ember') {
        cx.shadowColor = p.c; cx.shadowBlur = 12; cx.fillStyle = p.c;
        cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.fill();
        cx.shadowBlur = 0;
      } else if (p.k === 'coin' || p.k === 'fly') { // монета: эллипс, «переворачивается»
        const w = Math.abs(Math.cos(p.spin)) * p.r + 1;
        const g = cx.createLinearGradient(p.x - w, p.y, p.x + w, p.y);
        g.addColorStop(0, '#a8740f'); g.addColorStop(0.5, '#ffe68a'); g.addColorStop(1, '#c48a12');
        cx.fillStyle = g;
        cx.beginPath(); cx.ellipse(p.x, p.y, w, p.r, 0, 0, Math.PI * 2); cx.fill();
      } else {
        cx.fillStyle = p.c;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.spin);
        cx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
        cx.restore();
      }
    }
    rings = rings.filter(r => r.life > 0);
    for (const r of rings) {
      r.r += (r.maxR - r.r) * 0.07 + 2; r.life -= 0.022;
      cx.globalAlpha = Math.max(0, r.life);
      cx.strokeStyle = r.c; cx.lineWidth = 6 * r.life + 1;
      cx.shadowColor = r.c; cx.shadowBlur = 20;
      cx.beginPath(); cx.arc(r.x, r.y, r.r, 0, Math.PI * 2); cx.stroke();
      cx.shadowBlur = 0;
    }
    cx.globalAlpha = 1;
    raf = (parts.length || rings.length) ? requestAnimationFrame(loop) : 0;
    if (!raf) cx.clearRect(0, 0, cv.width, cv.height);
  }

  function flash(color) {
    if (lowfx()) return;
    const el = document.createElement('div');
    el.className = 'flash';
    el.style.background = color;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 650);
  }

  // тряска экрана: power 1 — лёгкая, 3 — сильная
  function shake(power = 1) {
    if (lowfx()) return;
    const app = document.getElementById('app');
    app.style.setProperty('--shake', power * 4 + 'px');
    app.classList.remove('shaking'); void app.offsetWidth; app.classList.add('shaking');
    setTimeout(() => app.classList.remove('shaking'), 600);
  }

  return { init, burst, rain, flash, embers, coins, coinsTo, ring, shake, explode };
})();
