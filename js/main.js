// Запуск игры, цикл крутки с выбором «продать/в гараж», заряженные крутки удачи,
// автокрутка, торговая площадка, тест-хук __nom.
(async () => {
  await State.load();
  UI.init();
  Phone.init();

  const $spin = document.getElementById('spinBtn');
  let spinning = false;
  let pending = null;     // {plate, rarity, resolve} — ждём решения игрока
  let forceNext = null;   // __nom.forceRarity
  let lastSpinEnd = 0;
  let raidUntil = 0;      // облава активна до этого момента (ms)
  let devLuck = 1;        // меню разработчика: множитель бросков на все крутки
  let devNextTries = 0;   // меню разработчика: заряд на одну следующую крутку

  function raidActive() { return Date.now() < raidUntil; }
  function startRaid() {
    raidUntil = Date.now() + CFG.RAID.DURATION_MS;
    State.raidStarted();
    UI.setRaid(raidUntil);
    Snd.jingle('epic');
    UI.toast('🚨 ОБЛАВА! 60 секунд — каждая крутка бросает 2 номера!');
    setTimeout(() => { if (!raidActive()) { UI.setRaid(0); UI.showEvents(State.checkNow()); } },
      CFG.RAID.DURATION_MS + 100);
  }

  function fmt(n) { return n.toLocaleString('ru-RU'); }

  function spinDuration() {
    const s = State.get();
    if (s.settings.fast) return CFG.FAST_SPIN_MS;
    return Math.round(CFG.SPIN_BASE_MS * Math.pow(CFG.SPIN_SPEED_FACTOR, s.up.speed));
  }

  function autoKeepTier() {
    const k = State.get().settings.autoKeep;
    return k === 'none' ? 99 : CFG.TIER[k];
  }

  function resolveChoice(keep) {
    if (!pending) return;
    if (keep && !State.canKeep(pending.plate)) { // гараж полон — продай или освободи место
      Snd.deny();
      UI.toast(`🏠 Гараж полон (${State.garageUsed()}/${State.garageCap()}) — продай номер или расширь гараж в магазине`);
      return;
    }
    const { plate, rarity, resolve } = pending;
    pending = null;
    UI.hideChoice();
    let events = [];
    if (keep) {
      events = State.keepPlate(plate, rarity);
      UI.toast('В гараж!');
      Snd.open();
    } else {
      const v = State.sellPending(plate);
      UI.toast(`Продано: +${UI.money(v, plate)}`);
      Snd.buy();
    }
    events = events.concat(State.checkNow()); // ачивки и вехи сразу, а не при заходе в магазин
    UI.markChoiceDone(keep, State.sellValue(plate), plate);
    UI.refreshHUD();
    if (events.length) UI.showEvents(events);
    resolve(keep);
  }

  // Заряженная крутка: какая по счёту следующая и что ей положено
  function nextCharge() {
    const n = State.get().spins + 1;
    return CFG.CHARGES.find(c => n % c.every === 0) || null;
  }

  // opts: { instant } — без анимации; { auto } — решение принимает автомат (автокрутка/__nom);
  //       { minTier, vipCost } — VIP-гарант (ставится в doSpin по выбранной кнопке)
  async function spin(opts = {}) {
    if (spinning || pending) return null;
    const s = State.get();
    const charge = nextCharge();
    let freeSale = false;
    if (opts.minTier) {
      if (!State.payVip(opts.vipCost)) {
        Snd.deny();
        UI.toast('Не хватает на гарант — режим сброшен');
        UI.setVipSel(null);
        UI.refreshHUD();
        return null;
      }
    } else {
      freeSale = State.paySpin(); // нет денег: бесплатно, но всё продаётся
    }
    spinning = true;
    $spin.disabled = true;
    const lvlBefore = s.level;
    // результат считается ДО анимации — визуал только показывает его.
    // Заряд/билет = несколько бросков, берём лучший; облава удваивает броски;
    // удача даёт шанс на второй бросок.
    let tries = 1, how = null;
    if (charge) { tries = charge.mult; how = 'charge' + charge.mult; }
    else if (!opts.auto && State.useTicket()) {
      tries = CFG.LEVEL.TICKET_TRIES;
      how = 'ticket';
      UI.toast(`🎟 Билет заряда: лучший из ${tries}!`);
    }
    if (raidActive()) { tries *= CFG.RAID.TRIES_MULT; how = how || 'raid'; }
    if (devNextTries) { tries = Math.max(tries, devNextTries); devNextTries = 0; }
    if (tries === 1 && Math.random() < s.up.luck * CFG.LUCK_PER_LVL) tries = 2;
    tries *= devLuck;
    UI.refreshHUD();
    const res = Plates.rollSpin(Math.random, {
      pity: s.pity,
      force: forceNext,
      tries,
      minTier: opts.minTier || 0,
      pinnedReg: State.pinFor(),
      mode: s.mode, isTaken: State.isTaken,
    });
    forceNext = null;
    if (charge) UI.toast(`⚡ Крутка удачи ${charge.mult}×!`);
    Snd.click();
    // мифик и секрет уходят в «чёрный конверт»: табличка садится чёрной заглушкой, без спойлеров
    const dark = res.tier >= CFG.TIER.mythic && !s.settings.lowfx;
    await UI.animateSpin(opts.instant ? 0 : spinDuration(), res.plate, res.rarity, dark);
    const out = State.registerSpin(res.plate, res.rarity,
      { trig: res.trig, charge: !!charge,
        how: how || (opts.minTier ? 'vip' : res.trig ? 'pity' : 'luck') });
    UI.refreshHUD();
    if (State.get().level > lvlBefore) UI.levelUp(State.get().level);
    if (!dark) Snd.jingle(res.rarity);

    // эффекты по редкости
    const rc = CFG.RARITIES[res.tier];
    const box = document.getElementById('plateBox').getBoundingClientRect();
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    if (dark) {
      await UI.darkReveal(res.plate, res.rarity);
      UI.showPlate(res.plate, res.rarity, 'landed blackPlate');
      FX.flash(rc.color);
    } else if (res.tier >= CFG.TIER.epic) {
      FX.burst(cx, cy, [rc.color, '#ffffff'], 40 + res.tier * 20, 1 + res.tier * 0.2);
    }
    if (!dark && res.tier >= CFG.TIER.legendary) {
      FX.flash(rc.color);
      FX.rain([rc.color, '#ffe17d', '#ffffff'], 120);
      if (!s.settings.lowfx) await UI.bigMoment(res.plate, res.rarity);
    }
    if (res.trig) UI.toast(res.trig === 'rare' ? 'Гарант: редкий номер!' : 'Гарант: легендарный номер!');
    let kept = false;
    if (out.kind === 'choice') {
      if (freeSale || opts.auto) {
        // авто-решение: без денег всё продаётся, автокрутка — по настройке
        kept = !freeSale && res.tier >= autoKeepTier() && State.canKeep(res.plate);
        let events;
        if (kept) events = State.keepPlate(res.plate, res.rarity);
        else { State.sellPending(res.plate); events = State.checkNow(); }
        UI.showResult(res, { kind: 'auto', kept, value: out.value });
        if (events.length) UI.showEvents(events);
      } else {
        // игрок решает сам
        UI.showResult(res, out);
        UI.showChoice(res.plate);
        kept = await new Promise(resolve => { pending = { plate: res.plate, rarity: res.rarity, resolve }; });
      }
    } else {
      UI.showResult(res, out);
      if (out.events && out.events.length) UI.showEvents(out.events);
    }

    UI.feedPush(res.plate, res.rarity);
    UI.refreshHUD();
    spinning = false;
    lastSpinEnd = Date.now();
    $spin.disabled = false;
    if (!raidActive() && State.get().spins >= CFG.RAID.MIN_SPINS && Math.random() < CFG.RAID.CHANCE) startRaid();
    return Object.assign({ kept }, res, out);
  }

  // --- управление ---
  // крутка учитывает выбранный гарант
  function doSpin(extra = {}) {
    const v = UI.getVipSel();
    if (v !== null) return spin(Object.assign({ minTier: CFG.TIER[State.vipList()[v].key], vipCost: State.vipCost(v) }, extra));
    return spin(extra);
  }
  $spin.onclick = () => doSpin();
  document.getElementById('btnKeep').onclick = () => resolveChoice(true);
  document.getElementById('btnSell').onclick = () => resolveChoice(false);

  document.addEventListener('keydown', e => {
    // ` (Ё) — меню разработчика: открыть/закрыть
    if (e.code === 'Backquote' && !e.target.closest('input')) {
      e.preventDefault();
      const dev = document.getElementById('dev');
      if (dev.classList.contains('hidden')) UI.openOverlay('dev'); else UI.closeOverlay('dev');
      return;
    }
    if (Phone.isOpen() || e.target.closest('input, textarea, select')) return;
    const ovOpen = document.querySelector('.overlay:not(.hidden)') ||
      !document.getElementById('bigMoment').classList.contains('hidden');
    if (ovOpen) return;
    if (pending) { // быстрый выбор: Пробел — продать (фарм-поток), Enter — в гараж
      if (e.code === 'Enter' || e.code === 'KeyG') { e.preventDefault(); resolveChoice(true); }
      if (e.code === 'Space' || e.code === 'KeyX' || e.code === 'Backspace') { e.preventDefault(); resolveChoice(false); }
      return;
    }
    if (e.code === 'Space' && !e.repeat) { e.preventDefault(); doSpin(); }
  });

  // автокрутка: решения принимает сама, но ПЕРЕД заряженной круткой останавливается —
  // заряды игрок крутит лично
  let chargeNotified = false;
  setInterval(() => {
    const s = State.get();
    if (s.up.auto === 0 || !s.settings.autoOn || spinning || pending) return;
    const ch = nextCharge();
    if (ch) {
      if (!chargeNotified) {
        chargeNotified = true;
        UI.toast(`⚡ Заряженная крутка ${ch.mult}× готова — крути сам!`);
        Snd.reward();
      }
      return;
    }
    chargeNotified = false;
    const pause = CFG.AUTO_PAUSE_MS[s.up.auto - 1];
    if (Date.now() - lastSpinEnd >= pause) doSpin({ auto: true });
  }, 120);

  // периодический сейв; незакрытый выбор при выходе уходит в гараж
  setInterval(() => State.doSave(), 30000);
  window.addEventListener('beforeunload', () => {
    if (pending && State.canKeep(pending.plate)) State.keepPlate(pending.plate, pending.rarity);
    else if (pending) State.sellPending(pending.plate);
  });

  // --- тест-хук для headless-прогона ---
  window.__nom = {
    state: () => State.get(),
    spin: () => spin({ instant: true, auto: true }),
    async spinMany(n) { // быстрый прогон без анимации и UI, решения — по настройке автокрутки
      const s = State.get();
      let last = null;
      for (let i = 0; i < n; i++) {
        State.paySpin();
        const ch = nextCharge();
        const res = Plates.rollSpin(Math.random, { pity: s.pity,
          tries: ch ? ch.mult : 1, pinnedReg: State.pinFor(), mode: s.mode, isTaken: State.isTaken });
        const out = State.registerSpin(res.plate, res.rarity,
          { trig: res.trig, charge: !!ch, how: ch ? 'charge' + ch.mult : (res.trig ? 'pity' : 'luck') });
        if (out.kind === 'choice') {
          if (res.tier >= autoKeepTier() && State.canKeep(res.plate)) State.keepPlate(res.plate, res.rarity);
          else State.sellPending(res.plate);
        }
        last = Object.assign({}, res, out);
      }
      UI.refreshHUD();
      if (last) UI.showPlate(last.plate, last.rarity, 'landed');
      return last;
    },
    choose: keep => resolveChoice(keep),
    forceRarity(key) { forceNext = key; },
    give(n) { State.get().money += n; State.markDirty(); UI.refreshHUD(); },
    buy: k => { const ok = State.buyUpgrade(k); UI.refreshHUD(); return ok; },
    setReg: r => { State.setRegion(r); UI.refreshHUD(); },
    sellGarage: p => { const v = State.sellFromGarage(p); UI.refreshHUD(); return v; },
    raidNow: () => startRaid(),
    setMode: m => { State.setMode(m); UI.refreshHUD(); },
    giveUsd: n => { State.get().us.usd += n; State.markDirty(); UI.refreshHUD(); },
    setDevLuck: n => { devLuck = Math.max(1, n | 0); UI.refreshHUD(); },
    devLuck: () => devLuck,
    setNextTries: n => { devNextTries = n | 0; },
    nextTries: () => devNextTries,
    forced: () => forceNext,
    buyVisa: () => { const ok = State.buyVisa(); UI.refreshHUD(); return ok; },
    giveTicket: () => { State.get().tickets++; UI.refreshHUD(); },
    save: () => State.doSave(),
    reset: () => { State.reset(); UI.refreshHUD(); },
    open: id => UI.openOverlay(id),
    close: id => UI.closeOverlay(id),
  };
})();
