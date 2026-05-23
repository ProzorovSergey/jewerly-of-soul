/**
 * remote/authApi.js
 * ----------------------------------------------------------------
 * Реализация AuthAPI поверх настоящего backend (PHP + MySQL).
 * Сигнатуры совпадают с js/api/local/authApi.js, кроме того, что
 * вход теперь по e-mail (а не по логину).
 *
 * См. AuthAPI в js/api/interfaces.js
 */

import { api, setToken, clearToken, getToken } from './client.js';

/** Регистрация. creds: { email, password, displayName, consent }. */
export async function register({ email, password, displayName, consent }) {
    const data = await api('auth/register', {
        method: 'POST',
        body: { email, password, displayName, consent: !!consent },
    });
    if (data.session && data.session.token) setToken(data.session.token);
    return data.user;
}

/** Вход. creds: { email, password }. */
export async function login({ email, password }) {
    const data = await api('auth/login', {
        method: 'POST',
        body: { email, password },
    });
    if (data.session && data.session.token) setToken(data.session.token);
    return { user: data.user, session: data.session };
}

/** Выход. */
export async function logout() {
    try { await api('auth/logout', { method: 'POST' }); }
    catch (_) { /* даже если сервер недоступен — токен локально гасим */ }
    clearToken();
}

/** Текущий пользователь или null. */
export async function getCurrentUser() {
    if (!getToken()) return null;
    try {
        const data = await api('auth/me');
        if (!data.user) clearToken();
        return data.user || null;
    } catch (err) {
        // 401 — токен протух/недействителен: гасим его.
        // Сетевая ошибка — считаем «не вошёл», сайт при этом не падает.
        if (err.status === 401) clearToken();
        return null;
    }
}

/** Обновить поля профиля. */
export async function updateProfile(patch) {
    const data = await api('auth/update', { method: 'POST', body: patch });
    return data.user;
}
