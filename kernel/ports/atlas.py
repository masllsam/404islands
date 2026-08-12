"""The atlas view: every simulated field, laid out side by side.

The scene renderer (``render.py``) shows the island as it looks.  This shows the
island as it *is* -- one panel per state field, with a common scale bar, so that
a viewer can see for themselves that the greens are leaf area, the valleys are
where discharge is, the rain shadow is real, and the soil ages away from the
summit.

On the finished object this is the second face of the display: the piece can be
turned from the world to its own instrumentation, the way a skeleton watch shows
its movement.  It is also the fastest way to tell whether a change to the kernel
did what it was supposed to.

The bitmap font is 5x7 and lives in this file because a font dependency is not
worth taking for eleven labels (AGENTS.md §8).
"""

from __future__ import annotations

import numpy as np

from ..substrate import kmath as km

# --- a 5x7 bitmap font, column-major bits ---------------------------------
_FONT = {
    "A": (0x7E, 0x11, 0x11, 0x11, 0x7E), "B": (0x7F, 0x49, 0x49, 0x49, 0x36),
    "C": (0x3E, 0x41, 0x41, 0x41, 0x22), "D": (0x7F, 0x41, 0x41, 0x22, 0x1C),
    "E": (0x7F, 0x49, 0x49, 0x49, 0x41), "F": (0x7F, 0x09, 0x09, 0x09, 0x01),
    "G": (0x3E, 0x41, 0x49, 0x49, 0x7A), "H": (0x7F, 0x08, 0x08, 0x08, 0x7F),
    "I": (0x00, 0x41, 0x7F, 0x41, 0x00), "J": (0x20, 0x40, 0x41, 0x3F, 0x01),
    "K": (0x7F, 0x08, 0x14, 0x22, 0x41), "L": (0x7F, 0x40, 0x40, 0x40, 0x40),
    "M": (0x7F, 0x02, 0x0C, 0x02, 0x7F), "N": (0x7F, 0x04, 0x08, 0x10, 0x7F),
    "O": (0x3E, 0x41, 0x41, 0x41, 0x3E), "P": (0x7F, 0x09, 0x09, 0x09, 0x06),
    "Q": (0x3E, 0x41, 0x51, 0x21, 0x5E), "R": (0x7F, 0x09, 0x19, 0x29, 0x46),
    "S": (0x46, 0x49, 0x49, 0x49, 0x31), "T": (0x01, 0x01, 0x7F, 0x01, 0x01),
    "U": (0x3F, 0x40, 0x40, 0x40, 0x3F), "V": (0x1F, 0x20, 0x40, 0x20, 0x1F),
    "W": (0x7F, 0x20, 0x18, 0x20, 0x7F), "X": (0x63, 0x14, 0x08, 0x14, 0x63),
    "Y": (0x03, 0x04, 0x78, 0x04, 0x03), "Z": (0x61, 0x51, 0x49, 0x45, 0x43),
    "0": (0x3E, 0x51, 0x49, 0x45, 0x3E), "1": (0x00, 0x42, 0x7F, 0x40, 0x00),
    "2": (0x42, 0x61, 0x51, 0x49, 0x46), "3": (0x21, 0x41, 0x45, 0x4B, 0x31),
    "4": (0x18, 0x14, 0x12, 0x7F, 0x10), "5": (0x27, 0x45, 0x45, 0x45, 0x39),
    "6": (0x3C, 0x4A, 0x49, 0x49, 0x30), "7": (0x01, 0x71, 0x09, 0x05, 0x03),
    "8": (0x36, 0x49, 0x49, 0x49, 0x36), "9": (0x06, 0x49, 0x49, 0x29, 0x1E),
    " ": (0x00, 0x00, 0x00, 0x00, 0x00), ".": (0x00, 0x40, 0x60, 0x00, 0x00),
    ",": (0x00, 0x80, 0x60, 0x00, 0x00), "-": (0x08, 0x08, 0x08, 0x08, 0x08),
    "/": (0x20, 0x10, 0x08, 0x04, 0x02), ":": (0x00, 0x36, 0x36, 0x00, 0x00),
    "(": (0x00, 0x1C, 0x22, 0x41, 0x00), ")": (0x00, 0x41, 0x22, 0x1C, 0x00),
    "%": (0x23, 0x13, 0x08, 0x64, 0x62), "+": (0x08, 0x08, 0x3E, 0x08, 0x08),
    "2ND": (0,), "_": (0x40, 0x40, 0x40, 0x40, 0x40),
}


def draw_text(img: np.ndarray, x: int, y: int, text: str,
              colour=(230, 232, 236), scale: int = 1) -> None:
    """Blit a string.  Clipped at the image edges; unknown glyphs are skipped."""
    col = np.array(colour, dtype=np.uint8)
    h, w = img.shape[:2]
    cx = x
    for ch in text.upper():
        glyph = _FONT.get(ch)
        if glyph is None or len(glyph) != 5:
            cx += 6 * scale
            continue
        for gx, bits in enumerate(glyph):
            for gy in range(7):
                if not (bits >> gy) & 1:
                    continue
                px, py = cx + gx * scale, y + gy * scale
                if 0 <= px < w - scale and 0 <= py < h - scale:
                    img[py:py + scale, px:px + scale] = col
        cx += 6 * scale


# --- colour ramps ----------------------------------------------------------

def _ramp(stops):
    """Build a 256-entry lookup from (position, rgb) stops."""
    lut = np.zeros((256, 3))
    xs = np.array([s[0] for s in stops])
    cs = np.array([s[1] for s in stops], dtype=np.float64)
    t = np.linspace(0.0, 1.0, 256)
    for c in range(3):
        lut[:, c] = np.interp(t, xs, cs[:, c])
    return lut


RAMPS = {
    # Elevation: bathymetry in blues, land in the plate's greens and golds.
    "elevation": _ramp([(0.00, (4, 8, 14)), (0.35, (16, 54, 74)), (0.49, (70, 150, 150)),
                        (0.50, (150, 140, 96)), (0.60, (54, 112, 52)),
                        (0.78, (128, 150, 70)), (0.92, (150, 116, 78)),
                        (1.00, (238, 238, 240))]),
    "water": _ramp([(0.0, (28, 22, 16)), (0.35, (56, 74, 96)),
                    (0.7, (90, 168, 200)), (1.0, (226, 244, 252))]),
    "life": _ramp([(0.0, (18, 16, 14)), (0.25, (110, 92, 46)),
                   (0.55, (128, 168, 62)), (0.8, (36, 122, 58)), (1.0, (14, 58, 40))]),
    "heat": _ramp([(0.0, (10, 14, 40)), (0.4, (78, 60, 120)),
                   (0.7, (204, 118, 74)), (1.0, (252, 232, 176))]),
    "age": _ramp([(0.0, (26, 22, 20)), (0.4, (112, 62, 48)),
                  (0.75, (176, 130, 84)), (1.0, (232, 214, 186))]),
    "gold": _ramp([(0.0, (10, 10, 12)), (0.5, (110, 82, 32)), (1.0, (238, 206, 138))]),
}


def colourise(field: np.ndarray, ramp: str, lo=None, hi=None, gamma=1.0,
              mask=None) -> np.ndarray:
    f = np.asarray(field, dtype=np.float64)
    lo = float(np.nanmin(f)) if lo is None else lo
    hi = float(np.nanmax(f)) if hi is None else hi
    t = np.clip((f - lo) / max(hi - lo, 1e-12), 0.0, 1.0)
    if gamma != 1.0:
        t = t ** gamma
    idx = (t * 255.0 + 0.5).astype(np.int32)
    out = RAMPS[ramp][idx]
    if mask is not None:
        out = np.where(mask[..., None], out, np.array([8.0, 8.0, 10.0]))
    return out


def _upscale(rgb: np.ndarray, factor: int) -> np.ndarray:
    return np.repeat(np.repeat(rgb, factor, axis=0), factor, axis=1)


def build(island, cell_px: int = 3, cols: int = 4, pad: int = 12,
          header: int = 26) -> np.ndarray:
    """Render every principal state field as a labelled panel grid."""
    st = island.state
    g = island.grid
    land = st.z > st.sea_level
    veg = island.veg
    net = island.net

    elev = st.z - st.sea_level
    discharge = net.route(island.annual_precip_mm * 1e-3 * g.cell_area_m2)
    lens = getattr(island, "lens", g.zeros())

    panels = [
        ("ELEVATION M", colourise(
            np.where(land, 0.5 + 0.5 * np.clip(elev / max(elev.max(), 1.0), 0, 1),
                     0.5 * np.clip(1.0 + elev / 4000.0, 0, 1)), "elevation", 0.0, 1.0)),
        ("RAINFALL MM/YR", colourise(island.annual_precip_mm, "water", gamma=0.65)),
        ("LEAF AREA INDEX", colourise(veg.total_lai(), "life", 0.0,
                                      max(float(veg.total_lai().max()), 1.0), mask=land)),
        ("BIOMASS KGC/M2", colourise(veg.total_biomass(), "life", 0.0,
                                     max(float(veg.total_biomass().max()), 1.0), mask=land)),
        ("DISCHARGE M3/YR", colourise(km.log(np.maximum(discharge, 1.0)), "gold",
                                      mask=land)),
        ("SOIL DEPTH M", colourise(st.soil_depth, "age", 0.0,
                                   max(float(st.soil_depth.max()), 0.01), mask=land)),
        ("SUBSTRATE AGE YR", colourise(st.soil_age, "age", mask=land)),
        ("SOIL CARBON", colourise(veg.soil.total_c(), "age", 0.0,
                                  max(float(veg.soil.total_c().max()), 0.01), mask=land)),
        ("PHOSPHORUS AVAIL", colourise(veg.soil.p_available, "heat", 0.0,
                                       max(float(veg.soil.p_available.max()), 1e-4),
                                       mask=land)),
        ("NITROGEN AVAIL", colourise(veg.soil.n_available, "heat", 0.0,
                                     max(float(veg.soil.n_available.max()), 1e-4),
                                     mask=land)),
        ("REEF THICKNESS M", colourise(st.reef_thickness, "water", 0.0,
                                       max(float(st.reef_thickness.max()), 0.01),
                                       mask=~land)),
        ("FRESHWATER LENS M", colourise(lens, "water", 0.0,
                                        max(float(lens.max()), 0.01), mask=land)),
    ]

    pw = g.nx * cell_px
    ph = g.ny * cell_px
    rows = (len(panels) + cols - 1) // cols
    W = cols * pw + (cols + 1) * pad
    H = rows * (ph + header) + (rows + 1) * pad + 34

    img = np.full((H, W, 3), 10, dtype=np.uint8)

    for k, (title, rgb) in enumerate(panels):
        r, c = divmod(k, cols)
        x0 = pad + c * (pw + pad)
        y0 = pad + 30 + r * (ph + header + pad)
        draw_text(img, x0, y0, title, colour=(196, 186, 150))
        tile = _upscale(np.clip(rgb, 0, 255).astype(np.uint8), cell_px)
        img[y0 + header:y0 + header + ph, x0:x0 + pw] = tile
        # Hairline frame -- the panels are specimens and want mounts.
        img[y0 + header - 1, x0:x0 + pw] = (60, 56, 48)
        img[y0 + header + ph, x0:x0 + pw] = (60, 56, 48)
        img[y0 + header:y0 + header + ph, x0 - 1] = (60, 56, 48)
        img[y0 + header:y0 + header + ph, x0 + pw] = (60, 56, 48)

    d = island.diagnostics
    draw_text(img, pad, 10,
              f"ISLAND {island.cfg.island_id:03d}   YEAR {st.year:.0f}   "
              f"{st.reef_stage.upper().replace('-', ' ')}   "
              f"SUMMIT {d.get('summit_m', 0):.0f} M   "
              f"LAND {d.get('land_area_km2', 0):.1f} KM2   "
              f"SST {d.get('sst_c', 0):.1f} C   SPECIES {d.get('species', 0)}",
              colour=(226, 214, 170))
    draw_text(img, pad, H - 20,
              f"SEED {island.cfg.seed.hex()[:32]}   "
              f"LEDGER CLOSES TO 1E{island.ledger.residual_exponent()}",
              colour=(120, 114, 96))
    return img


def day_sheet(island, frames: int = 12, width: int = 320, height: int = 200,
              pad: int = 8, header: int = 20, cols: int = 4, **render_kw) -> np.ndarray:
    """One simulated day, rendered at regular intervals, as a contact sheet.

    The single most direct answer to "is it actually running": the sun crosses,
    the land heats, the sea breeze builds its cap cloud through the afternoon and
    lets it go after dark, and the sky drifts at whatever wind the island has
    today.  None of that is keyframed -- it is the fast clock (docs/03b §5).

    Advances the island by exactly one day, so the caller gets a piece whose
    clock has moved on, as it would have anyway.
    """
    from .render import Renderer
    from ..atmos.weather import TICKS_PER_DAY

    step_ticks = max(TICKS_PER_DAY // frames, 1)
    tiles = []
    for _ in range(frames):
        island.step_fast(step_ticks)
        f = island.delta_frame().values
        hour = (island.state.sim_days % 1.0) * 24.0
        img = Renderer(island, width=width, height=height, **render_kw).render()
        tiles.append((hour, f, img))

    rows = (frames + cols - 1) // cols
    W = cols * width + (cols + 1) * pad
    H = rows * (height + header) + (rows + 1) * pad + 30
    sheet = np.full((H, W, 3), 10, dtype=np.uint8)

    for k, (hour, f, img) in enumerate(tiles):
        r, c = divmod(k, cols)
        x0 = pad + c * (width + pad)
        y0 = pad + 26 + r * (height + header + pad)
        draw_text(sheet, x0, y0,
                  f"{int(hour):02d}:{int((hour % 1) * 60):02d}   "
                  f"SUN {f['sun_elevation_deg']:+.0f}   "
                  f"CLOUD {f['cloud_frac']:.2f}   "
                  f"T {f['t_air_mean_c']:.0f}C   "
                  f"WIND {f['wind_speed_ms']:.0f}",
                  colour=(196, 186, 150))
        sheet[y0 + header:y0 + header + height, x0:x0 + width] = img

    d = island.diagnostics
    draw_text(sheet, pad, 9,
              f"ONE SIMULATED DAY   ISLAND {island.cfg.island_id:03d}   "
              f"YEAR {island.state.year:.0f}   "
              f"LAT {island.cfg.latitude_deg:.1f}   "
              f"LAND {d.get('land_area_km2', 0):.1f} KM2   "
              f"SST {d.get('sst_c', 0):.1f} C",
              colour=(226, 214, 170))
    return sheet


def write_day_sheet(island, path, **kw) -> str:
    from . import png

    png.write(path, day_sheet(island, **kw))
    return path


def write(island, path, **kw) -> str:
    from . import png

    png.write(path, build(island, **kw))
    return path
