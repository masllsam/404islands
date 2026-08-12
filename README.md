# 404 Islands

**An edition of 404 kinetic sculptures, each containing a living island.**

Not a rendering. Not a recording. A scientifically-grounded simulation of one volcanic
island's geology, climate, water, life, and evolution — begun at the moment the object was
made, never repeating, and outliving everyone who will own it.

> **Kurzfassung (DE).** 404 nummerierte Objekte. In jedem lebt eine Insel: echte Geologie,
> Thermodynamik, Hydrologie, Ökologie und Evolution, die miteinander rechnen. Man sieht sie
> auf einem Display, live aus der Simulation gerendert — jeder Bildpunkt lässt sich auf eine
> Zustandsgröße zurückführen. Der Körper ist Gold, Emaille, Keramik, Saphir und Edelstein
> und hält Jahrhunderte. Display und Elektronik halten das nicht aus — sie sind absichtlich
> austauschbare Serviceteile hinter einem Saphirfenster. Unvergänglich
> ist die eingravierte Zahl: Seed plus veröffentlichter Algorithmus. Solange beide
> existieren, kann die Insel exakt neu berechnet werden. Das eigentliche Material dieses
> Kunstwerks ist Mathematik; das Gold ist ihr Reliquiar.
> Einstieg: `docs/00-DIRECTION-ANALYSIS.md`, dann `docs/01-VISION.md`.

---

## The idea in three parts

**It is really running.** Magma arrives from a hotspot, a chamber pressurises, and the
volcano erupts when its walls fail — so eruption intervals are an output, not a schedule.
Trade winds lift over the edifice and rain falls where Clausius–Clapeyron says it must, so
one flank becomes rainforest and the other a desert. Rivers cut where the stream-power law
puts them. Plants photosynthesise through Farquhar kinetics, compete for light and water
and phosphorus, and their heritable traits are moved by a selection gradient taken from
what the plants actually achieved. Populations isolated by the island's own ridges
accumulate incompatibilities and, eventually, become new species.

**It proves it.** Every simulated day the kernel closes its energy, water, carbon, and
sediment budgets and reports the residual — currently ~1e-17 relative. It reproduces
published empirical laws it was never shown: Hack's law comes out at h = 0.507 against a
published 0.57; slope–area concavity at θ = 0.471 against 0.4–0.6; the windward:leeward
rainfall ratio at 29× on a Kauai-scale island. Nothing was fitted to those numbers. The
whole history is recomputable, bit for bit, from a 256-bit seed.

**You can see it.** The piece is a display in a vessel of gold, plique-à-jour enamel,
alumina and sapphire, and what it shows is the island drawn live from the simulation: real
terrain from the erosion model, the sun at its computed angle casting real shadows into
real valleys, cloud where air is rising, green where there is leaf area, gold where there
is discharge. Every pixel traces to a state variable. A second face — the **atlas** — shows
each simulated field separately and labelled, so the claim is checkable rather than merely
asserted.

The panel and the electronics are explicitly serviceable consumables behind a sapphire
window; what is permanent is the seed and the algorithm, engraved in sapphire and platinum
inside the piece and published in print — so an island could be brought back, exactly, in
the next century by someone who never heard of us.

## Try it

```bash
pip install numpy pytest

# Ignite an island and draw it: the scene, and the atlas of every field it computes.
python -m kernel.cli --seed island-001 --years 30 --post-shield 300000 \
    --hour 8.5 --image scene.png --atlas atlas.png --image-size 1100x690
```

Genesis runs 400,000 years of deep time (eruptions, flexure, subsidence, erosion, reef);
`--post-shield` carries the island past its shield stage, where rivers have time to carve.
Then it runs year by year, printing its chronicle, its lineages, its conservation ledger
and its provenance chain.

```bash
python -m kernel.cli --seed island-001 --years 25 --render   # in the terminal, live
python -m kernel.cli --years 10 --score hardware/scores/vitrine-01.toml  # servo/LED channels
python -m pytest tests/substrate tests/determinism tests/ports -q   # fast gates
python -m pytest tests/emergent -q                                  # the laws it was never taught
```

## Where to read

| | |
|---|---|
| [`docs/00-DIRECTION-ANALYSIS.md`](docs/00-DIRECTION-ANALYSIS.md) | Why the project restarted, and what was kept |
| [`docs/01-VISION.md`](docs/01-VISION.md) | The artwork: Fabergé lineage, the three layers of permanence |
| [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md) | Determinism contract, multi-rate coupler, ports |
| [`docs/03a`](docs/03a-GEOSPHERE.md) · [`03b`](docs/03b-ATMOSPHERE.md) · [`03c`](docs/03c-HYDROSPHERE.md) · [`03d`](docs/03d-BIOSPHERE.md) · [`03e`](docs/03e-EVOSPHERE.md) | The science, with equations, citations, and every approximation stated |
| [`docs/03f-VALIDATION.md`](docs/03f-VALIDATION.md) | The exams the island was never taught |
| [`docs/04-STATE-FRAME.md`](docs/04-STATE-FRAME.md) | The kernel's only output, and its wire format |
| [`docs/09-DISPLAY.md`](docs/09-DISPLAY.md) | **The display: the scene, the atlas, and what every pixel means** |
| [`docs/05-KINETIC-SCORE.md`](docs/05-KINETIC-SCORE.md) | Driving servos, steppers, and light around the image |
| [`docs/06-MATERIALS-CONSERVATION.md`](docs/06-MATERIALS-CONSERVATION.md) | Materials, the Recarving, service, escrow |
| [`docs/07-EDITION-PROVENANCE.md`](docs/07-EDITION-PROVENANCE.md) | Curation of the 404, ignition, ownership, authentication |
| [`docs/08-ROADMAP.md`](docs/08-ROADMAP.md) | What is done, what is open, what to pick up |
| [`AGENTS.md`](AGENTS.md) | Conventions for contributors, human or agent |

## Status

Milestone 1 — the kernel exists and is honest. All five modules implemented and coupled,
all four budgets closing, determinism gated by tests, emergent laws reproduced. Known-open
items are listed plainly at the top of [`docs/08`](docs/08-ROADMAP.md), including the
land-surface energy budget, which is *not* closed and which the ledger reports as open
rather than pretending otherwise.

The reference kernel is Python, written to be read and audited. The runtime that ships
inside the object will be a Rust port that must reproduce it bit-for-bit.

## A note on what this is not

Not an NFT — ownership is a physical object with a physical certificate, and nothing here
needs a blockchain. Not a game — there is no score and nothing to win. Not a screensaver —
it is a display and emphatically not a loop; if the simulation could be swapped for a
recording without anyone noticing, the project has failed, which is exactly what the
ledger, the atlas face, the seed and the published specification exist to make checkable.

---

*Prior work — a browser-based generative-art app under the same name — is preserved in
`archive/` and explained in `docs/00-DIRECTION-ANALYSIS.md`. It is not maintained.*
