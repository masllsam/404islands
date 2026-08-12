"""The graphics port: the island, drawn.

**This is the artwork's primary surface.**  The piece is a display in a vessel of
gold, enamel and sapphire, and what the display shows is the simulation itself --
every field the kernel computes, made visible (docs/09-DISPLAY.md).

Nothing here is decorative invention.  Every pixel traces to a state variable:

* the sun is at the elevation and azimuth the orbital solver put it at, and it
  casts a real ray-marched shadow into the valleys the erosion model carved;
* the sea's colour is depth, and the reef is where coral actually accreted;
* the greens are leaf area index, and their hue is the trait mix of whichever
  lineage won that cell;
* the clouds sit at the computed lifting condensation level, thickest where the
  orographic model says air is rising, and they rain on the windward flank;
* the rivers are discharge on the D8 network the terrain actually has.

Palette and composition follow the Belle-Epoque reference plate (docs/01 §8):
demantoid and peridot greens on a black ground, old gold for the watercourses,
translucency everywhere -- the light comes from *inside* the world, as it does
through plique-a-jour enamel.

The reference implementation is a software raymarcher: readable, dependency-free,
and slow.  The runtime inside the object renders the same description on the GPU
(docs/09 §6); this file is the specification of what that shader must draw.
"""

from __future__ import annotations

import numpy as np

from ..atmos import orbital, thermo
from ..substrate import kmath as km
from ..substrate.constants import T0

# ---------------------------------------------------------------- palette
# Linear-light RGB.  Named for the stones and enamels they stand for.

DEEP_OCEAN = np.array([0.008, 0.020, 0.034])
MID_OCEAN = np.array([0.016, 0.070, 0.092])
LAGOON = np.array([0.075, 0.300, 0.310])
REEF_CREST = np.array([0.290, 0.560, 0.470])
SAND = np.array([0.640, 0.560, 0.370])
BASALT = np.array([0.040, 0.036, 0.032])
BASALT_DRY = np.array([0.140, 0.110, 0.082])
LAVA_YOUNG = np.array([0.105, 0.055, 0.048])
PERIDOT = np.array([0.310, 0.430, 0.120])
DEMANTOID = np.array([0.090, 0.300, 0.115])
FOREST_DEEP = np.array([0.032, 0.130, 0.070])
GOLD = np.array([0.620, 0.460, 0.170])
SNOW = np.array([0.880, 0.900, 0.920])
LAVA_GLOW = np.array([2.400, 0.560, 0.090])


def _bilinear(field: np.ndarray, fx: np.ndarray, fy: np.ndarray) -> np.ndarray:
    """Sample a grid field at fractional cell coordinates."""
    ny, nx = field.shape
    x = np.clip(fx, 0.0, nx - 1.001)
    y = np.clip(fy, 0.0, ny - 1.001)
    i0 = x.astype(np.int32)
    j0 = y.astype(np.int32)
    tx = x - i0
    ty = y - j0
    i1 = np.minimum(i0 + 1, nx - 1)
    j1 = np.minimum(j0 + 1, ny - 1)
    a = field[j0, i0] * (1 - tx) + field[j0, i1] * tx
    b = field[j1, i0] * (1 - tx) + field[j1, i1] * tx
    return a * (1 - ty) + b * ty


def _bicubic(field: np.ndarray, fx: np.ndarray, fy: np.ndarray) -> np.ndarray:
    """Catmull-Rom sample of a grid field.

    Bilinear sampling of a 240 m grid leaves visible terracing on the flanks --
    the interpolant is only C0, so every cell boundary is a crease the shading
    picks out as a step.  Catmull-Rom is C1 and the steps disappear.

    This is a *rendering* choice, not a change to the terrain: the physics still
    runs on the cell values, and the interpolant only decides what happens
    between them.
    """
    ny, nx = field.shape
    x = np.clip(fx, 1.0, nx - 2.001)
    y = np.clip(fy, 1.0, ny - 2.001)
    i = np.floor(x).astype(np.int32)
    j = np.floor(y).astype(np.int32)
    tx = (x - i)[..., None]
    ty = y - j

    def w(t):
        t2, t3 = t * t, t * t * t
        return np.concatenate([
            -0.5 * t3 + t2 - 0.5 * t,
            1.5 * t3 - 2.5 * t2 + 1.0,
            -1.5 * t3 + 2.0 * t2 + 0.5 * t,
            0.5 * t3 - 0.5 * t2,
        ], axis=-1)

    wx = w(tx)
    wy = w(ty[..., None])
    ii = np.clip(i[..., None] + np.array([-1, 0, 1, 2]), 0, nx - 1)
    out = 0.0
    for k, dj in enumerate((-1, 0, 1, 2)):
        jj = np.clip(j + dj, 0, ny - 1)
        row = (field[jj[..., None], ii] * wx).sum(axis=-1)
        out = out + row * wy[..., k]
    return out


class Camera:
    """Perspective view, looking down at the island from off one shoulder.

    Default framing is deliberately close to how the object sits on a table: the
    horizon high in the frame, the island filling the lower two thirds, sky and
    weather above it.
    """

    def __init__(self, grid, width=960, height=600, azimuth_deg=215.0,
                 elevation_deg=17.0, distance_factor=1.0, fov_deg=34.0,
                 target_z=200.0, subject_radius_m=None):
        self.width, self.height = width, height
        span = max(grid.nx, grid.ny) * grid.cell_size_m
        # Frame the island, not the domain.  A shrinking island should grow in
        # the frame as it subsides -- the piece stays a portrait of one place.
        radius = subject_radius_m if subject_radius_m else span * 0.30
        dist = (radius / np.tan(np.deg2rad(fov_deg) * 0.5)) * 1.55 * distance_factor
        a = np.deg2rad(azimuth_deg)
        e = np.deg2rad(elevation_deg)
        self.target = np.array([0.0, 0.0, target_z])
        self.eye = self.target + dist * np.array([
            float(km.cos(e) * km.sin(a)),
            float(km.cos(e) * km.cos(a)),
            float(km.sin(e)),
        ])
        self.fov = np.deg2rad(fov_deg)
        self.far = dist * 2.6

    def rays(self):
        fwd = self.target - self.eye
        fwd = fwd / np.linalg.norm(fwd)
        right = np.cross(fwd, np.array([0.0, 0.0, 1.0]))
        right /= np.linalg.norm(right)
        up = np.cross(right, fwd)

        aspect = self.width / self.height
        sy = np.tan(self.fov * 0.5)
        sx = sy * aspect
        px = (np.arange(self.width) + 0.5) / self.width * 2.0 - 1.0
        py = 1.0 - (np.arange(self.height) + 0.5) / self.height * 2.0
        PX, PY = np.meshgrid(px, py)

        d = (fwd[None, None, :]
             + (PX * sx)[..., None] * right[None, None, :]
             + (PY * sy)[..., None] * up[None, None, :])
        return d / np.linalg.norm(d, axis=2, keepdims=True)


class Renderer:
    """Draw one frame of one island."""

    def __init__(self, island, width=960, height=600, primary_steps=224,
                 shadow_steps=64, refine=6, azimuth_deg=215.0, elevation_deg=19.0,
                 zoom=1.75):
        self.island = island
        self.grid = island.grid
        land = island.state.z > island.state.sea_level
        if bool(np.any(land)):
            r = island.grid.radius_m()
            radius = float(np.percentile(r[land], 99)) * 1.15
        else:
            radius = max(island.grid.nx, island.grid.ny) * island.grid.cell_size_m * 0.25
        self.cam = Camera(island.grid, width, height, azimuth_deg=azimuth_deg,
                          elevation_deg=elevation_deg,
                          distance_factor=1.0 / max(zoom, 1e-3),
                          subject_radius_m=max(radius, 800.0))
        self.width, self.height = width, height
        self.primary_steps = primary_steps
        self.shadow_steps = shadow_steps
        self.refine = 8
        self.exposure = 1.35
        # How much of the simulated cloud fraction the deck actually paints.
        # The full field would be meteorologically right and would also hide the
        # island for days at a time; the piece exists to be looked at.
        self.cloud_gain = 0.55

    # --------------------------------------------------------------- sampling

    def _world_to_cell(self, x, y):
        g = self.grid
        return (x / g.cell_size_m + 0.5 * (g.nx - 1),
                y / g.cell_size_m + 0.5 * (g.ny - 1))

    def _height(self, x, y, field, smooth=False):
        """Sample the surface.  Bilinear while marching (16x cheaper and only
        used to bracket the hit), bicubic where the result is actually seen:
        the refined intersection and the shading normal."""
        fx, fy = self._world_to_cell(x, y)
        return _bicubic(field, fx, fy) if smooth else _bilinear(field, fx, fy)

    # ------------------------------------------------------------- ray march

    def _march(self, origin, direction, field, steps, t_max, t0=None):
        """March until the ray drops below the surface; refine by bisection."""
        n = direction.shape[0]
        t = np.full(n, 1.0 if t0 is None else 0.0) if t0 is None else t0.copy()
        dt = t_max / steps
        hit = np.zeros(n, dtype=bool)
        t_hit = np.full(n, np.inf)
        t_prev = t.copy()

        for _ in range(steps):
            p = origin[None, :] + direction * t[:, None]
            h = self._height(p[:, 0], p[:, 1], field)
            below = (p[:, 2] < h) & ~hit
            newly = below & ~hit
            t_hit = np.where(newly, t, t_hit)
            hit |= newly
            t_prev = np.where(~hit, t, t_prev)
            t = t + dt
            if bool(hit.all()):
                break

        # Bisection between the last point above and the first below.
        lo, hi = t_prev.copy(), np.where(np.isfinite(t_hit), t_hit, t_prev)
        for _ in range(self.refine):
            mid = 0.5 * (lo + hi)
            p = origin[None, :] + direction * mid[:, None]
            h = self._height(p[:, 0], p[:, 1], field, smooth=True)
            under = p[:, 2] < h
            hi = np.where(under, mid, hi)
            lo = np.where(under, lo, mid)
        return hit, 0.5 * (lo + hi)

    def _shadow(self, points, sun_dir, field, max_dist):
        """Is this point in shadow?  A second march, toward the sun.

        The cast shadow travelling across a carved valley is the element that
        most convinces a viewer the terrain is a real surface rather than a
        picture of one, so it is worth its cost.
        """
        n = points.shape[0]
        lit = np.ones(n)
        if sun_dir[2] <= 0.02:
            return np.zeros(n)
        dt = max_dist / self.shadow_steps
        t = np.full(n, self.grid.cell_size_m * 1.2)
        blocked = np.zeros(n, dtype=bool)
        for _ in range(self.shadow_steps):
            p = points + sun_dir[None, :] * t[:, None]
            h = self._height(p[:, 0], p[:, 1], field)
            blocked |= (p[:, 2] < h - 1.0)
            t = t + dt
        lit = np.where(blocked, 0.0, 1.0)
        return lit

    # ------------------------------------------------------------ appearance

    def _surface_colour(self, fx, fy, z_hit, st, sun_elev):
        """Colour of the solid surface: rock, soil, canopy, sand, snow, lava."""
        isl = self.island
        lai = _bilinear(isl.veg.total_lai(), fx, fy)
        soil = _bilinear(st.soil_depth, fx, fy)
        age = _bilinear(st.soil_age, fx, fy)
        elev = z_hit

        # Bare ground: fresh basalt is nearly black; weathered ground reddens as
        # its soil ages, which is the same variable the phosphorus budget reads.
        weather = np.clip(age / 6.0e4, 0.0, 1.0)[..., None]
        bare = LAVA_YOUNG[None, :] * (1 - weather) + BASALT_DRY[None, :] * weather
        bare = bare * (0.55 + 0.45 * np.clip(soil / 0.6, 0.0, 1.0))[..., None]

        # Canopy: hue interpolates with leaf area, from peridot scrub through
        # demantoid to the near-black green of closed forest.
        v = np.clip(lai / 6.0, 0.0, 1.0)[..., None]
        canopy = (PERIDOT[None, :] * (1 - v) ** 1.5
                  + DEMANTOID[None, :] * 2.0 * v * (1 - v)
                  + FOREST_DEEP[None, :] * v ** 1.5)
        cover = np.clip(lai / 1.8, 0.0, 1.0)[..., None]
        col = bare * (1 - cover) + canopy * cover

        # Shoreline sand, a narrow band above the waterline.
        beach = np.clip(1.0 - np.abs(elev - st.sea_level) / 6.0, 0.0, 1.0)[..., None] ** 1.5
        col = col * (1 - beach) + SAND[None, :] * beach

        # Snow above the freezing level, computed from the actual lapse rate.
        snow_line = max((isl.ocean.sst_c + 1.0) / 0.0065, 200.0)
        snowy = np.clip((elev - snow_line) / 260.0, 0.0, 1.0)[..., None]
        col = col * (1 - snowy) + SNOW[None, :] * snowy

        # Rivers, drawn in gold: the whiplash line of the reference plate,
        # placed by discharge rather than by a designer's hand.
        q = _bilinear(isl.net.drainage_area(), fx, fy)
        wet = _bilinear(isl.annual_precip_mm, fx, fy)
        river = np.clip((km.log(np.maximum(q, 1.0)) - 12.2) / 3.0, 0.0, 1.0)
        river = river * np.clip(wet / 900.0, 0.0, 1.0) * (elev > st.sea_level)
        col = col * (1 - river[..., None]) + GOLD[None, :] * river[..., None] * 0.85

        # Fresh lava still incandescent, if the volcano erupted recently.
        glow = float(getattr(self.island, "_eruption_glow", 0.0))
        if glow > 0.0:
            hot = np.clip((1.0 - age / 900.0), 0.0, 1.0) * glow
            col = col + LAVA_GLOW[None, :] * hot[..., None]
        return col

    def _water_colour(self, depth, sun_elev, sea_state, fx, fy):
        """Sea colour by depth, with the reef reading through it."""
        d = np.maximum(depth, 0.0)
        # Exponential extinction, not a linear ramp: water absorbs red first and
        # the colour bands you see round a reef are Beer's law, not a gradient.
        shallow = km.exp(-d / 11.0)[..., None]
        mid = km.exp(-d / 95.0)[..., None]
        col = (DEEP_OCEAN[None, :] * (1 - mid)
               + MID_OCEAN[None, :] * mid * (1 - shallow)
               + LAGOON[None, :] * shallow)

        reefy = _bilinear(self.island.state.reef_thickness, fx, fy)
        crest = (np.clip(reefy / 4.0, 0.0, 1.0) * np.clip(1.0 - d / 9.0, 0.0, 1.0))[..., None]
        col = col * (1 - crest) + REEF_CREST[None, :] * crest

        # Surf where the sea meets land or reef flat.
        foam = np.clip(1.0 - d / 3.0, 0.0, 1.0) ** 1.5 * (0.30 + 0.08 * sea_state)
        col = col + foam[..., None] * 0.60
        return col

    def _sky(self, dirs, sun_dir, sun_elev, cct, cloud):
        """Sky gradient, sun disc, and horizon glow from the actual sun."""
        up = np.clip(dirs[:, 2], -1.0, 1.0)
        day = np.clip(float(km.sin(max(sun_elev, 0.0))) ** 0.5, 0.0, 1.0)

        # Zenith and horizon colours follow the computed colour temperature, so
        # a simulated sunset is red because the path length says it is.
        warm = np.clip((6500.0 - cct) / 4700.0, 0.0, 1.0)
        zenith = np.array([0.055, 0.105, 0.210]) * day + np.array([0.004, 0.006, 0.014])
        horizon = ((np.array([0.62, 0.30, 0.13]) * warm
                    + np.array([0.36, 0.50, 0.66]) * (1 - warm)) * day
                   + np.array([0.010, 0.012, 0.022]))
        t = np.clip(up, 0.0, 1.0)[:, None] ** 0.55
        col = horizon[None, :] * (1 - t) + zenith[None, :] * t

        # Overcast desaturates and flattens the sky; that difference is what a
        # viewer reads as weather.
        grey = np.array([0.30, 0.31, 0.33]) * (0.25 + 0.75 * day)
        col = col * (1 - 0.75 * cloud) + grey[None, :] * (0.75 * cloud)

        cos_sun = np.clip(dirs @ sun_dir, -1.0, 1.0)
        if sun_elev > -0.12:
            disc = np.clip((cos_sun - 0.99965) / 0.00035, 0.0, 1.0)
            halo = np.clip(cos_sun, 0.0, 1.0) ** 220.0
            sun_tint = np.array([1.0, 0.55 + 0.35 * (1 - warm), 0.22 + 0.55 * (1 - warm)])
            glow = (disc * 9.0 + halo * 1.1) * (1.0 - 0.6 * cloud)
            col = col + sun_tint[None, :] * glow[:, None]

        # Night: the moon, and a faint starfield that does not twinkle.
        if sun_elev < 0.05:
            night = np.clip((0.05 - sun_elev) / 0.35, 0.0, 1.0)
            col = col + np.array([0.020, 0.024, 0.038])[None, :] * night * np.clip(up, 0, 1)[:, None]
        return col

    def _cloud_texture(self):
        """Broken-cloud pattern, advected downwind.

        Cached per render.  Deterministic in the island's seed, so two people
        watching the same island at the same tick see the same sky -- clouds are
        state, not decoration.
        """
        if getattr(self, "_cloud_tex", None) is not None:
            return self._cloud_tex
        from ..geo import noise
        from ..substrate.rng import Stream

        s = Stream(self.island.cfg.seed, "atmos", 0, stream=91)
        base = 0.5 + 0.5 * noise.fbm(self.grid, s, octaves=5, frequency=2.6)
        # Mirror-tile it.  The sky has to continue past the domain, and wrapping
        # a non-periodic field leaves straight seams across the clouds -- which
        # is exactly what it looked like: a rectangle of weather.
        row = np.concatenate([base, base[:, ::-1]], axis=1)
        tex = np.concatenate([row, row[::-1, :]], axis=0)
        self._cloud_tex = tex
        return tex

    def _clouds(self, origin, dirs, occluder_t, frame, st):
        """The cloud deck, at the computed lifting condensation level.

        Two populations, both from state:

        * **Cap cloud** -- thick, stationary, sitting where the orographic model
          says air is rising.  This is the plume that hangs over a tropical
          island's windward flank all day and is most of why such islands look
          the way they do from the sea.
        * **Broken trade cloud** -- a noise field advected downwind at the
          simulated wind speed, with coverage set by the frame's cloud fraction.

        Getting the opacity wrong here is not a cosmetic error: an earlier
        revision painted an 88%-opaque deck over the whole domain and hid the
        island completely.
        """
        isl = self.island
        z_base = self._cloud_base()
        depth_m = 900.0        # cumulus have vertical extent; a plane does not

        dz = dirs[:, 2]
        safe = np.abs(dz) > 1e-4

        # Two-step fixed point on a *displaced* deck: the cloud top rises where
        # there is more cloud water, so the deck gets a lumpy upper surface.  A
        # flat plane reads as fog lying on the water, which is not what a trade
        # cumulus field looks like from above.
        z_hit = np.full(dirs.shape[0], z_base)
        for _ in range(3):
            t = np.where(safe, (z_hit - origin[2]) / np.where(safe, dz, 1.0), -1.0)
            p = origin[None, :] + dirs * np.maximum(t, 0.0)[:, None]
            fx, fy = self._world_to_cell(p[:, 0], p[:, 1])
            amount, lift = self._cloud_amount(fx, fy, frame, st)
            # Cap cloud rides *over* the ridge that lifts it.  Held at a fixed
            # altitude it slices through the mountain instead, and the island
            # reads as half-buried in fog rather than crowned by weather.
            terrain = _bilinear(np.maximum(st.z - st.sea_level, 0.0), fx, fy)
            ride = np.maximum(terrain + 220.0 - z_base, 0.0) * np.clip(lift * 2.2, 0.0, 1.0)
            z_hit = z_base + ride + depth_m * amount

        t_cloud = np.where(safe, (z_hit - origin[2]) / np.where(safe, dz, 1.0), -1.0)
        visible = (t_cloud > 0.0) & (t_cloud < occluder_t)

        # Slant path through a slab of finite thickness, so grazing rays see more
        # cloud and the deck reads as a deck rather than a decal.
        # Keep the slant gain modest.  It was 2.6 with a 3.5x cap, which drove
        # peak opacity to 0.97 and buried the island under a white sheet -- the
        # cloud has to read as weather over a place you can still see.
        slant = np.clip(1.0 / np.maximum(np.abs(dz), 0.20), 1.0, 2.0)
        alpha = np.where(visible, 1.0 - km.exp(-1.5 * amount * slant), 0.0)
        return alpha, lift, visible

    def _cloud_base(self) -> float:
        """Cloud base = lifting condensation level of the marine boundary layer."""
        z = float(thermo.lifting_condensation_level(self.island.ocean.sst_k + 1.0, 0.78))
        return float(np.clip(z, 550.0, 2400.0))

    def _cloud_amount(self, fx, fy, frame, st):
        """Cloud water on the deck, in cell coordinates.  Shared by the visible
        deck and by the shadows it throws, so a cloud and its shadow can never
        disagree."""
        isl = self.island

        # Cap cloud: only the strongly-rising air, so the plume hugs the summit
        # instead of tinting the whole sky.
        precip = _bilinear(isl.annual_precip_mm, fx, fy)
        pmax = max(float(isl.annual_precip_mm.max()), 1.0)
        pthr = float(np.percentile(isl.annual_precip_mm, 90))
        lift = np.clip((precip - pthr) / max(pmax - pthr, 1.0), 0.0, 1.0) ** 1.1
        # Gate on the terrain that is doing the lifting.  Without this the cap
        # cloud spreads over open water and buries the island under a white
        # sheet -- the deck has to sit *on* the mountain, as it does in every
        # photograph of a tropical island.
        elev = _bilinear(np.maximum(st.z - st.sea_level, 0.0), fx, fy)
        lift = lift * np.clip(elev / 260.0, 0.0, 1.0)

        # The cap is only as strong as the sea breeze made it *this afternoon*:
        # the precipitation field says where uplift happens, the fast clock says
        # how much of it is currently condensed (docs/03b §5).  Before this the
        # cap was a fixed feature of the climatology and the island looked the
        # same at dawn as at four in the afternoon.
        cap_now = float(frame.get("convective_cloud", 0.0))
        lift = lift * (0.18 + 1.5 * cap_now)

        # Trade cloud: the noise field, advected downwind at the simulated wind.
        # Sampled with wrap so the sky continues past the domain -- a rectangle
        # of cloud ending in mid-air reads as a bug, and is one.
        # Advect at the wind the island actually has right now, not the
        # climatological trade: on a slack day the sky barely moves.
        speed = float(frame.get("wind_speed_ms", 7.0))
        theta = np.deg2rad(float(frame.get("wind_dir_deg", 0.0)))
        u, v = speed * float(km.sin(theta)), speed * float(km.cos(theta))
        drift = st.sim_days * 86400.0 * 0.0022
        tex = self._cloud_texture()
        ny, nx = tex.shape
        sx = np.mod(fx - u * drift / self.grid.cell_size_m, nx - 1.001)
        sy = np.mod(fy - v * drift / self.grid.cell_size_m, ny - 1.001)
        n = _bilinear(tex, sx, sy)

        # Threshold the noise so coverage matches the frame's cloud fraction:
        # broken trade cumulus with clear sky between, not a uniform veil.
        # Coverage from the trade deck alone, not the total: the cap is drawn by
        # its own term and counting it twice fills the sky.
        base = float(np.clip(frame["cloud_frac"] - 0.6 * cap_now, 0.02, 1.0))
        lo, hi = np.percentile(tex, [100.0 * (1.0 - base), 100.0])
        broken = np.clip((n - lo) / max(hi - lo, 1e-6), 0.0, 1.0) ** 0.8

        # No domain-edge fade is needed: the cap term is already island-shaped
        # because it is gated on the terrain doing the lifting, and the trade
        # term wraps.  A rectangular fade was leaving a soft-edged box of sky.
        return (np.clip(0.42 * broken * base + 0.42 * lift, 0.0, 1.0)
                * self.cloud_gain), lift

    def _cloud_shadow(self, points, sun_dir, frame, st):
        """Shadow of the deck on whatever is beneath it.

        Cheap, and it does more for the sense of a real sky than anything else
        in this file: the sea goes dark in patches and the light on the island
        changes as the weather passes over it.
        """
        if sun_dir[2] <= 0.05:
            return np.ones(points.shape[0])
        t = (self._cloud_base() - points[:, 2]) / max(sun_dir[2], 1e-3)
        p = points + sun_dir[None, :] * np.maximum(t, 0.0)[:, None]
        fx, fy = self._world_to_cell(p[:, 0], p[:, 1])
        amount, _ = self._cloud_amount(fx, fy, frame, st)
        return 1.0 - 0.80 * np.clip(amount, 0.0, 1.0)

    # ------------------------------------------------------------------ frame

    def render(self) -> np.ndarray:
        isl = self.island
        st = isl.state
        frame = isl.delta_frame().values

        sun_elev = np.deg2rad(frame["sun_elevation_deg"])
        sun_azi = np.deg2rad(frame["sun_azimuth_deg"])
        sun_dir = np.array([
            float(km.cos(sun_elev) * km.sin(sun_azi)),
            float(km.cos(sun_elev) * km.cos(sun_azi)),
            float(km.sin(sun_elev)),
        ])
        moon_elev = np.deg2rad(frame["moon_elevation_deg"])
        cct = frame["sky_colour_temp_k"]
        cloud = float(np.clip(frame["cloud_frac"], 0.0, 1.0))
        sea_state = float(frame["sea_state"])

        # The terrain we march is the solid surface; water is a separate plane.
        land_field = st.z
        water_z = st.sea_level

        dirs = self.cam.rays().reshape(-1, 3)
        origin = self.cam.eye

        hit, t_hit = self._march(origin, dirs, land_field,
                                 self.primary_steps, self.cam.far)

        # Sea plane intersection.  The solid march also returns hits on the
        # *seafloor*, which is below the water plane -- so visibility has to be
        # resolved by distance, not by preferring one surface.  (Preferring the
        # solid hit paints the whole abyssal plain as sunlit land, which is
        # exactly as wrong as it sounds.)
        dz = dirs[:, 2]
        with np.errstate(divide="ignore", invalid="ignore"):
            t_sea = np.where(np.abs(dz) > 1e-6, (water_z - origin[2]) / dz, -1.0)
        sea_hit = t_sea > 0.0

        # --- shade the solid surface ---------------------------------------
        p_land = origin[None, :] + dirs * np.where(hit, t_hit, 0.0)[:, None]
        fx, fy = self._world_to_cell(p_land[:, 0], p_land[:, 1])

        eps = self.grid.cell_size_m
        hx = (self._height(p_land[:, 0] + eps, p_land[:, 1], land_field, smooth=True)
              - self._height(p_land[:, 0] - eps, p_land[:, 1], land_field, smooth=True)) / (2 * eps)
        hy = (self._height(p_land[:, 0], p_land[:, 1] + eps, land_field, smooth=True)
              - self._height(p_land[:, 0], p_land[:, 1] - eps, land_field, smooth=True)) / (2 * eps)
        normal = np.stack([-hx, -hy, np.ones_like(hx)], axis=1)
        normal /= np.linalg.norm(normal, axis=1, keepdims=True)

        ndotl = np.clip(normal @ sun_dir, 0.0, 1.0)
        lit = self._shadow(p_land + normal * 2.0, sun_dir, land_field,
                           max(self.grid.nx, self.grid.ny) * self.grid.cell_size_m * 0.75)
        lit = lit * self._cloud_shadow(p_land, sun_dir, frame, st)

        albedo = self._surface_colour(fx, fy, p_land[:, 2], st, sun_elev)

        # Direct sun, warm and directional; sky fill, cool and ambient.
        warm = np.clip((6500.0 - cct) / 4700.0, 0.0, 1.0)
        sun_colour = np.array([1.0, 0.80 - 0.28 * warm, 0.58 - 0.44 * warm])
        strength = max(float(km.sin(max(sun_elev, 0.0))), 0.0) ** 0.65
        direct = (sun_colour[None, :] * (ndotl * lit)[:, None]
                  * (2.35 * strength) * (1.0 - 0.72 * cloud))
        sky_fill = np.array([0.26, 0.34, 0.46]) * (0.10 + 0.55 * strength) * (0.5 + cloud)
        ambient = sky_fill[None, :] * (0.5 + 0.5 * normal[:, 2])[:, None]
        moonlight = 0.0
        if sun_elev < 0.0 and moon_elev > 0.0:
            moonlight = 0.045 * float(km.sin(moon_elev)) * frame["moon_phase"] * 2.0
            ambient = ambient + np.array([0.30, 0.36, 0.52])[None, :] * moonlight

        land_rgb = albedo * (direct + ambient)

        # --- shade the sea --------------------------------------------------
        p_sea = origin[None, :] + dirs * np.where(sea_hit, t_sea, 0.0)[:, None]
        sfx, sfy = self._world_to_cell(p_sea[:, 0], p_sea[:, 1])
        inside_sea = ((sfx > 0) & (sfx < self.grid.nx - 1)
                      & (sfy > 0) & (sfy < self.grid.ny - 1))
        bed = np.where(inside_sea, self._height(p_sea[:, 0], p_sea[:, 1], land_field),
                       water_z - 4000.0)
        depth = water_z - bed
        sea_rgb = self._water_colour(depth, sun_elev, sea_state, sfx, sfy)
        sea_shadow = self._cloud_shadow(p_sea, sun_dir, frame, st)

        # Fresnel-weighted sky reflection, plus a specular glitter path.
        cos_i = np.clip(-dirs[:, 2], 0.0, 1.0)
        fres = 0.02 + 0.98 * (1.0 - cos_i) ** 5
        refl_dir = dirs.copy()
        refl_dir[:, 2] = -refl_dir[:, 2]
        sky_refl = self._sky(refl_dir, sun_dir, sun_elev, cct, cloud)
        spec = np.clip(refl_dir @ sun_dir, 0.0, 1.0) ** (260.0 / max(1.0 + sea_state, 1.0))
        lit_water = (0.28 + 0.72 * strength) * (0.45 + 0.55 * sea_shadow)
        sea_rgb = (sea_rgb * lit_water[:, None] * (1 - fres)[:, None]
                   + sky_refl * fres[:, None]
                   + sun_colour[None, :] * (spec * 2.4 * strength * sea_shadow)[:, None])

        # --- composite ------------------------------------------------------
        sky_rgb = self._sky(dirs, sun_dir, sun_elev, cct, cloud)
        show_water = sea_hit & ((~hit) | (t_sea <= t_hit))
        show_land = hit & ~show_water
        rgb = np.where(show_land[:, None], land_rgb,
                       np.where(show_water[:, None], sea_rgb, sky_rgb))

        # Aerial perspective: distance fades toward the horizon colour.
        t_any = np.where(show_land, t_hit, np.where(show_water, t_sea, self.cam.far))
        haze = 1.0 - km.exp(-np.clip(t_any, 0.0, self.cam.far) / (self.cam.far * 1.5))
        haze = haze * (0.10 + 0.30 * cloud)
        horizon_col = self._sky(np.tile(np.array([[0.0, 1.0, 0.02]]), (dirs.shape[0], 1)),
                                sun_dir, sun_elev, cct, cloud)
        rgb = rgb * (1 - haze[:, None]) + horizon_col * haze[:, None]

        # --- clouds and rain veils ------------------------------------------
        alpha, lift, cvis = self._clouds(origin, dirs, t_any, frame, st)
        cloud_lit = 0.55 + 0.45 * strength
        cloud_col = (np.array([0.86, 0.87, 0.90]) * cloud_lit
                     + np.array([0.24, 0.26, 0.34]) * (1 - cloud_lit))
        # Rain-bearing cloud is darker underneath, which is how a squall reads.
        heavy = np.clip(lift * cloud * 1.6, 0.0, 1.0)
        base_col = cloud_col[None, :] * (1.0 - 0.62 * heavy[:, None])
        if moon_elev > 0.0 and sun_elev < 0.0:
            base_col = base_col * (0.06 + moonlight * 4.0)
        rgb = rgb * (1 - alpha[:, None]) + base_col * alpha[:, None]

        rain = np.clip(heavy - 0.35, 0.0, 1.0) * 0.42 * cvis
        rgb = rgb * (1 - rain[:, None]) + (base_col * 0.75) * rain[:, None]

        img = rgb.reshape(self.height, self.width, 3)
        return self._grade(img)

    # ------------------------------------------------------------------ grade

    def _grade(self, img: np.ndarray) -> np.ndarray:
        """Tone map, vignette, and gamma.

        The black ground of the reference plate is what makes green read as
        luminous, so the vignette is not a photographic affectation here -- it is
        the setting the stones sit in.
        """
        x = np.maximum(img, 0.0) * self.exposure
        # Filmic curve: highlights roll off instead of clipping, so a sun on
        # water does not turn into a white hole.
        x = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)
        # Saturation lift.  The reference plate is emphatically *not* muted; its
        # greens are stones, and a photographic desaturation would lose the one
        # quality the palette exists for.
        luma = (x * np.array([0.2126, 0.7152, 0.0722])).sum(axis=2, keepdims=True)
        x = np.clip(luma + (x - luma) * 1.28, 0.0, None)

        h, w = x.shape[:2]
        yy = (np.arange(h) / h - 0.5) * 2.0
        xx = (np.arange(w) / w - 0.5) * 2.0
        XX, YY = np.meshgrid(xx, yy)
        r = np.sqrt(XX ** 2 + (YY * 1.05) ** 2)
        vig = np.clip(1.0 - 0.55 * np.clip(r - 0.30, 0.0, None) ** 1.6, 0.0, 1.0)
        x = x * vig[..., None]

        x = np.clip(x, 0.0, 1.0) ** (1.0 / 2.2)
        return (x * 255.0 + 0.5).astype(np.uint8)


def render_png(island, path, width=960, height=600, **kw) -> str:
    from . import png

    img = Renderer(island, width=width, height=height, **kw).render()
    png.write(path, img)
    return path
