/**
 * home.js
 * ----------------------------------------------------------------
 * Заполнение главной страницы:
 *  - hero-canvas + about-canvas через autoMountMinis
 *  - три карточки "Что уже собрано" (рисуем мини-браслеты)
 *  - четыре камня "тихие голоса"
 */

import { loadStones, findStone } from '../core/database.js';
import { autoMountMinis, renderMini } from '../ui/miniBracelet.js';
import { generateStoneTexture, preloadAlbedos, onAlbedoReady } from '../core/stoneGenerator.js';
import * as ideas from '../services/ideaService.js';
import * as users from '../services/userService.js';
import { magneticHover } from '../ui/motion.js';

// =================================================================
// HERO микровзаимодействия (V2):
//   • magnetic-hover на primary CTA;
//   • плавное скрытие scroll-hint при первой прокрутке.
// Запускается параллельно с основной init() — не блокирует камни.
// =================================================================
function setupHeroInteractions() {
    // Magnetic-hover на всех элементах с [data-magnetic]
    document.querySelectorAll('[data-magnetic]').forEach(el => {
        magneticHover(el, { strength: 0.20, radius: 140 });
    });

    // Скрываем scroll-hint при любой прокрутке > 60px
    const hint = document.getElementById('heroScrollHint');
    if (hint) {
        const hide = () => {
            if (window.scrollY > 60) {
                hint.classList.add('is-hidden');
                window.removeEventListener('scroll', hide);
            }
        };
        window.addEventListener('scroll', hide, { passive: true });
    }
}

setupHeroInteractions();

const FEATURED = [
    {
        title: 'Лунный Вуаль',
        sub: 'для тонкой настройки',
        stones: ['moonstone','labradorite','rock-crystal','moonstone','labradorite','white-jade',
                 'moonstone','labradorite','rock-crystal','moonstone','labradorite','white-jade'],
        tags: [
            { el: 'вода',  label: 'вода' },
            { el: 'воздух', label: 'воздух' },
        ],
    },
    {
        title: 'Зелёный Обет',
        sub: 'для роста и удачи',
        stones: ['green-jade','aventurine','malachite','green-jade','aventurine','malachite',
                 'green-jade','aventurine','malachite','green-jade','aventurine','malachite'],
        tags: [
            { el: 'земля', label: 'земля' },
            { el: 'воздух', label: 'нефрит · авантюрин · малахит' },
        ],
    },
    {
        title: 'Царская Печать',
        sub: 'для веса слова',
        stones: ['almandine-garnet','lapis','pyrite','almandine-garnet','lapis','pyrite',
                 'almandine-garnet','lapis','pyrite','almandine-garnet','lapis','pyrite'],
        tags: [
            { el: 'огонь', label: 'огонь' },
            { el: 'земля', label: 'гранат · лазурит · пирит' },
        ],
    },
];

const QUARTET_IDS = ['amethyst', 'labradorite', 'lapis', 'rose-quartz'];

async function init() {
    let data;
    try {
        data = await loadStones();
    } catch (err) {
        console.error('Не удалось загрузить базу камней:', err);
        return;
    }
    const catalogue = data.stones;

    // Фоновая загрузка PNG — рендерим procedural сразу, не ждём
    preloadAlbedos(catalogue);

    // Hero и about canvas — через автомаунт по data-атрибутам
    autoMountMinis(catalogue);

    // Hero v2: социальное доказательство + триптих топ-3 идей
    await renderHeroProofAndTrio(catalogue);

    // Карточки "Что уже собрано"
    const grid = document.getElementById('featuredGrid');
    if (grid) {
        grid.innerHTML = FEATURED.map((item, idx) => `
            <article class="featured-card" data-tilt data-tilt-max="3">
                <div class="featured-card__visual">
                    <canvas
                        data-mini-bracelet
                        data-stones="${item.stones.join(',')}"
                        data-size="8"
                        data-length="180"
                        width="360" height="360"></canvas>
                </div>
                <div class="featured-card__body">
                    <h3 class="featured-card__title">${item.title}</h3>
                    <div class="featured-card__sub">${item.sub}</div>
                    <div class="featured-card__tags">
                        ${item.tags.map(t => `<span class="element-tag" data-el="${t.el}">${t.label}</span>`).join('')}
                    </div>
                </div>
            </article>
        `).join('');
        autoMountMinis(catalogue);
        autoMountMinis(catalogue);
    }

    // Четыре тихих голоса
    const quartet = document.getElementById('stoneQuartet');
    if (quartet) {
        quartet.innerHTML = QUARTET_IDS.map(id => {
            const s = findStone(catalogue, id);
            if (!s) return '';
            return `
                <article class="stone-quartet__item">
                    <div class="stone-quartet__visual">
                        <canvas data-stone-id="${s.id}" width="320" height="320"></canvas>
                    </div>
                    <h3 class="stone-quartet__name">${s.name}</h3>
                    <p class="stone-quartet__desc">${(s.energy || []).join(' · ')}</p>
                </article>
            `;
        }).join('');

        // Рисуем по одному большому камню в каждом canvas + перерисовываем,
        // когда подгрузится PNG-альбедо
        quartet.querySelectorAll('canvas[data-stone-id]').forEach(c => {
            const id = c.dataset.stoneId;
            const stone = findStone(catalogue, id);
            if (!stone) return;
            const draw = () => {
                const dpr = window.devicePixelRatio || 1;
                const w = c.clientWidth || 200;
                c.width = w * dpr; c.height = w * dpr;
                const ctx = c.getContext('2d');
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, w, w);
                const tex = generateStoneTexture(stone, w * 0.7, 0);
                ctx.drawImage(tex, w * 0.15, w * 0.15, w * 0.7, w * 0.7);
            };
            draw();
            onAlbedoReady(id, draw);
        });
    }
}

async function renderHeroProofAndTrio(catalogue) {
    // Цифры: сколько идей в сообществе, сколько авторов
    const feed = await ideas.listFeed({});
    const publicCount = feed.length;
    const authorIds = new Set(feed.map(i => i.authorId));
    const totalLikes = feed.reduce((sum, i) => sum + (i.likesCount || 0), 0);

    const proofEl = document.getElementById('heroProof');
    if (proofEl) {
        proofEl.innerHTML = `
            <div class="proof-stat">
                <span class="proof-stat__num">${publicCount}+</span>
                <span class="proof-stat__label">идей в ленте</span>
            </div>
            <div class="proof-stat">
                <span class="proof-stat__num">${authorIds.size}</span>
                <span class="proof-stat__label">авторов</span>
            </div>
            <div class="proof-stat">
                <span class="proof-stat__num">${totalLikes}</span>
                <span class="proof-stat__label">лайков</span>
            </div>
        `;
    }

    // Триптих — топ-3 идеи по лайкам
    const trioEl = document.getElementById('heroTrio');
    if (trioEl) {
        const top3 = [...feed].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0)).slice(0, 3);
        trioEl.innerHTML = top3.map(i => `
            <a class="hero-tile" href="idea.html?id=${encodeURIComponent(i.id)}"
               aria-label="${escapeHtml(i.title)}" data-tilt data-tilt-max="6">
                <canvas data-mini-stones="${i.stones.map(s => s.id).join(',')}"
                        data-size="${i.stones[0]?.size || 8}"
                        data-length="${i.length || 180}"></canvas>
                <span class="hero-tile__name">${escapeHtml(i.title)}</span>
            </a>
        `).join('');

        trioEl.querySelectorAll('canvas[data-mini-stones]').forEach(c => {
            const ids = c.dataset.miniStones.split(',').filter(Boolean);
            renderMini(c, catalogue, {
                stoneIds: ids,
                size: +c.dataset.size || 8,
                length: +c.dataset.length || 180,
            });
        });
    }
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
}

init();
