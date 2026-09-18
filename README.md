# Palworld 1.0 Breeding Tools

Machine-readable Palworld breeding data for **version 1.0** (2026-07-10) plus tools to compute optimal breeding paths from your owned pals.

🌐 **Web App:** [palworld-breeding-calculator](https://helios57.github.io/palworld) — drop your save file, select target pals, get a step-by-step optimized breeding plan. Runs entirely in your browser.

## Quick Start

### Web App (no install)

Go to **[helios57.github.io/palworld](https://helios57.github.io/palworld)** and:

1. **Drop** your `Level.sav` file (PlZ format, single-player/co-op), **paste** your pal list as CSV, or **search** and click to add pals
2. **Pick targets** — use presets (Base Workers / Flyers / Fighters) or search for specific pals
3. Click **Compute Breeding Plan** → get a consolidated, step-by-step build order
4. **Print** it with the 🖨 button

PlM (dedicated server) saves require the Python CLI tool below.

### Python CLI

```bash
# Install (only needed for save-file reading; the breeding tools are stdlib-only)
pip install -r tools/requirements.txt

# Extract your pal list from a save file (PlZ and PlM both work)
python3 tools/extract_pals.py -f /path/to/Level.sav

# Generate a full breeding report
python3 tools/report_gen.py -f owned_pals.txt -t targets.txt

# Get the exact step-by-step ordered path
python3 tools/exact_path.py -of owned_pals.txt -tf targets.txt
```

## Save File Tooling

`Level.sav` is a GVAS blob behind a 12-byte header. Palworld 1.0 dedicated
servers write **PlM** (Oodle Kraken); older and single-player saves use **PlZ**
(zlib). `tools/palsave.py` reads both and writes PlZ, which the 1.0 server
still loads and rewrites as PlM on its next autosave.

```bash
# Which bases exist, how much is stored where
python3 tools/inspect_save.py Level.sav

# Chests and contents of your main base (the one with the most objects)
python3 tools/inspect_save.py Level.sav --base main --contents

# Confirm the parser reproduces your save byte for byte before editing it
python3 tools/inspect_save.py Level.sav --verify

# Add items to the emptiest chest of the main base
python3 tools/add_items.py Level.sav --base main --auto-chest \
    --item AIcore:9999 --item Thermal_Core:9999 -o Level.edited.sav

# Or target one container directly, and preview without writing
python3 tools/add_items.py Level.sav --container <guid> \
    --item AncientParts2:9999 -o out.sav --dry-run
```

Item ids are the game's **internal** names (`AIcore`, `Thermal_Core`,
`AncientParts2`), not display names. `inspect_save.py --contents` lists the ids
already in your world; [paldb.cc](https://paldb.cc) shows the rest under
"code name". Quantities above a stack (9999) are split across slots
automatically.

**Installing an edited save on a dedicated server:** stop the server first, or
it will overwrite your edit with the world it still holds in memory. Back up
`Saved/SaveGames/<id>/` first. `add_items.py` never modifies the input file,
refuses to run unless an untouched parse of your save round-trips byte for
byte, and re-reads what it wrote to confirm the items landed.

Notes on `palworld-save-tools` 0.24.0, which predates 1.0: it cannot parse a
1.0 save unaided. `palsave.py` adds the new `SetProperty` type and keeps every
`RawData` blob opaque, because several of that library's rawdata decoders
assume the pre-1.0 layout. Structure is still fully walked, so property sizes
are recomputed correctly on write.

## Repository Structure

```
palworld/
├── README.md
├── docs/                       # GitHub Pages (static web app)
│   ├── index.html
│   ├── css/style.css
│   ├── js/                     # Compiled TypeScript
│   │   ├── engine.js           # CombiRank breeding formula
│   │   ├── solver.js           # BFS reachability + path optimization
│   │   ├── save-parser.js      # PlZ zlib decompression + GVAS parser
│   │   ├── data-loader.js      # Fetch breeding data
│   │   └── ui.js               # DOM interaction, pal selection, results
│   └── data/                   # Static breeding data
│       ├── pals.json
│       ├── special_combos.json
│       └── internal_id_map.json
├── src/                        # TypeScript source
│   ├── engine.ts
│   ├── solver.ts
│   ├── save-parser.ts
│   ├── data-loader.ts
│   └── ui.ts
├── data/                       # Master breeding data
│   ├── pals.json               # All 299 pals: paldeck, elements, CombiRank, work
│   ├── pals.csv                # Flat table (rank + 12 work jobs)
│   ├── special_combos.json     # 164 unique parent-pair → child overrides
│   ├── breeding_mechanics.json # Formula, tie-break, pool exclusions, 1.0 mechanics
│   ├── internal_id_map.json    # Internal CharacterID → display name mapping
│   └── src_*                   # Raw sourced inputs (provenance)
├── tools/                      # Python CLI tools
│   ├── build_data.py           # Regen data files from src_*
│   ├── breeding_engine.py      # Core breeding library
│   ├── report_gen.py           # Generate MD + JSON breeding reports
│   ├── exact_path.py           # Exact dependency-ordered breeding path
│   ├── extract_pals.py         # Extract pal names from save file
│   ├── palsave.py              # Save library: PlZ/PlM, GVAS, item slots
│   ├── inspect_save.py         # List bases, chests and stored items
│   ├── add_items.py            # Add items to a storage container
│   └── requirements.txt        # pyooz + palworld-save-tools
└── tests/
    ├── unit/                   # Unit tests (engine, solver, parser, loader)
    ├── data/                   # Data integrity tests (ranks, combos, pool)
    ├── python/                 # Save tooling tests (pytest, synthetic data)
    ├── e2e/                    # End-to-end Playwright tests
    └── fixtures/               # Test fixtures
```

## Breeding Formula (1.0)

Every pal has a hidden integer **CombiRank**. Two opposite-gender parents produce:

```
target = floor((rank_A + rank_B + 1) / 2)
child  = pal in the generic pool whose CombiRank is closest to target
tie    → the HIGHER CombiRank wins
```

- Parent order does not matter; you need one male + one female
- **164 special combos** override the formula (fixed parent-pair → child)
- **Same-species** pairing always yields that species
- **~118 pals excluded** from the generic pool (variants, same-species-only, crossover rank 3100)

## New in 1.0

- **Mutation** — small chance of stronger baby with mutation-only passives
- **Awakening** — spend Radiant Gems to boost stats
- **Condensation** — lowered to 48 food-copies for 4★; each star adds +1 to all work suitabilities
- Several former breeding targets are now **same-species-only** (Lyleen, Orserk, Grizzbolt)

## Development

```bash
npm install
npx tsc              # Compile TypeScript → docs/js/
npx vitest           # Run unit + data tests
npx playwright test  # Run e2e tests

pip install -r tools/requirements.txt pytest
python -m pytest tests/python   # Save tooling tests
```

The save tooling tests build their fixtures in-process, so no savegame is
needed to run them and none is committed here.

Re-run data from sources:
```bash
python3 tools/build_data.py  # Rebuild pals.json, special_combos.json, etc.
```

## Data Sources

- [paldb.cc](https://paldb.cc) — Breed Combi / Unique tabs
- [palworld.wiki.gg](https://palworld.wiki.gg) — community wiki
- `beliarance/palworld-kb` 1.0 knowledge base
- In-game verification for tie-break rule and pool exclusions

See `data/src_DATA_SOURCES.md` and `data/breeding_mechanics.json` → `sources`/`gaps` for full details.

## License

MIT — see [LICENSE](LICENSE)
