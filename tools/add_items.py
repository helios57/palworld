#!/usr/bin/env python3
"""Add items to a storage container in a Palworld 1.0 ``Level.sav``.

Writes a new ``PlZ`` save; the game loads it and rewrites it as ``PlM`` on the
next autosave. The input file is never modified in place.

Stop the server before installing the result, or it will overwrite the edit
with the world it still holds in memory.

Examples::

    # 9999 AI Cores into a specific chest
    python tools/add_items.py Level.sav --container <guid> \
        --item AIcore:9999 -o Level.edited.sav

    # Several items into the emptiest chest of the main base
    python tools/add_items.py Level.sav --base main --auto-chest \
        --item AIcore:9999 --item Thermal_Core:9999 -o Level.edited.sav

Item ids are the game's internal names (``AIcore``, ``Thermal_Core``,
``AncientParts2``), not display names. ``inspect_save.py --contents`` shows the
ids already present in your world; paldb.cc lists the rest under "code name".
"""

import argparse
import sys

import palsave

DEFAULT_MAX_STACK = 9999


def parse_item(spec: str) -> tuple[str, int]:
    """Parse an ``ItemId:count`` argument."""
    if ":" not in spec:
        raise argparse.ArgumentTypeError(
            f"expected ItemId:count, got {spec!r} (e.g. AIcore:9999)"
        )
    static_id, _, count = spec.rpartition(":")
    if not static_id:
        raise argparse.ArgumentTypeError(f"missing item id in {spec!r}")
    try:
        quantity = int(count)
    except ValueError:
        raise argparse.ArgumentTypeError(f"count must be a number in {spec!r}") from None
    if quantity <= 0:
        raise argparse.ArgumentTypeError(f"count must be positive in {spec!r}")
    return static_id, quantity


def pick_chest(gvas, base_id: str) -> str:
    """Container id of the chest in ``base_id`` with the most free slots."""
    entries = palsave.containers(gvas)
    best, best_free = None, -1
    for chest in palsave.iter_chests(gvas):
        if chest.base_id != base_id:
            continue
        entry = entries[chest.container_id]
        free = palsave.slot_num(entry) - len(palsave.read_slots(entry))
        if free > best_free:
            best, best_free = chest.container_id, free
    if best is None:
        raise ValueError(f"no player-built chest found in base {base_id}")
    if best_free <= 0:
        raise ValueError(f"every chest in base {base_id} is full")
    return best


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Add items to a container in a Palworld save.",
        epilog=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("save", help="path to the source Level.sav")
    parser.add_argument("-o", "--output", required=True, help="path for the edited save")
    parser.add_argument("--item", required=True, action="append", type=parse_item,
                        metavar="ID:COUNT", help="item to add; repeatable")
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--container", help="container guid to add to")
    target.add_argument("--base", help="base camp guid, or 'main' for the largest")
    parser.add_argument("--auto-chest", action="store_true",
                        help="with --base, pick the chest with the most free slots")
    parser.add_argument("--max-stack", type=int, default=DEFAULT_MAX_STACK,
                        help=f"per-slot stack cap (default {DEFAULT_MAX_STACK})")
    parser.add_argument("--dry-run", action="store_true",
                        help="show the plan without writing anything")
    args = parser.parse_args(argv)

    if args.base and not args.auto_chest:
        parser.error("--base needs --auto-chest (or name a --container directly)")

    try:
        gvas, raw, header = palsave.load_sav(args.save)
    except (palsave.UnsupportedSaveError, FileNotFoundError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"{args.save}: {header.format} save, {len(raw):,} bytes of GVAS")

    # An edit is only trustworthy if an untouched parse reproduces the input.
    if palsave.write_gvas(gvas) != raw:
        print("ERROR: this save does not round-trip byte-identically; "
              "refusing to edit it", file=sys.stderr)
        return 1
    print("round-trip check: OK")

    if args.container:
        container_id = args.container
    else:
        base_id = palsave.main_base_id(gvas) if args.base == "main" else args.base
        try:
            container_id = pick_chest(gvas, base_id)
        except ValueError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1
        print(f"base {base_id} -> chest {container_id}")

    entry = palsave.containers(gvas).get(container_id)
    if entry is None:
        print(f"ERROR: no container {container_id}", file=sys.stderr)
        return 1

    before = palsave.read_slots(entry)
    print(f"container {container_id}: "
          f"{len(before)}/{palsave.slot_num(entry)} slots used")

    try:
        plan = palsave.plan_additions(entry, args.item, args.max_stack)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    for addition in plan:
        print(f"  + slot {addition.slot:3d}  {addition.static_id:36} x{addition.count}")

    if args.dry_run:
        print("dry run: nothing written")
        return 0

    palsave.apply_additions(entry, plan)

    written = palsave.save_plz(args.output, gvas)
    print(f"wrote {args.output} ({written:,} bytes, PlZ)")

    # Re-read what we just wrote and confirm the container looks right.
    check, _, _ = palsave.load_sav(args.output)
    after = palsave.read_slots(palsave.containers(check)[container_id])
    added = {(a.slot, a.static_id, a.count) for a in plan}
    found = {(s.index, s.static_id, s.count) for s in after}
    if not added <= found:
        print("ERROR: verification failed, missing "
              f"{sorted(added - found)}", file=sys.stderr)
        return 1
    print(f"verified: {len(after)} slots now occupied, all additions present")
    return 0


if __name__ == "__main__":
    sys.exit(main())
