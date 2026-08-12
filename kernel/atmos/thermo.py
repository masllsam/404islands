"""Moist thermodynamics (docs/03b §3).

Almost everything about where this island is wet and where it is dry descends
from one exponential -- the Clausius-Clapeyron relation.  It is not tunable, and
it should never be tuned.  If the leeward side is not dry enough, the answer is
in the dynamics, not in this file.
"""

from __future__ import annotations

import numpy as np

from ..substrate import kmath as km
from ..substrate.constants import CP_AIR, G_ACC, L_VAP, R_DRY, R_VAP, T0

GAMMA_DRY = G_ACC / CP_AIR          # 9.76 K/km
EPSILON_MW = R_DRY / R_VAP          # 0.622


def saturation_vapour_pressure(t_kelvin):
    """Bolton (1980), accurate to 0.1% over -35..35 C.  Returns Pa."""
    tc = np.asarray(t_kelvin, dtype=np.float64) - T0
    return 611.2 * km.exp(17.67 * tc / (tc + 243.5))


def saturation_mixing_ratio(t_kelvin, pressure_pa):
    es = saturation_vapour_pressure(t_kelvin)
    return EPSILON_MW * es / np.maximum(pressure_pa - es, 1.0)


def vapour_pressure_from_rh(t_kelvin, rh):
    return np.clip(rh, 0.0, 1.5) * saturation_vapour_pressure(t_kelvin)


def dewpoint(vapour_pressure_pa):
    """Inverse of Bolton's formula."""
    e = np.maximum(np.asarray(vapour_pressure_pa, dtype=np.float64), 1.0)
    a = km.log(e / 611.2) / 17.67
    return T0 + 243.5 * a / (1.0 - a)


def moist_lapse_rate(t_kelvin, pressure_pa):
    """Saturated adiabatic lapse rate, K/m.

    Ranges from ~4 K/km in warm moist tropical air to ~9 K/km in cold dry air.
    Using a constant here would make every island's cloud base wrong in a
    different way.
    """
    t = np.asarray(t_kelvin, dtype=np.float64)
    r = saturation_mixing_ratio(t, pressure_pa)
    num = 1.0 + L_VAP * r / (R_DRY * t)
    den = 1.0 + L_VAP ** 2 * r * EPSILON_MW / (CP_AIR * R_DRY * t * t)
    return GAMMA_DRY * num / den


def moist_stability_freq_sq(t_kelvin, pressure_pa, env_lapse):
    """Moist Brunt-Vaisala frequency squared -- the N_m the orographic model needs."""
    gamma_m = moist_lapse_rate(t_kelvin, pressure_pa)
    return np.maximum((G_ACC / t_kelvin) * (gamma_m - env_lapse), 1e-8)


def lifting_condensation_level(t_kelvin, rh):
    """Height of cloud base, m (Espy's approximation, refined)."""
    td = dewpoint(vapour_pressure_from_rh(t_kelvin, rh))
    return np.maximum(125.0 * (np.asarray(t_kelvin, dtype=np.float64) - td), 0.0)


def air_density(t_kelvin, pressure_pa, vapour_pressure_pa=0.0):
    t = np.asarray(t_kelvin, dtype=np.float64)
    pd = np.asarray(pressure_pa, dtype=np.float64) - vapour_pressure_pa
    return pd / (R_DRY * t) + np.asarray(vapour_pressure_pa, dtype=np.float64) / (R_VAP * t)


def pressure_at_height(elevation_m, t_sea_kelvin=288.15, p0=101325.0, lapse=0.0065):
    """Hypsometric equation with a constant lapse rate."""
    z = np.maximum(np.asarray(elevation_m, dtype=np.float64), 0.0)
    t = np.maximum(t_sea_kelvin - lapse * z, 180.0)
    return p0 * km.pow(t / t_sea_kelvin, G_ACC / (R_DRY * lapse))


def psychrometric_constant(pressure_pa):
    return CP_AIR * np.asarray(pressure_pa, dtype=np.float64) / (EPSILON_MW * L_VAP)


def delta_svp(t_kelvin):
    """d(es)/dT -- the slope term in Penman-Monteith.  Pa/K."""
    tc = np.asarray(t_kelvin, dtype=np.float64) - T0
    es = saturation_vapour_pressure(t_kelvin)
    return 4098.0 * es / np.maximum((tc + 243.5) ** 2, 1e-6)


def penman_monteith(net_radiation, ground_flux, t_kelvin, vpd_pa, pressure_pa,
                    r_a, r_s):
    """Latent heat flux, W/m2 (Monteith 1965).

    r_s comes from the biosphere's stomatal model, so the vegetation genuinely
    controls its own evaporative cooling -- and therefore the humidity, and
    therefore, through the orographic model, some of its own rainfall.
    """
    delta = delta_svp(t_kelvin)
    gamma = psychrometric_constant(pressure_pa)
    rho = air_density(t_kelvin, pressure_pa)
    avail = np.asarray(net_radiation, dtype=np.float64) - np.asarray(ground_flux, dtype=np.float64)
    num = delta * avail + rho * CP_AIR * np.maximum(vpd_pa, 0.0) / np.maximum(r_a, 1.0)
    den = delta + gamma * (1.0 + np.asarray(r_s, dtype=np.float64) / np.maximum(r_a, 1.0))
    return num / np.maximum(den, 1e-6)


def aerodynamic_resistance(wind_ms, canopy_height_m):
    """Neutral-stability log-law resistance, s/m.

    Stability corrections are a Milestone-2 item; the neutral form is within
    ~20% for the windy maritime conditions that dominate an island.
    """
    h = np.maximum(canopy_height_m, 0.05)
    z0 = 0.1 * h
    d = 0.65 * h
    zm = np.maximum(h + 2.0, 2.0)
    u = np.maximum(wind_ms, 0.3)
    lg = km.log((zm - d) / z0)
    return lg * lg / (0.16 * u)
