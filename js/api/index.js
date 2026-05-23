/**
 * api/index.js
 * ----------------------------------------------------------------
 * Точка переключения реализаций API.
 *
 *  • На «боевом» домене (reg.ru) авторизация, заявки, лента
 *    сообщества и профили идут через настоящий backend
 *    (PHP + MySQL) — папка ./remote/*.
 *  • На localhost и GitHub Pages, где backend нет, подключается
 *    локальная имитация на localStorage — папка ./local/*.
 *
 *  AI-ассистент пока всегда работает локально (mock на правилах).
 *
 * Все остальные модули импортируют API только отсюда:
 *   import { authApi, orderApi, ideaApi, userApi, aiApi } from '../api/index.js';
 */

import * as authLocal   from './local/authApi.js';
import * as orderLocal  from './local/orderApi.js';
import * as ideaLocal   from './local/ideaApi.js';
import * as userLocal   from './local/userApi.js';

import * as authRemote  from './remote/authApi.js';
import * as orderRemote from './remote/orderApi.js';
import * as ideaRemote  from './remote/ideaApi.js';
import * as userRemote  from './remote/userApi.js';

import * as aiApi from './local/aiApi.js';

/**
 * Есть ли у текущего домена backend.
 * localhost / 127.0.0.1 / file:// / *.github.io — предпросмотр без сервера.
 */
function backendAvailable() {
    const h = location.hostname;
    if (h === '' || h === 'localhost' || h === '127.0.0.1') return false;
    if (h.endsWith('.github.io')) return false;
    return true;
}

/** true — работаем через настоящий backend; false — локальная имитация. */
export const USE_BACKEND = backendAvailable();

const authApi  = USE_BACKEND ? authRemote  : authLocal;
const orderApi = USE_BACKEND ? orderRemote : orderLocal;
const ideaApi  = USE_BACKEND ? ideaRemote  : ideaLocal;
const userApi  = USE_BACKEND ? userRemote  : userLocal;

export { authApi, orderApi, ideaApi, userApi, aiApi };
