"""Deterministic transcendental functions.

The platform libm is NOT bit-identical across operating systems, CPU vendors, or
library versions.  A kernel that calls ``math.exp`` cannot promise that an island
recomputed in 2140 matches the island engraved on the certificate today, which is
the one promise this project actually makes (docs/02 §D2).

So we carry our own.  Range reduction plus fixed minimax-style polynomials, using
only operations IEEE-754 defines exactly: +, -, *, /, sqrt, frexp, ldexp, and
comparison.  Every implementation here is a pure function of its input bits.

Accuracy target: < 2 ulp over the documented domains.  Verified against mpmath
reference vectors in tests/substrate/test_kmath.py.  Accuracy is secondary to
reproducibility -- a function that is 3 ulp off but identical everywhere is
strictly better here than one that is correctly rounded on some machines only.
"""

from __future__ import annotations

import numpy as np

# Cody-Waite splits: high part has trailing zero bits so k*hi is exact.
_LN2_HI = 6.93147180369123816490e-01
_LN2_LO = 1.90821492927058770002e-10
_LN2 = 6.93147180559945309417e-01

_PIO2_1 = 1.57079632673412561417e00
_PIO2_2 = 6.07710050650619224932e-11
_PIO2_3 = 2.02226624879595063154e-21
_2_OVER_PI = 6.36619772367581382433e-01

_SQRT_HALF = 0.70710678118654752440
_SQRT3 = 1.73205080756887729353
_PI_OVER_6 = 0.52359877559829887308


def exp(x):
    """e**x.  Domain: [-700, 700]; outside, saturates to 0 / +inf."""
    x = np.asarray(x, dtype=np.float64)
    # Clamp before the range reduction.  An infinite argument would make
    # k = +/-inf and then (x - k*ln2) = inf - inf = NaN, which the saturation
    # below would mask -- correct answer, but arrived at through a NaN, and a NaN
    # that passes through arithmetic is the kind of thing that later turns up
    # somewhere it cannot be masked.
    xr = np.clip(x, -746.0, 710.0)
    k = np.rint(xr * (1.0 / _LN2))
    # Cody-Waite: subtract k*ln2 in two exact pieces to keep r accurate.
    r = (xr - k * _LN2_HI) - k * _LN2_LO
    # Taylor for e**r on |r| <= ln2/2 ~ 0.3466.  Degree 13 => truncation ~5e-18.
    p = 1.0 / 6227020800.0
    for c in (1.0 / 479001600.0, 1.0 / 39916800.0, 1.0 / 3628800.0,
              1.0 / 362880.0, 1.0 / 40320.0, 1.0 / 5040.0, 1.0 / 720.0,
              1.0 / 120.0, 1.0 / 24.0, 1.0 / 6.0, 0.5, 1.0, 1.0):
        p = p * r + c
    with np.errstate(over="ignore", under="ignore"):
        out = np.ldexp(p, k.astype(np.int64))
    out = np.where(x > 709.78, np.inf, out)
    out = np.where(x < -745.0, 0.0, out)
    return out


def log(x):
    """Natural logarithm.  Domain: x > 0.  x <= 0 yields nan/-inf as IEEE does."""
    x = np.asarray(x, dtype=np.float64)
    with np.errstate(invalid="ignore", divide="ignore"):
        m, e = np.frexp(np.where(x > 0.0, x, 1.0))  # x = m * 2**e, m in [0.5, 1)
        # Recentre m to [sqrt(1/2), sqrt(2)) so |s| stays small.
        adjust = m < _SQRT_HALF
        m = np.where(adjust, m * 2.0, m)
        e = np.where(adjust, e - 1, e)
        # log(m) = 2*atanh(s), s = (m-1)/(m+1);  |s| <= 0.1716
        s = (m - 1.0) / (m + 1.0)
        s2 = s * s
        p = 1.0 / 21.0  # |s| <= 0.1716 => truncation ~2e-19
        for c in (1.0 / 19.0, 1.0 / 17.0, 1.0 / 15.0, 1.0 / 13.0, 1.0 / 11.0,
                  1.0 / 9.0, 1.0 / 7.0, 1.0 / 5.0, 1.0 / 3.0, 1.0):
            p = p * s2 + c
        out = 2.0 * s * p + e.astype(np.float64) * _LN2
        out = np.where(x > 0.0, out, np.where(x == 0.0, -np.inf, np.nan))
    return out


def pow(base, expo):  # noqa: A001 - deliberate shadow, this is our math namespace
    """base**expo for base > 0.  Use ``ipow`` for integer exponents."""
    return exp(np.asarray(expo, dtype=np.float64) * log(base))


def sqrt(x):
    """IEEE-754 mandates correct rounding for sqrt, so the platform is safe here."""
    return np.sqrt(np.asarray(x, dtype=np.float64))


def _sin_kernel(r):
    """sin(r) for |r| <= pi/4."""
    r2 = r * r
    p = 1.58969099521155010221e-10
    for c in (-2.50507602534068634195e-08, 2.75573137070700676789e-06,
              -1.98412698298579493134e-04, 8.33333333332248946124e-03,
              -1.66666666666666324348e-01):
        p = p * r2 + c
    return r + r * r2 * p


def _cos_kernel(r):
    """cos(r) for |r| <= pi/4."""
    r2 = r * r
    p = -1.13596475577881948265e-11
    for c in (2.08757232129817482790e-09, -2.75573141792967388112e-07,
              2.48015872888517179954e-05, -1.38888888888730564116e-03,
              4.16666666666665929218e-02):
        p = p * r2 + c
    return 1.0 - 0.5 * r2 + r2 * r2 * p


def _reduce_quadrant(x):
    """Cody-Waite reduction: x = n*(pi/2) + r, |r| <= pi/4.  Valid to |x| ~ 1e8."""
    n = np.rint(x * _2_OVER_PI)
    r = ((x - n * _PIO2_1) - n * _PIO2_2) - n * _PIO2_3
    return r, np.mod(n.astype(np.int64), 4)


def sin(x):
    x = np.asarray(x, dtype=np.float64)
    r, q = _reduce_quadrant(x)
    s, c = _sin_kernel(r), _cos_kernel(r)
    return np.select([q == 0, q == 1, q == 2], [s, c, -s], default=-c)


def cos(x):
    x = np.asarray(x, dtype=np.float64)
    r, q = _reduce_quadrant(x)
    s, c = _sin_kernel(r), _cos_kernel(r)
    return np.select([q == 0, q == 1, q == 2], [c, -s, -c], default=s)


def tanh(x):
    x = np.asarray(x, dtype=np.float64)
    xc = np.clip(x, -20.0, 20.0)
    e2 = exp(2.0 * xc)
    return np.where(x > 20.0, 1.0, np.where(x < -20.0, -1.0, (e2 - 1.0) / (e2 + 1.0)))


def expm1(x):
    """Accurate near zero, where exp(x)-1 catastrophically cancels."""
    x = np.asarray(x, dtype=np.float64)
    small = np.abs(x) < 0.25
    xs = np.where(small, x, 0.0)
    p = 1.0 / 6227020800.0  # degree 12 => truncation ~2e-18 on |x| <= 0.25
    for c in (1.0 / 479001600.0, 1.0 / 39916800.0, 1.0 / 3628800.0,
              1.0 / 362880.0, 1.0 / 40320.0, 1.0 / 5040.0, 1.0 / 720.0,
              1.0 / 120.0, 1.0 / 24.0, 1.0 / 6.0, 0.5, 1.0):
        p = p * xs + c
    return np.where(small, xs * p, exp(x) - 1.0)


def log1p(x):
    x = np.asarray(x, dtype=np.float64)
    small = np.abs(x) < 0.0625
    xs = np.where(small, x, 0.0)
    p = -1.0 / 13.0  # degree 13 => truncation ~2e-17 on |x| <= 1/16
    for c in (1.0 / 12.0, -1.0 / 11.0, 1.0 / 10.0, -1.0 / 9.0, 1.0 / 8.0,
              -1.0 / 7.0, 1.0 / 6.0, -1.0 / 5.0, 1.0 / 4.0, -1.0 / 3.0,
              0.5, -1.0):
        p = p * xs + c
    return np.where(small, -xs * p, log(1.0 + x))


def atan2(y, x):
    """Deterministic atan2 via a polynomial for atan on [0,1] plus quadrant logic."""
    y = np.asarray(y, dtype=np.float64)
    x = np.asarray(x, dtype=np.float64)
    ax, ay = np.abs(x), np.abs(y)
    swap = ay > ax
    num = np.where(swap, ax, ay)
    den = np.where(swap, ay, ax)
    with np.errstate(invalid="ignore", divide="ignore"):
        t = np.where(den > 0.0, num / den, 0.0)  # t in [0, 1]
    # Second reduction: fold [tan(15deg), 1] down via
    # atan(t) = pi/6 + atan((t*sqrt3 - 1)/(sqrt3 + t)), so |t'| <= tan(15deg).
    fold = t > 0.26794919243112270647
    tf = np.where(fold, (t * _SQRT3 - 1.0) / (_SQRT3 + t), t)
    t2 = tf * tf
    p = 1.0 / 21.0  # atan Taylor, |tf| <= 0.268 => truncation ~3e-15
    for c in (-1.0 / 19.0, 1.0 / 17.0, -1.0 / 15.0, 1.0 / 13.0, -1.0 / 11.0,
              1.0 / 9.0, -1.0 / 7.0, 1.0 / 5.0, -1.0 / 3.0, 1.0):
        p = p * t2 + c
    a = tf * p + np.where(fold, _PI_OVER_6, 0.0)
    a = np.where(swap, 0.5 * np.pi - a, a)
    a = np.where(x < 0.0, np.pi - a, a)
    a = np.where(y < 0.0, -a, a)
    return a


def asin(x):
    x = np.clip(np.asarray(x, dtype=np.float64), -1.0, 1.0)
    return atan2(x, sqrt(np.maximum(1.0 - x * x, 0.0)))


def acos(x):
    x = np.clip(np.asarray(x, dtype=np.float64), -1.0, 1.0)
    return atan2(sqrt(np.maximum(1.0 - x * x, 0.0)), x)


def hypot(a, b):
    return sqrt(np.asarray(a, dtype=np.float64) ** 2 + np.asarray(b, dtype=np.float64) ** 2)
