/**
 * seedService.js
 * ----------------------------------------------------------------
 * Если localStorage ещё не засеян, подгружает data/community.seed.json
 * и заливает пользователей и идеи в локальную базу. Дальше работает
 * как обычная база — пользователи могут лайкать/добавлять свои идеи.
 */

import * as storage from '../core/userStorage.js';
import * as authApiLocal from '../api/local/authApi.js';
import * as ideaApiLocal from '../api/local/ideaApi.js';

const SEED_URL = './data/community.seed.json';

/** Засеять локальную базу seed-данными (если ещё не засеяна). */
export async function ensureSeed() {
    if (storage.isSeedLoaded()) return;
    try {
        const res = await fetch(SEED_URL, { cache: 'no-cache' });
        if (!res.ok) throw new Error('seed http ' + res.status);
        const data = await res.json();

        for (const u of data.users || []) authApiLocal._seedUser(u);
        ideaApiLocal._seedIdeas(data.ideas || []);

        storage.markSeedLoaded();
        console.info('[seed] community seed loaded:', (data.users||[]).length, 'users,', (data.ideas||[]).length, 'ideas');
    } catch (err) {
        console.warn('[seed] failed to load:', err);
    }
}
