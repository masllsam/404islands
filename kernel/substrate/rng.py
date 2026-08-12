"""Counter-based deterministic randomness (docs/02 §D4).

There is no global RNG state anywhere in this kernel.  Every draw is a pure hash
of an explicit coordinate:

    (genesis_seed, module, tick, stream, index)  ->  bits

This buys three things that a stateful generator cannot:

1. Adding a new random call site in the biosphere cannot shift the geosphere's
   numbers.  Streams are independent by construction, so modules can be developed
   in parallel without stepping on each other's history.
2. Any draw can be recomputed out of order, years later, without replaying.
3. Parallel and vectorised evaluation give identical results to serial.

The mixer is SplitMix64 (Steele, Lea & Flood 2014) -- small, well-tested,
passes BigCrush, and short enough to reimplement correctly from this file alone
in any language, in any century.
"""

from __future__ import annotations

import hashlib

import numpy as np

_M64 = np.uint64(0xFFFFFFFFFFFFFFFF)
_GOLDEN = np.uint64(0x9E3779B97F4A7C15)
_MIX1 = np.uint64(0xBF58476D1CE4E5B9)
_MIX2 = np.uint64(0x94D049BB133111EB)

# Module identifiers.  Append only; never renumber -- these are part of every
# island's history.
MODULE = {
    "genesis": 1,
    "geo": 2,
    "atmos": 3,
    "hydro": 4,
    "bio": 5,
    "evo": 6,
    "disturbance": 7,
    "dispersal": 8,
}


def _splitmix64(x: np.ndarray) -> np.ndarray:
    with np.errstate(over="ignore"):
        z = (x + _GOLDEN) & _M64
        z = ((z ^ (z >> np.uint64(30))) * _MIX1) & _M64
        z = ((z ^ (z >> np.uint64(27))) * _MIX2) & _M64
        return z ^ (z >> np.uint64(31))


def seed_from_phrase(phrase: str) -> bytes:
    """Derive a 32-byte genesis seed from text.  Studio use only.

    Production seeds come from a hardware entropy source and are committed by
    hash before the piece is built (docs/07 §3).
    """
    return hashlib.blake2b(phrase.encode("utf-8"), digest_size=32).digest()


class Stream:
    """One independent random stream, addressed rather than advanced."""

    __slots__ = ("_key",)

    def __init__(self, seed: bytes, module: str, tick: int, stream: int = 0):
        if module not in MODULE:
            raise KeyError(f"unknown module {module!r}; register it in rng.MODULE")
        # Fold the 256-bit seed into a 64-bit key together with the coordinate.
        # blake2b keeps this deterministic and specified (RFC 7693) rather than
        # depending on any language's hash().
        material = (
            seed
            + MODULE[module].to_bytes(2, "little")
            # Signed: genesis spin-up runs on negative ticks, before ignition.
            + int(tick).to_bytes(8, "little", signed=True)
            + int(stream).to_bytes(4, "little", signed=False)
        )
        digest = hashlib.blake2b(material, digest_size=8).digest()
        self._key = np.uint64(int.from_bytes(digest, "little"))

    def bits(self, index) -> np.ndarray:
        """Raw uint64 for the given index or index array."""
        idx = np.asarray(index, dtype=np.uint64)
        with np.errstate(over="ignore"):
            return _splitmix64(self._key ^ _splitmix64(idx))

    def uniform(self, index) -> np.ndarray:
        """Uniform on [0, 1).  53-bit mantissa, exactly as the IEEE format allows."""
        return (self.bits(index) >> np.uint64(11)).astype(np.float64) * (1.0 / 9007199254740992.0)

    def normal(self, index) -> np.ndarray:
        """Standard normal via Box-Muller.

        Box-Muller rather than ziggurat: no tables, no rejection loop, so the
        number of random words consumed per draw is fixed and the result does not
        depend on control flow.  Determinism beats speed here.
        """
        idx = np.asarray(index, dtype=np.uint64)
        u1 = np.maximum(self.uniform(idx * np.uint64(2)), 1e-300)
        u2 = self.uniform(idx * np.uint64(2) + np.uint64(1))
        from . import kmath as km

        return km.sqrt(-2.0 * km.log(u1)) * km.cos(2.0 * np.pi * u2)

    def exponential(self, index, rate: float = 1.0) -> np.ndarray:
        from . import kmath as km

        u = np.maximum(self.uniform(index), 1e-300)
        return -km.log(u) / rate

    def poisson_event(self, index, rate_per_step: float) -> np.ndarray:
        """Bernoulli approximation to a Poisson process over one step.

        Valid while rate_per_step << 1, which we assert at the call sites for
        rare events (eruptions, colonisations, cyclones).
        """
        from . import kmath as km

        p = 1.0 - km.exp(-rate_per_step)
        return self.uniform(index) < p

    def choice_index(self, index, weights: np.ndarray) -> int:
        """Weighted pick over a 1-D weight array.  Deterministic tie-breaking by
        position: the cumulative sum is taken in fixed ascending order."""
        total = float(np.sum(weights))
        if total <= 0.0:
            return 0
        u = float(self.uniform(index)) * total
        return int(np.searchsorted(np.cumsum(weights), u, side="right"))
