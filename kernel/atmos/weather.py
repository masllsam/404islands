"""The fast clock: diurnal weather, at 15 simulated minutes a tick.

Everything above this file runs on annual climatology, which is right for
carving a landscape over a hundred thousand years and useless for the thing a
person actually stands in front of.  This is what gives the display something to
do between one minute and the next.

Three mechanisms, all real, none of them scripted:

* **The diurnal heating cycle.** Land has almost no heat capacity compared with
  a 50 m ocean mixed layer, so it warms and cools within hours while the sea
  barely moves.  Everything else here follows from that contrast.

* **The sea breeze and its cloud.**  Warm land draws air in from all sides; on an
  island the inflow has nowhere to go but up, and it converges over the summit.
  The result is the afternoon cap cloud that forms over almost every tropical
  island on almost every calm day, peaks in mid-afternoon, and dissolves after
  sunset.  It is probably the most-photographed weather phenomenon on Earth and
  it costs about forty lines.

* **Synoptic variability.**  The trade wind is not a constant.  An
  Ornstein-Uhlenbeck process gives it a realistic autocorrelation -- gusty for a
  day, then slack for three -- without ever repeating.

Conservation note: the boundary layer here is *diagnostic*.  It carries no heat
storage of its own, because at a 15-minute step over a maritime island its
thermal inertia is negligible beside the mixed layer's, and giving it a reservoir
we could not close would put a hole in the energy budget for the sake of a
detail nobody can see (docs/02 §7, docs/03b §6).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from ..substrate import kmath as km
from ..substrate.constants import CP_AIR, RHO_AIR, SIGMA_SB, T0
from ..substrate.rng import Stream
from . import energy, orbital, thermo

TICKS_PER_DAY = 96                 # 15 sim-minutes
SECONDS_PER_TICK = 86400.0 / TICKS_PER_DAY

# Ornstein-Uhlenbeck timescales.  A trade wind stays gusty or slack for a couple
# of days, not for an hour and not for a month.
TAU_WIND_DAYS = 2.5
TAU_SYNOPTIC_DAYS = 4.0

# The convective cloud lags its forcing: air has to rise, cool, and condense
# before anything is visible, and it lingers after the forcing stops.
TAU_CLOUD_BUILD_H = 1.4
TAU_CLOUD_DECAY_H = 2.6

# Island diameter at which sea-breeze convergence is fully developed.  A breeze
# front penetrates inland at a few m/s over an afternoon, so islands more than
# ~10 km across close their circulation and cap over; an islet a kilometre wide
# never does.  This is the length scale, not a fudge.
BREEZE_SATURATION_KM = 9.0

# THE ONE TUNED SCALAR IN THIS FILE.
#
# Converts sea-breeze forcing (K of land-sea contrast, scaled by island size,
# shear and moisture) into cloud cover.  Calibrated once so that a ~10 km
# tropical island on a calm day caps over at 0.6-0.9 in mid-afternoon, which is
# what every photograph of one shows.  Isolated and named rather than buried in
# the physics, as with WET_FRACTION in orographic.py.
BREEZE_TO_CLOUD = 2.6

# Boundary nudging width, in cells.  Air entering the domain has to arrive with
# the cloud its airmass is carrying, and air leaving has to be absorbed; without
# a relaxation zone the field either recirculates (periodic) or piles up against
# the edge (clamped).  This is the standard regional-model treatment and it is
# the same "imposed synoptic flow" split as everywhere else in docs/03b §1.
NUDGE_CELLS = 6.0


@dataclass
class WeatherState:
    """Prognostic fast-clock variables.  Small, so a delta frame stays cheap."""

    wind_speed_ms: float = 7.0
    wind_dir_rad: float = 0.0
    synoptic: float = 0.0          # -1 dry and settled .. +1 moist and disturbed
    convective_cloud: float = 0.0  # 0..1, the island's own afternoon cloud
    trade_cloud: float = 0.0       # 0..1, the background broken deck
    precip_rate_mm_h: float = 0.0
    t_land_mean_k: float = 295.0
    t_land_range_k: float = 0.0
    land_sea_contrast_k: float = 0.0
    squall: float = 0.0            # 0..1, a passing shower

    # Spatial fields.  These are what let a shower *cross* the island instead of
    # covering it, and they are what the display samples -- so the cloud in the
    # picture is state, not a texture the renderer invented.
    cloud_water: np.ndarray | None = None    # (ny, nx), 0..1 condensed on the deck
    precip_field_mm_h: np.ndarray | None = None
    _airmass_tex: np.ndarray | None = None   # trade cumulus the inflow carries
    _tex_sorted: np.ndarray | None = None
    _oro_cache: tuple | None = None
    _drift_cells: tuple = (0.0, 0.0)

    def ensure_fields(self, grid, seed) -> None:
        if self.cloud_water is not None:
            return
        from ..geo import noise
        from ..substrate.rng import Stream

        self.cloud_water = grid.zeros()
        self.precip_field_mm_h = grid.zeros()
        s = Stream(seed, "atmos", 0, stream=91)
        base = 0.5 + 0.5 * noise.fbm(grid, s, octaves=5, frequency=2.6)
        # Mirror-tiled so the inflow can scroll indefinitely without a seam.
        row = np.concatenate([base, base[:, ::-1]], axis=1)
        self._airmass_tex = np.concatenate([row, row[::-1, :]], axis=0)
        self._tex_sorted = np.sort(self._airmass_tex.ravel())
        self._oro_cache = None

    def airmass_thresholds(self, cover: float) -> tuple[float, float]:
        """Percentile cut for a given sky coverage.

        Cached against a pre-sorted copy: this runs 96 times a simulated day and
        re-sorting the texture every tick is pure waste.
        """
        n = self._tex_sorted.size
        idx = int(np.clip((1.0 - cover) * (n - 1), 0, n - 1))
        return float(self._tex_sorted[idx]), float(self._tex_sorted[-1])

    def orographic_thresholds(self, precip) -> tuple[float, float]:
        """88th percentile and maximum of the rainfall field.

        Recomputed only when the climatology changes -- which is once a year, not
        once a tick.
        """
        key = (float(precip.sum()), float(precip.max()))
        if self._oro_cache is None or self._oro_cache[0] != key:
            self._oro_cache = (key, float(np.percentile(precip, 88)),
                               max(float(precip.max()), 1.0))
        return self._oro_cache[1], self._oro_cache[2]


def _ou_step(value: float, target: float, tau_days: float, dt_days: float,
             sigma: float, draw: float) -> float:
    """One Ornstein-Uhlenbeck increment: mean-reverting, correctly scaled.

    The sqrt(dt) on the noise is what makes the process independent of the
    timestep; getting it wrong makes the weather's variability a function of how
    finely you happen to be integrating.
    """
    a = dt_days / max(tau_days, 1e-6)
    return value + (target - value) * a + sigma * float(km.sqrt(a)) * draw


def _sample(field: np.ndarray, fx: np.ndarray, fy: np.ndarray,
            wrap: bool = False) -> np.ndarray:
    """Bilinear sample in cell coordinates; wrap or clamp at the edges."""
    ny, nx = field.shape
    if wrap:
        x = np.mod(fx, nx)
        y = np.mod(fy, ny)
        i0 = np.floor(x).astype(np.int64) % nx
        j0 = np.floor(y).astype(np.int64) % ny
        i1 = (i0 + 1) % nx
        j1 = (j0 + 1) % ny
    else:
        x = np.clip(fx, 0.0, nx - 1.001)
        y = np.clip(fy, 0.0, ny - 1.001)
        i0 = np.floor(x).astype(np.int64)
        j0 = np.floor(y).astype(np.int64)
        i1 = np.minimum(i0 + 1, nx - 1)
        j1 = np.minimum(j0 + 1, ny - 1)
    tx = x - np.floor(x)
    ty = y - np.floor(y)
    a = field[j0, i0] * (1 - tx) + field[j0, i1] * tx
    b = field[j1, i0] * (1 - tx) + field[j1, i1] * tx
    return a * (1 - ty) + b * ty


def advect(field: np.ndarray, u_ms: float, v_ms: float, dt_s: float,
           cell_size_m: float) -> np.ndarray:
    """Semi-Lagrangian advection: look back to where this air came from.

    Unconditionally stable, so the wind may blow as hard as it likes without the
    timestep having to shrink -- which matters because a cyclone is exactly the
    case where you least want the weather solver to fall over.
    """
    ny, nx = field.shape
    jj, ii = np.meshgrid(np.arange(ny, dtype=np.float64),
                         np.arange(nx, dtype=np.float64), indexing="ij")
    dx = u_ms * dt_s / cell_size_m
    dy = v_ms * dt_s / cell_size_m
    return _sample(field, ii - dx, jj - dy)


def land_surface_temperature(sw_down: float, lw_down: float, t_air_k: float,
                             albedo: float, lai: float, wind_ms: float,
                             soil_moisture: float) -> float:
    """Skin temperature of the land, solved from its energy balance.

    Bare rock over-shoots the air temperature by 15-25 K at midday; a wet forest
    barely moves, because it spends the energy on transpiration instead.  That
    difference is what drives the sea breeze, so it has to be a solved balance
    and not a fudge.
    """
    r_a = float(thermo.aerodynamic_resistance(wind_ms, 0.1 + 0.9 * min(lai, 6.0)))
    # Surface resistance: dense wet vegetation transpires freely, dry rock cannot.
    beta = float(np.clip(soil_moisture, 0.02, 1.0)) * float(np.clip(lai / 3.0, 0.05, 1.0))
    r_s = 60.0 / max(beta, 0.02)
    vpd = float(thermo.saturation_vapour_pressure(t_air_k)) * 0.25
    t_s = energy.surface_temperature(
        sw_down * (1.0 - albedo), lw_down, t_air_k, vpd, 101325.0, r_a, r_s,
        ground_flux=0.1 * sw_down * (1.0 - albedo))
    return float(np.asarray(t_s).reshape(-1)[0])


def step(state: WeatherState, island, tick: int, n_ticks: int = 1) -> WeatherState:
    """Advance the weather by ``n_ticks`` of 15 simulated minutes."""
    isl = island
    st = isl.state
    g = isl.grid
    land = st.z > st.sea_level
    dt_days = n_ticks / TICKS_PER_DAY

    s = Stream(isl.cfg.seed, "atmos", tick, stream=5)
    lat_rad = float(np.deg2rad(isl.cfg.latitude_deg))
    day = st.sim_days

    # --- solar geometry, from the orbital solution --------------------------
    decl, r_factor = orbital.solar_state(day % 365.2422, isl.orbit)
    hour_angle = orbital.hour_angle(day % 1.0)
    sun_elev, _ = orbital.sun_position(lat_rad, decl, hour_angle)

    # --- synoptic state -----------------------------------------------------
    state.synoptic = float(np.clip(_ou_step(
        state.synoptic, 0.0, TAU_SYNOPTIC_DAYS, dt_days, 0.9,
        float(s.normal(np.uint64(1)))), -2.5, 2.5))

    base_u, base_v = isl._trade_wind()
    base_speed = float(np.hypot(base_u, base_v))
    state.wind_speed_ms = float(np.clip(_ou_step(
        state.wind_speed_ms, base_speed * (1.0 + 0.22 * state.synoptic),
        TAU_WIND_DAYS, dt_days, 2.2, float(s.normal(np.uint64(2)))), 0.4, 34.0))
    state.wind_dir_rad = float(_ou_step(
        state.wind_dir_rad, float(km.atan2(base_u, base_v)),
        TAU_WIND_DAYS * 1.6, dt_days, 0.28, float(s.normal(np.uint64(3)))))

    # --- diurnal heating and the land-sea contrast --------------------------
    sst_k = isl.ocean.sst_k
    t_air_k = sst_k + 1.0
    if sun_elev > 0.0:
        tau = float(energy.clear_sky_transmission(sun_elev, 0.0))
        sw = (1361.0 * r_factor * tau * float(km.sin(sun_elev))
              * float(energy.cloud_transmission(state.trade_cloud)))
    else:
        sw = 0.0
    e_a = 0.75 * float(thermo.saturation_vapour_pressure(t_air_k))
    lw_down = float(energy.downward_longwave(t_air_k, e_a,
                                             max(state.trade_cloud, 0.05)))

    if bool(np.any(land)):
        lai = float(g.mean(isl.veg.total_lai(), land))
        albedo = float(g.mean(isl.veg.albedo(), land))
        moisture = float(np.clip(g.mean(isl._bio_env()["moisture_frac"], land), 0.0, 1.0))
        t_land = land_surface_temperature(sw, lw_down, t_air_k, albedo, lai,
                                          state.wind_speed_ms, moisture)
    else:
        t_land = sst_k

    state.t_land_mean_k = t_land
    state.land_sea_contrast_k = t_land - sst_k

    # --- the sea breeze, and the cloud it builds ----------------------------
    # Inflow driven by the pressure deficit over warm land; on an island the
    # inflow converges and has nowhere to go but up.  Blown apart by a strong
    # synoptic wind, which is why the cap cloud is a *calm-day* phenomenon.
    drive = max(state.land_sea_contrast_k, 0.0)
    # Scale by the island's own diameter, not by how much of the domain happens
    # to be land: a 10 km island makes a convergence cell whatever size box we
    # simulate it in.  (An earlier version divided by the domain land fraction,
    # which made the cloud a function of the grid.)
    land_area_km2 = float(np.sum(land)) * g.cell_area_m2 / 1e6
    diameter_km = 2.0 * float(km.sqrt(land_area_km2 / np.pi)) if land_area_km2 > 0 else 0.0
    size_factor = float(np.clip(diameter_km / BREEZE_SATURATION_KM, 0.0, 1.0))

    breeze = drive * size_factor
    # Strong synoptic flow ventilates the island and blows the cell apart, which
    # is why the cap cloud is a calm-day phenomenon.
    shear_penalty = 1.0 / (1.0 + (state.wind_speed_ms / 9.0) ** 2)
    humidity = float(np.clip(0.75 + 0.15 * state.synoptic, 0.20, 1.0))

    forcing = float(np.clip(breeze * shear_penalty * humidity / BREEZE_TO_CLOUD,
                            0.0, 1.0))
    tau_h = TAU_CLOUD_BUILD_H if forcing > state.convective_cloud else TAU_CLOUD_DECAY_H
    alpha = np.clip(dt_days * 24.0 / tau_h, 0.0, 1.0)
    state.convective_cloud = float(state.convective_cloud
                                   + (forcing - state.convective_cloud) * alpha)

    # --- background trade cloud ---------------------------------------------
    trade_target = float(np.clip(0.30 + 0.20 * state.synoptic, 0.02, 0.92))
    state.trade_cloud = float(np.clip(_ou_step(
        state.trade_cloud, trade_target, 1.2, dt_days, 0.11,
        float(s.normal(np.uint64(4)))), 0.0, 0.95))

    # Showers are not drawn from a die any more: they fall out of the cloud
    # field below, where and when it is loaded enough to rain.


    # Diurnal air-temperature range: large over dry land, small over wet forest
    # or open water.  This is the number an owner feels as "the island's climate".
    state.t_land_range_k = float(np.clip(state.land_sea_contrast_k * 1.4, 0.0, 22.0))

    _step_cloud_field(state, isl, s, dt_days, size_factor, humidity)
    return state


def _step_cloud_field(state: WeatherState, isl, s, dt_days: float,
                      size_factor: float, humidity: float) -> None:
    """Condensed water on the deck, as a field.

    Built rather than integrated.  Time-stepping an advected field here means a
    Courant number around twenty -- the air crosses a 20 km island in about
    forty minutes -- and semi-Lagrangian advection at that CFL is enormously
    diffusive: the first version of this smeared the sky into streaks and then
    accumulated source until the island vanished under a lid.

    So the field is composed from two pieces that are each exact:

    * **the airmass**, a cumulus texture sampled at an offset that scrolls at the
      wind, which is precisely "the cloud that was upwind a moment ago";
    * **the island's plume**, the orographic and sea-breeze source smeared
      *downwind* by a few taps with exponential decay -- the steady-state
      solution of advection with a sink, which is what a cap cloud's trailing
      plume actually is.

    Memory lives in ``convective_cloud``, which carries the build and decay lags
    and scales the breeze term, so a cloud still outlasts the heating that made
    it.
    """
    g = isl.grid
    state.ensure_fields(g, isl.cfg.seed)
    dt_s = dt_days * 86400.0
    st = isl.state
    land = st.z > st.sea_level

    u = state.wind_speed_ms * float(km.sin(state.wind_dir_rad))
    v = state.wind_speed_ms * float(km.cos(state.wind_dir_rad))

    # --- the airmass drifting through --------------------------------------
    dcx, dcy = state._drift_cells
    dcx += u * dt_s / g.cell_size_m
    dcy += v * dt_s / g.cell_size_m
    state._drift_cells = (dcx, dcy)

    jj, ii = np.meshgrid(np.arange(g.ny, dtype=np.float64),
                         np.arange(g.nx, dtype=np.float64), indexing="ij")
    tex = _sample(state._airmass_tex, ii - dcx, jj - dcy, wrap=True)
    cover = float(np.clip(0.26 + 0.18 * state.synoptic, 0.02, 0.85))
    lo, hi = state.airmass_thresholds(cover)
    # Soft step, not a ramp to the maximum: a cumulus is either there or it is
    # not, and only its edges are thin.  A linear ramp put almost all the cloud
    # near zero, so the covered *area* came out at a third of the coverage the
    # threshold was supposed to set.
    t = np.clip((tex - lo) / max(hi - lo, 1e-6) / 0.28, 0.0, 1.0)
    field = (t * t * (3.0 - 2.0 * t)) * 0.50

    # --- the island's own cloud, trailing downwind --------------------------
    pthr, pmax = state.orographic_thresholds(isl.annual_precip_mm)
    orographic = np.clip((isl.annual_precip_mm - pthr) / max(pmax - pthr, 1.0), 0.0, 1.0)
    elev = np.maximum(st.z - st.sea_level, 0.0)
    breeze = np.clip(elev / 300.0, 0.0, 1.0) * land.astype(np.float64)
    source = (orographic * humidity * 0.42
              + breeze * state.convective_cloud * 0.85) * max(size_factor, 0.15)

    speed = max(state.wind_speed_ms, 0.5)
    step_km = 1.6
    decay_km = 5.0
    dx = u / speed * (step_km * 1000.0) / g.cell_size_m
    dy = v / speed * (step_km * 1000.0) / g.cell_size_m
    plume = np.zeros_like(source)
    weight = 0.0
    for k in range(6):
        w = float(km.exp(-k * step_km / decay_km))
        plume += w * _sample(source, ii - k * dx, jj - k * dy)
        weight += w
    plume /= max(weight, 1e-6)

    field = np.clip(field + plume, 0.0, 1.3)
    state.cloud_water = field

    # --- rain ---------------------------------------------------------------
    # Only cloud loaded past the precipitation threshold rains, which is why
    # trade cumulus drift by dry and the island's own cloud does not.
    excess = np.maximum(field - 0.60, 0.0)
    state.precip_field_mm_h = excess * 55.0

    if bool(np.any(land)):
        state.precip_rate_mm_h = float(g.mean(state.precip_field_mm_h, land))
        state.squall = float(np.clip(np.max(state.precip_field_mm_h) / 25.0, 0.0, 1.0))

def total_cloud(state: WeatherState) -> float:
    """Sky cover, for the delta frame and the kinetic score.

    Read from the field when there is one, so the number and the picture can
    never disagree -- the fraction the frame reports is literally the mean of
    the array the renderer samples.
    """
    if state.cloud_water is not None:
        return float(np.clip(np.mean(np.clip(state.cloud_water / 0.50, 0.0, 1.0)),
                             0.0, 1.0))
    return float(np.clip(1.0 - (1.0 - state.trade_cloud) * (1.0 - state.convective_cloud),
                         0.0, 1.0))
