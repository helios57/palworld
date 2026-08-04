/**
 * Palworld 1.0 breeding solver.
 *
 * BFS reachability from owned pals, path reconstruction, multi-target consolidation.
 */

import {
  breedDetail,
  isSpecial,
  getWork,
  getRank,
  getPool,
} from "./engine.js";

export interface BridgePal {
  name: string;
  rank: number;
  newReachable: number;
  unlocksTargets: string[];
  rarity: string;
  locations: string;
}

// Easy-to-catch early-game pals that fill key CombiRank gaps.
// These are common spawns available at low levels in starting areas.
const EASY_CATCH: { name: string; locations: string; rarity: string }[] = [
  { name: "Lamball", locations: "Starting area", rarity: "Common" },
  { name: "Cattiva", locations: "Starting area", rarity: "Common" },
  { name: "Chikipi", locations: "Starting area", rarity: "Common" },
  { name: "Foxparks", locations: "Grassy fields", rarity: "Common" },
  { name: "Pengullet", locations: "Beaches, rivers", rarity: "Common" },
  { name: "Teafant", locations: "Grassy fields", rarity: "Common" },
  { name: "Lifmunk", locations: "Forests", rarity: "Common" },
  { name: "Tanzee", locations: "Forests", rarity: "Common" },
  { name: "Rushoar", locations: "Forests, hills", rarity: "Common" },
  { name: "Gumoss", locations: "Forests, caves", rarity: "Common" },
  { name: "Daedream", locations: "Nighttime anywhere", rarity: "Common" },
  { name: "Vixy", locations: "Grassy fields", rarity: "Common" },
  { name: "Jolthog", locations: "Grassy fields", rarity: "Common" },
  { name: "Sparkit", locations: "Plains", rarity: "Common" },
  { name: "Direhowl", locations: "Forests, plains", rarity: "Uncommon" },
  { name: "Nitewing", locations: "Open fields", rarity: "Common" },
  { name: "Eikthyrdeer", locations: "Forests", rarity: "Uncommon" },
  { name: "Mozzarina", locations: "Grassy fields", rarity: "Common" },
  { name: "Melpaca", locations: "Plains", rarity: "Common" },
  { name: "Caprity", locations: "Forests", rarity: "Common" },
  { name: "Cremis", locations: "Grassy fields", rarity: "Common" },
  { name: "Rooby", locations: "Volcano region", rarity: "Uncommon" },
  { name: "Tombat", locations: "Nighttime, caves", rarity: "Common" },
  { name: "Kelpsea", locations: "Beaches", rarity: "Common" },
  { name: "Celaray", locations: "Open fields", rarity: "Common" },
  { name: "Hangyu", locations: "Forests, hills", rarity: "Common" },
  { name: "Flopie", locations: "Grassy fields", rarity: "Common" },
  { name: "Gobfin", locations: "Beaches", rarity: "Common" },
  { name: "Galeclaw", locations: "Forests", rarity: "Common" },
  { name: "Depresso", locations: "Caves, nighttime", rarity: "Common" },
  { name: "Leezpunk", locations: "Caves, nighttime", rarity: "Common" },
  { name: "Rayhound", locations: "Desert", rarity: "Uncommon" },
  { name: "Vanwyrm", locations: "Volcano region", rarity: "Uncommon" },
  { name: "Bushi", locations: "Volcano region", rarity: "Uncommon" },
  { name: "Penking", locations: "Beaches (boss)", rarity: "Uncommon" },
  { name: "Gorirat", locations: "Forests", rarity: "Uncommon" },
  { name: "Elphidran", locations: "Mountains", rarity: "Uncommon" },
  { name: "Surfent", locations: "Rivers, lakes", rarity: "Uncommon" },
  { name: "Relaxaurus", locations: "Lakes", rarity: "Uncommon" },
  { name: "Pupperai", locations: "Plains", rarity: "Common" },
];

const EASY_MAP = new Map(EASY_CATCH.map((e) => [e.name, e]));

/**
 * Find "bridge pals" — pals not currently owned that, if caught, would most
 * increase breeding reachability. Only considers common/low-rarity pals.
 *
 * Returns top N suggestions ordered by how many new pals (including targets)
 * they would make reachable.
 */
export function findBridgePals(
  owned: string[],
  unreachableTargets: string[],
  topN: number = 8,
): BridgePal[] {
  const ownedSet = new Set(owned);
  const { depth: currentReach } = reachable(owned, 8);
  const currentCount = Object.keys(currentReach).length;

  const pool = getPool();
  const candidates = pool.filter(
    (p) => !ownedSet.has(p) && EASY_MAP.has(p),
  );

  const results: BridgePal[] = [];

  for (const cand of candidates) {
    const testOwned = [...owned, cand];
    const { depth: newReach } = reachable(testOwned, 8);
    const newCount = Object.keys(newReach).length;
    const gained = newCount - currentCount;

    // Check which unreachable targets become reachable
    const unlocksTargets = unreachableTargets.filter(
      (t) => !(t in currentReach) && t in newReach,
    );

    if (gained > 0 || unlocksTargets.length > 0) {
      const info = EASY_MAP.get(cand)!;
      results.push({
        name: cand,
        rank: getRank(cand) ?? 0,
        newReachable: gained,
        unlocksTargets,
        rarity: info.rarity,
        locations: info.locations,
      });
    }
  }

  // Sort by: unlocks targets first, then by new reachable count
  results.sort((a, b) => {
    const targetDiff = b.unlocksTargets.length - a.unlocksTargets.length;
    if (targetDiff !== 0) return targetDiff;
    return b.newReachable - a.newReachable;
  });

  return results.slice(0, topN);
}

export interface Step {
  parents: [string, string];
  child: string;
  type: "special" | "same-species" | "formula";
  tieDependent: boolean;
}

export interface TargetPlan {
  pal: string;
  depth: number;
  steps: Step[];
  work: Record<string, number>;
}

export interface ConsolidatedPlan {
  targets: string[];
  owned: string[];
  steps: Step[];
  reachableCount: number;
  totalPals: number;
}

type Recipe = Record<string, [string, string] | null>;

/**
 * BFS reachability from owned pals.
 * Returns depth, steps count, recipe, and fragile-step count per pal.
 */
export function reachable(
  owned: string[],
  maxDepth: number = 8,
): {
  depth: Record<string, number>;
  steps: Record<string, number>;
  recipe: Recipe;
  frag: Record<string, number>;
} {
  const depth: Record<string, number> = {};
  const steps: Record<string, number> = {};
  const frag: Record<string, number> = {};
  const recipe: Recipe = {};
  const cost: Record<string, [number, number, number]> = {}; // [depth, fragSteps, totalSteps]

  for (const p of owned) {
    depth[p] = 0;
    steps[p] = 0;
    frag[p] = 0;
    recipe[p] = null;
    cost[p] = [0, 0, 0];
  }

  let changed = true;
  let passes = 0;

  while (changed && passes < maxDepth + 3) {
    changed = false;
    passes++;
    const cur = Object.keys(depth);

    for (let i = 0; i < cur.length; i++) {
      for (let j = i; j < cur.length; j++) {
        const a = cur[i];
        const b = cur[j];
        const result = breedDetail(a, b);
        if (!result) continue;

        const { child, fragile: isFragile } = result;

        if (child === a || child === b) continue;

        const nd = 1 + Math.max(depth[a], depth[b]);
        const nf = frag[a] + frag[b] + (isFragile ? 1 : 0);
        const ns = 1 + steps[a] + steps[b];
        const nc: [number, number, number] = [nd, nf, ns];

        const existing = cost[child];
        if (
          !existing ||
          nc[0] < existing[0] ||
          (nc[0] === existing[0] && nc[1] < existing[1]) ||
          (nc[0] === existing[0] && nc[1] === existing[1] && nc[2] < existing[2])
        ) {
          cost[child] = nc;
          depth[child] = nd;
          frag[child] = nf;
          steps[child] = ns;
          recipe[child] = [a, b];
          changed = true;
        }
      }
    }
  }

  return { depth, steps, recipe, frag };
}

/**
 * Topologically ordered steps for reaching a target pal.
 */
export function stepsOrdered(
  target: string,
  recipe: Recipe,
): [string, string, string][] {
  const out: [string, string, string][] = [];
  const seen = new Set<string>();

  function rec(x: string): void {
    const r = recipe[x];
    if (!r || seen.has(x)) return;
    const [a, b] = r;
    rec(a);
    rec(b);
    if (!seen.has(x)) {
      out.push([a, b, x]);
      seen.add(x);
    }
  }

  rec(target);
  return out;
}

/**
 * Convert raw steps to Step objects with type metadata.
 */
export function toStepObjects(
  rawSteps: [string, string, string][],
): Step[] {
  return rawSteps.map(([a, b, c]) => {
    let type: Step["type"] = "formula";
    if (isSpecial(a, b)) type = "special";
    else if (a === b) type = "same-species";

    const result = breedDetail(a, b);
    const tieDependent = result ? result.fragile : false;

    return { parents: [a, b], child: c, type, tieDependent };
  });
}

/**
 * Build a full plan for a single target.
 */
export function planForTarget(
  target: string,
  recipe: Recipe,
  depth: Record<string, number>,
): TargetPlan | null {
  if (!(target in depth) || !recipe[target]) {
    return null;
  }

  const rawSteps = stepsOrdered(target, recipe);
  const steps = toStepObjects(rawSteps);

  return {
    pal: target,
    depth: depth[target],
    steps,
    work: getWork(target),
  };
}

/**
 * Consolidated build order for multiple targets: shared steps deduplicated,
 * ordered so every parent is available before it's used.
 */
export function consolidatePlan(
  targets: string[],
  recipe: Recipe,
  depth: Record<string, number>,
  owned: string[],
  totalPals: number,
): ConsolidatedPlan {
  const seen = new Set<string>();
  const consSteps: Step[] = [];

  for (const t of targets) {
    const raw = stepsOrdered(t, recipe);
    for (const [a, b, c] of raw) {
      if (!seen.has(c)) {
        seen.add(c);
        const result = breedDetail(a, b);
        let type: Step["type"] = "formula";
        if (isSpecial(a, b)) type = "special";
        else if (a === b) type = "same-species";

        consSteps.push({
          parents: [a, b],
          child: c,
          type,
          tieDependent: result?.fragile ?? false,
        });
      }
    }
  }

  // Validate ordering: every parent must be owned or bred earlier
  const avail = new Set<string>(owned);
  for (const step of consSteps) {
    for (const p of step.parents) {
      if (!avail.has(p)) {
        throw new Error(
          `Invalid order: parent "${p}" for child "${step.child}" is not available yet. ` +
          `Make sure "${p}" is owned or listed earlier in the build order.`,
        );
      }
    }
    avail.add(step.child);
  }

  return {
    targets,
    owned,
    steps: consSteps,
    reachableCount: Object.keys(depth).length,
    totalPals,
  };
}
