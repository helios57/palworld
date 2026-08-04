/**
 * Palworld 1.0 CombiRank breeding engine.
 *
 * Formula: target = floor((rank_A + rank_B + 1) / 2)
 * Child = pal in the generic pool closest to target; ties → higher CombiRank wins.
 * Special combos override the formula; same-species pairing always yields that species.
 */

export interface PalData {
  paldeck: number;
  elements: string[];
  combi_rank: number;
  in_generic_pool: boolean;
  work: Record<string, number>;
}

export interface SpecialCombo {
  parent_a: string;
  parent_b: string;
  child: string;
}

export interface BreedResult {
  child: string;
  fragile: boolean;
}

let pals: Record<string, PalData> = {};
let combiRank: Record<string, number> = {};
let poolSorted: string[] = [];
let specialMap: Map<string, string> = new Map();
let workMap: Record<string, Record<string, number>> = {};

const formulaCache = new Map<string, BreedResult>();

function cacheKey(ra: number, rb: number): string {
  return ra <= rb ? `${ra}|${rb}` : `${rb}|${ra}`;
}

function specialKey(a: string, b: string): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

export function initEngine(
  palsData: Record<string, PalData>,
  specialCombos: SpecialCombo[],
): void {
  pals = palsData;
  combiRank = {};
  workMap = {};

  for (const [name, data] of Object.entries(palsData)) {
    combiRank[name] = data.combi_rank;
    workMap[name] = data.work ?? {};
  }

  poolSorted = Object.entries(palsData)
    .filter(([, p]) => p.in_generic_pool)
    .map(([n]) => n)
    .sort((a, b) => combiRank[a] - combiRank[b]);

  specialMap = new Map<string, string>();
  for (const c of specialCombos) {
    specialMap.set(specialKey(c.parent_a, c.parent_b), c.child);
  }

  formulaCache.clear();
}

export function formulaChild(ra: number, rb: number): BreedResult {
  const ck = cacheKey(ra, rb);
  const cached = formulaCache.get(ck);
  if (cached) return cached;

  const target = Math.floor((ra + rb + 1) / 2);

  let best = poolSorted[0];
  let bestDist = Math.abs(combiRank[best] - target);

  for (let i = 1; i < poolSorted.length; i++) {
    const n = poolSorted[i];
    const dist = Math.abs(combiRank[n] - target);

    if (
      dist < bestDist ||
      (dist === bestDist && combiRank[n] > combiRank[best])
    ) {
      best = n;
      bestDist = dist;
    }
  }

  let fragile = false;
  for (const n of poolSorted) {
    if (n !== best && Math.abs(combiRank[n] - target) === bestDist) {
      fragile = true;
      break;
    }
  }

  const result: BreedResult = { child: best, fragile };
  formulaCache.set(ck, result);
  return result;
}

export function breedDetail(a: string, b: string): BreedResult | null {
  const ra = combiRank[a];
  const rb = combiRank[b];
  if (ra === undefined || rb === undefined) return null;

  const spec = specialMap.get(specialKey(a, b));
  if (spec !== undefined) {
    return { child: spec, fragile: false };
  }

  if (a === b) {
    return { child: a, fragile: false };
  }

  return formulaChild(ra, rb);
}

export function breed(a: string, b: string): string | null {
  const result = breedDetail(a, b);
  return result ? result.child : null;
}

export function isSpecial(a: string, b: string): boolean {
  return specialMap.has(specialKey(a, b));
}

export function getPool(): string[] {
  return poolSorted.slice();
}

export function getRank(name: string): number | undefined {
  return combiRank[name];
}

export function getWork(name: string): Record<string, number> {
  return workMap[name] ?? {};
}

export function getAllPalNames(): string[] {
  return Object.keys(pals);
}

/** Verify the known 1.0 tie-break rule: Turtacle + Aegidron = Nitemary */
export function verifyEngine(): boolean {
  const result = breed("Turtacle", "Aegidron");
  return result === "Nitemary";
}
