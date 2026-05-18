/**
 * stoneShader.glsl.js
 * ----------------------------------------------------------------
 * Фрагментный шейдер PBR-рендера камня + перечисления типов.
 *
 * Алгоритм:
 *   1. Нормаль импостер-сферы из UV.
 *   2. Альбедо — либо из PNG-текстуры, либо по 15 процедурным алгоритмам.
 *   3. Lambert diffuse + GGX/Cook-Torrance specular + AO у силуэта.
 *   4. SSS для прозрачных финишей + лёгкий clearcoat.
 *   5. Reinhard tonemap (мягкий для PNG-режима).
 *
 * Маска силуэта — комбинация sphere-impostor + альфа PNG (что меньше).
 */

export const TEXTURE_TYPE = {
    crystalline: 0, inclusions: 1, smooth: 2, glossy: 3, banded: 4,
    sparkle:     5, swirl:      6, milky:  7, iridescent: 8, metallic: 9,
    concentric: 10, veined:    11, needle: 12, striated:  13, moss:    14,
};

export const FINISH = { polished: 0, matte: 1, transparent: 2 };

export const FRAG_SRC = `
precision highp float;
varying vec2 v_uv;

uniform vec3 u_base, u_highlight, u_shadow, u_accent, u_deep;
uniform vec3 u_flash0, u_flash1, u_flash2;
uniform int  u_textureType;
uniform int  u_finish;          // 0 polished, 1 matte, 2 transparent
uniform float u_variant;
uniform float u_seed;
uniform int       u_hasTexture; // 1 если есть PNG albedo, иначе 0
uniform sampler2D u_albedoTex;

// --- Хэш-шумы (детерминированные) ---
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p, int oct) {
    float s = 0.0; float a = 0.5; float f = 1.0;
    for (int i = 0; i < 6; i++) {
        if (i >= oct) break;
        s += a * vnoise(p * f);
        f *= 2.03; a *= 0.5;
    }
    return s;
}

vec2 swirlUV(vec2 p, float k) {
    return p + vec2(fbm(p + 7.1, 4), fbm(p + 3.7, 4)) * k;
}

float veined(vec2 p) {
    float n = fbm(p, 5);
    return smoothstep(0.45, 0.5, n) * 0.6 + smoothstep(0.5, 0.55, n) * 0.4;
}

float rings(vec2 p, float freq) {
    float r = length(p);
    return 0.5 + 0.5 * sin(r * freq + fbm(p, 3) * 2.5);
}

float bands(vec2 p) {
    return 0.5 + 0.5 * sin(p.y * 8.0 + fbm(p, 4) * 3.0);
}

float facets(vec2 p) {
    vec2 g = floor(p * 3.0);
    vec2 f = fract(p * 3.0);
    float minD = 8.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 of = vec2(float(i), float(j));
            vec2 r = of + vec2(hash21(g + of + 1.0), hash21(g + of + 5.0)) - f;
            float d = dot(r, r);
            minD = min(minD, d);
        }
    }
    return clamp(minD, 0.0, 1.0);
}

void main() {
    // [-1, 1] координата
    vec2 uv = v_uv * 2.0 - 1.0;
    float r2 = dot(uv, uv);
    if (r2 > 1.0) { gl_FragColor = vec4(0.0); return; }

    float edge = 1.0 - smoothstep(0.97, 1.0, sqrt(r2));

    vec3 N = vec3(uv, sqrt(max(0.0, 1.0 - r2)));

    float ang = u_variant * 1.7 + u_seed * 0.013;
    float ca = cos(ang), sa = sin(ang);
    vec2 tuv = mat2(ca, -sa, sa, ca) * uv * 1.7 + u_seed * 0.31;

    // ============ АЛЬБЕДО ============
    vec3 albedo = u_base;
    float roughness = 0.32;
    float metalness = 0.0;
    float pngMask = 1.0;

    if (u_hasTexture == 1) {
        vec4 tx = texture2D(u_albedoTex, v_uv);
        pngMask = tx.a;
        if (pngMask < 0.02) { gl_FragColor = vec4(0.0); return; }
        albedo = tx.rgb;
        roughness = (u_finish == 1) ? 0.55 : (u_finish == 2) ? 0.10 : 0.22;
    } else if (u_textureType == 0) {
        float f = facets(tuv);
        albedo = mix(u_deep, u_accent, smoothstep(0.0, 0.6, f));
        albedo = mix(albedo, u_base, 0.55);
        roughness = 0.18;
    } else if (u_textureType == 1) {
        float n = fbm(tuv * 4.0, 5);
        float sp = smoothstep(0.76, 0.80, hash21(tuv * 40.0 + u_seed));
        albedo = mix(u_base, u_deep, n * 0.55);
        albedo = mix(albedo, vec3(1.0, 0.85, 0.4), sp);
        roughness = 0.32;
    } else if (u_textureType == 2) {
        float n = fbm(tuv * 1.4, 4);
        albedo = mix(u_shadow, u_highlight, n * 0.5 + 0.3);
        albedo = mix(albedo, u_base, 0.6);
        roughness = 0.45;
    } else if (u_textureType == 3) {
        float n = fbm(tuv * 1.0, 3);
        albedo = mix(u_base, u_accent, n * 0.28);
        roughness = 0.10;
    } else if (u_textureType == 4) {
        float b = bands(tuv * 1.5);
        albedo = mix(u_deep, u_highlight, b);
        albedo = mix(albedo, u_base, 0.45);
        roughness = 0.20;
    } else if (u_textureType == 5) {
        float n = fbm(tuv * 2.0, 4);
        float sp = smoothstep(0.87, 0.91, hash21(tuv * 60.0 + u_seed));
        albedo = mix(u_base, u_shadow, n * 0.40);
        albedo += vec3(0.95, 0.82, 0.45) * sp * 0.8;
        roughness = 0.28;
    } else if (u_textureType == 6) {
        vec2 sw = swirlUV(tuv * 1.3, 0.45);
        float n = fbm(sw, 5);
        albedo = mix(u_deep, u_accent, n);
        albedo = mix(albedo, u_base, 0.45);
        roughness = 0.28;
    } else if (u_textureType == 7) {
        float n = fbm(tuv * 1.0, 4);
        albedo = mix(u_base, u_highlight, n * 0.55 + 0.22);
        roughness = 0.42;
    } else if (u_textureType == 8) {
        float n = fbm(tuv * 2.0, 4);
        albedo = mix(u_deep, u_base, n * 0.7 + 0.3);
        float angle = atan(uv.y, uv.x) + u_variant * 1.3;
        float bnd = sin(angle * 3.0 + fbm(tuv * 2.0, 3) * 4.0);
        float fmix = smoothstep(0.25, 1.0, bnd) * (1.0 - smoothstep(0.85, 1.0, sqrt(r2)));
        vec3 fcol = mix(u_flash0, u_flash1, sin(angle * 2.0) * 0.5 + 0.5);
        fcol = mix(fcol, u_flash2, fbm(tuv * 3.0, 2));
        albedo = mix(albedo, fcol, fmix * 0.85);
        roughness = 0.16;
    } else if (u_textureType == 9) {
        float n = fbm(tuv * 2.5, 4);
        albedo = mix(u_base, u_highlight, n * 0.5);
        roughness = 0.25;
        metalness = 1.0;
    } else if (u_textureType == 10) {
        float r = rings(tuv, 16.0);
        albedo = mix(u_deep, u_accent, r);
        albedo = mix(albedo, u_base, 0.5);
        roughness = 0.24;
    } else if (u_textureType == 11) {
        float v = veined(tuv * 1.8);
        albedo = mix(u_base, u_accent, v);
        float dark = smoothstep(0.55, 0.6, fbm(tuv * 4.0, 4));
        albedo = mix(albedo, u_deep, dark * 0.4);
        roughness = 0.30;
    } else if (u_textureType == 12) {
        float angle = atan(uv.y, uv.x);
        float radial = sin(angle * 9.0 + fbm(tuv, 3) * 2.5) * 0.5 + 0.5;
        radial = pow(radial, 5.0);
        albedo = mix(u_base, u_accent, radial);
        roughness = 0.28;
    } else if (u_textureType == 13) {
        float s = sin(tuv.x * 30.0 + fbm(tuv, 2) * 1.5) * 0.5 + 0.5;
        s = pow(s, 2.0);
        albedo = mix(u_deep, u_base, s);
        albedo = mix(albedo, u_accent, fbm(tuv * 3.0, 3) * 0.25);
        roughness = 0.32;
    } else if (u_textureType == 14) {
        float n = fbm(tuv * 3.0, 5);
        float patches = smoothstep(0.4, 0.7, n);
        albedo = mix(u_highlight, u_deep, patches * 0.85);
        albedo = mix(albedo, u_base, 0.55);
        roughness = 0.42;
    }

    if (u_hasTexture == 0) {
        float micro = (fbm(tuv * 30.0, 3) - 0.5) * 0.06;
        albedo *= 1.0 + micro;
    }

    // ============ ОСВЕЩЕНИЕ ============
    vec3 L  = normalize(vec3(-0.42, -0.72, 0.62));
    vec3 L2 = normalize(vec3( 0.50,  0.55, 0.48));
    vec3 V  = vec3(0.0, 0.0, 1.0);
    vec3 H  = normalize(L + V);

    float NdotL  = max(0.0, dot(N, L));
    float NdotL2 = max(0.0, dot(N, L2));
    float NdotV  = max(0.0, dot(N, V));
    float NdotH  = max(0.0, dot(N, H));
    float VdotH  = max(0.0, dot(V, H));

    vec3 diffuse;
    if (u_hasTexture == 1) {
        float litSoft = NdotL * 0.55 + NdotL2 * 0.25;
        diffuse = albedo * (0.92 + 0.18 * litSoft);
    } else {
        diffuse = albedo * (NdotL * 0.88 + NdotL2 * 0.22 + 0.10);
    }

    float a   = roughness * roughness;
    float a2  = a * a;
    float NdotH2 = NdotH * NdotH;
    float denom  = NdotH2 * (a2 - 1.0) + 1.0;
    float D   = a2 / (3.14159265 * denom * denom + 1e-6);
    float k   = (roughness + 1.0); k = k * k * 0.125;
    float Gv  = NdotV / (NdotV * (1.0 - k) + k);
    float Gl  = NdotL / (NdotL * (1.0 - k) + k);
    float G   = Gv * Gl;
    float F0  = mix(0.06, 0.85, metalness);
    float F   = F0 + (1.0 - F0) * pow(1.0 - VdotH, 5.0);
    float spec = D * G * F / max(1e-3, 4.0 * NdotV * NdotL);
    spec *= NdotL;

    vec3 specCol = mix(u_highlight, albedo, metalness);

    if (u_finish == 1) spec *= 0.15;
    if (u_finish == 2) spec *= 1.4;

    vec3 rimCol = vec3(0.0);

    vec3 ss = vec3(0.0);
    if (u_finish == 2) {
        float thick = pow(N.z, 0.55);
        ss = u_accent * (1.0 - thick) * 0.45;
    }

    float ao = (u_hasTexture == 1)
        ? smoothstep(-0.2, 0.5, N.z) * 0.3 + 0.7
        : smoothstep(0.0, 0.55, N.z);

    float clearcoat = 0.0;
    if (u_finish != 1) {
        clearcoat = pow(NdotH, 80.0) * 0.45;
    }

    vec3 color = diffuse * ao + specCol * spec + rimCol + ss + vec3(clearcoat);

    float tmStrength = (u_hasTexture == 1) ? 0.25 : 0.6;
    color = color / (1.0 + color * tmStrength);

    gl_FragColor = vec4(color, edge * pngMask);
}
`;
