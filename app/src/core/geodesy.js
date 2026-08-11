/**
 * The physics of standing on a particular island.
 *
 * The interior model is the same planet for everybody. This is what differs
 * from island to island: how hard gravity pulls at this latitude and this
 * height, how deep the island's own root reaches into the mantle to hold it
 * up, how fast the planet's rotation bends the wind here, and what the air
 * column above it is doing given the pressure actually measured there this
 * hour.
 *
 * None of it is tuned for looks. WGS84 and the free-air gradient are geodetic
 * standards; Airy isostasy is the textbook model; the barometric formula is
 * the ISA one. Where a number rests on an assumption — the density of the
 * crust, the shape of the edifice — the assumption is named.
 */

import { conditionsAtDepth, planetProfile } from './interior.js';

/** WGS84 ellipsoid. */
export const WGS84 = {
  a: 6378137.0, // semi-major axis, m
  b: 6356752.314245, // semi-minor axis, m
  f: 1 / 298.257223563, // flattening
  e2: 0.00669437999014, // first eccentricity squared
  GM: 3.986004418e14, // geocentric gravitational constant, m³/s²
  omega: 7.292115e-5, // rotation rate, rad/s
};

/** Densities in kg/m³, the standard values for an oceanic setting. */
export const DENSITIES = {
  seawater: 1027,
  oceanicCrust: 2900,
  continentalCrust: 2700,
  mantle: 3300,
  basalt: 2900,
};

const RAD = Math.PI / 180;

/**
 * Normal gravity on the WGS84 ellipsoid at a given latitude, in m/s².
 * Somigliana's closed formula: 9.7803 at the equator, 9.8322 at the poles.
 * The half-percent difference is real and measurable with a bathroom scale of
 * sufficient conviction.
 */
export function normalGravity(latitude) {
  const sin2 = Math.sin(latitude * RAD) ** 2;
  const k = 0.00193185265241;
  return (9.7803253359 * (1 + k * sin2)) / Math.sqrt(1 - WGS84.e2 * sin2);
}

/**
 * Gravity at height `h` metres above the ellipsoid, applying the free-air
 * gradient of −3.086 µm/s² per metre. This is why you weigh very slightly
 * less on a summit than on the beach below it.
 */
export function gravityAtHeight(latitude, heightMetres) {
  return normalGravity(latitude) - 3.086e-6 * heightMetres;
}

/** Geocentric radius of the ellipsoid at a latitude, in metres. */
export function geocentricRadius(latitude) {
  const phi = latitude * RAD;
  const a = WGS84.a;
  const b = WGS84.b;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return Math.sqrt(
    ((a * a * c) ** 2 + (b * b * s) ** 2) / ((a * c) ** 2 + (b * s) ** 2)
  );
}

/**
 * The Coriolis parameter f = 2Ω sin φ, in s⁻¹.
 *
 * Zero on the equator, which is why hurricanes cannot form there, and why the
 * atlas's equatorial islands sit in the doldrums.
 */
export function coriolisParameter(latitude) {
  return 2 * WGS84.omega * Math.sin(latitude * RAD);
}

/**
 * The inertial period: how long a free-moving parcel of water takes to turn a
 * full circle under the Coriolis force. About 17 hours at 45°, and infinite on
 * the equator.
 */
export function inertialPeriodHours(latitude) {
  const f = Math.abs(coriolisParameter(latitude));
  return f > 1e-12 ? (2 * Math.PI) / f / 3600 : Infinity;
}

/**
 * Airy isostasy: how deep a root the island needs to float.
 *
 * A load of relief `h` standing above the surrounding seafloor is held up by a
 * root of low-density crust displacing denser mantle, in the ratio
 * ρ_crust / (ρ_mantle − ρ_crust). For basaltic crust against peridotitic
 * mantle that is about 7.25 — so a kilometre of island demands seven
 * kilometres of root beneath it.
 *
 * This is the classical model and it is an idealisation: real oceanic
 * volcanoes are partly supported by the *flexural* strength of the plate
 * rather than floating freely, so the true root is shallower. Stated, not
 * hidden.
 */
export function isostaticRoot(reliefMetres, {
  crust = DENSITIES.oceanicCrust,
  mantle = DENSITIES.mantle,
} = {}) {
  const ratio = crust / (mantle - crust);
  return {
    ratio,
    rootMetres: reliefMetres * ratio,
    crust,
    mantle,
    model: 'Airy',
  };
}

/**
 * Pressure at the base of an island's root, in pascals.
 *
 * The island's own column plus everything the planet already had beneath it.
 * A kilometre-high island reaches a few hundred megapascals — a thousandth of
 * the core, and still four thousand atmospheres.
 */
export function pressureBeneathIsland(latitude, reliefMetres, options = {}) {
  const { rootMetres } = isostaticRoot(reliefMetres, options);
  const g = normalGravity(latitude);
  const crust = options.crust || DENSITIES.oceanicCrust;

  // The edifice above the seafloor, then its root below it.
  const columnMetres = reliefMetres + rootMetres;
  const ownColumn = crust * g * columnMetres;

  // Plus the planet's own pressure at that depth.
  const background = conditionsAtDepth(columnMetres / 1000).pressurePa;

  return {
    rootMetres,
    columnMetres,
    ownColumnPa: ownColumn,
    totalPa: background,
    totalGPa: background / 1e9,
    atmospheres: background / 101325,
  };
}

/**
 * Volume and mass of the island's visible edifice.
 *
 * Approximated as a cone of the given basal radius and height, which is within
 * a factor of about two for a real volcanic island and is labelled as an
 * estimate wherever it is shown. Better would need the heightfield integrated
 * on the GPU, which is a real option later.
 */
export function edificeMass(radiusMetres, heightMetres, density = DENSITIES.basalt) {
  const volume = (Math.PI * radiusMetres ** 2 * heightMetres) / 3;
  return {
    volumeM3: volume,
    volumeKm3: volume / 1e9,
    massKg: volume * density,
    density,
    shape: 'cone (estimate)',
  };
}

/**
 * The air column above the island, from the pressure actually measured there.
 *
 * `seaLevelPressureHpa` and `temperatureC` come from the live feed, so this is
 * real data driving textbook physics rather than a table of standard values.
 */
export function atmosphericColumn(latitude, summitMetres, seaLevelPressureHpa, temperatureC) {
  const g = normalGravity(latitude);
  const P0 = seaLevelPressureHpa * 100;
  const T0 = temperatureC + 273.15;
  const L = 0.0065; // ISA tropospheric lapse rate, K/m
  const M = 0.0289644; // molar mass of dry air, kg/mol
  const R = 8.31446; // universal gas constant

  // Barometric formula with a linear lapse rate.
  const exponent = (g * M) / (R * L);
  const ratio = Math.max(0.0001, 1 - (L * summitMetres) / T0);
  const summitPressure = P0 * ratio ** exponent;

  // Ideal gas at the surface.
  const airDensity = P0 / ((R / M) * T0);

  // Scale height: the distance over which pressure falls by a factor of e.
  const scaleHeight = (R * T0) / (M * g);

  return {
    gravity: g,
    seaLevelPa: P0,
    summitPa: summitPressure,
    summitHpa: summitPressure / 100,
    dropHpa: (P0 - summitPressure) / 100,
    airDensity,
    scaleHeightMetres: scaleHeight,
    summitTemperatureC: temperatureC - L * summitMetres,
    boilingPointC: boilingPoint(summitPressure),
    // Mass of air standing on every square metre of the island.
    columnMassKgPerM2: P0 / g,
  };
}

/**
 * The boiling point of water at a given pressure, in °C.
 *
 * Clausius–Clapeyron with the latent heat of vaporisation. At the summit of a
 * kilometre-high island water boils a few degrees below 100 °C — small, real,
 * and the sort of thing that would actually matter to somebody living there.
 */
export function boilingPoint(pressurePa) {
  const Lv = 2.257e6; // J/kg
  const Rv = 461.5; // J/(kg·K)
  const T0 = 373.15; // K at 101 325 Pa
  const inverse = 1 / T0 - (Rv / Lv) * Math.log(pressurePa / 101325);
  return 1 / inverse - 273.15;
}

/**
 * Everything the island page needs about the ground and the air.
 *
 * `relief` is the island's height above the sea in metres; `radius` its
 * approximate basal radius; the two climate arguments come from the live feed.
 */
export function islandPhysics(island, { relief, radius, pressureHpa, temperatureC }) {
  const g = normalGravity(island.lat);
  const summitG = gravityAtHeight(island.lat, relief);
  const root = isostaticRoot(relief);
  const beneath = pressureBeneathIsland(island.lat, relief);
  const edifice = edificeMass(radius, relief);
  const air = atmosphericColumn(island.lat, relief, pressureHpa, temperatureC);
  const profile = planetProfile();

  return {
    gravity: g,
    summitGravity: summitG,
    // How much lighter an eighty-kilogram person is at the summit, in grams.
    weightLossGrams: ((g - summitG) / g) * 80 * 1000,
    geocentricRadiusKm: geocentricRadius(island.lat) / 1000,
    coriolis: coriolisParameter(island.lat),
    inertialPeriodHours: inertialPeriodHours(island.lat),
    root,
    beneath,
    edifice,
    air,
    // The distance from here to the centre, which is the same for everyone
    // only if you ignore that the Earth is not a sphere.
    depthToCentreKm: geocentricRadius(island.lat) / 1000,
    planetMass: profile.totalMass,
  };
}
