# 05 — The Kinetic Score: Driving Light, Motion, and Sound

**Status:** Normative for the actuation port. Version `KS/1`.
**Audience:** anyone building the physical piece, its firmware, or a future re-housing.

---

## 1. What a Kinetic Score is

A **Kinetic Score** is a declarative document that maps StateFrame fields
(`docs/04` §5) onto physical output channels. It is *art direction as data*: separate from
the simulation, versioned independently, and replaceable without touching a line of kernel
code.

```
StateFrame  ──►  Kinetic Score  ──►  Channel values  ──►  Motion Envelope  ──►  Hardware
 (physics)        (art direction)      (normalised)        (safety/smoothing)     (drivers)
```

This separation is what lets one island drive a wall-mounted framed piece, a table
vitrine, a future all-mechanical instantiation, and a gallery-scale installation — all from
the same physics. It also means the studio can issue a revised score as a *conservation
update* without ever altering the artwork's history.

## 2. Design principles

1. **Nothing moves faster than nature.** Every mechanical channel is rate-limited to a
   speed that reads as growth, tide, or weather. If a viewer can see a servo *seek*, the
   piece is broken.
2. **Silence is a specification.** Audible actuator noise is a defect. Metal-geared servos
   under continuous PWM hum; therefore continuous-hold channels use either non-back-drivable
   mechanisms with power-off holding, or magnetic/flexure suspensions. See §7.
3. **Light frames the display; it never competes with it.** The image is the work
   (`docs/09`), and every lighting channel here surrounds and answers it. Emitters sit
   behind the plique-à-jour enamel so the material is lit *through*, never in front of it,
   and never visible. No channel may cast light onto the panel itself.
4. **The score never invents.** Every channel traces to a physical quantity. If nothing in
   the island justifies a movement, nothing moves. Idle is a legitimate and frequent state.
5. **Degrade gracefully.** With half the channels dead the piece must still be beautiful and
   still be truthful. Channels carry a priority class; a reduced-capability Heart drives the
   high-priority set only.

## 3. Channel classes

### 3.1 Light (priority A — never omitted)

| Channel | Type | Source field | Notes |
|---|---|---|---|
| `sun.intensity` | 16-bit PWM | `sky_luminance` | perceptual (CIE L*) curve, not linear |
| `sun.cct` | dual-white mix | `sky_colour_temp_K` | 1800 K at horizon → 6500 K at zenith, from real Rayleigh/Mie path length |
| `sun.angle` | 2-axis gimbal or emitter array | `sun_elevation/azimuth` | throws the room's light from the same direction as the sun on the display, so the object and its image agree |
| `sky.dome` | RGBW array | cloud, humidity, sun elevation | overcast is *diffuse and flat*; clear is *hard and directional*. The difference between them is what a viewer feels as weather |
| `moon.*` | PWM + CCT | `moon_phase`, `moon_elevation` | 4100 K, ~0.3 % of solar. Nights must be genuinely dark |
| `canopy.glow` | RGB behind enamel leafwork | `canopy_greenness`, `bloom_index` | drives the demantoid green of the reference plate |
| `water.caustics` | patterned emitter | `sea_state`, sun angle | slow, non-repeating |
| `lava.glow` | deep red/orange | `event_flags.eruption`, chamber pressure | black-body from actual magma temperature (~1100 °C ⇒ 1370 K appearance) |
| `chronicle.marker` | single point source | speciation / extinction / colonisation flags | a slow pulse the owner learns to recognise. Rare. Meaningful |

### 3.2 Motion (priority B)

| Channel | Actuator | Source | Range / rate limit |
|---|---|---|---|
| `tide.ring` | stepper or clock movement | `tide_phase` | full cycle 12 h 25 min sim, continuous |
| `sea.swell` | 2–3 coupled servos under a shaped element | `sea_state`, wind | ±4°, ≤ 2°/s |
| `canopy.sway` | flexure + voice coil | `wind_speed`, gustiness | ±2°, resonant with the element's own period |
| `pendant.drops` | gravity + damped magnetic drive | wind, precipitation | free-swinging; driven only to sustain |
| `season.armature` | geared stepper, non-back-drivable | `season_phase` | one revolution per sim-year — i.e. one per real day |
| `subsidence.index` | linear actuator or micrometer screw | `island_age`, `reef_stage` | **moves millimetres per decade.** A physical record of deep time the owner can measure with a loupe |
| `weather.vane` | continuous rotation | `wind_dir` | ≤ 6°/s, heavily damped |
| `bloom.aperture` | shape-memory or micro-servo | `bloom_index` | opens over hours; a rare event |

`subsidence.index` deserves emphasis: it is a mechanism whose entire visible travel is
consumed over the object's lifetime. It cannot be faked, cannot be rushed, and constitutes
physical proof that the island has been running. It is the piece's hour hand.

### 3.3 Sound (priority C, default off)

Bells, chimes, or a plucked string, struck mechanically — never a speaker. Struck on
chronicle events only. Most owners will hear their island fewer than a dozen times a year.
Default state is silence, user-enabled.

### 3.4 Other

Mist/humidity (sealed micro-nebuliser, **not** in the same chamber as any metal or enamel —
see conservation constraints in `docs/06`), and thermal channels (Peltier, a few degrees) —
both optional, both Milestone-4, both with hard conservation review before approval.

## 4. Score file format

Human-writable TOML, machine-validated against a schema. Example:

```toml
schema = "KS/1"
score  = "Vitrine No.1 — Plique-à-jour"
piece  = "table"

[channel."sun.intensity"]
driver   = "pwm16"
address  = "led0:ch0"
source   = "sky_luminance"
transfer = "perceptual_L"          # from transfer library, not ad-hoc math
domain   = [0.0, 1.0]
range    = [0.0, 1.0]
priority = "A"

[channel."season.armature"]
driver     = "stepper"
address    = "motion0:m2"
source     = "season_phase"
transfer   = "linear_wrap"
range_deg  = [0.0, 360.0]
max_deg_s  = 0.02                  # ≈ one revolution per real day
accel_deg_s2 = 0.005
deadband_deg = 0.05                # never dither
hold       = "mechanical"          # non-back-drivable; unpowered at rest
priority   = "B"

[channel."chronicle.marker"]
driver   = "rgb"
address  = "led1:ch4"
source   = "event_flags"
trigger  = ["speciation", "extinction", "colonisation"]
envelope = { attack_s = 8.0, hold_s = 120.0, release_s = 240.0 }
colour   = { speciation = "#8FBF5A", extinction = "#6E3B4E", colonisation = "#E8D9A0" }
priority = "A"
```

Transfer functions come from a **fixed, versioned library** (`linear`, `perceptual_L`,
`gamma`, `smoothstep`, `log10`, `ema`, `deadband`, `linear_wrap`, `hysteresis`). Arbitrary
expressions are forbidden: a score must be auditable and must not be able to hide logic
that contradicts the physics.

## 5. Motion Envelope — the safety and grace layer

Every mechanical channel passes through, in order:

1. **Deadband** — ignore changes below threshold. Kills dithering.
2. **Slew limit** — clamp `|Δ|` per tick to `max_rate`.
3. **S-curve** — jerk-limited acceleration profile. No visible snap.
4. **Soft limits** — clamp to the mechanism's safe travel, inside the hard endstops.
5. **Thermal/duty guard** — track actuator duty cycle; back off before heating. Heat is the
   enemy of both servos and enamel.
6. **Watchdog** — if no frame arrives within `T_timeout`, ease all channels to a defined
   **rest pose** over 30 s and power down holds. A dead Heart must never leave the piece
   straining or in an ugly attitude. It should look asleep, not broken.

The envelope is implemented in firmware, below the score, and is **not** score-configurable
beyond declared per-channel limits. Art direction cannot override safety.

## 6. Wire protocol

Kernel/score host → motion controller, over USB-CDC or UART, 8-byte-aligned:

```
0x4B 0x53          magic
u8  version
u8  msg_type       0=frame, 1=config, 2=query, 3=estop, 4=heartbeat
u16 seq
u16 n_channels
{ u16 channel_id, i32 value_q16_16 } × n
u32 crc32c
```

Fixed-point `Q16.16` on the wire — no float ambiguity across MCU toolchains. Heartbeat at
5 Hz; missing three consecutive heartbeats triggers the watchdog rest pose. `estop` is
honoured unconditionally and latches until a power cycle.

**Lighting** may alternatively be driven over DMX512/RDM so that gallery and installation
formats interoperate with standard theatre equipment. The channel map is published.

## 7. Actuator selection notes

Hard-won constraints for whoever builds this:

- **Hobby servos are unacceptable.** Potentiometer feedback dithers, gears backlash, and
  they hum continuously under load. Use closed-loop BLDC micro-gimbals, or stepper +
  harmonic/cycloidal reduction, or non-back-drivable worm drives that hold with power off.
- **Prefer mechanisms that hold without power.** Lower heat, silent, and they survive the
  Heart dying mid-pose.
- **Magnetic coupling through the enclosure wall** wherever motion must cross a sealed
  boundary. No dynamic seals, no dust ingress, no lubricant migration onto enamel.
- **Flexures over bearings** for small-amplitude motion. No lubricant, no wear, no noise,
  and a fatigue life in the 10⁸-cycle range if designed within stress limits.
- **LED binning matters.** Across 404 pieces the sun must be the same sun. Specify bin,
  CRI ≥ 95, R9 ≥ 90, and hold a lifetime buy of matched reels in escrow with the spare
  Hearts.
- **No UV.** Emitter spectra must be filtered below 400 nm: UV degrades enamel colourants,
  organic sealants, and any paper in the piece over decades.

## 8. Scores as editioned works

A Kinetic Score is signed, versioned, and archived with the edition. The score shipped with
piece *n* is recorded on its certificate. Later scores may be issued — as conservation
updates, or as an artist's revision — and the owner may choose to install one or not. The
island underneath is untouched either way.

This is a real and deliberate parallel to a musical score and its performances: **the
physics is the composition; the score is an interpretation; the object is a performance
that has been going on, without interruption, since the day it was lit.**
