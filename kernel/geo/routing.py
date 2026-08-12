"""Flow routing: depression filling, D8 receivers, drainage accumulation.

Every river on the island exists because of this file.  It also produces the
topological ordering that makes the implicit erosion solver in lem.py stable at
century timesteps, which is what lets an island age within a human lifetime.
"""

from __future__ import annotations

import heapq

import numpy as np

# Ordered so that ties break identically on every machine (docs/02 §D5).
_NEIGHBOURS = (
    (-1, -1), (-1, 0), (-1, 1),
    (0, -1), (0, 1),
    (1, -1), (1, 0), (1, 1),
)


def fill_depressions(z: np.ndarray, sea_level: float, epsilon: float = 1e-4) -> np.ndarray:
    """Priority-flood with an epsilon gradient (Barnes, Lehman & Mulla 2014).

    Returns a surface with no interior sinks, so every cell drains to the ocean.
    The epsilon tilt gives lake floors a defined flow direction; the *real* lake
    is then recovered as ``z_filled - z``, which the hydrosphere uses as depression
    storage.  Landslide-dammed lakes and crater lakes both appear here for free.
    """
    ny, nx = z.shape
    filled = np.full_like(z, np.inf)
    closed = np.zeros(z.shape, dtype=bool)
    heap: list[tuple[float, int, int]] = []

    # Seed: everything at or below sea level, plus the domain edge.
    ocean = z <= sea_level
    for j in range(ny):
        for i in range(nx):
            edge = j == 0 or i == 0 or j == ny - 1 or i == nx - 1
            if ocean[j, i] or edge:
                filled[j, i] = z[j, i]
                closed[j, i] = True
                heapq.heappush(heap, (float(z[j, i]), j * nx + i, 0))

    while heap:
        elev, packed, _ = heapq.heappop(heap)
        j, i = divmod(packed, nx)
        for dj, di in _NEIGHBOURS:
            jj, ii = j + dj, i + di
            if jj < 0 or ii < 0 or jj >= ny or ii >= nx or closed[jj, ii]:
                continue
            new = max(float(z[jj, ii]), elev + epsilon)
            filled[jj, ii] = new
            closed[jj, ii] = True
            heapq.heappush(heap, (new, jj * nx + ii, 0))

    return filled


def d8_receivers(zf: np.ndarray, cell_size: float, sea_level: float):
    """Steepest-descent receiver for every cell.

    Returns ``(receiver, distance, order)`` where ``order`` lists cells from
    outlets upstream -- the stack ordering of Braun & Willett (2013).  Processing
    in that order makes the implicit erosion solve a single sweep.
    """
    ny, nx = zf.shape
    n = ny * nx
    flat = zf.ravel()
    receiver = np.arange(n, dtype=np.int64)
    distance = np.full(n, cell_size, dtype=np.float64)

    diag = cell_size * 1.4142135623730951
    best = np.zeros(n, dtype=np.float64)
    for dj, di in _NEIGHBOURS:
        shifted = np.roll(np.roll(zf, -dj, axis=0), -di, axis=1)
        # Mask wrapped edges: a cell may not drain across the domain boundary.
        valid = np.ones(zf.shape, dtype=bool)
        if dj == -1:
            valid[-1, :] = False
        elif dj == 1:
            valid[0, :] = False
        if di == -1:
            valid[:, -1] = False
        elif di == 1:
            valid[:, 0] = False
        dist = diag if (dj != 0 and di != 0) else cell_size
        drop = np.where(valid, (zf - shifted) / dist, -np.inf).ravel()
        idx = (np.arange(n) + dj * nx + di) % n
        take = drop > best
        best = np.where(take, drop, best)
        receiver = np.where(take, idx, receiver)
        distance = np.where(take, dist, distance)

    outlet = (flat <= sea_level) | (best <= 0.0)
    receiver = np.where(outlet, np.arange(n, dtype=np.int64), receiver)

    # Stack order: descending filled elevation is a valid topological order
    # because water only ever moves downhill on the filled surface.  Ties break
    # by flat index, so the order is identical everywhere.
    order = np.lexsort((np.arange(n), -flat))
    return receiver, distance, order


def accumulate(order: np.ndarray, receiver: np.ndarray, weight: np.ndarray) -> np.ndarray:
    """Route ``weight`` downstream along the receiver tree.

    Serial by necessity -- each cell must receive everything above it first.  The
    fixed ``order`` is what makes the result machine-independent.
    """
    acc = weight.ravel().astype(np.float64).copy()
    rec = receiver
    for c in order.tolist():
        r = rec[c]
        if r != c:
            acc[r] += acc[c]
    return acc


class FlowNetwork:
    """Cached routing solution.  Rebuilt only when the terrain changes, which at
    century timesteps is rarely -- the daily hydrology reuses it."""

    __slots__ = ("filled", "lake_depth", "receiver", "distance", "order", "shape", "cell_size")

    def __init__(self, z: np.ndarray, cell_size: float, sea_level: float):
        self.shape = z.shape
        self.cell_size = cell_size
        self.filled = fill_depressions(z, sea_level)
        self.lake_depth = np.maximum(self.filled - z, 0.0)
        self.receiver, self.distance, self.order = d8_receivers(self.filled, cell_size, sea_level)

    def drainage_area(self) -> np.ndarray:
        w = np.full(self.shape, self.cell_size * self.cell_size)
        return accumulate(self.order, self.receiver, w).reshape(self.shape)

    def route(self, field: np.ndarray) -> np.ndarray:
        """Accumulate any per-cell quantity downstream (water, sediment, nutrients)."""
        return accumulate(self.order, self.receiver, field).reshape(self.shape)

    def flow_path_length(self) -> np.ndarray:
        """Longest upstream flow path reaching each cell, in metres.

        This is the L in Hack's law (L ~ A^0.57).  It has to be the *longest*
        path, not the accumulated one -- accumulating distance just re-measures
        area and would make the exponent come out at 1.0, which is the kind of
        error that passes a test while proving nothing.
        """
        length = np.zeros(self.receiver.size, dtype=np.float64)
        rec, dist = self.receiver, self.distance
        for c in self.order.tolist():          # upstream first
            r = rec[c]
            if r != c:
                cand = length[c] + dist[c]
                if cand > length[r]:
                    length[r] = cand
        return length.reshape(self.shape)

    def slope_to_receiver(self, z: np.ndarray) -> np.ndarray:
        flat = z.ravel()
        s = (flat - flat[self.receiver]) / self.distance
        return np.maximum(s, 0.0).reshape(self.shape)
