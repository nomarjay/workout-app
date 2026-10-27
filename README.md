# Form — workout library

Vue 3 + Vite frontend, Express API, and MongoDB storage.

## Run locally

Requires Node.js 22+ and a running MongoDB server.

```powershell
npm install
if (!(Test-Path api/.env)) { Copy-Item api/.env.example api/.env }
npm run db:check
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to port 3001.
Configure `MONGODB_URI` and `MONGODB_DB` in `api/.env` if needed.

The API listens while MongoDB initializes and returns HTTP 503 until it is ready.
Temporary startup connection errors retry automatically with delays of 1–30 seconds;
invalid credentials or initialization errors still stop startup. Connection selection
waits up to 15 seconds. If MongoDB becomes unavailable later, requests return HTTP 503;
use **Reload data** once connectivity returns. Failed writes are not automatically replayed.

## Dashboard homepage

The app opens on **Dashboard**. Expand Profile settings in the client profile card to select a saved user,
or log out and create another profile. Selection is remembered in this browser;
this is a local profile chooser without password authentication. The existing
primary profile keeps its calendar and logs. Each profile has its own calendar,
completed workout history, and personal information. The workout library and
catalog are shared. Profile fields include name, optional email/date of birth/
gender/height/weight, goal, experience, activity level, and weekly target.

Select a calendar date to view its workout. Opening the right-click menu keeps
the current day displayed until you choose View day or another action. Right-click a date (or use Shift+F10
or **Actions for selected day**) to schedule a workout, view the day, start a
session, edit the schedule or routine, change repeat frequency, or remove a
scheduled session. Routine edits affect the shared library; removing a calendar
session keeps the routine and completed logs.

Repeat options are daily, weekly, every two weeks, and monthly, with an end date
within one year. Monthly dates clamp to the last valid day of shorter months.
Repeating sessions store a series ID and frequency. Edit or remove one session,
or apply changes to that session and following sessions. Frequency changes
replace following dates of that series and reject conflicts with other plans.
Existing entries created before series tracking remain independent sessions.

The dashboard shows primary muscles, planned intensity, and planned duration.
Automatic duration estimates 5 minutes warm-up + 6 minutes per exercise + 5
minutes cool-down. **Start workout** lets you change equipment and attachments
for that session; **Finish & log workout** stores a completed snapshot. The
workout log replaces Coming up and supports confirmed deletion of individual logs.
Weekly counts track planned sessions, not completed workouts.

The API selects a profile using `X-Profile-Id` (defaults to the legacy `primary`
profile for existing clients). `GET /api/profiles` lists available profiles and
`POST /api/profiles` creates another one. Schedule and log records are scoped to
that profile. Schedule dates remain local `YYYY-MM-DD` values. Series changes
use `scope: "future"` in PUT or `?scope=future` in DELETE; otherwise only the
selected session changes. Deleting a shared routine removes all its calendar
assignments while preserving completed logs.

## Catalog and workouts

`api/data/catalog.js` merges exercise entries with equipment muscle details and
exports the normalized seeds. Each exercise has `equipmentId`, `muscleGroupId`
(primary category), `muscleGroupIds` (all primary and secondary groups), muscle
names, and a nullable attachment. Seeded Multifunctional Cable Machine attachments are null.
The live catalog is stored in `catalog_exercises` and `catalog_equipment`.
On first startup, the current file-based library seeds these collections using
stable IDs. `catalog_state` records initialization so later restarts preserve
edits and deletions. Existing collections and saved workouts are retained;
no database reset is required. File changes do not overwrite the managed catalog.

The UI has separate Exercises, Equipment, Muscle groups, and Workouts views.
All views support name search, alphabetical sorting, and grid/list display.
Exercises additionally filter by equipment and any associated muscle group.
Cards include image placeholders; an optional `image` URL displays an actual image.

Add exercises to a workout, name it, reorder or remove selections, and save.
Repeated exercises are allowed. MongoDB stores each ordered exercise selection
as a snapshot, preserving the saved workout if catalog details later change.
The unsaved builder is held in memory and resets on page reload.

Use **New exercise** or **New equipment** on the respective tab to create an item.
Each card has edit and delete controls. Exercise editing includes its muscle group,
equipment options, primary/secondary muscles, isolation flag, default attachment,
and optional image URL. Equipment editing includes its type, category, supported
attachments, and optional image URL. Delete requires an inline confirmation.
Items referenced by saved workouts cannot be deleted; equipment also cannot be
deleted while an exercise uses it. Used exercise option keys and equipment types
are protected from removal or replacement. Removing supported attachments is
blocked while exercises or workouts reference them. Unsaved selections are updated
after catalog changes, and deleted options are removed from the draft.

## API

| Method | Path                | Purpose                                                               |
| ------ | ------------------- | --------------------------------------------------------------------- |
| GET    | /api/health         | Database connectivity                                                 |
| GET    | /api/catalog        | Groups, equipment, attachments and exercises                          |
| GET    | /api/muscle-groups  | Muscle groups                                                         |
| GET    | /api/profile        | Client profile, or null if none exists                                |
| POST   | /api/profile        | Create the client profile                                             |
| PUT    | /api/profile        | Update the client profile                                             |
| DELETE | /api/profile        | Delete profile information                                            |
| GET    | /api/schedule       | Dated workout assignments                                             |
| PUT    | /api/schedule/:date | Assign or replace `{ workoutId, durationMinutes }` on a date          |
| DELETE | /api/schedule/:date | Remove the assignment for a date                                      |
| GET    | /api/exercises      | Exercise definitions with equipment options                           |
| GET    | /api/exercises/:id  | One exercise definition                                               |
| POST   | /api/exercises      | Create an exercise definition                                         |
| PUT    | /api/exercises/:id  | Update an exercise definition                                         |
| DELETE | /api/exercises/:id  | Delete an unused exercise                                             |
| GET    | /api/equipment      | Equipment types                                                       |
| GET    | /api/equipment/:id  | One equipment type                                                    |
| POST   | /api/equipment      | Create equipment                                                      |
| PUT    | /api/equipment/:id  | Update equipment                                                      |
| DELETE | /api/equipment/:id  | Delete unused equipment                                               |
| GET    | /api/workouts       | Saved workouts                                                        |
| POST   | /api/workouts       | Save `{ "name": "Push day", "exerciseIds": ["catalog exercise ID"] }` |
| DELETE | /api/workouts/:id   | Delete a workout                                                      |
| PUT    | /api/workouts/:id   | Update a workout name and ordered selections                          |

Exercise writes accept `{ name, muscleGroupId, equipmentOptions }`. Each option
has a stable `key`, `equipmentId`, nullable `attachmentId`, `primaryMuscles` and
`secondaryMuscles` arrays, `isIsolation` boolean, and optional `image` URL.
Equipment writes accept `{ "equipment-type": "Name", category, attachmentIds, image }`;
categories are `Machines`, `Free weights`, `Bodyweight`, or `Other`.
Validation errors return 400, missing records return 404, and reference conflicts
return 409. Workout selections accept `{ exerciseId, equipmentOptionKey, attachment }`.

## Scripts

- pm run dev`: frontend and API with reload
- pm run build`: production frontend
- pm start`: API and built frontend
- pm run db:check`: initialize and check MongoDB
- pm test`: catalog relationship and HTTP workout tests using an in-memory database stub

Selectorized isolation movements use an exercise-level `isIsolation` boolean.
The UI marks exercise variants with this flag set to true. Legacy
isolation equipment ID 2 resolves to selectorized equipment ID 1; the retired
category is hidden. Unrecognized equipment is retained and flagged for correction
instead of preventing the catalog from loading.

Equipment metadata is served from `catalog_equipment`; legacy collections are retained. In the equipment data files,
`equipment-type` replaces the machine-level
ame`property and contains the full type
(e.g.`Multifunctional Cable Machine`). Exercise names remain under 
ame`. Exercise labels show
the equipment type first, e.g. `Multifunctional Cable Machine · Seated Row`. Equipment sorting
uses that full type, then exercise name. The builder Arrange button changes exercise
order; changing catalog sorting does not change the draft.
Selection feedback, undo, collapsible previews, and animated reorder/add/remove
interactions support building a routine. Reduced-motion preferences disable animations.

Exercise cards group matching names by stripping equipment qualifiers and “Seated,”
while preserving movement differences such as incline. Each card offers only
catalog-backed equipment and movement variants. Variants offer an attachment
selector when their equipment supports attachments. The selection
reference lists every draft exercise by name, equipment, and attachment.
Workout POST accepts `selections: [{ exerciseId, attachment }]`; the original
`exerciseIds` request format remains supported. Attachments are validated against
the attachment catalog and saved per selected exercise.

# Percentage-based training

Trainer Mode accepts an optional exercise-specific 1RM (100%). Enter the 1RM,
choose tempo, and click **Calculate based on one rep Max** to populate 3 sets
of 8 reps, 2 reps in reserve, a working load of 75%, and minimum/maximum
planning weights of 70%/80%. These are editable defaults. Only clicking the
button populates or replaces fields; editing inputs never triggers it.
The working load uses inverse Epley:
`load = 1RM / (1 + (reps + reserve) / 30)`. One rep with zero reserve uses
exactly 100%. Suggestions are limited to 1–10 total reps including reserve,
rounded down to two decimals, and can be overridden for equipment increments.
Working weight / 1RM × 100 is displayed for every identical prescribed set.
The API rejects working weights above the entered 1RM. Existing plans without
a 1RM retain their volume calculations. No AI service is used.

Strength relative to bodyweight uses kg-equivalent 1RM / profile weight in kg.
Use consistent equipment and total-load/per-hand conventions. This is an
exercise-specific descriptive measure, not a population percentile or overall
fitness classification. Profile demographics and planned frequency are context;
the app does not infer biological sex from gender or treat scheduled sessions as
completed training. A current fitness score would require validated reference
populations, actual performance history, and broader fitness measurements.

Evidence and limitations: [repetitions–%1RM meta-regression](https://pubmed.ncbi.nlm.nih.gov/37792272/)
reports variation across people and exercises;
[prediction equation research](https://pmc.ncbi.nlm.nih.gov/articles/PMC11435939/)
evaluates Epley and other equations in a specific older-adult population.
Inverse Epley with reserve is a transparent planning heuristic, not an
individualized scientifically validated prescription.
