// Весь DOM: табличка, анимация крутки, лента, гараж, магазин, настройки, тосты.
const UI = (() => {
  const $ = id => document.getElementById(id);
  const fmt = n => n.toLocaleString('ru-RU');

  // --- деньги: рубли или доллары (по номеру или по коду валюты) ---
  function money(v, plateOrCur) {
    const cur = ['usd', 'rub', 'aed'].includes(plateOrCur) ? plateOrCur : State.curOfPlate(plateOrCur);
    return cur === 'usd' ? `$${fmt(v)}` : cur === 'aed' ? `${fmt(v)} AED` : `${fmt(v)} ₽`;
  }
  // номер текстом (для тостов): у США — «CA 7ABC123»
  function plateText(plate) {
    const dv = Plates.divineOf(plate);
    if (dv) return `«${dv.name}» ${dv.show}`;
    const p = Plates.parse(plate);
    if (p.ae) return `${CFG.AE_EM[p.em].en} ${p.code} ${p.num}`;
    if (!p.us) return plate;
    return `${p.st} ${p.raw}`;
  }

  // --- отрисовка таблички ---
  function plateHTML(plate, rarity, extraCls = '') {
    const p = Plates.parse(plate);
    if (rarity === 'divine') extraCls = extraCls.replace('blackPlate', '') + ' goldPlate';
    if (p.dv) return divinePlateHTML(p.key, rarity, extraCls);
    if (p.ae) {
      const e = CFG.AE_EM[p.em] || CFG.AE_EMIRATES[0];
      return `<div class="plate aePlate r-${rarity} ${extraCls}">
        <div class="aeLeft"><span class="aeEn">${e.en}</span><span class="aeAr">${e.ar}</span></div>
        <div class="aeMain"><b class="aeCode">${p.code}</b><span class="aeNum">${p.num}</span></div>
      </div>`;
    }
    if (p.us) { // США: название штата сверху, номер, прозвище снизу; цвета штата
      const st = CFG.US_STATE[p.st] || CFG.US_STATES[0];
      return `<div class="plate usPlate r-${rarity} ${p.van ? 'usVanity' : ''} ${extraCls}"
        style="--ubg:${st.bg};--ufg:${st.fg};--uac:${st.ac}">
        <div class="usTop">${st.name}</div>
        <div class="usText">${p.raw}</div>
        <div class="usNick">${st.nick}</div>
      </div>`;
    }
    // каждый символ в своей ячейке фиксированной ширины: шрифт номеров не моноширинный,
    // и без ячеек табличка меняет ширину от номера к номеру — дёргается при прокрутке
    const cells = str => [...str].map(c => `<i>${c}</i>`).join('');
    if (p.mil) { // военный: чёрная табличка «1234 АВ | 77 RUS», без флага
      return `<div class="plate milPlate r-${rarity} ${extraCls}">
        <div class="p-main"><span class="p-d">${cells(p.d)}</span><span class="p-l">${cells(p.ls)}</span></div>
        <div class="p-reg"><div class="p-regnum">${cells(p.reg)}</div><div class="p-rus">RUS</div></div>
      </div>`;
    }
    return `<div class="plate r-${rarity} ${extraCls}">
      <div class="p-main"><span class="p-l">${cells(p.l1)}</span><span class="p-d">${cells(p.d)}</span><span class="p-l">${cells(p.l2)}</span></div>
      <div class="p-reg"><div class="p-regnum">${cells(p.reg)}</div><div class="p-rus">RUS<span class="p-flag"></span></div></div>
    </div>`;
  }
  // четыре божественных номера — форматы, которых не бывает
  function divinePlateHTML(key, rarity, cls) {
    const cells = str => [...str].map(c => `<i>${c}</i>`).join('');
    if (key === 'ru') return `<div class="plate dvPlate dv-ru r-${rarity} ${cls}">
        <div class="p-main"><span class="p-d">${cells('777777')}</span></div>
        <div class="p-reg"><div class="p-regnum">${cells('777')}</div><div class="p-rus">RUS<span class="p-flag"></span></div></div>
      </div>`;
    if (key === 'mil') return `<div class="plate milPlate dvPlate dv-mil r-${rarity} ${cls}">
        <div class="p-main"><span class="p-d">${cells('0000')}</span><span class="p-l">${cells('ОО')}</span></div>
        <div class="p-reg"><div class="p-regnum">${cells('00')}</div><div class="p-rus">RUS</div></div>
      </div>`;
    if (key === 'us') {
      const st = CFG.US_STATE.CA;
      return `<div class="plate usPlate dvPlate dv-us r-${rarity} ${cls}" style="--ubg:${st.bg};--ufg:${st.fg};--uac:${st.ac}">
        <div class="usTop">${st.name}</div><div class="usText dvVoid">&nbsp;</div><div class="usNick">${st.nick}</div>
      </div>`;
    }
    const e = CFG.AE_EM.DXB;
    return `<div class="plate aePlate dvPlate dv-ae r-${rarity} ${cls}">
        <div class="aeLeft"><span class="aeEn">${e.en}</span><span class="aeAr">${e.ar}</span></div>
        <div class="aeMain"><span class="aeNum">0</span></div>
      </div>`;
  }

  // подпись под табличкой: регион или код войск
  function plateCaption(plate) {
    const dv = Plates.divineOf(plate);
    if (dv) return `✨ «${dv.name}» · ${dv.where.split(' · ')[0]} · единственный на всю игру`;
    const code = Plates.codeOf(plate);
    if (Plates.isAE(plate)) {
      const e = CFG.AE_EM[code], p = Plates.parse(plate);
      return `${e.name} · ${CFG.AE_TIERS[e.tier].name.toLowerCase()} · ${p.len} ${p.len === 1 ? 'цифра' : p.len < 5 ? 'цифры' : 'цифр'}`;
    }
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
    if (s.mode === 'ae') return 'AE:' + (s.ae.em || 'DXB') + ':?:•••••';
    return s.mode === 'mil' ? '····АА' + (s.milCode || '10') : 'А···АА' + (s.region || '77');
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
    const chance = Plates.isAE(res.plate) ? CFG.AE.CHANCES[res.tier] : Plates.isUS(res.plate) ? CFG.US.CHANCES[res.tier]
      : Plates.isMil(res.plate) ? CFG.MIL.CHANCES[res.tier] : rc.chance;
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
    const us = Plates.isUS(res.plate), ae = Plates.isAE(res.plate);
    const mil = Plates.isMil(res.plate), dvp = Plates.divineOf(res.plate);
    // множитель места: регион России или тир штата США; у военных его нет
    const rt = ae ? Object.assign({}, CFG.AE_TIERS[CFG.AE_EM[reg].tier], { name: 'эмират: ' + CFG.AE_TIERS[CFG.AE_EM[reg].tier].name })
      : us ? Object.assign({}, CFG.US_TIERS[CFG.US_STATE[reg].tier], { name: 'штат: ' + CFG.US_TIERS[CFG.US_STATE[reg].tier].name })
      : mil ? Object.assign({}, CFG.MIL_CODE_TIER[reg], { name: 'код войск: ' + CFG.MIL_CODE_TIER[reg].name }) : CFG.REG_TIER[reg];
    const multLvl = 0; // «Множитель ₽» убран из игры
    const sec = Plates.secretOf(res.plate);
    const blat = Plates.blatOf(res.plate);
    const legendName = Plates.mythicName(res.plate);
    const base = dvp ? dvp.price : ae ? CFG.AE.PLATE_BASE : us ? CFG.US.PLATE_BASE : mil ? CFG.MIL.PLATE_BASE : CFG.PLATE_BASE;
    let running = base;
    const steps = [{ label: dvp ? `✨ Божественный номер «${dvp.name}»` : ae ? 'Базовый номер Эмиратов' : us ? 'Базовый американский номер' : mil ? 'Базовый военный номер' : 'Базовый номер',
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
    const tb = Plates.tierBonus(res.plate);
    if (tb > 1) {
      running *= tb;
      steps.push({ label: `Надбавка за редкость (${CFG.RARITIES[Plates.tierOf(res.plate)].name.toLowerCase()})`, val: '×' + tb, price: running });
    }
    if (State.isUnique(res.plate)) steps.push({ label: '🔒 Единственный экземпляр в игре', val: '✦', price: null });
    if (rt && rt.sellMult > 1) {
      running *= rt.sellMult;
      steps.push({ label: us || mil || ae ? rt.name[0].toUpperCase() + rt.name.slice(1) : `Регион ${rt.name.toLowerCase()}`,
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
    if (s.mode === 'ae') {
      const e = s.ae.em ? CFG.AE_EM[s.ae.em] : null, et = e ? CFG.AE_TIERS[e.tier] : null;
      $('regBtn').innerHTML = e ? `🏙 Эмират: <b>${e.name}</b> <span class="rbInfo">крутка ×${et.costMult} · продажа ×${et.sellMult}</span>`
        : `🏙 Эмират: Любой <span class="rbInfo">случайный, без наценки</span>`;
      return;
    }
    if (s.mode === 'us') { // в США та же кнопка выбирает штат
      const st = s.us.state ? CFG.US_STATE[s.us.state] : null;
      const t = st ? CFG.US_TIERS[st.tier] : null;
      $('regBtn').innerHTML = st
        ? `🗽 Штат: <b>${st.name}</b> <span class="rbInfo">крутка ×${t.costMult} · продажа ×${t.sellMult}</span>`
        : `🗽 Штат: Любой <span class="rbInfo">случайный, без наценки</span>`;
      return;
    }
    if (s.mode === 'mil') { // у военных та же кнопка выбирает код войск
      const ct = s.milCode ? CFG.MIL_CODE_TIER[s.milCode] : null;
      $('regBtn').innerHTML = ct
        ? `🎖 Код войск: <b>${s.milCode}</b> <span class="rbInfo">крутка ×${ct.costMult} · продажа ×${ct.sellMult}</span>`
        : `🎖 Код войск: Любой <span class="rbInfo">случайный, без наценки</span>`;
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

  // меню эмиратов (как штаты США)
  function renderEmirates() {
    const s = State.get();
    const icons = { t2: '🏙', t1: '🕌', t0: '🏜' };
    let html = `<button class="regAny ${s.ae.em ? '' : 'regPicked'}" data-em="">
      <span class="regAnyTitle">🎲 Любой эмират</span>
      <span class="regAnySub">эмират выпадает случайно: 60% северные · 25% Шарджа · 15% Дубай и Абу-Даби</span>
    </button>`;
    for (const key of ['t2', 't1', 't0']) {
      const tt = CFG.AE_TIERS[key];
      html += `<div class="regTierHead"><span class="regTierName">${icons[key]} ${tt.name}</span>
        <span class="regTierInfo">крутка ×${tt.costMult} · продажа ×${tt.sellMult}</span></div><div class="regList">` +
        CFG.AE_EMIRATES.filter(e => e.tier === key).map(e => `<button class="regRow ${s.ae.em === e.em ? 'regPicked' : ''}" data-em="${e.em}">
          ${plateHTML(Plates.aePlate(e.em, 'A', '12345'), 'common', 'aeMini')}
          <span class="rrName">${e.name} <small class="gMeta">· ${e.ar}</small></span>
          <span class="rrPrice">крутка ×${tt.costMult}</span>
        </button>`).join('') + '</div>';
    }
    $('regionsBody').innerHTML = html;
    $('regionsBody').querySelectorAll('[data-em]').forEach(btn => {
      btn.onclick = () => {
        State.setAeEm(btn.dataset.em || null);
        Snd.open();
        toast(btn.dataset.em ? `Эмират ${CFG.AE_EM[btn.dataset.em].name} выбран` : 'Эмират: любой');
        closeOverlay('regions');
        showPlate(placeholder(), 'common');
        refreshHUD();
      };
    });
  }

  // меню кодов войск (военные) — как регионы: тиры с наценкой и множителем продажи
  const MIL_LOOK = {
    t0: { icon: '🪖', hint: 'Обычные части. Без наценки за престиж.' },
    t1: { icon: '🗺', hint: 'Коды округов. Солидно.' },
    t2: { icon: '🎖', hint: 'Гвардейские коды — двойные цифры.' },
    t3: { icon: '⭐', hint: 'Генштаб. Выше только небо.' },
  };
  function renderMilCodes() {
    const s = State.get();
    let html = `<button class="regAny ${s.milCode ? '' : 'regPicked'}" data-code="">
      <span class="regAnyTitle">🎲 Любой код</span>
      <span class="regAnySub">код выпадает случайно: 85% обычные · 10% округа · 4% гвардия · 1% генштаб</span>
    </button>`;
    for (const t of [...CFG.MIL_CODE_TIERS].reverse()) {
      const look = MIL_LOOK[t.key];
      html += `<div class="regTierHead">
        <span class="regTierName">${look.icon} ${t.name}</span>
        <span class="regTierInfo">крутка ×${t.costMult} · продажа ×${t.sellMult}</span>
        <span class="regTierHint">${look.hint}</span>
      </div>
      <div class="regList">` +
        t.codes.map(c => `<button class="regRow ${s.milCode === c ? 'regPicked' : ''}" data-code="${c}">
          <span class="regCard milCard tier-${t.key}"><span class="rcNum">${c}</span><span class="rcRus">RUS</span></span>
          <span class="rrName">Код войск ${c}</span>
          <span class="rrPrice">крутка ×${t.costMult}</span>
        </button>`).join('') +
      `</div>`;
    }
    $('regionsBody').innerHTML = html;
    $('regionsBody').querySelectorAll('[data-code]').forEach(btn => {
      btn.onclick = () => {
        State.setMilCode(btn.dataset.code || null);
        Snd.open();
        toast(btn.dataset.code ? `Код войск ${btn.dataset.code} выбран` : 'Код войск: любой');
        closeOverlay('regions');
        showPlate(placeholder(), 'common');
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
    // страна: Россия / США; тип (гражданские / военные) — отдельная кнопка, только для России
    $('modeBtn').innerHTML = m === 'us' ? `🇺🇸 Страна: <b>США</b> <span class="rbInfo">доллары</span>`
      : m === 'ae' ? `🇦🇪 Страна: <b>Эмираты</b> <span class="rbInfo">дирхамы</span>`
      : `🇷🇺 Страна: <b>Россия</b> <span class="rbInfo">рубли</span>`;
    $('modeBtn').classList.toggle('modeUs', m === 'us');
    $('modeBtn').classList.toggle('modeAe', m === 'ae');
    $('typeBtn').classList.toggle('hidden', m === 'us' || m === 'ae');
    $('typeBtn').innerHTML = m === 'mil' ? `🪖 Тип: <b>Военные</b> <span class="rbInfo">крутка ×${CFG.MIL.COST_MULT}</span>`
      : `🚗 Тип: <b>Гражданские</b>`;
    $('typeBtn').classList.toggle('modeMil', m === 'mil');
  }
  function switchMode(mode, text) {
    State.setMode(mode);
    comboTab = null;
    setVipSel(null); // гаранты у стран в разной валюте — сбрасываем выбор
    Snd.open();
    toast(text);
    closeOverlay('modes');
    closeOverlay('types');
    hideResult();
    showPlate(placeholder(), 'common');
    refreshHUD();
  }
  const modeCard = (cur, mode, title, sample, desc, extra = '') => `<button class="modeCard ${cur ? 'regPicked' : ''}" data-mode="${mode}">
      <span class="mcTitle">${title}</span>
      ${plateHTML(sample, 'common')}
      <span class="mcDesc">${desc}</span>${extra}
    </button>`;
  // тип номеров России
  function renderTypes() {
    const s = State.get();
    $('typesBody').innerHTML =
      modeCard(s.mode === 'civ', 'civ', '🚗 Гражданские', 'А123ВС77',
        `Белые таблички «А123ВС77». Регионы, блатные серии, слова, секретки. Крутка ${fmt(CFG.SPIN_COST)} ₽ × регион.`) +
      modeCard(s.mode === 'mil', 'mil', '🪖 Военные', '1945ВВ10',
        `Чёрные таблички «1234 АВ 77». Четыре цифры: великие даты, годы, 7777, две пары, зеркала. ` +
        `Крутка ${fmt(CFG.SPIN_COST * CFG.MIL.COST_MULT)} ₽ × код войск. Секреток у военных нет — потолок мифик.`) +
      `<div class="gMeta">Номера не смешиваются: крутишь только выбранный тип. Гараж, уровни и заряды — общие.</div>`;
    $('typesBody').querySelectorAll('[data-mode]').forEach(b => {
      b.onclick = () => switchMode(b.dataset.mode, b.dataset.mode === 'mil' ? '🪖 Крутим военные номера' : '🚗 Крутим гражданские номера');
    });
  }
  // страна
  function renderModes() {
    const s = State.get();
    const visa = s.us.visa;
    const ru = s.ruMode === 'mil' ? 'mil' : 'civ';
    $('modesBody').innerHTML =
      modeCard(s.mode !== 'us', ru, '🇷🇺 Россия', 'А777АА77',
        `Гражданские и военные номера (тип выбирается отдельной кнопкой), регионы и коды войск, секретки. Кошелёк в рублях.`) +
      modeCard(s.mode === 'us', 'us', visa ? '🇺🇸 США' : '🇺🇸 США 🔒', 'US:CA:7BOS777',
        `15 штатов, именные таблички (BOSS, LUCKY7…), свои сочетания и секретки. Отдельный кошелёк в долларах, крутка $${CFG.US.SPIN_COST}.`,
        visa ? '' : `<span class="visaTag">Виза: ${fmt(CFG.US.VISA_PRICE)} ₽ · +$${fmt(CFG.US.START_USD)} на старт</span>`) +
      modeCard(s.mode === 'ae', 'ae', s.ae.visa ? '🇦🇪 Эмираты' : '🇦🇪 Эмираты 🔒', 'AE:DXB:P:7',
        `Самые дорогие номера в мире: эмират, буквенный код и 1–5 цифр — чем короче, тем дороже. Однозначный — уже событие.
        Кошелёк в дирхамах, крутка ${CFG.AE.SPIN_COST} AED.`,
        s.ae.visa ? '' : `<span class="visaTag">Виза: ${fmt(CFG.AE.VISA_PRICE)} ₽ · +${fmt(CFG.AE.START_AED)} AED на старт</span>`) +
      `<div class="gMeta">Гараж, уровни и заряды — общие для всех стран. Кошельки разные: обменивай в 💱 Обменнике (меню ☰).</div>`;
    $('modesBody').querySelectorAll('[data-mode]').forEach(b => {
      b.onclick = () => {
        const mode = b.dataset.mode;
        if (mode === 'ae' && !State.get().ae.visa) {
          if (State.buyVisaAE()) {
            Snd.reward();
            FX.rain(['#00732f', '#ffffff', '#ff0000', '#000000'], 160);
            showEvents(State.checkNow());
            switchMode('ae', `🇦🇪 Виза в Эмираты получена! +${fmt(CFG.AE.START_AED)} AED. Ahlan wa sahlan!`);
          } else { Snd.deny(); toast(`На визу в Эмираты нужно ${fmt(CFG.AE.VISA_PRICE)} ₽`); }
          return;
        }
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
        switchMode(mode, mode === 'us' ? '🇺🇸 Крутим американские номера' : mode === 'ae' ? '🇦🇪 Крутим номера Эмиратов' : '🇷🇺 Крутим российские номера');
      };
    });
  }

  // --- обменник ₽ ⇄ $ ---
  function renderExchange() {
    const s = State.get();
    const pairs = [
      s.us.visa && { cur: 'usd', fx: CFG.US, sign: '$', name: 'доллары' },
      s.ae.visa && { cur: 'aed', fx: CFG.AE, sign: 'AED', name: 'дирхамы' },
    ].filter(Boolean);
    if (!pairs.length) {
      $('exchangeBody').innerHTML = '<div class="gMeta">Обменник работает после покупки визы (меню «🌍 Страна»).</div>';
      return;
    }
    $('exchangeBody').innerHTML = pairs.map(pr => `
      <div class="gSetTitle">₽ ⇄ ${pr.sign} <small>курс 1 ${pr.sign} = ${pr.fx.RATE} ₽ · комиссия ${Math.round(pr.fx.FEE * 100)}%</small></div>
      <div class="exRow"><span>₽ → ${pr.sign}</span>
        <input type="number" min="0" step="1000" placeholder="сколько рублей" data-ex="rub2${pr.cur}">
        <button class="ocGive" data-go="rub2${pr.cur}">Обменять</button></div>
      <div class="gMeta" data-q="rub2${pr.cur}">у тебя ${money(s.money, 'rub')}</div>
      <div class="exRow"><span>${pr.sign} → ₽</span>
        <input type="number" min="0" step="10" placeholder="сколько (${pr.name})" data-ex="${pr.cur}2rub">
        <button class="ocGive" data-go="${pr.cur}2rub">Обменять</button></div>
      <div class="gMeta" data-q="${pr.cur}2rub">у тебя ${money(State.balance(pr.cur), pr.cur)}</div>`).join('');
    const body = $('exchangeBody');
    body.querySelectorAll('[data-ex]').forEach(inp => {
      inp.oninput = () => {
        const dir = inp.dataset.ex, [from, to] = dir.split('2');
        body.querySelector(`[data-q="${dir}"]`).textContent =
          `получишь ${money(State.exchangeQuote(dir, Number(inp.value) || 0), to)} · у тебя ${money(State.balance(from), from)}`;
      };
    });
    body.querySelectorAll('[data-go]').forEach(btn => {
      btn.onclick = () => {
        const dir = btn.dataset.go, to = dir.split('2')[1];
        const got = State.exchange(dir, body.querySelector(`[data-ex="${dir}"]`).value);
        if (got) { Snd.buy(); toast(`💱 Обменяно: +${money(got, to)}`); }
        else { Snd.deny(); toast('Не хватает денег или сумма слишком мала'); }
        renderExchange();
        refreshHUD();
      };
    });
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

  // --- кошелёк: плавный счётчик ---
  let shownMoney = null, shownCur = null, moneyRaf = 0;
  function animateMoney(target, cur) {
    const el = $('moneyVal');
    if (shownMoney === null || shownCur !== cur || State.get().settings.lowfx) {
      shownMoney = target; shownCur = cur; el.textContent = fmt(target); return;
    }
    if (target === shownMoney) return;
    const from = shownMoney, t0 = performance.now(), ms = 650;
    const box = $('money');
    box.classList.remove('mUp', 'mDown'); void box.offsetWidth;
    box.classList.add(target > from ? 'mUp' : 'mDown');
    shownMoney = target;
    cancelAnimationFrame(moneyRaf);
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(from + (target - from) * e));
      if (k < 1) moneyRaf = requestAnimationFrame(step);
    };
    step();
  }
  // монеты летят из таблички в кошелёк
  function coinsToWallet(n = 10) {
    const a = $('plateBox').getBoundingClientRect(), b = $('money').getBoundingClientRect();
    FX.coinsTo(a.left + a.width / 2, a.top + a.height / 2, b.left + b.width / 2, b.top + b.height / 2, n);
  }

  // --- HUD ---
  function refreshHUD() {
    const s = State.get();
    // главный кошелёк — валюта текущего режима; второй мелко, если есть виза
    const cur = State.curMode();
    $('moneyCur').textContent = cur === 'usd' ? '$' : cur === 'aed' ? 'AED' : '₽';
    animateMoney(State.balance(cur), cur);
    $('money2').textContent = [cur !== 'rub' ? `${fmt(s.money)} ₽` : '', cur !== 'usd' && s.us.visa ? `$${fmt(s.us.usd)}` : '',
      cur !== 'aed' && s.ae.visa ? `${fmt(s.ae.aed)} AED` : ''].filter(Boolean).join(' · ');
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
    $('prestigeBadge').classList.toggle('hidden', !s.prestige);
    $('prestigeBadge').textContent = s.prestige ? '⭐'.repeat(Math.min(3, s.prestige)) + (s.prestige > 3 ? s.prestige : '') : '';
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
    $('pityLeg').textContent = fmt(Math.max(0, CFG.PITY.LEG_HARD - s.pity.leg)) + (s.pity.leg >= CFG.PITY.LEG_SOFT ? ' 🔥' : '');
    $('autoRow').classList.toggle('hidden', s.up.auto === 0);
    document.body.dataset.skin = (s.skins && s.skins.on) || '';
    $('btnDaily').classList.toggle('menuDot', !!(s.login && !s.login.claimed));
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

  // --- раскрытие мифика / секретки / божественного ---
  //  мифик: багровое зарево и угли, символы проявляются по одному, в конце — ВЗРЫВ
  //  секретка: зелёный дождь 0101, табличка из «?», символы по очереди «взламываются» помехами
  //  божественный — отдельный экран (divineReveal): свет, номер с крыльями и нимбом спускается, барабаны как в слотах
  function darkReveal(plate, rarity) {
    if (rarity === 'divine') return divineReveal(plate);
    return new Promise(resolve => {
      const rc = CFG.RARITIES[CFG.TIER[rarity]];
      const p = Plates.parse(plate);
      const dr = $('darkReveal');
      const secret = rarity === 'secret';
      dr.style.setProperty('--c', rc.color);
      $('drGlow').classList.remove('on');
      $('drTitle').classList.add('hidden');
      dr.classList.remove('drGold', 'drDone');
      dr.dataset.r = rarity;               // CSS: свой фон и эффекты
      const fxTimers = [];
      if (rarity === 'mythic') { // угольки поднимаются
        FX.embers(['#fb7185', '#ff9a3c', '#ffd2d2'], 50);
        fxTimers.push(setInterval(() => FX.embers(['#fb7185', '#ff9a3c'], 14), 600));
      }
      const stopMatrix = secret ? matrixRain(dr.querySelector('.drMatrix')) : () => {};
      $('drTitle').textContent = secret ? '🔓 ДОСТУП ПОЛУЧЕН: СЕКРЕТНЫЙ НОМЕР' : rc.name + ' номер!';
      $('drSub').textContent = secret ? 'взлом базы номеров…' : 'что-то очень редкое…';
      // у секретки вместо символа сначала «?», настоящий символ — в data-c
      const ch = (cls, s) => s.split('').map(c => {
        const real = c === ' ' ? '&nbsp;' : c;
        return `<span class="${cls} drCh" data-c="${real}">${secret ? '?' : real}</span>`;
      }).join('');
      if (p.ae) { // Эмираты: эмират виден, код и цифры раскрываются по символу
        const e = CFG.AE_EM[p.em];
        $('drPlate').innerHTML = `<div class="plate darkPlate aePlate aeDark">
          <div class="aeLeft"><span class="aeEn">${e.en}</span><span class="aeAr">${e.ar}</span></div>
          <div class="aeMain"><b class="aeCode">${ch('p-l', p.code)}</b><span class="aeNum">${ch('p-d', p.num)}</span></div>
        </div>`;
      } else if (p.us) { // США: название штата и прозвище видны, текст раскрывается по символу
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
          <div class="p-reg"><div class="p-regnum">${ch('p-d', p.reg)}</div><div class="p-rus drCh">RUS${p.mil ? '' : '<span class="p-flag"></span>'}</div></div>
        </div>`;
      }
      dr.classList.remove('hidden');

      const spans = [...dr.querySelectorAll('.drCh')];
      const chars = spans.filter(sp => sp.dataset.c !== undefined);
      if (secret) spans.forEach(sp => sp.classList.add('on', 'hackQ')); // «??????» видно сразу
      const timers = [], scrambles = [];
      let finished = false, closed = false;
      const POOL = '0123456789ABCDEFGHKMPTXАВЕКМНОРСТУХ#%&@$';

      // секретка: символ «взламывается» — мелькают помехи, потом встаёт настоящий
      function crack(sp, i) {
        sp.classList.add('hacking');
        const iv = setInterval(() => { sp.textContent = POOL[Math.floor(Math.random() * POOL.length)]; Snd.tick(); }, 55);
        scrambles.push(iv);
        timers.push(setTimeout(() => {
          clearInterval(iv);
          sp.innerHTML = sp.dataset.c;
          sp.classList.remove('hacking', 'hackQ');
          sp.classList.add('cracked');
          Snd.suspense(i);
        }, 520));
      }

      function finish() {
        if (finished) return;
        finished = true;
        timers.forEach(clearTimeout);
        scrambles.forEach(clearInterval);
        spans.forEach(sp => {
          sp.classList.add('on');
          if (sp.dataset.c !== undefined) { sp.innerHTML = sp.dataset.c; sp.classList.remove('hacking', 'hackQ'); }
        });
        $('drGlow').classList.add('on');
        $('drTitle').classList.remove('hidden');
        $('drSub').textContent = 'нажми, чтобы продолжить';
        fxTimers.forEach(clearInterval);
        dr.classList.add('drDone');
        Snd.boom();
        Snd.jingle(rarity);
        const cx = innerWidth / 2, cy = innerHeight / 2;
        if (rarity === 'mythic') {
          FX.explode(cx, cy); // взрыв вместо конфетти
          FX.embers(['#ff7a2f', '#ffd166', '#ffffff'], 60);
        } else if (secret) {
          FX.shake(2); FX.ring(cx, cy, '#22c55e'); setTimeout(() => FX.ring(cx, cy, '#86efac', 560), 180);
          FX.burst(cx, cy, ['#22c55e', '#86efac', '#ffffff'], 140, 1.6);
        }
        timers.push(setTimeout(close, 6500));
      }
      function close() {
        if (closed) return;
        closed = true;
        timers.forEach(clearTimeout);
        scrambles.forEach(clearInterval);
        fxTimers.forEach(clearInterval);
        stopMatrix();
        dr.classList.add('hidden');
        dr.onclick = null;
        resolve();
      }
      dr.onclick = () => { if (!finished) finish(); else close(); };

      // сценарий: чернота → цвет проявляется → символы по одному → финал
      timers.push(setTimeout(() => $('drGlow').classList.add('on'), 350));
      if (secret) {
        chars.forEach((sp, i) => timers.push(setTimeout(() => crack(sp, i), 1300 + i * 700)));
        spans.filter(sp => sp.dataset.c === undefined).forEach(sp => timers.push(setTimeout(() => sp.classList.remove('hackQ'), 1300 + chars.length * 700)));
        timers.push(setTimeout(finish, 1300 + chars.length * 700 + 700));
      } else {
        spans.forEach((sp, i) => {
          timers.push(setTimeout(() => {
            sp.classList.add('on');
            Snd.suspense(i);
          }, 1000 + i * 480));
        });
        timers.push(setTimeout(finish, 1000 + spans.length * 480 + 500));
      }
    });
  }

  // зелёный «дождь» из 0 и 1 на канвасе (секретка). Возвращает функцию остановки
  function matrixRain(cv) {
    if (!cv || State.get().settings.lowfx) return () => {};
    const cx = cv.getContext('2d');
    const size = 18;
    let cols = [], raf = 0, stopped = false;
    const resize = () => {
      cv.width = innerWidth; cv.height = innerHeight;
      cols = Array.from({ length: Math.ceil(cv.width / size) }, () => Math.random() * -cv.height / size);
    };
    resize();
    cx.fillStyle = '#000'; cx.fillRect(0, 0, cv.width, cv.height);
    let last = 0;
    const step = t => {
      if (stopped) return;
      raf = requestAnimationFrame(step);
      if (t - last < 45) return;
      last = t;
      cx.fillStyle = 'rgba(0, 0, 0, .12)';
      cx.fillRect(0, 0, cv.width, cv.height);
      cx.font = `700 ${size - 2}px Consolas, monospace`;
      cols.forEach((y, i) => {
        const x = i * size, yy = y * size;
        cx.fillStyle = Math.random() < 0.06 ? '#d1fae5' : '#22c55e';
        cx.fillText(Math.random() < 0.5 ? '0' : '1', x, yy);
        cols[i] = yy > cv.height && Math.random() > 0.975 ? 0 : y + 1;
      });
    };
    raf = requestAnimationFrame(step);
    return () => { stopped = true; cancelAnimationFrame(raf); cx.clearRect(0, 0, cv.width, cv.height); };
  }

  // крыло ангела (SVG): перья слоями, белые с золотой кромкой
  const WING = `<svg viewBox="0 0 160 110" aria-hidden="true"><defs>
      <linearGradient id="wingG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f3e3b0"/></linearGradient></defs>
    <g fill="url(#wingG)" stroke="#d9a82e" stroke-width="1.6" stroke-linejoin="round">
      <path d="M150 20 C110 0 60 2 10 30 C40 34 70 36 150 34 Z"/>
      <path d="M150 34 C105 22 55 30 6 58 C40 58 80 56 150 50 Z"/>
      <path d="M150 50 C108 46 64 58 16 86 C52 82 92 74 150 64 Z"/>
      <path d="M150 64 C116 68 84 82 46 106 C82 98 118 86 150 76 Z"/>
    </g></svg>`;

  // --- божественный: темнота → свет → номер с крыльями и нимбом спускается → символы крутятся барабанами слота ---
  function divineReveal(plate) {
    return new Promise(resolve => {
      const dvp = Plates.divineOf(plate);
      const el = $('divineReveal');
      el.className = 'dvS0';
      el.innerHTML = `<div class="dvLight"></div><div class="dvRays"></div>
        <div class="dvAngel">
          <div class="dvHalo"></div>
          <div class="dvWing dvWingL">${WING}</div><div class="dvWing dvWingR">${WING}</div>
          <div class="dvPlateBox">${divinePlateHTML(dvp.key, 'divine', 'goldPlate')}</div>
        </div>
        <div class="dvTitle"><small>✨ БОЖЕСТВЕННЫЙ НОМЕР ✨</small><b>«${dvp.name}»</b><span>${money(dvp.price, dvp.cur)} · единственный на всю игру</span></div>
        <div class="dvSub">…</div>`;
      el.classList.remove('hidden');
      const sub = el.querySelector('.dvSub');
      // барабаны: каждый символ таблички крутится, потом встаёт на место
      const reels = [...el.querySelectorAll('.dvPlateBox .p-main i, .dvPlateBox .p-regnum i, .dvPlateBox .aeNum')];
      // пока номер спускается — табличка пустая, символы появятся только из барабанов
      reels.forEach(r => { r.dataset.c = r.textContent; r.textContent = ' '; r.classList.add('reel', 'blank'); });
      const digits = '0123456789', letters = 'АВЕКМНОРСТУХ';
      const spinIv = [], timers = [];
      let finished = false, closed = false;
      const at = (ms, fn) => timers.push(setTimeout(fn, ms));

      function startReels() {
        sub.textContent = 'барабаны крутятся…';
        reels.forEach(r => {
          r.classList.remove('blank');
          r.classList.add('spinning');
          const pool = /\d/.test(r.dataset.c) ? digits : letters;
          spinIv.push(setInterval(() => { r.textContent = pool[Math.floor(Math.random() * pool.length)]; }, 70));
        });
        const tickIv = setInterval(() => Snd.tick(), 110);
        spinIv.push(tickIv);
        reels.forEach((r, i) => at(1300 + i * 650, () => {
          clearInterval(spinIv[i]);
          r.textContent = r.dataset.c;
          r.classList.remove('spinning');
          r.classList.add('stopped');
          Snd.suspense(i);
          FX.burst(...centerOf(r), ['#ffe17d', '#ffffff'], 18, 0.6);
        }));
        at(1300 + reels.length * 650 + 300, finish);
        if (!reels.length) at(2200, finish); // пустая табличка США — «пустота» просто вспыхивает
      }
      function centerOf(node) { const b = node.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }

      function finish() {
        if (finished) return;
        finished = true;
        timers.forEach(clearTimeout);
        spinIv.forEach(clearInterval);
        reels.forEach(r => { r.textContent = r.dataset.c; r.classList.remove('spinning'); r.classList.add('stopped'); });
        el.className = 'dvS1 dvS2 dvS3 dvDone';
        sub.textContent = 'нажми, чтобы продолжить';
        Snd.boom(); Snd.jingle('secret');
        const [cx, cy] = centerOf(el.querySelector('.dvPlateBox'));
        FX.flash('#ffffff'); FX.ring(cx, cy, '#ffd54a', 760); setTimeout(() => FX.ring(cx, cy, '#ffffff', 560), 200);
        FX.coins(220); FX.coins(60, cx, cy);
        timers.push(setTimeout(close, 9000));
      }
      function close() {
        if (closed) return;
        closed = true;
        timers.forEach(clearTimeout);
        spinIv.forEach(clearInterval);
        el.classList.add('hidden');
        el.onclick = null;
        el.innerHTML = '';
        resolve();
      }
      el.onclick = () => { if (!finished) finish(); else close(); };

      // сценарий (медленно — ради такого момента можно подождать)
      at(300, () => { el.classList.add('dvS1'); sub.textContent = 'что-то меняется…'; });          // экран светлеет
      at(2600, () => { el.classList.add('dvS2'); sub.textContent = 'с небес спускается…'; Snd.suspense(0); }); // спуск
      at(7400, () => { el.classList.add('dvS3'); FX.coins(30); startReels(); });                  // приземлился
    });
  }

  // --- оверлеи ---
  // кто в Telegram: id аккаунта (null — игра открыта не в Telegram)
  function tgUserId() {
    const tg = window.Telegram && window.Telegram.WebApp;
    return tg && tg.initData && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : null;
  }
  function devAllowed() {
    const id = tgUserId();
    return id === null || CFG.OWNER_TG_IDS.includes(id);
  }

  function openOverlay(id) {
    if (id === 'dev' && !devAllowed()) return;
    Snd.open();
    if (id === 'garage') renderGarage();
    if (id === 'shop') renderShop();
    if (id === 'settings') renderSettings();
    if (id === 'regions') {
      const m = State.get().mode;
      if (m === 'us') renderStates(); else if (m === 'ae') renderEmirates(); else if (m === 'mil') renderMilCodes(); else renderRegions();
      $('regionsTitle').textContent = m === 'us' ? '🗽 Выбор штата' : m === 'ae' ? '🏙 Выбор эмирата' : m === 'mil' ? '🎖 Код войск' : '📍 Выбор региона';
    }
    if (id === 'types') renderTypes();
    if (id === 'profile') renderProfile();
    if (id === 'vips') renderVips();
    if (id === 'combos') renderCombos();
    if (id === 'coll') renderColl();
    if (id === 'modes') renderModes();
    if (id === 'exchange') renderExchange();
    if (id === 'dev') renderDev();
    if (id === 'news') renderNews();
    if (id === 'daily') renderDailyLogin();
    if (id === 'prestige') renderPrestige();
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
      <span>🔒 сейф: <b>${fmt(State.safeCount())}</b> <small>(мифики и секретки место не занимают)</small></span>` +
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
        <option value="ae">🇦🇪 Эмираты</option>
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
    const sum = { rub: 0, usd: 0, aed: 0 };
    for (const p of plates) sum[State.curOfPlate(p)] += State.sellValue(p);
    return ['rub', 'usd', 'aed'].filter(c => sum[c]).map(c => money(sum[c], c)).join(' + ') || '0 ₽';
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
    if (Plates.isAE(plate)) {
      const p = Plates.parse(plate), e = CFG.AE_EM[p.em];
      return (p.em + p.code + p.num + e.en.replace(/\s/g, '') + e.name.toUpperCase()).includes(q);
    }
    return norm(plate).includes(norm(gQuery.trim()));
  }

  function renderGGrid() {
    const s = State.get();
    let list = Object.entries(s.found);
    list = list.filter(([p]) => matchQuery(p));
    if (gFilter !== 'all') list = list.filter(([, rec]) => rec.r === gFilter);
    if (gType !== 'all') list = list.filter(([p]) => (Plates.isAE(p) ? 'ae' : Plates.isUS(p) ? 'us' : Plates.isMil(p) ? 'mil' : 'civ') === gType);
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
      const ex = sp.plate + (sp.reg === '*' ? '77' : sp.reg); // пример для справочника
      html += secretSlot(scFound[sp.key], ex, sp.name, sp.reg === '*' ? 'любой регион' : 'только регион ' + sp.reg, Plates.secretKeyOf(sp, 'civ'));
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

    const msF = s.sets.milSecrets || {};
    html += `<div class="gSetTitle">🎖 Военные секретки <small>${Object.keys(msF).length}/${CFG.MIL_SECRETS.length}</small></div>
      <div class="gMeta">Точные военные номера-легенды. Шанс — как у гражданских секреток. Если выбран код войск — падают только секретки этого кода.</div>
      <div class="gSetGrid">` +
      CFG.MIL_SECRETS.map(sp => secretSlot(msF[sp.key], sp.plate + (sp.reg === '*' ? '10' : sp.reg), sp.name,
        sp.reg === '*' ? 'любой код войск' : 'только код ' + sp.reg, Plates.secretKeyOf(sp, 'mil'))).join('') + `</div>`;

    // --- божественные: четыре невозможных номера, по одному на страну ---
    const dvF = s.sets.divine || {};
    html += `<div class="gSetTitle">✨ Божественные <small>${Object.keys(dvF).length}/${CFG.DIVINE_PLATES.length}</small></div>
      <div class="gMeta">Номера, которых не бывает. Каждый существует один раз на всю игру, шанс — 1 к ${fmt(Math.round(1 / CFG.DIVINE_CHANCE))} за крутку в своей стране.</div>
      <div class="gSetGrid">` + CFG.DIVINE_PLATES.map(d => {
        const got = dvF[d.key], taken = !got && State.isTaken('D:' + d.key);
        return `<div class="gSlot secSlot ${got ? 'foundSlot' : 'secTodo'}">
          ${got ? plateHTML('DV:' + d.key, 'divine') : '<div class="dvUnknown">???</div>'}
          <div class="slotName"><b>${got ? d.name : '???'}</b></div>
          <div class="slotName">${d.where}</div>
          <div class="slotName secVal">${money(d.price, d.cur)}</div>
          <div class="slotName">${got ? '✅ твой' : taken ? '💨 уже у кого-то' : '🔍 не найден'}</div></div>`;
      }).join('') + `</div>`;

    // --- США ---
    const rarOf = p => s.found[p] ? s.found[p].r : State.rarityOf(p);
    if (!s.us.visa) {
      html += `<div class="gSetTitle">🗽 США <small>закрыто</small></div>
        <div class="gMeta">Купи визу в меню «🌍 Страна», чтобы открыть американские коллекции.</div>`;
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
        CFG.US_SECRETS.map(x => secretSlot(usF[x.key], 'US:' + (x.st === '*' ? 'CA' : x.st) + ':' + x.t, x.name,
          x.st === '*' ? 'любой штат' : 'только ' + CFG.US_STATE[x.st].name, Plates.secretKeyOf(x, 'us'))).join('') + `</div>`;
    }
    // --- Эмираты ---
    if (!s.ae.visa) {
      html += `<div class="gSetTitle">🇦🇪 Эмираты <small>закрыто</small></div>
        <div class="gMeta">Купи визу в меню «🌍 Страна», чтобы открыть коллекции Эмиратов.</div>`;
    } else {
      const emF = s.sets.emirates || {};
      html += `<div class="gSetTitle">🏜 Все эмираты <small>${Object.keys(emF).length}/${CFG.AE_EMIRATES.length}</small></div>
        <div class="gMeta">Оставь в гараже хотя бы один номер каждого из семи эмиратов.</div><div class="gSetGrid">` +
        CFG.AE_EMIRATES.map(e => emF[e.em]
          ? `<div class="gSlot foundSlot">${plateHTML(emF[e.em], rarOf(emF[e.em]))}<div class="slotName">${e.name}</div></div>`
          : `<div class="gSlot"><b>${e.em}</b><div class="slotName">${e.name}</div></div>`).join('') + '</div>';
    }
    const aeF = s.sets.aeSecrets || {};
    html += `<div class="gSetTitle">🕶 Секретки Эмиратов <small>${Object.keys(aeF).length}/${CFG.AE_SECRETS.length}</small></div>
      <div class="gMeta">Самые дорогие номера в игре — реальные легенды аукционов Дубая и Абу-Даби.</div><div class="gSetGrid">` +
      CFG.AE_SECRETS.map(x => secretSlot(aeF[x.key], Plates.aePlate(x.em === '*' ? 'DXB' : x.em, x.code, x.num), x.name,
        x.em === '*' ? 'любой эмират' : 'только ' + CFG.AE_EM[x.em].name, Plates.secretKeyOf(x, 'ae'))).join('') + '</div>';
    $('collBody').innerHTML = html;
  }

  // справочник секреток: все видны сразу — номер, имя, где падает и сколько стоит
  function secretSlot(foundPlate, example, name, where, key) {
    const shown = foundPlate || example;
    const onMarket = !foundPlate && State.isTaken(key);
    const status = foundPlate ? '✅ найдена' : onMarket ? '🛍 сейчас на рынке' : '🔍 не найдена';
    return `<div class="gSlot secSlot ${foundPlate ? 'foundSlot' : 'secTodo'}">
      ${plateHTML(shown, foundPlate ? State.rarityOf(foundPlate) : 'secret', 'blackPlate')}
      <div class="slotName"><b>${name}</b></div>
      <div class="slotName">${where}</div>
      <div class="slotName secVal">≈ ${money(State.sellValue(shown), shown)}${where.startsWith('любой') ? ' и выше' : ''}</div>
      <div class="slotName">${status}</div></div>`;
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
    html += `<div class="gSetTitle">🎨 Скины табличек <small>только красота, на цену не влияют</small></div>
      <div class="skinGrid">` +
      [{ key: null, name: 'Обычная', desc: 'Как с завода', cost: 0 }, ...CFG.SKINS].map(sk => {
        const own = !sk.key || s.skins.owned[sk.key];
        const on = (s.skins.on || null) === sk.key;
        return `<div class="skinCard ${on ? 'skinOn' : ''}" data-skinwrap="${sk.key || ''}">
          <div class="skinPreview" data-skin="${sk.key || ''}">${plateHTML('А777АА77', 'rare')}</div>
          <b>${sk.name}</b><small>${sk.desc}</small>
          <button class="upBtn" data-skin-act="${sk.key || ''}" ${!own && s.money < sk.cost ? 'disabled' : ''}>
            ${on ? 'Надето ✓' : own ? 'Надеть' : fmt(sk.cost) + ' ₽'}</button>
        </div>`;
      }).join('') + '</div>';
    $('shopBody').innerHTML = html;
    $('shopBody').querySelectorAll('[data-skin-act]').forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.skinAct || null;
        const s2 = State.get();
        if (key && !s2.skins.owned[key]) {
          if (!State.buySkin(key)) { Snd.deny(); toast('Не хватает денег на скин'); return; }
          Snd.buy(); FX.rain(['#a78bfa', '#ffffff', '#38bdf8'], 50); toast('🎨 Скин куплен и надет!');
        } else { State.setSkin(key); Snd.click(); toast(key ? '🎨 Скин надет' : 'Табличка снова обычная'); }
        renderShop(); refreshHUD();
      };
    });
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
  // --- перерождение ---
  function renderPrestige() {
    const s = State.get();
    const need = State.prestigeNeed(), can = State.canPrestige();
    const pct = Math.min(100, Math.floor(s.money / need * 100));
    const now = Math.round(CFG.PRESTIGE.BONUS * 100 * (s.prestige || 0)), next = now + Math.round(CFG.PRESTIGE.BONUS * 100);
    $('prestigeBody').innerHTML = `
      <div class="prTop"><div class="prStar">${'⭐'.repeat(Math.max(1, Math.min(5, s.prestige || 0)))}</div>
        <b>Перерождений: ${s.prestige || 0}</b><small>бонус ко всем продажам сейчас: +${now}%</small></div>
      <div class="gMeta">Упёрся в потолок? Начни заново сильнее: каждое перерождение навсегда добавляет +${Math.round(CFG.PRESTIGE.BONUS * 100)}% к цене любой продажи.</div>
      <div class="prCols">
        <div class="prCol prBurn"><b>🔥 Сгорит</b><span>рубли и доллары</span><span>обычные номера гаража (до легендарок включительно)</span><span>апгрейды магазина</span><span>объявления на рынке</span></div>
        <div class="prCol prKeep"><b>🛡 Останется</b><span>сейф: мифики, секретки, божественные</span><span>коллекции и достижения</span><span>уровень и билеты</span><span>визы, скины, рекорды, рейтинг рынка</span></div>
      </div>
      <div class="gMeta">Нужно накопить: <b>${money(need, 'rub')}</b> · у тебя ${money(s.money, 'rub')}</div>
      <span class="achBar prBar"><i style="width:${pct}%"></i></span>
      <button class="dangerBtn prBtn" id="prGo" ${can ? '' : 'disabled'}>${can ? `🔁 Переродиться (+${next}% к продажам)` : `Накоплено ${pct}%`}</button>`;
    let armed = false;
    if (can) $('prGo').onclick = e => {
      if (!armed) { armed = true; e.target.textContent = 'ТОЧНО? Деньги, обычные номера и апгрейды сгорят'; return; }
      if (!State.doPrestige()) return;
      closeOverlay('prestige');
      Snd.jingle('secret');
      FX.flash('#ffe17d');
      FX.rain(['#ffe17d', '#ffffff', '#a78bfa'], 220);
      hideResult();
      showPlate(placeholder(), 'common');
      $('feed').innerHTML = '';
      showEvents(State.checkNow());
      refreshHUD();
    };
  }

  // --- бонус за вход: 7 клеток, сегодняшняя подсвечена ---
  function renderDailyLogin() {
    const s = State.get();
    const today = State.loginDay();
    const can = !s.login.claimed;
    const label = r => [r.money ? money(r.money, 'rub') : '', r.tickets ? '🎟 ×' + r.tickets : '', r.charge ? '⚡ заряд ' + r.charge + '×' : '']
      .filter(Boolean).join('<br>');
    $('dailyBody').innerHTML = `<div class="gMeta">Заходи каждый день подряд — награда растёт. Пропустил день — серия с начала.
      Серия сейчас: <b>${s.login.streak}</b> ${s.login.streak === 1 ? 'день' : 'дн.'}</div>
      <div class="loginGrid">` + CFG.LOGIN.DAYS.map((d, i) => {
        const st = i < today ? 'got' : i === today ? (can ? 'now' : 'got') : 'later';
        return `<div class="loginDay ld-${st} ${i === 6 ? 'ldBig' : ''}"><b>День ${i + 1}</b><span>${label(State.loginReward(i))}</span>
          ${st === 'got' ? '<i>✓</i>' : ''}</div>`;
      }).join('') + `</div>
      <button class="gSell loginBtn" id="loginClaim" ${can ? '' : 'disabled'}>${can ? 'Забрать награду 🎁' : 'Сегодня уже забрано — приходи завтра'}</button>`;
    if (can) $('loginClaim').onclick = () => {
      const r = State.claimLogin();
      if (!r) return;
      Snd.reward();
      FX.rain(['#ffe17d', '#4ade80', '#ffffff'], 90);
      toast(`🎁 Бонус за вход: ${[r.money ? '+' + money(r.money, 'rub') : '', r.tickets ? '🎟 +' + r.tickets : '', r.charge ? '⚡ следующая крутка — лучший из ' + r.charge : ''].filter(Boolean).join(' · ')}`);
      refreshHUD();
      renderDailyLogin();
      setTimeout(() => closeOverlay('daily'), 900);
    };
  }

  // «Что нового»: последние обновления
  function renderNews() {
    $('newsBody').innerHTML = CFG.CHANGELOG.map((c, i) => `<div class="newsBlock ${i ? 'old' : ''}">
      <div class="newsHead"><b>${c.title}</b><span>v${c.v}</span></div>
      <ul>${c.items.map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('') +
      '<button class="gSell newsOk">Погнали! 🚘</button>';
    $('newsBody').querySelector('.newsOk').onclick = () => closeOverlay('news');
  }

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
      ${tgUserId() !== null ? `<div class="setVer">Твой Telegram ID: <b>${tgUserId()}</b></div>` : ''}
      <div class="setVer">Блатной Номерок v${CFG.VERSION} · <a href="#" id="setNews">что нового</a></div>
    `;
    $('setNews').onclick = e => { e.preventDefault(); closeOverlay('settings'); openOverlay('news'); };
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
    bindMenu('btnPrestige', 'prestige');
    bindMenu('btnDaily', 'daily');
    bindMenu('btnExchange', 'exchange');
    if (devAllowed()) bindMenu('btnDev', 'dev'); else $('btnDev').remove();
    $('bragBtn').onclick = () => brag();
    $('modeBtn').onclick = () => openOverlay('modes');
    $('typeBtn').onclick = () => openOverlay('types');
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
      ${r ? `${plateHTML(r.p, State.rarityOf(r.p))}<b class="recVal">${fmt(r.v)} ₽</b>` : '<span class="gMeta">пока нет</span>'}</div>`;
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

    html += achievementsHTML(s);

    $('profileBody').innerHTML = html;
    $('profileBody').querySelectorAll('[data-achtab]').forEach(b => {
      b.onclick = () => { achTab = b.dataset.achtab; Snd.click(); renderProfile(); };
    });
  }

  // --- достижения: вкладки по категориям, уровни I–V с прогрессом, секретные — «???» ---
  let achTab = 'spins';
  const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
  const short = n => n >= 1e9 ? (n / 1e9) + ' млрд' : n >= 1e6 ? (n / 1e6) + ' млн' : fmt(n);
  function achievementsHTML(s) {
    let tiersDone = 0, tiersAll = 0;
    for (const a of CFG.ACH) a.goals.forEach((g, i) => { tiersAll++; if (s.claimed[State.achKey(a, i)]) tiersDone++; });
    let h = `<div class="gSetTitle">🏅 Достижения <small>${tiersDone}/${tiersAll} · очков: ${fmt(State.achPoints())}</small></div>
      <div class="tabRow achTabs">` + CFG.ACH_CATS.map(c => {
        const list = CFG.ACH.filter(a => a.cat === c.key);
        const left = list.some(a => a.goals.some((g, i) => !s.claimed[State.achKey(a, i)] && a.prog(s) >= g));
        return `<button class="tabBtn ${achTab === c.key ? 'tabOn' : ''}" data-achtab="${c.key}">${c.name}${left ? ' •' : ''}</button>`;
      }).join('') + '</div>';
    for (const a of CFG.ACH.filter(x => x.cat === achTab)) {
      const p = a.prog(s);
      const lvl = a.goals.filter((g, i) => s.claimed[State.achKey(a, i)]).length;
      const maxed = lvl >= a.goals.length;
      const hidden = a.secret && !maxed;
      const goal = a.goals[Math.min(lvl, a.goals.length - 1)];
      const r = State.achReward(a, Math.min(lvl, a.goals.length - 1));
      const pct = maxed ? 100 : Math.min(100, Math.floor(p / goal * 100));
      const multi = a.goals.length > 1;
      h += `<div class="achRow ${maxed ? 'achDone' : ''}">
        <span class="achIcon">${hidden ? '❓' : a.icon}</span>
        <span class="achInfo">
          <b>${hidden ? '???' : a.name}${multi ? ` <span class="achTier">${a.goals.map((g, i) => '<i class="' + (i < lvl ? 'on' : '') + '">★</i>').join('')}</span>` : ''}</b>
          <small>${hidden ? 'подсказка: ' + a.hint : a.desc.replace('{n}', short(goal))}</small>
          ${multi && !maxed ? `<span class="achBar"><i style="width:${pct}%"></i></span><small>${short(Math.min(p, goal))} / ${short(goal)} · уровень ${ROMAN[lvl]}</small>` : ''}
        </span>
        <span class="achReward">${maxed ? '✅' : `+${fmt(r.money)} ₽${r.tickets ? `<br>🎟 +${r.tickets}` : ''}`}</span>
      </div>`;
    }
    return h;
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
    if (p.dv) { // божественный: золотая табличка с «невозможным» текстом
      const dvp = Plates.divineOf(plate);
      const gg = cx.createLinearGradient(px, py, px + pw, py + ph);
      gg.addColorStop(0, '#7a5410'); gg.addColorStop(0.3, '#f5d26b'); gg.addColorStop(0.5, '#fff3c4'); gg.addColorStop(0.7, '#d9a82e'); gg.addColorStop(1, '#8a6214');
      cx.fillStyle = gg; roundRect(cx, px, py, pw, ph, 14); cx.fill();
      cx.lineWidth = 5; cx.strokeStyle = '#5c3d06'; cx.stroke();
      cx.textAlign = 'center'; cx.fillStyle = '#3a2603'; cx.font = '800 72px Arial Narrow, Segoe UI, sans-serif';
      cx.fillText(dvp.key === 'us' ? 'CALIFORNIA' : dvp.show, W / 2, py + 92);
    }
    else if (p.ae) { // Эмираты: эмират и код слева, крупные цифры справа
      const e = CFG.AE_EM[p.em];
      const ink = black ? '#eef1f4' : '#111';
      cx.fillStyle = black ? '#0b0d12' : '#fbfbfa';
      roundRect(cx, px, py, pw, ph, 10); cx.fill();
      cx.lineWidth = 6; cx.strokeStyle = black ? '#3a3f47' : '#111'; cx.stroke();
      cx.beginPath(); cx.moveTo(px + 140, py + 10); cx.lineTo(px + 140, py + ph - 10); cx.stroke();
      cx.textAlign = 'center'; cx.fillStyle = ink;
      cx.font = '900 20px Arial Narrow, Segoe UI, sans-serif'; cx.fillText(e.en.length > 9 ? e.en.split(' ')[0] : e.en, px + 70, py + 56);
      cx.font = '700 26px Segoe UI, sans-serif'; cx.fillText(e.ar, px + 70, py + 92);
      if (black) { cx.shadowColor = rc.color; cx.shadowBlur = 16; }
      cx.font = '800 96px Arial Narrow, Segoe UI, sans-serif'; cx.fillText((p.code ? p.code + '  ' : '') + p.num, px + 140 + (pw - 140) / 2, py + 100);
      cx.shadowBlur = 0;
    }
    else if (p.us) { // США: цвета штата, название сверху, прозвище снизу
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
  // сколько секреток текущей страны ещё никем не найдено
  function secretsLeft() {
    const s = State.get();
    const list = s.mode === 'us' ? CFG.US_SECRETS : s.mode === 'ae' ? CFG.AE_SECRETS : s.mode === 'mil' ? CFG.MIL_SECRETS : CFG.SECRET_PLATES;
    return list.filter(x => !State.isTaken(Plates.secretKeyOf(x, s.mode))).length;
  }
  function renderDev() {
    const s = State.get();
    const N = window.__nom;
    const luck = N.devLuck();
    const forced = N.forced();
    const btn = (act, label, on = false) => `<button class="devBtn ${on ? 'devOn' : ''}" data-act="${act}">${label}</button>`;
    $('devBody').innerHTML = `
      <div class="devSec">💰 Деньги <small>₽ ${fmt(s.money)} · $${fmt(s.us.usd)}</small></div>
      <div class="devRow">${btn('rub:1000000', '+1 млн ₽')}${btn('rub:10000000', '+10 млн ₽')}${btn('rub:100000000', '+100 млн ₽')}
        ${btn('usd:10000', '+$10 000')}${btn('usd:1000000', '+$1 млн')}${btn('aed:100000', '+100 000 AED')}${btn('aed:10000000', '+10 млн AED')}</div>
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
        ${btn('maxup', 'Все апгрейды на максимум')}${btn('visa', s.us.visa ? 'Забрать визу США' : 'Выдать визу США')}${btn('visaAe', s.ae.visa ? 'Забрать визу Эмиратов' : 'Выдать визу Эмиратов')}</div>
      <div class="gMeta">Меню для тестов: открывается в ☰ или клавишей <b>\`</b> (Ё). Всё выданное сохраняется в сейв.</div>`;
    $('devBody').querySelectorAll('[data-act]').forEach(b => {
      b.onclick = () => {
        const [act, arg] = b.dataset.act.split(':');
        const n = Number(arg);
        const amt = Math.max(0, Math.floor(Number($('devAmt').value) || 0));
        if (act === 'rub') N.give(n);
        else if (act === 'usd') N.giveUsd(n);
        else if (act === 'aed') { s.ae.aed += n; }
        else if (act === 'rubAmt') N.give(amt);
        else if (act === 'usdAmt') N.giveUsd(amt);
        else if (act === 'zero') { s.money = 0; s.us.usd = 0; }
        else if (act === 'luck') { N.setDevLuck(n); toast(n === 1 ? '🍀 Удача: обычная' : `🍀 Удача ×${n} на все крутки`); }
        else if (act === 'force') {
          N.forceRarity(arg);
          const left = secretsLeft();
          toast(arg === 'secret' && !left ? '🎯 Все секретки этой страны уже найдены — выпадет мифик'
            : `🎯 Следующая крутка: ${CFG.RARITIES[CFG.TIER[arg]].name}` + (arg === 'secret' ? ` (осталось секреток: ${left})` : ''));
        }
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
        else if (act === 'visaAe') {
          if (s.ae.visa) { s.ae.visa = false; if (s.mode === 'ae') { State.setMode('civ'); showPlate(placeholder(), 'common'); } }
          else { s.ae.visa = true; }
          toast(s.ae.visa ? '🇦🇪 Виза Эмиратов выдана' : 'Виза Эмиратов забрана');
        }
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

  return { init, coinsToWallet, plateHTML, showPlate, animateSpin, showResult, showChoice, hideChoice, markChoiceDone, feedPush,
    refreshHUD, toast, showEvents, bigMoment, darkReveal, openOverlay, closeOverlay,
    getVipSel, setVipSel, setRaid, levelUp, brag, money, plateText };
})();
