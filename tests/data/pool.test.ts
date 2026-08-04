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

type PalsJson = Record<string, PalData>;

const dataDir = resolve(__dirname, '../../data');
const pals: PalsJson = JSON.parse(
  readFileSync(resolve(dataDir, 'pals.json'), 'utf-8')
);

const inPool = Object.entries(pals).filter(([, d]) => d.in_generic_pool);
const notInPool = Object.entries(pals).filter(([, d]) => !d.in_generic_pool);

// Variant suffixes that indicate elemental/regional variants (excluded from pool)
const variantSuffixes = [
  'Lux', 'Noct', 'Ignis', 'Cryst', 'Terra',
  'Aqua', 'Botan', 'Primo', 'Gild', 'Libero',
];

function hasVariantSuffix(name: string): boolean {
  for (const suffix of variantSuffixes) {
    // Check that the name ends with the suffix, preceded by a space
    // (e.g. "Relaxaurus Lux" not "Frostallion" which happens to contain "Lux" but not as a suffix)
    if (name.endsWith(' ' + suffix)) return true;
  }
  return false;
}

describe('Generic breeding pool integrity', () => {
  it('should have 182 pals in the generic pool', () => {
    expect(inPool.length).toBe(182);
  });

  it('should have 117 pals excluded from the generic pool', () => {
    expect(notInPool.length).toBe(117);
  });

  it('should total 299 pals (in pool + excluded)', () => {
    expect(inPool.length + notInPool.length).toBe(299);
  });

  it('should exclude all elemental/regional variants (except Wumpo Botan)', () => {
    const variantInPool: string[] = [];
    for (const [name, data] of inPool) {
      if (hasVariantSuffix(name) && name !== 'Wumpo Botan') {
        variantInPool.push(name);
      }
    }
    expect(variantInPool).toEqual([]);
  });

  it('should have Wumpo Botan in the generic pool', () => {
    expect(pals['Wumpo Botan']).toBeDefined();
    expect(pals['Wumpo Botan'].in_generic_pool).toBe(true);
  });

  it('should exclude legendary pals (Frostallion, Jetragon, Paladius, Necromus)', () => {
    for (const name of ['Frostallion', 'Jetragon', 'Paladius', 'Necromus']) {
      expect(
        pals[name].in_generic_pool,
        `${name} should not be in the generic pool`
      ).toBe(false);
    }
  });

  it('should exclude Bellanoir and Bellanoir Libero', () => {
    for (const name of ['Bellanoir', 'Bellanoir Libero']) {
      expect(
        pals[name].in_generic_pool,
        `${name} should not be in the generic pool`
      ).toBe(false);
    }
  });

  it('should exclude crossover pals (rank 3100)', () => {
    const crossover = Object.entries(pals).filter(
      ([, d]) => d.combi_rank === 3100
    );
    expect(crossover.length).toBeGreaterThan(0); // sanity: they exist
    for (const [name, data] of crossover) {
      expect(
        data.in_generic_pool,
        `${name} (crossover, rank 3100) should not be in the generic pool`
      ).toBe(false);
    }
  });

  it('should include common pals like Cattiva, Chikipi, Lamball in the pool', () => {
    for (const name of ['Cattiva', 'Chikipi', 'Lamball']) {
      expect(
        pals[name].in_generic_pool,
        `${name} should be in the generic pool`
      ).toBe(true);
    }
  });

  it('should have a monotonically increasing CombiRank sequence when sorted', () => {
    const sorted = inPool.sort((a, b) => a[1].combi_rank - b[1].combi_rank);
    const ranks = sorted.map(([, d]) => d.combi_rank);
    for (let i = 1; i < ranks.length; i++) {
      expect(
        ranks[i],
        `CombiRank at index ${i} (pal: ${sorted[i][0]}, rank ${ranks[i]}) ` +
        `should be >= previous (pal: ${sorted[i - 1][0]}, rank ${ranks[i - 1]})`
      ).toBeGreaterThanOrEqual(ranks[i - 1]);
    }
  });
});
