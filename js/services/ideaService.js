/**
 * ideaService.js
 * ----------------------------------------------------------------
 * Бизнес-логика работы с идеями. UI-слой использует только этот
 * модуль (не ideaApi напрямую), потому что здесь — проверка
 * прав, привязка к текущему пользователю и обогащение объектами
 * камней из stones.json.
 */

import { ideaApi } from '../api/index.js';
import * as auth from './authService.js';
import { loadStones } from '../core/database.js';

let _cataloguePromise = null;
function getCatalogue() {
    if (!_cataloguePromise) _cataloguePromise = loadStones().then(d => d.stones);
    return _cataloguePromise;
}

/** Обогатить idea.stones полными объектами камней (для рендеринга). */
export async function expandIdea(idea) {
    if (!idea) return null;
    const cat = await getCatalogue();
    return {
        ...idea,
        stones: (idea.stones || []).map(s => {
            const full = cat.find(x => x.id === s.id);
            return full ? { ...s, stone: full } : s;
        }),
    };
}

/** Создать новую идею от имени текущего юзера. */
export async function create(data) {
    const me = await auth.getCurrentUser();
    if (!me) throw new Error('Войдите, чтобы сохранить идею');
    return ideaApi.create({ ...data, authorId: me.id });
}

export async function update(id, patch) {
    const me = await auth.getCurrentUser();
    if (!me) throw new Error('Войдите для редактирования');
    const idea = await ideaApi.getById(id);
    if (!idea) throw new Error('Идея не найдена');
    if (idea.authorId !== me.id) throw new Error('Это не ваша идея');
    return ideaApi.update(id, patch);
}

export async function remove(id) {
    const me = await auth.getCurrentUser();
    if (!me) throw new Error('Войдите для удаления');
    const idea = await ideaApi.getById(id);
    if (!idea) return;
    if (idea.authorId !== me.id) throw new Error('Это не ваша идея');
    return ideaApi.remove(id);
}

export async function getById(id, opts = { expand: false }) {
    const idea = await ideaApi.getById(id);
    if (!idea) return null;
    return opts.expand ? expandIdea(idea) : idea;
}

export async function listMy() {
    const me = await auth.getCurrentUser();
    if (!me) return [];
    return ideaApi.list({ authorId: me.id, sort: 'recent' });
}

export async function listMyFavorites() {
    const me = await auth.getCurrentUser();
    if (!me) return [];
    const ids = me.favorites || [];
    const all = await ideaApi.list({ isPublic: true });
    return all.filter(i => ids.includes(i.id));
}

export async function listFeed(filter = {}) {
    return ideaApi.list({ isPublic: true, sort: 'popular', ...filter });
}

export async function toggleLike(ideaId) {
    const me = await auth.getCurrentUser();
    if (!me) throw new Error('Войдите, чтобы поставить лайк');
    const result = await ideaApi.toggleLike(ideaId, me.id);
    await auth.refresh();
    return result;
}

export async function toggleFavorite(ideaId) {
    const me = await auth.getCurrentUser();
    if (!me) throw new Error('Войдите, чтобы добавить в избранное');
    const result = await ideaApi.toggleFavorite(ideaId, me.id);
    await auth.refresh();
    return result;
}
