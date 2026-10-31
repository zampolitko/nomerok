// «Блатной Рынок» — торговая площадка в телефоне: объявления, покупатели с характерами, торг.
// Чистые расчёты (оценка, ожидание, покупатель) работают и в node — для симуляции баланса.
const Market = (() => {
  const C = (typeof CFG !== 'undefined') ? CFG : require('./config.js');
  const P = (typeof Plates !== 'undefined') ? Plates : require('./plates.js');
  const M = C.MARKET;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  // --- покупатели ---
  const NAMES = {
    rub: ['Артём', 'Саня Бэха', 'Дядя Валера', 'Рустам', 'Ирина', 'Колян с района', 'Эдик', 'Батя на Камри',
      'Олег Тюнинг', 'Мага', 'Серёга', 'Вован', 'Настя', 'Гоша Автосалон', 'Тимур', 'Михалыч'],
    usd: ['Bob from Texas', 'Tony Casino', 'Trucker Mike', 'Collector Dave', 'Jessica', 'Kevin', 'Car dealer Rick',
      'Lil Plate', 'Grandma Sue', 'Hank'],
    aed: ['Sheikh Rashid', 'Ahmed', 'Khalid', 'Omar from Marina', 'Faisal', 'Yousef', 'Hamdan', 'Rich Expat Tom',
      'Saeed', 'Mansour', 'Layla', 'Abdullah'],
  };
  const AVA = ['😎', '🧔', '👨‍🦲', '👩', '🤠', '👴', '🧑‍💼', '👨‍🔧', '🕶', '🐻', '🦊', '🐺'];
  // тексты: {p} — цена объявления, {o} — предложение, {c} — встречная игрока
  const T = {
    rub: {
      normal: { hi: ['Здравствуйте! Номер ещё актуален?', 'Добрый день, номер продаёте ещё?', 'Привет! Интересует номер'],
        full: ['Беру за вашу цену — {o}. Когда удобно встретиться?', 'Устраивает {o}, готов забрать сегодня'],
        offer: ['Могу дать {o}, больше не потяну', 'Готов взять за {o}'] },
      haggler: { hi: ['Добрый день, торг уместен?', 'Здравствуйте. Скидочку сделаете?', 'Привет, по цене договоримся?'],
        offer: ['Предлагаю {o}, деньги сразу', 'Давайте за {o} и разойдёмся', '{o} — и я уже еду'] },
      lowball: { hi: ['Здарова', 'Э, продаёшь?', 'Слышь, номер ещё есть?'],
        offer: ['{o} и забираю, всё равно хлам', 'Отдай за {o}, кому он ещё нужен', '{o} наличкой, больше никто не даст'] },
      collector: { hi: ['Ого, давно такой ищу!', 'Вот это номер! Собираю такие', 'Наконец-то! Это то, что надо в коллекцию'],
        full: ['Даю {o}, без торга. Беру!', 'Плачу {o} — по рукам?'],
        offer: ['Могу предложить {o}, но это максимум', 'Даю {o}, подумайте'] },
      agree: ['Ладно, договорились — {c}', 'Ок, по рукам за {c}', 'Хорошо, беру за {c}'],
      meet: ['Давайте посередине — {o}', 'Не, многовато. {o} — последнее слово', 'Могу {o}, это край'],
      leave: ['Ну и сиди со своим номером', 'Не, дорого. Удачи', 'Ясно, пойду дальше смотреть', 'Слишком жирно, пас'],
      decline: ['Понял, извините', 'Ну и ладно', 'Жаль. Если передумаете — пишите'],
      sold: ['Блин, опоздал… Удачи!', 'Эх, уже продали? Ну ладно'],
      gone: 'Объявление снято с продажи',
    },
    usd: {
      normal: { hi: ['Hi! Is the plate still available?', 'Hello, still selling this plate?', 'Hey! Interested in your plate'],
        full: ["I'll take it for {o}. When can we meet?", '{o} works for me, deal?'],
        offer: ["I can do {o}, that's my limit", 'Would you take {o}?'] },
      haggler: { hi: ['Hi, is the price negotiable?', 'Hey, any discount?', 'Hello! Can we talk price?'],
        offer: ['How about {o}? Cash today', '{o} and I pick it up now', "Let's say {o}"] },
      lowball: { hi: ['yo', 'u selling?', 'hey is this still up'],
        offer: ['{o} cash, take it or leave it', "I'll give you {o}, nobody else will", '{o} and im doing u a favor'] },
      collector: { hi: ["Wow, I've been hunting for one like this!", 'What a plate! I collect these', 'Finally! Exactly what my collection needs'],
        full: ['{o}, no haggling. Deal!', "I'm paying {o} — shake hands?"],
        offer: ["I can offer {o}, that's my max", '{o}, think about it'] },
      agree: ['Fine, deal at {c}', 'OK, {c} it is', 'Alright, {c} works'],
      meet: ["Let's meet in the middle — {o}", '{o}, final offer', 'Best I can do is {o}'],
      leave: ['Keep it then, lol', 'Too pricey for me. Good luck', 'Nah, pass'],
      decline: ['Ok, no worries', 'Fair enough', "Shame. Text me if you change your mind"],
      sold: ['Aw, too late! Good luck', 'Sold already? Oh well'],
      gone: 'Listing removed',
    },
  };
  T.aed = T.usd; // в Эмиратах торгуются по-английски
  const fill = (t, o) => t.replace('{p}', o.p || '').replace('{o}', o.o || '').replace('{c}', o.c || '');

  // --- чистые расчёты ---
  function curOf(plate) { const dv = P.divineOf(plate); if (dv) return dv.cur; return P.isAE(plate) ? 'aed' : P.isUS(plate) ? 'usd' : 'rub'; }
  // «интересный» номер — коллекционеры пишут чаще и платят больше
  function interesting(plate) {
    if (P.tierOf(plate) >= C.TIER.epic) return true;
    return P.combosOf(plate).some(c => ['blat', 'word', 'mhist', 'mmine', 'uvan', 'uvtop', 'udate', 'alpha', 'ltrip'].includes(c.id));
  }
  function ratingLevel(deals) { return Math.min(M.RATING_MAX, Math.floor(Math.sqrt(deals || 0))); }
  // ожидание следующего покупателя (мс): чем дороже относительно оценки — тем дольше, не больше MAX
  function delayFor(price, est, plate, opts = {}) {
    let r = price / Math.max(1, est);
    if (interesting(plate)) r /= 1.3;                 // за интересными номерами очередь
    let ms = M.BASE_WAIT_MS * Math.exp(M.WAIT_GROWTH * (r - 0.8));
    ms *= 1 - 0.03 * ratingLevel(opts.deals);
    if (opts.bumped) ms *= M.BUMP_SPEED;
    if (!opts.avg) ms *= rnd(0.5, 1.5); // avg — среднее время для подсказки в интерфейсе
    return Math.round(Math.max(M.MIN_WAIT_MS, Math.min(M.MAX_WAIT_MS, ms)));
  }
  function niceRound(v, cur) {
    if (cur === 'usd' || cur === 'aed') {
      if (v >= 100000) return Math.round(v / 1000) * 1000;
      if (v >= 10000) return Math.round(v / 100) * 100;
      return v >= 100 ? Math.round(v / 5) * 5 : Math.max(1, Math.round(v));
    }
    if (v >= 100000) return Math.round(v / 1000) * 1000;
    if (v >= 10000) return Math.round(v / 500) * 500;
    if (v >= 1000) return Math.round(v / 50) * 50;
    if (v >= 100) return Math.round(v / 10) * 10;
    return Math.max(1, Math.round(v));
  }
  // новый покупатель на объявление: тип, сколько готов заплатить (скрыто), стартовое предложение
  function genBuyer(plate, price, est, deals) {
    const cur = curOf(plate);
    const intr = interesting(plate);
    const w = intr ? { normal: .35, haggler: .32, lowball: .15, collector: .18 }
      : { normal: .40, haggler: .37, lowball: .20, collector: .03 };
    let x = Math.random(), type = 'normal';
    for (const k in w) { if (x < w[k]) { type = k; break; } x -= w[k]; }
    const boost = 1 + 0.02 * ratingLevel(deals);
    const f = { normal: [0.9, 1.25], haggler: [0.8, 1.15], lowball: [0.3, 0.55], collector: [1.1, 1.8] }[type];
    const maxPay = Math.round(est * rnd(f[0], f[1]) * boost);
    let offer, full = false;
    if (type === 'lowball') offer = est * rnd(0.25, 0.5);
    else if (type === 'haggler') offer = Math.min(maxPay, price) * rnd(0.7, 0.88);
    else if (type === 'collector') {
      if (price <= maxPay) { full = true; offer = price < maxPay * 0.8 ? Math.min(maxPay, price * rnd(1.05, 1.25)) : price; }
      else offer = maxPay;
    } else { // normal
      if (price <= maxPay) { full = true; offer = price; }
      else offer = maxPay * rnd(0.85, 1);
    }
    offer = niceRound(Math.min(offer, Math.max(maxPay, price)), cur);
    if (full && type === 'normal') offer = price;
    const patience = { normal: 2, haggler: 3, lowball: 1, collector: 2 }[type];
    return { type, maxPay: Math.max(maxPay, offer), offer, full, patience, cur };
  }

  // --- работа с состоянием (только в браузере) ---
  const S = () => State.get().market;
  const money = (v, cur) => cur === 'usd' ? '$' + v.toLocaleString('ru-RU') : cur === 'aed' ? v.toLocaleString('ru-RU') + ' AED' : v.toLocaleString('ru-RU') + ' ₽';
  function est(plate) { return niceRound(State.sellValue(plate) * M.EST_MULT, curOf(plate)); }
  function slots() { return M.BASE_SLOTS + (State.get().up.slots || 0); }
  function active() { return S().listings.filter(l => !l.sold); }
  function deals() { return S().deals || 0; }
  function waitFor(l, now) {
    return delayFor(l.price, l.est, l.plate, { deals: deals(), bumped: (l.bumpUntil || 0) > now });
  }

  function list(plate, price) {
    const s = State.get();
    if (!s.found[plate] || active().length >= slots()) return false;
    const now = Date.now();
    const l = { id: ++S().seq, plate, rec: s.found[plate], price, est: est(plate), cur: curOf(plate),
      t: now, nextAt: 0, bumpUntil: 0, sold: false };
    l.nextAt = now + waitFor(l, now);
    delete s.found[plate];
    if (s.showcase === plate) s.showcase = null;
    S().listings.push(l);
    State.markDirty();
    return l;
  }
  function withdraw(lid) {
    const s = State.get();
    const l = S().listings.find(x => x.id === lid && !x.sold);
    if (!l || !State.canKeep(l.plate)) return false; // в гараже нет места
    s.found[l.plate] = l.rec;
    S().listings = S().listings.filter(x => x.id !== lid);
    for (const c of S().chats) if (c.lid === lid && c.status === 'open') {
      c.status = 'gone';
      c.msgs.push({ from: 'sys', text: T[c.cur].gone, t: Date.now() });
    }
    State.markDirty();
    return true;
  }
  function bumpCost(l) { return Math.max(M.BUMP_MIN[l.cur], Math.round(l.price * M.BUMP_FEE)); }
  function bump(lid) {
    const l = S().listings.find(x => x.id === lid && !x.sold);
    if (!l) return false;
    const cost = bumpCost(l);
    if (State.balance(l.cur) < cost) return false;
    State.debit(l.cur, cost);
    const now = Date.now();
    l.bumpUntil = now + M.BUMP_MS;
    l.nextAt = Math.min(l.nextAt, now + waitFor(l, now));
    State.markDirty();
    return true;
  }

  function addMsg(c, from, text, extra = {}) {
    c.msgs.push(Object.assign({ from, text, t: Date.now() }, extra));
    if (from === 'buyer') { c.unread = true; c.lastBuyer = Date.now(); }
  }
  function unreadCount() { return S().chats.filter(c => c.unread).length; }

  // новый покупатель пишет в чат
  function newChat(l, at) {
    const b = genBuyer(l.plate, l.price, l.est, deals());
    const L = T[l.cur][b.type];
    const c = { id: ++S().seq, lid: l.id, plate: l.plate, cur: l.cur,
      buyer: { name: pick(NAMES[l.cur]), type: b.type, ava: pick(AVA) },
      offer: b.offer, maxPay: b.maxPay, patience: b.patience, status: 'open', unread: true,
      msgs: [], replyAt: 0, reply: null, t: at };
    const o = money(b.offer, l.cur);
    c.msgs.push({ from: 'buyer', text: pick(L.hi), t: at });
    c.msgs.push({ from: 'buyer', text: fill(pick(b.full && L.full ? L.full : L.offer), { o }), t: at + 1, offer: b.offer });
    c.lastBuyer = at;
    S().chats.push(c);
    return c;
  }

  // ответ покупателя на встречную цену (выполняется, когда «допечатал»)
  function deliverReply(c) {
    if (c.kind === 'buy') return deliverSellerReply(c);
    const L = T[c.cur];
    const counter = c.reply.counter;
    if (counter <= c.maxPay) {
      c.offer = counter;
      addMsg(c, 'buyer', fill(pick(L.agree), { c: money(counter, c.cur) }), { offer: counter });
    } else {
      c.patience--;
      if (c.patience <= 0) {
        c.status = 'gone';
        addMsg(c, 'buyer', pick(L.leave));
      } else {
        const meet = niceRound(Math.min(c.maxPay, (c.offer + counter) / 2), c.cur);
        c.offer = Math.max(c.offer, meet);
        addMsg(c, 'buyer', fill(pick(L.meet), { o: money(c.offer, c.cur) }), { offer: c.offer });
      }
    }
    c.reply = null;
    c.replyAt = 0;
  }

  // главный такт: новые покупатели и ответы. Возвращает новые сообщения для уведомлений
  function tick() {
    const now = Date.now();
    const events = [];
    let fresh = 0;
    for (const l of active()) {
      let guard = 0;
      while (l.nextAt <= now && guard++ < M.OFFLINE_CAP && fresh < M.OFFLINE_CAP) {
        const c = newChat(l, l.nextAt);
        events.push(c);
        fresh++;
        l.nextAt += waitFor(l, l.nextAt);
      }
      if (l.nextAt <= now) l.nextAt = now + waitFor(l, now); // лимит накопления исчерпан
    }
    for (const c of S().chats) {
      if (c.status === 'open' && c.reply && c.replyAt <= now) { deliverReply(c); events.push(c); }
    }
    const shopChanged = shopTick(now, events);
    pruneChats();
    if (events.length || shopChanged) State.markDirty();
    return events;
  }
  // старые закрытые чаты не копим
  function pruneChats() {
    const ch = S().chats;
    if (ch.length <= 80) return;
    const closed = ch.filter(c => c.status !== 'open' && c.status !== 'firm')
      .sort((a, b) => (a.lastBuyer || a.t) - (b.lastBuyer || b.t));
    const drop = new Set(closed.slice(0, ch.length - 80));
    S().chats = ch.filter(c => !drop.has(c));
  }

  // --- действия игрока в чате ---
  function accept(cid) {
    const s = State.get();
    const c = S().chats.find(x => x.id === cid);
    if (!c || c.status !== 'open' || c.reply) return 0;
    const l = S().listings.find(x => x.id === c.lid && !x.sold);
    if (!l) return 0;
    const net = Math.round(c.offer * (1 - M.FEE));
    State.creditSale(l.plate, net);
    if (l.cur === 'rub') State.better('maxMarket', l.plate, net);
    if (c.offer >= l.est * 1.5) s.claimed.flagOverEst = true;
    s.stats.market = (s.stats.market || 0) + 1;
    S().deals = (S().deals || 0) + 1;
    l.sold = true;
    c.status = 'deal';
    addMsg(c, 'sys', `✅ Сделка: ${money(c.offer, c.cur)} − комиссия ${Math.round(M.FEE * 100)}% = +${money(net, c.cur)}`);
    c.unread = false;
    for (const o of S().chats) if (o !== c && o.lid === l.id && o.status === 'open') {
      o.status = 'gone';
      addMsg(o, 'buyer', pick(T[o.cur].sold));
    }
    S().listings = S().listings.filter(x => !x.sold);
    State.markDirty();
    return net;
  }
  function decline(cid) {
    const s = State.get();
    const c = S().chats.find(x => x.id === cid);
    if (!c || (c.status !== 'open' && c.status !== 'firm')) return;
    if (c.kind === 'buy') { // покупка: игрок передумал
      addMsg(c, 'me', c.cur !== 'rub' ? 'Changed my mind, sorry' : 'Передумал, извините');
      c.status = 'gone'; c.unread = false; c.reply = null;
      State.markDirty();
      return;
    }
    if (c.buyer.type === 'lowball') {
      s.stats.lowballs = (s.stats.lowballs || 0) + 1;
      const l = S().listings.find(x => x.id === c.lid);
      const ratio = c.offer / Math.max(1, l ? l.est : c.offer);
      if (c.cur === 'rub' && (!s.rec.maxLowball || ratio < s.rec.maxLowball.r))
        s.rec.maxLowball = { p: c.plate, v: c.offer, r: ratio, t: Date.now() };
    }
    addMsg(c, 'me', c.cur !== 'rub' ? 'No thanks, not interested' : 'Нет, не интересно');
    addMsg(c, 'buyer', pick(T[c.cur].decline));
    c.status = 'gone';
    c.unread = false;
    State.markDirty();
  }
  function counter(cid, price) {
    const c = S().chats.find(x => x.id === cid);
    const v = Math.floor(Number(price) || 0);
    if (!c || c.status !== 'open' || c.reply || v <= 0) return false;
    if (c.kind === 'buy' && v >= c.offer) return false; // не меньше цены — просто покупай
    addMsg(c, 'me', c.kind === 'buy'
      ? (c.cur !== 'rub' ? `Would you take ${money(v, c.cur)}?` : `Отдадите за ${money(v, c.cur)}?`)
      : (c.cur !== 'rub' ? `How about ${money(v, c.cur)}?` : `Давайте за ${money(v, c.cur)}`));
    c.reply = { counter: v };
    c.replyAt = Date.now() + rnd(M.REPLY_MS[0], M.REPLY_MS[1]);
    State.markDirty();
    return true;
  }
  function markRead(cid) {
    const c = S().chats.find(x => x.id === cid);
    if (c && c.unread) { c.unread = false; State.markDirty(); }
  }
  // меню разработчика: следующий покупатель приходит прямо сейчас
  function devBuyerNow() {
    const l = active()[0];
    if (!l) return false;
    l.nextAt = Date.now();
    return true;
  }

  // ================= ПОКУПКА: чужие объявления =================
  const B = M.BUY;
  const ST = { // реплики продавцов (aed — те же английские, что и usd): {c} — цена игрока, {o} — встречная продавца, {p} — окончательная
    rub: {
      hi: ['Здравствуйте, номер на месте', 'Привет, да, продаю', 'Добрый день, номер в наличии'],
      agree: ['Ладно, забирай за {c}', 'Договорились, {c}', 'Эх, уговорил — {c}'],
      meet: ['За {c} не отдам. {o} — и по рукам', 'Давай {o}, меньше никак', 'Могу скинуть до {o}, не ниже'],
      firm: ['Всё, торг окончен. Хочешь — бери за {p}', 'Цена окончательная: {p}. Не нравится — не бери', 'Не, дальше не двигаюсь. {p}'],
      insult: ['Ты прикалываешься? Цена {p}, торга не будет', 'Смешно. {p} — или до свидания'],
      sold: ['Всё, номер ушёл другому покупателю', 'Извини, уже продал'],
      hot: 'Цена и так ниже рынка — без торга',
    },
    usd: {
      hi: ['Hi, yes the plate is available', 'Hey, still selling', 'Hello! Yep, got it'],
      agree: ['Fine, {c} it is', 'Deal at {c}', 'Ugh, okay — {c}'],
      meet: ["Can't do {c}. {o} and it's yours", '{o}, lowest I go', 'I can come down to {o}'],
      firm: ["That's it, {p} final. Take it or leave it", 'Price is {p}. No more haggling', 'Not moving. {p}'],
      insult: ['Are you kidding? {p}, no haggling', 'LOL. {p} or bye'],
      sold: ['Sorry, already sold it', 'Gone to another buyer, sorry'],
      hot: "It's already below market — no haggling",
    },
  };
  const SH = () => {
    const m = S();
    if (!m.shop) m.shop = { offers: [], next: { rub: 0, usd: 0 } };
    return m.shop;
  };
  const rollW = w => { let x = Math.random(); for (const k in w) { if (x < w[k]) return k; x -= w[k]; } return Object.keys(w)[0]; };
  const rDig = () => String(1 + Math.floor(Math.random() * 999)).padStart(3, '0');
  const rLet = () => C.LETTERS[Math.floor(Math.random() * C.LETTERS.length)];

  // номера, которых не хватает в наборах игрока — на рынке их больше
  function wantedMakers(cur) {
    const s = State.get(), sets = s.sets, out = [];
    if (cur === 'aed') {
      const ems = C.AE_EMIRATES.filter(x => !sets.emirates[x.em]);
      if (ems.length) out.push(() => P.randomPlate(Math.random, pick(ems).em, 'ae')); // номер недостающего эмирата
      return out;
    }
    if (cur === 'usd') {
      const st = C.US_STATES.filter(x => !sets.states[x.st]);
      if (st.length) out.push(() => P.randomPlate(Math.random, pick(st).st, 'us')); // любой номер недостающего штата
      const van = [...C.US_VANITY.common, ...C.US_VANITY.top].filter(t => !sets.vanity[t]);
      if (van.length) out.push(() => 'US:' + P.rollState(Math.random) + ':' + pick(van));
      return out;
    }
    const words = C.WORDS.filter(w => !sets.words[w]);
    if (words.length) out.push(() => { const w = pick(words); return w[0] + rDig() + w[1] + w[2] + P.rollRegion(Math.random); });
    const dates = Object.keys(C.MIL_DATES).filter(d => !(sets.dates || {})[d]);
    if (dates.length) out.push(() => pick(dates) + rLet() + rLet() + P.rollMilCode(Math.random));
    return out;
  }
  // что этот номер закрывает в коллекциях (подпись на карточке)
  function wantedLabel(plate) {
    const s = State.get(), sets = s.sets;
    const sec = P.secretOf(plate);
    if (sec) return `🤫 секретка «${sec.name}»`;
    if (P.isAE(plate)) return sets.emirates[P.parse(plate).em] ? '' : '🧩 нового эмирата нет в коллекции';
    if (P.isUS(plate)) {
      const p = P.parse(plate);
      if (p.van && !sets.vanity[p.t]) return '🧩 нет в наборе именных';
      if (!sets.states[p.st]) return '🧩 нового штата нет в коллекции';
      return '';
    }
    const mn = P.mythicName(plate);
    if (mn && !sets.mythics[plate]) return `🧩 мифик «${mn}» для набора`;
    const date = P.milDate(plate);
    if (date && !(sets.dates || {})[plate.slice(0, 4)]) return `🧩 дата «${date}» для набора`;
    if (!P.isMil(plate) && C.WORDS.includes(P.letters(plate)) && !sets.words[P.letters(plate)]) return '🧩 нового слова нет в наборе';
    return '';
  }

  // сгенерировать объявление. forceKey — тест/дев: secret|mythic|legendary|epic|wanted|filler
  function genOffer(cur, forceKey) {
    const s = State.get();
    const us = cur === 'usd', ae = cur === 'aed';
    const busy = new Set([...SH().offers.map(o => o.plate), ...active().map(l => l.plate)]);
    const free = p => {
      if (!p || s.found[p] || busy.has(p)) return false;
      const k = P.uniqKey(p);
      return !k || !State.isTaken(k);
    };
    const mode = () => ae ? 'ae' : us ? 'us' : (Math.random() < B.MIL_SHARE ? 'mil' : 'civ');
    const tryMake = make => { for (let i = 0; i < 40; i++) { const p = make(); if (free(p)) return p; } return null; };
    const makers = {
      secret: () => P.craft('secret', Math.random, null, mode()),
      // именные легенды — только те, что по сочетаниям действительно мифики
      mythic: () => {
        const named = C.MYTHICS.filter(m => P.classify(m.plate) === 'mythic');
        if (!us && !ae && named.length && Math.random() < 0.4) return pick(named).plate;
        const p = P.craft('mythic', Math.random, null, mode());
        return P.classify(p) === 'mythic' ? p : null;
      },
      legendary: () => P.craft('legendary', Math.random, null, mode()),
      epic: () => P.craft('epic', Math.random, null, mode()),
      wanted: () => { const w = wantedMakers(cur); return w.length ? pick(w)() : null; },
      filler: () => P.craft(rollW(B.FILLER), Math.random, null, mode()),
    };
    const chain = ['secret', 'mythic', 'legendary', 'epic', 'wanted', 'filler'];
    let key = forceKey || (() => { let x = Math.random(); for (const k of chain.slice(0, 5)) { if (x < B.ROLL[k]) return k; x -= B.ROLL[k]; } return 'filler'; })();
    let plate = null;
    for (let i = chain.indexOf(key); i < chain.length && !plate; i++) plate = tryMake(makers[chain[i]]);
    if (!plate) return null;
    if (curOf(plate) !== cur) return null;
    const r = P.classify(plate);
    const e = est(plate);
    const unique = !!P.uniqKey(plate);
    let kind, k;
    if (unique) { kind = 'unique'; k = rnd(...B.UNIQUE_K[r] || B.UNIQUE_K.legendary); }
    else { kind = rollW(B.KIND); k = rnd(...B.PRICE[kind]); }
    // никогда не дешевле мгновенной продажи + 1 — иначе купил и сразу продал в плюс (округление могло опустить)
    const sv = State.sellValue(plate) + 1;
    const price = Math.max(sv, niceRound(Math.max(e * B.FLOOR, e * k), cur));
    const type = unique ? (Math.random() < 0.6 ? 'stubborn' : 'dealer')
      : rollW(kind === 'over' ? { dealer: 0.6, stubborn: 0.2, soft: 0.2 } : { soft: 0.45, stubborn: 0.35, dealer: 0.2 });
    const sel = B.SELLERS[type];
    const min = Math.min(price, Math.max(sv, niceRound(Math.max(e * B.FLOOR, price * rnd(...sel.min)), cur)));
    const now = Date.now();
    const life = kind === 'deal' ? rnd(...B.DEAL_LIFE_MS) : rnd(...B.LIFE_MS);
    if (unique) State.markTaken(plate); // единственный экземпляр: теперь он «у продавца»
    return { id: ++S().seq, plate, r, cur, est: e, price, min, kind, patience: sel.patience,
      seller: { name: pick(NAMES[cur]), ava: pick(AVA), type }, t: now, until: now + life };
  }

  let news = []; // заметные новые объявления (легендарка+) — для уведомления
  function shopTick(now, events) {
    const sh = SH(), s = State.get();
    let changed = false;
    for (const o of sh.offers.filter(x => x.until <= now)) { closeOffer(o, 'expired', events); changed = true; }
    for (const cur of ['rub', 'usd', 'aed']) {
      if (cur === 'usd' && !s.us.visa) continue;
      if (cur === 'aed' && !(s.ae && s.ae.visa)) continue;
      const [lo, hi] = B.FEED[cur];
      let n = sh.offers.filter(o => o.cur === cur).length;
      const filling = n < lo;
      while (n < lo || (n < hi && now >= (sh.next[cur] || 0))) {
        const o = genOffer(cur);
        sh.next[cur] = now + rnd(...B.SPAWN_MS);
        if (!o) break;
        if (filling) o.until = now + (o.until - now) * rnd(0.3, 1); // стартовая лента — разного «возраста»
        sh.offers.push(o);
        if (P.tierOf(o.plate) >= C.TIER.legendary) news.push(o);
        n++; changed = true;
        if (!filling) break;
      }
    }
    return changed;
  }
  function takeNews() { const n = news; news = []; return n; }

  // объявление закрыто: истекло или куплено — чаты по нему закрываются
  function closeOffer(o, why, events) {
    const sh = SH();
    sh.offers = sh.offers.filter(x => x !== o);
    // уникальный номер никто не купил — он снова может выпасть в крутке
    if (why === 'expired') { const k = P.uniqKey(o.plate); if (k && !State.get().found[o.plate]) State.untake(k); }
    for (const c of S().chats) {
      if (c.kind !== 'buy' || c.oid !== o.id || (c.status !== 'open' && c.status !== 'firm')) continue;
      c.status = 'gone'; c.reply = null;
      if (why === 'expired') { addMsg(c, 'buyer', pick(ST[c.cur].sold)); if (events) events.push(c); }
    }
  }

  function offers(cur) { return SH().offers.filter(o => !cur || o.cur === cur); }
  function chatFor(oid) { return S().chats.find(c => c.kind === 'buy' && c.oid === oid && (c.status === 'open' || c.status === 'firm')); }

  // начать торг с продавцом (или вернуться в открытый чат)
  function haggle(oid) {
    const o = SH().offers.find(x => x.id === oid);
    if (!o || o.kind === 'deal') return null;
    const old = chatFor(oid);
    if (old) return old;
    const now = Date.now();
    const c = { id: ++S().seq, kind: 'buy', oid, plate: o.plate, cur: o.cur,
      buyer: { name: o.seller.name, type: o.seller.type, ava: o.seller.ava },
      offer: o.price, min: o.min, patience: o.patience, status: 'open', unread: false,
      msgs: [{ from: 'buyer', text: pick(ST[o.cur].hi), t: now, offer: o.price }], replyAt: 0, reply: null, t: now, lastBuyer: now };
    S().chats.push(c);
    State.markDirty();
    return c;
  }
  // продавец отвечает на нашу цену
  function deliverSellerReply(c) {
    const L = ST[c.cur], v = c.reply.counter;
    const o = { c: money(v, c.cur) };
    if (v >= c.min) {
      c.offer = v;
      addMsg(c, 'buyer', fill(pick(L.agree), o), { offer: v });
    } else {
      c.patience -= v < c.offer * 0.5 ? 2 : 1; // наглый торг злит быстрее
      if (c.patience <= 0) {
        c.status = 'firm';
        addMsg(c, 'buyer', fill(pick(v < c.offer * 0.5 ? L.insult : L.firm), { p: money(c.offer, c.cur) }));
      } else {
        c.offer = Math.max(c.min, Math.min(c.offer, niceRound((c.offer + v) / 2, c.cur)));
        addMsg(c, 'buyer', fill(pick(L.meet), { c: o.c, o: money(c.offer, c.cur) }), { offer: c.offer });
      }
    }
    c.reply = null;
    c.replyAt = 0;
  }

  // купить: по цене объявления или по выторгованной в чате
  function buy(oid, cid) {
    const s = State.get();
    const o = SH().offers.find(x => x.id === oid);
    if (!o) return { err: 'gone' };
    const c = cid ? S().chats.find(x => x.id === cid && x.oid === oid && (x.status === 'open' || x.status === 'firm')) : null;
    if (c && c.reply) return { err: 'wait' };
    const price = c ? c.offer : o.price;
    if (s.found[o.plate]) return { err: 'have' };
    if (!State.canKeep(o.plate)) return { err: 'full' };
    if (State.balance(o.cur) < price) return { err: 'money' };
    State.debit(o.cur, price);
    const events = State.keepPlate(o.plate, o.r);
    const tier = C.TIER[o.r];
    s.found[o.plate].how = 'market';
    s.stats.bought = (s.stats.bought || 0) + 1;
    if (o.kind === 'deal') s.claimed.flagBuyHot = true;
    if (price < o.price) s.claimed.flagHaggle = true;
    if (tier >= C.TIER.mythic) s.claimed.flagBuyMyth = true;
    if (tier >= C.TIER.legendary) {
      s.legends.unshift({ p: o.plate, r: o.r, n: s.spins, t: Date.now(), how: 'market' });
      if (s.legends.length > 100) s.legends.length = 100;
    }
    if (!s.best || tier > s.best.tier) s.best = { plate: o.plate, tier };
    closeOffer(o, 'bought');
    if (c) { c.status = 'deal'; addMsg(c, 'sys', `✅ Куплено за ${money(price, o.cur)}`); c.unread = false; }
    events.push(...State.checkNow());
    State.markDirty();
    return { ok: true, price, plate: o.plate, r: o.r, cur: o.cur, events };
  }

  // меню разработчика: объявление нужной редкости прямо сейчас
  function devOffer(key, cur = 'rub') {
    const o = genOffer(cur, key);
    if (o) { SH().offers.unshift(o); State.markDirty(); }
    return o;
  }

  return { est, slots, active, list, withdraw, bump, bumpCost, tick, accept, decline, counter, markRead,
    unreadCount, ratingLevel, deals, delayFor, genBuyer, curOf, interesting, devBuyerNow, money,
    offers, haggle, buy, chatFor, wantedLabel, takeNews, devOffer, genOffer,
    chats: () => S().chats, listings: () => S().listings };
})();

if (typeof module !== 'undefined') module.exports = Market;
