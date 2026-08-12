"""Landscape evolution: incision, hillslopes, soil production, landsliding.

This is where the island earns its shape.  Rain that the atmosphere actually
produced, routed by the network that the terrain actually has, cuts valleys
whose depth and spacing are set by the stream-power law.  Windward canyons and
a smooth leeward flank come out of it without anyone asking for them.
"""

from __future__ import annotations

import numpy as np

from ..substrate import kmath as km
from ..substrate.constants import G_ACC, RHO_WATER
from .routing import FlowNetwork


def stream_power_implicit(z: np.ndarray, net: FlowNetwork, k_sp: np.ndarray,
                          q_eff: np.ndarray, dt_yr: float, sea_level: float,
                          m: float = 0.5, n: float = 1.0) -> np.ndarray:
    """Implicit stream-power incision (Braun & Willett 2013).

    The explicit form needs tiny timesteps.  For n = 1 the implicit form is linear
    and can be solved in a single upstream sweep along the flow stack:

        z_i = (z_i^t + dt K Q^m z_r / dx) / (1 + dt K Q^m / dx)

    unconditionally stable, so we can take century steps and still watch an island
    age inside a human lifetime.  That is not a performance nicety -- it is what
    makes the artwork possible.
    """
    if abs(n - 1.0) > 1e-12:
        raise NotImplementedError("only n = 1 has a closed-form implicit solution here")

    zf = z.ravel().copy()
    rec = net.receiver
    dist = net.distance
    coef = (k_sp.ravel() * km.pow(np.maximum(q_eff.ravel(), 1e-30), m) * dt_yr / dist)

    # Downstream-first: receivers must already hold their new elevation.
    for c in net.order.tolist()[::-1]:
        r = rec[c]
        if r == c:
            continue
        if zf[c] <= sea_level:
            continue
        f = coef[c]
        zf[c] = (zf[c] + f * zf[r]) / (1.0 + f)
        if zf[c] < zf[r]:
            zf[c] = zf[r]
    return zf.reshape(z.shape)


def hillslope_nonlinear(grid, z: np.ndarray, d_h: float, s_crit: float,
                        dt_yr: float, substeps: int = 8) -> np.ndarray:
    """Nonlinear (threshold) hillslope diffusion, Roering et al. (1999).

        q = D grad(z) / (1 - (|grad z| / Sc)^2)

    Flux diverges as the slope approaches the critical angle, so hillslopes flatten
    out at ~33 deg and steeper ground fails.  Linear diffusion cannot make a cliff;
    this can, and the island's skyline depends on it.
    """
    dt = dt_yr / substeps
    d = grid.cell_size_m
    for _ in range(substeps):
        gx, gy = grid.gradient(z)
        s2 = (gx * gx + gy * gy) / (s_crit * s_crit)
        denom = np.maximum(1.0 - np.minimum(s2, 0.98), 0.02)
        qx = d_h * gx / denom
        qy = d_h * gy / denom
        div = ((np.roll(qx, -1, axis=1) - np.roll(qx, 1, axis=1))
               + (np.roll(qy, -1, axis=0) - np.roll(qy, 1, axis=0))) / (2.0 * d)
        z = z + dt * div
    return z


def soil_production(h_soil: np.ndarray, dt_yr: float, p0_m_yr: float = 1.0e-4,
                    h_star_m: float = 0.4) -> np.ndarray:
    """Exponential soil production function (Heimsath et al. 1997).

    Bedrock converts to regolith fastest under a thin cover and stalls under a
    thick one -- the humped-to-declining relationship that gives real landscapes a
    characteristic soil depth.  Feeds the phosphorus budget in bio/, which is how
    the island's fertility ends up tied to its age.
    """
    return p0_m_yr * km.exp(-h_soil / h_star_m) * dt_yr


def landslide_factor_of_safety(grid, z: np.ndarray, h_soil: np.ndarray,
                               saturation: np.ndarray, root_cohesion_pa: np.ndarray,
                               phi_deg: float = 35.0, c_soil_pa: float = 3.0e3,
                               gamma_soil: float = 17000.0) -> np.ndarray:
    """Infinite-slope stability with pore pressure and root reinforcement.

        FS = (c' + c_root + (gamma z cos^2 t - u) tan phi) / (gamma z sin t cos t)

    Fire removes roots; a wet season raises pore pressure.  Their coincidence
    produces a landslide, which resets vegetation and dumps sediment into a river,
    which smothers a reef.  Four modules, one chain of cause -- and nothing in it
    was scripted.
    """
    slope = grid.slope(z)
    theta = km.atan2(slope, np.ones_like(slope))
    cos_t = km.cos(theta)
    sin_t = km.sin(theta)
    h = np.maximum(h_soil, 0.05)
    u = np.clip(saturation, 0.0, 1.0) * RHO_WATER * G_ACC * h * cos_t * cos_t
    tan_phi = float(km.sin(np.deg2rad(phi_deg)) / km.cos(np.deg2rad(phi_deg)))
    driving = gamma_soil * h * sin_t * cos_t
    resisting = c_soil_pa + root_cohesion_pa + np.maximum(
        gamma_soil * h * cos_t * cos_t - u, 0.0) * tan_phi
    return resisting / np.maximum(driving, 1.0)


def apply_landslides(grid, z: np.ndarray, h_soil: np.ndarray, fos: np.ndarray):
    """Strip regolith where FS < 1 and deposit it one cell downslope."""
    fail = (fos < 1.0) & (h_soil > 0.05)
    if not np.any(fail):
        return z, h_soil, 0.0, fail
    stripped = np.where(fail, h_soil, 0.0)
    h_new = np.where(fail, 0.0, h_soil)
    z_new = z - stripped

    gx, gy = grid.gradient(z)
    dj = np.clip(np.rint(-gy / np.maximum(km.hypot(gx, gy), 1e-9)), -1, 1).astype(int)
    di = np.clip(np.rint(-gx / np.maximum(km.hypot(gx, gy), 1e-9)), -1, 1).astype(int)
    deposit = np.zeros_like(z)
    js, iss = np.nonzero(fail)
    for j, i in zip(js.tolist(), iss.tolist()):
        jj = min(max(j + int(dj[j, i]), 0), grid.ny - 1)
        ii = min(max(i + int(di[j, i]), 0), grid.nx - 1)
        deposit[jj, ii] += stripped[j, i]
    z_new = z_new + deposit
    h_new = h_new + deposit
    volume = float(np.sum(stripped)) * grid.cell_area_m2
    return z_new, h_new, volume, fail
