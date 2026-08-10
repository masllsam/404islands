# 404 Islands

**A living atlas of the ocean.**

Four hundred and four islands that do not exist, anchored to four hundred and
four coordinates that do. The land is mathematics — fractal noise, folded and
eroded by a shader running on your own graphics card. Everything above the
waterline is measured: the sun is where the sun actually is, the clouds are the
clouds reported over that patch of ocean in the last hour, the swell is the
swell, and the snowline on a fjordland island slides up and down its own flank
as the temperature at 68° north changes through the day.

Stand still and the render keeps refining until it is clean enough to print.

```
npm start          # http://localhost:8080
npm test           # 58 tests, no dependencies
node scripts/smoke.mjs   # browser checks (needs a global Playwright)
```

No build step. No dependencies. No framework. Open the page and it runs.

---

## What is real and what is generated

This distinction is the whole piece, so it is worth being precise about.

| | Source |
|---|---|
| Coastlines, relief, archetype, name, seed | Generated deterministically from a 32-bit seed. Fixed forever. |
| Latitude and longitude | Assigned once, inside a real archipelagic region. Fixed forever. |
| Temperature, cloud, wind, precipitation, pressure | Live, from [Open-Meteo](https://open-meteo.com) (CC BY 4.0) |
| Wave height, period, sea surface temperature | Live, from the Open-Meteo marine API |
| Sun elevation and azimuth, sunrise, day length | Computed locally from the NOAA solar equations |
| Snowline, wave amplitude, haze, water colour | Derived from the live values above |
| Moonlight | **Invented.** See "Honest seams" below. |

When the feed cannot be reached, the atlas does not freeze and it does not
pretend. It falls back to a physical climate model — seasonal temperature by
latitude, trade winds and westerlies, convection over the ITCZ, fully-developed
sea from wind speed — and the status pill in the masthead turns amber and reads
*modelled* until real observations return.

## How it is drawn

One fragment shader draws the entire world. The terrain is raymarched as a
fractal heightfield with domain warping; the sea is an analytically displaced
plane with a Beer–Lambert water column over it; the sky is a single-scatter
model that runs from polar night through sunrise to noon.

**Motion is cheap, stillness is expensive.** While you drag, the renderer draws
at reduced resolution with a short march budget — whatever the device can hold
at sixty frames a second. The moment you let go, the simulation clock freezes
and the renderer begins stacking jittered samples of that identical instant
into one accumulation buffer. It is an exposure in the photographic sense and
it behaves like one: noise anneals away, edges resolve, shadow detail arrives.
Ninety-six samples later the frame is clean enough to print, and the download
button re-runs the whole exposure at 2400 × 1500.

**The budget is measured, not assumed.** Frame time drives render scale first
and shader tier second, so a five-year-old phone and a workstation both land
near 60 fps with the best image each can hold.

The atlas grid uses a second, shared context that renders a queue of tiles on a
per-frame budget and blits each into the tile's own canvas. Only visible tiles
own a surface, so scrolling all 404 never holds more than a couple of dozen.

## Seven forms of land

Terrain is not one formula with the knobs turned. Each island belongs to an
archetype, and each archetype answers *where does the island stop* differently.

| Form | What it is |
|---|---|
| **Volcanic** | A single young cone, still arguing with the sea |
| **Atoll** | A ring of coral around water that used to be a mountain |
| **Plateau** | A table of old stone, cut off clean |
| **Archipelago** | Not one island. Several, pretending |
| **Sandbar** | A rumour of land. Moves with the season |
| **Fjordland** | Stone that ice went through and left open |
| **Karst** | Towers. Dissolved, not built |

Archetypes are weighted by latitude, which is why there are no coral atolls off
Svalbard and no fjords in the Tuamotus.

## Layout

```
app/                  the artwork — static, no build
  index.html
  styles/             base.css (tokens, type, components), views.css
  src/
    core/             rng, geography, archetypes, names, catalogue, solar
    climate/          live feed, modelled fallback, derivation to uniforms
    gl/               context, renderer, thumbnail factory, shaders
    ui/               router, views, components, formatting
server/index.js       static host + climate cache + reservations
tests/                node:test, no dependencies
scripts/smoke.mjs     browser checks
```

The test suite covers what can be checked without a GPU: that the catalogue is
byte-identical across separate processes, that the solar equations agree with
known astronomy, that the modelled climate is physically plausible for every
island on every date, that the live feed parses Open-Meteo's actual response
shape (including array responses, marine nulls and zone-less timestamps)
against a fake upstream, and that the server refuses path traversal and
validates reservations. `scripts/smoke.mjs` covers the rest: every route
mounts, all three shader tiers compile and run, and the shared GL context
survives navigation.

The terrain mathematics lives **only** in `app/src/gl/shaders/scene.glsl.js`.
There is no second CPU implementation to fall out of sync with it; island
statistics that a human reads are derived from the catalogue parameters, never
re-simulated.

## The server

Three jobs, zero dependencies:

1. **Serve the app** — correct MIME types, ETags, gzip/brotli for text, and a
   single-page fallback that still 404s genuinely missing assets.
2. **Stand between the atlas and Open-Meteo** — requests are batched fifty
   coordinates at a time, cached for ten minutes, and served stale while they
   revalidate, so a thousand visitors looking at the same island cost the
   upstream one call. The client falls back to calling Open-Meteo directly if
   the proxy is absent, so a purely static deployment also works.
3. **Take reservations** — writes an intent to `.data/reservations.ndjson`.
   There is no payment processor connected and the endpoint says so in its own
   response body.

Configuration is environment only: `PORT`, `HOST`, `DATA_DIR`,
`CLIMATE_TTL_MS`, `UPSTREAM_TIMEOUT_MS`.

### API

```
GET  /healthz                        uptime, island count, cache statistics
GET  /api/islands                    the full catalogue
GET  /api/islands/:n                 one island, 1–404
GET  /api/climate/forecast?…         cached Open-Meteo forecast passthrough
GET  /api/climate/marine?…           cached Open-Meteo marine passthrough
POST /api/reserve                    { island, tier, email, note }
```

## Honest seams

Things this project could have faked and deliberately does not:

- **Moonlight is invented.** Lunar phase and position are not in the feed, and
  computing them precisely to light a scene nobody can verify would be
  precision theatre. Instead there is a full moon in opposition — the honest
  photographic answer to a night exposure. Without it every island past sunset
  is a black cut-out: true to the physics, false to the experience. It is
  labelled as invented here and in the shader source.
- **No manufactured scarcity.** Nothing counts down. Nothing claims three are
  left.
- **No fake checkout.** The reservation form records an intent and says, on the
  button itself, that no payment is taken.
- **No ownership claims that are not true.** Acquisition buys a listing in the
  atlas and a physical plotter drawing. Not a deed, not a token, not a legal
  interest in anything. The acquisition page also says plainly that physical
  fulfilment is not running yet, so a reservation is a place in a queue and a
  stated price rather than a purchase.
- **Wave amplitude is exaggerated**, consistently. One world unit is roughly
  900 m of island, at which scale real metres of swell would be invisible.
  Relative sea states stay honest; absolute ones are scaled.

## Accessibility

Keyboard-navigable throughout; the canvas itself is focusable and orbits with
the arrow keys. `prefers-reduced-motion` stops the title scene drifting. Every
tile carries a text description of its island and its current conditions, so
the atlas is readable without seeing a single render. Without WebGL 2 the
renders are replaced by a plain statement of what is missing and everything
else — catalogue, coordinates, live readings — still works.

## Licence

MIT for the generator, the shaders and this interface. Exposures you export are
yours with no conditions attached. Climate data © Open-Meteo contributors,
CC BY 4.0.
