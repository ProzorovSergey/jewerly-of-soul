/**
 * userApi.js
 * ----------------------------------------------------------------
 * Реализация UserAPI (см. interfaces.js) — публичная информация
 * о пользователях. Чувствительные поля (passwordHash, salt, likes
 * и т.д.) вырезаются.
 */

import * as storage from '../../core/userStorage.js';

const USERS_KEY = 'users';
const IDEAS_KEY = 'ideas';

function publicView(user) {
    if (!user) return null;
    const ideas = storage.read(IDEAS_KEY, []);
    return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar || '✦',
        createdAt: user.createdAt,
        publishedCount: ideas.filter(i => i.authorId === user.id && i.isPublic).length,
    };
}

export async function getById(id) {
    const users = storage.read(USERS_KEY, []);
    return publicView(users.find(u => u.id === id));
}

export async function getByUsername(username) {
    username = (username || '').toLowerCase();
    const users = storage.read(USERS_KEY, []);
    return publicView(users.find(u => u.username === username));
}

export async function listAll() {
    const users = storage.read(USERS_KEY, []);
    return users.map(publicView);
}
