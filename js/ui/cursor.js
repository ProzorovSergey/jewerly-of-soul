/**
 * cursor.js
 * ----------------------------------------------------------------
 * Премиум-курсор: золотая точка следует за мышью точно, тонкое
 * кольцо догоняет с инерцией (lerp). На интерактивных элементах
 * кольцо вырастает и подсвечивается. На клике — сжимается.
 *
 * Принцип «mix-blend-mode: screen» — курсор всегда читается на
 * любом фоне, в стиле Linear/Vercel/Awwwards.
 *
 * Отключается:
 *   - на touch-устройствах (matchMedia '(hover: none)');
 *   - при prefers-reduced-motion (избегаем лишнего движения).
 */

const HOVER_SELECTOR = 'a, button, input, textarea, select, [role="button"], [data-tilt], .chip, .stone-chip, .toast';

function isTouch() {
    return matchMedia('(hover: none)').matches;
}
function isReducedMotion() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function init() {
    if (isTouch() || isReducedMotion()) return;
    // Защита от повторной инициализации
    if (document.body.dataset.cursorOn === '1') return;
    document.body.dataset.cursorOn = '1';
    document.body.classList.add('cursor-on');

    const dot  = document.createElement('div');
    const ring = document.createElement('div');
    dot.className  = 'cursor-dot';
    ring.className = 'cursor-ring';
    dot.setAttribute('aria-hidden', 'true');
    ring.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    // Координаты: точные mouse / lerp-ring
    let mx = -100, my = -100;
    let rx = -100, ry = -100;
    let isInside = false;

    function onMove(e) {
        mx = e.clientX;
        my = e.clientY;
        if (!isInside) {
            // первый ввод — сразу подтянуть ring чтобы не «прилетал» из (-100,-100)
            rx = mx; ry = my;
            isInside = true;
            dot.style.opacity = '1';
            ring.style.opacity = '1';
        }
    }

    function onLeave() {
        isInside = false;
        dot.style.opacity = '0';
        ring.style.opacity = '0';
    }

    function onDown() { ring.classList.add('is-clicked'); }
    function onUp()   { ring.classList.remove('is-clicked'); }

    function onOver(e) {
        if (e.target.closest && e.target.closest(HOVER_SELECTOR)) {
            ring.classList.add('is-interactive');
        }
    }
    function onOut(e) {
        if (e.target.closest && e.target.closest(HOVER_SELECTOR)) {
            // Проверим, не ушли ли на другой интерактивный
            const related = e.relatedTarget;
            if (!related || !related.closest || !related.closest(HOVER_SELECTOR)) {
                ring.classList.remove('is-interactive');
            }
        }
    }

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown, { passive: true });
    window.addEventListener('mouseup',   onUp,   { passive: true });
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout',  onOut);
    document.documentElement.addEventListener('mouseleave', onLeave);
    document.documentElement.addEventListener('mouseenter', () => { isInside = true; dot.style.opacity = '1'; ring.style.opacity = '1'; });

    // Стартовое состояние — невидимый, пока мышь не двинулась
    dot.style.opacity = '0';
    ring.style.opacity = '0';

    // RAF-цикл — обновляем позиции
    const LERP = 0.18;   // 0 = очень медленно, 1 = без задержки
    function tick() {
        // Точка — точно
        dot.style.transform  = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
        // Кольцо — догоняет lerp-ом
        rx += (mx - rx) * LERP;
        ry += (my - ry) * LERP;
        ring.style.transform = `translate(${rx.toFixed(2)}px, ${ry.toFixed(2)}px) translate(-50%, -50%)`;
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
