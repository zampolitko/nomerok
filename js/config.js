// Единый конфиг игры: редкости, шансы, регионы, секретки, магазин, pity, заряды, рынок.
// Всё, что балансится — здесь. Работает и в браузере, и в node (для тестов).
const CFG = {};

// Разрешённые буквы на российских номерах
CFG.LETTERS = 'АВЕКМНОРСТУХ';

// Редкости по возрастанию. chance — справочное «примерно 1 к N» для интерфейса;
// фактическая редкость ВЫЧИСЛЯЕТСЯ из множителя сочетаний номера (см. RARITY_THRESH).
CFG.RARITIES = [
  { key: 'common',    name: 'Обычный',     color: '#9aa4b2', chance: null },
  { key: 'uncommon',  name: 'Необычный',   color: '#4ade80', chance: 6 },
  { key: 'rare',      name: 'Редкий',      color: '#38bdf8', chance: 19 },
  { key: 'epic',      name: 'Эпический',   color: '#a78bfa', chance: 60 },
  { key: 'legendary', name: 'Легендарный', color: '#fbbf24', chance: 3000 },
  { key: 'mythic',    name: 'Мифический',  color: '#fb7185', chance: 100000 },
  { key: 'secret',    name: 'Секретный',   color: '#e879f9', chance: 300000 },
];
CFG.TIER = {}; // key -> индекс
CFG.RARITIES.forEach((r, i) => { CFG.TIER[r.key] = i; });

// Цена номера = PLATE_BASE × произведение множителей сочетаний × регион × «Множитель ₽»
CFG.PLATE_BASE = 12;
// Верхние границы множителя сочетаний для тиров 0..4; выше последней — мифик
CFG.RARITY_THRESH = [4, 30, 150, 4000, 36000]; // мифик ≥36000 — вдвое реже прежнего
CFG.SECRET_MULT = 100000; // фиксированный множитель секретных номеров

// Тиры регионов. На каждой крутке регион случаен (weight — шанс тира в %),
// либо выбран игроком (costMult умножает цену крутки и гаранта).
// Номер крутого региона и продаётся дороже (sellMult).
CFG.REG_TIERS = [
  { key: 't0', name: 'Обычные', sellMult: 1, costMult: 2, weight: 85,
    regs: ['02','06','07','09','12','15','22','26','30','32','33','35','36','40','43','45',
      '47','48','53','56','58','60','64','68','70','71','73','76','86','89','102','124',
      '136','138','142','150','152','159','163','164','173','186','190','196'] },
  { key: 't1', name: 'Города', sellMult: 1.5, costMult: 3, weight: 10,
    regs: ['78','23','66','16','52','63','54','24','61','74','55','34'] },
  { key: 't2', name: 'Престиж', sellMult: 2, costMult: 5, weight: 4,
    regs: ['77','97','99','177','197','199','05','95'] },
  { key: 't3', name: 'Элита', sellMult: 3, costMult: 8, weight: 1,
    regs: ['777','799'] },
];
CFG.REG_TIER = {}; // регион -> тир
CFG.REG_TIERS.forEach(t => t.regs.forEach(r => { CFG.REG_TIER[r] = t; }));
CFG.ALL_REGS = CFG.REG_TIERS.flatMap(t => t.regs);

// Что за регион — подписи в меню выбора
CFG.REG_NAMES = {
  '777': 'Москва — три топора', '799': 'Москва — новая элита',
  '77': 'Москва', '97': 'Москва', '99': 'Москва',
  '177': 'Москва', '197': 'Москва', '199': 'Москва',
  '05': 'Дагестан, Махачкала', '95': 'Чечня, Грозный',
  '78': 'Санкт-Петербург', '23': 'Краснодарский край', '66': 'Екатеринбург',
  '16': 'Татарстан, Казань', '52': 'Нижний Новгород', '63': 'Самара',
  '54': 'Новосибирск', '24': 'Красноярский край', '61': 'Ростов-на-Дону',
  '74': 'Челябинск', '55': 'Омск', '34': 'Волгоград',
  '02': 'Башкортостан, Уфа', '06': 'Ингушетия', '07': 'Кабардино-Балкария',
  '09': 'Карачаево-Черкесия', '12': 'Марий Эл', '15': 'Северная Осетия',
  '22': 'Алтайский край, Барнаул', '26': 'Ставропольский край', '30': 'Астраханская область',
  '32': 'Брянская область', '33': 'Владимирская область', '35': 'Вологодская область',
  '36': 'Воронежская область', '40': 'Калужская область', '43': 'Кировская область',
  '45': 'Курганская область', '47': 'Ленинградская область', '48': 'Липецкая область',
  '53': 'Новгородская область', '56': 'Оренбургская область', '58': 'Пензенская область',
  '60': 'Псковская область', '64': 'Саратовская область', '68': 'Тамбовская область',
  '70': 'Томская область', '71': 'Тульская область', '73': 'Ульяновская область',
  '76': 'Ярославская область', '86': 'ХМАО — Югра', '89': 'Ямало-Ненецкий АО',
  '102': 'Башкортостан', '124': 'Красноярский край', '136': 'Воронежская область',
  '138': 'Иркутская область', '142': 'Кемеровская область', '150': 'Московская область',
  '152': 'Нижегородская область', '159': 'Пермский край', '163': 'Самарская область',
  '164': 'Саратовская область', '173': 'Ульяновская область', '186': 'ХМАО — Югра',
  '190': 'Московская область', '196': 'Свердловская область',
};

// Словесные номера (буквы 1+5+6 складываются в слово) — своя коллекция в гараже
CFG.WORDS = ['КОТ','ТОК','ВОР','ХАМ','СОК','СОМ','МОХ','МЕХ','РАК','МАК','РОТ','ТОР','НОС','СОН','ОСА','УРА','ХОР','РОМ','КОМ','КУМ','ТУР'];

// ============ КОЛЛЕКЦИЯ СОЧЕТАНИЙ ============
// Каждое сочетание: множитель цены. Внутри одной группы (g) работает только
// самое дорогое из совпавших; сочетания разных групп ПЕРЕМНОЖАЮТСЯ.
// test(p): p = { l1, d, l2, reg, ls } (ls — три буквы строкой)
CFG.COMBOS = [
  // --- цифры: нули и повторы (группа dnum) ---
  { id: 'dpair',  g: 'dnum', name: 'Пара цифр',            desc: 'Две одинаковые цифры',            ex: '122', mult: 2,
    test: p => new Set(p.d).size === 2 },
  { id: 'zero1',  g: 'dnum', name: 'Ноль впереди',         desc: 'Номер начинается с нуля',         ex: '038', mult: 3,
    test: p => p.d[0] === '0' && p.d[1] !== '0' },
  { id: 'zeroPair', g: 'dnum', name: 'Ноль и пара',        desc: 'Ноль впереди и пара одинаковых',  ex: '055', mult: 5,
    test: p => p.d[0] === '0' && p.d[1] === p.d[2] && p.d[1] !== '0' },
  { id: 'small',  g: 'dnum', name: 'Малый номер',          desc: 'Цифры меньше десяти',             ex: '005', mult: 40,
    test: p => p.d[0] === '0' && p.d[1] === '0' },
  { id: 'agent',  g: 'dnum', name: 'Агентский',            desc: 'Как у одного известного агента',  ex: '007', mult: 60,
    test: p => p.d === '007' },
  { id: 'first',  g: 'dnum', name: 'Номер один',           desc: 'Самый первый номер страны',       ex: '001', mult: 100,
    test: p => p.d === '001' },
  { id: 'trip',   g: 'dnum', name: 'Все цифры одинаковые', desc: 'Три одинаковые цифры',            ex: '555', mult: 150,
    test: p => p.d[0] === p.d[1] && p.d[1] === p.d[2] },
  { id: 'devil',  g: 'dnum', name: 'Дьявольские',          desc: 'Число зверя',                     ex: '666', mult: 180,
    test: p => p.d === '666' },
  { id: 'axes',   g: 'dnum', name: 'Три топора',           desc: 'Легендарные три семёрки',         ex: '777', mult: 400,
    test: p => p.d === '777' },
  // --- цифры: узоры (группа dpat) ---
  { id: 'palin',  g: 'dnum', name: 'Зеркальные цифры',     desc: 'Читаются одинаково с двух сторон', ex: '121', mult: 8,
    test: p => p.d[0] === p.d[2] && p.d[0] !== p.d[1] },
  { id: 'round',  g: 'dnum', name: 'Круглые сотни',        desc: 'Ровные сотни',                    ex: '300', mult: 10,
    test: p => p.d[1] === '0' && p.d[2] === '0' && p.d[0] !== '0' },
  { id: 'mirror0', g: 'dnum', name: 'Зеркальный с нулём',  desc: 'Зеркало с нулём в середине',      ex: '505', mult: 12,
    test: p => p.d[1] === '0' && p.d[0] === p.d[2] && p.d[0] !== '0' },
  { id: 'step2',  g: 'dnum', name: 'Цифры через одну',     desc: 'Шаг в две единицы',               ex: '135', mult: 15,
    test: p => (+p.d[1] - +p.d[0] === 2 && +p.d[2] - +p.d[1] === 2) || (+p.d[0] - +p.d[1] === 2 && +p.d[1] - +p.d[2] === 2) },
  { id: 'seq',    g: 'dnum', name: 'Цифры подряд',         desc: 'По порядку вверх или вниз',       ex: '123', mult: 30,
    test: p => (+p.d[1] - +p.d[0] === 1 && +p.d[2] - +p.d[1] === 1) || (+p.d[0] - +p.d[1] === 1 && +p.d[1] - +p.d[2] === 1) },
  // --- цифры: особые числа (группа dspec) ---
  { id: 'notfound', g: 'dspec', name: 'Не найден',         desc: 'Страница не найдена',             ex: '404', mult: 20,
    test: p => p.d === '404' },
  { id: 'sci',    g: 'dspec', name: 'Число из науки',      desc: 'π и e передают привет',           ex: '314', mult: 20,
    test: p => p.d === '314' || p.d === '271' },
  { id: 'those',  g: 'dspec', name: 'Те самые цифры',      desc: 'Ну ты понял',                     ex: '228', mult: 25,
    test: p => p.d === '228' },
  { id: 'svc',    g: 'dspec', name: 'Служебный номер',     desc: 'Как у экстренных служб',          ex: '112', mult: 25,
    test: p => ['101','102','103','104','112','911'].includes(p.d) },
  // --- цифры и регион (группа dreg) ---
  { id: 'tailreg', g: 'dreg', name: 'Хвост = регион',      desc: 'Конец цифр совпадает с регионом', ex: '142 на 42', mult: 10,
    test: p => p.reg.length === 2 && p.d.slice(1) === p.reg },
  { id: 'eqreg',  g: 'dreg', name: 'Цифры = регион',       desc: 'Цифры повторяют код региона',     ex: '777 на 777', mult: 50,
    test: p => p.d === p.reg || p.d === '0' + p.reg },
  // --- буквы: повторы (группа lrep) ---
  { id: 'lpair',  g: 'lrep', name: 'Пара букв',            desc: 'Две одинаковые буквы',            ex: 'А##ВВ', mult: 2.5,
    test: p => p.ls[0] === p.ls[1] || p.ls[1] === p.ls[2] || p.ls[0] === p.ls[2] },
  { id: 'lpalin', g: 'lrep', name: 'Палиндром букв',       desc: 'Первая и последняя совпадают',    ex: 'А##ВА', mult: 3,
    test: p => p.ls[0] === p.ls[2] && p.ls[0] !== p.ls[1] },
  { id: 'ltrip',  g: 'lrep', name: '3 одинаковые буквы',   desc: 'Вся серия из одной буквы',        ex: 'ААА',  mult: 60,
    test: p => p.ls[0] === p.ls[1] && p.ls[1] === p.ls[2] },
  // --- буквы: смысл (группа lword) ---
  { id: 'alpha',  g: 'lword', name: 'Буквы по алфавиту',   desc: 'Серия идёт по порядку алфавита',  ex: 'АВЕ', mult: 25,
    test: p => {
      const i = [CFG.LETTERS.indexOf(p.ls[0]), CFG.LETTERS.indexOf(p.ls[1]), CFG.LETTERS.indexOf(p.ls[2])];
      return (i[1] - i[0] === 1 && i[2] - i[1] === 1) || (i[0] - i[1] === 1 && i[1] - i[2] === 1);
    } },
  { id: 'word',   g: 'lword', name: 'Слово на номере',     desc: 'Буквы складываются в слово',      ex: 'КОТ', mult: 35,
    test: p => CFG.WORDS.includes(p.ls) },
  { id: 'blat',   g: 'lword', name: 'Блатная серия',       desc: 'Серия, которую знает вся страна', ex: 'ЕКХ, АМР, ХАН', mult: 40,
    test: p => CFG.BLAT_SERIES.some(b => b.ls === p.ls) },
  // --- блатная серия на своём регионе (группа lhome) ---
  { id: 'home',   g: 'lhome', name: 'Родной регион',       desc: 'Блатная серия на своём регионе',  ex: 'ЕКХ на 99', mult: 3,
    test: p => CFG.BLAT_SERIES.some(b => b.ls === p.ls && b.reg === p.reg) },
  // --- серия недели (группа lweek): каждую неделю — две новые серии ---
  { id: 'week',   g: 'lweek', name: 'Серия недели', desc: 'Каждую неделю — две новые серии букв', ex: 'меняется', mult: 25,
    test: p => CFG._weeklySets().includes(p.ls) },
];
// награда за первое открытие сочетания
CFG.COMBO_REWARD = c => Math.min(50000, Math.max(200, c.mult * 100));
CFG.COMBOS_COMPLETE_REWARD = 1000000;

// Серии недели: детерминированно от номера ISO-недели
CFG._weeklySets = function () {
  if (CFG._weekCache && CFG._weekCache.key === CFG.weekKey()) return CFG._weekCache.sets;
  let seed = 0;
  for (const ch of CFG.weekKey()) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const L = CFG.LETTERS;
  const mk = () => L[Math.floor(rnd() * 12)] + L[Math.floor(rnd() * 12)] + L[Math.floor(rnd() * 12)];
  const sets = [mk(), mk()];
  CFG._weekCache = { key: CFG.weekKey(), sets };
  return sets;
};
CFG.weekKey = function () {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return d.getFullYear() + '-W' + week;
};

// Именные легенды — культовые номера (редкость из их сочетаний, легендарка+)
CFG.MYTHICS = [
  { plate: 'А777АА77', name: 'Тройной туз' },
  { plate: 'В999ВВ99', name: 'Все девятки' },
  { plate: 'О777ОО777', name: 'Три топора' },
  { plate: 'А999АА799', name: 'Девятки под мигалкой' },
  { plate: 'Х666ХХ66', name: 'Дьявольский' },
  { plate: 'С555СС55', name: 'Полтинник' },
  { plate: 'Е222ЕЕ22', name: 'Утиная стая' },
  { plate: 'О555ОО05', name: 'Кавказский туз' },
];

// Блатные серии: работают на ЛЮБОМ регионе (сочетание «Блатная серия»),
// на своём регионе — ещё и «Родной регион»
CFG.BLAT_SERIES = [
  { ls: 'АМР', reg: '97',  name: '«Кортеж»' },
  { ls: 'ЕКХ', reg: '99',  name: '«Еду Как Хочу»' },
  { ls: 'ХАН', reg: '777', name: '«Хан»' },
  { ls: 'ВОР', reg: '77',  name: '«Вор в законе»' },
  { ls: 'РУС', reg: '77',  name: '«Патриот»' },
  { ls: 'КОТ', reg: '78',  name: '«Питерский кот»' },
  { ls: 'ХАМ', reg: '05',  name: '«Хамло»' },
];

// Секретные номера: точные номера-легенды. reg '*' — любой регион.
// Цифр 000 в обычной генерации нет — «Нулевой» выпадает только секреткой.
// Отдельный бросок на каждой крутке с шансом SECRET_CHANCE.
CFG.SECRET_PLATES = [
  { key: 'zero',  plate: 'О000ОО', reg: '*',   name: 'Нулевой' },
  { key: 'pres',  plate: 'А777МР', reg: '777', name: 'Президентский' },
  { key: 'cort1', plate: 'А001МР', reg: '97',  name: 'Первый кортеж' },
  { key: 'ekx1',  plate: 'Е001КХ', reg: '99',  name: 'Еду Как Хочу №1' },
  { key: 'one',   plate: 'А001АА', reg: '77',  name: 'Номер один страны' },
  { key: 'abs',   plate: 'А777АА', reg: '777', name: 'Абсолют' },
  { key: 'xan1',  plate: 'Х001АН', reg: '777', name: 'Хан №1' },
];
CFG.SECRET_CHANCE = 1 / 300000;

// Pity-гарант (только легендарный)
CFG.PITY = {
  LEG_SOFT: 1500,     // после этого шанс легендарки+ плавно растёт
  LEG_STEP: 0.00008,  // прибавка к шансу за каждую крутку сверх LEG_SOFT
  LEG_HARD: 2600,     // жёсткий гарант
};

// Экономика
CFG.START_MONEY = 3000;         // стартовый капитал
CFG.SPIN_COST = 100;            // базовая цена крутки (умножается на costMult локации)

// VIP-гаранты: платная крутка с редкостью не ниже выбранной (+ надбавка региона).
// Матожидание ниже цены — инструмент охотника, не фарма.
CFG.VIP = [
  { key: 'rare',      cost: 4500 },
  { key: 'epic',      cost: 12000 },
  { key: 'legendary', cost: 230000 },
];

// Заряженные крутки: каждая N-я крутка бросает mult номеров и берёт самый дорогой.
// Первый подходящий в списке побеждает (500-я — это 25×, а не 5×).
// Заряд вместе с гарантом: КАЖДЫЙ бросок не ниже гаранта, берётся самый дорогой.
CFG.CHARGES = [
  { every: 500, mult: 25, cls: 'charge25', label: '25× УДАЧА!' },
  { every: 100, mult: 5,  cls: 'charge5',  label: '5× УДАЧА!' },
];

// Магазин улучшений
CFG.UPGRADES = {
  speed: { name: 'Скорость крутки', desc: 'Анимация короче на 9% за уровень',
    costs: [1400, 3500, 8500, 21000, 50000, 115000, 260000, 580000, 1300000, 2900000] },
  luck:  { name: 'Удача', desc: '+2% за уровень шанс бросить два номера и взять лучший',
    costs: [2800, 7000, 17000, 43000, 100000, 230000, 520000, 1150000, 2600000, 5800000] },
  mult:  { name: 'Множитель ₽', desc: '+20% к продажам за уровень',
    costs: [2100, 5600, 14000, 36000, 86000, 200000, 460000, 1000000, 2300000, 5000000] },
  auto:  { name: 'Автокрутка', desc: 'Крутит сама. Уровни сокращают паузу между крутками',
    costs: [14000, 70000, 350000, 1400000] },
  garage: { name: 'Гараж: +50 мест', desc: 'Больше места под номера. Легендарки и выше лежат в сейфе и места не занимают',
    costs: [200000, 800000, 3000000, 10000000, 30000000, 80000000] },
  slots: { name: 'Слоты на рынке', desc: '+1 объявление одновременно на «Блатном Рынке»',
    costs: [300000, 1500000, 6000000] },
};

// Удача: шанс двойного броска за уровень
CFG.LUCK_PER_LVL = 0.02;

CFG.SPIN_BASE_MS = 1600;        // базовая длительность анимации
CFG.SPIN_SPEED_FACTOR = 0.91;   // множитель за уровень скорости
CFG.FAST_SPIN_MS = 250;         // «быстрая крутка» в настройках
CFG.AUTO_PAUSE_MS = [900, 550, 300, 120]; // пауза автокрутки по уровням (1..4)

// Вехи (milestones): за номера в гараже и за количество круток
CFG.MILESTONES = {
  uniques: [
    { at: 10, reward: 1400 }, { at: 25, reward: 4200 }, { at: 50, reward: 11000 },
    { at: 100, reward: 28000 }, { at: 200, reward: 70000 }, { at: 350, reward: 170000 },
    { at: 500, reward: 430000 },
  ],
  spins: [
    { at: 100, reward: 700 }, { at: 500, reward: 3500 }, { at: 1000, reward: 8500 },
    { at: 5000, reward: 43000 }, { at: 10000, reward: 115000 }, { at: 25000, reward: 290000 },
  ],
};

// Награды за закрытие коллекционных наборов
CFG.SET_REWARDS = { words: 350000, mythics: 1500000, secrets: 2500000, dates: 2000000 };

// Достижения: test получает состояние игры
CFG.ACHIEVEMENTS = [
  { id: 'spin1',     name: 'Первая крутка',         desc: 'С почином!',                          reward: 200,    test: s => s.spins >= 1 },
  { id: 'spin100',   name: 'Разогрелся',            desc: '100 круток',                          reward: 1000,   test: s => s.spins >= 100 },
  { id: 'spin1k',    name: 'Барабанщик',            desc: '1 000 круток',                        reward: 5000,   test: s => s.spins >= 1000 },
  { id: 'spin10k',   name: 'Однорукий бандит',      desc: '10 000 круток',                       reward: 30000,  test: s => s.spins >= 10000 },
  { id: 'rare1',     name: 'Синий огонёк',          desc: 'Поймай редкий номер',                 reward: 500,    test: s => s.counts.rare >= 1 },
  { id: 'epic1',     name: 'Фиолетовое настроение', desc: 'Поймай эпический номер',              reward: 2000,   test: s => s.counts.epic >= 1 },
  { id: 'leg1',      name: 'Золотая жила',          desc: 'Поймай легендарный номер',            reward: 10000,  test: s => s.counts.legendary >= 1 },
  { id: 'myth1',     name: 'Легенда гаража',        desc: 'Поймай мифический номер',             reward: 50000,  test: s => s.counts.mythic >= 1 },
  { id: 'sec1',      name: 'Теневой коллекционер',  desc: 'Поймай секретный номер',              reward: 100000, test: s => s.counts.secret >= 1 },
  { id: 'gar10',     name: 'Завёл гараж',           desc: '10 номеров в гараже',                 reward: 800,    test: s => Object.keys(s.found).length >= 10 },
  { id: 'gar50',     name: 'Коллекционер',          desc: '50 номеров в гараже',                 reward: 4000,   test: s => Object.keys(s.found).length >= 50 },
  { id: 'gar200',    name: 'Музей номеров',         desc: '200 номеров в гараже',                reward: 20000,  test: s => Object.keys(s.found).length >= 200 },
  { id: 'words5',    name: 'Начитанный',            desc: '5 словесных номеров',                 reward: 5000,   test: s => Object.keys(s.sets.words).length >= 5 },
  { id: 'lyam',      name: 'Первый лям',            desc: 'Накопи 1 000 000 ₽',                  reward: 25000,  test: s => s.money >= 1000000 },
  { id: 'spent100k', name: 'Прожигатель',           desc: 'Потрать 100 000 ₽',                   reward: 5000,   test: s => s.stats.spent >= 100000 },
  { id: 'charge10',  name: 'Заряженный',            desc: 'Открути 10 круток удачи (5×/25×)',    reward: 8000,   test: s => s.stats.charges >= 10 },
  { id: 'market1',   name: 'Первая сделка',         desc: 'Продай номер на рынке',               reward: 5000,   test: s => (s.stats.market || 0) >= 1 },
  { id: 'market25',  name: 'Барыга',                desc: '25 сделок на рынке',                  reward: 50000,  test: s => (s.stats.market || 0) >= 25 },
  { id: 'raid1',     name: 'Попал под облаву',      desc: 'Переживи облаву',                     reward: 3000,   test: s => (s.stats.raids || 0) >= 1 },
  { id: 'lvl10',     name: 'Авторитет',             desc: 'Достигни 10 уровня',                  reward: 15000,  test: s => (s.level || 1) >= 10 },
  { id: 'blat1',     name: 'Блатной',               desc: 'Поймай блатную серию',                reward: 5000,   test: s => (s.combos.blat || 0) >= 1 },
  { id: 'visa',      name: 'Гражданин мира',        desc: 'Купи визу в США',                     reward: 50000,  test: s => !!(s.us && s.us.visa) },
  { id: 'vanity1',   name: 'Именной',               desc: 'Поймай именную табличку США',         reward: 30000,  test: s => (s.combos.uvan || 0) + (s.combos.uvtop || 0) >= 1 },
  { id: 'states15',  name: 'Road trip',             desc: 'Собери в гараже все 15 штатов',       reward: 500000, test: s => Object.keys((s.sets && s.sets.states) || {}).length >= CFG.US_STATES.length },
  { id: 'overEst',   name: 'Умеешь продать',        desc: 'Продай на рынке дороже оценки ×1.5',  reward: 15000,  test: s => !!s.claimed.flagOverEst },
  { id: 'buy1',      name: 'Покупатель',            desc: 'Купи номер на рынке',                 reward: 3000,   test: s => (s.stats.bought || 0) >= 1 },
  { id: 'buyHot',    name: 'Урвал',                 desc: 'Купи номер по 🔥 срочной цене',        reward: 8000,   test: s => !!s.claimed.flagBuyHot },
  { id: 'buyHaggle', name: 'Сбил цену',             desc: 'Выторгуй скидку у продавца',          reward: 8000,   test: s => !!s.claimed.flagHaggle },
  { id: 'buyLeg',    name: 'Охотник за легендами',  desc: 'Купи легендарку или выше на рынке',   reward: 100000, test: s => !!s.claimed.flagBuyLeg },
  { id: 'lowball10', name: 'Не на того напали',     desc: 'Отшей 10 лоуболлеров',                reward: 10000,  test: s => (s.stats.lowballs || 0) >= 10 },
  { id: 'pity5',     name: 'Награда за терпение',   desc: 'Поймай 5 pity-гарантов',              reward: 3000,   test: s => s.stats.pityTrig >= 5 },
  { id: 'elite1',    name: 'Три топора',            desc: 'Оставь в гараже номер региона 777/799', reward: 15000, test: s => s.stats.eliteKept >= 1 },
];

// Задания дня: каждый день случайные 3 из пула, сложность тоже случайная
CFG.DAILY_POOL = [
  { key: 'spins', name: 'Открутить {n} раз',             goals: [30, 60, 100],       rewards: [1500, 2500, 4000] },
  { key: 'found', name: 'Поймать {n} необычных и выше',  goals: [8, 15, 25],         rewards: [1500, 3000, 5000] },
  { key: 'earn',  name: 'Заработать {n} ₽ продажами',    goals: [3000, 8000, 15000], rewards: [2000, 3500, 6000] },
  { key: 'keep',  name: 'Оставить {n} номеров в гараже', goals: [3, 6, 10],          rewards: [1500, 2500, 4000] },
  { key: 'rares', name: 'Поймать {n} редких и выше',     goals: [2, 4, 7],           rewards: [2500, 4500, 8000] },
];
CFG.DAILY_COUNT = 3;

// ============ ВОЕННЫЕ НОМЕРА ============
// Формат «1234 АВ 77»: 4 цифры, 2 буквы, код войск 10–99. Чёрная табличка, белые символы.
// Отдельный режим (переключатель «Тип номеров»), с гражданскими не смешиваются.
CFG.MIL = {
  COST_MULT: 3,                        // военная крутка дороже гражданской
  PLATE_BASE: 140,                     // база цены (калибровка test/calib-mil.js: EV ≈ 2.2× цены)
  RARITY_THRESH: [2, 12, 40, 480, 4800], // мифик ≥4800 — реже; по квантилям: ~75% / 93% / 98.6% / 1-1/2500 / 1-1/40000
  CHANCES: [null, 6, 15, 82, 2000, 89000], // справочное «1 к N» для интерфейса (из test/sim.js)
  CODES: Array.from({ length: 90 }, (_, i) => String(10 + i)),
};

// Исторические даты для сочетания «Великая дата»
CFG.MIL_DATES = {
  '1147': 'Основание Москвы', '1242': 'Ледовое побоище', '1380': 'Куликовская битва',
  '1612': 'Освобождение Москвы', '1703': 'Основание Петербурга', '1812': 'Бородино',
  '1861': 'Отмена крепостного права', '1917': 'Революция', '1941': 'Начало войны',
  '1945': 'Победа', '1957': 'Первый спутник', '1961': 'Полёт Гагарина',
  '1980': 'Олимпиада-80', '1991': 'Распад СССР',
};

// Сочетания военных номеров. p = { d: 4 цифры, ls: 2 буквы, reg: код }
// Группы как у гражданских: внутри группы — самое дорогое, группы перемножаются.
CFG._dig = p => p.d.split('').map(Number);
CFG.MIL_COMBOS = [
  // --- цифры (группа mnum) ---
  { id: 'mpair',   g: 'mnum', name: 'Пара цифр',             desc: 'Есть две одинаковые цифры',       ex: '1204 → 1224', mult: 1.5,
    test: p => new Set(p.d).size === 3 },
  { id: 'mzero',   g: 'mnum', name: 'Ноль впереди',          desc: 'Номер начинается с нуля',         ex: '0384', mult: 2,
    test: p => p.d[0] === '0' && p.d[1] !== '0' },
  { id: 'mround',  g: 'mnum', name: 'Ровные сотни',          desc: 'Две нуля в конце',                ex: '4500', mult: 8,
    test: p => p.d.slice(2) === '00' && p.d[1] !== '0' && p.d[0] !== '0' },
  { id: 'mtwo',    g: 'mnum', name: 'Две пары',              desc: 'Пара и пара',                     ex: '1122', mult: 12,
    test: p => p.d[0] === p.d[1] && p.d[2] === p.d[3] && p.d[0] !== p.d[2] },
  { id: 'mrep',    g: 'mnum', name: 'Повтор пары',           desc: 'Две одинаковые половинки',        ex: '1212', mult: 12,
    test: p => p.d[0] === p.d[2] && p.d[1] === p.d[3] && p.d[0] !== p.d[1] },
  { id: 'mmirror', g: 'mnum', name: 'Зеркальный номер',      desc: 'Читается одинаково с двух сторон', ex: '1221', mult: 12,
    test: p => p.d[0] === p.d[3] && p.d[1] === p.d[2] && p.d[0] !== p.d[1] },
  { id: 'mtrip',   g: 'mnum', name: '3 одинаковые цифры',    desc: 'Три из четырёх совпадают',        ex: '5559', mult: 20,
    test: p => { const c = {}; for (const x of p.d) c[x] = (c[x] || 0) + 1; return Object.values(c).includes(3); } },
  { id: 'msmall',  g: 'mnum', name: 'Малый номер',           desc: 'Меньше сотни',                    ex: '0042', mult: 30,
    test: p => p.d.slice(0, 2) === '00' && p.d[2] !== '0' },
  { id: 'mthous',  g: 'mnum', name: 'Ровные тысячи',         desc: 'Три нуля в конце',                ex: '3000', mult: 40,
    test: p => p.d.slice(1) === '000' },
  { id: 'mseq',    g: 'mnum', name: 'Цифры подряд',          desc: 'По порядку вверх или вниз',       ex: '1234', mult: 60,
    test: p => { const a = CFG._dig(p); return a.every((x, i) => i === 0 || x - a[i - 1] === 1) || a.every((x, i) => i === 0 || a[i - 1] - x === 1); } },
  { id: 'mtiny',   g: 'mnum', name: 'Однозначный номер',     desc: 'Меньше десяти',                   ex: '0005', mult: 120,
    test: p => p.d.slice(0, 3) === '000' },
  { id: 'magent',  g: 'mnum', name: 'Агент 0007',            desc: 'С лицензией на всё',              ex: '0007', mult: 200,
    test: p => p.d === '0007' },
  { id: 'mone',    g: 'mnum', name: 'Номер один',            desc: 'Первый номер части',              ex: '0001', mult: 300,
    test: p => p.d === '0001' },
  { id: 'mquad',   g: 'mnum', name: 'Все четыре одинаковые', desc: 'Четыре одинаковые цифры',         ex: '5555', mult: 400,
    test: p => new Set(p.d).size === 1 },
  { id: 'maxes',   g: 'mnum', name: 'Четыре топора',         desc: 'Легендарные 7777',                ex: '7777', mult: 1500,
    test: p => p.d === '7777' },
  // --- даты (группа mdate) ---
  { id: 'mbirth',  g: 'mdate', name: 'Год рождения',         desc: 'Похоже на год: 1950–2010',        ex: '1987', mult: 2,
    test: p => +p.d >= 1950 && +p.d <= 2010 },
  { id: 'mnow',    g: 'mdate', name: 'Текущий год',          desc: 'Этот год прямо на номере',        ex: 'меняется', mult: 50,
    test: p => +p.d === new Date().getFullYear() },
  { id: 'mhist',   g: 'mdate', name: 'Великая дата',         desc: 'Год из истории страны',           ex: '1945, 1961', mult: 80,
    test: p => !!CFG.MIL_DATES[p.d] },
  // --- твой год из настроек (группа mmine) ---
  { id: 'mmine',   g: 'mmine', name: 'Твой год',             desc: 'Твой год рождения из настроек',   ex: 'впиши в ⚙', mult: 100,
    test: p => !!CFG.myYear && p.d === String(CFG.myYear) },
  // --- буквы и код (группы mlet, mcode) ---
  { id: 'mlpair',  g: 'mlet',  name: 'Одинаковые буквы',     desc: 'Обе буквы серии одинаковые',      ex: 'ММ', mult: 4,
    test: p => p.ls[0] === p.ls[1] },
  { id: 'mcode',   g: 'mcode', name: 'Хвост = код',          desc: 'Конец цифр совпадает с кодом',    ex: '1477 на 77', mult: 10,
    test: p => p.d.slice(2) === p.reg },
];
CFG.myYear = null; // выставляется из настроек игрока

// ============ США (ЧАСТЬ 2) ============
// Номер хранится как 'US:CA:7ABC123' — штат и текст таблички.
// Открывается визой за рубли; свой долларовый кошелёк; обмен ₽ ⇄ $ с комиссией.
CFG.US = {
  VISA_PRICE: 5000000,        // ₽
  START_USD: 1000,
  SPIN_COST: 10,              // $
  PLATE_BASE: 4.5,            // $ — калибровка test/calib-us.js (EV ≈ 2.2× цены крутки)
  RARITY_THRESH: [2, 4, 30, 600, 3600], // по квантилям; мифик ≥4000 — реже
  CHANCES: [null, 6, 27, 84, 2400, 117000], // справочное «1 к N» (из test/sim.js)
  RATE: 90,                   // 1 $ = 90 ₽
  FEE: 0.08,                  // комиссия обменника
  LETTERS: 'ABCDEFGHJKLMNPRSTUVWXYZ', // без I, O, Q — как на настоящих табличках
  VANITY_CHANCE: 1 / 400,     // шанс именной таблички на бросок
  SECRET_CHANCE: 1 / 300000,
};
// гаранты в долларах
CFG.US.VIP = [
  { key: 'rare',      cost: 500 },
  { key: 'epic',      cost: 1600 },
  { key: 'legendary', cost: 18000 },
];

// Штаты: формат (L — буква, D — цифра, остальное как есть), цвета, прозвище.
// tier: t0 обычные / t1 крупные / t2 престиж (как регионы у России)
CFG.US_STATES = [
  { st: 'CA', name: 'California', nick: 'The Golden State',    fmt: 'DLLLDDD',  bg: '#ffffff', fg: '#1d3a8a', ac: '#c8102e', tier: 't1' },
  { st: 'TX', name: 'Texas',      nick: 'The Lone Star State', fmt: 'LLL-DDDD', bg: '#f4f1ea', fg: '#111111', ac: '#002868', tier: 't1' },
  { st: 'FL', name: 'Florida',    nick: 'Sunshine State',      fmt: 'LLL-LDD',  bg: '#ffffff', fg: '#0b6b3a', ac: '#f28c28', tier: 't1' },
  { st: 'NY', name: 'New York',   nick: 'Empire State',        fmt: 'LLL-DDDD', bg: '#f6f6f6', fg: '#0b2a6f', ac: '#f2a900', tier: 't1' },
  { st: 'NV', name: 'Nevada',     nick: 'The Silver State',    fmt: 'DDD-LLL',  bg: '#e9eef5', fg: '#1b2a4a', ac: '#8a96a8', tier: 't2' },
  { st: 'HI', name: 'Hawaii',     nick: 'Aloha State',         fmt: 'LLL-DDD',  bg: '#ffffff', fg: '#111111', ac: '#e4572e', tier: 't2' },
  { st: 'AK', name: 'Alaska',     nick: 'The Last Frontier',   fmt: 'LLL DDD',  bg: '#fff7d6', fg: '#0b2a6f', ac: '#2a6fdb', tier: 't2' },
  { st: 'IL', name: 'Illinois',   nick: 'Land of Lincoln',     fmt: 'LL DDDDD', bg: '#ffffff', fg: '#1d3a8a', ac: '#c8102e', tier: 't0' },
  { st: 'AZ', name: 'Arizona',    nick: 'Grand Canyon State',  fmt: 'LLLDDDD',  bg: '#fbe9d0', fg: '#7a2e0e', ac: '#d4622b', tier: 't0' },
  { st: 'WA', name: 'Washington', nick: 'Evergreen State',     fmt: 'LLLDDDD',  bg: '#f2f6ff', fg: '#1d3a8a', ac: '#2e7d32', tier: 't0' },
  { st: 'GA', name: 'Georgia',    nick: 'Peach State',         fmt: 'LLL DDDD', bg: '#ffffff', fg: '#111111', ac: '#f28c6b', tier: 't0' },
  { st: 'MI', name: 'Michigan',   nick: 'Great Lakes State',   fmt: 'LLL DDDD', bg: '#ffffff', fg: '#0b2a6f', ac: '#2a6fdb', tier: 't0' },
  { st: 'OH', name: 'Ohio',       nick: 'Birthplace of Aviation', fmt: 'LLL DDDD', bg: '#ffffff', fg: '#7a1f2b', ac: '#c8102e', tier: 't0' },
  { st: 'NJ', name: 'New Jersey', nick: 'Garden State',        fmt: 'LDDLLL',   bg: '#f7f2c9', fg: '#111111', ac: '#7a6a1f', tier: 't0' },
  { st: 'CO', name: 'Colorado',   nick: 'Centennial State',    fmt: 'LLL-LDD',  bg: '#ffffff', fg: '#1b5e20', ac: '#3a6fb0', tier: 't0' },
];
CFG.US_STATE = {};
CFG.US_STATES.forEach(s => { CFG.US_STATE[s.st] = s; });
CFG.US_TIERS = {
  t0: { name: 'Обычные штаты', weight: 70, sellMult: 1,   costMult: 2 },
  t1: { name: 'Крупные штаты', weight: 25, sellMult: 1.5, costMult: 3 },
  t2: { name: 'Престиж',       weight: 5,  sellMult: 2.5, costMult: 6 },
};

// Именные таблички (vanity): слово вместо номера. top — «жирные» слова
CFG.US_VANITY = {
  common: ['COOL', 'FAST', 'SPEEDY', 'MYRIDE', 'GOGOGO', 'ROADIE', 'DRIFT', 'TURBO', 'VROOM',
    'HONK', 'SUNNY', 'CHILL', 'RUSSIA', 'MOSCOW', 'DOLLAR', 'HOTDOG', 'COWBOY', 'SURFER'],
  top: ['BOSS', 'KING', 'RICH', 'LUCKY', 'LUCKY7', 'CASINO', 'JACKPOT', 'MONEY', 'GOLD', 'VIP1'],
};
CFG.US_ABBR = ['USA', 'NYC', 'LAX', 'FBI', 'CIA', 'VIP', 'CEO', 'BBQ', 'OMG', 'LOL', 'WOW', 'BOB', 'MOM', 'DAD', 'ACE'];
CFG.US_DATES = { '1776': 'Независимость', '1969': 'Высадка на Луну', '1492': 'Колумб', '1865': 'Конец Гражданской войны' };

// Секретки США: точный текст таблички, st '*' — любой штат
CFG.US_SECRETS = [
  { key: 'one',   t: '1',      st: '*',  name: 'Номер один Америки' },
  { key: 'potus', t: 'POTUS',  st: '*',  name: 'Президентский' },
  { key: 'area',  t: 'AREA51', st: 'NV', name: 'Зона 51' },
  { key: 'holly', t: 'HOLLYWD', st: 'CA', name: 'Голливуд' },
];

// Сочетания США. p = { st, t (текст без -/пробелов), dg (цифры подряд), lt (буквы подряд), van }
CFG.US_COMBOS = [
  // --- цифры (группа ud) ---
  { id: 'upair',  g: 'ud', name: 'Pair',            desc: 'Две одинаковые цифры',          ex: '7ABC223', mult: 1.5,
    test: p => !p.van && p.dg.length >= 2 && new Set(p.dg).size < p.dg.length },
  { id: 'uzero',  g: 'ud', name: 'Leading zero',    desc: 'Цифры начинаются с нуля',       ex: 'ABC-0347', mult: 2,
    test: p => !p.van && p.dg[0] === '0' },
  { id: 'uround', g: 'ud', name: 'Round',           desc: 'Цифры кончаются на 00',         ex: 'ABC-4500', mult: 8,
    test: p => !p.van && p.dg.length >= 3 && p.dg.endsWith('00') },
  { id: 'umirror', g: 'ud', name: 'Mirror',         desc: 'Цифры читаются с двух сторон',  ex: 'ABC-1221', mult: 10,
    test: p => !p.van && p.dg.length >= 3 && p.dg === [...p.dg].reverse().join('') && new Set(p.dg).size > 1 },
  { id: 'u911',   g: 'ud', name: '911',             desc: 'Экстренный вызов',              ex: 'ABC-9114', mult: 25,
    test: p => !p.van && p.dg.includes('911') },
  { id: 'useq',   g: 'ud', name: 'Straight',        desc: 'Цифры подряд, как стрит',       ex: 'ABC-1234', mult: 30,
    test: p => { if (p.van || p.dg.length < 3) return false; const a = [...p.dg].map(Number);
      return a.every((x, i) => !i || x - a[i - 1] === 1) || a.every((x, i) => !i || a[i - 1] - x === 1); } },
  { id: 'u007',   g: 'ud', name: 'Agent 007',       desc: 'Лицензия на всё',               ex: 'ABC-0071', mult: 40,
    test: p => !p.van && p.dg.includes('007') },
  { id: 'ulucky', g: 'ud', name: 'Lucky 7s',        desc: 'Три семёрки подряд',            ex: 'ABC-7771', mult: 60,
    test: p => !p.van && p.dg.includes('777') },
  { id: 'udate',  g: 'ud', name: 'American date',   desc: 'Год из истории США',            ex: '1776, 1969', mult: 80,
    test: p => !p.van && !!CFG.US_DATES[p.dg] },
  { id: 'uall',   g: 'ud', name: 'All the same',    desc: 'Все цифры одинаковые',          ex: 'ABC-5555', mult: 150,
    test: p => !p.van && p.dg.length >= 3 && new Set(p.dg).size === 1 },
  { id: 'ujack',  g: 'ud', name: 'Jackpot 7777',    desc: 'Четыре семёрки — джекпот',      ex: 'ABC-7777', mult: 800,
    test: p => !p.van && p.dg === '7777' },
  // --- буквы (группа ul) ---
  { id: 'ulpair', g: 'ul', name: 'Double letters',  desc: 'Две одинаковые буквы рядом',    ex: 'AAB-1234', mult: 2,
    test: p => !p.van && /(.)\1/.test(p.lt) },
  { id: 'ualpha', g: 'ul', name: 'ABC',             desc: 'Буквы по алфавиту',             ex: 'ABC, XYZ', mult: 25,
    test: p => { if (p.van || p.lt.length < 3) return false; const a = [...p.lt].map(c => c.charCodeAt(0));
      return a.every((x, i) => !i || x - a[i - 1] === 1); } },
  { id: 'uabbr',  g: 'ul', name: 'Abbreviation',    desc: 'Буквы — известное сокращение',  ex: 'USA, NYC, FBI', mult: 30,
    test: p => !p.van && CFG.US_ABBR.includes(p.lt) },
  { id: 'ultrip', g: 'ul', name: 'Triple letters',  desc: 'Три одинаковые буквы',          ex: 'AAA-1234', mult: 50,
    test: p => !p.van && /(.)\1\1/.test(p.lt) },
  // --- штат (группа ust) ---
  { id: 'uarea',  g: 'ust', name: 'Area 51',        desc: '51 на табличке Невады',         ex: 'NV 451-ABC', mult: 15,
    test: p => !p.van && p.st === 'NV' && p.dg.includes('51') },
  { id: 'uroute', g: 'ust', name: 'Route 66',       desc: '66 в штате на Трассе 66',       ex: 'AZ ABC6612', mult: 12,
    test: p => !p.van && ['IL', 'TX', 'AZ', 'CA'].includes(p.st) && p.dg.includes('66') },
  // --- именные (группа uvan) ---
  { id: 'uvan',   g: 'uvan', name: 'Vanity plate',  desc: 'Именная табличка со словом',    ex: 'COWBOY, TURBO', mult: 300,
    test: p => p.van },
  { id: 'uvtop',  g: 'uvan', name: 'Big vanity',    desc: 'Именная табличка-легенда',      ex: 'BOSS, KING, LUCKY7', mult: 2500,
    test: p => p.van && CFG.US_VANITY.top.includes(p.t) },
];

// Гараж: вместимость BASE + STEP за уровень апгрейда «Гараж». Уникальные номера (легендарка+) — в сейфе, не считаются
CFG.GARAGE = { BASE: 100, STEP: 50 };

// ============ ТОРГОВАЯ ПЛОЩАДКА «БЛАТНОЙ РЫНОК» (в телефоне) ============
// Выставляешь номер из гаража за свою цену; покупатели пишут в случайный момент:
// дёшево — быстро, дорого — долго, но не позже MAX_WAIT_MS. Можно торговаться.
CFG.MARKET = {
  FEE: 0.05,                   // комиссия площадки с продажи
  BASE_SLOTS: 3,               // объявлений одновременно (+ апгрейд «Слоты на рынке»)
  EST_MULT: 1.5,               // рыночная оценка = мгновенная продажа × 1.5
  PRICE_MIN: 0.5, PRICE_MAX: 5, // ползунок цены — доля оценки
  BASE_WAIT_MS: 45000,         // ожидание при цене 0.8 оценки; дальше растёт экспонентой
  WAIT_GROWTH: 2.2,
  MIN_WAIT_MS: 8000,
  MAX_WAIT_MS: 28 * 60 * 1000, // не дольше ~28 минут
  REPLY_MS: [2500, 8000],      // покупатель «печатает» ответ
  OFFLINE_CAP: 5,              // сколько новых покупателей максимум накопится, пока игра закрыта
  BUMP_FEE: 0.03,              // «Поднять объявление»: 3% цены
  BUMP_MIN: { rub: 500, usd: 5 },
  BUMP_MS: 10 * 60 * 1000,     // поднятие действует 10 минут
  BUMP_SPEED: 0.35,            // ожидание ×0.35 пока поднято
  // рейтинг продавца: уровень = √сделок (до 10). Каждый уровень: −3% ожидания, +2% к оценке покупателей
  RATING_MAX: 10,
  // --- покупка: объявления других продавцов (вкладка «🛍 Купить») ---
  BUY: {
    FEED: { rub: [8, 12], usd: [5, 8] },     // сколько объявлений в ленте (мин, макс)
    SPAWN_MS: [40000, 100000],               // новое объявление, пока лента не полная
    LIFE_MS: [5 * 60000, 30 * 60000],        // сколько живёт объявление
    DEAL_LIFE_MS: [60000, 180000],           // «🔥 Срочно» — исчезает за 1–3 минуты
    MIL_SHARE: 0.25,                         // доля военных номеров в рублёвой ленте
    // шанс редкостей у нового объявления (остальное — обычный товар)
    ROLL: { secret: 0.002, mythic: 0.01, legendary: 0.04, epic: 0.10, wanted: 0.22 },
    FILLER: { common: 0.35, uncommon: 0.40, rare: 0.25 },
    KIND: { fair: 0.55, over: 0.30, deal: 0.15 },
    PRICE: { fair: [0.9, 1.15], over: [1.5, 3], deal: [0.72, 0.85] }, // доля рыночной оценки
    UNIQUE_K: { legendary: [1.3, 2], mythic: [2, 3], secret: [2.5, 4] }, // уникальные — всегда с наценкой
    FLOOR: 0.72, // ниже оценки×0.72 не продают никогда: мгновенная перепродажа не окупается
    // продавцы: min — до какой доли цены готовы уступить, patience — сколько раз торгуются
    SELLERS: {
      stubborn: { name: 'упёртый',     min: [0.93, 1],    patience: 1 },
      soft:     { name: 'сговорчивый', min: [0.7, 0.85],  patience: 3 },
      dealer:   { name: 'барыга',      min: [0.82, 0.92], patience: 2 },
    },
  },
};

// ============ УРОВЕНЬ ИГРОКА ============
// XP: за крутку 1 + 2 за каждую ступень редкости. Порог уровня n: XP_BASE × n^1.5
CFG.LEVEL = {
  XP_BASE: 40,
  REWARD: lvl => 500 * lvl,     // деньги за новый уровень
  TICKET_EVERY: 5,              // каждые 5 уровней — билет заряда
  TICKET_TRIES: 3,              // билет = следующая крутка «лучший из 3»
  TITLES: ['Пешеход', 'Водила', 'Таксист', 'Пацан с района', 'Перекупщик', 'Коллекционер',
    'Блатной', 'Авторитет', 'Вор в законе', 'Хозяин дорог'],
};

// ============ ОБЛАВА ============
// Случайный ивент: на DURATION_MS каждая крутка бросает 2 номера (берётся лучший)
CFG.RAID = {
  CHANCE: 1 / 220,         // шанс начаться после крутки
  DURATION_MS: 60000,
  TRIES_MULT: 2,
  MIN_SPINS: 30,           // не раньше этой крутки
};

if (typeof module !== 'undefined') module.exports = CFG;
