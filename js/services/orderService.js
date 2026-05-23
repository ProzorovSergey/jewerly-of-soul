/**
 * orderService.js
 * ----------------------------------------------------------------
 * Бизнес-логика заявок поверх orderApi. UI-код (конструктор,
 * админ-панель, профиль) обращается к заявкам только через этот
 * модуль — не напрямую в api.
 *
 * Order:
 *   { id, publicCode, userId, contactName, contactMethod,
 *     contactValue, composition, braceletLength, comment,
 *     status, adminNote, createdAt, updatedAt }
 *
 *   status: 'new' | 'accepted' | 'in_progress' | 'done' | 'cancelled'
 */

import { orderApi } from '../api/index.js';

/** Человекочитаемые названия статусов. */
export const STATUS_LABELS = {
    new:         'Новая',
    accepted:    'Принята',
    in_progress: 'В работе',
    done:        'Готова',
    cancelled:   'Отменена',
};

/** Статусы по порядку — для фильтров и админ-панели. */
export const STATUS_ORDER = ['new', 'accepted', 'in_progress', 'done', 'cancelled'];

/** Создать заявку. */
export function create(order) {
    return orderApi.create(order);
}

/** Заявки текущего пользователя. */
export function listMine() {
    return orderApi.listMine();
}

/** Все заявки (для админ-панели). status — необязательный фильтр. */
export function listAll(status) {
    return orderApi.listAll(status);
}

/** Одна заявка по { id } или { code }. */
export function get(ref) {
    return orderApi.get(ref);
}

/** Сменить статус заявки (админ). */
export function setStatus(id, status, adminNote) {
    return orderApi.setStatus(id, status, adminNote);
}
