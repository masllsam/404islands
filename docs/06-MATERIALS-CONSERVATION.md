# 06 — Materials, Making, and Conservation

> **Kurzfassung (DE).** Der Körper aus Gold, Platin, Emaille, Aluminiumoxid-Keramik,
> Saphir und harten Edelsteinen hält Jahrhunderte. Die Elektronik nicht — sie ist
> absichtlich ein austauschbares Serviceteil in einem dokumentierten Sockel. Das
> Wichtigste: **das Bild der Insel ist kein Display.** Es ist ein echtes, in Keramik und
> Gold geschnittenes Relief, auf dem Licht und Schatten spielen. Displays altern, Relief
> und Licht nicht. Und alle 25 Jahre darf der Besitzer das Relief neu schneiden lassen —
> nach dem *aktuellen* Zustand der Insel. Die alten Reliefs bleiben im Sockel liegen, wie
> Bohrkerne. Das Objekt sammelt seine eigene Erdgeschichte als physische Schichten.

---

## 1. The permanence problem, restated correctly

Nothing with electricity in it lasts 300 years. Every attempt to make electronics permanent
fails, and pretending otherwise would make the work dishonest.

So the electronics are not asked to be permanent. The design instead follows one rule:

> **Anything that must last is passive. Anything active is serviceable.**

And one consequence, which is the most important engineering decision in the whole project:

> **The island's landscape is not displayed. It is carved.**

## 2. The relief — why the primary image is physical

A screen is a light source pretending to be a surface. It ages (organic emitters decay,
polarisers yellow, backlights shift, drivers fail), it is anachronistic within twenty
years, and it looks like a screen — which is to say, like everything else.

The primary visual element of the piece is therefore a **physical bas-relief of the actual
simulated terrain**, cut by 5-axis CNC and hand-finished, in high-purity alumina ceramic
with selective gilding, at a vertical exaggeration of ~2.5×. Around and through it:
plique-à-jour enamel for water and canopy, gemstone-set reef and shoreline, gold whiplash
lines for the principal watercourses.

Light and motion then do the living part:

- The sun crosses at its real angle and **casts real shadows into real valleys**. At low
  sun the canyons go black and the ridges catch. Nothing on a display comes close, and it
  will not look dated in 2150.
- Weather is diffuse vs. hard light, and colour temperature.
- Vegetation is coloured light through translucent enamel.
- Water level, tide, sea state, season, and deep time are mechanical (`docs/05` §3.2).

Optionally, a small high-density display sits behind a sapphire window in the base as an
**instrument panel** — the chronicle, the ledger, the numbers — explicitly framed as
equipment, not as the artwork. When it dies, the artwork is undiminished. This is the
correct place for a screen: subordinate, honest, replaceable.

## 3. The Recarving — the piece keeps its own strata

The relief is the island as it was at a moment. The island moves on. So:

**Every 25 years, the owner may commission a Recarving.** The current state frame is taken,
a new relief is cut and finished, and it replaces the one in the piece. The old relief is
not discarded — it is archived in a drawer in the base, edge-labelled with its dates, like a
stack of core samples.

After a century the piece holds four reliefs. Lift them out and lay them side by side and
you are holding the island's geological history in your hands: the valleys deeper, the
reef wider, the summit lower. Nobody has to explain what happened. You can *see* it, and
you can measure it with callipers.

The Recarving is a service ritual (like re-gilding an icon or servicing a movement), a
renewal of the relationship between studio and owner, and — bluntly — the mechanism by
which the workshop remains alive and funded long enough to still exist when the Hearts need
replacing.

## 4. Material schedule

### 4.1 Permanent — the Vessel

| Material | Use | Longevity | Notes |
|---|---|---|---|
| **18k / 22k gold** | frame, whiplash line-work, settings, bezels | millennia | chemically immune; 18k for structure, 22k where colour matters. Four-colour gold alloying (yellow/green/red/white) is Fabergé practice and available |
| **Platinum (950/Ir)** | the Soul plate, high-stress pivots | millennia | inert, tough, does not work-harden badly |
| **Vitreous enamel** on gold | plique-à-jour canopy and water, guilloché sky, champlevé fields | millennia (glass) | brittle; sensitive to thermal shock and impact, not to time. Lead-free formulations only |
| **High-purity alumina (99.7 %)** | relief substrate, structure | geological | chosen over zirconia deliberately — see §4.3 |
| **Synthetic sapphire** | windows, engraved Soul plate, wear surfaces | geological | Mohs 9, chemically inert, optically stable |
| **Fused silica** | light guides, optical elements | geological | no yellowing, unlike any polymer |
| **Demantoid / tsavorite garnet** | the greens of the reference plate | permanent | Mohs 7–7.5, no cleavage, stable — the durable route to that colour |
| **Green sapphire, spinel, chrome diopside** | supporting greens | permanent | |
| **Titanium Gr5 / niobium** | internal chassis, fasteners | centuries | light, corrosion-proof, non-magnetic |
| **Rock crystal, agate, nephrite** | carved bases, hardstone elements | geological | Fabergé's hardstone tradition |

### 4.2 Permitted with reservations

| Material | Reservation |
|---|---|
| **Peridot** | Exactly the colour of the reference plate — but Mohs 6.5–7, brittle, attacked by acid and by sweat. Permitted only in protected, non-contact settings. Prefer demantoid/tsavorite where the piece is handled |
| **Emerald** | Heavily included, cleaves, and almost always oiled — the oil dries out and the stone visibly changes over decades. Avoid |
| **Pearl / nacre** | Organic. Dries, crazes, and dulls in 50–150 years. The reference plate's seed pearls should be reinterpreted in white sapphire or moonstone if permanence matters, or accepted as an explicitly mortal element |
| **Amethyst** | Fades under UV. Acceptable only where the lighting spectrum is filtered below 400 nm (`docs/05` §7) |
| **Silver** | Tarnishes. Only in sealed, inerted compartments, if at all |

### 4.3 Forbidden

- **Zirconia (Y-TZP)** as a structural ceramic — it suffers **low-temperature degradation**
  (tetragonal→monoclinic transformation) in humid conditions over decades, with surface
  roughening and microcracking. Well documented in medical implants. Alumina instead.
- **Structural polymers, adhesives, and elastomers** in any load path or seal that must
  outlive the Heart. All permanent joins are mechanical, brazed, or fused.
- **Plated finishes.** Plating wears through and reveals a lie. Solid material or nothing.
- **Aluminium electrolytic capacitors, lithium chemistry, and any wet cell** anywhere in
  the piece. Electrolytics dry out and leak; lithium ages and can vent. Solid-state
  capacitors and supercapacitors only, and even those live in the Heart.
- **Foams, felts, and organic dampers.** They crumble, off-gas, and stain enamel.
- **Anything that off-gasses acetic or formic acid** (many silicones, some woods, some
  adhesives) — it corrodes metal and etches glass inside a sealed vitrine. Standard museum
  Oddy-test practice applies: every material in the enclosure is Oddy-tested before
  approval. No exceptions, including for materials we like.

## 5. The Heart — designed to be replaced

A sealed module, ~90 × 90 × 18 mm, in a published mechanical and electrical standard:

- Kinematic three-point mount to a titanium datum — repeatable to microns, no adjustment,
  no adhesive.
- One connector: power in, differential signal out, ground. Gold-plated, over-specified
  contact force, rated for hundreds of mating cycles.
- Contains: SoC, non-volatile store (3× redundant), motion controller, LED drivers,
  supercapacitor for graceful shutdown. No battery, no fan, no moving part.
- Conformally sealed; convection-free conduction cooling into the chassis.
- Replaceable with a single tool in under ten minutes, by anyone competent, without
  disturbing a single permanent element.

**Escrow.** Manufactured with the edition: 404 + 25 % spare Hearts, plus matched LED reels,
plus complete fabrication files, firmware sources, toolchain containers, and test vectors —
deposited with an independent trust alongside the printed kernel specification. Hearts are
stored unpowered, dry, and cool (the correct way to store flash and silicon for decades),
with a documented refresh protocol.

**The right to reimplement.** The Heart specification, the StateFrame format, the kinetic
score format, and the kernel specification are published under an irrevocable open licence.
Any competent engineer, in any century, may build a new Heart for an island. We may not be
here. The islands should not depend on us.

## 6. Environmental envelope and care

| Parameter | Specification |
|---|---|
| Temperature | 15–25 °C; **rate of change < 2 K/h** (enamel and gold have different expansion coefficients; thermal shock is the leading cause of enamel loss) |
| Relative humidity | 40–55 %, non-condensing |
| Light on the piece | < 150 lux ambient; no direct sunlight; internal emitters filtered < 400 nm |
| Atmosphere | Sealed vitrine, dry inert fill (argon) for the enamel and optics chamber; a silica-gel/Art-Sorb cassette accessible for service |
| Vibration/shock | Isolated mount; the relief and enamel are the fragile elements, not the electronics |
| Cleaning | Dry, soft brush only. **No solvents, no ultrasonics, no ammonia** anywhere near enamel or gemstones |

Delivered with the piece: a conservator's dossier in the standard museum format — full
material inventory with Oddy results, construction drawings, damage-and-repair record, and
named treatment protocols. Written for a conservator in 2180 who has never heard of us.

## 7. Failure modes we accept, and what happens

| Failure | When | Consequence | Remedy |
|---|---|---|---|
| Heart dies | 15–40 yr | Island pauses; **no state lost** (checkpoints) | Swap Heart; resume from last full frame |
| LED output shifts/dims | 20–50 yr | Colour drift | Replace emitter board (part of the Heart) and re-calibrate to the published spectrum |
| Actuator wear | 30–80 yr | Channel drops out | Replace; envelope already degrades gracefully (`docs/05` §2.5) |
| Instrument display fails | 10–25 yr | Panel dark | Replace, or leave dark — the artwork is unaffected |
| Enamel chip | impact | Visible loss | Conservator repair; recorded in the dossier. Honest repair, never invisible restoration |
| All electronics unavailable | any time | Piece is static | Mechanical element still winds and runs (`docs/01` §6); the Soul plate still carries the seed; the island can be recomputed elsewhere and, if desired, recarved |

The last row is the one that matters. **There is no failure mode in which the artwork is
lost.** There are only failure modes in which it is asleep.
