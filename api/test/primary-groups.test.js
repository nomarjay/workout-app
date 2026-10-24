import test from 'node:test';
import assert from 'node:assert/strict';
import { belongsToPrimaryGroup } from '../../ui/src/utils/muscleGroups.js';
import { normalizeExercise } from '../data/catalog.js';

test('bench belongs to Chest while secondary triceps and delts do not classify it as Arms or Shoulders', () => {
  const bench = normalizeExercise({ name: 'Smith Machine Bench Press', equipment: 'Smith Machine', muscleGroupId: 1 });
  assert.ok(bench.secondaryMuscles.includes('Triceps'));
  assert.equal(belongsToPrimaryGroup(bench, '1'), true);
  assert.equal(belongsToPrimaryGroup(bench, 3), false);
  assert.equal(belongsToPrimaryGroup(bench, 6), false);
  assert.equal(belongsToPrimaryGroup({ muscleGroupId: '3' }, 3), true);
  assert.equal(belongsToPrimaryGroup({ muscleGroupIds: [1, 3] }, 3), false);
});
