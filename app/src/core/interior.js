/**
 * The inside of the planet.
 *
 * Everything above the waterline in this atlas is measured or computed. Below
 * it, until now, there was nothing — the islands floated on an abstraction.
 * This is the rest of the world: the density, gravity, pressure and
 * temperature of the Earth from the surface to the centre.
 *
 * The density profile is PREM, the Preliminary Reference Earth Model
 * (Dziewonski & Anderson, 1981), which is still the standard reference and is
 * itself derived from seismology — travel times, normal modes, and the
 * planet's mass and moment of inertia. It is given as polynomials in the
 * normalized radius x = r/a.
 *
 * Gravity and pressure are *not* tabulated here. They are integrated from that
 * density, which is the honest way round and makes the model checkable:
 *
 *     m(r) = ∫₀ʳ 4πr′² ρ(r′) dr′          mass enclosed
 *     g(r) = G·m(r) / r²                   gravity from the shell theorem
 *     P(r) = ∫ᵣᴿ ρ(r′) g(r′) dr′           hydrostatic equilibrium
 *
 * Integrating that from the surface inward reproduces, from the density alone,
 * the numbers the literature quotes: about 136 GPa at the core–mantle
 * boundary, 329 GPa at the inner core boundary, and 364 GPa at the centre —
 * some 3.6 million atmospheres. The tests check exactly those, along with the
 * planet's total mass and its moment of inertia factor.
 *
 * The atmosphere contributes 1 bar, or 0.0001 GPa. It is not that it is
 * ignored; it is that it is three parts in ten million of the answer.
 */

/** Gravitational constant, CODATA 2018, m³ kg⁻¹ s⁻². */
export const G = 6.6743e-11;

/** PREM's Earth radius, in metres. */
export const EARTH_RADIUS = 6371000;

/**
 * PREM density shells. Each is valid from `top` downward to the next one's
 * top, with density in g/cm³ as a polynomial in x = r/6371 km, given
 * lowest-order coefficient first.
 */
export const PREM_SHELLS = [
  { name: 'Ocean', top: 6371.0, rho: [1.02] },
  { name: 'Upper crust', top: 6368.0, rho: [2.6] },
  { name: 'Lower crust', top: 6356.0, rho: [2.9] },
  { name: 'Lithospheric mantle', top: 6346.6, rho: [2.691, 0.6924] },
  { name: 'Low-velocity zone', top: 6291.0, rho: [2.691, 0.6924] },
  { name: 'Transition zone', top: 6151.0, rho: [7.1089, -3.8045] },
  { name: 'Transition zone', top: 5971.0, rho: [11.2494, -8.0298] },
  { name: 'Transition zone', top: 5771.0, rho: [5.3197, -1.4836] },
  { name: 'Lower mantle', top: 5701.0, rho: [7.9565, -6.4761, 5.5283, -3.0807] },
  { name: 'Outer core', top: 3480.0, rho: [12.5815, -1.2638, -3.6426, -5.5281] },
  { name: 'Inner core', top: 1221.5, rho: [13.0885, 0, -8.8381] },
];

/** The boundaries a person has heard of, by depth in kilometres. */
export const BOUNDARIES = {
  seafloor: 3,
  moho: 24.4,
  lowVelocityZone: 80,
  transition410: 400,
  transition660: 670,
  coreMantle: 2891,
  innerCore: 5150,
  centre: 6371,
};

/**
 * PREM density at radius `rKm`, in kg/m³.
 */
export function density(rKm) {
  const r = Math.max(0, Math.min(EARTH_RADIUS / 1000, rKm));
  const x = r / 6371;

  // Shells are ordered outward-in; the first whose top is at or above r wins.
  let shell = PREM_SHELLS[PREM_SHELLS.length - 1];
  for (const candidate of PREM_SHELLS) {
    if (r <= candidate.top) shell = candidate;
    else break;
  }

  let rho = 0;
  for (let i = shell.rho.length - 1; i >= 0; i--) rho = rho * x + shell.rho[i];
  return rho * 1000; // g/cm³ → kg/m³
}

/** Which named layer a given depth falls in. */
export function layerAtDepth(depthKm) {
  if (depthKm < BOUNDARIES.seafloor) return 'Ocean';
  if (depthKm < BOUNDARIES.moho) return 'Oceanic crust';
  if (depthKm < BOUNDARIES.transition410) return 'Upper mantle';
  if (depthKm < BOUNDARIES.transition660) return 'Transition zone';
  if (depthKm < BOUNDARIES.coreMantle) return 'Lower mantle';
  if (depthKm < BOUNDARIES.innerCore) return 'Outer core (liquid)';
  return 'Inner core (solid)';
}

/**
 * Temperature estimate, in kelvin, at a given depth.
 *
 * This is the least certain quantity in the whole model and is presented as
 * an estimate everywhere it appears. Density is pinned by seismology to a
 * fraction of a percent; temperature is inferred from phase boundaries and
 * the melting curve of iron, and the published values at the core disagree by
 * several hundred kelvin. These anchors follow the mainstream geotherm, with
 * the inner core boundary set by the iron melting curve at 329 GPa — which is
 * exactly the measurement that calibrates the whole profile.
 */
const GEOTHERM = [
  [0, 288], // surface
  [3, 275], // seafloor: cold bottom water
  [24, 750], // Moho
  [100, 1600], // base of the lithosphere
  [410, 1800], // olivine → wadsleyite
  [660, 1900], // ringwoodite → bridgmanite + ferropericlase
  [2700, 2900], // lower mantle, near-adiabatic
  [2891, 4000], // core–mantle boundary, with its thermal boundary layer
  [5150, 5400], // inner core boundary: the iron melting point at 329 GPa
  [6371, 5700], // centre
];

export function temperature(depthKm) {
  const d = Math.max(0, Math.min(6371, depthKm));
  for (let i = 1; i < GEOTHERM.length; i++) {
    const [d0, t0] = GEOTHERM[i - 1];
    const [d1, t1] = GEOTHERM[i];
    if (d <= d1) {
      const f = d1 === d0 ? 0 : (d - d0) / (d1 - d0);
      return t0 + (t1 - t0) * f;
    }
  }
  return GEOTHERM[GEOTHERM.length - 1][1];
}

let cachedProfile = null;

/**
 * Integrate the whole planet.
 *
 * Returns arrays sampled every `stepKm` from the centre outward: enclosed
 * mass, gravity, and pressure. Computed once and cached — it is the same for
 * every island, because it is the same planet.
 */
export function planetProfile(stepKm = 1) {
  if (cachedProfile && cachedProfile.stepKm === stepKm) return cachedProfile;

  const steps = Math.round(6371 / stepKm);
  const dr = stepKm * 1000;

  const radius = new Float64Array(steps + 1);
  const rho = new Float64Array(steps + 1);
  const mass = new Float64Array(steps + 1);
  const gravity = new Float64Array(steps + 1);
  const pressure = new Float64Array(steps + 1);

  // Outward pass: mass enclosed, then gravity from the shell theorem. Density
  // is sampled at the midpoint of each shell, which makes this second-order
  // accurate rather than first.
  let m = 0;
  for (let i = 0; i <= steps; i++) {
    const rKm = i * stepKm;
    const r = rKm * 1000;
    radius[i] = rKm;
    rho[i] = density(rKm);

    if (i > 0) {
      const rMidKm = (i - 0.5) * stepKm;
      const rMid = rMidKm * 1000;
      m += 4 * Math.PI * rMid * rMid * density(rMidKm) * dr;
    }
    mass[i] = m;
    gravity[i] = r > 0 ? (G * m) / (r * r) : 0;
  }

  // Inward pass: hydrostatic equilibrium, starting from one atmosphere at the
  // surface. That 101 325 Pa is the entire contribution of the air, and it is
  // carried purely so nobody has to wonder whether it was left out.
  pressure[steps] = 101325;
  for (let i = steps - 1; i >= 0; i--) {
    const rhoMid = density((i + 0.5) * stepKm);
    const gMid = 0.5 * (gravity[i] + gravity[i + 1]);
    pressure[i] = pressure[i + 1] + rhoMid * gMid * dr;
  }

  cachedProfile = {
    stepKm,
    steps,
    radius,
    density: rho,
    mass,
    gravity,
    pressure,
    totalMass: mass[steps],
    surfaceGravity: gravity[steps],
    centralPressure: pressure[0],
    meanDensity: mass[steps] / ((4 / 3) * Math.PI * EARTH_RADIUS ** 3),
  };
  return cachedProfile;
}

/** Linear sample of a profile array at an arbitrary depth. */
function sampleAtDepth(profile, array, depthKm) {
  const rKm = Math.max(0, Math.min(6371, 6371 - depthKm));
  const index = rKm / profile.stepKm;
  const i = Math.floor(index);
  if (i >= profile.steps) return array[profile.steps];
  const f = index - i;
  return array[i] + (array[i + 1] - array[i]) * f;
}

/**
 * The full state of the planet at one depth: what it is made of, how heavy it
 * is, how hard it is squeezed, and how hot.
 */
export function conditionsAtDepth(depthKm) {
  const profile = planetProfile();
  const pressurePa = sampleAtDepth(profile, profile.pressure, depthKm);

  return {
    depthKm,
    layer: layerAtDepth(depthKm),
    density: sampleAtDepth(profile, profile.density, depthKm),
    gravity: sampleAtDepth(profile, profile.gravity, depthKm),
    pressurePa,
    pressureGPa: pressurePa / 1e9,
    /** In multiples of standard atmospheric pressure. */
    atmospheres: pressurePa / 101325,
    temperatureK: temperature(depthKm),
    temperatureC: temperature(depthKm) - 273.15,
  };
}

/**
 * A cross-section of the planet at the boundaries worth naming — the section
 * the island page draws.
 */
export function crossSection() {
  return [
    { name: 'Sea surface', depthKm: 0 },
    { name: 'Seafloor', depthKm: BOUNDARIES.seafloor },
    { name: 'Mohorovičić discontinuity', depthKm: BOUNDARIES.moho },
    { name: 'Base of the lithosphere', depthKm: BOUNDARIES.lowVelocityZone },
    { name: '410 km discontinuity', depthKm: BOUNDARIES.transition410 },
    { name: '660 km discontinuity', depthKm: BOUNDARIES.transition660 },
    { name: 'Core–mantle boundary', depthKm: BOUNDARIES.coreMantle },
    { name: 'Inner core boundary', depthKm: BOUNDARIES.innerCore },
    { name: 'Centre of the Earth', depthKm: BOUNDARIES.centre },
  ].map((entry) => ({ ...entry, ...conditionsAtDepth(entry.depthKm) }));
}

/**
 * Moment of inertia factor, I/MR². The measured value is 0.3307, and it is one
 * of the two integral constraints — with the total mass — that any density
 * model has to satisfy. A uniform sphere would give 0.4; the Earth's lower
 * number is the signature of its dense core.
 */
export function momentOfInertiaFactor() {
  const profile = planetProfile();
  const dr = profile.stepKm * 1000;
  let moment = 0;

  for (let i = 1; i <= profile.steps; i++) {
    const rMid = (i - 0.5) * profile.stepKm * 1000;
    const rhoMid = density((i - 0.5) * profile.stepKm);
    moment += (8 / 3) * Math.PI * rhoMid * rMid ** 4 * dr;
  }

  return moment / (profile.totalMass * EARTH_RADIUS ** 2);
}
