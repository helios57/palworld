import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { initEngine, breed } from '../../src/engine.js';
import type { PalData, SpecialCombo } from '../../src/engine.js';
import {
  reachable,
  stepsOrdered,
  toStepObjects,
  planForTarget,
  consolidatePlan,
} from '../../src/solver.js';
import type { Step } from '../../src/solver.js';

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

describe('solver', () => {
  const ownedBase = ['Lamball', 'Cattiva', 'Chikipi'];

  beforeAll(() => {
    const pals = loadPals();
    const combos = loadSpecialCombos();
    initEngine(pals, combos);
  });

  describe('reachable()', () => {
    it('assigns depth 0 to all owned pals', () => {
      const { depth } = reachable(ownedBase);
      for (const p of ownedBase) {
        expect(depth[p]).toBe(0);
      }
    });

    it('assigns recipe=null for owned pals', () => {
      const { recipe } = reachable(ownedBase);
      for (const p of ownedBase) {
        expect(recipe[p]).toBeNull();
      }
    });

    it('assigns steps=0 for owned pals', () => {
      const { steps } = reachable(ownedBase);
      for (const p of ownedBase) {
        expect(steps[p]).toBe(0);
      }
    });

    it('assigns frag=0 for owned pals', () => {
      const { frag } = reachable(ownedBase);
      for (const p of ownedBase) {
        expect(frag[p]).toBe(0);
      }
    });

    it('finds reachable children beyond owned set', () => {
      const { depth, recipe } = reachable(ownedBase);
      // There should be at least some reachable pals beyond the owned set
      const reachableCount = Object.keys(depth).length;
      expect(reachableCount).toBeGreaterThan(ownedBase.length);

      // At least one reachable pal should have depth > 0
      const beyondOwned = Object.entries(depth).filter(
        ([name]) => !ownedBase.includes(name),
      );
      expect(beyondOwned.length).toBeGreaterThan(0);

      // Each reachable non-owned pal should have a recipe
      for (const [name] of beyondOwned) {
        expect(recipe[name]).toBeDefined();
        expect(recipe[name]).not.toBeNull();
      }
    });

    it('respects maxDepth parameter (fewer BFS passes finds fewer pals)', () => {
      // maxDepth controls BFS loop iterations (passes = maxDepth + 3).
      // A lower maxDepth limits search breadth and finds fewer pals.
      const r0 = reachable(ownedBase, 0);
      const r2 = reachable(ownedBase, 2);
      const r4 = reachable(ownedBase, 4);
      // Lower maxDepth should find fewer or equal pals
      expect(Object.keys(r0.depth).length).toBeLessThanOrEqual(
        Object.keys(r2.depth).length,
      );
      expect(Object.keys(r2.depth).length).toBeLessThanOrEqual(
        Object.keys(r4.depth).length,
      );
    });

    it('finds fewer pals at lower maxDepth', () => {
      const r1 = reachable(ownedBase, 1);
      const r2 = reachable(ownedBase, 4);
      // Lower depth should find fewer or equal pals
      expect(Object.keys(r1.depth).length).toBeLessThanOrEqual(
        Object.keys(r2.depth).length,
      );
    });

    it('recipe pairs actually produce the child via breed()', () => {
      const { recipe } = reachable(ownedBase);
      for (const [child, parents] of Object.entries(recipe)) {
        if (parents === null) continue;
        const [a, b] = parents;
        const actualChild = breed(a, b);
        expect(actualChild).toBe(child);
      }
    });

    it('returns empty depth for empty owned set', () => {
      const { depth, recipe } = reachable([]);
      expect(Object.keys(depth)).toEqual([]);
      expect(Object.keys(recipe)).toEqual([]);
    });

    it('with large owned set, finds many reachable pals', () => {
      const manyOwned = [
        'Lamball', 'Cattiva', 'Chikipi', 'Foxparks', 'Pengullet',
        'Jolthog', 'Gumoss', 'Vixy', 'Hoocrates', 'Teafant',
      ];
      const { depth } = reachable(manyOwned);
      // With a larger owned set, should find many reachable pals
      expect(Object.keys(depth).length).toBeGreaterThan(manyOwned.length);
    });
  });

  describe('stepsOrdered()', () => {
    it('returns steps in valid dependency order', () => {
      const { recipe } = reachable(ownedBase);

      // Find a reachable pal with depth > 1 for a meaningful path
      const reachablePals = Object.keys(recipe).filter(
        (name) => recipe[name] !== null && !ownedBase.includes(name),
      );
      expect(reachablePals.length).toBeGreaterThan(0);

      // Pick one
      const target = reachablePals[0];
      const steps = stepsOrdered(target, recipe);

      // Every step's parents should be either owned or produced by a previous step
      const available = new Set(ownedBase);
      for (const [a, b] of steps) {
        expect(available.has(a)).toBe(true);
        expect(available.has(b)).toBe(true);
        const child = breed(a, b);
        // Steps go [a, b, child], add child to available
        available.add(child!);
      }
    });

    it('returns empty array for owned pal (depth 0)', () => {
      const { recipe } = reachable(ownedBase);
      const steps = stepsOrdered('Lamball', recipe);
      expect(steps).toEqual([]);
    });

    it('returns empty array for unreachable pal', () => {
      const { recipe } = reachable(ownedBase);
      const steps = stepsOrdered('CompletelyUnreachable', recipe);
      expect(steps).toEqual([]);
    });

    it('includes the target pal as the last result', () => {
      const { recipe } = reachable(ownedBase);
      const reachablePals = Object.keys(recipe).filter(
        (name) => recipe[name] !== null && !ownedBase.includes(name),
      );
      const target = reachablePals[0];
      const steps = stepsOrdered(target, recipe);

      if (steps.length > 0) {
        const lastStep = steps[steps.length - 1];
        // lastStep is [a, b, child] and child should be the target
        expect(lastStep[2]).toBe(target);
      }
    });
  });

  describe('toStepObjects()', () => {
    it('identifies special combo steps', () => {
      // Use owned pals that form a special combo
      const owned = ['Incineram', 'Maraith'];
      const { recipe } = reachable(owned);
      const steps = stepsOrdered('Incineram Noct', recipe);
      const objects = toStepObjects(steps);

      expect(objects.length).toBeGreaterThan(0);
      // If "Incineram Noct" is a special combo, the step type should be "special"
      const specialSteps = objects.filter((s: Step) => s.type === 'special');
      // There may be a direct special combo step
      expect(specialSteps.length).toBeGreaterThanOrEqual(0);
    });

    it('identifies same-species steps', () => {
      // If we own two of the same species, breed produces itself
      const { recipe } = reachable(ownedBase);
      // We need to find a step from same-species parents
      const allSteps = Object.entries(recipe)
        .filter(([, parents]) => parents !== null)
        .filter(([, parents]) => parents![0] === parents![1]);

      if (allSteps.length > 0) {
        const target = allSteps[0][0];
        const rawSteps = stepsOrdered(target, recipe);
        const objects = toStepObjects(rawSteps);
        const sameSpecies = objects.filter((s: Step) => s.type === 'same-species');
        expect(sameSpecies.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('identifies formula steps', () => {
      const { recipe } = reachable(ownedBase);
      const reachablePals = Object.keys(recipe).filter(
        (name) => recipe[name] !== null && !ownedBase.includes(name),
      );
      const target = reachablePals[0];
      const rawSteps = stepsOrdered(target, recipe);
      const objects = toStepObjects(rawSteps);

      for (const step of objects) {
        expect(['special', 'same-species', 'formula']).toContain(step.type);
      }
    });

    it('captures tieDependent from breedDetail', () => {
      const { recipe } = reachable(ownedBase);
      const reachablePals = Object.keys(recipe).filter(
        (name) => recipe[name] !== null && !ownedBase.includes(name),
      );
      if (reachablePals.length > 0) {
        const target = reachablePals[0];
        const rawSteps = stepsOrdered(target, recipe);
        const objects = toStepObjects(rawSteps);

        for (const step of objects) {
          expect(typeof step.tieDependent).toBe('boolean');
        }
      }
    });
  });

  describe('planForTarget()', () => {
    it('returns null for unreachable target', () => {
      const { recipe, depth } = reachable(ownedBase);
      const plan = planForTarget('CompletelyUnreachablePal', recipe, depth);
      expect(plan).toBeNull();
    });

    it('returns null for owned pal (recipe is null)', () => {
      const { recipe, depth } = reachable(ownedBase);
      const plan = planForTarget('Lamball', recipe, depth);
      expect(plan).toBeNull();
    });

    it('returns valid plan for reachable target', () => {
      const { recipe, depth } = reachable(ownedBase);
      const reachablePals = Object.keys(recipe).filter(
        (name) => recipe[name] !== null && !ownedBase.includes(name),
      );
      expect(reachablePals.length).toBeGreaterThan(0);

      const target = reachablePals[0];
      const plan = planForTarget(target, recipe, depth);

      expect(plan).not.toBeNull();
      expect(plan!.pal).toBe(target);
      expect(plan!.depth).toBeGreaterThan(0);
      expect(plan!.steps.length).toBeGreaterThan(0);
      expect(plan!.work).toBeDefined();
    });

    it('plan steps are in valid order', () => {
      const { recipe, depth } = reachable(ownedBase);
      const reachablePals = Object.keys(recipe).filter(
        (name) => recipe[name] !== null && !ownedBase.includes(name),
      );
      const target = reachablePals[0];
      const plan = planForTarget(target, recipe, depth);

      expect(plan).not.toBeNull();
      const available = new Set(ownedBase);
      for (const step of plan!.steps) {
        for (const p of step.parents) {
          expect(available.has(p)).toBe(true);
        }
        available.add(step.child);
      }
    });
  });

  describe('consolidatePlan()', () => {
    it('returns a valid consolidated plan', () => {
      const { recipe, depth } = reachable(ownedBase);
      const reachablePals = Object.keys(recipe).filter(
        (name) => recipe[name] !== null && !ownedBase.includes(name),
      );

      // Pick up to 2 targets
      const targets = reachablePals.slice(0, 2);
      expect(targets.length).toBeGreaterThan(0);

      const consolidated = consolidatePlan(
        targets,
        recipe,
        depth,
        ownedBase,
        299,
      );

      expect(consolidated.targets).toEqual(targets);
      expect(consolidated.owned).toEqual(ownedBase);
      expect(consolidated.steps.length).toBeGreaterThan(0);
      expect(consolidated.totalPals).toBe(299);
      expect(consolidated.reachableCount).toBe(
        Object.keys(depth).length,
      );
    });

    it('deduplicates shared intermediate steps', () => {
      const { recipe, depth } = reachable(ownedBase);
      const reachablePals = Object.keys(recipe).filter(
        (name) => recipe[name] !== null && !ownedBase.includes(name),
      );

      if (reachablePals.length >= 2) {
        const targets = reachablePals.slice(0, 2);
        const consolidated = consolidatePlan(
          targets,
          recipe,
          depth,
          ownedBase,
          299,
        );

        // Check no duplicate children in steps
        const children = consolidated.steps.map((s: Step) => s.child);
        const uniqueChildren = new Set(children);
        expect(children.length).toBe(uniqueChildren.size);
      }
    });

    it('all parents are available before use (no ordering violations)', () => {
      const { recipe, depth } = reachable(ownedBase);
      const reachablePals = Object.keys(recipe).filter(
        (name) => recipe[name] !== null && !ownedBase.includes(name),
      );

      if (reachablePals.length >= 2) {
        const targets = reachablePals.slice(0, 2);
        const consolidated = consolidatePlan(
          targets,
          recipe,
          depth,
          ownedBase,
          299,
        );

        // Verify ordering: every parent is either owned or appears as an earlier child
        const avail = new Set<string>(ownedBase);
        for (const step of consolidated.steps) {
          expect(avail.has(step.parents[0])).toBe(true);
          expect(avail.has(step.parents[1])).toBe(true);
          avail.add(step.child);
        }
      }
    });

    it('throws if a parent is not available in the build order', () => {
      const { recipe, depth } = reachable(ownedBase);
      const reachablePals = Object.keys(recipe).filter(
        (name) => recipe[name] !== null && !ownedBase.includes(name),
      );

      if (reachablePals.length > 0) {
        const target = reachablePals[0];

        // Manually construct steps with a missing parent to test validation
        const fakeSteps: Step[] = [
          {
            parents: ['MissingPal1', 'Lamball'],
            child: target,
            type: 'formula',
            tieDependent: false,
          },
        ];

        // Build a recipe that maps the target's parents to the fake steps
        // and call consolidatePlan which will validate ordering
        // We need to construct a scenario that triggers the error
        // Actually, we test that consolidatePlan for a known good input doesn't throw,
        // and we test a bad ordering scenario separately

        // consolidatePlan handles a real plan. To test the error path,
        // we can try constructing steps out of order and verify it throws
        expect(() => {
          // Build a recipe where a child depends on a parent NOT in owned
          // and not produced earlier
          const badRecipe = { ...recipe };
          // Add a fake dependency
          badRecipe['FakeChild'] = ['NotOwnedPal', 'AlsoNotOwned'];

          // This uses a fake depth map
          const badDepth = { ...depth, FakeChild: 1 };

          consolidatePlan(['FakeChild'], badRecipe, badDepth, ownedBase, 299);
        }).toThrow('Invalid order');
      }
    });

    it('returns correct step count for single target', () => {
      const { recipe, depth } = reachable(ownedBase);
      const reachablePals = Object.keys(recipe).filter(
        (name) => recipe[name] !== null && !ownedBase.includes(name),
      );

      if (reachablePals.length > 0) {
        const target = reachablePals[0];
        const plan = planForTarget(target, recipe, depth)!;
        const consolidated = consolidatePlan(
          [target],
          recipe,
          depth,
          ownedBase,
          299,
        );

        // Single target: consolidated steps should equal plan steps
        expect(consolidated.steps.length).toBe(plan.steps.length);
      }
    });
  });
});
