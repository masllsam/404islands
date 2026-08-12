"""Physical constants and unit policy.

SI everywhere, without exception (docs/04 §4).  Every simulation disaster in this
genre traces back to a unit that was convenient once.  If a number in this kernel
is not in SI, it is a bug, and the variable name must carry the unit suffix.
"""

from __future__ import annotations

# --- universal -------------------------------------------------------------
G_ACC = 9.80665           # m s-2       standard gravity
SIGMA_SB = 5.670374419e-8  # W m-2 K-4  Stefan-Boltzmann
R_UNIV = 8.314462618      # J mol-1 K-1
R_DRY = 287.052874        # J kg-1 K-1  specific gas constant, dry air
R_VAP = 461.5250          # J kg-1 K-1  water vapour
CP_AIR = 1004.68          # J kg-1 K-1
CP_WATER = 4184.0         # J kg-1 K-1
L_VAP = 2.501e6           # J kg-1      latent heat of vaporisation at 0 C
L_FUS = 3.34e5            # J kg-1      latent heat of fusion
KARMAN = 0.40
T0 = 273.15               # K

# --- astronomical ----------------------------------------------------------
SOLAR_CONSTANT = 1361.0   # W m-2 at 1 AU
OBLIQUITY_DEG = 23.4392911
ECCENTRICITY = 0.0167086
PERIHELION_DEG = 102.9373  # longitude of perihelion
DAYS_PER_YEAR = 365.2422
SECONDS_PER_DAY = 86400.0
LUNAR_SYNODIC_DAYS = 29.530588

# --- earth materials -------------------------------------------------------
RHO_AIR = 1.225           # kg m-3 at sea level, 15 C
RHO_WATER = 1000.0        # kg m-3
RHO_SEAWATER = 1027.0     # kg m-3
RHO_BASALT = 2900.0       # kg m-3  dense basaltic edifice
RHO_CRUST = 2800.0        # kg m-3
RHO_MANTLE = 3300.0       # kg m-3
YOUNGS_MODULUS = 7.0e10   # Pa      oceanic lithosphere
POISSON = 0.25
TE_ELASTIC = 25.0e3       # m       effective elastic thickness

# --- lithosphere cooling (Parsons & Sclater 1977) --------------------------
SUBSIDENCE_COEFF = 350.0  # m per sqrt(Myr)
RIDGE_DEPTH = 2500.0      # m

# --- biology ---------------------------------------------------------------
CO2_PPM_DEFAULT = 420.0
O2_PARTIAL_PA = 21000.0   # Pa
KC25 = 40.49              # Pa    Michaelis constant for CO2 (Bernacchi 2001)
KO25 = 27840.0            # Pa    Michaelis constant for O2
GAMMA_STAR_25 = 4.275     # Pa    CO2 compensation point w/o dark respiration
EA_VCMAX = 65330.0        # J mol-1
EA_JMAX = 43540.0         # J mol-1
EA_KC = 79430.0           # J mol-1
EA_KO = 36380.0           # J mol-1
EA_GAMMA = 37830.0        # J mol-1
Q10_RESP = 2.0
MOLAR_MASS_C = 0.012011   # kg mol-1

# --- numerical policy ------------------------------------------------------
LEDGER_TOL_STEP = 1e-9      # relative, per step   (docs/02 §7)
LEDGER_TOL_CENTURY = 1e-6   # relative, accumulated
EPS = 1e-12
