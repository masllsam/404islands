"""Farquhar-von Caemmerer-Berry photosynthesis and Medlyn optimal stomata.

Unmodified textbook biochemistry.  It is used here for a reason beyond realism:
because carbon gain is computed from a plant's *traits* through real enzyme
kinetics, the evolutionary module can take a numerical derivative of fitness with
respect to a trait and get a selection gradient that means something.  Selection
in this kernel is emergent because photosynthesis is mechanistic (docs/03e §3).
"""

from __future__ import annotations

import numpy as np

from ..substrate import kmath as km
from ..substrate.constants import (
    CO2_PPM_DEFAULT, EA_GAMMA, EA_JMAX, EA_KC, EA_KO, EA_VCMAX,
    GAMMA_STAR_25, KC25, KO25, MOLAR_MASS_C, O2_PARTIAL_PA, Q10_RESP, R_UNIV, T0,
)


def arrhenius(value_25, ea_j_mol, t_kelvin):
    tk = np.asarray(t_kelvin, dtype=np.float64)
    return value_25 * km.exp(ea_j_mol * (tk - 298.15) / (298.15 * R_UNIV * tk))


def peaked_arrhenius(value_25, ea_j_mol, t_kelvin, hd=200000.0, s_entropy=650.0):
    """Arrhenius with high-temperature deactivation -- without it, photosynthesis
    would keep rising through 50 C, and the model's tropics would be wrong."""
    tk = np.asarray(t_kelvin, dtype=np.float64)
    base = arrhenius(value_25, ea_j_mol, tk)
    num = 1.0 + km.exp((298.15 * s_entropy - hd) / (298.15 * R_UNIV))
    den = 1.0 + km.exp((tk * s_entropy - hd) / (R_UNIV * tk))
    return base * num / den


def vcmax_from_traits(leaf_n_g_m2, lma_g_m2):
    """V_cmax from leaf nitrogen per area.

    Derived rather than tabulated, so a lineage that evolves thicker or more
    nitrogen-rich leaves gets a photosynthetic capacity that actually follows.
    ~1.7 umol CO2 per gram of leaf N per second is the conventional slope.
    """
    n_area = np.maximum(leaf_n_g_m2, 0.1)
    return 25.0 * n_area / np.maximum(lma_g_m2 / 100.0, 0.2) * 0.4


def assimilation(par_umol, t_leaf_k, vcmax25, jmax25, ci_pa, beta_water=1.0):
    """Net assimilation, umol CO2 m-2 s-1."""
    vcmax = peaked_arrhenius(vcmax25, EA_VCMAX, t_leaf_k) * beta_water
    jmax = peaked_arrhenius(jmax25, EA_JMAX, t_leaf_k) * beta_water
    kc = arrhenius(KC25, EA_KC, t_leaf_k)
    ko = arrhenius(KO25, EA_KO, t_leaf_k)
    gamma_star = arrhenius(GAMMA_STAR_25, EA_GAMMA, t_leaf_k)

    # Electron transport: non-rectangular hyperbola of absorbed PAR.
    alpha, theta = 0.3, 0.7
    i_abs = alpha * np.maximum(par_umol, 0.0)
    disc = np.maximum((i_abs + jmax) ** 2 - 4.0 * theta * i_abs * jmax, 0.0)
    j = (i_abs + jmax - km.sqrt(disc)) / (2.0 * theta)

    ci = np.maximum(ci_pa, gamma_star + 1e-3)
    a_c = vcmax * (ci - gamma_star) / (ci + kc * (1.0 + O2_PARTIAL_PA / ko))
    a_j = j * (ci - gamma_star) / (4.0 * ci + 8.0 * gamma_star)
    r_d = 0.015 * vcmax * km.pow(Q10_RESP, (t_leaf_k - 298.15) / 10.0)
    return np.minimum(a_c, a_j) - r_d


def medlyn_ci(vpd_pa, g1, ca_pa):
    """Optimal intercellular CO2 from the Medlyn et al. (2011) solution.

    Derived from the plant maximising carbon gain per unit water lost, which is
    why g1 is a meaningful evolvable trait rather than a fitted constant:
    ci/ca = g1 / (g1 + sqrt(D)).
    """
    d_kpa = np.maximum(np.asarray(vpd_pa, dtype=np.float64) / 1000.0, 0.05)
    ratio = g1 / (g1 + km.sqrt(d_kpa))
    return np.clip(ratio, 0.1, 0.95) * ca_pa


def water_stress_beta(psi_leaf_m, psi_50_m, a_shape=3.0):
    """Vulnerability curve.  Sustained low beta is hydraulic failure, i.e. death
    by drought -- a mechanism, not an assigned mortality rate."""
    ratio = np.maximum(psi_leaf_m, -300.0) / np.minimum(psi_50_m, -0.1)
    return 1.0 / (1.0 + km.pow(np.maximum(ratio, 1e-6), a_shape))


def canopy_gpp(par_top_umol, lai, t_leaf_k, vcmax25, jmax25, vpd_pa, g1,
               beta_water, ca_ppm=CO2_PPM_DEFAULT, k_ext=0.5):
    """Two-big-leaf canopy GPP, kg C m-2 s-1.

    Sunlit and shaded fractions integrated separately: a single big leaf
    systematically overestimates light saturation and underestimates deep-canopy
    productivity.
    """
    lai = np.maximum(lai, 0.0)
    f_sun = np.where(lai > 0.0, (1.0 - km.exp(-k_ext * lai)) / np.maximum(k_ext, 1e-6), 0.0)
    lai_sun = np.minimum(f_sun, lai)
    lai_shade = np.maximum(lai - lai_sun, 0.0)

    ca_pa = ca_ppm * 1e-6 * 101325.0
    ci = medlyn_ci(vpd_pa, g1, ca_pa)

    par_sun = np.maximum(par_top_umol, 0.0)
    par_shade = np.maximum(par_top_umol, 0.0) * 0.2 * km.exp(-k_ext * lai * 0.5)

    a_sun = assimilation(par_sun, t_leaf_k, vcmax25, jmax25, ci, beta_water)
    a_shade = assimilation(par_shade, t_leaf_k, vcmax25, jmax25, ci, beta_water)

    umol_m2_s = np.maximum(a_sun, 0.0) * lai_sun + np.maximum(a_shade, 0.0) * lai_shade
    return umol_m2_s * 1e-6 * MOLAR_MASS_C


def stomatal_resistance(gpp_kg_c_m2_s, lai, vpd_pa, g1, ca_ppm=CO2_PPM_DEFAULT):
    """Bulk canopy resistance, s/m -- handed back to the surface energy balance so
    the vegetation controls its own evaporative cooling."""
    a_umol = np.maximum(gpp_kg_c_m2_s, 0.0) / (1e-6 * MOLAR_MASS_C)
    d_kpa = np.maximum(np.asarray(vpd_pa, dtype=np.float64) / 1000.0, 0.05)
    gs_mol = 0.01 + 1.6 * (1.0 + g1 / km.sqrt(d_kpa)) * a_umol / max(ca_ppm, 1.0)
    gs_ms = np.maximum(gs_mol * 0.0224, 1e-5)
    return np.clip(1.0 / gs_ms, 30.0, 5000.0)
