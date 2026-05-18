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
 * Размещение:
 *   - каждый камень занимает дугу длиной = его диаметр,
 *   - сумма диаметров не должна превышать длины браслета,
 *   - визуально оставшееся расстояние распределяется как
 *     "нитка" между камнями.
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

// =================================================================
// ОТРИСОВКА БРАСЛЕТА
// =================================================================

/**
 * Нарисовать браслет на canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object}   state            состояние браслета
 * @param {Number}   state.length     длина в мм
 * @param {Array}    state.stones     массив камней
 * @param {Object}   [opts]
 * @param {Boolean}  [opts.showGuide] рисовать ли направляющую окружность
 */
export function renderBracelet(canvas, state, opts = {}) {
    const ctx = canvas.getContext('2d');

    // Работаем в CSS-пикселях. Если canvas увеличен под retina
    // (canvas.width > clientWidth), применяем соответствующий масштаб.
    // clientWidth == 0 означает, что canvas не в DOM (напр., рендерим
    // на оффскрин-canvas в Node для тестов) — тогда используем
    // canvas.width/height напрямую.
    const cssW = canvas.clientWidth || canvas.width;
    const cssH = canvas.clientHeight || canvas.height;
    const scaleX = canvas.width / cssW;
    const scaleY = canvas.height / cssH;
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    const W = cssW;
    const H = cssH;

    // Фон — глубокий тёмный с радиальным «свечением» в центре,
    // как на референсных макетах Jewerly of Soul.
    ctx.clearRect(0, 0, W, H);
    // Цвета фона зависят от текущей темы — берём из CSS-переменной
    // --bg-elev-1, чтобы холст браслета сливался с подиумом карточки
    // в обеих темах. Падение — захардкоженный тёмный.
    const cssBg = (() => {
        try {
            const v = getComputedStyle(document.documentElement).getPropertyValue('--bg-elev-1').trim();
            return v || '#0E0E14';
        } catch { return '#0E0E14'; }
    })();
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

    // Если нет камней — подсказка
    if (!state.stones.length) {
        ctx.fillStyle = 'rgba(217, 184, 121, 0.55)';
        ctx.font = 'italic 18px "Fraunces", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('добавьте камни, чтобы увидеть браслет', W / 2, H / 2);
        return;
    }

    // --- Геометрия ---
    const circumference = state.length; // мм
    const radiusMm = circumference / (2 * Math.PI);
    const maxStoneMm = Math.max(...state.stones.map(s => s.size));
    // Нужно вместить круг + шарики по краям.
    // Доступный радиус в пикселях — половина меньшей стороны минус поля.
    const padding = 24;
    const availablePx = Math.min(W, H) / 2 - padding;
    const pxPerMm = availablePx / (radiusMm + maxStoneMm / 2 + 2);

    const cx = W / 2;
    const cy = H / 2;
    const ringRadius = radiusMm * pxPerMm;

    // --- Направляющая "нитка" — тонкая пунктирная окружность ---
    if (opts.showGuide !== false) {
        ctx.save();
        ctx.strokeStyle = isLight
            ? 'rgba(60, 50, 30, 0.18)'
            : 'rgba(232, 228, 221, 0.08)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // --- Размещение камней ---
    // Каждый камень получает угловую долю = size / circumference * 2π.
    // Промежутки (если есть) уходят равномерно между камнями, чтобы
    // реальный диаметр шарика визуально совпадал с занимаемой дугой.
    const totalStonesMm = totalStoneLength(state.stones);
    const gapMm = Math.max(0, circumference - totalStonesMm);
    const gapPerStone = gapMm / state.stones.length; // размазываем поровну

    let currentAngle = -Math.PI / 2; // начинаем сверху

    state.stones.forEach((stone, idx) => {
        const arcMm = stone.size + gapPerStone;
        const stoneAngle = (arcMm / circumference) * Math.PI * 2;
        const center = currentAngle + stoneAngle / 2;

        const x = cx + Math.cos(center) * ringRadius;
        const y = cy + Math.sin(center) * ringRadius;

        const displaySize = Math.max(10, stone.size * pxPerMm);

        // Мягкая тень под шариком (на тёмном фоне делаем глубже)
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
        ctx.shadowBlur = Math.max(6, displaySize * 0.28);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = Math.max(2, displaySize * 0.08);
        ctx.fillStyle = 'rgba(0,0,0,0.001)';
        ctx.beginPath();
        ctx.arc(x, y, displaySize / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Текстура камня — используем idx как variant, чтобы одинаковые
        // камни в разных позициях немного отличались.
        const texture = generateStoneTexture(stone.stone, displaySize, idx);
        ctx.drawImage(
            texture,
            x - displaySize / 2,
            y - displaySize / 2,
            displaySize,
            displaySize,
        );

        currentAngle += stoneAngle;
    });
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
