import test from 'node:test';
import assert from 'node:assert/strict';
import { computed, createSSRApp, ref } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { memoryDb } from './helpers/memory-db.js';
import { createDraftTrainerSaver } from '../../ui/src/utils/draftTrainer.js';
import { useCatalogBrowser } from '../../ui/src/composables/useCatalogBrowser.js';
import { groupExerciseVariants } from '../../ui/src/utils/exerciseVariants.js';

test('recent sorting keeps creation order through exercise grouping, filtering and search', () => {
  const exercises = ref([
    { name: 'Alpha legacy', exerciseId: 'a' },
    { name: 'Zulu new', exerciseId: 'z', createdAt: '2026-10-26T12:00:00Z' },
    { name: 'Beta older', exerciseId: 'b', createdAt: '2026-10-25T12:00:00Z' },
    { name: 'Invalid date', exerciseId: 'i', createdAt: 'invalid' },
  ]);
  const browser = useCatalogBrowser(computed(() => groupExerciseVariants(exercises.value)));
  browser.sort.value = 'recent';
  assert.deepEqual(browser.visible.value.map(item => item.id), ['z', 'b', 'a', 'i']);
  browser.search.value = 'older';
  assert.deepEqual(browser.visible.value.map(item => item.id), ['b']);
  browser.search.value = '';
  browser.sort.value = 'asc';
  assert.equal(browser.visible.value[0].id, 'a');
});

test('draft training saves the routine and plan together, and retry does not duplicate the workout', async () => {
  const server = createApp(memoryDb()).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, options) => {
    const response = await fetch(base + path, options);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    return body;
  };
  try {
    const catalog = await request('/api/catalog');
    const draft = [catalog.exercises.find(item => Number(item.equipmentId) === 4)];
    let rejectPlan = true;
    const saved = [];
    const save = createDraftTrainerSaver(async (path, options) => {
      if (path.startsWith('/api/trainer-mode/') && rejectPlan) { rejectPlan = false; throw new Error('Plan connection failed'); }
      return request(path, options);
    }, workout => saved.push(workout));
    const plan = { weightUnit: 'kg', exercises: [{ exerciseIndex: 0, oneRepMax: 100, referenceMaxWeight: 100, workingWeight: 60, minWeight: 0, maxWeight: 100, reps: 8, sets: 3, repsInReserve: 2, tempo: 'controlled', loadMode: 'adaptive', weightIncrement: 0.01, useAlgorithm: false }] };
    await assert.rejects(save({ name: 'Before saving', draft, plan }), /Plan connection failed/);
    assert.equal((await request('/api/workouts')).length, 1);
    const result = await save({ name: 'Ready routine', draft, plan });
    assert.equal(result.id, saved[0].id);
    assert.equal((await request('/api/workouts')).length, 1);
    assert.equal((await request(`/api/trainer-mode/${result.id}`)).exercises[0].workingWeight, 60);
    const machine = await request('/api/equipment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ 'equipment-type': 'Recent machine', category: 'Machines', attachmentIds: [] }) });
    assert.ok(Number.isFinite(Date.parse(machine.createdAt)));
    await request(`/api/equipment/${machine.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...machine, 'equipment-type': 'Renamed machine' }) });
    assert.equal((await request(`/api/equipment/${machine.id}`)).createdAt, machine.createdAt);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('one exercise filter and sort panel offers recent items and draft Trainer Mode without the duplicate detail selector', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../../ui', import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Exercise } = await server.ssrLoadModule('/src/views/ExerciseView.vue');
    const { default: Step } = await server.ssrLoadModule('/src/components/TrainerModeStep.vue');
    const { default: Workout } = await server.ssrLoadModule('/src/views/WorkoutView.vue');
    const catalog = { groups: [], equipment: [], attachments: [], exercises: [], exerciseDefinitions: [] };
    const draft = [{ name: 'Chest Press', selectionId: 'first', exerciseId: 'press', equipmentOptionKey: '3', equipment: 'Plate Loaded Machine' }];
    const html = await renderToString(createSSRApp(Exercise, { catalog, draft }));
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.ok(html.includes('Recently added'));
    assert.ok(!html.includes('Primary muscle group'));
    assert.ok(html.includes('Train by muscle group'));
    assert.match(html, /<button[^>]*>Trainer Mode<\/button>/);
    const trainer = await renderToString(createSSRApp(Step, { workout: { id: 'draft', isDraft: true, name: 'Draft workout', exercises: draft } }));
    assert.ok(!trainer.includes('>Exercise details<select'));
    assert.ok(!trainer.includes('Configure Trainer Mode'));
    assert.ok(trainer.includes('Save the routine and plan together when ready.'));
    assert.ok(trainer.includes('SELECTED EXERCISE · 1 OF 1'));
    const builder = await renderToString(createSSRApp(Workout, { catalog, draft, workouts: [], workoutName: '' }));
    assert.match(builder, /<button[^>]*class="step-link"[^>]*>2 · Trainer Mode \(optional\)<\/button>/);
    assert.ok(!/<button[^>]*>Trainer Mode<\/button>/.test(builder), 'No separate Trainer Mode button in the routine panel');
    const empty = await renderToString(createSSRApp(Workout, { catalog, draft: [], workouts: [], workoutName: '' }));
    assert.match(empty, /<button[^>]*class="step-link"[^>]*disabled/);
  } finally { await server.close(); }
});
