/**
 * remote/userApi.js
 * ----------------------------------------------------------------
 * Реализация UserAPI поверх настоящего backend — публичные
 * профили пользователей. Сигнатуры совпадают с js/api/local/userApi.js.
 *
 * См. UserAPI в js/api/interfaces.js
 */

import { api } from './client.js';

export async function getById(id) {
    const data = await api('users/get', { query: { id } });
    return data.user || null;
}

export async function getByUsername(username) {
    const data = await api('users/get', { query: { username } });
    return data.user || null;
}

export async function listAll() {
    const data = await api('users/list');
    return data.users || [];
}
