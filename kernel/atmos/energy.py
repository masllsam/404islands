"""Radiation on real terrain, the surface energy balance, and the slab ocean.

Two things here matter more than their line count suggests:

* **Slope, aspect, and cast shadow.** A north-facing gully and the south-facing
  spur beside it receive different amounts of sun, so they hold different
  moisture, grow different vegetation, and select for different traits.  That
  asymmetry, repeated across every ridge, is most of what makes a simulated
  island look inhabited rather than rendered.
* **The slab ocean's thermal inertia.** It is why maritime seasons lag the sun by
  two months and swing gently.  It gives the object its unhurried breathing, and
  it is a result here, not a parameter.
"""

from __future__ import annotations

import numpy as np

from ..substrate import kmath as km
from ..substrate.constants import CP_WATER, RHO_SEAWATER, SIGMA_SB, T0
from . import orbital, thermo

MIXED_LAYER_DEPTH_M = 50.0
OCEAN_HEAT_CAPACITY = RHO_SEAWATER * CP_WATER * MIXED_LAYER_DEPTH_M  # J m-2 K-1
ALBEDO_WATER = 0.06
ALBEDO_ROCK = 0.14
ALBEDO_SNOW = 0.75

# Fraction of top-of-atmosphere shortwave reaching the surface under clear sky,
# daily mean: the atmosphere absorbs ~20% and scatters some back to space.
ATMOS_SW_TRANSMISSION = 0.62


def clear_sky_transmission(elevation_rad, elevation_m, precipitable_water_mm=25.0):
    """Two-band Beer-Lambert with air mass and water vapour."""
    sin_e = np.maximum(km.sin(elevation_rad), 0.02)
    airmass = 1.0 / sin_e
    p_ratio = km.exp(-np.maximum(elevation_m, 0.0) / 8400.0)
    tau_r = km.exp(-0.09 * airmass * p_ratio)                    # Rayleigh + aerosol
    tau_w = 1.0 - 0.077 * km.pow(precipitable_water_mm * airmass / 25.0, 0.3)
    return np.clip(tau_r * tau_w, 0.0, 1.0)


def cloud_transmission(cloud_fraction):
    """Kasten & Czeplak (1980)."""
    c = np.clip(cloud_fraction, 0.0, 1.0)
    return 1.0 - 0.75 * km.pow(np.maximum(c, 1e-6), 3.4)


def terrain_factors(grid, z: np.ndarray):
    """Slope, aspect and sky-view factor.  Cached per terrain epoch."""
    slope = km.atan2(grid.slope(z), np.ones(z.shape))
    aspect = grid.aspect_rad(z)
    sky_view = (1.0 + km.cos(slope)) * 0.5
    return slope, aspect, sky_view


def incidence_cosine(sun_elev, sun_azi, slope, aspect):
    """cos of the angle between the beam and the surface normal."""
    return np.maximum(
        km.sin(sun_elev) * km.cos(slope)
        + km.cos(sun_elev) * km.sin(slope) * km.cos(sun_azi - aspect),
        0.0,
    )


def shortwave_on_terrain(grid, z: np.ndarray, sun_elev: float, sun_azi: float,
                         r_factor: float, cloud: float, albedo: np.ndarray,
                         slope, aspect, sky_view):
    """Direct + diffuse + terrain-reflected shortwave, W/m2."""
    from ..substrate.constants import SOLAR_CONSTANT

    if sun_elev <= 0.0:
        return np.zeros(z.shape)
    tau = float(clear_sky_transmission(sun_elev, 0.0)) * float(cloud_transmission(cloud))
    beam_normal = SOLAR_CONSTANT * r_factor * tau
    direct = beam_normal * incidence_cosine(sun_elev, sun_azi, slope, aspect)
    horizontal = SOLAR_CONSTANT * r_factor * float(km.sin(sun_elev))
    diffuse = 0.3 * horizontal * (0.2 + 0.8 * cloud) * sky_view
    reflected = (1.0 - sky_view) * albedo * horizontal * 0.5
    return direct + diffuse + reflected


def downward_longwave(t_air_k, vapour_pressure_pa, cloud):
    """Brutsaert (1975) bulk emissivity with a cloud correction."""
    eps_a = 1.24 * km.pow(np.maximum(vapour_pressure_pa, 1.0) / 100.0 / t_air_k, 1.0 / 7.0)
    eps_a = np.clip(eps_a * (1.0 + 0.22 * np.clip(cloud, 0.0, 1.0) ** 2), 0.5, 1.0)
    return eps_a * SIGMA_SB * km.pow(t_air_k, 4.0)


def surface_temperature(sw_net, lw_down, t_air_k, vpd_pa, pressure_pa, r_a, r_s,
                        ground_flux, emissivity=0.97, iterations=4):
    """Solve R_n = H + LE + G for the skin temperature.

    Newton with a fixed iteration count -- a convergence test would make the
    number of iterations data-dependent, and therefore a determinism hazard
    across compilers that reorder the residual (docs/02 §D1).
    """
    from ..substrate.constants import CP_AIR

    t_s = np.array(t_air_k, dtype=np.float64, copy=True)
    rho = thermo.air_density(t_air_k, pressure_pa)
    gamma = thermo.psychrometric_constant(pressure_pa)
    for _ in range(iterations):
        lw_up = emissivity * SIGMA_SB * km.pow(t_s, 4.0)
        h = rho * CP_AIR * (t_s - t_air_k) / np.maximum(r_a, 1.0)
        vpd_s = np.maximum(thermo.saturation_vapour_pressure(t_s)
                           - (thermo.saturation_vapour_pressure(t_air_k) - vpd_pa), 0.0)
        le = rho * CP_AIR * vpd_s / (gamma * np.maximum(r_a + r_s, 1.0))
        f = sw_net + lw_down - lw_up - h - le - ground_flux
        dlw = 4.0 * emissivity * SIGMA_SB * km.pow(t_s, 3.0)
        dh = rho * CP_AIR / np.maximum(r_a, 1.0)
        dle = (rho * CP_AIR * thermo.delta_svp(t_s)
               / (gamma * np.maximum(r_a + r_s, 1.0)))
        t_s = t_s + f / np.maximum(dlw + dh + dle, 1e-3)
        t_s = np.clip(t_s, 180.0, 350.0)
    return t_s


class SlabOcean:
    """A well-mixed surface layer with real heat capacity.

    Integrated forward with the actual daily-mean insolation, so the seasonal lag
    and amplitude are emergent.  ``transport`` stands in for the meridional heat
    transport that a 10 km domain cannot possibly resolve, tuned once so that a
    global-mean-like column sits near observed SST for its latitude; it is
    documented as tuned (docs/03b §6).
    """

    def __init__(self, latitude_deg: float, sst_initial_c: float | None = None):
        self.latitude_rad = float(np.deg2rad(latitude_deg))
        # Observed zonal-mean SST, floored at the freezing point of seawater.
        # Beyond ~60 deg the ocean is at -1.8 C and forms ice; islands there get
        # a polar climate rather than an impossible one.
        target = max(29.0 - 0.0075 * abs(latitude_deg) ** 2.1, -1.8)
        self.sst_k = T0 + (target if sst_initial_c is None else sst_initial_c)
        self.transport_w_m2 = 0.0
        self._calibrate(target)

    # Bulk transfer coefficients over the open ocean (Large & Yeager 2004).
    CE_LATENT = 1.3e-3
    CH_SENSIBLE = 1.0e-3
    WIND_REFERENCE_MS = 7.0
    RH_MARINE = 0.80

    def _fluxes(self, sst_k: float, cloud: float) -> tuple[float, float, float]:
        """Net longwave, latent, and sensible loss from the surface, W/m2.

        Latent heat is the largest single term in a tropical ocean's budget --
        around 120 W/m2 -- and it rises steeply with SST through
        Clausius-Clapeyron.  That is the negative feedback that pins tropical
        SST near 28-30 C.  Leaving it out (as an earlier revision did) lets the
        slab run away past 45 C, which then cooks the biosphere.  It is a good
        example of why the missing term matters more than the tuned one.
        """
        from ..substrate.constants import CP_AIR, L_VAP, RHO_AIR

        e_a = self.RH_MARINE * float(thermo.saturation_vapour_pressure(sst_k))
        lw_net = (0.97 * SIGMA_SB * sst_k ** 4
                  - float(downward_longwave(sst_k - 1.5, e_a, cloud)))

        p = 101325.0
        q_s = 0.622 * float(thermo.saturation_vapour_pressure(sst_k)) / p
        q_a = self.RH_MARINE * q_s
        latent = (RHO_AIR * L_VAP * self.CE_LATENT * self.WIND_REFERENCE_MS
                  * max(q_s - q_a, 0.0))
        sensible = (RHO_AIR * CP_AIR * self.CH_SENSIBLE * self.WIND_REFERENCE_MS
                    * 1.5)   # air ~1.5 K cooler than the skin, on average
        return lw_net, latent, sensible

    def _calibrate(self, target_c: float) -> None:
        """Choose the residual transport term so the annual mean lands on target.

        Everything else in the budget is computed; this one number stands in for
        the meridional heat transport that a 20 km domain cannot resolve, and it
        is the only tuned quantity in the ocean.  Documented as tuned
        (docs/03b §6).
        """
        orbit = orbital.Orbit()
        samples = list(range(0, 365, 5))
        total = 0.0
        for d in samples:
            decl, rf = orbital.solar_state(float(d), orbit)
            total += orbital.daily_mean_toa(self.latitude_rad, decl, rf)
        mean_toa = total / len(samples)
        absorbed = (mean_toa * (1.0 - ALBEDO_WATER) * ATMOS_SW_TRANSMISSION
                    * float(cloud_transmission(0.45)))
        lw, le, h = self._fluxes(T0 + target_c, 0.45)
        # Sign: transport is what the ocean circulation *removes*.  Net must be
        # zero at the target, so transport = losses - absorbed.  (Getting this
        # backwards makes the slab self-heat until it saturates its clip, which
        # is exactly what an unbalanced energy budget looks like.)
        self.transport_w_m2 = (lw + le + h) - absorbed

    def step(self, day_of_year: float, orbit: orbital.Orbit, cloud: float,
             dt_days: float) -> float:
        decl, rf = orbital.solar_state(day_of_year, orbit)
        toa = orbital.daily_mean_toa(self.latitude_rad, decl, rf)
        sw = (toa * (1.0 - ALBEDO_WATER) * float(cloud_transmission(cloud))
              * ATMOS_SW_TRANSMISSION)
        lw_net, latent, sensible = self._fluxes(self.sst_k, cloud)
        net = sw - lw_net - latent - sensible + self.transport_w_m2
        self.last_net_w_m2 = net
        self.sst_k += net * dt_days * 86400.0 / OCEAN_HEAT_CAPACITY
        # Seawater freezes at -1.8 C and the latent heat of fusion buffers it
        # there: further cooling makes ice, not colder water.  Without this floor
        # a high-latitude island's ocean runs to impossible temperatures in
        # midwinter.
        self.sst_k = float(np.clip(self.sst_k, T0 - 1.8, 320.0))
        return self.sst_k

    @property
    def sst_c(self) -> float:
        return self.sst_k - T0
