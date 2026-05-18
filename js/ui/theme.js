/**
 * theme.js
 * ----------------------------------------------------------------
 * Управление темой оформления (dark | light | auto).
 *
 * Логика:
 *   - Пользовательский выбор хранится в localStorage 'auraline:v1:theme'
 *   - Если выбора нет — используется prefers-color-scheme (CSS делает сам)
 *   - При явном выборе ставится html[data-theme="dark"|"light"]
 *
 * API:
 *   getTheme()                 → 'dark' | 'light' | 'auto'
 *   setTheme(theme)            → применить и сохранить
 *   toggleTheme()              → переключить dark ↔ light (auto становится явным)
 *   onThemeChange(cb)          → подписаться на смену
 */

const STORAGE_KEY = 'auraline:v1:theme';
const listeners = new Set();

export function getTheme() {
    try {
        return localStorage.getItem(STORAGE_KEY) || 'auto';
    } catch { return 'auto'; }
}

export function setTheme(theme) {
    const root = document.documentElement;
    if (theme === 'auto') {
        root.removeAttribute('data-theme');
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
    } else {
        root.setAttribute('data-theme', theme);
        try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
        // Обновляем theme-color для адресной строки браузера
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute('content', theme === 'light' ? '#FAF7F0' : '#06060A');
        }
    }
    fire(theme);
}

export function toggleTheme() {
    const current = effectiveTheme();
    setTheme(current === 'light' ? 'dark' : 'light');
}

/** Текущая «эффективная» тема (даже если auto) */
export function effectiveTheme() {
    const stored = getTheme();
    if (stored !== 'auto') return stored;
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function onThemeChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}

function fire(theme) {
    for (const cb of listeners) {
        try { cb(theme); } catch (e) { console.error(e); }
    }
    try {
        document.dispatchEvent(new CustomEvent('theme:change', { detail: theme }));
    } catch {}
}

// Применить тему на старте: явно сохранённую ИЛИ дефолтную тёмную.
// Раньше при 'auto' атрибут вообще не ставился — и тогда срабатывало
// правило @media (prefers-color-scheme: light), что давало кашу у людей
// со светлой системной темой. Теперь дефолт всегда тёмная.
const initial = getTheme();
const themeToApply = (initial === 'light') ? 'light' : 'dark';
document.documentElement.setAttribute('data-theme', themeToApply);

// Слушаем смену системной темы — если у пользователя 'auto'
try {
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
        if (getTheme() === 'auto') fire('auto');
    });
} catch {}
