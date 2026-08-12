# 02 — Architecture

**Status:** Normative. Changes here require updating `KERNEL_SPEC_VERSION` and
`docs/07-EDITION-PROVENANCE.md`.

---

## 1. The one rule

```
The kernel is a pure function of (seed, elapsed time, ordered input log).
Everything else is a consumer of its output.
```

No wall-clock reads, no I/O, no randomness that is not derived from the seed, no threads
whose scheduling can change a result. If two people run the same kernel version with the
same seed and the same input log, they get **byte-identical state frames**, on any
machine, in any century.

Everything below is in service of that rule or of the fact that the result must also drive
a physical object.

## 2. Layering

```
┌──────────────────────────────────────────────────────────────┐
│  PORTS (impure, replaceable, never influence the kernel)     │
│   render · kinetic (servo/LED/audio) · provenance · telemetry│
└───────────────▲──────────────────────────────────────────────┘
                │  StateFrame (versioned, canonical, hashed)
┌───────────────┴──────────────────────────────────────────────┐
│  COUPLER — multi-rate operator splitting, fixed order        │
├──────────────────────────────────────────────────────────────┤
│  MODULES                                                     │
│   geosphere · atmosphere · hydrosphere · biosphere · evosphere│
├──────────────────────────────────────────────────────────────┤
│  SUBSTRATE — grid · kmath · deterministic RNG · ledger       │
└──────────────────────────────────────────────────────────────┘
```

Dependency arrows point downward only. A module may never import a port. A port may never
call back into a module.

## 3. Determinism contract

This is the part most projects get wrong, so it is specified rather than assumed.

**D1 — Arithmetic.** IEEE-754 binary64 throughout. Compiler contraction (FMA fusion),
fast-math, reassociation, and vectorised reductions with unspecified order are forbidden in
any conforming implementation.

**D2 — Transcendentals are ours.** `exp`, `log`, `pow`, `sin`, `cos`, `sqrt`, `tanh` from
the platform libm are **not bit-identical across platforms or versions**. This single issue
destroys long-horizon reproducibility. A conforming kernel calls only `kernel/substrate/kmath`,
which provides its own polynomial implementations with published coefficients and test
vectors. (`sqrt` is exempt: IEEE-754 mandates correct rounding.)

**D3 — Reductions.** Any sum over the grid uses a fixed traversal order (row-major,
ascending index) with Neumaier compensated summation. No parallel reduction unless it is a
deterministic tree of fixed shape.

**D4 — Randomness.** One counter-based generator (`splitmix64` → `pcg64`) keyed by
`(genesis_seed, module_id, tick, stream_id, cell_index)`. Random draws never depend on
call order, so adding a call site in module A cannot change module B's stream. There is no
global RNG state anywhere in the kernel.

**D5 — Iteration order.** Dictionary/map iteration is forbidden in kernel paths. All
collections that are iterated are ordered sequences with explicit sort keys (e.g. cohorts
sorted by `(species_id, cohort_id)`).

**D6 — No wall clock.** Simulation time advances only via `tick`. Real elapsed time enters
only at the Ports boundary, as an input event (`ADVANCE n_ticks`), and is recorded in the
input log.

**D7 — Input log.** Owner interactions and service events are appended to a signed,
ordered log. `seed + kernel_version + input_log` is the complete definition of the island's
state. Nothing else may influence it.

**Test gate:** `tests/determinism/` replays 10,000 island-years and compares frame hashes
against golden vectors, on at least two architectures (x86-64, aarch64), before any
release.

## 4. Time and the multi-rate coupler

The artwork must be legible at six timescales at once (`docs/01-VISION.md` §4). The kernel
therefore runs classic **operator splitting** with per-module timesteps, all integer
multiples of one base tick.

| Clock | Base step | Modules stepped | Notes |
|---|---|---|---|
| `T_FAST` | 1 tick = 15 sim-minutes | solar geometry, land skin temperature, sea breeze, cloud, showers, wind | drives what the eye sees — **implemented**, `kernel/atmos/weather.py`, `Island.step_fast()` |
| `T_DAY` | 96 ticks = 1 sim-day | hydrology routing, soil moisture, phenology, disturbance dice | |
| `T_YEAR` | 365 sim-days | demography, mortality, recruitment, soil carbon, reef accretion | |
| `T_CENTURY` | 100 sim-years | landscape evolution, subsidence, isostasy, weathering, speciation check | deep time |

Only `T_FAST` is coupled to real time, and only through the **presentation rate**
`R = sim-time per real-second`, which is itself part of the piece's identity (see §4.1).
Deep-time modules are stepped with large `dt` and *implicit* or sub-cycled schemes because
explicit stepping at century `dt` is unconditionally unstable for diffusion — see
`docs/03b`.

Splitting order is **fixed and normative**:

```
geosphere → atmosphere → hydrosphere → biosphere → evosphere → ledger
```

Each module reads the previous module's *committed* state, never a partially-updated one.
Double-buffered fields; no in-place mutation across module boundaries.

### 4.1 Presentation rate

Default `R`: **1 sim-day per 4 real-minutes** ⇒ one island-year per real day, one century
per 100 real days. A piece ignited in 2026 reaches the Darwin barrier-reef stage of its
volcano's life inside its first owner's lifetime. `R` is fixed per piece at ignition,
recorded on the certificate, and is *not* a user setting — changing it would change what
the object is.

The owner may **pause** (the island sleeps; no state is lost, time does not pass) and may
**witness** (temporarily accelerate to watch a season compress), but witnessing is
recorded in the log and does not advance canonical time. A witnessed future is a
projection, not history. This distinction is aesthetically important: you can look ahead,
but you cannot *have* looked ahead.

## 5. Modules and their coupling

Fields exchanged at module boundaries — the coupling interface is the contract; internals
are free.

```
geosphere ──elevation, slope, aspect, lithology, soil depth──► atmosphere
          ──drainage network, substrate age────────────────► hydrosphere, biosphere
          ──eruption/landslide events─────────────────────► biosphere (disturbance)

atmosphere ──T_air, precip, radiation, humidity, wind, PET──► hydrosphere, biosphere
           ──sea-surface temperature───────────────────────► geosphere (reef accretion)

hydrosphere ──soil moisture, runoff, lake level, water table► biosphere
            ──discharge, sediment flux──────────────────────► geosphere (incision)

biosphere ──LAI, albedo, roughness, transpiration──────────► atmosphere
          ──root cohesion, litter, canopy interception─────► hydrosphere, geosphere
          ──population sizes, trait means, resource field──► evosphere

evosphere ──trait values, species list, extinctions────────► biosphere
```

Note the feedbacks: vegetation changes albedo and transpiration, which changes climate,
which changes vegetation. Roots stabilise slopes, which changes landslide frequency, which
resets vegetation. These loops are the reason the island is interesting; they are also the
reason it can go unstable, hence §7.

## 6. StateFrame

The single output of the kernel. Versioned, canonical (deterministic serialisation),
hashed. Full schema in `docs/04-STATE-FRAME.md`. Two variants:

- **Full frame** — complete state, sufficient to restart the simulation. Written at
  checkpoints (every sim-year) to the Heart's non-volatile store, in triplicate with
  rolling generations, so a power loss mid-write cannot orphan a piece.
- **Delta frame** — emitted at `T_FAST` for the ports. Small, fixed layout, no allocation.

Frames carry `frame_hash = H(canonical_bytes)` and a running `chain_hash` (Merkle-style
over the history). The chain hash is what the provenance port publishes and what an
auditor recomputes.

## 7. Conservation ledger

Every `T_DAY` the kernel closes budgets and asserts:

| Budget | Closure |
|---|---|
| Energy | `∫(SW_in − SW_out − LW_out) dA + advection = ΔH_stored` |
| Water | `P − E − R_out − ΔS_soil − ΔS_lake − ΔS_gw = 0` |
| Carbon | `GPP − R_a − R_h − D_fire − D_export = ΔC_veg + ΔC_soil` |
| Mass (sediment) | `erosion − deposition − export = Δregolith` |
| Individuals | `births − deaths + immigration − emigration = ΔN` per population |

Residuals must stay below published tolerances (relative 1e-9 per step, 1e-6 accumulated
per century). Exceeding it is a hard error in CI and a logged anomaly on hardware.

This is not only hygiene. **The ledger is exhibited.** The piece can show that it is
conserving energy to nine digits. That is the artwork's proof of honesty, and it is the
reason nobody can credibly claim it is a recording.

## 8. Ports

| Port | Consumes | Produces | Notes |
|---|---|---|---|
| `render` | delta frames | pixels / geometry | may be replaced entirely in future centuries |
| `kinetic` | delta frames | servo, stepper, LED, audio, solenoid channels | see `docs/05-KINETIC-SCORE.md` |
| `provenance` | full frames | signed chain hashes, certificate updates | |
| `telemetry` | health counters | service diagnostics | **never** the island's state; privacy by construction |
| `studio` | full frames | seed curation, catalogue generation | studio-side only, not in the object |

Ports are allowed to be lossy, late, or absent. The kernel does not know whether anyone is
watching.

## 9. Repository layout

```
docs/                       specification (normative)
kernel/                     reference implementation (Python, executable spec)
  substrate/                grid, kmath, rng, ledger, units
  geo/                      volcanism, subsidence, landscape evolution, reef
  atmos/                    insolation, energy balance, orographic precipitation
  hydro/                    routing, soil water, groundwater lens
  bio/                      photosynthesis, demography, soil carbon
  evo/                      quantitative genetics, speciation
  ports/                    state frame, kinetic score, ascii render
  bench/                    performance harness
tests/                      unit, invariant, determinism, soak
studio/                     seed search & curation tooling (not shipped in the object)
hardware/                   enclosure, module spec, channel maps, firmware notes
archive/                    superseded work, kept for reference
```

## 10. Two implementations, one spec

- **Reference kernel (`kernel/`, Python + NumPy).** Readable, auditable, slow. It *is* the
  specification's executable form. When code and prose disagree, prose wins and the code
  is a bug.
- **Runtime kernel (planned, Rust, `no_std`-capable).** What actually ships inside the
  Heart. Must reproduce reference golden vectors bit-for-bit. Rust is chosen for
  deterministic arithmetic control, no GC pauses, and a plausible 20-year toolchain
  archive.

Any third implementation in any language is legitimate if it passes the vectors. That is
deliberate: it is how the work survives us.

## 11. Performance envelope (targets, to be measured not assumed)

| Metric | Target |
|---|---|
| Grid | 128 × 128 cells, ~10 km island ⇒ 78 m resolution |
| `T_FAST` step | < 8 ms on the Heart's SoC |
| One sim-year | < 3 s |
| One sim-century | < 5 min |
| Steady-state power | < 10 W including display and idle actuators |
| Full frame size | < 8 MB uncompressed |

Measured continuously by `kernel/bench/`; regressions are release blockers.
