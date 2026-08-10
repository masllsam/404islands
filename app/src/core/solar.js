/**
 * Where the sun actually is.
 *
 * The light on an island is not decorative. It is computed from the island's
 * real coordinate and the real instant you are looking at it, using the NOAA
 * solar position equations. If it is 04:50 in the Banda Sea, the sun sits just
 * under the horizon and the water goes the colour it goes.
 *
 * Accurate to roughly a tenth of a degree, which is far past what a horizon
 * line can show.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const sin = (d) => Math.sin(d * RAD);
const cos = (d) => Math.cos(d * RAD);
const tan = (d) => Math.tan(d * RAD);

/** Julian day number for a JS Date (or epoch millis). */
export function julianDay(date) {
  const ms = date instanceof Date ? date.getTime() : date;
  return ms / 86400000 + 2440587.5;
}

/** Julian centuries since J2000.0. */
export function julianCentury(date) {
  return (julianDay(date) - 2451545) / 36525;
}

/**
 * Core solar geometry that only depends on time, not on where you stand.
 * Pulled out so callers computing many islands at one instant can share it.
 */
export function solarTerms(date) {
  const t = julianCentury(date);

  const meanLong = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnom = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccent = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  const eqCentre =
    sin(meanAnom) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    sin(2 * meanAnom) * (0.019993 - 0.000101 * t) +
    sin(3 * meanAnom) * 0.000289;

  const trueLong = meanLong + eqCentre;
  const appLong = trueLong - 0.00569 - 0.00478 * sin(125.04 - 1934.136 * t);

  const meanObliq =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliqCorr = meanObliq + 0.00256 * cos(125.04 - 1934.136 * t);

  const declination = Math.asin(sin(obliqCorr) * sin(appLong)) * DEG;

  const varY = tan(obliqCorr / 2) ** 2;
  const eqOfTime =
    4 *
    DEG *
    (varY * Math.sin(2 * meanLong * RAD) -
      2 * eccent * Math.sin(meanAnom * RAD) +
      4 * eccent * varY * Math.sin(meanAnom * RAD) * Math.cos(2 * meanLong * RAD) -
      0.5 * varY * varY * Math.sin(4 * meanLong * RAD) -
      1.25 * eccent * eccent * Math.sin(2 * meanAnom * RAD));

  return { declination, eqOfTime, julianCentury: t };
}

/**
 * Sun elevation and azimuth in degrees for a coordinate and instant.
 * Azimuth is measured clockwise from true north.
 */
export function sunPosition(lat, lon, date = new Date(), terms = null) {
  const { declination, eqOfTime } = terms || solarTerms(date);
  const ms = date instanceof Date ? date.getTime() : date;

  const utcMinutes = ((ms / 60000) % 1440 + 1440) % 1440;
  let trueSolarTime = (utcMinutes + eqOfTime + 4 * lon) % 1440;
  if (trueSolarTime < 0) trueSolarTime += 1440;

  let hourAngle = trueSolarTime / 4 - 180;
  if (hourAngle < -180) hourAngle += 360;

  const cosZenith =
    sin(lat) * sin(declination) + cos(lat) * cos(declination) * cos(hourAngle);
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZenith))) * DEG;
  const elevation = 90 - zenith;

  // Atmospheric refraction lifts the apparent disc near the horizon.
  const refraction = solarRefraction(elevation);

  let azimuth;
  const denom = cos(lat) * Math.sin(zenith * RAD);
  if (Math.abs(denom) > 1e-9) {
    const cosAz = (sin(lat) * cos(zenith) - sin(declination)) / denom;
    azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * DEG;
    azimuth = hourAngle > 0 ? (azimuth + 180) % 360 : (540 - azimuth) % 360;
  } else {
    azimuth = declination > lat ? 180 : 0;
  }

  return {
    elevation,
    apparentElevation: elevation + refraction,
    azimuth,
    declination,
    hourAngle,
    zenith,
  };
}

/** Approximate atmospheric refraction in degrees (Saemundsson). */
export function solarRefraction(elevationDeg) {
  if (elevationDeg > 85) return 0;
  const e = elevationDeg;
  if (e > 5) {
    return (
      (58.1 / tan(e) - 0.07 / tan(e) ** 3 + 0.000086 / tan(e) ** 5) / 3600
    );
  }
  if (e > -0.575) {
    return (
      (1735 + e * (-518.2 + e * (103.4 + e * (-12.79 + e * 0.711)))) / 3600
    );
  }
  return -20.772 / tan(e) / 3600;
}

/**
 * Unit vector pointing at the sun in the renderer's frame:
 * +X east, +Y up, +Z south (so a camera looking north looks down -Z).
 */
export function sunDirection(lat, lon, date = new Date(), terms = null) {
  const { apparentElevation, azimuth } = sunPosition(lat, lon, date, terms);
  const el = apparentElevation * RAD;
  const az = azimuth * RAD;
  const horiz = Math.cos(el);
  return [horiz * Math.sin(az), Math.sin(el), horiz * Math.cos(az)];
}

/**
 * Sunrise / sunset as minutes past UTC midnight, or null for a day that never
 * breaks (or never ends) — which real islands in this atlas do experience.
 */
export function daylight(lat, lon, date = new Date()) {
  const { declination, eqOfTime } = solarTerms(date);
  const cosHa =
    cos(90.833) / (cos(lat) * cos(declination)) - tan(lat) * tan(declination);

  if (cosHa > 1) return { polarNight: true, midnightSun: false, sunrise: null, sunset: null };
  if (cosHa < -1) return { polarNight: false, midnightSun: true, sunrise: null, sunset: null };

  const ha = Math.acos(cosHa) * DEG;
  const noon = 720 - 4 * lon - eqOfTime;
  return {
    polarNight: false,
    midnightSun: false,
    sunrise: (noon - ha * 4 + 1440) % 1440,
    sunset: (noon + ha * 4 + 1440) % 1440,
    solarNoon: (noon + 1440) % 1440,
    dayLengthMinutes: ha * 8,
  };
}

/**
 * A 0..1 phase describing where in the daily light cycle an island is, used
 * for copy and for the atlas tile ordering. 0 = solar midnight, 0.5 = noon.
 */
export function dayPhase(lat, lon, date = new Date()) {
  const { hourAngle } = sunPosition(lat, lon, date);
  return ((hourAngle + 180) % 360) / 360;
}
