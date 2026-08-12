"""Trait-based vegetation: lineages, growth, succession, soil, nutrients.

There are no plant functional types here and no painted vegetation map.  There
are lineages carrying trait vectors, and the traits succeed or fail against the
climate the atmosphere produced on the soil the geosphere made.  Vegetation
types are what you get when you cluster the survivors.

The nutrient section is the geology-biology handshake: phosphorus comes only
from rock weathering, so an island's fertility has an arc.  It becomes lush, and
then -- over deep time, still watered, still warm -- it becomes poor.  That is
what happens to real islands (Vitousek's Hawaiian chronosequence), and an owner
who lives with a piece long enough will watch theirs pass its own peak.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from ..substrate import kmath as km
from ..substrate.grid import ksum_fast
from . import photosynthesis as ps

# Light compensation point of a shade leaf, umol PAR m-2 s-1.
I_COMPENSATION_UMOL = 22.0

TRAIT_NAMES = ("lma", "leaf_n", "wood_density", "h_max", "seed_mass", "psi_50", "g1")

# Trait bounds -- the physically possible envelope, not a preferred range.
TRAIT_BOUNDS = {
    "lma":          (30.0, 320.0),    # g m-2
    "leaf_n":       (0.6, 3.6),       # g m-2
    "wood_density": (0.20, 0.90),     # g cm-3
    "h_max":        (0.15, 45.0),     # m
    "seed_mass":    (1e-5, 2.0e-2),   # kg
    "psi_50":       (-320.0, -60.0),  # m head
    "g1":           (1.5, 7.0),       # kPa^0.5
}


def leaf_lifespan_yr(lma):
    """Leaf economics spectrum (Wright et al. 2004).

    Imposed as an empirical constraint surface -- 2,548 species on six continents
    -- so that evolution cannot invent a leaf that is simultaneously cheap, tough
    and long-lived.  Trade-offs must be real or the radiation is meaningless.
    """
    return 0.09 * km.pow(np.asarray(lma, dtype=np.float64) / 50.0, 1.7) * 4.0


def background_mortality_yr(wood_density):
    """Cheap wood grows fast and dies young; dense wood is the opposite."""
    return 0.005 + 0.10 * km.exp(-6.0 * (np.asarray(wood_density, dtype=np.float64) - 0.2))


@dataclass
class Lineage:
    """One evolving population.  Traits live here; the evosphere moves them."""

    id: int
    parent_id: int
    traits: dict[str, float]
    born_year: float
    origin: str = "colonisation"
    alive: bool = True
    trait_var: dict[str, float] = field(default_factory=dict)

    def __post_init__(self):
        if not self.trait_var:
            # Additive genetic variance ~ (10% of trait range)^2 at founding;
            # selection erodes it and mutation restores it (docs/03e §1).
            self.trait_var = {
                k: (0.10 * (TRAIT_BOUNDS[k][1] - TRAIT_BOUNDS[k][0])) ** 2
                for k in TRAIT_NAMES
            }

    def vcmax25(self) -> float:
        return float(ps.vcmax_from_traits(self.traits["leaf_n"], self.traits["lma"]))

    def jmax25(self) -> float:
        return 1.9 * self.vcmax25()

    def clone(self, new_id: int, year: float, origin: str) -> "Lineage":
        return Lineage(id=new_id, parent_id=self.id, traits=dict(self.traits),
                       born_year=year, origin=origin,
                       trait_var=dict(self.trait_var))


@dataclass
class SoilPools:
    """CENTURY-style carbon and the two nutrient budgets."""

    litter_c: np.ndarray
    slow_c: np.ndarray
    passive_c: np.ndarray
    n_available: np.ndarray
    p_available: np.ndarray
    p_occluded: np.ndarray

    @classmethod
    def create(cls, grid):
        z = grid.zeros
        return cls(litter_c=z(), slow_c=z(), passive_c=z(),
                   n_available=grid.full(0.5), p_available=grid.full(0.02),
                   p_occluded=z())

    def total_c(self) -> np.ndarray:
        return self.litter_c + self.slow_c + self.passive_c


def decomposition_modifier(t_soil_k, moisture_frac):
    """Q10 temperature response x a moisture optimum near field capacity."""
    f_t = km.pow(2.0, (np.asarray(t_soil_k, dtype=np.float64) - 283.15) / 10.0)
    m = np.clip(moisture_frac, 0.0, 1.0)
    f_w = np.clip(1.0 - 4.0 * (m - 0.6) ** 2, 0.05, 1.0)
    return f_t * f_w


def weathering_p_release(soil_production_m_yr, rock_p_frac=8.0e-4, rho_rock=2900.0):
    """Phosphorus enters the biosphere only here.  There is no atmospheric source
    worth counting, which is the whole reason old islands go hungry."""
    return soil_production_m_yr * rho_rock * rock_p_frac


class Vegetation:
    """Per-lineage biomass on the grid, plus soil, plus the nutrient cycle."""

    def __init__(self, grid, max_lineages: int = 12):
        self.grid = grid
        self.max_lineages = max_lineages
        self.biomass = np.zeros((max_lineages,) + grid.shape)      # kg C m-2
        self.lai = np.zeros((max_lineages,) + grid.shape)
        self.soil = SoilPools.create(grid)
        self.lineages: list[Lineage] = []

    # --- lineage bookkeeping -------------------------------------------------

    def slot_of(self, lineage_id: int) -> int | None:
        for k, ln in enumerate(self.lineages):
            if ln.id == lineage_id:
                return k
        return None

    def add_lineage(self, lineage: Lineage) -> int | None:
        if len(self.lineages) < self.max_lineages:
            self.lineages.append(lineage)
            return len(self.lineages) - 1
        # Displace the least abundant lineage -- competitive exclusion, made
        # explicit because the array has a fixed width.
        totals = [float(np.sum(self.biomass[k])) for k in range(len(self.lineages))]
        k = int(np.argmin(totals))
        if totals[k] > 1e-3:
            return None
        self.lineages[k] = lineage
        self.biomass[k] = 0.0
        self.lai[k] = 0.0
        return k

    def total_lai(self) -> np.ndarray:
        return np.sum(self.lai, axis=0)

    def total_biomass(self) -> np.ndarray:
        return np.sum(self.biomass, axis=0)

    def dominant(self) -> np.ndarray:
        if not self.lineages:
            return np.zeros(self.grid.shape, dtype=np.int64)
        return np.argmax(self.biomass[: len(self.lineages)], axis=0)

    def albedo(self) -> np.ndarray:
        """Vegetation darkens the surface, which warms it, which changes the
        climate the vegetation is responding to."""
        lai = self.total_lai()
        return 0.14 - 0.035 * np.clip(lai / 5.0, 0.0, 1.0)

    def canopy_height(self) -> np.ndarray:
        h = np.zeros(self.grid.shape)
        for k, ln in enumerate(self.lineages):
            h = np.maximum(h, ln.traits["h_max"] * np.clip(self.biomass[k] / 8.0, 0.0, 1.0))
        return h

    def root_cohesion_pa(self) -> np.ndarray:
        """Roots reinforce hillslopes.  Burn the forest and the slopes fail --
        that chain is why fire and landslides are coupled here."""
        return 2000.0 * np.clip(self.total_biomass() / 5.0, 0.0, 1.0)

    # --- the annual step -----------------------------------------------------

    def step_year(self, env: dict, dt_yr: float, ledger=None) -> dict:
        """Grow, respire, die, decompose, cycle nutrients.  Returns diagnostics."""
        grid = self.grid
        land = env["land_mask"]
        n_active = len(self.lineages)
        if n_active == 0:
            return {"gpp": 0.0, "npp": 0.0, "lai": 0.0}

        par = env["par_umol"]
        t_leaf = env["t_air_k"]
        vpd = env["vpd_pa"]
        psi_soil = env["psi_soil_m"]
        seconds = dt_yr * 3.15576e7

        gpp_total = 0.0
        npp_total = 0.0
        litter_in = grid.zeros()

        light_avail = np.ones(grid.shape)
        order = np.argsort([-self.lineages[k].traits["h_max"] for k in range(n_active)])

        for k in order.tolist():
            ln = self.lineages[k]
            lai_k = self.lai[k]
            beta = ps.water_stress_beta(psi_soil, ln.traits["psi_50"])

            gpp = ps.canopy_gpp(par * light_avail, lai_k, t_leaf,
                                ln.vcmax25(), ln.jmax25(), vpd,
                                ln.traits["g1"], beta)
            gpp = np.where(land, gpp, 0.0) * seconds       # kg C m-2 over the step

            # Nutrient limitation: Liebig's minimum on N and P.
            demand_n = gpp * 0.012
            demand_p = gpp * 0.0008
            f_n = np.clip(self.soil.n_available / np.maximum(demand_n, 1e-9), 0.0, 1.0)
            f_p = np.clip(self.soil.p_available / np.maximum(demand_p, 1e-9), 0.0, 1.0)
            f_nut = np.minimum(f_n, f_p)
            gpp = gpp * f_nut
            self.soil.n_available -= np.minimum(demand_n * f_nut, self.soil.n_available)
            self.soil.p_available -= np.minimum(demand_p * f_nut, self.soil.p_available)

            # Respiration: maintenance scales with tissue N, growth with new tissue.
            r_maint = (0.25 * ln.traits["leaf_n"] / 2.0
                       * km.pow(2.0, (t_leaf - 288.15) / 10.0)
                       * np.clip(self.biomass[k], 0.0, 40.0) * 0.02 * dt_yr)
            npp = (gpp - r_maint) * 0.75

            mort = float(background_mortality_yr(ln.traits["wood_density"])) * dt_yr
            starving = npp < 0.0
            mort_field = np.where(starving, np.minimum(mort + 0.25 * dt_yr, 0.9), mort)
            # Self-thinning: crowding kills.
            crowd = np.clip(self.total_biomass() / 25.0, 0.0, 1.0)
            mort_field = np.minimum(mort_field + 0.05 * crowd * dt_yr, 0.95)

            loss = self.biomass[k] * mort_field
            # Floor NPP at exactly the carbon available after mortality, so the
            # biomass update never needs a clamp.  A clamp here would create
            # carbon out of nothing and the ledger would (correctly) refuse to
            # close -- better to make the physics right than to widen the
            # tolerance (docs/02 §7).
            npp = np.maximum(npp, -(self.biomass[k] - loss))
            # Confine the whole update to land.  A drowned cell that keeps
            # respiring would quietly destroy carbon the budget never sees --
            # the classic way a conservation check ends up lying.
            npp = np.where(land, npp, 0.0)
            loss = np.where(land, loss, 0.0)
            self.biomass[k] = self.biomass[k] + npp - loss
            litter_in += loss

            leaf_frac = 0.35 / np.maximum(leaf_lifespan_yr(ln.traits["lma"]), 0.3)
            lai_k = (self.biomass[k] * leaf_frac * 1000.0
                     / np.maximum(ln.traits["lma"], 10.0))
            # A canopy cannot carry leaves that sit below their own light
            # compensation point -- they cost more to maintain than they fix, and
            # the plant sheds them.  Beer's law then sets the ceiling:
            #     LAI_max = ln(I_here / I_compensation) / k
            # which is why real closed canopies stop near LAI 6-8 however fertile
            # the site is.  Without it, stacked lineages sum to impossible values.
            par_here = np.maximum(par * light_avail, 1e-6)
            lai_cap = np.maximum(km.log(par_here / I_COMPENSATION_UMOL) / 0.5, 0.0)
            self.lai[k] = np.where(land, np.clip(lai_k, 0.0, lai_cap), 0.0)

            light_avail = light_avail * km.exp(-0.5 * self.lai[k])
            gpp_total += float(ksum_fast(np.where(land, gpp, 0.0)))
            npp_total += float(ksum_fast(np.where(land, npp, 0.0)))

        # --- soil carbon and nutrients --------------------------------------
        mod = decomposition_modifier(env["t_soil_k"], env["moisture_frac"]) * dt_yr
        self.soil.litter_c += litter_in
        d_litter = self.soil.litter_c * np.clip(0.9 * mod, 0.0, 0.95)
        self.soil.litter_c -= d_litter
        self.soil.slow_c += 0.30 * d_litter
        d_slow = self.soil.slow_c * np.clip(0.03 * mod, 0.0, 0.5)
        self.soil.slow_c -= d_slow
        self.soil.passive_c += 0.12 * d_slow
        d_passive = self.soil.passive_c * np.clip(0.0008 * mod, 0.0, 0.1)
        self.soil.passive_c -= d_passive

        respired = (d_litter - 0.30 * d_litter) + (d_slow - 0.12 * d_slow) + d_passive
        self.soil.n_available += (d_litter + d_slow) * 0.012 + 0.0008 * dt_yr  # + fixation
        self.soil.p_available += (d_litter + d_slow) * 0.0008
        self.soil.p_available += env["p_weathering"] * dt_yr

        # Leaching and occlusion: the slow drain that ends an island's fertility.
        leach = np.clip(env["drainage_m_yr"] * dt_yr / 2.0, 0.0, 0.6)
        self.soil.n_available *= (1.0 - leach * 0.5)
        occluded = self.soil.p_available * np.clip(0.004 * dt_yr, 0.0, 0.5)
        self.soil.p_available -= occluded
        self.soil.p_occluded += occluded
        self.soil.p_available *= (1.0 - leach * 0.15)

        if ledger is not None:
            area = grid.cell_area_m2
            ledger["carbon"].add_in(gpp_total * area)
            ledger["carbon"].add_out((gpp_total - npp_total) * area
                                     + float(ksum_fast(respired)) * area)
            ledger["carbon"].set_stored(
                (float(ksum_fast(self.total_biomass()))
                 + float(ksum_fast(self.soil.total_c()))) * area)

        lai_mean = float(grid.mean(self.total_lai(), land))
        return {
            "gpp": gpp_total * grid.cell_area_m2,
            "npp": npp_total * grid.cell_area_m2,
            "lai": lai_mean,
            "n_limited": float(grid.mean(
                (self.soil.n_available < 0.3).astype(np.float64), land)),
            "p_limited": float(grid.mean(
                (self.soil.p_available < 0.01).astype(np.float64), land)),
        }

    def establish(self, slot: int, mask: np.ndarray, amount: float = 0.05) -> float:
        """Seed a lineage onto cells where it can get a start.

        Returns the carbon introduced, in kg C m-2 summed over cells.  Propagules
        arrive from outside the island, so this is a genuine inflow and the
        caller must book it -- otherwise every colonisation event silently
        manufactures carbon.
        """
        seeded = np.where(mask & (self.biomass[slot] < amount), amount, self.biomass[slot])
        added = float(ksum_fast(seeded - self.biomass[slot]))
        self.biomass[slot] = seeded
        return added

    def fitness_proxy(self, slot: int, env: dict, land: np.ndarray) -> float:
        """Realised per-capita carbon gain, used by the evosphere as fitness.

        Deliberately *not* a hand-written fitness function: it is what the plant
        actually managed to do, in this climate, on this soil, this year.
        """
        b = self.biomass[slot]
        if float(np.sum(b)) <= 1e-9:
            return 0.0
        ln = self.lineages[slot]
        beta = ps.water_stress_beta(env["psi_soil_m"], ln.traits["psi_50"])
        gpp = ps.canopy_gpp(env["par_umol"], self.lai[slot], env["t_air_k"],
                            ln.vcmax25(), ln.jmax25(), env["vpd_pa"],
                            ln.traits["g1"], beta)
        weight = np.where(land, b, 0.0)
        tot = float(ksum_fast(weight))
        if tot <= 1e-12:
            return 0.0
        return float(ksum_fast(np.where(land, gpp, 0.0) * weight)) / tot
