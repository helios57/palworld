/**
 * Palworld 1.0 breeding solver.
 *
 * BFS reachability from owned pals, path reconstruction, multi-target consolidation.
 */

import {
  breedDetail,
  isSpecial,
  getWork,
} from "./engine.js";

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
