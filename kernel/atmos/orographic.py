"""Orographic precipitation -- Smith & Barstad (2004) linear theory.

The most consequential ~60 lines in the kernel.  This is what makes one side of
the island a rainforest and the other a desert, and thereby what makes the
landscape asymmetric, the soils different, the vegetation different, and the
selection pressures different on either side of a single ridge.  Kauai gets over
11 m of rain a year on its summit and half a metre on its leeward coast, 20 km
away.  A factor of twenty, from terrain alone.

The theory is linear and analytic in Fourier space: one FFT pair per weather
step.  It includes airborne moisture advection and hydrometeor fallout delays,
which is why the rain maximum sits *downwind* of the crest rather than on it,
and why there is a sharp lee-side shadow rather than a smooth falloff.
"""

from __future__ import annotations

import numpy as np

from ..substrate import kmath as km
from ..substrate.constants import L_VAP, R_VAP
from . import thermo

HW_MOISTURE_SCALE_M = 2500.0   # moisture scale height
TAU_C_S = 500.0                # cloud water conversion time
TAU_F_S = 500.0                # hydrometeor fallout time

# Moist stability of the trade-wind layer.  The formal moist Brunt-Vaisala
# frequency goes imaginary in conditionally-unstable tropical air, which the
# linear theory cannot represent; we floor it at a stability typical of the
# trade inversion.  Documented approximation (docs/03b §6).
NM_MIN = 5.0e-3               # s-1

# THE ONE TUNED SCALAR IN THIS FILE.
#
# Smith & Barstad's theory gives the precipitation rate during moist upslope
# flow.  An annual total is that rate times the fraction of the year such flow
# actually occurs, and no part of the linear theory predicts that fraction.
# Rather than bury the discrepancy in C_w -- where it would silently corrupt the
# thermodynamics -- it is isolated here as an explicit duty factor, calibrated
# once against Kauai (summit ~11 m/yr, leeward coast ~0.5 m/yr, island mean
# ~2 m/yr) and never touched again.  See tests/emergent/test_orographic.py.
WET_FRACTION = 0.12


def background_rate_mm_hr(sst_c: float, latitude_deg: float) -> float:
    """Non-orographic rainfall: convective and frontal.

    A 10 km domain cannot generate its own convection or its own fronts, so the
    rain that does not come from lifting over the island is imposed from the
    regime the island sits in (docs/03b §1).  Two sources, both real: deep
    convection over a warm ocean in the tropics, and travelling fronts in the
    mid-latitudes.  This is why an atoll -- entirely below its own condensation
    level, and therefore with no orographic rain at all -- is nonetheless not a
    desert.
    """
    convective = 1600.0 * min(max((sst_c - 22.0) / 6.0, 0.0), 1.0)
    frontal = 700.0 * min(max((abs(latitude_deg) - 30.0) / 20.0, 0.0), 1.0)
    return (250.0 + convective + frontal) / (24.0 * 365.2422)


def uplift_sensitivity(t_sea_kelvin: float, pressure_pa: float = 101325.0) -> float:
    """C_w = rho_sref * Gamma_m / gamma_m, the kg/m3 of condensate per unit uplift."""
    rho_sref = (thermo.saturation_vapour_pressure(t_sea_kelvin)
                / (R_VAP * t_sea_kelvin))
    gamma_env = 0.0065
    gamma_m = float(thermo.moist_lapse_rate(t_sea_kelvin, pressure_pa))
    return float(rho_sref) * gamma_m / max(gamma_env, 1e-6)


def precipitation(grid, elevation_m: np.ndarray, wind_u: float, wind_v: float,
                  t_sea_kelvin: float, background_mm_hr: float = 0.02,
                  humidity_scale: float = 1.0) -> np.ndarray:
    """Precipitation rate, mm/hr.

    Returns background + orographic; negative orographic contributions (lee-side
    drying) are allowed to cancel the background down to zero, which is exactly
    the rain shadow.
    """
    ny, nx = grid.shape
    speed = float(np.hypot(wind_u, wind_v))
    h_raw = np.maximum(elevation_m, 0.0)
    h_max = float(np.max(h_raw))

    # (1) Condensation threshold.  Air lifted below its lifting condensation
    # level produces no rain, so only the terrain above the LCL forces
    # precipitation.  This is why atolls are dry and 2 km islands are drenched --
    # a difference of a factor of ten that no purely linear model would give.
    rh_trade = 0.80
    z_lcl = float(thermo.lifting_condensation_level(t_sea_kelvin, rh_trade))
    h_eff = np.maximum(h_raw - z_lcl, 0.0)

    # (2) Froude blocking.  When Fr = U / (N h) < 1, air below the dividing
    # streamline goes *around* the obstacle rather than over it (docs/03b §6).
    nm = max(float(np.sqrt(max(
        float(thermo.moist_stability_freq_sq(t_sea_kelvin, 101325.0, 0.0065)), 0.0))), NM_MIN)
    if h_max > 1.0:
        froude = speed / max(nm * h_max, 1e-6)
        h_eff = h_eff * min(1.0, froude)

    # Mirror-pad: a hard-edged island in a periodic transform would rain on
    # itself from the opposite side of the domain.
    py, px = ny // 2, nx // 2
    h = np.pad(h_eff, ((py,), (px,)), mode="constant")
    Ny, Nx = h.shape

    ky = 2.0 * np.pi * np.fft.fftfreq(Ny, d=grid.cell_size_m)
    kx = 2.0 * np.pi * np.fft.fftfreq(Nx, d=grid.cell_size_m)
    KX, KY = np.meshgrid(kx, ky, indexing="xy")

    sigma = wind_u * KX + wind_v * KY                    # intrinsic frequency
    k2 = KX * KX + KY * KY

    nm2 = nm * nm

    with np.errstate(divide="ignore", invalid="ignore"):
        s2 = np.where(np.abs(sigma) < 1e-12, 1e-12, sigma) ** 2
        m2 = (nm2 - s2) * k2 / s2
        # Propagating waves (m2 > 0) vs. evanescent (m2 < 0); branch chosen so
        # energy radiates upward / decays with height, per Smith & Barstad.
        m = np.where(
            m2 >= 0.0,
            np.sign(sigma) * np.sqrt(np.abs(m2)),
            1j * np.sqrt(np.abs(m2)),
        )

    cw = uplift_sensitivity(t_sea_kelvin) * humidity_scale
    h_hat = np.fft.fft2(h)

    denom = ((1.0 - 1j * m * HW_MOISTURE_SCALE_M)
             * (1.0 + 1j * sigma * TAU_C_S)
             * (1.0 + 1j * sigma * TAU_F_S))
    with np.errstate(divide="ignore", invalid="ignore"):
        p_hat = cw * 1j * sigma * h_hat / denom
    p_hat = np.where(np.isfinite(p_hat), p_hat, 0.0)
    p_hat[0, 0] = 0.0

    p_kg_m2_s = np.real(np.fft.ifft2(p_hat))
    p_mm_hr = p_kg_m2_s * 3600.0 * WET_FRACTION
    p_mm_hr = p_mm_hr[py:py + ny, px:px + nx]

    return np.maximum(p_mm_hr + background_mm_hr, 0.0)


def annual_precipitation_mm(grid, elevation_m: np.ndarray, wind_u: float, wind_v: float,
                            t_sea_kelvin: float, background_mm_hr: float = 0.02,
                            wind_variability: float = 0.35) -> np.ndarray:
    """Climatological annual total, mm/yr.

    Averaged over a small fan of wind directions rather than one: real trade winds
    wander, and a single direction produces an unrealistically knife-edged shadow
    that would then carve an unrealistically knife-edged landscape.
    """
    total = grid.zeros()
    weights = 0.0
    for offset, w in ((-wind_variability, 0.25), (0.0, 0.5), (wind_variability, 0.25)):
        c, s = float(km.cos(offset)), float(km.sin(offset))
        u = wind_u * c - wind_v * s
        v = wind_u * s + wind_v * c
        total = total + w * precipitation(grid, elevation_m, u, v, t_sea_kelvin,
                                          background_mm_hr)
        weights += w
    return (total / weights) * 24.0 * 365.2422
