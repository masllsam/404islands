"""kmath must be accurate AND identical everywhere.  Accuracy is checked here;
cross-platform identity is checked by tests/determinism (docs/02 §D2)."""
import math

import numpy as np
import pytest

from kernel.substrate import kmath as km


@pytest.mark.parametrize("fn,ref,lo,hi,tol", [
    ("exp", np.exp, -700.0, 700.0, 1e-15),
    ("sin", np.sin, -1000.0, 1000.0, 1e-14),
    ("cos", np.cos, -1000.0, 1000.0, 1e-14),
    ("tanh", np.tanh, -20.0, 20.0, 1e-15),
    ("expm1", np.expm1, -5.0, 5.0, 1e-13),
    ("asin", np.arcsin, -1.0, 1.0, 1e-14),
    ("acos", np.arccos, -1.0, 1.0, 1e-14),
])
def test_accuracy(fn, ref, lo, hi, tol):
    x = np.linspace(lo, hi, 20001)
    got, want = getattr(km, fn)(x), ref(x)
    scale = np.maximum(np.abs(want), 1.0)
    assert np.max(np.abs(got - want) / scale) < tol


def test_log_relative():
    x = np.exp(np.linspace(-690, 690, 20001))
    got, want = km.log(x), np.log(x)
    assert np.max(np.abs((got - want) / np.maximum(np.abs(want), 1.0))) < 1e-15


def test_atan2_all_quadrants():
    a = np.linspace(-50, 50, 601)
    y, x = np.meshgrid(a, a, indexing="ij")
    assert np.max(np.abs(km.atan2(y, x) - np.arctan2(y, x))) < 1e-14


def test_exp_saturates_rather_than_raising():
    assert km.exp(np.array([-1e4]))[0] == 0.0
    assert np.isinf(km.exp(np.array([1e4]))[0])


# Rendering ports are outside the determinism contract by design (docs/02 §8):
# they consume StateFrames and produce pixels, and cannot influence a frame, a
# hash, or an island's history.  Everything that *can* -- the kernel modules, the
# substrate, the state frame, the kinetic score -- is still guarded.
_LIBM_EXEMPT = {"kmath.py", "render.py", "atlas.py", "ascii_render.py"}


def test_no_libm_in_hot_path():
    """Nothing that can affect an island's history may call platform libm."""
    import pathlib
    import re
    banned = re.compile(r"\bnp\.(exp|log|log1p|expm1|sin|cos|tan|arcsin|arccos|arctan2|power)\b")
    offenders = []
    for path in pathlib.Path("kernel").rglob("*.py"):
        if path.name in _LIBM_EXEMPT:
            continue
        for n, line in enumerate(path.read_text().splitlines(), 1):
            if banned.search(line) and "noqa: libm" not in line:
                offenders.append(f"{path}:{n}: {line.strip()}")
    assert not offenders, "platform transcendentals in kernel path:\n" + "\n".join(offenders)
