# 00 — Direction Analysis: Should We Restart?

**Status:** Decided · **Date:** 2026-08 · **Decision owner:** project founder
**Verdict: Restart the core. Keep the repository. Archive the old work.**

This document exists because the question "are we going in the right direction, or do we
need to start over?" was asked explicitly. It records the answer and the reasoning, so
that nobody — human or agent — has to re-litigate it later.

---

## 1. What the project was

The repository (now under `archive/legacy-webapp/`) contained a browser-first
subscription product:

| Aspect | Legacy state |
|---|---|
| Product | Web app, 404 islands as generative-art pages |
| Simulation | Perlin noise + fBm terrain; weather as sine waves and random events |
| Truth model | *Plausible-looking* — output tuned to look nice |
| Business | $10/year "Steward", $100 "Guardian", Stripe, Oracle free tier |
| Physical output | Pen-plotter print as a merch item |
| Architecture | React component tree; simulation state entangled with UI hooks |
| Persistence | Island state stored as JSON documents in a cloud DB |

It is competent work for what it is. It is also the wrong object.

## 2. What the project is now

An **edition of 404 kinetic sculptures**, each containing a scientifically-grounded
simulation of one island's geology, climate, hydrology, ecology, and evolution, running
continuously for the owner's lifetime, expressed through precious materials, light, and
motion. Fabergé lineage, not SaaS lineage.

## 3. Why this is not a pivot but a re-founding

The two products disagree at every load-bearing joint. This is the test that matters: if
the disagreements were at the leaves, we would refactor. They are at the root.

### 3.1 Truth vs. plausibility

Perlin noise produces terrain that *looks* like terrain. It contains no rivers, because
nothing flowed. It has no windward side, because no air rose over it. A collector who
studies the piece for twenty years will find nothing underneath — no explanation, no
mechanism, no reward for attention. The stated goal is *"so dass man es fühlen kann,
dass es echt ist, und daraus lernen kann"*. Noise cannot deliver that, and no amount of
polish on top of noise can. The generative layer must be replaced with governing
equations, and that is a rewrite by definition.

**What survives:** noise is still legitimate — but demoted from *the terrain* to *the
initial perturbation field* that a real landscape-evolution model then carves. It is an
input, not an answer.

### 3.2 Determinism is now a structural requirement, not a nicety

A collectible whose value rests on provenance must be **bit-exactly reproducible from its
seed**. The island's entire history has to be recomputable in 2150 from the engraved seed
and the published kernel — otherwise the artwork's identity lives in a database that will
not survive the century. The legacy code uses `Math.random()`, floating-point reductions
in nondeterministic order, wall-clock time, and server-side mutable state. Determinism is
not a feature you add to such a system; it is a property you design a system around.

### 3.3 The simulation must be headless — the legacy one cannot be

The kernel has to drive: a display, servos, stepper motors, LEDs, a certification
pipeline, and (in 2200) some rendering technology nobody has invented. Legacy simulation
logic lives inside React hooks (`useWeather`, `useSeason`) and canvas renderers. Physics
is entangled with presentation. Every future output port would have to drag a browser
behind it. The kernel must be a pure function of (seed, time); presentation must be a
consumer of its output, never its host.

### 3.4 Timescales are incompatible

The legacy model has one clock. The artwork needs at least four running concurrently:
light and motion in seconds, weather in hours, ecological succession in years, geological
subsidence and speciation in centuries. That is an operator-split multi-rate coupler —
an architectural pattern, chosen at the foundation, not a scheduler you bolt on.

### 3.5 The economics invert

$10/year for a web page vs. a numbered edition of 404 objects in gold, enamel, and
sapphire. Different buyer, different obligations (conservation, service, escrow,
authentication), different everything. The Stripe/Oracle/nginx stack is not the
infrastructure of this business. Keeping it would keep pulling decisions toward the old
product.

## 4. What we keep

Deleting is not the point; misfiling is what killed the clarity. Kept and reused:

- **`PerlinNoise.js` / `FractionalBrownianMotion.js`** → ported as the *initial roughness
  field* for the geodynamic seed stage. Reference: `kernel/geo/noise.py`.
- **The 404 number and the island metaphor.** Both are good and both survive.
- **The instinct toward physical fulfilment.** The legacy plan already reached for
  plotters and Raspberry Pi installations. That instinct was right and is now the centre
  of the work rather than a merch tier.
- **Deployment/CI craft** in `archive/legacy-webapp/` — reusable when we need a
  studio-side build farm for seed curation.

Everything else is reference material.

## 5. Risks this decision creates, and how we hold them

| Risk | Reality | Mitigation |
|---|---|---|
| Scientific scope is enormous | True. Earth system models are career-scale efforts. | We do not build a climate model. We build the *smallest set of coupled equations that are individually textbook-correct and jointly conservative*. Every simplification is written down in `docs/03-*` with its citation and its known failure mode. Honesty about the approximation is part of the artwork. |
| Compute budget in an embedded object | A sculpture cannot host a GPU cluster. | Grid ~128², multi-rate stepping, deep-time processes advanced on long timesteps. Target: a full island-year in seconds on a ~10 W module. Measured, not assumed — see `kernel/bench/`. |
| Electronics will not last 300 years | Certain. The owner already named this. | Architecturally answered by the three-layer model (Vessel / Heart / Soul) in `docs/06-MATERIALS-CONSERVATION.md`. The permanent artefact is the *seed and the algorithm*, engraved in sapphire and platinum; the compute module is an explicitly serviceable consumable. |
| Simulation drifts into instability over decades | Real. Long integrations blow up or flatline. | Conservation ledger (energy/water/carbon) checked every frame; invariant tests in CI; multi-century soak runs as a release gate. |
| Rewrite loses momentum | Real. | The reference kernel is runnable from day one and every milestone produces a thing you can watch. |

## 6. The decision

1. Legacy code moved to `archive/` — preserved, referenceable, out of the way.
2. New core: a deterministic, headless, physically-grounded simulation kernel
   (`kernel/`), specified in `docs/`, with output ports for render, actuation, and
   provenance.
3. The specification is the deliverable of record. The Python kernel is the executable
   reference; the production runtime will be a port that must reproduce it bit-for-bit.

**We are not starting over. We are starting, properly, for the first time — and keeping
the eighteen months of instinct that told us what this wanted to be.**
