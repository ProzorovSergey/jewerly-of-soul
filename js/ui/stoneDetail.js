/**
 * stoneDetail.js
 * ----------------------------------------------------------------
 * Модалка детального просмотра одного камня. Содержит:
 *  - большой рендер (canvas через stoneGenerator);
 *  - имя, стихию, цвет, размеры, redkost;
 *  - чипы энергии и (если есть) описание;
 *  - сердечко-избранное;
 *  - кнопку «Добавить в конструктор».
 *
 * Использование:
 *   import { openStoneDetail } from '../ui/stoneDetail.js';
 *   openStoneDetail(stone);
 */

import { openModal } from './modal.js';
import { generateStoneTexture, onAlbedoReady } from '../core/stoneGenerator.js';
import * as favs from '../services/favoritesService.js';
import { toast } from './toast.js';

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
}

export async function openStoneDetail(stone) {
    if (!stone) return;

    const isRare = (stone.rarity || 'common') === 'rare';
    const initiallyFav = await favs.isFavorite(stone.id);

    const energyHtml = (stone.energy || [])
        .map(e => `<span class="stone-detail__energy">${escapeHtml(e)}</span>`)
        .join('');

    const sizesHtml = (stone.sizes || []).length
        ? `<div class="stone-detail__row">
               <span class="stone-detail__row-label">Размеры</span>
               <span class="stone-detail__row-value">${(stone.sizes || []).join(' · ')} мм</span>
           </div>`
        : '';

    const descHtml = stone.description
        ? `<p class="stone-detail__desc">${escapeHtml(stone.description)}</p>`
        : '';

    const body = `
        <div class="stone-detail${isRare ? ' is-rare' : ''}">
            <div class="stone-detail__visual">
                <canvas id="stoneDetailCanvas" width="320" height="320"></canvas>
                ${isRare ? '<span class="rare-badge">rare</span>' : ''}
                <button type="button" class="stone-detail__heart${initiallyFav ? ' is-active' : ''}"
                        id="stoneDetailHeart"
                        aria-label="${initiallyFav ? 'убрать из избранного' : 'в избранное'}"
                        aria-pressed="${initiallyFav}">
                    <svg viewBox="0 0 24 24" fill="${initiallyFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                </button>
            </div>

            <div class="stone-detail__info">
                <h2 class="stone-detail__name">${escapeHtml(stone.name)}</h2>

                <div class="stone-detail__meta">
                    <span class="element-tag" data-el="${escapeHtml(stone.element || '')}">${escapeHtml(stone.element || '')}</span>
                    <span class="stone-detail__color">${escapeHtml(stone.color_category || '')}</span>
                </div>

                ${descHtml}

                ${energyHtml ? `<div class="stone-detail__energies">${energyHtml}</div>` : ''}

                ${sizesHtml}
            </div>
        </div>
    `;

    const m = openModal({
        title: '',
        body,
        className: 'modal--stone-detail',
        buttons: [
            { label: 'Закрыть',                 kind: 'ghost',   onClick: ({ close }) => close() },
            { label: 'Добавить в конструктор',  kind: 'primary', onClick: ({ close }) => {
                close();
                // Передаём камень в конструктор через query-параметр.
                // constructor.js может это прочитать и добавить бусину.
                location.href = `constructor.html?stone=${encodeURIComponent(stone.id)}`;
            }},
        ],
    });

    // ---- Отрисовка камня на canvas ----
    const c = m.root.querySelector('#stoneDetailCanvas');
    if (c) {
        const draw = () => {
            const dpr = window.devicePixelRatio || 1;
            const w = c.clientWidth || 320;
            c.width = w * dpr; c.height = w * dpr;
            const ctx = c.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, w);
            const tex = generateStoneTexture(stone, w * 0.92, 0);
            ctx.drawImage(tex, w * 0.04, w * 0.04, w * 0.92, w * 0.92);
        };
        draw();
        // Когда подгрузится PNG-альбедо — перерисовать
        onAlbedoReady(stone.id, draw);
    }

    // ---- Сердечко ----
    const heart = m.root.querySelector('#stoneDetailHeart');
    if (heart) {
        heart.addEventListener('click', async () => {
            const added = await favs.toggle(stone.id);
            heart.classList.toggle('is-active', added);
            heart.setAttribute('aria-pressed', String(added));
            heart.setAttribute('aria-label', added ? 'убрать из избранного' : 'в избранное');
            const svgPath = heart.querySelector('svg');
            if (svgPath) svgPath.setAttribute('fill', added ? 'currentColor' : 'none');
            (added ? toast.success : toast.info)(added ? `${stone.name} — в избранном` : `${stone.name} убран из избранного`);
        });
    }
}
