/**
 * admin.js
 * ----------------------------------------------------------------
 * Панель управления заявками — только для администратора.
 * Доступ на уровне сервера проверяет backend (require_admin):
 * не-админ получит 403, и страница покажет сообщение об отказе.
 */

import * as auth from '../services/authService.js';
import * as orderService from '../services/orderService.js';
import { toast } from '../ui/toast.js';

const $ = id => document.getElementById(id);

const state = { filter: '', orders: [] };

const els = {
    summary: $('adminSummary'),
    filters: $('adminFilters'),
    list:    $('adminList'),
};

const METHOD_LABELS = {
    telegram: 'Telegram', phone: 'Телефон', whatsapp: 'WhatsApp',
    vk: 'ВКонтакте', email: 'E-mail', other: 'Контакт',
};

// =================================================================
// УТИЛИТЫ
// =================================================================

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
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

// =================================================================
// ЗАГРУЗКА И ОТРИСОВКА
// =================================================================

async function load() {
    els.list.innerHTML = '<p class="admin-empty">Загрузка…</p>';
    try {
        state.orders = await orderService.listAll(state.filter || undefined);
    } catch (err) {
        if (err.status === 403) {
            els.summary.textContent = '';
            els.list.innerHTML = '<p class="admin-empty">Доступ к заявкам есть только у администратора.</p>';
            return;
        }
        els.list.innerHTML = `<p class="admin-empty">Не удалось загрузить заявки: ${escapeHtml(err.message || '')}</p>`;
        return;
    }
    render();
}

function render() {
    const orders = state.orders;
    els.summary.textContent = orders.length
        ? `${orders.length} ${plural(orders.length, 'заявка', 'заявки', 'заявок')}`
        : 'Заявок пока нет';

    if (!orders.length) {
        els.list.innerHTML = '<p class="admin-empty">В этой категории заявок нет.</p>';
        return;
    }

    els.list.innerHTML = orders.map(o => {
        const comp = groupComposition(o.composition);
        const compHtml = comp.map(c =>
            `<li>${escapeHtml(c.name)}${c.size ? ` · ${c.size} мм` : ''}` +
            `${c.count > 1 ? ` <span class="order-card__mult">× ${c.count}</span>` : ''}</li>`
        ).join('');

        const statusOpts = orderService.STATUS_ORDER.map(s =>
            `<option value="${s}"${s === o.status ? ' selected' : ''}>${orderService.STATUS_LABELS[s]}</option>`
        ).join('');

        const beadsCount = (o.composition || []).length;

        return `
        <article class="order-card" data-id="${escapeHtml(o.id)}">
            <div class="order-card__head">
                <span class="order-card__code">${escapeHtml(o.publicCode || '')}</span>
                <span class="order-card__badge order-card__badge--${escapeHtml(o.status)}">${escapeHtml(orderService.STATUS_LABELS[o.status] || o.status)}</span>
                <span class="order-card__date">${fmtDate(o.createdAt)}</span>
            </div>
            <div class="order-card__contact">
                <strong>${escapeHtml(o.contactName || '—')}</strong>
                <span>${escapeHtml(METHOD_LABELS[o.contactMethod] || 'Контакт')}: ${escapeHtml(o.contactValue || '')}</span>
            </div>
            ${o.braceletLength ? `<div class="order-card__len">Длина ${o.braceletLength / 10} см · ${beadsCount} ${plural(beadsCount, 'бусина', 'бусины', 'бусин')}</div>` : ''}
            <ul class="order-card__composition">${compHtml}</ul>
            ${o.comment ? `<p class="order-card__comment">${escapeHtml(o.comment)}</p>` : ''}
            <div class="order-card__admin">
                <select class="field" data-status aria-label="статус заявки">${statusOpts}</select>
                <textarea class="field" data-note placeholder="Заметка по заказу (видна только вам)">${escapeHtml(o.adminNote || '')}</textarea>
                <button class="btn btn--primary btn--sm" data-save type="button">Сохранить</button>
            </div>
        </article>`;
    }).join('');

    els.list.querySelectorAll('[data-save]').forEach(btn => {
        btn.addEventListener('click', () => saveCard(btn.closest('.order-card')));
    });
}

async function saveCard(card) {
    if (!card) return;
    const id = card.dataset.id;
    const status = card.querySelector('[data-status]').value;
    const note = card.querySelector('[data-note]').value.trim();
    const btn = card.querySelector('[data-save]');

    btn.disabled = true;
    btn.textContent = 'Сохраняю…';
    try {
        await orderService.setStatus(id, status, note);
        toast.success('Заявка обновлена');

        const o = state.orders.find(x => x.id === id);
        if (o) { o.status = status; o.adminNote = note; }

        // При активном фильтре, если заявка ему больше не соответствует —
        // проще перезагрузить список.
        if (state.filter && state.filter !== status) {
            load();
            return;
        }
        const badge = card.querySelector('.order-card__badge');
        badge.className = 'order-card__badge order-card__badge--' + status;
        badge.textContent = orderService.STATUS_LABELS[status] || status;
    } catch (err) {
        toast.error(err.message || 'Не удалось сохранить');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Сохранить';
    }
}

// =================================================================
// ИНИТ
// =================================================================

function setupFilters() {
    els.filters.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        els.filters.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        state.filter = chip.dataset.status || '';
        load();
    });
}

async function init() {
    let me = null;
    try { me = await auth.getCurrentUser(); } catch (_) { me = null; }
    if (!me) {
        location.replace('login.html?return=admin.html');
        return;
    }
    setupFilters();
    load();
}

init();
