"""Studio-side seed characterisation and curation (docs/07 §2).

Never ships inside the object.  This is how the 404 get chosen from millions: every
candidate is integrated far enough to characterise it, scored on a descriptor
vector, and then the edition is selected to *span* that space rather than to
maximise prettiness.

An atlas needs the austere, the arid, and the nearly-drowned.  404 lush green
paradises would be a decorating scheme, not a work.

    python -m studio.seed_search --candidates 200 --out candidates.json
    python -m studio.seed_search --curate candidates.json --select 24
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from kernel.geo import reef
from kernel.island import Island, IslandConfig
from kernel.substrate.rng import seed_from_phrase

# The descriptor axes the edition must span.  Order is fixed; append only.
DESCRIPTORS = (
    "summit_m", "land_area_km2", "ruggedness", "reef_stage",
    "precip_mean_mm", "orographic_contrast", "latitude_deg",
    "substrate_age_kyr", "volcanic_supply", "lens_health",
)


def characterise(phrase: str, latitude: float, grid: int = 48,
                 cell: float = 380.0, genesis: float = 400000.0,
                 years: int = 5) -> dict:
    """Integrate one candidate far enough to know what it is."""
    cfg = IslandConfig(seed=seed_from_phrase(phrase), nx=grid, ny=grid,
                       cell_size_m=cell, latitude_deg=latitude,
                       genesis_years=genesis)
    isl = Island(cfg)
    for _ in range(years):
        isl.step_year()

    z = isl.state.z
    land = z > isl.state.sea_level
    g = isl.grid
    p = isl.annual_precip_mm
    d = isl.diagnostics

    if not np.any(land):
        ruggedness = 0.0
        contrast = 1.0
        precip = float(p.mean())
    else:
        ruggedness = float(np.mean(g.slope(z)[land]))
        wet = float(np.percentile(p[land], 90))
        dry = float(np.percentile(p[land], 10))
        contrast = wet / max(dry, 1.0)
        precip = float(p[land].mean())

    return {
        "phrase": phrase,
        "seed_hex": cfg.seed.hex(),
        "summit_m": float(np.max(z - isl.state.sea_level)),
        "land_area_km2": float(np.sum(land)) * g.cell_area_m2 / 1e6,
        "ruggedness": ruggedness,
        "reef_stage": float(reef.REEF_STAGE_ID.get(isl.state.reef_stage, 0)),
        "reef_stage_name": isl.state.reef_stage,
        "precip_mean_mm": precip,
        "orographic_contrast": contrast,
        "latitude_deg": latitude,
        "substrate_age_kyr": float(isl.volcano.plate_age_myr * 1000.0),
        "volcanic_supply": float(isl.volcano.supply_now()),
        "lens_health": float(d.get("lens_volume_m3", 0.0)) ** 0.25,
        "species": int(d.get("species", 0)),
        "sst_c": float(d.get("sst_c", 0.0)),
        "chain_root": isl.hasher.root_hex(),
    }


def _normalise(rows: list[dict]) -> np.ndarray:
    """Z-score each descriptor so no axis dominates the distance metric."""
    m = np.array([[r[k] for k in DESCRIPTORS] for r in rows], dtype=np.float64)
    mu = m.mean(axis=0)
    sd = m.std(axis=0)
    sd[sd < 1e-12] = 1.0
    return (m - mu) / sd


def curate(rows: list[dict], n_select: int) -> list[dict]:
    """Farthest-point selection: maximise coverage, not quality.

    A top-N ranking by any single measure would return 404 near-duplicates of
    whatever that measure likes.  Farthest-point traversal instead walks outward
    to the extremes of the space and then fills the interior, which is what makes
    the finished collection an atlas of what an island can be.
    """
    if n_select >= len(rows):
        return list(rows)
    x = _normalise(rows)
    # Start from the most extreme candidate, so the traversal is deterministic.
    first = int(np.argmax(np.linalg.norm(x, axis=1)))
    chosen = [first]
    dist = np.linalg.norm(x - x[first], axis=1)
    while len(chosen) < n_select:
        nxt = int(np.argmax(dist))
        chosen.append(nxt)
        dist = np.minimum(dist, np.linalg.norm(x - x[nxt], axis=1))
    return [rows[i] for i in sorted(chosen)]


def rarity_statement(rows: list[dict], predicate, description: str) -> str:
    """The catalogue's rarity claims are checkable statements about the search.

    'Of 1.2 million candidate islands, 31 developed X' is verifiable by anyone who
    reruns the search from the published parameters.  That is worth far more than
    an assigned scarcity tier (docs/07 §2.1).
    """
    n = sum(1 for r in rows if predicate(r))
    return f"Of {len(rows):,} candidate islands, {n} {description}."


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="studio.seed_search", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--candidates", type=int, default=0, help="how many to characterise")
    ap.add_argument("--prefix", default="cand")
    ap.add_argument("--grid", type=int, default=48)
    ap.add_argument("--genesis", type=float, default=400000.0)
    ap.add_argument("--out", default="candidates.json")
    ap.add_argument("--curate", default=None, help="curate an existing candidates file")
    ap.add_argument("--select", type=int, default=24)
    args = ap.parse_args(argv)

    if args.curate:
        rows = json.loads(Path(args.curate).read_text())
        picked = curate(rows, args.select)
        print(f"selected {len(picked)} of {len(rows)} to span {len(DESCRIPTORS)} axes\n")
        for r in picked:
            print(f"  {r['phrase']:<14} summit {r['summit_m']:6.0f} m  "
                  f"land {r['land_area_km2']:6.2f} km2  {r['reef_stage_name']:<14} "
                  f"lat {r['latitude_deg']:5.1f}  rain {r['precip_mean_mm']:6.0f} mm  "
                  f"contrast {r['orographic_contrast']:5.1f}x")
        print()
        print(rarity_statement(rows, lambda r: r["orographic_contrast"] > 8.0,
                               "developed a rain shadow stronger than eightfold"))
        print(rarity_statement(rows, lambda r: r["summit_m"] > 1500.0,
                               "rose more than 1,500 m above the sea"))
        print(rarity_statement(rows, lambda r: r["reef_stage_name"] == "atoll",
                               "had already become atolls"))
        return 0

    rows = []
    for i in range(args.candidates):
        # Latitude is part of the candidate, not a constant: the edition must
        # include cold islands and arid ones, not only the tropics.
        lat = -60.0 + 120.0 * ((i * 0.6180339887498949) % 1.0)
        phrase = f"{args.prefix}-{i:05d}"
        row = characterise(phrase, lat, grid=args.grid, genesis=args.genesis)
        rows.append(row)
        print(f"{i + 1:>5}/{args.candidates}  {phrase}  lat {lat:6.1f}  "
              f"summit {row['summit_m']:6.0f} m  land {row['land_area_km2']:6.2f} km2  "
              f"{row['reef_stage_name']}", flush=True)
    Path(args.out).write_text(json.dumps(rows, indent=2))
    print(f"\nwrote {len(rows)} candidates to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
