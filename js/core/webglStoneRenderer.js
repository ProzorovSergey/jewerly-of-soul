/**
 * webglStoneRenderer.js
 * ----------------------------------------------------------------
 * Совместимый прокси на новую модульную структуру js/core/webgl/*.
 * Сам код движка теперь разбит на:
 *   webgl/stoneVertex.glsl.js   — VS как строка
 *   webgl/stoneShader.glsl.js   — FS + TEXTURE_TYPE/FINISH
 *   webgl/glContext.js          — init, compile, dummy texture, утилиты
 *   webgl/albedoLoader.js       — асинхронная загрузка PNG + подписки
 *   webgl/index.js              — главный entry: render + кэш
 *
 * Этот файл оставлен для обратной совместимости — старые импорты
 * `import * from '../core/webglStoneRenderer.js'` продолжают работать.
 */

export {
    generateStoneTexture,
    clearTextureCache,
    preloadAlbedos,
    onAlbedoReady,
} from './webgl/index.js';
