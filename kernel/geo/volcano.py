"""Edifice construction, lithospheric flexure, and subsidence (docs/03a §2-3).

The island is never drawn.  It is erupted onto a cooling plate, and then it sinks
under its own weight while the plate contracts beneath it.  Everything the viewer
eventually recognises as "an island" is downstream of these three processes.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from ..substrate import kmath as km
from ..substrate.constants import (
    G_ACC, POISSON, RHO_BASALT, RHO_MANTLE, RHO_SEAWATER,
    RIDGE_DEPTH, SUBSIDENCE_COEFF, TE_ELASTIC, YOUNGS_MODULUS,
)
from ..substrate.rng import Stream


@dataclass
class VolcanoState:
    """Persistent magmatic state.  Eruptions come from chamber pressure, not dice."""

    rift_azimuths_rad: np.ndarray
    hotspot_offset_m: float          # distance the plate has carried the edifice
    plate_velocity_m_yr: float
    hotspot_sigma_m: float
    q_max_m3_yr: float
    chamber_pressure_pa: float = 0.0
    chamber_volume_m3: float = 0.0
    volume_erupted_m3: float = 0.0
    plate_age_myr: float = 5.0
    eruptions: int = 0
    collapses: int = 0
    log: list[str] = field(default_factory=list)

    @property
    def stage(self) -> str:
        v = self.volume_erupted_m3
        if self.supply_now() > 0.25 * self.q_max_m3_yr:
            return "shield" if v > 0.3 * 2.0e12 else "submarine"
        if self.supply_now() > 0.02 * self.q_max_m3_yr:
            return "post-shield"
        return "erosional"

    def supply_now(self) -> float:
        d = self.hotspot_offset_m / self.hotspot_sigma_m
        return float(self.q_max_m3_yr * km.exp(-0.5 * d * d))


def initial_volcano(seed: bytes, grid) -> VolcanoState:
    """Draw the island's magmatic constitution.  These few numbers decide more
    about the finished piece than anything else in the kernel."""
    s = Stream(seed, "genesis", 0, stream=1)
    n_rifts = 2 + int(s.uniform(np.uint64(1)) * 2.0)  # 2 or 3 rift arms
    base = float(s.uniform(np.uint64(2))) * 2.0 * np.pi
    azis = np.array(
        [base + i * (2.0 * np.pi / n_rifts) + float(s.normal(np.uint64(10 + i))) * 0.25
         for i in range(n_rifts)],
        dtype=np.float64,
    )
    return VolcanoState(
        rift_azimuths_rad=azis,
        hotspot_offset_m=float(s.uniform(np.uint64(3))) * 20.0e3,
        plate_velocity_m_yr=0.06 + float(s.uniform(np.uint64(4))) * 0.05,
        hotspot_sigma_m=45.0e3 + float(s.uniform(np.uint64(5))) * 60.0e3,
        # Sized for a *small* oceanic island -- a Society or Austral island,
        # 10-25 km across and a few hundred km3, not a Hawaiian shield of 40,000
        # km3.  Only the summit region of the edifice lies inside our domain; the
        # deeper flanks are represented by the pedestal laid down at genesis.
        q_max_m3_yr=2.4e5 + float(s.uniform(np.uint64(6))) * 1.25e6,
        plate_age_myr=1.0 + float(s.uniform(np.uint64(7))) * 12.0,
        chamber_volume_m3=0.0,
    )


def bingham_relax(dh: np.ndarray, z: np.ndarray, cell_size: float,
                  critical_slope: float, iterations: int = 60) -> np.ndarray:
    """Spread a lava increment until nowhere exceeds the yield-strength slope.

    A Bingham fluid stops when the driving stress falls below its yield strength,
    which for a flow of thickness h on slope theta means h ~ tau_y/(rho g sin theta)
    (Hulme 1974).  Relaxing the added thickness against a critical slope is the
    cheap discrete equivalent, and it is why shields come out with the gentle
    constant flank angle that real shields have -- rather than the Gaussian bumps
    a noise-based generator would give.
    """
    h = dh.copy()
    h_crit = critical_slope * cell_size
    for _ in range(iterations):
        surf = z + h
        moved = np.zeros_like(h)
        for dj, di in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nb = np.roll(np.roll(surf, -dj, axis=0), -di, axis=1)
            valid = np.ones(h.shape, dtype=bool)
            if dj == -1:
                valid[-1, :] = False
            elif dj == 1:
                valid[0, :] = False
            if di == -1:
                valid[:, -1] = False
            elif di == 1:
                valid[:, 0] = False
            excess = np.where(valid, np.maximum(surf - nb - h_crit, 0.0), 0.0)
            flux = np.minimum(0.25 * excess, np.maximum(h, 0.0) * 0.25)
            moved -= flux
            moved += np.roll(np.roll(flux, dj, axis=0), di, axis=1)
        h = np.maximum(h + moved, 0.0)
    return h


def erupt(grid, z: np.ndarray, vol: VolcanoState, seed: bytes, tick: int,
          volume_m3: float) -> tuple[np.ndarray, tuple[float, float]]:
    """Emplace one eruption's volume from a vent on a rift arm."""
    s = Stream(seed, "geo", tick, stream=11)
    x, y = grid.coords_m()

    # Vent position: along a rift arm, exponentially more likely near the summit.
    arm = int(s.uniform(np.uint64(1)) * len(vol.rift_azimuths_rad))
    azi = float(vol.rift_azimuths_rad[arm])
    reach = float(s.exponential(np.uint64(2), rate=1.0)) * 1.2e3
    reach = min(reach, 0.42 * grid.nx * grid.cell_size_m)
    vx = reach * float(km.sin(azi))
    vy = reach * float(km.cos(azi))

    # Vent aperture: small relative to the flow's eventual spread.
    r2 = (x - vx) ** 2 + (y - vy) ** 2
    sigma = 1.6 * grid.cell_size_m
    blob = km.exp(-0.5 * r2 / (sigma * sigma))
    blob_vol = float(np.sum(blob)) * grid.cell_area_m2
    if blob_vol <= 0.0:
        return z, (vx, vy)
    dh = blob * (volume_m3 / blob_vol)

    # Submarine flows are quenched and steeper; subaerial ones run further.
    subaerial = z[grid.ny // 2, grid.nx // 2] > 0.0
    crit = 0.17 if subaerial else 0.30
    dh = bingham_relax(dh, z, grid.cell_size_m, crit)
    return z + dh, (vx, vy)


def step_magma(vol: VolcanoState, seed: bytes, tick: int, dt_yr: float,
               grid, z: np.ndarray) -> tuple[np.ndarray, list[str]]:
    """Advance supply, pressurise the chamber, erupt when it fails.

    Eruptions are not scheduled and not sampled from a recurrence distribution.
    Magma arrives, the chamber pressurises, and when pressure exceeds the wall
    strength it erupts and depressurises.  Recurrence intervals are therefore an
    *output* -- they lengthen as the island drifts off the hotspot, exactly as
    they do along a real volcanic chain.
    """
    events: list[str] = []
    vol.hotspot_offset_m += vol.plate_velocity_m_yr * dt_yr
    vol.plate_age_myr += dt_yr * 1e-6

    supply = vol.supply_now() * dt_yr
    vol.chamber_volume_m3 += supply
    # Simple elastic chamber: pressure rises with stored volume.
    stiffness_pa_per_m3 = 1.6e-2   # erupts at ~0.5 km3, ~2-5 kyr recurrence
    vol.chamber_pressure_pa = vol.chamber_volume_m3 * stiffness_pa_per_m3

    s = Stream(seed, "geo", tick, stream=12)
    # Wall strength varies; a fixed threshold would make eruptions periodic.
    strength = 8.0e6 * (0.7 + 0.6 * float(s.uniform(np.uint64(1))))

    while vol.chamber_pressure_pa > strength and vol.chamber_volume_m3 > 0.0:
        drained = vol.chamber_volume_m3 * (0.35 + 0.5 * float(s.uniform(np.uint64(2))))
        z, (vx, vy) = erupt(grid, z, vol, seed, tick + vol.eruptions, drained)
        vol.chamber_volume_m3 -= drained
        vol.volume_erupted_m3 += drained
        vol.chamber_pressure_pa = vol.chamber_volume_m3 * stiffness_pa_per_m3
        vol.eruptions += 1
        events.append(f"eruption {vol.eruptions}: {drained/1e6:.2f} Mm3 at ({vx/1e3:.1f}, {vy/1e3:.1f}) km")
        if len(events) > 8:
            break
    return z, events


def flexure(grid, load_thickness_m: np.ndarray, rho_load: float = RHO_BASALT) -> np.ndarray:
    """Deflection of a thin elastic plate under the edifice load (docs/03a §3).

    Solved spectrally: in Fourier space the plate equation
    ``D grad^4 w + drho g w = q`` becomes a per-wavenumber division, so the whole
    flexural field costs one FFT pair.  This is what produces the moat and arch
    that ring real volcanic islands, and it is why loading one flank makes the
    opposite flank sink.
    """
    d_rigidity = YOUNGS_MODULUS * TE_ELASTIC ** 3 / (12.0 * (1.0 - POISSON ** 2))
    drho = RHO_MANTLE - RHO_SEAWATER

    q = load_thickness_m * rho_load * G_ACC
    # Mirror-pad to a soft boundary: a periodic FFT on a hard-edged load would
    # wrap the moat around to the opposite side of the domain.
    q_pad = np.pad(q, ((grid.ny // 2,), (grid.nx // 2,)), mode="constant")
    ny, nx = q_pad.shape
    ky = 2.0 * np.pi * np.fft.fftfreq(ny, d=grid.cell_size_m)
    kx = 2.0 * np.pi * np.fft.fftfreq(nx, d=grid.cell_size_m)
    KX, KY = np.meshgrid(kx, ky, indexing="xy")
    k4 = (KX ** 2 + KY ** 2) ** 2

    w_hat = np.fft.fft2(q_pad) / (d_rigidity * k4 + drho * G_ACC)
    w = np.real(np.fft.ifft2(w_hat))
    return w[grid.ny // 2: grid.ny // 2 + grid.ny, grid.nx // 2: grid.nx // 2 + grid.nx]


def thermal_subsidence_m(plate_age_myr: float) -> float:
    """Half-space cooling depth (Parsons & Sclater 1977)."""
    return RIDGE_DEPTH + SUBSIDENCE_COEFF * float(km.sqrt(max(plate_age_myr, 1e-6)))


def subsidence_rate_m_yr(plate_age_myr: float) -> float:
    a = max(plate_age_myr, 1e-3)
    return float(SUBSIDENCE_COEFF / (2.0 * km.sqrt(a))) * 1e-6
