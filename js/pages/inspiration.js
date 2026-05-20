/**
 * inspiration.js — лента «Сообщество».
 *  - Карточки идей со всех публикаций
 *  - Поиск, сортировка, фильтр по настроению
 *  - Кнопка-лайк прямо в карточке
 *  - Клик по карточке → idea.html?id=…
 */

import * as auth from '../services/authService.js';
import * as ideas from '../services/ideaService.js';
import * as users from '../services/userService.js';
import { loadStones } from '../core/database.js';
import { preloadAlbedos } from '../core/stoneGenerator.js';
import { toast } from '../ui/toast.js';
import { skeletonGrid } from '../ui/skeleton.js';
import { ideaCardHTML, mountIdeaCardCanvases } from '../ui/ideaCard.js';
import { openIdeaPreview } from '../ui/ideaPreview.js';
import { stagger } from '../ui/motion.js';

const state = {
    catalogue: [],
    feed: [],
    authors: new Map(),
    me: null,
    sort: 'popular',
    mood: 'all',
    search: '',
};

const els = {
    grid:    document.getElementById('feedGrid'),
    empty:   document.getElementById('emptyNote'),
    search:  document.getElementById('feedSearch'),
    sortRow: document.querySelector('.feed-controls__sort'),
    moodRow: document.getElementById('moodFilters'),
};

async function init() {
    els.grid.innerHTML = skeletonGrid(6);

    state.catalogue = (await loadStones()).stones;
    preloadAlbedos(state.catalogue);   // фоновая, не блокирует

    state.me = await auth.getCurrentUser();
    auth.onAuthChange(u => { state.me = u; render(); });

    // Все авторы в одну мапу
    const allUsers = await users.listAll();
    for (const u of allUsers) state.authors.set(u.id, u);

    bindFilters();
    await reload();
}

function bindFilters() {
    els.search.addEventListener('input', () => {
        state.search = els.search.value.trim();
        reload();
    });
    els.sortRow.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        els.sortRow.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        state.sort = chip.dataset.sort;
        reload();
    });
    els.moodRow.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        els.moodRow.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        state.mood = chip.dataset.mood;
        reload();
    });
}

async function reload() {
    const filter = { sort: state.sort };
    if (state.mood !== 'all') filter.mood = state.mood;
    if (state.search) filter.search = state.search;

    // Плавная смена ленты: гасим текущую сетку, ждём fade, грузим, рендерим
    const hadContent = els.grid.children.length > 0;
    if (hadContent) els.grid.classList.add('is-swapping');

    state.feed = await ideas.listFeed(filter);

    // Минимальная пауза для завершения fade-out (если был контент)
    if (hadContent) await new Promise(r => setTimeout(r, 160));

    render();
    els.grid.classList.remove('is-swapping');
}

/** Общий toggle-like — используется и в карточке, и в preview-модалке. */
async function handleLike(ideaId) {
    if (!state.me) {
        toast.info('Войдите, чтобы лайкнуть');
        throw new Error('not authenticated');
    }
    const r = await ideas.toggleLike(ideaId);
    // Синхронизируем локальный state.me.likes
    state.me.likes = state.me.likes || [];
    if (r.liked && !state.me.likes.includes(ideaId)) state.me.likes.push(ideaId);
    if (!r.liked) state.me.likes = state.me.likes.filter(x => x !== ideaId);
    // Обновляем счётчик в state.feed (чтобы preview/карточки были согласованы)
    const fi = state.feed.find(i => i.id === ideaId);
    if (fi) fi.likesCount = r.likesCount;
    return r;
}

function render() {
    if (!state.feed.length) {
        els.grid.innerHTML = '';
        els.empty.classList.remove('is-hidden');
        return;
    }
    els.empty.classList.add('is-hidden');

    els.grid.innerHTML = state.feed.map((idea, idx) => {
        const html = ideaCardHTML(idea, {
            author: state.authors.get(idea.authorId),
            currentUser: state.me,
            variant: 'feed',
        });
        // Первая карточка — editorial-featured (крупнее на широких экранах)
        if (idx === 0) {
            return html.replace('class="idea-card feed-card"', 'class="idea-card feed-card feed-card--featured"');
        }
        return html;
    }).join('');

    mountIdeaCardCanvases(els.grid, state.catalogue);

    // Staggered появление карточек.
    // Вариант 'fade' (opacity-only) — НЕ трогает transform, чтобы
    // не конфликтовать с tilt-эффектом (он анимирует transform
    // через CSS-переменные).
    stagger(els.grid.querySelectorAll('.feed-card'), {
        variant: 'fade',
        gap: 50,
    });

    // Клик по карточке (не по лайку и не по прямой ссылке с Ctrl) → preview-модалка
    els.grid.querySelectorAll('.feed-card').forEach(card => {
        const id = card.dataset.id;
        if (!id) return;
        card.addEventListener('click', e => {
            // Пропускаем клики по лайку и спец-клики (новая вкладка)
            if (e.target.closest('[data-like]')) return;
            if (e.metaKey || e.ctrlKey || e.button === 1) return;
            e.preventDefault();
            const idea = state.feed.find(i => i.id === id);
            if (!idea) return;
            openIdeaPreview(idea, {
                author: state.authors.get(idea.authorId),
                catalogue: state.catalogue,
                currentUser: state.me,
                onLike: handleLike,
            });
        });
    });

    // Лайки прямо в карточке
    els.grid.querySelectorAll('button[data-like]').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const r = await handleLike(btn.dataset.like);
                btn.classList.toggle('is-active', r.liked);
                btn.querySelector('span').textContent = r.likesCount;
                const path = btn.querySelector('path');
                if (path) path.setAttribute('fill', r.liked ? 'currentColor' : 'none');
            } catch (err) {
                if (err.message !== 'not authenticated') toast.error(err.message);
            }
        });
    });
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
}

init();
