# 03d — Biosphere: Photosynthesis, Demography, Soil, Nutrients, Consumers

**Timescales:** `T_FAST` (carbon and water flux), `T_DAY` (phenology, disturbance),
`T_YEAR` (demography, soil).
**Principle:** there are **no hardcoded species and no painted vegetation map**. There are
plants with traits, and the traits succeed or fail against the climate the atmosphere
actually produced on the soil the geosphere actually made.

---

## 1. Why trait-based rather than plant-functional-types

Conventional land models assign fixed PFTs ("tropical broadleaf evergreen") with tabulated
parameters. That would make all 404 islands feel like the same nine plants. Instead each
lineage carries a **trait vector**, subject to real trade-offs, and the evosphere
(`docs/03e`) moves it. Vegetation types emerge as clusters in trait space, and they can be
things we never anticipated — which is the entire promise of the object.

Trait vector (heritable, continuous):

| Trait | Symbol | Trade-off it sits on |
|---|---|---|
| Leaf mass per area | LMA | thick tough long-lived leaf ↔ cheap fast-return leaf |
| Leaf nitrogen | N_leaf | photosynthetic capacity ↔ construction and herbivory cost |
| Wood density | ρ_w | mechanical safety & drought tolerance ↔ growth rate |
| Max height | H_max | light competition ↔ hydraulic and structural cost |
| Seed mass | m_s | seedling survival ↔ number of seeds |
| Xylem P50 | ψ_50 | cavitation resistance ↔ conductivity |
| Root:shoot | R:S | water/nutrient access ↔ carbon cost |

The **leaf economics spectrum** (Wright et al. 2004) is imposed as an empirical constraint
surface: `leaf lifespan ∝ LMA^{~1.7}`, `A_max ∝ N_leaf / LMA`. This is a global empirical
law measured across 2,548 species on six continents; using it as a trade-off manifold is
what keeps evolution from inventing an impossible superplant.

## 2. Photosynthesis — Farquhar, unmodified

The standard biochemical model (Farquhar, von Caemmerer & Berry 1980):

```
A_c = V_cmax (C_i − Γ*) / ( C_i + K_c(1 + O/K_o) )        Rubisco-limited
A_j = J     (C_i − Γ*) / ( 4 C_i + 8 Γ* )                 RuBP/light-limited
A_n = min(A_c, A_j) − R_d
```

with Arrhenius temperature dependence and peaked deactivation for `V_cmax` and `J_max`,
and `J` from the non-rectangular hyperbola of absorbed PAR. `V_cmax` is derived from
`N_leaf / LMA`, so the trait vector determines photosynthetic capacity mechanistically
rather than by lookup.

**Stomata — optimal, not empirical.** Medlyn et al. (2011), from the theory that a plant
maximises carbon gain per unit water lost:

```
g_s = g_0 + 1.6 ( 1 + g_1 / √D ) · A_n / C_a
```

`g_1` is a species trait tied to `ψ_50` — drought-tolerant lineages run more conservative
stomata. This closes the loop with the atmosphere: `g_s` sets surface resistance `r_s` in
`docs/03b` §3, so the forest sets its own evaporative cooling, its own humidity, and
thereby its own rainfall.

**Canopy scaling.** Two-big-leaf (sunlit/shaded) with Beer's law
`I(L) = I_0 e^{−k L}`, `k ≈ 0.5`. Full multi-layer is a Milestone-3 option.

## 3. Allocation, allometry, growth

Net primary production `NPP = GPP − R_a`, with autotrophic respiration split into growth
(a fixed fraction of new tissue) and maintenance (tissue N × Q10 temperature response).

Allocation follows the **pipe model** (Shinozaki 1964): sapwood cross-section supports a
proportional leaf area, so height and diameter are mechanically consistent. Height–diameter
allometry with wood density; stems fail under wind load above the mechanical limit — a real
cyclone mortality mechanism rather than an assigned mortality rate.

## 4. Water stress

Soil matric potential from `docs/03c` §3 → leaf water potential through a soil–plant–
atmosphere continuum with hydraulic conductance, and a vulnerability curve:

```
β = 1 / ( 1 + (ψ_leaf / ψ_50)^a )
```

`β` down-regulates `V_cmax` and `g_1`. Sustained `β` below threshold causes hydraulic
failure and death. This is a *mechanism* for drought mortality, which is the difference
between an island that has a real rain-shadow desert and an island with a brown texture on
one side.

## 5. Demography — cohorts and gaps

Following the ED / LPJ-GUESS approach: each grid cell holds several **patches** of
different disturbance age; each patch holds **cohorts** (individuals of the same lineage,
size, and age).

- **Recruitment**: seed rain from local and dispersed sources (§8), germination gated by
  light, moisture, and seedbed (fresh lava vs. litter vs. ash).
- **Growth**: NPP allocated per cohort, diameter and height updated.
- **Mortality**: background (trait-linked, from wood density) + carbon starvation
  (negative carbon balance) + hydraulic failure + size/age + crowding (self-thinning at the
  −3/2 power law) + disturbance.
- **Gap dynamics**: a canopy death opens light; the light pulse triggers a recruitment
  cohort. Succession follows: pioneers with low LMA and low wood density first, replaced by
  slow shade-tolerant lineages. This is the mechanism of forest succession and it is the
  most-watched behaviour of the object at the one-year timescale.

## 6. Soil carbon

CENTURY/RothC-style pools — metabolic and structural litter, microbial, slow, and passive
soil organic matter — with decomposition rates modified by temperature (Q10) and moisture.
Turnover times from days to millennia, so an island accumulates a *soil carbon memory* of
its own climate history that lags the climate by centuries.

## 7. Nutrients — the geology–biology handshake

**Nitrogen** enters biologically (symbiotic and free-living fixation, a trait with a carbon
cost) and leaves by leaching and denitrification.

**Phosphorus** has no atmospheric source worth counting. It comes **only from rock
weathering**, and over time it is lost to leaching and occlusion into unavailable
iron/aluminium minerals.

This produces one of the most striking results in ecosystem science — the
**Hawaiian substrate-age chronosequence** (Vitousek & Farrington 1997; Chadwick et al.
1999): young volcanic sites are *nitrogen-limited* (plenty of fresh rock P, no N yet), and
after a few hundred thousand years they become *phosphorus-limited* (N accumulated, P
weathered away and occluded). Productivity peaks in the middle and declines on ancient
substrates — **retrogression**.

We implement the mechanism, not the result. The consequence is that **an island's fertility
has an arc**: it becomes lush, and then, over deep time, it becomes poor and stunted even
though the rain still falls. Any owner who lives with a piece long enough will see their
island pass its own peak. That is not a metaphor we wrote in. It is what happens to islands.

## 8. Dispersal and colonisation

Islands are populated by rare arrivals. Three vectors, with realistic relative rates:

- **Wind** — spores, dust-sized seeds, small arthropods. Fat-tailed (Lévy) dispersal kernel
  scaled by the simulated wind field.
- **Sea** — drift-tolerant seeds and rafts. Rate scaled by current and by storm activity.
- **Birds** — internal and external transport; the dominant vector for fleshy-fruited
  plants and the reason island floras are taxonomically skewed the way they are.

Arrival is a rare Poisson process with rate depending on **island area and isolation**.
Extinction rate depends on population size. The MacArthur–Wilson species–area equilibrium
should therefore *emerge* rather than be imposed — a validation target (`docs/03f`).

## 9. Consumers and the food web

Consumer cohorts with metabolic theory of ecology:

```
B_metabolic ∝ M^{3/4} · e^{−E/kT}          (Kleiber; Brown et al. 2004)
```

Type-II functional response for feeding; body size determines diet breadth and predator–prey
mass ratio; territory/home-range scales with body mass and resource density. Herbivory
pressure feeds back onto plant leaf traits (defence ↔ growth trade-off), and predator
introduction — or extinction — cascades. Trophic structure is emergent; we specify
metabolism, not a food web diagram.

## 10. Fire

Where fuel accumulates and dries. Fuel load from litter pools, moisture from `docs/03c`,
ignition from lightning (with a rate tied to simulated convection) or lava. Rate of spread
from a Rothermel-style formulation with wind and slope factors. Fire consumes biomass,
volatilises N (but **not** P — which concentrates in ash, a real and consequential
asymmetry), resets patches to early succession, and can lock a landscape into a
fire-maintained grassland state that is stable for centuries. Alternative stable states,
emergent.

## 11. Simplifications, stated

| We simplify | Consequence | Why acceptable |
|---|---|---|
| Two-big-leaf canopy | biased fluxes in very deep canopies | ~5 % on GPP; documented |
| No explicit mycorrhizae | P uptake efficiency parameterised | major P-cycle refinement, Milestone-3 |
| Cohorts, not individual trees | loses fine spatial competition | ED-style scaling is well validated |
| Marine ecosystem is coarse (reef + plankton index) | no simulated fish populations | reef *accretion* is mechanistic; reef *ecology* is Milestone-3 |
| No pathogens | misses a real driver of island forest collapse | planned |

## 12. References

Farquhar, von Caemmerer & Berry (1980) *Planta* 149:78 · Medlyn et al. (2011) *Glob. Change
Biol.* 17:2134 · Wright et al. (2004) *Nature* 428:821 · Moorcroft, Hurtt & Pacala (2001)
*Ecol. Monogr.* 71:557 (ED) · Smith, Prentice & Sykes (2001) *Glob. Ecol. Biogeogr.* 10:621
(LPJ-GUESS) · Vitousek & Farrington (1997) *Biogeochemistry* 37:63 · Chadwick et al. (1999)
*Nature* 397:491 · Parton et al. (1987) *SSSAJ* 51:1173 (CENTURY) · Brown et al. (2004)
*Ecology* 85:1771 · Shinozaki et al. (1964) *Jap. J. Ecol.* 14:97 · Rothermel (1972) USDA
INT-115 · MacArthur & Wilson (1967) *The Theory of Island Biogeography*.
