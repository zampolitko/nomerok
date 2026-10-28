// Весь DOM: табличка, анимация крутки, лента, гараж, магазин, настройки, тосты.
const UI = (() => {
  const $ = id => document.getElementById(id);
  const fmt = n => n.toLocaleString('ru-RU');

  // --- деньги: рубли или доллары (по номеру или по коду валюты) ---
  function money(v, plateOrCur) {
    const cur = plateOrCur === 'usd' || plateOrCur === 'rub' ? plateOrCur : State.curOfPlate(plateOrCur);
    return cur === 'usd' ? `$${fmt(v)}` : `${fmt(v)} ₽`;
  }
  // номер текстом (для тостов): у США — «CA 7ABC123»
  function plateText(plate) {
    if (!Plates.isUS(plate)) return plate;
    const p = Plates.parse(plate);
    return `${p.st} ${p.raw}`;
  }

  // --- отрисовка таблички ---
  function plateHTML(plate, rarity, extraCls = '') {
    const p = Plates.parse(plate);
    if (p.us) { // США: название штата сверху, номер, прозвище снизу; цвета штата
      const st = CFG.US_STATE[p.st] || CFG.US_STATES[0];
      return `<div class="plate usPlate r-${rarity} ${p.van ? 'usVanity' : ''} ${extraCls}"
        style="--ubg:${st.bg};--ufg:${st.fg};--uac:${st.ac}">
        <div class="usTop">${st.name}</div>
        <div class="usText">${p.raw}</div>
        <div class="usNick">${st.nick}</div>
      </div>`;
    }
    if (p.mil) { // военный: чёрная табличка «1234 АВ | 77 RUS», без флага
      return `<div class="plate milPlate r-${rarity} ${extraCls}">
        <div class="p-main"><span class="p-d">${p.d}</span><span class="p-l">${p.ls}</span></div>
        <div class="p-reg"><div class="p-regnum">${p.reg}</div><div class="p-rus">RUS</div></div>
      </div>`;
    }
    return `<div class="plate r-${rarity} ${extraCls}">
      <div class="p-main"><span class="p-l">${p.l1}</span><span class="p-d">${p.d}</span><span class="p-l">${p.l2}</span></div>
      <div class="p-reg"><div class="p-regnum">${p.reg}</div><div class="p-rus">RUS<span class="p-flag"></span></div></div>
    </div>`;
  }
  // подпись под табличкой: регион или код войск
  function plateCaption(plate) {
    const code = Plates.codeOf(plate);
    if (Plates.isUS(plate)) {
      const st = CFG.US_STATE[code];
      const t = CFG.US_TIERS[st.tier];
      return `${st.name} · ${st.nick} · ${t.name.toLowerCase()}` + (Plates.isVanity(plate) ? ' · именная табличка' : '');
    }
    if (Plates.isMil(plate)) {
      const date = Plates.milDate(plate);
      return `Код войск ${code}` + (date ? ` · ${plate.slice(0, 4)} — ${date}` : '');
    }
    return `Регион ${code} · ${CFG.REG_NAMES[code] || 'Россия'}`;
  }
  function placeholder() {
    const s = State.get();
    if (s.mode === 'us') return 'US:' + (s.us.state || 'CA') + ':• • • • • • •';
    return s.mode === 'mil' ? '····АА10' : 'А···АА77';
  }

  function showPlate(plate, rarity, cls = '') {
    $('plateBox').innerHTML = plateHTML(plate, rarity, cls);
  }

  // --- анимация крутки: мелькание с замедлением ---
  // blind: финал показывается чёрной заглушкой (интригу раскроет чёрный конверт)
  // слоты результата фиксированные — контент очищается, высота не прыгает
  function hideResult() {
    clearBd();
    $('riRarity').textContent = '';
    $('riChance').textContent = '';
    $('riBars').innerHTML = '';
    $('plateCaption').textContent = '';
    $('breakdown').innerHTML = '';
    $('riNew').textContent = '';
    $('riReward').textContent = '';
    $('bragBtn').classList.add('hidden');
  }
  function animateSpin(duration, finalPlate, finalRarity, blind) {
    hideResult();
    const land = () => showPlate(finalPlate, blind ? 'common' : finalRarity, blind ? 'landed blinded' : 'landed');
    return new Promise(resolve => {
      if (duration <= 0) {
        land();
        resolve();
        return;
      }
      const t0 = performance.now();
      function step() {
        const t = (performance.now() - t0) / duration; // 0..1
        if (t >= 1) {
          land();
          Snd.stop();
          resolve();
          return;
        }
        showPlate(Plates.randomVisual(Math.random, State.pinFor(), State.get().mode), 'common', 'spinning');
        Snd.tick();
        // интервал растёт от 45мс к ~260мс — эффект замедления
        setTimeout(step, 45 + 215 * t * t);
      }
      step();
    });
  }

  // --- результат: редкость с полосками, разбивка по очереди, цена растёт на глазах ---
  let bdTimers = [];
  function clearBd() { bdTimers.forEach(clearTimeout); bdTimers = []; }

  // плавный счётчик цены
  function animateCount(el, from, to, ms, render) {
    const t0 = performance.now();
    function step() {
      const k = Math.min(1, (performance.now() - t0) / ms);
      el.textContent = render(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 2))));
      if (k < 1 && !el.dataset.stop) requestAnimationFrame(step);
    }
    step();
  }

  function showResult(res, out) {
    clearBd();
    const rc = CFG.RARITIES[res.tier];
    lastBrag = { plate: res.plate, tier: res.tier, value: out.value };
    $('bragBtn').classList.remove('hidden');
    // редкость над табличкой + полоски (чем больше, тем выше редкость)
    const rr = $('riRarity');
    rr.textContent = rc.name.toUpperCase();
    rr.style.color = rc.color;
    rr.style.textShadow = `0 0 14px ${rc.color}`;
    const chance = Plates.isUS(res.plate) ? CFG.US.CHANCES[res.tier] : Plates.isMil(res.plate) ? CFG.MIL.CHANCES[res.tier] : rc.chance;
    $('riChance').textContent = chance ? `1 к ${fmt(chance)}` : 'каждый второй';
    $('riBars').innerHTML = CFG.RARITIES.map((_, i) =>
      `<span class="riBar ${i <= res.tier ? 'on' : ''}" style="${i <= res.tier ? `background:${rc.color};box-shadow:0 0 8px ${rc.color}` : ''}"></span>`
    ).join('');
    // подпись региона
    const reg = Plates.codeOf(res.plate);
    $('plateCaption').textContent = plateCaption(res.plate);
    // статус
    const rn = $('riNew');
    if (out.kind === 'dup') {
      rn.textContent = `повтор ×${out.count} — продан`;
      rn.className = 'isdup';
    } else if (out.kind === 'choice') {
      rn.textContent = 'НОВЫЙ!';
      rn.className = 'isnew';
    } else {
      rn.textContent = out.kept ? 'НОВЫЙ — в гараж!' : 'НОВЫЙ — продан';
      rn.className = out.kept ? 'isnew' : 'isdup';
    }
    $('riReward').textContent = '';

    // разбивка: НАСТОЯЩИЕ множители сочетаний, по строке за раз, цена нарастает
    const us = Plates.isUS(res.plate);
    const mil = Plates.isMil(res.plate);
    // множитель места: регион России или тир штата США; у военных его нет
    const rt = us ? Object.assign({}, CFG.US_TIERS[CFG.US_STATE[reg].tier], { name: 'штат: ' + CFG.US_TIERS[CFG.US_STATE[reg].tier].name })
      : mil ? null : CFG.REG_TIER[reg];
    const multLvl = State.get().up.mult;
    const sec = Plates.secretOf(res.plate);
    const blat = Plates.blatOf(res.plate);
    const legendName = Plates.mythicName(res.plate);
    const base = us ? CFG.US.PLATE_BASE : mil ? CFG.MIL.PLATE_BASE : CFG.PLATE_BASE;
    let running = base;
    const steps = [{ label: us ? 'Базовый американский номер' : mil ? 'Базовый военный номер' : 'Базовый номер',
      val: money(base, res.plate), price: running }];
    for (const c of Plates.combosOf(res.plate)) {
      running *= c.mult;
      const label = c.id === 'blat' && blat ? `Блатная серия ${blat.name}`
        : c.id === 'mhist' ? `Великая дата: ${Plates.milDate(res.plate)}`
        : c.id === 'udate' ? `${c.name}: ${CFG.US_DATES[Plates.parse(res.plate).dg]}`
        : (c.id === 'uvan' || c.id === 'uvtop') ? `${c.name}: ${Plates.parse(res.plate).t}` : c.name;
      steps.push({ label, val: '×' + c.mult, price: running });
    }
    if (sec) {
      const k = Plates.plateMult(res.plate) / Plates.comboMult(res.plate);
      running *= k;
      steps.push({ label: `Секретный номер «${sec.name}»`, val: '×' + fmt(Math.round(k)), price: running });
    }
    if (legendName) steps.push({ label: `Именная легенда «${legendName}»`, val: '✦', price: null });
    if (State.isUnique(res.plate)) steps.push({ label: '🔒 Единственный экземпляр в игре', val: '✦', price: null });
    if (rt && rt.sellMult > 1) {
      running *= rt.sellMult;
      steps.push({ label: us ? rt.name[0].toUpperCase() + rt.name.slice(1) : `Регион ${rt.name.toLowerCase()}`,
        val: '×' + rt.sellMult, price: running });
    }
    if (multLvl > 0) {
      running *= (1 + 0.2 * multLvl);
      steps.push({ label: `Множитель денег (ур. ${multLvl})`, val: '×' + (1 + 0.2 * multLvl).toFixed(1), price: running });
    }
    const p3 = out.value; // точная финальная цена
    const bd = $('breakdown');
    bd.innerHTML = '';
    // куда тикает цена: на кнопку продажи (выбор) или в строку награды (авто-продажа)
    const sellsAuto = out.kind === 'dup' || (out.kind === 'auto' && !out.kept);
    const priceEl = out.kind === 'choice' ? $('btnSell') : (sellsAuto ? $('riReward') : null);
    const renderPrice = out.kind === 'choice'
      ? v => `💰 Продать за ${money(v, res.plate)}`
      : v => `+${money(v, res.plate)}`;
    if (priceEl) { delete priceEl.dataset.stop; priceEl.textContent = renderPrice(0); }

    let shownPrice = 0;
    steps.forEach((st, i) => {
      bdTimers.push(setTimeout(() => {
        const row = document.createElement('div');
        row.className = 'bdRow bdAnim';
        row.innerHTML = `<span>${st.label}</span><span class="bdVal">${st.val}</span>`;
        bd.appendChild(row);
        bd.scrollTop = bd.scrollHeight;
        Snd.tick();
        if (st.price !== null && priceEl) {
          animateCount(priceEl, shownPrice, Math.round(st.price), 260, renderPrice);
          shownPrice = Math.round(st.price);
        }
        if (i === steps.length - 1 && priceEl) {
          bdTimers.push(setTimeout(() => { priceEl.textContent = renderPrice(p3); }, 320));
        }
      }, 160 + i * 260));
    });
  }

  // --- выбор: продать или в гараж (цену на кнопку рисует анимация разбивки) ---
  function showChoice(plate) {
    const room = !plate || State.canKeep(plate);
    $('btnKeep').textContent = room ? '🏠 В гараж' : `🏠 Гараж полон ${State.garageUsed()}/${State.garageCap()}`;
    $('btnKeep').classList.toggle('keepFull', !room);
    $('choiceRow').classList.remove('hidden');
    $('spinBtn').classList.add('hidden');
  }
  // итог после решения — без перезапуска разбивки
  function markChoiceDone(kept, value, plate) {
    const rn = $('riNew');
    rn.textContent = kept ? 'НОВЫЙ — в гараж!' : 'НОВЫЙ — продан';
    rn.className = kept ? 'isnew' : 'isdup';
    $('riReward').textContent = kept ? '' : `+${money(value, plate || 'rub')}`;
  }
  function hideChoice() {
    $('choiceRow').classList.add('hidden');
    $('spinBtn').classList.remove('hidden');
  }

  // --- лента ---
  function feedPush(plate, rarity) {
    const rc = CFG.RARITIES[CFG.TIER[rarity]];
    const el = document.createElement('div');
    el.className = 'feedItem';
    const black = CFG.TIER[rarity] >= CFG.TIER.mythic ? 'blackPlate' : '';
    el.innerHTML = plateHTML(plate, rarity, black) + `<span class="fi-r" style="color:${rc.color}">${rc.name}</span>`;
    const feed = $('feed');
    feed.prepend(el);
    while (feed.children.length > 10) feed.lastChild.remove();
  }

  // --- выбор региона: кнопка снизу + меню как гараж ---
  function refreshRegBtn() {
    const s = State.get();
    if (s.mode === 'us') { // в США та же кнопка выбирает штат
      const st = s.us.state ? CFG.US_STATE[s.us.state] : null;
      const t = st ? CFG.US_TIERS[st.tier] : null;
      $('regBtn').innerHTML = st
        ? `🗽 Штат: <b>${st.name}</b> <span class="rbInfo">крутка ×${t.costMult} · продажа ×${t.sellMult}</span>`
        : `🗽 Штат: Любой <span class="rbInfo">случайный, без наценки</span>`;
      return;
    }
    const t = s.region ? CFG.REG_TIER[s.region] : null;
    $('regBtn').innerHTML = s.region
      ? `📍 Регион: <b>${s.region}</b> <span class="rbInfo">крутка ×${t.costMult} · продажа ×${t.sellMult}</span>`
      : `📍 Регион: Любой <span class="rbInfo">случайный, без наценки</span>`;
  }

  // меню штатов США (открывается той же кнопкой, что и регионы)
  function renderStates() {
    const s = State.get();
    const icons = { t2: '🌴', t1: '🏙', t0: '🌾' };
    let html = `<button class="regAny ${s.us.state ? '' : 'regPicked'}" data-st="">
      <span class="regAnyTitle">🎲 Любой штат</span>
      <span class="regAnySub">штат выпадает случайно: 70% обычные · 25% крупные · 5% престиж</span>
    </button>`;
    for (const key of ['t2', 't1', 't0']) {
      const t = CFG.US_TIERS[key];
      html += `<div class="regTierHead">
        <span class="regTierName">${icons[key]} ${t.name}</span>
        <span class="regTierInfo">крутка ×${t.costMult} · продажа ×${t.sellMult}</span>
      </div><div class="regList">` +
        CFG.US_STATES.filter(st => st.tier === key).map(st => `<button class="regRow ${s.us.state === st.st ? 'regPicked' : ''}" data-st="${st.st}">
          ${plateHTML('US:' + st.st + ':' + st.fmt.replace(/L/g, 'A').replace(/D/g, '7'), 'common', 'usMini')}
          <span class="rrName">${st.name} <small class="gMeta">· ${st.nick}</small></span>
          <span class="rrPrice">крутка ×${t.costMult}</span>
        </button>`).join('') + `</div>`;
    }
    $('regionsBody').innerHTML = html;
    $('regionsBody').querySelectorAll('[data-st]').forEach(btn => {
      btn.onclick = () => {
        State.setUsState(btn.dataset.st || null);
        Snd.open();
        toast(btn.dataset.st ? `Штат ${CFG.US_STATE[btn.dataset.st].name} выбран` : 'Штат: любой');
        closeOverlay('regions');
        showPlate(placeholder(), 'common');
        refreshHUD();
      };
    });
  }

  const TIER_LOOK = { // оформление тиров в меню
    t0: { icon: '🌾', hint: 'Глубинка. Дёшево и сердито.' },
    t1: { icon: '🏙', hint: 'Города-миллионники. Солидно.' },
    t2: { icon: '🌟', hint: 'Москва и Кавказ. Блатные края.' },
    t3: { icon: '👑', hint: 'Три топора. Выше только небо.' },
  };

  function renderRegions() {
    const s = State.get();
    let html = `<button class="regAny ${s.region ? '' : 'regPicked'}" data-reg="">
      <span class="regAnyTitle">🎲 Любой регион</span>
      <span class="regAnySub">регион выпадает случайно: 85% обычные · 10% города · 4% престиж · 1% элита</span>
    </button>`;
    // столбиком: самые крутые сверху, дальше дешевле
    for (const t of [...CFG.REG_TIERS].reverse()) {
      const look = TIER_LOOK[t.key];
      html += `<div class="regTierHead">
        <span class="regTierName">${look.icon} ${t.name}</span>
        <span class="regTierInfo">крутка ×${t.costMult} · продажа ×${t.sellMult}</span>
        <span class="regTierHint">${look.hint}</span>
      </div>
      <div class="regList">` +
        t.regs.map(r => `<button class="regRow ${s.region === r ? 'regPicked' : ''}" data-reg="${r}">
          <span class="regCard tier-${t.key}">
            <span class="rcNum">${r}</span>
            <span class="rcRus"><span class="p-flag"></span>RUS</span>
          </span>
          <span class="rrName">${CFG.REG_NAMES[r] || 'Россия'}</span>
          <span class="rrPrice">крутка ×${t.costMult}</span>
        </button>`).join('') +
      `</div>`;
    }
    $('regionsBody').innerHTML = html;
    $('regionsBody').querySelectorAll('[data-reg]').forEach(btn => {
      btn.onclick = () => {
        State.setRegion(btn.dataset.reg || null);
        Snd.open();
        toast(btn.dataset.reg ? `Регион ${btn.dataset.reg} выбран` : 'Регион: любой');
        closeOverlay('regions');
        refreshHUD();
      };
    });
  }

  // --- заряженные крутки (CFG.CHARGES) ---
  function nextChargeInfo() {
    const n = State.get().spins + 1;
    return CFG.CHARGES.find(c => n % c.every === 0) || null;
  }

  // --- VIP-гаранты: кнопка ВЫБИРАЕТ режим, крутит главная кнопка ---
  let vipSel = null; // индекс выбранного гаранта или null
  function getVipSel() { return vipSel; }
  function setVipSel(i) {
    vipSel = i;
    const b = $('vipBanner');
    if (i === null) { b.classList.add('hidden'); return; }
    const rc = CFG.RARITIES[CFG.TIER[State.vipList()[i].key]];
    b.innerHTML = `⭐ ВЫБРАН ГАРАНТ: <b>${rc.name.toUpperCase()} НОМЕР</b> — крутка не ниже этой редкости`;
    b.style.setProperty('--c', rc.color);
    b.classList.add('hidden');
    void b.offsetWidth; // перезапуск анимации
    b.classList.remove('hidden');
  }
  function refreshVipBtn() {
    const b = $('vipBtn');
    if (vipSel === null) { b.innerHTML = '💎 Гарант: выкл'; b.style.removeProperty('--c'); b.classList.remove('vipOn'); return; }
    const rc = CFG.RARITIES[CFG.TIER[State.vipList()[vipSel].key]];
    b.innerHTML = `💎 Гарант: <b>${rc.name}</b> <span class="rbInfo">−${money(State.vipCost(vipSel), State.curMode())} за крутку</span>`;
    b.style.setProperty('--c', rc.color);
    b.classList.add('vipOn');
  }
  function renderVips() {
    const s = State.get();
    let html = `<button class="regAny ${vipSel === null ? 'regPicked' : ''}" data-vip="">
      <span class="regAnyTitle">🎲 Без гаранта</span>
      <span class="regAnySub">обычная крутка за ${money(State.spinCost(), State.curMode())} — как повезёт</span>
    </button>`;
    const cur = State.curMode();
    html += State.vipList().map((v, i) => {
      const rc = CFG.RARITIES[CFG.TIER[v.key]];
      const cost = State.vipCost(i);
      return `<button class="vipCard ${vipSel === i ? 'regPicked' : ''}" data-vip="${i}" style="--c:${rc.color}"
        ${State.balance(cur) < cost && vipSel !== i ? 'disabled' : ''}>
        <span class="vcName">${rc.name} номер</span>
        <span class="vcDesc">редкость не ниже «${rc.name.toLowerCase()}», шанс выше — остаётся</span>
        <span class="vcCost">${money(cost, cur)} за крутку</span>
      </button>`;
    }).join('');
    $('vipsBody').innerHTML = html;
    $('vipsBody').querySelectorAll('[data-vip]').forEach(btn => {
      btn.onclick = () => {
        const i = btn.dataset.vip === '' ? null : Number(btn.dataset.vip);
        setVipSel(i);
        if (i !== null) Snd.reward(); else Snd.open();
        closeOverlay('vips');
        refreshHUD();
      };
    });
  }

  // --- коллекция сочетаний ---
  let comboTab = null; // 'civ' | 'mil'; по умолчанию — текущий тип номеров
  function renderCombos() {
    const s = State.get();
    const tab = comboTab || s.mode;
    const list = tab === 'us' ? CFG.US_COMBOS : tab === 'mil' ? CFG.MIL_COMBOS : CFG.COMBOS;
    const opened = () => list.filter(x => s.combos[x.id]).length;
    const cnt = l => `${l.filter(x => s.combos[x.id]).length}/${l.length}`;
    const weekly = CFG._weeklySets();
    let html = `<div class="tabRow">
      <button class="tabBtn ${tab === 'civ' ? 'tabOn' : ''}" data-tab="civ">🚗 Гражданские ${cnt(CFG.COMBOS)}</button>
      <button class="tabBtn ${tab === 'mil' ? 'tabOn' : ''}" data-tab="mil">🪖 Военные ${cnt(CFG.MIL_COMBOS)}</button>
      <button class="tabBtn ${tab === 'us' ? 'tabOn' : ''}" data-tab="us">🗽 США ${cnt(CFG.US_COMBOS)}</button>
    </div><div class="gSummary">
      <span>открыто: <b>${opened()}/${list.length}</b></span>` +
      (tab === 'civ'
        ? `<span>серии недели: <b>${weekly.join(' · ')}</b> <small>(×25 до конца недели)</small></span>`
        : tab === 'mil'
        ? `<span>твой год: <b>${s.settings.birthYear || 'не указан — впиши в ⚙ Настройках'}</b></span>`
        : `<span>именные таблички: <b>${Object.keys(s.sets.vanity || {}).length}/${CFG.US_VANITY.common.length + CFG.US_VANITY.top.length}</b></span>`) +
      `<span>за все: <b>+${tab === 'us' ? '$20 000' : fmt(CFG.COMBOS_COMPLETE_REWARD) + ' ₽'}</b></span>
    </div><div class="comboGrid">`;
    const sorted = [...list].sort((a, b) => a.mult - b.mult);
    for (const c of sorted) {
      const n = s.combos[c.id] || 0;
      html += `<div class="comboCard ${n ? '' : 'comboLocked'}">
        <div class="ccTop"><span class="ccName">${n ? '' : '🔒 '}${c.name}</span><span class="ccMult">×${c.mult}</span></div>
        <div class="ccDesc">${c.desc}</div>
        <div class="ccEx">например, ${c.id === 'week' ? weekly.join(' или ') : c.ex}</div>
        <div class="ccCount">${n ? `выпало ${fmt(n)} раз` : `награда за открытие: +${tab === 'us'
          ? '$' + fmt(Math.max(5, Math.round(CFG.COMBO_REWARD(c) / 50))) : fmt(CFG.COMBO_REWARD(c)) + ' ₽'}`}</div>
      </div>`;
    }
    html += '</div>';
    $('combosBody').innerHTML = html;
    $('combosBody').querySelectorAll('[data-tab]').forEach(b => {
      b.onclick = () => { comboTab = b.dataset.tab; Snd.open(); renderCombos(); };
    });
  }

  // --- тип номеров: гражданские / военные / США ---
  function refreshModeBtn() {
    const m = State.get().mode;
    $('modeBtn').innerHTML = m === 'us' ? `🗽 Тип: <b>США</b> <span class="rbInfo">доллары</span>`
      : m === 'mil' ? `🪖 Тип: <b>Военные</b> <span class="rbInfo">крутка ×${CFG.MIL.COST_MULT}</span>`
      : `🚗 Тип: <b>Гражданские</b>`;
    $('modeBtn').classList.toggle('modeMil', m === 'mil');
    $('modeBtn').classList.toggle('modeUs', m === 'us');
    $('regBtn').classList.toggle('hidden', m === 'mil'); // у военных код войск случайный
  }
  function switchMode(mode, text) {
    State.setMode(mode);
    comboTab = null;
    setVipSel(null); // гаранты у стран в разной валюте — сбрасываем выбор
    Snd.open();
    toast(text);
    closeOverlay('modes');
    hideResult();
    showPlate(placeholder(), 'common');
    refreshHUD();
  }
  function renderModes() {
    const s = State.get();
    const card = (mode, title, sample, desc, extra = '') => `<button class="modeCard ${s.mode === mode ? 'regPicked' : ''}" data-mode="${mode}">
      <span class="mcTitle">${title}</span>
      ${plateHTML(sample, 'common')}
      <span class="mcDesc">${desc}</span>${extra}
    </button>`;
    const visa = s.us.visa;
    $('modesBody').innerHTML =
      card('civ', '🚗 Гражданские', 'А123ВС77',
        `Белые таблички «А123ВС77». Регионы, блатные серии, слова, секретки. Крутка ${fmt(CFG.SPIN_COST)} ₽ × регион.`) +
      card('mil', '🪖 Военные', '1945ВВ10',
        `Чёрные таблички «1234 АВ 77». Четыре цифры: великие даты, годы, 7777, две пары, зеркала. ` +
        `Крутка ${fmt(CFG.SPIN_COST * CFG.MIL.COST_MULT)} ₽, код войск случайный.`) +
      card('us', visa ? '🗽 США' : '🗽 США 🔒', 'US:CA:7BOS777',
        `15 штатов, именные таблички (BOSS, LUCKY7…), свои сочетания. Отдельный кошелёк в долларах, крутка $${CFG.US.SPIN_COST}.`,
        visa ? '' : `<span class="visaTag">Виза: ${fmt(CFG.US.VISA_PRICE)} ₽ · +$${fmt(CFG.US.START_USD)} на старт</span>`) +
      `<div class="gMeta">Номера не смешиваются: крутишь только выбранный тип. Гараж, уровни и заряды — общие.
      У России и США разные кошельки: обменивай в 💱 Обменнике (меню ☰).</div>`;
    $('modesBody').querySelectorAll('[data-mode]').forEach(b => {
      b.onclick = () => {
        const mode = b.dataset.mode;
        if (mode === 'us' && !State.get().us.visa) {
          if (State.buyVisa()) {
            Snd.reward();
            FX.rain(['#b22234', '#ffffff', '#3c3b6e'], 140);
            showEvents(State.checkNow());
            switchMode('us', `🗽 Виза получена! На счёт +$${fmt(CFG.US.START_USD)}. Welcome to America!`);
          } else {
            Snd.deny();
            toast(`На визу нужно ${fmt(CFG.US.VISA_PRICE)} ₽`);
          }
          return;
        }
        switchMode(mode, mode === 'us' ? '🗽 Крутим американские номера'
          : mode === 'mil' ? '🪖 Крутим военные номера' : '🚗 Крутим гражданские номера');
      };
    });
  }

  // --- обменник ₽ ⇄ $ ---
  function renderExchange() {
    const s = State.get();
    const R = CFG.US.RATE, F = Math.round(CFG.US.FEE * 100);
    if (!s.us.visa) {
      $('exchangeBody').innerHTML = `<div class="gMeta">Обменник работает после покупки визы в США (меню «Тип номеров»).</div>`;
      return;
    }
    $('exchangeBody').innerHTML = `
      <div class="gSummary"><span>курс: <b>1 $ = ${R} ₽</b></span><span>комиссия: <b>${F}%</b></span></div>
      <div class="exRow">
        <span>₽ → $</span>
        <input type="number" id="exRub" min="0" step="1000" placeholder="сколько рублей">
        <button class="ocGive" id="exRubBtn">Обменять</button>
      </div>
      <div class="gMeta" id="exRubQ">у тебя ${fmt(s.money)} ₽</div>
      <div class="exRow">
        <span>$ → ₽</span>
        <input type="number" id="exUsd" min="0" step="10" placeholder="сколько долларов">
        <button class="ocGive" id="exUsdBtn">Обменять</button>
      </div>
      <div class="gMeta" id="exUsdQ">у тебя $${fmt(s.us.usd)}</div>`;
    const bind = (inp, q, dir, own) => {
      $(inp).oninput = () => {
        const v = Number($(inp).value) || 0;
        $(q).textContent = `получишь ${dir === 'rub2usd' ? '$' + fmt(State.exchangeQuote(dir, v)) : fmt(State.exchangeQuote(dir, v)) + ' ₽'} · у тебя ${own()}`;
      };
    };
    bind('exRub', 'exRubQ', 'rub2usd', () => fmt(State.get().money) + ' ₽');
    bind('exUsd', 'exUsdQ', 'usd2rub', () => '$' + fmt(State.get().us.usd));
    const go = (inp, dir) => {
      const got = State.exchange(dir, $(inp).value);
      if (got) {
        Snd.buy();
        toast(`💱 Обменяно: +${dir === 'rub2usd' ? '$' + fmt(got) : fmt(got) + ' ₽'}`);
      } else { Snd.deny(); toast('Не хватает денег или сумма слишком мала'); }
      renderExchange();
      refreshHUD();
    };
    $('exRubBtn').onclick = () => go('exRub', 'rub2usd');
    $('exUsdBtn').onclick = () => go('exUsd', 'usd2rub');
  }

  // --- витрина ---
  function renderShowcase() {
    const s = State.get();
    const sc = $('showcase');
    if (s.showcase && s.found[s.showcase]) {
      const rec = s.found[s.showcase];
      sc.classList.remove('hidden');
      $('showcasePlate').innerHTML = plateHTML(s.showcase, rec.r, rec.black ? 'blackPlate' : '');
    } else sc.classList.add('hidden');
  }

  // --- HUD ---
  function refreshHUD() {
    const s = State.get();
    // главный кошелёк — валюта текущего режима; второй мелко, если есть виза
    const usMode = s.mode === 'us';
    $('moneyCur').textContent = usMode ? '$' : '₽';
    $('moneyVal').textContent = fmt(usMode ? s.us.usd : s.money);
    $('money2').textContent = !s.us.visa ? '' : usMode ? `${fmt(s.money)} ₽` : `$${fmt(s.us.usd)}`;
    const cost = State.spinCost();
    const curBal = State.balance(State.curMode());
    const charge = nextChargeInfo();
    const btn = $('spinBtn');
    btn.classList.remove('charge5', 'charge25');
    if (charge) btn.classList.add(charge.cls);
    if (vipSel !== null) {
      btn.innerHTML = (charge ? '⚡ ' : '') + `КРУТИТЬ ГАРАНТ <span class="pill">−${money(State.vipCost(vipSel), State.curMode())}</span>`;
    } else if (charge) {
      btn.innerHTML = `⚡ КРУТИТЬ <span class="pill">${charge.label}</span>`;
    } else {
      btn.innerHTML = curBal >= cost
        ? `КРУТИТЬ <span class="pill">−${money(cost, State.curMode())}</span>`
        : 'КРУТИТЬ <span class="pill">бесплатно, всё продаётся</span>';
    }
    refreshVipBtn();
    // счётчики до зарядов (крутка №n+1 — следующая)
    const n = s.spins;
    $('chargeInfo').innerHTML = [...CFG.CHARGES].reverse().map(c => {
      const left = c.every - (n % c.every) - 1;
      const cls = c.cls === 'charge25' ? 'c25' : 'c5';
      return `до <b class="${cls}">${c.mult}×</b>: ${left === 0 ? 'СЕЙЧАС' : left}`;
    }).join(' · ') + (s.tickets ? ` · <b class="c5">🎟 ${s.tickets}</b>` : '') +
      (window.__nom && window.__nom.devLuck() > 1 ? ` · <b class="devBadge">🍀 ×${window.__nom.devLuck()}</b>` : '');
    // уровень
    const need = State.xpNeed(s.level);
    $('lvlNum').textContent = s.level;
    $('lvlTitle').textContent = State.levelTitle(s.level);
    $('lvlFill').style.width = Math.min(100, s.xp / need * 100) + '%';
    $('lvlBox').title = `Опыт: ${fmt(s.xp)} / ${fmt(need)}`;
    const pb = $('phoneBadge'), un = typeof Market !== 'undefined' ? Market.unreadCount() : 0;
    pb.textContent = un; pb.classList.toggle('hidden', !un);
    refreshRegBtn();
    refreshModeBtn();
    renderShowcase();
    $('stSpins').textContent = fmt(s.spins);
    $('stUniq').textContent = fmt(State.uniques());
    $('stBest').innerHTML = s.best
      ? plateHTML(s.best.plate, CFG.RARITIES[s.best.tier].key)
      : '—';
    $('pityLeg').textContent = s.pity.leg;
    $('autoRow').classList.toggle('hidden', s.up.auto === 0);
    $('autoChk').checked = s.settings.autoOn;
  }

  // --- тосты ---
  function toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
  function showEvents(events) {
    events.forEach((e, i) => setTimeout(() => {
      toast(e.reward ? `${e.text} +${fmt(e.reward)} ₽` : e.text);
      Snd.reward();
    }, i * 700));
  }

  // --- момент славы ---
  function bigMoment(plate, rarity) {
    return new Promise(resolve => {
      const rc = CFG.RARITIES[CFG.TIER[rarity]];
      $('bmTitle').textContent = rc.name + ' номер!';
      $('bmTitle').style.color = rc.color;
      $('bmTitle').style.textShadow = `0 0 30px ${rc.color}`;
      $('bmPlate').innerHTML = plateHTML(plate, rarity);
      const bm = $('bigMoment');
      bm.classList.remove('hidden');
      let done = false;
      const close = () => {
        if (done) return;
        done = true;
        bm.classList.add('hidden');
        bm.removeEventListener('click', close);
        resolve();
      };
      bm.addEventListener('click', close);
      setTimeout(close, 4000);
    });
  }

  // --- чёрный конверт: мифик/секрет раскрывается посимвольно ---
  function darkReveal(plate, rarity) {
    return new Promise(resolve => {
      const rc = CFG.RARITIES[CFG.TIER[rarity]];
      const p = Plates.parse(plate);
      const dr = $('darkReveal');
      dr.style.setProperty('--c', rc.color);
      $('drGlow').classList.remove('on');
      $('drTitle').classList.add('hidden');
      $('drTitle').textContent = rc.name + ' номер!';
      $('drSub').textContent = 'что-то очень редкое…';
      const ch = (cls, s) => s.split('').map(c => `<span class="${cls} drCh">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
      if (p.us) { // США: название штата и прозвище видны, текст раскрывается по символу
        const st = CFG.US_STATE[p.st];
        $('drPlate').innerHTML = `<div class="plate darkPlate usPlate usDark">
          <div class="usTop">${st.name}</div>
          <div class="usText">${ch('p-d', p.raw)}</div>
          <div class="usNick drCh">${st.nick}</div>
        </div>`;
      } else {
        const mainHtml = p.mil
          ? ch('p-d', p.d) + ch('p-l', p.ls)
          : ch('p-l', p.l1) + ch('p-d', p.d) + ch('p-l', p.l2);
        $('drPlate').innerHTML = `<div class="plate darkPlate">
          <div class="p-main">${mainHtml}</div>
          <div class="p-reg drCh"><div class="p-regnum">${p.reg}</div><div class="p-rus">RUS${p.mil ? '' : '<span class="p-flag"></span>'}</div></div>
        </div>`;
      }
      dr.classList.remove('hidden');

      const spans = [...dr.querySelectorAll('.drCh')];
      const timers = [];
      let finished = false, closed = false;

      function finish() {
        if (finished) return;
        finished = true;
        timers.forEach(clearTimeout);
        spans.forEach(sp => sp.classList.add('on'));
        $('drGlow').classList.add('on');
        $('drTitle').classList.remove('hidden');
        $('drSub').textContent = 'нажми, чтобы продолжить';
        Snd.boom();
        Snd.jingle(rarity);
        FX.rain([rc.color, '#ffe17d', '#ffffff'], 160);
        timers.push(setTimeout(close, 6000));
      }
      function close() {
        if (closed) return;
        closed = true;
        timers.forEach(clearTimeout);
        dr.classList.add('hidden');
        dr.onclick = null;
        resolve();
      }
      dr.onclick = () => { if (!finished) finish(); else close(); };

      // сценарий: чернота → цвет проявляется → символы по одному → финал
      timers.push(setTimeout(() => $('drGlow').classList.add('on'), 350));
      spans.forEach((sp, i) => {
        timers.push(setTimeout(() => {
          sp.classList.add('on');
          Snd.suspense(i);
        }, 1000 + i * 480));
      });
      timers.push(setTimeout(finish, 1000 + spans.length * 480 + 500));
    });
  }

  // --- оверлеи ---
  function openOverlay(id) {
    Snd.open();
    if (id === 'garage') renderGarage();
    if (id === 'shop') renderShop();
    if (id === 'settings') renderSettings();
    if (id === 'regions') { State.get().mode === 'us' ? renderStates() : renderRegions(); $('regionsTitle').textContent = State.get().mode === 'us' ? '🗽 Выбор штата' : '📍 Выбор региона'; }
    if (id === 'profile') renderProfile();
    if (id === 'vips') renderVips();
    if (id === 'combos') renderCombos();
    if (id === 'coll') renderColl();
    if (id === 'modes') renderModes();
    if (id === 'exchange') renderExchange();
    if (id === 'dev') renderDev();
    $(id).classList.remove('hidden');
  }
  function closeOverlay(id) { $(id).classList.add('hidden'); }

  // --- гараж ---
  let gFilter = 'all', gSort = 'new', gType = 'all';
  function renderGarage() {
    const s = State.get();
    const plates = Object.entries(s.found); // [plate, rec]
    const byR = {};
    CFG.RARITIES.forEach(r => byR[r.key] = 0);
    plates.forEach(([, rec]) => byR[rec.r]++);

    const used = State.garageUsed(), cap = State.garageCap();
    let html = `<div class="gSummary">
      <span class="${used >= cap ? 'gFull' : ''}">🏠 мест: <b>${fmt(used)}/${fmt(cap)}</b></span>
      <span>🔒 сейф: <b>${fmt(State.safeCount())}</b> <small>(легендарки+ место не занимают)</small></span>` +
      CFG.RARITIES.map(r => `<span style="color:${r.color}">${r.name}: <b>${fmt(byR[r.key])}</b></span>`).join('') +
      `</div>
      <div class="gTools">
        <input type="search" id="gSearch" placeholder="🔍 поиск: 777, АМР, Texas…" value="${gQuery.replace(/"/g, '&quot;')}">
        <select id="gMassTier">
          <option value="0">обычные</option>
          <option value="1">необычные и ниже</option>
          <option value="2">редкие и ниже</option>
          <option value="3">эпики и ниже</option>
        </select>
        <button class="gMassBtn" id="gMassSell">🧹 Продать все</button>
      </div>
      <div class="gSelBar ${gSel.size ? '' : 'hidden'}" id="gSelBar"></div>`;

    // фильтры + сетка найденного
    html += `<div class="gFilters">
      <select id="gType">
        <option value="all">все номера</option>
        <option value="civ">🚗 гражданские</option>
        <option value="mil">🪖 военные</option>
        <option value="us">🗽 США</option>
      </select>
      <select id="gFilter">
        <option value="all">все редкости</option>` +
      CFG.RARITIES.map(r => `<option value="${r.key}">${r.name}</option>`).join('') +
      `</select>
      <select id="gSort">
        <option value="new">новые сначала</option>
        <option value="old">старые сначала</option>
        <option value="rar">по редкости</option>
        <option value="cnt">по количеству копий</option>
      </select>
    </div><div class="gGrid" id="gGrid"></div>`;

    $('garageBody').innerHTML = html;
    $('gFilter').value = gFilter;
    $('gSort').value = gSort;
    $('gType').value = gType;
    $('gType').onchange = e => { gType = e.target.value; renderGGrid(); };
    $('gFilter').onchange = e => { gFilter = e.target.value; renderGGrid(); };
    $('gSort').onchange = e => { gSort = e.target.value; renderGGrid(); };
    $('gSearch').oninput = e => { gQuery = e.target.value; renderGGrid(); };
    $('gMassTier').value = gMassTier;
    $('gMassTier').onchange = e => { gMassTier = Number(e.target.value); massArmed = false; massLabel(); };
    $('gMassSell').onclick = massSell;
    massLabel();
    renderGGrid();
  }

  // --- массовая продажа: всё ниже порога, кроме уникальных и витрины; второе нажатие — подтверждение ---
  let gMassTier = 0, massArmed = false;
  function massTargets() {
    const s = State.get();
    return Object.keys(s.found).filter(p => !State.isUnique(p) && p !== s.showcase && CFG.TIER[s.found[p].r] <= gMassTier);
  }
  function sumByCur(plates) {
    const sum = { rub: 0, usd: 0 };
    for (const p of plates) sum[State.curOfPlate(p)] += State.sellValue(p);
    return [sum.rub ? money(sum.rub, 'rub') : '', sum.usd ? money(sum.usd, 'usd') : ''].filter(Boolean).join(' + ') || '0 ₽';
  }
  function massLabel() {
    const n = massTargets().length;
    $('gMassSell').textContent = massArmed ? `Точно? ${n} шт. за ${sumByCur(massTargets())}` : `🧹 Продать все (${n})`;
    $('gMassSell').classList.toggle('armed', massArmed);
  }
  function massSell() {
    const list = massTargets();
    if (!list.length) { Snd.deny(); toast('Под условие ничего не попало'); return; }
    if (!massArmed) { massArmed = true; massLabel(); return; }
    const total = sumByCur(list);
    for (const p of list) { State.sellFromGarage(p); gSel.delete(p); }
    massArmed = false;
    Snd.buy();
    toast(`🧹 Продано ${list.length} номеров: +${total}`);
    showEvents(State.checkNow());
    refreshHUD();
    renderGarage();
  }

  // --- выбор галочками: продать или выставить на рынок пачкой ---
  const gSel = new Set();
  function renderSelBar() {
    const bar = $('gSelBar');
    if (!bar) return;
    const s = State.get();
    for (const p of [...gSel]) if (!s.found[p]) gSel.delete(p);
    bar.classList.toggle('hidden', !gSel.size);
    if (!gSel.size) return;
    const free = Market.slots() - Market.active().length;
    bar.innerHTML = `<span>Выбрано: <b>${gSel.size}</b></span>
      <button class="gSell" id="gSelSell">💰 Продать за ${sumByCur([...gSel])}</button>
      <button class="gStar" id="gSelList" ${free > 0 ? '' : 'disabled'}>📢 На рынок по оценке (слотов: ${free})</button>
      <button class="gStar" id="gSelClear">✖</button>`;
    $('gSelSell').onclick = () => {
      const list = [...gSel], total = sumByCur(list);
      for (const p of list) State.sellFromGarage(p);
      gSel.clear();
      Snd.buy(); toast(`Продано ${list.length}: +${total}`);
      showEvents(State.checkNow()); refreshHUD(); renderGarage();
    };
    $('gSelList').onclick = () => {
      let n = 0;
      for (const p of [...gSel]) { if (Market.list(p, Market.est(p))) { gSel.delete(p); n++; } }
      Snd.reward(); toast(n ? `📢 Выставлено на рынок: ${n}` : 'Нет свободных слотов на рынке');
      refreshHUD(); renderGarage();
    };
    $('gSelClear').onclick = () => { gSel.clear(); renderGGrid(); };
  }

  // поиск: латиница-двойник → кириллица (A777AA = А777АА), регистр не важен; для США — штат и его имя
  const LAT2CYR = { A: 'А', B: 'В', E: 'Е', K: 'К', M: 'М', H: 'Н', O: 'О', P: 'Р', C: 'С', T: 'Т', Y: 'У', X: 'Х' };
  const norm = t => t.toUpperCase().replace(/[ABEKMHOPCTYX]/g, c => LAT2CYR[c]).replace(/[\s\-·]/g, '');
  let gQuery = '';
  function matchQuery(plate) {
    if (!gQuery.trim()) return true;
    const q = gQuery.trim().toUpperCase().replace(/[\s\-]/g, '');
    if (Plates.isUS(plate)) {
      const p = Plates.parse(plate), st = CFG.US_STATE[p.st];
      return (p.st + p.t + st.name.toUpperCase().replace(/\s/g, '')).includes(q);
    }
    return norm(plate).includes(norm(gQuery.trim()));
  }

  function renderGGrid() {
    const s = State.get();
    let list = Object.entries(s.found);
    list = list.filter(([p]) => matchQuery(p));
    if (gFilter !== 'all') list = list.filter(([, rec]) => rec.r === gFilter);
    if (gType !== 'all') list = list.filter(([p]) => (Plates.isUS(p) ? 'us' : Plates.isMil(p) ? 'mil' : 'civ') === gType);
    const sorters = {
      new: (a, b) => b[1].t - a[1].t,
      old: (a, b) => a[1].t - b[1].t,
      rar: (a, b) => CFG.TIER[b[1].r] - CFG.TIER[a[1].r] || b[1].t - a[1].t,
      cnt: (a, b) => b[1].n - a[1].n,
    };
    list.sort(sorters[gSort]);
    const MAX = 200;
    const shown = list.slice(0, MAX);
    $('gGrid').innerHTML = shown.map(([plate, rec]) =>
      `<div class="gCard ${gSel.has(plate) ? 'gPicked' : ''}">
        <input type="checkbox" class="gChk" data-chk="${plate}" ${gSel.has(plate) ? 'checked' : ''} title="выбрать">
        ${plateHTML(plate, rec.r, rec.black ? 'blackPlate' : '')}
        <div class="gMeta">${State.isUnique(plate) ? '🔒 единственный · ' : ''}${rec.n > 1 ? `выпадал ×${rec.n} · ` : ''}${new Date(rec.t).toLocaleDateString('ru-RU')}</div>
        <div class="gBtns">
          <button class="gSell" data-plate="${plate}">💰 ${money(State.sellValue(plate), plate)}</button>
          <button class="gStar" data-star="${plate}" title="на витрину">⭐</button>
          <button class="gStar" data-list="${plate}" title="выставить на Блатной Рынок">📢</button>
        </div>
      </div>`).join('') +
      (list.length > MAX ? `<div class="gCard"><div class="gMeta">…и ещё ${fmt(list.length - MAX)}</div></div>` : '') ||
      `<div class="gMeta">${gQuery.trim() ? 'ничего не нашлось' : 'пока пусто — иди крути!'}</div>`;
    $('gGrid').querySelectorAll('[data-chk]').forEach(ch => {
      ch.onchange = () => {
        if (ch.checked) gSel.add(ch.dataset.chk); else gSel.delete(ch.dataset.chk);
        ch.closest('.gCard').classList.toggle('gPicked', ch.checked);
        renderSelBar();
      };
    });
    renderSelBar();
    $('gGrid').querySelectorAll('.gSell').forEach(btn => {
      btn.onclick = () => {
        const v = State.sellFromGarage(btn.dataset.plate);
        if (v) { Snd.buy(); toast(`Продано: +${money(v, btn.dataset.plate)}`); }
        refreshHUD();
        renderGarage();
      };
    });
    $('gGrid').querySelectorAll('[data-list]').forEach(btn => {
      btn.onclick = () => { closeOverlay('garage'); Phone.openSell(btn.dataset.list); };
    });
    $('gGrid').querySelectorAll('[data-star]').forEach(btn => {
      btn.onclick = () => {
        State.setShowcase(btn.dataset.star);
        Snd.open();
        toast('На витрине!');
        refreshHUD();
      };
    });
  }

  // --- коллекции: словарь, именные легенды, секретные серии ---
  function renderColl() {
    const s = State.get();
    let html = '';
    const wFound = s.sets.words;
    html += `<div class="gSetTitle">📖 Словарь <small>${Object.keys(wFound).length}/${CFG.WORDS.length}</small></div>
      <div class="gMeta">Три буквы серии складываются в слово (например, К123ОТ — это КОТ).
      Оставь такой номер в гараже — слово засчитается. Собери все ${CFG.WORDS.length} — получишь +${fmt(CFG.SET_REWARDS.words)} ₽.</div>
      <div class="gSetGrid">`;
    for (const w of CFG.WORDS) {
      html += wFound[w]
        ? `<div class="gSlot foundSlot">${plateHTML(wFound[w], 'epic')}<div class="slotName">${w}</div></div>`
        : `<div class="gSlot">???</div>`;
    }
    html += `</div>`;

    const mFound = s.sets.mythics;
    html += `<div class="gSetTitle">🔥 Именные легенды <small>${Object.keys(mFound).length}/${CFG.MYTHICS.length}</small></div>
      <div class="gMeta">Девять культовых номеров страны — у каждого своё имя. За все: +${fmt(CFG.SET_REWARDS.mythics)} ₽.</div>
      <div class="gSetGrid">`;
    for (const m of CFG.MYTHICS) {
      html += mFound[m.plate]
        ? `<div class="gSlot foundSlot">${plateHTML(m.plate, 'mythic')}<div class="slotName">${m.name}</div></div>`
        : `<div class="gSlot">???<div class="slotName">регион ${m.plate.slice(6)}</div></div>`;
    }
    html += `</div>`;

    const scFound = s.sets.secrets;
    html += `<div class="gSetTitle">🕶 Секретные номера <small>${Object.keys(scFound).length}/${CFG.SECRET_PLATES.length}</small></div>
      <div class="gMeta">Точные номера-легенды: кортежи, нули, «единички» власти. Шанс — примерно 1 к ${fmt(Math.round(1 / CFG.SECRET_CHANCE))}.
      Если выбран регион — падают только секретки этого региона. За все: +${fmt(CFG.SET_REWARDS.secrets)} ₽.</div>
      <div class="gSetGrid">`;
    for (const sp of CFG.SECRET_PLATES) {
      html += scFound[sp.key]
        ? `<div class="gSlot foundSlot">${plateHTML(scFound[sp.key], 'secret', 'blackPlate')}<div class="slotName">${sp.name}</div></div>`
        : `<div class="gSlot">???<div class="slotName">${sp.reg === '*' ? 'любой регион' : 'регион ' + sp.reg}</div></div>`;
    }
    html += `</div>`;

    const caught = CFG.BLAT_SERIES.filter(b => s.combos.blat && Object.keys(s.found).some(p => Plates.letters(p) === b.ls));
    html += `<div class="gSetTitle">😎 Блатные серии <small>${caught.length}/${CFG.BLAT_SERIES.length} в гараже</small></div>
      <div class="gMeta">Сочетание «Блатная серия» ×40 — работает на любом регионе. На родном регионе — ещё «Родной регион» ×3.</div>
      <div class="gSetGrid">` +
      CFG.BLAT_SERIES.map(b => `<div class="gSlot ${caught.includes(b) ? 'foundSlot' : ''}">
        <b>${b.ls}</b><div class="slotName">${b.name} · родной ${b.reg}</div></div>`).join('') +
      `</div>`;

    const dFound = s.sets.dates || {};
    const dates = Object.entries(CFG.MIL_DATES);
    html += `<div class="gSetTitle">🎖 Великие даты <small>${Object.keys(dFound).length}/${dates.length}</small></div>
      <div class="gMeta">Военные номера, где цифры — год из истории страны. Оставь такой номер в гараже, чтобы дата засчиталась.
      За все: +${fmt(CFG.SET_REWARDS.dates)} ₽.</div>
      <div class="gSetGrid">` +
      dates.map(([y, name]) => dFound[y]
        ? `<div class="gSlot foundSlot">${plateHTML(dFound[y], s.found[dFound[y]] ? s.found[dFound[y]].r : 'rare')}<div class="slotName">${y} · ${name}</div></div>`
        : `<div class="gSlot"><b>${y}</b><div class="slotName">${name}</div></div>`).join('') +
      `</div>`;

    // --- США ---
    const rarOf = p => s.found[p] ? s.found[p].r : Plates.classify(p);
    if (!s.us.visa) {
      html += `<div class="gSetTitle">🗽 США <small>закрыто</small></div>
        <div class="gMeta">Купи визу в меню «Тип номеров», чтобы открыть американские коллекции.</div>`;
    } else {
      const stF = s.sets.states || {};
      html += `<div class="gSetTitle">🗽 Road trip: штаты <small>${Object.keys(stF).length}/${CFG.US_STATES.length}</small></div>
        <div class="gMeta">Оставь в гараже хотя бы один номер каждого штата. Все 15 — достижение «Road trip» (+500 000 ₽).</div>
        <div class="gSetGrid">` +
        CFG.US_STATES.map(st => stF[st.st]
          ? `<div class="gSlot foundSlot">${plateHTML(stF[st.st], rarOf(stF[st.st]))}<div class="slotName">${st.name}</div></div>`
          : `<div class="gSlot"><b>${st.st}</b><div class="slotName">${st.name}</div></div>`).join('') + `</div>`;
      const vF = s.sets.vanity || {};
      const allV = [...CFG.US_VANITY.top, ...CFG.US_VANITY.common];
      html += `<div class="gSetTitle">✍ Именные таблички <small>${Object.keys(vF).length}/${allV.length}</small></div>
        <div class="gMeta">Шанс именной таблички — 1 к ${fmt(Math.round(1 / CFG.US.VANITY_CHANCE))}. Золотые слова — легенды (×2500).</div>
        <div class="gSetGrid">` +
        allV.map(w => vF[w]
          ? `<div class="gSlot foundSlot">${plateHTML(vF[w], rarOf(vF[w]))}</div>`
          : `<div class="gSlot ${CFG.US_VANITY.top.includes(w) ? 'vanTop' : ''}">???<div class="slotName">${w.length} букв</div></div>`).join('') + `</div>`;
      const usF = s.sets.usSecrets || {};
      html += `<div class="gSetTitle">🕶 Секретки США <small>${Object.keys(usF).length}/${CFG.US_SECRETS.length}</small></div>
        <div class="gSetGrid">` +
        CFG.US_SECRETS.map(x => usF[x.key]
          ? `<div class="gSlot foundSlot">${plateHTML(usF[x.key], 'secret', 'blackPlate')}<div class="slotName">${x.name}</div></div>`
          : `<div class="gSlot">???<div class="slotName">${x.st === '*' ? 'любой штат' : CFG.US_STATE[x.st].name}</div></div>`).join('') + `</div>`;
    }
    $('collBody').innerHTML = html;
  }

  // --- магазин ---
  function renderShop() {
    const s = State.get();
    let html = '';
    for (const key in CFG.UPGRADES) {
      const u = CFG.UPGRADES[key];
      const lvl = s.up[key];
      const cost = State.upgradeCost(key);
      const maxed = cost === null;
      html += `<div class="upCard">
        <div class="upInfo">
          <div class="upName">${u.name}</div>
          <div class="upDesc">${u.desc}</div>
          <div class="upLvl">уровень ${lvl}${maxed ? ' (МАКС)' : ' / ' + u.costs.length}</div>
        </div>
        <button class="upBtn" data-up="${key}" ${maxed || s.money < cost ? 'disabled' : ''}>
          ${maxed ? 'МАКС' : fmt(cost) + ' ₽'}
        </button>
      </div>`;
    }
    $('shopBody').innerHTML = html;
    $('shopBody').querySelectorAll('[data-up]').forEach(btn => {
      btn.onclick = () => {
        if (State.buyUpgrade(btn.dataset.up)) {
          Snd.buy();
          toast('Улучшение куплено!');
          showEvents(State.checkNow());
        } else Snd.deny();
        renderShop();
        refreshHUD();
      };
    });
  }

  // --- настройки ---
  function renderSettings() {
    const st = State.get().settings;
    $('settingsBody').innerHTML = `
      <div class="setRow"><span>Звук</span><input type="checkbox" id="setSound" ${st.sound ? 'checked' : ''}></div>
      <div class="setRow"><span>Громкость</span><input type="range" id="setVol" min="0" max="1" step="0.05" value="${st.vol}"></div>
      <div class="setRow"><span>Быстрая крутка (без анимации)</span><input type="checkbox" id="setFast" ${st.fast ? 'checked' : ''}></div>
      <div class="setRow"><span>Меньше эффектов</span><input type="checkbox" id="setLowfx" ${st.lowfx ? 'checked' : ''}></div>
      <div class="setRow"><span>Автокрутка оставляет</span>
        <select id="setAutoKeep">
          <option value="none" ${st.autoKeep === 'none' ? 'selected' : ''}>ничего (всё продаёт)</option>
          <option value="common" ${st.autoKeep === 'common' ? 'selected' : ''}>вообще всё</option>
          <option value="uncommon" ${st.autoKeep === 'uncommon' ? 'selected' : ''}>необычный и выше</option>
          <option value="rare" ${st.autoKeep === 'rare' ? 'selected' : ''}>редкий и выше</option>
          <option value="epic" ${st.autoKeep === 'epic' ? 'selected' : ''}>эпический и выше</option>
        </select>
      </div>
      <div class="setRow"><span>Твой год рождения<br><small class="gMeta">для военного сочетания «Твой год» ×100</small></span>
        <input type="number" id="setBirth" min="1900" max="2026" placeholder="1995" value="${st.birthYear || ''}">
      </div>
      <div class="setSec">📲 Перенос сейва <small class="gMeta">${State.storageInfo().cloud
        ? '☁ сейв хранится в облаке Telegram — одинаковый на телефоне и компьютере'
        : 'сейв хранится на этом компьютере'}</small></div>
      <div class="setRow setCol">
        <span class="gMeta">Скопируй сейв здесь и вставь в игре на другом устройстве (например, в боте в Telegram Desktop) — прогресс переедет целиком.</span>
        <button class="gStar" id="setExport">📤 Скопировать мой сейв</button>
        <textarea id="setImportTxt" rows="3" placeholder="вставь сюда скопированный сейв"></textarea>
        <button class="gStar" id="setImport">📥 Загрузить вставленный сейв</button>
      </div>
      <button class="dangerBtn" id="setReset">Сбросить весь прогресс</button>
    `;
    $('setExport').onclick = async () => {
      const txt = State.exportSave();
      let ok = false;
      try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) {}
      if (!ok) { // запасной путь: выделить текст в поле
        const ta = $('setImportTxt');
        ta.value = txt; ta.select();
        try { ok = document.execCommand('copy'); } catch (e) {}
      }
      toast(ok ? `📤 Сейв скопирован (${Math.round(txt.length / 1024)} КБ) — вставь его на другом устройстве` : 'Выдели текст в поле и скопируй вручную');
    };
    let impArmed = false;
    $('setImport').onclick = async e => {
      const txt = $('setImportTxt').value;
      if (!txt.trim()) { Snd.deny(); toast('Сначала вставь сейв в поле'); return; }
      if (!impArmed) { impArmed = true; e.target.textContent = 'ТОЧНО? Текущий прогресс заменится'; return; }
      const ok = await State.importSave(txt);
      if (!ok) { Snd.deny(); toast('Это не похоже на сейв «Блатного Номерка»'); impArmed = false; e.target.textContent = '📥 Загрузить вставленный сейв'; return; }
      toast('📥 Сейв загружен — перезапускаю…');
      setTimeout(() => location.reload(), 600);
    };
    $('setBirth').onchange = e => {
      State.setBirthYear(e.target.value);
      const y = State.get().settings.birthYear;
      toast(y ? `Твой год: ${y} — лови его на военных номерах!` : 'Год сброшен');
    };
    const bind = (id, key, prop = 'checked', num = false) => {
      $(id).onchange = e => {
        State.get().settings[key] = num ? Number(e.target[prop]) : e.target[prop];
        State.markDirty();
      };
    };
    bind('setSound', 'sound');
    bind('setVol', 'vol', 'value', true);
    bind('setFast', 'fast');
    bind('setLowfx', 'lowfx');
    bind('setAutoKeep', 'autoKeep', 'value');
    let armed = false;
    $('setReset').onclick = e => {
      if (!armed) { armed = true; e.target.textContent = 'ТОЧНО? Нажми ещё раз — всё сотрётся'; return; }
      State.reset();
      refreshHUD();
      $('feed').innerHTML = '';
      hideResult();
      closeOverlay('settings');
      toast('Прогресс сброшен');
    };
  }

  // --- инициализация ---
  function init() {
    FX.init();
    // бургер-меню
    const menu = $('mainMenu');
    $('btnMenu').onclick = e => { e.stopPropagation(); menu.classList.toggle('hidden'); Snd.open(); };
    document.addEventListener('click', e => {
      if (!menu.classList.contains('hidden') && !menu.contains(e.target)) menu.classList.add('hidden');
    });
    const bindMenu = (id, overlay) => {
      $(id).onclick = () => { menu.classList.add('hidden'); openOverlay(overlay); };
    };
    bindMenu('btnGarage', 'garage');
    bindMenu('btnColl', 'coll');
    bindMenu('btnCombos', 'combos');
    bindMenu('btnProfile', 'profile');
    $('regBtn').onclick = () => openOverlay('regions');
    $('vipBtn').onclick = () => openOverlay('vips');
    bindMenu('btnShop', 'shop');
    bindMenu('btnSettings', 'settings');
    bindMenu('btnExchange', 'exchange');
    bindMenu('btnDev', 'dev');
    $('bragBtn').onclick = () => brag();
    $('modeBtn').onclick = () => openOverlay('modes');
    document.querySelectorAll('.closeBtn').forEach(b => b.onclick = () => closeOverlay(b.dataset.close));
    document.querySelectorAll('.overlay').forEach(ov => {
      ov.addEventListener('click', e => { if (e.target === ov) ov.classList.add('hidden'); });
    });
    $('autoChk').onchange = e => { State.get().settings.autoOn = e.target.checked; State.markDirty(); };
    // стартовая табличка-заглушка
    showPlate(placeholder(), 'common');
    refreshHUD();
  }

  // --- профиль: статистика, задания дня, журнал легенд, достижения ---
  function renderProfile() {
    State.ensureDaily();
    const s = State.get();
    const st = s.stats;
    const profit = st.earned - st.spent;
    const card = (val, lab, color) =>
      `<div class="profCard"><div class="pcVal"${color ? ` style="color:${color}"` : ''}>${val}</div><div class="pcLab">${lab}</div></div>`;
    let html = `<div class="profGrid">` +
      card(`${s.level} · ${State.levelTitle(s.level)}`, 'уровень', '#c4b5fd') +
      card(fmt(s.spins), 'круток всего') +
      card('−' + fmt(st.spent) + ' ₽', 'потрачено', '#ff8d9d') +
      card('+' + fmt(st.earned) + ' ₽', 'заработано', '#7df9a7') +
      card((profit >= 0 ? '+' : '') + fmt(profit) + ' ₽', 'профит', profit >= 0 ? '#7df9a7' : '#ff8d9d') +
      (s.us.visa ? card('$' + fmt(s.us.usd), `кошелёк США · заработано $${fmt(s.us.earned)}`, '#93c5fd') : '') +
      card(fmt(Object.keys(s.found).length), 'в гараже') +
      card(new Date(st.started).toLocaleDateString('ru-RU'), 'играешь с') +
      `</div>`;

    if (s.best) {
      const bk = CFG.RARITIES[s.best.tier].key;
      html += `<div class="gSetTitle">⭐ Лучшая находка</div><div class="profBest">` +
        plateHTML(s.best.plate, bk, s.best.tier >= CFG.TIER.mythic ? 'blackPlate' : '') + `</div>`;
    }

    // книга рекордов
    const R = s.rec;
    const recRow = (icon, label, r) => `<div class="recRow"><span class="recIcon">${icon}</span>
      <span class="recLabel">${label}</span>
      ${r ? `${plateHTML(r.p, Plates.classify(r.p))}<b class="recVal">${fmt(r.v)} ₽</b>` : '<span class="gMeta">пока нет</span>'}</div>`;
    html += `<div class="gSetTitle">📔 Книга рекордов</div>` +
      recRow('💰', 'Самая дорогая продажа', R.maxSale) +
      recRow('📱', 'Самая дорогая сделка на рынке', R.maxMarket) +
      recRow('🏠', 'Самый дорогой номер в гараже', R.maxKept) +
      recRow('🤡', 'Самый наглый лоуболл (предложили)', R.maxLowball) +
      `<div class="recRow"><span class="recIcon">⏳</span><span class="recLabel">Дольше всего без редкого</span>
        <b class="recVal">${fmt(R.maxStreak)} круток</b></div>
      <div class="recRow"><span class="recIcon">🏦</span><span class="recLabel">Пик богатства</span>
        <b class="recVal">${fmt(R.maxMoney)} ₽</b></div>
      <div class="recRow"><span class="recIcon">📋</span><span class="recLabel">Сделок на рынке · облав пережито</span>
        <b class="recVal">${fmt(st.market || 0)} · ${fmt(st.raids || 0)}</b></div>`;

    html += `<div class="gSetTitle">🎲 Выпадения по редкостям</div><div class="gSummary">` +
      CFG.RARITIES.map(r => `<span style="color:${r.color}">${r.name}: <b>${fmt(s.counts[r.key])}</b></span>`).join('') +
      `</div>`;

    html += `<div class="gSetTitle">📅 Задания дня</div>`;
    for (const t of s.daily.tasks) {
      html += `<div class="dailyRow ${t.done ? 'dailyDone' : ''}">
        <span class="dName">${t.name}</span>
        <div class="dBar"><div class="dFill" style="width:${Math.min(100, t.prog / t.goal * 100)}%"></div></div>
        <span class="dProg">${fmt(Math.min(t.prog, t.goal))}/${fmt(t.goal)}</span>
        <span class="dReward">${t.done ? '✔ получено' : '+' + fmt(t.reward) + ' ₽'}</span>
      </div>`;
    }

    html += `<div class="gSetTitle">🏆 Журнал легенд <small>${s.legends.length}</small></div>`;
    const HOW = { vip: 'VIP-гарант', pity: 'pity-гарант', luck: 'чистая удача',
      charge3: '⚡ 3× удача', charge10: '⚡ 10× удача', charge5: '⚡ 5× удача', charge25: '⚡ 25× удача',
      ticket: '🎟 билет заряда', raid: '🚨 облава' };
    html += s.legends.length
      ? s.legends.map(L => {
          const rc = CFG.RARITIES[CFG.TIER[L.r]];
          return `<div class="legRow">
            ${plateHTML(L.p, L.r, CFG.TIER[L.r] >= CFG.TIER.mythic ? 'blackPlate' : '')}
            <span class="legMeta"><b style="color:${rc.color}">${rc.name}</b> · крутка №${fmt(L.n)} ·
              ${new Date(L.t).toLocaleDateString('ru-RU')} · ${HOW[L.how] || ''}</span>
          </div>`;
        }).join('')
      : '<div class="gMeta">пока пусто — лови легендарку!</div>';

    const done = CFG.ACHIEVEMENTS.filter(a => s.claimed['a' + a.id]).length;
    html += `<div class="gSetTitle">🏅 Достижения <small>${done}/${CFG.ACHIEVEMENTS.length}</small></div>`;
    html += CFG.ACHIEVEMENTS.map(a => {
      const ok = s.claimed['a' + a.id];
      return `<div class="achRow ${ok ? 'achDone' : ''}">
        <span class="achIcon">${ok ? '🏅' : '🔒'}</span>
        <span class="achInfo"><b>${a.name}</b><small>${a.desc}</small></span>
        <span class="achReward">+${fmt(a.reward)} ₽</span>
      </div>`;
    }).join('');

    $('profileBody').innerHTML = html;
  }

  // --- облава: баннер с таймером и полицейская подсветка ---
  let raidTimer = null;
  function setRaid(until) {
    clearInterval(raidTimer);
    const b = $('raidBanner');
    const tick = () => {
      const ms = until - Date.now();
      if (ms <= 0) {
        clearInterval(raidTimer);
        b.classList.add('hidden');
        document.body.classList.remove('raidOn');
        return;
      }
      const sec = Math.ceil(ms / 1000);
      b.innerHTML = `🚨 ОБЛАВА · <b>0:${String(sec).padStart(2, '0')}</b> · каждая крутка — лучший из 2`;
    };
    if (until > Date.now()) {
      b.classList.remove('hidden');
      document.body.classList.add('raidOn');
      tick();
      raidTimer = setInterval(tick, 250);
    } else tick();
  }

  // --- новый уровень ---
  function levelUp(lvl) {
    const box = $('lvlBox');
    box.classList.remove('lvlPop');
    void box.offsetWidth;
    box.classList.add('lvlPop');
    const r = box.getBoundingClientRect();
    FX.burst(r.left + r.width / 2, r.top + r.height / 2, ['#c4b5fd', '#ffe17d', '#ffffff'], 50, 1.1);
    Snd.reward();
  }

  // --- «Похвастаться»: PNG-карточка находки ---
  let lastBrag = null;
  function roundRect(cx, x, y, w, h, r) {
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.arcTo(x + w, y, x + w, y + h, r);
    cx.arcTo(x + w, y + h, x, y + h, r);
    cx.arcTo(x, y + h, x, y, r);
    cx.arcTo(x, y, x + w, y, r);
    cx.closePath();
  }
  async function brag() {
    if (!lastBrag) return;
    await document.fonts.ready;
    const { plate, tier, value } = lastBrag;
    const rc = CFG.RARITIES[tier];
    const p = Plates.parse(plate);
    const W = 880, H = 500;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const cx = cv.getContext('2d');
    // фон
    const g = cx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a1040'); g.addColorStop(1, '#050510');
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    const rg = cx.createRadialGradient(W / 2, 210, 20, W / 2, 210, 420);
    rg.addColorStop(0, rc.color + '55'); rg.addColorStop(1, 'transparent');
    cx.fillStyle = rg; cx.fillRect(0, 0, W, H);
    // заголовок
    cx.textAlign = 'center';
    cx.fillStyle = '#8d93ad'; cx.font = '700 18px Segoe UI, sans-serif';
    cx.fillText('Б Л А Т Н О Й   Н О М Е Р О К', W / 2, 42);
    cx.fillStyle = rc.color; cx.font = '900 44px Segoe UI, sans-serif';
    cx.shadowColor = rc.color; cx.shadowBlur = 24;
    cx.fillText(rc.name.toUpperCase(), W / 2, 98);
    cx.shadowBlur = 0;
    // полоски редкости
    for (let i = 0; i < CFG.RARITIES.length; i++) {
      cx.fillStyle = i <= tier ? rc.color : '#241c52';
      roundRect(cx, W / 2 - 133 + i * 40, 114, 32, 7, 3); cx.fill();
    }
    // табличка (военные — всегда чёрные)
    const black = tier >= CFG.TIER.mythic || p.mil;
    const px = 150, py = 150, pw = 580, ph = 130, regW = 150;
    if (p.us) { // США: цвета штата, название сверху, прозвище снизу
      const st = CFG.US_STATE[p.st];
      cx.fillStyle = black ? '#0b0d12' : st.bg;
      roundRect(cx, px, py, pw, ph, 14); cx.fill();
      cx.lineWidth = 5; cx.strokeStyle = black ? '#3a3f47' : st.ac; cx.stroke();
      cx.textAlign = 'center';
      cx.fillStyle = black ? '#eef1f4' : st.ac; cx.font = 'italic 800 24px Georgia, serif';
      cx.fillText(st.name, W / 2, py + 30);
      cx.fillStyle = black ? '#eef1f4' : st.fg;
      if (black) { cx.shadowColor = rc.color; cx.shadowBlur = 16; }
      cx.font = '800 66px Arial Narrow, Segoe UI, sans-serif';
      cx.fillText(p.raw, W / 2, py + 96);
      cx.shadowBlur = 0;
      cx.fillStyle = black ? '#9aa1ab' : st.ac; cx.font = '700 15px Segoe UI, sans-serif';
      cx.fillText(st.nick.toUpperCase(), W / 2, py + 120);
    }
    else {
    cx.fillStyle = black ? '#0b0d12' : '#f4f6f8';
    roundRect(cx, px, py, pw, ph, 12); cx.fill();
    cx.lineWidth = 5; cx.strokeStyle = black ? '#3a3f47' : '#0c0f14'; cx.stroke();
    cx.beginPath(); cx.moveTo(px + pw - regW, py + 4); cx.lineTo(px + pw - regW, py + ph - 4); cx.stroke();
    cx.fillStyle = black ? '#eef1f4' : '#15181d';
    if (black) { cx.shadowColor = rc.color; cx.shadowBlur = 16; }
    cx.textAlign = 'left';
    cx.font = '96px RoadNumbersFull, Arial Narrow, sans-serif';
    let x = px + 30;
    const put = (t, size) => { cx.font = `${size}px RoadNumbersFull, Arial Narrow, sans-serif`; cx.fillText(t, x, py + 102); x += cx.measureText(t).width + 12; };
    if (p.mil) { put(p.d, 108); put(p.ls, 92); }
    else { put(p.l1, 92); put(p.d, 108); put(p.l2, 92); }
    cx.textAlign = 'center';
    cx.font = '80px RoadNumbersFull, Arial Narrow, sans-serif';
    cx.fillText(p.reg, px + pw - regW / 2, py + 82);
    cx.shadowBlur = 0;
    cx.font = '800 20px Arial Narrow, sans-serif';
    if (p.mil) cx.fillText('RUS', px + pw - regW / 2, py + 116);
    else {
      cx.fillText('RUS', px + pw - regW / 2 - 20, py + 116);
      const fx = px + pw - regW / 2 + 8, fy = py + 100;
      [['#fff', 0], ['#2457c5', 1], ['#d52b1e', 2]].forEach(([c, i]) => { cx.fillStyle = c; cx.fillRect(fx, fy + i * 6, 30, 6); });
    }
    } // конец российской таблички
    // подпись и сочетания
    cx.fillStyle = '#8d93ad'; cx.font = '600 18px Segoe UI, sans-serif';
    cx.fillText(plateCaption(plate), W / 2, 316);
    const sec = Plates.secretOf(plate);
    const tags = (sec ? [`Секретный номер «${sec.name}»`] : [])
      .concat(Plates.combosOf(plate).slice().reverse().map(c => `${c.name} ×${c.mult}`)).slice(0, 4);
    cx.fillStyle = '#cfd4ff'; cx.font = '600 19px Segoe UI, sans-serif';
    cx.fillText(tags.join('   ·   ') || 'Простой номер, но мой', W / 2, 354);
    cx.fillStyle = '#ffe17d'; cx.font = '900 40px Segoe UI, sans-serif';
    cx.shadowColor = '#ffe17d'; cx.shadowBlur = 18;
    cx.fillText(money(value, plate), W / 2, 416);
    cx.shadowBlur = 0;
    cx.fillStyle = '#555b70'; cx.font = '15px Segoe UI, sans-serif';
    const s = State.get();
    cx.fillText(`крутка №${fmt(s.spins)} · уровень ${s.level} · ${new Date().toLocaleDateString('ru-RU')}`, W / 2, 470);
    // скачать
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = `blatnoy-nomerok-${plate}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    Snd.reward();
    toast('📸 Карточка сохранена — хвастайся!');
  }

  // --- меню разработчика (кнопка в ☰ или клавиша ` / Ё) ---
  function renderDev() {
    const s = State.get();
    const N = window.__nom;
    const luck = N.devLuck();
    const forced = N.forced();
    const btn = (act, label, on = false) => `<button class="devBtn ${on ? 'devOn' : ''}" data-act="${act}">${label}</button>`;
    $('devBody').innerHTML = `
      <div class="devSec">💰 Деньги <small>₽ ${fmt(s.money)} · $${fmt(s.us.usd)}</small></div>
      <div class="devRow">${btn('rub:1000000', '+1 млн ₽')}${btn('rub:10000000', '+10 млн ₽')}${btn('rub:100000000', '+100 млн ₽')}
        ${btn('usd:10000', '+$10 000')}${btn('usd:1000000', '+$1 млн')}</div>
      <div class="devRow"><input type="number" id="devAmt" placeholder="своя сумма">
        ${btn('rubAmt', '→ в ₽')}${btn('usdAmt', '→ в $')}${btn('zero', 'Обнулить оба')}</div>

      <div class="devSec">🍀 Удача на все крутки <small>каждая крутка бросает N номеров и берёт лучший</small></div>
      <div class="devRow">${[1, 5, 25, 100, 1000].map(n => btn('luck:' + n, n === 1 ? 'выкл' : '×' + n, luck === n)).join('')}</div>

      <div class="devSec">🎯 Следующая крутка — точно эта редкость</div>
      <div class="devRow">${CFG.RARITIES.map(r => `<button class="devBtn ${forced === r.key ? 'devOn' : ''}" data-act="force:${r.key}"
        style="color:${r.color};border-color:${r.color}">${r.name}</button>`).join('')}</div>

      <div class="devSec">⚡ События</div>
      <div class="devRow">${btn('next:5', 'Заряд 5× на следующую')}${btn('next:25', 'Заряд 25× на следующую')}
        ${btn('raid', '🚨 Облава сейчас')}${btn('market', '📱 Покупатель прямо сейчас')}${btn('pity', 'Pity: легендарка через 1 крутку')}</div>
      <div class="devSec">🛍 Объявление на рынке <small>появится первым во вкладке «Купить»</small></div>
      <div class="devRow">${['filler', 'wanted', 'epic', 'legendary', 'mythic', 'secret'].map(k =>
        btn('offer:' + k, { filler: 'Обычное', wanted: 'Для коллекции', epic: 'Эпик', legendary: 'Легендарка', mythic: 'Мифик', secret: 'Секретка' }[k])).join('')}
        ${s.us.visa ? btn('offerUs:legendary', '🇺🇸 Легендарка') : ''}</div>

      <div class="devSec">⭐ Прогресс</div>
      <div class="devRow">${btn('lvl:1', 'Уровень +1')}${btn('lvl:5', 'Уровень +5')}${btn('tick:5', 'Билеты заряда +5')}
        ${btn('maxup', 'Все апгрейды на максимум')}${btn('visa', s.us.visa ? 'Забрать визу США' : 'Выдать визу США')}</div>
      <div class="gMeta">Меню для тестов: открывается в ☰ или клавишей <b>\`</b> (Ё). Всё выданное сохраняется в сейв.</div>`;
    $('devBody').querySelectorAll('[data-act]').forEach(b => {
      b.onclick = () => {
        const [act, arg] = b.dataset.act.split(':');
        const n = Number(arg);
        const amt = Math.max(0, Math.floor(Number($('devAmt').value) || 0));
        if (act === 'rub') N.give(n);
        else if (act === 'usd') N.giveUsd(n);
        else if (act === 'rubAmt') N.give(amt);
        else if (act === 'usdAmt') N.giveUsd(amt);
        else if (act === 'zero') { s.money = 0; s.us.usd = 0; }
        else if (act === 'luck') { N.setDevLuck(n); toast(n === 1 ? '🍀 Удача: обычная' : `🍀 Удача ×${n} на все крутки`); }
        else if (act === 'force') { N.forceRarity(arg); toast(`🎯 Следующая крутка: ${CFG.RARITIES[CFG.TIER[arg]].name}`); }
        else if (act === 'next') { N.setNextTries(n); toast(`⚡ Следующая крутка — лучший из ${n}`); }
        else if (act === 'raid') { closeOverlay('dev'); N.raidNow(); }
        else if (act === 'market') { closeOverlay('dev'); Market.devBuyerNow(); }
        else if (act === 'offer' || act === 'offerUs') {
          const o = Market.devOffer(arg, act === 'offerUs' ? 'usd' : 'rub');
          toast(o ? `🛍 На рынке: ${plateText(o.plate)} за ${money(o.price, o.cur)}` : 'Не из чего делать — всё уже разобрано');
        }
        else if (act === 'pity') { s.pity.leg = CFG.PITY.LEG_HARD - 1; toast('Следующая крутка — гарантированная легендарка'); }
        else if (act === 'lvl') { s.level += n; s.xp = 0; toast(`Уровень ${s.level}`); }
        else if (act === 'tick') { s.tickets += n; }
        else if (act === 'maxup') { for (const k in CFG.UPGRADES) s.up[k] = CFG.UPGRADES[k].costs.length; toast('Все апгрейды на максимуме'); }
        else if (act === 'visa') {
          if (s.us.visa) { s.us.visa = false; if (s.mode === 'us') { State.setMode('civ'); showPlate(placeholder(), 'common'); } }
          else { s.us.visa = true; }
          toast(s.us.visa ? '🗽 Виза выдана' : 'Виза забрана');
        }
        Snd.click();
        State.markDirty();
        refreshHUD();
        if (!$('dev').classList.contains('hidden')) renderDev();
      };
    });
  }

  return { init, plateHTML, showPlate, animateSpin, showResult, showChoice, hideChoice, markChoiceDone, feedPush,
    refreshHUD, toast, showEvents, bigMoment, darkReveal, openOverlay, closeOverlay,
    getVipSel, setVipSel, setRaid, levelUp, brag, money, plateText };
})();
