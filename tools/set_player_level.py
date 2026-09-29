#!/usr/bin/env python3
"""Set player levels in a Palworld 1.0 ``Level.sav``.

Writes a new ``PlZ`` save; the input file is never modified in place. Stop the
server before installing the result, or it will overwrite the edit with the
world it still holds in memory.

Palworld stores a *cumulative* Exp total alongside the level, so both have to
move together: a level with too little Exp behind it can be recalculated back
down during play. Level 80 is the 1.0 cap and its threshold is known
(45,859,908), so ``--level 80`` needs no ``--exp``. For any other level pass
``--exp`` explicitly rather than have the tool invent a curve.

Examples::

    # everyone to the level cap
    python tools/set_player_level.py Level.sav --all --level 80 -o out.sav

    # one player, explicit level and cumulative exp
    python tools/set_player_level.py Level.sav --player SomePlayer \
        --level 60 --exp 6000000 -o out.sav

    # just look
    python tools/set_player_level.py Level.sav --list
"""

import argparse
import sys

import palsave


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Set player levels in a Palworld save.",
        epilog=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("save", help="path to the source Level.sav")
    parser.add_argument("-o", "--output", help="path for the edited save")
    parser.add_argument("--list", action="store_true",
                        help="list players and exit")
    who = parser.add_mutually_exclusive_group()
    who.add_argument("--all", action="store_true", help="every player")
    who.add_argument("--player", action="append", metavar="NAME_OR_UID",
                     help="one player by nickname or uid; repeatable")
    parser.add_argument("--level", type=int, help="target level (1-80)")
    parser.add_argument("--exp", type=int,
                        help="cumulative exp; defaults to the cap value at level 80")
    parser.add_argument("--dry-run", action="store_true",
                        help="show what would change without writing")
    args = parser.parse_args(argv)

    try:
        gvas, raw, header = palsave.load_sav(args.save)
    except (palsave.UnsupportedSaveError, FileNotFoundError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(f"{args.save}: {header.format} save, {len(raw):,} bytes of GVAS")

    players = list(palsave.iter_players(gvas))
    if not players:
        print("ERROR: no player characters found", file=sys.stderr)
        return 1

    if args.list:
        print(f"\n{len(players)} players:")
        for p in players:
            print(f"  {p.nickname:14} {p.uid}  Level {p.level:3d}  Exp {p.exp:,}")
        return 0

    if args.level is None:
        parser.error("--level is required (or use --list)")
    if not args.all and not args.player:
        parser.error("choose --all or --player NAME")

    if args.exp is not None:
        exp = args.exp
    elif args.level == palsave.PLAYER_MAX_LEVEL:
        exp = palsave.PLAYER_EXP_AT_MAX_LEVEL
    else:
        parser.error(
            f"--exp is required for level {args.level}; only the level "
            f"{palsave.PLAYER_MAX_LEVEL} threshold is known "
            f"({palsave.PLAYER_EXP_AT_MAX_LEVEL:,}). Passing too little exp for "
            "a level can get it recalculated back down in game."
        )

    if args.level > palsave.PLAYER_MAX_LEVEL:
        print(f"WARNING: level {args.level} is above the 1.0 cap of "
              f"{palsave.PLAYER_MAX_LEVEL}", file=sys.stderr)

    # An edit is only trustworthy if an untouched parse reproduces the input.
    if palsave.write_gvas(gvas) != raw:
        print("ERROR: this save does not round-trip byte-identically; "
              "refusing to edit it", file=sys.stderr)
        return 1
    print("round-trip check: OK")

    if args.all:
        targets = players
    else:
        wanted = {w.lower() for w in args.player}
        targets = [p for p in players
                   if p.nickname.lower() in wanted or p.uid.lower() in wanted]
        missing = wanted - {p.nickname.lower() for p in targets} \
                         - {p.uid.lower() for p in targets}
        if missing:
            print(f"ERROR: no such player(s): {', '.join(sorted(missing))}",
                  file=sys.stderr)
            print("       known: " + ", ".join(p.nickname for p in players),
                  file=sys.stderr)
            return 1

    print(f"\n{len(targets)} player(s) -> level {args.level}, exp {exp:,}:")
    for p in targets:
        print(f"  {p.nickname:14} Level {p.level:3d} -> {args.level}   "
              f"Exp {p.exp:,} -> {exp:,}")

    if args.dry_run:
        print("dry run: nothing written")
        return 0
    if not args.output:
        parser.error("-o/--output is required unless --dry-run or --list")

    for p in targets:
        palsave.set_player_level(p, args.level, exp)

    written = palsave.save_plz(args.output, gvas)
    print(f"\nwrote {args.output} ({written:,} bytes, PlZ)")

    # Re-read what we wrote and confirm.
    check, _, _ = palsave.load_sav(args.output)
    after = {p.uid: p for p in palsave.iter_players(check)}
    for p in targets:
        got = after.get(p.uid)
        if got is None or got.level != args.level or got.exp != exp:
            print(f"ERROR: verification failed for {p.nickname}: {got}",
                  file=sys.stderr)
            return 1
    print(f"verified: {len(targets)} player(s) now at level {args.level}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
