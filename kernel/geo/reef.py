"""Coral accretion, and the race that defines the island's whole life.

Bosscher & Schlager (1992): coral growth is light-limited, and light falls off
exponentially with depth.  Set that against thermal subsidence and Darwin's 1842
sequence follows with no special-casing at all:

    growth > subsidence  ->  fringing reef, widening
    growth ~ subsidence  ->  barrier reef with a lagoon
    growth < subsidence  ->  the reef gives up; a guyot drowns

An owner is watching this race.  It is the slowest thing in the piece and the
one that will still be undecided when they hand it on.
"""

from __future__ import annotations

import numpy as np

from ..substrate import kmath as km

I0_SURFACE = 2000.0   # umol m-2 s-1, midday PAR at the sea surface
IK = 250.0            # umol m-2 s-1, saturating irradiance for coral
K_ATTEN = 0.09        # m-1, clear oceanic water
G_MAX_M_YR = 0.012    # m yr-1, ~12 mm/yr for a healthy shallow reef


def growth_rate_m_yr(depth_m: np.ndarray, sst_c: float, turbidity: np.ndarray,
                     omega_arag: float = 3.5) -> np.ndarray:
    """Vertical accretion rate as a function of depth, temperature, turbidity."""
    depth = np.maximum(depth_m, 0.0)
    light = km.tanh(I0_SURFACE * km.exp(-K_ATTEN * depth) / IK)

    # Thermal window: growth peaks ~27 C, collapses under bleaching stress and
    # in cold water.  This is why high-latitude islands in the edition have no
    # reef at all, and why a warming ocean can end one.
    f_t = km.exp(-0.5 * ((sst_c - 27.0) / 4.0) ** 2)
    if sst_c > 31.0:
        f_t *= float(km.exp(-2.0 * (sst_c - 31.0)))
    if sst_c < 18.0:
        f_t = 0.0

    f_omega = np.clip((omega_arag - 2.0) / 1.5, 0.0, 1.0)
    f_turb = km.exp(-turbidity / 0.05)  # river plumes kill reef opposite deltas

    rate = G_MAX_M_YR * light * f_t * f_omega * f_turb
    return np.where(depth <= 0.0, 0.0, rate)


def step(z: np.ndarray, reef_thickness: np.ndarray, sea_level: float, sst_c: float,
         turbidity: np.ndarray, dt_yr: float, shelf_mask: np.ndarray):
    """Accrete reef where conditions allow.  Returns (z, reef_thickness, stage)."""
    depth = sea_level - z
    rate = growth_rate_m_yr(depth, sst_c, turbidity)
    # Coral cannot grow above low tide; it planes off at the surface, which is
    # what makes reef flats flat.
    headroom = np.maximum(depth - 0.3, 0.0)
    growth = np.minimum(rate * dt_yr, headroom) * shelf_mask
    return z + growth, reef_thickness + growth, classify(z + growth, sea_level, shelf_mask)


def classify(z: np.ndarray, sea_level: float, shelf_mask: np.ndarray) -> str:
    """Name the island's position in Darwin's sequence.

    Reported on the instrument panel and in the chronicle.  For most pieces this
    string changes two or three times per human lifetime, and each change is an
    event worth marking.
    """
    land = z > sea_level
    land_area = int(np.sum(land))
    if land_area == 0:
        return "guyot"

    near_surface = shelf_mask & (~land) & (sea_level - z < 3.0)
    lagoon = shelf_mask & (~land) & (sea_level - z >= 8.0)
    n_reef = int(np.sum(near_surface))
    n_lagoon = int(np.sum(lagoon))

    if n_reef == 0:
        return "no-reef"
    if land_area < 0.04 * n_reef:
        return "atoll"
    if n_lagoon > 0.5 * n_reef:
        return "barrier-reef"
    return "fringing-reef"


REEF_STAGE_ID = {
    "no-reef": 0,
    "fringing-reef": 1,
    "barrier-reef": 2,
    "atoll": 3,
    "guyot": 4,
}
