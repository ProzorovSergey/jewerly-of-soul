/**
 * aiApi.js
 * ----------------------------------------------------------------
 * Mock-реализация AIAPI. Имитирует асинхронный вызов AI-сервиса
 * с задержкой ~600 мс. Реальную rule-based генерацию делает
 * js/core/aiAssistant.js.
 *
 * Когда подключим реальный backend (OpenAI / Anthropic / Supabase
 * Edge Functions) — заменим только этот файл.
 */

import { describeBraceletEnergy } from '../../core/aiAssistant.js';

export async function describe(req) {
    const delay = 500 + Math.random() * 400;
    await new Promise(r => setTimeout(r, delay));
    return describeBraceletEnergy(req);
}
