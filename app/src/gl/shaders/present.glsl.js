/**
 * The present pass.
 *
 * Everything between the radiance buffer and the glass: bloom, tone mapping,
 * precipitation, and the small optical dishonesties — grain, vignette, a
 * whisper of lateral chromatic aberration — that stop a render from looking
 * like a render.
 *
 * Rain and snow live here rather than in the scene because they are between
 * the viewer and the world, not in it. That is also why they never smear when
 * a still converges: they are drawn after the accumulation.
 */

export const PRESENT_FRAGMENT = `#version 300 es
precision highp float;

out vec4 fragColor;

uniform sampler2D uScene;
uniform vec2  uResolution;
uniform float uTime;
uniform float uExposure;
uniform float uRain;
uniform float uSnow;
uniform float uWindDir;
uniform float uWindSpeed;
uniform float uBloom;
uniform float uGrain;
uniform float uVignette;
uniform float uFade;      // 0 → black, 1 → full image
uniform float uConverged; // 0..1, how settled the still is

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// ACES filmic curve (Narkowicz fit). Holds highlights on a sun disc without
// the plastic shoulder of Reinhard.
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

// One tilted layer of rain. Cells hold at most one streak, so density is
// controlled by how many cells are populated rather than by overdraw.
float rainLayer(vec2 uv, float scale, float speed, float slant, float seed) {
  vec2 p = uv * scale;
  p.x += p.y * slant;
  p.y += uTime * speed;

  vec2 cell = floor(p);
  vec2 f = fract(p);

  float h = hash21(cell + seed);
  if (h > 0.16 + uRain * 0.34) return 0.0;

  float x = fract(h * 41.7);
  float len = 0.35 + fract(h * 17.3) * 0.5;
  float dx = abs(f.x - x);
  float streak = smoothstep(0.030, 0.0, dx) * smoothstep(len, 0.0, abs(f.y - 0.5) * 2.0);
  return streak;
}

float snowLayer(vec2 uv, float scale, float speed, float drift, float seed) {
  vec2 p = uv * scale;
  p.y += uTime * speed;
  p.x += sin(p.y * 1.7 + uTime * 0.9 + seed) * drift;

  vec2 cell = floor(p);
  vec2 f = fract(p);

  float h = hash21(cell + seed);
  if (h > 0.10 + uSnow * 0.22) return 0.0;

  vec2 c = vec2(fract(h * 31.1), fract(h * 71.7));
  float d = length(f - c);
  float r = 0.045 + fract(h * 13.9) * 0.055;
  return smoothstep(r, 0.0, d);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 centred = uv - 0.5;

  // Lateral chromatic aberration, strongest at the edges. Kept well under a
  // pixel at the centre so text-adjacent UI never looks soft.
  float ca = 0.0016 * uBloom;
  vec3 col;
  col.r = texture(uScene, uv + centred * ca).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv - centred * ca).b;

  // Bloom from the mip chain: cheap, wide, and stable under accumulation.
  if (uBloom > 0.001) {
    vec3 glow = textureLod(uScene, uv, 3.0).rgb * 0.5 +
                textureLod(uScene, uv, 5.0).rgb * 0.35 +
                textureLod(uScene, uv, 7.0).rgb * 0.15;
    vec3 excess = max(glow - 0.55, vec3(0.0));
    col += excess * uBloom * 0.9;
  }

  col = aces(col * uExposure);

  // Precipitation, in front of everything.
  if (uRain > 0.003) {
    float slant = clamp(sin(uWindDir) * (0.15 + uWindSpeed * 0.006), -0.7, 0.7);
    float r = 0.0;
    r += rainLayer(uv, 34.0, 2.6, slant, 1.0) * 0.55;
    r += rainLayer(uv, 62.0, 4.2, slant, 7.0) * 0.35;
    r += rainLayer(uv, 96.0, 6.4, slant, 19.0) * 0.22;
    col += vec3(0.62, 0.70, 0.80) * r * uRain * 0.75;
  }

  if (uSnow > 0.003) {
    float s = 0.0;
    s += snowLayer(uv, 26.0, 0.30, 0.10, 3.0) * 0.9;
    s += snowLayer(uv, 44.0, 0.52, 0.16, 11.0) * 0.6;
    s += snowLayer(uv, 72.0, 0.85, 0.22, 23.0) * 0.35;
    col = mix(col, vec3(0.96, 0.97, 1.0), clamp(s * uSnow, 0.0, 0.85));
  }

  // Vignette, elliptical so it does not fight a wide frame.
  float vig = 1.0 - uVignette * dot(centred * vec2(1.0, 1.15), centred * vec2(1.0, 1.15)) * 1.9;
  col *= clamp(vig, 0.0, 1.0);

  // Grain. It anneals away as the still converges, which is exactly what a
  // long exposure does.
  float grain = (hash21(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5);
  col += grain * uGrain * (1.0 - uConverged * 0.75);

  // Ordered dither against banding in the deep blues of a night sea.
  float dither = (hash21(gl_FragCoord.xy * 0.7331) - 0.5) / 255.0;
  col += dither;

  fragColor = vec4(max(col, vec3(0.0)) * uFade, 1.0);
}
`;

/** Blends the freshly-rendered frame into the accumulation buffer. */
export const ACCUMULATE_FRAGMENT = `#version 300 es
precision highp float;

out vec4 fragColor;

uniform sampler2D uCurrent;
uniform sampler2D uHistory;
uniform float uWeight; // 1 / (samples + 1)
uniform vec2 uResolution;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 cur = texture(uCurrent, uv).rgb;
  vec3 hist = texture(uHistory, uv).rgb;
  fragColor = vec4(mix(hist, cur, uWeight), 1.0);
}
`;
