"""The port boundary: StateFrames must be canonical, and scores must be safe."""
import numpy as np
import pytest

from kernel.island import Island, IslandConfig
from kernel.ports.kinetic import Envelope, KineticScore, encode_wire
from kernel.ports.state_frame import DELTA_FIELDS, DeltaFrame, pack_events, unpack_events
from kernel.substrate.rng import seed_from_phrase

SMALL = dict(nx=32, ny=32, cell_size_m=400.0, genesis_years=20000.0)


@pytest.fixture(scope="module")
def island():
    isl = Island(IslandConfig(seed=seed_from_phrase("ports"), **SMALL))
    isl.step_year()
    return isl


def test_delta_frame_is_canonical_and_fixed_size(island):
    a = island.delta_frame()
    b = island.delta_frame()
    seed = island.cfg.seed
    assert a.canonical_bytes(seed, b"\x00" * 32) == b.canonical_bytes(seed, b"\x00" * 32)
    # Fixed layout: a missing field must serialise as 0.0, not shift the record.
    sparse = DeltaFrame(tick=0, sim_time_s=0.0, island_id=1, values={})
    full = DeltaFrame(tick=0, sim_time_s=0.0, island_id=1,
                      values={k: 1.0 for k in DELTA_FIELDS})
    assert len(sparse.canonical_bytes(seed, b"\x00" * 32)) == \
        len(full.canonical_bytes(seed, b"\x00" * 32))


def test_frame_hash_chain_is_order_dependent(island):
    seed = island.cfg.seed
    f = island.delta_frame()
    assert f.frame_hash(seed, b"\x00" * 32) != f.frame_hash(seed, b"\x01" * 32)


def test_appending_a_field_does_not_move_the_others():
    """The append-only rule is what lets a 2140 reader parse a frame written now
    (docs/04 §6).  A field added at the end must leave every earlier field at the
    same byte offset."""
    import struct
    from kernel.ports import state_frame as sf

    values = {name: float(i + 1) for i, name in enumerate(sf.DELTA_FIELDS)}
    frame = DeltaFrame(tick=1, sim_time_s=2.0, island_id=3, values=values)
    blob = frame.canonical_bytes(b"\x11" * 32, b"\x22" * 32)

    header = 4 + 2 + 3 + 2 + 32 + 8 + 8 + 1 + 32
    for i, name in enumerate(sf.DELTA_FIELDS):
        got, = struct.unpack_from("<d", blob, header + 8 * i)
        assert got == values[name], f"{name} moved to a different offset"

    # An older reader that knows only the first 30 fields still gets them right.
    legacy = sf.DELTA_FIELDS[:30]
    for i, name in enumerate(legacy):
        got, = struct.unpack_from("<d", blob, header + 8 * i)
        assert got == values[name]


def test_event_flags_round_trip():
    names = ["speciation", "eruption", "fire"]
    assert sorted(unpack_events(pack_events(names))) == sorted(names)
    assert pack_events(["not-a-real-event"]) == 0


def test_full_frame_ignores_dict_insertion_order(island):
    """A reader that never saw our code must be able to reproduce the bytes."""
    f1 = island.full_frame()
    fields = dict(reversed(list(f1.fields.items())))
    scalars = dict(reversed(list(f1.scalars.items())))
    f2 = type(f1)(tick=f1.tick, sim_time_s=f1.sim_time_s, island_id=f1.island_id,
                  genesis_seed=f1.genesis_seed, fields=fields, scalars=scalars,
                  chronicle=f1.chronicle)
    assert f1.canonical_bytes(b"\x00" * 32) == f2.canonical_bytes(b"\x00" * 32)


# ------------------------------------------------------------------- the score

def test_score_loads_and_renders(island):
    score = KineticScore.load("hardware/scores/vitrine-01.toml")
    values = score.render(island.delta_frame().as_dict(), dt=1.0, capability="C")
    assert values
    assert all(0.0 <= v <= 1.0 for v in values.values())


def test_priority_degradation_keeps_light():
    """With reduced capability the piece must still be beautiful and truthful."""
    score = KineticScore.load("hardware/scores/vitrine-01.toml")
    frame = {k: 0.5 for k in DELTA_FIELDS}
    frame["events"] = []
    a = set(score.render(frame, 1.0, capability="A"))
    c = set(score.render(frame, 1.0, capability="C"))
    assert a < c
    assert "sun.intensity" in a and "sun.elevation" in a


def test_envelope_respects_slew_limit():
    """Nothing may move faster than nature (docs/05 §2)."""
    e = Envelope(max_rate=0.1, max_accel=0.05, soft_min=0.0, soft_max=1.0)
    for _ in range(5):
        prev = e.value
        v = e.update(1.0, dt=1.0)
        assert v - prev <= 0.1 + 1e-9
    assert e.value < 1.0


def test_envelope_deadband_prevents_dither():
    e = Envelope(max_rate=1.0, max_accel=1.0, deadband=0.05)
    e.update(0.5, dt=1.0)
    settled = e.value
    for _ in range(20):
        e.update(settled + 0.01, dt=1.0)
    assert e.value == settled


def test_envelope_rest_pose_on_watchdog():
    """A dead Heart must leave the piece looking asleep, not broken."""
    e = Envelope(max_rate=1.0, max_accel=1.0)
    e.update(0.9, dt=1.0)
    for _ in range(120):
        e.rest(dt=1.0)
    assert e.value < 0.02


def test_wire_protocol_is_fixed_point_with_crc():
    payload = encode_wire({"a": 0.5, "b": 0.25}, {"a": 1, "b": 2}, seq=7)
    assert payload[:2] == b"KS"
    assert len(payload) == 8 + 2 * 6 + 4
    # Same values, different insertion order -> identical bytes.
    assert payload == encode_wire({"b": 0.25, "a": 0.5}, {"a": 1, "b": 2}, seq=7)
