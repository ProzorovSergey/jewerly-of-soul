/**
 * reveal.js — декларативный scroll-reveal через CSS-классы
 * ----------------------------------------------------------------
 * Любой элемент с атрибутом `data-reveal` плавно проявляется,
 * когда впервые попадает в viewport. После проявления наблюдение
 * снимается — нулевая стоимость на дальнейший скроллинг.
 *
 * Подход — на CSS-классах (не inline-style), чтобы:
 *   • не вмешиваться в каскад пользовательских стилей;
 *   • было легко переопределить вариант на странице;
 *   • не плодить будущие GC-узлы с inline transition strings.
 *
 * Декларация:
 *     <section data-reveal>...</section>                   default: fade-up
 *     <section data-reveal="blur-in">...</section>         именованный вариант
 *     <div data-reveal-stagger="80">                       staggered дети по 80мс
 *
 * Опциональные атрибуты:
 *   data-reveal-delay="200"        задержка в мс перед стартом
 *   data-reveal-once="false"       по умолчанию true: больше не наблюдать
 *
 * Доступные варианты (см. base.css → .reveal--*):
 *   fade-up (default), fade-down, fade-left, fade-right,
 *   blur-in, scale-in, rise
 *
 * На prefers-reduced-motion — мгновенный показ, без transform.
 */

const REVEAL_SELECTOR = '[data-reveal]';
const VARIANT_CLASS_PREFIX = 'reveal--';
const VALID_VARIANTS = new Set([
    'fade-up', 'fade-down', 'fade-left', 'fade-right',
    'blur-in', 'scale-in', 'rise',
]);

let io = null;

function isReducedMotion() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function reveal(el) {
    const delay = parseInt(el.dataset.revealDelay, 10) || 0;
    if (delay > 0) {
        setTimeout(() => el.classList.add('is-revealed'), delay);
    } else {
        // requestAnimationFrame гарантирует, что класс is-revealed
        // применяется ПОСЛЕ установки initial-стилей — иначе transition
        // не сработает (нет «from-состояния» для браузера).
        requestAnimationFrame(() => el.classList.add('is-revealed'));
    }

    // Stagger для прямых детей (по данным data-reveal-stagger)
    const stagger = parseInt(el.dataset.revealStagger, 10);
    if (stagger > 0) {
        [...el.children].forEach((child, i) => {
            child.style.setProperty('--reveal-delay', `${i * stagger}ms`);
            child.classList.add('reveal-stagger-child');
        });
    }
}

function attach(el) {
    if (el.__revealAttached) return;
    el.__revealAttached = true;

    // Применяем класс-вариант — base.css знает, как анимировать каждый
    const variant = el.dataset.reveal;
    if (variant && VALID_VARIANTS.has(variant)) {
        el.classList.add(VARIANT_CLASS_PREFIX + variant);
    }

    if (isReducedMotion()) {
        el.classList.add('is-revealed');
        return;
    }

    // Если элемент уже в viewport (страница загружена с
    // сохранённой позицией / hero на первом экране) — показать сразу.
    const r = el.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const alreadyVisible = r.top < viewportH && r.bottom > 0;
    if (alreadyVisible) {
        reveal(el);
        return;
    }

    if (!io) {
        io = new IntersectionObserver(entries => {
            // Если несколько элементов вошли одновременно — стартуют
            // со стартовой задержкой, создавая мини-каскад
            entries
                .filter(e => e.isIntersecting)
                .forEach((entry, i) => {
                    const el = entry.target;
                    // Микро-стаггер: 60мс между соседними
                    const baseDelay = parseInt(el.dataset.revealDelay, 10) || 0;
                    el.dataset.revealDelay = String(baseDelay + i * 60);
                    reveal(el);
                    io.unobserve(el);
                });
        }, {
            threshold: 0.08,
            rootMargin: '0px 0px -80px 0px',
        });
    }
    io.observe(el);
}

export function mountReveal(root = document) {
    root.querySelectorAll(REVEAL_SELECTOR).forEach(attach);
}

// Авто-запуск + повторный обход при появлении новых узлов (layout.js,
// динамически вставленные карточки и т.д.)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountReveal());
} else {
    mountReveal();
}

const mo = new MutationObserver(records => {
    for (const r of records) {
        r.addedNodes.forEach(n => {
            if (n.nodeType !== 1) return;
            if (n.matches?.(REVEAL_SELECTOR)) attach(n);
            n.querySelectorAll?.(REVEAL_SELECTOR).forEach(attach);
        });
    }
});
if (document.body) mo.observe(document.body, { childList: true, subtree: true });
else document.addEventListener('DOMContentLoaded', () =>
    mo.observe(document.body, { childList: true, subtree: true }));
