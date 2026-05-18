/**
 * userStorage.js
 * ----------------------------------------------------------------
 * Низкоуровневая обёртка над window.localStorage:
 *  - неймспейс ключей с префиксом проекта;
 *  - JSON (де)сериализация;
 *  - утилиты для хеширования паролей через WebCrypto;
 *  - генерация id-токенов.
 *
 * Этот модуль — единственное место, где код напрямую обращается
 * к localStorage. Всё остальное (api, services) работает через
 * него.  Когда подключим реальный backend — нужно будет заменить
 * только этот файл и js/api/local/*.
 */

const PREFIX = 'auraline:v1:';

// =================================================================
// БАЗОВЫЕ ОПЕРАЦИИ
// =================================================================

/** Прочитать значение из localStorage. Возвращает defaultValue, если нет/невалидно. */
export function read(key, defaultValue = null) {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        if (raw == null) return defaultValue;
        return JSON.parse(raw);
    } catch (err) {
        console.warn('[userStorage] read failed:', key, err);
        return defaultValue;
    }
}

/** Записать значение в localStorage. */
export function write(key, value) {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
    } catch (err) {
        console.warn('[userStorage] write failed:', key, err);
        return false;
    }
}

/** Удалить ключ. */
export function remove(key) {
    try {
        localStorage.removeItem(PREFIX + key);
    } catch (_) { /* noop */ }
}

/** Перечислить все ключи проекта (без префикса). */
export function keys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
    }
    return out;
}

// =================================================================
// УНИКАЛЬНЫЕ ID
// =================================================================

/**
 * Сгенерировать псевдо-UUID v4. Используем crypto.randomUUID()
 * там, где доступно, иначе — фолбэк на Math.random().
 */
export function uid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// =================================================================
// ПАРОЛИ: SHA-256(salt + password)
// =================================================================
//
// Это НЕ production-уровень безопасности. Для production нужен
// bcrypt/argon2 на сервере. Здесь мы делаем хэш только чтобы
// в localStorage не лежал plain-text пароль. На защите диплома
// можно показать раздел README про переход на backend.

/** Случайная "соль" в виде hex-строки. */
export function makeSalt(bytes = 16) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return [...arr].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Хеширование пароля.
 * @returns {Promise<string>} hex-строка SHA-256 от (salt + password).
 */
export async function hashPassword(password, salt) {
    const enc = new TextEncoder();
    const data = enc.encode(salt + ':' + password);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Сравнить пароль с хэшем (constant-time-ish). */
export async function verifyPassword(password, salt, expectedHash) {
    const actual = await hashPassword(password, salt);
    if (actual.length !== expectedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) {
        diff |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
    }
    return diff === 0;
}

// =================================================================
// СИД-ДАННЫЕ ДЛЯ СООБЩЕСТВА
// =================================================================
//
// При первом запуске страницы лента сообщества должна быть
// наполненной — 10 «фейк-пользователей» с ~30 идеями. Эти данные
// загружаются один раз и сливаются с пользовательскими.

const SEED_LOADED_KEY = 'seed:community:loaded';

export function isSeedLoaded() {
    return read(SEED_LOADED_KEY, false) === true;
}

export function markSeedLoaded() {
    write(SEED_LOADED_KEY, true);
}

/** Перечитать сид-данные принудительно (для отладки). */
export function resetSeed() {
    remove(SEED_LOADED_KEY);
}

// =================================================================
// ОЧИСТКА (для отладки)
// =================================================================

/** Удалить ВСЕ ключи проекта. */
export function nukeAll() {
    for (const k of keys()) remove(k);
}
