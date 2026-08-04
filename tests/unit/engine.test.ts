import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  initEngine,
  breed,
  breedDetail,
  isSpecial,
  getAllPalNames,
  getPool,
  getRank,
  getWork,
  verifyEngine,
  formulaChild,
} from '../../src/engine.js';
import type { PalData, SpecialCombo } from '../../src/engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../../data');

function loadPals(): Record<string, PalData> {
  return JSON.parse(readFileSync(resolve(dataDir, 'pals.json'), 'utf-8'));
}

function loadSpecialCombos(): SpecialCombo[] {
  return JSON.parse(
    readFileSync(resolve(dataDir, 'special_combos.json'), 'utf-8'),
  );
}

describe('engine', () => {
  beforeAll(() => {
    const pals = loadPals();
    const combos = loadSpecialCombos();
    initEngine(pals, combos);
  });

  describe('breed()', () => {
    it('Turtacle + Aegidron = Nitemary (tie-break verification)', () => {
      expect(breed('Turtacle', 'Aegidron')).toBe('Nitemary');
    });

    it('Anubis + Anubis = Anubis (same-species returns same species)', () => {
      expect(breed('Anubis', 'Anubis')).toBe('Anubis');
    });

    it('Jetragon + Jetragon = Jetragon (same-species)', () => {
      expect(breed('Jetragon', 'Jetragon')).toBe('Jetragon');
    });

    it('breed(a, b) = breed(b, a) — order insensitivity', () => {
      const pairs: [string, string][] = [
        ['Anubis', 'Jormuntide'],
        ['Lamball', 'Cattiva'],
        ['Foxparks', 'Chikipi'],
        ['Turtacle', 'Aegidron'],
        ['Jetragon', 'Frostallion'],
      ];
      for (const [a, b] of pairs) {
        expect(breed(a, b)).toBe(breed(b, a));
      }
    });

    it('special combo: Incineram + Maraith = Incineram Noct', () => {
      expect(breed('Incineram', 'Maraith')).toBe('Incineram Noct');
    });

    it('special combo: Relaxaurus + Sparkit = Relaxaurus Lux', () => {
      expect(breed('Relaxaurus', 'Sparkit')).toBe('Relaxaurus Lux');
    });

    it('special combo: Mau + Pengullet = Mau Cryst', () => {
      expect(breed('Mau', 'Pengullet')).toBe('Mau Cryst');
    });

    it('special combo: Vanwyrm + Foxcicle = Vanwyrm Cryst', () => {
      expect(breed('Vanwyrm', 'Foxcicle')).toBe('Vanwyrm Cryst');
    });

    it('returns null for unknown pal name', () => {
      expect(breed('NotAPal', 'Anubis')).toBeNull();
    });

    it('returns null for two unknown pal names', () => {
      expect(breed('FakePal1', 'FakePal2')).toBeNull();
    });
  });

  describe('breedDetail()', () => {
    it('returns fragile: false for special combos', () => {
      const result = breedDetail('Incineram', 'Maraith');
      expect(result).not.toBeNull();
      expect(result!.child).toBe('Incineram Noct');
      expect(result!.fragile).toBe(false);
    });

    it('returns fragile: false for same-species pairing', () => {
      const result = breedDetail('Anubis', 'Anubis');
      expect(result).not.toBeNull();
      expect(result!.child).toBe('Anubis');
      expect(result!.fragile).toBe(false);
    });

    it('returns null for unknown pal name', () => {
      expect(breedDetail('FakePal', 'Anubis')).toBeNull();
    });

    it('returns a valid BreedResult for formula-based pairs', () => {
      const result = breedDetail('Lamball', 'Cattiva');
      expect(result).not.toBeNull();
      expect(typeof result!.child).toBe('string');
      expect(typeof result!.fragile).toBe('boolean');
    });
  });

  describe('isSpecial()', () => {
    it('returns true for known special combo', () => {
      expect(isSpecial('Incineram', 'Maraith')).toBe(true);
      expect(isSpecial('Relaxaurus', 'Sparkit')).toBe(true);
      expect(isSpecial('Mau', 'Pengullet')).toBe(true);
    });

    it('returns true regardless of order', () => {
      expect(isSpecial('Maraith', 'Incineram')).toBe(true);
      expect(isSpecial('Sparkit', 'Relaxaurus')).toBe(true);
    });

    it('returns false for non-special pair', () => {
      expect(isSpecial('Lamball', 'Cattiva')).toBe(false);
      expect(isSpecial('Anubis', 'Jormuntide')).toBe(false);
    });

    it('returns false for same-species pair (unless in special combos)', () => {
      // Anubis + Anubis is same-species, not a special combo
      expect(isSpecial('Anubis', 'Anubis')).toBe(false);
    });
  });

  describe('formulaChild()', () => {
    it('computes the correct child for known ranks', () => {
      // Anubis has rank 480, in generic pool
      // formulaChild(480, 480) should yield the pal closest to floor((480+480+1)/2) = 480
      const result = formulaChild(480, 480);
      expect(result.child).toBe('Anubis');
      expect(result.fragile).toBe(false);
    });

    it('produces symmetric results: formulaChild(ra, rb) = formulaChild(rb, ra)', () => {
      const r1 = formulaChild(100, 500);
      const r2 = formulaChild(500, 100);
      expect(r1.child).toBe(r2.child);
      expect(r1.fragile).toBe(r2.fragile);
    });
  });

  describe('getAllPalNames()', () => {
    it('returns 299 entries', () => {
      const names = getAllPalNames();
      expect(names).toHaveLength(299);
    });

    it('includes known pals', () => {
      const names = getAllPalNames();
      expect(names).toContain('Anubis');
      expect(names).toContain('Jetragon');
      expect(names).toContain('Lamball');
      expect(names).toContain('Turtacle');
    });
  });

  describe('getPool()', () => {
    it('returns the generic breeding pool (non-empty)', () => {
      const pool = getPool();
      expect(pool.length).toBeGreaterThan(0);
    });

    it('contains Anubis (in_generic_pool: true)', () => {
      const pool = getPool();
      expect(pool).toContain('Anubis');
    });

    it('returns a new array each time (slice)', () => {
      const p1 = getPool();
      const p2 = getPool();
      expect(p1).toEqual(p2);
      // They should be different objects
      p1.push('FakePal');
      expect(p2).not.toContain('FakePal');
    });
  });

  describe('getRank()', () => {
    it('returns correct rank for Anubis (480)', () => {
      expect(getRank('Anubis')).toBe(480);
    });

    it('returns correct rank for Jetragon (70)', () => {
      expect(getRank('Jetragon')).toBe(70);
    });

    it('returns undefined for unknown pal', () => {
      expect(getRank('NotAPal')).toBeUndefined();
    });
  });

  describe('getWork()', () => {
    it('returns work suitabilities for Anubis', () => {
      const work = getWork('Anubis');
      expect(work).toHaveProperty('Handiwork');
      expect(work).toHaveProperty('Mining');
      expect(work).toHaveProperty('Transporting');
      expect(work['Handiwork']).toBe(6);
      expect(work['Mining']).toBe(6);
      expect(work['Transporting']).toBe(4);
    });

    it('returns empty object for unknown pal', () => {
      const work = getWork('NotAPal');
      expect(work).toEqual({});
    });
  });

  describe('verifyEngine()', () => {
    it('returns true (Turtacle + Aegidron = Nitemary)', () => {
      expect(verifyEngine()).toBe(true);
    });
  });

  describe('initEngine()', () => {
    it('resets state with empty data', () => {
      // First save original state
      const previousNames = getAllPalNames();

      // Reset with empty data
      initEngine({}, []);

      expect(getAllPalNames()).toEqual([]);
      expect(getPool()).toEqual([]);
      expect(breed('Anubis', 'Anubis')).toBeNull();

      // Restore original data for other tests
      const pals = loadPals();
      const combos = loadSpecialCombos();
      initEngine(pals, combos);
      expect(getAllPalNames()).toHaveLength(previousNames.length);
    });
  });

  describe('breedDetail cache', () => {
    it('formulaChild caches results (same reference for same ranks)', () => {
      const r1 = formulaChild(150, 350);
      const r2 = formulaChild(150, 350);
      // Same ranks should return the same cached object reference
      expect(r1).toBe(r2);
    });

    it('formulaChild returns different results for different ranks', () => {
      const r1 = formulaChild(150, 350);
      const r2 = formulaChild(200, 400);
      expect(r1).not.toBe(r2);
    });
  });
});
