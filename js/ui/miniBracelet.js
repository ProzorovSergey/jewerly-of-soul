/**
 * miniBracelet.js
 * ----------------------------------------------------------------
 * Рисует уменьшенный браслет в карточке (главная, "мои работы",
 * "вдохновение") по списку id камней.
 *
 * Не требует state-объекта основного приложения — самостоятельно
 * берёт камни из переданной базы.
 */

import { renderBracelet } from '../core/bracelet.js';
import { onAlbedoReady } from '../core/stoneGenerator.js';

/**
 * Подготовить «фейковое» состояние браслета по списку id и
 * нарисовать на canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object[]}          catalogue       массив объектов stone
 * @param {Object}            composition
 * @param {String[]}          composition.stoneIds   id камней по порядку
 * @param {Number}            composition.size       размер бусины (мм), по умолчанию 8
 * @param {Number}            composition.length     длина браслета (мм), по умолчанию 180
 */
export function renderMini(canvas, catalogue, composition) {
    const size = composition.size || 8;
    const length = composition.length || 180;
    const ids = composition.stoneIds || [];

    const stones = ids.map(id => {
        const stone = catalogue.find(s => s.id === id);
        return stone ? { stoneId: id, size, stone } : null;
    }).filter(Boolean);

    // Если ничего не нашли — попробуем первые попавшиеся камни (мягкий фолбэк)
    if (!stones.length && catalogue.length) {
        for (let i = 0; i < 12 && i < catalogue.length; i++) {
            stones.push({ stoneId: catalogue[i].id, size, stone: catalogue[i] });
        }
    }

    const draw = () => {
        resizeForRetina(canvas);
        renderBracelet(canvas, { length, stones }, { showGuide: false });
    };
    draw();

    // Перерисовываем браслет, когда любой из его камней получит PNG-альбедо.
    // onAlbedoReady снимается само после срабатывания.
    const uniqIds = [...new Set(ids)];
    uniqIds.forEach(id => onAlbedoReady(id, draw));
}

function resizeForRetina(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
    }
}

/**
 * Запустить ленивую отрисовку всех мини-браслетов на странице.
 * Каждый элемент `<canvas data-mini-bracelet data-stones="id1,id2,...">`
 * будет нарисован, когда попадёт в viewport.
 */
export function autoMountMinis(catalogue) {
    const nodes = document.querySelectorAll('canvas[data-mini-bracelet]');
    if (!nodes.length) return;

    const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const c = entry.target;
            const ids = (c.dataset.stones || '').split(',').map(s => s.trim()).filter(Boolean);
            const size = +c.dataset.size || 8;
            const length = +c.dataset.length || 180;
            renderMini(c, catalogue, { stoneIds: ids, size, length });
            io.unobserve(c);
        });
    }, { threshold: 0.1 });

    nodes.forEach(n => io.observe(n));
}
