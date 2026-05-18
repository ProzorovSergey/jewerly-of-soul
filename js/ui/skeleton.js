/**
 * skeleton.js
 * ----------------------------------------------------------------
 * Лёгкие skeleton-загрузчики. Возвращают HTML-строку, которую
 * можно вставить в .innerHTML вместо реального контента.
 */

export function skeletonCard() {
    return `
        <div class="skeleton-card">
            <div class="skeleton skeleton--circle"></div>
            <div class="skeleton skeleton--line skeleton--line-lg" style="margin-top:14px"></div>
            <div class="skeleton skeleton--line" style="margin-top:8px;width:60%"></div>
        </div>
    `;
}

export function skeletonGrid(n = 6) {
    return Array.from({ length: n }, () => skeletonCard()).join('');
}

export function skeletonLine(width = '100%') {
    return `<div class="skeleton skeleton--line" style="width:${width}"></div>`;
}
