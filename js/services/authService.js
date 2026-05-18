/**
 * authService.js
 * ----------------------------------------------------------------
 * Бизнес-логика авторизации поверх AuthAPI. Дополнительно:
 *  - кэш текущего пользователя в памяти (избавляет от частых читок);
 *  - событие 'auth:change' через CustomEvent — UI подписывается и
 *    перерисовывает шапку/защищённые места без перезагрузки.
 *
 * UI-код должен использовать ТОЛЬКО этот модуль (никаких прямых
 * вызовов authApi).
 */

import { authApi } from '../api/index.js';

let _cached = undefined;     // undefined = ещё не загружен, null = нет, User = есть
const listeners = new Set();

function emit() {
    for (const fn of listeners) {
        try { fn(_cached); } catch (e) { console.error(e); }
    }
    // также шлём событие на document — для слабосвязанных потребителей
    try {
        document.dispatchEvent(new CustomEvent('auth:change', { detail: _cached }));
    } catch (_) { /* SSR/тесты */ }
}

/** Подписаться на смену юзера. Возвращает функцию-отписку. */
export function onAuthChange(cb) {
    listeners.add(cb);
    // если уже знаем — сообщим сразу
    if (_cached !== undefined) {
        try { cb(_cached); } catch (e) { console.error(e); }
    }
    return () => listeners.delete(cb);
}

/** Текущий юзер. Кэшируется. */
export async function getCurrentUser() {
    if (_cached === undefined) {
        _cached = await authApi.getCurrentUser();
    }
    return _cached;
}

export async function register(creds) {
    const user = await authApi.register(creds);
    _cached = user;
    emit();
    return user;
}

export async function login(creds) {
    const { user } = await authApi.login(creds);
    _cached = user;
    emit();
    return user;
}

export async function logout() {
    await authApi.logout();
    _cached = null;
    emit();
}

export async function updateProfile(patch) {
    const updated = await authApi.updateProfile(patch);
    _cached = updated;
    emit();
    return updated;
}

/** Принудительно перечитать (например после внешних изменений). */
export async function refresh() {
    _cached = await authApi.getCurrentUser();
    emit();
    return _cached;
}

/** Истина, если юзер залогинен. */
export async function isAuthenticated() {
    const u = await getCurrentUser();
    return !!u;
}
