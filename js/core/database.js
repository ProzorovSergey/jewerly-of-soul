/**
 * database.js
 * ----------------------------------------------------------------
 * Имитация "базы данных" камней:
 *   - загружает data/stones.json через fetch();
 *   - кэширует результат в localStorage по ключу и версии;
 *   - при оффлайне/ошибке возвращает кэш, если он есть.
 */

const CACHE_KEY = 'bracelet_stones_cache_v1';
const DATA_URL  = './data/stones.json';

/**
 * Загрузить список камней. Сперва пытается fetch(),
 * при успехе обновляет кэш в localStorage.
 * Если fetch упал (например, открыли файл через file://),
 * возвращает данные из кэша. Иначе — исключение.
 *
 * @returns {Promise<Object>} { version, updated, stones: [] }
 */
export async function loadStones() {
    // 1. Пробуем сеть
    try {
        const res = await fetch(DATA_URL, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        saveCache(data);
        return data;
    } catch (err) {
        console.warn('[database] fetch failed, trying cache:', err);
    }

    // 2. Фолбэк: localStorage
    const cached = readCache();
    if (cached) {
        console.info('[database] using cached stones');
        return cached;
    }

    // 3. Совсем плохо
    throw new Error('Не удалось загрузить базу камней: ни сеть, ни кэш не доступны.');
}

function saveCache(data) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            savedAt: Date.now(),
            data,
        }));
    } catch (err) {
        // LocalStorage может быть недоступен (privacy mode и т.п.)
        console.warn('[database] cache save failed:', err);
    }
}

function readCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed.data || null;
    } catch (err) {
        console.warn('[database] cache read failed:', err);
        return null;
    }
}

/** Принудительно очистить кэш (для отладки). */
export function clearStonesCache() {
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch (_) { /* noop */ }
}

/** Найти камень по id. */
export function findStone(stones, id) {
    return stones.find(s => s.id === id) || null;
}
