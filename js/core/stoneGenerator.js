/**
 * stoneGenerator.js
 * ----------------------------------------------------------------
 * Совместимый прокси-модуль. Внутри — WebGL PBR-рендер
 * (webglStoneRenderer.js). Сохраняет старое имя экспорта
 * generateStoneTexture, чтобы все потребители (bracelet.js,
 * страницы) работали без изменений.
 */

export {
    generateStoneTexture,
    clearTextureCache,
    preloadAlbedos,
    onAlbedoReady,
} from './webglStoneRenderer.js';
