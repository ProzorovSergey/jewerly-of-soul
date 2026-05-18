/**
 * motion.js — централизованная motion-system для Jewerly of Soul v2
 * ----------------------------------------------------------------
 * Единая точка для премиум-анимаций. Никакого React/GSAP — только
 * нативный requestAnimationFrame, IntersectionObserver и CSS-transitions
 * через токены из tokens.css.
 *
 * Принципы:
 *  • Только GPU-friendly свойства: transform, opacity, filter.
 *  • Никаких top/left/width/height в анимациях — провоцируют reflow.
 *  • Каждая функция уважает prefers-reduced-motion (сразу finalize).
 *  • Хуки на scroll/cursor дроссируются rAF, никаких jQuery-стиль setInterval.
 *  • will-change ставится на старте и СНИМАЕТСЯ после конца — иначе утечка
 *    GPU-памяти на длинных страницах.
 *
 * Публичное API:
 *   stagger(elements, options)
 *   revealOnScroll(rootSelector, options)
 *   magneticHover(element, options)
 *   parallaxOnScroll(element, options)
 *   tween(element, props, options)             — императивный tween
 *   prefersReducedMotion()
 *   onScrollDirection(cb)                      — подписка на up/down
 */

// =================================================================
// КОНФИГ ИЗ tokens.css
// =================================================================

const cssVar = (name, fallback = '') => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
};

const TOKENS = {
    get easeOut()      { return cssVar('--ease-out',       'cubic-bezier(0.16, 1, 0.3, 1)'); },
    get easeOutExpo()  { return cssVar('--ease-out-expo',  'cubic-bezier(0.19, 1, 0.22, 1)'); },
    get easeOutQuint() { return cssVar('--ease-out-quint', 'cubic-bezier(0.22, 1, 0.36, 1)'); },
    get easeSpring()   { return cssVar('--ease-spring',    'cubic-bezier(0.34, 1.56, 0.64, 1)'); },
    get durMd()        { return cssVar('--dur-md', '240ms'); },
    get durLg()        { return cssVar('--dur-lg', '380ms'); },
    get durXl()        { return cssVar('--dur-xl', '560ms'); },
    get stagger()      { return parseInt(cssVar('--stagger-step', '60ms'), 10) || 60; },
};

// =================================================================
// REDUCED MOTION
// =================================================================

const _rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let _reduced = _rmQuery.matches;
_rmQuery.addEventListener?.('change', e => { _reduced = e.matches; });

/** Истина, если пользователь предпочёл «без анимаций». */
export function prefersReducedMotion() {
    return _reduced;
}

// =================================================================
// VARIANTS — состояния «до» для разных типов reveal
// =================================================================

const VARIANTS = {
    'fade':       { from: 'opacity: 0;',                                  to: 'opacity: 1;' },
    'fade-up':    { from: 'opacity: 0; transform: translateY(24px);',     to: 'opacity: 1; transform: translateY(0);' },
    'fade-down':  { from: 'opacity: 0; transform: translateY(-24px);',    to: 'opacity: 1; transform: translateY(0);' },
    'fade-left':  { from: 'opacity: 0; transform: translateX(-32px);',    to: 'opacity: 1; transform: translateX(0);' },
    'fade-right': { from: 'opacity: 0; transform: translateX(32px);',     to: 'opacity: 1; transform: translateX(0);' },
    'blur-in':    { from: 'opacity: 0; filter: blur(12px);',              to: 'opacity: 1; filter: blur(0);' },
    'scale-in':   { from: 'opacity: 0; transform: scale(0.96);',          to: 'opacity: 1; transform: scale(1);' },
    'rise':       { from: 'opacity: 0; transform: translateY(40px) scale(0.98);', to: 'opacity: 1; transform: translateY(0) scale(1);' },
};

function applyStyles(el, css) {
    el.style.cssText += ';' + css;
}

function clearMotionStyles(el) {
    // Снимаем only motion-style свойства, не трогая user styles
    el.style.opacity = '';
    el.style.transform = '';
    el.style.filter = '';
    el.style.transition = '';
    el.style.willChange = '';
}

// =================================================================
// REVEAL ON SCROLL — основной публичный API
// =================================================================

/**
 * Запустить scroll-reveal для всех элементов внутри root.
 *
 * Элементы должны быть помечены атрибутом data-reveal с опциональным значением:
 *   <div data-reveal>            — default 'fade-up'
 *   <div data-reveal="blur-in">  — blur-in вариант
 *   <div data-reveal-stagger>    — staggered раскрытие детей (по очереди)
 *
 * @param {String|Element} root        корневой селектор / элемент (default: document)
 * @param {Object}         [opts]
 * @param {Number}         [opts.threshold=0.1]
 * @param {String}         [opts.rootMargin='0px 0px -10% 0px']
 * @param {Number}         [opts.duration]   override длительности (мс)
 * @param {String}         [opts.easing]     override easing curve
 * @returns {Function}     unmount-функция (отписаться от observer'ов)
 */
export function revealOnScroll(root = document, opts = {}) {
    const {
        threshold = 0.1,
        rootMargin = '0px 0px -10% 0px',
        duration,
        easing,
    } = opts;

    const rootEl = typeof root === 'string' ? document.querySelector(root) : root;
    if (!rootEl) return () => {};

    const elements = [...rootEl.querySelectorAll('[data-reveal]')];
    if (!elements.length) return () => {};

    // Reduced-motion → сразу показываем всё без анимаций
    if (prefersReducedMotion()) {
        elements.forEach(el => { el.style.opacity = '1'; el.removeAttribute('data-reveal'); });
        return () => {};
    }

    const dur = duration || parseInt(TOKENS.durXl, 10) || 560;
    const ease = easing || TOKENS.easeOutQuint;

    // Применяем initial-состояние ко всем элементам ДО первой отрисовки.
    // Иначе они мелькнут видимыми перед фокусом IntersectionObserver.
    elements.forEach(el => prime(el));

    function prime(el) {
        const variant = VARIANTS[el.dataset.reveal] || VARIANTS['fade-up'];
        applyStyles(el, variant.from);
        el.style.willChange = 'transform, opacity, filter';
    }

    function reveal(el, delay = 0) {
        const variant = VARIANTS[el.dataset.reveal] || VARIANTS['fade-up'];
        el.style.transition = `all ${dur}ms ${ease} ${delay}ms`;
        // forced reflow перед сменой свойств — гарантирует transition
        // eslint-disable-next-line no-unused-expressions
        void el.offsetHeight;
        applyStyles(el, variant.to);
        // Снимаем will-change после конца анимации
        setTimeout(() => { el.style.willChange = ''; }, dur + delay + 50);
    }

    // Элементы, уже видимые на стартовом viewport — раскрываем сразу
    // (IntersectionObserver не среагирует на статически видимое в Safari).
    const viewportH = window.innerHeight;
    const immediate = [];
    elements.forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.top < viewportH && r.bottom > 0) immediate.push(el);
    });

    // Stagger для immediate-элементов
    immediate.forEach((el, i) => reveal(el, i * (TOKENS.stagger / 2)));

    const remaining = elements.filter(el => !immediate.includes(el));
    if (!remaining.length) return () => {};

    const io = new IntersectionObserver((entries) => {
        // Группируем триггеры в один кадр → если несколько элементов
        // вошли в viewport одновременно, они стартуют со stagger
        const triggered = entries.filter(e => e.isIntersecting);
        triggered.forEach((entry, i) => {
            reveal(entry.target, i * TOKENS.stagger);
            io.unobserve(entry.target);
        });
    }, { threshold, rootMargin });

    remaining.forEach(el => io.observe(el));

    return () => io.disconnect();
}

// =================================================================
// STAGGER — императивный staggered-reveal набора элементов
// =================================================================

/**
 * Запустить staggered-анимацию для группы элементов.
 * В отличие от revealOnScroll, не ждёт IntersectionObserver —
 * стартует сразу. Подходит для anime-effect внутри уже видимого блока
 * (например, после открытия модалки).
 *
 * @param {NodeList|Element[]} elements
 * @param {Object}             [opts]
 * @param {String}             [opts.variant='fade-up']
 * @param {Number}             [opts.gap]              мс между элементами
 * @param {Number}             [opts.duration]
 * @param {String}             [opts.easing]
 */
export function stagger(elements, opts = {}) {
    const els = [...elements].filter(Boolean);
    if (!els.length) return;

    const {
        variant = 'fade-up',
        gap = TOKENS.stagger,
        duration,
        easing,
    } = opts;

    if (prefersReducedMotion()) {
        els.forEach(el => { el.style.opacity = '1'; });
        return;
    }

    const v = VARIANTS[variant] || VARIANTS['fade-up'];
    const dur = duration || parseInt(TOKENS.durLg, 10) || 380;
    const ease = easing || TOKENS.easeOutQuint;

    els.forEach(el => {
        applyStyles(el, v.from);
        el.style.willChange = 'transform, opacity, filter';
    });

    requestAnimationFrame(() => {
        els.forEach((el, i) => {
            const delay = i * gap;
            el.style.transition = `all ${dur}ms ${ease} ${delay}ms`;
            applyStyles(el, v.to);
            setTimeout(() => { el.style.willChange = ''; }, dur + delay + 50);
        });
    });
}

// =================================================================
// MAGNETIC HOVER — тонкое притяжение к курсору
// =================================================================

/**
 * Премиум-приём — элемент слегка тянется к курсору при hover.
 * Эффект известен по Apple-сайтам и premium-агенствам.
 * Дроссируется rAF, на touch-устройствах не активируется.
 *
 * @param {Element|String} target
 * @param {Object}         [opts]
 * @param {Number}         [opts.strength=0.18]    сила притяжения (0..0.5)
 * @param {Number}         [opts.radius=160]       зона активации в px
 * @returns {Function}     отписка
 */
export function magneticHover(target, opts = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return () => {};
    // На touch (pointer:coarse) — НЕ активируем
    if (window.matchMedia('(pointer: coarse)').matches) return () => {};
    if (prefersReducedMotion()) return () => {};

    const { strength = 0.18, radius = 160 } = opts;

    let rafId = 0;
    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;

    function onPointerMove(e) {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);

        if (dist < radius) {
            targetX = dx * strength;
            targetY = dy * strength;
        } else {
            targetX = 0;
            targetY = 0;
        }
        if (!rafId) rafId = requestAnimationFrame(animate);
    }

    function onPointerLeave() {
        targetX = 0; targetY = 0;
        if (!rafId) rafId = requestAnimationFrame(animate);
    }

    function animate() {
        // Линейная интерполяция к цели — плавный «магнитный» эффект
        currentX += (targetX - currentX) * 0.18;
        currentY += (targetY - currentY) * 0.18;

        if (Math.abs(targetX - currentX) < 0.1 && Math.abs(targetY - currentY) < 0.1) {
            currentX = targetX; currentY = targetY;
            el.style.transform = targetX === 0 && targetY === 0
                ? ''
                : `translate3d(${currentX}px, ${currentY}px, 0)`;
            rafId = 0;
            return;
        }

        el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        rafId = requestAnimationFrame(animate);
    }

    el.style.willChange = 'transform';
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerleave', onPointerLeave);

    return () => {
        document.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerleave', onPointerLeave);
        if (rafId) cancelAnimationFrame(rafId);
        el.style.transform = '';
        el.style.willChange = '';
    };
}

// =================================================================
// PARALLAX — лёгкий вертикальный сдвиг от scroll-position
// =================================================================

/**
 * Subtle parallax — элемент сдвигается медленнее основного контента.
 * Только translate3d, никаких background-position (вызовут reflow).
 *
 * @param {Element|String} target
 * @param {Object}         [opts]
 * @param {Number}         [opts.speed=0.3]   <0 - быстрее scroll, >0 - медленнее. Рекомендуется 0.1..0.5.
 * @returns {Function}     отписка
 */
export function parallaxOnScroll(target, opts = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return () => {};
    if (prefersReducedMotion()) return () => {};

    const { speed = 0.3 } = opts;

    let rafId = 0;
    let lastY = window.scrollY;
    let needsUpdate = false;

    function onScroll() {
        needsUpdate = true;
        if (!rafId) rafId = requestAnimationFrame(update);
    }

    function update() {
        rafId = 0;
        if (!needsUpdate) return;
        needsUpdate = false;
        const rect = el.getBoundingClientRect();
        // Активируем только если элемент в области viewport ±200px —
        // экономим работу на больших страницах
        if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
        const center = rect.top + rect.height / 2 - window.innerHeight / 2;
        const offset = -center * speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    }

    el.style.willChange = 'transform';
    window.addEventListener('scroll', onScroll, { passive: true });
    update();

    return () => {
        window.removeEventListener('scroll', onScroll);
        if (rafId) cancelAnimationFrame(rafId);
        el.style.transform = '';
        el.style.willChange = '';
    };
}

// =================================================================
// TWEEN — императивная анимация transform/opacity для одного элемента
// =================================================================

/**
 * Анимировать transform/opacity императивно (CSS transition внутри).
 * Полезно для случаев, когда CSS-класса недостаточно.
 *
 * @param {Element} el
 * @param {Object}  props    { translateY, translateX, scale, opacity, rotate }
 * @param {Object}  [opts]   { duration, easing, delay }
 * @returns {Promise<void>}  резолвится после конца анимации
 */
export function tween(el, props, opts = {}) {
    if (!el) return Promise.resolve();

    const {
        duration = parseInt(TOKENS.durMd, 10) || 240,
        easing = TOKENS.easeOutQuint,
        delay = 0,
    } = opts;

    if (prefersReducedMotion()) {
        // Сразу финальное состояние без анимации
        applyTweenProps(el, props);
        return Promise.resolve();
    }

    el.style.willChange = 'transform, opacity';
    el.style.transition = `transform ${duration}ms ${easing} ${delay}ms, opacity ${duration}ms ${easing} ${delay}ms`;

    return new Promise(resolve => {
        requestAnimationFrame(() => {
            applyTweenProps(el, props);
            setTimeout(() => {
                el.style.willChange = '';
                el.style.transition = '';
                resolve();
            }, duration + delay + 16);
        });
    });
}

function applyTweenProps(el, props) {
    const t = [];
    if (props.translateY != null) t.push(`translateY(${props.translateY}px)`);
    if (props.translateX != null) t.push(`translateX(${props.translateX}px)`);
    if (props.scale != null)      t.push(`scale(${props.scale})`);
    if (props.rotate != null)     t.push(`rotate(${props.rotate}deg)`);
    if (t.length) el.style.transform = t.join(' ');
    if (props.opacity != null) el.style.opacity = String(props.opacity);
}

// =================================================================
// SCROLL DIRECTION — подписка на смену направления прокрутки
// =================================================================

/**
 * Подписаться на смену направления прокрутки. Полезно для
 * sticky-header'ов, которые скрываются вниз и показываются вверх.
 *
 * @param {Function} cb       cb('up'|'down', {y, lastY})
 * @returns {Function}        отписка
 */
export function onScrollDirection(cb) {
    let lastY = window.scrollY;
    let lastDir = '';
    let rafId = 0;

    function onScroll() {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            const y = window.scrollY;
            const dir = y > lastY ? 'down' : y < lastY ? 'up' : lastDir;
            if (dir && dir !== lastDir) {
                cb(dir, { y, lastY });
                lastDir = dir;
            }
            lastY = y;
            rafId = 0;
        });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
        window.removeEventListener('scroll', onScroll);
        if (rafId) cancelAnimationFrame(rafId);
    };
}

// =================================================================
// Никакого auto-mount — motion.js это library, не orchestrator.
// Декларативный scroll-reveal по [data-reveal] обслуживает reveal.js
// через CSS-classes (.is-revealed + варианты). Он легче и не
// мешает CSS-каскаду пользовательских стилей.
// =================================================================

// Удобный экспорт всего «по дефолту» — для тех, кто хочет одну import-строку
export default {
    revealOnScroll,
    stagger,
    magneticHover,
    parallaxOnScroll,
    tween,
    onScrollDirection,
    prefersReducedMotion,
};
