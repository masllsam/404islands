# hardware/

Everything that turns a StateFrame into something you can stand in front of.
Normative specifications live in `docs/05-KINETIC-SCORE.md` (channels, envelopes, wire
protocol) and `docs/06-MATERIALS-CONSERVATION.md` (materials, the Heart, service).

```
hardware/
  scores/     Kinetic Scores -- art direction as data, one per physical format
  README.md   this file
```

## Scores

`scores/vitrine-01.toml` is the reference score for the table-mounted format. Load and
evaluate it against a live island with:

```bash
python -m kernel.cli --seed island-001 --years 10 --score hardware/scores/vitrine-01.toml
```

A score maps StateFrame fields onto physical channels through a fixed, versioned transfer
library. It never contains logic. That restriction is what lets one island drive a
wall-mounted frame, a table vitrine, a gallery installation, and — one day — an entirely
mechanical instantiation, from the same physics.

**Rate limits in a score are aesthetic decisions with mechanical consequences.** If a
viewer can see a channel seek its target, the number is wrong. Read `docs/05` §2 before
editing one.

## Still to be built (Milestone 4, `docs/08`)

- **The Heart** — sealed compute-and-motion module, ~90 × 90 × 18 mm, kinematic three-point
  mount, one connector, no battery, no fan, no moving part. Published as an open standard
  so anyone can build a replacement in any century.
- **Motion controller firmware** — implements the Motion Envelope (deadband → slew → S-curve
  → soft limits → duty guard → watchdog rest pose) *below* the score, where art direction
  cannot override it.
- **`subsidence.index`** — the hour hand of the piece. A linear mechanism whose entire
  visible travel is consumed over the object's lifetime, read against an engraved scale
  with a loupe. It cannot be faked and it cannot be rushed.
- **Relief carving pipeline** — StateFrame → 5-axis toolpath → alumina and gold. Used at
  first making and again at each Recarving (`docs/06` §3).
- **Actuator qualification** — silence, zero backlash, hold-without-power, 10⁸-cycle flexure
  life. Hobby servos are excluded by specification, not by preference.
- **Optical chain** — light guides in fused silica behind plique-à-jour enamel, emitters
  filtered below 400 nm, LED binning and a lifetime buy held in escrow with the spare
  Hearts.

## Hard constraints, repeated here because they are easy to lose

1. No UV reaches any enamel, gemstone, or paper. Filter below 400 nm.
2. Every material inside the sealed volume is Oddy-tested before approval. No exceptions,
   including for materials we like.
3. No dynamic seals. Motion crosses the enclosure wall by magnetic coupling.
4. Temperature change under 2 K/h. Thermal shock is the leading cause of enamel loss, and
   enamel loss is not repairable, only disguisable.
5. Nothing in the piece may require a network, an account, or us.
