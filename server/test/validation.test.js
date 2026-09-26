import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkout } from '../src/validation.js';
const valid = { name: 'Push day', date: '2026-09-26', durationMinutes: 45, muscleGroupIds: [1, 3] };
test('accepts a workout and leap-day dates', () => {
  assert.equal(validateWorkout(valid), null);
  assert.equal(validateWorkout({ ...valid, date: '2024-02-29' }), null);
});
test('rejects invalid calendar dates', () => {
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', 'yesterday'])
    assert.ok(validateWorkout({ ...valid, date }));
});
test('rejects invalid durations and muscle group selections', () => {
  for (const durationMinutes of [0, -1, 1.5, 1441, '45'])
    assert.ok(validateWorkout({ ...valid, durationMinutes }));
  for (const muscleGroupIds of [[], [1, 1], [-1], ['1'], null])
    assert.ok(validateWorkout({ ...valid, muscleGroupIds }));
});
test('rejects missing or oversized fields', () => {
  for (const body of [null, {}, { ...valid, name: ' ' }, { ...valid, name: 'a'.repeat(101) }, { ...valid, notes: 'a'.repeat(2001) }])
    assert.ok(validateWorkout(body));
});
