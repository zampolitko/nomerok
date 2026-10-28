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
  const VANITY = new Set([...C.US_VANITY.common, ...C.US_VANITY.top]);
  function parse(p) {
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
  function letters(p) { return isUS(p) ? parse(p).lt : isMil(p) ? p.slice(4, 6) : p[0] + p[4] + p[5]; }
  function codeOf(p) { return isUS(p) ? parse(p).st : p.slice(6); } // регион, код войск или штат
  function isVanity(p) { return isUS(p) && parse(p).van; }

  // секретный номер — только точное совпадение (reg '*' — любой регион); у военных секреток нет
  function secretOf(p) {
    if (isUS(p)) {
      const { st, t } = parse(p);
      return C.US_SECRETS.find(s => s.t === t && (s.st === '*' || s.st === st)) || null;
    }
    if (isMil(p)) return null;
    const body = p.slice(0, 6), reg = p.slice(6);
    for (const s of C.SECRET_PLATES) {
      if (s.plate === body && (s.reg === '*' || s.reg === reg)) return s;
    }
    return null;
  }
  function blatOf(p) {
    if (isMil(p) || isUS(p)) return null;
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
    const p = parse(plate);
    const best = {};
    for (const c of (p.us ? C.US_COMBOS : p.mil ? C.MIL_COMBOS : C.COMBOS)) {
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
  function baseOf(plate) { return isUS(plate) ? C.US.PLATE_BASE : isMil(plate) ? C.MIL.PLATE_BASE : C.PLATE_BASE; }
  function basePrice(plate) { return Math.round(baseOf(plate) * plateMult(plate)); }

  // --- редкость из множителя сочетаний (у военных — свои пороги) ---
  function classify(plate) {
    if (secretOf(plate)) return 'secret';
    const m = comboMult(plate);
    const T = isUS(plate) ? C.US.RARITY_THRESH : isMil(plate) ? C.MIL.RARITY_THRESH : C.RARITY_THRESH;
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
  function randomPlate(rng, pinnedReg, mode) {
    if (mode === 'us') return randomUS(rng, pinnedReg);
    if (mode === 'mil') {
      return String(1 + Math.floor(rng() * 9999)).padStart(4, '0') + rLetter(rng) + rLetter(rng) + pick(C.MIL.CODES, rng);
    }
    return rLetter(rng) + rDigits(rng) + rLetter(rng) + rLetter(rng) + (pinnedReg || rollRegion(rng));
  }

  // крафт военного номера нужной редкости: шаблоны + проверка классификатором
  function craftMil(key, rng) {
    const code = () => pick(C.MIL.CODES, rng);
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
    return randomPlate(rng, null, 'mil');
  }

  // Секретки, доступные при текущем регионе (null — все)
  function secretPool(pinnedReg) {
    return C.SECRET_PLATES.filter(s => !pinnedReg || s.reg === '*' || s.reg === pinnedReg);
  }
  function makeSecret(s, rng, pinnedReg) {
    const reg = s.reg !== '*' ? s.reg : (pinnedReg || rollRegion(rng));
    return s.plate + reg;
  }

  // Крафт номера нужной редкости — для pity, фолбэков гаранта и тест-хуков.
  // Строит по шаблону и проверяет классификатором.
  function craft(key, rng, pinnedReg, mode) {
    if (mode === 'us') return craftUS(key, rng, pinnedReg);
    if (mode === 'mil') return craftMil(key === 'secret' ? 'mythic' : key, rng); // у военных секреток нет
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

  // --- уникальность: легендарка и выше существует в одном экземпляре ---
  // ключ — сам номер; у секреток — их имя (одна «Нулевая» на всю игру, на любом регионе)
  function uniqKey(plate) {
    if (tierOf(plate) < C.TIER.legendary) return null;
    const sec = secretOf(plate);
    if (sec) return 'S:' + (isUS(plate) ? 'us:' : '') + sec.key;
    return plate;
  }

  // --- полная крутка ---
  // opts = { pity, tries, minTier, pinnedReg, force, mode, isTaken }
  //  isTaken(key) — уже существующие уникальные номера: такие больше не выпадают
  //  tries   — заряженная крутка: бросаем N номеров, берём самый дорогой
  //  minTier — VIP-гарант: редкость не ниже (реролл до порога)
  //  pinnedReg — выбранный регион (все выпадения в нём; у военных не действует)
  //  force   — тест-хук: точная редкость
  //  mode    — 'civ' (гражданские) или 'mil' (военные)
  function rollSpin(rng, opts) {
    const { pity = null, tries = 1, pinnedReg: pin = null, force = null, mode = 'civ' } = opts;
    const mil = mode === 'mil';
    const pinnedReg = mil ? null : pin;
    // у военных нет секреток — гарант «секрет» не бывает, потолок мифик
    const minTier = Math.min(opts.minTier || 0, mil ? C.TIER.mythic : 99);
    let plate, trig = null;
    const us = mode === 'us';
    const isTaken = opts.isTaken || (() => false);
    const free = p => { const k = uniqKey(p); return !k || !isTaken(k); };
    const sKey = s => 'S:' + (us ? 'us:' : '') + s.key;
    const sPool = (mil ? [] : us ? C.US_SECRETS.filter(s => !pinnedReg || s.st === '*' || s.st === pinnedReg)
      : secretPool(pinnedReg)).filter(s => !isTaken(sKey(s))); // пойманные секретки больше не выпадают
    const sChance = us ? C.US.SECRET_CHANCE : C.SECRET_CHANCE;
    // свободный (не существующий ещё) случайный номер
    function freeRandom() {
      let p = randomPlate(rng, pinnedReg, mode), guard = 0;
      while (!free(p) && guard++ < 200) p = randomPlate(rng, pinnedReg, mode);
      return p;
    }
    // один честный бросок: сначала шанс секретки, иначе случайный номер
    function rollOne() {
      if (sPool.length && rng() < sChance) {
        const s = pick(sPool, rng);
        return us ? usPlate(s.st === '*' ? (pinnedReg || rollState(rng)) : s.st, s.t)
          : makeSecret(s, rng, pinnedReg);
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
    if (force) {
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
  function randomVisual(rng, pinnedReg, mode) { return randomPlate(rng, mode === 'mil' ? null : pinnedReg, mode); }

  const API = { parse, letters, codeOf, isMil, isUS, isVanity, classify, tierOf, combosOf, comboMult, plateMult,
    basePrice, rollSpin, rollRegion, rollState, randomPlate, craft, randomVisual, secretOf, blatOf, mythicName, milDate,
    uniqKey };
  if (typeof module !== 'undefined') module.exports = API;
  else window.Plates = API;
})();
