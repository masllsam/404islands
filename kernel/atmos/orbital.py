"""Orbital mechanics and insolation (docs/03b §2).

The deepest rhythm in the object.  Everything that oscillates -- the day, the
season, the ice age, the terraces the sea cuts into the island's flanks -- comes
from this file.  It is also the only place the piece touches astronomy, so it is
kept small and exact.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..substrate import kmath as km
from ..substrate.constants import (
    DAYS_PER_YEAR, ECCENTRICITY, LUNAR_SYNODIC_DAYS, OBLIQUITY_DEG,
    PERIHELION_DEG, SOLAR_CONSTANT,
)


@dataclass
class Orbit:
    obliquity_rad: float = np.deg2rad(OBLIQUITY_DEG)
    eccentricity: float = ECCENTRICITY
    perihelion_rad: float = np.deg2rad(PERIHELION_DEG)

    def at_epoch(self, year: float) -> "Orbit":
        """Milankovitch variation for deep-time runs.

        A three-term truncation of the Laskar solution's dominant periods:
        obliquity ~41 kyr, precession ~23 kyr, eccentricity ~100 kyr.  Irrelevant
        over one owner's lifetime; decisive over the island's.
        """
        t = year
        return Orbit(
            obliquity_rad=np.deg2rad(
                23.25 + 1.19 * float(km.sin(2.0 * np.pi * t / 41000.0))),
            eccentricity=0.028 + 0.023 * float(km.sin(2.0 * np.pi * t / 100000.0)),
            perihelion_rad=float(np.mod(self.perihelion_rad + 2.0 * np.pi * t / 23000.0,
                                        2.0 * np.pi)),
        )


def _true_anomaly(mean_anomaly: float, e: float) -> float:
    """Kepler's equation by Newton iteration.  Fixed iteration count, so the
    result does not depend on a convergence test that might differ by a bit."""
    E = mean_anomaly
    for _ in range(6):
        E = E - (E - e * float(km.sin(E)) - mean_anomaly) / (1.0 - e * float(km.cos(E)))
    return 2.0 * float(km.atan2(
        km.sqrt(1.0 + e) * km.sin(E / 2.0), km.sqrt(1.0 - e) * km.cos(E / 2.0)))


def solar_state(day_of_year: float, orbit: Orbit) -> tuple[float, float]:
    """Return (declination_rad, inverse-square distance factor)."""
    mean_anomaly = 2.0 * np.pi * (day_of_year / DAYS_PER_YEAR) - orbit.perihelion_rad
    nu = _true_anomaly(mean_anomaly, orbit.eccentricity)
    r_factor = ((1.0 + orbit.eccentricity * float(km.cos(nu))) ** 2
                / (1.0 - orbit.eccentricity ** 2) ** 2)
    lam = nu + orbit.perihelion_rad
    decl = float(km.asin(km.sin(orbit.obliquity_rad) * km.sin(lam)))
    return decl, r_factor


def hour_angle(fraction_of_day: float) -> float:
    """Solar hour angle; 0 at local solar noon, +/- pi at midnight."""
    return 2.0 * np.pi * (fraction_of_day - 0.5)


def sun_position(lat_rad: float, decl: float, h: float) -> tuple[float, float]:
    """Solar elevation and azimuth (radians; azimuth clockwise from north)."""
    sin_elev = (float(km.sin(lat_rad)) * float(km.sin(decl))
                + float(km.cos(lat_rad)) * float(km.cos(decl)) * float(km.cos(h)))
    elev = float(km.asin(np.clip(sin_elev, -1.0, 1.0)))
    azi = float(km.atan2(
        -km.sin(h) * km.cos(decl),
        km.cos(lat_rad) * km.sin(decl) - km.sin(lat_rad) * km.cos(decl) * km.cos(h),
    ))
    return elev, float(np.mod(azi, 2.0 * np.pi))


def toa_flux(lat_rad: float, decl: float, h: float, r_factor: float) -> float:
    """Instantaneous top-of-atmosphere flux on a horizontal surface."""
    elev, _ = sun_position(lat_rad, decl, h)
    return max(SOLAR_CONSTANT * r_factor * float(km.sin(elev)), 0.0)


def daily_mean_toa(lat_rad: float, decl: float, r_factor: float) -> float:
    """Analytic daily-mean insolation -- exact, and far cheaper than integrating
    the day.  Used by the slab ocean and the annual biology."""
    x = -(float(km.sin(lat_rad)) / float(km.cos(lat_rad))) * \
        (float(km.sin(decl)) / float(km.cos(decl)))
    if x >= 1.0:
        return 0.0            # polar night
    if x <= -1.0:
        h0 = np.pi           # polar day
    else:
        h0 = float(km.acos(np.clip(x, -1.0, 1.0)))
    return (SOLAR_CONSTANT * r_factor / np.pi) * (
        h0 * float(km.sin(lat_rad)) * float(km.sin(decl))
        + float(km.cos(lat_rad)) * float(km.cos(decl)) * float(km.sin(h0))
    )


def moon_phase(day: float) -> float:
    """Synodic phase in [0, 1); 0 = new, 0.5 = full.

    The moon does almost nothing physically at this scale -- but it drives the
    tide ring and the night lighting, and a piece whose nights ignore the moon
    would feel wrong to anyone who has looked out of a window.
    """
    return float(np.mod(day / LUNAR_SYNODIC_DAYS, 1.0))


def tide_phase(day: float) -> float:
    """Semidiurnal tide with a spring/neap envelope from the lunar phase."""
    return float(np.mod(day * (2.0 * 24.0 / 24.84), 1.0))


def spring_neap(day: float) -> float:
    return float(0.5 + 0.5 * km.cos(4.0 * np.pi * moon_phase(day)))
