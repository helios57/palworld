# Palworld Breeding Tools — Website & Repository Design

**Date:** 2026-08-04
**Status:** Approved

## Overview

Publish the existing Palworld 1.0 breeding data and Python tools to a public GitHub repository, and build a static single-page web app (GitHub Pages) where users can input their owned pals via save file upload, CSV, or UI selection, pick target pals, and get an optimized, consolidated breeding build order.

## Repository structure

```
palworld/
├── .gitignore
├── README.md                  # project overview, links to web app
├── LICENSE
├── tools/                     # Python CLI tools (cleaned of personal data)
│   ├── requirements.txt
│   ├── build_data.py          # regen data files from src_*
│   ├── breeding_engine.py     # core breed() + reachability (library, no OWNED)
│   ├── report_gen.py          # CLI: owned list → MD + JSON report (takes args)
│   ├── exact_path.py          # CLI: exact step ordering (takes args)
│   └── extract_pals.py        # NEW: extract pal names from PlM/PlZ save file
├── data/                      # static breeding data (also consumed by web app)
│   ├── pals.json
│   ├── pals.csv
│   ├── special_combos.json
│   ├── breeding_mechanics.json
│   ├── internal_id_map.json
│   └── src_*                  # provenance sources
├── docs/                      # GitHub Pages root (served on gh-pages branch)
│   ├── index.html
│   ├── favicon.ico
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── engine.js          # CombiRank breeding formula
│       ├── save-parser.js     # PlZ zlib decompression + GVAS parser
│       ├── solver.js          # BFS reachability + path optimization
│       ├── ui.js              # DOM interaction, pal selection, results
│       └── data-loader.js     # fetch breeding data from data/
├── tests/
│   ├── unit/
│   │   ├── engine.test.ts     # breed(), formula_child(), special combos, caches
│   │   ├── solver.test.ts     # reachability BFS, path ordering, depth limits
│   │   ├── save-parser.test.ts# GVAS extraction, ID→name mapping, error handling
│   │   └── data-loader.test.ts# fetch, cache, schema validation
│   ├── data/
│   │   ├── ranks.test.ts      # 299 valid unique ranks, no gaps, sorted
│   │   ├── combos.test.ts     # every combo references real pals, no orphans
│   │   ├── pool.test.ts       # generic pool exclusions match documented rules
│   │   └── snapshots.test.ts  # known pairings produce expected children
│   ├── e2e/
│   │   ├── save-upload.spec.ts    # drop PlZ save → correct pal list extracted
│   │   ├── csv-import.spec.ts     # paste CSV → owned list populated
│   │   ├── ui-select.spec.ts      # typeahead, add/remove, state persistence
│   │   ├── single-target.spec.ts  # pick 1 pal → correct recipe rendered
│   │   ├── multi-target.spec.ts   # pick N targets → consolidated order
│   │   └── edge-cases.spec.ts     # empty input, bad save, unknown names, max depth
│   └── fixtures/
│       ├── sample-plz.sav         # minimal PlZ save (known pal list)
│       ├── sample-pals.csv        # known-good CSV input
│       └── expected-results.json  # precomputed breeding paths for verification
└── .github/workflows/
    ├── ci.yml                 # vitest + playwright on push
    └── deploy.yml             # build TS→JS, publish to gh-pages branch
```

## Security exclusions (.gitignore)

- `*.sav`, `*.gvas`, `*.raw` — save files
- `__pycache__/`, `*.pyc`
- `node_modules/`
- Personal plan files: `breeding_plan.*`, `optimal_paths.json`, `breeding_paths.md`
- Environment: `.env`, `.env.*`

## Web app architecture

**Stack:** Vanilla TypeScript → compiled to JS, zero runtime dependencies. One HTML page, modular TS files. Under 100 KB total JS.

### Three input methods → one engine

| Input | How |
|-------|-----|
| **Save file drop** | Detect PlZ magic bytes → `DecompressionStream("deflate-raw")` → GVAS binary parser extracts CharacterIDs → map to display names via `internal_id_map.json` |
| **CSV upload/paste** | Parse column of pal names → fuzzy-match against known pal names → show unmatched for user to fix |
| **UI select** | Typeahead search (name or job filter) → click to add → owned list with remove buttons → persist to `localStorage` |

### Engine flow

1. User provides owned pal list through any input method
2. User selects target pal(s) from full 299 pal list (searchable, filterable by role: base/flyer/fighter)
3. BFS solver computes min-generation reachability from owned set (same algorithm as Python `breeding_engine.reachable()`)
4. Multi-target mode: topological sort + dedup → consolidated build order
5. Results rendered as numbered steps: `ParentA + ParentB = Child` with tags (★ special, owned, flyer/fighter/base)
6. Printable output with CSS `@page` / `@media print`

### CombiRank engine (TypeScript port of breeding_engine.py)

- `formulaChild(rankA, rankB)` → `{child, fragile}`
- Special combo lookup (Map of `Set<a,b>` → child)
- Same-species short-circuit
- Cached by sorted rank pair
- Tie-break: 1.0 higher-rank rule

### Solver

- BFS across all pairs of currently reachable pals
- Cost tuple: `(depth, fragileSteps, totalBreeds)` — minimizes depth first
- `recipe` map: pal → `[parentA, parentB]` (or null if owned)
- `stepsOrdered(pal, recipe)`: topological sort for dependency ordering
- Multi-target consolidation: iterate targets in dependency order, collect unique steps

### UI states

- **Empty:** prompt to drop save, upload CSV, or start searching
- **Owning:** show count badge, scrollable tag list with remove buttons
- **Selecting targets:** searchable grid, recommended presets (base workers / flyers / fighters)
- **Computing:** spinner
- **Results:** numbered build steps, tags (★ special, owned parent, role tags), keep/reuse notes
- **Print:** CSS `@media print` hides inputs, shows clean numbered list
- **Error:** corrupt save, unsupported format, no reachable path (with depth increase suggestion)

### Browser compatibility

- `DecompressionStream` — Chrome 80+, Firefox 113+, Safari 16.4+
- ES2020 modules (`import`/`export`)
- `localStorage` for state persistence
- CSS Grid + custom properties

## Python tools (cleaned for publication)

### `extract_pals.py` (NEW)
- Detects PlZ vs PlM format by magic bytes
- PlZ: zlib decompress → parse GVAS → extract CharacterIDs
- PlM: prints message directing user to install `palooz` bindings or use the web CSV path
- Accepts `-f` for save file path, `-o` for output (default: prints pal names to stdout)
- Usage: `python3 tools/extract_pals.py -f /path/to/Level.sav`

### `breeding_engine.py` (cleaned)
- Remove hardcoded OWNED list from `__main__` block
- `__main__` section takes owned list from argv or stdin
- Pure library: import `breed()`, `reachable()`, `steps_ordered()`

### `report_gen.py` (cleaned)
- Accept owned list via `-o` flag or from a file
- Generates `breeding_paths.md` + `optimal_paths.json`

### `exact_path.py` (cleaned)
- Accept owned list + targets via CLI args

## CI/CD

### `ci.yml`
- Trigger: push to main, PRs
- Steps: checkout → setup node → npm ci → vitest (unit + data) → build TS → playwright (e2e)

### `deploy.yml`
- Trigger: push to main (on success after ci)
- Steps: checkout → setup node → npm ci → build TS → copy data/ + docs/ → deploy to `gh-pages` branch
- GitHub Pages configured to serve from `gh-pages` branch, `/docs` folder

## Testing coverage requirements

Every feature path must have a test:

| Feature | Unit | Data | E2E |
|---------|------|------|-----|
| `breed(a,b)` formula | ✓ | — | — |
| Special combo lookup | ✓ | ✓ | — |
| Same-species short-circuit | ✓ | — | — |
| Tie-break (higher rank) | ✓ | — | — |
| Cache hits | ✓ | — | — |
| BFS reachability | ✓ | — | — |
| Path ordering (topo sort) | ✓ | — | — |
| Multi-target consolidation | ✓ | — | — |
| Depth limit capping | ✓ | — | — |
| 299 valid unique ranks | — | ✓ | — |
| All combos reference real pals | — | ✓ | — |
| Pool exclusions match rules | — | ✓ | — |
| Known pairings unchanged | — | ✓ | — |
| Save file drop → pal list | — | — | ✓ |
| CSV import → owned list | — | — | ✓ |
| UI typeahead + add/remove | — | — | ✓ |
| Single target recipe | — | — | ✓ |
| Multi-target consolidated | — | — | ✓ |
| Empty owned edge case | — | — | ✓ |
| Corrupt/bad save | — | — | ✓ |
| Unreachable target | — | — | ✓ |
| localStorage persistence | — | — | ✓ |
| Print output | — | — | ✓ |

## Out of scope (v1)

- PlM (Oodle Kraken) in-browser decompression — link to `extract_pals.py` instead
- Mobile app / PWA
- Multi-language i18n
- Passive skill inheritance tracking
- Mutation probability display
- User accounts / cloud save
