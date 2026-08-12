# 03c — Hydrosphere: Soil Water, Runoff, Rivers, Lakes, the Freshwater Lens

**Timescales:** `T_DAY` (routing, storage), `T_FAST` (evaporative flux).
**Principle:** every drop is accounted for. The water budget is the easiest budget for an
observer to audit, so it is the one that must be beyond reproach.

---

## 1. The budget

```
P = E_int + E_soil + T_veg + Q_surf + Q_base + ΔS_soil + ΔS_gw + ΔS_lake + ΔS_snow
```

Closed and asserted every `T_DAY` (`docs/02` §7). Residual tolerance 1e-9 relative.

## 2. Interception and throughfall

Canopy storage capacity scales with leaf area:

```
S_c = 0.2 · LAI   [mm]
```

Intercepted water evaporates at the potential rate (no stomatal resistance — it is on the
outside of the leaf), which is why a wet forest transpires *less* than a dry one on the
same day. Throughfall and stemflow reach the soil; the remainder is intercepted loss.

## 3. Soil water

Multi-layer (6 layers, geometric spacing to ~2 m or to bedrock depth `h_soil` from
`docs/03a` §4). Richards' equation is too stiff for our budget, so we use a
mass-conserving tipping-bucket cascade with **real retention and conductivity curves**
(Clapp & Hornberger 1978):

```
ψ(θ) = ψ_s (θ/θ_s)^{−b}
K(θ) = K_s (θ/θ_s)^{2b+3}
```

Parameters `(ψ_s, K_s, θ_s, b)` from soil texture, which is itself produced by the
geosphere's weathering model — young ashy soils are coarse and fast-draining, ancient
lateritic soils are fine, clay-rich, and hold water. The island's hydrology therefore
*ages*.

Matric potential ψ is the variable the biosphere actually reads for water stress
(`docs/03d` §4), so the plants respond to potential, not to a bucket fraction. This matters:
it is why a plant on a sandy slope wilts before a plant in loam at the same water content.

## 4. Runoff generation — both real mechanisms

**Infiltration excess (Hortonian)** — rain falls faster than soil accepts it. Green–Ampt:

```
f(t) = K_s ( 1 + (ψ_f Δθ) / F(t) )
```

Dominant on bare lava, on ash after fire, and under cyclone rainfall intensities.

**Saturation excess (Dunne)** — soil is already full, usually in valley bottoms and
convergent hollows. Located by the TOPMODEL topographic index:

```
λ = ln( a / tanβ )        a = upslope area per unit contour width
```

High λ cells saturate first. This produces riparian wetlands exactly where they belong in
the landscape — in the hollows, along the streams — without anyone placing them.

## 5. Channel routing

Kinematic wave along the D∞ network from `docs/03a` §4, with Manning friction:

```
∂A/∂t + ∂Q/∂x = q_lat ,    Q = (1/n) A R^{2/3} S^{1/2}
```

Sub-cycled within `T_DAY` under the Courant condition. Deterministic order: cells processed
in topological order of the flow network, ties broken by index (D5).

Suspended and bed sediment load is carried and returned to the geosphere, closing the
erosion–deposition loop and building deltas where rivers meet the sea. Those deltas then
smother reef (`03a` §5) — a three-module chain from rainfall to coral death, all of it
mechanistic.

## 6. Lakes and closed basins

Depressions identified by Planchon–Darboux fill and given a water balance with
stage–area–volume hypsometry from the actual terrain. They overflow at the spill point,
which then becomes an outlet channel that begins to incise — so a lake can drain itself
over centuries by cutting its own outlet. Crater lakes on young volcanoes; landslide-dammed
lakes that breach catastrophically.

## 7. The freshwater lens — the most island thing there is

Fresh groundwater floats on seawater. Hydrostatics gives the Ghyben–Herzberg relation:

```
z_interface = (ρ_f / (ρ_s − ρ_f)) · h_freeboard ≈ 40 · h
```

Forty metres of fresh water below sea level for every metre of head above it. The lens
shape follows Dupuit–Forchheimer for a strip/circular island of recharge `R`,
conductivity `K`, half-width `L`:

```
h(x)² = ( R (L² − x²) ) / ( K (1 + ρ_f/(ρ_s−ρ_f)) )
```

Consequences the object will actually show:

- Lens volume scales with island **area** and **recharge**, so a shrinking, subsiding island
  loses its fresh water non-linearly and its interior vegetation dies back from the coast
  inward.
- Drought thins the lens; over-transpiration by a dense forest thins it further; salt water
  intrudes and kills the forest, which then reduces transpiration and lets the lens recover.
  A genuine oscillator, emergent, on a decadal period.
- Storm surge and cyclone overwash salinise the lens for years.

For atolls this is the whole story of habitability. When one of the 404 pieces reaches its
atoll stage, the lens becomes the most important number in it.

## 8. Simplifications, stated

| We simplify | Consequence | Why acceptable |
|---|---|---|
| Cascade instead of Richards' equation | poor at sharp wetting fronts, sub-hour | our `T_DAY` step doesn't resolve those anyway; retention physics retained |
| Sharp freshwater/seawater interface | no mixing zone | Ghyben–Herzberg is the standard first-order island result |
| No explicit permeability contrast between lava flows and dikes | mis-locates some springs | real Hawaiian hydrology is dike-compartmentalised; Milestone-3 |
| Kinematic wave (no backwater) | no floodplain inundation dynamics | acceptable at 78 m and steep island gradients |

## 9. References

Clapp & Hornberger (1978) *WRR* 14:601 · Beven & Kirkby (1979) *Hydrol. Sci. Bull.* 24:43 ·
Green & Ampt (1911) *J. Agric. Sci.* 4:1 · Dunne & Black (1970) *WRR* 6:1296 ·
Badon-Ghyben (1888); Herzberg (1901) · Vacher (1988) *GSA Bull.* 100:580 ·
Falkland & Custodio (1991) *Hydrology and Water Resources of Small Islands*, UNESCO.
