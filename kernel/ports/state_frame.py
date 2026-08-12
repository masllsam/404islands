"""StateFrame construction, canonical serialisation, and hashing (docs/04).

Everything downstream of the kernel consumes this and only this: the display,
the servos, the certificate, and whatever renders these islands in 2140.  If the
format is right, the artwork outlives its implementation.

BLAKE2b-256 (RFC 7693) rather than a newer hash: it is specified in an RFC, it is
in the Python standard library, it is in every serious crypto library, and it is
overwhelmingly likely to still be implementable from its specification in two
hundred years.  Longevity beats fashion here.
"""

from __future__ import annotations

import hashlib
import struct
from dataclasses import asdict, dataclass, field

MAGIC = b"404I"
SF_VERSION = 1
KERNEL_SEMVER = (0, 2, 0)   # 0.2: fast clock, two new delta fields

# Fixed field order for the delta frame.  Append only, never reorder (docs/04 §6).
DELTA_FIELDS = (
    "sun_elevation_deg", "sun_azimuth_deg", "moon_phase", "moon_elevation_deg",
    "sky_luminance", "sky_colour_temp_k", "cloud_frac", "precip_rate_mm_h",
    "wind_speed_ms", "wind_dir_deg", "t_air_mean_c", "t_range_c",
    "sst_c", "sea_state", "tide_phase", "lake_stage_norm",
    "river_discharge_norm", "lens_health", "lai_mean", "canopy_greenness",
    "bloom_index", "senescence_index", "npp_norm", "fire_activity",
    "population_stress", "season_phase", "year_fraction", "island_age_years",
    "summit_elevation_m", "land_area_km2",
    # --- appended in kernel 0.2 (docs/04 §6: append only, never reorder) ---
    "convective_cloud", "squall",
)

EVENT_BITS = {
    "eruption": 0, "earthquake": 1, "cyclone": 2, "landslide": 3,
    "fire": 4, "bloom": 5, "speciation": 6, "extinction": 7,
    "colonisation": 8, "reef_stage_change": 9, "drought": 10, "flood": 11,
    "shower": 12,
}


def pack_events(names) -> int:
    flags = 0
    for n in names:
        if n in EVENT_BITS:
            flags |= 1 << EVENT_BITS[n]
    return flags


def unpack_events(flags: int) -> list[str]:
    return [n for n, b in EVENT_BITS.items() if flags & (1 << b)]


@dataclass
class DeltaFrame:
    """Small, fixed-layout, allocation-free.  Emitted every fast tick."""

    tick: int
    sim_time_s: float
    island_id: int
    values: dict[str, float] = field(default_factory=dict)
    event_flags: int = 0
    species_count: int = 0
    reef_stage: int = 0
    ledger_ok: bool = True
    residual_exponent: int = -18

    def canonical_bytes(self, genesis_seed: bytes, prev_hash: bytes) -> bytes:
        parts = [
            MAGIC,
            struct.pack("<H", SF_VERSION),
            bytes(KERNEL_SEMVER),
            struct.pack("<H", self.island_id),
            genesis_seed,
            struct.pack("<Q", self.tick),
            struct.pack("<d", self.sim_time_s),
            struct.pack("<B", 0),          # frame_kind = delta
            prev_hash,
        ]
        # Fixed order; missing fields serialise as 0.0 so layout never shifts.
        for name in DELTA_FIELDS:
            parts.append(struct.pack("<d", float(self.values.get(name, 0.0))))
        parts.append(struct.pack("<IHBBb", self.event_flags, self.species_count,
                                 self.reef_stage, 1 if self.ledger_ok else 0,
                                 self.residual_exponent))
        return b"".join(parts)

    def frame_hash(self, genesis_seed: bytes, prev_hash: bytes) -> bytes:
        return hashlib.blake2b(self.canonical_bytes(genesis_seed, prev_hash),
                               digest_size=32).digest()

    def as_dict(self) -> dict:
        d = dict(self.values)
        d.update({
            "tick": self.tick,
            "sim_time_s": self.sim_time_s,
            "events": unpack_events(self.event_flags),
            "species_count": self.species_count,
            "reef_stage": self.reef_stage,
            "ledger_ok": self.ledger_ok,
            "residual_exponent": self.residual_exponent,
        })
        return d


@dataclass
class FullFrame:
    """Complete state: enough to restart the island from nothing but this."""

    tick: int
    sim_time_s: float
    island_id: int
    genesis_seed: bytes
    fields: dict
    scalars: dict
    chronicle: list

    def canonical_bytes(self, prev_hash: bytes) -> bytes:
        import numpy as np

        parts = [
            MAGIC, struct.pack("<H", SF_VERSION), bytes(KERNEL_SEMVER),
            struct.pack("<H", self.island_id), self.genesis_seed,
            struct.pack("<Q", self.tick), struct.pack("<d", self.sim_time_s),
            struct.pack("<B", 1), prev_hash,
        ]
        # Sorted keys: dict insertion order is an implementation detail, and this
        # must be reproducible by a reader that never saw our code (docs/02 §D5).
        for key in sorted(self.fields):
            arr = np.ascontiguousarray(self.fields[key], dtype=np.float64)
            parts.append(key.encode("utf-8"))
            parts.append(struct.pack("<II", *arr.shape[:2]) if arr.ndim >= 2
                         else struct.pack("<II", arr.size, 1))
            parts.append(arr.astype("<f8").tobytes(order="C"))
        for key in sorted(self.scalars):
            parts.append(key.encode("utf-8"))
            parts.append(struct.pack("<d", float(self.scalars[key])))
        return b"".join(parts)

    def frame_hash(self, prev_hash: bytes) -> bytes:
        return hashlib.blake2b(self.canonical_bytes(prev_hash),
                               digest_size=32).digest()


class ChainHasher:
    """Running hash over the island's history.

    This is what the provenance port publishes quarterly, and what an auditor
    recomputes from the seed to prove a piece is what its certificate says.
    """

    def __init__(self):
        self.prev_delta = b"\x00" * 32
        self.prev_full = b"\x00" * 32
        self.chain = b"\x00" * 32
        self.n_delta = 0
        self.n_full = 0

    def add_delta(self, frame: DeltaFrame, genesis_seed: bytes) -> bytes:
        h = frame.frame_hash(genesis_seed, self.prev_delta)
        self.prev_delta = h
        self.n_delta += 1
        return h

    def add_full(self, frame: FullFrame) -> bytes:
        h = frame.frame_hash(self.prev_full)
        self.prev_full = h
        self.chain = hashlib.blake2b(self.chain + h, digest_size=32).digest()
        self.n_full += 1
        return h

    def root_hex(self) -> str:
        return self.chain.hex()
