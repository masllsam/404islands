# 04 — StateFrame: The Kernel's Only Output

**Status:** Normative wire format. Version `SF/1`. Changes require a version bump and a
migration note; old frames must remain readable forever.

---

## 1. Why this document exists

Everything downstream of the kernel — the display, the servos, the lights, the certificate,
the studio tooling, and whatever renders these islands in 2140 — consumes this and only
this. If the format is right, the artwork outlives its implementation. That is the whole
game.

Design rules:

1. **Self-describing.** A frame carries its schema version and unit metadata. No external
   knowledge is required to interpret it.
2. **Canonical.** One state ⇒ exactly one byte sequence. Fixed field order, fixed
   endianness (little), no floats-as-text, no maps with unstable ordering.
3. **Verifiable.** Every frame carries its own hash and links to its predecessor.
4. **Boring.** CBOR (RFC 8949) with deterministic encoding, plus a documented plain-binary
   layout for the embedded delta path. No bespoke compression in the archival path.
5. **Hashed with BLAKE2b-256** (RFC 7693), not with something newer. It is specified in an
   RFC, it is in the Python standard library, it is in every serious crypto library, and it
   is overwhelmingly likely to still be implementable from its written specification in two
   hundred years. Longevity beats fashion, and this is a hash that has to outlive us.

## 2. Two frame kinds

| | **Full frame** | **Delta frame** |
|---|---|---|
| Cadence | every sim-year, and on request | every `T_FAST` tick |
| Purpose | restart, archive, audit | drive render + kinetic ports |
| Size | ≤ 8 MB | ≤ 4 KB, fixed layout, zero allocation |
| Contains | complete state incl. all fields, cohorts, genetics | scalars and small aggregates only |
| Written to | non-volatile store, ×3 rolling generations | ring buffer in RAM |

## 3. Common header

```
magic         "404I"          4 bytes
sf_version    u16             wire format version
kernel_semver u8[3]           kernel that produced it
island_id     u16             1..404  (0 = studio/uncertified)
genesis_seed  u8[32]          the Soul (docs/01 §5)
tick          u64             ticks since ignition
sim_time      f64             sim-seconds since ignition
frame_kind    u8             0 = delta, 1 = full
prev_hash     u8[32]          BLAKE2b-256 of previous frame of the same kind
payload_len   u32
payload       …
frame_hash    u8[32]          BLAKE2b-256 over everything above
```

`chain_hash` is maintained separately by the provenance port as a Merkle root over full
frames, published quarterly (`docs/07`).

## 4. Full-frame payload — top level

```
grid        { nx, ny, cell_size_m, origin_lat, origin_lon, projection }
geo         { bedrock_z, soil_depth, lithology_id, regolith_texture,
              flow_dir, drainage_area, reef_thickness, subsidence_accum,
              magma_chamber_pressure, volume_erupted, sea_level }
atmos       { T_air_2m, T_surface, q_vapour, cloud_frac, precip_rate, snow_depth,
              wind_u, wind_v, SW_down, LW_down, SST, orbital_state }
hydro       { soil_moisture[6], water_table, lake_stage, discharge,
              lens_thickness, salinity, sediment_load }
bio         { patches[] → cohorts[] { lineage_id, n, dbh, height, biomass_pools },
              LAI, albedo, litter_pools, soil_C_pools[4], N_avail, P_avail, P_occluded,
              consumers[] { lineage_id, n, mean_mass } }
evo         { lineages[] { id, parent_id, trait_means[7], trait_var[7],
              allele_freqs, N_e, born_tick }, chronicle_cursor }
ledger      { energy_in, energy_out, energy_stored, water_*, carbon_*, residuals }
```

Fields are stored as `f32` arrays unless the ledger requires `f64`; the ledger, all
accumulators, and anything feeding a conservation check are `f64` without exception.
Field arrays are row-major, `y` outer.

Units are SI throughout, declared in the schema table. No exceptions, no "convenient" units
anywhere in the kernel — every historical simulation disaster in this genre traces back to a
unit that was convenient once.

## 5. Delta-frame payload — fixed layout

Optimised for the Heart's real-time loop and for the kinetic port. Fixed size, no dynamic
structures, safe to read from an interrupt context.

```
sun_elevation_deg      f32     sun_azimuth_deg        f32
moon_phase             f32     moon_elevation_deg     f32
sky_luminance          f32     sky_colour_temp_K      f32
cloud_frac             f32     precip_rate_mm_h       f32
wind_speed_ms          f32     wind_dir_deg           f32
T_air_mean_C           f32     T_range_C              f32
SST_C                  f32     sea_state_0_9          f32
tide_phase             f32     lake_stage_norm        f32
river_discharge_norm   f32     lens_health_0_1        f32
LAI_mean               f32     canopy_greenness       f32
bloom_index            f32     senescence_index       f32
NPP_norm               f32     fire_activity          f32
species_count          u16     population_stress      f32
event_flags            u32     (eruption, quake, cyclone, landslide,
                                fire, bloom, speciation, extinction,
                                colonisation, reef_stage_change, …)
season_phase           f32     year_fraction          f32
island_age_years       f64     reef_stage             u8
ledger_ok              u8      residual_exponent      i8
```

**Note the design choice:** the delta frame is deliberately *interpretive* — it carries
`canopy_greenness` and `sea_state`, not raw arrays. It is the layer at which the simulation
becomes describable, and therefore the natural place for an art-direction contract. The
kinetic score (`docs/05`) is defined purely over these fields, which is what allows a
future physical instantiation with entirely different hardware to be driven by the same
island.

## 6. Compatibility rules

- **Never remove or reorder a field.** Deprecate by documentation only.
  *History:* `SF/1` shipped 30 delta fields at kernel 0.1; `convective_cloud` and
  `squall` were appended at kernel 0.2 for the fast clock. A 0.1 reader still parses a
  0.2 frame correctly up to field 30 and reports the remainder as unknown, which is the
  compatibility rule working as intended rather than a version break.
- **New fields append**, with a defined value meaning "not produced by this kernel".
- A reader encountering `sf_version` greater than it knows must read the fields it
  recognises and report the remainder as unknown rather than failing.
- Every version of this document is retained in `docs/history/` forever.

## 7. Storage on the object

Full frames written in triplicate to independent flash regions with rolling generations
`(gen, hash)`, committed by a final atomic generation-counter write. A power loss can lose
at most the most recent sim-year, and can never leave a piece unable to start. Verified by
the power-loss injection test (`docs/03f`).

Additionally, once per sim-century, a **checkpoint capsule** — genesis seed, kernel
version, input log hash, and full frame hash — is emitted for the certificate record. This
is the audit trail that lets a third party in any future year prove that the object in the
vitrine is the object the certificate describes.
