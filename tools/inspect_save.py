#!/usr/bin/env python3
"""Inspect a Palworld 1.0 ``Level.sav``: bases, storage chests and contents.

Read-only. Use this to find the container id you want before running
``add_items.py``.

Examples::

    # Overview of every base camp
    python tools/inspect_save.py Level.sav

    # Chests and contents of the main base
    python tools/inspect_save.py Level.sav --base main --contents

    # One specific container
    python tools/inspect_save.py Level.sav --container <guid>

    # Confirm the parser reproduces your save byte for byte
    python tools/inspect_save.py Level.sav --verify
"""

import argparse
import collections
import sys

import palsave


def _collect(gvas):
    """Group chests by base camp, with decoded contents."""
    bases = collections.defaultdict(
        lambda: {"objects": 0, "chests": [], "items": collections.Counter()}
    )
    for map_object in palsave.map_objects(gvas):
        bases[palsave.map_object_base_id(map_object)]["objects"] += 1

    entries = palsave.containers(gvas)
    for chest in palsave.iter_chests(gvas):
        entry = entries[chest.container_id]
        slots = palsave.read_slots(entry)
        bases[chest.base_id]["chests"].append((chest, entry, slots))
        for slot in slots:
            if not slot.empty:
                bases[chest.base_id]["items"][slot.static_id] += slot.count
    return bases


def _print_bases(bases, main):
    print(f"{'base camp':43} {'objects':>8} {'chests':>7} {'slots used/cap':>15}  top items")
    for base_id, info in sorted(bases.items(), key=lambda kv: -len(kv[1]["chests"])):
        if not info["chests"] and info["objects"] < 5:
            continue
        used = sum(len(s) for _, _, s in info["chests"])
        cap = sum(palsave.slot_num(e) for _, e, _ in info["chests"])
        top = ", ".join(f"{n} x{c}" for n, c in info["items"].most_common(5))
        tag = " (main)" if base_id == main else ""
        print(
            f"{base_id}{tag:<7} {info['objects']:8d} {len(info['chests']):7d} "
            f"{used:>7d}/{cap:<7d}  {top[:70]}"
        )


def _print_chests(info, show_contents):
    for chest, entry, slots in info["chests"]:
        cap = palsave.slot_num(entry)
        print(f"\n  {chest.map_object_id:14} {chest.container_id}  "
              f"{len(slots)}/{cap} slots used")
        if show_contents:
            for slot in sorted(slots, key=lambda s: s.index):
                if not slot.empty:
                    print(f"      slot {slot.index:3d}  {slot.static_id:36} x{slot.count}")


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Inspect bases, chests and items in a Palworld save.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("save", help="path to Level.sav")
    parser.add_argument("--base", help="base camp guid, or 'main' for the largest")
    parser.add_argument("--container", help="show a single container by guid")
    parser.add_argument("--contents", action="store_true", help="list items per chest")
    parser.add_argument("--verify", action="store_true",
                        help="check the parser reproduces the file byte for byte")
    args = parser.parse_args(argv)

    try:
        gvas, raw, header = palsave.load_sav(args.save)
    except palsave.UnsupportedSaveError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    except FileNotFoundError:
        print(f"ERROR: file not found: {args.save}", file=sys.stderr)
        return 1

    print(f"{args.save}: {header.format} save, {len(raw):,} bytes of GVAS")

    if args.verify:
        ok = palsave.write_gvas(gvas) == raw
        print(f"round-trip byte-identical: {ok}")
        if not ok:
            print("refusing to vouch for edits on this file", file=sys.stderr)
            return 1

    if args.container:
        entries = palsave.containers(gvas)
        entry = entries.get(args.container)
        if entry is None:
            print(f"ERROR: no container {args.container}", file=sys.stderr)
            return 1
        cap = palsave.slot_num(entry)
        slots = palsave.read_slots(entry)
        print(f"\ncontainer {args.container}: {len(slots)}/{cap} slots used")
        for slot in sorted(slots, key=lambda s: s.index):
            print(f"  slot {slot.index:3d}  {slot.static_id or '(empty)':36} x{slot.count}")
        return 0

    bases = _collect(gvas)
    main_id = palsave.main_base_id(gvas)

    if args.base:
        base_id = main_id if args.base == "main" else args.base
        if base_id not in bases:
            print(f"ERROR: no base camp {base_id}", file=sys.stderr)
            return 1
        info = bases[base_id]
        print(f"\nbase {base_id}: {info['objects']} objects, {len(info['chests'])} chests")
        _print_chests(info, args.contents)
        print("\n  totals:")
        for name, count in info["items"].most_common(20):
            print(f"      {name:36} x{count}")
        return 0

    print()
    _print_bases(bases, main_id)
    print(f"\nmain base (most objects): {main_id}")
    print("re-run with --base main --contents to list its chests")
    return 0


if __name__ == "__main__":
    sys.exit(main())
