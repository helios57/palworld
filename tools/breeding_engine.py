#!/usr/bin/env python3
"""Palworld 1.0 breeding engine.
- breed(a,b): special-combo override -> same-species -> CombiRank averaging formula
  child = floor((rankA+rankB+1)/2); nearest pal in the generic pool; ties -> higher rank.
- Reachability search (min breeding generations) from a set of OWNED pals.
- Path reconstruction toward the best base-working pals.
Usage: python3 tools/breeding_engine.py Pal1 "Pal Two" Pal3
       python3 tools/breeding_engine.py -f <file>
"""
import json, os, csv, sys

D = os.path.join(os.path.dirname(__file__), "..", "data")
pals = json.load(open(os.path.join(D, "pals.json")))
combos = json.load(open(os.path.join(D, "special_combos.json")))
RANK = {n: p["combi_rank"] for n, p in pals.items()}
POOL = [n for n, p in pals.items() if p["in_generic_pool"]]
POOL_SORTED = sorted(POOL, key=lambda n: RANK[n])
WORK = {n: p.get("work", {}) for n, p in pals.items()}

# special combos: unordered lookup -> child
SPECIAL = {}
for c in combos:
    SPECIAL[frozenset((c["parent_a"], c["parent_b"]))] = c["child"]

def formula_child(ra, rb):
    """Return (child, fragile). fragile=True if the result depends on the tie-break
    rule (another pool pal is exactly equidistant from the target)."""
    t = (ra + rb + 1) // 2
    best, bestkey = None, None
    for n in POOL_SORTED:
        key = (abs(RANK[n] - t), -RANK[n])   # nearest; tie -> higher rank (1.0)
        if bestkey is None or key < bestkey:
            bestkey, best = key, n
    d = abs(RANK[best] - t)
    fragile = any(n != best and abs(RANK[n] - t) == d for n in POOL)
    return best, fragile

# cache formula results by (rank pair) for speed
_fcache = {}
def breed_detail(a, b):
    """(child, fragile) for a pairing. Special combos / same-species are never fragile."""
    s = SPECIAL.get(frozenset((a, b)))
    if s is not None:
        return s, False
    if a == b:
        return a, False
    ra, rb = RANK[a], RANK[b]
    k = (min(ra, rb), max(ra, rb))
    if k not in _fcache:
        _fcache[k] = formula_child(ra, rb)
    return _fcache[k]

def breed(a, b):
    return breed_detail(a, b)[0]

# --- documented in-game sanity check (1.0 tie-break) --------------------------
assert breed("Turtacle", "Aegidron") == "Nitemary", breed("Turtacle", "Aegidron")

def reachable(owned, max_depth=7):
    """Min-generation breeding reachability from owned pals.
    Cost per pal = (depth, fragile_steps, total_steps): shallowest tree first, then
    fewest tie-break-dependent steps, then fewest total breeds. Returns depth, steps,
    recipe, frag dicts."""
    depth = {p: 0 for p in owned}
    steps = {p: 0 for p in owned}
    frag  = {p: 0 for p in owned}
    recipe = {p: None for p in owned}       # None => owned; else (a,b)
    cost = {p: (0, 0, 0) for p in owned}
    changed = True
    passes = 0
    while changed and passes < max_depth + 3:
        changed = False
        passes += 1
        cur = list(depth)
        for i, a in enumerate(cur):
            for b in cur[i:]:
                child, fragile = breed_detail(a, b)
                if child == a or child == b:
                    continue
                nd = 1 + max(depth[a], depth[b])
                nf = frag[a] + frag[b] + (1 if fragile else 0)
                ns = 1 + steps[a] + steps[b]
                nc = (nd, nf, ns)
                if child not in cost or nc < cost[child]:
                    cost[child] = nc
                    depth[child], frag[child], steps[child] = nd, nf, ns
                    recipe[child] = (a, b)
                    changed = True
    return depth, steps, recipe, frag

def tree(p, recipe):
    r = recipe.get(p)
    if r is None:
        return {"pal": p, "owned": True}
    a, b = r
    return {"pal": p, "parents": [tree(a, recipe), tree(b, recipe)]}

def steps_ordered(p, recipe):
    """Topologically ordered list of breeding steps (parents -> child), deepest first."""
    out, seen = [], set()
    def rec(x):
        r = recipe.get(x)
        if r is None or x in seen:
            return
        a, b = r
        rec(a); rec(b)
        if x not in seen:
            out.append((a, b, x))
            seen.add(x)
    rec(p)
    return out

def is_special(a, b):
    return frozenset((a, b)) in SPECIAL

if __name__ == "__main__":
    # Parse command line arguments
    args = sys.argv[1:]
    if not args:
        print("Usage: python3 breeding_engine.py Pal1 \"Pal Two\" Pal3")
        print("       python3 breeding_engine.py -f <file>")
        print("  Provide pal names as space-separated arguments, or use -f to read from a file")
        sys.exit(1)

    owned = []
    if args[0] == "-f":
        if len(args) < 2:
            print("Error: -f requires a filename argument")
            sys.exit(1)
        filepath = args[1]
        try:
            with open(filepath) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        owned.append(line)
        except FileNotFoundError:
            print(f"Error: file '{filepath}' not found")
            sys.exit(1)
    else:
        owned = args

    if not owned:
        print("Error: no pal names provided")
        sys.exit(1)

    depth, steps, recipe, frag = reachable(owned)
    print(f"owned={len(owned)}  reachable species={len(depth)}  (of {len(pals)} total)")

    JOBS = ["Kindling","Watering","Planting","Generating_Electricity","Handiwork","Gathering",
            "Lumbering","Mining","Medicine","Cooling","Transporting","Farming"]
    # best reachable worker per job
    print("\n=== best REACHABLE worker per job (level, depth, steps) ===")
    for j in JOBS:
        cands = [(WORK[n].get(j,0), -depth[n], n) for n in depth if WORK[n].get(j,0) > 0]
        if not cands: continue
        cands.sort(reverse=True)
        lvl, _, n = cands[0]
        # also show best OWNED already
        owned_best = max([(WORK[n2].get(j,0), n2) for n2 in owned if WORK[n2].get(j,0)>0] or [(0,"-")])
        print(f"  {j:22} -> {n:20} L{lvl}  depth={depth[n]} steps={steps[n]:>2}"
              f"   | owned-best {owned_best[1]} L{owned_best[0]}")
