"""The render port: the artwork's primary surface (docs/09).

These are not pixel-comparison tests -- art direction will change.  They check
the properties that must hold for the image to be a *readout* of the simulation
rather than an illustration of one.
"""
import numpy as np
import pytest

from kernel.island import Island, IslandConfig
from kernel.ports import atlas, png
from kernel.ports.render import Renderer
from kernel.substrate.rng import seed_from_phrase

# Big enough to actually build an island.  An earlier version of this fixture
# produced four land cells, and every "does the image respond to X" test
# passed vacuously because the frame was empty sea.
SMALL = dict(nx=64, ny=64, cell_size_m=320.0, genesis_years=400000.0)


@pytest.fixture(scope="module")
def island():
    isl = Island(IslandConfig(seed=seed_from_phrase("render"), **SMALL))
    for _ in range(8):
        isl.step_year()
    assert int((isl.state.z > isl.state.sea_level).sum()) > 100, "fixture built no island"
    return isl


def _at_hour(isl, hour):
    isl.state.sim_days = float(int(isl.state.sim_days)) + hour / 24.0
    return isl


def test_png_round_trips_through_zlib():
    rgb = np.random.default_rng(0).integers(0, 256, (7, 11, 3), dtype=np.uint8)
    blob = png.encode(rgb)
    assert blob[:8] == b"\x89PNG\r\n\x1a\n"
    import struct
    import zlib
    w, h = struct.unpack(">II", blob[16:24])
    assert (w, h) == (11, 7)
    idat = blob[blob.index(b"IDAT") + 4:]
    raw = zlib.decompress(idat[:-8])
    back = np.frombuffer(raw, dtype=np.uint8).reshape(h, w * 3 + 1)[:, 1:]
    assert np.array_equal(back.reshape(h, w, 3), rgb)


def test_scene_renders_and_is_deterministic(island):
    _at_hour(island, 9.0)
    a = Renderer(island, width=120, height=80).render()
    b = Renderer(island, width=120, height=80).render()
    assert a.shape == (80, 120, 3)
    assert a.dtype == np.uint8
    assert np.array_equal(a, b), "the same state must draw the same image"


def test_night_is_dark_and_noon_is_not(island):
    noon = Renderer(_at_hour(island, 12.0), width=120, height=80).render()
    night = Renderer(_at_hour(island, 0.0), width=120, height=80).render()
    assert night.mean() < 0.45 * noon.mean(), (night.mean(), noon.mean())
    # Nights must be genuinely dark, not merely dim (docs/09 §3).
    assert night.mean() < 60


def test_sun_moves_the_shadows(island):
    """Two different times of day must produce materially different images --
    otherwise the light is not coming from the orbital solution."""
    morning = Renderer(_at_hour(island, 8.0), width=120, height=80).render().astype(int)
    evening = Renderer(_at_hour(island, 16.0), width=120, height=80).render().astype(int)
    # Measure where the island is.  Over the whole frame the difference is
    # diluted by sea and sky, which are near-symmetric about noon -- and a
    # whole-frame threshold would then be testing the sky, not the shadows.
    crop = (slice(30, 70), slice(35, 95))
    assert np.abs(morning[crop] - evening[crop]).mean() > 7.0


def test_land_is_greener_than_open_water(island):
    """A crude but load-bearing check: the vegetated island must not read as sea."""
    _at_hour(island, 11.0)
    r = Renderer(island, width=160, height=100)
    img = r.render().astype(float)
    # Centre of frame is the island; the top strip is open water and sky.
    centre = img[45:75, 55:105]
    greenness = centre[..., 1].mean() - centre[..., 2].mean()
    water = img[5:20, 10:50]
    assert greenness > water[..., 1].mean() - water[..., 2].mean()


def test_atlas_labels_every_field(island):
    img = atlas.build(island, cell_px=2)
    assert img.ndim == 3 and img.shape[2] == 3
    # Panels must actually contain data, not just background.
    assert img.std() > 12.0
    assert img.max() > 200          # text is drawn near-white


def test_atlas_is_deterministic(island):
    assert np.array_equal(atlas.build(island, cell_px=2), atlas.build(island, cell_px=2))


def test_renderer_never_touches_kernel_state(island):
    """A port may not influence the simulation (docs/02 §1)."""
    before_z = island.state.z.copy()
    before_tick = island.state.tick
    before_bio = island.veg.total_biomass().copy()
    Renderer(island, width=80, height=50).render()
    atlas.build(island, cell_px=1)
    assert np.array_equal(island.state.z, before_z)
    assert np.array_equal(island.veg.total_biomass(), before_bio)
    assert island.state.tick == before_tick
