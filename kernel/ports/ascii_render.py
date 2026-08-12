"""A render port for the terminal.

Deliberately the crudest possible consumer of a StateFrame.  Its purpose is to
prove the port boundary: if an island can be watched through 24-bit ANSI escapes
with no help from the kernel, it can be watched through anything -- a display in
2030, a light behind plique-a-jour enamel in 2040, whatever exists in 2140.

The palette is taken from the reference plate: demantoid and peridot greens on a
black ground, old gold for the watercourses, amethyst only where the island earns
it.
"""

from __future__ import annotations

import numpy as np

RESET = "\033[0m"


def _rgb(r: int, g: int, b: int, char: str = "  ") -> str:
    return f"\033[48;2;{r};{g};{b}m{char}{RESET}"


def _mix(c0, c1, t: float):
    t = max(0.0, min(1.0, t))
    return tuple(int(a + (b - a) * t) for a, b in zip(c0, c1))


# Reference-plate palette (docs/01 §8).
DEEP_SEA = (4, 10, 16)
SHALLOW = (18, 54, 62)
REEF = (86, 150, 132)
SAND = (196, 178, 122)
ROCK_DARK = (52, 44, 36)
ROCK_LIGHT = (128, 112, 88)
PERIDOT = (128, 168, 68)
DEMANTOID = (58, 128, 62)
FOREST_DEEP = (24, 74, 44)
GOLD = (186, 152, 78)
SNOW = (232, 232, 236)


def frame_to_ansi(island, width: int | None = None, shade: bool = True) -> str:
    """Render the island's current surface, lit by its own sun."""
    st = island.state
    g = island.grid
    z = st.z - st.sea_level
    land = z > 0.0
    lai = island.veg.total_lai()

    step = max(1, g.nx // (width or 72))
    zz = z[::step, ::step]
    ll = lai[::step, ::step]
    lm = land[::step, ::step]

    # Relief shading from the actual sun position -- the same number that will
    # drive the gimbal that casts the real shadow on the carved relief.
    frame = island.delta_frame().values
    sun_el = np.deg2rad(max(frame["sun_elevation_deg"], 3.0))
    sun_az = np.deg2rad(frame["sun_azimuth_deg"])
    gy, gx = np.gradient(zz, g.cell_size_m * step)
    illum = (np.sin(sun_el) - np.cos(sun_el) * (gx * np.sin(sun_az) + gy * np.cos(sun_az)))
    illum = np.clip(illum, 0.25, 1.6) if shade else np.ones_like(zz)

    zmax = max(float(zz.max()), 1.0)
    rows = []
    for j in range(zz.shape[0]):
        row = []
        for i in range(zz.shape[1]):
            h = float(zz[j, i])
            if not lm[j, i]:
                d = -h
                if d < 6.0:
                    c = REEF
                elif d < 60.0:
                    c = _mix(SHALLOW, REEF, 1.0 - d / 60.0)
                else:
                    c = _mix(DEEP_SEA, SHALLOW, max(0.0, 1.0 - (d - 60.0) / 900.0))
            else:
                v = float(ll[j, i])
                if h < 8.0:
                    base = SAND
                elif v > 3.5:
                    base = _mix(DEMANTOID, FOREST_DEEP, min((v - 3.5) / 3.0, 1.0))
                elif v > 0.4:
                    base = _mix(ROCK_LIGHT, PERIDOT, min(v / 3.5, 1.0))
                else:
                    base = _mix(ROCK_DARK, ROCK_LIGHT, min(h / zmax * 2.0, 1.0))
                if h > 0.82 * zmax and zmax > 1200.0:
                    base = _mix(base, SNOW, 0.5)
                c = base
            f = float(illum[j, i])
            row.append(_rgb(*[min(255, int(x * f)) for x in c]))
        rows.append("".join(row))
    return "\n".join(rows)


def status_line(island) -> str:
    d = island.diagnostics
    st = island.state
    return (
        f"year {st.year:8.1f} | summit {d.get('summit_m', 0):6.0f} m | "
        f"land {d.get('land_area_km2', 0):6.2f} km2 | {st.reef_stage:<14} | "
        f"SST {d.get('sst_c', 0):5.1f} C | rain {d.get('precip_mean_mm', 0):6.0f} mm | "
        f"LAI {d.get('lai', 0):4.2f} | species {d.get('species', 0):2d}"
    )


def precip_map(island, width: int = 72) -> str:
    """Rainfall, so the rain shadow is visible as a thing in its own right."""
    g = island.grid
    step = max(1, g.nx // width)
    p = island.annual_precip_mm[::step, ::step]
    pmax = max(float(p.max()), 1.0)
    rows = []
    for j in range(p.shape[0]):
        row = []
        for i in range(p.shape[1]):
            t = float(p[j, i]) / pmax
            row.append(_rgb(*_mix((40, 28, 20), (120, 200, 240), t ** 0.6)))
        rows.append("".join(row))
    return "\n".join(rows)
