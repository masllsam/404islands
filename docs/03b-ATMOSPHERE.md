# 03b — Atmosphere: Radiation, Thermodynamics, Orographic Precipitation

**Timescales:** `T_FAST` (radiation, fluxes), `T_DAY` (weather), `T_CENTURY` (orbital).
**Principle:** we do not run a general circulation model, and we never pretend to. We run
a *column-and-terrain* model in which every term is a real thermodynamic quantity and the
energy budget closes to nine digits.

---

## 1. Scope, honestly

An island is 10 km across. Global circulation is 10,000 km. The synoptic flow arriving at
our island is therefore **imposed** — as trade winds from the Hadley circulation at the
island's latitude, with a seasonally migrating ITCZ and a stochastic-but-physical
storm/cyclone component. What we then simulate *properly* is what the island does to that
flow and that radiation: lifting, condensation, shading, heating, sea breeze, and the
surface energy and water budgets.

This division is the correct one. It is also exactly how regional models are run
(a driving reanalysis plus a resolved local domain), so it is standard practice, not a
dodge — but it is written down here so no one ever claims more than we do.

## 2. Insolation from real orbital geometry

Solar declination and distance from the orbital elements:

```
δ(t)  = arcsin( sin ε · sin λ(t) )
(d0/d)² = ( 1 + e cos ν )² / (1 − e²)²
```

with true longitude λ from the eccentric anomaly (Kepler solved by Newton iteration to
1e-14). Nominal: obliquity `ε = 23.44°`, eccentricity `e = 0.0167`, solar constant
`S_0 = 1361 W/m²`.

For deep-time runs, ε, e, and the precession angle vary on their real periods (~41 kyr,
~100/400 kyr, ~23 kyr) via a truncated Laskar-style series — so glacial cycles, sea-level
change, and the island's terraces all descend from the same orbital clock. Milankovitch
forcing is the deepest rhythm in the object.

Top-of-atmosphere flux on a horizontal surface at latitude φ, hour angle h:

```
S_TOA = S_0 (d0/d)² · ( sinφ sinδ + cosφ cosδ cos h )
```

**Terrain matters and is resolved.** For each cell we compute:

- **Beam geometry:** cosine of incidence on the actual sloped surface from slope β and
  aspect γ — the reason a north-facing gully is cooler, wetter, and forested while the
  south-facing spur beside it is dry scrub. This asymmetry is one of the most visible
  outputs of the whole model.
- **Cast shadows:** horizon angle per cell per azimuth, precomputed per terrain epoch.
  Deep valleys are genuinely in shade at low sun.
- **Sky-view factor** `V_d` for diffuse, and terrain-reflected radiation `(1−V_d)·α·S`.

Atmospheric transmission by a two-band Beer–Lambert with air mass, water vapour, and cloud:

```
τ = τ_clear(m) · (1 − 0.75 c^3.4)          (Kasten–Czeplak cloud transmission)
```

## 3. Thermodynamics

**Saturation vapour pressure** — Clausius–Clapeyron, Bolton (1980) form:

```
e_s(T) = 611.2 · exp( 17.67 (T − 273.15) / (T − 29.65) )   [Pa]
```

Everything about moisture on this island — where clouds form, how much rain the windward
slope gets, how fast the leeward side dries, how the tropics differ from the high
latitudes — descends from this one exponential. The ~7 %/K scaling is the model's
temperature-precipitation coupling and it is not tunable.

**Lapse rates.** Dry adiabatic `Γ_d = g/c_p = 9.8 K/km`; moist adiabatic computed from the
saturated equivalent-potential-temperature relation (not a constant); environmental profile
between them per stability. Lifting condensation level from Espy/Bolton.

**Surface energy balance**, solved per cell for surface temperature `T_s` by Newton
iteration on the residual:

```
R_n = (1 − α) S↓ + ε_s L↓ − ε_s σ T_s⁴
R_n = H + LE + G
H  = ρ c_p (T_s − T_a) / r_a
LE = ρ c_p / γ · ( e_s(T_s) − e_a ) / ( r_a + r_s )
```

Downward longwave from a bulk emissivity (Brutsaert 1975, with cloud correction):

```
ε_a = 1.24 (e_a / T_a)^{1/7} · (1 + 0.22 c²)
```

Aerodynamic resistance `r_a` from Monin–Obukhov similarity with stability corrections;
surface resistance `r_s` from the biosphere's stomatal model — so the vegetation genuinely
controls its own evaporative cooling, and a forest and a lava field beside each other run
at visibly different surface temperatures.

**Slab ocean.** A mixed layer of depth `h_ml ≈ 50 m` with heat capacity
`C = ρ_w c_w h_ml ≈ 2.1×10⁸ J m⁻² K⁻¹`:

```
C · dSST/dt = R_n,ocean − H_ocean − LE_ocean + Q_transport
```

Its thermal inertia is why maritime climates lag the sun by ~2 months and have small
annual ranges. That lag is a *result* here, not a parameter — and it is what gives the
object its slow, unhurried seasonal breathing. SST also feeds reef accretion (`03a` §5)
and cyclone genesis (§5).

## 4. Orographic precipitation

The model that makes this island real: **Smith & Barstad (2004) linear theory of
orographic precipitation**. It is analytic in Fourier space, so it costs one FFT and
delivers physically-structured windward/leeward rainfall including advection and fallout
delays:

```
P̂(k,l) = ( C_w · i σ ĥ(k,l) ) / ( (1 − i m H_w)(1 + i σ τ_c)(1 + i σ τ_f) )
σ = U k + V l          (intrinsic frequency)
m = ...                (vertical wavenumber from moist stability N_m and σ)
```

with `C_w` the uplift sensitivity from thermodynamics, `H_w ≈ 2.5 km` the moisture scale
height, and `τ_c, τ_f ≈ 200–1000 s` the cloud-conversion and hydrometeor-fallout
timescales. Background precipitation is added; negative values are truncated.

Why this and not "rain more where it's steep": the fallout timescales advect precipitation
*downwind of the peak*, and the moist stability term produces gravity waves that can
suppress rain on the immediate lee — reproducing observed rain shadows quantitatively.
Kauai's Mount Waialeale receives >11 m/yr while the leeward coast 20 km away receives
0.5 m/yr. A factor of twenty across a small island, from terrain alone.

Snow when the wet-bulb temperature is below ~1 °C, with an accumulation/melt model
(degree-day plus radiation) for high or high-latitude islands.

## 5. Weather and storms

- **Trade winds** at the island's latitude with seasonal ITCZ migration, plus a
  slowly-varying stochastic component (Ornstein–Uhlenbeck, seeded per D4) so the wind is
  never a repeating loop.
- **Sea breeze / land breeze**: diurnal reversal driven by the actual simulated land–sea
  surface temperature contrast. Small islands have a characteristic afternoon convergence
  cloud over the peak — a beautiful, daily, entirely emergent event that the object shows
  every single simulated afternoon.
- **Tropical cyclones**: genesis conditioned on SST > 26.5 °C, sufficient mid-level
  humidity, low shear, and latitude > 5°; intensity capped by potential intensity theory
  (Emanuel 1986) from SST and outflow temperature. Passage delivers extreme wind and rain,
  and drives landslides, reef damage, defoliation, and — critically — **overwater
  dispersal of organisms** (`docs/03e` §5). Storms are how the island receives its life.

## 6. Simplifications, stated

| We simplify | Consequence | Why acceptable |
|---|---|---|
| No 3-D dynamical core | no resolved deep convection, no self-organised circulation | out of compute budget by orders of magnitude; the imposed-flow + resolved-response split is standard regional practice |
| Grey-band radiation, not line-by-line | ~few W/m² bias | budget still closes exactly; bias documented |
| Linear orographic theory | breaks for very steep terrain and blocked flow (Froude < 1) | flagged at runtime; blocked-flow regime approximated by a flow-diversion correction |
| Slab ocean, no dynamic currents | no ENSO-like variability | a prescribed interannual oscillator is a Milestone-3 addition |
| Aerosols and chemistry absent | no volcanic-haze radiative forcing | eruption-driven forcing is a planned addition; the coupling matters for the object |

## 7. References

Bolton (1980) *Mon. Wea. Rev.* 108:1046 · Brutsaert (1975) *WRR* 11:742 ·
Monteith (1965) *Symp. Soc. Exp. Biol.* 19:205 · Smith & Barstad (2004) *J. Atmos. Sci.*
61:1377 · Roe (2005) *Annu. Rev. Earth Planet. Sci.* 33:645 · Emanuel (1986) *J. Atmos.
Sci.* 43:585 · Kasten & Czeplak (1980) *Solar Energy* 24:177 · Laskar et al. (2004)
*A&A* 428:261 · Dozier & Frew (1990) *IEEE TGRS* 28:963 (horizon/sky-view).
