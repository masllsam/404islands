# 03f — Validation: Exams the Island Was Never Taught

**Status:** Normative. These are release gates, implemented in `tests/emergent/`.

---

## The argument

Anyone can tune a simulation until it looks right. The defensible claim is different:

> The model is given only local mechanisms — the stream-power law, Farquhar
> photosynthesis, Clausius–Clapeyron, Wright–Fisher sampling. It is never shown the
> large-scale empirical laws below. If it reproduces them anyway, the mechanisms are
> doing real work.

Each test below is a published empirical regularity that is **not fitted, not referenced,
and not reachable** by any parameter in the kernel. A conforming implementation must
reproduce all of them within the stated tolerance. This section is what entitles the
project to the word *scientific*, and it is also, plainly, the strongest thing we can put
in front of a collector or a curator.

## Geomorphology

| Law | Expected | Tolerance |
|---|---|---|
| **Hack's law** — main stream length vs. basin area, `L = c A^h` | `h ≈ 0.57` | ±0.05 |
| **Horton's ratios** — bifurcation `R_b`, length `R_l` by Strahler order | `R_b ≈ 3–5`, `R_l ≈ 1.5–3` | within range |
| **Slope–area scaling** — `S ∝ A^{−θ}` in the fluvial domain | concavity `θ ≈ 0.4–0.6` | ±0.1 |
| **Hypsometric integral** vs. island age | monotonic decline from youthful to mature | sign & trend |
| **Drainage density** vs. mean precipitation | positive, saturating | sign & trend |

## Hydrology and climate

| Law | Expected | Tolerance |
|---|---|---|
| **Budyko curve** — `E/P` as a function of `PET/P` across the island's cells | cells fall on the Budyko curve without being told it exists | RMSE < 0.10 |
| **Orographic ratio** — windward:leeward annual precipitation on a 1500 m island | 5×–20× | within range |
| **Seasonal ocean lag** — SST maximum after insolation maximum | 6–10 weeks | ±3 weeks |
| **Diurnal convergence cloud** over the summit on calm days | present in >60 % of tropical calm days | frequency |
| **Precipitation–temperature scaling** of extreme events | ~7 %/K (Clausius–Clapeyron rate) | ±3 %/K |

## Ecology

| Law | Expected | Tolerance |
|---|---|---|
| **Species–area relationship** — `S = c A^z` across the archipelago catalogue | `z ≈ 0.25–0.35` | within range |
| **MacArthur–Wilson equilibrium** — richness stabilises with ongoing turnover | turnover > 0 at equilibrium | qualitative |
| **Self-thinning** — `N ∝ M^{−3/2}` in even-aged stands | exponent −1.5 | ±0.2 |
| **Kleiber's law** in the consumer web | `B ∝ M^{0.75}` | ±0.05 |
| **Leaf economics spectrum** — realised trait cloud vs. Wright et al. (2004) | occupies the observed manifold, not the whole box | qualitative |
| **Vitousek retrogression** — N-limitation on young substrate → P-limitation on old | limitation switches, NPP peaks mid-sequence | sign & ordering |
| **Elevational richness** — mid-elevation peak on wet tropical islands | hump-shaped | qualitative |

## Evolution

| Law | Expected | Tolerance |
|---|---|---|
| **Founder effect** — heterozygosity after colonisation vs. source | strong reduction, recovering slowly with mutation | sign & magnitude |
| **Drift scaling** — variance in allele frequency `∝ 1/(2N_e)` | matches Wright–Fisher expectation | ±10 % |
| **Speciation vs. island area & ruggedness** | in-situ speciation rate rises with both | sign & trend |
| **Island rule** — body size shifts toward intermediate on islands | dwarfing of large, gigantism of small | qualitative |
| **Radiation vs. isolation and age** | peaks at intermediate age, high isolation | qualitative |

## Geology

| Law | Expected | Tolerance |
|---|---|---|
| **Darwin's sequence** — fringing → barrier → atoll → guyot with subsidence | full sequence occurs when `G ≈ ṡ` | qualitative |
| **Subsidence** — `d ∝ √age` for the underlying plate | slope 350 m/√Myr | ±15 % |
| **Flexural moat and arch** around the load | present, wavelength consistent with `T_e` | ±20 % on wavelength |

## Conservation (hard gates, not statistical)

| Check | Tolerance |
|---|---|
| Energy budget residual per step | < 1e-9 relative |
| Water budget residual per step | < 1e-9 relative |
| Carbon budget residual per step | < 1e-9 relative |
| Accumulated residual over 100 sim-years | < 1e-6 relative |
| Bit-exact replay, x86-64 vs. aarch64, 10,000 sim-years | exact |

## Soak tests

| Run | Requirement |
|---|---|
| 1,000 islands × 1,000 sim-years | no NaN, no unbounded growth, no total ecosystem collapse in >95 % |
| 10 islands × 100,000 sim-years (deep time) | full Darwin sequence completes; no numerical drift beyond tolerance |
| Power-loss injection during checkpoint write, 10,000 trials | zero corrupted islands |

## What failure means

A failed emergent test is **not** a licence to tune until it passes. It is a signal that a
mechanism is wrong or missing. The remedy is to find the mechanism. If we cannot, the
honest response is to record the failure in this document and in the catalogue, publicly.

An artwork that publishes what it gets wrong is more trustworthy than one that claims to
get everything right — and this one will be examined by people who know.
