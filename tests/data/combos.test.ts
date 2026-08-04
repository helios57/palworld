import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface ComboEntry {
  parent_a: string;
  parent_b: string;
  child: string;
}

const dataDir = resolve(__dirname, '../../data');
const combos: ComboEntry[] = JSON.parse(
  readFileSync(resolve(dataDir, 'special_combos.json'), 'utf-8')
);
const pals: Record<string, unknown> = JSON.parse(
  readFileSync(resolve(dataDir, 'pals.json'), 'utf-8')
);

function sortedPair(a: string, b: string): string {
  return a < b ? `${a}|||${b}` : `${b}|||${a}`;
}

describe('Special combo data integrity', () => {
  it('should have 164 total special combos', () => {
    expect(combos.length).toBe(164);
  });

  it('should have every parent_a referencing an existing pal', () => {
    const missing = new Set<string>();
    for (const c of combos) {
      if (!(c.parent_a in pals)) missing.add(c.parent_a);
    }
    expect([...missing]).toEqual([]);
  });

  it('should have every parent_b referencing an existing pal', () => {
    const missing = new Set<string>();
    for (const c of combos) {
      if (!(c.parent_b in pals)) missing.add(c.parent_b);
    }
    expect([...missing]).toEqual([]);
  });

  it('should have every child referencing an existing pal', () => {
    const missing = new Set<string>();
    for (const c of combos) {
      if (!(c.child in pals)) missing.add(c.child);
    }
    expect([...missing]).toEqual([]);
  });

  it('should have same-species combos produce the same pal as child', () => {
    const invalid: string[] = [];
    for (const c of combos) {
      if (c.parent_a === c.parent_b) {
        if (c.child !== c.parent_a) {
          invalid.push(`${c.parent_a} + ${c.parent_b} -> ${c.child} (expected child: ${c.parent_a})`);
        }
      }
    }
    expect(invalid).toEqual([]);
  });

  it('should have frozenset-style uniqueness (no duplicate unordered parent pairs with same child)', () => {
    const seen = new Map<string, string>(); // sorted-pair-key -> child
    const issues: string[] = [];
    for (const c of combos) {
      const key = sortedPair(c.parent_a, c.parent_b);
      const prev = seen.get(key);
      if (prev !== undefined && prev === c.child) {
        issues.push(
          `Duplicate: {${c.parent_a}, ${c.parent_b}} -> ${c.child} appears more than once`
        );
      }
      seen.set(key, c.child);
    }
    expect(issues).toEqual([]);
  });

  it('should flag unordered parent pairs that map to multiple different children', () => {
    // Multiple children for the same parent pair is a known game mechanic
    // (e.g., Katress + Wixen can produce Wixen Noct OR Katress Ignis).
    // This test documents those cases rather than failing on them.
    const pairChildren = new Map<string, string[]>();
    for (const c of combos) {
      const key = sortedPair(c.parent_a, c.parent_b);
      const existing = pairChildren.get(key) || [];
      existing.push(c.child);
      pairChildren.set(key, existing);
    }
    const multiChild: { pair: string; children: string[] }[] = [];
    for (const [pair, children] of pairChildren) {
      const uniqueChildren = [...new Set(children)];
      if (uniqueChildren.length > 1) {
        const [a, b] = pair.split('|||');
        multiChild.push({ pair: `${a} + ${b}`, children: uniqueChildren });
      }
    }

    // Currently only one known case: Katress + Wixen -> [Wixen Noct, Katress Ignis]
    // If more appear, they need investigation.
    const knownMultiChild = new Set(['Katress|||Wixen']);
    for (const [pair, children] of pairChildren) {
      const uniqueChildren = [...new Set(children)];
      if (uniqueChildren.length > 1 && !knownMultiChild.has(pair)) {
        const [a, b] = pair.split('|||');
        throw new Error(
          `Unexpected multi-child pair: ${a} + ${b} -> [${uniqueChildren.join(', ')}]`
        );
      }
    }

    // Verify the known case is present and correct
    expect(multiChild).toHaveLength(1);
    expect(multiChild[0].pair).toBe('Katress + Wixen');
    expect(multiChild[0].children.sort()).toEqual(['Katress Ignis', 'Wixen Noct']);
  });

  it('should have only same-species-only pals listed as such in breeding_mechanics', () => {
    // Same-species-only pals: parent_a == parent_b == child
    // These must match the breeding_mechanics.json list
    const mechanics = JSON.parse(
      readFileSync(resolve(dataDir, 'breeding_mechanics.json'), 'utf-8')
    );
    const expectedSameSpecies = new Set(
      mechanics.excluded_from_generic_pool.categories.same_species_only_28
    );

    const comboSameSpecies = new Set<string>();
    for (const c of combos) {
      if (c.parent_a === c.parent_b) {
        comboSameSpecies.add(c.parent_a);
      }
    }

    // Check that every same-species combo pal is in the expected list
    const unexpected: string[] = [];
    for (const name of comboSameSpecies) {
      if (!expectedSameSpecies.has(name)) {
        unexpected.push(name);
      }
    }
    expect(unexpected).toEqual([]);

    // Check that every expected same-species pal has a combo entry
    const missing: string[] = [];
    for (const name of expectedSameSpecies) {
      if (!comboSameSpecies.has(name)) {
        missing.push(name);
      }
    }
    expect(missing).toEqual([]);
  });
});
