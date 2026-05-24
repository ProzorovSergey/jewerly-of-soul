/**
 * bracelet.js
 * ----------------------------------------------------------------
 * Логика браслета + отрисовка на canvas.
 *
 * Модель:
 *   bracelet = {
 *     length: number,           // целевая длина браслета в мм
 *     stones: BraceletStone[],  // массив камней по порядку
 *   }
 *   BraceletStone = {
 *     stoneId: string,  // id из базы
 *     size: number,     // диаметр в мм
 *     stone: Stone,     // ссылка на полный объект из базы
 *   }
 *
 * Размещение — два режима (opts.layout):
 *   'fill' (по умолчанию, конструктор):
 *     - камни ложатся вплотную по часовой стрелке от 12 часов;
 *     - каждый камень занимает дугу = его диаметр;
 *     - незаполненный остаток — пустая дуга «нити» в конце.
 *   'ring' (лента сообщества, превью, экспорт):
 *     - готовое замкнутое изделие: бусины распределены равномерно
 *       по всей окружности, вплотную друг к другу.
 *
 * Геометрия раскладки вынесена в computeBraceletLayout() — её
 * использует и отрисовка, и конструктор (попадание курсора при
 * выделении и перетаскивании камней).
 */

import { generateStoneTexture } from './stoneGenerator.js';

// =================================================================
// ГЕОМЕТРИЯ
// =================================================================

/** Суммарный "занятый" размер в мм. */
export function totalStoneLength(stones) {
    return stones.reduce((sum, s) => sum + s.size, 0);
}

/**
 * Можно ли добавить камень данного размера без превышения длины?
 */
export function canAddStone(stones, braceletLength, size) {
    return totalStoneLength(stones) + size <= braceletLength;
}

/** Сколько мм осталось. */
export function remainingLength(stones, braceletLength) {
    return Math.max(0, braceletLength - totalStoneLength(stones));
}

/**
 * Сгруппировать бусины по «вид камня + размер»: вместо строки на
 * каждую бусину — «название × количество». Порядок групп — по
 * первому появлению камня в браслете.
 *
 * Принимает массив бусин в любом из принятых на сайте форматов:
 *   { stoneId, size, stone }   — конструктор и экспорт
 *   { id, size, stone }        — развёрнутая идея
 *   { id, size }               — «сырая» идея (stone подтянется по catalogue)
 *
 * @param {Array}  stones
 * @param {Array}  [catalogue]  каталог камней — чтобы достать stone по id
 * @returns {Array<{ id, name, element, size, count, stone }>}
 */
export function groupStones(stones, catalogue) {
    const groups = new Map();
    for (const s of stones || []) {
        const id = s.stoneId || s.id || (s.stone && s.stone.id) || '?';
        const size = s.size || 0;
        let stone = s.stone || null;
        if (!stone && catalogue) stone = catalogue.find(x => x.id === id) || null;

        const key = id + '|' + size;
        let g = groups.get(key);
        if (!g) {
            g = {
                id,
                name: (stone && stone.name) || id,
                element: (stone && stone.element) || '',
                size,
                count: 0,
                stone,
            };
            groups.set(key, g);
        }
        if (!g.stone && stone) { g.stone = stone; g.name = stone.name; g.element = stone.element || ''; }
        g.count++;
    }
    return [...groups.values()];
}

/**
 * Рассчитать раскладку браслета — положение каждой бусины на кольце.
 * Все координаты — в CSS-пикселях canvas (та же система, что у
 * pointer-событий после вычитания getBoundingClientRect).
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} state
 * @param {Object} [opts]
 * @param {'fill'|'ring'} [opts.layout='fill']  режим раскладки
 * @returns {{ beads: Array, cx: number, cy: number, ringRadius: number }}
 *   bead = { index, stone, x, y, displaySize, radius,
 *            startAngle, centerAngle, endAngle }
 */
export function computeBraceletLayout(canvas, state, opts = {}) {
    const W = canvas.clientWidth || canvas.width;
    const H = canvas.clientHeight || canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    const n = state.stones.length;
    if (!n) {
        return { beads: [], cx, cy, ringRadius: 0 };
    }

    const padding = 24;
    const availablePx = Math.min(W, H) / 2 - padding;

    // =============================================================
    // Режим 'ring' — готовое замкнутое изделие. Бусины равномерно
    // по всей окружности; используется в ленте, превью, экспорте.
    // =============================================================
    if (opts.layout === 'ring') {
        let ringRadius;
        let displaySize;
        if (n === 1) {
            // Одна бусина — крупно по центру.
            displaySize = availablePx * 1.4;
            ringRadius = 0;
        } else {
            // Соседние бусины касаются: хорда между центрами = диаметр.
            //   D = 2·R·sin(π/n);  внешний край R + D/2 ≤ availablePx
            //   ⇒ D = availablePx / ( 1/(2·sin(π/n)) + 1/2 )
            const sinHalf = Math.sin(Math.PI / n);
            displaySize = availablePx / (1 / (2 * sinHalf) + 0.5);
            ringRadius = displaySize / (2 * sinHalf);
        }
        displaySize = Math.max(10, displaySize);
        const step = (Math.PI * 2) / n;
        const beads = state.stones.map((stone, idx) => {
            const centerAngle = -Math.PI / 2 + idx * step;
            return {
                index: idx,
                stone,
                x: cx + Math.cos(centerAngle) * ringRadius,
                y: cy + Math.sin(centerAngle) * ringRadius,
                displaySize,
                radius: displaySize / 2,
                startAngle: centerAngle - step / 2,
                centerAngle,
                endAngle: centerAngle + step / 2,
            };
        });
        return { beads, cx, cy, ringRadius };
    }

    // =============================================================
    // Режим 'fill' (по умолчанию) — конструктор. Камни ложатся
    // вплотную по часовой стрелке, занимая дугу = своему размеру.
    // =============================================================
    const circumference = state.length; // мм
    const radiusMm = circumference / (2 * Math.PI);
    const maxStoneMm = Math.max(...state.stones.map(s => s.size));
    const pxPerMm = availablePx / (radiusMm + maxStoneMm / 2 + 2);
    const ringRadius = radiusMm * pxPerMm;

    let currentAngle = -Math.PI / 2; // верхняя точка (12 часов)
    const beads = state.stones.map((stone, idx) => {
        const stoneAngle = (stone.size / circumference) * Math.PI * 2;
        const startAngle = currentAngle;
        const centerAngle = currentAngle + stoneAngle / 2;
        const endAngle = currentAngle + stoneAngle;
        currentAngle = endAngle;

        const displaySize = Math.max(10, stone.size * pxPerMm);
        return {
            index: idx,
            stone,
            x: cx + Math.cos(centerAngle) * ringRadius,
            y: cy + Math.sin(centerAngle) * ringRadius,
            displaySize,
            radius: displaySize / 2,
            startAngle,
            centerAngle,
            endAngle,
        };
    });

    return { beads, cx, cy, ringRadius };
}

// =================================================================
// ОТРИСОВКА БРАСЛЕТА
// =================================================================

/** Акцентный (золотой) цвет из CSS-переменной — для подсветки выбора. */
function readAccent() {
    try {
        const v = getComputedStyle(document.documentElement)
            .getPropertyValue('--accent').trim();
        return v || '#D9B879';
    } catch (_) {
        return '#D9B879';
    }
}

/** Нарисовать одну бусину (тень + текстура). */
function drawBead(ctx, bead, x, y, displaySize, lifted) {
    ctx.save();
    ctx.shadowColor = lifted ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = lifted ? Math.max(14, displaySize * 0.5) : Math.max(6, displaySize * 0.28);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = lifted ? Math.max(6, displaySize * 0.18) : Math.max(2, displaySize * 0.08);
    ctx.fillStyle = 'rgba(0,0,0,0.001)';
    ctx.beginPath();
    ctx.arc(x, y, displaySize / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const texture = generateStoneTexture(bead.stone.stone, displaySize, bead.index);
    ctx.drawImage(
        texture,
        x - displaySize / 2,
        y - displaySize / 2,
        displaySize,
        displaySize,
    );
}

/** Нарисовать золотое кольцо-подсветку вокруг выделенной бусины. */
function drawSelection(ctx, x, y, displaySize, accent) {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, displaySize / 2 + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

/**
 * Нарисовать браслет на canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object}   state              состояние браслета
 * @param {Object}   [opts]
 * @param {Boolean}  [opts.showGuide]   рисовать ли направляющую окружность
 * @param {'fill'|'ring'} [opts.layout]  режим раскладки (см. computeBraceletLayout)
 * @param {Number}   [opts.selectedIndex] индекс выделенной бусины
 * @param {Object}   [opts.drag]        { index, x, y } — бусина рисуется у курсора
 */
export function renderBracelet(canvas, state, opts = {}) {
    const ctx = canvas.getContext('2d');

    // Работаем в CSS-пикселях с учётом retina-масштаба canvas.
    const cssW = canvas.clientWidth || canvas.width;
    const cssH = canvas.clientHeight || canvas.height;
    ctx.setTransform(canvas.width / cssW, 0, 0, canvas.height / cssH, 0, 0);

    const W = cssW;
    const H = cssH;

    // --- Фон: радиальное свечение, цвет зависит от темы ---
    ctx.clearRect(0, 0, W, H);
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    if (isLight) {
        bg.addColorStop(0, '#F4EAD0');
        bg.addColorStop(0.6, '#ECDFC0');
        bg.addColorStop(1, '#E2D2A8');
    } else {
        bg.addColorStop(0, '#15131A');
        bg.addColorStop(0.6, '#0B0A10');
        bg.addColorStop(1, '#06060A');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // --- Пустой браслет — подсказка ---
    if (!state.stones.length) {
        ctx.fillStyle = 'rgba(217, 184, 121, 0.55)';
        ctx.font = 'italic 18px "Fraunces", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('добавьте камни, чтобы увидеть браслет', W / 2, H / 2);
        return;
    }

    const layout = computeBraceletLayout(canvas, state, opts);

    // --- Направляющая "нитка" — пунктирная окружность ---
    if (opts.showGuide !== false && layout.ringRadius > 0) {
        ctx.save();
        ctx.strokeStyle = isLight
            ? 'rgba(60, 50, 30, 0.18)'
            : 'rgba(232, 228, 221, 0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.arc(layout.cx, layout.cy, layout.ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    const accent = readAccent();
    const dragIndex = (opts.drag && typeof opts.drag.index === 'number') ? opts.drag.index : -1;
    const selectedIndex = (typeof opts.selectedIndex === 'number') ? opts.selectedIndex : -1;

    // --- Обычные бусины на своих местах ---
    for (const bead of layout.beads) {
        if (bead.index === dragIndex) continue; // её рисуем у курсора
        drawBead(ctx, bead, bead.x, bead.y, bead.displaySize, false);
    }

    // --- Подсветка выделенной (но не перетаскиваемой) бусины ---
    if (selectedIndex >= 0 && selectedIndex !== dragIndex) {
        const b = layout.beads[selectedIndex];
        if (b) drawSelection(ctx, b.x, b.y, b.displaySize, accent);
    }

    // --- Перетаскиваемая бусина — поверх всех, у курсора, приподнята ---
    if (dragIndex >= 0) {
        const b = layout.beads[dragIndex];
        if (b) {
            const lifted = b.displaySize * 1.12;
            drawBead(ctx, b, opts.drag.x, opts.drag.y, lifted, true);
            drawSelection(ctx, opts.drag.x, opts.drag.y, lifted, accent);
        }
    }
}

// =================================================================
// СЕРИАЛИЗАЦИЯ
// =================================================================

/** Превратить состояние в JSON-совместимый объект. */
export function serializeBracelet(state) {
    return {
        version: 1,
        length_mm: state.length,
        length_cm: +(state.length / 10).toFixed(1),
        stones_count: state.stones.length,
        total_stones_length_mm: totalStoneLength(state.stones),
        stones: state.stones.map((s, idx) => ({
            position: idx + 1,
            id: s.stoneId,
            name: s.stone.name,
            size_mm: s.size,
            color: s.stone.color,
            texture: s.stone.texture,
        })),
        generated_at: new Date().toISOString(),
    };
}
