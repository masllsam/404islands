"""Deterministic gradient noise -- demoted to its proper role.

The legacy project (archive/legacy-webapp) built its terrain out of this.  That
was the central mistake: noise produces surfaces that *look* like landscapes but
contain no rivers, because nothing ever flowed on them, and no rain shadow,
because no air ever rose over them.

Here noise does one honest job: it supplies the small initial roughness of a
fresh lava surface, and the spatial structure of rock strength, before the
landscape evolution model (lem.py) does the actual work of carving.  It is an
initial condition, never an answer.
"""

from __future__ import annotations

import numpy as np

from ..substrate import kmath as km
from ..substrate.rng import Stream


def _fade(t):
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)


def perlin2d(grid, stream: Stream, frequency: float, offset: int = 0) -> np.ndarray:
    """Perlin gradient noise, unit frequency = one feature per grid width.

    Gradients are drawn by cell coordinate rather than from a shuffled permutation
    table, so the field is addressable: any cell can be evaluated without
    generating its neighbours (docs/02 §D4).
    """
    x, y = grid.coords_m()
    span = grid.nx * grid.cell_size_m
    u = (x / span + 0.5) * frequency
    v = (y / span + 0.5) * frequency

    xi = np.floor(u).astype(np.int64)
    yi = np.floor(v).astype(np.int64)
    xf = u - xi
    yf = v - yi

    def grad(ix, iy):
        # 2**20 stride keeps lattice coordinates separated for any plausible grid.
        key = ((iy + 4096) * 1048576 + (ix + 4096) + offset * 1099511627776).astype(np.uint64)
        ang = stream.uniform(key) * (2.0 * np.pi)
        return km.cos(ang), km.sin(ang)

    def dot(ix, iy, dx, dy):
        gx, gy = grad(ix, iy)
        return gx * dx + gy * dy

    n00 = dot(xi, yi, xf, yf)
    n10 = dot(xi + 1, yi, xf - 1.0, yf)
    n01 = dot(xi, yi + 1, xf, yf - 1.0)
    n11 = dot(xi + 1, yi + 1, xf - 1.0, yf - 1.0)

    su, sv = _fade(xf), _fade(yf)
    nx0 = n00 + su * (n10 - n00)
    nx1 = n01 + su * (n11 - n01)
    return (nx0 + sv * (nx1 - nx0)) * 1.4142135623730951  # normalise to ~[-1,1]


def fbm(grid, stream: Stream, octaves: int = 6, frequency: float = 2.0,
        lacunarity: float = 2.0, gain: float = 0.5) -> np.ndarray:
    """Fractional Brownian motion.  Amplitude normalised so the result is ~[-1, 1]."""
    total = grid.zeros()
    amp = 1.0
    freq = frequency
    norm = 0.0
    for o in range(octaves):
        total = total + amp * perlin2d(grid, stream, freq, offset=o + 1)
        norm += amp
        amp *= gain
        freq *= lacunarity
    return total / max(norm, 1e-12)


def ridged(grid, stream: Stream, octaves: int = 5, frequency: float = 2.0) -> np.ndarray:
    """Ridged multifractal -- used only for rock-strength heterogeneity, where
    the sharp lineations stand in for dike swarms and flow contacts."""
    total = grid.zeros()
    amp = 1.0
    freq = frequency
    norm = 0.0
    for o in range(octaves):
        n = 1.0 - np.abs(perlin2d(grid, stream, freq, offset=100 + o))
        total = total + amp * n * n
        norm += amp
        amp *= 0.5
        freq *= 2.0
    return total / max(norm, 1e-12)
