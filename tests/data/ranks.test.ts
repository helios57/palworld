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

describe('CombiRank data integrity', () => {
  const names = Object.keys(pals);

  it('should have exactly 299 pals', () => {
    expect(names.length).toBe(299);
  });

  it('should have unique pal names (no duplicates)', () => {
    expect(names.length).toBe(new Set(names).size);
  });

  it('should have a numeric combi_rank for every pal', () => {
    for (const [name, data] of Object.entries(pals)) {
      expect(
        typeof data.combi_rank,
        `${name}: combi_rank should be a number, got ${typeof data.combi_rank}`
      ).toBe('number');
      expect(
        Number.isInteger(data.combi_rank),
        `${name}: combi_rank should be an integer, got ${data.combi_rank}`
      ).toBe(true);
    }
  });

  it('should have positive combi_rank values for all pals', () => {
    for (const [name, data] of Object.entries(pals)) {
      expect(
        data.combi_rank,
        `${name}: combi_rank should be positive, got ${data.combi_rank}`
      ).toBeGreaterThan(0);
    }
  });

  it('should have combi_rank values within a reasonable range (1-9999)', () => {
    for (const [name, data] of Object.entries(pals)) {
      expect(
        data.combi_rank,
        `${name}: combi_rank ${data.combi_rank} should be <= 9999`
      ).toBeLessThanOrEqual(9999);
    }
  });

  it('should have no duplicate paldeck numbers among numbered pals', () => {
    const paldeckMap = new Map<string, string[]>();
    for (const [name, data] of Object.entries(pals)) {
      if (data.paldeck === '') continue; // unnumbered crossover pals
      const existing = paldeckMap.get(data.paldeck) || [];
      existing.push(name);
      paldeckMap.set(data.paldeck, existing);
    }
    const duplicates: [string, string[]][] = [];
    for (const [deck, palNames] of paldeckMap) {
      if (palNames.length > 1) {
        duplicates.push([deck, palNames]);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it('should have at least one element for every pal (except known untyped pals)', () => {
    // Astralym is the only pal with no elements in the dataset
    const knownUntyped = new Set(['Astralym']);
    for (const [name, data] of Object.entries(pals)) {
      if (knownUntyped.has(name)) {
        expect(
          data.elements,
          `${name}: known untyped pal should have empty elements`
        ).toEqual([]);
      } else {
        expect(
          data.elements.length,
          `${name}: should have at least one element`
        ).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('should have a boolean in_generic_pool for every pal', () => {
    for (const [name, data] of Object.entries(pals)) {
      expect(
        typeof data.in_generic_pool,
        `${name}: in_generic_pool should be boolean, got ${typeof data.in_generic_pool}`
      ).toBe('boolean');
    }
  });

  it('should have a work object for every pal (can be empty)', () => {
    for (const [name, data] of Object.entries(pals)) {
      expect(
        typeof data.work,
        `${name}: work should be an object, got ${typeof data.work}`
      ).toBe('object');
      expect(
        data.work,
        `${name}: work should not be null`
      ).not.toBeNull();
    }
  });
});
