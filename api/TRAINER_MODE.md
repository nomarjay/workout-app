# Trainer Mode

Workouts describe which exercises to perform and their order. Trainer Mode owns
the training prescriptions and calculations; exercise catalog files and workout
documents do not contain these settings.

`src/trainer-mode.js` is the pure validation/calculation handler.
`src/trainer-mode-routes.js` handles persistence in MongoDB's `trainer_mode`
collection. Each document's `_id` is the workout ID string, ensuring one plan per
workout. No migration is needed for existing workouts.

## API

- `GET /api/trainer-mode`: supported weight units and tempos.
- `PUT /api/trainer-mode/:workoutId`: create or replace all assignments.
- `GET /api/trainer-mode/:workoutId`: read assignments and `needsReview`.
- `POST /api/trainer-mode/:workoutId/calculate`: calculate the saved plan.
- `DELETE /api/trainer-mode/:workoutId`: remove assignments.

Example PUT body for a workout containing one exercise:

```json
{
  "weightUnit": "kg",
  "exercises": [
    {
      "exerciseIndex": 0,
      "minWeight": 10,
      "maxWeight": 50,
      "workingWeight": 30,
      "reps": 10,
      "sets": 3,
      "tempo": "slow-and-controlled"
    }
  ]
}
```

Assign every exercise by its zero-based position so repeated exercises can have
different prescriptions. Weights must be finite and nonnegative; working weight
must lie within the inclusive bounds. Reps and sets must be positive integers.
Tempo is `controlled`, `slow-and-controlled`, or `explosive`. A plan uses one unit
(`kg` or `lb`) throughout; no unit conversion is performed.

Calculations return each prescription with `totalReps = reps * sets` and
`volume = workingWeight * reps * sets`, plus workout totals for sets, reps and
volume. Volume uses the assigned load as entered; it does not infer per-hand
loads, body weight, cable ratios, or tempo durations. Bounds validate assigned
weight; they do not automatically select or progress it.

Changing exercise identity, equipment, attachment, or ordering marks existing
assignments as needing review. Calculation returns 409 until the full plan is
reassigned. Renaming a workout preserves assignments. Deleting a workout removes
its Trainer Mode document. Missing workouts/plans return 404; invalid assignments
return 400. Calculations never write computed values into workouts.

The workout builder offers Trainer Mode as an optional second step after saving.
Users can skip it and return through a saved workout's Trainer Mode button.
Existing assignments load for editing; stale assignments must be entered again
to avoid applying settings to the wrong occurrence. Skipping or cancelling does
not change saved prescriptions. The UI submits assignments to this API; training
calculations remain in the backend. Automatic progression is not implemented.


## Adaptive set plans

Trainer Mode's UI saves `loadMode: "adaptive"` and an optional `weightIncrement`
(default 2.5 kg or 5 lb). For 1–30 reps, the starting load uses inverse Epley
with target reps plus reserve reps; without a 1RM it uses working weight.
The manual maximum caps that starting load. Equal working sets keep the same
load, rounded down to the equipment increment. Set count alone does not predict
fatigue. The preview's optional set feedback changes subsequent suggestions by
available equipment increments: hard = -1, missed reps = -2, easy = +1, target
met = no change. Increases are capped by the manual maximum and 1RM. These are
planning rules, not a validated individual capacity model. Feedback is local to
the preview, not saved as completed performance, and resets when inputs change.
Higher-rep extrapolations are less certain. Changing units does not convert
entered loads; it updates default weight increments to 5 lb or 2.5 kg.

Adaptive calculations include `setPlan` (first 100 sets) and sum each set's
weight times reps for volume, with the same target load for each working set. Existing API plans without loadMode retain fixed-load calculations;
editing and saving through the UI opts them into adaptive planning.


## Algorithm maker and default template

Trainer Mode selects `Default · Four-set progression` when no saved algorithm
snapshot exists. Every exercise uses the same selected template with its own
`referenceMaxWeight`, equipment increment, and tempo. The default sets are:

| Set | Label | % of template maximum | Reps |
| --- | --- | --- | --- |
| 1 | Warm-up | 35% | 12–15 |
| 2 | Set 2 | 50% | 10 |
| 3 | Set 3 | 75% | 8 |
| 4 | Set 4 | 90–95% | 6 |

The reference maximum is entered explicitly; this template does not infer that
the prescribed reps are achievable at each percentage. Weight ranges are rounded
down to equipment increments. Both ends of weight and rep ranges remain visible.

The algorithm maker edits labels, warm-up markers, percentage ranges and rep
ranges; adds/removes sets (1–20); applies a draft; saves named reusable copies;
and updates custom algorithms. The built-in default is immutable and restorable.
`GET/POST /api/trainer-algorithms` list/create algorithms and
`PUT /api/trainer-algorithms/:id` updates a custom algorithm.

Trainer Mode PUT accepts `algorithm: { id, name, sets }` plus exercise entries
`{ exerciseIndex, referenceMaxWeight, weightIncrement, tempo }`. It validates
and stores a snapshot so changing a library algorithm does not rewrite saved
workout plans. Calculation returns individual weight/rep ranges, warm-up flags,
and volume/rep minimum and maximum totals (warm-up included). Existing plans
without an algorithm retain their legacy API calculation until edited and saved.


Trainer Mode retains the original maximum/1RM entry, Calculate button, min/max
and working weights, reps, sets, reserve reps, and tempo alongside the algorithm
maker. Calculate fills these settings from the selected workout algorithm.
Each exercise can opt out with `useAlgorithm: false` to use manual settings.
The UI no longer asks for an equipment increment: algorithm percentages are
calculated to 0.01 units (for example, 35% of 280 lb is 98 lb). Saved legacy
increment fields remain readable for older API clients.


## Smith machine bar resistance

Smith machine inputs represent added plate weight. Equipment ID 5 (or legacy
Smith machine names) has a fixed 12 lb bar, converted using 0.45359237 kg/lb.
Algorithm percentages use the entered maximum plus the bar; resulting loads
cannot fall below the unloaded bar. Manual/adaptive loads and volume include
the same resistance. Inputs remain plate-only when saved and reloaded so the
bar is never added twice. Zero plate weight is valid for Smith maximums.
Calculated form settings subtract the bar before populating plate inputs.
An inline, keyboard-focusable information bubble beside Smith weights reads
“starting resistance set by Smith machine”; there is no separate resistance field.
