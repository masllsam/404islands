# AGENTS.md — How to work in this repository

For any contributor, human or agent. Read this before your first commit here; it is short,
and every rule in it exists because breaking it silently corrupts 404 artworks.

---

## 1. What this project is

An edition of 404 kinetic sculptures, each containing a scientifically-grounded,
continuously-running simulation of one island. Start with `docs/01-VISION.md`, then `docs/02-ARCHITECTURE.md`.
If you only read one more thing, read `docs/00-DIRECTION-ANALYSIS.md` — it explains why the
old web app in `archive/` is not the project.

## 2. The five rules

**R1 — The specification is the deliverable of record.** `docs/` is normative. When code
and prose disagree, the prose wins and the code is a bug. If you change behaviour, change
the document in the same commit.

**R2 — Determinism is not negotiable.** Read `docs/02` §3 in full before touching kernel
code. In practice:

- Never call `math.*` or `np.exp/log/sin/cos/power/...` in `kernel/`. Use
  `kernel.substrate.kmath`. There is a test that enforces this.
- Never call `hash()`. Python randomises string hashes per process. There is a test.
- Never iterate a dict or set in a kernel path. Sort with an explicit key.
- Never use a global RNG. Address a `Stream(seed, module, tick, stream)` (`docs/02` §D4).
- Never sum a grid with bare `np.sum` in a budget term. Use `grid.integrate` /
  `ksum_fast`.
- Never let control flow depend on a convergence test in a hot path. Fix the iteration
  count.

**R3 — Physics, with the approximations written down.** Every mechanism cites a source in
its module docstring and in the matching `docs/03*` file. Every simplification appears in
that file's "Simplifications, stated" table with its known failure mode. A tuned parameter
must be *isolated*, *named*, and *labelled as tuned* — see `WET_FRACTION` in
`kernel/atmos/orographic.py` for the pattern. Burying a fudge inside a physical constant
is the one thing that would make this project worthless.

**R4 — The ledger does not lie.** If a budget is reported closed, it must actually close to
1e-9 relative per step. Never add a compensating term that cancels a residual — an earlier
revision did exactly that and it made the ledger meaningless. If you cannot close a budget,
say so in `docs/08` and let the ledger report it open. An honest open budget is worth more
than a fake closed one.

**R5 — Nothing in `kernel/` *outside `ports/`* may know about presentation.** No colours, no channel names, no
frame rates, no display. The kernel emits StateFrames; ports consume them. If you find
yourself importing a port from a module, the design is wrong.

The rendering ports (`ports/render.py`, `ports/atlas.py`, `ports/ascii_render.py`) are
exempt from the determinism contract — they consume StateFrames and produce pixels, and
cannot influence a frame or a hash — but not from R3: **every pixel must trace to a state
variable** (`docs/09` §2.1). If a change makes the image prettier by severing that link,
reject it. The one thing the display must never become is an illustration of a simulation.

## 3. Layout

```
docs/          normative specification         <- start here
kernel/        reference implementation (Python; the executable spec)
  substrate/   kmath, rng, grid, ledger, constants
  geo/ atmos/ hydro/ bio/ evo/                  <- the five modules
  ports/       state frame, kinetic score, renderer
  island.py    the coupler
  cli.py       studio driver
tests/         substrate · determinism · emergent · ports
hardware/      enclosure, module spec, kinetic scores
studio/        seed search and curation (never ships in the object)
archive/       superseded work, kept for reference, not maintained
```

## 4. Running things

```bash
pip install numpy pytest

# ignite an island and draw it
python -m kernel.cli --seed island-001 --years 30 --post-shield 300000 \
    --hour 8.5 --image scene.png --atlas atlas.png

# or watch it in the terminal
python -m kernel.cli --seed island-001 --years 25 --render

# with the hardware channel mapping evaluated
python -m kernel.cli --seed island-001 --years 10 \
    --score hardware/scores/vitrine-01.toml

# the gates
python -m pytest tests/substrate tests/determinism tests/ports -q   # fast, must always pass
python -m pytest tests/emergent -q                      # slow (~2 min)
```

`--strict` makes any ledger residual a hard failure. CI uses it.

## 5. Before you open a PR

1. `pytest tests/substrate tests/determinism` passes.
2. `pytest tests/emergent` passes, or you have explained a failure in `docs/03f` as a
   missing mechanism. **A failing emergent test is never fixed by widening the tolerance.**
3. The ledger still closes: `python -m kernel.cli --years 10 --strict --quiet`.
4. Any new mechanism has a citation, and any new approximation has a row in the relevant
   "Simplifications, stated" table.
5. If you changed the coupler order, a StateFrame field, `kmath`, or the RNG, you have
   bumped `KERNEL_SEMVER` and said so — those changes alter every island's history.

## 6. Conventions

- SI units everywhere, no exceptions. Variable names carry the unit: `depth_m`,
  `rate_mm_hr`, `t_air_k`. A non-SI number in the kernel is a bug.
- `f64` for anything entering a budget or an accumulator. `f32` is fine for output fields.
- Comments explain *why*, and especially why a simpler choice was rejected. The physics is
  legible from the equations; the judgement calls are not.
- Append-only identifiers: module IDs in `rng.MODULE`, StateFrame fields, event bits.
  Never renumber. They are part of every island's history.

## 7. Working alongside other agents

The RNG streams are independent by construction (`docs/02` §D4), so adding a random draw
in the biosphere cannot shift the geosphere's numbers. That is deliberate: it means several
agents can develop different modules in parallel without silently rewriting history. The
module boundaries in `docs/02` §5 are the contract — coordinate on the *fields exchanged*,
not on internals.

If you are picking up work cold, `docs/08-ROADMAP.md` §"How to pick up work" lists the
tracks that can start immediately and what each depends on.

## 8. What not to do

- Do not add a dependency to `kernel/`. NumPy and the standard library only. This code has
  to be buildable in twenty years.
- Do not add a network call anywhere in `kernel/`. The object must work with the internet
  permanently switched off, forever.
- Do not "improve" terrain with noise. Noise is an initial condition, never an answer
  (`kernel/geo/noise.py` explains why at length).
- Do not add a blockchain. Provenance is physical, documentary, cryptographic, and
  behavioural (`docs/07` §6). None of those needs one.
- Do not tune a parameter to make an emergent test pass. Find the missing mechanism.
