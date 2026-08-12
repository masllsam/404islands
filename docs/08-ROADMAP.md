# 08 — Roadmap

**Rule:** every milestone ends with something you can watch, and something you can check.
No milestone is "infrastructure only".

---

## Milestone 1 — The kernel exists and is honest ✅ *(this commit)*

- [x] Deterministic substrate: `kmath` (own transcendentals), counter-based RNG, compensated
      reductions, conservation ledger.
- [x] Geosphere: hotspot supply → chamber pressure → eruption; Bingham flow emplacement;
      spectral flexure; half-space cooling subsidence; implicit stream-power incision;
      nonlinear hillslopes; soil production; landslides; reef accretion with the Darwin
      classification.
- [x] Atmosphere: orbital insolation from Kepler; Clausius–Clapeyron; Smith–Barstad
      orographic precipitation with LCL and Froude blocking; slab ocean with bulk latent
      and sensible fluxes.
- [x] Hydrosphere: soil water with Clapp–Hornberger retention; Ghyben–Herzberg lens;
      routing on the D8 network.
- [x] Biosphere: Farquhar photosynthesis, Medlyn stomata, trait-based lineages on the leaf
      economics spectrum, CENTURY-style soil carbon, N and P with weathering-limited P.
- [x] Evosphere: quantitative genetics with emergent selection gradients, drift scaled by
      Nₑ, founder effects, Dobzhansky–Muller speciation, the chronicle.
- [x] Ports: StateFrame with canonical serialisation and hash chaining; Kinetic Score
      loader with the Motion Envelope; **the display** — a software raymarching scene
      renderer (real sun, cast shadows, Beer's-law water, reef, advected cloud with
      shadows, discharge-placed rivers) and the labelled field atlas; a dependency-free
      PNG encoder; terminal renderer; CLI.
- [x] **All four conservation budgets close to ~1e-17 relative.**
- [x] Emergent tests passing that were never fitted: Hack's law h = 0.507 (published 0.57),
      slope–area concavity θ = 0.471 (published 0.4–0.6), orographic ratio 29×, TOA
      insolation balance to < 3 W/m², SST within observed zonal means at four latitudes,
      seasonal range monotonic in latitude, tropical LAI and NPP in observed ranges.

**Known-open at Milestone 1, stated plainly:**

- The land-surface energy budget is not closed (only the ocean's is). The ledger reports
  this rather than pretending otherwise.
- `WET_FRACTION` in `orographic.py` is the one tuned scalar in the atmosphere; the ocean's
  `transport_w_m2` is the one tuned scalar in the ocean. Both are isolated and labelled.
- Demes are a block partition, not a least-cost partition over real topography.
- Consumers, fire spread, and the marine ecosystem are specified but not implemented.
- The reference kernel runs ~1.8 s per island-year at 96². The Heart needs < 3 s at 128²
  in Rust — plausible but unproven.
- The scene renderer is a NumPy raymarcher at ~10 s a frame. It specifies the image; it
  cannot produce it in real time. The GPU shader is Milestone 3 (`docs/09` §6).
- Cloud opacity carries one presentation-side constant (`Renderer.cloud_gain`): the full
  simulated cloud fraction is meteorologically right and would also hide the island for
  days at a time. Isolated and labelled, like every other tuned value.

## Milestone 2 — Fidelity

- [ ] Close the land-surface energy budget: per-cell radiation on real terrain with cast
      shadows, Newton-solved skin temperature, Monin–Obukhov stability corrections.
- [x] **`T_FAST` weather stepping** (`kernel/atmos/weather.py`, `Island.step_fast()`):
      diurnal heating with a solved land skin temperature, sea-breeze convergence, the
      afternoon cap cloud with its build and decay lags, showers, and Ornstein-Uhlenbeck
      wind and synoptic state. Two new delta-frame fields; kernel 0.2.
- [x] **The day sheet** — one simulated day as a contact sheet (`--day-sheet`).
- [x] **Per-cell weather fields** — condensed cloud water and precipitation as arrays, so
      a squall crosses the island instead of covering it, and so the display samples the
      kernel's cloud rather than generating its own. The last place the image invented
      something is closed.
- [ ] Cloud deck art direction: draw it with interior structure rather than as a single
      displaced surface, so a developed cap cloud reads as cumulus with holes in it rather
      than as a lid. The midday view is currently over-obscured (`docs/09` §2.1.2).
- [ ] Couple fast-clock precipitation into the water budget, so the shower you watch is
      the drop the river carries. Needs the daily hydrology (`T_DAY`) to become prognostic
      first, and the ledger has to keep closing across the change.
- [ ] Least-cost-path deme partition over real topography, so a newly-cut canyon physically
      isolates two populations.
- [ ] Individual-based genetics below Nₑ = 500 (currently analytic everywhere).
- [ ] Consumers and the trophic web with metabolic scaling.
- [ ] Rothermel fire spread; cyclone tracks rather than uniform passage.
- [ ] Eustatic sea level from the orbital solution; wave-cut terraces.
- [ ] **Gate:** all of `docs/03f` passing, including the species–area relationship and
      Vitousek retrogression, which need Milestone-2 machinery to test at all.

## Milestone 3 — The runtime

- [ ] Rust `no_std`-capable port reproducing the reference golden vectors bit-for-bit.
- [ ] GPU renderer matching the reference image within a published perceptual tolerance,
      at 30 fps on the Heart's SoC (`docs/09` §6).
- [ ] Cross-architecture determinism gate (x86-64 vs aarch64), 10,000 sim-years.
- [ ] Checkpointing with triple redundancy; power-loss injection, 10,000 trials, zero
      corrupted islands.
- [ ] Performance envelope met on target silicon (`docs/02` §11).
- [ ] Soak: 1,000 islands × 1,000 years; 10 islands × 100,000 years for the full Darwin
      sequence.

## Milestone 4 — The object

- [ ] Heart module: schematic, layout, mechanical datum, connector, thermal path.
- [ ] Motion controller firmware implementing the Motion Envelope and the wire protocol.
- [ ] Actuator selection and qualification: silence, backlash, hold-without-power, 10⁸-cycle
      flexure life.
- [ ] LED spectral calibration and lifetime buy; binning across the edition.
- [ ] `subsidence.index` mechanism — millimetres per decade, readable with a loupe.
- [ ] Relief carving pipeline: StateFrame → 5-axis toolpath → alumina and gold.
- [ ] Enamel trials: plique-à-jour over the light guides, thermal-shock qualification.
- [ ] Oddy tests for every material in the sealed volume. No exceptions.
- [ ] Mechanical, unpowered element (`docs/01` §6).

## Milestone 5 — The edition

- [ ] Studio seed search: ≥ 10⁶ candidates characterised on the descriptor vector.
- [ ] Curation to 404, with published rarity statistics and per-piece curatorial statements.
- [ ] Kernel specification frozen, hashed, printed on cotton rag, deposited.
- [ ] Escrow: spare Hearts, matched LED reels, fabrication files, toolchain containers,
      test vectors, with an independent trust.
- [ ] Certificate folio design and production.
- [ ] Ignition protocol, witnesses, seed commitment.
- [ ] The one exhibition — all 404 in a room, running, photographed properly.

---

## How to pick up work

Milestones are ordered but not serial. Independent tracks that can start now:

| Track | Depends on | Where |
|---|---|---|
| Land-surface energy closure | nothing | `kernel/atmos/energy.py` |
| GPU renderer | frozen `docs/09` | new `runtime/render/` |
| Scene art direction | nothing | `kernel/ports/render.py` |
| Consumers / trophic web | nothing | new `kernel/bio/consumers.py` |
| Fire spread | nothing | new `kernel/bio/fire.py` |
| Least-cost demes | nothing | `kernel/evo/genetics.py::region_map` |
| Rust port | frozen `docs/04` | new `runtime/` |
| Studio seed search | nothing | `studio/` |
| Hardware | frozen `docs/05` | `hardware/` |

See `AGENTS.md` for the conventions any contributor — human or agent — must follow.

---

## Measured, not assumed

Numbers from the Milestone-1 kernel, recorded here so regressions are visible.

| Quantity | Measured | Published / expected |
|---|---|---|
| Hack's law exponent | **0.507** | 0.57 |
| Slope–area concavity θ | **0.471** | 0.4–0.6 |
| Windward:leeward rainfall, Kauai-scale island | **29×** | 5–40× |
| Summit rainfall, 1600 m island | **9,840 mm/yr** | ~11,000 (Waialeale) |
| Global mean TOA insolation | **340.2 W/m²** | 340.25 (S₀/4) |
| SST, equator / 20° / 40° / 60° | **29.0 / 25.3 / 15.6 / 1.4 °C** | observed zonal means |
| Seasonal SST range | monotonic 0.5 → 6.6 K with latitude | maritime seasonality |
| Tropical LAI | **5.4** | 4–8 |
| Tropical NPP | **1.07 kg C m⁻² yr⁻¹** | 0.8–1.5 |
| Energy / water / carbon budget residual | **~1e-17 relative** | ≤ 1e-9 required |
| Reference kernel speed | 1.8 s per island-year at 96² | Rust target < 3 s at 128² |
| Diurnal land temperature range, 4 km tropical island | **24.1 → 30.8 °C** | 5–10 K typical |
| Cap cloud, same island | **0.05 → 0.54, peak 14:00** | peaks 1–4 h after solar noon |
| Scene render | ~10 s a frame at 1100×690 (NumPy) | GPU shader, Milestone 3 |
| Fast clock | **0.6 s per simulated day** (96 ticks, 64² grid) | must not dominate the year |
| Shower footprint | **< 50 % of the domain**, gated by test | showers are local |

**A finding worth recording:** at 15 km domains with 200 kyr of construction, roughly half
of all seeds never break the surface at all — they stay guyots. Emergence is not the
default. That is the honest basis for the edition's rarity claims (`docs/07` §2.1), and it
is why curation runs over millions rather than hundreds.
