"""Command-line driver for the reference kernel.

    python -m kernel.cli --seed island-001 --years 40 --render

Ignite an island, run it, and show what it did.  This is the studio's own
instrument, not something that ships inside the object -- but it consumes exactly
the same StateFrames and drives exactly the same Kinetic Score that the Heart
will (docs/02 §8).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from .island import Island, IslandConfig
from .ports import ascii_render
from .ports.kinetic import KineticScore
from .substrate.rng import seed_from_phrase


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="kernel.cli", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--seed", default="island-001",
                   help="seed phrase; production seeds are 32 raw bytes (docs/07 §3)")
    p.add_argument("--island-id", type=int, default=0, help="1..404, 0 = studio")
    p.add_argument("--years", type=int, default=25, help="island-years to run after ignition")
    p.add_argument("--genesis", type=float, default=400000.0,
                   help="deep-time spin-up before ignition, in years")
    p.add_argument("--post-shield", type=float, default=0.0,
                   help="further deep time after the hotspot moves on; this is the "
                        "stage where rivers carve the landscape (try 300000)")
    p.add_argument("--grid", type=int, default=96, help="cells per side")
    p.add_argument("--cell", type=float, default=240.0, help="cell size, metres")
    p.add_argument("--lat", type=float, default=19.5, help="latitude, degrees")
    p.add_argument("--render", action="store_true", help="draw the island each year")
    p.add_argument("--precip", action="store_true", help="draw the rainfall field")
    p.add_argument("--score", type=str, default=None,
                   help="Kinetic Score TOML to evaluate (hardware/scores/vitrine-01.toml)")
    p.add_argument("--strict", action="store_true",
                   help="fail hard on any ledger residual (CI mode)")
    p.add_argument("--json", type=str, default=None, help="write final state summary here")
    p.add_argument("--image", type=str, default=None,
                   help="write the scene as a PNG (the artwork's primary view)")
    p.add_argument("--atlas", type=str, default=None,
                   help="write the field atlas as a PNG: every simulated field, labelled")
    p.add_argument("--image-size", type=str, default="960x600")
    p.add_argument("--hour", type=float, default=None,
                   help="time of day for the image, 0..24 (default: whatever time it is)")
    p.add_argument("--view-azimuth", type=float, default=215.0)
    p.add_argument("--view-elevation", type=float, default=19.0)
    p.add_argument("--zoom", type=float, default=1.75)
    p.add_argument("--quiet", action="store_true")
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)

    cfg = IslandConfig(
        seed=seed_from_phrase(args.seed), island_id=args.island_id,
        nx=args.grid, ny=args.grid, cell_size_m=args.cell,
        latitude_deg=args.lat, genesis_years=args.genesis,
        post_shield_years=args.post_shield, strict_ledger=args.strict,
    )

    t0 = time.time()
    if not args.quiet:
        print(f"igniting island '{args.seed}' "
              f"({args.grid}x{args.grid} @ {args.cell:.0f} m, lat {args.lat:.1f})", flush=True)
    island = Island(cfg)
    t_genesis = time.time() - t0

    if not args.quiet:
        v = island.volcano
        print(f"genesis: {args.genesis:,.0f} yr in {t_genesis:.1f} s | "
              f"{v.eruptions} eruptions, {v.volume_erupted_m3/1e9:.1f} km3 | "
              f"plate {v.plate_age_myr:.2f} Myr | stage {v.stage}")

    score = KineticScore.load(args.score) if args.score else None

    t1 = time.time()
    for year in range(args.years):
        events = island.step_year()
        if args.render and not args.quiet:
            print("\033[H\033[J", end="")
            print(ascii_render.frame_to_ansi(island, width=args.grid))
        if args.precip and not args.quiet:
            print(ascii_render.precip_map(island, width=args.grid))
        if not args.quiet:
            line = ascii_render.status_line(island)
            if events:
                line += "  <- " + ", ".join(sorted(set(events)))
            print(line, flush=True)

    if args.hour is not None:
        island.state.sim_days = float(int(island.state.sim_days)) + args.hour / 24.0

    frame = island.delta_frame()
    full = island.full_frame()
    t_run = time.time() - t1

    if args.image or args.atlas:
        w, h = (int(v) for v in args.image_size.lower().split("x"))
        if args.image:
            from .ports.render import Renderer
            from .ports import png
            t2 = time.time()
            r = Renderer(island, width=w, height=h,
                         azimuth_deg=args.view_azimuth,
                         elevation_deg=args.view_elevation, zoom=args.zoom)
            png.write(args.image, r.render())
            if not args.quiet:
                print(f"\nwrote {args.image}  ({w}x{h}, {time.time() - t2:.1f} s)")
        if args.atlas:
            from .ports import atlas
            atlas.write(island, args.atlas)
            if not args.quiet:
                print(f"wrote {args.atlas}")

    if not args.quiet:
        print()
        print(f"ran {args.years} island-years in {t_run:.1f} s "
              f"({t_run / max(args.years, 1):.2f} s/yr)")

        print("\nconservation ledger")
        for name, a in island.ledger.audit().items():
            mark = "ok " if a["ok"] else "OPEN"
            print(f"  {mark} {name:<9} accumulated residual {a['relative_accum']:.3e} "
                  f"relative | worst step {a['worst_relative_step']:.3e}")
        if island.ledger.anomalies:
            print(f"  {len(island.ledger.anomalies)} anomalies, first: "
                  f"{island.ledger.anomalies[0]}")

        print("\nchronicle")
        for e in island.evo.chronicle.entries[-14:]:
            print(f"  year {e['year']:>8.1f}  {e['kind']:<13} {e['text']}")

        print("\nlineages")
        for slot, ln in enumerate(island.veg.lineages):
            import numpy as np
            b = float(np.sum(island.veg.biomass[slot]))
            if b < 1e-6:
                continue
            tr = ln.traits
            print(f"  #{ln.id:<3} ({ln.origin:<20}) biomass {b:8.1f}  "
                  f"LMA {tr['lma']:6.1f}  wood {tr['wood_density']:.2f}  "
                  f"h_max {tr['h_max']:5.1f}  psi50 {tr['psi_50']:7.1f}")

        print("\nprovenance")
        print(f"  genesis seed   {cfg.seed.hex()}")
        print(f"  frames         {island.hasher.n_delta} delta, {island.hasher.n_full} full")
        print(f"  chain root     {island.hasher.root_hex()}")

        if score is not None:
            print(f"\nkinetic score '{score.name}' ({score.piece})")
            values = score.render(frame.as_dict(), dt=1.0, capability="C")
            for name in sorted(values):
                print(f"  {name:<22} {values[name]:.4f}")

    if args.json:
        out = {
            "seed_phrase": args.seed,
            "genesis_seed_hex": cfg.seed.hex(),
            "island_id": args.island_id,
            "years": args.years,
            "chain_root": island.hasher.root_hex(),
            "diagnostics": island.diagnostics,
            "delta_frame": frame.as_dict(),
            "ledger": island.ledger.audit(),
            "chronicle": island.evo.chronicle.entries,
            "timings": {"genesis_s": t_genesis, "run_s": t_run},
        }
        Path(args.json).write_text(json.dumps(out, indent=2, default=float))
        if not args.quiet:
            print(f"\nwrote {args.json}")

    return 0 if island.ledger.ok() else 1


if __name__ == "__main__":
    sys.exit(main())
