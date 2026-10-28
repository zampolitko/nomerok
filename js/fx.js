// Частицы и вспышки на канвасе поверх интерфейса.
const FX = (() => {
  let cv, cx, parts = [], raf = 0;

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

  function burst(x, y, colors, n, power = 1) {
    if (lowfx()) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (2 + Math.random() * 6) * power;
      parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
        life: 1, decay: 0.012 + Math.random() * 0.02,
        c: colors[Math.floor(Math.random() * colors.length)],
        r: 2 + Math.random() * 4, spin: Math.random() * 6,
      });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function rain(colors, n) { // конфетти сверху на весь экран
    if (lowfx()) return;
    for (let i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * cv.width, y: -10 - Math.random() * cv.height * 0.3,
        vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 4,
        life: 1, decay: 0.004 + Math.random() * 0.006,
        c: colors[Math.floor(Math.random() * colors.length)],
        r: 3 + Math.random() * 4, spin: Math.random() * 6,
      });
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function loop() {
    cx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= p.decay; p.spin += 0.1;
      cx.globalAlpha = Math.max(0, p.life);
      cx.fillStyle = p.c;
      cx.save();
      cx.translate(p.x, p.y);
      cx.rotate(p.spin);
      cx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
      cx.restore();
    }
    cx.globalAlpha = 1;
    raf = parts.length ? requestAnimationFrame(loop) : 0;
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

  return { init, burst, rain, flash };
})();
