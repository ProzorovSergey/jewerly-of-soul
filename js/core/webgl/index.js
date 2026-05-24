/**
 * webgl/index.js
 * ----------------------------------------------------------------
 * Главный entry-point рендера камней. Собирает glContext, шейдер и
 * albedoLoader в публичный API:
 *
 *   generateStoneTexture(stone, pixelSize, variant) → HTMLCanvasElement
 *   preloadAlbedos(catalogue, opts)
 *   onAlbedoReady(stoneId, cb)
 *   clearTextureCache()
 *
 * Сам рендер: WebGL рисует на оффскрин-canvas, кадр копируется на
 * выходной 2D-canvas через drawImage — это даёт стабильный кадр
 * (preserveDrawingBuffer тут не помог бы при повторных рендерах).
 *
 * Render-кэш: до 600 записей по ключу `${id}_${size}_${variant}`.
 * При загрузке нового PNG кэш инвалидируется для соответствующего
 * stoneId через подписку на onAnyAlbedoReady.
 */

import {
    init, getGl, getProgram, getBuffer, getCanvas, getDummyTex,
    setVec3, setInt, setFloat, hexToVec3, hashSeed,
} from './glContext.js';
import { TEXTURE_TYPE, FINISH } from './stoneShader.glsl.js';
import {
    tryLoadAlbedo, getAlbedo, hasPendingLoad,
    preloadAlbedos as _preloadAlbedos,
    onAlbedoReady as _onAlbedoReady,
    onAnyAlbedoReady,
} from './albedoLoader.js';

// =================================================================
// Render-кэш
// =================================================================

const cache = new Map();      // key → HTMLCanvasElement
// Текстуры теперь рендерятся «с запасом» по разрешению (до 512²),
// поэтому каждая запись тяжелее — лимит снижен, чтобы не раздувать память.
const CACHE_LIMIT = 400;

function cacheKey(stone, pixelSize, variant) {
    return `${stone.id}_${Math.round(pixelSize)}_${variant}`;
}

function trimCache() {
    if (cache.size <= CACHE_LIMIT) return;
    const drop = Math.ceil(cache.size * 0.25);
    let i = 0;
    for (const k of cache.keys()) {
        cache.delete(k);
        if (++i >= drop) break;
    }
}

// При появлении нового PNG-альбедо — выбрасываем все рендеры этого камня,
// чтобы следующий вызов перерисовал с фото-текстурой.
onAnyAlbedoReady(stoneId => {
    for (const k of [...cache.keys()]) {
        if (k.startsWith(stoneId + '_')) cache.delete(k);
    }
});

export function clearTextureCache() { cache.clear(); }

// =================================================================
// Главная функция — generateStoneTexture
// =================================================================

export function generateStoneTexture(stone, pixelSize, variant = 0) {
    const key = cacheKey(stone, pixelSize, variant);
    if (cache.has(key)) return cache.get(key);

    // Камень рендерится «с запасом» по разрешению, чтобы не выглядеть
    // пиксельным. На retina-экранах одна CSS-точка — это 2-3 реальных
    // пикселя; вдобавок берём 2× supersample под аккуратный даунскейл.
    // Потолок 512 — ровно размер исходных PNG-альбедо, выше нет смысла.
    // Кэш-ключ остаётся по запрошенному размеру, физический — крупнее.
    const requested = Math.max(8, Math.round(pixelSize));
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const size = Math.min(512, Math.max(requested, Math.round(requested * dpr * 2)));

    if (!init()) {
        return renderFallback(stone, size, variant);
    }

    try {
        return renderWebGL(stone, size, variant, key);
    } catch (err) {
        console.warn('[stoneRenderer] WebGL render failed for', stone.id, err);
        return renderFallback(stone, size, variant);
    }
}

function renderWebGL(stone, size, variant, key) {
    const gl     = getGl();
    const prog   = getProgram();
    const buf    = getBuffer();
    const canvas = getCanvas();
    const dummy  = getDummyTex();

    canvas.width = size;
    canvas.height = size;
    gl.viewport(0, 0, size, size);

    gl.useProgram(prog);

    const pal = stone.palette || {};
    setVec3(gl, prog, 'u_base',      hexToVec3(pal.base      || stone.color || '#888'));
    setVec3(gl, prog, 'u_highlight', hexToVec3(pal.highlight || '#FFFFFF'));
    setVec3(gl, prog, 'u_shadow',    hexToVec3(pal.shadow    || '#000000'));
    setVec3(gl, prog, 'u_accent',    hexToVec3(pal.accent    || pal.base   || '#888'));
    setVec3(gl, prog, 'u_deep',      hexToVec3(pal.deep      || '#000000'));

    const flashes = stone.flashes || [];
    setVec3(gl, prog, 'u_flash0', hexToVec3(flashes[0] || pal.highlight || '#FFFFFF'));
    setVec3(gl, prog, 'u_flash1', hexToVec3(flashes[1] || pal.accent    || '#FFFFFF'));
    setVec3(gl, prog, 'u_flash2', hexToVec3(flashes[2] || pal.deep      || '#000000'));

    setInt(gl, prog, 'u_textureType', TEXTURE_TYPE[stone.texture] ?? 2);
    setInt(gl, prog, 'u_finish',
        stone.finish === 'matte' ? FINISH.matte :
        stone.finish === 'transparent' ? FINISH.transparent : FINISH.polished);
    setFloat(gl, prog, 'u_variant', variant * 0.7);
    setFloat(gl, prog, 'u_seed', hashSeed(stone.id));

    // PNG-альбедо: всегда привязываем sampler к unit 0
    const albedoEntry = getAlbedo(stone.id);
    const hasTexture = !!(albedoEntry && albedoEntry.status === 'ready' && albedoEntry.texture);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, hasTexture ? albedoEntry.texture : dummy);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_albedoTex'), 0);
    setInt(gl, prog, 'u_hasTexture', hasTexture ? 1 : 0);

    // Если ещё не пробовали — стартанём фоновую загрузку
    if (!albedoEntry && !hasPendingLoad(stone.id)) {
        tryLoadAlbedo(stone.id);
    }

    const locPos = gl.getAttribLocation(prog, 'a_pos');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Копируем WebGL-frame в "внешний" 2D-canvas — стабильный кадр
    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    out.getContext('2d').drawImage(canvas, 0, 0);

    cache.set(key, out);
    trimCache();
    return out;
}

// =================================================================
// Fallback (если WebGL недоступен)
// =================================================================

function renderFallback(stone, size, variant) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    const base = (stone.color || stone.palette?.base) || '#888';
    const cx = size / 2, cy = size / 2;
    const g = ctx.createRadialGradient(cx * 0.7, cy * 0.7, 1, cx, cy, size / 2);
    g.addColorStop(0, lighten(base, 0.5));
    g.addColorStop(0.5, base);
    g.addColorStop(1, darken(base, 0.6));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    return c;
}

function lighten(hex, t) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0,2), 16);
    const g = parseInt(hex.slice(2,4), 16);
    const b = parseInt(hex.slice(4,6), 16);
    const f = v => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0');
    return '#' + f(r) + f(g) + f(b);
}
function darken(hex, t) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0,2), 16);
    const g = parseInt(hex.slice(2,4), 16);
    const b = parseInt(hex.slice(4,6), 16);
    const f = v => Math.round(v * (1 - t)).toString(16).padStart(2, '0');
    return '#' + f(r) + f(g) + f(b);
}

// =================================================================
// Re-export подписки на готовность PNG
// =================================================================

export const preloadAlbedos = _preloadAlbedos;
export const onAlbedoReady  = _onAlbedoReady;
