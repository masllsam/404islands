"""Determinism is the promise the certificate makes (docs/02 §3).

An island must be recomputable, bit for bit, from its seed alone -- today, and in
2140 from the engraved plate and the printed specification.  These tests are the
only thing standing between that promise and a hard-to-detect lie.
"""
import numpy as np
import pytest

from kernel.island import Island, IslandConfig
from kernel.substrate.rng import Stream, seed_from_phrase

SMALL = dict(nx=32, ny=32, cell_size_m=400.0, genesis_years=20000.0)


def run(phrase="replay", years=3, **kw):
    cfg = IslandConfig(seed=seed_from_phrase(phrase), **{**SMALL, **kw})
    isl = Island(cfg)
    hashes = []
    for _ in range(years):
        isl.step_year()
        hashes.append(isl.delta_frame().frame_hash(cfg.seed, b"\x00" * 32).hex())
    return isl, hashes


def test_same_seed_same_history():
    _, a = run()
    _, b = run()
    assert a == b, "identical seeds produced divergent histories"


def test_different_seed_diverges():
    _, a = run("replay")
    _, b = run("replay-2")
    assert a != b


def test_full_frame_hash_stable():
    i1, _ = run()
    i2, _ = run()
    assert i1.full_frame().frame_hash(b"\x00" * 32) == i2.full_frame().frame_hash(b"\x00" * 32)
    assert i1.hasher.root_hex() == i2.hasher.root_hex()


def test_terrain_identical_to_the_bit():
    i1, _ = run()
    i2, _ = run()
    assert np.array_equal(i1.state.z, i2.state.z)
    assert np.array_equal(i1.veg.total_biomass(), i2.veg.total_biomass())


def test_rng_streams_are_independent():
    """Adding a draw in one module must not shift another module's numbers.

    This is the property that lets several agents develop modules in parallel
    without silently rewriting every island's history (docs/02 §D4).
    """
    seed = seed_from_phrase("streams")
    geo = Stream(seed, "geo", 100, stream=0)
    bio = Stream(seed, "bio", 100, stream=0)
    idx = np.arange(64, dtype=np.uint64)
    assert not np.allclose(geo.uniform(idx), bio.uniform(idx))
    # Addressable: the 7th draw is the 7th draw whether or not you took the first six.
    assert geo.uniform(np.uint64(7)) == Stream(seed, "geo", 100, stream=0).uniform(np.uint64(7))


def test_rng_is_uniform_and_normal():
    s = Stream(seed_from_phrase("stats"), "bio", 0, stream=1)
    u = s.uniform(np.arange(200000, dtype=np.uint64))
    assert 0.0 <= u.min() and u.max() < 1.0
    assert abs(float(u.mean()) - 0.5) < 0.005
    n = s.normal(np.arange(200000, dtype=np.uint64))
    assert abs(float(n.mean())) < 0.01
    assert abs(float(n.std()) - 1.0) < 0.02


def test_no_hash_based_indexing():
    """Python randomises str hashes per process; a kernel that indexes by hash()
    replays differently every run."""
    import ast
    import pathlib
    bad = []
    for path in pathlib.Path("kernel").rglob("*.py"):
        # Parse rather than grep: the warning against hash() appears in comments
        # and docstrings, and a text search would flag its own documentation.
        for node in ast.walk(ast.parse(path.read_text())):
            if (isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                    and node.func.id == "hash"):
                bad.append(f"{path}:{node.lineno}")
    assert not bad, "hash() used in kernel: " + ", ".join(bad)


def test_ledger_closes_under_strict_mode():
    cfg = IslandConfig(seed=seed_from_phrase("strict"), strict_ledger=True, **SMALL)
    isl = Island(cfg)
    for _ in range(3):
        isl.step_year()          # raises if any budget residual exceeds tolerance
    assert isl.ledger.ok()
    assert not isl.ledger.anomalies
