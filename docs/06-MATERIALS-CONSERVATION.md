# 06 — Materials, Making, and Conservation

> **Kurzfassung (DE).** Der Körper aus Gold, Platin, Emaille, Aluminiumoxid-Keramik,
> Saphir und harten Edelsteinen hält Jahrhunderte. **Das Werk selbst ist das Display**
> (siehe `docs/09-DISPLAY.md`): darauf läuft die Insel als live gerenderte Grafik. Display
> und Elektronik halten keine 300 Jahre — deshalb sind beide bewusst als austauschbare
> Serviceteile in dokumentierten Fassungen gebaut, hinter einem Saphirfenster. Was bleibt,
> ist der eingravierte Seed und der veröffentlichte Algorithmus: solange beide existieren,
> kann die Insel exakt neu berechnet und auf jedem künftigen Bildschirm wieder gezeigt
> werden. Optional, nicht als Ersatz: alle 25 Jahre ein in Keramik geschnittenes Relief
> des dann aktuellen Zustands, das im Sockel gesammelt wird — wie Bohrkerne.

---

## 1. The permanence problem, restated correctly

Nothing with electricity in it lasts 300 years. Every attempt to make electronics permanent
fails, and pretending otherwise would make the work dishonest.

So the electronics are not asked to be permanent. The design instead follows one rule:

> **Anything that must last is passive. Anything active is serviceable.**

And one consequence, which is the most important engineering decision in the whole project:

> **The image is serviced, not preserved. The seed is preserved.**

The display shows the island; the display is a 20-to-40-year part; and that is fine,
because the artwork does not live in the panel. It lives in the engraved seed and the
published algorithm, from which the island can be recomputed exactly and shown again on
whatever displays images in that century (`docs/09` §7).

## 2. The display is the work

The piece is a display in a vessel, and what it shows is the island rendered live from the
simulation, continuously (`docs/09-DISPLAY.md`). Everything material in this document —
the gold, the enamel, the gemstone setting, the light and motion of `docs/05` — frames and
answers that image. They are the reliquary; the image is the relic.

The panel sits behind a **sapphire window** in a bezel of 18k gold, with the plique-à-jour
enamel and gem-set work carried around the aperture so that the frame and the image read as
one object rather than as a screen someone mounted in jewellery. Emitters for the kinetic
light channels sit behind the enamel, never in front, so the surrounding material is lit
*through* — the same optical principle as the image itself.

An earlier revision of this document argued the opposite: that the primary image should be
a carved physical relief, because displays do not last three centuries. That was the wrong
trade. It solved a materials problem by removing the thing the work is. The longevity
answer is §5 and §7 — service the panel, guarantee the specification — and it does not
require giving up the image.

## 3. The Recarving — an optional companion, not a substitute

The display shows the island now. A **Recarving** captures a moment of it in permanent
material:

**Every 25 years, the owner may commission one.** The current state frame is taken, and a
bas-relief of the island's terrain at that instant is cut by 5-axis CNC in high-purity
alumina and hand-finished with selective gilding, at ~2.5× vertical exaggeration. It is
dated, edge-labelled, and kept in a drawer in the base.

After a century the drawer holds four. Lay them side by side and you are holding the
island's geological history: the valleys deeper, the reef wider, the summit lower. Nobody
has to explain what happened — you can see it, and measure it with callipers.

This is a companion to the display, never a replacement for it. It is also a service
ritual, a renewal of the relationship between studio and owner, and — bluntly — part of how
the workshop stays alive and funded long enough to still exist when the Hearts and panels
need replacing.

## 4. Material schedule

### 4.1 Permanent — the Vessel

| Material | Use | Longevity | Notes |
|---|---|---|---|
| **18k / 22k gold** | frame, whiplash line-work, settings, bezels | millennia | chemically immune; 18k for structure, 22k where colour matters. Four-colour gold alloying (yellow/green/red/white) is Fabergé practice and available |
| **Platinum (950/Ir)** | the Soul plate, high-stress pivots | millennia | inert, tough, does not work-harden badly |
| **Vitreous enamel** on gold | plique-à-jour canopy and water, guilloché sky, champlevé fields | millennia (glass) | brittle; sensitive to thermal shock and impact, not to time. Lead-free formulations only |
| **High-purity alumina (99.7 %)** | relief substrate, structure | geological | chosen over zirconia deliberately — see §4.3 |
| **Synthetic sapphire** | **the display window**, engraved Soul plate, wear surfaces | geological | Mohs 9, chemically inert, optically stable; AR-coated on the inner face only, so the coating is never exposed to handling |
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
| Display panel dims, shifts, or fails | 20–40 yr | The image degrades or stops | Replace the panel module and re-profile to the piece's archived colorimetry (`docs/09` §7). A permanent element is never disturbed |
| Enamel chip | impact | Visible loss | Conservator repair; recorded in the dossier. Honest repair, never invisible restoration |
| All electronics unavailable | any time | Piece is static | Mechanical element still winds and runs (`docs/01` §6); the Soul plate still carries the seed; the island can be recomputed elsewhere and, if desired, recarved |

The last row is the one that matters. **There is no failure mode in which the artwork is
lost.** There are only failure modes in which it is asleep.
