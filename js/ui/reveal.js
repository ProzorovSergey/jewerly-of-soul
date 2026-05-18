/**
 * reveal.js
 * ----------------------------------------------------------------
 * Премиум scroll-reveal через IntersectionObserver.
 * Любой элемент с атрибутом `data-reveal` плавно проявляется,
 * когда впервые попадает в viewport. После проявления наблюдение
 * снимается — нет затрат на скроллинг.
 *
 *     <section data-reveal>...</section>
 *
 * Опциональные атрибуты:
 *   data-reveal-delay="200"   — задержка в мс перед анимацией
 *   data-reveal-stagger="80"  — для контейнера: дети получают
 *                                  staggered-delay 80мс между друг другом
 *
 * На prefers-reduced-motion — мгновенный показ, без transform.
 */

const REVEAL_SELECTOR = '[data-reveal]';
let io = null;

function isReducedMotion() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function reveal(el) {
    const delay = parseInt(el.dataset.revealDelay, 10) || 0;
    if (delay > 0) {
        setTimeout(() => el.classList.add('is-revealed'), delay);
    } else {
        el.classList.add('is-revealed');
    }

    // Stagger для прямых детей
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

    if (isReducedMotion()) {
        el.classList.add('is-revealed');
        return;
    }

    // Если элемент уже в viewport ИЛИ выше его (страница загружена с
    // сохранённой позицией) — показать мгновенно, без ожидания scroll.
    const r = el.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const alreadyVisible = r.top < viewportH;
    if (alreadyVisible) {
        reveal(el);
        return;
    }

    if (!io) {
        io = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    reveal(entry.target);
                    io.unobserve(entry.target);
                }
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

// Авто-запуск + повторный обход при появлении новых узлов
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountReveal());
} else {
    mountReveal();
}

// MutationObserver для динамически добавленных секций (например, из layout.js)
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
