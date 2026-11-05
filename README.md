# Form — Workout Planner & Training Library

Form is a full-stack fitness app for turning an exercise library into a practical training routine. Users can explore movements and equipment, build reusable workouts, schedule sessions, and record completed training. Trainer Mode adds editable set plans and transparent weight calculations.

The project brings together a Vue interface, an Express REST API, and MongoDB persistence, with particular attention to relationships between exercises, equipment, saved routines, and training history.

## What you can do

- **Explore the library:** search exercises, filter by equipment or muscle group, and choose equipment variants and supported attachments.
- **Build workouts:** add individual or multiple exercises, reorder selections, repeat movements, and save or edit named routines.
- **Manage the catalog:** create and edit exercises and equipment, including muscle targets, attachment compatibility, and image URLs.
- **Plan training:** assign workouts to calendar dates and create daily, weekly, biweekly, or monthly schedules.
- **Use Trainer Mode:** configure weights, sets, reps, tempo, and reps in reserve; use percentage templates or adaptive load suggestions.
- **Track sessions:** finish and log workouts, review completed history, and maintain separate calendars and logs for local profiles.
- **Learn about muscle groups:** browse muscle information alongside related exercises.

## Technology

| Layer       | Tools                                        | Responsibility                                                                               |
| ----------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Frontend    | Vue 3, Vite, Tailwind CSS, Lucide icons      | Reactive views, workout builder, calendar, and training interface                            |
| Backend     | Node.js 22+, Express 5                       | REST endpoints, input validation, and application rules                                      |
| Database    | MongoDB, native Node.js driver               | Catalog, workouts, profiles, schedules, logs, and training plans                             |
| Development | npm workspaces, Concurrently, Docker Compose | Shared dependency installation, development servers, and local database                      |
| Tests       | Node.js built-in test runner                 | API behavior, data relationships, scheduling, training calculations, and UI rendering checks |

## How it works

### Catalog relationships and workout creation

An exercise definition contains equipment options. Each option identifies its equipment, primary and secondary muscles, and optional attachment. The interface presents these options as selectable variants, so a movement can support several equipment configurations without duplicating its core definition.

The workout builder keeps an ordered draft in browser memory. Saving sends the selections to the API, which checks that each exercise and equipment option exists and that its attachment is supported. MongoDB stores ordered exercise snapshots with reference IDs; responses hydrate those references with catalog metadata. Repeated movements remain separate workout entries.

Catalog edits also enforce dependency rules. For example, equipment used by an exercise cannot be deleted, and attachments referenced by saved records cannot simply be removed. These checks protect saved routines from inconsistent relationships.

### Scheduling and completed history

Profiles have separate schedules and workout logs, while the exercise catalog and workout library are shared. Calendar dates use `YYYY-MM-DD` values to preserve the intended day across timezone changes. Monthly recurrence clamps to the last valid day of shorter months. Recurring sessions can be changed individually or from a selected session forward.

Completing a session stores a workout snapshot in the log. Deleting a routine removes its calendar assignments while retaining completed history. Planned session counts and completed workout history are treated separately.

### Trainer Mode calculations

Trainer Mode uses deterministic calculations that can be inspected in the source. It supports manual prescriptions, percentage-based set templates, and adaptive suggestions based on earlier set feedback.

For the one-rep-max suggestion, the app uses an inverse Epley approximation:

```text
suggested load = one-rep max / (1 + (reps + reps in reserve) / 30)
```

One rep with zero reserve uses the entered maximum directly. The basic suggestion helper limits reps plus reserve to 10. Percentage templates calculate load ranges from a reference maximum and round down to available equipment increments. Adaptive plans adjust subsequent suggestions by increments based on whether a previous set felt easy, on target, hard, or missed its target.

The server validates prescriptions before saving them. A signature of the ordered workout selections binds a training plan to the matching exercise occurrences, including repeated movements. These calculations are editable planning heuristics, not individualized fitness assessments.

### Persistence and startup

On first initialization, the API seeds the managed catalog and starter workouts. An initialization marker prevents restarts from restoring deleted catalog entries or overwriting user edits. During database startup, the API returns HTTP 503 until initialization finishes and retries temporary connection failures.

## Run locally

You will need **Node.js 22+**, npm, and a running **MongoDB** server.

1. Clone the repository and open a terminal in the project folder.
2. Install dependencies:

   ```sh
   npm install
   ```

3. Copy `api/.env.example` to `api/.env`. Set `MONGODB_URI` to your MongoDB connection string and `MONGODB_DB` to your database name. The defaults use a local MongoDB server and a database named `workout_app`.
4. Start the app:

   ```sh
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

`npm run dev` starts both the frontend and backend. Keep the terminal open while using the app. If a database connection error appears, check that MongoDB is running and that the connection string in `api/.env` is correct.

## Source layout

```text
api/
  data/          Seed catalog and reference data
  src/           Express app, database initialization, routes, and domain logic
  test/          Automated tests and database check script
ui/
  src/
    components/  Reusable interface components
    composables/ Shared reactive behavior
    data/        Frontend reference content
    utils/       Equipment, selection, and training calculations
    views/       Dashboard, exercises, equipment, muscle groups, and workouts
compose.yaml     Local MongoDB service
package.json     Workspace scripts
```

## Scope and current limitations

Profile switching is a local convenience without password authentication or access control. The app is intended for local use in its current form. Unsaved workout drafts reset on page reload, and optional remote exercise images require network access. Training suggestions depend on user-entered values and equipment conventions; the app does not calculate a validated overall fitness score.
