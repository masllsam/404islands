"""The conservation ledger (docs/02 §7).

This is the artwork's proof of honesty, not merely a debugging aid.  A piece that
can show, on demand, that it has conserved energy to nine digits across four
hundred simulated years cannot plausibly be a recording -- and that is the single
claim a sceptical viewer will most want to test.

So the ledger is a first-class output, exhibited on the instrument panel and
printed in the chronicle.  It is also a hard CI gate.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .constants import LEDGER_TOL_CENTURY, LEDGER_TOL_STEP


@dataclass
class Budget:
    """One conserved quantity: what came in, what left, what is stored."""

    name: str
    unit: str
    inflow: float = 0.0
    outflow: float = 0.0
    stored: float = 0.0
    _stored_prev: float = 0.0
    _inflow_step: float = 0.0
    _outflow_step: float = 0.0
    residual_step: float = 0.0
    residual_accum: float = 0.0
    worst_relative: float = 0.0

    def add_in(self, v: float) -> None:
        self._inflow_step += float(v)

    def add_out(self, v: float) -> None:
        self._outflow_step += float(v)

    def set_stored(self, v: float) -> None:
        self.stored = float(v)

    def close(self) -> float:
        """Close the step: (in - out) must equal the change in storage."""
        delta = self.stored - self._stored_prev
        self.residual_step = (self._inflow_step - self._outflow_step) - delta
        scale = max(abs(self._inflow_step), abs(self._outflow_step), abs(delta), 1e-30)
        rel = abs(self.residual_step) / scale
        self.worst_relative = max(self.worst_relative, rel)
        self.inflow += self._inflow_step
        self.outflow += self._outflow_step
        self.residual_accum += self.residual_step
        self._stored_prev = self.stored
        self._inflow_step = 0.0
        self._outflow_step = 0.0
        return rel

    def relative_accum(self) -> float:
        scale = max(abs(self.inflow), abs(self.outflow), abs(self.stored), 1e-30)
        return abs(self.residual_accum) / scale


@dataclass
class Ledger:
    strict: bool = True
    budgets: dict[str, Budget] = field(default_factory=dict)
    anomalies: list[str] = field(default_factory=list)
    steps_closed: int = 0

    def __post_init__(self) -> None:
        for name, unit in (
            ("energy", "J"),
            ("water", "kg"),
            ("carbon", "kgC"),
            ("sediment", "kg"),
        ):
            self.budgets[name] = Budget(name=name, unit=unit)

    def __getitem__(self, name: str) -> Budget:
        return self.budgets[name]

    def prime(self, name: str, value: float) -> None:
        """Declare the initial contents of a budget.

        Without this, the first close sees the whole standing stock appear from
        nowhere and reports a 100% residual -- which is technically correct and
        completely useless.  Priming states what was already there at ignition.
        """
        b = self.budgets[name]
        b.stored = float(value)
        b._stored_prev = float(value)

    def close_step(self, tick: int) -> None:
        self.steps_closed += 1
        for b in self.budgets.values():
            rel = b.close()
            if rel > LEDGER_TOL_STEP:
                msg = (
                    f"tick {tick}: {b.name} budget residual {b.residual_step:.6e} {b.unit} "
                    f"(relative {rel:.3e} > {LEDGER_TOL_STEP:.0e})"
                )
                self.anomalies.append(msg)
                if self.strict:
                    raise AssertionError(msg)

    def audit(self) -> dict[str, dict[str, float]]:
        return {
            name: {
                "inflow": b.inflow,
                "outflow": b.outflow,
                "stored": b.stored,
                "residual_accum": b.residual_accum,
                "relative_accum": b.relative_accum(),
                "worst_relative_step": b.worst_relative,
                "ok": b.relative_accum() <= LEDGER_TOL_CENTURY,
            }
            for name, b in self.budgets.items()
        }

    def ok(self) -> bool:
        return all(b.relative_accum() <= LEDGER_TOL_CENTURY for b in self.budgets.values())

    def residual_exponent(self) -> int:
        """Base-10 exponent of the worst relative residual, for the delta frame.

        The instrument panel shows this as 'conserving to 1e-N'.  It is the number
        a curious owner will point at first.
        """
        worst = max((b.relative_accum() for b in self.budgets.values()), default=0.0)
        if worst <= 0.0:
            return -18
        import math

        return int(math.floor(math.log10(worst)))
