import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { localDate } from '../../ui/src/utils/dashboard.js';

test('dashboard renders the current date, populated workout and profile, and empty onboarding state', async () => {
  const server = await createServer({ root: fileURLToPath(new URL('../../ui', import.meta.url)),
    server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Dashboard } = await server.ssrLoadModule('/src/views/DashboardView.vue');
    const today = localDate();
    const workout = { id: 'sample', name: 'Upper body day', exercises: [
      { name: 'Bench Press', equipment: 'Smith Machine', equipmentId: 5, muscleGroupIds: [1], primaryMuscles: ['Pectoralis Major'], attachment: null },
    ] };
    const common = { workouts: [workout], schedules: [{ date: today, workoutId: 'sample', durationMinutes: null, intensity: 'Moderate' }],
      catalog: { groups: [{ id: 1, name: 'Chest' }] }, busy: false, loading: false };
    const populated = await renderToString(createSSRApp(Dashboard, { ...common, profile: {
      name: 'Taylor Client', email: '', birthDate: '1994-10-15', gender: '', heightCm: 175, weightKg: 72,
      goal: 'Build strength', experience: 'Intermediate', activityLevel: 'Moderately active', weeklyTarget: 3,
    } }));
    for (const content of ['Welcome back, Taylor.', 'Upper body day', 'Workout overview', '175 cm', 'Bench Press', 'Estimated time']) {
      assert.ok(populated.includes(content), content);
    }
    assert.ok(populated.includes('Start workout'));
    assert.ok(populated.includes('Actions for selected day'));
    const signedOut = await renderToString(createSSRApp(Dashboard, { ...common, profile: null, signedOut: true }));
    assert.ok(signedOut.includes('Choose your profile'));
    assert.ok(!signedOut.includes('Start workout'));
    assert.ok(!signedOut.includes('Upper body day'));
    assert.ok(populated.includes('Workout log'));
    assert.ok(!populated.includes('Coming up'));
    const history = await renderToString(createSSRApp(Dashboard, { ...common, profile: null, logs: [{ id: 'log-1', name: 'Finished session', scheduledDate: today, completedAt: new Date().toISOString(), exercises: [{ name: 'Cable curl', equipment: 'Cable', attachment: 'Rope' }] }] }));
    for (const content of ['Finished session', 'Cable curl', 'Rope', 'Delete logged workout']) assert.ok(history.includes(content), content);
    assert.ok(populated.includes('aria-current="date"'));
    assert.ok(populated.includes(`datetime="${today}"`));
    const agenda = populated.split('aria-labelledby="daily-heading"')[1].split('aria-labelledby="overview-heading"')[0];
    for (const content of ['Primary muscles worked', 'Pectoralis Major', 'Moderate', 'Overall intensity']) assert.ok(agenda.includes(content), content);
    assert.ok(!agenda.includes('Equipment types'));
    assert.ok(!agenda.includes('Muscle groups'));
    const unset = await renderToString(createSSRApp(Dashboard, { ...common, profile: null,
      schedules: [{ date: today, workoutId: 'sample', durationMinutes: null }] }));
    assert.ok(unset.includes('Not set'));
    const empty = await renderToString(createSSRApp(Dashboard, { ...common, profile: null, workouts: [], schedules: [] }));
    for (const content of ['Create profile', 'Build your first workout', 'Your calendar']) assert.ok(empty.includes(content), content);
    const { default: App } = await server.ssrLoadModule('/src/App.vue');
    const home = await renderToString(createSSRApp(App));
    assert.ok(home.includes('aria-pressed="true">Dashboard'));
    assert.ok(home.includes('Your training, at a glance.'));
  } finally { await server.close(); }
});
