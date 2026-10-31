// Состояние игры: сейв/лоад (сервер + localStorage), экономика, вехи, наборы,
// торговая площадка, уровень игрока, книга рекордов.
const State = (() => {
  const def = () => ({
    v: 10, ts: 0, money: CFG.START_MONEY, spins: 0,
    taken: {},   // уникальные номера (легендарка+), которые уже существуют: больше не выпадают
    found: {},   // 'А123ВС77' -> { r:'epic', n:3, first:спин#, t:время }
    counts: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0, secret: 0, divine: 0 },

    up: { speed: 0, auto: 0, slots: 0, garage: 0 },
    pity: { leg: 0 },
    best: null,  // { plate, tier }
    sets: { words: {}, mythics: {}, secrets: {}, dates: {}, states: {}, vanity: {}, usSecrets: {}, milSecrets: {}, emirates: {}, aeSecrets: {}, divine: {} }, // прогресс наборов
    us: { visa: false, usd: 0, state: null, earned: 0, spent: 0 }, // США: виза и долларовый кошелёк
    ae: { visa: false, aed: 0, em: null, earned: 0, spent: 0 },     // Эмираты: виза и кошелёк в дирхамах
    claimed: {}, // id выданных наград (вехи, наборы)
    mode: 'civ',               // тип номеров: 'civ' гражданские | 'mil' военные
    region: null,              // выбранный регион (null = любой)
    milCode: null,             // выбранный код войск у военных (null = любой)
    ruMode: 'civ',             // какой тип России был выбран последним (страна и тип — разные меню)
    showcase: null,            // номер на витрине
    pending: null,             // выпавший номер, по которому игрок ещё не решил: {plate, rarity, value}
    stats: { spent: 0, earned: 0, started: Date.now(), charges: 0, pityTrig: 0,
      eliteKept: 0, raids: 0, market: 0, lowballs: 0, bought: 0 },
    legends: [],               // журнал великих находок: {p, r, n, t, how}
    daily: null,               // задания дня: {date, tasks:[{key,name,goal,reward,prog,done}]}
    combos: {},                // счётчики сочетаний: id -> сколько раз выпадало
    level: 1, xp: 0, tickets: 0,
    login: { last: null, streak: 0, claimed: true }, // бонус за вход
    bonusCharge: 0,
    prestige: 0,               // перерождений: каждое +10% ко всем продажам навсегда
    skins: { owned: {}, on: null }, // скины табличек            // заряд из бонуса за вход: следующая ручная крутка — лучший из N
    market: { listings: [], chats: [], seq: 0, deals: 0, unread: 0, // торговая площадка
      shop: { offers: [], next: { rub: 0, usd: 0 } } },            // чужие объявления (покупка)
    rec: {                     // книга рекордов
      maxSale: null, maxKept: null, maxMarket: null, maxLowball: null,
      streak: 0, maxStreak: 0, maxMoney: CFG.START_MONEY,
    },
    settings: { vol: 0.7, sound: true, fast: false, lowfx: false, autoOn: false, autoKeep: 'rare',
      birthYear: null },
  });

  let s = def();
  let saveTimer = null;

  // --- сейв/лоад ---
  // Хранилища: localStorage всегда; сервер (server.js) — только если он ответил на /load;
  // облако Telegram — если игра открыта как мини-приложение (сейв режется на куски по 4000 символов,
  // пишется в запасной слот a/b, и только потом meta переключается на него — обрыв не портит сейв).
  let hasServer = false;
  const Cloud = (() => {
    const tg = window.Telegram && window.Telegram.WebApp;
    const cs = tg && tg.CloudStorage;
    const on = !!(cs && tg.initData && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9'));
    const CH = 4000;
    let slot = 'a', busy = false, queued = null;
    const getItems = keys => new Promise(res => {
      try { cs.getItems(keys, (err, v) => res(err ? null : v)); } catch (e) { res(null); }
    });
    const setItem = (k, v) => new Promise(res => {
      try { cs.setItem(k, v, err => res(!err)); } catch (e) { res(false); }
    });
    async function load() {
      if (!on) return null;
      const m = await getItems(['meta']);
      if (!m || !m.meta) return null;
      let meta;
      try { meta = JSON.parse(m.meta); } catch (e) { return null; }
      slot = meta.slot;
      const keys = Array.from({ length: meta.n }, (_, i) => meta.slot + i);
      const parts = await getItems(keys);
      if (!parts) return null;
      try { return JSON.parse(keys.map(k => parts[k] || '').join('')); } catch (e) { return null; }
    }
    async function write(body) {
      const next = slot === 'a' ? 'b' : 'a';
      const n = Math.ceil(body.length / CH);
      const oks = await Promise.all(Array.from({ length: n }, (_, i) => setItem(next + i, body.slice(i * CH, (i + 1) * CH))));
      if (oks.every(Boolean) && await setItem('meta', JSON.stringify({ slot: next, n, ts: Date.now() }))) slot = next;
    }
    async function save(body) {
      if (!on) return;
      if (busy) { queued = body; return; }
      busy = true;
      try { await write(body); } finally { busy = false; }
      if (queued) { const b = queued; queued = null; save(b); }
    }
    return { on, load, save };
  })();

  function snapshot() { s.ts = Date.now(); return JSON.stringify(s); }

  let lastCloud = 0, cloudTimer = null, frozen = false;
  function doSave(flush) {
    if (frozen) return; // после импорта — до перезагрузки ничего не пишем
    const body = snapshot();
    try { localStorage.setItem('nomerok-save', body); } catch (e) {}
    if (hasServer) fetch('/save', { method: 'POST', body }).catch(() => {});
    if (Cloud.on) { // облако не чаще раза в 4 секунды, при сворачивании — сразу
      clearTimeout(cloudTimer);
      const wait = flush ? 0 : Math.max(0, 4000 - (Date.now() - lastCloud));
      cloudTimer = setTimeout(() => { lastCloud = Date.now(); Cloud.save(snapshot()); }, wait);
    }
  }
  function markDirty() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 800);
  }

  function merge(base, data) { // аккуратно накатываем сейв на дефолты
    for (const k in data) {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) &&
          data[k] && typeof data[k] === 'object') merge(base[k], data[k]);
      else base[k] = data[k];
    }
    return base;
  }

  function recomputeGarage() {
    let best = null;
    for (const plate in s.found) {
      const rec = s.found[plate];
      rec.r = rarityOf(plate);
      const t = CFG.TIER[rec.r];
      if (t < CFG.TIER.mythic) delete rec.black;
      if (!best || t > best.tier) best = { plate, tier: t };
    }
    if (best) s.best = best;
  }

  async function load() {
    let server = null, local = null, cloud = null;
    try {
      const r = await fetch('/load');
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) { hasServer = true; server = await r.json(); }
    } catch (e) {}
    try { local = JSON.parse(localStorage.getItem('nomerok-save')); } catch (e) {}
    cloud = await Cloud.load();
    // берём самый свежий, чтобы старый сейв не затёр новый
    const data = pickFresh([server, local, cloud]);
    s = def();
    if (data) {
      merge(s, data);
      if ((data.v || 1) < 3) s.money = Math.max(s.money, CFG.START_MONEY); // миграция на новую экономику
      if (data.unlocked) { // миграция с локаций: возвращаем деньги за разблокировки
        const refund = { mega: 2000, kavkaz: 3000, msk: 15000, elite: 75000 };
        for (const k in data.unlocked) if (refund[k]) s.money += refund[k];
        delete s.unlocked;
        delete s.loc;
      }
      if ((data.v || 1) < 7) {
        // v7: секретки стали точными номерами — пересчёт гаража и набора секреток
        recomputeGarage();
        s.sets.secrets = {};
        for (const plate in s.found) {
          const sec = Plates.secretOf(plate);
          if (sec) s.sets.secrets[sec.key] = plate;
        }
        delete s.sets.mythics['А001АА77']; // переехал в секретки
        // уровень задним числом за уже накрученное (без денежных наград)
        let xp = Math.round(s.spins * 1.5);
        while (xp >= xpNeed(s.level)) { xp -= xpNeed(s.level); s.level++; }
        s.xp = xp;
        s.tickets = Math.floor(s.level / CFG.LEVEL.TICKET_EVERY);
      }
      if ((data.v || 1) < 8) {
        // v8: легендарки и выше уникальны — всё, что уже выпадало, помечаем существующим
        for (const p of Object.keys(s.found)) markTaken(p);
        for (const L of s.legends || []) markTaken(L.p);
      }
      if ((data.v || 1) < 9) {
        // v9: «Удача» и «Множитель ₽» убраны — деньги за купленные уровни возвращаются
        let refund = 0;
        for (const k of ['luck', 'mult']) {
          const lv = s.up[k] || 0;
          for (let i = 0; i < lv; i++) refund += CFG.REFUND_V9[k][i] || 0;
          delete s.up[k];
        }
        if (refund) { s.money += refund; queue.push({ text: `Удача и Множитель ₽ убраны из магазина — вернули ${refund.toLocaleString('ru-RU')} ₽`, reward: 0 }); }
      }
      if ((data.v || 1) < 9) silentAch();
      if ((data.v || 1) < 10) {
        // v10: «золотое исполнение» мификов и секреток убрано — разница в цене возвращается деньгами
        for (const p of Object.keys(s.gold || {})) {
          if (s.found[p]) {
            const plain = rawValue(p);
            const refund = Math.round(plain * 11 * (1 + CFG.PRESTIGE.BONUS * (s.prestige || 0)));
            credit(curOfPlate(p), refund);
            s.found[p].r = Plates.classify(p);
            queue.push({ text: `Золотой ${p} стал обычным ${CFG.RARITIES[CFG.TIER[s.found[p].r]].name.toLowerCase()} — разница вернулась деньгами`, reward: 0 });
          }
        }
        delete s.gold;
      }
      s.v = 10;
      repairUniques();
      if (s.region && !CFG.REG_TIER[s.region]) s.region = null;
      if (s.milCode && !CFG.MIL_CODE_TIER[s.milCode]) s.milCode = null;
      if (!['civ', 'mil', 'us', 'ae'].includes(s.mode) || (s.mode === 'us' && !s.us.visa) || (s.mode === 'ae' && !s.ae.visa)) s.mode = 'civ';
      if (s.ae.em && !CFG.AE_EM[s.ae.em]) s.ae.em = null;
      if (s.us.state && !CFG.US_STATE[s.us.state]) s.us.state = null;
    }
    CFG.myYear = s.settings.birthYear || null;
    ensureDaily();
  }

  function pickFresh(list) {
    return list.filter(d => d && typeof d === 'object' && d.found).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0] || null;
  }

  function reset() { s = def(); CFG.myYear = null; ensureDaily(); doSave(true); }

  // перенос между устройствами: сейв целиком текстом
  function exportSave() { return snapshot(); }
  function importSave(text) {
    let data;
    try { data = JSON.parse(text.trim()); } catch (e) { return false; }
    if (!data || typeof data !== 'object' || !data.found || typeof data.spins !== 'number') return false;
    frozen = true;
    clearTimeout(saveTimer); clearTimeout(cloudTimer);
    data.ts = Date.now(); // импорт — самый свежий сейв на всех хранилищах
    const body = JSON.stringify(data);
    try { localStorage.setItem('nomerok-save', body); } catch (e) {}
    if (hasServer) fetch('/save', { method: 'POST', body }).catch(() => {});
    return Cloud.on ? Cloud.save(body).then(() => true) : Promise.resolve(true);
  }
  function storageInfo() { return { cloud: Cloud.on, server: hasServer }; }

  // --- тип номеров ---
  function setMode(m) {
    s.mode = m === 'mil' ? 'mil' : (m === 'us' && s.us.visa) ? 'us' : (m === 'ae' && s.ae.visa) ? 'ae' : 'civ';
    if (s.mode === 'civ' || s.mode === 'mil') s.ruMode = s.mode;
    markDirty();
  }

  // --- валюты: рубли, доллары, дирхамы ---
  // cur: 'rub' | 'usd' | 'aed'. Номер продаётся в валюте своей страны.
  function curOfPlate(plate) { const dv = Plates.divineOf(plate); if (dv) return dv.cur; return Plates.isAE(plate) ? 'aed' : Plates.isUS(plate) ? 'usd' : 'rub'; }
  function curMode() { return s.mode === 'us' ? 'usd' : s.mode === 'ae' ? 'aed' : 'rub'; }
  function balance(cur) { return cur === 'usd' ? s.us.usd : cur === 'aed' ? s.ae.aed : s.money; }
  function credit(cur, v) {
    if (cur === 'usd') { s.us.usd += v; s.us.earned += v; if (s.us.usd > (s.rec.maxUsd || 0)) s.rec.maxUsd = s.us.usd; }
    else if (cur === 'aed') { s.ae.aed += v; s.ae.earned += v; if (s.ae.aed > (s.rec.maxAed || 0)) s.rec.maxAed = s.ae.aed; }
    else addMoney(v);
  }
  function debit(cur, v) {
    if (cur === 'usd') { s.us.usd -= v; s.us.spent += v; }
    else if (cur === 'aed') { s.ae.aed -= v; s.ae.spent += v; }
    else spend(v);
  }

  // --- виза и обменник ---
  function buyVisa() {
    if (s.us.visa || s.money < CFG.US.VISA_PRICE) return false;
    spend(CFG.US.VISA_PRICE);
    s.us.visa = true;
    s.us.usd += CFG.US.START_USD;
    markDirty();
    return true;
  }
  function buyVisaAE() {
    if (s.ae.visa || s.money < CFG.AE.VISA_PRICE) return false;
    spend(CFG.AE.VISA_PRICE);
    s.ae.visa = true;
    s.ae.aed += CFG.AE.START_AED;
    markDirty();
    return true;
  }
  // обмен: dir = 'rub2usd' | 'usd2rub' | 'rub2aed' | 'aed2rub' (комиссия FEE)
  const EX = { usd: () => CFG.US, aed: () => CFG.AE };
  function exchangeQuote(dir, amount) {
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    const [from, to] = dir.split('2');
    const fx = EX[from === 'rub' ? to : from]();
    return from === 'rub' ? Math.floor(a / fx.RATE * (1 - fx.FEE)) : Math.floor(a * fx.RATE * (1 - fx.FEE));
  }
  function exchange(dir, amount) {
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    const [from, to] = dir.split('2');
    const out = exchangeQuote(dir, a);
    if (!a || !out || balance(from) < a) return 0;
    // обмен не считается заработком/тратой в статистике
    const add = (cur, v) => { if (cur === 'rub') s.money += v; else if (cur === 'usd') s.us.usd += v; else s.ae.aed += v; };
    add(from, -a);
    add(to, out);
    markDirty();
    return out;
  }
  function setAeEm(em) { s.ae.em = (em && CFG.AE_EM[em]) ? em : null; markDirty(); }
  function setUsState(st) { s.us.state = (st && CFG.US_STATE[st]) ? st : null; markDirty(); }
  function setBirthYear(y) {
    const n = Number(y);
    s.settings.birthYear = (n >= 1900 && n <= 2026) ? n : null;
    CFG.myYear = s.settings.birthYear;
    markDirty();
  }

  // --- уникальные номера ---
  function markTaken(plate) { const k = Plates.uniqKey(plate); if (k) s.taken[k] = true; }
  function untake(key) { delete s.taken[key]; }
  // секретка или именной мифик засчитывается в коллекцию в момент находки — даже если его продать:
  // такой номер единственный, второго шанса не будет
  function creditUnique(plate) {
    const dv = Plates.divineOf(plate);
    if (dv) { s.sets.divine[dv.key] = plate; return; }
    const sec = Plates.secretOf(plate);
    if (sec) {
      const set = Plates.isAE(plate) ? s.sets.aeSecrets : Plates.isUS(plate) ? s.sets.usSecrets : Plates.isMil(plate) ? s.sets.milSecrets : s.sets.secrets;
      set[sec.key] = set[sec.key] || plate;
    }
    if (!Plates.isUS(plate) && !Plates.isAE(plate) && Plates.mythicName(plate)) s.sets.mythics[plate] = true;
  }
  // починка уникальных при каждом запуске:
  //  — всё найденное (гараж + журнал находок) засчитано в коллекции;
  //  — «занятыми» остаются только реально найденные или лежащие на рынке; остальное
  //    (истёкшие объявления, которые никто не купил) возвращается в игру
  function repairUniques() {
    const found = new Set([...Object.keys(s.found), ...(s.legends || []).map(l => l.p)]);
    for (const p of found) creditUnique(p);
    const keep = new Set();
    for (const p of found) { const k = Plates.uniqKey(p); if (k) keep.add(k); }
    for (const o of ((s.market.shop || {}).offers || [])) { const k = Plates.uniqKey(o.plate); if (k) keep.add(k); }
    for (const l of (s.market.listings || [])) { const k = Plates.uniqKey(l.plate); if (k) keep.add(k); }
    for (const k of Object.keys(s.taken)) if (!keep.has(k)) delete s.taken[k];
    for (const k of keep) s.taken[k] = true;
  }
  function isTaken(key) { return !!s.taken[key]; }
  function isUnique(plate) { return !!Plates.uniqKey(plate); }

  // --- вместимость гаража: уникальные номера лежат в сейфе и место не занимают ---
  function garageCap() { return CFG.GARAGE.BASE + CFG.GARAGE.STEP * (s.up.garage || 0); }
  function garageUsed() { return Object.keys(s.found).filter(p => !isUnique(p)).length; }
  function safeCount() { return Object.keys(s.found).filter(p => isUnique(p)).length; }
  function canKeep(plate) { return isUnique(plate) || garageUsed() < garageCap(); }

  // --- экономика ---
  function multValue(v) { return Math.round(v); } // «Множитель ₽» убран; функция осталась для совместимости
  // все приходы/расходы идут через эти две — копится статистика профиля
  function addMoney(v) {
    s.money += v;
    s.stats.earned += v;
    if (s.money > s.rec.maxMoney) s.rec.maxMoney = s.money;
  }
  function spend(v) { s.money -= v; s.stats.spent += v; }

  // очередь событий (ежедневки, уровни и пр.), отдаётся вместе с checkRewards
  let queue = [];
  function pushEv(text, reward) { queue.push({ text, reward }); }

  // --- книга рекордов ---
  function better(slot, plate, value) {
    if (!s.rec[slot] || value > s.rec[slot].v) s.rec[slot] = { p: plate, v: value, t: Date.now() };
  }
  function recordSale(plate, value) { better('maxSale', plate, value); }
  

  // --- уровень игрока ---
  function xpNeed(lvl) { return Math.round(CFG.LEVEL.XP_BASE * Math.pow(lvl, 1.5)); }
  function levelTitle(lvl) {
    const T = CFG.LEVEL.TITLES;
    return T[Math.min(T.length - 1, Math.floor((lvl - 1) / 3))];
  }
  function addXP(tier) {
    s.xp += 1 + 2 * tier;
    while (s.xp >= xpNeed(s.level)) {
      s.xp -= xpNeed(s.level);
      s.level++;
      const money = CFG.LEVEL.REWARD(s.level);
      addMoney(money);
      let text = `Уровень ${s.level}! ${levelTitle(s.level)}`;
      if (s.level % CFG.LEVEL.TICKET_EVERY === 0) {
        s.tickets++;
        text += ' + билет заряда ⚡';
      }
      pushEv(text, money);
    }
  }
  // --- бонус за вход ---
  const dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  // новый день: двигаем серию. Возвращает true, если сегодня бонус ещё не забран
  function loginCheck() {
    const L = s.login || (s.login = { last: null, streak: 0, claimed: true });
    const now = new Date(), today = dayKey(now);
    if (L.last !== today) {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      L.streak = L.last === dayKey(y) ? L.streak + 1 : 1;
      L.last = today;
      L.claimed = false;
      markDirty();
    }
    return !L.claimed;
  }
  function loginDay() { return ((Math.max(1, s.login.streak) - 1) % CFG.LOGIN.DAYS.length); }
  function loginReward(i) {
    const d = CFG.LOGIN.DAYS[i];
    return { money: d.money ? d.money * CFG.LOGIN.MONEY(s.level) : 0, tickets: d.tickets || 0, charge: d.charge || 0 };
  }
  function claimLogin() {
    if (!s.login || s.login.claimed) return null;
    const r = loginReward(loginDay());
    if (r.money) addMoney(r.money);
    s.tickets += r.tickets;
    if (r.charge) s.bonusCharge = Math.max(s.bonusCharge || 0, r.charge);
    s.login.claimed = true;
    markDirty();
    return r;
  }
  // --- перерождение ---
  function prestigeNeed() { return CFG.PRESTIGE.NEED(s.prestige || 0); }
  function canPrestige() { return s.money >= prestigeNeed(); }
  // сгорает: рубли, доллары, обычные номера гаража, апгрейды магазина, объявления на рынке.
  // остаётся: сейф (мифики и секретки), коллекции, уровень, достижения, визы, рекорды, рейтинг рынка, скины
  function doPrestige() {
    if (!canPrestige()) return false;
    for (const l of (s.market.listings || [])) if (!l.sold && isUnique(l.plate)) s.found[l.plate] = l.rec; // уникальные — в сейф
    for (const p of Object.keys(s.found)) if (!isUnique(p)) delete s.found[p];
    if (s.showcase && !s.found[s.showcase]) s.showcase = null;
    s.market.listings = [];
    s.market.chats = s.market.chats.filter(c => c.kind === 'buy' && c.status !== 'open' && c.status !== 'firm');
    s.money = CFG.START_MONEY;
    if (s.us.visa) s.us.usd = CFG.US.START_USD;
    if (s.ae && s.ae.visa) s.ae.aed = CFG.AE.START_AED;
    s.up = { speed: 0, auto: 0, slots: 0, garage: 0 };
    s.settings.autoOn = false;
    s.pending = null;
    s.prestige = (s.prestige || 0) + 1;
    pushEv(`🔁 ПЕРЕРОЖДЕНИЕ ${s.prestige}! Все продажи теперь +${Math.round(CFG.PRESTIGE.BONUS * 100 * s.prestige)}%`, 0);
    doSave(true);
    return true;
  }

  // --- скины ---
  function buySkin(key) {
    const sk = CFG.SKINS.find(x => x.key === key);
    if (!sk || s.skins.owned[key] || s.money < sk.cost) return false;
    spend(sk.cost);
    s.skins.owned[key] = true;
    s.skins.on = key;
    markDirty();
    return true;
  }
  function setSkin(key) { s.skins.on = key && s.skins.owned[key] ? key : null; markDirty(); }

  function useBonusCharge() {
    const n = s.bonusCharge || 0;
    if (n) { s.bonusCharge = 0; markDirty(); }
    return n;
  }

  function useTicket() {
    if (s.tickets <= 0) return false;
    s.tickets--;
    markDirty();
    return true;
  }

  // --- задания дня ---
  function ensureDaily() {
    const date = new Date().toISOString().slice(0, 10);
    const valid = s.daily && s.daily.tasks.every(t => CFG.DAILY_POOL.some(p => p.key === t.key));
    if (s.daily && s.daily.date === date && valid) return;
    let seed = 0;
    for (const ch of date) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const pool = [...CFG.DAILY_POOL];
    const tasks = [];
    for (let i = 0; i < CFG.DAILY_COUNT && pool.length; i++) {
      const t = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      const gi = Math.floor(rnd() * t.goals.length);
      tasks.push({ key: t.key, name: t.name.replace('{n}', t.goals[gi].toLocaleString('ru-RU')),
        goal: t.goals[gi], reward: t.rewards[gi], prog: 0, done: false });
    }
    s.daily = { date, tasks };
    markDirty();
  }
  function bumpDaily(key, amt) {
    ensureDaily();
    for (const t of s.daily.tasks) {
      if (t.key !== key || t.done) continue;
      t.prog += amt;
      if (t.prog >= t.goal) {
        t.done = true;
        addMoney(t.reward);
        pushEv(`Задание дня: ${t.name}!`, t.reward);
      }
    }
  }

  function upgradeCost(key) {
    const u = CFG.UPGRADES[key];
    return s.up[key] >= u.costs.length ? null : u.costs[s.up[key]];
  }
  function buyUpgrade(key) {
    const cost = upgradeCost(key);
    if (cost === null || s.money < cost) return false;
    spend(cost);
    s.up[key]++;
    markDirty();
    return true;
  }

  // --- вехи и наборы ---
  function uniques() { return Object.keys(s.found).length; }

  function checkRewards() {
    const events = queue.splice(0);
    const claim = (id, text, reward) => {
      if (s.claimed[id]) return;
      s.claimed[id] = true;
      addMoney(reward);
      events.push({ text, reward });
    };
    const un = uniques();
    for (const m of CFG.MILESTONES.uniques)
      if (un >= m.at) claim('u' + m.at, `Коллекция: ${m.at} уникальных номеров!`, m.reward);
    for (const m of CFG.MILESTONES.spins)
      if (s.spins >= m.at) claim('s' + m.at, `Открутил ${m.at} раз!`, m.reward);
    if (Object.keys(s.sets.words).length >= CFG.WORDS.length)
      claim('set-words', 'Словарь собран целиком!', CFG.SET_REWARDS.words);
    if (Object.keys(s.sets.mythics).length >= CFG.MYTHICS.length)
      claim('set-mythics', 'ВСЕ ИМЕННЫЕ ЛЕГЕНДЫ ТВОИ!', CFG.SET_REWARDS.mythics);
    if (Object.keys(s.sets.secrets).length >= CFG.SECRET_PLATES.length)
      claim('set-secrets', 'ВСЕ СЕКРЕТНЫЕ НОМЕРА РАСКРЫТЫ!', CFG.SET_REWARDS.secrets);
    if (Object.keys(s.sets.dates || {}).length >= Object.keys(CFG.MIL_DATES).length)
      claim('set-dates', 'ВСЕ ВЕЛИКИЕ ДАТЫ СОБРАНЫ!', CFG.SET_REWARDS.dates);
    for (const a of CFG.ACH) {
      const p = a.prog(s);
      a.goals.forEach((g, i) => {
        const id = achKey(a, i);
        if (s.claimed[id] || p < g) return;
        s.claimed[id] = true;
        const r = achReward(a, i);
        addMoney(r.money);
        s.tickets += r.tickets;
        events.push({ text: `🏅 ${a.name}${a.goals.length > 1 ? ' ' + ROMAN[i] : ''}${r.tickets ? ` · 🎟 +${r.tickets}` : ''}`, reward: r.money });
      });
    }
    return events;
  }
  // достижения: ключ уровня, награда и очки
  const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
  function achKey(a, i) { return 'A:' + a.id + ':' + i; }
  function achReward(a, i) {
    if (a.secret) return CFG.ACH_SECRET;
    if (a.goals.length === 1) return CFG.ACH_SINGLE;
    return { money: CFG.ACH_TIER.money[i], tickets: CFG.ACH_TIER.tickets[i], points: CFG.ACH_TIER.points[i] };
  }
  function achPoints() {
    let pts = 0;
    for (const a of CFG.ACH) a.goals.forEach((g, i) => { if (s.claimed[achKey(a, i)]) pts += achReward(a, i).points; });
    return pts;
  }
  // при переходе на новые достижения: всё, что уже выполнено, засчитывается без повторной выплаты
  function silentAch() {
    for (const a of CFG.ACH) {
      const p = a.prog(s);
      a.goals.forEach((g, i) => { if (p >= g) s.claimed[achKey(a, i)] = true; });
    }
  }
  // проверить награды вне крутки (магазин, рынок)
  function checkNow() { const ev = checkRewards(); if (ev.length) markDirty(); return ev; }

  // --- цена крутки: военные ×COST_MULT (регион не действует), гражданские × множитель региона,
  //     США — в долларах × множитель выбранного штата ---
  function regCostMult() {
    if (s.mode === 'ae') return s.ae.em ? CFG.AE_TIERS[CFG.AE_EM[s.ae.em].tier].costMult : 1;
    if (s.mode === 'us') return s.us.state ? CFG.US_TIERS[CFG.US_STATE[s.us.state].tier].costMult : 1;
    if (s.mode === 'mil') return CFG.MIL.COST_MULT * (s.milCode ? CFG.MIL_CODE_TIER[s.milCode].costMult : 1);
    return s.region ? CFG.REG_TIER[s.region].costMult : 1;
  }
  function spinCost() { return (s.mode === 'us' ? CFG.US.SPIN_COST : s.mode === 'ae' ? CFG.AE.SPIN_COST : CFG.SPIN_COST) * regCostMult(); }
  function vipList() { return s.mode === 'us' ? CFG.US.VIP : s.mode === 'ae' ? CFG.AE.VIP : CFG.VIP; }
  function vipCost(i) { return vipList()[i].cost * regCostMult(); }
  // закреплённый «регион» для текущего режима: регион России или штат США
  function pinFor() { return s.mode === 'us' ? s.us.state : s.mode === 'ae' ? s.ae.em : s.mode === 'mil' ? s.milCode : s.region; }
  // Оплата VIP-гаранта. false = не хватило.
  function payVip(cost) {
    const cur = curMode();
    if (balance(cur) < cost) return false;
    debit(cur, cost);
    s.stats.vips = (s.stats.vips || 0) + 1;
    markDirty();
    return true;
  }
  function setMilCode(code) {
    s.milCode = (code && CFG.MIL_CODE_TIER[code]) ? code : null;
    markDirty();
  }
  function setRegion(reg) {
    s.region = (reg && CFG.REG_TIER[reg]) ? reg : null;
    markDirty();
  }

  // --- крутка и продажа ---
  // Цена продажи: база × сочетания номера × регион номера × «Множитель ₽»
  // США — в долларах: база × сочетания × тир штата
  // редкость конкретного номера: золотой (божественный) — это тот же мифик/секретка в золоте
  function rarityOf(plate) { return Plates.classify(plate); }
  function sellValue(plate) {
    return Math.round(rawValue(plate) * (1 + CFG.PRESTIGE.BONUS * (s.prestige || 0)));
  }
  function rawValue(plate) {
    if (Plates.isDivine(plate)) return Plates.basePrice(plate);
    if (Plates.isAE(plate)) {
      const e = CFG.AE_EM[Plates.codeOf(plate)];
      return multValue(Math.max(1, Math.round(Plates.basePrice(plate) * (e ? CFG.AE_TIERS[e.tier].sellMult : 1))));
    }
    if (Plates.isUS(plate)) {
      const st = CFG.US_STATE[Plates.codeOf(plate)];
      return multValue(Math.max(1, Math.round(Plates.basePrice(plate) * (st ? CFG.US_TIERS[st.tier].sellMult : 1))));
    }
    if (Plates.isMil(plate)) { // военные: × тир кода войск
      const ct = CFG.MIL_CODE_TIER[plate.slice(6)];
      return multValue(Math.round(Plates.basePrice(plate) * (ct ? ct.sellMult : 1)));
    }
    const rt = CFG.REG_TIER[plate.slice(6)];
    return multValue(Math.round(Plates.basePrice(plate) * (rt ? rt.sellMult : 1)));
  }
  // продажа: деньги в валюту номера; рубли идут в задания дня и рекорды
  function creditSale(plate, value) {
    const cur = curOfPlate(plate);
    credit(cur, value);
    if (cur === 'rub') { bumpDaily('earn', value); recordSale(plate, value); }
  }

  // Оплата крутки. true = денег не хватило: крутка бесплатна, но результат авто-продаётся.
  function paySpin() {
    const cost = spinCost(), cur = curMode();
    if (balance(cur) >= cost) { debit(cur, cost); markDirty(); return false; }
    s.claimed.flagBroke = true; // крутка без денег: бесплатно, но всё продаётся
    return true;
  }
  // Регистрирует выпавший номер. meta: {trig, how, charge} — pity, способ добычи, заряд.
  // Исходы:
  //  dup    — уже есть в гараже, копия авто-продаётся
  //  choice — новый номер (любой, даже обычный): игрок решает, продать или оставить
  function registerSpin(plate, rarity, meta = {}) {
    s.spins++;
    const tier = CFG.TIER[rarity];
    s.counts[rarity]++;
    if (!s.best || tier > s.best.tier) s.best = { plate, tier };
    if (meta.trig) s.stats.pityTrig++;
    if (meta.charge) s.stats.charges++;
    if (Plates.isMil(plate)) s.stats.milSpins = (s.stats.milSpins || 0) + 1;
    else if (Plates.isUS(plate)) s.stats.usSpins = (s.stats.usSpins || 0) + 1;
    else if (Plates.isAE(plate)) s.stats.aeSpins = (s.stats.aeSpins || 0) + 1;
    const hr = new Date().getHours();
    if (hr >= 3 && hr < 5) s.claimed.flagNight = true;
    markTaken(plate); // мифик и секретка — единственный экземпляр, больше не выпадет
    creditUnique(plate);
    // серия без редкого — рекорд терпения
    if (tier >= CFG.TIER.rare) s.rec.streak = 0;
    else if (++s.rec.streak > s.rec.maxStreak) s.rec.maxStreak = s.rec.streak;
    addXP(tier);
    bumpDaily('spins', 1);
    if (tier >= 1) bumpDaily('found', 1);
    if (tier >= CFG.TIER.rare) bumpDaily('rares', 1);
    // счётчики сочетаний + награда за первое открытие
    for (const c of Plates.combosOf(plate)) {
      const first = !s.combos[c.id];
      s.combos[c.id] = (s.combos[c.id] || 0) + 1;
      if (first) {
        if (Plates.isAE(plate)) { // сочетания Эмиратов награждают дирхамами
          const aed = Math.max(10, Math.round(CFG.COMBO_REWARD(c) / CFG.AE.RATE));
          credit('aed', aed);
          pushEv(`Открыто сочетание «${c.name}»! +${aed.toLocaleString('ru-RU')} AED`, 0);
          if (!s.claimed['aeCombosAll'] && CFG.AE_COMBOS.every(x => s.combos[x.id])) {
            s.claimed['aeCombosAll'] = true;
            credit('aed', 50000);
            pushEv('ВСЕ СОЧЕТАНИЯ ЭМИРАТОВ ОТКРЫТЫ! +50 000 AED', 0);
          }
          continue;
        }
        if (Plates.isUS(plate)) { // американские сочетания награждают долларами
          const usd = Math.max(5, Math.round(CFG.COMBO_REWARD(c) / 50));
          credit('usd', usd);
          pushEv(`Открыто сочетание «${c.name}»! +$${usd}`, 0);
          if (!s.claimed['usCombosAll'] && CFG.US_COMBOS.every(x => s.combos[x.id])) {
            s.claimed['usCombosAll'] = true;
            credit('usd', 20000);
            pushEv('ВСЕ АМЕРИКАНСКИЕ СОЧЕТАНИЯ ОТКРЫТЫ! +$20 000', 0);
          }
          continue;
        }
        const reward = CFG.COMBO_REWARD(c);
        addMoney(reward);
        pushEv(`Открыто сочетание «${c.name}»!`, reward);
        if (!s.claimed['combosAll'] && CFG.COMBOS.every(x => s.combos[x.id])) {
          s.claimed['combosAll'] = true;
          addMoney(CFG.COMBOS_COMPLETE_REWARD);
          pushEv('ВСЕ ГРАЖДАНСКИЕ СОЧЕТАНИЯ ОТКРЫТЫ!', CFG.COMBOS_COMPLETE_REWARD);
        }
        if (!s.claimed['milCombosAll'] && CFG.MIL_COMBOS.every(x => s.combos[x.id])) {
          s.claimed['milCombosAll'] = true;
          addMoney(CFG.COMBOS_COMPLETE_REWARD);
          pushEv('ВСЕ ВОЕННЫЕ СОЧЕТАНИЯ ОТКРЫТЫ!', CFG.COMBOS_COMPLETE_REWARD);
        }
      }
    }
    // журнал легенд: легендарка и выше попадает в историю, даже если потом продать
    if (tier >= CFG.TIER.legendary) {
      s.legends.unshift({ p: plate, r: rarity, n: s.spins, t: Date.now(), how: meta.how || 'luck' });
      if (s.legends.length > 100) s.legends.length = 100;
    }
    const rec = s.found[plate];
    if (rec) {
      rec.n++; // сколько раз выпадал
      const value = sellValue(plate);
      creditSale(plate, value);
      const events = checkRewards();
      markDirty();
      return { kind: 'dup', value, count: rec.n, events };
    }
    markDirty();
    return { kind: 'choice', value: sellValue(plate) };
  }

  // Решение «в гараж»: номер сохраняется, двигает наборы и вехи.
  // Мифик+ помечается чёрным трофеем (добыт через чёрный конверт).
  function keepPlate(plate, rarity) {
    s.found[plate] = { r: rarity, n: 1, first: s.spins, t: Date.now() };
    if (CFG.TIER[rarity] >= CFG.TIER.mythic) s.found[plate].black = true;
    bumpDaily('keep', 1);
    if (Plates.isDivine(plate)) { // божественный: только в коллекцию «✨ Божественные»
      creditUnique(plate);
      better('maxKept', plate, sellValue(plate));
      const events = checkRewards();
      markDirty();
      return events;
    }
    const sec = Plates.secretOf(plate);
    if (Plates.isAE(plate)) { // наборы Эмиратов: эмираты, секретки
      const p = Plates.parse(plate);
      s.sets.emirates[p.em] = s.sets.emirates[p.em] || plate;
      creditUnique(plate);
      const events = checkRewards();
      markDirty();
      return events;
    }
    if (Plates.isUS(plate)) { // наборы США: штаты, именные таблички, секретки
      const p = Plates.parse(plate);
      s.sets.states[p.st] = s.sets.states[p.st] || plate;
      if (p.van) s.sets.vanity[p.t] = plate;
      if (sec) s.sets.usSecrets[sec.key] = plate;
      const events = checkRewards();
      markDirty();
      return events;
    }
    better('maxKept', plate, sellValue(plate));
    const mil = Plates.isMil(plate);
    const rt = mil ? null : CFG.REG_TIER[plate.slice(6)];
    if (rt && rt.key === 't3') s.stats.eliteKept++;
    const w = Plates.letters(plate);
    if (!mil && CFG.WORDS.includes(w)) s.sets.words[w] = plate;
    if (Plates.milDate(plate)) { s.sets.dates = s.sets.dates || {}; s.sets.dates[plate.slice(0, 4)] = plate; }
    if (Plates.mythicName(plate)) s.sets.mythics[plate] = true;
    creditUnique(plate); // секретки (гражданские и военные) и именные мифики
    if (!Plates.isUS(plate) && Plates.parse(plate).d.includes('666')) s.claimed.flagDevil = true;
    const events = checkRewards();
    markDirty();
    return events;
  }

  // Решение «продать» только что выпавший номер
  function sellPending(plate) {
    const value = sellValue(plate);
    if (CFG.TIER[rarityOf(plate)] >= CFG.TIER.mythic) s.claimed.flagSoldMyth = true;
    creditSale(plate, value);
    markDirty();
    return value;
  }

  // Продажа из гаража; priceOverride — цена сделки на рынке.
  // Запись удаляется; прогресс наборов остаётся (находку не сотрёшь).
  function sellFromGarage(plate, priceOverride) {
    const rec = s.found[plate];
    if (!rec) return 0;
    const value = priceOverride || sellValue(plate);
    creditSale(plate, value);
    delete s.found[plate];
    if (s.showcase === plate) s.showcase = null;
    markDirty();
    return value;
  }

  // невыбранный номер переживает закрытие игры (в Telegram её закрывают свайпом без предупреждения)
  function setPending(p) { s.pending = p; doSave(true); }
  function clearPending() { if (s.pending) { s.pending = null; markDirty(); } }

  function setShowcase(plate) {
    s.showcase = (plate && s.found[plate]) ? plate : null;
    markDirty();
  }

  function raidStarted() { s.stats.raids++; markDirty(); }

  function get() { return s; }

  return { load, doSave, markDirty, reset, get, paySpin, payVip, registerSpin, keepPlate, sellPending,
    sellFromGarage, sellValue, setShowcase, buyUpgrade, upgradeCost, uniques, multValue,
    spinCost, vipCost, setRegion, setMilCode, checkNow, ensureDaily,
    xpNeed, levelTitle, useTicket, raidStarted, better, credit, debit, creditSale, setMode, setBirthYear,
    curOfPlate, curMode, balance, buyVisa, exchange, exchangeQuote, setUsState, setAeEm, buyVisaAE, vipList, pinFor, markTaken, untake, isTaken, isUnique,
    garageCap, garageUsed, safeCount, canKeep, rarityOf, achKey, achReward, achPoints, loginCheck, loginDay, loginReward, claimLogin, useBonusCharge, buySkin, setSkin, prestigeNeed, canPrestige, doPrestige, exportSave, importSave, storageInfo, isFrozen: () => frozen, setPending, clearPending };
})();

// свернули мини-приложение / переключили вкладку — сразу сохраняем (в Telegram beforeunload ненадёжен)
document.addEventListener('visibilitychange', () => { if (document.hidden) State.doSave(true); });

// сейв при закрытии вкладки
window.addEventListener('beforeunload', () => {
  if (State.isFrozen()) return;
  try {
    const body = JSON.stringify(Object.assign(State.get(), { ts: Date.now() }));
    localStorage.setItem('nomerok-save', body);
    if (State.storageInfo().server) navigator.sendBeacon('/save', body);
  } catch (e) {}
});
