/**
 * profile.js — личный кабинет.
 *  - Хедер с аватаром и именем
 *  - 3 вкладки: мои идеи, избранное, понравились
 *  - Каждая карточка кликабельна → idea.html?id=…
 */

import * as auth from '../services/authService.js';
import * as ideas from '../services/ideaService.js';
import * as orderService from '../services/orderService.js';
import { ideaApi } from '../api/index.js';
import { loadStones } from '../core/database.js';
import { preloadAlbedos } from '../core/stoneGenerator.js';
import { skeletonGrid } from '../ui/skeleton.js';
import { ideaCardHTML, mountIdeaCardCanvases } from '../ui/ideaCard.js';

let catalogue = [];
let currentTab = 'my';

const els = {
    avatar:  document.getElementById('profileAvatar'),
    name:    document.getElementById('profileName'),
    meta:    document.getElementById('profileMeta'),
    grid:    document.getElementById('ideaGrid'),
    empty:   document.getElementById('emptyNote'),
    tabs:    document.querySelectorAll('.profile-tab'),
    cntMy:   document.getElementById('cntMy'),
    cntFav:  document.getElementById('cntFav'),
    cntLiked:document.getElementById('cntLiked'),
    cntOrders:document.getElementById('cntOrders'),
};

async function init() {
    const me = await auth.getCurrentUser();
    if (!me) return; // layout уже перенаправил

    els.avatar.textContent = me.avatar || '✦';
    els.name.textContent   = me.displayName;
    els.meta.innerHTML     = `@${escapeHtml(me.username)} · с ${new Date(me.createdAt).toLocaleDateString('ru-RU')}`;

    // Скелетоны пока загружаем
    els.grid.innerHTML = skeletonGrid(6);

    catalogue = (await loadStones()).stones;
    await preloadAlbedos(catalogue);

    // Счётчики
    const my = await ideas.listMy();
    els.cntMy.textContent = my.length;
    els.cntFav.textContent  = (me.favorites || []).length;
    els.cntLiked.textContent= (me.likes || []).length;

    // Счётчик заявок — отдельным запросом, без падения при ошибке
    if (els.cntOrders) {
        try {
            const myOrders = await orderService.listMine();
            els.cntOrders.textContent = myOrders.length;
        } catch (_) { els.cntOrders.textContent = '0'; }
    }

    els.tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

    // Выйти из аккаунта
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await auth.logout();
            location.href = 'index.html';
        });
    }

    switchTab('my');
}

async function switchTab(tab) {
    currentTab = tab;
    els.tabs.forEach(t => t.classList.toggle('is-active', t.dataset.tab === tab));
    els.empty.classList.add('is-hidden');

    // --- Вкладка «Заявки» — отдельный список, не сетка идей ---
    if (tab === 'orders') {
        els.grid.className = 'admin-list';
        els.grid.innerHTML = '<p class="empty-note">Загрузка заявок…</p>';
        let orders = [];
        try {
            orders = await orderService.listMine();
        } catch (err) {
            els.grid.innerHTML = `<p class="empty-note">Не удалось загрузить заявки: ${escapeHtml(err.message || '')}</p>`;
            return;
        }
        if (!orders.length) {
            els.grid.innerHTML = '';
            els.empty.textContent = 'Вы ещё не оформляли заявок. Соберите браслет в конструкторе и нажмите «Оформить заявку».';
            els.empty.classList.remove('is-hidden');
            return;
        }
        renderOrders(orders);
        return;
    }

    // --- Вкладки с идеями ---
    els.grid.className = 'idea-grid';
    els.grid.innerHTML = skeletonGrid(3);

    let list = [];
    const me = await auth.getCurrentUser();
    if (tab === 'my') {
        list = await ideas.listMy();
    } else if (tab === 'favorites') {
        const all = await ideaApi.list({});
        list = all.filter(i => (me.favorites || []).includes(i.id));
    } else if (tab === 'liked') {
        const all = await ideaApi.list({});
        list = all.filter(i => (me.likes || []).includes(i.id));
    }

    if (!list.length) {
        els.grid.innerHTML = '';
        els.empty.textContent = tab === 'my'
            ? 'Пока нет своих идей. Соберите первую в конструкторе.'
            : tab === 'favorites' ? 'Пока нет избранных.' : 'Пока нет лайков.';
        els.empty.classList.remove('is-hidden');
        return;
    }

    renderIdeas(list);
}

function renderIdeas(list) {
    els.grid.innerHTML = list.map(i => ideaCardHTML(i, { variant: 'profile' })).join('');
    mountIdeaCardCanvases(els.grid, catalogue);
}

// =================================================================
// ЗАЯВКИ ПОЛЬЗОВАТЕЛЯ
// =================================================================

function renderOrders(list) {
    els.grid.innerHTML = list.map(orderCardHTML).join('');
}

function orderCardHTML(o) {
    const comp = groupComposition(o.composition);
    const compHtml = comp.map(c =>
        `<li>${escapeHtml(c.name)}${c.size ? ` · ${c.size} мм` : ''}` +
        `${c.count > 1 ? ` <span class="order-card__mult">× ${c.count}</span>` : ''}</li>`
    ).join('');
    const beads = (o.composition || []).length;
    const statusLabel = orderService.STATUS_LABELS[o.status] || o.status;
    return `
    <article class="order-card">
        <div class="order-card__head">
            <span class="order-card__code">${escapeHtml(o.publicCode || '')}</span>
            <span class="order-card__badge order-card__badge--${escapeHtml(o.status)}">${escapeHtml(statusLabel)}</span>
            <span class="order-card__date">${fmtDate(o.createdAt)}</span>
        </div>
        ${o.braceletLength ? `<div class="order-card__len">Длина ${o.braceletLength / 10} см · ${beads} ${plural(beads, 'бусина', 'бусины', 'бусин')}</div>` : ''}
        <ul class="order-card__composition">${compHtml}</ul>
        ${o.comment ? `<p class="order-card__comment">${escapeHtml(o.comment)}</p>` : ''}
    </article>`;
}

/** Свернуть состав в список вида [{ name, size, count }]. */
function groupComposition(comp) {
    const map = new Map();
    for (const c of comp || []) {
        const name = c.name || c.id || 'камень';
        const key = name + '|' + (c.size || '');
        if (!map.has(key)) map.set(key, { name, size: c.size, count: 0 });
        map.get(key).count++;
    }
    return [...map.values()];
}

function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
}

function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
         + ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
        { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
}

init();
