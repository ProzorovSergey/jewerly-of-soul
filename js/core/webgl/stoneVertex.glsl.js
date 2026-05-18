/**
 * stoneVertex.glsl.js
 * ----------------------------------------------------------------
 * Вершинный шейдер для рендера импостер-сферы камня.
 * Просто прокидывает координаты full-screen quad-а в [0,1].
 */

export const VERT_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;
