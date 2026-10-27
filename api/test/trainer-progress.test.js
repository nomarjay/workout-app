import test from 'node:test';
import assert from 'node:assert/strict';
import { ref } from 'vue';
import { useTrainerProgress } from '../../ui/src/composables/useTrainerProgress.js';

test('trainer advances between exercise occurrences, keeps inputs, and ends in review', () => {
  const assignments = ref([
    { exerciseIndex: 0, oneRepMax: 100 },
    { exerciseIndex: 1, oneRepMax: 80 },
  ]);
  const progress = useTrainerProgress(assignments);
  assert.equal(progress.activeIndex.value, 0);
  progress.completeExercise(0);
  assert.equal(progress.activeIndex.value, 1);
  assert.deepEqual(progress.completed.value, [0]);
  progress.completeExercise(1);
  assert.equal(progress.activeIndex.value, null);
  assert.equal(assignments.value[0].oneRepMax, 100);
  assert.equal(assignments.value[1].oneRepMax, 80);
  progress.activeIndex.value = 0;
  progress.markDirty(0);
  assert.deepEqual(progress.completed.value, [1]);
  progress.completeExercise(0);
  assert.equal(progress.activeIndex.value, null);
  assert.deepEqual([...progress.completed.value].sort(), [0, 1]);
});

test('trainer returns to skipped exercises and resets review after shared settings change', () => {
  const assignments = ref([
    { exerciseIndex: 0 },
    { exerciseIndex: 1 },
    { exerciseIndex: 2 },
  ]);
  const progress = useTrainerProgress(assignments);
  progress.activeIndex.value = 2;
  progress.completeExercise(2);
  assert.equal(progress.activeIndex.value, 0);
  progress.completeExercise(0);
  assert.equal(progress.activeIndex.value, 1);
  progress.completeExercise(1);
  assert.equal(progress.activeIndex.value, null);
  progress.resetProgress();
  assert.deepEqual(progress.completed.value, []);
  assert.equal(progress.activeIndex.value, 0);
});
