/**
 * authApi.js
 * ----------------------------------------------------------------
 * Реализация AuthAPI поверх localStorage.
 * Хранит пользователей в ключе 'users' и текущую сессию в 'session'.
 *
 * См. AuthAPI в js/api/interfaces.js
 */

import * as storage from '../../core/userStorage.js';

const USERS_KEY   = 'users';     // массив User
const SESSION_KEY = 'session';   // объект Session

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

function readUsers() { return storage.read(USERS_KEY, []); }
function writeUsers(arr) { return storage.write(USERS_KEY, arr); }

function generateAvatar(displayName) {
    const trimmed = (displayName || '').trim();
    if (!trimmed) return '✦';
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Зарегистрировать нового пользователя. */
export async function register({ username, password, displayName }) {
    username = (username || '').trim().toLowerCase();
    displayName = (displayName || '').trim();

    if (username.length < 3) throw new Error('Логин должен быть не короче 3 символов');
    if (!/^[a-z0-9_.-]+$/.test(username)) throw new Error('Логин может содержать только латиницу, цифры, _ . -');
    if (password.length < 6) throw new Error('Пароль должен быть не короче 6 символов');
    if (displayName.length < 1) throw new Error('Укажите имя пользователя');

    const users = readUsers();
    if (users.some(u => u.username === username)) {
        throw new Error('Логин уже занят');
    }

    const salt = storage.makeSalt();
    const passwordHash = await storage.hashPassword(password, salt);

    const user = {
        id: storage.uid(),
        username,
        displayName,
        avatar: generateAvatar(displayName),
        passwordHash,
        salt,
        createdAt: new Date().toISOString(),
        likes: [],
        favorites: [],
        publishedIdeas: [],
    };

    users.push(user);
    writeUsers(users);

    // Сразу залогиниваем
    await openSession(user);
    return user;
}

/** Войти. */
export async function login({ username, password }) {
    username = (username || '').trim().toLowerCase();
    const users = readUsers();
    const user = users.find(u => u.username === username);
    if (!user) throw new Error('Пользователь не найден');

    const ok = await storage.verifyPassword(password, user.salt, user.passwordHash);
    if (!ok) throw new Error('Неверный пароль');

    const session = await openSession(user);
    return { user, session };
}

/** Открыть новую сессию (без проверки пароля — для register/login). */
async function openSession(user) {
    const session = {
        token: storage.uid(),
        userId: user.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    };
    storage.write(SESSION_KEY, session);
    return session;
}

/** Выйти. */
export async function logout() {
    storage.remove(SESSION_KEY);
}

/** Текущий пользователь или null. */
export async function getCurrentUser() {
    const session = storage.read(SESSION_KEY);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
        storage.remove(SESSION_KEY);
        return null;
    }
    const users = readUsers();
    return users.find(u => u.id === session.userId) || null;
}

/** Обновить поля профиля. */
export async function updateProfile(patch) {
    const me = await getCurrentUser();
    if (!me) throw new Error('Нужно войти');
    const users = readUsers();
    const idx = users.findIndex(u => u.id === me.id);
    if (idx < 0) throw new Error('Пользователь не найден');

    const allowed = ['displayName', 'avatar', 'likes', 'favorites', 'publishedIdeas'];
    for (const k of allowed) {
        if (k in patch) users[idx][k] = patch[k];
    }
    writeUsers(users);
    return users[idx];
}

/** Внутренняя функция: добавить юзера напрямую (для seed). */
export function _seedUser(user) {
    const users = readUsers();
    if (users.some(u => u.id === user.id || u.username === user.username)) return;
    users.push(user);
    writeUsers(users);
}
