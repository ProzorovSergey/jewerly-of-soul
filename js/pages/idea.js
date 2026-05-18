/**
 * idea.js — детальная страница одной идеи.
 */

import * as auth from '../services/authService.js';
import * as ideas from '../services/ideaService.js';
import * as users from '../services/userService.js';
import { loadStones } from '../core/database.js';
import { renderMini } from '../ui/miniBracelet.js';
import { generateStoneTexture, preloadAlbedos, onAlbedoReady } from '../core/stoneGenerator.js';
import { toast } from '../ui/toast.js';
import { openModal } from '../ui/modal.js';

const root = document.getElementById('ideaRoot');

async function init() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) {
        root.innerHTML = '<p class="muted" style="padding:80px 0;text-align:center">Идея не найдена.</p>';
        return;
    }

    const idea = await ideas.getById(id, { expand: true });
    if (!idea) {
        root.innerHTML = `
            <p class="muted" style="padding:80px 0;text-align:center">
                Эта идея не найдена. Возможно, её удалили.
            </p>`;
        return;
    }

    const author = await users.getById(idea.authorId);
    const me = await auth.getCurrentUser();
    const catalogue = (await loadStones()).stones;
    await preloadAlbedos(catalogue);

    // SEO: подменяем title/description под конкретную идею + JSON-LD
    updateSeoForIdea(idea, author);

    render({ idea, author, me, catalogue });
}

/**
 * Обновляет <title>, og:* и впрыскивает JSON-LD CreativeWork для
 * конкретной идеи. Это даёт богатые превью при шеринге ссылки в
 * Telegram/WhatsApp и помогает поисковикам индексировать карточки.
 */
function updateSeoForIdea(idea, author) {
    const title = `${idea.title} · Идея браслета · Jewerly of Soul`;
    const desc  = (idea.description || '').trim()
        || `Браслет из ${idea.stones.length} натуральных камней, ${(idea.length||180)/10} см. Композиция от ${author?.displayName || 'мастера'}.`;

    document.title = title;

    setMeta('description', desc);
    setMeta('og:title', title, 'property');
    setMeta('og:description', desc, 'property');
    setMeta('twitter:title', title);
    setMeta('twitter:description', desc);

    // JSON-LD
    const ld = {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: idea.title,
        description: desc,
        dateCreated: idea.createdAt,
        dateModified: idea.updatedAt,
        inLanguage: 'ru',
        author: author ? {
            '@type': 'Person',
            name: author.displayName,
            alternateName: '@' + author.username,
        } : undefined,
        interactionStatistic: {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/LikeAction',
            userInteractionCount: idea.likesCount || 0,
        },
        keywords: (idea.tags || []).join(', '),
        isPartOf: {
            '@type': 'WebSite',
            name: 'Jewerly of Soul',
            url: 'https://prozorovsergey.github.io/jewerly-of-soul/',
        },
    };
    // Чистим undefined
    for (const k of Object.keys(ld)) if (ld[k] === undefined) delete ld[k];

    let script = document.getElementById('jsonLdIdea');
    if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'jsonLdIdea';
        document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(ld);
}

function setMeta(name, content, attr = 'name') {
    let m = document.head.querySelector(`meta[${attr}="${name}"]`);
    if (!m) {
        m = document.createElement('meta');
        m.setAttribute(attr, name);
        document.head.appendChild(m);
    }
    m.setAttribute('content', content);
}

function render({ idea, author, me, catalogue }) {
    const stoneIds = idea.stones.map(s => s.id);
    const size = idea.stones[0]?.size || 8;
    const len  = idea.length || 180;

    const isMine = me && idea.authorId === me.id;
    const liked  = me && (me.likes || []).includes(idea.id);
    const fav    = me && (me.favorites || []).includes(idea.id);

    root.innerHTML = `
        <div class="idea-visual">
            <canvas id="ideaCanvas" width="700" height="700"></canvas>
        </div>
        <div class="idea-content">
            <p class="eyebrow">${escapeHtml(idea.mood || 'композиция')}</p>
            <h1 class="h-1">${escapeHtml(idea.title || 'Без названия')}</h1>
            ${idea.description ? `<p class="lead" style="margin-top:16px">${escapeHtml(idea.description)}</p>` : ''}

            <div class="idea-author">
                <span class="avatar">${escapeHtml(author?.avatar || '✦')}</span>
                <div class="idea-author__body">
                    <div class="idea-author__name">${escapeHtml(author?.displayName || 'аноним')}</div>
                    <div class="idea-author__meta">
                        @${escapeHtml(author?.username || '')} ·
                        ${new Date(idea.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                </div>
            </div>

            <div class="idea-actions">
                ${me ? `
                    <button class="btn btn--ghost btn--sm ${liked ? 'is-active' : ''}" id="likeBtn">
                        ♥ <span id="likesCount">${idea.likesCount || 0}</span>
                    </button>
                    <button class="btn btn--ghost btn--sm ${fav ? 'is-active' : ''}" id="favBtn">
                        ${fav ? '★ в избранном' : '☆ в избранное'}
                    </button>
                ` : `
                    <a href="login.html" class="btn btn--ghost btn--sm">♥ Войдите, чтобы лайкнуть</a>
                `}
                ${isMine ? `
                    <button class="btn btn--ghost btn--sm" id="deleteBtn" style="margin-left:auto">Удалить</button>
                ` : ''}
            </div>

            <div class="idea-section">
                <h3>Состав · ${idea.stones.length} камней</h3>
                <div class="idea-stones" id="stoneList"></div>
            </div>

            ${idea.tags?.length ? `
                <div class="idea-section">
                    <h3>Теги</h3>
                    <div class="idea-tags">
                        ${idea.tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}
                    </div>
                </div>
            ` : ''}

            ${idea.energyDescription ? `
                <div class="idea-energy">
                    <h3>Энергетика</h3>
                    <p>${escapeHtml(idea.energyDescription)}</p>
                </div>
            ` : ''}
        </div>
    `;

    // Рисуем большой браслет
    const canvas = document.getElementById('ideaCanvas');
    resize(canvas);
    renderMini(canvas, catalogue, { stoneIds, size, length: len });

    // Камни с миниатюрами
    const stoneList = document.getElementById('stoneList');
    stoneList.innerHTML = idea.stones.map((s, i) => `
        <div class="idea-stone">
            <canvas data-stone="${s.id}" data-var="${i}" width="32" height="32"></canvas>
            <div>
                <div class="idea-stone__name">${escapeHtml(s.stone?.name || s.id)}</div>
                <div class="idea-stone__meta">${s.size} мм · ${escapeHtml(s.stone?.element || '')}</div>
            </div>
        </div>
    `).join('');
    stoneList.querySelectorAll('canvas[data-stone]').forEach(c => {
        const stone = catalogue.find(x => x.id === c.dataset.stone);
        if (!stone) return;
        const variant = +c.dataset.var || 0;
        const drawIcon = () => {
            const dpr = window.devicePixelRatio || 1;
            c.width = 32 * dpr; c.height = 32 * dpr;
            const ctx = c.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, 32, 32);
            const tex = generateStoneTexture(stone, 32, variant);
            ctx.drawImage(tex, 0, 0, 32, 32);
        };
        drawIcon();
        // Когда подгрузится PNG-альбедо — перерисовать иконку с фото-текстурой
        onAlbedoReady(stone.id, drawIcon);
    });

    // Действия
    if (me) {
        const likeBtn = document.getElementById('likeBtn');
        const favBtn  = document.getElementById('favBtn');
        if (likeBtn) likeBtn.addEventListener('click', async () => {
            try {
                const r = await ideas.toggleLike(idea.id);
                document.getElementById('likesCount').textContent = r.likesCount;
                likeBtn.classList.toggle('is-active', r.liked);
            } catch (e) { toast.error(e.message); }
        });
        if (favBtn) favBtn.addEventListener('click', async () => {
            try {
                const r = await ideas.toggleFavorite(idea.id);
                favBtn.classList.toggle('is-active', r.favorited);
                favBtn.textContent = r.favorited ? '★ в избранном' : '☆ в избранное';
                toast.info(r.favorited ? 'Добавлено в избранное' : 'Убрано из избранного');
            } catch (e) { toast.error(e.message); }
        });
    }
    if (isMine) {
        document.getElementById('deleteBtn').addEventListener('click', () => {
            openModal({
                title: 'Удалить идею?',
                body: '<p>Это действие нельзя отменить. Идея удалится из ленты сообщества.</p>',
                buttons: [
                    { label: 'Отмена', kind: 'ghost', onClick: ({ close }) => close() },
                    { label: 'Удалить', kind: 'primary', onClick: async ({ close }) => {
                        try {
                            await ideas.remove(idea.id);
                            close();
                            toast.success('Идея удалена');
                            setTimeout(() => location.href = 'profile.html', 400);
                        } catch (e) { toast.error(e.message); }
                    } },
                ],
            });
        });
    }
}

function resize(c) {
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth || 700;
    c.width = w * dpr; c.height = w * dpr;
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
    ));
}

init();
