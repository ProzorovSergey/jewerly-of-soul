/**
 * ideaApi.js
 * ----------------------------------------------------------------
 * Реализация IdeaAPI (см. interfaces.js) на localStorage.
 * Все идеи лежат одним массивом по ключу 'ideas'.
 */

import * as storage from '../../core/userStorage.js';

const IDEAS_KEY = 'ideas';
const USERS_KEY = 'users';

function readAll() { return storage.read(IDEAS_KEY, []); }
function writeAll(arr) { return storage.write(IDEAS_KEY, arr); }

/** Полный объект идеи + значения по умолчанию. */
function normalize(partial) {
    const now = new Date().toISOString();
    return {
        id: partial.id || storage.uid(),
        authorId: partial.authorId,
        title: (partial.title || '').trim() || 'Без названия',
        description: (partial.description || '').trim(),
        stones: Array.isArray(partial.stones) ? partial.stones : [],
        length: typeof partial.length === 'number' ? partial.length : 180,
        tags: Array.isArray(partial.tags) ? partial.tags : [],
        mood: partial.mood || '',
        isPublic: !!partial.isPublic,
        createdAt: partial.createdAt || now,
        updatedAt: now,
        likesCount: typeof partial.likesCount === 'number' ? partial.likesCount : 0,
        energyDescription: partial.energyDescription || '',
    };
}

export async function create(partial) {
    if (!partial.authorId) throw new Error('Не указан authorId');
    const idea = normalize(partial);
    const all = readAll();
    all.push(idea);
    writeAll(all);

    // Если public — добавим в publishedIdeas автора
    if (idea.isPublic) {
        const users = storage.read(USERS_KEY, []);
        const idx = users.findIndex(u => u.id === idea.authorId);
        if (idx >= 0) {
            users[idx].publishedIdeas = users[idx].publishedIdeas || [];
            if (!users[idx].publishedIdeas.includes(idea.id)) {
                users[idx].publishedIdeas.push(idea.id);
                storage.write(USERS_KEY, users);
            }
        }
    }
    return idea;
}

export async function getById(id) {
    const all = readAll();
    return all.find(i => i.id === id) || null;
}

export async function update(id, patch) {
    const all = readAll();
    const idx = all.findIndex(i => i.id === id);
    if (idx < 0) throw new Error('Идея не найдена');
    const wasPublic = all[idx].isPublic;
    all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
    writeAll(all);

    // Если статус публичности изменился — синхронизируем publishedIdeas автора
    if (wasPublic !== all[idx].isPublic) {
        const users = storage.read(USERS_KEY, []);
        const u = users.find(u => u.id === all[idx].authorId);
        if (u) {
            u.publishedIdeas = u.publishedIdeas || [];
            if (all[idx].isPublic) {
                if (!u.publishedIdeas.includes(id)) u.publishedIdeas.push(id);
            } else {
                u.publishedIdeas = u.publishedIdeas.filter(x => x !== id);
            }
            storage.write(USERS_KEY, users);
        }
    }
    return all[idx];
}

export async function remove(id) {
    const all = readAll();
    const idea = all.find(i => i.id === id);
    if (!idea) return;
    writeAll(all.filter(i => i.id !== id));
    // Чистим у автора
    const users = storage.read(USERS_KEY, []);
    const u = users.find(u => u.id === idea.authorId);
    if (u) {
        u.publishedIdeas = (u.publishedIdeas || []).filter(x => x !== id);
        storage.write(USERS_KEY, users);
    }
    // Чистим из likes/favorites всех юзеров
    for (const user of users) {
        user.likes = (user.likes || []).filter(x => x !== id);
        user.favorites = (user.favorites || []).filter(x => x !== id);
    }
    storage.write(USERS_KEY, users);
}

export { remove as delete_ };

export async function list(filter = {}) {
    let all = readAll();

    if (filter.authorId) all = all.filter(i => i.authorId === filter.authorId);
    if (typeof filter.isPublic === 'boolean') all = all.filter(i => i.isPublic === filter.isPublic);
    if (filter.tag) all = all.filter(i => (i.tags || []).includes(filter.tag));
    if (filter.mood) all = all.filter(i => i.mood === filter.mood);
    if (filter.stoneId) all = all.filter(i => (i.stones || []).some(s => s.id === filter.stoneId));

    if (filter.search) {
        const q = filter.search.trim().toLowerCase();
        all = all.filter(i =>
            i.title.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q) ||
            (i.tags || []).some(t => t.toLowerCase().includes(q)));
    }

    if (filter.sort === 'popular') {
        all.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    } else {
        // recent — по умолчанию
        all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }
    return all;
}

export async function toggleLike(ideaId, userId) {
    const users = storage.read(USERS_KEY, []);
    const u = users.find(u => u.id === userId);
    if (!u) throw new Error('Пользователь не найден');
    u.likes = u.likes || [];

    const all = readAll();
    const idea = all.find(i => i.id === ideaId);
    if (!idea) throw new Error('Идея не найдена');

    const wasLiked = u.likes.includes(ideaId);
    if (wasLiked) {
        u.likes = u.likes.filter(x => x !== ideaId);
        idea.likesCount = Math.max(0, (idea.likesCount || 1) - 1);
    } else {
        u.likes.push(ideaId);
        idea.likesCount = (idea.likesCount || 0) + 1;
    }
    storage.write(USERS_KEY, users);
    writeAll(all);
    return { liked: !wasLiked, likesCount: idea.likesCount };
}

export async function toggleFavorite(ideaId, userId) {
    const users = storage.read(USERS_KEY, []);
    const u = users.find(u => u.id === userId);
    if (!u) throw new Error('Пользователь не найден');
    u.favorites = u.favorites || [];
    const was = u.favorites.includes(ideaId);
    if (was) u.favorites = u.favorites.filter(x => x !== ideaId);
    else u.favorites.push(ideaId);
    storage.write(USERS_KEY, users);
    return { favorited: !was };
}

/** Прямой засев идей (для seed). Сохраняет likesCount и authorId как есть. */
export function _seedIdeas(ideas) {
    const all = readAll();
    const existing = new Set(all.map(i => i.id));
    for (const i of ideas) {
        if (!existing.has(i.id)) all.push(normalize(i));
    }
    writeAll(all);
}
