/**
 * ideaCard.js
 * ----------------------------------------------------------------
 * Единый компонент карточки идеи. Используется в:
 *   - inspiration.js (лента сообщества)
 *   - profile.js     (мои идеи / избранное / лайки)
 *   - home.js        (опционально, если когда-то на главной появится лента)
 *
 * Раньше шаблон HTML дублировался в трёх страницах. Теперь — одно
 * место правды, через варианты:
 *
 *   ideaCardHTML(idea, { author, currentUser, variant: 'feed' | 'profile' })
 *
 * variant управляет тем, что выводится в footer карточки.
 *   'feed'    — автор + лайк (для ленты сообщества)
 *   'profile' — бейдж публикации/черновика (для своего профиля)
 *
 * Также экспортируется ideaCardOverlayInfo() — стандартный набор
 * «N камней · X см» в overlay-блоке (минимализм P2.3).
 *
 * @example
 *   import { ideaCardHTML, mountIdeaCardCanvases } from '../ui/ideaCard.js';
 *
 *   container.innerHTML = ideas.map(i =>
 *       ideaCardHTML(i, { author: authors.get(i.authorId), currentUser, variant: 'feed' })
 *   ).join('');
 *   mountIdeaCardCanvases(container, catalogue);
 */

import { renderMini } from './miniBracelet.js';

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
}

/**
 * Тело карточки — overlay + visual + body.
 *
 * @param {Object} idea
 * @param {Object} opts
 * @param {Object} [opts.author]       PublicUser
 * @param {Object} [opts.currentUser]  залогиненный user (для определения liked)
 * @param {'feed'|'profile'} [opts.variant='feed']
 * @returns {string} HTML
 */
export function ideaCardHTML(idea, opts = {}) {
    const { author, currentUser, variant = 'feed' } = opts;
    const liked = currentUser && (currentUser.likes || []).includes(idea.id);

    const overlayInfo = `
        <div class="idea-card__overlay" aria-hidden="true">
            <div class="idea-card__overlay-info">
                <span>${idea.stones.length} камней</span>
                <span>·</span>
                <span>${(idea.length || 180) / 10} см</span>
            </div>
            ${(idea.tags || []).slice(0, 3).length ? `
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                    ${(idea.tags || []).slice(0, 3).map(t => `<span class="feed-card__tag">${escapeHtml(t)}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `;

    const visual = `
        <a class="feed-card__visual-link" href="idea.html?id=${encodeURIComponent(idea.id)}"
           aria-label="${escapeHtml(idea.title)}">
            <div class="idea-card__visual">
                <canvas data-mini-stones="${idea.stones.map(s => s.id).join(',')}"
                        data-size="${idea.stones[0]?.size || 8}"
                        data-length="${idea.length || 180}"></canvas>
                ${overlayInfo}
            </div>
        </a>
    `;

    // Body — варианты
    const titleLink = `
        <a href="idea.html?id=${encodeURIComponent(idea.id)}" style="text-decoration:none;color:inherit">
            <h3 class="idea-card__title">${escapeHtml(idea.title || 'Без названия')}</h3>
        </a>
    `;

    let foot = '';
    if (variant === 'profile') {
        foot = idea.isPublic
            ? `<span class="idea-card__badge">опубликовано · ♥ ${idea.likesCount || 0}</span>`
            : `<span class="idea-card__badge idea-card__badge--draft">черновик</span>`;
    } else {
        // 'feed'
        foot = `
            <div class="feed-card__foot">
                <div class="idea-card__author">
                    <span class="avatar">${escapeHtml(author?.avatar || '✦')}</span>
                    <span>${escapeHtml(author?.displayName || 'аноним')}</span>
                </div>
                <button class="idea-card__like ${liked ? 'is-active' : ''}" data-like="${idea.id}" type="button" aria-label="лайк">
                    <svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    <span>${idea.likesCount || 0}</span>
                </button>
            </div>
        `;
    }

    const body = `
        <div class="idea-card__body">
            ${titleLink}
            ${foot}
        </div>
    `;

    // Для feed-карточки используем тег <article>; для profile — <a> (вся карточка кликабельна).
    if (variant === 'profile') {
        return `
            <a class="idea-card" href="idea.html?id=${encodeURIComponent(idea.id)}" data-tilt data-tilt-max="4">
                ${visual.replace('feed-card__visual-link', 'profile-card__visual-link')}
                ${body}
            </a>
        `;
    }
    return `
        <article class="idea-card feed-card" data-id="${escapeHtml(idea.id)}" data-tilt data-tilt-max="4">
            ${visual}
            ${body}
        </article>
    `;
}

/**
 * После вставки HTML — нужно инициализировать canvas-ы внутри карточек.
 * @param {Element} container  узел, внутри которого искать canvas
 * @param {Array}   catalogue  массив stone-объектов (для renderMini)
 */
export function mountIdeaCardCanvases(container, catalogue) {
    container.querySelectorAll('canvas[data-mini-stones]').forEach(c => {
        const ids = c.dataset.miniStones.split(',').filter(Boolean);
        renderMini(c, catalogue, {
            stoneIds: ids,
            size: +c.dataset.size || 8,
            length: +c.dataset.length || 180,
        });
    });
}
