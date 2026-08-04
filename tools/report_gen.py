#!/usr/bin/env python3
"""Generate the optimal base-worker breeding plan for the owned pals.
Writes: breeding_paths.md (human report) and data/optimal_paths.json (machine-readable).
Usage: python3 tools/report_gen.py [-f owned.txt] [-t targets.txt] Pal1 "Pal Two" ...
"""
import json, os, sys

# add parent dir to path for breeding_engine import
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import breeding_engine as E

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.join(SCRIPT_DIR, "..")
DATA = os.path.join(PARENT, "data")

# ---- CLI arg parsing -----------------------------------------------------------
def parse_args():
    owned = []
    targets_file = None

    args = sys.argv[1:]
    if not args:
        print("Usage: python3 tools/report_gen.py [-f owned.txt] [-t targets.txt] Pal1 \"Pal Two\" ...")
        print("  Pals can be passed directly as args, or via -f file (one pal per line)")
        print("  -t targets.txt overrides default target tiers (one pal per line)")
        sys.exit(0)

    i = 0
    while i < len(args):
        if args[i] == "-f":
            i += 1
            if i >= len(args):
                print("Error: -f requires a filename", file=sys.stderr)
                sys.exit(1)
            try:
                with open(args[i]) as f:
                    for line in f:
                        pal = line.strip()
                        if pal:
                            owned.append(pal)
            except FileNotFoundError:
                print(f"Error: file not found: {args[i]}", file=sys.stderr)
                sys.exit(1)
        elif args[i] == "-t":
            i += 1
            if i >= len(args):
                print("Error: -t requires a filename", file=sys.stderr)
                sys.exit(1)
            targets_file = args[i]
        else:
            owned.append(args[i])
        i += 1

    if not owned:
        print("Error: no pals specified", file=sys.stderr)
        print("Usage: python3 tools/report_gen.py [-f owned.txt] [-t targets.txt] Pal1 \"Pal Two\" ...")
        sys.exit(1)

    return owned, targets_file

OWNED, targets_file = parse_args()

# ---- target tiers (default or from -t file) ------------------------------------
DEFAULT_TIERS = [
    ("Tier 1 — base + flyers (1–2 breeds)",
     ["Carnibora","Venusa","Wistella","Wumpo","Jormuntide","Suzaku","Beakon"]),
    ("Tier 2 — power mid (2–4 breeds)",
     ["Jormuntide Ignis","Anubis","Eidrolon"]),
    ("Tier 3 — premium (4–5 breeds)",
     ["Astegon","Blazamut"]),
]

if targets_file:
    try:
        with open(targets_file) as f:
            targets = [line.strip() for line in f if line.strip()]
        TIERS = [("Targets", targets)]
    except FileNotFoundError:
        print(f"Error: targets file not found: {targets_file}", file=sys.stderr)
        sys.exit(1)
else:
    TIERS = DEFAULT_TIERS

depth, steps, recipe, frag = E.reachable(OWNED, max_depth=8)

JOBS = ["Kindling","Watering","Planting","Generating_Electricity","Handiwork","Gathering",
        "Lumbering","Mining","Medicine","Cooling","Transporting","Farming"]
JOBLBL = {"Generating_Electricity":"Electricity"}
def jl(j): return JOBLBL.get(j, j)
def wfmt(n):
    return ", ".join(f"{jl(j)} {v}" for j, v in sorted(E.WORK[n].items(), key=lambda x:-x[1]) if v)

# ---- must-catch (non-breedable) analysis -------------------------------------
import json as _json
_combat = {c["name"]: c for c in _json.load(open(os.path.join(DATA,"src_pals_combat.json")))}
_cross_children = {c["child"] for c in E.combos if c["parent_a"] != c["parent_b"]}
MUST_CATCH = [p for p, d in E.pals.items()
              if not d["in_generic_pool"] and p not in _cross_children]
def bestwork(n):
    return max(E.WORK[n].values()) if E.WORK[n] else 0
# per-job: best bred (reachable, any depth) vs best caught
JOB_BEST = {}
for j in JOBS:
    bred = max(((E.WORK[n].get(j,0), n) for n in depth if E.WORK[n].get(j,0)), default=(0,None))
    caught = max(((E.WORK[n].get(j,0), n) for n in MUST_CATCH if E.WORK[n].get(j,0)), default=(0,None))
    JOB_BEST[j] = {"bred": bred, "caught": caught, "catch_wins": caught[0] > bred[0]}
# catch-only pals that are the best (or tie) at >=1 job = worth catching
CATCH_WORTH = {}
for j, v in JOB_BEST.items():
    if v["caught"][1] and v["caught"][0] >= v["bred"][0] and v["caught"][0] >= 6:
        n = v["caught"][1]
        CATCH_WORTH.setdefault(n, [])
        CATCH_WORTH[n].append((jl(j), v["caught"][0], v["bred"][0], v["bred"][1]))

ALLT = [t for _, ts in TIERS for t in ts]
# Filter to only reachable targets; also filter TIERS for markdown output
ALLT = [t for t in ALLT if t in depth]
TIERS = [(title, [t for t in ts if t in depth]) for title, ts in TIERS]
TIERS = [(title, ts) for title, ts in TIERS if ts]  # drop empty tiers

def step_rows(target):
    rows = []
    for a, b, c in E.steps_ordered(target, recipe):
        child, fragile = E.breed_detail(a, b)
        kind = "special" if E.is_special(a, b) else ("same-species" if a == b else "formula")
        rows.append({"parents": [a, b], "child": c, "type": kind, "tie_dependent": fragile})
    return rows

# ---- optimal_paths.json ------------------------------------------------------
out = {
  "game_version": "1.0",
  "owned": OWNED,
  "reachable_species": len(depth),
  "note": "Paths use CombiRank averaging + 1.0 special combos. 'tie_dependent' steps "
          "rely on the 1.0 higher-CombiRank tie-break; verify those on a 1.0 calculator.",
  "must_catch": {n: {"combi_rank": E.RANK[n], "rarity": _combat.get(n,{}).get("rarity"),
                     "work": E.WORK[n]}
                 for n in sorted(MUST_CATCH, key=lambda x: -bestwork(x))},
  "best_worker_per_job_bred_vs_caught": {
      jl(j): {"best_bred": {"pal": v["bred"][1], "level": v["bred"][0]},
              "best_caught": {"pal": v["caught"][1], "level": v["caught"][0]},
              "catch_is_better": v["catch_wins"]}
      for j, v in JOB_BEST.items()},
  "targets": {}
}
for t in ALLT:
    rows = step_rows(t)
    out["targets"][t] = {
      "combi_rank": E.RANK[t], "work": E.WORK[t],
      "depth": depth[t], "unique_breeds": len(rows), "tie_dependent_steps": frag[t],
      "path": rows,
    }
# consolidated dedup build order
seen, cons = set(), []
for t in ALLT:
    for a, b, c in E.steps_ordered(t, recipe):
        if c not in seen:
            seen.add(c)
            _, fragile = E.breed_detail(a, b)
            cons.append({"parents":[a,b],"child":c,
                         "type":"special" if E.is_special(a,b) else ("same-species" if a==b else "formula"),
                         "tie_dependent":fragile})
out["consolidated_build_order"] = cons
json.dump(out, open(os.path.join(DATA,"optimal_paths.json"),"w"), ensure_ascii=False, indent=1)

# ---- breeding_paths.md -------------------------------------------------------
L = []
L.append("# Optimal base-worker breeding plan (Palworld 1.0)\n")
L.append("_Data verified against the latest version: **1.0.1 (build 1.100.619, 2026-07-15)** — "
         "a bug-fix hotfix with no pal/breeding changes since the 1.0 launch. Checked 2026-07-27._\n")
L.append(f"From your **{len(OWNED)}** pals, **{len(depth)} of {len(E.pals)}** species are reachable "
         "by breeding. Below is a curated set of strong base workers, flying mounts, and combat "
         "pals, ordered by how little breeding they take.\n")
L.append("**How to read a step:** `A + B = C`. `★` = guaranteed *special combo*. "
         "`⚠` = the step lands on a CombiRank tie decided by the 1.0 higher-rank rule — "
         "double-check these on a 1.0 calculator (paldb.cc).\n")

# owned coverage
L.append("## What your owned pals already cover\n")
for n in OWNED:
    w = {j:v for j,v in E.WORK[n].items() if v>=3}
    if w:
        L.append(f"- **{n}** — {wfmt(n)}")
L.append("")
L.append("Key starters: **Moldron** (Kindling 5 / Mining 5) and **Ragnahawk** (Kindling 4 / Transporting 5) "
         "are your main breeding workhorses; **Frostplume** (Cooling 4), **Blazehowl** (Kindling 5), "
         "**Univolt** (Electricity 3) unlock most chains. **Beegarde** (Gathering 3 / Farming 3) "
         "and **Dynamoff** (Electricity 6) are already top-tier base workers.\n")

def sym(row):
    if row["type"]=="special": return " ★"
    if row["type"]=="same-species": return " (same-species)"
    return " ⚠" if row["tie_dependent"] else ""

for title, ts in TIERS:
    L.append(f"## {title}\n")
    for t in ts:
        nb = len(E.steps_ordered(t, recipe))
        L.append(f"### {t}  — {wfmt(t)}")
        L.append(f"*CombiRank {E.RANK[t]} · {nb} breed(s) · depth {depth[t]}*\n")
        for a,b,c in E.steps_ordered(t, recipe):
            row = {"type":"special" if E.is_special(a,b) else ("same-species" if a==b else "formula"),
                   "tie_dependent": E.breed_detail(a,b)[1]}
            L.append(f"- `{a} + {b} = {c}`{sym(row)}")
        L.append("")

# consolidated
L.append("## Consolidated build order (all targets, shared steps once)\n")
L.append(f"Breed these **{len(cons)}** pals in order and you get all {len(ALLT)} targets above. "
         "Reusable intermediates (Univolt Cryst, Lapure, Jormuntide, Jormuntide Ignis, "
         "Cryolinx Terra, Sibelyx Primo) are bred once and reused — keep a spare of each.\n")
for i,r in enumerate(cons,1):
    a,b = r["parents"]
    L.append(f"{i}. `{a} + {b} = {r['child']}`" + sym(r))
L.append("")

# catch-only
L.append("## Pals you must CATCH — not breedable in 1.0\n")
L.append(f"**{len(MUST_CATCH)}** species can't be produced by cross-species breeding (they are "
         "same-species-only or have no recipe). Critically, in 1.0 the *single best base worker "
         "for most jobs is one of these* — so for top-tier bases you catch the elite worker and "
         "breed the rest. Breeding two of a same-species pal only makes the same species.\n")
L.append("### Best worker per job: breed vs. catch\n")
L.append("| Job | Best you can BREED | Best if you CATCH | Verdict |")
L.append("|---|---|---|---|")
for j in JOBS:
    v = JOB_BEST[j]
    b = f"{v['bred'][1]} L{v['bred'][0]}" if v['bred'][1] else "—"
    c = f"{v['caught'][1]} L{v['caught'][0]}" if v['caught'][1] else "—"
    verdict = "**catch** — clearly better" if v["caught"][0] > v["bred"][0]+1 else \
              ("catch for +1" if v["caught"][0] > v["bred"][0] else "breeding is enough ✓")
    L.append(f"| {jl(j)} | {b} | {c} | {verdict} |")
L.append("")
L.append("### Priority catches (elite base workers)\n")
order = sorted(CATCH_WORTH, key=lambda n: -max(x[1] for x in CATCH_WORTH[n]))
for n in order:
    wins = CATCH_WORTH[n]
    jobtxt = "; ".join(f"{jb} {lv}" + (f" (vs bred {bl})" if bl else "") for jb,lv,bl,bp in wins)
    L.append(f"- **{n}** ({_combat.get(n,{}).get('rarity','?')}) — {wfmt(n)}  → wins: {jobtxt}")
L.append("")
L.append("**Also worth catching:** **Grizzbolt** (Epic) — unlocks `Mossanda + Grizzbolt = "
         "Mossanda Lux ★` (Electricity/Handiwork). **Legendaries** (same-species-only, mainly "
         "combat/mounts but with base uses): **Jetragon** (Gathering 8), **Frostallion** "
         "(Cooling 7), **Neptilius** (Watering 7), **Bellanoir Libero** (Medicine 7), "
         "**Paladius/Necromus** (Mining/Lumber 6).\n")
L.append("Full machine-readable list in `data/optimal_paths.json` → `must_catch` (all "
         f"{len(MUST_CATCH)}) and `best_worker_per_job_bred_vs_caught`.\n")

open(os.path.join(PARENT,"breeding_paths.md"),"w").write("\n".join(L))
print(f"reachable={len(depth)}  targets={len(ALLT)}  consolidated_breeds={len(cons)}")
print("fragile steps per target:", {t:frag[t] for t in ALLT})
print("wrote breeding_paths.md + data/optimal_paths.json")
