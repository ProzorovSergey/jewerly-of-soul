/**
 * ideaPreview.js — immersive quick-preview идеи прямо в ленте
 * ----------------------------------------------------------------
 * Клик по карточке в inspiration-ленте открывает модалку с крупным
 * рендером браслета, составом, автором и лайком — без ухода со
 * страницы. Кнопка «Открыть полностью» ведёт на idea.html.
 *
 * Использование:
 *   import { openIdeaPreview } from '../ui/ideaPreview.js';
 *   openIdeaPreview(idea, { author, catalogue, currentUser, onLike });
 */

import { openModal } from './modal.js';
import { renderMini } from './miniBracelet.js';
import { toast } from './toast.js';
import { onAlbedoReady, generateStoneTexture } from '../core/stoneGenerator.js';
import { exportCard } from '../core/exporter.js';

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
}

/**
 * Открыть immersive-превью идеи.
 *
 * @param {Object} idea
 * @param {Object} opts
 * @param {Object} [opts.author]       PublicUser
 * @param {Array}  opts.catalogue      каталог камней (для рендера)
 * @param {Object} [opts.currentUser]  залогиненный user (для liked-состояния)
 * @param {Function} [opts.onLike]     async (ideaId) => { liked, likesCount }
 */
export function openIdeaPreview(idea, opts = {}) {
    if (!idea) return;
    const { author, catalogue = [], currentUser, onLike } = opts;

    const stoneIds = idea.stones.map(s => s.id);
    const size = idea.stones[0]?.size || 8;
    const len  = idea.length || 180;
    const liked = currentUser && (currentUser.likes || []).includes(idea.id);

    // Уникальные камни состава — компактные иконки с количеством
    const counts = {};
    for (const s of idea.stones) counts[s.id] = (counts[s.id] || 0) + 1;
    const uniqueStones = [];
    const seen = new Set();
    for (const s of idea.stones) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        const stone = catalogue.find(x => x.id === s.id);
        if (stone) uniqueStones.push(stone);
    }

    const stonesChipsHtml = uniqueStones.map((st, i) => `
        <span class="idea-preview__stone">
            <canvas data-preview-stone="${st.id}" data-var="${i}" width="26" height="26"></canvas>
            <span>${escapeHtml(st.name)}${counts[st.id] > 1
                ? ` <span style="color:var(--accent);font-weight:600">×${counts[st.id]}</span>` : ''}</span>
        </span>
    `).join('');

    const tagsHtml = (idea.tags || []).slice(0, 5)
        .map(t => `<span class="idea-preview__tag">${escapeHtml(t)}</span>`)
        .join('');

    const body = `
        <div class="idea-preview">
            <div class="idea-preview__visual">
                <canvas id="ideaPreviewCanvas" width="420" height="420"></canvas>
            </div>

            <div class="idea-preview__info">
                <p class="idea-preview__eyebrow">${escapeHtml(idea.mood || 'композиция')}</p>
                <h2 class="idea-preview__title">${escapeHtml(idea.title || 'Без названия')}</h2>

                <div class="idea-preview__author">
                    <span class="avatar">${escapeHtml(author?.avatar || '✦')}</span>
                    <span class="idea-preview__author-name">${escapeHtml(author?.displayName || 'аноним')}</span>
                </div>

                ${idea.description ? `<p class="idea-preview__desc">${escapeHtml(idea.description)}</p>` : ''}

                <div class="idea-preview__meta">
                    <span>${idea.stones.length} камней</span>
                    <span class="idea-preview__meta-dot"></span>
                    <span>${len / 10} см</span>
                </div>

                <div class="idea-preview__stones">${stonesChipsHtml}</div>

                ${tagsHtml ? `<div class="idea-preview__tags">${tagsHtml}</div>` : ''}

                <button type="button" class="idea-preview__like${liked ? ' is-active' : ''}" id="ideaPreviewLike">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    <span id="ideaPreviewLikeCount">${idea.likesCount || 0}</span>
                </button>
            </div>
        </div>
    `;

    const m = openModal({
        title: '',
        body,
        className: 'modal--idea-preview',
        buttons: [
            { label: 'Закрыть',      kind: 'ghost', onClick: ({ close }) => close() },
            { label: 'Скачать фото', kind: 'ghost', onClick: async () => {
                try {
                    await exportCard({
                        length: len,
                        stones: idea.stones.map(s => ({
                            stoneId: s.id,
                            size: s.size,
                            stone: catalogue.find(x => x.id === s.id),
                        })),
                    }, { prefix: 'jewerly-of-soul', title: idea.title || '' });
                    toast.success('Фото браслета сохранено в загрузки');
                } catch (_) {
                    toast.error('Не удалось сохранить фото');
                }
            }},
            { label: 'Открыть полностью', kind: 'primary', onClick: ({ close }) => {
                close();
                location.href = `idea.html?id=${encodeURIComponent(idea.id)}`;
            }},
        ],
    });

    // ---- Рендер большого браслета ----
    const canvas = m.root.querySelector('#ideaPreviewCanvas');
    if (canvas) {
        renderMini(canvas, catalogue, { stoneIds, size, length: len });
    }

    // ---- Иконки камней состава (procedural → PNG) ----
    m.root.querySelectorAll('canvas[data-preview-stone]').forEach(c => {
        const stone = catalogue.find(x => x.id === c.dataset.previewStone);
        if (!stone) return;
        const variant = +c.dataset.var || 0;
        const draw = () => {
            const dpr = window.devicePixelRatio || 1;
            c.width = 26 * dpr; c.height = 26 * dpr;
            const ctx = c.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, 26, 26);
            const tex = generateStoneTexture(stone, 26, variant);
            ctx.drawImage(tex, 0, 0, 26, 26);
        };
        draw();
        onAlbedoReady(stone.id, draw);
    });

    // ---- Лайк ----
    const likeBtn = m.root.querySelector('#ideaPreviewLike');
    if (likeBtn && typeof onLike === 'function') {
        likeBtn.addEventListener('click', async () => {
            try {
                const r = await onLike(idea.id);
                likeBtn.classList.toggle('is-active', r.liked);
                const cnt = m.root.querySelector('#ideaPreviewLikeCount');
                if (cnt) cnt.textContent = r.likesCount;
                const svg = likeBtn.querySelector('svg');
                if (svg) svg.setAttribute('fill', r.liked ? 'currentColor' : 'none');
            } catch (_) { /* onLike сам покажет toast */ }
        });
    }

    return m;
}
