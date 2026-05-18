/**
 * glContext.js
 * ----------------------------------------------------------------
 * Singleton WebGL-контекст для рендера камней:
 *   - lazy-init контекста + компиляции шейдеров
 *   - dummy 1×1 текстура (для sampler u_albedoTex когда нет PNG)
 *   - утилиты: compileProgram, hexToVec3, hashSeed, setVec3/setInt/setFloat
 *   - uploadTexture(img) — загрузить HTMLImageElement как WebGL-текстуру
 *
 * Контекст один на всё приложение. После init() поля gl/prog/buf/canvas
 * заполнены, dummyTex доступна. supported=false означает фолбэк на canvas2d.
 */

import { VERT_SRC }  from './stoneVertex.glsl.js';
import { FRAG_SRC }  from './stoneShader.glsl.js';

let gl       = null;
let prog     = null;
let buf      = null;
let canvas   = null;
let dummyTex = null;
let inited    = false;
let supported = true;

/** Lazy init. Идемпотентна. Возвращает true если WebGL доступен. */
export function init() {
    if (inited) return supported;
    inited = true;
    try {
        canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        gl = canvas.getContext('webgl', {
            premultipliedAlpha: false,
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: true,
        }) || canvas.getContext('experimental-webgl');
        if (!gl) { supported = false; return false; }

        prog = compileProgram(gl, VERT_SRC, FRAG_SRC);
        if (!prog) { supported = false; return false; }

        buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER,
            new Float32Array([-1,-1,  1,-1,  -1,1,  1,1]),
            gl.STATIC_DRAW);

        // Заглушка 1×1: всегда что-то привязано к u_albedoTex
        dummyTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, dummyTex);
        gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
            new Uint8Array([0, 0, 0, 0])
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } catch (err) {
        console.warn('[glContext] WebGL init failed:', err);
        supported = false;
    }
    return supported;
}

// =================================================================
// Геттеры (после init)
// =================================================================
export const getGl       = () => gl;
export const getProgram  = () => prog;
export const getBuffer   = () => buf;
export const getCanvas   = () => canvas;
export const getDummyTex = () => dummyTex;
export const isSupported = () => supported && inited;

// =================================================================
// Компиляция шейдеров
// =================================================================

function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('[glContext] shader error:', gl.getShaderInfoLog(sh));
        console.error(src);
        gl.deleteShader(sh);
        return null;
    }
    return sh;
}

function compileProgram(gl, vs, fs) {
    const v = compileShader(gl, gl.VERTEX_SHADER, vs);
    const f = compileShader(gl, gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    const p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error('[glContext] link error:', gl.getProgramInfoLog(p));
        return null;
    }
    return p;
}

// =================================================================
// Загрузка PNG-изображения как WebGL-текстуры
// =================================================================

/** Залить HTMLImageElement в WebGL-текстуру. Возвращает WebGLTexture или null. */
export function uploadTexture(img) {
    if (!gl) return null;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
}

// =================================================================
// Цветовые и хэш-утилиты
// =================================================================

export function hexToVec3(hex) {
    if (!hex) return [0.5, 0.5, 0.5];
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
    ];
}

export function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    }
    return (h >>> 0) % 1000;
}

// =================================================================
// Униформы
// =================================================================

export function setVec3(gl, prog, name, v) {
    gl.uniform3f(gl.getUniformLocation(prog, name), v[0], v[1], v[2]);
}
export function setInt(gl, prog, name, x) {
    gl.uniform1i(gl.getUniformLocation(prog, name), x);
}
export function setFloat(gl, prog, name, x) {
    gl.uniform1f(gl.getUniformLocation(prog, name), x);
}
