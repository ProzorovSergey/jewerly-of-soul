/**
 * local/authApi.js
 * ----------------------------------------------------------------
 * Реализация AuthAPI поверх localStorage — для предпросмотра без
 * backend (localhost / GitHub Pages). Вход по e-mail, как и в
 * remote-версии: контракты local и remote совпадают.
 *
 * `username` — производный логин (из e-mail), нужен для
 * совместимости с лентой сообщества и seed-данными.
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

/** Подобрать свободный username на основе e-mail. */
function deriveUsername(users, email) {
    let base = (email.split('@')[0] || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (base.length < 3) base = 'user' + base;
    base = base.slice(0, 50);
    let candidate = base;
    let n = 1;
    while (users.some(u => u.username === candidate)) {
        n++;
        candidate = base + n;
    }
    return candidate;
}

/** Зарегистрировать нового пользователя. */
export async function register({ email, password, displayName }) {
    email = (email || '').trim().toLowerCase();
    displayName = (displayName || '').trim();
    password = password || '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Введите корректный e-mail');
    if (password.length < 6) throw new Error('Пароль должен быть не короче 6 символов');
    if (displayName.length < 1) throw new Error('Укажите имя');

    const users = readUsers();
    if (users.some(u => (u.email || '').toLowerCase() === email)) {
        throw new Error('Пользователь с такой почтой уже зарегистрирован');
    }

    const salt = storage.makeSalt();
    const passwordHash = await storage.hashPassword(password, salt);

    const user = {
        id: storage.uid(),
        email,
        username: deriveUsername(users, email),
        displayName,
        avatar: generateAvatar(displayName),
        role: 'user',
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
export async function login({ email, password }) {
    email = (email || '').trim().toLowerCase();
    const users = readUsers();
    const user = users.find(u => (u.email || '').toLowerCase() === email);
    // Один и тот же текст ошибки — чтобы не подсказывать, что именно неверно.
    if (!user) throw new Error('Неверная почта или пароль');

    const ok = await storage.verifyPassword(password || '', user.salt, user.passwordHash);
    if (!ok) throw new Error('Неверная почта или пароль');

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

/**
 * Восстановление пароля в режиме предпросмотра (localStorage) не
 * работает — письма отправлять некому. Заглушки сохраняют контракт
 * с remote-версией, чтобы страницы не падали.
 */
export async function requestPasswordReset(email, hp) {
    return { ok: true, preview: true };
}

export async function resetPassword(token, password) {
    throw new Error('Восстановление пароля доступно только на основном сайте.');
}

/** Внутренняя функция: добавить юзера напрямую (для seed). */
export function _seedUser(user) {
    const users = readUsers();
    if (users.some(u => u.id === user.id || u.username === user.username)) return;
    users.push(user);
    writeUsers(users);
}
