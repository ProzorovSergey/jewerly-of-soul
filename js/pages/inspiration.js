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
    state.feed = await ideas.listFeed(filter);
    render();
}

function render() {
    if (!state.feed.length) {
        els.grid.innerHTML = '';
        els.empty.classList.remove('is-hidden');
        return;
    }
    els.empty.classList.add('is-hidden');

    els.grid.innerHTML = state.feed.map(idea => ideaCardHTML(idea, {
        author: state.authors.get(idea.authorId),
        currentUser: state.me,
        variant: 'feed',
    })).join('');

    mountIdeaCardCanvases(els.grid, state.catalogue);

    // Лайки
    els.grid.querySelectorAll('button[data-like]').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.preventDefault();
            e.stopPropagation();
            if (!state.me) {
                toast.info('Войдите, чтобы лайкнуть');
                return;
            }
            try {
                const r = await ideas.toggleLike(btn.dataset.like);
                btn.classList.toggle('is-active', r.liked);
                btn.querySelector('span').textContent = r.likesCount;
                const path = btn.querySelector('path');
                path.setAttribute('fill', r.liked ? 'currentColor' : 'none');
                // Обновим в state, чтобы при ре-рендере не сбрасывалось
                if (state.me) {
                    state.me.likes = state.me.likes || [];
                    if (r.liked && !state.me.likes.includes(btn.dataset.like)) state.me.likes.push(btn.dataset.like);
                    if (!r.liked) state.me.likes = state.me.likes.filter(x => x !== btn.dataset.like);
                }
            } catch (err) { toast.error(err.message); }
        });
    });
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
}

init();
