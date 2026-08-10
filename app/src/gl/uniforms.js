/**
 * The one place island data and climate data become shader uniforms.
 *
 * Both the full renderer and the atlas thumbnail factory feed the same scene
 * shader, so they must agree exactly on how a catalogue entry maps onto it.
 * They agree by both calling this.
 */

/** Uniforms fixed by an island's identity — these never change while you look. */
export function islandUniforms(island) {
  const t = island.terrain;
  const s = island.surface;
  return {
    uArchetype: t.archetypeIndex ?? island.archetype.index,
    uNoiseSeed: t.noiseSeed >>> 0,
    uHeight: t.height,
    uSharpness: t.sharpness,
    uRidgeMix: t.ridgeMix,
    uWarp: t.warp,
    uFreq: t.freq,
    uCoast: t.coast,
    uRotation: t.rotation,
    uAniso: t.anisotropy,
    uOctaves: t.octaves,
    uLobes: t.lobes,
    uCanopyHue: s.canopyHue,
    uSandHue: s.sandHue,
    uRockHue: s.rockHue,
    uRockValue: s.rockValue,
    uReefWidth: s.reefWidth,
  };
}

/** Uniforms that come from the sky: the live half of the picture. */
export function climateUniforms(scene) {
  return {
    uSunDir: scene.sunDir,
    uNight: scene.night,
    uTwilight: scene.twilight,
    uCloudCover: scene.cloudCover,
    uCloudDensity: scene.cloudDensity,
    uCloudHeight: scene.cloudHeight,
    uRain: scene.rain,
    uSnow: scene.snow,
    uFog: scene.fog,
    uHaze: scene.haze,
    uWindDir: scene.windDir,
    uWindSpeed: scene.windSpeed,
    uWaveAmp: scene.waveAmp,
    uWaveChop: scene.waveChop,
    uWavePeriod: scene.wavePeriod,
    uWaterWarmth: scene.waterWarmth,
    uTurbidity: scene.turbidity,
    uSnowline: scene.snowline,
    uVegetation: scene.vegetation,
    uAurora: scene.aurora || 0,
  };
}

/** Convert orbit coordinates into an eye position. */
export function orbitPosition({ azimuth, elevation, distance, target }) {
  const ce = Math.cos(elevation);
  return [
    target[0] + Math.sin(azimuth) * ce * distance,
    target[1] + Math.sin(elevation) * distance,
    target[2] + Math.cos(azimuth) * ce * distance,
  ];
}

/** Everything the scene shader needs for one draw. */
export function sceneUniforms({
  island,
  scene,
  camera,
  resolution,
  time = 0,
  jitter = [0, 0],
  fov = 0.62,
}) {
  return {
    ...islandUniforms(island),
    ...climateUniforms(scene),
    uResolution: resolution,
    uJitter: jitter,
    uTime: time,
    uCamPos: orbitPosition(camera),
    uCamTarget: camera.target,
    uFov: fov,
  };
}

/**
 * Exposure, in stops rather than in taste.
 *
 * A night island lit correctly for a daylight exposure is a black rectangle.
 * A photographer standing on that beach would open up several stops, and this
 * renderer is already a long exposure, so it does the same. The scene is not
 * being brightened — the shutter is being held open.
 */
export function exposureFor(scene, base = 0.92) {
  // Squared, so twilight — which still has plenty of sky light — is barely
  // touched and only genuine darkness opens the shutter wide.
  return base * (1 + scene.night * scene.night * 1.7);
}

/**
 * How visible the aurora should be: a function of geomagnetic latitude and how
 * dark the sky is. Not a forecast — a plausibility. Islands above 60° see it
 * on a clear dark night, and that is the truthful amount of drama.
 */
export function auroraStrength(island, scene) {
  const absLat = Math.abs(island.lat);
  if (absLat < 55) return 0;
  const band = Math.min(1, (absLat - 55) / 12);
  const dark = scene.night;
  const clear = 1 - scene.cloudCover * 0.9;
  return Math.max(0, band * dark * clear);
}
