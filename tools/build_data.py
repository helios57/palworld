#!/usr/bin/env python3
"""Build clean, machine-readable Palworld 1.0 breeding data files from the
sourced knowledge base (data/src_*). Produces:
  data/pals.json            -- per-pal: paldeck no, elements, rarity, combi_rank,
                               work suitabilities, in_generic_pool flag
  data/pals.csv             -- flat table (rank + 12 work jobs)
  data/special_combos.json  -- 164 unique parent-pair -> child overrides
  data/breeding_mechanics.json -- formula, tie-break, mutation/awakening, exclusions
All numbers are Palworld 1.0 (paldb.cc Breed Combi/Unique tabs, updated 2026-07-14).
"""
import json, csv, os

D = os.path.join(os.path.dirname(__file__), "data")
br = json.load(open(os.path.join(D, "src_breeding.json")))
ranks = br["combi_ranks"]              # name -> int, 299 pals
combos = br["special_combos"]          # list of {parent_a,parent_b,child}, 164

JOBS = ["Kindling","Watering","Planting","Generating_Electricity","Handiwork",
        "Gathering","Lumbering","Mining","Medicine","Cooling","Transporting","Farming"]
work, meta = {}, {}
with open(os.path.join(D, "src_palworld_pals.csv")) as f:
    for row in csv.DictReader(f):
        n = row["Name"]
        work[n] = {j: (int(row[j]) if row[j] else 0) for j in JOBS}
        meta[n] = {"paldeck": row["Number"],
                   "elements": [e for e in (row["Element_1"], row["Element_2"]) if e]}

# ---- generic breeding pool exclusions ----------------------------------------
VARIANT = {"Lux","Noct","Ignis","Cryst","Terra","Aqua","Botan","Primo","Gild","Libero"}
self_pair   = {c["child"] for c in combos if c["parent_a"] == c["parent_b"]}   # same-species-only (28)
crossover   = {n for n, r in ranks.items() if r == 3100}                        # 11 Terraria/Yakushima @3100
variant_all = {n for n in ranks if n.split()[-1] in VARIANT}                    # elemental/regional variants
# 1.0 exceptions: some variants ARE in the generic pool (verified in-game)
variant_all.discard("Wumpo Botan")
excluded = self_pair | crossover | variant_all | {"Bellanoir", "Bellanoir Libero"}
pool = {n for n in ranks if n not in excluded}

# ---- pals.json ---------------------------------------------------------------
pals = {}
for n in sorted(ranks, key=lambda x: ranks[x]):
    pals[n] = {
        "paldeck": meta.get(n, {}).get("paldeck"),
        "elements": meta.get(n, {}).get("elements", []),
        "combi_rank": ranks[n],
        "in_generic_pool": n in pool,
        "work": {j: v for j, v in work.get(n, {}).items() if v},
    }
json.dump(pals, open(os.path.join(D, "pals.json"), "w"), ensure_ascii=False, indent=1)

# ---- pals.csv ----------------------------------------------------------------
with open(os.path.join(D, "pals.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["Name","Paldeck","Element1","Element2","CombiRank","InGenericPool"] + JOBS)
    for n in sorted(ranks, key=lambda x: (ranks[x], x)):
        el = meta.get(n, {}).get("elements", []) + ["", ""]
        w.writerow([n, meta.get(n,{}).get("paldeck"), el[0], el[1], ranks[n],
                    int(n in pool)] + [work.get(n,{}).get(j,0) for j in JOBS])

# ---- special_combos.json -----------------------------------------------------
json.dump(combos, open(os.path.join(D, "special_combos.json"), "w"),
          ensure_ascii=False, indent=1)

# ---- breeding_mechanics.json -------------------------------------------------
mech = {
    "game_version": "1.0",
    "latest_version_confirmed": "1.0.1 (build 1.100.619, released 2026-07-15) is the newest "
        "version as of 2026-07-27; it is a bug-fix hotfix (save-data loss, Burning status, "
        "PS/Xbox fixes) with NO pal roster or breeding changes since 1.0. No 1.0.2+ exists.",
    "data_updated": br.get("updated"),
    "formula": br["formula"],
    "tie_break": "On an exact CombiRank tie, the child is the pal with the HIGHER "
                 "CombiRank (verified in-game 1.0: Turtacle 2410 + Aegidron 30 -> "
                 "target 1220 -> Nitemary 1230 over Quivern 1210).",
    "same_species": br["same_species_note"],
    "order_insensitive": True,
    "gender_requirement": "one male + one female; genders do not affect child species",
    "excluded_from_generic_pool": {
        "why": "The averaging formula can NEVER output these; obtain them via their "
               "special combo or same-species pairing.",
        "categories": {
            "elemental_regional_variants": sorted(variant_all),
            "same_species_only_28": sorted(self_pair),
            "crossover_rank_3100": sorted(crossover),
        },
        "count": len(excluded),
    },
    "new_in_1_0": {
        "mutation": "Small chance a bred pal hatches stronger than expected with a "
                    "unique mutation-only passive. Species is chosen on a SEPARATE "
                    "branch (may differ from the normal child). Mushroom/Deluxe "
                    "Vegetable Cake raise the chance.",
        "awakening": "Not breeding: spend Radiant Gems (World Tree) to boost a pal's "
                     "stats and unlock powerful passives.",
        "cakes": {
            "Cake": "standard, required for breeding",
            "Mushroom Cake": "higher chance of better stats",
            "Vegetable Cake": "produces two eggs",
            "Deluxe Vegetable Cake": "better mutation + stat-growth chance",
            "Special Cake": "better chance to inherit multiple passives",
        },
        "condensation": "1.0 lowered max-condensation cost to 48 food-copies (keeper "
                        "+47) for 4-star; each star adds +1 to all work suitabilities "
                        "(4-star = +1 to every job).",
    },
    "sources": br.get("sources"),
    "gaps": br.get("gaps"),
}
json.dump(mech, open(os.path.join(D, "breeding_mechanics.json"), "w"),
          ensure_ascii=False, indent=1)

print(f"pals: {len(pals)} | generic pool: {len(pool)} | excluded: {len(excluded)} "
      f"| combos: {len(combos)}")
print(f"excluded breakdown: variants={len(variant_all)} self-pair={len(self_pair)} "
      f"crossover3100={len(crossover)}")
print("wrote: pals.json, pals.csv, special_combos.json, breeding_mechanics.json")
