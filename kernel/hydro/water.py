"""Soil water, runoff generation, and the island's freshwater lens.

The water budget is the easiest budget for a sceptical observer to audit, so it
is the one that must be beyond reproach.  Every term here reports to the ledger.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..substrate import kmath as km
from ..substrate.constants import L_VAP, RHO_SEAWATER, RHO_WATER

# Clapp & Hornberger (1978) parameters by texture class.
TEXTURE = {
    "ash":   dict(theta_s=0.55, psi_s=-0.12, k_s=2.0e-5, b=3.5),   # young volcanic
    "loam":  dict(theta_s=0.45, psi_s=-0.35, k_s=7.0e-6, b=5.4),
    "clay":  dict(theta_s=0.48, psi_s=-0.63, k_s=1.3e-6, b=11.4),  # ancient, lateritic
    "rock":  dict(theta_s=0.08, psi_s=-0.05, k_s=1.0e-4, b=2.0),   # bare lava
}


def texture_from_age(soil_age_yr: np.ndarray) -> dict[str, np.ndarray]:
    """Soils coarsen to loam and then to clay as they age.

    So the island's hydrology ages with it: a young island sheds rain through
    porous ash, an ancient one holds it in clay and sheds it overland.  Same
    rainfall, different rivers.
    """
    f_clay = np.clip(soil_age_yr / 3.0e5, 0.0, 1.0)
    f_ash = np.clip(1.0 - soil_age_yr / 2.0e4, 0.0, 1.0)
    f_loam = np.clip(1.0 - f_clay - f_ash, 0.0, 1.0)
    out = {}
    for key in ("theta_s", "psi_s", "k_s", "b"):
        out[key] = (f_ash * TEXTURE["ash"][key]
                    + f_loam * TEXTURE["loam"][key]
                    + f_clay * TEXTURE["clay"][key])
    return out


def matric_potential(theta, theta_s, psi_s, b):
    """psi(theta) = psi_s (theta/theta_s)^-b.  Metres of head (negative)."""
    rel = np.clip(theta / np.maximum(theta_s, 1e-6), 0.02, 1.0)
    return psi_s * km.pow(rel, -b)


def hydraulic_conductivity(theta, theta_s, k_s, b):
    rel = np.clip(theta / np.maximum(theta_s, 1e-6), 0.0, 1.0)
    return k_s * km.pow(np.maximum(rel, 1e-6), 2.0 * b + 3.0)


def topographic_index(drainage_area, slope, cell_size):
    """TOPMODEL ln(a / tan beta).  High values saturate first -- and they are
    exactly the valley bottoms and convergent hollows, so riparian wetland ends up
    where it belongs without anyone placing it."""
    a = np.maximum(drainage_area, cell_size ** 2) / cell_size
    return km.log(a / np.maximum(slope, 1e-4))


def green_ampt_infiltration(rain_rate_ms, k_s, theta_deficit, psi_f=0.15,
                            cumulative_m=0.001):
    """Infiltration capacity, m/s.  Excess becomes Hortonian overland flow --
    the dominant mechanism on bare lava and on ash after a fire."""
    cap = k_s * (1.0 + psi_f * np.maximum(theta_deficit, 0.0) / np.maximum(cumulative_m, 1e-4))
    return np.minimum(np.asarray(rain_rate_ms, dtype=np.float64), cap)


@dataclass
class SoilColumn:
    """Layered store.  Six layers, geometric spacing, capped at the regolith depth."""

    theta: np.ndarray          # (nlayer, ny, nx) volumetric water content
    thickness: np.ndarray      # (nlayer, ny, nx) m

    @classmethod
    def create(cls, grid, soil_depth_m: np.ndarray, nlayer: int = 6, wetness: float = 0.5):
        frac = np.array([0.05, 0.08, 0.12, 0.20, 0.25, 0.30])[:nlayer]
        frac = frac / frac.sum()
        thick = frac[:, None, None] * np.maximum(soil_depth_m, 0.02)[None, :, :]
        theta = np.full(thick.shape, wetness * 0.45)
        return cls(theta=theta, thickness=thick)

    @classmethod
    def rescale(cls, column: "SoilColumn", soil_depth_m: np.ndarray) -> "SoilColumn":
        """Follow the regolith as it thickens, conserving water content.

        Soil production adds depth every century; the column has to grow with it
        or the same water gets spread ever thinner and the whole island reads as
        a drought.
        """
        nlayer = column.thickness.shape[0]
        frac = np.array([0.05, 0.08, 0.12, 0.20, 0.25, 0.30])[:nlayer]
        frac = frac / frac.sum()
        new_thick = frac[:, None, None] * np.maximum(soil_depth_m, 0.02)[None, :, :]
        # New volume arrives at the current mean wetness rather than dry, which is
        # what weathering in place actually does.
        return cls(theta=column.theta.copy(), thickness=new_thick)

    def storage_m(self) -> np.ndarray:
        return np.sum(self.theta * self.thickness, axis=0)

    def total_mass_kg(self, cell_area_m2: float) -> float:
        from ..substrate.grid import ksum_fast

        return ksum_fast(self.storage_m()) * cell_area_m2 * RHO_WATER


def freshwater_lens_thickness(grid, z, sea_level, recharge_m_yr, k_aquifer_m_s=1e-4):
    """Ghyben-Herzberg lens depth below sea level (docs/03c §7).

    Forty metres of fresh water for every metre of head.  The lens is the single
    most island-specific thing in the hydrosphere: it scales with area and
    recharge, so a subsiding island loses its fresh water non-linearly and its
    interior dies back from the coast inward, years before the sea reaches it.
    """
    land = z > sea_level
    if not np.any(land):
        return np.zeros(z.shape), 0.0

    from .. geo.routing import _NEIGHBOURS  # noqa: F401  (documented dependency)

    # Distance to the nearest coast, by iterative dilation of the ocean mask.
    dist = np.full(z.shape, np.inf)
    dist[~land] = 0.0
    frontier = ~land
    step = 0
    while np.any(np.isinf(dist)) and step < max(grid.nx, grid.ny):
        step += 1
        grown = frontier.copy()
        for dj, di in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            grown |= np.roll(np.roll(frontier, dj, axis=0), di, axis=1)
        new = grown & np.isinf(dist)
        dist[new] = step * grid.cell_size_m
        frontier = grown
    dist[np.isinf(dist)] = max(grid.nx, grid.ny) * grid.cell_size_m

    half_width = np.maximum(dist, grid.cell_size_m)
    r = np.maximum(recharge_m_yr, 0.0) / 3.15576e7   # m/s
    delta = RHO_SEAWATER / (RHO_SEAWATER - RHO_WATER)  # ~38

    # Dupuit-Forchheimer strip solution for head above sea level.
    head2 = r * half_width * half_width / (k_aquifer_m_s * (1.0 + delta))
    head = km.sqrt(np.maximum(head2, 0.0))
    head = np.where(land, head, 0.0)
    lens = delta * head

    volume = float(np.sum(lens * 0.25)) * grid.cell_area_m2  # x porosity
    return lens, volume


def lens_health(lens_thickness, land_mask) -> float:
    """0..1 index for the instrument panel and the kinetic score.

    On an atoll this becomes the most important number in the piece.
    """
    if not np.any(land_mask):
        return 0.0
    mean_lens = float(np.mean(lens_thickness[land_mask]))
    return float(np.clip(mean_lens / 25.0, 0.0, 1.0))
