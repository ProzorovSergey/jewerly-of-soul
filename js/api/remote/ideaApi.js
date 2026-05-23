/**
 * remote/ideaApi.js
 * ----------------------------------------------------------------
 * Реализация IdeaAPI поверх настоящего backend.
 * Сигнатуры совпадают с js/api/local/ideaApi.js.
 *
 * Право собственности (автор идеи, лайкающий пользователь)
 * backend определяет по токену сессии — клиентские authorId/userId
 * сервером игнорируются.
 *
 * См. IdeaAPI в js/api/interfaces.js
 */

import { api } from './client.js';

export async function create(partial) {
    const data = await api('ideas/create', { method: 'POST', body: partial });
    return data.idea;
}

export async function getById(id) {
    try {
        const data = await api('ideas/get', { query: { id } });
        return data.idea || null;
    } catch (err) {
        if (err.status === 404) return null;
        throw err;
    }
}

export async function update(id, patch) {
    const data = await api('ideas/update', { method: 'POST', body: { id, ...patch } });
    return data.idea;
}

export async function remove(id) {
    await api('ideas/delete', { method: 'POST', body: { id } });
}
export { remove as delete_ };

export async function list(filter = {}) {
    const query = {};
    if (filter.authorId) query.authorId = filter.authorId;
    if (typeof filter.isPublic === 'boolean') query.isPublic = filter.isPublic ? '1' : '0';
    if (filter.tag) query.tag = filter.tag;
    if (filter.mood) query.mood = filter.mood;
    if (filter.stoneId) query.stoneId = filter.stoneId;
    if (filter.search) query.search = filter.search;
    if (filter.sort) query.sort = filter.sort;

    const data = await api('ideas/list', { query });
    return data.ideas || [];
}

export async function toggleLike(ideaId /*, userId */) {
    // backend берёт пользователя из токена; ответ: { liked, likesCount }
    return await api('ideas/like', { method: 'POST', body: { ideaId } });
}

export async function toggleFavorite(ideaId /*, userId */) {
    // ответ: { favorited }
    return await api('ideas/favorite', { method: 'POST', body: { ideaId } });
}
