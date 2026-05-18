/**
 * favoritesService.js
 * ----------------------------------------------------------------
 * Избранные камни пользователя. Хранятся в localStorage отдельным
 * ключом на пользователя (или 'guest', если не залогинен).
 *
 * Событие 'favorites:change' (CustomEvent на document) — для
 * слабосвязанных потребителей: иконка-сердечко, профиль, бейдж.
 */

import { read, write } from '../core/userStorage.js';
import { getCurrentUser } from './authService.js';

async function keyForCurrent() {
    const user = await getCurrentUser();
    return user ? `favorites:stones:${user.id}` : 'favorites:stones:guest';
}

/** Список id избранных камней. */
export async function list() {
    const k = await keyForCurrent();
    return read(k, []);
}

export async function isFavorite(stoneId) {
    const ids = await list();
    return ids.includes(stoneId);
}

/**
 * Переключить «сердечко» у камня.
 * @returns {Promise<boolean>} true — добавили, false — убрали.
 */
export async function toggle(stoneId) {
    const k = await keyForCurrent();
    const ids = read(k, []);
    const i = ids.indexOf(stoneId);
    const added = i < 0;
    if (added) ids.push(stoneId);
    else ids.splice(i, 1);
    write(k, ids);

    try {
        document.dispatchEvent(new CustomEvent('favorites:change', {
            detail: { stoneId, favorited: added, ids: [...ids] },
        }));
    } catch (_) { /* SSR/тесты */ }

    return added;
}

export async function count() {
    return (await list()).length;
}

/** Очистить все избранные текущего юзера (для отладки/настроек). */
export async function clear() {
    const k = await keyForCurrent();
    write(k, []);
    try {
        document.dispatchEvent(new CustomEvent('favorites:change', {
            detail: { stoneId: null, favorited: false, ids: [] },
        }));
    } catch (_) { /* noop */ }
}
