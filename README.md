# Form — workout tracker

A small Vue 3 + Vite frontend, Express/Node API, and MySQL starter. Log workouts with a date, duration, notes, and multiple targeted muscle groups; browse history, filter by muscle group, and delete workouts. Summary cards show all-time totals.

## Run locally

Requires Node.js 22+ and Docker with Compose (or an existing MySQL 8 database).

```powershell
npm install
Copy-Item server/.env.example server/.env
docker compose up -d --wait
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the API at http://127.0.0.1:3001. If you change the API port, also update `client/vite.config.js`.

For an existing MySQL installation, create a database and an application user, import `database/schema.sql` into that database, and configure `server/.env`. Docker initializes the schema and seeds ten muscle groups on the first startup of its data volume. Later schema changes must be applied manually; restarting the container does not rerun initialization scripts.

```sh
mysql -u root -p -e "CREATE DATABASE workout_app;"
mysql -u root -p workout_app < database/schema.sql
```

The import command uses shell input redirection; run it in Bash or Command Prompt, or use your MySQL client's import feature on Windows. Configure a dedicated database user before running the API.

## Scripts

- `npm run dev` — run the frontend and API with reload.
- `npm test` — run API input-validation tests.
- `npm run build` — build the Vue frontend.
- `npm start` — serve the API and built frontend at http://127.0.0.1:3001 after building.
- `docker compose stop` — stop MySQL while retaining the data volume.

## Project layout

```text
client/src/App.vue        Workout form, history, and summaries
client/src/style.css      Responsive styles
server/src/index.js       API routes and parameterized SQL
server/src/validation.js  Workout input validation
database/schema.sql      Tables and muscle-group seeds
compose.yaml             Local MySQL service with persistent storage
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Check database connectivity |
| GET | `/api/muscle-groups` | List available muscle groups |
| GET | `/api/workouts` | List workouts, newest date first |
| POST | `/api/workouts` | Create a workout |
| DELETE | `/api/workouts/:id` | Delete a workout and its group associations |

Example POST body:

```json
{
  "name": "Push day",
  "date": "2026-09-26",
  "durationMinutes": 45,
  "notes": "Bench press: 3 × 8. Shoulder press: 3 × 10.",
  "muscleGroupIds": [1, 3, 5]
}
```

Use IDs returned by `/api/muscle-groups`. Workouts and muscle groups have a many-to-many relationship through `workout_muscle_groups`. Creation uses a transaction; deleting a workout cascades to its associations.

This is a single-user local starter, without authentication, workout editing, or structured exercise/set/rep tracking. Before public deployment, add authentication and per-user ownership, migrations, pagination, and deployment-specific security. The included database passwords are local development defaults. The API and database ports bind to loopback by default. The frontend optionally loads Google Fonts and falls back to system sans-serif fonts offline.
