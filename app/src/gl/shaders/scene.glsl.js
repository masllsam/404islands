/**
 * The scene shader.
 *
 * One fragment shader draws the whole world: the terrain is raymarched as a
 * fractal heightfield, the sea is an analytically-displaced plane, and the sky
 * is a hand-tuned single-scatter model that runs from polar night through
 * sunrise to noon. Every weather-facing uniform comes from a real observation
 * at the island's real coordinate.
 *
 * Three quality tiers are compiled from this one source via QUALITY:
 *   0 — atlas thumbnail: short marches, no soft shadows
 *   1 — interactive: what you see while dragging
 *   2 — still: what the image converges to once you let go
 */

export const VERTEX_SHADER = `#version 300 es
// A single oversized triangle covers the viewport with no vertex buffer and
// no diagonal seam.
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const SCENE_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

out vec4 fragColor;

// ── Frame ───────────────────────────────────────────────────────────────
uniform vec2  uResolution;
uniform vec2  uJitter;       // sub-pixel offset for temporal supersampling
uniform float uTime;
uniform vec3  uCamPos;
uniform vec3  uCamTarget;
uniform float uFov;          // vertical, radians

// ── Island identity ─────────────────────────────────────────────────────
uniform int   uArchetype;
uniform uint  uNoiseSeed;
uniform float uHeight;
uniform float uSharpness;
uniform float uRidgeMix;
uniform float uWarp;
uniform float uFreq;
uniform float uCoast;
uniform float uRotation;
uniform float uAniso;
uniform int   uOctaves;
uniform int   uLobes;

// ── Surface ─────────────────────────────────────────────────────────────
uniform float uVegetation;
uniform float uCanopyHue;
uniform float uSandHue;
uniform float uRockHue;
uniform float uRockValue;
uniform float uReefWidth;
uniform float uSnowline;
uniform float uTurbidity;

// ── Live climate ────────────────────────────────────────────────────────
uniform vec3  uSunDir;
uniform float uNight;
uniform float uTwilight;
uniform float uCloudCover;
uniform float uCloudDensity;
uniform float uCloudHeight;
uniform float uRain;
uniform float uSnow;
uniform float uFog;
uniform float uHaze;
uniform float uWindDir;
uniform float uWindSpeed;
uniform float uWaveAmp;
uniform float uWaveChop;
uniform float uWavePeriod;
uniform float uWaterWarmth;
uniform float uAurora;
uniform vec3  uMoonDir;    // real lunar position for this coordinate and hour
uniform float uMoonLight;  // 0..1, lit fraction x altitude x distance x cloud
uniform float uMoonPhase;  // illuminated fraction of the disc
uniform float uSeaLevel;   // tide, in world units, about mean sea level

#define PI  3.14159265359
#define TAU 6.28318530718

#if QUALITY == 0
  #define MARCH_STEPS 64
  #define SHADOW_STEPS 0
  #define MAX_DIST 12.0
  #define CLOUD_LAYERS 1
  #define AO_ON 0
  #define REFINE_STEPS 3
#elif QUALITY == 1
  #define MARCH_STEPS 130
  #define SHADOW_STEPS 14
  #define MAX_DIST 16.0
  #define CLOUD_LAYERS 2
  #define AO_ON 1
  #define REFINE_STEPS 5
#else
  #define MARCH_STEPS 240
  #define SHADOW_STEPS 28
  #define MAX_DIST 22.0
  #define CLOUD_LAYERS 2
  #define AO_ON 1
  #define REFINE_STEPS 7
#endif

// ════════════════════════════════════════════════════════════════════════
//  Noise
// ════════════════════════════════════════════════════════════════════════

uint hashU(int x, int y, uint seed) {
  uint h = seed;
  h ^= uint(x) * 0x9E3779B1u;
  h *= 0x85EBCA6Bu;
  h ^= h >> 15u;
  h ^= uint(y) * 0xC2B2AE35u;
  h *= 0x27D4EB2Fu;
  h ^= h >> 13u;
  return h;
}

float hash01(int x, int y, uint seed) {
  return float(hashU(x, y, seed) >> 8) * (1.0 / 16777216.0);
}

const vec2 GRADS[16] = vec2[16](
  vec2( 1.000000,  0.000000), vec2( 0.923880,  0.382683),
  vec2( 0.707107,  0.707107), vec2( 0.382683,  0.923880),
  vec2( 0.000000,  1.000000), vec2(-0.382683,  0.923880),
  vec2(-0.707107,  0.707107), vec2(-0.923880,  0.382683),
  vec2(-1.000000,  0.000000), vec2(-0.923880, -0.382683),
  vec2(-0.707107, -0.707107), vec2(-0.382683, -0.923880),
  vec2( 0.000000, -1.000000), vec2( 0.382683, -0.923880),
  vec2( 0.707107, -0.707107), vec2( 0.923880, -0.382683)
);

vec2 grad2(int x, int y, uint seed) {
  return GRADS[hashU(x, y, seed) & 15u];
}

// Classic gradient noise, quintic interpolation, roughly [-1, 1].
float perlin(vec2 p, uint seed) {
  vec2 i = floor(p);
  vec2 f = p - i;
  ivec2 ii = ivec2(i);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  float n00 = dot(grad2(ii.x,     ii.y,     seed), f);
  float n10 = dot(grad2(ii.x + 1, ii.y,     seed), f - vec2(1.0, 0.0));
  float n01 = dot(grad2(ii.x,     ii.y + 1, seed), f - vec2(0.0, 1.0));
  float n11 = dot(grad2(ii.x + 1, ii.y + 1, seed), f - vec2(1.0, 1.0));

  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y) * 1.4;
}

const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

float fbm(vec2 p, int octaves, float gain, uint seed) {
  float sum = 0.0, amp = 0.5, norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * perlin(p, seed + uint(i) * 131u);
    norm += amp;
    p = ROT * p * 2.03;
    amp *= gain;
  }
  return sum / max(norm, 1e-5);
}

// Ridged multifractal: absolute value folded and inverted, so creases become
// crests. This is what gives volcanic and karst islands their spines.
float ridged(vec2 p, int octaves, float gain, uint seed) {
  float sum = 0.0, amp = 0.5, norm = 0.0, prev = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    float n = 1.0 - abs(perlin(p, seed + uint(i) * 197u));
    n *= n;
    sum += amp * n * prev;
    prev = mix(1.0, n, 0.6);
    norm += amp;
    p = ROT * p * 2.07;
    amp *= gain;
  }
  return sum / max(norm, 1e-5);
}

mat2 rot2(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

// ════════════════════════════════════════════════════════════════════════
//  Terrain
// ════════════════════════════════════════════════════════════════════════

// How much land there is at a point, before relief is applied. Each archetype
// is a different answer to "where does the island stop".
float islandMask(vec2 q, vec2 warped, int octaves) {
  float edge = fbm(warped * 1.45 + 23.7, min(octaves, 4), 0.5, uNoiseSeed + 909u);

  if (uArchetype == 3) {
    // Archipelago: several centres on a ring, unioned smoothly.
    float m = 0.0;
    float spread = uCoast * 1.15;
    for (int i = 0; i < 6; i++) {
      if (i >= uLobes) break;
      float a = TAU * float(i) / float(uLobes) + uRotation;
      float rad = spread * (0.55 + 0.45 * hash01(i, 7, uNoiseSeed));
      vec2 c = vec2(cos(a), sin(a)) * rad;
      float lobeR = uCoast * (0.34 + 0.30 * hash01(i, 11, uNoiseSeed));
      float d = length(q - c) + edge * 0.20;
      m = max(m, 1.0 - smoothstep(lobeR * 0.55, lobeR * 1.25, d));
    }
    return m;
  }

  float r = length(q) + edge * 0.36;

  if (uArchetype == 1) {
    // Atoll: a rim of reef, a lagoon inside it, deep water outside.
    float rim = uCoast * 0.88;
    float w = max(0.05, uReefWidth) * 1.9;
    float ring = 1.0 - smoothstep(0.0, 1.0, abs(r - rim) / w);
    float outer = 1.0 - smoothstep(rim + w * 0.9, rim + w * 1.9, r);
    return clamp(ring * outer, 0.0, 1.0);
  }

  if (uArchetype == 2) {
    // Plateau: flat crown, cliffs that fall away fast.
    return 1.0 - smoothstep(uCoast * 0.94, uCoast * 1.06, r);
  }

  if (uArchetype == 6) {
    // Karst: the coast is porous — towers stand where the field is high and
    // the water reaches everywhere else.
    float base = 1.0 - smoothstep(uCoast * 0.7, uCoast * 1.3, r);
    float towers = smoothstep(0.42, 0.68, fbm(warped * 4.1, min(octaves, 5), 0.55, uNoiseSeed + 401u) * 0.5 + 0.5);
    return base * mix(0.15, 1.0, towers);
  }

  float m = 1.0 - smoothstep(uCoast * 0.80, uCoast * 1.24, r);

  if (uArchetype == 5) {
    // Fjordland: cut deep, narrow inlets in from the coast.
    float channels = ridged(warped * uFreq * 2.6 + 61.0, min(octaves, 5), 0.5, uNoiseSeed + 733u);
    m -= smoothstep(0.55, 0.95, channels) * 0.85;
  }

  return clamp(m, 0.0, 1.0);
}

// Where the seabed is shallow. This is a separate field from the land mask
// because the two are genuinely different questions: an atoll has no land in
// its lagoon but the floor is right there, which is the whole reason a lagoon
// is the colour it is.
float shelfMask(vec2 q, vec2 warped, int octaves) {
  float edge = fbm(warped * 1.15 + 7.3, min(octaves, 3), 0.5, uNoiseSeed + 55u);

  if (uArchetype == 3) {
    float m = 0.0;
    float spread = uCoast * 1.15;
    for (int i = 0; i < 6; i++) {
      if (i >= uLobes) break;
      float a = TAU * float(i) / float(uLobes) + uRotation;
      float rad = spread * (0.55 + 0.45 * hash01(i, 7, uNoiseSeed));
      vec2 c = vec2(cos(a), sin(a)) * rad;
      float lobeR = uCoast * (0.34 + 0.30 * hash01(i, 11, uNoiseSeed));
      float d = length(q - c) + edge * 0.22;
      m = max(m, 1.0 - smoothstep(lobeR * 1.15, lobeR * 2.6, d));
    }
    return m;
  }

  float r = length(q) + edge * 0.26;
  float outer = uArchetype == 1
    ? uCoast * 0.88 + max(0.05, uReefWidth) * 1.9
    : uCoast;
  return 1.0 - smoothstep(outer * 1.02, outer * 2.05, r);
}

// Signed height above sea level, in world units.
float terrainHeight(vec2 p, int octaves) {
  vec2 q = rot2(uRotation) * p;
  q.x /= uAniso;

  vec2 w = vec2(
    fbm(q * 1.7 + 11.3, min(octaves, 4), 0.5, uNoiseSeed + 17u),
    fbm(q * 1.7 - 5.1,  min(octaves, 4), 0.5, uNoiseSeed + 53u)
  );
  vec2 s = q + w * uWarp;

  float base = fbm(s * uFreq, octaves, 0.5, uNoiseSeed) * 0.5 + 0.5;
  float rid  = ridged(s * uFreq * 1.03, octaves, 0.5, uNoiseSeed + 3u);
  float n = mix(base, rid, uRidgeMix);

  float mask = islandMask(q, s, octaves);
  float h = pow(clamp(n, 0.0, 1.0), uSharpness) * mask;

  if (uArchetype == 2) {
    // Flatten the crown into a table.
    h = mix(h, smoothstep(0.22, 0.46, n) * mask, 0.72);
  }
  if (uArchetype == 4) {
    // Sandbars are almost pure mask: no interior to speak of.
    h = mix(h, mask * 0.85, 0.65);
  }

  // The land sits on a shelf, and the shelf falls away. Squaring the falloff
  // keeps the water shallow for a while after the land ends — which is where
  // all of the colour in a tropical island actually comes from — and then
  // drops to open-ocean depth.
  float shelf = shelfMask(q, s, octaves);
  float away = 1.0 - shelf;

  return h * uHeight - 0.012 - away * away * 0.55;
}

// Fewer octaves further away: the far side of the island cannot resolve
// detail the near side needs, and paying for it costs frames.
int lodOctaves(float t) {
  return max(3, uOctaves - int(clamp(t * 0.85, 0.0, 4.0)));
}

vec3 terrainNormal(vec2 p, float t) {
  float e = max(0.0015, t * 0.0016);
  int oct = lodOctaves(t);
  float hx1 = terrainHeight(p + vec2(e, 0.0), oct);
  float hx0 = terrainHeight(p - vec2(e, 0.0), oct);
  float hz1 = terrainHeight(p + vec2(0.0, e), oct);
  float hz0 = terrainHeight(p - vec2(0.0, e), oct);
  return normalize(vec3(hx0 - hx1, 2.0 * e, hz0 - hz1));
}

// Heightfield march: step by the vertical gap, which is a safe under-estimate
// of the distance to the surface for the near-vertical terrain here, then
// interpolate the crossing for a clean silhouette.
bool marchTerrain(vec3 ro, vec3 rd, out float tHit) {
  float t = 0.02;
  float lastT = t;
  float lastGap = ro.y + rd.y * t - terrainHeight(ro.xz + rd.xz * t, lodOctaves(t));
  tHit = 0.0;

  for (int i = 0; i < MARCH_STEPS; i++) {
    vec3 p = ro + rd * t;
    // Nothing above the summit can be hit on an upward ray.
    if (rd.y > 0.0 && p.y > uHeight + 0.06) return false;

    float gap = p.y - terrainHeight(p.xz, lodOctaves(t));
    if (gap < 0.0) {
      // Linear interpolation of the crossing is fine on a slope and visibly
      // stepped on a cliff, where the height changes far faster than the
      // march assumed. Bisect the bracket to clean up vertical faces.
      float lo = lastT;
      float hi = t;
      for (int k = 0; k < REFINE_STEPS; k++) {
        float mid = 0.5 * (lo + hi);
        vec3 mp = ro + rd * mid;
        if (mp.y - terrainHeight(mp.xz, lodOctaves(mid)) < 0.0) hi = mid;
        else lo = mid;
      }
      tHit = REFINE_STEPS > 0
        ? hi
        : lastT + (t - lastT) * lastGap / max(lastGap - gap, 1e-6);
      return true;
    }
    lastT = t;
    lastGap = gap;
    t += clamp(gap * 0.62, 0.006 + t * 0.0035, 0.35);
    if (t > MAX_DIST) return false;
  }
  return false;
}

float terrainShadow(vec3 p, vec3 sd) {
#if SHADOW_STEPS == 0
  return 1.0;
#else
  if (sd.y <= 0.02) return 0.0;
  float shade = 1.0;
  float t = 0.012;
  for (int i = 0; i < SHADOW_STEPS; i++) {
    vec3 q = p + sd * t;
    if (q.y > uHeight + 0.04) break;
    float gap = q.y - terrainHeight(q.xz, max(3, uOctaves - 2));
    shade = min(shade, 14.0 * gap / t);
    if (shade < 0.005) return 0.0;
    t += clamp(gap * 0.8, 0.012, 0.22);
    if (t > 4.0) break;
  }
  return clamp(shade, 0.0, 1.0);
#endif
}

float terrainAO(vec3 p, vec3 n) {
#if AO_ON == 0
  return 1.0;
#else
  float occ = 0.0, sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float d = 0.008 + 0.045 * float(i);
    float h = terrainHeight(p.xz + n.xz * d, max(3, uOctaves - 2));
    occ += (p.y + n.y * d - h) * sca;
    sca *= 0.72;
  }
  return clamp(0.5 + 1.9 * occ, 0.0, 1.0);
#endif
}

// ════════════════════════════════════════════════════════════════════════
//  Sea
// ════════════════════════════════════════════════════════════════════════

// Sum of trochoidal waves travelling with the live wind, plus a fine chop
// whose amplitude tracks wind speed. Returns (height, dH/dx, dH/dz).
//
// The detail parameter fades the highest-frequency ripple out with distance. Without it a
// pixel near the horizon covers dozens of wave periods and the normal it gets
// is essentially random, which reads as stipple across the whole far sea — the
// classic specular aliasing that no amount of supersampling fixes cheaply.
vec3 waveField(vec2 p, float detail) {
  float h = 0.0;
  vec2 d = vec2(0.0);

  vec2 wind = vec2(sin(uWindDir), cos(uWindDir));
  float freq = TAU / max(1.2, uWavePeriod * 0.42);
  float amp = uWaveAmp;

  for (int i = 0; i < 4; i++) {
    float spread = (float(i) - 1.5) * 0.42;
    vec2 dir = rot2(spread) * wind;
    float speed = sqrt(9.81 / max(freq, 0.01)) * 0.30;
    float phase = dot(dir, p) * freq + uTime * freq * speed;
    h += amp * sin(phase);
    d += dir * amp * freq * cos(phase);
    freq *= 1.83;
    amp *= 0.58;
  }

  // Wind ripple: high-frequency detail that makes the specular glitter.
  float ripple = uWaveAmp * (0.35 + uWaveChop * 1.6) * detail;
  if (ripple < 1e-6) return vec3(h, d);
  vec2 rp = p * 26.0 + wind * uTime * 1.1;
  float rn = perlin(rp, uNoiseSeed + 8191u);
  h += rn * ripple * 0.30;
  float e = 0.02;
  d += vec2(
    (perlin(rp + vec2(e, 0.0), uNoiseSeed + 8191u) - rn) / e,
    (perlin(rp + vec2(0.0, e), uNoiseSeed + 8191u) - rn) / e
  ) * ripple * 0.30 * 26.0;

  return vec3(h, d);
}

// ════════════════════════════════════════════════════════════════════════
//  Sky
// ════════════════════════════════════════════════════════════════════════

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

float starField(vec3 rd) {
  vec3 d = rd * 220.0;
  ivec3 c = ivec3(floor(d));
  float best = 0.0;
  for (int i = 0; i < 2; i++) {
    for (int j = 0; j < 2; j++) {
      ivec2 cell = ivec2(c.x + i, c.y + j);
      float hx = hash01(cell.x, cell.y * 71 + c.z, 0x51EDu);
      if (hx > 0.9955) {
        vec3 sp = vec3(float(cell.x), float(cell.y), float(c.z)) +
                  vec3(hash01(cell.x, cell.y, 3u), hash01(cell.y, cell.x, 5u), 0.5);
        float dist = length(d.xy - sp.xy);
        float mag = hash01(cell.y, cell.x * 13, 0x7A1u);
        // A softer falloff than a point light: hard stars alias badly in a
        // sea reflection, and a slightly blurred star is what a lens gives
        // you anyway.
        best = max(best, exp(-dist * dist * 3.2) * (0.30 + mag * 0.75));
      }
    }
  }
  return best;
}

// Bands of light over the magnetic latitudes, only when it is dark enough
// to see them. Cheap, but it is the correct answer for an island at 78° N.
vec3 auroraLayer(vec3 rd) {
  if (uAurora < 0.01 || rd.y < 0.02) return vec3(0.0);
  float t = uTime * 0.05;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float y = 0.16 + float(i) * 0.10;
    float plane = (y - 0.0) / max(rd.y, 0.02);
    vec2 pp = rd.xz * plane;
    float band = fbm(vec2(pp.x * 0.9, pp.y * 0.22 + t + float(i)), 4, 0.55, 0x3110u + uint(i));
    float curtain = smoothstep(0.15, 0.55, band) * smoothstep(0.9, 0.25, abs(pp.y * 0.1));
    vec3 tint = mix(vec3(0.18, 1.0, 0.45), vec3(0.45, 0.35, 1.0), float(i) / 2.0);
    col += tint * curtain * 0.24;
  }
  return col * uAurora * (1.0 - smoothstep(0.55, 0.95, rd.y));
}

// Clouds are a stack of infinite planes with fractal coverage. Cheaper than a
// volume by an order of magnitude, and at these altitudes the eye cannot tell.
vec4 cloudLayer(vec3 ro, vec3 rd, vec3 sd, float altitude, float scale, float coverage, float sharp) {
  if (rd.y <= 0.012) return vec4(0.0);
  float t = (altitude - ro.y) / rd.y;
  if (t <= 0.0 || t > 900.0) return vec4(0.0);

  vec2 p = (ro.xz + rd.xz * t) * scale;
  vec2 drift = vec2(sin(uWindDir), cos(uWindDir)) * uTime * (0.006 + uWindSpeed * 0.00035);
  p += drift * scale * 40.0;

  float n = fbm(p, 5, 0.52, uNoiseSeed + 5051u) * 0.5 + 0.5;
  float density = smoothstep(1.0 - coverage - 0.06, 1.0 - coverage + sharp, n);
  if (density <= 0.001) return vec4(0.0);

  // Thin the deck out toward the horizon so it reads as a ceiling, not a wall.
  density *= smoothstep(0.012, 0.16, rd.y);

  // Self-shadowing from the density gradient toward the sun.
  vec2 toSun = normalize(sd.xz + vec2(1e-4)) * 0.09;
  float nUp = fbm(p + toSun * scale * 30.0, 4, 0.52, uNoiseSeed + 5051u) * 0.5 + 0.5;
  float lit = clamp(0.55 + (n - nUp) * 3.4, 0.12, 1.35);

  float sunUp = clamp(sd.y, -0.3, 1.0);
  vec3 bright = mix(vec3(0.42, 0.30, 0.30), vec3(1.06, 1.02, 0.98), smoothstep(-0.1, 0.3, sunUp));
  vec3 shade = mix(vec3(0.05, 0.06, 0.10), vec3(0.42, 0.47, 0.58), smoothstep(-0.1, 0.25, sunUp));
  vec3 col = mix(shade, bright, lit);

  // Silver lining where the sun is behind the cloud edge.
  float mu = max(dot(rd, sd), 0.0);
  col += bright * pow(mu, 12.0) * (1.0 - density) * 1.4;

  return vec4(col, clamp(density * uCloudDensity, 0.0, 1.0));
}

vec3 skyColor(vec3 rd, vec3 sd, bool withClouds, float starGain) {
  float up = rd.y;
  float mu = clamp(dot(rd, sd), -1.0, 1.0);
  float sunUp = sd.y;

  float day = smoothstep(-0.14, 0.24, sunUp);
  float dusk = exp(-pow(sunUp / 0.15, 2.0));

  vec3 zenith = mix(vec3(0.008, 0.014, 0.035), vec3(0.075, 0.215, 0.585), day);
  vec3 horizon = mix(vec3(0.020, 0.032, 0.062), vec3(0.520, 0.680, 0.900), day);

  // The low sun paints the horizon and bruises the zenith.
  horizon = mix(horizon, vec3(1.05, 0.44, 0.17), dusk * 0.80);
  zenith = mix(zenith, vec3(0.26, 0.15, 0.33), dusk * 0.40);

  float grad = pow(1.0 - clamp(up, 0.0, 1.0), 3.4);
  vec3 col = mix(zenith, horizon, grad);

  // Below the horizon the sky is the sea's own darkness.
  col = mix(col, col * 0.35, smoothstep(0.0, -0.12, up));

  // Mie forward scattering: the halo, then the tighter glow.
  float halo = pow(max(mu, 0.0), 6.0);
  vec3 haloTint = mix(vec3(1.0, 0.48, 0.20), vec3(1.0, 0.93, 0.80), day);
  col += haloTint * halo * (0.20 + dusk * 1.5);
  col += haloTint * pow(max(mu, 0.0), 1.8) * 0.05 * day;

  // The sun's disc.
  float disc = smoothstep(0.99965, 0.99988, mu) * step(-0.03, sunUp);
  col += mix(vec3(2.4, 1.1, 0.45), vec3(6.0, 5.7, 5.2), day) * disc;

  // The moon's disc, at its real place in the sky and in its real phase.
  // Both bodies subtend about half a degree, which is the one coincidence in
  // the solar system everybody has noticed.
  if (uMoonDir.y > -0.05) {
    float mmu = dot(rd, uMoonDir);
    const float MOON_RADIUS = 0.00465; // radians
    if (mmu > 0.99995) {
      // Position within the disc, in units of its radius.
      vec3 perp = rd - uMoonDir * mmu;
      vec3 sunward = normalize(sd - uMoonDir * dot(sd, uMoonDir) + vec3(1e-6));
      vec3 sideward = cross(uMoonDir, sunward);
      float a = dot(perp, sunward) / MOON_RADIUS;
      float b = dot(perp, sideward) / MOON_RADIUS;
      float r2 = a * a + b * b;

      if (r2 < 1.0) {
        // The terminator is an ellipse, not a straight edge: its semi-axis
        // along the sunward direction is cos of the phase angle. At export
        // size a crescent is thirty pixels across, so this is visible.
        float k = 2.0 * uMoonPhase - 1.0;
        float edge = -k * sqrt(max(0.0, 1.0 - b * b));
        float lit = smoothstep(edge - 0.09, edge + 0.09, a);
        float limb = 1.0 - smoothstep(0.86, 1.0, sqrt(r2));

        // Limb darkening, and the faint earthshine that makes the unlit part
        // of a young moon visible against a dark sky.
        float shade = 0.35 + 0.65 * sqrt(max(0.0, 1.0 - r2));
        float earthshine = 0.035 * (1.0 - uMoonPhase);
        float brightness = (lit * shade + earthshine) * limb;

        // Bright against a night sky, washed out in daylight — as it is.
        col += vec3(1.05, 1.02, 0.94) * brightness * mix(2.6, 0.85, day)
             * (1.0 - uCloudCover * 0.85);
      }
    }
    // A soft halo, so the moon reads as a light source rather than a sticker.
    col += vec3(0.7, 0.76, 0.95) * pow(max(mmu, 0.0), 900.0)
         * uMoonLight * 0.5 * (1.0 - day);
  }

  // Stars and aurora, only where the sky is dark enough to hold them.
  float darkness = 1.0 - day;
  float clear = 1.0 - uCloudCover * 0.85;
  if (darkness > 0.02 && up > -0.02) {
    col += vec3(0.85, 0.90, 1.0) * starField(rd) * darkness * darkness * 0.6 * clear * starGain;
    col += auroraLayer(rd) * darkness * clear * mix(0.35, 1.0, starGain);
  }

  if (withClouds) {
    vec4 low = cloudLayer(vec3(0.0, 0.0, 0.0), rd, sd, uCloudHeight, 0.16, uCloudCover, 0.16);
    col = mix(col, low.rgb, low.a);
#if CLOUD_LAYERS > 1
    vec4 high = cloudLayer(vec3(0.0), rd, sd, uCloudHeight * 3.6, 0.055,
                           uCloudCover * 0.55 + 0.10, 0.30);
    col = mix(col, high.rgb * 1.05, high.a * 0.5);
#endif
  }

  // Haze lifts the whole horizon band and mutes it.
  vec3 hazeCol = mix(vec3(0.05, 0.07, 0.11), vec3(0.72, 0.78, 0.86), day);
  col = mix(col, hazeCol, uHaze * grad * 0.55);

  return col;
}

// ════════════════════════════════════════════════════════════════════════
//  Materials
// ════════════════════════════════════════════════════════════════════════

vec3 sunLight(vec3 sd) {
  float up = clamp(sd.y, -0.2, 1.0);
  // Reddening as the path through the atmosphere lengthens.
  vec3 tint = mix(vec3(1.30, 0.42, 0.13), vec3(1.02, 0.99, 0.96), smoothstep(-0.04, 0.30, up));
  float strength = smoothstep(-0.10, 0.16, up);
  return tint * strength * 2.85;
}

/**
 * The moon, where the moon actually is.
 *
 * Direction, phase and brightness all arrive as uniforms from real lunar
 * astronomy computed for this island's coordinate and this instant — see
 * core/lunar.js. So a crescent gives less light than a gibbous, a moon near
 * the horizon is dimmed by the same atmosphere that reddens a sunset, and on
 * a new moon the island is genuinely dark.
 *
 * The exposure still opens up at night, because this render is a long one.
 * That is a photographic choice, not an invented light source.
 */
vec3 moonDirection(vec3 sd) {
  return uMoonDir;
}

vec3 moonLight(vec3 sd) {
  // Moonlight is reflected sunlight, so it carries a little of the sun's warmth
  // under a very cool sky; the blue of a moonlit night is the sky, not the moon.
  float night = 1.0 - smoothstep(-0.16, 0.10, sd.y);
  // Real moonlight is about one four-hundred-thousandth of sunlight. This is
  // nothing like that far down — it is a long exposure — but it must stay well
  // under the sun (2.85) or a full moon renders brighter than noon, which is
  // exactly what happened at 2.6. The night exposure lift multiplies this
  // again, so the number here is deliberately small.
  return vec3(0.40, 0.48, 0.72) * uMoonLight * night * 0.34;
}

vec3 skyLight(vec3 sd) {
  float day = smoothstep(-0.14, 0.24, sd.y);
  vec3 base = mix(vec3(0.085, 0.115, 0.195), vec3(0.28, 0.40, 0.62), day);
  return base * (0.55 + uCloudCover * 0.35);
}

vec3 terrainAlbedo(vec3 p, vec3 n, float t) {
  float hNorm = clamp(p.y / max(uHeight, 0.02), 0.0, 1.0);
  float slope = clamp(n.y, 0.0, 1.0);

  vec3 sand = hsv2rgb(vec3(uSandHue / 360.0, 0.30, 0.86));
  vec3 rock = hsv2rgb(vec3(uRockHue / 360.0, 0.24, uRockValue));
  vec3 canopy = hsv2rgb(vec3(uCanopyHue / 360.0, 0.52, 0.30));
  vec3 scrub = hsv2rgb(vec3((uCanopyHue + 18.0) / 360.0, 0.36, 0.42));

  // Detail break-up so large faces do not read as flat paint.
  float grain = fbm(p.xz * 18.0, 4, 0.5, uNoiseSeed + 313u) * 0.5 + 0.5;

  vec3 col = rock * mix(0.82, 1.18, grain);

  // Beach first: a band where the land meets the water, scaled to the island's
  // own relief. An absolute width would swallow an atoll whole — its entire rim
  // is lower than a volcanic island's beach.
  // Measured from the current waterline: at low water the exposed strip of
  // wet sand widens, which is the whole visual point of having a tide.
  float above = p.y - uSeaLevel;
  float beachBand = 0.004 + uHeight * 0.055 + slope * uHeight * 0.05;
  float beach = (1.0 - smoothstep(0.002, beachBand, above)) * smoothstep(0.25, 0.7, slope);
  col = mix(col, sand, clamp(beach, 0.0, 1.0));

  // The intertidal zone: ground the sea has covered recently is darker and
  // still wet. This is the band that appears and disappears twice a day.
  float wet = (1.0 - smoothstep(0.0, 0.006 + uHeight * 0.02, above)) * step(0.0, above);
  col *= 1.0 - wet * 0.35;

  // Then vegetation over the top of it, because that is the order the world
  // does it in: scrub and palms grow down onto the sand, and an atoll that is
  // pure beach from rim to rim reads as a sandbar instead.
  float veg = uVegetation * smoothstep(0.18, 0.58, slope) *
              (1.0 - smoothstep(uSnowline * 0.75, uSnowline, hNorm)) *
              smoothstep(0.004, 0.030 + uHeight * 0.05, above);
  col = mix(col, mix(scrub, canopy, grain), clamp(veg, 0.0, 1.0));

  // Snow, with the line set by the live temperature. Steep faces shed it.
  float snowMask = smoothstep(uSnowline - 0.06, uSnowline + 0.05, hNorm) *
                   smoothstep(0.52, 0.86, slope);
  snowMask = clamp(snowMask + uSnow * 0.35 * smoothstep(0.6, 0.9, slope), 0.0, 1.0);
  col = mix(col, vec3(0.94, 0.96, 1.0), snowMask);

  // Rain darkens and saturates everything it lands on.
  col *= 1.0 - uRain * 0.22;

  return col;
}

// ════════════════════════════════════════════════════════════════════════
//  Main
// ════════════════════════════════════════════════════════════════════════

vec3 shadeTerrain(vec3 p, vec3 rd, float t, vec3 sd) {
  vec3 n = terrainNormal(p.xz, t);
  vec3 albedo = terrainAlbedo(p, n, t);

  float shadow = terrainShadow(p + n * 0.004, sd);
  float ao = terrainAO(p, n);

  float ndl = max(dot(n, sd), 0.0);
  vec3 direct = sunLight(sd) * ndl * shadow;

  // Moonlight: soft, cool, and unshadowed, because a half-lit night landscape
  // reads better than a correctly-black one.
  vec3 md = moonDirection(sd);
  direct += moonLight(sd) * max(dot(n, md), 0.0) * ao;

  // Sky dome contribution, weighted by how much of it the point can see.
  vec3 ambient = skyLight(sd) * (0.55 + 0.45 * n.y) * ao;

  // Bounce off the water: a cold up-light that makes coastlines read.
  vec3 seaBounce = mix(vec3(0.05, 0.12, 0.16), vec3(0.08, 0.24, 0.26), uWaterWarmth) *
                   max(0.0, 0.35 - p.y) * 1.4 * smoothstep(0.0, 0.6, sd.y);

  vec3 col = albedo * (direct + ambient + seaBounce);

  // Wet rock catches a sheen in the rain.
  if (uRain > 0.01) {
    vec3 h = normalize(sd - rd);
    float spec = pow(max(dot(n, h), 0.0), 48.0);
    col += sunLight(sd) * spec * uRain * 0.35 * shadow;
  }

  return col;
}

vec3 shadeWater(vec3 p, vec3 rd, vec3 waveN, float depth, vec3 sd) {
  vec3 n = waveN;
  vec3 refl = reflect(rd, n);
  refl.y = abs(refl.y) * 0.85 + 0.02;

  // A star reflected in moving water lands on a sub-pixel facet and
  // aliases into confetti. Damping it is cheaper and truer than
  // supersampling the sky.
  vec3 reflected = skyColor(refl, sd, true, 0.18);

  // Beer–Lambert through water: red dies first, which is the whole reason
  // shallow tropical water looks the way it does. The light makes the trip
  // twice — down to the floor and back up — so the path length is doubled.
  vec3 extinction = vec3(3.6, 0.98, 0.68) * (1.0 + uTurbidity * 2.2);
  float d = max(depth, 0.0);

  float daylight = 0.14 + 0.86 * smoothstep(-0.08, 0.28, sd.y);
  vec3 sandFloor = hsv2rgb(vec3(uSandHue / 360.0, 0.28, 0.72));
  vec3 floorLit = sandFloor * exp(-d * extinction * 9.0) * daylight;

  // Scattering within the water column: what makes deep water blue rather
  // than merely dark.
  vec3 bodyTint = mix(vec3(0.015, 0.10, 0.17), vec3(0.02, 0.27, 0.31), uWaterWarmth);
  vec3 body = bodyTint * (1.0 - exp(-d * extinction * 3.0)) * daylight;

  vec3 refracted = floorLit + body;

  float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
  vec3 col = mix(refracted, reflected, fresnel);

  // Sun glitter, and a colder, smaller version of it under the moon.
  vec3 h = normalize(sd - rd);
  float rough = mix(0.06, 0.22, clamp(uWaveChop, 0.0, 1.0));
  float spec = pow(max(dot(n, h), 0.0), 2.0 / (rough * rough));
  col += sunLight(sd) * spec * 0.55;

  vec3 md = moonDirection(sd);
  vec3 mh = normalize(md - rd);
  col += moonLight(sd) * pow(max(dot(n, mh), 0.0), 40.0) * 2.2;

  // Foam: where the swell trips over the shallows, and on steep wave faces.
  // Keyed tightly to depth so a wide shelf does not read as a white halo.
  float shoreFoam = 1.0 - smoothstep(0.0, 0.006 + uWaveAmp * 0.9, d);
  float crestFoam = smoothstep(0.55, 0.95, 1.0 - n.y) * uWaveChop * 1.2;
  float foam = clamp(shoreFoam * 0.85 + crestFoam, 0.0, 1.0);
  vec3 foamCol = vec3(0.92, 0.95, 0.97) * max(daylight, 0.16);
  col = mix(col, foamCol, foam * (0.5 + 0.5 * uWaveChop));

  return col;
}

vec3 applyAtmosphere(vec3 col, vec3 rd, float dist, vec3 sd) {
  float density = 0.055 + uHaze * 0.13 + uFog * 0.85 + uRain * 0.09;
  float f = 1.0 - exp(-dist * density);
  vec3 fogCol = skyColor(normalize(vec3(rd.x, max(rd.y, -0.03), rd.z)), sd, false, 0.0);
  // Sun-facing fog glows; this is what makes rain look like weather and not
  // like a grey filter.
  float mu = max(dot(rd, sd), 0.0);
  fogCol += sunLight(sd) * pow(mu, 4.0) * 0.10;
  return mix(col, fogCol, clamp(f, 0.0, 1.0));
}

void main() {
  vec2 uv = (gl_FragCoord.xy + uJitter) / uResolution;
  vec2 ndc = uv * 2.0 - 1.0;
  ndc.x *= uResolution.x / uResolution.y;

  vec3 fwd = normalize(uCamTarget - uCamPos);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  float halfH = tan(uFov * 0.5);
  vec3 rd = normalize(fwd + right * ndc.x * halfH + up * ndc.y * halfH);
  vec3 ro = uCamPos;

  vec3 sd = normalize(uSunDir);
  vec3 col;
  float dist = MAX_DIST;

  // Terrain first: it is opaque and bounds the water march.
  float tTerrain;
  bool hitTerrain = marchTerrain(ro, rd, tTerrain);

  // Water: intersect the mean plane, then relax onto the displaced surface.
  bool hitWater = false;
  float tWater = 0.0;
  vec3 waterN = vec3(0.0, 1.0, 0.0);
  // The sea surface sits at the tide, which is why a low island can gain and
  // lose a startling amount of beach over six hours.
  if (rd.y < -0.0005 && ro.y > uSeaLevel) {
    tWater = (uSeaLevel - ro.y) / rd.y;
    if (tWater < MAX_DIST && (!hitTerrain || tWater < tTerrain)) {
      for (int i = 0; i < 3; i++) {
        vec3 wp = ro + rd * tWater;
        vec3 wf = waveField(wp.xz, 1.0);
        tWater += (wf.x + uSeaLevel - wp.y) / rd.y;
      }
      vec3 wp = ro + rd * tWater;
      float detail = 1.0 / (1.0 + tWater * tWater * 0.055);
      vec3 wf = waveField(wp.xz, detail);
      waterN = normalize(vec3(-wf.y, 1.0, -wf.z));
      hitWater = tWater > 0.0 && tWater < MAX_DIST && (!hitTerrain || tWater < tTerrain);
    }
  }

  if (hitWater) {
    vec3 p = ro + rd * tWater;
    float bed = terrainHeight(p.xz, lodOctaves(tWater));
    col = shadeWater(p, rd, waterN, uSeaLevel - bed, sd);
    dist = tWater;
  } else if (hitTerrain) {
    vec3 p = ro + rd * tTerrain;
    col = shadeTerrain(p, rd, tTerrain, sd);
    dist = tTerrain;
  } else if (rd.y < -0.0005 && ro.y > uSeaLevel) {
    // Open sea beyond the marching horizon. Shading it as fully-attenuated
    // deep water means it meets the sky exactly where the haze says it should,
    // with no seam where the march gave up.
    vec3 far = mix(vec3(0.015, 0.055, 0.10), vec3(0.02, 0.13, 0.185), uWaterWarmth);
    far *= 0.2 + 0.8 * smoothstep(-0.1, 0.3, sd.y);
    col = applyAtmosphere(far, rd, MAX_DIST * 2.5, sd);
    dist = 0.0;
  } else {
    col = skyColor(rd, sd, true, 1.0);
    dist = 0.0;
  }

  if (dist > 0.0) {
    col = applyAtmosphere(col, rd, dist, sd);
  }

  fragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;
