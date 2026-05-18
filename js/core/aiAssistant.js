/**
 * aiAssistant.js
 * ----------------------------------------------------------------
 * Rule-based mock AI-ассистента. Анализирует выбранные камни и
 * формирует осмысленный (для глаз) текст про энергетику браслета.
 *
 * Это НЕ настоящий LLM — это шаблонизатор, который смотрит на
 * доминирующие стихии/энергии/цвета камней и собирает текст из
 * заготовленных кусочков. На защите можно показать как «mock-API»
 * с возможностью заменить реализацию на реальный OpenAI/Anthropic
 * через aiApi.js.
 */

// ---------- Поэтические заготовки ----------

const ELEMENT_TONES = {
    'земля':  { word: 'земная', tone: 'опорная и неторопливая' },
    'вода':   { word: 'водная', tone: 'текучая и интуитивная' },
    'огонь':  { word: 'огненная', tone: 'тёплая и движущая' },
    'воздух': { word: 'воздушная', tone: 'ясная и подвижная' },
    'эфир':   { word: 'эфирная', tone: 'тонкая и собирающая' },
};

const ENERGY_PHRASES = {
    'спокойствие':  'мягкое успокаивающее звучание',
    'интуиция':     'способность слышать внутренний голос',
    'защита':       'плотное защитное поле',
    'любовь':       'тёплое любящее присутствие',
    'удача':        'благоприятный поток обстоятельств',
    'деньги':       'устойчивость в делах',
    'сила':         'опора и решимость',
    'уверенность':  'спокойная внутренняя уверенность',
    'баланс':       'выравнивание состояний',
    'вдохновение':  'тонкая чувствительность к идеям',
    'энергия':      'живое внутреннее движение',
};

const RECOMMENDATION_TEMPLATES = [
    'Носить тогда, когда нужна {tone}: в начале нового цикла, в долгие дни или в дни решений.',
    'Подойдёт для {tone} — для медленного утра, для дороги, для дня, в котором важно никуда не торопиться.',
    'Можно носить как амулет — на левой руке для приёма энергии, на правой для отдачи. {tone_cap}.',
    'Идеален в моменты, когда внутри слишком много шума: камни здесь работают как тихий якорь {tone}.',
];

const NAME_PATTERNS = [
    '{Element} {noun}',
    '{Quality} {noun}',
    '{Quality} {place}',
    '{Noun} {modifier}',
    '{Element_short} в {place}',
];

const NAMES_DICT = {
    Element: { 'земля': 'Земной', 'вода': 'Водный', 'огонь': 'Огненный', 'воздух': 'Воздушный', 'эфир': 'Эфирный' },
    Element_short: { 'земля': 'Земля', 'вода': 'Вода', 'огонь': 'Огонь', 'воздух': 'Воздух', 'эфир': 'Эфир' },
    Quality: ['Тихий', 'Глубокий', 'Лунный', 'Утренний', 'Северный', 'Янтарный', 'Молчаливый', 'Прибрежный', 'Зимний', 'Бархатный', 'Поздний'],
    noun: ['обет', 'вуаль', 'якорь', 'оберег', 'путь', 'след', 'голос', 'шёпот', 'круг', 'свет'],
    Noun: ['Обет', 'Вуаль', 'Якорь', 'Оберег', 'Путь', 'След', 'Голос', 'Шёпот', 'Круг', 'Свет'],
    modifier: ['тишины', 'воды', 'утра', 'севера', 'листа', 'долгого дня', 'покоя', 'дороги'],
    place: ['тумана', 'рассвета', 'дождя', 'оазиса', 'звезды', 'воды', 'сада', 'долгого дня'],
};

// ---------- ВСПОМОГАТЕЛЬНОЕ ----------

function countBy(items, key) {
    const m = new Map();
    for (const it of items) {
        const v = typeof key === 'function' ? key(it) : it[key];
        if (Array.isArray(v)) {
            for (const x of v) m.set(x, (m.get(x) || 0) + 1);
        } else if (v != null) {
            m.set(v, (m.get(v) || 0) + 1);
        }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function pick(arr, rng = Math.random) {
    return arr[Math.floor(rng() * arr.length)];
}

/** Псевдо-PRNG из seed-строки (детерминирует названия для одного состава). */
function mulberry32FromString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    let s = h >>> 0;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function fillPattern(pattern, ctx, rng) {
    return pattern.replace(/\{(\w+)\}/g, (_, key) => {
        const dict = NAMES_DICT[key];
        if (!dict) return '';
        if (Array.isArray(dict)) return pick(dict, rng);
        return dict[ctx.element] || dict[Object.keys(dict)[0]];
    });
}

// ---------- ОСНОВНАЯ ФУНКЦИЯ ----------

/**
 * Сформировать описание энергии браслета.
 * Принимает stones как массив объектов {id, size, stone: {element, energy, color_category, name}}.
 *
 * @param {Object} req
 * @returns {AIDescribeResponse}
 */
export function describeBraceletEnergy(req) {
    const stones = (req.stones || []).map(s => s.stone).filter(Boolean);
    if (!stones.length) {
        return {
            energyDescription: 'Добавьте хотя бы один камень — и я расскажу, что получается.',
            recommendations: '',
            nameSuggestions: [],
            dominants: { elements: [], energies: [] },
        };
    }

    // 1. Доминанты
    const elements = countBy(stones, 'element');
    const energies = countBy(stones, 'energy');
    const colors   = countBy(stones, 'color_category');

    const topElements = elements.slice(0, 2).map(([k]) => k);
    const topEnergies = energies.slice(0, 4).map(([k]) => k);
    const topColors   = colors.slice(0, 2).map(([k]) => k);

    const lead = topElements[0] || 'земля';
    const leadTone = ELEMENT_TONES[lead] || ELEMENT_TONES['земля'];

    // 2. Описание энергии — связный абзац
    const uniqueNames = [...new Set(stones.map(s => s.name))].slice(0, 5);
    const energyPhrasesText = topEnergies
        .filter(e => ENERGY_PHRASES[e])
        .slice(0, 3)
        .map(e => ENERGY_PHRASES[e])
        .join(', ');

    let energyDescription = `Композиция получается ${leadTone.word} — ${leadTone.tone}.`;
    if (topElements.length > 1) {
        const second = topElements[1];
        const secondTone = ELEMENT_TONES[second];
        if (secondTone) {
            energyDescription += ` Сбоку присутствует ${secondTone.word} нотка — ${secondTone.tone}.`;
        }
    }
    if (energyPhrasesText) {
        energyDescription += ` Ведущие звучания браслета: ${energyPhrasesText}.`;
    }
    if (uniqueNames.length) {
        energyDescription += ` Камни-проводники: ${uniqueNames.join(', ')}.`;
    }

    // 3. Рекомендации
    const recTemplate = pick(RECOMMENDATION_TEMPLATES, mulberry32FromString(uniqueNames.join('-')));
    const recommendations = recTemplate
        .replaceAll('{tone}', leadTone.tone)
        .replaceAll('{tone_cap}', capitalize(leadTone.tone));

    // 4. Названия — 5 вариантов
    const seedStr = stones.map(s => s.id).join('-');
    const rng = mulberry32FromString(seedStr);
    const ctx = { element: lead };
    const nameSet = new Set();
    let safety = 0;
    while (nameSet.size < 5 && safety++ < 40) {
        const pat = pick(NAME_PATTERNS, rng);
        const name = fillPattern(pat, ctx, rng).replace(/\s+/g, ' ').trim();
        if (name) nameSet.add(name);
    }

    return {
        energyDescription,
        recommendations,
        nameSuggestions: [...nameSet],
        dominants: {
            elements: topElements,
            energies: topEnergies,
            colors:   topColors,
        },
    };
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
