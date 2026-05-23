/**
 * remote/orderApi.js
 * ----------------------------------------------------------------
 * Заявки на сборку браслетов поверх настоящего backend.
 *
 * Объект Order:
 *   { id, publicCode, userId, contactName, contactMethod, contactValue,
 *     composition: BraceletStoneRef[], braceletLength, comment,
 *     status, adminNote, createdAt, updatedAt }
 *
 *   status: 'new' | 'accepted' | 'in_progress' | 'done' | 'cancelled'
 */

import { api } from './client.js';

/** Создать заявку. Доступно и гостям, и вошедшим пользователям. */
export async function create(order) {
    const data = await api('orders/create', { method: 'POST', body: order });
    return data.order;
}

/** Заявки текущего пользователя. */
export async function listMine() {
    const data = await api('orders/mine');
    return data.orders || [];
}

/** Все заявки (только администратор). status — необязательный фильтр. */
export async function listAll(status) {
    const data = await api('orders/list', { query: status ? { status } : null });
    return data.orders || [];
}

/** Одна заявка по id или публичному коду. */
export async function get({ id, code } = {}) {
    const data = await api('orders/get', { query: { id, code } });
    return data.order;
}

/** Сменить статус заявки (только администратор). */
export async function setStatus(id, status, adminNote) {
    const body = { id, status };
    if (adminNote !== undefined) body.adminNote = adminNote;
    const data = await api('orders/status', { method: 'POST', body });
    return data.order;
}
