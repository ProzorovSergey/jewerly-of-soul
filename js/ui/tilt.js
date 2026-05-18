/**
 * tilt.js
 * ----------------------------------------------------------------
 * Лёгкий tilt + elevation на mouse-move. Применяется к любому
 * элементу с атрибутом `data-tilt`. Под капотом — CSS-кастом
 * проперти `--tilt-x`, `--tilt-y`, `--tilt-shift-x`, `--tilt-shift-y`,
 * `--tilt-active`, которые сама карточка использует в transform/shadow.
 *
 * Принцип: не накладываем transform напрямую — отдаём только числа,
 * а как именно «откликаться» (rotate / translate / scale / shadow)
 * решает CSS карточки. Это позволяет каждой карточке иметь свой
 * характер микровзаимодействия.
 *
 *     <article class="idea-card" data-tilt>...</article>
 *
 * Опциональные атрибуты:
 *   data-tilt-max  — максимальный угол наклона, по умолчанию 5°
 *   data-tilt-glare="1"  — добавить glare-блик (требует CSS)
 *
 * На touch-устройствах эффект автоматически отключается.
 */

const TILT_SELECTOR = '[data-tilt]';
let observer = null;

function isTouch() {
    return matchMedia('(hover: none)').matches;
}

function attach(el) {
    if (isTouch() || el.__tiltAttached) return;
    el.__tiltAttached = true;

    const max = parseFloat(el.dataset.tiltMax) || 5;
    let rafId = 0;
    let active = false;

    function onMove(e) {
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;   // 0..1
        const py = (e.clientY - rect.top) / rect.height;
        // x → tilt по Y-оси (право → -max..+max), y → tilt по X-оси (низ → -max..+max)
        const tiltY = (px - 0.5) * 2 * max;          // влево/вправо
        const tiltX = -(py - 0.5) * 2 * max;         // вверх/вниз (инверсия)
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            el.style.setProperty('--tilt-x', tiltX.toFixed(2) + 'deg');
            el.style.setProperty('--tilt-y', tiltY.toFixed(2) + 'deg');
            el.style.setProperty('--tilt-shift-x', ((px - 0.5) * 8).toFixed(2) + 'px');
            el.style.setProperty('--tilt-shift-y', ((py - 0.5) * 8).toFixed(2) + 'px');
            if (!active) {
                active = true;
                el.style.setProperty('--tilt-active', '1');
            }
        });
    }

    function onLeave() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            el.style.setProperty('--tilt-x', '0deg');
            el.style.setProperty('--tilt-y', '0deg');
            el.style.setProperty('--tilt-shift-x', '0px');
            el.style.setProperty('--tilt-shift-y', '0px');
            el.style.setProperty('--tilt-active', '0');
            active = false;
        });
    }

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointercancel', onLeave);

    // Базовое значение
    el.style.setProperty('--tilt-active', '0');
}

/**
 * Авто-инициализация: ищет все [data-tilt] на странице и подписывает их.
 * При появлении новых через MutationObserver — подписывает тоже.
 */
export function mountTilt(root = document) {
    root.querySelectorAll(TILT_SELECTOR).forEach(attach);
    if (!observer) {
        observer = new MutationObserver(records => {
            for (const r of records) {
                r.addedNodes.forEach(n => {
                    if (n.nodeType !== 1) return;
                    if (n.matches?.(TILT_SELECTOR)) attach(n);
                    n.querySelectorAll?.(TILT_SELECTOR).forEach(attach);
                });
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
}

// Авто-запуск
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountTilt());
} else {
    mountTilt();
}
