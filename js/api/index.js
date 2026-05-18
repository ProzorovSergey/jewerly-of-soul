/**
 * api/index.js
 * ----------------------------------------------------------------
 * Точка переключения реализаций. Сейчас используется localStorage,
 * в будущем — можно подменить на remote-API одной строкой.
 *
 * Все остальные модули должны импортировать API через этот файл,
 * а не напрямую из ./local/*.
 *
 *     import { authApi, ideaApi, userApi, aiApi } from '../api/index.js';
 */

import * as authApi from './local/authApi.js';
import * as ideaApi from './local/ideaApi.js';
import * as userApi from './local/userApi.js';
import * as aiApi   from './local/aiApi.js';

export { authApi, ideaApi, userApi, aiApi };
