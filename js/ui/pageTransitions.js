/**
 * pageTransitions.js
 * ----------------------------------------------------------------
 * Плавные переходы между страницами через View Transitions API.
 *
 * Перехватывает клики по same-origin <a href="…html">, проигрывает
 * fade/scale-переход через document.startViewTransition, и только
 * после этого делает реальный переход.
 *
 * На браузерах без поддержки (Firefox, Safari < 18) — обычная
 * навигация без задержки, никаких сломанных кликов.
 *
 * Игнорируется:
 *   - клики с модификаторами (Ctrl/Cmd/Shift) — открытие в новой вкладке
 *   - якоря (#…)
 *   - target=_blank
 *   - download / cross-origin
 *   - элементы с data-no-transition
 *   - prefers-reduced-motion
 */

const supported = typeof document !== 'undefined'
    && typeof document.startViewTransition === 'function';

function isModified(e) {
    return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

function shouldIntercept(link, e) {
    if (!link) return false;
    if (isModified(e)) return false;
    if (link.target && link.target !== '' && link.target !== '_self') return false;
    if (link.hasAttribute('download')) return false;
    if (link.dataset.noTransition !== undefined) return false;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return false;
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;

    try {
        const url = new URL(link.href, location.href);
        if (url.origin !== location.origin) return false;
        // тот же path и тот же hash — это якорь, не навигация
        if (url.pathname === location.pathname && url.search === location.search) return false;
        return true;
    } catch {
        return false;
    }
}

function init() {
    if (!supported) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    document.addEventListener('click', e => {
        // Если клик уже обработан (например, карточка ленты открыла
        // превью-модалку и вызвала preventDefault) — не перехватываем.
        if (e.defaultPrevented) return;
        const link = e.target.closest && e.target.closest('a[href]');
        if (!shouldIntercept(link, e)) return;
        e.preventDefault();
        document.startViewTransition(() => {
            location.href = link.href;
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
