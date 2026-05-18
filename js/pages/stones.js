/**
 * stones.js
 * ----------------------------------------------------------------
 * Каталог камней. 4 фильтра: цвет, стихия, энергия, редкость.
 * Сортировка. Сердечко-избранное. Клик по карточке → детальная модалка.
 * Редкие камни визуально подсвечиваются особой рамкой.
 */

import { loadStones } from '../core/database.js';
import { generateStoneTexture, preloadAlbedos, onAlbedoReady } from '../core/stoneGenerator.js';
import * as favs from '../services/favoritesService.js';
import { openStoneDetail } from '../ui/stoneDetail.js';

const state = {
    catalogue: [],
    element: 'all',
    color:   'all',
    energy:  'all',
    rarity:  'all',
    search:  '',
    sort:    'default',
    favIds:  new Set(),
    showOnlyFavs: false,
};

// Порядок стихий для сортировки «по стихии»
const ELEMENT_ORDER = { 'земля': 0, 'вода': 1, 'воздух': 2, 'огонь': 3, 'эфир': 4 };

const els = {
    grid:       document.getElementById('stoneGrid'),
    count:      document.getElementById('stoneCount'),
    search:     document.getElementById('stoneSearch'),
    fEl:        document.getElementById('elementFilters'),
    fCol:       document.getElementById('colorFilters'),
    fEn:        document.getElementById('energyFilters'),
    fRar:       document.getElementById('rarityFilters'),
    empty:      document.getElementById('emptyNote'),
    panel:      document.getElementById('filterPanel'),
    toggle:     document.getElementById('filterToggle'),
    filterCnt:  document.getElementById('filterCount'),
    clearBtn:   document.getElementById('filterClear'),
    sort:       document.getElementById('stoneSort'),
    favsToggle: document.getElementById('favsOnlyToggle'),
    favsCount:  document.getElementById('favsCount'),
};

async function init() {
    try {
        const data = await loadStones();
        state.catalogue = data.stones;
        els.count.textContent = state.catalogue.length;
    } catch (err) {
        console.error('stones load failed:', err);
        return;
    }

    // Фоновая (не блокирующая) загрузка PNG
    preloadAlbedos(state.catalogue);

    // Загружаем избранные текущего юзера
    state.favIds = new Set(await favs.list());
    updateFavsCount();

    bindFilter(els.fEl,  'element');
    bindFilter(els.fCol, 'color');
    bindFilter(els.fEn,  'energy');
    bindFilter(els.fRar, 'rarity');

    els.search.addEventListener('input', () => {
        state.search = els.search.value.trim().toLowerCase();
        updateFilterCount();
        render();
    });

    if (els.sort) {
        els.sort.addEventListener('change', () => {
            state.sort = els.sort.value || 'default';
            render();
        });
    }

    if (els.favsToggle) {
        els.favsToggle.addEventListener('click', () => {
            state.showOnlyFavs = !state.showOnlyFavs;
            els.favsToggle.classList.toggle('is-active', state.showOnlyFavs);
            els.favsToggle.setAttribute('aria-pressed', String(state.showOnlyFavs));
            render();
        });
    }

    // Раскрытие панели фильтров
    if (els.toggle && els.panel) {
        els.toggle.addEventListener('click', () => {
            const open = els.panel.hasAttribute('hidden');
            if (open) {
                els.panel.removeAttribute('hidden');
                els.toggle.setAttribute('aria-expanded', 'true');
            } else {
                els.panel.setAttribute('hidden', '');
                els.toggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (els.clearBtn) {
        els.clearBtn.addEventListener('click', () => clearAllFilters());
    }

    // Слушаем внешние изменения избранного (например, из модалки)
    document.addEventListener('favorites:change', e => {
        const { ids } = e.detail || {};
        if (Array.isArray(ids)) {
            state.favIds = new Set(ids);
            updateFavsCount();
            // Подсветить сердечки без полной перерисовки сетки
            els.grid.querySelectorAll('.stone-card').forEach(card => {
                const id = card.dataset.stoneId;
                if (!id) return;
                const heart = card.querySelector('.stone-card__heart');
                if (!heart) return;
                const fav = state.favIds.has(id);
                heart.classList.toggle('is-active', fav);
                heart.setAttribute('aria-pressed', String(fav));
                const svg = heart.querySelector('svg');
                if (svg) svg.setAttribute('fill', fav ? 'currentColor' : 'none');
            });
            // Если включён «только избранные» — перерисовать
            if (state.showOnlyFavs) render();
        }
    });

    updateFilterCount();
    render();
}

function clearAllFilters() {
    state.element = 'all';
    state.color   = 'all';
    state.energy  = 'all';
    state.rarity  = 'all';
    state.search  = '';
    els.search.value = '';
    [els.fEl, els.fCol, els.fEn, els.fRar].forEach(group => {
        if (!group) return;
        group.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
        const first = group.querySelector('.chip[data-element="all"], .chip[data-color="all"], .chip[data-energy="all"], .chip[data-rarity="all"]');
        if (first) first.classList.add('is-active');
    });
    updateFilterCount();
    render();
}

function updateFilterCount() {
    let n = 0;
    if (state.element !== 'all') n++;
    if (state.color   !== 'all') n++;
    if (state.energy  !== 'all') n++;
    if (state.rarity  !== 'all') n++;
    if (state.search) n++;
    if (els.filterCnt) {
        els.filterCnt.textContent = n;
        els.filterCnt.hidden = n === 0;
    }
    if (els.clearBtn) {
        els.clearBtn.hidden = n === 0;
    }
}

function updateFavsCount() {
    if (els.favsCount) {
        els.favsCount.textContent = state.favIds.size;
        els.favsCount.hidden = state.favIds.size === 0;
    }
}

function bindFilter(container, key) {
    if (!container) return;
    container.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        container.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        state[key] = chip.dataset[key] || 'all';
        updateFilterCount();
        render();
    });
}

function matches(s) {
    if (state.showOnlyFavs && !state.favIds.has(s.id)) return false;
    if (state.element !== 'all' && s.element !== state.element) return false;
    if (state.color   !== 'all' && s.color_category !== state.color) return false;
    if (state.energy  !== 'all' && !(s.energy || []).includes(state.energy)) return false;
    if (state.rarity  !== 'all' && (s.rarity || 'common') !== state.rarity) return false;
    if (state.search) {
        const hay = (s.name + ' ' + s.element + ' ' + s.color_category + ' '
                   + (s.energy || []).join(' ')).toLowerCase();
        if (!hay.includes(state.search)) return false;
    }
    return true;
}

function sortList(list) {
    const sorted = [...list];
    switch (state.sort) {
        case 'name-asc':
            sorted.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
            break;
        case 'name-desc':
            sorted.sort((a, b) => b.name.localeCompare(a.name, 'ru'));
            break;
        case 'rarity':
            // сначала rare, потом common
            sorted.sort((a, b) => {
                const ra = (a.rarity || 'common') === 'rare' ? 0 : 1;
                const rb = (b.rarity || 'common') === 'rare' ? 0 : 1;
                if (ra !== rb) return ra - rb;
                return a.name.localeCompare(b.name, 'ru');
            });
            break;
        case 'element':
            sorted.sort((a, b) => {
                const oa = ELEMENT_ORDER[a.element] ?? 99;
                const ob = ELEMENT_ORDER[b.element] ?? 99;
                if (oa !== ob) return oa - ob;
                return a.name.localeCompare(b.name, 'ru');
            });
            break;
        default:
            // 'default' — порядок из данных
            break;
    }
    return sorted;
}

function heartButtonHtml(stoneId) {
    const fav = state.favIds.has(stoneId);
    return `
        <button type="button" class="stone-card__heart${fav ? ' is-active' : ''}"
                aria-label="${fav ? 'убрать из избранного' : 'в избранное'}"
                aria-pressed="${fav}">
            <svg viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
        </button>
    `;
}

function render() {
    const filtered = state.catalogue.filter(matches);
    const list = sortList(filtered);

    if (!list.length) {
        els.grid.innerHTML = '';
        els.empty.classList.remove('is-hidden');
        return;
    }
    els.empty.classList.add('is-hidden');

    els.grid.innerHTML = list.map(s => `
        <article class="stone-card${s.rarity === 'rare' ? ' is-rare' : ''}"
                 data-tilt data-tilt-max="3"
                 data-stone-id="${s.id}"
                 tabindex="0"
                 role="button"
                 aria-label="${s.name} — открыть детально">
            ${s.rarity === 'rare' ? '<span class="rare-badge">rare</span>' : ''}
            ${heartButtonHtml(s.id)}
            <div class="stone-card__visual">
                <canvas data-stone="${s.id}" width="240" height="240"></canvas>
            </div>
            <h3 class="stone-card__name">${s.name}</h3>
            <div class="stone-card__meta">
                <span class="element-tag" data-el="${s.element}">${s.element}</span>
            </div>
            <div class="stone-card__overlay" aria-hidden="true">
                <div class="stone-card__overlay-row">
                    <span class="stone-card__color">${s.color_category}</span>
                    <span>·</span>
                    <span>${(s.sizes || []).join(' · ')} мм</span>
                </div>
                <div class="stone-card__overlay-energy">
                    ${(s.energy || []).map(e => `<span>${e}</span>`).join('')}
                </div>
            </div>
        </article>
    `).join('');

    // ---- Делегирование кликов по сетке ----
    els.grid.querySelectorAll('.stone-card').forEach(card => {
        const id = card.dataset.stoneId;
        if (!id) return;

        // Сердечко: останавливаем всплытие, чтобы не открывалась модалка
        const heart = card.querySelector('.stone-card__heart');
        if (heart) {
            heart.addEventListener('click', async e => {
                e.stopPropagation();
                const added = await favs.toggle(id);
                heart.classList.toggle('is-active', added);
                heart.setAttribute('aria-pressed', String(added));
                heart.setAttribute('aria-label', added ? 'убрать из избранного' : 'в избранное');
                const svg = heart.querySelector('svg');
                if (svg) svg.setAttribute('fill', added ? 'currentColor' : 'none');
            });
        }

        // Клик по карточке → детальная модалка
        card.addEventListener('click', () => {
            const stone = state.catalogue.find(x => x.id === id);
            if (stone) openStoneDetail(stone);
        });

        // Доступность: Enter/Space на карточке
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const stone = state.catalogue.find(x => x.id === id);
                if (stone) openStoneDetail(stone);
            }
        });
    });

    // ---- Рисуем камни ----
    els.grid.querySelectorAll('canvas[data-stone]').forEach(c => {
        const id = c.dataset.stone;
        const stone = list.find(x => x.id === id);
        if (!stone) return;
        const drawOnce = () => {
            const dpr = window.devicePixelRatio || 1;
            const w = c.clientWidth || 120;
            c.width = w * dpr; c.height = w * dpr;
            const ctx = c.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, w);
            const tex = generateStoneTexture(stone, w * 0.92, 0);
            ctx.drawImage(tex, w * 0.04, w * 0.04, w * 0.92, w * 0.92);
        };
        drawOnce();
        onAlbedoReady(id, drawOnce);
    });
}

init();
