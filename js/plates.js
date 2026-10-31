// Ядро номеров: честная генерация, сочетания, цена из множителей, редкость из цены.
// Чистые функции, без DOM — гоняются и в node-тестах.
// Номер хранится строкой: 'А123ВС77' (буква, 3 цифры, 2 буквы, регион 2-3 цифры).
(function () {
  const C = (typeof CFG !== 'undefined') ? CFG : require('./config.js');
  const L = C.LETTERS;

  // --- разбор: гражданский «А123ВС77» или военный «1234АВ77» (начинается с цифры) ---
  // '····АА10' — заглушка военной таблички до первой крутки
  function isMil(p) { const c = p[0]; return (c >= '0' && c <= '9') || p.startsWith('····'); }
  // американский номер: 'US:CA:7ABC123' (штат и текст таблички как есть, с дефисом/пробелом)
  function isUS(p) { return p.startsWith('US:'); }
  // номер Эмиратов: 'AE:DXB:AA:12345' — эмират, буквенный код, 1–5 цифр
  function isAE(p) { return p.startsWith('AE:'); }
  // божественный номер: 'DV:ru' | 'DV:mil' | 'DV:us' | 'DV:ae'
  function isDivine(p) { return p.startsWith('DV:'); }
  function divineOf(p) { return isDivine(p) ? C.DIVINE_PLATES.find(d => d.key === p.slice(3)) || null : null; }
  function aePlate(em, code, num) { return 'AE:' + em + ':' + code + ':' + num; }
  const VANITY = new Set([...C.US_VANITY.common, ...C.US_VANITY.top]);
  function parse(p) {
    if (isDivine(p)) return { dv: true, key: p.slice(3), reg: 'DV' };
    if (isAE(p)) {
      const [, em, code, num] = p.split(':');
      return { ae: true, em, reg: em, code, num, len: num.length, dg: num, t: code + num };
    }
    if (isUS(p)) {
      const i = p.indexOf(':', 3);
      const st = p.slice(3, i), raw = p.slice(i + 1);
      const t = raw.replace(/[- ]/g, '');
      return { us: true, st, reg: st, raw, t, dg: t.replace(/[^0-9]/g, ''), lt: t.replace(/[^A-Z]/g, ''),
        van: VANITY.has(t) };
    }
    if (isMil(p)) return { mil: true, d: p.slice(0, 4), ls: p.slice(4, 6), reg: p.slice(6) };
    return { mil: false, l1: p[0], d: p.slice(1, 4), l2: p.slice(4, 6), reg: p.slice(6), ls: p[0] + p[4] + p[5] };
  }
  function letters(p) { return isDivine(p) ? '' : isAE(p) ? parse(p).code : isUS(p) ? parse(p).lt : isMil(p) ? p.slice(4, 6) : p[0] + p[4] + p[5]; }
  function codeOf(p) { return isDivine(p) ? 'DV' : isAE(p) ? parse(p).em : isUS(p) ? parse(p).st : p.slice(6); } // регион, код войск, штат или эмират
  function isVanity(p) { return isUS(p) && parse(p).van; }

  // секретный номер — только точное совпадение (reg '*' — любой регион / код войск)
  function secretOf(p) {
    if (isDivine(p)) return null;
    if (isAE(p)) {
      const { em, code, num } = parse(p);
      return C.AE_SECRETS.find(s => s.code === code && s.num === num && (s.em === '*' || s.em === em)) || null;
    }
    if (isUS(p)) {
      const { st, t } = parse(p);
      return C.US_SECRETS.find(s => s.t === t && (s.st === '*' || s.st === st)) || null;
    }
    const body = p.slice(0, 6), reg = p.slice(6);
    for (const s of (isMil(p) ? C.MIL_SECRETS : C.SECRET_PLATES)) {
      if (s.plate === body && (s.reg === '*' || s.reg === reg)) return s;
    }
    return null;
  }
  function blatOf(p) {
    if (isMil(p) || isUS(p) || isAE(p) || isDivine(p)) return null;
    const ls = letters(p);
    return C.BLAT_SERIES.find(b => b.ls === ls) || null;
  }
  function milDate(p) { return isMil(p) ? (C.MIL_DATES[p.slice(0, 4)] || null) : null; }
  function mythicName(p) {
    const m = C.MYTHICS.find(x => x.plate === p);
    return m ? m.name : null;
  }

  // --- сочетания: внутри группы работает только самое дорогое ---
  function combosOf(plate) {
    if (isDivine(plate)) return [];
    const p = parse(plate);
    const best = {};
    for (const c of (p.ae ? C.AE_COMBOS : p.us ? C.US_COMBOS : p.mil ? C.MIL_COMBOS : C.COMBOS)) {
      if (c.test(p) && (!best[c.g] || c.mult > best[c.g].mult)) best[c.g] = c;
    }
    return Object.values(best).sort((a, b) => a.mult - b.mult);
  }
  function comboMult(plate) {
    return combosOf(plate).reduce((m, c) => m * c.mult, 1);
  }
  // итоговый множитель номера: секретка стоит не меньше SECRET_MULT
  // и не меньше своих сочетаний ×3
  function plateMult(plate) {
    const m = comboMult(plate);
    return secretOf(plate) ? Math.max(C.SECRET_MULT, m * 3) : m;
  }
  // базовая цена без региона и апгрейдов
  function baseOf(plate) { return isAE(plate) ? C.AE.PLATE_BASE : isUS(plate) ? C.US.PLATE_BASE : isMil(plate) ? C.MIL.PLATE_BASE : C.PLATE_BASE; }
  // надбавка за редкость (C.TIER_BONUS): легендарки, мифики и секретки дороже своих сочетаний
  function tierBonus(plate) { return C.TIER_BONUS[classify(plate)] || 1; }
  function basePrice(plate) {
    const dv = divineOf(plate);
    if (dv) return dv.price; // цена божественного фиксированная, без региона
    return Math.round(baseOf(plate) * plateMult(plate) * tierBonus(plate));
  }

  // --- редкость из множителя сочетаний (у военных — свои пороги) ---
  function classify(plate) {
    if (isDivine(plate)) return 'divine';
    if (secretOf(plate)) return 'secret';
    const m = comboMult(plate);
    const T = isAE(plate) ? C.AE.RARITY_THRESH : isUS(plate) ? C.US.RARITY_THRESH : isMil(plate) ? C.MIL.RARITY_THRESH : C.RARITY_THRESH;
    for (let i = 0; i < T.length; i++) {
      if (m < T[i]) return C.RARITIES[i].key;
    }
    return 'mythic';
  }
  function tierOf(plate) { return C.TIER[classify(plate)]; }

  // --- генерация ---
  function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
  function rLetter(rng) { return L[Math.floor(rng() * L.length)]; }
  function rDigits(rng) { return String(1 + Math.floor(rng() * 999)).padStart(3, '0'); } // 001..999

  // случайный регион: взвешенный бросок по тирам (престижные — редко)
  function rollRegion(rng) {
    let r = rng() * 100;
    for (const t of C.REG_TIERS) {
      if (r < t.weight) return pick(t.regs, rng);
      r -= t.weight;
    }
    return pick(C.REG_TIERS[0].regs, rng);
  }

  // случайный код войск: тир по весам, потом код внутри тира
  function rollMilCode(rng) {
    let r = rng() * 100;
    for (const t of C.MIL_CODE_TIERS) {
      if (r < t.weight) return pick(t.codes, rng);
      r -= t.weight;
    }
    return pick(C.MIL_CODE_TIERS[0].codes, rng);
  }

  // --- США ---
  // случайный штат: сначала тир по весам, потом штат внутри тира
  function rollState(rng) {
    let r = rng() * 100;
    for (const key in C.US_TIERS) {
      if (r < C.US_TIERS[key].weight) return pick(C.US_STATES.filter(s => s.tier === key), rng).st;
      r -= C.US_TIERS[key].weight;
    }
    return C.US_STATES[0].st;
  }
  // заполнить формат штата; dsrc/lsrc — принудительные цифры/буквы (для крафта)
  function fillFmt(fmt, rng, dsrc, lsrc) {
    let out = '', di = 0, li = 0;
    for (const ch of fmt) {
      if (ch === 'D') out += dsrc && di < dsrc.length ? dsrc[di++] : String(Math.floor(rng() * 10));
      else if (ch === 'L') out += lsrc && li < lsrc.length ? lsrc[li++] : C.US.LETTERS[Math.floor(rng() * C.US.LETTERS.length)];
      else out += ch;
    }
    return out;
  }
  function usPlate(st, text) { return 'US:' + st + ':' + text; }
  function randomUS(rng, pinnedSt) {
    const st = pinnedSt || rollState(rng);
    if (rng() < C.US.VANITY_CHANCE) {
      const top = rng() < 0.12;
      return usPlate(st, pick(top ? C.US_VANITY.top : C.US_VANITY.common, rng));
    }
    let t;
    do { t = fillFmt(C.US_STATE[st].fmt, rng); } while (/^0+$/.test(t.replace(/[^0-9]/g, ''))); // без «все нули»
    return usPlate(st, t);
  }
  // крафт американского номера нужной редкости: узоры цифр × узоры букв, именные
  function craftUS(key, rng, pinnedSt) {
    if (key === 'secret') {
      const pool = C.US_SECRETS.filter(s => !pinnedSt || s.st === '*' || s.st === pinnedSt);
      const s = pool.length ? pick(pool, rng) : pick(C.US_SECRETS, rng);
      return usPlate(s.st === '*' ? (pinnedSt || rollState(rng)) : s.st, s.t);
    }
    const dpat = [null, null, '7777', '1234', '5555', '7771', '1221', '4500', '1776', '1969', '0071', '9110'];
    const lpat = [null, null, 'AAA', 'ABC', 'USA', 'FBI', 'XYZ', 'BBQ'];
    for (let i = 0; i < 8000; i++) {
      const st = pinnedSt || rollState(rng);
      let p;
      if (rng() < 0.15) {
        p = usPlate(st, pick(rng() < 0.5 ? C.US_VANITY.top : C.US_VANITY.common, rng));
      } else {
        const fmt = C.US_STATE[st].fmt;
        let d = pick(dpat, rng);
        const nd = (fmt.match(/D/g) || []).length;
        if (d && d.length > nd) d = d.slice(0, nd);
        p = usPlate(st, fillFmt(fmt, rng, d, pick(lpat, rng)));
      }
      if (classify(p) === key) return p;
    }
    return randomUS(rng, pinnedSt);
  }

  // честный случайный номер; mode 'mil' — военный (0001–9999, 2 буквы, код войск), 'us' — США
  // --- Эмираты ---
  function rollEm(rng) {
    let r = rng() * 100;
    for (const key in C.AE_TIERS) {
      if (r < C.AE_TIERS[key].weight) return pick(C.AE_EMIRATES.filter(e => e.tier === key), rng).em;
      r -= C.AE_TIERS[key].weight;
    }
    return C.AE_EMIRATES[0].em;
  }
  function aeCode(rng) {
    const l = () => C.AE.LETTERS[Math.floor(rng() * C.AE.LETTERS.length)];
    return rng() < C.AE.DOUBLE_CODE ? l() + l() : l();
  }
  function aeNum(rng, len) {
    if (!len) {
      let r = rng();
      for (const [n, w] of C.AE.LEN_W) { if (r < w) { len = n; break; } r -= w; }
      len = len || 5;
    }
    let s = String(1 + Math.floor(rng() * 9));
    while (s.length < len) s += String(Math.floor(rng() * 10));
    return s;
  }
  function randomAE(rng, pinnedEm) { return aePlate(pinnedEm || rollEm(rng), aeCode(rng), aeNum(rng)); }
  // крафт номера Эмиратов нужной редкости: короткие номера, повторы, лесенки + проверка классификатором
  function craftAE(key, rng, pinnedEm) {
    const em = () => pinnedEm || rollEm(rng);
    if (key === 'secret') {
      const pool = C.AE_SECRETS.filter(s => !pinnedEm || s.em === '*' || s.em === pinnedEm);
      const s = pool.length ? pick(pool, rng) : pick(C.AE_SECRETS, rng);
      return aePlate(s.em === '*' ? em() : s.em, s.code, s.num);
    }
    const pats = [
      () => aeNum(rng),
      () => aeNum(rng, 1 + Math.floor(rng() * 5)),
      () => { const d = String(1 + Math.floor(rng() * 9)); return d.repeat(1 + Math.floor(rng() * 5)); },
      () => { const a = 1 + Math.floor(rng() * 5), n = 3 + Math.floor(rng() * 3); return '0123456789'.slice(a, a + n); },
      () => '786' + (rng() < 0.5 ? '' : String(Math.floor(rng() * 10))),
      () => String(1 + Math.floor(rng() * 9)) + '000',
    ];
    for (let i = 0; i < 8000; i++) {
      const code = rng() < 0.3 ? (() => { const c = C.AE.LETTERS[Math.floor(rng() * 26)]; return c + c; })() : aeCode(rng);
      const p = aePlate(em(), code, pick(pats, rng)());
      if (classify(p) === key) return p;
    }
    return randomAE(rng, pinnedEm);
  }

  function randomPlate(rng, pinnedReg, mode) {
    if (mode === 'ae') return randomAE(rng, pinnedReg);
    if (mode === 'us') return randomUS(rng, pinnedReg);
    if (mode === 'mil') {
      return String(1 + Math.floor(rng() * 9999)).padStart(4, '0') + rLetter(rng) + rLetter(rng) + (pinnedReg || rollMilCode(rng));
    }
    return rLetter(rng) + rDigits(rng) + rLetter(rng) + rLetter(rng) + (pinnedReg || rollRegion(rng));
  }

  // крафт военного номера нужной редкости: шаблоны + проверка классификатором
  function craftMil(key, rng, pinned) {
    const code = () => pinned || rollMilCode(rng);
    const L2 = () => rLetter(rng) + rLetter(rng);
    const x = () => String(Math.floor(rng() * 10));
    const tpl = [
      () => String(1 + Math.floor(rng() * 9999)).padStart(4, '0'),              // случайные
      () => { const a = x(), b = x(); return a + a + b + b; },                  // две пары
      () => { const a = x(); return a + a + a + x(); },                          // тройка
      () => { const s = 1 + Math.floor(rng() * 6); return '' + s + (s + 1) + (s + 2) + (s + 3); }, // подряд
      () => { const a = String(1 + Math.floor(rng() * 9)); return a + a + a + a; }, // четыре
      () => pick(Object.keys(C.MIL_DATES), rng),                                 // дата
      () => '000' + String(1 + Math.floor(rng() * 9)),                           // однозначный
      () => '7777',
    ];
    for (let i = 0; i < 5000; i++) {
      const lt = rng() < 0.5 ? (() => { const l = rLetter(rng); return l + l; })() : L2();
      const p = pick(tpl, rng)() + lt + code();
      if (p.slice(0, 4) !== '0000' && classify(p) === key) return p;
    }
    return randomPlate(rng, pinned, 'mil');
  }

  // Секретки, доступные при текущем регионе / коде войск (null — все)
  function secretPool(pinnedReg, mode) {
    return (mode === 'mil' ? C.MIL_SECRETS : C.SECRET_PLATES).filter(s => !pinnedReg || s.reg === '*' || s.reg === pinnedReg);
  }
  function makeSecret(s, rng, pinnedReg, mode) {
    const reg = s.reg !== '*' ? s.reg : (pinnedReg || (mode === 'mil' ? rollMilCode(rng) : rollRegion(rng)));
    return s.plate + reg;
  }
  // ключ секретки в «занятых»: одна «Нулевая» на всю игру, на любом регионе
  function secretKeyOf(s, mode) { return 'S:' + (mode === 'us' ? 'us:' : mode === 'mil' ? 'mil:' : mode === 'ae' ? 'ae:' : '') + s.key; }

  // Крафт номера нужной редкости — для pity, фолбэков гаранта и тест-хуков.
  // Строит по шаблону и проверяет классификатором.
  function craft(key, rng, pinnedReg, mode) {
    if (mode === 'ae') return craftAE(key, rng, pinnedReg);
    if (mode === 'us') return craftUS(key, rng, pinnedReg);
    if (mode === 'mil' && key === 'secret') {
      const el = secretPool(pinnedReg, 'mil');
      return makeSecret(el.length ? pick(el, rng) : pick(C.MIL_SECRETS, rng), rng, pinnedReg, 'mil');
    }
    if (mode === 'mil') return craftMil(key, rng, pinnedReg);
    const reg = () => pinnedReg || rollRegion(rng);
    if (key === 'secret') {
      const el = secretPool(pinnedReg);
      return makeSecret(el.length ? pick(el, rng) : pick(C.SECRET_PLATES, rng), rng, pinnedReg);
    }
    for (let i = 0; i < 2000; i++) {
      let p;
      const a = rLetter(rng);
      const x = String(1 + Math.floor(rng() * 9));
      if (key === 'mythic') p = a + x + x + x + a + a + reg();                       // ААА + 555
      else if (key === 'legendary') {                                               // ААА + подряд
        const s0 = 1 + Math.floor(rng() * 7);
        p = a + s0 + (s0 + 1) + (s0 + 2) + a + a + reg();
      } else if (key === 'epic') p = a + x + '0' + x + a + a + reg();               // ААА + зеркало
      else if (key === 'rare') { const w = pick(C.WORDS, rng); p = w[0] + rDigits(rng) + w[1] + w[2] + reg(); } // слово
      else if (key === 'uncommon') {                                                // пара цифр + пара букв
        const y = String(Math.floor(rng() * 10));
        p = a + x + y + y + a + rLetter(rng) + reg();
      } else p = randomPlate(rng, pinnedReg);                                       // common
      if (classify(p) === key) return p;
    }
    return randomPlate(rng, pinnedReg); // крайний случай
  }

  // --- уникальность: мифик и секретка существуют в одном экземпляре ---
  // ключ — сам номер; у секреток — их имя (одна «Нулевая» на всю игру, на любом регионе)
  function uniqKey(plate) {
    if (isDivine(plate)) return 'D:' + plate.slice(3);
    if (tierOf(plate) < C.TIER.mythic) return null;
    const sec = secretOf(plate);
    if (sec) return secretKeyOf(sec, isAE(plate) ? 'ae' : isUS(plate) ? 'us' : isMil(plate) ? 'mil' : 'civ');
    return plate;
  }

  // --- полная крутка ---
  // opts = { pity, tries, minTier, pinnedReg, force, mode, isTaken }
  //  isTaken(key) — уже существующие уникальные номера: такие больше не выпадают
  //  tries   — заряженная крутка: бросаем N номеров, берём самый дорогой
  //  minTier — VIP-гарант: редкость не ниже (реролл до порога)
  //  pinnedReg — выбранный регион / код войск / штат (все выпадения в нём)
  //  force   — тест-хук: точная редкость ('divine' — божественный номер страны, если ещё свободен)
  //  mode    — 'civ' (гражданские), 'mil' (военные), 'us' или 'ae'
  // Божественный номер страны ловится отдельным броском с шансом C.DIVINE_CHANCE (раньше секретки)
  function rollSpin(rng, opts) {
    const { pity = null, tries = 1, pinnedReg: pin = null, force = null, mode = 'civ' } = opts;
    const pinnedReg = pin;
    const minTier = Math.min(opts.minTier || 0, C.TIER.secret);
    let plate, trig = null;
    const us = mode === 'us', ae = mode === 'ae';
    const isTaken = opts.isTaken || (() => false);
    const free = p => { const k = uniqKey(p); return !k || !isTaken(k); };
    const sKey = s => secretKeyOf(s, mode);
    const sPool = (ae ? C.AE_SECRETS.filter(s => !pinnedReg || s.em === '*' || s.em === pinnedReg)
      : us ? C.US_SECRETS.filter(s => !pinnedReg || s.st === '*' || s.st === pinnedReg)
      : secretPool(pinnedReg, mode)).filter(s => !isTaken(sKey(s))); // пойманные секретки больше не выпадают
    const sChance = ae ? C.AE.SECRET_CHANCE : us ? C.US.SECRET_CHANCE : C.SECRET_CHANCE;
    // божественный этой страны: ещё никем не пойман и подходит под выбранный регион/штат/эмират
    const dPool = C.DIVINE_PLATES.filter(d => d.mode === mode && (!pinnedReg || !d.pin || d.pin === pinnedReg) && !isTaken('D:' + d.key));
    // готовая табличка секретки для текущей страны
    const secretPlate = s => ae ? aePlate(s.em === '*' ? (pinnedReg || rollEm(rng)) : s.em, s.code, s.num)
      : us ? usPlate(s.st === '*' ? (pinnedReg || rollState(rng)) : s.st, s.t) : makeSecret(s, rng, pinnedReg, mode);
    // свободный (не существующий ещё) случайный номер
    function freeRandom() {
      let p = randomPlate(rng, pinnedReg, mode), guard = 0;
      while (!free(p) && guard++ < 200) p = randomPlate(rng, pinnedReg, mode);
      return p;
    }
    // один честный бросок: сначала шанс секретки, иначе случайный номер
    function rollOne() {
      if (dPool.length && rng() < C.DIVINE_CHANCE) return 'DV:' + dPool[0].key;
      if (sPool.length && rng() < sChance) {
        return secretPlate(pick(sPool, rng));
      }
      return freeRandom();
    }
    // крафт свободного номера; если такой редкости свободных нет — на ступень ниже
    const craftK = key => {
      for (let t = C.TIER[key]; t >= 0; t--) {
        for (let i = 0; i < 300; i++) {
          const p = craft(C.RARITIES[t].key, rng, pinnedReg, mode);
          if (free(p)) return p;
        }
      }
      return freeRandom();
    };
    if (force === 'divine') { // тест-хук: божественный этой страны, а если уже пойман — секретка или мифик
      plate = dPool.length ? 'DV:' + dPool[0].key
        : sPool.length ? secretPlate(sPool[Math.floor(rng() * sPool.length)]) : craftK('mythic');
    } else if (force) {
      plate = craftK(force);
    } else {
      // гарант: бросок не ниже порога. Секретку при перебросах не ловим — иначе тысячи
      // перебросов легендарного гаранта складываются в заметный шанс секретки
      function floored() {
        let p = rollOne();
        if (minTier > 0 && tierOf(p) < minTier) {
          let guard = 0;
          while ((tierOf(p) < minTier || !free(p)) && guard++ < 200000) p = randomPlate(rng, pinnedReg, mode);
          if (tierOf(p) < minTier) p = craftK(C.RARITIES[minTier].key);
        }
        return p;
      }
      // заряд: N бросков (каждый с гарантом, если он куплен), берём самый дорогой
      let bestM = -1;
      plate = null;
      for (let i = 0; i < Math.max(1, tries); i++) {
        const c = floored();
        const m = plateMult(c);
        if (m > bestM) { bestM = m; plate = c; }
      }
      // pity легендарки (двигается всегда, срабатывает на обычных крутках)
      if (pity) {
        const LEGT = C.TIER.legendary;
        if (tierOf(plate) < LEGT) {
          if (pity.leg >= C.PITY.LEG_HARD - 1) { plate = craftK('legendary'); trig = 'leg-hard'; }
          else if (pity.leg >= C.PITY.LEG_SOFT &&
                   rng() < (pity.leg - C.PITY.LEG_SOFT) * C.PITY.LEG_STEP) {
            plate = craftK('legendary');
            trig = 'leg-soft';
          }
        }
        if (tierOf(plate) >= LEGT) pity.leg = 0; else pity.leg += 1;
      }
    }
    const rarity = classify(plate);
    return { plate, rarity, tier: C.TIER[rarity], trig };
  }

  // Случайный «мусорный» номер для мелькания в анимации
  function randomVisual(rng, pinnedReg, mode) { return randomPlate(rng, pinnedReg, mode); }

  const API = { parse, letters, codeOf, isMil, isUS, isVanity, classify, tierOf, combosOf, comboMult, plateMult,
    basePrice, rollSpin, rollRegion, rollMilCode, rollState, randomPlate, craft, randomVisual, secretOf, blatOf, mythicName, milDate,
    uniqKey, secretKeyOf, tierBonus, isAE, aePlate, rollEm, isDivine, divineOf };
  if (typeof module !== 'undefined') module.exports = API;
  else window.Plates = API;
})();
