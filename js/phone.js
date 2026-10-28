// Телефон: экран блокировки → сразу «Блатной Рынок». Объявления, продажа, чаты как в мессенджере, профиль.
const Phone = (() => {
  const $ = id => document.getElementById(id);
  const fmt = n => n.toLocaleString('ru-RU');
  const M = CFG.MARKET;
  let open = false, locked = true;
  let tab = 'mine';         // mine | sell | chats | chat | price | profile
  let chatId = null;        // открытый чат
  let sellPlate = null;     // номер на экране выставления
  let sellK = 1;            // цена = оценка × k
  let buyCur = 'rub';       // лента покупки: рубли или доллары
  let armedBuy = null;      // id объявления, ждущего подтверждения покупки
  const SELLER = { stubborn: 'упёртый', soft: 'сговорчивый', dealer: 'барыга' };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const timeStr = t => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const ago = t => {
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    return s < 60 ? 'только что' : s < 3600 ? `${Math.floor(s / 60)} мин назад` : `${Math.floor(s / 3600)} ч назад`;
  };
  const mins = ms => ms < 60000 ? `${Math.max(1, Math.round(ms / 1000))} сек` : `${Math.round(ms / 60000)} мин`;
  const TYPE = { normal: '', haggler: 'любит торговаться', lowball: 'лоуболлер', collector: 'коллекционер' };

  // --- открыть / закрыть ---
  function show(opts = {}) {
    open = true;
    locked = !opts.unlocked;
    if (opts.tab) tab = opts.tab;
    $('phone').classList.remove('hidden');
    Snd.open();
    render();
  }
  function hide() { open = false; $('phone').classList.add('hidden'); UI.refreshHUD(); }
  function openSell(plate) {
    sellPlate = plate;
    sellK = 1;
    show({ unlocked: true, tab: 'price' });
  }

  // --- экраны ---
  function statusBar() {
    const s = State.get();
    return `<div class="phStatus"><span>${timeStr(Date.now())}</span><span class="phNotch"></span>
      <span>📶 🔋 ${Math.max(15, 100 - (s.spins % 85))}%</span></div>`;
  }
  // --- обои: чистый ч/б — серый верх, мягкий светлый туман за часами, плавно в чёрный ---
  function wallpaper() { return '<div class="phWall" aria-hidden="true"></div>'; }
  const IC = {
    signal: on => `<svg viewBox="0 0 18 12" class="phIc">${[0, 1, 2, 3].map(i =>
      `<rect x="${i * 4.7}" y="${9 - i * 3}" width="3.2" height="${3 + i * 3}" rx="1" fill="#fff" opacity="${i < on ? 1 : .35}"/>`).join('')}</svg>`,
    wifi: `<svg viewBox="0 0 16 12" class="phIc"><path fill="#fff" d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0zM3.6 7a6.2 6.2 0 0 1 8.8 0l-1.4 1.4a4.2 4.2 0 0 0-6 0zM1.2 4.6a9.6 9.6 0 0 1 13.6 0l-1.4 1.4a7.6 7.6 0 0 0-10.8 0z"/></svg>`,
    torch: `<svg viewBox="0 0 24 24"><path fill="#fff" d="M8 2h8v3l-2 4v12a2 2 0 0 1-4 0V9L8 5z"/><circle cx="12" cy="13" r="1.3" fill="#333"/></svg>`,
    cam: `<svg viewBox="0 0 24 24"><path fill="#fff" d="M4 7h3.2l1.6-2.2h6.4L16.8 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13.2" r="3.8" fill="#333"/><circle cx="12" cy="13.2" r="2.6" fill="#fff"/></svg>`,
  };
  let torch = false, lockMin = '';
  function lockScreen() {
    const s = State.get();
    const unread = Market.chats().filter(c => c.unread).slice(-3).reverse();
    const d = new Date();
    const wd = d.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '');
    const date = `${wd[0].toUpperCase() + wd.slice(1)} ${d.getDate()} ${d.toLocaleDateString('ru-RU', { month: 'short' })}`;
    const bat = Math.max(15, 100 - (s.spins % 85));
    lockMin = timeStr(Date.now());
    return `<div class="phLock ${torch ? 'phTorchOn' : ''}">${wallpaper()}
      <div class="phLockBar"><span class="phCarrier">MegaFon</span><span class="phIsland"></span>
        <span class="phIcons">${IC.signal(2)}${IC.wifi}<span class="phBat ${bat <= 20 ? 'low' : ''}"><i style="width:${bat}%"></i><b>${bat}</b></span></span></div>
      <div class="phCCLine"></div>
      <button class="phLockClose" data-lock="close" title="убрать телефон">✕</button>
      <div class="phDate">${date}</div>
      <svg class="phClock" viewBox="0 0 300 250" preserveAspectRatio="none" aria-label="${lockMin}">
        <defs><linearGradient id="clkGlass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#e9e9e9" stop-opacity=".82"/></linearGradient>
          <filter id="clkShadow" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-opacity=".28"/></filter></defs>
        <text x="150" y="98" text-anchor="middle" textLength="292" lengthAdjust="spacingAndGlyphs" transform="scale(1,2.5)"
          fill="url(#clkGlass)" stroke="#ffffff" stroke-opacity=".5" stroke-width=".4" filter="url(#clkShadow)">${lockMin}</text>
      </svg>
      <div class="phNotifs">` + unread.map(c => {
        const last = [...c.msgs].reverse().find(m => m.from === 'buyer');
        return `<div class="phNotif"><b>🏪 Блатной Рынок · ${esc(c.buyer.name)}</b><span>${esc(last ? last.text : '')}</span></div>`;
      }).join('') + `</div>
      <div class="phLockBtns">
        <button class="phRound" data-lock="torch" title="фонарик">${IC.torch}</button>
        <span class="phUnlock">нажми, чтобы открыть</span>
        <button class="phRound" data-lock="cam" title="камера">${IC.cam}</button>
      </div>
    </div>`;
  }
  function appHeader(title, back) {
    return `<div class="phHead">${back ? `<button class="phBack" data-go="${back}">‹</button>` : '<span class="phLogo">🏪</span>'}
      <span class="phTitle">${title}</span><button class="phPower" data-act="close" title="убрать телефон">⏻</button></div>`;
  }
  function tabBar() {
    const u = Market.unreadCount();
    const t = (id, icon, label) => `<button class="phTab ${tab === id || (id === 'chats' && tab === 'chat') || (id === 'sell' && tab === 'price') ? 'on' : ''}" data-go="${id}">
      <span>${icon}</span><small>${label}</small>${id === 'chats' && u ? `<i>${u}</i>` : ''}</button>`;
    return `<div class="phTabs">${t('mine', '📋', 'Мои')}${t('sell', '➕', 'Продать')}${t('buy', '🛍', 'Купить')}${t('chats', '💬', 'Чаты')}${t('profile', '⭐', 'Профиль')}</div>`;
  }

  // --- покупка: лента чужих объявлений ---
  const left = t => { const ms = Math.max(0, t - Date.now()); return ms < 60000 ? `${Math.ceil(ms / 1000)} сек` : `${Math.ceil(ms / 60000)} мин`; };
  function priceTag(o) {
    const k = o.price / o.est;
    if (o.kind === 'deal') return '<em class="phHot">🔥 Срочно</em>';
    if (o.kind === 'unique') return '<em class="phUniq">🔒 единственный</em>';
    return k <= 1.2 ? '<em class="phFair">👍 честная цена</em>' : '<em class="phOver">💸 дороговато</em>';
  }
  function screenBuy() {
    const s = State.get();
    if (buyCur === 'usd' && !s.us.visa) buyCur = 'rub';
    const list = Market.offers(buyCur).slice().sort((a, b) =>
      (b.kind === 'unique') - (a.kind === 'unique') || (b.kind === 'deal') - (a.kind === 'deal') || b.t - a.t);
    let h = appHeader('Купить номер') + `<div class="phBody">`;
    if (s.us.visa) h += `<div class="phSeg">
      <button class="${buyCur === 'rub' ? 'on' : ''}" data-act="buyCur" data-cur="rub">🇷🇺 Рубли</button>
      <button class="${buyCur === 'usd' ? 'on' : ''}" data-act="buyCur" data-cur="usd">🇺🇸 Доллары</button></div>`;
    h += `<div class="phHint">Баланс: <b>${Market.money(State.balance(buyCur), buyCur)}</b> · гараж ${State.garageUsed()}/${State.garageCap()}<br>
      Объявления других продавцов. 🔥 срочные исчезают за пару минут, с остальными можно поторговаться.</div>`;
    if (!list.length) h += '<div class="phEmpty">Объявлений пока нет — загляни чуть позже.</div>';
    for (const o of list) {
      const wl = Market.wantedLabel(o.plate);
      const chat = Market.chatFor(o.id);
      const k = o.price / o.est;
      h += `<div class="phCard ${o.kind === 'deal' ? 'phCardHot' : ''} ${o.kind === 'unique' ? 'phCardUniq' : ''}">
        ${UI.plateHTML(o.plate, o.r, (CFG.TIER[o.r] >= CFG.TIER.mythic ? 'blackPlate ' : '') + 'phPlate')}
        <div class="phRow"><b>${Market.money(o.price, o.cur)}</b>${priceTag(o)}</div>
        <div class="phRow phMuted"><span>оценка ${Market.money(o.est, o.cur)} · ×${k.toFixed(2)}</span><span>⏳ ${left(o.until)}</span></div>
        <div class="phRow phMuted"><span>${o.seller.ava} ${esc(o.seller.name)}${SELLER[o.seller.type] ? ` · <i>${SELLER[o.seller.type]}</i>` : ''}</span>
          <span style="color:${CFG.RARITIES[CFG.TIER[o.r]].color}">${CFG.RARITIES[CFG.TIER[o.r]].name}</span></div>
        ${wl ? `<div class="phTag">${esc(wl)}</div>` : ''}
        <div class="phBtns">
          <button class="phBtn ${armedBuy === o.id ? 'phArmed' : 'phMain'}" data-act="buy" data-id="${o.id}">${armedBuy === o.id ? `Точно? ${Market.money(o.price, o.cur)}` : '🛒 Купить'}</button>
          ${o.kind === 'deal' ? '<button class="phBtn phGhost" disabled>без торга</button>'
            : `<button class="phBtn phGhost" data-act="haggle" data-id="${o.id}">${chat ? '💬 В чат' : '💬 Торг'}</button>`}
        </div></div>`;
    }
    return h + '</div>' + tabBar();
  }
  function buyErr(r) {
    return { gone: 'Объявление уже снято', have: 'Такой номер уже есть в гараже', wait: 'Продавец ещё печатает…',
      full: `🏠 Гараж полон (${State.garageUsed()}/${State.garageCap()}) — освободи место`,
      money: 'Не хватает денег' }[r.err] || 'Не получилось';
  }
  function doBuy(oid, cid) {
    const r = Market.buy(oid, cid);
    armedBuy = null;
    if (!r.ok) { Snd.deny(); UI.toast(buyErr(r)); return; }
    const tier = CFG.TIER[r.r];
    Snd.jingle(tier >= CFG.TIER.legendary ? 'legendary' : 'epic');
    if (tier >= CFG.TIER.epic) FX.rain([CFG.RARITIES[tier].color, '#ffffff'], 60);
    UI.toast(`🛍 Куплено: ${UI.plateText(r.plate)} за ${Market.money(r.price, r.cur)} — уже в гараже`);
    UI.showEvents(r.events);
  }

  function screenMine() {
    const ls = Market.active();
    let h = appHeader('Мои объявления') + `<div class="phBody">
      <div class="phHint">Слоты: <b>${ls.length}/${Market.slots()}</b> · комиссия площадки ${Math.round(M.FEE * 100)}%</div>`;
    if (!ls.length) h += `<div class="phEmpty">Пока ничего не продаёшь.<br>Жми <b>➕ Продать</b> и выставь номер из гаража.</div>`;
    for (const l of ls) {
      const chats = Market.chats().filter(c => c.lid === l.id && c.status === 'open').length;
      const bumped = (l.bumpUntil || 0) > Date.now();
      h += `<div class="phCard">
        ${UI.plateHTML(l.plate, l.rec.r, 'phPlate')}
        <div class="phRow"><b>${Market.money(l.price, l.cur)}</b><span>оценка ${Market.money(l.est, l.cur)} · ×${(l.price / l.est).toFixed(2)}</span></div>
        <div class="phRow phMuted"><span>выставлен ${ago(l.t)}</span><span>${chats ? `💬 ${chats} в чатах` : '⏳ ждём покупателей'}${bumped ? ' · 🔥 поднято' : ''}</span></div>
        <div class="phBtns">
          <button class="phBtn" data-act="bump" data-id="${l.id}" ${bumped ? 'disabled' : ''}>🔥 Поднять · ${Market.money(Market.bumpCost(l), l.cur)}</button>
          <button class="phBtn phGhost" data-act="withdraw" data-id="${l.id}">Снять</button>
        </div></div>`;
    }
    return h + '</div>' + tabBar();
  }

  function screenSell() {
    const s = State.get();
    const plates = Object.keys(s.found).sort((a, b) => State.sellValue(b) * (Market.curOf(b) === 'usd' ? CFG.US.RATE : 1)
      - State.sellValue(a) * (Market.curOf(a) === 'usd' ? CFG.US.RATE : 1));
    const full = Market.active().length >= Market.slots();
    let h = appHeader('Продать номер') + `<div class="phBody">
      <div class="phHint">${full ? '⚠ Все слоты заняты — сними объявление или купи слот в магазине' : 'Выбери номер из гаража — дорогие сверху'}</div>`;
    if (!plates.length) h += '<div class="phEmpty">Гараж пуст — сначала накрути номеров!</div>';
    for (const p of plates.slice(0, 60)) {
      h += `<button class="phPick" data-act="pick" data-plate="${esc(p)}" ${full ? 'disabled' : ''}>
        ${UI.plateHTML(p, s.found[p].r, (s.found[p].black ? 'blackPlate ' : '') + 'phPlate')}
        <span>оценка<br><b>${Market.money(Market.est(p), Market.curOf(p))}</b></span></button>`;
    }
    return h + '</div>' + tabBar();
  }

  function speedLabel(k) {
    return k <= 0.85 ? '🚀 улетит за минуту' : k <= 1.15 ? '🔥 быстро' : k <= 1.6 ? '🙂 средне'
      : k <= 2.2 ? '🐢 долго' : '🦥 очень долго — ждать коллекционера';
  }
  // цена объявления: вписывается руками или ползунком (доля оценки)
  function sellPrice() { return Math.max(1, Math.round(Market.est(sellPlate) * sellK)); }
  function priceInfo(price) {
    const est = Market.est(sellPlate);
    const k = price / est;
    const wait = Market.delayFor(price, est, sellPlate, { deals: Market.deals(), avg: true });
    return { k, line1: `×${k.toFixed(2)} от оценки`, speed: speedLabel(k), wait: `~${mins(wait)}` };
  }
  function screenPrice() {
    const s = State.get();
    if (!sellPlate || !s.found[sellPlate]) { tab = 'sell'; return screenSell(); }
    const cur = Market.curOf(sellPlate);
    const est = Market.est(sellPlate);
    const price = sellPrice();
    const info = priceInfo(price);
    const full = Market.active().length >= Market.slots();
    return appHeader('Новое объявление', 'sell') + `<div class="phBody">
      <div class="phBig">${UI.plateHTML(sellPlate, s.found[sellPlate].r, s.found[sellPlate].black ? 'blackPlate' : '')}</div>
      <div class="phRow"><span>Мгновенная продажа</span><b>${Market.money(State.sellValue(sellPlate), cur)}</b></div>
      <div class="phRow"><span>Рыночная оценка</span><b>${Market.money(est, cur)}</b></div>
      ${Market.interesting(sellPlate) ? '<div class="phTag">🧐 Интересный номер — коллекционеры будут писать чаще</div>' : ''}
      <label class="phPriceIn"><span>${cur === 'usd' ? '$' : '₽'}</span>
        <input type="number" id="phPriceIn" min="1" step="1" value="${price}" inputmode="numeric"></label>
      <input type="range" id="phSlider" min="${M.PRICE_MIN}" max="${M.PRICE_MAX}" step="0.05" value="${Math.min(M.PRICE_MAX, sellK)}">
      <div class="phRow phMuted"><span id="phK">${info.line1}</span><span id="phSpeed">${info.speed}</span></div>
      <div class="phRow phMuted"><span>первый покупатель примерно через</span><span id="phWait">${info.wait}</span></div>
      <button class="phBtn phMain" data-act="publish" ${full ? 'disabled' : ''}>${full ? 'Нет свободных слотов' : '📢 Опубликовать'}</button>
    </div>` + tabBar();
  }
  // обновить подписи без перерисовки экрана (иначе поле ввода теряет фокус)
  function refreshPriceInfo(price) {
    const info = priceInfo(price);
    $('phK').textContent = info.line1;
    $('phSpeed').textContent = info.speed;
    $('phWait').textContent = info.wait;
  }

  function screenChats() {
    const list = [...Market.chats()].sort((a, b) => (b.lastBuyer || b.t) - (a.lastBuyer || a.t)).slice(0, 40);
    let h = appHeader('Сообщения') + '<div class="phBody">';
    if (!list.length) h += '<div class="phEmpty">Сообщений пока нет. Выставь номер — покупатели напишут сами.</div>';
    for (const c of list) {
      const last = c.msgs[c.msgs.length - 1];
      const tag = c.status === 'deal' ? '<em class="ok">сделка</em>' : c.status === 'gone' ? '<em>закрыт</em>' : c.reply ? '<em>печатает…</em>' : '';
      h += `<button class="phChatRow ${c.unread ? 'unread' : ''}" data-act="openChat" data-id="${c.id}">
        <span class="phAva">${c.buyer.ava}</span>
        <span class="phChatMid"><b>${c.kind === 'buy' ? '🛍 ' : ''}${esc(c.buyer.name)}</b> ${tag}<small>${esc(Market.curOf(c.plate) === 'usd' ? UI.plateText(c.plate) : c.plate)} · ${esc(last.text)}</small></span>
        <span class="phTime">${timeStr(last.t)}</span></button>`;
    }
    return h + '</div>' + tabBar();
  }

  function screenChat() {
    const c = Market.chats().find(x => x.id === chatId);
    if (!c) { tab = 'chats'; return screenChats(); }
    Market.markRead(c.id);
    if (c.kind === 'buy') return screenBuyChat(c);
    const l = Market.listings().find(x => x.id === c.lid);
    let h = appHeader(`${c.buyer.ava} ${esc(c.buyer.name)}`, 'chats') + `<div class="phBody phChatBody" id="phChatBody">
      <div class="phChatPlate">${UI.plateHTML(c.plate, Plates.classify(c.plate), 'phPlate')}
        <span>${l ? `объявление: <b>${Market.money(l.price, c.cur)}</b>` : 'объявление закрыто'}${TYPE[c.buyer.type] ? ` · <i>${TYPE[c.buyer.type]}</i>` : ''}</span></div>`;
    for (const m of c.msgs) {
      if (m.from === 'sys') { h += `<div class="phSys">${esc(m.text)}</div>`; continue; }
      h += `<div class="phMsg ${m.from === 'me' ? 'me' : 'them'}">${esc(m.text)}<small>${timeStr(m.t)}</small></div>`;
    }
    if (c.reply) h += '<div class="phMsg them typing"><span></span><span></span><span></span></div>';
    h += '</div>';
    if (c.status === 'open' && !c.reply) {
      h += `<div class="phActions">
        <button class="phBtn phMain" data-act="accept">✅ Продать за ${Market.money(c.offer, c.cur)}</button>
        <div class="phCounter"><input type="number" id="phCounter" placeholder="своя цена" value="${l ? l.price : ''}">
          <button class="phBtn" data-act="counter">➤</button>
          <button class="phBtn phGhost" data-act="decline">✖</button></div>
        <div class="phHint">комиссия ${Math.round(M.FEE * 100)}% · на руки ${Market.money(Math.round(c.offer * (1 - M.FEE)), c.cur)}</div>
      </div>`;
    }
    return h;
  }

  // чат с продавцом: торгуемся вниз
  function screenBuyChat(c) {
    const o = Market.offers().find(x => x.id === c.oid);
    let h = appHeader(`${c.buyer.ava} ${esc(c.buyer.name)}`, 'chats') + `<div class="phBody phChatBody" id="phChatBody">
      <div class="phChatPlate">${UI.plateHTML(c.plate, Plates.classify(c.plate), 'phPlate')}
        <span>${o ? `цена: <b>${Market.money(o.price, c.cur)}</b> · оценка ${Market.money(o.est, c.cur)} · ⏳ ${left(o.until)}` : 'объявление закрыто'}${SELLER[c.buyer.type] ? ` · <i>${SELLER[c.buyer.type]}</i>` : ''}</span></div>`;
    for (const m of c.msgs) {
      if (m.from === 'sys') { h += `<div class="phSys">${esc(m.text)}</div>`; continue; }
      h += `<div class="phMsg ${m.from === 'me' ? 'me' : 'them'}">${esc(m.text)}<small>${timeStr(m.t)}</small></div>`;
    }
    if (c.reply) h += '<div class="phMsg them typing"><span></span><span></span><span></span></div>';
    h += '</div>';
    if (o && (c.status === 'open' || c.status === 'firm') && !c.reply) {
      h += `<div class="phActions">
        <button class="phBtn phMain" data-act="buyChat">🛒 Купить за ${Market.money(c.offer, c.cur)}</button>` +
        (c.status === 'open' ? `<div class="phCounter"><input type="number" id="phCounter" placeholder="твоя цена" value="">
          <button class="phBtn" data-act="counter">➤</button>
          <button class="phBtn phGhost" data-act="decline">✖</button></div>
        <div class="phHint">предложи цену ниже — продавец ответит. Наглый торг злит быстрее</div>`
        : '<div class="phHint">продавец больше не торгуется</div>') + `</div>`;
    }
    return h;
  }

  function screenProfile() {
    const s = State.get();
    const lvl = Market.ratingLevel(Market.deals());
    const stars = '★'.repeat(Math.min(5, Math.ceil(lvl / 2))) + '☆'.repeat(5 - Math.min(5, Math.ceil(lvl / 2)));
    return appHeader('Профиль продавца') + `<div class="phBody">
      <div class="phProfile"><div class="phAvaBig">😎</div><b>Ты</b><div class="phStars">${stars}</div>
        <small>рейтинг ${lvl}/${M.RATING_MAX}</small></div>
      <div class="phRow"><span>Сделок</span><b>${fmt(Market.deals())}</b></div>
      <div class="phRow"><span>Слотов</span><b>${Market.slots()}</b></div>
      <div class="phRow"><span>Отшито лоуболлеров</span><b>${fmt(s.stats.lowballs || 0)}</b></div>
      <div class="phHint">Рейтинг растёт от сделок: каждый уровень — покупатели пишут на 3% быстрее и готовы платить на 2% больше.
        Слоты докупаются в магазине. «Поднять» — объявление 10 минут в топе, покупатели пишут втрое быстрее.</div>
    </div>` + tabBar();
  }

  function render() {
    if (!open) return;
    const scr = $('phScreen');
    let html;
    if (locked) html = lockScreen();
    else html = statusBar() + ({ mine: screenMine, sell: screenSell, buy: screenBuy, price: screenPrice, chats: screenChats,
      chat: screenChat, profile: screenProfile }[tab] || screenMine)();
    // сохраняем ввод встречной цены между перерисовками
    const keep = $('phCounter') ? $('phCounter').value : null;
    scr.innerHTML = html;
    if (keep !== null && $('phCounter')) $('phCounter').value = keep;
    const body = $('phChatBody');
    if (body) body.scrollTop = body.scrollHeight;
    bind();
  }

  function bind() {
    const scr = $('phScreen');
    if (locked) {
      scr.querySelectorAll('[data-lock]').forEach(b => b.onclick = e => {
        e.stopPropagation();
        if (b.dataset.lock === 'torch') { torch = !torch; Snd.click(); render(); }
        else if (b.dataset.lock === 'close') hide();
        else { Snd.click(); scr.classList.remove('phShutter'); void scr.offsetWidth; scr.classList.add('phShutter'); }
      });
      scr.querySelector('.phLock').onclick = () => {
        locked = false;
        Snd.click();
        if (Market.unreadCount()) tab = 'chats';
        scr.classList.add('phUnlocking');
        setTimeout(() => scr.classList.remove('phUnlocking'), 350);
        render();
      };
      return;
    }
    scr.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { tab = b.dataset.go; Snd.click(); render(); });
    scr.querySelectorAll('[data-act]').forEach(b => b.onclick = () => act(b.dataset.act, b));
    const sl = $('phSlider');
    const pin = $('phPriceIn');
    if (sl) sl.oninput = () => {
      sellK = Number(sl.value);
      const p = sellPrice();
      if (pin) pin.value = p;
      refreshPriceInfo(p);
    };
    if (pin) {
      pin.oninput = () => {
        const v = Math.floor(Number(pin.value) || 0);
        if (v < 1) return;
        sellK = v / Market.est(sellPlate);
        if (sl) sl.value = Math.min(M.PRICE_MAX, Math.max(M.PRICE_MIN, sellK));
        refreshPriceInfo(v);
      };
      pin.onkeydown = e => { if (e.key === 'Enter') act('publish'); };
    }
    const ci = $('phCounter');
    if (ci) ci.onkeydown = e => { if (e.key === 'Enter') act('counter'); };
  }

  function act(a, b) {
    const id = b && b.dataset.id ? Number(b.dataset.id) : null;
    if (a === 'close') return hide();
    if (a === 'bump') {
      if (Market.bump(id)) { Snd.buy(); UI.toast('🔥 Объявление поднято на 10 минут'); } else { Snd.deny(); UI.toast('Не хватает денег на поднятие'); }
    } else if (a === 'withdraw') {
      if (Market.withdraw(id)) { Snd.open(); UI.toast('Объявление снято, номер вернулся в гараж'); }
      else { Snd.deny(); UI.toast('🏠 В гараже нет места — освободи место, чтобы снять объявление'); }
    } else if (a === 'pick') {
      sellPlate = b.dataset.plate; sellK = 1; tab = 'price';
    } else if (a === 'publish') {
      const typed = $('phPriceIn') ? Math.floor(Number($('phPriceIn').value) || 0) : 0;
      const price = typed >= 1 ? typed : sellPrice();
      if (Market.list(sellPlate, price)) {
        Snd.reward();
        UI.toast(`📢 Опубликовано за ${Market.money(price, Market.curOf(sellPlate))}`);
        sellPlate = null; tab = 'mine';
      } else { Snd.deny(); UI.toast('Нет свободных слотов'); }
    } else if (a === 'buyCur') {
      buyCur = b.dataset.cur; armedBuy = null;
    } else if (a === 'buy') {
      if (armedBuy !== id) { armedBuy = id; Snd.click(); }
      else doBuy(id);
    } else if (a === 'haggle') {
      const c = Market.haggle(id);
      if (c) { chatId = c.id; tab = 'chat'; }
    } else if (a === 'buyChat') {
      const c = Market.chats().find(x => x.id === chatId);
      if (c) doBuy(c.oid, c.id);
    } else if (a === 'openChat') {
      chatId = id; tab = 'chat';
    } else if (a === 'accept') {
      const net = Market.accept(chatId);
      if (net) {
        Snd.jingle('epic');
        FX.rain(['#7df9a7', '#ffe17d', '#ffffff'], 80);
        const c = Market.chats().find(x => x.id === chatId);
        UI.toast(`🤝 Продано! +${Market.money(net, c.cur)}`);
        UI.showEvents(State.checkNow());
      }
    } else if (a === 'decline') {
      Market.decline(chatId); Snd.open();
    } else if (a === 'counter') {
      const v = $('phCounter') ? $('phCounter').value : 0;
      if (!Market.counter(chatId, v)) {
        Snd.deny();
        const c = Market.chats().find(x => x.id === chatId);
        if (c && c.kind === 'buy' && Number(v) >= c.offer) UI.toast('Это не меньше цены — жми «Купить»');
        return;
      }
      if ($('phCounter')) $('phCounter').value = '';
      Snd.click();
    }
    UI.refreshHUD();
    render();
  }

  // уведомления о новых сообщениях
  function notify(chats) {
    const fresh = chats.filter(c => c.unread);
    if (!fresh.length) return;
    Snd.reward();
    const c = fresh[fresh.length - 1];
    const last = [...c.msgs].reverse().find(m => m.from === 'buyer');
    if (!(open && !locked && tab === 'chat' && chatId === c.id)) {
      UI.toast(`📱 ${c.buyer.name}: ${last ? last.text : 'новое сообщение'}`);
    }
    const btn = $('btnPhone');
    btn.classList.remove('phRing'); void btn.offsetWidth; btn.classList.add('phRing');
  }

  // такт: раз в секунду — новые покупатели, ответы, обновление экрана
  function loop() {
    const ev = Market.tick();
    if (ev.length) { notify(ev); UI.refreshHUD(); }
    for (const o of Market.takeNews()) { // легендарка+ на рынке — повод открыть телефон
      Snd.reward();
      UI.toast(`📱 На рынке: ${CFG.RARITIES[CFG.TIER[o.r]].name.toLowerCase()} ${UI.plateText(o.plate)} за ${Market.money(o.price, o.cur)}!`);
    }
    // ленты с таймерами обновляем каждую секунду (но не пока вводится цена)
    const typing = document.activeElement && document.activeElement.id === 'phCounter';
    if (open && (ev.length || ((tab === 'mine' || tab === 'buy') && !locked)) && !(typing && !ev.length)) render();
    else if (open && locked && lockMin !== timeStr(Date.now())) render(); // часы на экране блокировки
  }
  function init() {
    $('btnPhone').onclick = () => (open ? hide() : show());
    $('phone').addEventListener('click', e => { if (e.target.id === 'phone') hide(); });
    loop();
    setInterval(loop, 1000);
  }
  function badge() { return Market.unreadCount(); }

  return { init, show, hide, openSell, badge, isOpen: () => open };
})();
