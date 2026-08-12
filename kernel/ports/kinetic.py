"""Kinetic Score evaluation: StateFrame -> channel values -> motion envelope.

Art direction as data (docs/05).  The score is separate from the physics, so one
island can drive a wall-mounted frame, a table vitrine, a future all-mechanical
instantiation, or a gallery installation without the kernel ever knowing.

The Motion Envelope below is the reason the piece will look alive rather than
mechanical.  Nothing on this object is allowed to move at a speed a viewer can
read as "a servo seeking".  If you can see it seek, it is broken.
"""

from __future__ import annotations

import tomllib
from dataclasses import dataclass, field
from pathlib import Path

from ..substrate import kmath as km

# --- transfer function library -------------------------------------------
# Fixed and versioned.  Arbitrary expressions are forbidden: a score must be
# auditable, and must not be able to hide logic that contradicts the physics.


def _clamp01(x: float) -> float:
    return 0.0 if x < 0.0 else (1.0 if x > 1.0 else x)


def t_linear(x, lo, hi):
    return _clamp01((x - lo) / (hi - lo)) if hi != lo else 0.0


def t_perceptual_l(x, lo, hi):
    """CIE L* lightness.  Linear PWM on an LED looks wrong to the eye; this is
    what makes a simulated dusk read as a dusk."""
    y = t_linear(x, lo, hi)
    return (y * 24389.0 / 27.0) / 100.0 if y <= 216.0 / 24389.0 else (
        float(km.pow(y, 1.0 / 3.0)) * 1.16 - 0.16)


def t_gamma(x, lo, hi, gamma=2.2):
    return float(km.pow(t_linear(x, lo, hi), gamma))


def t_smoothstep(x, lo, hi):
    y = t_linear(x, lo, hi)
    return y * y * (3.0 - 2.0 * y)


def t_log10(x, lo, hi):
    import math
    v = max(x, 1e-9)
    return t_linear(math.log10(v), math.log10(max(lo, 1e-9)), math.log10(max(hi, 1e-9)))


def t_linear_wrap(x, lo, hi):
    span = hi - lo
    return ((x - lo) % span) / span if span else 0.0


TRANSFERS = {
    "linear": t_linear,
    "perceptual_L": t_perceptual_l,
    "gamma": t_gamma,
    "smoothstep": t_smoothstep,
    "log10": t_log10,
    "linear_wrap": t_linear_wrap,
}


@dataclass
class Envelope:
    """Deadband -> slew limit -> S-curve -> soft limits -> duty guard.

    Implemented below the score, in firmware, and NOT score-configurable beyond
    the declared per-channel limits.  Art direction cannot override safety.
    """

    max_rate: float = 1.0          # units per second
    max_accel: float = 0.5         # units per second squared
    deadband: float = 0.0
    soft_min: float = 0.0
    soft_max: float = 1.0
    value: float = 0.0
    velocity: float = 0.0
    duty: float = 0.0

    def update(self, target: float, dt: float) -> float:
        target = min(max(target, self.soft_min), self.soft_max)
        error = target - self.value
        if abs(error) < self.deadband:
            # Sit still rather than dither.  Dither is audible and it wears gears.
            self.velocity *= 0.5
            self.duty = max(self.duty - dt * 0.1, 0.0)
            return self.value

        desired_v = max(min(error / max(dt, 1e-6), self.max_rate), -self.max_rate)
        dv = max(min(desired_v - self.velocity, self.max_accel * dt), -self.max_accel * dt)
        self.velocity += dv
        self.value += self.velocity * dt
        self.value = min(max(self.value, self.soft_min), self.soft_max)
        self.duty = min(self.duty + dt * abs(self.velocity) / max(self.max_rate, 1e-9), 60.0)
        return self.value

    def rest(self, dt: float, rest_value: float = 0.0) -> float:
        """Ease to the rest pose over ~30 s when frames stop arriving.

        A dead Heart must never leave the piece straining or in an ugly attitude.
        It should look asleep, not broken.
        """
        self.velocity = 0.0
        step = (rest_value - self.value) * min(dt / 30.0, 1.0)
        self.value += step
        return self.value


@dataclass
class Channel:
    name: str
    driver: str
    address: str
    source: str
    transfer: str = "linear"
    domain: tuple[float, float] = (0.0, 1.0)
    out_range: tuple[float, float] = (0.0, 1.0)
    priority: str = "B"
    trigger: list[str] = field(default_factory=list)
    envelope: Envelope = field(default_factory=Envelope)
    colours: dict[str, str] = field(default_factory=dict)

    def evaluate(self, frame_dict: dict, dt: float) -> float:
        if self.trigger:
            fired = any(t in frame_dict.get("events", []) for t in self.trigger)
            raw = 1.0 if fired else 0.0
        else:
            raw = float(frame_dict.get(self.source, 0.0))
            fn = TRANSFERS.get(self.transfer, t_linear)
            raw = fn(raw, self.domain[0], self.domain[1])
        target = self.out_range[0] + raw * (self.out_range[1] - self.out_range[0])
        return self.envelope.update(target, dt)


class KineticScore:
    """A loaded score: channels, their transfers, and their safety envelopes."""

    def __init__(self, name: str, piece: str, channels: list[Channel]):
        self.name = name
        self.piece = piece
        self.channels = channels
        self.frames_since_input = 0

    @classmethod
    def load(cls, path: str | Path) -> "KineticScore":
        data = tomllib.loads(Path(path).read_text(encoding="utf-8"))
        if data.get("schema") != "KS/1":
            raise ValueError(f"unsupported score schema {data.get('schema')!r}")
        channels = []
        for name, spec in data.get("channel", {}).items():
            env = Envelope(
                max_rate=float(spec.get("max_rate", 1.0)),
                max_accel=float(spec.get("max_accel", 0.5)),
                deadband=float(spec.get("deadband", 0.0)),
                soft_min=float(spec.get("range", [0.0, 1.0])[0]),
                soft_max=float(spec.get("range", [0.0, 1.0])[1]),
            )
            channels.append(Channel(
                name=name,
                driver=spec.get("driver", "pwm16"),
                address=spec.get("address", ""),
                source=spec.get("source", ""),
                transfer=spec.get("transfer", "linear"),
                domain=tuple(spec.get("domain", [0.0, 1.0])),
                out_range=tuple(spec.get("range", [0.0, 1.0])),
                priority=spec.get("priority", "B"),
                trigger=list(spec.get("trigger", [])),
                envelope=env,
                colours=dict(spec.get("colour", {})),
            ))
        channels.sort(key=lambda c: c.name)   # deterministic evaluation order
        return cls(data.get("score", "unnamed"), data.get("piece", "table"), channels)

    def render(self, frame_dict: dict, dt: float,
               capability: str = "A") -> dict[str, float]:
        """Evaluate all channels at or above the given priority class.

        A reduced-capability Heart -- or one with half its actuators dead --
        drives only the high-priority set, and the piece stays beautiful and
        truthful (docs/05 §2.5).
        """
        allowed = {"A": ("A",), "B": ("A", "B"), "C": ("A", "B", "C")}[capability]
        return {c.name: c.evaluate(frame_dict, dt)
                for c in self.channels if c.priority in allowed}

    def rest_all(self, dt: float) -> dict[str, float]:
        return {c.name: c.envelope.rest(dt) for c in self.channels}


def encode_wire(values: dict[str, float], channel_ids: dict[str, int],
                seq: int, version: int = 1) -> bytes:
    """Pack channel values for the motion controller (docs/05 §6).

    Fixed-point Q16.16 on the wire: no float format ambiguity between the host's
    toolchain and the MCU's, in this decade or any later one.
    """
    import struct
    import zlib

    items = sorted((channel_ids[k], v) for k, v in values.items() if k in channel_ids)
    body = b"".join(struct.pack("<Hi", cid, int(round(v * 65536.0))) for cid, v in items)
    head = struct.pack("<2sBBHH", b"KS", version, 0, seq & 0xFFFF, len(items))
    payload = head + body
    return payload + struct.pack("<I", zlib.crc32(payload) & 0xFFFFFFFF)
