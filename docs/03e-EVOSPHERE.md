# 03e — Evosphere: Genetics, Selection, Drift, Speciation, Radiation

**Timescales:** `T_YEAR` (reproduction, selection), `T_CENTURY` (speciation checks).
**Principle:** we never write a fitness function. Fitness is the number of surviving
offspring an organism actually had in the simulated world. Selection is a *consequence*
of the biosphere, not an input to it.

This module is the reason the object is worth owning for forty years.

---

## 1. What is inherited

Each lineage carries the trait vector of `docs/03d` §1 in a genetic architecture:

- **L = 64 loci** per trait complex, additive effects, diploid.
- Phenotype `z = μ + Σ_l (a_l · g_l) + ε` where `ε ~ N(0, V_E)` is developmental noise.
- Narrow-sense heritability `h² = V_A / V_P` emerges from the allele frequencies rather
  than being set. It changes as selection erodes variance and mutation restores it — so a
  population that has been hammered by selection *becomes less able to respond*, which is
  a real and important phenomenon.
- Pleiotropy via a sparse locus→trait effect matrix, fixed per lineage at genesis. This is
  what makes trade-offs genetic rather than merely imposed: you cannot select for fast
  growth without dragging wood density with you.

## 2. Two regimes, one model

Individual-based genetics for every plant on a 128² grid is not affordable. We use a
**hybrid** with an explicit, defensible switch:

- **Small populations (N < N_switch ≈ 500)** — full individual-based Wright–Fisher
  reproduction. This is where genetic drift, founder effects, inbreeding depression, and
  extinction vortices happen, and all of them are *strongly* size-dependent. Getting them
  right matters far more than getting large populations right.
- **Large populations (N ≥ N_switch)** — the breeder's equation / Lande response, tracking
  mean and additive variance per deme:

```
Δz̄ = h² S = (V_A / V_P) · S,     S = z̄_selected − z̄
ΔV_A = mutation input (V_m ≈ 10⁻³ V_E per generation) − selection erosion − drift loss (V_A/2N_e)
```

The switch is hysteretic (different up/down thresholds) so a population near the boundary
does not chatter, and is deterministic.

## 3. Selection is emergent

For each individual or cohort, the biosphere already computes: carbon balance, hydraulic
safety margin, mechanical survival under wind, herbivory losses, reproductive output. The
evosphere reads exactly those and nothing else.

```
w_i  ∝  (offspring produced) × (survival to reproduction)
```

Consequences that follow without being programmed:

- On the wet windward slope, low-LMA fast-return leaves win.
- Across the ridge in the rain shadow, the same lineage is selected toward high LMA,
  cavitation-resistant xylem, and conservative stomata.
- After a flank collapse opens bare rock, selection swings hard toward dispersal ability
  and seedling establishment — then swings back to shade tolerance a century later.

Selection reverses when the climate reverses. Nothing is going anywhere in particular.

## 4. Effective population size, drift, and the small-island problem

`N_e` is tracked per deme, accounting for variance in reproductive success, sex ratio, and
temporal fluctuation (harmonic mean over generations — a single bottleneck dominates the
average, which is why bottlenecks matter so much).

Drift magnitude `∝ 1/(2N_e)`. On a small island this is not a footnote — it is the dominant
evolutionary force. Populations lose variation, fix mildly deleterious alleles, and
sometimes spiral into the extinction vortex. **Some lineages on some of the 404 islands
will simply die, and it will be nobody's fault.** That has to be true for the work to be
honest.

## 5. Colonisation and the founder effect

An arrival event (`docs/03d` §8) delivers a handful of propagules — often one. The founding
population carries a random sample of the source pool's alleles: reduced variation, shifted
means. Everything the lineage subsequently becomes is conditioned on that sample.

This is the mechanism behind why island biotas are strange, and it is the point in the
model where the deepest contingency enters. **Two islands with nearly identical climates
will diverge irreversibly because of which three seeds happened to land.** Rerun the seed
and you get the same answer forever; change one bit and you get another world. That is
exactly the property a numbered edition of 404 should have.

## 6. Spatial structure and speciation

The island supplies its own barriers: ridges between the radial valleys that the landscape
model carved, elevation belts, the windward/leeward divide, and — for older islands — the
progressive fragmentation of the land into separate remnants as the volcano subsides.

**Gene flow** between demes decays with distance and with terrain resistance (a
least-cost-path metric over the actual topography), so a deep new canyon *physically*
isolates two populations.

**Genetic distance** `D` accumulates between isolated demes by mutation and divergent
selection. Reproductive isolation follows the **Dobzhansky–Muller** model: incompatibilities
are pairwise between substitutions, so isolation grows with roughly the square of the number
of substitutions ("the snowball effect"; Orr 1995):

```
P(incompatible) ≈ 1 − exp( −c · k² ),   k = number of divergent substitutions
```

When hybrid fitness drops below threshold, the demes are declared separate species, get
new identifiers, and are recorded — with a timestamp, a location, and a cause — in the
island's **chronicle**.

**A speciation event is a headline event of the artwork.** The object should mark it: a
change in light, a movement, an entry in the log the owner can read. *On 14 March 2061,
on the north ridge of Island 217, a population became a species.* Twelve people on Earth
will own an island that has done this by 2061. It cannot be bought, only waited for.

## 7. Adaptive radiation

Given (a) empty niche space after colonisation, (b) spatial structure, and (c) heritable
variation, the classic outcome is radiation: one founder lineage filling many roles.
Darwin's finches, Hawaiian silverswords, Anolis lizards, Hawaiian *Drosophila*.

We do not implement "radiation". We implement colonisation, competition for resources
along real axes (light, water, N, P, seed size, body mass), spatial isolation, and
incompatibility accumulation. Radiation is then a *prediction* of the model, and whether
it happens on a given island — and how far it goes — depends on that island's area,
topographic ruggedness, climatic diversity, and how early the founder arrived.

Rugged, wet, young, isolated islands should radiate. Flat, dry, old, subsiding ones should
not. If the model reproduces that pattern unprompted, the module is working.

## 8. The chronicle

Every evolutionary event is written to an append-only, hash-chained record: colonisations,
extinctions, bottlenecks, speciations, trait shifts beyond a threshold, radiations.

This is the island's **history**, and it is a primary artefact of ownership — the thing an
heir reads. It is not a log file. It should be printable, on cotton rag, as a supplement to
the certificate, and it should read like a natural history because it is one.

## 9. Simplifications, stated

| We simplify | Consequence | Why acceptable |
|---|---|---|
| No explicit genome sequence | no molecular clock detail, no linkage maps | quantitative genetics is the right level for phenotype evolution |
| Diploid, no recombination map | no linkage disequilibrium structure | affects speed of response modestly; documented |
| DMI snowball is a parameterised probability | not derived from molecular interaction | it is the standard theoretical result |
| Mainland source pool is a fixed trait distribution | no coevolution with a wider world | an island is *defined* by its isolation; this is arguably correct |
| No horizontal gene transfer, no polyploidy | polyploidy is a real and common plant speciation route on islands | Milestone-3; it would be a beautiful addition |

## 10. References

Falconer & Mackay (1996) *Introduction to Quantitative Genetics*, 4th ed. ·
Lande (1979) *Evolution* 33:402 · Lynch & Walsh (1998) *Genetics and Analysis of
Quantitative Traits* · Orr (1995) *Genetics* 139:1805 · Coyne & Orr (2004) *Speciation* ·
Gavrilets (2004) *Fitness Landscapes and the Origin of Species* · Grant & Grant (2014)
*40 Years of Evolution: Darwin's Finches on Daphne Major* · Losos & Ricklefs (2009)
*Nature* 457:830 · Whittaker & Fernández-Palacios (2007) *Island Biogeography*, 2nd ed. ·
Gillespie (2004) *Science* 303:356 (Hawaiian spider radiation).
