import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface PalData {
  paldeck: string;
  elements: string[];
  combi_rank: number;
  in_generic_pool: boolean;
  work: Record<string, number>;
}

interface ComboEntry {
  parent_a: string;
  parent_b: string;
  child: string;
}

type PalsJson = Record<string, PalData>;

const dataDir = resolve(__dirname, '../../data');
const pals: PalsJson = JSON.parse(
  readFileSync(resolve(dataDir, 'pals.json'), 'utf-8')
);
const combos: ComboEntry[] = JSON.parse(
  readFileSync(resolve(dataDir, 'special_combos.json'), 'utf-8')
);

// Build special combo lookup (sorted key -> child)
// Katress+Wixen maps to two children — first-found is preserved for lookup
const specialComboMap = new Map<string, string>();
for (const c of combos) {
  const key = c.parent_a < c.parent_b
    ? `${c.parent_a}|||${c.parent_b}`
    : `${c.parent_b}|||${c.parent_a}`;
  if (!specialComboMap.has(key)) {
    specialComboMap.set(key, c.child);
  }
}

/**
 * Compute the child species for a breeding pair using the game formula:
 * 1. Same species -> same species
 * 2. Special combo match -> fixed child
 * 3. Generic: target = floor((rankA + rankB + 1) / 2)
 *    Child = in-pool pal with closest rank. Tie -> HIGHER CombiRank.
 */
function breed(parent1: string, parent2: string): string | null {
  const rank1 = pals[parent1]?.combi_rank;
  const rank2 = pals[parent2]?.combi_rank;

  if (rank1 === undefined || rank2 === undefined) return null;

  // Same species always yields itself
  if (parent1 === parent2) return parent1;

  // Check special combos first
  const comboKey = parent1 < parent2
    ? `${parent1}|||${parent2}`
    : `${parent2}|||${parent1}`;
  const specialChild = specialComboMap.get(comboKey);
  if (specialChild !== undefined) return specialChild;

  // Generic formula: target = floor((rankA + rankB + 1) / 2)
  const target = Math.floor((rank1 + rank2 + 1) / 2);

  // Find in-pool pal with closest rank. Tie -> HIGHER CombiRank.
  let bestPal: string | null = null;
  let bestDist = Infinity;

  for (const [name, data] of Object.entries(pals)) {
    if (!data.in_generic_pool) continue;
    const dist = Math.abs(data.combi_rank - target);
    if (dist < bestDist) {
      bestDist = dist;
      bestPal = name;
    } else if (dist === bestDist && bestPal) {
      if (data.combi_rank > pals[bestPal].combi_rank) {
        bestPal = name;
      }
    }
  }

  return bestPal;
}

describe('Breeding result snapshots (regression tests)', () => {
  describe('Special combo results', () => {
    const specialTests: [string, string, string][] = [
      // Well-known variant-producing special combos
      ['Blazehowl', 'Jormuntide', 'Jormuntide Ignis'],
      ['Relaxaurus', 'Sparkit', 'Relaxaurus Lux'],
      ['Incineram', 'Maraith', 'Incineram Noct'],
      ['Mau', 'Pengullet', 'Mau Cryst'],
      ['Vanwyrm', 'Foxcicle', 'Vanwyrm Cryst'],
      ['Eikthyrdeer', 'Hangyu', 'Eikthyrdeer Terra'],
      ['Elphidran', 'Surfent', 'Elphidran Aqua'],
      ['Pyrin', 'Katress', 'Pyrin Noct'],
      ['Mossanda', 'Grizzbolt', 'Mossanda Lux'],
      ['Frostallion', 'Helzephyr', 'Frostallion Noct'],
      // Same-species special combos
      ['Frostallion', 'Frostallion', 'Frostallion'],
      ['Jetragon', 'Jetragon', 'Jetragon'],
      ['Shadowbeak', 'Shadowbeak', 'Shadowbeak'],
    ];

    for (const [parent1, parent2, expected] of specialTests) {
      it(`${parent1} + ${parent2} should produce ${expected}`, () => {
        const result = breed(parent1, parent2);
        expect(result).toBe(expected);
      });
    }
  });

  describe('Order insensitivity (both directions yield same child)', () => {
    // Mix of special-combo and generic pairs
    const pairs: [string, string][] = [
      ['Blazehowl', 'Jormuntide'],
      ['Relaxaurus', 'Sparkit'],
      ['Mau', 'Pengullet'],
      ['Pyrin', 'Katress'],
      ['Frostallion', 'Helzephyr'],
      ['Lamball', 'Cattiva'],
      ['Foxparks', 'Lamball'],
      ['Elizabee', 'Relaxaurus'],
      ['Kitsun', 'Astegon'],
      ['Anubis', 'Anubis'],
    ];

    for (const [a, b] of pairs) {
      it(`${a} + ${b} should equal ${b} + ${a}`, () => {
        const resultAB = breed(a, b);
        const resultBA = breed(b, a);
        expect(resultAB).toBe(resultBA);
      });
    }
  });

  describe('Generic formula results (computed from data)', () => {
    // Expected values computed from the actual pals.json data using:
    //   target = floor((rankA + rankB + 1) / 2)
    //   child = in-pool pal with closest rank (tie -> higher rank)
    // These serve as regression tests: if data changes, these break.
    const genericTests: [string, string, string][] = [
      // Early-game pairings
      ['Lamball', 'Cattiva', 'Daedream'],         // ranks 3050+2760 -> target 2905
      ['Chikipi', 'Lamball', 'Teafant'],           // ranks 3080+3050 -> target 3065
      ['Cattiva', 'Lifmunk', 'Cremis'],            // ranks 2760+3020 -> target 2890
      ['Foxparks', 'Lamball', 'Lifmunk'],          // ranks 2990+3050 -> target 3020
      ['Tanzee', 'Pengullet', 'Pupperai'],         // ranks 2900+2960 -> target 2930
      ['Lamball', 'Chikipi', 'Teafant'],           // ranks 3050+3080 -> target 3065
      // Mid-game pairings
      ['Direhowl', 'Nitewing', 'Cinnamoth'],       // ranks 2680+2560 -> target 2620
      ['Nitewing', 'Mossanda', 'Kikit'],           // ranks 2560+2060 -> target 2310
      ['Elizabee', 'Relaxaurus', 'Dogen'],         // ranks 1790+1090 -> target 1440
      ['Kitsun', 'Astegon', 'Relaxaurus'],         // ranks 1670+490 -> target 1080
      // Higher-tier pairings
      ['Suzaku', 'Blazehowl', 'Warsect'],          // ranks 1200+1360 -> target 1280
      ['Quivern', 'Helzephyr', 'Gildra'],          // ranks 1210+1130 -> target 1170
      ['Penking', 'Bushi', 'Sibelyx'],             // ranks 2070+1560 -> target 1815
      ['Anubis', 'Jormuntide', 'Roujay'],          // ranks 480+590 -> target 535
      // Same-species (generic path: same pal in pool)
      ['Anubis', 'Anubis', 'Anubis'],              // same species
    ];

    for (const [parent1, parent2, expected] of genericTests) {
      it(`${parent1} + ${parent2} should produce ${expected}`, () => {
        const result = breed(parent1, parent2);
        expect(result).toBe(expected);
      });
    }
  });

  describe('Special combo override takes precedence over formula', () => {
    it('Grizzbolt + Mossanda resolves via special combo, not formula', () => {
      // Grizzbolt (1020) + Mossanda (2060) -> target 1540
      // The closest in-pool pal to 1540 by rank would be different from Mossanda Lux
      // But Mossanda Lux is the special combo child and is excluded from pool
      expect(pals['Mossanda Lux'].in_generic_pool).toBe(false);
      const result = breed('Grizzbolt', 'Mossanda');
      expect(result).toBe('Mossanda Lux');
    });

    it('Blazehowl + Felbat uses special combo, not formula', () => {
      // Blazehowl (1360) + Felbat (1690) -> target 1525
      // Should produce Blazehowl Noct via special combo
      expect(pals['Blazehowl Noct'].in_generic_pool).toBe(false);
      const result = breed('Blazehowl', 'Felbat');
      expect(result).toBe('Blazehowl Noct');
    });
  });

  describe('Same-species always yields itself', () => {
    const sameSpeciesChecks = [
      'Cattiva',
      'Chikipi',
      'Lamball',
      'Anubis',
      'Mossanda',
    ];

    for (const name of sameSpeciesChecks) {
      it(`${name} + ${name} should produce ${name}`, () => {
        expect(breed(name, name)).toBe(name);
      });
    }
  });
});
