/**
 * Palworld 1.0 CombiRank breeding engine.
 *
 * Formula: target = floor((rank_A + rank_B + 1) / 2)
 * Child = pal in the generic pool closest to target; ties → higher CombiRank wins.
 * Special combos override the formula; same-species pairing always yields that species.
 */
let pals = {};
let combiRank = {};
let poolSorted = [];
let specialMap = new Map();
let workMap = {};
const formulaCache = new Map();
function cacheKey(ra, rb) {
    return ra <= rb ? `${ra}|${rb}` : `${rb}|${ra}`;
}
function specialKey(a, b) {
    return a <= b ? `${a}|${b}` : `${b}|${a}`;
}
export function initEngine(palsData, specialCombos) {
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
    specialMap = new Map();
    for (const c of specialCombos) {
        specialMap.set(specialKey(c.parent_a, c.parent_b), c.child);
    }
    formulaCache.clear();
}
export function formulaChild(ra, rb) {
    const ck = cacheKey(ra, rb);
    const cached = formulaCache.get(ck);
    if (cached)
        return cached;
    const target = Math.floor((ra + rb + 1) / 2);
    let best = poolSorted[0];
    let bestDist = Math.abs(combiRank[best] - target);
    for (let i = 1; i < poolSorted.length; i++) {
        const n = poolSorted[i];
        const dist = Math.abs(combiRank[n] - target);
        if (dist < bestDist ||
            (dist === bestDist && combiRank[n] > combiRank[best])) {
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
    const result = { child: best, fragile };
    formulaCache.set(ck, result);
    return result;
}
export function breedDetail(a, b) {
    const ra = combiRank[a];
    const rb = combiRank[b];
    if (ra === undefined || rb === undefined)
        return null;
    const spec = specialMap.get(specialKey(a, b));
    if (spec !== undefined) {
        return { child: spec, fragile: false };
    }
    if (a === b) {
        return { child: a, fragile: false };
    }
    return formulaChild(ra, rb);
}
export function breed(a, b) {
    const result = breedDetail(a, b);
    return result ? result.child : null;
}
export function isSpecial(a, b) {
    return specialMap.has(specialKey(a, b));
}
export function getPool() {
    return poolSorted.slice();
}
export function getRank(name) {
    return combiRank[name];
}
export function getWork(name) {
    return workMap[name] ?? {};
}
export function getAllPalNames() {
    return Object.keys(pals);
}
/** Verify the known 1.0 tie-break rule: Turtacle + Aegidron = Nitemary */
export function verifyEngine() {
    const result = breed("Turtacle", "Aegidron");
    return result === "Nitemary";
}
