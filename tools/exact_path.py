#!/usr/bin/env python3
"""Emit the exact, dependency-ordered breeding sequence from OWNED to all
recommended base workers. Validates that every parent exists before it's used.
Writes exact_breeding_path.md and prints it.

Usage:
  python3 exact_path.py -o Pal1 "Pal Two" ... -t Target1 Target2 ...
  python3 exact_path.py -of owned.txt -tf targets.txt
"""
import os, sys, collections, argparse
import breeding_engine as E

DATA = os.path.join(os.path.dirname(__file__), "..", "data")
D = os.path.dirname(__file__)

WORKLBL = {"Generating_Electricity": "Electricity"}


def wfmt(n):
    return ", ".join(
        f"{WORKLBL.get(j, j)} {v}"
        for j, v in sorted(E.WORK[n].items(), key=lambda x: -x[1])
        if v
    )


def parse_args():
    parser = argparse.ArgumentParser(
        description="Exact breeding path calculator for Palworld 1.0"
    )
    parser.add_argument(
        "-o", "--owned", nargs="*", default=None,
        help="Owned pals (space-separated list)"
    )
    parser.add_argument(
        "-of", "--owned-file", default=None,
        help="File with owned pals, one per line"
    )
    parser.add_argument(
        "-t", "--targets", nargs="*", default=None,
        help="Target pals (space-separated list)"
    )
    parser.add_argument(
        "-tf", "--targets-file", default=None,
        help="File with target pals, one per line"
    )
    return parser.parse_args()


def main():
    args = parse_args()

    # ---- collect owned pals -------------------------------------------------
    owned = []
    if args.owned:
        owned.extend(args.owned)
    if args.owned_file:
        with open(args.owned_file) as f:
            owned.extend([line.strip() for line in f if line.strip()])

    # ---- collect target pals ------------------------------------------------
    targets = []
    if args.targets:
        targets.extend(args.targets)
    if args.targets_file:
        with open(args.targets_file) as f:
            targets.extend([line.strip() for line in f if line.strip()])

    if not owned or not targets:
        print("Usage: python3 exact_path.py -o Pal1 \"Pal Two\" ... -t Target1 Target2 ...")
        print("   or: python3 exact_path.py -of owned.txt -tf targets.txt")
        sys.exit(1)

    # ---- reachability & path computation ------------------------------------
    depth, steps, recipe, frag = E.reachable(owned, max_depth=8)

    # consolidated dependency-ordered steps (dedup, first occurrence)
    seen, order = set(), []
    for t in targets:
        for a, b, c in E.steps_ordered(t, recipe):
            if c not in seen:
                seen.add(c)
                order.append((a, b, c))

    # ---- validate ordering: parents must be owned or bred earlier -----------
    bred_by = {}
    avail = set(owned)
    for i, (a, b, c) in enumerate(order, 1):
        assert a in avail, f"step {i}: parent {a} not available yet"
        assert b in avail, f"step {i}: parent {b} not available yet"
        avail.add(c)
        bred_by[c] = i

    # ---- check for unreachable targets -------------------------------------
    unreachable = [t for t in targets if t not in bred_by]
    if unreachable:
        print("Error: the following targets are not reachable within "
              "max breeding generations from your owned pals:")
        for t in unreachable:
            print(f"  - {t}")
        sys.exit(1)

    # ---- how many times each owned pal is used as a parent ------------------
    owned_use = collections.Counter()
    same_species_needed = set()
    for a, b, c in order:
        for p in (a, b):
            if p in owned:
                owned_use[p] += 1
        if a == b:
            same_species_needed.add(a)

    def tag(p):
        if p in owned:
            return f"{p} _(owned)_"
        return f"{p} _(step {bred_by[p]})_" if p in bred_by else p

    # ---- build report -------------------------------------------------------
    L = []
    L.append("# Exact breeding path — from your pals to all base workers (Palworld 1.0)\n")
    L.append(
        f"Start with only the **{len(owned)}** pals you own and breed in this exact order. "
        "Every step's parents are either **owned** or **bred in an earlier step** (validated). "
        "`★` = guaranteed special combo · `⚠` = tie step (verify on paldb.cc) · "
        "🎯 = a final base worker.\n"
    )
    L.append(
        "**Keep every pal you breed** — many are reused as parents. You need one **male + one "
        "female** per pairing; for same-species steps you need two of that species.\n"
    )
    L.append(
        "> ⚠ **Farm hygiene:** the Breeding Farm auto-pairs *any* male+female left inside, so "
        "put **only the two intended parents** in the pen for each step and remove them before "
        "the next one. (e.g. Sparkit + a leftover Chillet from step 1 makes **Leezpunk**, not "
        "Relaxaurus Lux.)\n"
    )

    for i, (a, b, c) in enumerate(order, 1):
        _, fragile = E.breed_detail(a, b)
        mark = " ★" if E.is_special(a, b) else (" ⚠" if fragile else "")
        goal = f"  🎯 **{wfmt(c)}**" if c in targets else ""
        L.append(
            f"{i}. **{a}** + **{b}** → **{c}**{mark}"
            f"   \n   _(_ {tag(a)} + {tag(b)} _)_{goal}"
        )

    L.append(f"\n## Owned pals you'll use as parents (keep them alive)\n")
    for p, n in owned_use.most_common():
        extra = "  ← need a **breeding pair (M+F)**" if p in same_species_needed else ""
        L.append(f"- **{p}** × {n} pairing(s){extra}")
    unused = [p for p in owned if p not in owned_use]
    L.append(f"\nNot needed for this plan (free to use elsewhere): {', '.join(unused)}.\n")

    L.append(f"## The {len(targets)} base workers you end up with\n")
    for t in targets:
        L.append(f"- **{t}** (step {bred_by[t]}) — {wfmt(t)}")

    open(os.path.join(D, "exact_breeding_path.md"), "w").write("\n".join(L))
    print("\n".join(L))
    print(f"\n[validated {len(order)} steps; ordering OK]")


if __name__ == "__main__":
    main()
