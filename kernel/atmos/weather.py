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
    history: list[float] = field(default_factory=list)


def _ou_step(value: float, target: float, tau_days: float, dt_days: float,
             sigma: float, draw: float) -> float:
    """One Ornstein-Uhlenbeck increment: mean-reverting, correctly scaled.

    The sqrt(dt) on the noise is what makes the process independent of the
    timestep; getting it wrong makes the weather's variability a function of how
    finely you happen to be integrating.
    """
    a = dt_days / max(tau_days, 1e-6)
    return value + (target - value) * a + sigma * float(km.sqrt(a)) * draw


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

    # --- showers -------------------------------------------------------------
    # A shower needs cloud and moisture together; deep convective cloud rains
    # hard and briefly, which is why island afternoons are wet and island
    # mornings are not.
    shower_rate = 0.55 * state.convective_cloud ** 2 + 0.12 * max(state.synoptic, 0.0)
    if bool(s.poisson_event(np.uint64(5), np.clip(shower_rate * dt_days * 24.0, 0.0, 0.9))):
        state.squall = 1.0
    state.squall = float(state.squall * float(km.exp(-dt_days * 24.0 / 0.8)))

    climatological_mm_yr = float(g.mean(isl.annual_precip_mm, land)) if np.any(land) \
        else float(isl.annual_precip_mm.mean())
    mean_rate = climatological_mm_yr / 8766.0
    state.precip_rate_mm_h = float(
        mean_rate * (0.25 + 1.6 * state.trade_cloud)
        + 9.0 * state.squall * state.convective_cloud)

    # Diurnal air-temperature range: large over dry land, small over wet forest
    # or open water.  This is the number an owner feels as "the island's climate".
    state.t_land_range_k = float(np.clip(state.land_sea_contrast_k * 1.4, 0.0, 22.0))
    return state


def total_cloud(state: WeatherState) -> float:
    """Combined cover for the display and the kinetic score.

    Overlap, not a sum: two decks covering half the sky each do not cover it all.
    """
    return float(np.clip(1.0 - (1.0 - state.trade_cloud) * (1.0 - state.convective_cloud),
                         0.0, 1.0))
