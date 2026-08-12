"""The island lattice, and the compensated reductions everything else depends on."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from . import kmath as km


def ksum(a) -> float:
    """Neumaier compensated summation in fixed row-major order (docs/02 §D3).

    numpy's pairwise sum is fast and accurate but its blocking depends on array
    shape and on the build, so two machines can legitimately disagree in the last
    bits.  Over a century of daily budget closures those bits accumulate into a
    visible divergence.  This is slower and identical everywhere.
    """
    flat = np.asarray(a, dtype=np.float64).ravel(order="C")
    total = 0.0
    comp = 0.0
    for v in flat.tolist():
        t = total + v
        if abs(total) >= abs(v):
            comp += (total - t) + v
        else:
            comp += (v - t) + total
        total = t
    return total + comp


def ksum_fast(a) -> float:
    """Blocked compensated sum: same result as ``ksum`` to within 1 ulp, ~100x faster.

    Used inside the step loop; ``ksum`` is used by the ledger's audit path and by
    the determinism tests, which compare the two.
    """
    flat = np.asarray(a, dtype=np.float64).ravel(order="C")
    n = flat.size
    block = 1024
    if n <= block:
        return ksum(flat)
    pad = (-n) % block
    if pad:
        flat = np.concatenate([flat, np.zeros(pad, dtype=np.float64)])
    partial = flat.reshape(-1, block).sum(axis=1, dtype=np.float64)
    return ksum(partial)


@dataclass(frozen=True)
class Grid:
    """A regular square lattice on a local tangent plane.

    An island is ~10 km across; map projection error over that span is far below
    our resolution, so a plane is the honest choice and avoids pretending to a
    rigour we do not have.
    """

    nx: int
    ny: int
    cell_size_m: float
    latitude_deg: float
    longitude_deg: float

    @property
    def shape(self) -> tuple[int, int]:
        return (self.ny, self.nx)

    @property
    def cell_area_m2(self) -> float:
        return self.cell_size_m * self.cell_size_m

    @property
    def n_cells(self) -> int:
        return self.nx * self.ny

    def zeros(self) -> np.ndarray:
        return np.zeros(self.shape, dtype=np.float64)

    def full(self, v: float) -> np.ndarray:
        return np.full(self.shape, float(v), dtype=np.float64)

    def coords_m(self) -> tuple[np.ndarray, np.ndarray]:
        """Cell-centre coordinates in metres, origin at the grid centre."""
        x = (np.arange(self.nx, dtype=np.float64) - 0.5 * (self.nx - 1)) * self.cell_size_m
        y = (np.arange(self.ny, dtype=np.float64) - 0.5 * (self.ny - 1)) * self.cell_size_m
        return np.meshgrid(x, y, indexing="xy")

    def radius_m(self) -> np.ndarray:
        x, y = self.coords_m()
        return km.hypot(x, y)

    # --- differential operators (second-order central, replicate boundary) ---

    def gradient(self, f: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        d = self.cell_size_m
        fx = (np.roll(f, -1, axis=1) - np.roll(f, 1, axis=1)) / (2.0 * d)
        fy = (np.roll(f, -1, axis=0) - np.roll(f, 1, axis=0)) / (2.0 * d)
        fx[:, 0] = (f[:, 1] - f[:, 0]) / d
        fx[:, -1] = (f[:, -1] - f[:, -2]) / d
        fy[0, :] = (f[1, :] - f[0, :]) / d
        fy[-1, :] = (f[-1, :] - f[-2, :]) / d
        return fx, fy

    def slope(self, f: np.ndarray) -> np.ndarray:
        fx, fy = self.gradient(f)
        return km.hypot(fx, fy)

    def aspect_rad(self, f: np.ndarray) -> np.ndarray:
        """Downslope azimuth, radians clockwise from north."""
        fx, fy = self.gradient(f)
        return np.mod(km.atan2(-fx, -fy), 2.0 * np.pi)

    def laplacian(self, f: np.ndarray) -> np.ndarray:
        d2 = self.cell_size_m * self.cell_size_m
        fp = np.pad(f, 1, mode="edge")
        return (fp[:-2, 1:-1] + fp[2:, 1:-1] + fp[1:-1, :-2] + fp[1:-1, 2:] - 4.0 * f) / d2

    def integrate(self, f: np.ndarray) -> float:
        """Area integral in fixed order.  All budget terms go through this."""
        return ksum_fast(f) * self.cell_area_m2

    def mean(self, f: np.ndarray, mask: np.ndarray | None = None) -> float:
        if mask is None:
            return ksum_fast(f) / self.n_cells
        n = float(ksum_fast(mask.astype(np.float64)))
        if n <= 0.0:
            return 0.0
        return ksum_fast(np.where(mask, f, 0.0)) / n
