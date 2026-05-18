/**
 * albedoLoader.js
 * ----------------------------------------------------------------
 * Асинхронная загрузка PNG-альбедо камней и подписка на готовность.
 *
 * API:
 *   tryLoadAlbedo(stoneId)         → Promise<{texture, status}>
 *   preloadAlbedos(catalogue, opts) → запустить фоновую/жадную загрузку всего каталога
 *   onAlbedoReady(stoneId, cb)     → подписка на готовность PNG конкретного камня
 *   onAnyAlbedoReady(cb)           → подписка на любое успешное событие (для invalidate render-кэша)
 *   getAlbedo(stoneId)             → {texture, status} | undefined
 */

import { init, uploadTexture } from './glContext.js';

const ASSETS_DIR = './assets/stones/';

const albedoCache    = new Map();   // id → { texture, status: 'ready'|'missing' }
const albedoPending  = new Map();   // id → Promise
const perStoneSubs   = new Map();   // id → Set<cb>
const anySubs        = new Set();   // глобальные подписчики (для invalidate)

// =================================================================
// Загрузка изображения
// =================================================================

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('image not found: ' + url));
        img.src = url;
    });
}

// =================================================================
// Основной путь загрузки одного камня
// =================================================================

export async function tryLoadAlbedo(stoneId) {
    if (albedoCache.has(stoneId)) return albedoCache.get(stoneId);
    if (albedoPending.has(stoneId)) return albedoPending.get(stoneId);

    const p = (async () => {
        const url = `${ASSETS_DIR}${stoneId}.png`;
        try {
            const img = await loadImage(url);
            if (!init()) {
                const entry = { texture: null, status: 'missing' };
                albedoCache.set(stoneId, entry);
                return entry;
            }
            const tex = uploadTexture(img);
            const entry = { texture: tex, status: 'ready' };
            albedoCache.set(stoneId, entry);
            fireAnyReady(stoneId);
            firePerStoneReady(stoneId);
            return entry;
        } catch (err) {
            const entry = { texture: null, status: 'missing' };
            albedoCache.set(stoneId, entry);
            return entry;
        }
    })();

    albedoPending.set(stoneId, p);
    return p;
}

// =================================================================
// Получить запись из кэша (для index.js при render)
// =================================================================

export function getAlbedo(stoneId) {
    return albedoCache.get(stoneId);
}

export function hasPendingLoad(stoneId) {
    return albedoPending.has(stoneId);
}

// =================================================================
// Bulk-загрузка каталога
// =================================================================

/**
 * @param {Array} catalogue   массив stone-объектов
 * @param {Object} [opts]
 * @param {boolean} [opts.eager=false] — true: блокирующая Promise.all; false: fire-and-forget
 */
export async function preloadAlbedos(catalogue, opts = {}) {
    if (opts.eager) {
        await Promise.all(catalogue.map(s => tryLoadAlbedo(s.id).catch(() => null)));
        return;
    }
    catalogue.forEach(s => { tryLoadAlbedo(s.id).catch(() => null); });
}

// =================================================================
// Подписки
// =================================================================

/** Подписка на готовность PNG конкретного камня (вызывается ровно один раз). */
export function onAlbedoReady(stoneId, cb) {
    const entry = albedoCache.get(stoneId);
    if (entry && entry.status === 'ready') { cb(); return () => {}; }
    if (!perStoneSubs.has(stoneId)) perStoneSubs.set(stoneId, new Set());
    perStoneSubs.get(stoneId).add(cb);
    return () => perStoneSubs.get(stoneId)?.delete(cb);
}

/** Подписка на ЛЮБОЕ успешное событие (id → void). Используется render-кэшем для инвалидации. */
export function onAnyAlbedoReady(cb) {
    anySubs.add(cb);
    return () => anySubs.delete(cb);
}

function firePerStoneReady(stoneId) {
    const set = perStoneSubs.get(stoneId);
    if (!set) return;
    for (const cb of set) {
        try { cb(); } catch (e) { console.error(e); }
    }
    set.clear();
}

function fireAnyReady(stoneId) {
    for (const cb of anySubs) {
        try { cb(stoneId); } catch (e) { console.error(e); }
    }
}
