/**
 * remote/client.js
 * ----------------------------------------------------------------
 * Низкоуровневый HTTP-клиент к backend «Jewerly of Soul».
 * Все remote-реализации API ходят на сервер только через него.
 *
 * Backend живёт на том же домене, что и сайт: /api/
 * Токен сессии хранится в localStorage и шлётся заголовком
 * X-Auth-Token (его, в отличие от Authorization, хостинг не режет).
 */

import * as storage from '../../core/userStorage.js';

/** Базовый адрес backend. На reg.ru сайт и /api лежат на одном домене. */
const API_BASE  = '/api/';
const TOKEN_KEY = 'auth:token';

export function getToken()      { return storage.read(TOKEN_KEY, null); }
export function setToken(token) { if (token) storage.write(TOKEN_KEY, token); }
export function clearToken()    { storage.remove(TOKEN_KEY); }

/**
 * Выполнить запрос к API.
 * @param {string} route          маршрут, например 'auth/login'
 * @param {Object} [opts]
 * @param {string} [opts.method]  'GET' | 'POST'
 * @param {Object} [opts.body]    тело запроса (будет сериализовано в JSON)
 * @param {Object} [opts.query]   доп. query-параметры
 * @returns {Promise<Object>}     разобранный JSON-ответ
 */
export async function api(route, opts = {}) {
    const { method = 'GET', body = null, query = null } = opts;

    let url = API_BASE + '?route=' + encodeURIComponent(route);
    if (query) {
        for (const [k, v] of Object.entries(query)) {
            if (v != null && v !== '') {
                url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v);
            }
        }
    }

    const headers = {};
    const token = getToken();
    if (token) headers['X-Auth-Token'] = token;

    const init = { method, headers };
    if (body != null) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch(url, init);
    } catch (err) {
        throw new Error('Нет связи с сервером. Проверьте интернет-соединение.');
    }

    let data = {};
    try { data = await res.json(); } catch (_) { data = {}; }

    if (!res.ok || data.error) {
        const e = new Error(data.error || ('Ошибка сервера (' + res.status + ')'));
        e.status = res.status;
        throw e;
    }
    return data;
}
