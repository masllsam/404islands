# 09 — The Display: What the Piece Shows

> **Kurzfassung (DE).** Das Werk ist ein Display. Darauf läuft die Insel als Grafik —
> nicht als Video, sondern live aus der Simulation gerendert: echtes Gelände aus dem
> Erosionsmodell, echter Sonnenstand mit echtem Schattenwurf, Wolken dort wo die Luft
> aufsteigt, Grün dort wo Blattfläche ist, Flüsse dort wo Abfluss ist. Jeder Pixel lässt
> sich auf eine Zustandsgröße zurückführen. Zweite Ansicht ist der **Atlas**: jedes
> simulierte Feld einzeln, beschriftet — damit man sieht, dass wirklich alles gerechnet
> wird. Das Gehäuse aus Gold, Emaille und Saphir rahmt das Display; Licht und Bewegung
> antworten darauf. Das Display ist ein Serviceteil, das ersetzt wird — die Insel selbst
> lebt im Seed und im Algorithmus.

**Status:** Normative for the render port. The piece's primary surface.

---

## 1. The display is the work

The object is a display in a vessel. What it shows is the island, rendered live from the
simulation, continuously, for as long as the piece has power. Not a recording, not a
pre-baked animation, not a stylised impression — the state of the world, drawn.

Everything else in the object — the gold, the enamel, the gemstone setting, the light, the
kinetic channels of `docs/05` — frames and answers the display. They are the reliquary.
The image is the relic.

This is stated plainly because an earlier revision of this specification demoted the
display in favour of a carved physical relief, on longevity grounds. That was the wrong
trade: it solved a materials problem by removing the thing the work is. The longevity
answer is in §7 and it does not require giving up the image.

## 2. Two faces

### 2.1 The scene — the island as it looks

A perspective view of the island, lit by its own sun. Reference implementation:
`kernel/ports/render.py`.

Every element traces to a state variable. Nothing is decorative invention:

| What you see | What it is |
|---|---|
| The land's shape | `state.z` — the surface the stream-power and hillslope models carved |
| Sun position, and the shadow it casts into the valleys | `orbital.sun_position` from the Kepler solution |
| Colour temperature of the light, from 1800 K at the horizon to 6500 K at zenith | atmospheric path length at the computed solar elevation |
| Green | leaf area index, hue by the winning lineage's trait mix |
| Gold and brown ground | bare regolith, reddening with substrate age — the same variable the phosphorus budget reads |
| Gold watercourses | discharge on the D8 flow network |
| Sea colour | depth, by Beer's-law extinction |
| The turquoise rim | `reef_thickness` where coral actually accreted |
| Cap cloud over the summit | orographic uplift; it rides *over* the ridge that lifts it |
| Broken trade cloud | coverage from the frame's cloud fraction, advected downwind at the simulated wind speed |
| Cloud shadows crossing land and water | the same cloud field, sampled along the sun ray |
| Snow | terrain above the freezing level from the actual lapse rate |
| Surf at the shoreline | depth and sea state |

**Consequence to protect:** if a change makes the image prettier but severs a pixel from
its state variable, reject it. The one thing this display must never become is an
illustration of a simulation.

### 2.2 The atlas — the island as it is

A grid of labelled panels, one per state field: elevation, rainfall, leaf area, biomass,
discharge, soil depth, substrate age, soil carbon, phosphorus, nitrogen, reef thickness,
freshwater lens. Reference implementation: `kernel/ports/atlas.py`.

This is the face that makes the claim checkable. In the atlas a viewer can *see* that the
windward side really does get the rain, that the biomass really does follow it, that the
soil really does age away from the summit, and that phosphorus and nitrogen limit in
complementary places. The header carries the island number, year, reef stage and species
count; the footer carries the seed and the ledger's residual exponent.

Turning the piece from the world to its own instrumentation is the same gesture as opening
a skeleton watch. It is where the object stops being beautiful and starts being credible.

```bash
python -m kernel.cli --seed island-001 --years 30 --post-shield 300000 \
    --hour 8.5 --image scene.png --atlas atlas.png --image-size 1000x625
```

## 3. Art direction

From the Belle-Époque reference plate (`docs/01` §8), binding:

- **Palette:** demantoid and peridot greens; old gold for watercourses and dry ground;
  a black ground and a vignette, because that is what makes green read as luminous.
  Amethyst and rose only where the simulation earns them.
- **Light from inside.** The scene is lit by its own sun and sky, never by a studio key
  light. At night it is genuinely dark, with the moon at its real phase and elevation.
- **Slowness.** Nothing snaps. The presentation rate (`docs/02` §4.1) is one island-year
  per real day, so the sun crosses the sky in four real minutes and the seasons take a day.
- **No interface.** No buttons, no cursors, no chrome on the scene face. The atlas face
  carries labels and nothing else.

## 4. What the viewer can change

Framing only: view azimuth, elevation, zoom, and which face is shown. The simulation is
never altered by looking at it. Owner interventions are limited and logged
(`docs/07` §4) — and none of them live in the display.

## 5. Resolution, rate, and honesty about both

| | Target |
|---|---|
| Panel | 2560 × 1600 or better, 10-bit, matte, no visible pixel structure at 400 mm |
| Refresh | 30 fps for the scene; the atlas updates once per sim-day |
| Simulation grid | 128 × 128 (the display resolves far more than the physics does) |
| Peak brightness | 180 cd/m², calibrated; the piece must never be brighter than a lit room |
| Colour | DCI-P3, factory-profiled per unit, profile archived with the certificate |

The display resolves more than the simulation does. That gap is handled by interpolation
(Catmull-Rom on the terrain, so a 240 m grid does not show terracing) and it is stated
here rather than hidden: **the image is smooth between cells; the physics is not.** The
atlas face shows the raw cells, at their real resolution, deliberately.

## 6. The runtime path

The reference renderer is a NumPy software raymarcher: readable, dependency-free, ~10 s a
frame. It exists to *specify* the image, not to produce it in the object.

The runtime renders the same description as a GPU shader on the Heart:

- Terrain by heightfield raymarch with a min-max mip pyramid for empty-space skipping.
- Shadows from the same pyramid, one ray per pixel.
- Water as an analytic plane with Beer's-law extinction and a Fresnel-weighted sky term.
- Clouds as a displaced deck with a two-step fixed point, exactly as in the reference.
- Everything driven from the StateFrame (`docs/04`), never from kernel internals.

**Gate:** the shader must match the reference renderer within a published perceptual
tolerance on a fixed set of test frames. The image is part of the specification, so it is
part of what a future re-implementation has to reproduce.

## 7. Longevity, honestly

Displays fail. Panels dim and shift, backlights die, drivers become unbuildable, connectors
become unobtainable. A display is a **20-to-40-year part**, and no engineering makes it a
300-year part.

So the display is designed as a serviceable module, on the same footing as the Heart
(`docs/06` §5):

- Standard mechanical aperture and mount behind a sapphire window, so a future panel of
  different technology can be fitted without touching a single permanent element.
- Panel-independent colour management: the piece stores its intended colorimetry, and each
  replacement panel is profiled to it. An island lit in 2190 should look as it did in 2027.
- The interface between Heart and panel is published, as is the renderer's specification.
- Panels are escrowed with the edition, and the *specification* — not the hardware — is the
  thing guaranteed.

And the answer that actually resolves it: **the image is not where the artwork lives.** The
artwork is the seed and the algorithm, engraved in sapphire and platinum inside the piece
and published in print (`docs/01` §5). If every panel ever made has failed, the island can
still be recomputed exactly and shown on whatever displays images in that century. The
display is the window. Windows get reglazed.

What must never happen is the reverse: an island whose *state* is lost. That is why the
checkpointing in `docs/04` §7 is triplicated and the seed is engraved, and why none of that
effort went into the panel.
