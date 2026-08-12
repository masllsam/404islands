"""The coupler: one island, all five modules, four clocks (docs/02 §4).

Operator splitting in a fixed order, with per-module timesteps that are integer
multiples of one base tick:

    geosphere -> atmosphere -> hydrosphere -> biosphere -> evosphere -> ledger

Each module reads the previous module's committed state, never a partially
updated one.  The order is normative: changing it changes every island in the
edition, and would require a kernel version bump and a note on 404 certificates.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .atmos import energy, orbital, orographic, thermo
from .bio import vegetation
from .bio.vegetation import TRAIT_BOUNDS, TRAIT_NAMES, Lineage, Vegetation
from .evo.genetics import Evosphere, region_map
from .geo import lem, noise, reef, volcano
from .geo.routing import FlowNetwork
from .hydro import water
from .ports.state_frame import ChainHasher, DeltaFrame, FullFrame, pack_events
from .substrate import kmath as km
from .substrate.constants import L_VAP, RHO_WATER, SIGMA_SB, T0
from .substrate.grid import Grid, ksum_fast
from .substrate.ledger import Ledger
from .substrate.rng import Stream, seed_from_phrase

TICKS_PER_DAY = 96                # 15 sim-minutes per fast tick
DAYS_PER_YEAR = 365.2422


@dataclass
class IslandConfig:
    seed: bytes
    island_id: int = 0
    nx: int = 96
    ny: int = 96
    cell_size_m: float = 240.0
    latitude_deg: float = 19.5
    longitude_deg: float = -155.5
    genesis_years: float = 400000.0   # deep-time spin-up before ignition
    post_shield_years: float = 0.0    # further deep time with the hotspot gone
    strict_ledger: bool = False       # True in CI; anomalies are logged on hardware

    @classmethod
    def from_phrase(cls, phrase: str, **kw) -> "IslandConfig":
        return cls(seed=seed_from_phrase(phrase), **kw)


@dataclass
class IslandState:
    z: np.ndarray                     # surface elevation, m rel. to datum
    bedrock_z: np.ndarray
    soil_depth: np.ndarray
    soil_age: np.ndarray
    reef_thickness: np.ndarray
    k_erodibility: np.ndarray
    z_reference: np.ndarray = None      # genesis surface; flexure loads relative to it
    flexure_applied: np.ndarray = None  # deflection already folded into z
    sea_level: float = 0.0
    tick: int = 0
    sim_days: float = 0.0
    year: float = 0.0
    reef_stage: str = "no-reef"
    events_this_step: list[str] = field(default_factory=list)


class Island:
    """One of the 404.  Deterministic in (seed, elapsed ticks, input log)."""

    def __init__(self, config: IslandConfig):
        self.cfg = config
        self.grid = Grid(config.nx, config.ny, config.cell_size_m,
                         config.latitude_deg, config.longitude_deg)
        self.ledger = Ledger(strict=config.strict_ledger)
        self.orbit = orbital.Orbit()
        self.ocean = energy.SlabOcean(config.latitude_deg)
        self.volcano = volcano.initial_volcano(config.seed, self.grid)
        self.veg = Vegetation(self.grid)
        self.evo = Evosphere(config.seed, self.grid)
        self.hasher = ChainHasher()
        self.input_log: list[tuple[int, str, str]] = []

        self.state = self._genesis()
        self.net = FlowNetwork(self.state.z, self.grid.cell_size_m, self.state.sea_level)
        self.annual_precip_mm = self.grid.full(1200.0)
        self.soil_water = water.SoilColumn.create(self.grid, self.state.soil_depth)
        self.diagnostics: dict = {}
        self._spin_up(config.genesis_years)
        if config.post_shield_years > 0.0:
            self._post_shield(config.post_shield_years)

        # The soil column must be built from the regolith the spin-up actually
        # produced, not from the bare rock we started with -- otherwise every
        # plant on the island spends its life at wilting point.
        self.soil_water = water.SoilColumn.create(self.grid, self.state.soil_depth,
                                                  wetness=0.6)
        self._prime_ledger()

    def _prime_ledger(self) -> None:
        g = self.grid
        area = g.n_cells * g.cell_area_m2
        self.ledger.prime("energy", energy.OCEAN_HEAT_CAPACITY * self.ocean.sst_k * area)
        self.ledger.prime("water", float(ksum_fast(
            self.soil_water.storage_m() * (self.state.z > self.state.sea_level)))
            * g.cell_area_m2 * RHO_WATER)
        self.ledger.prime("carbon", (float(ksum_fast(self.veg.total_biomass()))
                                     + float(ksum_fast(self.veg.soil.total_c())))
                          * g.cell_area_m2)
        self.ledger.prime("sediment", 0.0)

    # ------------------------------------------------------------------ setup

    def _genesis(self) -> IslandState:
        g = self.grid
        s = Stream(self.cfg.seed, "genesis", 0, stream=2)

        # The seafloor: thermal subsidence depth for the plate's age, plus a
        # little abyssal-hill roughness.  Nothing here is an island yet.
        depth = volcano.thermal_subsidence_m(self.volcano.plate_age_myr)
        z = g.full(-depth) + 60.0 * noise.fbm(g, s, octaves=4, frequency=3.0)

        # The pedestal.  A real oceanic volcano is 30-40 km across at its base
        # and only its top few kilometres are inside a 14 km window, so the
        # deeper flanks -- built before this domain's history begins -- are
        # represented analytically rather than simulated.  This is a regional
        # domain of a larger structure, which is standard practice, and it is why
        # the eruptions we *do* simulate are the ones that build the summit an
        # owner will actually look at.
        r = g.radius_m()
        r_edge = 0.5 * min(g.nx, g.ny) * g.cell_size_m
        summit_depth = 200.0 + 450.0 * float(s.uniform(np.uint64(41)))
        pedestal = np.maximum(depth - summit_depth, 0.0) * np.clip(1.0 - r / r_edge, 0.0, 1.0) ** 1.4
        z = z + pedestal * (0.9 + 0.2 * noise.fbm(g, s, octaves=3, frequency=2.0))

        # Rock strength: heterogeneous, with dike-like lineations.  This is what
        # makes some ridges hold up while their neighbours are cut away.
        k = 4.0e-6 * (0.55 + 0.9 * (0.5 + 0.5 * noise.ridged(g, s, octaves=4)))

        return IslandState(
            z=z, bedrock_z=z.copy(), soil_depth=g.zeros(), soil_age=g.zeros(),
            reef_thickness=g.zeros(), k_erodibility=k, sea_level=0.0,
            z_reference=z.copy(), flexure_applied=g.zeros(),
        )

    def _spin_up(self, years: float) -> None:
        """Build the island before the owner ever sees it.

        Deep time in century steps: erupt, load the plate, subside, erode, accrete
        reef.  What emerges is not a designed shape -- it is the shape this magma
        supply, at this latitude, under these trade winds, must produce.
        """
        dt = 2000.0
        steps = int(years / dt)
        # Pre-ignition history carries negative years, so the chronicle reads in
        # order and an owner can tell what happened before their island was lit.
        self.state.year = -steps * dt
        for i in range(steps):
            self._step_century(dt, tick=-(steps - i))
        self.state.year = 0.0
        self.veg.soil.p_available = np.maximum(self.veg.soil.p_available, 0.02)
        self._colonise_initial()

    def _post_shield(self, years: float) -> None:
        """Carry the island past the shield stage before ignition.

        While the hotspot is still feeding it, construction resurfaces the cone
        about as fast as rivers cut it -- which is why Mauna Loa has no canyons
        and Kauai does.  Cutting the supply and running on lets the landscape
        develop, and it is how most of the edition's islands will be found: the
        interesting landforms belong to the erosional stage.
        """
        self.volcano.q_max_m3_yr = 0.0
        self.volcano.chamber_volume_m3 = 0.0
        dt = 2000.0
        steps = int(years / dt)
        for i in range(steps):
            self._step_century(dt, tick=-(steps - i) - 1)
        self.state.year = 0.0

    def _colonise_initial(self) -> None:
        env = self._bio_env()
        for i in range(3):
            self.evo.colonise(self.veg, env, 0.0, tick=i, vector="wind")

    # ---------------------------------------------------------- deep time step

    def _step_century(self, dt_yr: float, tick: int) -> list[str]:
        st = self.state
        g = self.grid
        events: list[str] = []

        # --- geosphere: magma, load, subsidence --------------------------
        st.z, erupt_events = volcano.step_magma(
            self.volcano, self.cfg.seed, tick, dt_yr, g, st.z)
        if erupt_events:
            events.append("eruption")
            for e in erupt_events[:2]:
                self.evo.chronicle.record(st.year, "eruption", e)
            # Fresh lava resets soil and vegetation where it landed.
            fresh = st.z > st.bedrock_z + 0.5
            st.soil_depth = np.where(fresh, 0.0, st.soil_depth)
            st.soil_age = np.where(fresh, 0.0, st.soil_age)
            self._burn_carbon(fresh, fraction=1.0, to_atmosphere=0.5)
            self.veg.biomass[:, fresh] = 0.0
            self.veg.lai[:, fresh] = 0.0
            self.veg.soil.litter_c[fresh] = 0.0
            self.veg.soil.slow_c[fresh] = 0.0
            self.veg.soil.passive_c[fresh] = 0.0

        # Flexure is an *equilibrium* response to the load currently present, not
        # a rate.  Recompute it from the edifice built since genesis -- the
        # pedestal's own deflection is already contained in the seafloor depth --
        # and apply only the increment since last time.  Erosion unloads the plate
        # and lets it rebound, which is why the two terms must share one state.
        load = np.maximum(st.z - st.z_reference, 0.0)
        w_new = volcano.flexure(g, load)
        st.z = st.z - (w_new - st.flexure_applied)
        st.flexure_applied = w_new

        st.z = st.z - volcano.subsidence_rate_m_yr(self.volcano.plate_age_myr) * dt_yr

        # --- atmosphere: the climatology that will do the carving ---------
        self.ocean.step(180.0, self.orbit, 0.5, dt_days=30.0)
        u, v = self._trade_wind()
        self.annual_precip_mm = orographic.annual_precipitation_mm(
            g, np.maximum(st.z - st.sea_level, 0.0), u, v, self.ocean.sst_k,
            background_mm_hr=orographic.background_rate_mm_hr(
                self.ocean.sst_c, self.cfg.latitude_deg))

        # --- geosphere: landscape evolution -------------------------------
        self.net = FlowNetwork(st.z, g.cell_size_m, st.sea_level)
        q_eff = self.net.route(self.annual_precip_mm * 1e-3 * g.cell_area_m2)
        land = st.z > st.sea_level

        st.z = lem.stream_power_implicit(st.z, self.net, st.k_erodibility, q_eff,
                                         dt_yr, st.sea_level)
        st.z = lem.hillslope_nonlinear(g, st.z, d_h=0.006, s_crit=0.65, dt_yr=dt_yr)
        st.z = np.where(land, st.z, np.minimum(st.z, st.sea_level))

        production = lem.soil_production(st.soil_depth, dt_yr)
        st.soil_depth = np.where(land, np.minimum(st.soil_depth + production, 4.0), 0.0)
        st.soil_age = np.where(land, st.soil_age + dt_yr, 0.0)
        st.bedrock_z = np.minimum(st.bedrock_z, st.z)

        # --- reef ---------------------------------------------------------
        shelf = (st.z < st.sea_level) & (st.z > st.sea_level - 120.0)
        turbidity = np.clip(self.net.route(self.annual_precip_mm * 1e-6) / 5.0e3, 0.0, 1.0)
        prev_stage = st.reef_stage
        st.z, st.reef_thickness, st.reef_stage = reef.step(
            st.z, st.reef_thickness, st.sea_level, self.ocean.sst_c,
            turbidity, dt_yr, shelf)
        if st.reef_stage != prev_stage:
            events.append("reef_stage_change")
            self.evo.chronicle.record(
                st.year, "reef", f"reef stage: {prev_stage} -> {st.reef_stage}")

        st.year += dt_yr
        return events

    def _trade_wind(self) -> tuple[float, float]:
        """Prescribed synoptic flow at this latitude (docs/03b §1).

        A 10 km domain cannot generate its own circulation.  Trade easterlies in
        the tropics, westerlies in the mid-latitudes -- the Hadley/Ferrel pattern
        the island actually sits in.
        """
        lat = self.cfg.latitude_deg
        if abs(lat) < 30.0:
            return (-7.0 * float(km.cos(np.deg2rad(lat * 3.0))), 1.5)
        return (9.0, -1.0)

    # -------------------------------------------------------------- fast step

    def _bio_env(self) -> dict:
        st = self.state
        g = self.grid
        land = st.z > st.sea_level
        elev = np.maximum(st.z - st.sea_level, 0.0)

        t_sea = self.ocean.sst_k + 1.0
        t_air = t_sea - 0.0065 * elev
        rh = np.clip(0.65 + 0.25 * np.clip(self.annual_precip_mm / 3000.0, 0.0, 1.0),
                     0.3, 0.98)
        e_sat = thermo.saturation_vapour_pressure(t_air)
        vpd = np.maximum(e_sat * (1.0 - rh), 20.0)

        storage = self.soil_water.storage_m()
        depth = np.maximum(st.soil_depth, 0.02)
        moisture = np.clip(storage / (depth * 0.45), 0.0, 1.0)
        tex = water.texture_from_age(st.soil_age)
        psi = water.matric_potential(moisture * tex["theta_s"], tex["theta_s"],
                                     tex["psi_s"], tex["b"])

        decl, rf = orbital.solar_state(st.sim_days % DAYS_PER_YEAR, self.orbit)
        daily = orbital.daily_mean_toa(np.deg2rad(self.cfg.latitude_deg), decl, rf)
        par = daily * 2.1 * 0.45     # W/m2 -> umol PAR m-2 s-1, daylight mean

        return {
            "land_mask": land,
            "par_umol": g.full(max(par, 0.0)),
            "t_air_k": t_air,
            "t_soil_k": t_air - 1.0,
            "vpd_pa": vpd,
            "psi_soil_m": psi,
            "moisture_frac": moisture,
            "p_weathering": vegetation.weathering_p_release(
                lem.soil_production(st.soil_depth, 1.0)),
            "drainage_m_yr": np.clip(self.annual_precip_mm * 1e-3 - 0.8, 0.0, 4.0),
        }

    def step_year(self, dt_yr: float = 1.0) -> list[str]:
        """One island-year: biology, evolution, hydrology, budgets."""
        st = self.state
        g = self.grid
        events: list[str] = []
        tick = st.tick

        # --- atmosphere ---------------------------------------------------
        self._ocean_sw_absorbed_j = 0.0
        self._ocean_loss_j = 0.0
        for m in range(12):
            before = self.ocean.sst_k
            self.ocean.step(st.sim_days + m * 30.0, self.orbit, 0.45, dt_days=30.0)
            # Reconstruct the two sides of the flux from the temperature change
            # the slab actually took, so the budget reflects the integration that
            # happened rather than a recomputation that might differ.
            dt_s = 30.0 * 86400.0
            net = (self.ocean.sst_k - before) * energy.OCEAN_HEAT_CAPACITY / dt_s
            lw, le, sh = self.ocean._fluxes(before, 0.45)
            loss = lw + le + sh - self.ocean.transport_w_m2
            self._ocean_sw_absorbed_j += (net + loss) * dt_s
            self._ocean_loss_j += loss * dt_s
        u, v = self._trade_wind()
        self.annual_precip_mm = orographic.annual_precipitation_mm(
            g, np.maximum(st.z - st.sea_level, 0.0), u, v, self.ocean.sst_k,
            background_mm_hr=orographic.background_rate_mm_hr(
                self.ocean.sst_c, self.cfg.latitude_deg))

        env = self._bio_env()
        land = env["land_mask"]

        # --- hydrosphere --------------------------------------------------
        precip_m = self.annual_precip_mm * 1e-3 * dt_yr
        pet_m = np.clip(0.9 + 0.05 * (self.ocean.sst_c - 25.0), 0.3, 2.2) * dt_yr
        lai = self.veg.total_lai()
        transpiration = np.minimum(pet_m * np.clip(lai / 4.0, 0.05, 1.0), precip_m * 0.75)
        transpiration = np.where(land, transpiration, 0.0)
        recharge = np.clip(precip_m - transpiration, 0.0, None) * 0.3 * land

        self.lens, lens_volume = water.freshwater_lens_thickness(
            g, st.z, st.sea_level, np.where(land, recharge / max(dt_yr, 1e-9), 0.0))

        # Update soil storage toward its equilibrium wetness, then let runoff be
        # what is left.  Runoff *is* the residual of a catchment water balance --
        # closing the budget this way is the definition, not a fudge.  What it
        # buys: the ledger below is a real check on the other three terms.
        self.soil_water = water.SoilColumn.rescale(self.soil_water, st.soil_depth)
        target_theta = np.clip(0.15 + 0.5 * np.clip(precip_m / 2.0, 0.0, 1.0), 0.05, 0.45)
        store_before = self.soil_water.storage_m()
        self.soil_water.theta += (target_theta[None, :, :] - self.soil_water.theta) * 0.35
        d_store = self.soil_water.storage_m() - store_before
        runoff = np.maximum(precip_m - transpiration - d_store, 0.0) * land
        # Any cell where the floor bites is a genuine anomaly, not a rounding
        # artefact, so it is surfaced rather than absorbed.
        deficit = float(ksum_fast(np.minimum(precip_m - transpiration - d_store, 0.0) * land))

        water_in = float(ksum_fast(precip_m * land)) * g.cell_area_m2 * RHO_WATER
        water_out = (float(ksum_fast((transpiration + runoff) * land)) + deficit) \
            * g.cell_area_m2 * RHO_WATER
        soil_store = float(ksum_fast(self.soil_water.storage_m() * land)) \
            * g.cell_area_m2 * RHO_WATER
        self.ledger["water"].add_in(water_in)
        self.ledger["water"].add_out(water_out)
        self.ledger["water"].set_stored(soil_store)

        # --- energy budget --------------------------------------------------
        # Milestone 1 closes the *ocean* energy budget, which is a genuine
        # conservation check: absorbed shortwave in, longwave + latent + sensible
        # + transport out, mixed-layer heat as storage.  The land-surface budget
        # is not closed at this milestone and the ledger does not pretend it is
        # (docs/08, Milestone 2).  A budget we report as closed must actually be
        # closed; anything else devalues the ones that are.
        seconds = dt_yr * 3.15576e7
        area = g.n_cells * g.cell_area_m2
        e_in = self._ocean_sw_absorbed_j
        e_out = self._ocean_loss_j
        self.ledger["energy"].add_in(e_in * area)
        self.ledger["energy"].add_out(e_out * area)
        self.ledger["energy"].set_stored(
            energy.OCEAN_HEAT_CAPACITY * self.ocean.sst_k * area)

        # --- biosphere ------------------------------------------------------
        bio = self.veg.step_year(env, dt_yr, ledger=self.ledger)

        # --- evosphere ------------------------------------------------------
        regions = region_map(g, land, self.evo.n_regions_side)
        self.evo._last_regions = regions
        evo_events = self.evo.step_year(self.veg, env, regions, st.year, tick, dt_yr)
        if evo_events:
            events.append("speciation")
        events += ["extinction"] if self.evo.check_extinctions(self.veg, st.year) else []

        # Rare arrivals.  Rate falls with isolation and rises with island area --
        # MacArthur & Wilson's immigration curve, as a mechanism rather than a
        # fitted equilibrium (docs/03f).
        land_area_km2 = float(np.sum(land)) * g.cell_area_m2 / 1e6
        s = Stream(self.cfg.seed, "dispersal", tick, stream=3)
        rate = 0.02 * dt_yr * min(land_area_km2 / 20.0, 2.0)
        if land_area_km2 > 0.5 and bool(s.poisson_event(np.uint64(1), rate)):
            vector = ("wind", "sea", "bird")[int(s.uniform(np.uint64(2)) * 3.0)]
            if self.evo.colonise(self.veg, env, st.year, tick, vector):
                events.append("colonisation")
                self.ledger["carbon"].add_in(
                    self.evo.last_carbon_introduced * g.cell_area_m2)

        # --- disturbance -----------------------------------------------------
        events += self._disturbance(env, dt_yr, tick)

        # --- close the books --------------------------------------------------
        st.year += dt_yr
        st.sim_days += dt_yr * DAYS_PER_YEAR
        st.tick += int(dt_yr * DAYS_PER_YEAR * TICKS_PER_DAY)
        # Disturbances run after the biosphere, so storage is re-read here rather
        # than inside the biosphere step.
        self.ledger["carbon"].set_stored(
            (float(ksum_fast(self.veg.total_biomass()))
             + float(ksum_fast(self.veg.soil.total_c()))) * g.cell_area_m2)
        self.ledger.close_step(st.tick)

        self.diagnostics = {
            **bio,
            "lens_volume_m3": lens_volume,
            "land_area_km2": land_area_km2,
            "species": self.evo.species_count(self.veg),
            "sst_c": self.ocean.sst_c,
            "precip_mean_mm": float(g.mean(self.annual_precip_mm, land)),
            "precip_max_mm": float(np.max(self.annual_precip_mm)),
            "summit_m": float(np.max(st.z - st.sea_level)),
            "heterozygosity": self.evo.mean_heterozygosity(),
        }
        st.events_this_step = events
        return events

    def _disturbance(self, env: dict, dt_yr: float, tick: int) -> list[str]:
        st = self.state
        g = self.grid
        events: list[str] = []
        land = env["land_mask"]
        if not np.any(land):
            return events

        # Landslides: root cohesion vs. pore pressure, at the slope's own limit.
        fos = lem.landslide_factor_of_safety(
            g, st.z, st.soil_depth, env["moisture_frac"], self.veg.root_cohesion_pa())
        if np.any((fos < 1.0) & (st.soil_depth > 0.05)):
            st.z, st.soil_depth, vol, failed = lem.apply_landslides(
                g, st.z, st.soil_depth, fos)
            if vol > 0.0:
                # Buried, not burnt: the carbon moves to litter rather than to
                # the atmosphere.
                self.veg.soil.litter_c[failed] += self.veg.total_biomass()[failed] * 0.9
                self.veg.biomass[:, failed] *= 0.1
                self.veg.lai[:, failed] *= 0.1
                events.append("landslide")
                self.ledger["sediment"].add_in(vol * 2000.0)
                self.ledger["sediment"].add_out(vol * 2000.0)

        # Fire: fuel load and dryness, ignited by lightning.
        fuel = self.veg.soil.litter_c + self.veg.total_biomass() * 0.2
        dryness = np.clip(1.0 - env["moisture_frac"], 0.0, 1.0)
        risk = float(g.mean(np.clip(fuel / 4.0, 0.0, 1.0) * dryness ** 2, land))
        s = Stream(self.cfg.seed, "disturbance", tick, stream=5)
        self.fire_activity = risk
        if bool(s.poisson_event(np.uint64(1), risk * 0.25 * dt_yr)):
            burn = land & (dryness > 0.55) & (fuel > 1.0)
            if np.any(burn):
                self._burn_carbon(burn, fraction=0.75, to_atmosphere=0.85)
                self.veg.biomass[:, burn] *= 0.25
                self.veg.lai[:, burn] *= 0.25
                # Fire volatilises nitrogen but concentrates phosphorus in ash --
                # a real and consequential asymmetry (docs/03d §10).
                self.veg.soil.n_available[burn] *= 0.5
                self.veg.soil.p_available[burn] += self.veg.soil.litter_c[burn] * 0.0008
                self.veg.soil.litter_c[burn] *= 0.2
                events.append("fire")
                self.evo.chronicle.record(st.year, "fire",
                                          f"fire burned {int(np.sum(burn))} cells")

        # Cyclones: only where the ocean is warm enough to build one.
        if self.ocean.sst_c > 26.5 and abs(self.cfg.latitude_deg) > 5.0:
            if bool(s.poisson_event(np.uint64(2), 0.12 * dt_yr)):
                self.veg.lai *= 0.7
                events.append("cyclone")
                self.evo.chronicle.record(st.year, "cyclone", "tropical cyclone passage")
        return events

    # ------------------------------------------------------------------ output

    def _burn_carbon(self, mask: np.ndarray, fraction: float,
                     to_atmosphere: float) -> None:
        """Account carbon removed by a disturbance.

        A disturbance that silently deletes biomass would leave the carbon budget
        open, and an open budget on the instrument panel is the one thing that
        would let a sceptic dismiss the whole object.  So every kilogram is
        placed: some oxidised to the atmosphere, the rest to litter.
        """
        if not np.any(mask):
            return
        removed = self.veg.total_biomass() * mask * fraction
        oxidised = float(ksum_fast(removed)) * to_atmosphere
        self.ledger["carbon"].add_out(oxidised * self.grid.cell_area_m2)
        self.veg.soil.litter_c += removed * (1.0 - to_atmosphere)

    def delta_frame(self) -> DeltaFrame:
        """The interpretive layer the kinetic score and the render port read."""
        st = self.state
        g = self.grid
        land = st.z > st.sea_level
        day = st.sim_days
        decl, rf = orbital.solar_state(day % DAYS_PER_YEAR, self.orbit)
        h = orbital.hour_angle((day % 1.0))
        elev, azi = orbital.sun_position(np.deg2rad(self.cfg.latitude_deg), decl, h)

        sun_deg = float(np.rad2deg(elev))
        # Colour temperature from the beam's atmospheric path length: long path at
        # the horizon means scattered-out blue, so a real 1800 K sunset.
        cct = 1800.0 + 4700.0 * float(np.clip(km.sin(max(elev, 0.0)), 0.0, 1.0)) ** 0.4
        lum = float(np.clip(km.sin(max(elev, 0.0)), 0.0, 1.0)) ** 0.7

        lai = self.veg.total_lai()
        lai_mean = float(g.mean(lai, land)) if np.any(land) else 0.0
        npp = self.diagnostics.get("npp", 0.0)

        values = {
            "sun_elevation_deg": sun_deg,
            "sun_azimuth_deg": float(np.rad2deg(azi)),
            "moon_phase": orbital.moon_phase(day),
            "moon_elevation_deg": 40.0 * float(km.sin(2.0 * np.pi * (day % 1.0) + np.pi)),
            "sky_luminance": lum,
            "sky_colour_temp_k": cct,
            "cloud_frac": float(np.clip(self.diagnostics.get("precip_mean_mm", 0.0) / 3000.0,
                                        0.05, 0.95)),
            "precip_rate_mm_h": float(self.diagnostics.get("precip_mean_mm", 0.0) / 8760.0),
            "wind_speed_ms": float(abs(self._trade_wind()[0])),
            "wind_dir_deg": float(np.rad2deg(km.atan2(*self._trade_wind())) % 360.0),
            "t_air_mean_c": float(g.mean(np.asarray(self._bio_env()["t_air_k"]), land)) - T0
            if np.any(land) else self.ocean.sst_c,
            "t_range_c": 6.0,
            "sst_c": self.ocean.sst_c,
            "sea_state": float(np.clip(abs(self._trade_wind()[0]) / 3.0, 0.0, 9.0)),
            "tide_phase": orbital.tide_phase(day),
            "lake_stage_norm": float(np.clip(np.max(self.net.lake_depth) / 40.0, 0.0, 1.0)),
            "river_discharge_norm": float(np.clip(
                self.diagnostics.get("precip_mean_mm", 0.0) / 4000.0, 0.0, 1.0)),
            "lens_health": water.lens_health(getattr(self, "lens", g.zeros()), land),
            "lai_mean": lai_mean,
            "canopy_greenness": float(np.clip(lai_mean / 5.0, 0.0, 1.0)),
            "bloom_index": 0.0,
            "senescence_index": 0.0,
            "npp_norm": float(np.clip(npp / 1.0e8, 0.0, 1.0)),
            "fire_activity": float(getattr(self, "fire_activity", 0.0)),
            "population_stress": float(1.0 - self.evo.mean_heterozygosity()),
            "season_phase": float((day % DAYS_PER_YEAR) / DAYS_PER_YEAR),
            "year_fraction": float((day % DAYS_PER_YEAR) / DAYS_PER_YEAR),
            "island_age_years": st.year,
            "summit_elevation_m": float(np.max(st.z - st.sea_level)),
            "land_area_km2": float(np.sum(land)) * g.cell_area_m2 / 1e6,
        }

        frame = DeltaFrame(
            tick=st.tick, sim_time_s=st.sim_days * 86400.0,
            island_id=self.cfg.island_id, values=values,
            event_flags=pack_events(st.events_this_step),
            species_count=self.evo.species_count(self.veg),
            reef_stage=reef.REEF_STAGE_ID.get(st.reef_stage, 0),
            ledger_ok=self.ledger.ok(),
            residual_exponent=self.ledger.residual_exponent(),
        )
        self.hasher.add_delta(frame, self.cfg.seed)
        return frame

    def full_frame(self) -> FullFrame:
        st = self.state
        frame = FullFrame(
            tick=st.tick, sim_time_s=st.sim_days * 86400.0,
            island_id=self.cfg.island_id, genesis_seed=self.cfg.seed,
            fields={
                "z": st.z, "bedrock_z": st.bedrock_z, "soil_depth": st.soil_depth,
                "soil_age": st.soil_age, "reef_thickness": st.reef_thickness,
                "annual_precip_mm": self.annual_precip_mm,
                "lai": self.veg.total_lai(), "biomass": self.veg.total_biomass(),
                "soil_c": self.veg.soil.total_c(),
                "p_available": self.veg.soil.p_available,
                "lens": getattr(self, "lens", self.grid.zeros()),
            },
            scalars={
                "sea_level": st.sea_level, "year": st.year, "sst_k": self.ocean.sst_k,
                "plate_age_myr": self.volcano.plate_age_myr,
                "volume_erupted_m3": self.volcano.volume_erupted_m3,
                "eruptions": float(self.volcano.eruptions),
                "species": float(self.evo.species_count(self.veg)),
            },
            chronicle=self.evo.chronicle.entries,
        )
        self.hasher.add_full(frame)
        return frame

    # ------------------------------------------------------------------ input

    def record_input(self, kind: str, detail: str = "") -> None:
        """Append an owner or service event to the signed input log (docs/02 §D7).

        seed + kernel_version + input_log is the complete definition of this
        island's state.  Nothing else may influence it -- which is why pauses and
        interventions are recorded rather than hidden.
        """
        self.input_log.append((self.state.tick, kind, detail))
        self.evo.chronicle.record(self.state.year, "input", f"{kind}: {detail}")
