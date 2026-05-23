/**
 * constructor.js
 * ----------------------------------------------------------------
 * Полная логика страницы "Конструктор".
 * Связывает базу, генератор текстур, геометрию браслета и DOM.
 */

import { loadStones, findStone } from '../core/database.js';
import { generateStoneTexture, preloadAlbedos, onAlbedoReady } from '../core/stoneGenerator.js';
import {
    renderBracelet,
    computeBraceletLayout,
    canAddStone,
    totalStoneLength,
} from '../core/bracelet.js';
import { exportPNG, exportCard } from '../core/exporter.js';
import * as auth from '../services/authService.js';
import * as ideas from '../services/ideaService.js';
import * as orderService from '../services/orderService.js';
import * as ai from '../services/aiService.js';
import { toast } from '../ui/toast.js';
import { openModal } from '../ui/modal.js';

// =================================================================
// СОСТОЯНИЕ
// =================================================================

const state = {
    catalogue: [],
    selectedStoneId: null,
    selectedSize: 8,
    elementFilter: 'all',
    colorFilter:   'all',
    rarityFilter:  'all',
    search: '',
    bracelet: {
        length: 160,            // 16 см = 160 мм
        stones: [],
    },
    history: [],
    selectedIndex: null,        // выделенная бусина на браслете
    drag: null,                 // { stone, x, y, moved } во время перетаскивания
};

const HISTORY_LIMIT = 40;

function pushHistory() {
    state.history.push({
        length: state.bracelet.length,
        stones: state.bracelet.stones.map(s => ({ ...s })),
    });
    if (state.history.length > HISTORY_LIMIT) state.history.shift();
}

function undo() {
    const snap = state.history.pop();
    if (!snap) return;
    state.bracelet = snap;
    state.selectedIndex = null;
    syncLengthUI();
    renderSequence();
    renderEnergy();
    redraw();
}

// =================================================================
// DOM
// =================================================================

const $ = id => document.getElementById(id);
const els = {
    palette:        $('palette'),
    paletteSearch:  $('paletteSearch'),
    elementFilters: $('elementFilters'),
    colorFilters:   $('colorFilters'),
    rarityFilters:  $('rarityFilters'),
    lengthChips:    $('lengthChips'),
    lengthValue:    $('lengthValue'),
    sizeChips:      $('sizeChips'),
    canvas:         $('braceletCanvas'),
    metaCount:      $('metaCount'),
    metaFill:       $('metaFill'),
    metaSize:       $('metaSize'),
    metaLength:     $('metaLength'),
    sequenceList:   $('sequenceList'),
    seqEmpty:       $('seqEmpty'),
    energyTags:     $('energyTags'),
    energyHint:     $('energyHint'),
    undoBtn:        $('undoBtn'),
    clearBtn:       $('clearBtn'),
    randomBtn:      $('randomBtn'),
    sendBtn:        $('sendBtn'),
    downloadBtn:    $('downloadBtn'),
    saveBtn:        $('saveBtn'),
    aiBtn:          $('aiBtn'),
    aiResult:       $('aiResult'),
};

// =================================================================
// ИНИТ
// =================================================================

async function init() {
    try {
        const data = await loadStones();
        state.catalogue = data.stones;
    } catch (err) {
        console.error('Не удалось загрузить базу камней:', err);
        return;
    }

    preloadAlbedos(state.catalogue);   // фоновая, не блокирует

    resizeCanvasForRetina();
    window.addEventListener('resize', () => { resizeCanvasForRetina(); redraw(); });

    setupPalette();
    setupFilters();
    setupLengthChips();
    setupSizeChips();
    setupSearch();
    setupActions();
    setupShortcuts();
    setupCanvasInteraction();

    syncLengthUI();
    renderPalette();
    renderSequence();
    renderEnergy();
    redraw();

    // Если пришли с каталога с ?stone=ID — добавляем камень и подсвечиваем
    applyUrlStone();
}

function applyUrlStone() {
    const params = new URLSearchParams(location.search);
    const stoneId = params.get('stone');
    if (!stoneId) return;
    const stone = findStone(state.catalogue, stoneId);
    if (!stone) return;

    state.selectedStoneId = stoneId;
    renderPalette();   // перерисовать, чтобы появился класс is-active на чипе
    addStone(stoneId, state.selectedSize);
    toast.success(`${stone.name} добавлен в браслет`);

    // Чистим query — чтобы при ручном reload не дублировалось
    try {
        const url = new URL(location.href);
        url.searchParams.delete('stone');
        history.replaceState({}, '', url);
    } catch (_) { /* noop */ }

    // Скроллим к выбранному чипу в палитре
    requestAnimationFrame(() => {
        const node = document.querySelector(`.stone-chip[data-stone-id="${stoneId}"]`);
        if (node) node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}

// =================================================================
// CANVAS
// =================================================================

function resizeCanvasForRetina() {
    const c = els.canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth || 700;
    const h = c.clientHeight || 700;
    c.width = w * dpr;
    c.height = h * dpr;
}

function redraw() {
    const opts = { showGuide: true };
    if (state.selectedIndex != null) opts.selectedIndex = state.selectedIndex;
    if (state.drag) {
        const di = state.bracelet.stones.indexOf(state.drag.stone);
        if (di >= 0) opts.drag = { index: di, x: state.drag.x, y: state.drag.y };
    }
    renderBracelet(els.canvas, state.bracelet, opts);
    updateMeta();
    updateButtons();
}

function updateMeta() {
    const stones = state.bracelet.stones;
    const filled = totalStoneLength(stones);
    const fillPct = Math.round((filled / state.bracelet.length) * 100);
    els.metaCount.textContent = `${stones.length} / ${maxStonesAtCurrentSize()}`;
    els.metaFill.textContent = `${fillPct}%`;
    els.metaFill.classList.toggle('has-warn', fillPct > 95);
    els.metaSize.textContent = `${state.selectedSize} мм`;
    els.metaLength.textContent = `${state.bracelet.length / 10} см`;
}

function maxStonesAtCurrentSize() {
    return Math.floor(state.bracelet.length / state.selectedSize);
}

function updateButtons() {
    const hasStones = state.bracelet.stones.length > 0;
    els.sendBtn.disabled = !hasStones;
    els.downloadBtn.disabled = !hasStones;
    els.undoBtn.disabled = state.history.length === 0;
    if (els.saveBtn) els.saveBtn.disabled = !hasStones;
    if (els.aiBtn)   els.aiBtn.disabled   = !hasStones;
}

// =================================================================
// ПАЛИТРА
// =================================================================

function setupPalette() {
    els.palette.addEventListener('click', e => {
        const chip = e.target.closest('.stone-chip');
        if (!chip) return;
        state.selectedStoneId = chip.dataset.stoneId;
        // Сразу добавляем камень (одно касание = одна бусина)
        addStone(state.selectedStoneId, state.selectedSize);
        renderPalette();
    });
}

function setupFilters() {
    bindChipFilter(els.elementFilters, 'el',     v => state.elementFilter = v);
    bindChipFilter(els.colorFilters,   'color',  v => state.colorFilter   = v);
    bindChipFilter(els.rarityFilters,  'rarity', v => state.rarityFilter  = v);
}

function bindChipFilter(container, dsKey, applyFn) {
    if (!container) return;
    container.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        container.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        applyFn(chip.dataset[dsKey] || 'all');
        renderPalette();
    });
}

function setupSearch() {
    els.paletteSearch.addEventListener('input', () => {
        state.search = els.paletteSearch.value.trim().toLowerCase();
        renderPalette();
    });
}

function filterCatalogue() {
    return state.catalogue.filter(s => {
        if (state.elementFilter !== 'all' && s.element !== state.elementFilter) return false;
        if (state.colorFilter   !== 'all' && s.color_category !== state.colorFilter) return false;
        if (state.rarityFilter  !== 'all' && (s.rarity || 'common') !== state.rarityFilter) return false;
        if (state.search) {
            const hay = (s.name + ' ' + s.element + ' ' + s.color_category + ' '
                       + (s.energy || []).join(' ')).toLowerCase();
            if (!hay.includes(state.search)) return false;
        }
        return true;
    });
}

function renderPalette() {
    const stones = filterCatalogue();
    els.palette.innerHTML = stones.map(s => `
        <button class="stone-chip${state.selectedStoneId === s.id ? ' is-active' : ''}${s.rarity === 'rare' ? ' is-rare' : ''}"
                data-stone-id="${s.id}" title="${s.name} · ${s.element}${s.rarity === 'rare' ? ' · редкий' : ''}">
            <canvas data-stone-thumb="${s.id}" width="44" height="44"></canvas>
            <span class="stone-chip__name">${s.name}</span>
            ${s.rarity === 'rare' ? '<span class="stone-chip__rare" aria-label="редкий"></span>' : ''}
        </button>
    `).join('');

    // Рисуем превью камней + подписываемся на PNG-альбедо для перерисовки
    els.palette.querySelectorAll('canvas[data-stone-thumb]').forEach(c => {
        const id = c.dataset.stoneThumb;
        const stone = findStone(state.catalogue, id);
        if (!stone) return;
        const drawThumb = () => {
            const dpr = window.devicePixelRatio || 1;
            c.width = 44 * dpr; c.height = 44 * dpr;
            const ctx = c.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, 44, 44);
            const tex = generateStoneTexture(stone, 44, 0);
            ctx.drawImage(tex, 0, 0, 44, 44);
        };
        drawThumb();
        onAlbedoReady(id, drawThumb);
    });
}

// =================================================================
// ДЛИНА И РАЗМЕР
// =================================================================

function setupLengthChips() {
    els.lengthChips.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        const cm = +chip.dataset.len;
        if (!cm) return;
        pushHistory();
        state.bracelet.length = cm * 10;
        // Если новая длина меньше — обрезаем камни до возможной
        let total = totalStoneLength(state.bracelet.stones);
        while (total > state.bracelet.length && state.bracelet.stones.length) {
            const removed = state.bracelet.stones.pop();
            total -= removed.size;
        }
        syncLengthUI();
        renderSequence();
        renderEnergy();
        redraw();
    });
}

function syncLengthUI() {
    const cm = state.bracelet.length / 10;
    els.lengthValue.textContent = `${cm} см`;
    els.lengthChips.querySelectorAll('.chip').forEach(c => {
        c.classList.toggle('is-active', +c.dataset.len === cm);
    });
}

function setupSizeChips() {
    els.sizeChips.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        const size = +chip.dataset.size;
        if (!size) return;
        state.selectedSize = size;
        els.sizeChips.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        updateMeta();
    });
}

// =================================================================
// УПРАВЛЕНИЕ СОСТАВОМ
// =================================================================

function addStone(stoneId, size) {
    if (!canAddStone(state.bracelet.stones, state.bracelet.length, size)) {
        flashOverflow();
        return;
    }
    const stone = findStone(state.catalogue, stoneId);
    if (!stone) return;
    pushHistory();
    state.bracelet.stones.push({ stoneId, size, stone });
    renderSequence();
    renderEnergy();
    redraw();
}

function removeStone(index) {
    if (index < 0 || index >= state.bracelet.stones.length) return;
    pushHistory();
    state.bracelet.stones.splice(index, 1);
    state.selectedIndex = null;
    renderSequence();
    renderEnergy();
    redraw();
}

function clearAll() {
    if (!state.bracelet.stones.length) return;
    pushHistory();
    state.bracelet.stones = [];
    state.selectedIndex = null;
    renderSequence();
    renderEnergy();
    redraw();
}

function randomFill() {
    pushHistory();
    state.bracelet.stones = [];
    state.selectedIndex = null;
    const max = maxStonesAtCurrentSize();
    const pool = state.catalogue;
    for (let i = 0; i < max; i++) {
        const s = pool[Math.floor(Math.random() * pool.length)];
        state.bracelet.stones.push({ stoneId: s.id, size: state.selectedSize, stone: s });
    }
    renderSequence();
    renderEnergy();
    redraw();
}

function flashOverflow() {
    els.metaFill.classList.add('has-warn');
    setTimeout(() => updateMeta(), 600);
}

// =================================================================
// СПИСОК СОСТАВА
// =================================================================

function renderSequence() {
    const stones = state.bracelet.stones;
    if (!stones.length) {
        els.sequenceList.innerHTML = '<li class="sequence__empty">Пусто. Добавьте первый камень слева.</li>';
        return;
    }
    els.sequenceList.innerHTML = stones.map((s, idx) => `
        <li class="sequence__item">
            <div class="sequence__visual"><canvas data-seq-thumb="${idx}" width="28" height="28"></canvas></div>
            <div class="sequence__body">
                <div class="sequence__name">${s.stone.name}</div>
                <div class="sequence__meta">${s.size} мм · ${s.stone.element}</div>
            </div>
            <button class="sequence__remove" data-remove="${idx}" aria-label="удалить">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        </li>
    `).join('');

    // Превью каждого камня + подписка на PNG-альбедо
    els.sequenceList.querySelectorAll('canvas[data-seq-thumb]').forEach(c => {
        const idx = +c.dataset.seqThumb;
        const item = stones[idx];
        if (!item) return;
        const draw = () => {
            const dpr = window.devicePixelRatio || 1;
            c.width = 28 * dpr; c.height = 28 * dpr;
            const ctx = c.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, 28, 28);
            const tex = generateStoneTexture(item.stone, 28, idx);
            ctx.drawImage(tex, 0, 0, 28, 28);
        };
        draw();
        onAlbedoReady(item.stoneId, draw);
    });

    els.sequenceList.querySelectorAll('button[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => removeStone(+btn.dataset.remove));
    });
}

// =================================================================
// ЭНЕРГЕТИКА
// =================================================================

function renderEnergy() {
    const stones = state.bracelet.stones;
    if (!stones.length) {
        els.energyTags.innerHTML = '<span class="muted" style="font-size:13px;">появится, когда добавите камни</span>';
        els.energyHint.textContent = '';
        return;
    }
    // Считаем частоты энергий
    const freq = {};
    stones.forEach(s => (s.stone.energy || []).forEach(e => freq[e] = (freq[e] || 0) + 1));
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6);

    els.energyTags.innerHTML = top.map(([energy]) => `
        <span class="energy-tag">${energy}</span>
    `).join('');

    // Текст-подсказка: перечисление уникальных камней
    const uniq = [...new Set(stones.map(s => s.stone.name))];
    els.energyHint.textContent = uniq.join(' · ');
}

// =================================================================
// ДЕЙСТВИЯ
// =================================================================

function setupActions() {
    els.undoBtn.addEventListener('click', undo);
    els.clearBtn.addEventListener('click', clearAll);
    els.randomBtn.addEventListener('click', randomFill);

    els.downloadBtn.addEventListener('click', async () => {
        if (!state.bracelet.stones.length) {
            // Если браслет пустой — просто сохранить текущий canvas
            exportPNG(els.canvas, 'jewerly-of-soul');
            return;
        }
        await exportCard(state.bracelet, { prefix: 'jewerly-of-soul' });
        toast.success('Карточка сохранена в загрузки');
    });

    els.sendBtn.addEventListener('click', onSendOrder);

    // Сохранить как идею (требует авторизации)
    if (els.saveBtn) {
        els.saveBtn.addEventListener('click', onSaveIdea);
    }

    // AI описание
    if (els.aiBtn) {
        els.aiBtn.addEventListener('click', onAiDescribe);
    }
}

/** Оформление заявки на сборку браслета. */
async function onSendOrder() {
    if (!state.bracelet.stones.length) return;
    const me = await auth.getCurrentUser();

    const composition = state.bracelet.stones.map(s => ({
        id: s.stoneId,
        name: s.stone.name,
        size: s.size,
    }));
    const beads = composition.length;
    const lengthCm = state.bracelet.length / 10;

    openModal({
        title: 'Оформление заявки',
        body: `
            <div style="display:flex; flex-direction:column; gap:14px">
                <p class="muted" style="font-size:13px; margin:-4px 0 2px; line-height:1.5">
                    Композиция: ${beads} ${plural(beads, 'бусина', 'бусины', 'бусин')}, длина ${lengthCm} см.
                    Мастер свяжется с вами, чтобы уточнить детали и цену.
                </p>
                <div>
                    <label class="field-label" for="ordName">Как к вам обращаться *</label>
                    <input class="field" id="ordName" placeholder="Имя" value="${escapeAttr(me ? me.displayName : '')}">
                </div>
                <div>
                    <label class="field-label" for="ordMethod">Способ связи</label>
                    <select class="field" id="ordMethod">
                        <option value="telegram">Telegram</option>
                        <option value="phone">Телефон</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="vk">ВКонтакте</option>
                        <option value="email">E-mail</option>
                        <option value="other">Другое</option>
                    </select>
                </div>
                <div>
                    <label class="field-label" for="ordContact">Контакт для связи *</label>
                    <input class="field" id="ordContact" placeholder="@ник, телефон или почта" value="${escapeAttr(me && me.email ? me.email : '')}">
                </div>
                <div>
                    <label class="field-label" for="ordComment">Комментарий к заказу</label>
                    <textarea class="field" id="ordComment" placeholder="Пожелания по цвету, поводу, срокам…"></textarea>
                </div>
                <label style="display:flex; gap:10px; align-items:flex-start; font-size:13px; color:var(--text-soft); line-height:1.5">
                    <input type="checkbox" id="ordConsent" style="margin-top:2px; width:18px; height:18px; accent-color:var(--accent); flex-shrink:0">
                    <span>Я согласен на обработку персональных данных в соответствии с
                        <a href="privacy.html" target="_blank" rel="noopener" class="accent">политикой конфиденциальности</a>.</span>
                </label>
            </div>
        `,
        buttons: [
            { label: 'Отмена', kind: 'ghost', onClick: ({ close }) => close() },
            { label: 'Отправить заявку', kind: 'primary', onClick: async ({ root, close }) => {
                const contactName   = root.querySelector('#ordName').value.trim();
                const contactMethod = root.querySelector('#ordMethod').value;
                const contactValue  = root.querySelector('#ordContact').value.trim();
                const comment       = root.querySelector('#ordComment').value.trim();
                const consent       = root.querySelector('#ordConsent').checked;

                if (!contactName)  { toast.error('Укажите, как к вам обращаться'); return; }
                if (!contactValue) { toast.error('Укажите контакт для связи'); return; }
                if (!consent)      { toast.error('Подтвердите согласие на обработку данных'); return; }

                try {
                    const order = await orderService.create({
                        contactName, contactMethod, contactValue, comment, consent,
                        composition,
                        braceletLength: state.bracelet.length,
                    });
                    close();
                    toast.success(`Заявка ${order.publicCode} принята! Мастер свяжется с вами.`);
                } catch (e) {
                    toast.error(e.message || 'Не получилось отправить заявку');
                }
            } },
        ],
    });
}

/** Русская форма множественного числа: plural(n,'бусина','бусины','бусин'). */
function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
}

async function onSaveIdea() {
    if (!state.bracelet.stones.length) return;
    const me = await auth.getCurrentUser();
    if (!me) {
        toast.info('Войдите, чтобы сохранять идеи');
        setTimeout(() => location.href = 'login.html?return=constructor.html', 1200);
        return;
    }
    const dominants = computeDominants();
    openModal({
        title: 'Сохранить идею',
        body: `
            <div style="display:flex; flex-direction:column; gap:14px">
                <div>
                    <label class="field-label" for="ideaTitle">Название</label>
                    <input class="field" id="ideaTitle" placeholder="например, Лунный шёпот" value="${escapeAttr(dominants.suggestedName)}">
                </div>
                <div>
                    <label class="field-label" for="ideaDesc">Описание (необязательно)</label>
                    <textarea class="field" id="ideaDesc" placeholder="Что вы хотели сказать этим браслетом?"></textarea>
                </div>
                <div>
                    <label class="field-label" for="ideaTags">Теги (через запятую)</label>
                    <input class="field" id="ideaTags" placeholder="например: спокойствие, фиолетовый, утро">
                </div>
                <label style="display:flex; gap:10px; align-items:center; padding-top:4px">
                    <input type="checkbox" id="ideaPublic" checked>
                    <span style="font-size:13px; color:var(--text-soft)">Опубликовать в сообществе</span>
                </label>
            </div>
        `,
        buttons: [
            { label: 'Отмена', kind: 'ghost', onClick: ({ close }) => close() },
            { label: 'Сохранить', kind: 'primary', onClick: async ({ root, close }) => {
                const title = root.querySelector('#ideaTitle').value.trim() || dominants.suggestedName;
                const description = root.querySelector('#ideaDesc').value.trim();
                const tags = root.querySelector('#ideaTags').value.split(',').map(s => s.trim()).filter(Boolean);
                const isPublic = root.querySelector('#ideaPublic').checked;
                try {
                    const idea = await ideas.create({
                        title, description, tags, isPublic,
                        mood: dominants.mood,
                        stones: state.bracelet.stones.map(s => ({ id: s.stoneId, size: s.size })),
                        length: state.bracelet.length,
                    });
                    close();
                    toast.success('Идея сохранена');
                    setTimeout(() => location.href = `idea.html?id=${encodeURIComponent(idea.id)}`, 400);
                } catch (e) {
                    toast.error(e.message || 'Не получилось сохранить');
                }
            } },
        ],
    });
}

function computeDominants() {
    const stones = state.bracelet.stones.map(s => s.stone).filter(Boolean);
    const elFreq = {};
    for (const s of stones) elFreq[s.element] = (elFreq[s.element] || 0) + 1;
    const leadEl = Object.entries(elFreq).sort((a,b)=>b[1]-a[1])[0]?.[0] || '';

    const moodMap = {
        'земля': 'growth', 'вода': 'calm', 'огонь': 'action',
        'воздух': 'speech', 'эфир': 'silence',
    };
    const suggestedName = stones.length ? `Композиция · ${stones.map(s=>s.name)[0]}` : 'Композиция';
    return { suggestedName, mood: moodMap[leadEl] || 'calm' };
}

let aiInflight = false;
async function onAiDescribe() {
    if (!state.bracelet.stones.length || aiInflight) return;
    aiInflight = true;
    els.aiResult.hidden = false;
    els.aiResult.innerHTML = `<p class="muted" style="font-size:13px">AI слушает камни…</p>`;
    els.aiBtn.disabled = true;
    try {
        const out = await ai.describe({
            stones: state.bracelet.stones.map(s => ({ id: s.stoneId, size: s.size })),
            length: state.bracelet.length,
        });
        els.aiResult.innerHTML = `
            <p>${escapeHtml(out.energyDescription)}</p>
            ${out.recommendations ? `<p class="muted" style="font-size:13px;margin-top:8px">${escapeHtml(out.recommendations)}</p>` : ''}
            ${out.nameSuggestions?.length ? `
                <div style="margin-top:12px">
                    <div class="eyebrow" style="margin-bottom:6px">названия</div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px">
                        ${out.nameSuggestions.map(n => `<span class="energy-tag">${escapeHtml(n)}</span>`).join('')}
                    </div>
                </div>` : ''}
        `;
    } catch (err) {
        els.aiResult.innerHTML = `<p style="color:var(--el-fire);font-size:13px">${escapeHtml(err.message || 'AI не отвечает')}</p>`;
    } finally {
        aiInflight = false;
        els.aiBtn.disabled = false;
    }
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
}
function escapeAttr(s) { return escapeHtml(s).replace(/`/g, '&#96;'); }

// =================================================================
// ВЫБОР И ПЕРЕТАСКИВАНИЕ КАМНЕЙ НА БРАСЛЕТЕ
// =================================================================

function setupCanvasInteraction() {
    const canvas = els.canvas;
    canvas.style.touchAction = 'none';   // не скроллить страницу при перетаскивании
    canvas.style.cursor = 'grab';

    let rafPending = false;
    const scheduleRedraw = () => {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => { rafPending = false; redraw(); });
    };

    function pointerPos(e) {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function beadAt(pos) {
        const layout = computeBraceletLayout(canvas, state.bracelet);
        // ищем с конца — позже нарисованные бусины «выше»
        for (let i = layout.beads.length - 1; i >= 0; i--) {
            const b = layout.beads[i];
            const dx = pos.x - b.x, dy = pos.y - b.y;
            const r = b.radius + 3;
            if (dx * dx + dy * dy <= r * r) return b;
        }
        return null;
    }

    canvas.addEventListener('pointerdown', e => {
        const pos = pointerPos(e);
        const bead = beadAt(pos);
        if (!bead) {
            if (state.selectedIndex != null) { state.selectedIndex = null; redraw(); }
            return;
        }
        state.selectedIndex = bead.index;
        state.drag = { stone: state.bracelet.stones[bead.index], x: pos.x, y: pos.y, moved: false };
        canvas.style.cursor = 'grabbing';
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
        redraw();
    });

    canvas.addEventListener('pointermove', e => {
        const pos = pointerPos(e);
        if (!state.drag) {
            canvas.style.cursor = beadAt(pos) ? 'grab' : 'default';
            return;
        }
        if (!state.drag.moved) { pushHistory(); state.drag.moved = true; }
        state.drag.x = pos.x;
        state.drag.y = pos.y;
        reorderByPointer(pos);
        scheduleRedraw();
    });

    function endDrag(e) {
        if (!state.drag) return;
        const moved = state.drag.moved;
        state.drag = null;
        canvas.style.cursor = 'grab';
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
        redraw();
        if (moved) renderSequence();
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
}

/** Переставить перетаскиваемую бусину к ближайшему по углу слоту. */
function reorderByPointer(pos) {
    const stones = state.bracelet.stones;
    if (stones.length < 2 || !state.drag) return;

    const layout = computeBraceletLayout(els.canvas, state.bracelet);
    const ptrAngle = Math.atan2(pos.y - layout.cy, pos.x - layout.cx);

    let target = -1, best = Infinity;
    for (const b of layout.beads) {
        const d = angDist(ptrAngle, b.centerAngle);
        if (d < best) { best = d; target = b.index; }
    }

    const from = stones.indexOf(state.drag.stone);
    if (from < 0 || target < 0 || from === target) {
        if (from >= 0) state.selectedIndex = from;
        return;
    }
    stones.splice(from, 1);
    stones.splice(target, 0, state.drag.stone);
    state.selectedIndex = stones.indexOf(state.drag.stone);
}

/** Кратчайшее угловое расстояние между двумя углами (рад). */
function angDist(a, b) {
    let d = Math.abs(a - b) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    return d;
}

function setupShortcuts() {
    document.addEventListener('keydown', e => {
        const inField = e.target.closest('input, textarea');
        if (inField) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undo();
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            if (state.bracelet.stones.length) {
                pushHistory();
                if (state.selectedIndex != null && state.selectedIndex < state.bracelet.stones.length) {
                    state.bracelet.stones.splice(state.selectedIndex, 1);
                } else {
                    state.bracelet.stones.pop();
                }
                state.selectedIndex = null;
                renderSequence();
                renderEnergy();
                redraw();
            }
        }
    });
}

init();
