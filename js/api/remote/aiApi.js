/**
 * remote/aiApi.js
 * ----------------------------------------------------------------
 * AI-описание энергетики браслета через backend (PHP → OpenAI).
 *
 * Бэкенд сам решает:
 *   • ключ OpenAI задан в api/config.php — описание генерирует
 *     настоящая нейросеть;
 *   • ключа нет или нейросеть недоступна — бэкенд возвращает
 *     result = null, и мы аккуратно откатываемся на локальное
 *     описание по правилам (тот же aiAssistant, что и без backend).
 *
 * Контракт describe() совпадает с js/api/local/aiApi.js.
 */

import { api } from './client.js';
import { describeBraceletEnergy } from '../../core/aiAssistant.js';

/**
 * @param {{stones: {id,size,stone}[], length:number, intent?:string}} req
 *        stones — уже обогащённый список (с полным объектом камня),
 *        его готовит aiService перед вызовом.
 * @returns {Promise<{energyDescription, recommendations, nameSuggestions}>}
 */
export async function describe(req) {
    // Бэкенду нужны только название/стихия/энергии камня — отправляем их.
    const stones = (req.stones || []).map(s => ({
        name:    (s.stone && s.stone.name)    || s.id || '',
        element: (s.stone && s.stone.element) || '',
        energy:  (s.stone && Array.isArray(s.stone.energy)) ? s.stone.energy : [],
        size:    s.size || 8,
    }));

    try {
        const data = await api('ai/describe', {
            method: 'POST',
            body: { stones, length: req.length || 180, intent: req.intent || '' },
        });
        if (data && data.result && data.result.energyDescription) {
            return data.result;
        }
    } catch (_) {
        /* нейросеть или сеть недоступны — мягкий откат ниже */
    }

    // Фолбэк: описание по встроенным правилам — сайт работает всегда.
    return describeBraceletEnergy(req);
}
