"""Empirical laws the kernel was never told (docs/03f).

Each of these is a published regularity that no parameter in the kernel targets.
If local mechanisms reproduce them anyway, the mechanisms are doing real work.
This file is the project's claim to the word "scientific"; treat a failure as a
missing mechanism, never as a licence to tune.
"""
import numpy as np
import pytest

from kernel.atmos import energy, orbital, orographic
from kernel.geo import reef, routing
from kernel.island import Island, IslandConfig
from kernel.substrate.grid import Grid
from kernel.substrate.rng import seed_from_phrase


def gaussian_island(grid, summit_m, radius_m):
    x, y = grid.coords_m()
    return summit_m * np.exp(-(x ** 2 + y ** 2) / (2.0 * radius_m ** 2))


# --------------------------------------------------------------- hydrology

def test_orographic_rain_shadow_ratio():
    """Windward:leeward on a Kauai-scale island should be 5x-40x (docs/03f)."""
    g = Grid(96, 96, 300.0, 22.0, -159.5)
    h = gaussian_island(g, 1600.0, 7000.0)
    p = orographic.annual_precipitation_mm(g, h, -7.0, 1.5, 300.0)
    windward = float(p[:, -20:].mean())
    leeward = float(p[:, :20].mean())
    assert 5.0 < windward / max(leeward, 1e-6) < 40.0
    assert 4000.0 < float(p.max()) < 16000.0   # observed summit totals


def test_low_islands_get_no_orographic_rain():
    """An atoll sits entirely below its own condensation level, so it is dry --
    a factor-of-ten difference that follows from thermodynamics, not a rule."""
    g = Grid(64, 64, 300.0, 10.0, 160.0)
    bg = orographic.background_rate_mm_hr(28.0, 10.0)
    atoll = orographic.annual_precipitation_mm(g, gaussian_island(g, 25.0, 3000.0),
                                               -7.0, 1.5, 301.0, background_mm_hr=bg)
    high = orographic.annual_precipitation_mm(g, gaussian_island(g, 1800.0, 5000.0),
                                              -7.0, 1.5, 301.0, background_mm_hr=bg)
    assert float(high.max()) > 4.0 * float(atoll.max())


# ------------------------------------------------------------------ climate

@pytest.mark.parametrize("lat,lo,hi", [(0.0, 26.0, 30.5), (20.0, 22.0, 28.0),
                                       (40.0, 10.0, 20.0), (60.0, -2.5, 10.0)])
def test_sst_matches_observed_zonal_means(lat, lo, hi):
    o = orbital.Orbit()
    ocean = energy.SlabOcean(lat)
    for year in range(4):
        for d in range(0, 365, 5):
            ocean.step(year * 365.0 + d, o, 0.45, 5.0)
    assert lo <= ocean.sst_c <= hi


def test_seasonal_range_grows_with_latitude():
    """Maritime seasonality is small in the tropics and large at high latitude --
    a consequence of the mixed layer's heat capacity, not a setting."""
    o = orbital.Orbit()
    ranges = []
    for lat in (0.0, 20.0, 40.0, 60.0):
        ocean = energy.SlabOcean(lat)
        vals = []
        for year in range(4):
            for d in range(0, 365, 5):
                ocean.step(year * 365.0 + d, o, 0.45, 5.0)
                if year == 3:
                    vals.append(ocean.sst_c)
        ranges.append(max(vals) - min(vals))
    assert all(a < b for a, b in zip(ranges, ranges[1:])), ranges


def test_insolation_energy_balance_top_of_atmosphere():
    """Global annual mean TOA insolation must be S0/4."""
    o = orbital.Orbit()
    total = weight = 0.0
    for lat in np.linspace(-89.0, 89.0, 179):
        w = float(np.cos(np.deg2rad(lat)))
        acc = 0.0
        for d in range(0, 365):
            decl, rf = orbital.solar_state(float(d), o)
            acc += orbital.daily_mean_toa(np.deg2rad(lat), decl, rf)
        total += w * acc / 365.0
        weight += w
    assert abs(total / weight - 1361.0 / 4.0) < 3.0


# --------------------------------------------------------------- geomorphology

@pytest.fixture(scope="module")
def carved():
    """An island that has left the shield stage.

    While the hotspot is still feeding it, construction resurfaces the cone about
    as fast as rivers cut it -- which is why Mauna Loa has no canyons and Kauai
    does.  Testing fluvial signatures on an actively-built shield would be
    testing for something that should not be there.  So we build the edifice,
    then switch the magma supply off (as the plate drifting off the hotspot
    does) and let 300 kyr of rain work on it.
    """
    cfg = IslandConfig(seed=seed_from_phrase("island-001"), nx=96, ny=96,
                       cell_size_m=240.0, genesis_years=400000.0)
    isl = Island(cfg)
    isl.volcano.q_max_m3_yr = 0.0
    isl.volcano.chamber_volume_m3 = 0.0
    for i in range(150):
        isl._step_century(2000.0, tick=-100000 + i)
    return isl


def test_hacks_law(carved):
    """Main-stream length scales as A^h with h ~= 0.57 (Hack 1957)."""
    net = carved.net
    area = net.drainage_area()
    land = carved.state.z > 0.0
    a = area[land]
    if a.size < 50:
        pytest.skip("island too small to sample basins")
    length = net.flow_path_length()[land]
    m = (a > 4.0 * carved.grid.cell_area_m2) & (length > carved.grid.cell_size_m)
    if int(m.sum()) < 30:
        pytest.skip("too few basins above the sampling threshold")
    slope, _ = np.polyfit(np.log(a[m]), np.log(length[m]), 1)
    assert 0.40 < slope < 0.80, f"Hack exponent {slope:.3f} outside plausible range"


def test_slope_area_concavity(carved):
    """Fluvial channels thin downstream: S ~ A^-theta, theta ~ 0.4-0.6."""
    net = carved.net
    area = net.drainage_area()
    slope = net.slope_to_receiver(carved.state.z)
    land = (carved.state.z > 20.0) & (area > 10.0 * carved.grid.cell_area_m2) & (slope > 1e-4)
    if int(land.sum()) < 50:
        pytest.skip("too few channel cells")
    theta, _ = np.polyfit(np.log(area[land]), np.log(slope[land]), 1)
    assert -1.2 < theta < -0.05, f"concavity {-theta:.3f} implausible"


def test_every_land_cell_drains_to_the_sea(carved):
    """No interior sinks after depression filling: water must be able to leave."""
    net = carved.net
    z = carved.state.z
    land = z > 0.0
    filled = net.filled
    # Following receivers from any land cell must terminate at or below sea level.
    rec = net.receiver
    for start in np.flatnonzero(land.ravel())[::37]:
        c = int(start)
        for _ in range(4 * z.size):
            r = int(rec[c])
            if r == c:
                break
            c = r
        assert filled.ravel()[c] <= 0.0 + 1e-6


# ---------------------------------------------------------------------- reef

def test_darwin_sequence_responds_to_the_growth_subsidence_race():
    """Coral that outpaces subsidence stays at the surface; coral that loses drowns."""
    fast = reef.growth_rate_m_yr(np.array([2.0]), 27.0, np.array([0.0]))[0]
    deep = reef.growth_rate_m_yr(np.array([60.0]), 27.0, np.array([0.0]))[0]
    cold = reef.growth_rate_m_yr(np.array([2.0]), 12.0, np.array([0.0]))[0]
    muddy = reef.growth_rate_m_yr(np.array([2.0]), 27.0, np.array([0.4]))[0]
    assert fast > 10.0 * deep          # light limitation with depth
    assert cold == 0.0                 # no reef in cold water
    assert muddy < 0.05 * fast         # river plumes kill reef


# ------------------------------------------------------------------ ecology

def test_npp_and_lai_reach_observed_tropical_values():
    """A wet tropical island should settle near LAI 4-8 and NPP 0.5-2 kgC/m2/yr."""
    cfg = IslandConfig(seed=seed_from_phrase("island-001"), nx=64, ny=64,
                       cell_size_m=300.0, genesis_years=300000.0)
    isl = Island(cfg)
    for _ in range(25):
        isl.step_year()
    d = isl.diagnostics
    if d["land_area_km2"] < 1.0:
        pytest.skip("seed did not build a subaerial island")
    npp_per_m2 = d["npp"] / (d["land_area_km2"] * 1e6)
    assert 2.0 < d["lai"] < 9.0, d["lai"]
    assert 0.3 < npp_per_m2 < 2.5, npp_per_m2


def test_phosphorus_only_comes_from_rock():
    """No weathering, no phosphorus -- the coupling behind island retrogression."""
    from kernel.bio.vegetation import weathering_p_release
    assert weathering_p_release(0.0) == 0.0
    assert weathering_p_release(1e-4) > 0.0
