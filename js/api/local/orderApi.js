/**
 * local/orderApi.js
 * ----------------------------------------------------------------
 * Имитация заявок поверх localStorage — для предпросмотра на
 * localhost / GitHub Pages, где настоящего backend ещё нет.
 * Сигнатуры совпадают с js/api/remote/orderApi.js.
 *
 * На «боевом» домене (reg.ru) вместо этого файла подключается
 * remote/orderApi.js — переключение в js/api/index.js.
 */

import * as storage from '../../core/userStorage.js';
import * as authApi from './authApi.js';

const ORDERS_KEY = 'orders';
const STATUSES = ['new', 'accepted', 'in_progress', 'done', 'cancelled'];

function readOrders()  { return storage.read(ORDERS_KEY, []); }
function writeOrders(a) { storage.write(ORDERS_KEY, a); }

function makeCode() {
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let s = '';
    for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return 'JOS-' + s;
}

export async function create(order) {
    const me = await authApi.getCurrentUser();
    const now = new Date().toISOString();
    const rec = {
        id: storage.uid(),
        publicCode: makeCode(),
        userId: me ? me.id : null,
        contactName: order.contactName || '',
        contactMethod: order.contactMethod || 'other',
        contactValue: order.contactValue || '',
        composition: order.composition || [],
        braceletLength: order.braceletLength != null ? order.braceletLength : null,
        comment: order.comment || null,
        status: 'new',
        adminNote: null,
        createdAt: now,
        updatedAt: now,
    };
    const all = readOrders();
    all.unshift(rec);
    writeOrders(all);
    return rec;
}

export async function listMine() {
    const me = await authApi.getCurrentUser();
    if (!me) return [];
    return readOrders().filter(o => o.userId === me.id);
}

export async function listAll(status) {
    let all = readOrders();
    if (status) all = all.filter(o => o.status === status);
    return all;
}

export async function get({ id, code } = {}) {
    const all = readOrders();
    return all.find(o => o.id === id || o.publicCode === code) || null;
}

export async function setStatus(id, status, adminNote) {
    if (!STATUSES.includes(status)) throw new Error('Недопустимый статус');
    const all = readOrders();
    const o = all.find(x => x.id === id);
    if (!o) throw new Error('Заявка не найдена');
    o.status = status;
    if (adminNote !== undefined) o.adminNote = adminNote || null;
    o.updatedAt = new Date().toISOString();
    writeOrders(all);
    return o;
}
