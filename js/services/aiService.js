/**
 * aiService.js
 * ----------------------------------------------------------------
 * Сервис AI-помощника. Адаптирует входной формат «массив stoneRef»
 * к тому, что ожидает aiApi (обогащённый список с полным объектом
 * камня), и кэширует ответы в памяти на время сессии.
 */

import { aiApi } from '../api/index.js';
import { loadStones } from '../core/database.js';

let _catalogue = null;
async function catalogue() {
    if (!_catalogue) _catalogue = (await loadStones()).stones;
    return _catalogue;
}

const cache = new Map();
function cacheKey(req) {
    return (req.stones || []).map(s => `${s.id}@${s.size}`).join(',') + '|' + (req.length || 0);
}

/**
 * Описать энергетику браслета.
 * @param {{stones: {id:string, size:number}[], length:number, intent?:string}} req
 * @returns {Promise<AIDescribeResponse>}
 */
export async function describe(req) {
    const key = cacheKey(req);
    if (cache.has(key)) return cache.get(key);

    const cat = await catalogue();
    const enriched = (req.stones || []).map(s => {
        const full = cat.find(c => c.id === s.id);
        return { ...s, stone: full || null };
    }).filter(s => s.stone);

    const out = await aiApi.describe({
        stones: enriched,
        length: req.length || 180,
        intent: req.intent || '',
    });
    cache.set(key, out);
    return out;
}
