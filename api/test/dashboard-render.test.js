import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { localDate } from '../../ui/src/utils/dashboard.js';

test('dashboard renders the current date, populated workout and profile, and empty onboarding state', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../../ui', import.meta.url)),
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  });
  try {
    const { default: Dashboard } = await server.ssrLoadModule(
      '/src/views/DashboardView.vue'
    );
    const today = localDate();
    const workout = {
      id: 'sample',
      name: 'Upper body day',
      exercises: [
        {
          name: 'Bench Press',
          equipment: 'Smith Machine',
          equipmentId: 5,
          muscleGroupIds: [1],
          primaryMuscles: ['Pectoralis Major'],
          attachment: null,
        },
      ],
    };
    const common = {
      workouts: [workout],
      schedules: [
        {
          date: today,
          workoutId: 'sample',
          durationMinutes: null,
          intensity: 'Moderate',
        },
      ],
      catalog: { groups: [{ id: 1, name: 'Chest' }] },
      busy: false,
      loading: false,
    };
    const populated = await renderToString(
      createSSRApp(Dashboard, {
        ...common,
        profile: {
          name: 'Taylor Client',
          email: '',
          birthDate: '1994-10-15',
          gender: '',
          heightCm: 175,
          weightKg: 72,
          goal: 'Build strength',
          experience: 'Intermediate',
          activityLevel: 'Moderately active',
          weeklyTarget: 3,
        },
      })
    );
    for (const content of [
      'Welcome back, Taylor.',
      'Upper body day',
      'Your exercises',
      'Bench Press',
      'Estimated time',
    ]) {
      assert.ok(populated.includes(content), content);
    }
    assert.ok(populated.includes('Start workout'));
    assert.ok(populated.includes('Your week'));
    assert.ok(populated.includes('Change schedule'));
    assert.ok(!populated.includes('Workout details &amp; options'));
    const exerciseDetails = populated.match(
      /<details[^>]*aria-labelledby="exercises-heading"[^>]*>[\s\S]*?<\/details>/
    )?.[0];
    assert.ok(exerciseDetails, 'Exercises are collapsible');
    assert.ok(
      !/^<details[^>]*\sopen(?:[\s=>])/.test(exerciseDetails),
      'Exercises start collapsed'
    );
    assert.ok(exerciseDetails.includes('<summary'));
    assert.ok(exerciseDetails.includes('Bench Press'));
    const staticDetails = populated.match(
      /<section aria-label="Workout details">([\s\S]*?)<\/section>/
    )?.[1];
    assert.ok(staticDetails?.includes('Primary muscles worked'));
    assert.ok(staticDetails.includes('Edit workout'));
    assert.ok(staticDetails.includes('Remove schedule'));
    assert.ok(!staticDetails.includes('<summary'));
    assert.ok(!populated.includes('dashboard-stats'));
    assert.ok(
      populated.indexOf('aria-label="Workout details"') <
        populated.indexOf('aria-labelledby="exercises-heading"')
    );
    assert.ok(!populated.includes('repeat-heading'));
    assert.ok(populated.includes('Your calendar'));
    assert.ok(populated.includes('calendar-days'));
    assert.ok(populated.includes('Actions for selected day'));
    assert.ok(populated.includes('aria-current="date"'));
    const signedOut = await renderToString(
      createSSRApp(Dashboard, { ...common, profile: null, signedOut: true })
    );
    assert.ok(signedOut.includes('Choose your profile'));
    assert.ok(!signedOut.includes('Start workout'));
    assert.ok(!signedOut.includes('calendar-days'));
    assert.ok(!signedOut.includes('Upper body day'));
    assert.ok(!populated.includes('Workout log'));
    assert.ok(!populated.includes('Coming up'));
    const history = await renderToString(
      createSSRApp(Dashboard, {
        ...common,
        profile: null,
        logs: [
          {
            id: 'log-1',
            name: 'Finished session',
            scheduledDate: today,
            completedAt: new Date().toISOString(),
            exercises: [
              { name: 'Cable curl', equipment: 'Cable', attachment: 'Rope' },
            ],
          },
        ],
      })
    );
    assert.ok(!history.includes('workout-log'));
    assert.ok(history.includes('1 workout completed'));
    assert.ok(history.includes('Your calendar'));
    assert.ok(populated.includes(`datetime="${today}"`));
    const agenda = populated
      .split('aria-labelledby="daily-heading"')[1]
      .split('aria-labelledby="session-heading"')[0];
    for (const content of [
      'Primary muscles worked',
      'Pectoralis Major',
      'Moderate',
      'Overall intensity',
    ])
      assert.ok(agenda.includes(content), content);
    assert.ok(agenda.includes('Bench Press'));
    assert.ok(!populated.includes('workout-overview'));
    assert.ok(!agenda.includes('Equipment types'));
    assert.ok(!agenda.includes('Muscle groups'));
    const unset = await renderToString(
      createSSRApp(Dashboard, {
        ...common,
        profile: null,
        schedules: [
          { date: today, workoutId: 'sample', durationMinutes: null },
        ],
      })
    );
    assert.ok(unset.includes('Not set'));
    const empty = await renderToString(
      createSSRApp(Dashboard, {
        ...common,
        profile: null,
        workouts: [],
        schedules: [],
      })
    );
    for (const content of ['Build your first workout', 'Your calendar'])
      assert.ok(empty.includes(content), content);
    const repeatProfile = {
      name: 'Taylor',
      repeatingSchedule: {
        date: today,
        workoutId: 'sample',
        frequency: 'biweekly',
        until: null,
      },
      weeklyTarget: 3,
    };
    const repeatHome = await renderToString(
      createSSRApp(Dashboard, { ...common, profile: repeatProfile })
    );
    assert.ok(repeatHome.includes('Your calendar'));
    assert.ok(!repeatHome.includes('repeat-heading'));
    const completedLog = {
      id: 'completed-today',
      workoutId: 'sample',
      name: workout.name,
      scheduledDate: today,
      completedAt: new Date().toISOString(),
      exercises: workout.exercises,
    };
    const completed = await renderToString(
      createSSRApp(Dashboard, { ...common, logs: [completedLog] })
    );
    assert.ok(completed.includes('Workout logged successfully!'));
    assert.ok(completed.includes('is saved to your workout history.'));
    assert.ok(!completed.includes('Start workout'));
    assert.ok(!completed.includes('Finish &amp; log workout'));
    const differentWorkout = await renderToString(
      createSSRApp(Dashboard, {
        ...common,
        logs: [{ ...completedLog, workoutId: 'another-workout' }],
      })
    );
    assert.ok(differentWorkout.includes('Start workout'));
    assert.ok(!differentWorkout.includes('Workout logged successfully!'));
    const differentDate = await renderToString(
      createSSRApp(Dashboard, {
        ...common,
        logs: [{ ...completedLog, scheduledDate: '2020-01-01' }],
      })
    );
    assert.ok(differentDate.includes('Start workout'));
    const { default: App } = await server.ssrLoadModule('/src/App.vue');
    const home = await renderToString(createSSRApp(App));
    assert.ok(home.includes('aria-pressed="true">Dashboard'));
    assert.ok(home.includes('Your training, at a glance.'));
    assert.ok(home.includes('aria-label="Profile options"'));
    assert.ok(home.includes('aria-expanded="false"'));
    assert.ok(!populated.includes('profile-card'));
    const { default: ProfileMenu } = await server.ssrLoadModule(
      '/src/components/ProfileMenu.vue'
    );
    const profileNav = await renderToString(
      createSSRApp(ProfileMenu, {
        profile: { name: 'Taylor Client' },
        profiles: [],
        profileId: 'primary',
      })
    );
    assert.ok(profileNav.includes('Profile options for Taylor Client'));
    assert.ok(profileNav.includes('TC'));
  } finally {
    await server.close();
  }
});
