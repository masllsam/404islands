"""Quantitative genetics, drift, gene flow, and speciation (docs/03e).

We never write a fitness function.  Fitness is what the biosphere actually
measured -- realised carbon gain per unit biomass, in this climate, on this soil.
The selection gradient is taken numerically from that same simulation, so
selection here is a consequence of the world rather than an instruction to it.

This is the module that makes the object worth owning for forty years.  Over a
human lifetime an island's lineages will measurably change, and some of them
will become new species, on a date nobody can predict and nobody can buy.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from ..substrate import kmath as km
from ..substrate.rng import Stream
from ..bio.vegetation import TRAIT_BOUNDS, TRAIT_NAMES, Lineage

MUTATION_VARIANCE_FRACTION = 1.0e-3   # V_m per generation, as a fraction of V_E
N_SWITCH_UP = 600                     # individual-based below, analytic above
N_SWITCH_DOWN = 400                   # hysteresis, so populations don't chatter
DMI_SNOWBALL_C = 4.0e-4               # Dobzhansky-Muller incompatibility rate
ISOLATION_THRESHOLD = 0.75


@dataclass
class Deme:
    """A spatially distinct population of one lineage."""

    lineage_id: int
    region: int
    n_effective: float
    trait_mean: dict[str, float]
    trait_var: dict[str, float]
    substitutions: float = 0.0
    heterozygosity: float = 1.0


@dataclass
class Chronicle:
    """The island's natural history.  Append-only; printed for the owner."""

    entries: list[dict] = field(default_factory=list)

    def record(self, year: float, kind: str, text: str, **extra) -> None:
        self.entries.append({"year": round(float(year), 3), "kind": kind,
                             "text": text, **extra})

    def since(self, year: float) -> list[dict]:
        return [e for e in self.entries if e["year"] >= year]


def _clip_trait(name: str, value: float) -> float:
    lo, hi = TRAIT_BOUNDS[name]
    return float(min(max(value, lo), hi))


def region_map(grid, land_mask, n_regions_side: int = 3) -> np.ndarray:
    """Partition the island into demes.

    A coarse block partition stands in for the real barriers -- ridges between
    radial valleys, the windward/leeward divide.  Milestone-2 replaces it with a
    least-cost-path partition over the actual topography, which is what will let
    a newly-cut canyon physically isolate two populations.
    """
    ny, nx = grid.shape
    jj, ii = np.meshgrid(np.arange(ny), np.arange(nx), indexing="ij")
    rj = (jj * n_regions_side) // ny
    ri = (ii * n_regions_side) // nx
    return np.where(land_mask, rj * n_regions_side + ri, -1)


class Evosphere:
    """Tracks demes, moves traits under selection and drift, declares species."""

    def __init__(self, seed: bytes, grid, n_regions_side: int = 3):
        self.seed = seed
        self.grid = grid
        self.n_regions_side = n_regions_side
        self.demes: list[Deme] = []
        self.chronicle = Chronicle()
        self.next_lineage_id = 1
        self.divergence: dict[tuple[int, int], float] = {}
        self.last_carbon_introduced = 0.0

    # --- population structure ------------------------------------------------

    def sync_demes(self, veg, regions: np.ndarray) -> None:
        """Create or retire demes to match where biomass actually is."""
        present = set()
        for slot, ln in enumerate(veg.lineages):
            for r in range(self.n_regions_side ** 2):
                mask = regions == r
                if not np.any(mask):
                    continue
                biomass = float(np.sum(veg.biomass[slot][mask]))
                if biomass < 1e-3:
                    continue
                present.add((ln.id, r))
                if not any(d.lineage_id == ln.id and d.region == r for d in self.demes):
                    # Founder effect: a new deme carries a sample of the source's
                    # variation, not all of it (docs/03e §5).
                    self.demes.append(Deme(
                        lineage_id=ln.id, region=r,
                        n_effective=max(biomass * 40.0, 8.0),
                        trait_mean=dict(ln.traits),
                        trait_var={k: v * 0.55 for k, v in ln.trait_var.items()},
                        heterozygosity=0.6,
                    ))
        self.demes = [d for d in self.demes if (d.lineage_id, d.region) in present]

        for d in self.demes:
            slot = veg.slot_of(d.lineage_id)
            if slot is None:
                continue
            mask = regions == d.region
            d.n_effective = max(float(np.sum(veg.biomass[slot][mask])) * 40.0, 4.0)

    # --- the evolutionary step ----------------------------------------------

    def step_year(self, veg, env: dict, regions: np.ndarray, year: float,
                  tick: int, dt_yr: float) -> list[str]:
        events: list[str] = []
        self.sync_demes(veg, regions)
        land = env["land_mask"]

        for d_index, deme in enumerate(self.demes):
            slot = veg.slot_of(deme.lineage_id)
            if slot is None:
                continue
            mask = (regions == deme.region)
            local = {**env,
                     "par_umol": env["par_umol"],
                     "land_mask": land & mask}

            for trait_index, trait in enumerate(TRAIT_NAMES):
                grad = self._selection_gradient(veg, slot, trait, local, land & mask)
                v_a = deme.trait_var[trait]
                # Lande (1979): the response is the additive variance times the
                # selection gradient.  Trait variance is state, not a constant --
                # a population hammered by selection becomes less able to respond.
                response = v_a * grad * dt_yr

                stream = Stream(self.seed, "evo", tick, stream=1000 + d_index)
                # Index by position, never by hash(): Python's string hash is
                # randomised per process and would break replay (docs/02 §D5).
                idx = np.uint64(trait_index + 1)
                drift_sd = km.sqrt(max(v_a, 0.0) / max(2.0 * deme.n_effective, 1.0))
                drift = float(stream.normal(idx)) * float(drift_sd) * float(km.sqrt(dt_yr))

                new = deme.trait_mean[trait] + response + drift
                deme.trait_mean[trait] = _clip_trait(trait, new)

                span = TRAIT_BOUNDS[trait][1] - TRAIT_BOUNDS[trait][0]
                v_mut = MUTATION_VARIANCE_FRACTION * (0.1 * span) ** 2 * dt_yr
                v_a = v_a * (1.0 - dt_yr / (2.0 * deme.n_effective)) + v_mut
                deme.trait_var[trait] = max(v_a, 1e-12)

            deme.heterozygosity *= float(km.exp(-dt_yr / (2.0 * deme.n_effective)))
            deme.heterozygosity = min(deme.heterozygosity + 1e-4 * dt_yr, 1.0)
            deme.substitutions += dt_yr * (0.5 + 2.0 / max(deme.n_effective, 1.0) ** 0.25)

        events += self._gene_flow_and_speciation(veg, year, tick, dt_yr)
        self._write_back(veg)
        return events

    def _selection_gradient(self, veg, slot: int, trait: str, env: dict,
                            mask: np.ndarray) -> float:
        """Numerical fitness gradient, from the biosphere itself.

        Perturb the trait, ask the actual photosynthesis and hydraulics model what
        that plant would have achieved this year, and difference.  No optimum is
        specified anywhere -- if the climate reverses, the gradient reverses.
        """
        if not np.any(mask):
            return 0.0
        ln = veg.lineages[slot]
        lo, hi = TRAIT_BOUNDS[trait]
        delta = 0.02 * (hi - lo)
        base = ln.traits[trait]

        ln.traits[trait] = _clip_trait(trait, base + delta)
        w_plus = veg.fitness_proxy(slot, env, mask)
        ln.traits[trait] = _clip_trait(trait, base - delta)
        w_minus = veg.fitness_proxy(slot, env, mask)
        ln.traits[trait] = base

        scale = max(abs(w_plus) + abs(w_minus), 1e-18)
        return (w_plus - w_minus) / (2.0 * delta) / scale

    def _gene_flow_and_speciation(self, veg, year: float, tick: int,
                                  dt_yr: float) -> list[str]:
        """Accumulate divergence between isolated demes; split when incompatible."""
        events: list[str] = []
        by_lineage: dict[int, list[Deme]] = {}
        for d in self.demes:
            by_lineage.setdefault(d.lineage_id, []).append(d)

        for lineage_id, demes in by_lineage.items():
            if len(demes) < 2:
                continue
            for a in range(len(demes)):
                for b in range(a + 1, len(demes)):
                    da, db = demes[a], demes[b]
                    key = (min(da.region, db.region), max(da.region, db.region))
                    full = (lineage_id, key)

                    side = self.n_regions_side
                    sep = (abs(da.region // side - db.region // side)
                           + abs(da.region % side - db.region % side))
                    migration = 0.05 / (1.0 + sep * sep)   # isolation by distance

                    # Divergent selection plus mutation drive them apart;
                    # gene flow pulls them back together.
                    pheno_gap = 0.0
                    for trait in TRAIT_NAMES:
                        lo, hi = TRAIT_BOUNDS[trait]
                        pheno_gap += abs(da.trait_mean[trait] - db.trait_mean[trait]) / (hi - lo)
                    pheno_gap /= len(TRAIT_NAMES)

                    k = self.divergence.get(full, 0.0)
                    k += dt_yr * (0.4 + 6.0 * pheno_gap) * (1.0 - migration * 12.0)
                    k = max(k, 0.0)
                    self.divergence[full] = k

                    # Dobzhansky-Muller: incompatibilities are pairwise between
                    # substitutions, so isolation snowballs with k^2 (Orr 1995).
                    isolation = 1.0 - float(km.exp(-DMI_SNOWBALL_C * k * k))
                    if isolation > ISOLATION_THRESHOLD:
                        ev = self._speciate(veg, db, year, tick)
                        if ev:
                            events.append(ev)
                            self.divergence.pop(full, None)
                        return events
        return events

    def _speciate(self, veg, deme: Deme, year: float, tick: int) -> str | None:
        parent_slot = veg.slot_of(deme.lineage_id)
        if parent_slot is None:
            return None
        parent = veg.lineages[parent_slot]

        self.next_lineage_id += 1
        child = Lineage(id=self.next_lineage_id, parent_id=parent.id,
                        traits=dict(deme.trait_mean), born_year=year,
                        origin="speciation",
                        trait_var=dict(deme.trait_var))
        slot = veg.add_lineage(child)
        if slot is None:
            return None

        # The new species takes the biomass of the deme it arose in.
        regions = getattr(self, "_last_regions", None)
        if regions is not None:
            mask = regions == deme.region
            veg.biomass[slot] = np.where(mask, veg.biomass[parent_slot], 0.0)
            veg.lai[slot] = np.where(mask, veg.lai[parent_slot], 0.0)
            veg.biomass[parent_slot] = np.where(mask, 0.0, veg.biomass[parent_slot])
            veg.lai[parent_slot] = np.where(mask, 0.0, veg.lai[parent_slot])

        deme.lineage_id = child.id
        text = (f"lineage {parent.id} split: population in region {deme.region} "
                f"became species {child.id}")
        self.chronicle.record(year, "speciation", text,
                              parent=parent.id, child=child.id, region=deme.region)
        return text

    def _write_back(self, veg) -> None:
        """Push deme trait means back to lineages, weighted by population size."""
        by_lineage: dict[int, list[Deme]] = {}
        for d in self.demes:
            by_lineage.setdefault(d.lineage_id, []).append(d)
        for lineage_id, demes in by_lineage.items():
            slot = veg.slot_of(lineage_id)
            if slot is None:
                continue
            total = sum(d.n_effective for d in demes) or 1.0
            for trait in TRAIT_NAMES:
                veg.lineages[slot].traits[trait] = _clip_trait(
                    trait, sum(d.trait_mean[trait] * d.n_effective for d in demes) / total)
                veg.lineages[slot].trait_var[trait] = max(
                    sum(d.trait_var[trait] * d.n_effective for d in demes) / total, 1e-12)

    # --- colonisation --------------------------------------------------------

    def colonise(self, veg, env: dict, year: float, tick: int,
                 vector: str = "wind") -> str | None:
        """A propagule arrives from the source pool.

        Islands are populated by rare accidents, and the accident matters more
        than anything that follows: everything the lineage becomes is conditioned
        on the handful of alleles that happened to land.
        """
        s = Stream(self.seed, "dispersal", tick, stream=7)
        traits = {}
        for i, name in enumerate(TRAIT_NAMES):
            lo, hi = TRAIT_BOUNDS[name]
            u = float(s.uniform(np.uint64(i + 1)))
            # Source pool is biased toward middling strategies; extremes are rare.
            u = 0.5 + (u - 0.5) * 0.7
            traits[name] = _clip_trait(name, lo + u * (hi - lo))

        self.next_lineage_id += 1
        ln = Lineage(id=self.next_lineage_id, parent_id=0, traits=traits,
                     born_year=year, origin=f"colonisation-{vector}")
        # Founder effect: reduced variation from the start.
        ln.trait_var = {k: v * 0.35 for k, v in ln.trait_var.items()}
        slot = veg.add_lineage(ln)
        if slot is None:
            self.next_lineage_id -= 1
            return None

        land = env["land_mask"]
        seedable = land & (env["psi_soil_m"] > -60.0)
        if not np.any(seedable):
            seedable = land
        self.last_carbon_introduced = veg.establish(slot, seedable, amount=0.02)
        text = f"species {ln.id} arrived by {vector}"
        self.chronicle.record(year, "colonisation", text, lineage=ln.id, vector=vector)
        return text

    def check_extinctions(self, veg, year: float) -> list[str]:
        events = []
        for slot, ln in enumerate(list(veg.lineages)):
            if not ln.alive:
                continue
            if float(np.sum(veg.biomass[slot])) < 1e-6 and ln.born_year < year - 1.0:
                ln.alive = False
                text = f"species {ln.id} went extinct"
                self.chronicle.record(year, "extinction", text, lineage=ln.id)
                events.append(text)
        return events

    def species_count(self, veg) -> int:
        return sum(1 for slot, ln in enumerate(veg.lineages)
                   if ln.alive and float(np.sum(veg.biomass[slot])) > 1e-6)

    def mean_heterozygosity(self) -> float:
        if not self.demes:
            return 0.0
        return float(np.mean([d.heterozygosity for d in self.demes]))
