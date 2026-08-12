# 03a — Geosphere: Volcanism, Subsidence, Landscape Evolution, Reef

**Timescales:** `T_CENTURY` (deep time), with `T_DAY` disturbance events.
**Principle:** the island's shape is never drawn. It is *derived*, always, from a magma
source, a cooling plate, and rain that fell on it.

---

## 1. Why the island is volcanic

Every real oceanic island of interest is volcanic, and volcanic islands have a *life
cycle* that is one of the most beautiful results in the earth sciences: Darwin's 1842
subsidence theory, confirmed by drilling at Enewetak in 1952. A hotspot builds a shield
volcano; the plate carries it off the hotspot; the lithosphere cools and sinks; coral grows
upward to stay in the light; the sequence **high island → fringing reef → barrier reef →
atoll → drowned guyot** unfolds over tens of millions of years.

Compressed onto our presentation rate, an owner watches their island travel a real distance
along this sequence within a lifetime. This is the single strongest reason the geosphere
leads the module order: it is the slow ground truth everything else stands on.

## 2. Magma supply and edifice construction

Volume flux from the hotspot as the plate translates past it, in the shield-building phase:

```
Q(t) = Q_max · exp( −( (x(t) − x_hs)² ) / (2 σ_hs²) ),      x(t) = x_0 + v_plate · t
```

with `v_plate ≈ 0.08–0.10 m/yr`, `σ_hs ≈ 50–100 km`, `Q_max ≈ 0.02–0.1 km³/yr`
(Hawaiian shield-stage values; Vidal & Bonneville 2004). The Gaussian is a
parameterisation, not a law — flagged as such.

**Emplacement.** Erupted volume is distributed as flows that follow the steepest descent
path from a vent, with thickness set by yield strength and slope:

```
h_flow = τ_y / (ρ g sin θ)
```

(Hulme 1974, Bingham rheology). Vents are drawn from a rift-zone geometry: two or three
linear rift arms radiating from the summit, azimuths fixed per island at genesis by the
regional stress field. This is why real shield volcanoes are elongate and lobed, not
conical, and it is a large part of what makes an island look *specific*.

**Phases:**

| Phase | Duration | Behaviour |
|---|---|---|
| Submarine / seamount | ~ first 60 % of volume | steep flanks, no subaerial expression |
| Shield | rapid | tholeiitic, high flux, gentle 4–10° slopes |
| Post-shield capping | ~1 % of volume | alkalic, steeper, builds cinder cones |
| Erosional | Myr | no supply; the landscape model takes over entirely |
| Rejuvenated | rare, stochastic | isolated late vents (Honolulu Volcanics analogue) |

**Catastrophic flank collapse.** Shield volcanoes fail at giant scale (Hawaii's Nuuanu
slide, ~5000 km³). Modelled as a rare event when a flank exceeds a stability threshold
under its own load and pore pressure, removing a sector and leaving an amphitheatre
headwall. Recurrence ~10⁵ yr. Rare enough that only a few of the 404 pieces will ever show
one — which is exactly the kind of rarity the edition should have (see `docs/07`), because
it is earned by physics rather than assigned by a rarity table.

## 3. Subsidence and flexure

**Thermal subsidence.** Oceanic lithosphere cools and contracts; depth grows with the
square root of age (half-space cooling; Parsons & Sclater 1977):

```
d(t) = d_ridge + C √(t_age)     C ≈ 350 m / √Myr        (valid t < ~70 Myr)
⇒ subsidence rate  ṡ = C / (2 √t_age)
```

For a 1 Myr-old island this is ≈ 0.18 mm/yr; for young Hawaii, loading dominates and the
observed rate is ~2.5 mm/yr.

**Flexural loading.** The volcano's own weight bends the plate. Thin elastic plate on a
fluid substrate:

```
D ∇⁴w + (ρ_m − ρ_w) g w = q(x,y),        D = E T_e³ / (12(1 − ν²))
```

with `T_e ≈ 20–30 km`, `E = 70 GPa`, `ν = 0.25`, `ρ_m = 3300`, `ρ_w = 1030 kg/m³`.
Solved spectrally: in Fourier space the plate response is a simple multiplier,

```
ŵ(k) = q̂(k) / ( D k⁴ + (ρ_m − ρ_w) g )
```

so one FFT pair per century step. This produces the **moat and flexural arch** that ring
real volcanic islands, and it means loading a new flank makes the *other* side sink —
a genuine coupled behaviour, not decoration.

Total relative sea level at a cell: `RSL = eustatic(t) + thermal_subsidence(t) + flexure(x,y) − uplift`.

**Eustasy.** Glacial cycles move sea level by >120 m on 100 kyr timescales. Included as a
deterministic function of the orbital solution (`docs/03b` §2) for deep-time runs — an
island's terraces and notches will record its past sea levels, and those terraces are
visible in the finished object.

## 4. Landscape evolution

The core equation (Howard 1994; Whipple & Tucker 1999; Tucker & Hancock 2010):

```
∂z/∂t = U − K_sp · Q_eff^m · S^n + ∇·( q_hill ) + ∂h_soil/∂t
```

**Fluvial incision (stream power).** We use *effective discharge* rather than drainage
area, so that orographic precipitation actually controls where valleys cut:

```
Q_eff(i) = Σ_{j ∈ upstream(i)} P_eff(j) · A_cell
E_fluvial = K_sp · Q_eff^m · S^n ,     m ≈ 0.5,  n ≈ 1
```

`K_sp` is set by lithology (fresh basalt is resistant; weathered ash is not) and is one of
the few genuinely tuned parameters. Documented as tuned.

This coupling is the single most important thing in the geosphere. It is why the wet
windward side of the island develops deep amphitheatre valleys while the leeward side stays
smooth — the actual explanation for the shape of Kauai, Tahiti, and Moorea. Nothing in the
model was told to do this.

**Hillslope transport (nonlinear, threshold).** Linear diffusion cannot make cliffs. Roering
et al. (1999):

```
q_hill = D_h ∇z / ( 1 − (|∇z| / S_c)² )
```

Flux diverges as slope approaches the critical angle `S_c ≈ tan(33°)`, giving planar
threshold hillslopes and, above `S_c`, mass failure.

**Landsliding.** Infinite-slope stability with pore pressure from the hydrosphere and root
cohesion from the biosphere:

```
FS = ( c' + c_root + (γ z cos²θ − u) tan φ' ) / ( γ z sinθ cosθ )
```

Failure at `FS < 1`. A wet season plus a deforesting fire measurably raises landslide
frequency — a real, coupled, observable behaviour of the object.

**Soil production.** Bedrock converts to regolith fastest under thin soil (Heimsath et al.
1997):

```
∂h_soil/∂t = P_0 · exp(−h_soil / h*) − erosion,     P_0 ≈ 0.05–0.2 mm/yr,  h* ≈ 0.3–0.5 m
```

This ties directly to the biosphere's phosphorus budget (`docs/03d` §7): young volcanic
soils are fertile, ancient ones are leached and P-starved.

**Flow routing.** D∞ (Tarboton 1997) for realistic divergent flow on cones, with
Planchon–Darboux depression filling to identify lakes and closed basins. Deterministic
tie-breaking by cell index (D5).

## 5. Reef accretion

Coral growth as a function of light, which decays exponentially with depth
(Bosscher & Schlager 1992):

```
G(z) = G_max · tanh( I_0 e^{−k z} / I_k ) · f_T(SST) · f_Ω(aragonite) · f_turb(sediment)
```

`G_max ≈ 10–15 mm/yr`, `k ≈ 0.05–0.16 m⁻¹`, `I_k ≈ 250 µmol m⁻² s⁻¹`.
`f_T` peaks at 26–28 °C and collapses above ~31 °C (bleaching) and below ~18 °C.
`f_turb` is why reefs die opposite river mouths — a coupling from the hydrosphere that
gives every island's reef a shape derived from its own drainage.

Racing subsidence against accretion produces the Darwin sequence with no special-casing:

- `G > ṡ` → reef keeps up → fringing, then barrier as the lagoon deepens
- `G ≈ ṡ` → equilibrium barrier reef
- `G < ṡ` → give-up reef → drowned guyot

**This is the mechanism that makes the object a lifetime work.** The owner is watching a
race between coral and a sinking plate.

## 6. Simplifications, stated

| We simplify | Consequence | Why acceptable |
|---|---|---|
| Flexure is elastic, not viscoelastic | no stress relaxation over Myr | negligible over the object's horizon |
| Single lithology class per cell | no complex stratigraphy | resolution-limited anyway at 78 m |
| No explicit groundwater dike/rift hydrology | mis-times some spring locations | hydrosphere handles the bulk lens |
| Sediment transport is detachment-limited | under-represents alluvial fans | transport-limited mode is a Milestone-3 addition |
| Reef is 1-D vertical accretion per cell | no lateral reef-front progradation | planned refinement |

## 7. References

Parsons & Sclater (1977) *JGR* 82:803 · Watts (2001) *Isostasy and Flexure of the
Lithosphere*, CUP · Howard (1994) *WRR* 30:2261 · Whipple & Tucker (1999) *JGR* 104:17661 ·
Roering, Kirchner & Dietrich (1999) *WRR* 35:853 · Heimsath et al. (1997) *Nature* 388:358 ·
Tarboton (1997) *WRR* 33:309 · Planchon & Darboux (2002) *Catena* 46:159 ·
Bosscher & Schlager (1992) *Sedimentology* 39:503 · Darwin (1842) *The Structure and
Distribution of Coral Reefs* · Hulme (1974) *Geophys. J. R. astr. Soc.* 39:361 ·
Vidal & Bonneville (2004) *JGR* 109:B03104.
